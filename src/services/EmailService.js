// services/EmailService.js
const sgMail = require("@sendgrid/mail");

class EmailService {
  constructor() {
    if (!process.env.SENDGRID_API_KEY) {
      console.error("❌ SENDGRID_API_KEY is missing!");
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    console.log("📧 Email Service initialized (SendGrid Mode)");
  }

  async sendTemplateEmail(to, templateId, dynamicData) {
    try {
      console.log("=".repeat(60));
      console.log("📧 Sending Email");
      console.log("To:", to);

      const msg = {
        to,
        from: process.env.SENDGRID_FROM,
        templateId: templateId,
        dynamicTemplateData: dynamicData,
      };

      const response = await sgMail.send(msg);

      console.log("✅ Email Sent Successfully");
      console.log("=".repeat(60));

      return {
        success: true,
        messageId: response[0].headers["x-message-id"],
      };
    } catch (error) {
      console.error("❌ Email Error:", error.response?.body || error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ✅ Send OTP Email
  async sendOTP(email, otp) {
    return this.sendTemplateEmail(
      email,
      "d-ee834dddfdbe41d4b828db79cad0451b", // Your Template ID
      {
        name: "Visitor",
        otp: otp,
        event_name: "DIEMEX Exhibition 2026",
      }
    );
  }

  // ✅ Send Visitor Confirmation
  async sendVisitorConfirmation(visitorData) {
    return this.sendTemplateEmail(
      visitorData.email,
      "d-ee834dddfdbe41d4b828db79cad0451b", // You can create another template later
      {
        name: visitorData.name,
        event_name: "DIEMEX Exhibition 2026",
      }
    );
  }
}

module.exports = new EmailService();