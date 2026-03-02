// routes/exhibitor-credentials.js
const express = require("express");
const router = express.Router();
const emailService = require("../services/EmailService");

// Send credentials to exhibitor
router.post("/send-credentials", async (req, res) => {
  try {
    const { email, name, company, password, boothNumber, loginUrl } = req.body;

    // Validate required fields
    if (!email || !name || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Email, name, and password are required" 
      });
    }

    console.log(`📧 Sending credentials to: ${email} (${name})`);

    // Create a beautiful HTML email for credentials
    const subject = "🎫 Your DIEMEX Exhibitor Portal Login Credentials";
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Exhibitor Login Credentials - DIEMEX</title>
        <style>
          @media only screen and (max-width: 600px) {
            .container { width: 100% !important; }
            .button { width: 100% !important; display: block !important; }
            .credentials-box { padding: 15px !important; }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.12); overflow: hidden;">
                
                <!-- Hero Header with Gradient -->
                <tr>
                  <td style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); padding: 48px 40px; text-align: center;">
                    <h1 style="color: white; margin: 0 0 10px; font-size: 42px; font-weight: 700; letter-spacing: 1px;">DIEMEX</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 18px; font-weight: 300;">International Exhibition 2024</p>
                    <div style="width: 60px; height: 4px; background: #ffd700; margin: 20px auto 0; border-radius: 2px;"></div>
                  </td>
                </tr>
                
                <!-- Welcome Message -->
                <tr>
                  <td style="padding: 40px 40px 20px;">
                    <h2 style="color: #1a1a1a; margin: 0 0 10px; font-size: 28px; font-weight: 600;">
                      Welcome, ${name}! 👋
                    </h2>
                    <p style="color: #4a5568; margin: 0; font-size: 16px; line-height: 1.6;">
                      Your exhibitor account has been successfully created. Below are your login credentials for the DIEMEX Exhibitor Portal.
                    </p>
                  </td>
                </tr>
                
                <!-- Company Info Banner -->
                <tr>
                  <td style="padding: 0 40px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; color: white;">
                      <table width="100%">
                        <tr>
                          <td style="font-size: 14px; opacity: 0.9; padding-bottom: 8px;">COMPANY</td>
                          <td style="font-size: 14px; opacity: 0.9; padding-bottom: 8px;">BOOTH NUMBER</td>
                        </tr>
                        <tr>
                          <td style="font-size: 24px; font-weight: 600;">${company || 'Not specified'}</td>
                          <td style="font-size: 24px; font-weight: 600;">${boothNumber || 'Not assigned'}</td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
                
                <!-- Credentials Box -->
                <tr>
                  <td style="padding: 30px 40px;">
                    <div style="background-color: #f8fafc; border: 2px solid #e2e8f0; border-radius: 16px; padding: 30px;">
                      <h3 style="color: #1e3c72; margin: 0 0 20px; font-size: 20px; font-weight: 600; text-align: center;">
                        🔐 Your Login Credentials
                      </h3>
                      
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding: 12px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <table width="100%">
                              <tr>
                                <td width="80" style="color: #718096; font-size: 14px;">Email:</td>
                                <td style="color: #1e3c72; font-size: 16px; font-weight: 600; font-family: monospace;">${email}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0 0;"></td>
                        </tr>
                        <tr>
                          <td style="padding: 12px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <table width="100%">
                              <tr>
                                <td width="80" style="color: #718096; font-size: 14px;">Password:</td>
                                <td style="color: #2a5298; font-size: 16px; font-weight: 600; font-family: monospace; letter-spacing: 1px;">${password}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      
                      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0 8px; border-radius: 8px;">
                        <p style="color: #92400e; margin: 0; font-size: 14px; font-weight: 500;">
                          ⚠️ Please save these credentials and change your password after first login for security.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
                
                <!-- Login Button -->
                <tr>
                  <td style="padding: 0 40px 30px;" align="center">
                    <a href="${loginUrl || 'http://localhost:3000/login'}" 
                       style="display: inline-block; 
                              background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
                              color: white; 
                              padding: 16px 48px; 
                              text-decoration: none; 
                              border-radius: 50px; 
                              font-weight: 600;
                              font-size: 18px;
                              box-shadow: 0 4px 15px rgba(30, 60, 114, 0.4);
                              border: none;">
                      🚀 Access Exhibitor Portal
                    </a>
                  </td>
                </tr>
                
                <!-- Quick Access Info -->
                <tr>
                  <td style="padding: 0 40px 30px;">
                    <table width="100%" style="background-color: #f8fafc; border-radius: 12px; padding: 20px;">
                      <tr>
                        <td align="center" style="color: #4a5568; font-size: 14px; line-height: 1.6;">
                          <strong>📋 Quick Tips:</strong><br>
                          • Bookmark the login page for easy access<br>
                          • Update your exhibitor profile after login<br>
                          • Upload your company brochure and products<br>
                          • Check booth management section for details
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Support Footer -->
                <tr>
                  <td style="padding: 30px 40px; background-color: #1a202c;">
                    <table width="100%">
                      <tr>
                        <td style="color: #a0aec0; font-size: 14px; line-height: 1.6;">
                          <p style="margin: 0 0 15px;">
                            <strong style="color: white;">Need Help?</strong><br>
                            Contact our support team for assistance:
                          </p>
                          <p style="margin: 0;">
                            📧 <a href="mailto:support@diemex.com" style="color: #90cdf4; text-decoration: none;">support@diemex.com</a><br>
                            📞 <span style="color: #90cdf4;">+1 (555) 123-4567</span>
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top: 20px; border-top: 1px solid #2d3748; color: #718096; font-size: 12px; text-align: center;">
                          &copy; ${new Date().getFullYear()} DIEMEX Exhibition. All rights reserved.<br>
                          This email contains confidential login credentials.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Send the email
    const result = await emailService.sendEmail(email, subject, html);
    
    if (result.success) {
      console.log(`✅ Credentials email sent successfully to ${email}`);
      return res.status(200).json({
        success: true,
        message: "Credentials sent successfully",
        recipient: email,
        messageId: result.messageId
      });
    } else {
      console.error("❌ Failed to send credentials email:", result.error);
      return res.status(500).json({
        success: false,
        message: "Failed to send email",
        error: result.error,
        details: result.details
      });
    }

  } catch (error) {
    console.error("❌ Error in credentials route:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

// Test endpoint to verify the route is working
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Exhibitor credentials route is working",
    timestamp: new Date().toISOString(),
    emailService: {
      initialized: emailService.initialized,
      fromEmail: process.env.SENDGRID_FROM || 'Not configured',
      hasApiKey: !!process.env.SENDGRID_API_KEY
    }
  });
});

