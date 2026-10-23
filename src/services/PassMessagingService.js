const axios = require('axios');
const twilio = require('twilio');

// OTPs use Verify; visitor passes use Programmable Messaging.
class PassMessagingService {
  twilioClient() {
    const sid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
    const token = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
    if (!sid || !token) return null;
    const key = sid + ':' + token;
    if (this.clientKey !== key) {
      this.client = twilio(sid, token);
      this.clientKey = key;
      this.verifySettings = null;
    }
    return this.client;
  }

  verifyReady() {
    return Boolean(this.twilioClient() && process.env.TWILIO_VERIFY_SERVICE_SID?.trim());
  }

  verifyCodeLength() {
    const digits = Number(process.env.TWILIO_VERIFY_CODE_LENGTH || 6);
    return Number.isInteger(digits) && digits >= 4 && digits <= 10 ? digits : 6;
  }

  smsFrom() {
    return String(process.env.TWILIO_SMS_FROM || '').trim() ||
      String(process.env.TWILIO_PHONE_NUMBER || '').trim();
  }

  smsMessagingServiceSid() {
    return String(process.env.TWILIO_SMS_MESSAGING_SERVICE_SID || '').trim();
  }

  whatsAppFrom() {
    const sender = String(process.env.TWILIO_WHATSAPP_FROM || '').trim();
    return sender ? (sender.startsWith('whatsapp:') ? sender : 'whatsapp:' + sender) : '';
  }

  getSmsProvider() {
    if (this.twilioClient() && (this.smsMessagingServiceSid() || this.smsFrom())) return 'twilio';
    if (process.env.MSG91_AUTH_KEY) return 'msg91';
    return process.env.NODE_ENV === 'production' ? null : 'dev';
  }

