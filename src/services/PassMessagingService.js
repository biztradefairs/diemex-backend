/**
 * ============================================================================
 * DIEMEX 2027 — Multi-Channel Visitor Messaging Service (PassMessagingService.js)
 * ============================================================================
 * 
 * ROLE IN ARCHITECTURE:
 * This service is the transport abstraction layer for delivering OTPs,
 * registration confirmations, digital visitor badges, and QR codes across
 * SMS and WhatsApp channels.
 * 
 * CORE CAPABILITIES:
 *  1. Multi-Provider Fallbacks:
 *     - Twilio (SMS & WhatsApp Business API)
 *     - Meta / WhatsApp Cloud API (Direct Facebook Graph API)
 *     - MSG91 (Indian DLT Transactional SMS Gateway)
 *     - Local Dev Simulation (Zero-cost console logging in test environments)
 *  2. WhatsApp Media Attachments:
 *     - Automatically passes public Cloudinary image URLs (`mediaUrl`) to Twilio
 *       and Meta Cloud API for inline QR code/badge image delivery.
 *  3. Click-to-Chat Deep Linking:
 *     - Generates `https://wa.me/` URLs for instant browser/app chat opening.
 * ============================================================================
 */

const axios = require('axios');

class PassMessagingService {
  /**
   * Resolves the active SMS transport provider based on environment configuration.
   * 
   * PROVIDER RESOLUTION PRIORITY:
   *  1. Twilio: If TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER exist.
   *  2. MSG91: If MSG91_AUTH_KEY is configured (standard for Indian DLT).
   *  3. Dev: Local development simulator (logs messages to terminal without API cost).
   * 
   * @returns {'twilio' | 'msg91' | 'dev'} Active SMS provider key
   */
  getSmsProvider() {
    if (this.twilioClient() && (this.verifyReady() || this.smsFrom())) return 'twilio';
    if (process.env.MSG91_AUTH_KEY) return 'msg91';
    return null;
  }

