// src/services/EmailService.js
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this._transporter = null;
  }

  // Lazy getter for transporter
  get transporter() {
    if (!this._transporter) {
      this._transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_PORT === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }
    return this._transporter;
  }

  async sendEmail(to, subject, html, attachments = []) {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        html,
        attachments
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Email sent: ${info.messageId}`);
      
      // Send notification
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendNotification('EMAIL_SENT', null, {
          to,
          subject,
          messageId: info.messageId
        });
      } catch (kafkaError) {
        console.warn('Kafka not available for notification:', kafkaError.message);
      }

      return info;
    } catch (error) {
      console.error(`❌ Failed to send email: ${error.message}`);
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }

  async sendWelcomeEmail(user) {
    const subject = 'Welcome to Exhibition Admin Dashboard';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">Welcome ${user.name}!</h2>
        
        <p>Your account has been created successfully in the Exhibition Admin Dashboard.</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Account Details:</strong></p>
          <p>Email: ${user.email}</p>
          <p>Role: <span style="color: #4CAF50; font-weight: bold;">${user.role}</span></p>
          <p>Status: <span style="color: #4CAF50; font-weight: bold;">${user.status}</span></p>
        </div>
        
        <p>You can now access the exhibition admin dashboard to manage:</p>
        <ul>
          <li>Exhibitors and their information</li>
          <li>Articles and content</li>
          <li>Invoices and payments</li>
          <li>Floor plans and layouts</li>
          <li>Media and files</li>
        </ul>
        
        <p>If you have any questions or need assistance, please contact the system administrator.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
          <p>Thank you,</p>
          <p><strong>The Exhibition Management Team</strong></p>
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const subject = 'Password Reset Request - Exhibition Admin';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333; border-bottom: 2px solid #ff9800; padding-bottom: 10px;">Password Reset</h2>
        
        <p>You requested a password reset for your Exhibition Admin Dashboard account.</p>
        
        <div style="background-color: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
          <p><strong>Click the button below to reset your password:</strong></p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #ff9800; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px 0;">
            Reset Password
          </a>
          <p style="font-size: 12px; color: #666; margin-top: 10px;">
            Or copy this link: <br>
            <a href="${resetUrl}" style="color: #2196F3; word-break: break-all;">${resetUrl}</a>
          </p>
        </div>
        
        <p style="color: #f44336; font-weight: bold;">⚠️ This link will expire in 1 hour.</p>
        
        <p>If you didn't request this password reset, please ignore this email or contact the administrator if you're concerned about your account's security.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
          <p>Thank you,</p>
          <p><strong>The Exhibition Management Team</strong></p>
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  async sendInvoiceEmail(user, invoice, pdfBuffer = null) {
    const subject = `Invoice ${invoice.invoiceNumber} - Exhibition Management`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333; border-bottom: 2px solid #2196F3; padding-bottom: 10px;">Invoice ${invoice.invoiceNumber}</h2>
        
        <p>Dear ${user.name},</p>
        
        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Invoice Summary:</strong></p>
          <p>Invoice Number: <strong>${invoice.invoiceNumber}</strong></p>
          <p>Amount Due: <strong style="color: #2196F3;">$${invoice.amount.toFixed(2)}</strong></p>
          <p>Due Date: <strong>${new Date(invoice.dueDate).toLocaleDateString()}</strong></p>
          <p>Status: <span style="color: ${invoice.status === 'paid' ? '#4CAF50' : '#ff9800'}; font-weight: bold;">${invoice.status.toUpperCase()}</span></p>
        </div>
        
        <p>Please find attached your invoice for the exhibition participation.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Payment Instructions:</strong></p>
          <p>1. Review the attached invoice</p>
          <p>2. Make payment before the due date</p>
          <p>3. Keep this email for your records</p>
          <p>4. Contact us if you have any questions</p>
        </div>
        
        <p>Thank you for your participation in our exhibition!</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
          <p>Thank you for your business!</p>
          <p><strong>The Exhibition Management Team</strong></p>
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    `;

    const attachments = pdfBuffer ? [{
      filename: `invoice-${invoice.invoiceNumber}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }] : [];

    return this.sendEmail(user.email, subject, html, attachments);
  }

  async sendPaymentConfirmation(user, payment) {
    const subject = `Payment Confirmation - Transaction ${payment.transactionId}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">Payment Confirmation</h2>
        
        <p>Dear ${user.name},</p>
        
        <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Payment Details:</strong></p>
          <p>Transaction ID: <strong>${payment.transactionId}</strong></p>
          <p>Amount: <strong style="color: #4CAF50;">$${payment.amount.toFixed(2)}</strong></p>
          <p>Date: <strong>${new Date(payment.date).toLocaleDateString()}</strong></p>
          <p>Method: <strong>${payment.method}</strong></p>
          <p>Status: <span style="color: #4CAF50; font-weight: bold;">${payment.status.toUpperCase()}</span></p>
        </div>
        
        <p>Your payment has been successfully processed. Thank you for your prompt payment!</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
          <p>Thank you,</p>
          <p><strong>The Exhibition Management Team</strong></p>
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  // src/services/EmailService.js (add these methods)
async sendExhibitorWelcome(exhibitor, password) {
  const subject = 'Welcome to Exhibition Portal';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">Welcome ${exhibitor.name}!</h2>
      
      <p>Your exhibitor account has been created successfully.</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Account Details:</strong></p>
        <p>Company: ${exhibitor.company}</p>
        <p>Email: ${exhibitor.email}</p>
        <p>Booth Number: ${exhibitor.boothNumber || 'To be assigned'}</p>
        <p>Temporary Password: <strong>${password}</strong></p>
      </div>
      
      <div style="background-color: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Important:</strong> You must reset your password on first login.</p>
        <p>Login URL: <a href="${process.env.FRONTEND_URL}/login">${process.env.FRONTEND_URL}/login</a></p>
      </div>
      
      <p>You can now access your exhibitor dashboard to:</p>
      <ul>
        <li>View your stall layout</li>
        <li>Access exhibitor manual</li>
        <li>Submit extra requirements</li>
        <li>View and pay invoices</li>
        <li>Update company profile</li>
      </ul>
      
      <p>If you have any questions, please contact exhibition support.</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
        <p>Thank you,</p>
        <p><strong>The Exhibition Management Team</strong></p>
      </div>
    </div>
  `;

  return this.sendEmail(exhibitor.email, subject, html);
}

async sendPasswordResetExhibitor(exhibitor, resetUrl) {
  const subject = 'Password Reset Request - Exhibition Portal';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #333; border-bottom: 2px solid #ff9800; padding-bottom: 10px;">Password Reset</h2>
      
      <p>You requested a password reset for your Exhibition Portal account.</p>
      
      <div style="background-color: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
        <p><strong>Click the button below to reset your password:</strong></p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #ff9800; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px 0;">
          Reset Password
        </a>
        <p style="font-size: 12px; color: #666; margin-top: 10px;">
          This link will expire in 1 hour.
        </p>
      </div>
      
      <p>If you didn't request this password reset, please ignore this email.</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
        <p>Thank you,</p>
        <p><strong>The Exhibition Management Team</strong></p>
      </div>
    </div>
  `;

  return this.sendEmail(exhibitor.email, subject, html);
}

async sendPasswordResetConfirmation(exhibitor) {
  const subject = 'Password Reset Successful - Exhibition Portal';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">Password Reset Successful</h2>
      
      <p>Your password has been successfully reset.</p>
      
      <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>If you did not make this change, please contact support immediately.</strong></p>
        <p>Email: support@exhibition.com</p>
        <p>Phone: +1 (555) 123-4567</p>
      </div>
      
      <p>You can now login with your new password:</p>
      <p><a href="${process.env.FRONTEND_URL}/login">${process.env.FRONTEND_URL}/login</a></p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
        <p>Thank you,</p>
        <p><strong>The Exhibition Management Team</strong></p>
      </div>
    </div>
  `;

  return this.sendEmail(exhibitor.email, subject, html);
}

  async sendSystemAlert(subject, message, priority = 'medium') {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.warn('Admin email not configured for system alerts');
      return;
    }
    
    const priorityColors = {
      high: '#f44336',
      medium: '#ff9800',
      low: '#2196F3'
    };
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid ${priorityColors[priority]}; border-radius: 5px;">
        <h2 style="color: ${priorityColors[priority]}; border-bottom: 2px solid ${priorityColors[priority]}; padding-bottom: 10px;">System Alert: ${subject}</h2>
        
        <div style="background-color: #fff8e1; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Priority:</strong> <span style="color: ${priorityColors[priority]}; font-weight: bold;">${priority.toUpperCase()}</span></p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Message:</strong></p>
          <p>${message}</p>
        </div>
        
        <p>This is an automated system alert. Please investigate the issue.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
          <p><strong>Exhibition Admin System</strong></p>
          <p>Environment: ${process.env.NODE_ENV || 'development'}</p>
        </div>
      </div>
    `;

    return this.sendEmail(adminEmail, `[SYSTEM ALERT] ${subject}`, html);
  }

  async testConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Email service connection verified');
      return true;
    } catch (error) {
      console.error('❌ Email service connection failed:', error.message);
      return false;
    }
  }
}

module.exports = new EmailService();