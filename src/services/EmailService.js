const nodemailer = require("nodemailer");
const { convert } = require("html-to-text");

class EmailService {
  constructor() {
    this._transporter = null;
  }

  async getTransporter() {
    if (!this._transporter) {
      this._transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false, // TLS
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      console.log("📧 Gmail SMTP configured");
    }

    return this._transporter;
  }

  async sendEmail(to, subject, html) {
    const transporter = await this.getTransporter();

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
      text: convert(html),
    });

    console.log(`✅ Email sent to ${to}`);
    console.log("📨 Message ID:", info.messageId);

    return info;
  }

  async sendExhibitorWelcome(exhibitor, password) {
    const html = `
      <h2>Welcome ${exhibitor.name}</h2>
      <p>Your exhibitor account has been created.</p>
      <p><strong>Email:</strong> ${exhibitor.email}</p>
      <p><strong>Password:</strong> ${password}</p>
      <p>
        Login here:
        <a href="${process.env.FRONTEND_URL}/login">
          Login
        </a>
      </p>
      <p>Please change your password after login.</p>
    `;

    return this.sendEmail(
      exhibitor.email,
      "Welcome to Exhibition Portal",
      html
    );
  }

  async testConnection() {
    const transporter = await this.getTransporter();
    await transporter.verify();
    console.log("✅ Email service ready (Gmail)");
    return true;
  }
}

module.exports = new EmailService();
