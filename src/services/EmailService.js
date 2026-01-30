// services/EmailService.js - Add actual sending capability
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Try to create transporter, fallback to console
    try {
      // For Gmail (easiest to set up)
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'mondalrohan201@gmail.com', // Your Gmail
          pass: 'edtq coey qbkz bnqu'     // App password from Google
        }
      });
      console.log('📧 Email Service initialized (Gmail)');
    } catch (error) {
      console.log('📧 Email Service initialized (Console Mode)');
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
          from: 'Exhibition Portal <noreply@exhibition.com>',
          to: to,
          subject: subject,
          html: html,
          text: text
        };
        
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✅ Email SENT successfully to ${to}`);
        console.log(`📫 Message ID: ${info.messageId}`);
        return info;
      } else {
        console.log(`❌ EMAIL NOT SENT (No SMTP configured)`);
        console.log(`ℹ️ Would send to: ${to}`);
        console.log(`🔑 Password: ${passwordMatch ? passwordMatch[1].trim() : 'Not found'}`);
        console.log('='.repeat(70) + '\n');
        
        return {
          messageId: 'console-' + Date.now(),
          accepted: [to],
          response: 'Email logged to console (no SMTP configured)'
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
}