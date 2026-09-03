const axios = require('axios');

class PassMessagingService {
  getSmsProvider() {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      return 'twilio';
    }
    if (process.env.MSG91_AUTH_KEY) {
      return 'msg91';
    }
    return 'dev';
  }

  getWhatsAppProvider() {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) {
      return 'twilio';
    }
    if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
      return 'meta';
    }
    return 'dev';
  }

  getProvider(channel) {
    return channel === 'whatsapp' ? this.getWhatsAppProvider() : this.getSmsProvider();
  }

  isConfigured(channel) {
    return this.getProvider(channel) !== 'dev';
  }

  buildWhatsAppLink(e164Phone, text) {
    const digits = String(e164Phone || '').replace(/\D/g, '');
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  }

  async sendOtp({ phone, channel, otp }) {
    const message = channel === 'whatsapp'
      ? `Your DIEMEX verification code is *${otp}*. It expires in 10 minutes. Do not share this code.`
      : `DIEMEX: Your OTP is ${otp}. Valid for 10 minutes. Do not share.`;

    return this.sendMessage({ phone, channel, message, kind: 'otp' });
  }

  async sendPass({ phone, channel, name, registrationNumber, passUrl }) {
    const smsMessage =
      `DIEMEX 2026: Hi ${name}, your visitor pass ${registrationNumber} is ready. Show this QR at entry: ${passUrl}`;

    const whatsappMessage =
      `DIEMEX 2026 — Your Visitor Pass\n\nHi ${name},\n\nYour digital visitor badge is ready.\nRegistration: ${registrationNumber}\n\nShow this QR at entry:\n${passUrl}\n\n8–10 Oct 2026\nAuto Cluster Exhibition Centre, Pune`;

    const message = channel === 'whatsapp' ? whatsappMessage : smsMessage;
    const result = await this.sendMessage({ phone, channel, message, kind: 'pass' });

    return {
      ...result,
      whatsappUrl: this.buildWhatsAppLink(phone, whatsappMessage),
      message
    };
  }

  async sendMessage({ phone, channel, message, kind }) {
    const provider = this.getProvider(channel);

    if (process.env.NODE_ENV !== 'production' || provider === 'dev') {
      console.log(`[PassMessaging] ${channel.toUpperCase()} ${kind} via ${provider} → ${phone}`);
      console.log(`[PassMessaging] ${message}`);
    }

    if (provider === 'dev') {
      if (process.env.NODE_ENV === 'production') {
        return {
          success: false,
          provider,
          error: `${channel.toUpperCase()} delivery is not configured. Add Twilio, MSG91, or WhatsApp Cloud API credentials.`
        };
      }

      return {
        success: true,
        provider,
        simulated: true
      };
    }

    try {
      if (channel === 'whatsapp' && provider === 'twilio') {
        await this.sendTwilioWhatsApp(phone, message);
      } else if (channel === 'whatsapp' && provider === 'meta') {
        await this.sendMetaWhatsApp(phone, message);
      } else if (provider === 'twilio') {
        await this.sendTwilioSms(phone, message);
      } else if (provider === 'msg91') {
        await this.sendMsg91Sms(phone, message);
      }

      return { success: true, provider };
    } catch (error) {
      console.error(`[PassMessaging] ${channel} send failed:`, error.response?.data || error.message);
      return {
        success: false,
        provider,
        error: error.response?.data?.message || error.message || 'Failed to send message'
      };
    }
  }

  twilioAuth() {
    return {
      username: process.env.TWILIO_ACCOUNT_SID,
      password: process.env.TWILIO_AUTH_TOKEN
    };
  }

  twilioMessagesUrl() {
    return `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
  }

  async sendTwilioSms(phone, body) {
    const params = new URLSearchParams({
      To: phone,
      From: process.env.TWILIO_PHONE_NUMBER,
      Body: body
    });

    await axios.post(this.twilioMessagesUrl(), params, { auth: this.twilioAuth() });
  }

  async sendTwilioWhatsApp(phone, body) {
    const from = process.env.TWILIO_WHATSAPP_FROM.startsWith('whatsapp:')
      ? process.env.TWILIO_WHATSAPP_FROM
      : `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`;

    const params = new URLSearchParams({
      To: `whatsapp:${phone}`,
      From: from,
      Body: body
    });

    await axios.post(this.twilioMessagesUrl(), params, { auth: this.twilioAuth() });
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
