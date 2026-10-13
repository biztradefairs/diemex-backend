/**
 * ============================================================================
 * DIEMEX 2027 — Visitor Pass & On-Site Gate Badge Service (PassService.js)
 * ============================================================================
 * 
 * ROLE IN ARCHITECTURE:
 * This service is the core business logic engine for the entire Visitor Pass
 * and Badging subsystem. It handles:
 *  1. Multi-channel OTP authentication (SMS, WhatsApp, Email) & rate-limiting.
 *  2. Verification token generation and session lifecycle management.
 *  3. Visitor registration, database persistence, and unique code generation.
 *  4. High-contrast QR code payload construction and image data generation.
 *  5. Automated digital badge delivery via WhatsApp/SMS/Email.
 *  6. Real-time On-site Gate Scanner validation, duplicate prevention, and check-ins.
 *  7. Live gate security metrics and visitor attendance analytics.
 * ============================================================================
 */

const crypto = require('crypto');
const QRCode = require('qrcode');
const { Op } = require('sequelize');
const modelFactory = require('../models');
const messaging = require('./PassMessagingService');
const emailService = require('./EmailService');
const cloudinaryService = require('./CloudinaryService');

// ============================================================================
// CONFIGURATION CONSTANTS & TIMEOUTS
// ============================================================================

/** OTP Time-To-Live: 10 minutes */
const OTP_TTL_MS = 10 * 60 * 1000;

/** Minimum wait time before allowing OTP resend: 45 seconds */
const OTP_RESEND_MS = 45 * 1000;

/** Verification Token Time-To-Live after successful OTP: 30 minutes */
const VERIFY_TTL_MS = 30 * 60 * 1000;

/** Maximum allowed incorrect OTP attempts before invalidating */
const MAX_OTP_ATTEMPTS = 5;

/** Maximum allowed OTP requests per phone number per hour (Anti-spam / Anti-abuse) */
const MAX_OTP_PER_HOUR = 6;

/** Cooldown period to ignore accidental double scans on gate hardware: 15 seconds */
const SCAN_COOLDOWN_MS = 15 * 1000;

// ============================================================================
// IN-MEMORY SESSION STORES & EVENT METADATA
// ============================================================================

/** In-memory storage for active OTPs keyed by normalized phone number */
const otpStore = new Map();

/** In-memory storage for post-OTP verification tokens before registration completes */
const verifyStore = new Map();

/** Sliding window log of OTP send timestamps per phone for rate-limiting */
const sendLog = new Map();

/** Official Exhibition Metadata attached to every badge */
const EVENT = {
  name: 'DIEMEX 2027',
  dates: '24–26 Mar 2027',
  venue: 'Auto Cluster Exhibition Centre, Pune'
};

// ============================================================================
// HELPER & UTILITY FUNCTIONS
// ============================================================================

/**
 * Prunes expired entries from in-memory session maps.
 * 
 * WHY IT IS USED:
 * Prevents memory leaks in Node.js by evicting stale OTPs and expired tokens.
 * 
 * @param {Map} store - The map store to clean (otpStore or verifyStore)
 */
function pruneStore(store) {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (value.expiresAt && value.expiresAt < now) {
      store.delete(key);
    }
  }
}

/**
 * Masks a phone number for user privacy and compliance.
 * Example: "+913456789012" -> "+913454******12"
 * 
 * WHY IT IS USED:
 * Protects personal information in API responses sent back to the client UI.
 * 
 * @param {string} phone - Full phone number
 * @returns {string} Masked phone number string
 */
function maskPhone(phone) {
  const digits = String(phone || '');
  if (digits.length < 6) return digits;
  return `${digits.slice(0, 4)}${'*'.repeat(Math.max(0, digits.length - 8))}${digits.slice(-4)}`;
}

/**
 * Standardizes raw phone numbers into clean E.164-compatible format.
 * 
 * WHY IT IS USED:
 * Ensures phone numbers are consistent across OTP maps, SMS providers, and SQL queries.
 * 
 * @param {string} countryCode - Dialing code (e.g., "+91", "91")
 * @param {string} nationalNumber - Phone number without country code
 * @returns {{countryCode: string, nationalNumber: string, phone: string}}
 */
function normalizePhone(countryCode, nationalNumber) {
  const cc = String(countryCode || '').replace(/[^\d+]/g, '');
  const nn = String(nationalNumber || '').replace(/\D/g, '');
  const code = cc.startsWith('+') ? cc : `+${cc.replace(/\D/g, '')}`;
  return {
    countryCode: code,
    nationalNumber: nn,
    phone: `${code}${nn}`
  };
}

