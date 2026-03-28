// routes/contact.js
const express = require("express");
const router = express.Router();
const emailService = require("../services/EmailService");
const QRCode = require('qrcode');

// In-memory storage for visitor registrations (replace with database in production)
const visitorRegistrations = new Map();

function generateInwardTemplate({
  title,
  lightBg,
  stripColor,
  titleColor,
  data,
  includeSpace = false,
  qrCodeDataUrl = null
}) {
  // Generate dynamic fields
  const fields = Object.entries(data)
    .filter(([key]) => !['captchaToken', 'submittedAt'].includes(key))
    .map(([key, value]) => {
      if (Array.isArray(value)) value = value.join(", ");
      return `
         <tr>
          <td width="40%" style="padding:6px 0;"><strong>${key}</strong></td>
          <td style="padding:6px 0;">: ${value || "N/A"}</td>
         </tr>
      `;
    })
    .join("");

  return `
  <!DOCTYPE html>
  <html>
  <body style="margin:0; padding:0; background:#f2f2f2; font-family:Arial, sans-serif;">
    
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:40px 0;">

          <!-- CARD -->
          <table width="600" cellpadding="0" cellspacing="0"
            style="background:${lightBg}; border-radius:6px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1);">

            <!-- HEADER -->
            <tr>
              <td style="background:#0F2F5C; padding:40px 30px; text-align:center;">
                <img 
                  src="https://res.cloudinary.com/deo4vpw8f/image/upload/v1774094980/speakers/avatars/suexnf73ytsmdzooski2.png"
                  style="max-width:220px; display:block; margin:0 auto;"
                />
              </td>
            </tr>

            <!-- STRIP -->
            <tr>
              <td style="background:${stripColor}; height:30px;"></td>
            </tr>

            <!-- TITLE -->
            <tr>
              <td style="background:${titleColor}; color:#fff; text-align:center; padding:15px; font-size:20px; font-weight:bold;">
                ${title}
              </td>
            </tr>

            <!-- CONTENT -->
            <tr>
              <td style="padding:30px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px; color:#333;">
                  ${fields}
                </table>
                ${qrCodeDataUrl ? `
                  <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px dashed #ccc;">
                    <h3 style="color: #0F2F5C;">Visitor QR Code</h3>
                    <img src="${qrCodeDataUrl}" style="max-width: 200px; margin: 10px auto;" alt="Visitor QR Code" />
                    <p style="font-size: 12px; color: #666;">Show this QR code at the event entrance for quick check-in</p>
                  </div>
                ` : ''}
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="background:#1E5AA6; padding:15px;">
                <table width="100%">
                  <tr>
                    <td align="left">
                      <img 
                        src="https://res.cloudinary.com/deo4vpw8f/image/upload/v1774687173/maxxlogo_lulkwh.png"
                        style="max-width:120px; display:block;"
                      />
                    </td>
                    <td align="right" style="color:#fff; font-size:12px; line-height:1.5;">
                      <strong>8-10 Oct 2026</strong><br/>
                      Auto Cluster Exhibition Centre, Pune<br/>
                      maX Business Media Pvt Ltd<br/>
                      Bengaluru, India
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
}

// Generate QR Code for visitor
async function generateVisitorQRCode(visitorId, visitorData) {
  const qrData = JSON.stringify({
    id: visitorId,
    name: visitorData.firstName || visitorData.name,
    email: visitorData.email,
    company: visitorData.companyName || visitorData.company,
    registrationDate: new Date().toISOString(),
    event: "DIEMEX 2026",
    type: "visitor"
  });
  
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300,
      color: {
        dark: '#0F2F5C',
        light: '#FFFFFF'
      }
    });
    return qrCodeDataUrl;
  } catch (error) {
    console.error("QR Code generation error:", error);
    return null;
  }
}

router.post("/", async (req, res) => {
  try {
    const { formType, captchaToken, submittedAt, ...data } = req.body;

    if (!formType) {
      return res.status(400).json({ success: false, message: "Form type missing" });
    }

    console.log(`📝 Received ${formType} form submission:`, {
      email: data.email,
      firstName: data.firstName,
      formType
    });

    let subject = "";
    let html = "";
    let qrCodeDataUrl = null;
    let visitorId = null;

    // Handle visitor registration with QR code
    if (formType === "visitor-registration") {
      // Generate unique visitor ID
      visitorId = `VIS-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      // Store visitor data
      const visitorRecord = {
        id: visitorId,
        ...data,
        registrationDate: new Date().toISOString(),
        checkInTime: null,
        checkedIn: false,
        qrCodeScanned: false
      };
      
      visitorRegistrations.set(visitorId, visitorRecord);
      
      // Generate QR code for the visitor
      qrCodeDataUrl = await generateVisitorQRCode(visitorId, data);
      
      subject = "Your Visitor Badge & QR Code - DIEMEX 2026";
      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Visitor Registration Confirmation - DIEMEX 2026</title>
          <style>
            @media only screen and (max-width: 600px) {
              .container { width: 100% !important; }
              .qr-code { width: 180px !important; height: 180px !important; }
            }
          </style>
        </head>
        <body style="margin:0; padding:0; background:#f2f2f2; font-family:Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2;">
            <tr>
              <td align="center" style="padding:40px 20px;">
                <table width="600" cellpadding="0" cellspacing="0" border="0" class="container" style="max-width:600px; width:100%; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background:#0F2F5C; padding:30px; text-align:center;">
                      <img 
                        src="https://res.cloudinary.com/deo4vpw8f/image/upload/v1774094980/speakers/avatars/suexnf73ytsmdzooski2.png"
                        style="max-width:200px; width:100%; display:block; margin:0 auto;"
                        alt="DIEMEX Logo"
                      />
                      <p style="color:#fff; margin:10px 0 0; font-size:14px;">
                        International Die & Mould Exhibition
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding:40px 30px;">
                      <h2 style="color:#0F2F5C; margin-bottom:20px; text-align:center;">🎉 Registration Confirmed!</h2>
                      
                      <p style="font-size:16px; line-height:1.6; color:#333;">
                        Dear <strong>${data.firstName || data.name || 'Valued Visitor'}</strong>,
                      </p>
                      
                      <p style="font-size:16px; line-height:1.6; color:#333;">
                        Thank you for registering for <strong>DIEMEX 2026</strong>! We're excited to welcome you to the premier die and mould exhibition in India.
                      </p>
                      
                      <div style="background:#f0f7ff; padding:15px; border-radius:8px; margin:20px 0;">
                        <p style="margin:0; color:#0F2F5C;">
                          <strong>Visitor ID:</strong> ${visitorId}
                        </p>
                      </div>
                      
                      <!-- QR CODE SECTION -->
                      <div style="margin:30px 0; padding:25px; background:#f9f9f9; border-radius:12px; text-align:center; border:2px solid #e0e0e0;">
                        <h3 style="color:#0F2F5C; margin-bottom:15px;">📱 Your Visitor QR Code</h3>
                        <img 
                          src="${qrCodeDataUrl}" 
                          alt="Visitor QR Code"
                          class="qr-code"
                          style="width:220px; height:220px; border-radius:8px; border:3px solid #0F2F5C; padding:5px; background:#fff;"
                        />
                        <p style="margin-top:15px; font-size:14px; color:#666; line-height:1.5;">
                          ⭐ <strong>Important:</strong> Please save this QR code or keep this email handy.<br/>
                          Show this QR code at the registration desk for quick entry and badge collection.
                        </p>
                        <div style="margin-top:15px;">
                          <a href="${qrCodeDataUrl}" download="diemex-visitor-${visitorId}.png"
                             style="background:#0F2F5C; color:#ffffff; padding:10px 25px; text-decoration:none; border-radius:30px; display:inline-block; font-weight:bold; font-size:14px;">
                            ⬇️ Download QR Code
                          </a>
                        </div>
                      </div>
                      
                      <!-- Registration Details -->
                      <div style="background:#f5f5f5; padding:20px; border-radius:8px; margin:20px 0;">
                        <h4 style="color:#0F2F5C; margin-top:0; margin-bottom:15px;">📋 Registration Details:</h4>
                        <table width="100%" style="font-size:14px; color:#555;">
                          <tr>
                            <td style="padding:8px 0;"><strong>Full Name:</strong></td>
                            <td style="padding:8px 0;">${data.firstName || data.name} ${data.lastName || ''}</td>
                          </tr>
                          <tr>
                            <td style="padding:8px 0;"><strong>Email:</strong></td>
                            <td style="padding:8px 0;">${data.email}</td>
                          </tr>
                          <tr>
                            <td style="padding:8px 0;"><strong>Company:</strong></td>
                            <td style="padding:8px 0;">${data.companyName || data.company || 'Not provided'}</td>
                          </tr>
                          <tr>
                            <td style="padding:8px 0;"><strong>Designation:</strong></td>
                            <td style="padding:8px 0;">${data.jobTitle || data.designation || 'Not provided'}</td>
                          </tr>
                          <tr>
                            <td style="padding:8px 0;"><strong>Phone:</strong></td>
                            <td style="padding:8px 0;">${data.phone || data.mobile || 'Not provided'}</td>
                          </tr>
                          <tr>
                            <td style="padding:8px 0;"><strong>Registration Date:</strong></td>
                            <td style="padding:8px 0;">${new Date().toLocaleString()}</td>
                          </tr>
                        </table>
                      </div>
                      
                      <div style="background:#e8f5e9; padding:15px; border-radius:8px; margin:20px 0; border-left:4px solid #4caf50;">
                        <p style="margin:0; font-size:14px; color:#2e7d32;">
                          <strong>📍 Event Details:</strong><br/>
                          📅 Date: 8-10 October 2026<br/>
                          📍 Venue: Auto Cluster Exhibition Centre, Pune, India<br/>
                          ⏰ Time: 10:00 AM - 6:00 PM
                        </p>
                      </div>
                      
                      <p style="font-size:15px; line-height:1.6; margin-top:20px;">
                        We look forward to welcoming you at the event! If you have any questions, feel free to contact us.
                      </p>
                      
                      <p style="font-size:13px; color:#666; margin-top:20px;">
                        Need assistance? Contact us at <a href="mailto:pad@diemex.in" style="color:#0F2F5C;">pad@diemex.in</a> or call +91 80 40682257
                      </p>
                      
                      <p style="margin-top:30px;">
                        Best regards,<br/>
                        <strong>DIEMEX 2026 Team</strong>
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background:#1E5AA6; padding:20px; text-align:center;">
                      <p style="color:#fff; margin:0; font-size:12px;">
                        <strong>8-10 Oct 2026</strong> • Auto Cluster Exhibition Centre, Pune, India
                      </p>
                      <p style="color:#fff; margin:10px 0 0; font-size:11px;">
                        © 2026 maX Business Media Pvt Ltd. All rights reserved.
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
    } else {
      // Handle other form types (existing code)
      switch (formType) {
        case "event-brochure":
          subject = "Your Event Brochure - DIEMEX 2026";
          html = `
            <!DOCTYPE html>
            <html>
            <body style="margin:0; padding:0; background:#f2f2f2; font-family:Arial, sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background:#FCD5A6; padding:40px 0 0;">
                    <table width="600" cellpadding="0" cellspacing="0" border="0"
                      style="background:#0F2F5C; border-radius:6px 6px 0 0; color:#fff;">
                      <tr>
                        <td align="center" style="padding:30px;">
                          <img 
                            src="https://res.cloudinary.com/deo4vpw8f/image/upload/v1774094980/speakers/avatars/suexnf73ytsmdzooski2.png"
                            style="max-width:220px; display:block; margin:0 auto;"
                          />
                          <p style="margin:5px 0 0; font-size:14px;">
                            International Die & Mould Exhibition
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" border="0"
                      style="background:#ffffff; border-radius:0 0 6px 6px;">
                      <tr>
                        <td style="padding:40px 30px; color:#333; text-align:center;">
                          <p style="text-align:left; font-size:16px;">
                            Dear ${data.firstName || 'Valued Customer'},
                          </p>
                          <p style="text-align:left; font-size:16px;">
                            Thank you for requesting <strong>DIEMEX 2026</strong> Brochure.
                          </p>
                          <div style="margin:30px 0;">
                            <a href="https://collection.cloudinary.com/deo4vpw8f/67a18bfbba40b2b4d29f577dd33e80b1"
                               style="background:#0F2F5C; color:#ffffff; padding:15px 35px; text-decoration:none; border-radius:30px; display:inline-block; font-weight:bold;">
                              Download Brochure
                            </a>
                          </div>
                          <p style="font-size:15px;">If you have any questions, feel free to contact us.</p>
                          <p style="text-align:left; margin-top:20px;">
                            Best regards,<br/>
                            <strong>DIEMEX 2026 Team</strong>
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#1E5AA6; color:#fff; padding:15px; text-align:center; font-size:14px;">
                          <strong>8-10 Oct 2026</strong> • Auto Cluster Exhibition Centre, Pune, India
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `;
          break;
          
        case "post-show-report":
          subject = "Your Post Show Report - DIEMEX 2026";
          html = `
            <!DOCTYPE html>
            <html>
            <body style="margin:0; padding:0; background:#f2f2f2; font-family:Arial, sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background:#ECF0C6; padding:40px 0 0;">
                    <table width="600" cellpadding="0" cellspacing="0" border="0"
                      style="background:#0F2F5C; border-radius:6px 6px 0 0; color:#fff;">
                      <tr>
                        <td align="center" style="padding:30px;">
                          <img 
                            src="https://res.cloudinary.com/deo4vpw8f/image/upload/v1774094980/speakers/avatars/suexnf73ytsmdzooski2.png"
                            style="max-width:220px; display:block; margin:0 auto;"
                          />
                          <p style="margin:5px 0 0; font-size:14px;">
                            International Die & Mould Exhibition
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" border="0"
                      style="background:#ffffff; border-radius:0 0 6px 6px;">
                      <tr>
                        <td style="padding:40px 30px; color:#333; text-align:center;">
                          <p style="text-align:left; font-size:16px;">
                            Dear ${data.firstName || 'Valued Customer'},
                          </p>
                          <p style="text-align:left; font-size:16px;">
                            Thank you for requesting <strong>DIEMEX 2026</strong> Post Show Report.
                          </p>
                          <div style="margin:30px 0;">
                            <a href="https://your-download-link.com/post-show-report.pdf"
                               style="background:#0F2F5C; color:#ffffff; padding:15px 35px; text-decoration:none; border-radius:30px; display:inline-block; font-weight:bold;">
                              Download Report
                            </a>
                          </div>
                          <p style="font-size:15px;">If you have any questions, feel free to contact us.</p>
                          <p style="text-align:left; margin-top:20px;">
                            Best regards,<br/>
                            <strong>DIEMEX 2026 Team</strong>
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#1E5AA6; color:#fff; padding:15px; text-align:center; font-size:14px;">
                          <strong>8-10 Oct 2026</strong> • Auto Cluster Exhibition Centre, Pune, India
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `;
          break;
          
        case "exhibitor-enquiry":
          subject = "Your Exhibitor Enquiry - DIEMEX 2026";
          html = `
            <!DOCTYPE html>
            <html>
            <body style="margin:0; padding:0; background:#f2f2f2; font-family:Arial, sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background:#D7EEFB; padding:40px 0 0;">
                    <table width="600" cellpadding="0" cellspacing="0" border="0"
                      style="background:#0F2F5C; border-radius:6px 6px 0 0; color:#fff;">
                      <tr>
                        <td align="center" style="padding:30px;">
                          <img 
                            src="https://res.cloudinary.com/deo4vpw8f/image/upload/v1774094980/speakers/avatars/suexnf73ytsmdzooski2.png"
                            style="max-width:220px; display:block; margin:0 auto;"
                          />
                          <p style="margin:5px 0 0; font-size:14px;">
                            International Die & Mould Exhibition
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" border="0"
                      style="background:#ffffff; border-radius:0 0 6px 6px;">
                      <tr>
                        <td style="padding:40px 30px; color:#333;">
                          <p style="font-size:16px;">
                            Dear ${data.firstName || 'Valued Customer'},
                          </p>
                          <p style="font-size:16px;">
                            Thank you for your enquiry about exhibiting at 
                            <strong>DIEMEX 2026 International Die, Mould & Precision Machinery Expo</strong>.
                          </p>
                          <p style="font-size:16px;">
                            Our team will get in touch with you shortly to discuss your requirements.
                          </p>
                          <p style="margin-top:20px;">
                            Best regards,<br/>
                            <strong>DIEMEX 2026 Team</strong>
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#1E5AA6; color:#fff; padding:15px; text-align:center; font-size:14px;">
                          <strong>8-10 Oct 2026</strong> • Auto Cluster Exhibition Centre, Pune, India
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `;
          break;
          
        case "delegate-registration":
          subject = "Delegate Registration Confirmed - DIEMEX 2026";
          html = `
            <!DOCTYPE html>
            <html>
            <body style="margin:0; padding:0; background:#f2f2f2; font-family:Arial, sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background:#AE4A84; padding:40px 0 0;">
                    <table width="600" cellpadding="0" cellspacing="0" border="0"
                      style="background:#0F2F5C; border-radius:6px 6px 0 0; color:#fff;">
                      <tr>
                        <td align="center" style="padding:30px;">
                          <img 
                            src="https://res.cloudinary.com/deo4vpw8f/image/upload/v1774094980/speakers/avatars/suexnf73ytsmdzooski2.png"
                            style="max-width:220px; display:block; margin:0 auto;"
                          />
                          <p style="margin:5px 0 0; font-size:14px;">
                            International Die & Mould Exhibition
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" border="0"
                      style="background:#ffffff; border-radius:0 0 6px 6px;">
                      <tr>
                        <td style="padding:40px 30px; text-align:center; color:#333;">
                          <h2 style="margin-bottom:10px;">Delegate Registration Confirmed!</h2>
                          <p style="text-align:left;">
                            Dear ${data.firstName || 'Valued Delegate'},
                          </p>
                          <p style="text-align:left;">
                            Thank you for registering to attend 
                            <strong>DIEMEX 2026 Conference</strong>.
                          </p>
                          <div style="margin:30px 0;">
                            <a href="https://your-badge-download-link.com"
                               style="background:#0F2F5C; color:#fff; padding:15px 35px; text-decoration:none; border-radius:30px; display:inline-block;">
                              Download Badge
                            </a>
                          </div>
                          <p>We look forward to seeing you at the event.</p>
                          <p style="text-align:left; margin-top:20px;">
                            Best regards,<br/>
                            <strong>DIEMEX 2026 Team</strong>
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#1E5AA6; color:#fff; padding:15px; text-align:center;">
                          <strong>8-10 Oct 2026</strong> • Auto Cluster Exhibition Centre, Pune, India
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `;
          break;
          
        case "partner-registration":
          subject = "Your Partner Registration Confirmation - DIEMEX Exhibition";
          html = `
            <!DOCTYPE html>
            <html>
            <body style="margin:0; padding:0; background:#f2f2f2; font-family:Arial, sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background:#9333EA; padding:40px 0 0;">
                    <table width="600" cellpadding="0" cellspacing="0" border="0"
                      style="background:#0F2F5C; border-radius:6px 6px 0 0; color:#fff;">
                      <tr>
                        <td align="center" style="padding:30px;">
                          <img 
                            src="https://res.cloudinary.com/deo4vpw8f/image/upload/v1774094980/speakers/avatars/suexnf73ytsmdzooski2.png"
                            style="max-width:220px; display:block; margin:0 auto;"
                          />
                          <p style="margin:5px 0 0; font-size:14px;">
                            International Die & Mould Exhibition
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" border="0"
                      style="background:#ffffff; border-radius:0 0 6px 6px;">
                      <tr>
                        <td style="padding:40px 30px;">
                          <h2 style="color:#9333EA;">Partner Registration Confirmed! 🤝</h2>
                          <p>Dear ${data.firstName || ''},</p>
                          <p>Your partner registration has been successfully completed. Our partnership team will review your application within 2-3 business days.</p>
                          <div style="background-color: #F3E8FF; border-left: 4px solid #9333EA; padding: 20px; margin: 20px 0;">
                            <p><strong>🤝 Partner Benefits:</strong><br>
                            • Exclusive networking opportunities<br>
                            • Priority booth allocation<br>
                            • Marketing and brand visibility</p>
                          </div>
                          <p>Best regards,<br/>
                          <strong>DIEMEX 2026 Team</strong></p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `;
          break;

        default:
          subject = "Your Form Submission - DIEMEX Exhibition";
          html = `
            <h2>Thank you for your submission</h2>
            <p>Dear ${data.firstName || 'Valued Customer'},</p>
            <p>We have received your form submission. Our team will review and get back to you shortly.</p>
            <hr/>
            ${Object.entries(data)
              .filter(([key]) => !['captchaToken', 'submittedAt'].includes(key))
              .map(([key, value]) => `<p><strong>${key}:</strong> ${Array.isArray(value) ? value.join(', ') : value || 'Not provided'}</p>`)
              .join('')}
          `;
      }
    }

    // Validate email before sending
    if (!data.email) {
      return res.status(400).json({ 
        success: false, 
        message: "Email address is required" 
      });
    }

    // Send email to user with QR code (for visitor registration)
    console.log(`📧 Sending email to user: ${data.email}`);
    await emailService.sendEmail(data.email, subject, html);
    console.log(`✅ User email sent successfully to ${data.email}`);
    
    // Send notification to admin with QR code (for visitor registration)
    if (formType === "visitor-registration") {
      try {
        const adminEmail = 'pad9742@gmail.com';
        const adminHtml = generateInwardTemplate({
          title: "New Visitor Registration with QR Code!",
          lightBg: "#DDEFE2",
          stripColor: "#CFE3D5",
          titleColor: "#0F8F4F",
          data: { 
            ...data, 
            "Visitor ID": visitorId,
            "QR Code": "Generated and sent to visitor"
          },
          qrCodeDataUrl
        });
        
        await emailService.sendEmail(
          adminEmail, 
          `New Visitor Registration - ${visitorId} - DIEMEX 2026`, 
          adminHtml
        );
        console.log(`✅ Admin notification sent to ${adminEmail}`);
      } catch (adminError) {
        console.error("❌ Admin notification failed:", adminError);
      }
    } else {
      // Send regular admin notification for other form types
      try {
        const adminEmail = 'pad9742@gmail.com';
        let adminHtml = "";
        
        switch (formType) {
          case "delegate-registration":
            adminHtml = generateInwardTemplate({
              title: "New Delegate Registration!",
              lightBg: "#E8D6DC",
              stripColor: "#F2E3E7",
              titleColor: "#A84C7D",
              data
            });
            break;
          case "exhibitor-enquiry":
            adminHtml = generateInwardTemplate({
              title: "Exhibitor Enquiry!",
              lightBg: "#D7EEFB",
              stripColor: "#CFE3EE",
              titleColor: "#1F3F4F",
              data
            });
            break;
          case "event-brochure":
            adminHtml = generateInwardTemplate({
              title: "Brochure Download!",
              lightBg: "#F3E2C7",
              stripColor: "#EAD6B8",
              titleColor: "#F7941D",
              data
            });
            break;
          case "post-show-report":
            adminHtml = generateInwardTemplate({
              title: "Post Show Report Download!",
              lightBg: "#E7EDC9",
              stripColor: "#DDE5B2",
              titleColor: "#F4C400",
              data
            });
            break;
          default:
            adminHtml = generateInwardTemplate({
              title: "New Form Submission",
              lightBg: "#f5f5f5",
              stripColor: "#e0e0e0",
              titleColor: "#333",
              data
            });
        }
        
        await emailService.sendEmail(
          adminEmail,
          `New ${formType} Submission - DIEMEX 2026`,
          adminHtml
        );
        console.log(`✅ Admin notification sent to ${adminEmail}`);
      } catch (adminError) {
        console.error("❌ Admin notification failed:", adminError);
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: formType === "visitor-registration" 
        ? "Registration successful! QR code has been sent to your email." 
        : "Form submitted successfully. Please check your email for confirmation.",
      visitorId: visitorId,
      hasQRCode: !!qrCodeDataUrl
    });

  } catch (error) {
    console.error("❌ Contact API Error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
});

