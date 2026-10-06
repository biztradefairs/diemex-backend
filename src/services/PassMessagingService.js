const twilio = require('twilio');
const axios = require('axios');

class PassMessagingService {
  twilioClient() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) return null;
    return twilio(accountSid, authToken);
  }

  smsFrom() {
    return String(process.env.TWILIO_PHONE_NUMBER || '').trim();
  }

  whatsAppFrom() {
    const raw = String(process.env.TWILIO_WHATSAPP_FROM || this.smsFrom() || '').trim();
    if (!raw) return '';
    return raw.startsWith('whatsapp:') ? raw : `whatsapp:${raw}`;
  }

  verifyReady() {
    return Boolean(this.twilioClient() && process.env.TWILIO_VERIFY_SERVICE_SID);
  }

  verifyCodeLength() {
    const length = Number(process.env.TWILIO_VERIFY_CODE_LENGTH || 6);
    if (!Number.isFinite(length)) return 6;
    return Math.min(10, Math.max(4, length));
  }

  getSmsProvider() {
    if (this.twilioClient() && (this.verifyReady() || this.smsFrom())) return 'twilio';
    if (process.env.MSG91_AUTH_KEY) return 'msg91';
    return null;
  }

  getWhatsAppProvider() {
    if (this.twilioClient() && (this.verifyReady() || this.whatsAppFrom())) return 'twilio';
    if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) return 'meta';
    return null;
  }

  getProvider(channel) {
    return channel === 'whatsapp' ? this.getWhatsAppProvider() : this.getSmsProvider();
  }

  isConfigured(channel) {
    return Boolean(this.getProvider(channel));
  }

  async sendOtp({ phone, channel, otp }) {
    if (this.verifyReady()) {
      return this.startVerification({ phone, channel });
    }

    const message = channel === 'whatsapp'
      ? `Your DIEMEX verification code is *${otp}*. It expires in 10 minutes. Do not share this code.`
      : `DIEMEX: Your OTP is ${otp}. Valid for 10 minutes. Do not share.`;

    const result = await this.sendMessage({ phone, channel, message, kind: 'otp' });
    return { ...result, digits: 4, managed: false };
  }

  async startVerification({ phone, channel }) {
    const client = this.twilioClient();
    if (!client) {
      return { success: false, provider: 'twilio-verify', error: this.missingTwilioMessage(channel) };
    }

    try {
      const verification = await client.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID)
        .verifications.create({
          to: phone,
          channel: channel === 'whatsapp' ? 'whatsapp' : 'sms'
        });

      console.log(`[PassMessaging] Twilio Verify ${channel} → ${phone} (${verification.status})`);
      return {
        success: verification.status === 'pending' || verification.status === 'approved',
        provider: 'twilio-verify',
        managed: true,
        digits: this.verifyCodeLength(),
        status: verification.status
      };
    } catch (error) {
      console.error('[PassMessaging] Twilio Verify failed:', error.message);
      return {
        success: false,
        provider: 'twilio-verify',
        error: this.describeError(error)
      };
    }
  }

  async checkVerification({ phone, code }) {
    const client = this.twilioClient();
    if (!client || !process.env.TWILIO_VERIFY_SERVICE_SID) {
      return { approved: false, error: 'Twilio Verify is not configured' };
    }

    try {
      const check = await client.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID)
        .verificationChecks.create({
          to: phone,
          code: String(code || '').trim()
        });
      return { approved: check.status === 'approved', status: check.status };
    } catch (error) {
      console.error('[PassMessaging] Twilio Verify check failed:', error.message);
      return { approved: false, error: this.describeError(error) };
    }
  }

  async sendPass({ phone, channel, name, registrationNumber, passUrl }) {
    const smsMessage =
      `DIEMEX 2027: Hi ${name}, your visitor pass ${registrationNumber} is ready. Show this QR at entry: ${passUrl}`;

    const whatsappMessage =
      `DIEMEX 2027 — Your Visitor Pass\n\nHi ${name},\n\nYour digital visitor badge is ready.\nRegistration: ${registrationNumber}\n\nShow this QR at entry:\n${passUrl}\n\n24–26 Mar 2027\nAuto Cluster Exhibition Centre, Pune`;

    const message = channel === 'whatsapp' ? whatsappMessage : smsMessage;
    return this.sendMessage({ phone, channel, message, kind: 'pass' });
  }

  async sendMessage({ phone, channel, message, kind }) {
    const provider = this.getProvider(channel);
    if (!provider) {
      return {
        success: false,
        provider: 'twilio',
        error: this.missingTwilioMessage(channel)
      };
    }

    try {
      let sid = null;
      if (channel === 'whatsapp' && provider === 'twilio') {
        sid = await this.sendTwilioWhatsApp(phone, message, kind);
      } else if (channel === 'whatsapp' && provider === 'meta') {
        await this.sendMetaWhatsApp(phone, message);
      } else if (provider === 'twilio') {
        sid = await this.sendTwilioSms(phone, message, kind);
      } else if (provider === 'msg91') {
        await this.sendMsg91Sms(phone, message);
      }

      console.log(`[PassMessaging] ${channel} ${kind} sent via ${provider} → ${phone}${sid ? ` (${sid})` : ''}`);
      return { success: true, provider, sid, managed: false, digits: 4 };
    } catch (error) {
      console.error(`[PassMessaging] ${channel} send failed:`, error.message || error.response?.data || error);
      return {
        success: false,
        provider,
        error: this.describeError(error)
      };
    }
  }

  isTrialSmsError(error) {
    return /template name|predefined SMS templates/i.test(error?.message || '');
  }

  isContentSidError(error) {
    return /contentsid required/i.test(error?.message || '');
  }

  async sendTwilioSms(phone, body, kind) {
    const from = this.smsFrom();
    if (!from) {
      throw new Error('Set TWILIO_PHONE_NUMBER to your Twilio SMS number');
    }
    const client = this.twilioClient();
    try {
      const message = await client.messages.create({ body, from, to: phone });
      return message.sid;
    } catch (error) {
      if (!this.isTrialSmsError(error)) throw error;
      const template = kind === 'otp' ? 'sms_2fa' : 'sms_event_notifications';
      const message = await client.messages.create({ body: template, from, to: phone });
      return message.sid;
    }
  }

  async sendTwilioWhatsApp(phone, body, kind) {
    const from = this.whatsAppFrom();
    if (!from) {
      throw new Error('Set TWILIO_WHATSAPP_FROM to your Twilio WhatsApp sender');
    }
    const to = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
    const client = this.twilioClient();
    const contentSid = kind === 'otp'
      ? (process.env.TWILIO_WHATSAPP_OTP_CONTENT_SID || process.env.TWILIO_WHATSAPP_CONTENT_SID)
      : process.env.TWILIO_WHATSAPP_CONTENT_SID;

    if (contentSid) {
      const message = await client.messages.create({
        contentSid,
        contentVariables: JSON.stringify({ 1: body }),
        from,
        to
      });
      return message.sid;
    }

    try {
      const message = await client.messages.create({ body, from, to });
      return message.sid;
    } catch (error) {
      if (this.isContentSidError(error)) {
        throw new Error('WhatsApp on this Twilio trial needs the Content SID from the Try out WhatsApp page. Add it as TWILIO_WHATSAPP_CONTENT_SID.');
      }
      throw error;
    }
  }

  missingTwilioMessage(channel) {
    if (channel === 'whatsapp') {
      return 'WhatsApp is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM.';
    }
    return 'SMS is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.';
  }

  describeError(error) {
    const twilioMessage = error?.message;
    const apiMessage = error?.response?.data?.message;
    return apiMessage || twilioMessage || 'Failed to send message';
  }

  async sendMetaWhatsApp(phone, body) {
    const url = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to: phone.replace('+', ''),
        type: 'text',
        text: { body }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  }

  async sendMsg91Sms(phone, message) {
    const mobiles = phone.replace('+', '');
    await axios.get('https://api.msg91.com/api/sendhttp.php', {
      params: {
        authkey: process.env.MSG91_AUTH_KEY,
        mobiles,
        message,
        sender: process.env.MSG91_SENDER_ID || 'DIEMEX',
        route: 4,
        country: 91
      }
    });
  }
}

module.exports = new PassMessagingService();