/**
 * Validates mobile number format based on country rules.
 * 
 * WHY IT IS USED:
 * Performs strict regex validation for Indian numbers (10 digits starting 6-9)
 * and length checks for international delegates before hitting SMS gateways.
 * 
 * @param {string} countryCode - Dialing prefix
 * @param {string} nationalNumber - Digits string
 * @returns {boolean} True if valid
 */
function isValidMobile(countryCode, nationalNumber) {
  const nn = String(nationalNumber || '').replace(/\D/g, '');
  if (countryCode === '+91' || countryCode === '91') {
    return /^[6-9]\d{9}$/.test(nn);
  }
  return /^\d{6,15}$/.test(nn);
}

/**
 * Generates a cryptographically secure 4-digit random OTP.
 * 
 * WHY IT IS USED:
 * Produces unpredictable authentication codes (1000-9999) using Node.js crypto.
 * 
 * @returns {string} 4-digit OTP string
 */
function generateOtp() {
  return String(crypto.randomInt(1000, 10000));
}

/**
 * Generates a cryptographically secure verification token (48 hex chars).
 * 
 * WHY IT IS USED:
 * Issued upon OTP verification as a single-use proof of identity to complete registration.
 * 
 * @returns {string} Hex token string
 */
function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Generates a short, unique 12-character alphanumeric code for public pass URLs.
 * 
 * WHY IT IS USED:
 * Serves as the URL slug for public badge sharing (e.g., `/passes/view/8f7b2c91a03e`).
 * 
 * @returns {string} Unique public slug
 */
function generatePublicCode() {
  return crypto.randomBytes(6).toString('hex');
}

/**
 * Generates the official sequential DIEMEX registration number.
 * Example: "REG-DMX-24032027-104928"
 * 
 * WHY IT IS USED:
 * Provides a standardized, human-readable registration ID for badges and printing.
 * 
 * @returns {string} Official registration ID
 */
function generateRegistrationNumber() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const seq = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  return `REG-DMX-${dd}${mm}${yyyy}-${seq}`;
}

/**
 * Resolves the frontend base URL from environment variables.
 * 
 * WHY IT IS USED:
 * Dynamically builds absolute pass URLs for WhatsApp messages and emails.
 * 
 * @returns {string} Base URL (e.g., "https://diemex.in" or "http://localhost:3001")
 */
function frontendBase() {
  return (process.env.FRONTEND_URL || 'http://localhost:3001').replace(/\/$/, '');
}

/**
 * Constructs the full public web view URL for a visitor pass.
 * 
 * @param {string} publicCode - The unique public slug
 * @returns {string} Absolute URL to view the badge
 */
function passViewUrl(publicCode) {
  return `${frontendBase()}/passes/view/${publicCode}`;
}

/**
 * Validates email address format via standard regular expression.
 * 
 * @param {string} value - Email input
 * @returns {boolean} True if format matches email syntax
 */
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

/**
 * Converts internal channel code to human-readable capitalized text.
 * 
 * @param {'sms'|'whatsapp'|'email'} channel
 * @returns {string} "WhatsApp" | "Email" | "SMS"
 */
function channelLabel(channel) {
  if (channel === 'whatsapp') return 'WhatsApp';
  if (channel === 'email') return 'Email';
  return 'SMS';
}

/**
 * Returns the Date object representing 00:00:00 IST of the current event day.
 * 
 * WHY IT IS USED:
 * Calculates daily gate check-in statistics in Indian Standard Time (Asia/Kolkata).
 * 
 * @param {Date} [date=new Date()]
 * @returns {Date} Start of event day in IST
 */
function startOfEventDay(date = new Date()) {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
  return new Date(`${day}T00:00:00+05:30`);
}

/**
 * Extracts registration code or public slug from various scanner inputs.
 * 
 * WHY IT IS USED:
 * Supports parsing raw QR strings, full badge URLs (`/passes/view/code`),
 * JSON camera payloads, and formatted text lines.
 * 
 * @param {string} raw - Raw scanner input
 * @returns {string} Clean lookup code
 */
function extractPassCode(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';

  const codeLine = text.split(/\r?\n/).find((line) => /code\s*:/i.test(line));
  if (codeLine) return codeLine.replace(/code\s*:/i, '').trim();

  const viewMatch = text.match(/\/passes\/view\/([a-zA-Z0-9-]+)/);
  if (viewMatch) return viewMatch[1];

  try {
    const parsed = JSON.parse(text);
    return parsed.code || parsed.registrationNumber || parsed.publicCode || text;
  } catch {
    return text;
  }
}

