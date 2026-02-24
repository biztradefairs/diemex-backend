// services/EmailService.js

const sgMail = require("@sendgrid/mail");

class EmailService {
  constructor() {
    if (!process.env.SENDGRID_API_KEY) {
      console.error("❌ SENDGRID_API_KEY is missing in environment variables");
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    console.log("📧 Email Service initialized (SendGrid Mode)");
  }

  /**
   * Generic HTML Email Sender (Keeps your existing routes working)
   */
  async sendEmail(to, subject, html) {
    try {
      const msg = {
        to,
        from: process.env.SENDGRID_FROM,
        subject,
        html,
      };

      const response = await sgMail.send(msg);

      console.log("✅ Email sent successfully");
      return {
        success: true,
        messageId: response[0].headers["x-message-id"],
      };
    } catch (error) {
      console.error("❌ SendEmail Error:", error.response?.body || error.message);
      throw new Error("Failed to send email");
    }
  }

  /**
   * Dynamic Template Sender (Optional for future use)
   */
  async sendTemplateEmail(to, templateId, dynamicData) {
    try {
      const msg = {
        to,
        from: process.env.SENDGRID_FROM,
        templateId,
        dynamicTemplateData: dynamicData,
      };

      const response = await sgMail.send(msg);

      console.log("✅ Template email sent successfully");
      return {
        success: true,
        messageId: response[0].headers["x-message-id"],
      };
    } catch (error) {
      console.error("❌ Template Email Error:", error.response?.body || error.message);
      throw new Error("Failed to send template email");
    }
  }

  /**
   * Optional: Test connection
   */
  async testConnection() {
    try {
      if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM) {
        throw new Error("SendGrid environment variables missing");
      }

      console.log("📧 SendGrid configuration found");
      return true;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new EmailService();