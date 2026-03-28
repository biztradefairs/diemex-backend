const express = require("express");
const router = express.Router();
const emailService = require("../services/EmailService");
const QRCode = require('qrcode'); // You'll need to install this: npm install qrcode

function generateInwardTemplate({
  title,
  lightBg,
  stripColor,
  titleColor,
  data,
  includeSpace = false
}) {

  // 🔥 Generate dynamic fields
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
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="background:#1E5AA6; padding:15px;">
                <table width="100%">
                  <tr>
                    
                    <!-- LEFT LOGO -->
                    <td align="left">
                      <img 
                        src="https://res.cloudinary.com/deo4vpw8f/image/upload/v1774094980/speakers/avatars/suexnf73ytsmdzooski2.png"
                        style="max-width:120px; display:block;"
                      />
                    </td>

                    <!-- RIGHT TEXT -->
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

// Helper function to generate QR code as buffer (for email attachments)
async function generateQRCodeBuffer(data) {
  try {
    const qrData = data || "DIEMEX 2026";
    const buffer = await QRCode.toBuffer(qrData, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 200,
      color: {
        dark: '#0F2F5C',
        light: '#FFFFFF'
      },
      type: 'png'
    });
    return buffer;
  } catch (error) {
    console.error("QR Code generation error:", error);
    return null;
  }
}

// Helper function to generate QR code as data URL (fallback)
async function generateQRCodeDataURL(data) {
  try {
    const qrData = data || "DIEMEX 2026";
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 200,
      color: {
        dark: '#0F2F5C',
        light: '#FFFFFF'
      }
    });
    return qrCodeDataURL;
  } catch (error) {
    console.error("QR Code generation error:", error);
    return null;
  }
}