/**
 * Generates high-resolution Base64 QR code image Data URL.
 * 
 * WHY IT IS USED:
 * Embeds high-contrast theme-branded QR codes (#0F2F5C on white) for UI display and badges.
 * 
 * @param {string} payload - Text payload to encode
 * @returns {Promise<string>} Base64 image Data URL
 */
async function generateQrDataUrl(payload) {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 360,
    color: {
      dark: '#0F2F5C',
      light: '#FFFFFF'
    }
  });
}

/**
 * Constructs the standard human-readable verification payload embedded in the QR code.
 * 
 * WHY IT IS USED:
 * Encodes attendee details and registration ID for offline gate verification scanners.
 * 
 * @param {Object} pass - The visitor pass database object
 * @returns {string} Plaintext structured QR payload
 */
function buildQrPayload(pass) {
  return [
    EVENT.name,
    'Visitor',
    `Name: ${pass.name}`,
    `Company: ${pass.company}`,
    `Code: ${pass.registrationNumber}`,
    `Date: ${EVENT.dates}`
  ].join('\n');
}

// ============================================================================
// DATABASE MODEL ACCESSORS
// ============================================================================

let VisitorPassModel = null;
let ScanModel = null;
let passTableReady = false;

/**
 * Lazy-loads and synchronizes the Sequelize VisitorPass model.
 * 
 * WHY IT IS USED:
 * Ensures MySQL connection is established before querying and ensures tables exist.
 * 
 * @returns {Promise<Model>} Sequelize VisitorPass model
 */
async function getModel() {
  if (!VisitorPassModel || !ScanModel) {
    const models = await modelFactory.init();
    VisitorPassModel = models.VisitorPass;
    ScanModel = models.VisitorPassScan;
  }
  if (!VisitorPassModel) {
    const error = new Error('Visitor pass storage is not available');
    error.status = 500;
    throw error;
  }
  if (!passTableReady) {
    try {
      await VisitorPassModel.sync();
      if (ScanModel) await ScanModel.sync();
    } catch (error) {
      console.warn('Visitor pass tables already present:', error.message);
    }
    passTableReady = true;
  }
  return VisitorPassModel;
}

/**
 * Lazy-loads and synchronizes the Sequelize VisitorPassScan model.
 * 
 * WHY IT IS USED:
 * Provides access to the gate scan logging table for check-in events.
 * 
 * @returns {Promise<Model>} Sequelize VisitorPassScan model
 */
async function getScanModel() {
  await getModel();
  if (!ScanModel) {
    const error = new Error('Scan storage is not available');
    error.status = 500;
    throw error;
  }
  return ScanModel;
}

/**
 * Evaluates rate-limiting rules for OTP generation requests.
 * 
 * WHY IT IS USED:
 * Protects against SMS bombing and brute-force abuse by enforcing:
 *  1. Max 6 OTP requests per hour per phone.
 *  2. 45-second cooldown between resends.
 * 
 * @param {string} phone - Normalized phone number
 * @returns {{ok: boolean, error?: string, resendIn?: number}}
 */
function canSendOtp(phone) {
  pruneStore(otpStore);
  const now = Date.now();
  const log = (sendLog.get(phone) || []).filter((ts) => now - ts < 60 * 60 * 1000);
  sendLog.set(phone, log);

  if (log.length >= MAX_OTP_PER_HOUR) {
    return { ok: false, error: 'Too many OTP requests. Please try again later.' };
  }

  const existing = otpStore.get(phone);
  if (existing && existing.sentAt && now - existing.sentAt < OTP_RESEND_MS) {
    const wait = Math.ceil((OTP_RESEND_MS - (now - existing.sentAt)) / 1000);
    return { ok: false, error: `Please wait ${wait}s before requesting another OTP.`, resendIn: wait };
  }

  return { ok: true };
}

// ============================================================================
// CORE SERVICE METHODS (EXPORTED API WORKFLOWS)
// ============================================================================

