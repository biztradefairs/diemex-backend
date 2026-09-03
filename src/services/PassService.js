const crypto = require('crypto');
const QRCode = require('qrcode');
const { Op } = require('sequelize');
const modelFactory = require('../models');
const messaging = require('./PassMessagingService');

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_MS = 45 * 1000;
const VERIFY_TTL_MS = 30 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const MAX_OTP_PER_HOUR = 6;

const otpStore = new Map();
const verifyStore = new Map();
const sendLog = new Map();

const EVENT = {
  name: 'DIEMEX 2026',
  dates: '8–10 Oct 2026',
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

function includeDevOtp() {
  return process.env.NODE_ENV !== 'production';
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
let passTableReady = false;

async function getModel() {
  if (!VisitorPassModel) {
    const models = await modelFactory.init();
    VisitorPassModel = models.VisitorPass;
  }
  if (!VisitorPassModel) {
    const error = new Error('Visitor pass storage is not available');
    error.status = 500;
    throw error;
  }
  if (!passTableReady) {
    await VisitorPassModel.sync();
    passTableReady = true;
  }
  return VisitorPassModel;
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

async function sendOtp({ countryCode, nationalNumber, channel }) {
  const normalized = normalizePhone(countryCode, nationalNumber);
  if (!isValidMobile(normalized.countryCode, normalized.nationalNumber)) {
    const error = new Error('Enter a valid mobile number');
    error.status = 400;
    throw error;
  }

  if (!['sms', 'whatsapp'].includes(channel)) {
    const error = new Error('Choose SMS or WhatsApp');
    error.status = 400;
    throw error;
  }

  if (process.env.NODE_ENV === 'production' && !messaging.isConfigured(channel)) {
    const error = new Error(`${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} delivery is not configured yet.`);
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

  const otp = generateOtp();
  const previous = otpStore.get(normalized.phone) || {};

  otpStore.set(normalized.phone, {
    otp,
    channel,
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

  const delivery = await messaging.sendOtp({
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
    message: `OTP sent via ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}`,
    channel,
    phone: maskPhone(normalized.phone),
    e164: normalized.phone,
    expiresIn: Math.floor(OTP_TTL_MS / 1000),
    resendIn: Math.floor(OTP_RESEND_MS / 1000),
    provider: delivery.provider,
    simulated: Boolean(delivery.simulated),
    ...(includeDevOtp() ? { devOtp: otp } : {})
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

  if (String(stored.otp) !== String(otp).trim()) {
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
    email: payload.email || null,
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
  const result = await messaging.sendPass({
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

async function checkIn(code) {
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

  if (pass.status === 'checked_in') {
    return {
      success: true,
      alreadyCheckedIn: true,
      message: 'Visitor already checked in',
      checkInTime: pass.checkedInAt,
      pass: await serializePass(pass)
    };
  }

  pass.status = 'checked_in';
  pass.checkedInAt = new Date();
  await pass.save();

  return {
    success: true,
    alreadyCheckedIn: false,
    message: 'Visitor checked in successfully',
    checkInTime: pass.checkedInAt,
    pass: await serializePass(pass)
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
  checkIn,
  normalizePhone,
  EVENT
};
