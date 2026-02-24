// services/EmailService.js

const sgMail = require("@sendgrid/mail");

class EmailService {
  constructor() {
    if (!process.env.SENDGRID_API_KEY) {
      console.error("❌ SENDGRID_API_KEY missing");
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    console.log("📧 Email Service initialized (SendGrid Mode)");
  }

  // ✅ Generic HTML Email
  async sendEmail(to, subject, html) {
    try {
      const msg = {
        to,
        from: process.env.SENDGRID_FROM,
        subject,
        html,
      };

      const response = await sgMail.send(msg);

      console.log(`✅ Email sent to ${to}`);
      return {
        success: true,
        messageId: response[0].headers["x-message-id"],
      };
    } catch (error) {
      console.error("❌ Email Error:", error.response?.body || error.message);
      throw new Error("Email sending failed");
    }
  }

  // ✅ Exhibitor Welcome Email
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

  // ✅ Visitor OTP Email
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

  // ✅ Visitor Confirmation
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

  // ✅ Test connection (used in server.js)
  async testConnection() {
    if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM) {
      throw new Error("SendGrid environment variables missing");
    }

    console.log("📧 SendGrid configuration OK");
    return true;
  }
}

module.exports = new EmailService();