/**
 * Sends a 4-digit OTP via the requested channel (SMS, WhatsApp, Email).
 * 
 * WORKFLOW ROLE:
 * Step 1 of Visitor Registration: Validates phone/email, enforces rate limits,
 * stores the OTP in memory with a 10-minute TTL, and triggers delivery.
 * 
 * @param {Object} params
 * @param {string} params.countryCode - Country dial code (e.g. "+91")
 * @param {string} params.nationalNumber - Mobile number
 * @param {'sms'|'whatsapp'|'email'} params.channel - Desired delivery channel
 * @param {string} [params.email] - Email address (if channel is email)
 * @returns {Promise<Object>} Delivery confirmation & resend timer
 */
async function sendOtp({ countryCode, nationalNumber, channel, email }) {
  const normalized = normalizePhone(countryCode, nationalNumber);
  if (!isValidMobile(normalized.countryCode, normalized.nationalNumber)) {
    const error = new Error('Enter a valid mobile number');
    error.status = 400;
    throw error;
  }

  if (!['sms', 'whatsapp', 'email'].includes(channel)) {
    const error = new Error('Choose SMS, WhatsApp, or Email');
    error.status = 400;
    throw error;
  }

  const cleanEmail = String(email || '').trim().toLowerCase();
  if (channel === 'email' && !isValidEmail(cleanEmail)) {
    const error = new Error('Enter a valid email address');
    error.status = 400;
    throw error;
  }

  // In production, verify that external providers (Twilio/Meta/SendGrid) are configured
  if (process.env.NODE_ENV === 'production' && channel !== 'email' && !messaging.isConfigured(channel)) {
    const error = new Error(`${channelLabel(channel)} delivery is not configured yet.`);
    error.status = 503;
    throw error;
  }

  // Rate-limiting check
  const gate = canSendOtp(normalized.phone);
  if (!gate.ok) {
    const error = new Error(gate.error);
    error.status = 429;
    error.resendIn = gate.resendIn;
    throw error;
  }

  const otp = generateOtp();
  const previous = otpStore.get(normalized.phone) || {};

  // Store OTP in memory
  otpStore.set(normalized.phone, {
    otp,
    channel,
    email: cleanEmail || null,
    countryCode: normalized.countryCode,
    nationalNumber: normalized.nationalNumber,
    expiresAt: Date.now() + OTP_TTL_MS,
    sentAt: Date.now(),
    attempts: 0,
    verified: false
  });

  const log = sendLog.get(normalized.phone) || [];
  log.push(Date.now());
  sendLog.set(normalized.phone, log);

  // Dispatch OTP message
  const delivery = channel === 'email'
    ? await sendEmailOtp(cleanEmail, otp)
    : await messaging.sendOtp({
      phone: normalized.phone,
      channel,
      otp
    });

  if (!delivery.success) {
    if (previous.otp) otpStore.set(normalized.phone, previous);
    else otpStore.delete(normalized.phone);
    const error = new Error(delivery.error || 'Failed to send OTP');
    error.status = 502;
    throw error;
  }

  return {
    success: true,
    message: `OTP sent via ${channelLabel(channel)}`,
    channel,
    phone: maskPhone(normalized.phone),
    e164: normalized.phone,
    expiresIn: Math.floor(OTP_TTL_MS / 1000),
    resendIn: Math.floor(OTP_RESEND_MS / 1000),
    provider: delivery.provider,
    simulated: Boolean(delivery.simulated)
  };
}

/**
 * Verifies submitted OTP and issues a verification session token.
 * 
 * WORKFLOW ROLE:
 * Step 2 of Visitor Registration:
 *  - Checks OTP match and validates attempt limits.
 *  - If user is ALREADY REGISTERED, fetches and returns their existing badge immediately.
 *  - If user is NEW, generates a 30-minute verification token to proceed to profile entry.
 * 
 * @param {Object} params
 * @param {string} params.countryCode - Dialing code
 * @param {string} params.nationalNumber - Mobile number
 * @param {string} params.otp - 4-digit OTP submitted by user
 * @returns {Promise<Object>} Verification status, token, and existing pass if registered
 */