router.get("/visitor/:code", async (req, res) => {
  try {
    const Visitor = require("../models/Visitor");
    const visitor = await Visitor.findOne({
      visitorCode: req.params.code
    });

    if (!visitor) {
      return res.status(404).json({ message: "Visitor not found" });
    }

    res.json(visitor);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

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
    let visitorCode = null;
    let qrCodeBuffer = null;
    let qrCodeDataURL = null;
    
    // Generate QR code for visitor and delegate registrations
    if (formType === "visitor-registration" || formType === "delegate-registration") {
      // Create a unique visitor code
      visitorCode = `diemex-${Date.now()}`;
      
      // Create a unique QR code content
      const qrContent = `DIEMEX 2026\n${formType === "visitor-registration" ? "Visitor" : "Delegate"}\nName: ${data.firstName || ''} ${data.lastName || ''}\nEmail: ${data.email || ''}\nCode: ${visitorCode}\nDate: 8-10 Oct 2026`;
      
      // Generate both buffer (for attachments) and data URL (for fallback)
      qrCodeBuffer = await generateQRCodeBuffer(qrContent);
      qrCodeDataURL = await generateQRCodeDataURL(qrContent);
      
      // Save to database if Visitor model exists
      try {
        const Visitor = require("../models/Visitor");
        await Visitor.create({
          visitorCode,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.mobile || data.phone,
          address: data.address,
          company: data.company,
          designation: data.designation,
          formType: formType
        });
        console.log(`✅ Visitor saved with code: ${visitorCode}`);
      } catch (dbError) {
        console.error("Database save error:", dbError);
        // Continue even if database save fails
      }
    }

    // Safely access data with fallbacks to prevent undefined errors
    switch (formType) {
      case "event-brochure":
        subject = "Your Event Brochure - DIEMEX 2026";
        html = `
          <!DOCTYPE html>
          <html>
          <body style="margin:0; padding:0; background:#f2f2f2; font-family:Arial, sans-serif;">

            <table width="100%" cellpadding="0" cellspacing="0" border="0">

              <!-- TOP COLOR BACKGROUND -->
              <tr>
                <td align="center" style="background:#FCD5A6; padding:40px 0 0;">

                  <!-- BLUE HEADER (INSIDE COLOR AREA) -->
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

              <!-- WHITE CARD BODY -->
              <tr>
                <td align="center">

                  <table width="600" cellpadding="0" cellspacing="0" border="0"
                    style="background:#ffffff; border-radius:0 0 6px 6px;">

                    <!-- CONTENT -->
                    <tr>
                      <td style="padding:40px 30px; color:#333; text-align:center;">

                        <p style="text-align:left; font-size:16px;">
                          Dear ${data.firstName || 'Valued Customer'},
                        </p>

                        <p style="text-align:left; font-size:16px;">
                          Thank you for requesting <strong>DIEMEX 2026</strong> Brochure.
                        </p>

                        <!-- IMAGE -->
                        <div style="margin:30px 0;">
                          <img 
                            src="https://res.cloudinary.com/deo4vpw8f/image/upload/v1774094980/speakers/avatars/suexnf73ytsmdzooski2.png" 
                            alt="DIEMEX Brochure"
                            style="width:100%; max-width:450px; border-radius:6px;"
                          />
                        </div>

                        <!-- BUTTON -->
                        <div style="margin:30px 0;">
                          <a href="https://drive.google.com/your-brochure-link"
                             style="
                               background:#0F2F5C;
                               color:#ffffff;
                               padding:15px 35px;
                               text-decoration:none;
                               border-radius:30px;
                               font-size:16px;
                               display:inline-block;
                               font-weight:bold;
                             ">
                            Download Brochure
                          </a>
                          <p style="font-size:12px; color:#666; margin-top:10px;">
                            Click the button above to download your copy.
                          </p>
                        </div>

                        <p style="font-size:15px;">
                          If you have any questions, feel free to contact us.
                        </p>

                        <p style="text-align:left; margin-top:20px;">
                          Best regards,<br/>
                          <strong>DIEMEX 2026 Team</strong>
                        </p>

                      </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                      <td style="background:#1E5AA6; color:#fff; padding:15px; text-align:center; font-size:14px;">
                        <strong>8-10 Oct 2026</strong> • Auto Cluster Exhibition Centre, Pune, India
                      </td>
                    </tr>

                    <tr>
                      <td style="background:#E6EEF7; padding:20px; font-size:12px; color:#333; text-align:center;">
                        Organizer: <img 
                  src="https://res.cloudinary.com/deo4vpw8f/image/upload/v1774094980/speakers/avatars/suexnf73ytsmdzooski2.png"
                  style="max-width:220px; display:block; margin:0 auto;"
                /><br/>
                        T9, Swastik Manandi Arcade, Bengaluru, India<br/>
                        Tel: +91 80 40682257 | pad@maxxmedia.in | www.diemex.in
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

              <!-- TOP COLOR BACKGROUND -->
              <tr>
                <td align="center" style="background:#ECF0C6; padding:40px 0 0;">

                  <!-- BLUE HEADER (INSIDE COLOR AREA) -->
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

              <!-- WHITE CARD BODY -->
              <tr>
                <td align="center">

                  <table width="600" cellpadding="0" cellspacing="0" border="0"
                    style="background:#ffffff; border-radius:0 0 6px 6px;">

                    <!-- CONTENT -->
                    <tr>
                      <td style="padding:40px 30px; color:#333; text-align:center;">

                        <p style="text-align:left; font-size:16px;">
                          Dear ${data.firstName || 'Valued Customer'},
                        </p>

                        <p style="text-align:left; font-size:16px;">
                          Thank you for requesting <strong>DIEMEX 2026</strong> Post Show Report.
                        </p>

                        <!-- IMAGE -->
                        <div style="margin:30px 0;">
                          <img 
                            src="https://res.cloudinary.com/deo4vpw8f/image/upload/v1774094980/speakers/avatars/suexnf73ytsmdzooski2.png" 
                            alt="Post Show Report"
                            style="width:100%; max-width:450px; border-radius:6px;"
                          />
                        </div>

                        <!-- BUTTON -->
                        <div style="margin:30px 0;">
                          <a href="https://drive.google.com/your-post-show-report-link"
                             style="
                               background:#0F2F5C;
                               color:#ffffff;
                               padding:15px 35px;
                               text-decoration:none;
                               border-radius:30px;
                               font-size:16px;
                               display:inline-block;
                               font-weight:bold;
                             ">
                            Download Report
                          </a>
                          <p style="font-size:12px; color:#666; margin-top:10px;">
                            Click the button above to download your copy.
                          </p>
                        </div>

                        <p style="font-size:15px;">
                          If you have any questions, feel free to contact us.
                        </p>

                        <p style="text-align:left; margin-top:20px;">
                          Best regards,<br/>
                          <strong>DIEMEX 2026 Team</strong>
                        </p>

                      </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                      <td style="background:#1E5AA6; color:#fff; padding:15px; text-align:center; font-size:14px;">
                        <strong>8-10 Oct 2026</strong> • Auto Cluster Exhibition Centre, Pune, India
                      </td>
                    </tr>

                    <tr>
                      <td style="background:#E6EEF7; padding:20px; font-size:12px; color:#333; text-align:center;">
                        Organizer: <img 
                  src="https://res.cloudinary.com/deo4vpw8f/image/upload/v1774094980/speakers/avatars/suexnf73ytsmdzooski2.png"
                  style="max-width:220px; display:block; margin:0 auto;"
                /><br/>
                        T9, Swastik Manandi Arcade, Bengaluru, India<br/>
                        Tel: +91 80 40682257 | pad@maxxmedia.in | www.diemex.in
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
        
      case "visitor-registration":
        subject = "Visitor Registration Confirmed - DIEMEX 2026";
        html = `
          <!DOCTYPE html>
          <html>
          <body style="margin:0; padding:0; background:#f2f2f2; font-family:Arial, sans-serif;">

            <table width="100%" cellpadding="0" cellspacing="0" border="0">

              <!-- TOP COLOR BACKGROUND -->
              <tr>
                <td align="center" style="background:#D6E9D8; padding:40px 0 0;">

                  <!-- BLUE HEADER (INSIDE COLOR AREA) -->
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

              <!-- WHITE CARD BODY -->
              <tr>
                <td align="center">

                  <table width="600" cellpadding="0" cellspacing="0" border="0"
                    style="background:#ffffff; border-radius:0 0 6px 6px;">

                    <!-- CONTENT -->
                    <tr>
                      <td style="padding:40px 30px; color:#333; text-align:center;">

                        <h2 style="margin-bottom:10px;">Visitor Registration Confirmed !</h2>
                        <hr style="border:none; border-top:1px solid #ddd; width:80%; margin:10px auto 20px;" />

                        <p style="text-align:left; font-size:16px;">
                          Dear ${data.firstName || data.name || 'Valued Visitor'},
                        </p>

                        <p style="text-align:left; font-size:16px;">
                          Thank you for registering to attend <strong>DIEMEX 2026</strong>.<br/>
                          Below are your registration details and visitor badge.
                        </p>

                        <!-- QR CODE BADGE - Using CID for email compatibility -->
                        <div style="margin:30px 0; text-align:center;">
                          <div style="background:#fff; padding:20px; border-radius:12px; display:inline-block; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                            <img src="cid:qrcode_${visitorCode}" alt="Visitor QR Code" style="width:200px; height:200px; display:block; margin:0 auto;" />
                            <p style="margin-top:15px; font-size:14px; font-weight:bold; color:#0F2F5C;">DIEMEX 2026 Visitor Pass</p>
                            <p style="margin:5px 0; font-size:12px; color:#666;">${data.firstName || ''} ${data.lastName || ''}</p>
                            <p style="margin:5px 0; font-size:12px; color:#666; font-weight:bold;">Code: ${visitorCode}</p>
                          </div>
                        </div>

                        <!-- BUTTON - Download link -->
                        <div style="margin:30px 0;">
                          <a href="cid:qrcode_${visitorCode}" 
                             download="diemex-2026-visitor-badge.png"
                             style="
                               background:#0F2F5C;
                               color:#ffffff;
                               padding:15px 35px;
                               text-decoration:none;
                               border-radius:30px;
                               font-size:16px;
                               display:inline-block;
                               font-weight:bold;
                               cursor:pointer;
                             ">
                            Download Badge
                          </a>
                          <p style="font-size:12px; color:#666; margin-top:10px;">
                            Click the button above to download your visitor badge with QR code.
                          </p>
                        </div>

                        <div style="margin-top:15px; font-size:16px; font-weight:bold; padding:10px; background:#f5f5f5; border-radius:5px;">
                          Visitor Code: ${visitorCode}
                        </div>

                        <p style="font-size:15px;">
                          We look forward to seeing you at the event.
                        </p>

                        <p style="font-size:13px; color:#666;">
                          If you have any questions, feel free to contact us.
                        </p>

                        <p style="text-align:left; margin-top:20px;">
                          Best regards,<br/>
                          <strong>DIEMEX 2026 Team</strong>
                        </p>

                      </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                      <td style="background:#1E5AA6; color:#fff; padding:15px; text-align:center; font-size:14px;">
                        <strong>8-10 Oct 2026</strong> • Auto Cluster Exhibition Centre, Pune, India
                      </td>
                    </tr>

                    <tr>
                      <td style="background:#E6EEF7; padding:20px; font-size:12px; color:#333; text-align:center;">
                        Organizer: <img 
                  src="https://res.cloudinary.com/deo4vpw8f/image/upload/v1774094980/speakers/avatars/suexnf73ytsmdzooski2.png"
                  style="max-width:220px; display:block; margin:0 auto;"
                /><br/>
                        T9, Swastik Manandi Arcade, Bengaluru, India<br/>
                        Tel: +91 80 40682257 | pad@maxxmedia.in | www.diemex.in
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

              <!-- TOP COLOR BACKGROUND -->
              <tr>
                <td align="center" style="background:#D7EEFB; padding:40px 0 0;">

                  <!-- BLUE HEADER (INSIDE COLOR AREA) -->
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

              <!-- WHITE CARD BODY -->
              <tr>
                <td align="center">

                  <table width="600" cellpadding="0" cellspacing="0" border="0"
                    style="background:#ffffff; border-radius:0 0 6px 6px;">

                    <!-- CONTENT -->
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
                          We have received your request as follows:
                        </p>

                        <!-- INFO BOX -->
                        <table width="100%" cellpadding="10" cellspacing="0" 
                          style="background:#D7EEFB; margin:20px 0; border-collapse:collapse;">
                          
                          <tr>
                            <td width="40%"><strong>Company Name</strong></td>
                            <td>: ${data.companyName || data.company || 'Not provided'}</td>
                          </tr>

                          <tr>
                            <td><strong>Contact Person</strong></td>
                            <td>: ${data.firstName || ''} ${data.lastName || ''}</td>
                          </tr>

                          <tr>
                            <td><strong>Job Title</strong></td>
                            <td>: ${data.jobTitle || 'Not provided'}</td>
                          </tr>

                          <tr>
                            <td><strong>Address</strong></td>
                            <td>: ${data.address || 'Not provided'}</td>
                          </tr>

                          <tr>
                            <td><strong>Phone Number</strong></td>
                            <td>: ${data.phone || 'Not provided'}</td>
                          </tr>

                          <tr>
                            <td><strong>Email</strong></td>
                            <td>: ${data.email || 'Not provided'}</td>
                          </tr>

                          <tr>
                            <td><strong>Space Requirement</strong></td>
                            <td>: ${data.standSize || 'Not specified'}</td>
                          </tr>

                        </table>

                        <p style="font-size:15px;">
                          Our team will get in touch with you shortly to discuss your requirements 
                          and provide more information.
                        </p>

                        <p style="font-size:15px;">
                          We look forward to the opportunity to collaborate with you at 
                          <strong>DIEMEX 2026!</strong>
                        </p>

                        <p style="margin-top:20px;">
                          Best regards,<br/>
                          <strong>DIEMEX 2026 Team</strong>
                        </p>

                      </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                      <td style="background:#1E5AA6; color:#fff; padding:15px; text-align:center; font-size:14px;">
                        <strong>8-10 Oct 2026</strong> • Auto Cluster Exhibition Centre, Pune, India
                      </td>
                    </tr>

                    <tr>
                      <td style="background:#E6EEF7; padding:20px; font-size:12px; color:#333; text-align:center;">
                        Organizer: <img 
                  src="https://res.cloudinary.com/deo4vpw8f/image/upload/v1774094980/speakers/avatars/suexnf73ytsmdzooski2.png"
                  style="max-width:220px; display:block; margin:0 auto;"
                /><br/>
                        T9, Swastik Manandi Arcade, Bengaluru, India<br/>
                        Tel: +91 80 40682257 | pad@maxxmedia.in | www.diemex.in
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

              <!-- PURPLE BACKGROUND WITH HEADER INSIDE -->
              <tr>
                <td align="center" style="background:#AE4A84; padding:40px 0 0;">

                  <!-- BLUE HEADER (INSIDE PURPLE) -->
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

              <!-- WHITE CARD BODY -->
              <tr>
                <td align="center">

                  <table width="600" cellpadding="0" cellspacing="0" border="0"
                    style="background:#ffffff; border-radius:0 0 6px 6px;">

                    <tr>
                      <td style="padding:40px 30px; text-align:center; color:#333;">

                        <h2 style="margin-bottom:10px;">Delegate Registration Confirmed !</h2>
                        <hr style="border:none; border-top:1px solid #ddd; width:80%; margin:10px auto 20px;" />

                        <p style="text-align:left;">
                          Dear ${data.firstName || 'Valued Delegate'},
                        </p>

                        <p style="text-align:left;">
                          Thank you for registering to attend 
                          <strong>DIEMEX 2026 Conference</strong>.<br/>
                          Below are your registration details and delegate badge.
                        </p>

                        <div style="margin:30px 0; text-align:center;">
                          <div style="background:#fff; padding:20px; border-radius:12px; display:inline-block; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                            <img src="cid:qrcode_${visitorCode}" alt="Delegate QR Code" style="width:200px; height:200px; display:block; margin:0 auto;" />
                            <p style="margin-top:15px; font-size:14px; font-weight:bold; color:#0F2F5C;">DIEMEX 2026 Delegate Pass</p>
                            <p style="margin:5px 0; font-size:12px; color:#666;">${data.firstName || ''} ${data.lastName || ''}</p>
                            <p style="margin:5px 0; font-size:12px; color:#666; font-weight:bold;">Code: ${visitorCode}</p>
                          </div>
                        </div>

                        <a href="cid:qrcode_${visitorCode}"
                           download="diemex-2026-delegate-badge.png"
                           style="background:#0F2F5C; color:#fff; padding:15px 35px;
                                  text-decoration:none; border-radius:30px; display:inline-block;
                                  cursor:pointer;">
                          Download Badge
                        </a>

                        <div style="margin-top:15px; font-size:16px; font-weight:bold; padding:10px; background:#f5f5f5; border-radius:5px;">
                          Delegate Code: ${visitorCode}
                        </div>

                        <p style="margin-top:25px;">We look forward to seeing you at the event.</p>

                        <p style="font-size:13px; color:#666;">
                          If you have any questions, feel free to contact us.
                        </p>

                        <p style="text-align:left; margin-top:20px;">
                          Best regards,<br/>
                          <strong>DIEMEX 2026 Team</strong>
                        </p>

                      </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                      <td style="background:#1E5AA6; color:#fff; padding:15px; text-align:center;">
                        <strong>8-10 Oct 2026</strong> • Auto Cluster Exhibition Centre, Pune, India
                      </td>
                    </tr>

                    <tr>
                      <td style="background:#E6EEF7; padding:20px; font-size:12px; text-align:center;">
                        Organizer: <img 
                  src="https://res.cloudinary.com/deo4vpw8f/image/upload/v1774094980/speakers/avatars/suexnf73ytsmdzooski2.png"
                  style="max-width:220px; display:block; margin:0 auto;"
                /><br/>
                        Bengaluru, India | pad@maxxmedia.in | www.diemex.in
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
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #9333EA 0%, #A855F7 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .field { margin-bottom: 15px; }
              .field-label { font-weight: bold; color: #9333EA; }
              .field-value { margin-left: 10px; }
              hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
              .badge {
                display: inline-block;
                background: #9333EA;
                color: white;
                padding: 5px 15px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: bold;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Partner Registration Confirmed! 🤝</h1>
              </div>
              <div class="content">
                <h2>Welcome to DIEMEX Exhibition Partner Program, ${data.firstName || ''}!</h2>
                <p>Your partner registration has been successfully completed. Here's a summary of your registration details:</p>
                
                <hr/>
                
                <div class="field">
                  <span class="field-label">Name:</span>
                  <span class="field-value">${data.firstName || ''} ${data.lastName || ''}</span>
                </div>
                
                <div class="field">
                  <span class="field-label">Job Title:</span>
                  <span class="field-value">${data.jobTitle || 'Not provided'}</span>
                </div>
                
                <div class="field">
                  <span class="field-label">Email:</span>
                  <span class="field-value">${data.email || 'Not provided'}</span>
                </div>
                
                <div class="field">
                  <span class="field-label">Phone:</span>
                  <span class="field-value">+91 ${data.phone || 'Not provided'}</span>
                </div>
                
                <div class="field">
                  <span class="field-label">Company:</span>
                  <span class="field-value">${data.companyName || 'Not provided'}</span>
                </div>
                
                ${data.gstin ? `
                <div class="field">
                  <span class="field-label">GSTIN:</span>
                  <span class="field-value">${data.gstin}</span>
                </div>
                ` : ''}
                
                <div class="field">
                  <span class="field-label">Address:</span>
                  <span class="field-value">${data.address || 'Not provided'}</span>
                </div>
                
                ${data.website ? `
                <div class="field">
                  <span class="field-label">Website:</span>
                  <span class="field-value"><a href="${data.website}" style="color: #9333EA;">${data.website}</a></span>
                </div>
                ` : ''}
                
                <div class="field">
                  <span class="field-label">Marketing Consent:</span>
                  <span class="field-value">${data.marketingConsent ? '✅ Yes' : '❌ No'}</span>
                </div>
                
                <hr/>
                
                <p><strong>What's Next?</strong></p>
                <ul style="color: #666; margin-bottom: 20px;">
                  <li>Our partnership team will review your application within 2-3 business days</li>
                  <li>You'll receive an email with partnership benefits and next steps</li>
                  <li>A dedicated account manager will be assigned to assist you</li>
                  <li>We'll schedule an introductory call to discuss collaboration opportunities</li>
                </ul>
                
                <div style="background-color: #F3E8FF; border-left: 4px solid #9333EA; padding: 20px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; color: #6B21A8;">
                    <strong>🤝 Partner Benefits:</strong><br>
                    • Exclusive networking opportunities<br>
                    • Priority booth allocation<br>
                    • Marketing and brand visibility<br>
                    • Access to partner events<br>
                    • Business matching services
                  </p>
                </div>
                
                <p>We're excited about the possibility of partnering with you!</p>
                
                <p>Best regards,<br/>
                <img 
                  src="https://res.cloudinary.com/deo4vpw8f/image/upload/v1774094980/speakers/avatars/suexnf73ytsmdzooski2.png"
                  style="max-width:220px; display:block; margin:0 auto;"
                /></p>
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
    console.log(`📧 Sending email to user: ${data.email}`);
    
    // Prepare email options with attachments for QR code
    let emailOptions = {
      to: data.email,
      subject: subject,
      html: html
    };
    
    // Add QR code as inline attachment for visitor and delegate registrations
    if ((formType === "visitor-registration" || formType === "delegate-registration") && qrCodeBuffer) {
      emailOptions.attachments = [{
        filename: `qrcode_${visitorCode}.png`,
        content: qrCodeBuffer,
        cid: `qrcode_${visitorCode}`, // Same cid as in img src
        contentType: 'image/png'
      }];
    }
    
    await emailService.sendEmailWithAttachments(emailOptions);
    console.log(`✅ User email sent successfully to ${data.email}`);
    
    // Send notification to admin
    try {
      const adminEmail = 'pad9742@gmail.com';
      console.log(`📧 Sending admin notification to ${adminEmail}`);
      
      // Generate admin email HTML using the same template
      let adminHtml = "";
      
      switch (formType) {
        case "delegate-registration":
          adminHtml = generateInwardTemplate({
            title: "New Delegate Registration !",
            lightBg: "#E8D6DC",
            stripColor: "#F2E3E7",
            titleColor: "#A84C7D",
            data: { ...data, visitorCode: visitorCode || 'N/A' }
          });
          break;

        case "exhibitor-enquiry":
          adminHtml = generateInwardTemplate({
            title: "Exhibitor Enquiry !",
            lightBg: "#D7EEFB",
            stripColor: "#CFE3EE",
            titleColor: "#1F3F4F",
            data,
            includeSpace: true
          });
          break;

        case "event-brochure":
          adminHtml = generateInwardTemplate({
            title: "Brochure Download !",
            lightBg: "#F3E2C7",
            stripColor: "#EAD6B8",
            titleColor: "#F7941D",
            data
          });
          break;

        case "post-show-report":
          adminHtml = generateInwardTemplate({
            title: "Post Show Report Download !",
            lightBg: "#E7EDC9",
            stripColor: "#DDE5B2",
            titleColor: "#F4C400",
            data
          });
          break;

        case "visitor-registration":
          adminHtml = generateInwardTemplate({
            title: "New Visitor Registration !",
            lightBg: "#DDEFE2",
            stripColor: "#CFE3D5",
            titleColor: "#0F8F4F",
            data: { ...data, visitorCode: visitorCode || 'N/A' }
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
      // Don't fail the request if admin notification fails
    }

    return res.status(200).json({ 
      success: true, 
      message: "Form submitted successfully. Please check your email for confirmation.",
      visitorCode: visitorCode || null
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