  /**
   * Resolves the active WhatsApp transport provider based on environment configuration.
   * 
   * PROVIDER RESOLUTION PRIORITY:
   *  1. Twilio WhatsApp: If TWILIO_WHATSAPP_FROM is defined.
   *  2. Meta Cloud API: If WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID exist.
   *  3. Dev: Local simulator (logs to console and generates wa.me links).
   * 
   * @returns {'twilio' | 'meta' | 'dev'} Active WhatsApp provider key
   */
  getWhatsAppProvider() {
    if (this.twilioClient() && (this.verifyReady() || this.whatsAppFrom())) return 'twilio';
    if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) return 'meta';
    return null;
  }

  /**
   * Resolves the transport provider for the specified delivery channel.
   * 
   * @param {'whatsapp' | 'sms' | 'email'} channel - Target delivery channel
   * @returns {'twilio' | 'meta' | 'msg91' | 'dev'} Provider name
   */
  getProvider(channel) {
    return channel === 'whatsapp' ? this.getWhatsAppProvider() : this.getSmsProvider();
  }

  /**
   * Checks whether live carrier credentials are configured for the channel.
   * 
   * @param {'whatsapp' | 'sms'} channel - Target channel
   * @returns {boolean} True if a live third-party gateway is configured
   */
  isConfigured(channel) {
    return this.getProvider(channel) !== 'dev';
  }

  /**
   * Generates a standard WhatsApp click-to-chat deep link URL.
   * 
   * WHY IT IS USED:
   * Allows the frontend to open WhatsApp Web or native mobile app directly with
   * pre-filled pass verification details and web links.
   * 
   * @param {string} e164Phone - E.164 formatted telephone number (e.g. "+919876543210")
   * @param {string} text - Pre-filled message body
   * @returns {string} Fully encoded https://wa.me/ URL
   */
  buildWhatsAppLink(e164Phone, text) {
    const digits = String(e164Phone || '').replace(/\D/g, '');
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  }

  /**
   * Dispatches a 4-digit OTP verification code via the selected channel.
   * 
   * @param {Object} params
   * @param {string} params.phone - Recipient's E.164 phone number
   * @param {'whatsapp' | 'sms'} params.channel - Transport channel
   * @param {string} params.otp - 4-digit numeric verification OTP
   * @returns {Promise<Object>} Transport delivery outcome
   */
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

  /**
   * Dispatches the official digital visitor pass confirmation with badge link and media image.
   * 
   * WHY IT IS USED:
   * Formats channel-tailored notification copy (Markdown for WhatsApp, plain text for SMS),
   * includes registration code, links to the live digital badge, and attaches Cloudinary QR image.
   * 
   * @param {Object} params
   * @param {string} params.phone - Attendee E.164 telephone number
   * @param {'whatsapp' | 'sms'} params.channel - Selected delivery channel
   * @param {string} params.name - Attendee full name
   * @param {string} params.registrationNumber - Unique REG-DMX pass identifier
   * @param {string} params.passUrl - Web view URL for mobile pass card
   * @param {string} [params.mediaUrl] - Public HTTPS URL of the QR code/badge image
   * @returns {Promise<Object>} Transport outcome, WhatsApp chat link, and message text
   */
  async sendPass({ phone, channel, name, registrationNumber, passUrl, mediaUrl }) {
    const smsMessage =
      `DIEMEX 2027: Hi ${name}, your visitor pass ${registrationNumber} is ready. Show this QR at entry: ${passUrl}`;

    const whatsappMessage =
      `*DIEMEX 2027 — Your Visitor Pass*\n\n` +
      `Hi *${name}*,\n\n` +
      `Your digital visitor badge is ready.\n` +
      `📌 *Registration:* ${registrationNumber}\n\n` +
      `👉 *Show this QR at entry:*\n${passUrl}\n\n` +
      `📅 24–26 Mar 2027\n📍 Auto Cluster Exhibition Centre, Pune`;

    const message = channel === 'whatsapp' ? whatsappMessage : smsMessage;
    const result = await this.sendMessage({ phone, channel, message, mediaUrl, kind: 'pass' });

    return {
      ...result,
      whatsappUrl: this.buildWhatsAppLink(phone, whatsappMessage),
      message,
      mediaUrl
    };
  }

  /**
   * Directly dispatches the complete digital visitor badge image to WhatsApp.
   * 
   * @param {Object} params
   * @param {string} params.phone - Recipient phone number
   * @param {string} params.badgeUrl - Public HTTPS image URL of the complete badge
   * @param {string} params.registrationNumber - Pass registration number
   * @returns {Promise<Object>} Delivery outcome
   */
  async sendVisitorBadgeWhatsApp({ phone, badgeUrl, registrationNumber }) {
    const message =
      `*DIEMEX 2027 — Official Visitor Badge*\n\n` +
      `Registration: *${registrationNumber}*\n\n` +
      `Your digital visitor badge is ready.\n\n` +
      `📅 24–26 Mar 2027\n📍 Auto Cluster Exhibition Centre, Pune`;

    return this.sendMessage({
      phone,
      channel: 'whatsapp',
      message,
      mediaUrl: badgeUrl,
      kind: 'pass'
    });
  }

  /**
   * Unified internal routing engine for dispatching outbound messages.
   * 
   * WORKFLOW:
   *  1. Resolves provider (Twilio, Meta, MSG91, or Dev).
   *  2. Logs formatted payload to console in dev mode or non-production environments.
   *  3. Executes carrier API call (with media attachment handling when supported).
   *  4. Traps API errors and formats uniform result object.
   * 
   * @param {Object} params
   * @param {string} params.phone - E.164 target phone number
   * @param {'whatsapp' | 'sms'} params.channel - Channel identifier
   * @param {string} params.message - Text body to send
   * @param {string} [params.mediaUrl] - Optional HTTPS media image URL
   * @param {'otp' | 'pass'} params.kind - Category of message
   * @returns {Promise<{success: boolean, provider: string, simulated?: boolean, mediaUrl?: string, error?: string}>}
   */
  async sendMessage({ phone, channel, message, mediaUrl, kind }) {
    const provider = this.getProvider(channel);

    if (process.env.NODE_ENV !== 'production' || provider === 'dev') {
      console.log(`[PassMessaging] ${channel.toUpperCase()} ${kind} via ${provider} → ${phone}`);
      console.log(`[PassMessaging] ${message}`);
      if (mediaUrl) {
        console.log(`[PassMessaging] Media URL: ${mediaUrl}`);
      }
    }

    // Dev Simulation Mode: returns success without calling paid telecom APIs
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
        simulated: true,
        mediaUrl
      };
    }

    // Live Provider Execution
    try {
      let sid = null;
      if (channel === 'whatsapp' && provider === 'twilio') {
        await this.sendTwilioWhatsApp(phone, message, mediaUrl);
      } else if (channel === 'whatsapp' && provider === 'meta') {
        await this.sendMetaWhatsApp(phone, message, mediaUrl);
      } else if (provider === 'twilio') {
        sid = await this.sendTwilioSms(phone, message, kind);
      } else if (provider === 'msg91') {
        await this.sendMsg91Sms(phone, message);
      }

      return { success: true, provider, mediaUrl };
    } catch (error) {
      console.error(`[PassMessaging] ${channel} send failed:`, error.message || error.response?.data || error);
      return {
        success: false,
        provider,
        error: this.describeError(error)
      };
    }
  }

  /**
   * Helper to construct Twilio HTTP Basic Authentication credentials.
   * 
   * @returns {{username: string, password: string}}
   */
  twilioAuth() {
    return {
      username: process.env.TWILIO_ACCOUNT_SID,
      password: process.env.TWILIO_AUTH_TOKEN
    };
  }

  /**
   * Helper to construct Twilio Messages endpoint REST URL.
   * 
   * @returns {string} Twilio Messages API URL
   */
  twilioMessagesUrl() {
    return `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
  }

  /**
   * Sends transactional SMS via Twilio Messages API.
   * 
   * @param {string} phone - Recipient E.164 phone
   * @param {string} body - SMS message text
   * @returns {Promise<void>}
   */
  async sendTwilioSms(phone, body) {
    const params = new URLSearchParams({
      To: phone,
      From: process.env.TWILIO_PHONE_NUMBER,
      Body: body
    });

    await axios.post(this.twilioMessagesUrl(), params, { auth: this.twilioAuth() });
  }

  /**
   * Sends WhatsApp message (with optional image attachment) via Twilio WhatsApp API.
   * 
   * @param {string} phone - Recipient E.164 phone
   * @param {string} body - WhatsApp text body
   * @param {string} [mediaUrl] - Public HTTPS image URL for QR code/badge
   * @returns {Promise<void>}
   */
  async sendTwilioWhatsApp(phone, body, mediaUrl) {
    const from = process.env.TWILIO_WHATSAPP_FROM.startsWith('whatsapp:')
      ? process.env.TWILIO_WHATSAPP_FROM
      : `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`;

    const params = new URLSearchParams({
      To: `whatsapp:${phone}`,
      From: from,
      Body: body
    });

    if (mediaUrl) {
      params.append('MediaUrl', mediaUrl);
    }

    await axios.post(this.twilioMessagesUrl(), params, { auth: this.twilioAuth() });
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

  /**
   * Sends WhatsApp text or media image message via Meta WhatsApp Business Cloud API.
   * 
   * @param {string} phone - Target phone number
   * @param {string} body - Caption or text body
   * @param {string} [mediaUrl] - Public HTTPS image link
   * @returns {Promise<void>}
   */
  async sendMetaWhatsApp(phone, body, mediaUrl) {
    const url = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const payload = mediaUrl
      ? {
          messaging_product: 'whatsapp',
          to: phone.replace('+', ''),
          type: 'image',
          image: {
            link: mediaUrl,
            caption: body
          }
        }
      : {
          messaging_product: 'whatsapp',
          to: phone.replace('+', ''),
          type: 'text',
          text: { body }
        };

    await axios.post(
      url,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  }

  /**
   * Sends transactional SMS via Indian DLT MSG91 HTTP API gateway.
   * 
   * @param {string} phone - Target phone number (e.g. "+919876543210")
   * @param {string} message - DLT registered SMS text template
   * @returns {Promise<void>}
   */
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