async function verifyOtp({ countryCode, nationalNumber, otp }) {
  pruneStore(otpStore);
  pruneStore(verifyStore);

  const normalized = normalizePhone(countryCode, nationalNumber);
  const stored = otpStore.get(normalized.phone);

  if (!stored) {
    const error = new Error('No OTP found. Please request a new one.');
    error.status = 400;
    throw error;
  }

  if (stored.expiresAt < Date.now()) {
    otpStore.delete(normalized.phone);
    const error = new Error('OTP has expired. Please request a new one.');
    error.status = 400;
    throw error;
  }

  // Brute-force protection: max 5 attempts
  stored.attempts += 1;
  if (stored.attempts > MAX_OTP_ATTEMPTS) {
    otpStore.delete(normalized.phone);
    const error = new Error('Too many incorrect attempts. Please request a new OTP.');
    error.status = 429;
    throw error;
  }

  if (String(stored.otp) !== String(otp).trim()) {
    const error = new Error('Invalid OTP. Please try again.');
    error.status = 400;
    throw error;
  }

  // OTP verified successfully -> clear from active OTP store
  otpStore.delete(normalized.phone);

  const verificationToken = generateToken();
  const VisitorPass = await getModel();
  const existing = await VisitorPass.findOne({
    where: { phone: normalized.phone },
    order: [['createdAt', 'DESC']]
  });

  // Store verification session for form completion
  verifyStore.set(verificationToken, {
    phone: normalized.phone,
    countryCode: stored.countryCode,
    nationalNumber: stored.nationalNumber,
    channel: stored.channel,
    email: stored.email || null,
    expiresAt: Date.now() + VERIFY_TTL_MS,
    existingPassId: existing?.id || null
  });

  let delivery = null;
  if (existing) {
    delivery = await deliverPass(existing, stored.channel);
  }

  return {
    success: true,
    message: 'Phone number verified',
    verificationToken,
    channel: stored.channel,
    phone: maskPhone(normalized.phone),
    e164: normalized.phone,
    countryCode: stored.countryCode,
    nationalNumber: stored.nationalNumber,
    alreadyRegistered: Boolean(existing),
    pass: existing ? await serializePass(existing) : null,
    delivery
  };
}

/**
 * Completes new visitor registration and issues the digital QR pass.
 * 
 * WORKFLOW ROLE:
 * Step 3 of Visitor Registration: Validates the verification token, creates the
 * permanent `VisitorPass` database record, generates QR payload, and dispatches
 * the digital badge via WhatsApp/SMS/Email.
 * 
 * @param {Object} params
 * @param {string} params.verificationToken - Token issued from verifyOtp
 * @param {Object} params.payload - Visitor profile (name, company, interests, location, etc.)
 * @returns {Promise<Object>} Serialized pass and delivery status
 */
async function completeRegistration({ verificationToken, payload }) {
  pruneStore(verifyStore);
  const session = verifyStore.get(verificationToken);

  if (!session) {
    const error = new Error('Verification expired. Please verify your number again.');
    error.status = 401;
    throw error;
  }

  const name = String(payload.name || '').trim();
  const company = String(payload.company || '').trim();
  const interests = Array.isArray(payload.interests) ? payload.interests.filter(Boolean) : [];

  if (!name || name.length < 2) {
    const error = new Error('Please enter your full name');
    error.status = 400;
    throw error;
  }
  if (!company) {
    const error = new Error('Please enter your company or firm name');
    error.status = 400;
    throw error;
  }
  if (interests.length < 1) {
    const error = new Error('Please select at least one interest');
    error.status = 400;
    throw error;
  }

  const VisitorPass = await getModel();
  const registrationNumber = generateRegistrationNumber();
  const publicCode = generatePublicCode();

  // Create permanent VisitorPass record in database
  const pass = await VisitorPass.create({
    registrationNumber,
    publicCode,
    phone: session.phone,
    countryCode: session.countryCode,
    nationalNumber: session.nationalNumber,
    channel: session.channel,
    name,
    company,
    designation: payload.designation || null,
    email: payload.email || session.email || null,
    area: payload.area || null,
    city: payload.city || null,
    state: payload.state || null,
    country: payload.country || (session.countryCode === '+91' ? 'India' : null),
    pinCode: payload.pinCode || null,
    source: payload.source || null,
    interests,
    verifiedAt: new Date(),
    issuedAt: new Date(),
    status: 'issued'
  });

  // Attach formatted QR text payload
  pass.qrPayload = buildQrPayload(pass);
  await pass.save();

  // Consume verification session token
  verifyStore.delete(verificationToken);

  // Deliver pass link to attendee's device
  const delivery = await deliverPass(pass, session.channel);
  return {
    success: true,
    message: 'Registration completed',
    pass: await serializePass(pass),
    delivery
  };
}

/**
 * Resends a digital visitor badge to the user's selected channel.
 * 
 * WHY IT IS USED:
 * Allows attendees on the success screen or public link to re-trigger
 * SMS/WhatsApp dispatch if the original message was missed.
 * 
 * @param {Object} params
 * @param {string} [params.verificationToken] - Session verification token
 * @param {string} [params.publicCode] - Pass public slug
 * @param {'sms'|'whatsapp'|'email'} [params.channel] - Override delivery channel
 * @returns {Promise<Object>} Resend delivery status
 */
