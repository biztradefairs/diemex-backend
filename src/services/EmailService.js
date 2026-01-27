const nodemailer = require("nodemailer");
const { convert } = require("html-to-text");

class EmailService {
  constructor() {
    this._transporter = null;
  }

  async getTransporter() {
    if (!this._transporter) {
      const testAccount = await nodemailer.createTestAccount();

      this._transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      console.log("📧 Ethereal Email Account Created");
      console.log("   User:", testAccount.user);
      console.log("   Pass:", testAccount.pass);
      console.log("   Inbox:", "https://ethereal.email");
    }

    return this._transporter;
  }

  async sendEmail(to, subject, html) {
    const transporter = await this.getTransporter();

    const info = await transporter.sendMail({
      from: "noreply@exhibition.com",
      to,
      subject,
      html,
      text: convert(html),
    });

    console.log(`✅ Email sent to ${to}`);
    console.log("📧 Preview URL:", nodemailer.getTestMessageUrl(info));

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
        <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/login">
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
    console.log("✅ Email service ready (Ethereal)");
    return true;
  }
}

module.exports = new EmailService();
