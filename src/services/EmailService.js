const { convert } = require("html-to-text");

class EmailService {
  constructor() {
    console.log('📧 Email Service initialized (Console Mode)');
  }

  async sendEmail(to, subject, html) {
    try {
      // SIMPLE: Just log to console, don't actually send email
      console.log('\n' + '='.repeat(60));
      console.log('📧 EMAIL WOULD BE SENT (Console Mode)');
      console.log('='.repeat(60));
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      
      // Show credentials clearly
      const text = convert(html);
      const passwordMatch = text.match(/Password:\s*([^\n]+)/);
      if (passwordMatch) {
        console.log(`🔑 PASSWORD: ${passwordMatch[1].trim()}`);
      }
      
      console.log('='.repeat(60));
      console.log('HTML Preview (first 300 chars):');
      console.log(html.substring(0, 300) + '...');
      console.log('='.repeat(60) + '\n');
      
      // Return success immediately
      return { 
        messageId: 'console-' + Date.now(),
        accepted: [to],
        response: 'Email logged to console'
      };
      
    } catch (error) {
      console.error(`❌ Email logging error:`, error.message);
      
      // Still return success so API doesn't fail
      return { 
        messageId: 'error-' + Date.now(),
        accepted: [to],
        response: 'Email logged with error'
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
            <p><strong>Password:</strong> <span style="font-family: monospace; font-weight: bold; color: #dc2626;">${password}</span></p>
            <p><strong>Company:</strong> ${exhibitor.company}</p>
            <p><strong>Booth Number:</strong> ${exhibitor.boothNumber || 'To be assigned'}</p>
          </div>
          
          <p>
            <a href="${loginUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Login to Your Dashboard
            </a>
          </p>
          
          <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 5px; padding: 12px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;">
              <strong>Important:</strong> Please change your password after first login.
            </p>
          </div>
          
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
    // Always return success in console mode
    return { 
      connected: true, 
      mode: 'console',
      message: 'Emails are logged to console only'
    };
  }
}

module.exports = new EmailService();