// GET endpoint to fetch visitor details by QR code ID
router.get("/visitor/:visitorId", async (req, res) => {
  try {
    const { visitorId } = req.params;
    const visitor = visitorRegistrations.get(visitorId);
    
    if (!visitor) {
      return res.status(404).json({ 
        success: false, 
        message: "Visitor not found" 
      });
    }
    
    res.json({
      success: true,
      visitor: {
        id: visitor.id,
        name: visitor.firstName || visitor.name,
        email: visitor.email,
        company: visitor.companyName || visitor.company,
        designation: visitor.jobTitle || visitor.designation,
        phone: visitor.phone || visitor.mobile,
        registrationDate: visitor.registrationDate,
        checkInTime: visitor.checkInTime,
        checkedIn: visitor.checkedIn
      }
    });
  } catch (error) {
    console.error("Error fetching visitor:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
});

// POST endpoint to mark visitor as checked in (when QR code is scanned)
router.post("/visitor/:visitorId/checkin", async (req, res) => {
  try {
    const { visitorId } = req.params;
    const visitor = visitorRegistrations.get(visitorId);
    
    if (!visitor) {
      return res.status(404).json({ 
        success: false, 
        message: "Visitor not found" 
      });
    }
    
    if (visitor.checkedIn) {
      return res.status(400).json({ 
        success: false, 
        message: "Visitor already checked in", 
        checkInTime: visitor.checkInTime 
      });
    }
    
    // Update check-in status
    visitor.checkedIn = true;
    visitor.checkInTime = new Date().toISOString();
    visitorRegistrations.set(visitorId, visitor);
    
    res.json({
      success: true,
      message: "Visitor checked in successfully",
      visitor: {
        id: visitor.id,
        name: visitor.firstName || visitor.name,
        company: visitor.companyName || visitor.company,
        checkInTime: visitor.checkInTime
      }
    });
  } catch (error) {
    console.error("Error checking in visitor:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
});

// GET endpoint to get all visitors (for dashboard)
router.get("/visitors/all", async (req, res) => {
  try {
    const allVisitors = Array.from(visitorRegistrations.values());
    res.json({
      success: true,
      total: allVisitors.length,
      checkedIn: allVisitors.filter(v => v.checkedIn).length,
      visitors: allVisitors
    });
  } catch (error) {
    console.error("Error fetching visitors:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
});

// GET endpoint to get checked-in visitors only
router.get("/visitors/checked-in", async (req, res) => {
  try {
    const checkedInVisitors = Array.from(visitorRegistrations.values())
      .filter(v => v.checkedIn);
    
    res.json({
      success: true,
      count: checkedInVisitors.length,
      visitors: checkedInVisitors
    });
  } catch (error) {
    console.error("Error fetching checked-in visitors:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
});

// Add a test endpoint
router.get("/test", (req, res) => {
  res.json({ 
    success: true, 
    message: "Contact API is working with QR Code functionality",
    timestamp: new Date().toISOString(),
    environment: {
      hasSendGridKey: !!process.env.SENDGRID_API_KEY,
      hasSendGridFrom: !!process.env.SENDGRID_FROM
    }
  });
});

module.exports = router;