async function resendPass({ verificationToken, publicCode, channel }) {
  pruneStore(verifyStore);
  const VisitorPass = await getModel();
  let pass = null;
  let sendChannel = channel;

  if (verificationToken) {
    const session = verifyStore.get(verificationToken);
    if (!session) {
      const error = new Error('Verification expired. Please verify your number again.');
      error.status = 401;
      throw error;
    }
    pass = await VisitorPass.findOne({
      where: session.existingPassId
        ? { id: session.existingPassId }
        : { phone: session.phone },
      order: [['createdAt', 'DESC']]
    });
    sendChannel = sendChannel || session.channel;
  } else if (publicCode) {
    pass = await VisitorPass.findOne({ where: { publicCode } });
  }

  if (!pass) {
    const error = new Error('Visitor pass not found');
    error.status = 404;
    throw error;
  }

  const delivery = await deliverPass(pass, sendChannel || pass.channel);
  return {
    success: true,
    message: 'Pass sent',
    pass: await serializePass(pass),
    delivery
  };
}

/**
 * Handles the actual transport delivery of a visitor badge link.
 * 
 * WHY IT IS USED:
 * Formats message templates, invokes PassMessagingService / EmailService,
 * and updates `sentAt`, `sentVia`, and `sentStatus` in the database.
 * 
 * @param {Object} pass - VisitorPass database entity
 * @param {'sms'|'whatsapp'|'email'} [channel] - Transport channel
 * @returns {Promise<Object>} Transport result and WhatsApp click-to-chat URL
 */
async function deliverPass(pass, channel) {
  const sendChannel = channel || pass.channel;
  const passUrl = passViewUrl(pass.publicCode);

  let mediaUrl = null;
  // If delivering via WhatsApp and Cloudinary is configured, generate and upload QR image
  if (sendChannel === 'whatsapp' && process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
    try {
      const qrPayload = pass.qrPayload || buildQrPayload(pass);
      const qrBuffer = await QRCode.toBuffer(qrPayload, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 500,
        color: {
          dark: '#0F2F5C',
          light: '#FFFFFF'
        }
      });
      const uploadRes = await cloudinaryService.uploadImage(qrBuffer, {
        folder: 'visitor-passes',
        public_id: `qr-${pass.registrationNumber}`,
        overwrite: true
      });
      if (uploadRes?.secure_url) {
        mediaUrl = uploadRes.secure_url;
      }
    } catch (err) {
      console.warn('[PassService] Cloudinary QR upload skipped:', err.message);
    }
  }

  const result = sendChannel === 'email'
    ? await sendEmailPass(pass, passUrl)
    : await messaging.sendPass({
      phone: pass.phone,
      channel: sendChannel,
      name: pass.name,
      registrationNumber: pass.registrationNumber,
      passUrl,
      mediaUrl
    });

  pass.sentAt = new Date();
  pass.sentVia = sendChannel;
  pass.sentStatus = result.success ? (result.simulated ? 'simulated' : 'sent') : 'failed';
  await pass.save();

  return {
    success: result.success,
    simulated: Boolean(result.simulated),
    provider: result.provider,
    channel: sendChannel,
    whatsappUrl: result.whatsappUrl,
    passUrl,
    mediaUrl: result.mediaUrl || mediaUrl,
    error: result.error || null
  };
}

/**
 * Fetches and serializes a public visitor pass by publicCode or registrationNumber.
 * 
 * WORKFLOW ROLE:
 * Powers the public badge web page (`GET /api/passes/:code` -> `/passes/view/[code]`).
 * 
 * @param {string} code - Alphanumeric public slug or REG-DMX registration number
 * @returns {Promise<Object>} Fully serialized visitor pass with QR code Data URL
 */
async function getPassByCode(code) {
  const VisitorPass = await getModel();
  const pass = await VisitorPass.findOne({
    where: {
      [Op.or]: [
        { publicCode: code },
        { registrationNumber: code }
      ]
    }
  });

  if (!pass) {
    const error = new Error('Visitor pass not found');
    error.status = 404;
    throw error;
  }

  return serializePass(pass);
}

/**
 * Internal helper to lookup a pass from raw QR scan payloads.
 * 
 * @param {string} code - Raw scanned text or code
 * @returns {Promise<Object|null>} Pass database model instance
 */
