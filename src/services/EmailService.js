// services/EmailService.js - Add actual sending capability
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Initialize transporter with Gmail
    try {
      // For Gmail (easiest to set up)
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'mondalrohan201@gmail.com', // Your Gmail
          pass: 'edtq coey qbkz bnqu'     // App password from Google
        }
      });
      
      // Verify connection immediately
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('❌ Gmail SMTP connection error:', error.message);
          this.transporter = null;
        } else {
          console.log('✅ Email Service initialized (Gmail SMTP ready)');
        }
      });
    } catch (error) {
      console.error('❌ Email Service initialization error:', error.message);
      this.transporter = null;
    }
  }

  async sendEmail(to, subject, html) {
    try {
      console.log('\n' + '='.repeat(70));
      console.log('📧 SENDING EMAIL');
      console.log('='.repeat(70));
      console.log(`📨 To: ${to}`);
      console.log(`📝 Subject: ${subject}`);
      
      // Log to console first
      const text = html.replace(/<[^>]*>/g, '');
      const passwordMatch = text.match(/Password:\s*([^\n\r]+)/i);
      if (passwordMatch) {
        console.log(`🔑 PASSWORD: ${passwordMatch[1].trim()}`);
      }
      
      // Try to send actual email if transporter exists
      if (this.transporter) {
        const mailOptions = {
          from: 'Exhibition Portal <mondalrohan201@gmail.com>',
          to: to,
          subject: subject,
          html: html,
          text: text
        };
        
        try {
          const info = await this.transporter.sendMail(mailOptions);
          console.log(`✅ Email SENT successfully to ${to}`);
          console.log(`📫 Message ID: ${info.messageId}`);
          console.log('='.repeat(70) + '\n');
          return info;
        } catch (sendError) {
          console.error(`❌ Email send failed: ${sendError.message}`);
          console.log('='.repeat(70) + '\n');
          throw sendError;
        }
      } else {
        console.log(`❌ EMAIL NOT SENT (Gmail SMTP not configured)`);
        console.log(`ℹ️ Would send to: ${to}`);
        console.log(`🔑 Password: ${passwordMatch ? passwordMatch[1].trim() : 'Not found'}`);
        console.log('='.repeat(70) + '\n');
        
        return {
          messageId: 'console-' + Date.now(),
          accepted: [to],
          response: 'Email logged to console (SMTP not configured)'
        };
      }
      
    } catch (error) {
      console.error('❌ Email error:', error.message);
      console.log('📋 Fallback - Showing credentials:');
      console.log(`To: ${to}`);
      console.log(`Password would be: [Check console above]`);
      
      return {
        messageId: 'error-' + Date.now(),
        accepted: [to],
        response: 'Email failed: ' + error.message
      };
    }
  }

  async sendExhibitorWelcome(exhibitor, plainPassword) {
    const subject = 'Exhibition Portal - Login Credentials';
    const html = `
      <h2>Welcome to the Exhibition Portal</h2>
      <p>Dear ${exhibitor.name || exhibitor.email},</p>
      <p>Your account has been created. Here are your login credentials:</p>
      <hr>
      <p><strong>Email:</strong> ${exhibitor.email}</p>
      <p><strong>Password:</strong> ${plainPassword}</p>
      <hr>
      <p>Please log in to your account and change your password for security.</p>
      <p>Best regards,<br/>Exhibition Team</p>
    `;
    
    return this.sendEmail(exhibitor.email, subject, html);
  }
}

module.exports = new EmailService();
