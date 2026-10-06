const crypto = require('crypto');
const QRCode = require('qrcode');
const { Op } = require('sequelize');
const modelFactory = require('../models');
const messaging = require('./PassMessagingService');
const emailService = require('./EmailService');

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_MS = 45 * 1000;
const VERIFY_TTL_MS = 30 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const MAX_OTP_PER_HOUR = 6;
const SCAN_COOLDOWN_MS = 15 * 1000;

const otpStore = new Map();
const verifyStore = new Map();
const sendLog = new Map();

const EVENT = {
  name: 'DIEMEX 2027',
  dates: '24–26 Mar 2027',
  venue: 'Auto Cluster Exhibition Centre, Pune'
};

function pruneStore(store) {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (value.expiresAt && value.expiresAt < now) {
      store.delete(key);
    }
  }
}

function maskPhone(phone) {
  const digits = String(phone || '');
  if (digits.length < 6) return digits;
  return `${digits.slice(0, 4)}${'*'.repeat(Math.max(0, digits.length - 8))}${digits.slice(-4)}`;
}

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

function isValidMobile(countryCode, nationalNumber) {
  const nn = String(nationalNumber || '').replace(/\D/g, '');
  if (countryCode === '+91' || countryCode === '91') {
    return /^[6-9]\d{9}$/.test(nn);
  }
  return /^\d{6,15}$/.test(nn);
}

function generateOtp() {
  return String(crypto.randomInt(1000, 10000));
}

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

function generatePublicCode() {
  return crypto.randomBytes(6).toString('hex');
}

function generateRegistrationNumber() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const seq = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  return `REG-DMX-${dd}${mm}${yyyy}-${seq}`;
}

function frontendBase() {
  return (process.env.FRONTEND_URL || 'http://localhost:3001').replace(/\/$/, '');
}

function passViewUrl(publicCode) {
  return `${frontendBase()}/passes/view/${publicCode}`;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function channelLabel(channel) {
  if (channel === 'whatsapp') return 'WhatsApp';
  if (channel === 'email') return 'Email';
  return 'SMS';
}

function startOfEventDay(date = new Date()) {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
  return new Date(`${day}T00:00:00+05:30`);
}

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

let VisitorPassModel = null;
let ScanModel = null;
let passTableReady = false;

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

async function getScanModel() {
  await getModel();
  if (!ScanModel) {
    const error = new Error('Scan storage is not available');
    error.status = 500;
    throw error;
  }
  return ScanModel;
}

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

  if (channel !== 'email' && !messaging.isConfigured(channel)) {
    const error = new Error(`${channelLabel(channel)} delivery is not configured yet.`);
    error.status = 503;
    throw error;
  }

  const gate = canSendOtp(normalized.phone);
  if (!gate.ok) {
    const error = new Error(gate.error);
    error.status = 429;
    error.resendIn = gate.resendIn;
    throw error;
  }

  const useTwilioVerify = channel !== 'email' && messaging.verifyReady();
  const otp = useTwilioVerify ? null : generateOtp();
  const previous = otpStore.get(normalized.phone) || {};

  otpStore.set(normalized.phone, {
    otp,
    twilioVerify: useTwilioVerify,
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
    simulated: Boolean(delivery.simulated),
    digits: delivery.digits || (useTwilioVerify ? messaging.verifyCodeLength() : 4)
  };
}

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

  stored.attempts += 1;
  if (stored.attempts > MAX_OTP_ATTEMPTS) {
    otpStore.delete(normalized.phone);
    const error = new Error('Too many incorrect attempts. Please request a new OTP.');
    error.status = 429;
    throw error;
  }

  if (stored.twilioVerify) {
    const check = await messaging.checkVerification({
      phone: normalized.phone,
      code: otp
    });
    if (!check.approved) {
      const error = new Error(check.error || 'Invalid OTP. Please try again.');
      error.status = 400;
      throw error;
    }
  } else if (String(stored.otp) !== String(otp).trim()) {
    const error = new Error('Invalid OTP. Please try again.');
    error.status = 400;
    throw error;
  }

  otpStore.delete(normalized.phone);

  const verificationToken = generateToken();
  const VisitorPass = await getModel();
  const existing = await VisitorPass.findOne({
    where: { phone: normalized.phone },
    order: [['createdAt', 'DESC']]
  });

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

  pass.qrPayload = buildQrPayload(pass);
  await pass.save();

  verifyStore.delete(verificationToken);

  const delivery = await deliverPass(pass, session.channel);
  return {
    success: true,
    message: 'Registration completed',
    pass: await serializePass(pass),
    delivery
  };
}

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

async function deliverPass(pass, channel) {
  const sendChannel = channel || pass.channel;
  const passUrl = passViewUrl(pass.publicCode);
  const result = sendChannel === 'email'
    ? await sendEmailPass(pass, passUrl)
    : await messaging.sendPass({
      phone: pass.phone,
      channel: sendChannel,
      name: pass.name,
      registrationNumber: pass.registrationNumber,
      passUrl
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
    error: result.error || null
  };
}

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

function scanVisitor(pass) {
  return {
    name: pass.name,
    company: pass.company,
    registrationNumber: pass.registrationNumber,
    publicCode: pass.publicCode
  };
}

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

async function checkIn(code) {
  const result = await recordScan({ code, scannerId: 'legacy-check-in' });
  return {
    ...result,
    alreadyCheckedIn: false,
    message: result.duplicate ? result.message : 'Scan recorded',
    pass: result.visitor
  };
}

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
