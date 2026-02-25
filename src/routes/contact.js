// routes/contact.js
const express = require("express");
const router = express.Router();
const emailService = require("../services/EmailService");

router.post("/", async (req, res) => {
  try {
    const { formType, ...data } = req.body;

    if (!formType) {
      return res.status(400).json({ success: false, message: "Form type missing" });
    }

    let subject = "";
    let html = "";

    switch (formType) {
      case "event-brochure":
        subject = "Event Brochure Request Received";
        html = `
          <h2>Thank you for requesting the Event Brochure</h2>
          <p>Dear ${data.firstName},</p>
          <p>We have received your request.</p>
          <hr/>
          <p><strong>Name:</strong> ${data.firstName} ${data.lastName}</p>
          <p><strong>Company:</strong> ${data.company}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Country:</strong> ${data.country}</p>
          <hr/>
          <p>Our team will contact you shortly.</p>
        `;
        break;

      case "post-show-report":
        subject = "Post Show Report Request Received";
        html = `
          <h2>Thank you for requesting the Post-Show Report</h2>
          <p>Dear ${data.firstName},</p>
          <p>Your request has been successfully submitted.</p>
          <hr/>
          <p><strong>Company:</strong> ${data.company}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Sector:</strong> ${data.sector}</p>
        `;
        break;

      case "visitor-registration":
        subject = "Visitor Registration Confirmation";
        html = `
          <h2>Registration Confirmed</h2>
          <p>Dear ${data.firstName},</p>
          <p>Your registration is successfully completed.</p>
          <p>We look forward to seeing you at the exhibition.</p>
        `;
        break;

      default:
        subject = "New Form Submission";
        html = `<p>New form submission received.</p>`;
    }

    await emailService.sendEmail(data.email, subject, html);

    return res.json({ success: true });
  } catch (error) {
    console.error("Contact API Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;