const sgMail = require("@sendgrid/mail");
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.initialized = false;
    this.fallbackTransporter = null;
    this.init();
  }

  init() {
    // Initialize SendGrid
    if (process.env.SENDGRID_API_KEY) {
      try {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        this.initialized = true;
        console.log("✅ Email Service initialized with SendGrid");
        console.log(`📧 From email: ${process.env.SENDGRID_FROM}`);
      } catch (error) {
        console.error("❌ Failed to initialize SendGrid:", error.message);
      }
    } else {
      console.warn("⚠️ SENDGRID_API_KEY not found in environment variables");
    }

    // Setup fallback email service (using SMTP)
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      try {
        this.fallbackTransporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
        console.log("✅ Fallback SMTP service configured");
      } catch (error) {
        console.error("❌ Failed to initialize SMTP:", error.message);
      }
    } else {
      console.warn("⚠️ SMTP credentials not configured for fallback");
    }
  }

  async sendEmail(to, subject, html) {
    // Validate email
    if (!to || !subject || !html) {
      console.error("❌ Missing required email parameters");
      return { 
        success: false, 
        error: "Missing required parameters" 
      };
    }

    // Try SendGrid first
    if (this.initialized) {
      try {
        const result = await this.sendWithSendGrid(to, subject, html);
        if (result.success) return result;
      } catch (error) {
        console.error("❌ SendGrid failed, trying fallback:", error.message);
      }
    }

    // Try fallback SMTP
    if (this.fallbackTransporter) {
      try {
        const result = await this.sendWithSMTP(to, subject, html);
        if (result.success) return result;
      } catch (error) {
        console.error("❌ SMTP fallback failed:", error.message);
      }
    }

    // Last resort: Log email (for development)
    console.log("📧 WOULD SEND EMAIL (No email service available):", { 
      to, 
      subject, 
      htmlLength: html.length 
    });
    
    return { 
      success: false, 
      mock: true,
      message: "Email services unavailable" 
    };
  }

  async sendWithSendGrid(to, subject, html) {
    if (!process.env.SENDGRID_FROM) {
      throw new Error("SENDGRID_FROM not configured");
    }

    const msg = {
      to,
      from: process.env.SENDGRID_FROM,
      subject,
      html,
    };

    console.log(`📧 Attempting to send email via SendGrid:`);
    console.log(`   To: ${to}`);
    console.log(`   From: ${process.env.SENDGRID_FROM}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   HTML Length: ${html.length} characters`);

    const response = await sgMail.send(msg);

    console.log(`✅ Email sent successfully via SendGrid to ${to}`);
    console.log(`📧 Message ID: ${response[0]?.headers?.['x-message-id'] || 'Unknown'}`);

    return {
      success: true,
      provider: 'sendgrid',
      messageId: response[0]?.headers?.['x-message-id'],
    };
  }

  async sendWithSMTP(to, subject, html) {
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SENDGRID_FROM,
      to,
      subject,
      html,
    };

    console.log(`📧 Attempting to send email via SMTP:`);
    console.log(`   To: ${to}`);
    console.log(`   From: ${mailOptions.from}`);
    console.log(`   Subject: ${subject}`);

    const info = await this.fallbackTransporter.sendMail(mailOptions);
    
    console.log(`✅ Email sent successfully via SMTP to ${to}`);
    console.log(`📧 Message ID: ${info.messageId}`);

    return {
      success: true,
      provider: 'smtp',
      messageId: info.messageId,
    };
  }

  async sendEmailWithAttachment({ to, subject, html, attachment }) {
    // Validate parameters
    if (!to || !subject || !html || !attachment) {
      console.error("❌ Missing required parameters for attachment email");
      return { 
        success: false, 
        error: "Missing required parameters" 
      };
    }

    // Try SendGrid first
    if (this.initialized) {
      try {
        const result = await this.sendWithSendGridAttachment(to, subject, html, attachment);
        if (result.success) return result;
      } catch (error) {
        console.error("❌ SendGrid attachment failed, trying fallback:", error.message);
      }
    }

    // Try fallback SMTP
    if (this.fallbackTransporter) {
      try {
        const result = await this.sendWithSMTPAttachment(to, subject, html, attachment);
        if (result.success) return result;
      } catch (error) {
        console.error("❌ SMTP attachment fallback failed:", error.message);
      }
    }

    // Log if no email service available
    console.log("📧 WOULD SEND EMAIL WITH ATTACHMENT (No service available):", { 
      to, 
      subject, 
      attachmentFilename: attachment.filename 
    });
    
    return { 
      success: false, 
      mock: true,
      message: "Email services unavailable" 
    };
  }

  async sendWithSendGridAttachment(to, subject, html, attachment) {
    if (!process.env.SENDGRID_FROM) {
      throw new Error("SENDGRID_FROM not configured");
    }

    const msg = {
      to,
      from: process.env.SENDGRID_FROM,
      subject,
      html,
      attachments: [{
        content: attachment.content.toString('base64'),
        filename: attachment.filename,
        type: attachment.contentType || 'image/png',
        disposition: 'inline',
        content_id: attachment.cid
      }]
    };

    console.log(`📧 Attempting to send email with attachment via SendGrid:`);
    console.log(`   To: ${to}`);
    console.log(`   From: ${process.env.SENDGRID_FROM}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Attachment: ${attachment.filename}`);
    console.log(`   CID: ${attachment.cid}`);

    const response = await sgMail.send(msg);

    console.log(`✅ Email with attachment sent via SendGrid to ${to}`);
    console.log(`📧 Message ID: ${response[0]?.headers?.['x-message-id'] || 'Unknown'}`);

    return {
      success: true,
      provider: 'sendgrid',
      messageId: response[0]?.headers?.['x-message-id'],
    };
  }

  async sendWithSMTPAttachment(to, subject, html, attachment) {
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SENDGRID_FROM,
      to,
      subject,
      html,
      attachments: [{
        filename: attachment.filename,
        content: attachment.content,
        cid: attachment.cid
      }]
    };

    console.log(`📧 Attempting to send email with attachment via SMTP:`);
    console.log(`   To: ${to}`);
    console.log(`   From: ${mailOptions.from}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Attachment: ${attachment.filename}`);

    const info = await this.fallbackTransporter.sendMail(mailOptions);
    
    console.log(`✅ Email with attachment sent via SMTP to ${to}`);
    console.log(`📧 Message ID: ${info.messageId}`);

    return {
      success: true,
      provider: 'smtp',
      messageId: info.messageId,
    };
  }

  /**
   * Send password reset email with reset link
   */
  async sendPasswordResetEmail(email, name, resetUrl) {
    const subject = "🔐 Reset Your Password - DIEMEX Exhibitor Portal";
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - DIEMEX</title>
        <style>
          @media only screen and (max-width: 600px) {
            .container { width: 100% !important; }
            .button { width: 100% !important; display: block !important; }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 40px 0;">
          <tr>
          <td align="center">
            <table class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden;">
              
              <!-- Header with DIEMEX Branding -->
              <tr>
                <td style="background: linear-gradient(135deg, #004D9F 0%, #00A3E0 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 36px; font-weight: 600; letter-spacing: 1px;">DIEMEX</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">Exhibitor Portal</p>
                  </td>
              </tr>
              
              <!-- Main Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #333333; margin: 0 0 20px; font-size: 24px; font-weight: 600;">Password Reset Request</h2>
                  
                  <p style="color: #666666; margin: 0 0 20px; font-size: 16px; line-height: 1.6;">
                    Hello <strong style="color: #004D9F;">${name || 'Exhibitor'}</strong>,
                  </p>
                  
                  <p style="color: #666666; margin: 0 0 20px; font-size: 16px; line-height: 1.6;">
                    We received a request to reset the password for your DIEMEX Exhibitor Portal account. 
                    Click the button below to create a new password:
                  </p>
                  
                  <!-- Reset Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" style="padding: 20px 0 30px;">
                        <a href="${resetUrl}" 
                           style="background: linear-gradient(135deg, #004D9F 0%, #00A3E0 100%); 
                                  color: white; 
                                  padding: 16px 40px; 
                                  text-decoration: none; 
                                  border-radius: 50px; 
                                  font-weight: 600;
                                  font-size: 16px;
                                  display: inline-block;
                                  box-shadow: 0 4px 15px rgba(0, 77, 159, 0.3);
                                  border: none;">
                          🔐 Reset My Password
                        </a>
                        </td>
                    </tr>
                  </table>
                  
                  <!-- Security Info Box -->
                  <div style="background-color: #f8f9fa; border-left: 4px solid #004D9F; padding: 20px; margin: 30px 0; border-radius: 4px;">
                    <p style="color: #666666; margin: 0 0 10px; font-size: 14px; line-height: 1.6;">
                      <strong>⚠️ Important Security Information:</strong>
                    </p>
                    <p style="color: #666666; margin: 0; font-size: 14px; line-height: 1.6;">
                      • This link will expire in <strong>1 hour</strong><br>
                      • If you didn't request this, please ignore this email<br>
                      • Never share this link with anyone<br>
                      • DIEMEX team will never ask for your password
                    </p>
                  </div>
                  
                  <!-- Alternative Link -->
                  <p style="color: #999999; margin: 20px 0 0; font-size: 14px; line-height: 1.6;">
                    If the button doesn't work, copy and paste this link into your browser:
                  </p>
                  <p style="background-color: #f0f0f0; padding: 15px; border-radius: 6px; font-size: 14px; word-break: break-all; margin: 10px 0 0; color: #004D9F;">
                    ${resetUrl}
                  </p>
                  
                  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 40px 0 20px;">
                  
                  <!-- Footer -->
                  <p style="color: #999999; margin: 0 0 10px; font-size: 13px; line-height: 1.6; text-align: center;">
                    Need help? Contact us at 
                    <a href="mailto:support@diemex.com" style="color: #004D9F; text-decoration: none;">support@diemex.com</a>
                  </p>
                  <p style="color: #999999; margin: 0; font-size: 12px; text-align: center;">
                    &copy; ${new Date().getFullYear()} DIEMEX Exhibition. All rights reserved.
                  </p>
                  <p style="color: #999999; margin: 10px 0 0; font-size: 11px; text-align: center;">
                    This email was sent to ${email}
                  </p>
                  </td>
              </tr>
            </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return this.sendEmail(email, subject, html);
  }

  /**
   * Send password reset confirmation email
   */
  async sendPasswordResetConfirmation(email, name) {
    const subject = "✅ Password Reset Successful - DIEMEX Exhibitor Portal";
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Successful - DIEMEX</title>
        <style>
          @media only screen and (max-width: 600px) {
            .container { width: 100% !important; }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 40px 0;">
          <tr>
          <td align="center">
            <table class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden;">
              
              <!-- Success Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 40px 30px; text-align: center;">
                  <div style="background-color: rgba(255,255,255,0.2); width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                    <span style="color: white; font-size: 40px;">✓</span>
                  </div>
                  <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset Successful!</h1>
                  </td>
              </tr>
              
              <!-- Main Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #333333; margin: 0 0 20px; font-size: 22px;">Hello ${name || 'Exhibitor'},</h2>
                  
                  <p style="color: #666666; margin: 0 0 20px; font-size: 16px; line-height: 1.6;">
                    Your password has been successfully reset. You can now log in to your DIEMEX Exhibitor Portal account with your new password.
                  </p>
                  
                  <!-- Login Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" style="padding: 20px 0;">
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" 
                           style="background: linear-gradient(135deg, #004D9F 0%, #00A3E0 100%); 
                                  color: white; 
                                  padding: 14px 40px; 
                                  text-decoration: none; 
                                  border-radius: 50px; 
                                  font-weight: 600;
                                  font-size: 16px;
                                  display: inline-block;
                                  box-shadow: 0 4px 15px rgba(0, 77, 159, 0.3);">
                            🔐 Go to Login
                          </a>
                          </td>
                    </tr>
                  </table>
                  
                  <!-- Security Notice -->
                  <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 30px 0; border-radius: 4px;">
                    <p style="color: #856404; margin: 0; font-size: 14px; line-height: 1.6;">
                      <strong>🔔 Didn't request this change?</strong><br>
                      If you did not reset your password, please contact our support team immediately at 
                      <a href="mailto:support@diemex.com" style="color: #004D9F;">support@diemex.com</a>
                    </p>
                  </div>
                  
                  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                  
                  <!-- Footer -->
                  <p style="color: #999999; margin: 0; font-size: 12px; text-align: center;">
                    &copy; ${new Date().getFullYear()} DIEMEX Exhibition. All rights reserved.
                  </p>
                  <p style="color: #999999; margin: 10px 0 0; font-size: 11px; text-align: center;">
                    This email was sent to ${email}
                  </p>
                  </td>
              </tr>
            </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return this.sendEmail(email, subject, html);
  }

  async sendExhibitorWelcome(exhibitor, plainPassword) {
    const subject = "Welcome to DIEMEX Exhibitor Portal - Login Credentials";
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to DIEMEX Exhibitor Portal</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #004D9F; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; }
          .credentials { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .warning { color: #dc3545; font-size: 14px; }
          .button { display: inline-block; background: #004D9F; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to DIEMEX Exhibitor Portal</h1>
          </div>
          <div class="content">
            <h2>Dear ${exhibitor.name},</h2>
            <p>Your exhibitor account has been created successfully for DIEMEX Exhibition.</p>
            
            <div class="credentials">
              <h3>Your Login Credentials:</h3>
              <p><strong>Email:</strong> ${exhibitor.email}</p>
              <p><strong>Password:</strong> ${plainPassword}</p>
            </div>
            
            <p class="warning"><strong>⚠️ Important:</strong> Please login and change your password immediately for security.</p>
            
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" class="button">
              Login to Your Account
            </a>
            
            <hr style="margin: 30px 0;">
            
            <p>Best regards,<br>
            <strong>DIEMEX Exhibition Team</strong><br>
            <img src="https://res.cloudinary.com/deo4vpw8f/image/upload/v1774687173/maxxlogo_lulkwh.png" alt="DIEMEX" style="max-width: 150px; margin-top: 10px;">
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail(exhibitor.email, subject, html);
  }

  async sendVisitorOTP(email, name, otp) {
    const subject = "Your Verification Code - DIEMEX Exhibition";
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Email Verification - DIEMEX</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 5px; background: #f0f0f0; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h2>Email Verification</h2>
        <p>Dear ${name},</p>
        <p>Your OTP for DIEMEX exhibition registration is:</p>
        <div class="otp-code">${otp}</div>
        <p>This code expires in 5 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr>
        <p>Best regards,<br>DIEMEX Exhibition Team</p>
      </body>
      </html>
    `;
    return this.sendEmail(email, subject, html);
  }

  async sendVisitorConfirmation(visitorData) {
    const subject = "Registration Confirmed - DIEMEX Exhibition";
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Registration Confirmed - DIEMEX</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .details { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h2>Registration Confirmed!</h2>
        <p>Dear ${visitorData.name},</p>
        <p>Your registration for DIEMEX Exhibition has been successfully completed.</p>
        
        <div class="details">
          <h3>Registration Details:</h3>
          <p><strong>Name:</strong> ${visitorData.name}</p>
          <p><strong>Company:</strong> ${visitorData.company}</p>
          <p><strong>Email:</strong> ${visitorData.email}</p>
        </div>
        
        <p>We look forward to seeing you at the exhibition!</p>
        
        <p>Best regards,<br>
        <strong>DIEMEX Team</strong></p>
      </body>
      </html>
    `;
    return this.sendEmail(visitorData.email, subject, html);
  }

  async sendInvoiceEmail({ to, invoiceNumber, amount, pdfBuffer, dueDate }) {
    const subject = `Invoice ${invoiceNumber} from DIEMEX Exhibition`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice ${invoiceNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1e3a8a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .invoice-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .amount { font-size: 24px; color: #10b981; font-weight: bold; }
          .button { display: inline-block; background: #1e3a8a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>DIEMEX Exhibition</h1>
            <p>Invoice ${invoiceNumber}</p>
          </div>
          <div class="content">
            <h2>Dear Exhibitor,</h2>
            <p>Thank you for registering for DIEMEX Exhibition. Please find your invoice attached to this email.</p>
            
            <div class="invoice-details">
              <h3>Invoice Summary</h3>
              <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
              <p><strong>Amount:</strong> <span class="amount">₹${amount.toLocaleString()}</span></p>
              <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString('en-IN')}</p>
            </div>
            
            <p><strong>Payment Instructions:</strong></p>
            <p>Please make the payment via bank transfer to the following account:</p>
            <ul>
              <li><strong>Account Name:</strong> Maxx Business Media Pvt. Ltd.</li>
              <li><strong>Account Number:</strong> 272605000632</li>
              <li><strong>IFSC Code:</strong> ICIC0002726</li>
              <li><strong>Bank:</strong> ICICI Bank, New Delhi</li>
            </ul>
            
            <p>Please use your Invoice Number as reference when making the payment.</p>
            
            <p>If you have any questions, please don't hesitate to contact us.</p>
            
            <p>Best regards,<br>DIEMEX Exhibition Team</p>
          </div>
          <div class="footer">
            <p>DIEMEX Exhibition | www.diemex.com | support@diemex.com</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return await this.sendEmailWithAttachment({
      to,
      subject,
      html,
      attachment: {
        filename: `invoice-${invoiceNumber}.pdf`,
        content: pdfBuffer,
        cid: `invoice_${invoiceNumber}`,
        contentType: 'application/pdf'
      }
    });
  }
  
  // Test method to verify configuration
  async testConnection() {
    if (!process.env.SENDGRID_API_KEY && !process.env.SMTP_HOST) {
      throw new Error("No email service configured (SendGrid or SMTP)");
    }

    let services = [];
    
    if (this.initialized) {
      services.push("SendGrid");
      console.log("✅ SendGrid configuration OK");
      console.log(`📧 From: ${process.env.SENDGRID_FROM}`);
      console.log(`🔑 API Key: ${process.env.SENDGRID_API_KEY.substring(0, 10)}...`);
    }
    
    if (this.fallbackTransporter) {
      services.push("SMTP");
      console.log("✅ SMTP configuration OK");
      console.log(`📧 From: ${process.env.SMTP_FROM || process.env.SENDGRID_FROM}`);
    }
    
    console.log(`📧 Available email services: ${services.join(', ')}`);
    
    return {
      success: true,
      availableServices: services
    };
  }
}

module.exports = new EmailService();