async function findPassByCode(code) {
  const VisitorPass = await getModel();
  const lookup = extractPassCode(code);
  if (!lookup) return null;

  return VisitorPass.findOne({
    where: {
      [Op.or]: [
        { publicCode: lookup },
        { registrationNumber: lookup }
      ]
    }
  });
}

/**
 * Records an on-site venue gate entry scan event.
 * 
 * WORKFLOW ROLE:
 * Powers the gate QR scanner (`POST /api/passes/scan` -> `/scanner`):
 *  1. Looks up visitor pass by scanned QR code.
 *  2. Checks for duplicate scan within 15-second cooldown window.
 *  3. Records gate scan timestamp and device ID in `visitor_pass_scans` table.
 *  4. Computes real-time statistics: today's entry count and total event visits.
 * 
 * @param {Object} params
 * @param {string} params.code - Scanned QR text or pass code
 * @param {string} [params.scannerId] - Unique hardware identifier of scanning device
 * @returns {Promise<Object>} Scan validation outcome and visitor summary
 */
async function recordScan({ code, scannerId }) {
  const pass = await findPassByCode(code);
  if (!pass || pass.status === 'cancelled') {
    const error = new Error('Invalid Pass');
    error.status = 404;
    throw error;
  }

  const Scan = await getScanModel();
  const deviceId = String(scannerId || '').trim().slice(0, 64) || null;
  const now = new Date();

  // Check 15-second debounce cooldown to ignore accidental rapid double scans
  const recentScan = await Scan.findOne({
    where: {
      visitorPassId: pass.id,
      ...(deviceId ? { scannerId: deviceId } : {}),
      scannedAt: { [Op.gte]: new Date(now.getTime() - SCAN_COOLDOWN_MS) }
    },
    order: [['scannedAt', 'DESC']]
  });

  if (recentScan) {
    return {
      success: true,
      duplicate: true,
      message: 'Pass was just scanned',
      visitor: scanVisitor(pass),
      scannedAt: recentScan.scannedAt
    };
  }

  // Create gate scan entry log
  const scan = await Scan.create({
    visitorPassId: pass.id,
    scannerId: deviceId,
    scannedAt: now
  });

  const todayStart = startOfEventDay(now);
  const [todayVisit, eventVisits] = await Promise.all([
    Scan.count({
      where: {
        visitorPassId: pass.id,
        scannedAt: { [Op.gte]: todayStart }
      }
    }),
    Scan.count({ where: { visitorPassId: pass.id } })
  ]);

  return {
    success: true,
    duplicate: false,
    message: 'Scan recorded',
    visitor: scanVisitor(pass),
    scannedAt: scan.scannedAt,
    todayVisit,
    eventVisits
  };
}

/**
 * Aggregates real-time gate security statistics and recent check-ins.
 * 
 * WORKFLOW ROLE:
 * Powers the live analytics panel on the security scanner screen:
 *  - Today's total scan count
 *  - Unique visitor entries count
 *  - Repeat visit count
 *  - Live feed of the last 8 scanned attendees
 * 
 * @returns {Promise<Object>} Scanner analytics summary
 */
async function scannerSummary() {
  const Scan = await getScanModel();
  const VisitorPass = await getModel();
  const todayStart = startOfEventDay();

  const [todayScans, todayGroups, recent] = await Promise.all([
    Scan.count({ where: { scannedAt: { [Op.gte]: todayStart } } }),
    Scan.findAll({
      attributes: ['visitorPassId'],
      where: { scannedAt: { [Op.gte]: todayStart } },
      group: ['visitorPassId']
    }),
    Scan.findAll({
      order: [['scannedAt', 'DESC']],
      limit: 8
    })
  ]);

  const uniqueVisitors = todayGroups.length;
  const ids = [...new Set(recent.map((row) => row.visitorPassId))];
  const passes = ids.length
    ? await VisitorPass.findAll({ where: { id: ids } })
    : [];
  const byId = new Map(passes.map((pass) => [pass.id, pass]));

  return {
    success: true,
    today: {
      scans: todayScans,
      visitors: uniqueVisitors,
      repeat: Math.max(0, todayScans - uniqueVisitors)
    },
    recent: recent.map((row) => {
      const pass = byId.get(row.visitorPassId);
      return {
        id: row.id,
        name: pass?.name || 'Visitor',
        company: pass?.company || '',
        registrationNumber: pass?.registrationNumber || '',
        scannedAt: row.scannedAt
      };
    })
  };
}

