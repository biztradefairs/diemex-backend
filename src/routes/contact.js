// routes/contact.js
const express = require("express");
const router = express.Router();
const emailService = require("../services/EmailService");

router.post("/", async (req, res) => {
  try {
    const { formType, captchaToken, submittedAt, ...data } = req.body;

    if (!formType) {
      return res.status(400).json({ success: false, message: "Form type missing" });
    }

    // Log received data for debugging
    console.log(`📝 Received ${formType} form submission:`, {
      email: data.email,
      firstName: data.firstName,
      formType
    });

    let subject = "";
    let html = "";

    // Safely access data with fallbacks to prevent undefined errors
    switch (formType) {
      case "event-brochure":
        subject = "Your Event Brochure Request - DIEMEX Exhibition";
        html = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #004D9F 0%, #00A3E0 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .field { margin-bottom: 15px; }
              .field-label { font-weight: bold; color: #004D9F; }
              .field-value { margin-left: 10px; }
              hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Event Brochure Request</h1>
              </div>
              <div class="content">
                <h2>Thank you for your request, ${data.firstName || 'Valued Customer'}!</h2>
                <p>We have received your request for the Event Brochure. Here's a summary of the information you submitted:</p>
                
                <hr/>
                
                <div class="field">
                  <span class="field-label">Name:</span>
                  <span class="field-value">${data.firstName || ''} ${data.lastName || ''}</span>
                </div>
                
                <div class="field">
                  <span class="field-label">Company:</span>
                  <span class="field-value">${data.company || 'Not provided'}</span>
                </div>
                
                <div class="field">
                  <span class="field-label">Email:</span>
                  <span class="field-value">${data.email || 'Not provided'}</span>
                </div>
                
                <div class="field">
                  <span class="field-label">Country:</span>
                  <span class="field-value">${data.country || 'Not provided'}</span>
                </div>
                
                <hr/>
                
                <p><strong>Next Steps:</strong></p>
                <p>Our team will review your request and contact you shortly with the brochure. If you have any questions, please don't hesitate to reach out.</p>
                
                <p>Best regards,<br/>
                <strong>DIEMEX Exhibition Team</strong></p>
              </div>
            </div>
          </body>
          </html>
        `;
        break;

      case "post-show-report":
        subject = "Your Post-Show Report Request - DIEMEX Exhibition";
        html = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #004D9F 0%, #00A3E0 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .field { margin-bottom: 15px; }
              .field-label { font-weight: bold; color: #004D9F; }
              .field-value { margin-left: 10px; }
              hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Post-Show Report Request</h1>
              </div>
              <div class="content">
                <h2>Thank you for your request, ${data.firstName || 'Valued Customer'}!</h2>
                <p>We have received your request for the Post-Show Report. Here's a summary of the information you submitted:</p>
                
                <hr/>
                
                <div class="field">
                  <span class="field-label">Name:</span>
                  <span class="field-value">${data.firstName || ''} ${data.lastName || ''}</span>
                </div>
                
                <div class="field">
                  <span class="field-label">Company:</span>
                  <span class="field-value">${data.company || 'Not provided'}</span>
                </div>
                
                <div class="field">
                  <span class="field-label">Email:</span>
                  <span class="field-value">${data.email || 'Not provided'}</span>
                </div>
                
                <div class="field">
                  <span class="field-label">Sector:</span>
                  <span class="field-value">${data.sector || 'Not provided'}</span>
                </div>
                
                <hr/>
                
                <p><strong>Next Steps:</strong></p>
                <p>Our team will prepare the Post-Show Report and send it to you shortly. If you have any questions, please don't hesitate to reach out.</p>
                
                <p>Best regards,<br/>
                <strong>DIEMEX Exhibition Team</strong></p>
              </div>
            </div>
          </body>
          </html>
        `;
        break;

      case "visitor-registration":
        subject = "Your Visitor Registration Confirmation - DIEMEX Exhibition";
        html = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .field { margin-bottom: 15px; }
              .field-label { font-weight: bold; color: #28a745; }
              .field-value { margin-left: 10px; }
              hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Registration Confirmed! 🎉</h1>
              </div>
              <div class="content">
                <h2>Welcome to DIEMEX Exhibition, ${data.firstName || data.name || 'Valued Visitor'}!</h2>
                <p>Your registration has been successfully completed. Here's a summary of your registration details:</p>
                
                <hr/>
                
                <div class="field">
                  <span class="field-label">Name:</span>
                  <span class="field-value">${data.firstName || data.name || ''} ${data.lastName || ''}</span>
                </div>
                
                <div class="field">
                  <span class="field-label">Company:</span>
                  <span class="field-value">${data.company || 'Not provided'}</span>
                </div>
                
                <div class="field">
                  <span class="field-label">Email:</span>
                  <span class="field-value">${data.email || 'Not provided'}</span>
                </div>
                
                ${data.phone ? `
                <div class="field">
                  <span class="field-label">Phone:</span>
                  <span class="field-value">${data.phone}</span>
                </div>
                ` : ''}
                
                ${data.jobTitle ? `
                <div class="field">
                  <span class="field-label">Job Title:</span>
                  <span class="field-value">${data.jobTitle}</span>
                </div>
                ` : ''}
                
                <hr/>
                
                <p><strong>Event Details:</strong></p>
                <p>📅 Date: [Insert Event Date]<br/>
                📍 Location: [Insert Event Location]<br/>
                🎫 Your registration type: Visitor</p>
                
                <p>We look forward to seeing you at the exhibition!</p>
                
                <p>Best regards,<br/>
                <strong>DIEMEX Exhibition Team</strong></p>
              </div>
            </div>
          </body>
          </html>
        `;
        break;

      case "exhibitor-enquiry":
        subject = "Your Exhibitor Enquiry - DIEMEX Exhibition";
        html = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #004D9F 0%, #00A3E0 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .field { margin-bottom: 15px; }
              .field-label { font-weight: bold; color: #004D9F; }
              .field-value { margin-left: 10px; }
              hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Exhibitor Enquiry Received</h1>
              </div>
              <div class="content">
                <h2>Thank you for your enquiry, ${data.firstName || 'Valued Customer'}!</h2>
                <p>We have received your enquiry about exhibiting at DIEMEX Exhibition. Here's a summary of the information you submitted:</p>
                
                <hr/>
                
                <div class="field">
                  <span class="field-label">Name:</span>
                  <span class="field-value">${data.firstName || ''} ${data.lastName || ''}</span>
                </div>
                
                <div class="field">
                  <span class="field-label">Company:</span>
                  <span class="field-value">${data.companyName || data.company || 'Not provided'}</span>
                </div>
                
                <div class="field">
                  <span class="field-label">Email:</span>
                  <span class="field-value">${data.email || 'Not provided'}</span>
                </div>
                
                ${data.phone ? `
                <div class="field">
                  <span class="field-label">Phone:</span>
                  <span class="field-value">${data.phone}</span>
                </div>
                ` : ''}
                
                <div class="field">
                  <span class="field-label">Interest Level:</span>
                  <span class="field-value">${data.interestLevel || 'Not specified'}</span>
                </div>
                
                <div class="field">
                  <span class="field-label">Stand Size:</span>
                  <span class="field-value">${data.standSize || 'Not specified'}</span>
                </div>
                
                ${data.message ? `
                <div class="field">
                  <span class="field-label">Message:</span>
                  <span class="field-value">${data.message}</span>
                </div>
                ` : ''}
                
                <hr/>
                
                <p><strong>Next Steps:</strong></p>
                <p>Our exhibitions team will review your enquiry and contact you within 24-48 hours with more information about exhibition opportunities, pricing, and available booth spaces.</p>
                
                <p>Best regards,<br/>
                <strong>DIEMEX Exhibition Team</strong></p>
              </div>
            </div>
          </body>
          </html>
        `;
        break;

      default:
        subject = "Your Form Submission - DIEMEX Exhibition";
        html = `
          <h2>Thank you for your submission</h2>
          <p>Dear ${data.firstName || 'Valued Customer'},</p>
          <p>We have received your form submission. Here's what you submitted:</p>
          <hr/>
          ${Object.entries(data)
            .filter(([key]) => !['captchaToken', 'submittedAt'].includes(key))
            .map(([key, value]) => `<p><strong>${key}:</strong> ${Array.isArray(value) ? value.join(', ') : value || 'Not provided'}</p>`)
            .join('')}
          <hr/>
          <p>Our team will review your submission and get back to you shortly.</p>
        `;
    }

    // Validate email before sending
    if (!data.email) {
      return res.status(400).json({ 
        success: false, 
        message: "Email address is required" 
      });
    }

    // Send email to user with their submitted details
    await emailService.sendEmail(data.email, subject, html);
    
    // Also send notification to admin (optional)
    try {
      const adminEmail = 'pad9742@gmail.com'; // Send all admin notifications to this email
      await emailService.sendEmail(
        adminEmail,
        `New Form Submission: ${formType}`,
        generateAdminNotification(formType, data)
      );
      console.log(`📧 Admin notification sent to ${adminEmail}`);
    } catch (adminError) {
      console.error("Admin notification failed:", adminError);
      // Don't fail the request if admin notification fails
    }

    return res.status(200).json({ 
      success: true, 
      message: "Form submitted successfully. Please check your email for confirmation." 
    });

  } catch (error) {
    console.error("❌ Contact API Error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      response: error.response?.body
    });
    
    return res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
});

// Helper function for admin notification (keep this as is)
function generateAdminNotification(formType, data) {
  const fields = Object.entries(data)
    .filter(([key]) => !['captchaToken', 'submittedAt'].includes(key))
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        value = value.join(', ');
      }
      return `<p><strong>${key}:</strong> ${value || 'Not provided'}</p>`;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        .container { padding: 20px; }
        .header { background: #004D9F; color: white; padding: 10px 20px; }
        .content { padding: 20px; background: #f9f9f9; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>New Form Submission: ${formType}</h2>
        </div>
        <div class="content">
          ${fields}
          <p><strong>Submitted at:</strong> ${new Date().toLocaleString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Add a test endpoint
router.get("/test", (req, res) => {
  res.json({ 
    success: true, 
    message: "Contact API is working",
    timestamp: new Date().toISOString(),
    environment: {
      hasSendGridKey: !!process.env.SENDGRID_API_KEY,
      hasSendGridFrom: !!process.env.SENDGRID_FROM
    }
  });
});

module.exports = router;