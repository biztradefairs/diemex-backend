const sgMail = require("@sendgrid/mail");

class EmailService {
  constructor() {
    this.initialized = false;
    this.init();
  }

  init() {
    if (!process.env.SENDGRID_API_KEY) {
      console.error("❌ SENDGRID_API_KEY is missing in environment variables");
      return;
    }

    if (!process.env.SENDGRID_FROM) {
      console.error("❌ SENDGRID_FROM is missing in environment variables");
      return;
    }

    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      this.initialized = true;
      console.log("✅ Email Service initialized with SendGrid");
      console.log(`📧 From email: ${process.env.SENDGRID_FROM}`);
    } catch (error) {
      console.error("❌ Failed to initialize SendGrid:", error.message);
    }
  }

  async sendEmail(to, subject, html) {
    // Check if initialized
    if (!this.initialized) {
      console.error("❌ Email service not initialized. Check your SendGrid configuration.");
      // For development, log instead of sending
      console.log("📧 Would send email:", { to, subject, html });
      return { success: true, mock: true };
    }

    try {
      const msg = {
        to,
        from: process.env.SENDGRID_FROM,
        subject,
        html,
      };

      console.log(`📧 Attempting to send email to: ${to}`);
      console.log(`📧 Subject: ${subject}`);

      const response = await sgMail.send(msg);

      console.log(`✅ Email sent successfully to ${to}`);
      console.log(`📧 Message ID: ${response[0]?.headers?.['x-message-id'] || 'Unknown'}`);

      return {
        success: true,
        messageId: response[0]?.headers?.['x-message-id'],
      };
    } catch (error) {
      console.error("❌ SendGrid Error Details:");
      console.error("- Message:", error.message);
      
      if (error.response) {
        console.error("- Status Code:", error.response.statusCode);
        console.error("- Response Body:", error.response.body);
        console.error("- Response Headers:", error.response.headers);
      }

      return {
        success: false,
        error: error.message,
        details: error.response?.body || 'Unknown error'
      };
    }
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

  // Your existing methods...
  async sendExhibitorWelcome(exhibitor, plainPassword) {
    const subject = "Welcome to DIEMEX Exhibitor Portal - Login Credentials";
    const html = `
      <h2>Welcome to DIEMEX Exhibition Portal</h2>
      <p>Dear ${exhibitor.name},</p>
      <p>Your exhibitor account has been created successfully.</p>
      <hr>
      <p><strong>Email:</strong> ${exhibitor.email}</p>
      <p><strong>Password:</strong> ${plainPassword}</p>
      <hr>
      <p>Please login and change your password immediately for security.</p>
      <p>Login here: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/login</p>
      <p>Best regards,<br/>DIEMEX Exhibition Team</p>
    `;
    return this.sendEmail(exhibitor.email, subject, html);
  }

  async sendVisitorOTP(email, name, otp) {
    const subject = "Your Verification Code - DIEMEX Exhibition";
    const html = `
      <h2>Email Verification</h2>
      <p>Dear ${name},</p>
      <p>Your OTP for DIEMEX exhibition registration is:</p>
      <h1 style="font-size:36px; letter-spacing:8px; text-align:center; background:#f0f0f0; padding:20px; border-radius:8px;">${otp}</h1>
      <p>This code expires in 5 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `;
    return this.sendEmail(email, subject, html);
  }

  async sendVisitorConfirmation(visitorData) {
    const subject = "Registration Confirmed - DIEMEX Exhibition";
    const html = `
      <h2>Registration Confirmed!</h2>
      <p>Dear ${visitorData.name},</p>
      <p>Your registration for DIEMEX Exhibition has been successfully completed.</p>
      <hr>
      <p><strong>Name:</strong> ${visitorData.name}</p>
      <p><strong>Company:</strong> ${visitorData.company}</p>
      <p><strong>Email:</strong> ${visitorData.email}</p>
      <hr>
      <p>We look forward to seeing you at the exhibition!</p>
      <p>Best regards,<br/>DIEMEX Team</p>
    `;
    return this.sendEmail(visitorData.email, subject, html);
  }

  // Test method to verify configuration
  async testConnection() {
    if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM) {
      throw new Error("SendGrid environment variables missing");
    }

    if (!this.initialized) {
      throw new Error("SendGrid not initialized");
    }

    console.log("✅ SendGrid configuration OK");
    console.log(`📧 From: ${process.env.SENDGRID_FROM}`);
    console.log(`🔑 API Key: ${process.env.SENDGRID_API_KEY.substring(0, 10)}...`);

    return true;
  }
}

module.exports = new EmailService();