// Resend credentials for existing exhibitor
router.post("/resend/:exhibitorId", async (req, res) => {
  try {
    const { exhibitorId } = req.params;
    const { email, name, company, password, boothNumber } = req.body;

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        message: "Email and name are required"
      });
    }

    console.log(`📧 Resending credentials for exhibitor ${exhibitorId} to ${email}`);

    const subject = "🔄 Your DIEMEX Exhibitor Portal Credentials (Resent)";
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .credentials { background: #fff; border: 2px solid #1e3c72; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .field { margin-bottom: 10px; }
          .label { font-weight: bold; color: #1e3c72; }
          .note { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
          .button { background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>DIEMEX Exhibition</h1>
            <p>Exhibitor Portal Access</p>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>As requested, here are your login credentials for the DIEMEX Exhibitor Portal:</p>
            
            <div class="credentials">
              <div class="field">
                <span class="label">Email:</span> ${email}
              </div>
              <div class="field">
                <span class="label">Password:</span> <strong>${password || '********'}</strong>
              </div>
              ${company ? `<div class="field"><span class="label">Company:</span> ${company}</div>` : ''}
              ${boothNumber ? `<div class="field"><span class="label">Booth Number:</span> ${boothNumber}</div>` : ''}
            </div>
            
            <div class="note">
              <strong>⚠️ Important:</strong> For security, please change your password after logging in.
            </div>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" class="button">
                Access Exhibitor Portal
              </a>
            </p>
            
            <p>If you didn't request this, please contact support immediately.</p>
            
            <hr>
            <p style="color: #666; font-size: 12px;">
              This email was sent to ${email}. Please keep your credentials secure.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await emailService.sendEmail(email, subject, html);
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: "Credentials resent successfully",
        recipient: email
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Failed to resend credentials",
        error: result.error
      });
    }

  } catch (error) {
    console.error("❌ Error resending credentials:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

module.exports = router;