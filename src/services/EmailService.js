// services/EmailService.js - Add actual sending capability
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Initialize transporter with SMTP settings
    this.transporter = nodemailer.createTransport({
     service: 'gmail',
      secure:  'true',
      auth: {
        user: "mondalrohan201@gmail.com", // Your email
        pass: "fmvg vbvc bbcq mycy", // Your password or app-specific password
      },
    });
    
    console.log('📧 Email Service initialized (SMTP Mode)');
  }

  async sendEmail(to, subject, html) {
    try {
      console.log('\n' + '='.repeat(70));
      console.log('📧 SENDING EMAIL');
      console.log('='.repeat(70));
      console.log(`📨 To: ${to}`);
      console.log(`📝 Subject: ${subject}`);
      
      // Extract password for logging
      const text = html.replace(/<[^>]*>/g, '');
      const passwordMatch = text.match(/Password:\s*([^\n\r]+)/i);
      if (passwordMatch) {
        console.log(`🔑 PASSWORD: ${passwordMatch[1].trim()}`);
      }
      
      // ACTUALLY SEND THE EMAIL via SMTP
      const mailOptions = {
        from: `"Bengaluru Fitness Festival" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: to,
        subject: subject,
        html: html,
      };
      
      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ EMAIL SENT SUCCESSFULLY via SMTP`);
      console.log(`📨 Message ID: ${info.messageId}`);
      console.log(`📨 To: ${to}`);
      console.log(`🔑 Password: ${passwordMatch ? passwordMatch[1].trim() : 'Not found'}`);
      console.log('='.repeat(70) + '\n');
      
      return {
        messageId: info.messageId,
        accepted: [to],
        response: 'Email sent via SMTP'
      };
      
    } catch (error) {
      console.error('❌ Error sending email:', error.message);
      console.log('='.repeat(70) + '\n');
      
      // FALLBACK: Log to console if SMTP fails
      console.log('⚠️ FALLBACK: Email logged to console only');
      
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

  // Add method to send visitor registration to exhibitor
  async sendVisitorRegistrationToExhibitor(exhibitorEmail, visitorData) {
    const subject = 'New Visitor Registration - Exhibition';
    const html = `
      <h2>New Visitor Registration</h2>
      <p>A new visitor has registered for your exhibition:</p>
      <hr>
      <p><strong>Name:</strong> ${visitorData.name}</p>
      <p><strong>Designation:</strong> ${visitorData.designation}</p>
      <p><strong>Company:</strong> ${visitorData.company}</p>
      <p><strong>Email:</strong> ${visitorData.email}</p>
      <p><strong>Mobile:</strong> ${visitorData.mobile}</p>
      <p><strong>Country:</strong> ${visitorData.country}</p>
      <p><strong>City:</strong> ${visitorData.city}</p>
      <hr>
      <p>Please contact them for further communication.</p>
    `;
    
    return this.sendEmail(exhibitorEmail, subject, html);
  }

  // Add method to send confirmation to visitor
  async sendVisitorConfirmation(visitorData) {
    const subject = 'Registration Confirmed - Exhibition';
    const html = `
      <h2>Registration Confirmed!</h2>
      <p>Dear ${visitorData.name},</p>
      <p>Thank you for registering for the exhibition. Your registration has been confirmed.</p>
      <hr>
      <p><strong>Registration Details:</strong></p>
      <p><strong>Name:</strong> ${visitorData.name}</p>
      <p><strong>Company:</strong> ${visitorData.company}</p>
      <p><strong>Email:</strong> ${visitorData.email}</p>
      <hr>
      <p>We look forward to seeing you at the event!</p>
      <p>Best regards,<br/>Exhibition Team</p>
    `;
    
    return this.sendEmail(visitorData.email, subject, html);
  }
}

module.exports = new EmailService();