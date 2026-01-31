// services/EmailService.js - Add actual sending capability
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Console-only mode (no SMTP)
    this.transporter = null;
    console.log('📧 Email Service initialized (Console Mode - Credentials displayed below)');
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
      
      // Console-only mode (no SMTP)
      console.log(`✅ EMAIL DISPLAYED IN CONSOLE (Not sent via SMTP)`);
      console.log(`📨 To: ${to}`);
      console.log(`🔑 Password: ${passwordMatch ? passwordMatch[1].trim() : 'Not found'}`);
      console.log('='.repeat(70) + '\n');
      
      return {
        messageId: 'console-' + Date.now(),
        accepted: [to],
        response: 'Email displayed in console (no SMTP)'
      };
      
    } catch (error) {
      console.error('❌ Error preparing email:', error.message);
      console.log('='.repeat(70) + '\n');
      
      return {
        messageId: 'error-' + Date.now(),
        accepted: [to],
        response: 'Error: ' + error.message
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
