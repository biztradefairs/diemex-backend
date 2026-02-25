// services/EmailService.js
const sgMail = require("@sendgrid/mail");

class EmailService {
  constructor() {
    this.initialized = false;
    this.init();
  }

  init() {
    if (!process.env.SENDGRID_API_KEY) {
      console.error("❌ SENDGRID_API_KEY is missing in environment variables");
      return;
    }

    if (!process.env.SENDGRID_FROM) {
      console.error("❌ SENDGRID_FROM is missing in environment variables");
      return;
    }

    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      this.initialized = true;
      console.log("✅ Email Service initialized with SendGrid");
      console.log(`📧 From email: ${process.env.SENDGRID_FROM}`);
    } catch (error) {
      console.error("❌ Failed to initialize SendGrid:", error.message);
    }
  }

  async sendEmail(to, subject, html) {
    // Check if initialized
    if (!this.initialized) {
      console.error("❌ Email service not initialized. Check your SendGrid configuration.");
      // For development, log instead of sending
      console.log("📧 Would send email:", { to, subject, html });
      return { success: true, mock: true };
    }

    try {
      const msg = {
        to,
        from: process.env.SENDGRID_FROM,
        subject,
        html,
      };

      console.log(`📧 Attempting to send email to: ${to}`);
      console.log(`📧 Subject: ${subject}`);

      const response = await sgMail.send(msg);

      console.log(`✅ Email sent successfully to ${to}`);
      console.log(`📧 Message ID: ${response[0]?.headers?.['x-message-id'] || 'Unknown'}`);

      return {
        success: true,
        messageId: response[0]?.headers?.['x-message-id'],
      };
    } catch (error) {
      console.error("❌ SendGrid Error Details:");
      console.error("- Message:", error.message);
      
      if (error.response) {
        console.error("- Status Code:", error.response.statusCode);
        console.error("- Response Body:", error.response.body);
        console.error("- Response Headers:", error.response.headers);
      }

      // Don't throw, return error object
      return {
        success: false,
        error: error.message,
        details: error.response?.body || 'Unknown error'
      };
    }
  }

  // Test method to verify configuration
  async testConnection() {
    if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM) {
      throw new Error("SendGrid environment variables missing");
    }

    if (!this.initialized) {
      throw new Error("SendGrid not initialized");
    }

    console.log("✅ SendGrid configuration OK");
    console.log(`📧 From: ${process.env.SENDGRID_FROM}`);
    console.log(`🔑 API Key: ${process.env.SENDGRID_API_KEY.substring(0, 10)}...`);

    return true;
  }

  // Other methods remain the same...
  async sendExhibitorWelcome(exhibitor, plainPassword) {
    const subject = "Exhibition Portal - Login Credentials";
    const html = `
      <h2>Welcome to the Exhibition Portal</h2>
      <p>Dear ${exhibitor.name},</p>
      <p>Your exhibitor account has been created.</p>
      <hr>
      <p><strong>Email:</strong> ${exhibitor.email}</p>
      <p><strong>Password:</strong> ${plainPassword}</p>
      <hr>
      <p>Please login and change your password immediately.</p>
      <p>Best regards,<br/>Exhibition Team</p>
    `;
    return this.sendEmail(exhibitor.email, subject, html);
  }

  async sendVisitorOTP(email, name, otp) {
    const subject = "Your Verification Code for Exhibition Registration";
    const html = `
      <h2>Email Verification</h2>
      <p>Dear ${name},</p>
      <p>Your OTP is:</p>
      <h1 style="font-size:32px; letter-spacing:5px; text-align:center;">${otp}</h1>
      <p>This code expires in 5 minutes.</p>
    `;
    return this.sendEmail(email, subject, html);
  }

  async sendVisitorConfirmation(visitorData) {
    const subject = "Registration Confirmed - Exhibition";
    const html = `
      <h2>Registration Confirmed</h2>
      <p>Dear ${visitorData.name},</p>
      <p>Your registration has been successfully completed.</p>
      <hr>
      <p><strong>Name:</strong> ${visitorData.name}</p>
      <p><strong>Company:</strong> ${visitorData.company}</p>
      <p><strong>Email:</strong> ${visitorData.email}</p>
      <hr>
      <p>We look forward to seeing you!</p>
    `;
    return this.sendEmail(visitorData.email, subject, html);
  }
}

module.exports = new EmailService();