  getWhatsAppProvider() {
    if (this.twilioClient() && this.whatsAppFrom()) return 'twilio';
    if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) return 'meta';
    return process.env.NODE_ENV === 'production' ? null : 'dev';
  }

  getProvider(channel) {
    if (channel === 'whatsapp') return this.getWhatsAppProvider();
    if (channel === 'sms') return this.getSmsProvider();
    return null;
  }

  isConfigured(channel, kind = 'pass') {
    if (!['sms', 'whatsapp'].includes(channel)) return false;
    if (kind === 'otp' && this.verifyReady()) return true;
    const provider = this.getProvider(channel);
    return Boolean(provider && provider !== 'dev');
  }

  buildWhatsAppLink(phone, text) {
    return 'https://wa.me/' + String(phone || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(text);
  }

  async sendOtp({ phone, channel, otp }) {
    if (this.verifyReady()) return this.startVerification({ phone, channel });
    const message = 'DIEMEX: Your verification code is ' + otp + '. Valid for 10 minutes. Do not share.';
    const result = await this.sendMessage({
      phone, channel, message, kind: 'otp', templateData: { otp }
    });
    return { ...result, digits: 4, managed: false };
  }

  async startVerification({ phone, channel }) {
    if (!this.verifyReady()) {
      return { success: false, provider: 'twilio-verify', error: 'Twilio Verify is not configured.' };
    }
    try {
      const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID.trim();
      const service = this.twilioClient().verify.v2.services(serviceSid);
      // Read the actual service length so the browser renders the right number of inputs.
      if (!this.verifySettings || this.verifySettings.sid !== serviceSid ||
          this.verifySettings.expiresAt < Date.now()) {
        const settings = await service.fetch();
        this.verifySettings = {
          sid: serviceSid,
          digits: settings.codeLength || this.verifyCodeLength(),
          expiresAt: Date.now() + 5 * 60 * 1000
        };
      }
      const verification = await service.verifications.create({ to: phone, channel });
      return {
        success: ['pending', 'approved'].includes(verification.status),
        provider: 'twilio-verify', managed: true,
        digits: this.verifySettings.digits, status: verification.status
      };
    } catch (error) {
      return { success: false, provider: 'twilio-verify', error: this.describeError(error) };
    }
  }

  async checkVerification({ phone, code }) {
    if (!this.verifyReady()) return { approved: false, error: 'Twilio Verify is not configured.' };
    try {
      const check = await this.twilioClient().verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID.trim())
        .verificationChecks.create({ to: phone, code: String(code || '').trim() });
      return { approved: check.status === 'approved', status: check.status };
    } catch (error) {
      return { approved: false, error: this.describeError(error) };
    }
  }

  async sendPass({ phone, channel, name, registrationNumber, passUrl, mediaUrl }) {
    const message = 'DIEMEX 2027: Hi ' + name + ', your visitor pass ' +
      registrationNumber + ' is ready. Show this QR at entry: ' + passUrl;
    const result = await this.sendMessage({
      phone, channel, message, mediaUrl, kind: 'pass',
      templateData: {
        name, registrationNumber, passUrl, mediaUrl,
        publicCode: passUrl.split('/').filter(Boolean).pop(),
        eventName: 'DIEMEX 2027', eventDates: '24–26 Mar 2027',
        venue: 'Auto Cluster Exhibition Centre, Pune'
      }
    });
    return { ...result, message, mediaUrl, whatsappUrl: this.buildWhatsAppLink(phone, message) };
  }

  async sendVisitorBadgeWhatsApp({ phone, badgeUrl, registrationNumber }) {
    return this.sendMessage({
      phone, channel: 'whatsapp', kind: 'pass', mediaUrl: badgeUrl,
      message: 'DIEMEX 2027 visitor badge: ' + registrationNumber,
      templateData: { registrationNumber, mediaUrl: badgeUrl }
    });
  }

  async sendMessage({ phone, channel, message, mediaUrl, kind, templateData }) {
    const provider = this.getProvider(channel);
    if (!provider) {
      return { success: false, provider: null, error: channel.toUpperCase() + ' delivery is not configured.' };
    }
    if (provider === 'dev') {
      console.log('[PassMessaging] Simulated ' + channel + ' ' + kind + ': ' + message);
      return { success: true, provider, simulated: true, mediaUrl };
    }
    try {
      let response;
      if (provider === 'twilio' && channel === 'whatsapp') {
        response = await this.sendTwilioWhatsApp(phone, kind, templateData);
      } else if (provider === 'twilio') {
        response = await this.sendTwilioSms(phone, message);
      } else if (provider === 'meta') {
        await this.sendMetaWhatsApp(phone, message, mediaUrl);
      } else if (provider === 'msg91') {
        await this.sendMsg91Sms(phone, message);
      }
      return {
        success: true, provider, mediaUrl,
        messageSid: response?.sid || null, status: response?.status || 'accepted'
      };
    } catch (error) {
      return { success: false, provider, error: this.describeError(error) };
    }
  }

  twilioAuth() {
    return {
      username: process.env.TWILIO_ACCOUNT_SID.trim(),
      password: process.env.TWILIO_AUTH_TOKEN.trim()
    };
  }

  twilioMessagesUrl() {
    return 'https://api.twilio.com/2010-04-01/Accounts/' +
      process.env.TWILIO_ACCOUNT_SID.trim() + '/Messages.json';
  }

  async sendTwilioSms(phone, body) {
    const serviceSid = this.smsMessagingServiceSid();
    const params = new URLSearchParams({
      To: phone, Body: body,
      ...(serviceSid ? { MessagingServiceSid: serviceSid } : { From: this.smsFrom() })
    });
    const result = await axios.post(this.twilioMessagesUrl(), params, {
      auth: this.twilioAuth(), timeout: 15000
    });
    return result.data;
  }

  cloudinaryMediaPath(mediaUrl) {
    const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
    const prefix = '/' + cloudName + '/image/upload/';
    let url;
    try { url = new URL(mediaUrl); } catch (_) { /* Validated below. */ }
    if (!cloudName || !url || url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' ||
        url.username || url.password || url.port || !url.pathname.startsWith(prefix) || url.pathname === prefix) {
      throw new Error('WhatsApp mediaPath requires a public Cloudinary image URL for the configured cloud.');
    }
    return url.pathname.slice(prefix.length) + url.search;
  }

  templateVariables(kind, values = {}) {
    const raw = kind === 'otp'
      ? process.env.TWILIO_WHATSAPP_OTP_VARIABLES
      : process.env.TWILIO_WHATSAPP_PASS_VARIABLES;
    const mapping = raw ? JSON.parse(raw) :
      (kind === 'otp' ? { 1: 'otp' } : { 1: 'name', 2: 'registrationNumber', 3: 'passUrl' });
    if (!mapping || Array.isArray(mapping) || typeof mapping !== 'object') {
      throw new Error('WhatsApp template variable mapping must be a JSON object.');
    }
    const templateValues = Object.values(mapping).includes('mediaPath')
      ? { ...values, mediaPath: this.cloudinaryMediaPath(values.mediaUrl) }
      : values;
    const result = {};
    for (const [placeholder, field] of Object.entries(mapping)) {
      if (!Object.prototype.hasOwnProperty.call(templateValues, field) ||
          templateValues[field] == null || String(templateValues[field]).trim() === '') {
        throw new Error('Missing WhatsApp template value: ' + field);
      }
      result[placeholder] = String(templateValues[field]);
    }
    return result;
  }

  async sendTwilioWhatsApp(phone, kind, values) {
    const sid = kind === 'otp'
      ? process.env.TWILIO_WHATSAPP_OTP_CONTENT_SID
      : (process.env.TWILIO_WHATSAPP_PASS_CONTENT_SID || process.env.TWILIO_WHATSAPP_CONTENT_SID);
    if (!sid?.trim()) {
      throw new Error('Configure an approved WhatsApp ' + kind + ' Content SID before sending.');
    }
    // Template messages work outside a customer service window. Do not mix Body/MediaUrl with ContentSid.
    const params = new URLSearchParams({
      To: 'whatsapp:' + phone, From: this.whatsAppFrom(),
      ContentSid: sid.trim(),
      ContentVariables: JSON.stringify(this.templateVariables(kind, values))
    });
    const result = await axios.post(this.twilioMessagesUrl(), params, {
      auth: this.twilioAuth(), timeout: 15000
    });
    return result.data;
  }

  describeError(error) {
    return error?.response?.data?.message || error?.message || 'Failed to send message';
  }

  async sendMetaWhatsApp(phone, body, mediaUrl) {
    const payload = {
      messaging_product: 'whatsapp', to: phone.replace('+', ''),
      ...(mediaUrl
        ? { type: 'image', image: { link: mediaUrl, caption: body } }
        : { type: 'text', text: { body } })
    };
    await axios.post(
      'https://graph.facebook.com/v21.0/' + process.env.WHATSAPP_PHONE_NUMBER_ID + '/messages',
      payload,
      { headers: { Authorization: 'Bearer ' + process.env.WHATSAPP_TOKEN }, timeout: 15000 }
    );
  }

  async sendMsg91Sms(phone, message) {
    await axios.get('https://api.msg91.com/api/sendhttp.php', {
      params: {
        authkey: process.env.MSG91_AUTH_KEY, mobiles: phone.replace('+', ''),
        message, sender: process.env.MSG91_SENDER_ID || 'DIEMEX', route: 4, country: 91
      },
      timeout: 15000
    });
  }
}

module.exports = new PassMessagingService();