/**
 * Formats minimal visitor details for instant scanner feedback.
 * 
 * @param {Object} pass - VisitorPass database entity
 * @returns {{name: string, company: string, registrationNumber: string, publicCode: string}}
 */
function scanVisitor(pass) {
  return {
    name: pass.name,
    company: pass.company,
    registrationNumber: pass.registrationNumber,
    publicCode: pass.publicCode
  };
}

/**
 * Sends OTP email via EmailService.
 * 
 * @param {string} email - Recipient email
 * @param {string} otp - 4-digit OTP code
 * @returns {Promise<Object>} Delivery outcome
 */
async function sendEmailOtp(email, otp) {
  const result = await emailService.sendVisitorOTP(email, 'Visitor', otp);
  if (result?.success) {
    return { success: true, provider: result.provider || 'email' };
  }

  return {
    success: false,
    provider: 'email',
    error: result?.error || 'Failed to send OTP email'
  };
}

/**
 * Sends formatted HTML visitor pass email with public view link.
 * 
 * @param {Object} pass - VisitorPass database entity
 * @param {string} passUrl - Web link to digital badge
 * @returns {Promise<Object>} Delivery outcome
 */
async function sendEmailPass(pass, passUrl) {
  const to = pass.email;
  if (!to) {
    return { success: false, provider: 'email', error: 'No email address on this pass' };
  }

  const html = `
    <p>Dear ${pass.name},</p>
    <p>Your DIEMEX 2027 visitor pass is ready.</p>
    <p><strong>${pass.registrationNumber}</strong></p>
    <p>Open this link on your phone and show the QR at the entrance:</p>
    <p><a href="${passUrl}">${passUrl}</a></p>
    <p>24–26 Mar 2027 · Auto Cluster Exhibition Centre, Pune</p>
  `;
  const result = await emailService.sendEmail(to, 'Your DIEMEX 2027 Visitor Pass', html);
  if (result?.success) {
    return { success: true, provider: result.provider || 'email', passUrl };
  }

  return {
    success: false,
    provider: 'email',
    error: result?.error || 'Failed to send pass email'
  };
}

/**
 * Legacy check-in wrapper for backward compatibility with older endpoints.
 * 
 * @param {string} code - Pass code
 * @returns {Promise<Object>} Scan result
 */
async function checkIn(code) {
  const result = await recordScan({ code, scannerId: 'legacy-check-in' });
  return {
    ...result,
    alreadyCheckedIn: false,
    message: result.duplicate ? result.message : 'Scan recorded',
    pass: result.visitor
  };
}

/**
 * Serializes a database VisitorPass record into a complete API response object.
 * 
 * WHY IT IS USED:
 * Assembles all required badge elements: Base64 QR code Data URL, masked phone,
 * formatted location, public URL, and exhibition dates.
 * 
 * @param {Object} pass - VisitorPass database entity
 * @returns {Promise<Object>} Complete serialized VisitorPass DTO
 */
async function serializePass(pass) {
  const qrPayload = pass.qrPayload || buildQrPayload(pass);
  const qrDataUrl = await generateQrDataUrl(qrPayload);
  const location = [pass.area, pass.city, pass.state].filter(Boolean).join(', ');

  return {
    id: pass.id,
    registrationNumber: pass.registrationNumber,
    publicCode: pass.publicCode,
    name: pass.name,
    company: pass.company,
    designation: pass.designation,
    phone: pass.phone,
    maskedPhone: maskPhone(pass.phone),
    countryCode: pass.countryCode,
    nationalNumber: pass.nationalNumber,
    channel: pass.channel,
    email: pass.email,
    area: pass.area,
    city: pass.city,
    state: pass.state,
    country: pass.country,
    pinCode: pass.pinCode,
    location,
    source: pass.source,
    interests: pass.interests || [],
    status: pass.status,
    issuedAt: pass.issuedAt,
    sentAt: pass.sentAt,
    sentVia: pass.sentVia,
    sentStatus: pass.sentStatus,
    checkedInAt: pass.checkedInAt,
    qrPayload,
    qrDataUrl,
    passUrl: passViewUrl(pass.publicCode),
    event: EVENT
  };
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
  sendOtp,
  verifyOtp,
  completeRegistration,
  resendPass,
  getPassByCode,
  recordScan,
  scannerSummary,
  checkIn,
  normalizePhone,
  EVENT
};
