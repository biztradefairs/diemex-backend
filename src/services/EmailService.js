const nodemailer = require("nodemailer");
const { convert } = require("html-to-text");

class EmailService {
  constructor() {
    this._transporter = null;
  }

  async getTransporter() {
    if (!this._transporter) {
      // Check if email is configured
      if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('📧 Email not configured. Using console mode.');
        return null;
      }
      
      try {
        this._transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST,
          port: process.env.EMAIL_PORT || 587,
          secure: false,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
          tls: {
            rejectUnauthorized: false
          },
          connectionTimeout: 10000, // 10 seconds connection timeout
          greetingTimeout: 10000,   // 10 seconds greeting timeout
          socketTimeout: 10000      // 10 seconds socket timeout
        });
        
        console.log("📧 Email transporter configured");
      } catch (error) {
        console.error("❌ Email configuration error:", error.message);
        return null;
      }
    }

    return this._transporter;
  }

  async sendEmail(to, subject, html) {
    try {
      const transporter = await this.getTransporter();
      
      // If no transporter (email not configured), just log and return
      if (!transporter) {
        console.log(`📧 [CONSOLE] Email would be sent to: ${to}`);
        console.log(`📧 Subject: ${subject}`);
        console.log(`📧 Preview: ${html.substring(0, 100)}...`);
        return { messageId: 'console-' + Date.now() };
      }
      
      const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;

      const info = await transporter.sendMail({
        from: fromEmail,
        to,
        subject,
        html,
        text: convert(html),
      });

      console.log(`✅ Email sent to ${to}`);
      return info;
    } catch (error) {
      console.error(`❌ Failed to send email to ${to}:`, error.message);
      
      // Don't throw error, just log it
      console.log(`📧 [FALLBACK] Logging email that failed: ${subject} to ${to}`);
      
      // Return a mock response so the request doesn't fail
      return { 
        messageId: 'error-' + Date.now(),
        error: error.message 
      };
    }
  }

  async sendExhibitorWelcome(exhibitor, password) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const loginUrl = `${frontendUrl}/login`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
          <h1>Welcome to Exhibition Portal</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px;">
          <h2>Hello ${exhibitor.name},</h2>
          <p>Your exhibitor account has been created successfully.</p>
          
          <div style="background: white; border: 1px solid #d1d5db; border-radius: 5px; padding: 15px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Your Login Credentials:</h3>
            <p><strong>Email:</strong> ${exhibitor.email}</p>
            <p><strong>Password:</strong> ${password}</p>
            <p><strong>Company:</strong> ${exhibitor.company}</p>
            <p><strong>Booth Number:</strong> ${exhibitor.boothNumber || 'To be assigned'}</p>
          </div>
          
          <p>
            <a href="${loginUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Login to Your Dashboard
            </a>
          </p>
          
          <p><strong>Important:</strong> Please change your password after first login.</p>
          
          <p>Best regards,<br>
          Exhibition Management Team</p>
        </div>
      </div>
    `;

    return this.sendEmail(
      exhibitor.email,
      "Your Exhibition Portal Account Credentials",
      html
    );
  }

  async testConnection() {
    try {
      const transporter = await this.getTransporter();
      if (!transporter) {
        return { connected: false, message: 'Email not configured' };
      }
      
      await transporter.verify();
      return { connected: true };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }
}

module.exports = new EmailService();