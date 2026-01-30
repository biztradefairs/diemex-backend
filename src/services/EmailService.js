const nodemailer = require("nodemailer");
const { convert } = require("html-to-text");

class EmailService {
  constructor() {
    this._transporter = null;
  }

  async getTransporter() {
    if (!this._transporter) {
      // Check if email configuration exists
      if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('❌ Email configuration missing in .env file');
        throw new Error('Email configuration not set');
      }
      
      this._transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT || 587,
        secure: process.env.EMAIL_PORT === '465',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      console.log("📧 Email transporter configured");
    }

    return this._transporter;
  }

  async sendEmail(to, subject, html) {
    try {
      const transporter = await this.getTransporter();

      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject,
        html,
        text: convert(html),
      });

      console.log(`✅ Email sent to ${to}`);
      console.log("📨 Message ID:", info.messageId);

      return info;
    } catch (error) {
      console.error('❌ Email sending failed:', error.message);
      throw error;
    }
  }

  async sendExhibitorWelcome(exhibitor, password) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const loginUrl = `${frontendUrl}/exhibitor/login`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .credentials { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0; }
            .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Exhibition Portal</h1>
            </div>
            <div class="content">
              <h2>Hello ${exhibitor.name},</h2>
              <p>Your exhibitor account has been successfully created!</p>
              
              <div class="credentials">
                <h3>Your Login Credentials:</h3>
                <p><strong>Email:</strong> ${exhibitor.email}</p>
                <p><strong>Password:</strong> ${password}</p>
                <p><strong>Company:</strong> ${exhibitor.company}</p>
                <p><strong>Booth Number:</strong> ${exhibitor.boothNumber || 'To be assigned'}</p>
              </div>
              
              <p>
                <a href="${loginUrl}" class="button">Login to Your Dashboard</a>
              </p>
              
              <p><strong>Important Security Notice:</strong></p>
              <ul>
                <li>Keep your credentials secure</li>
                <li>Change your password after first login</li>
                <li>Do not share your password with anyone</li>
              </ul>
              
              <p>If you have any questions, please contact our support team.</p>
              
              <p>Best regards,<br>
              Exhibition Management Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(
      exhibitor.email,
      "Welcome to Exhibition Portal - Your Account Credentials",
      html
    );
  }

  async testConnection() {
    try {
      const transporter = await this.getTransporter();
      await transporter.verify();
      console.log("✅ Email service connected successfully");
      return true;
    } catch (error) {
      console.error("❌ Email connection failed:", error.message);
      return false;
    }
  }
}

module.exports = new EmailService();