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
        subject = "Event Brochure Request Received";
        html = `
          <h2>Thank you for requesting the Event Brochure</h2>
          <p>Dear ${data.firstName || 'Valued Customer'},</p>
          <p>We have received your request.</p>
          <hr/>
          <p><strong>Name:</strong> ${data.firstName || ''} ${data.lastName || ''}</p>
          <p><strong>Company:</strong> ${data.company || 'Not provided'}</p>
          <p><strong>Email:</strong> ${data.email || 'Not provided'}</p>
          <p><strong>Country:</strong> ${data.country || 'Not provided'}</p>
          <hr/>
          <p>Our team will contact you shortly.</p>
        `;
        break;

      case "post-show-report":
        subject = "Post Show Report Request Received";
        html = `
          <h2>Thank you for requesting the Post-Show Report</h2>
          <p>Dear ${data.firstName || 'Valued Customer'},</p>
          <p>Your request has been successfully submitted.</p>
          <hr/>
          <p><strong>Company:</strong> ${data.company || 'Not provided'}</p>
          <p><strong>Email:</strong> ${data.email || 'Not provided'}</p>
          <p><strong>Sector:</strong> ${data.sector || 'Not provided'}</p>
          <hr/>
          <p>Our team will contact you shortly.</p>
        `;
        break;

      case "visitor-registration":
        subject = "Visitor Registration Confirmation";
        html = `
          <h2>Registration Confirmed</h2>
          <p>Dear ${data.firstName || data.name || 'Valued Visitor'},</p>
          <p>Your registration is successfully completed.</p>
          <p><strong>Company:</strong> ${data.company || 'Not provided'}</p>
          <p><strong>Email:</strong> ${data.email || 'Not provided'}</p>
          <p>We look forward to seeing you at the exhibition.</p>
        `;
        break;

      case "exhibitor-enquiry":
        subject = "Exhibitor Enquiry Received";
        html = `
          <h2>Thank you for your exhibitor enquiry</h2>
          <p>Dear ${data.firstName || 'Valued Customer'},</p>
          <p>We have received your enquiry about exhibiting at our event.</p>
          <hr/>
          <p><strong>Name:</strong> ${data.firstName || ''} ${data.lastName || ''}</p>
          <p><strong>Company:</strong> ${data.companyName || data.company || 'Not provided'}</p>
          <p><strong>Email:</strong> ${data.email || 'Not provided'}</p>
          <p><strong>Interest Level:</strong> ${data.interestLevel || 'Not specified'}</p>
          <p><strong>Stand Size:</strong> ${data.standSize || 'Not specified'}</p>
          <hr/>
          <p>Our team will contact you shortly with more information.</p>
        `;
        break;

      default:
        subject = "New Form Submission";
        html = `<p>New form submission received from ${data.email || 'unknown'}</p>`;
    }

    // Validate email before sending
    if (!data.email) {
      return res.status(400).json({ 
        success: false, 
        message: "Email address is required" 
      });
    }

    // Send email to user
    await emailService.sendEmail(data.email, subject, html);
    
    // Also send notification to admin (optional)
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@diemex.com';
      await emailService.sendEmail(
        adminEmail,
        `New Form Submission: ${formType}`,
        generateAdminNotification(formType, data)
      );
    } catch (adminError) {
      console.error("Admin notification failed:", adminError);
      // Don't fail the request if admin notification fails
    }

    return res.status(200).json({ 
      success: true, 
      message: "Form submitted successfully" 
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

// Helper function for admin notification
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
    <h2>New Form Submission: ${formType}</h2>
    ${fields}
    <p><strong>Submitted at:</strong> ${new Date().toLocaleString()}</p>
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