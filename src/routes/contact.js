const express = require("express");
const router = express.Router();
const emailService = require("../services/EmailService");


function generateInwardTemplate({
  title,
  lightBg,
  stripColor,
  titleColor,
  data,
  includeSpace = false
}) {
  return `
  <!DOCTYPE html>
  <html>
  <body style="margin:0; padding:0; background:${lightBg}; font-family:Arial, sans-serif;">
    
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:40px 0;">

          <table width="600" cellpadding="0" cellspacing="0" style="background:${lightBg};">

            <tr>
              <td style="background:#0F2F5C; padding:30px; text-align:center; color:#fff;">
                <h2 style="margin:0;">3rd Edition <strong>diemex</strong></h2>
                <p style="margin:5px 0 0;">International Die & Mould Exhibition</p>
              </td>
            </tr>

            <tr>
              <td style="background:${stripColor}; height:25px;"></td>
            </tr>

            <tr>
              <td style="background:${titleColor}; color:#fff; text-align:center; padding:15px; font-size:20px; font-weight:bold;">
                ${title}
              </td>
            </tr>

            <tr>
              <td style="padding:30px; color:#333;">
                <table width="100%" cellpadding="8">
                  <tr><td><strong>Company Name</strong></td><td>: ${data.companyName || data.company || 'N/A'}</td></tr>
                  <tr><td><strong>Contact Person</strong></td><td>: ${data.firstName || ''} ${data.lastName || ''}</td></tr>
                  <tr><td><strong>Job Title</strong></td><td>: ${data.jobTitle || 'N/A'}</td></tr>
                  <tr><td><strong>Address</strong></td><td>: ${data.address || 'N/A'}</td></tr>
                  <tr><td><strong>Phone Number</strong></td><td>: ${data.phone || 'N/A'}</td></tr>
                  <tr><td><strong>Email</strong></td><td>: ${data.email || 'N/A'}</td></tr>

                  ${
                    includeSpace
                      ? `<tr><td><strong>Space Requirement</strong></td><td>: ${data.standSize || 'N/A'}</td></tr>`
                      : ""
                  }
                </table>
              </td>
            </tr>

            <tr>
              <td style="background:#1E5AA6; color:#fff; padding:15px; text-align:center;">
                <strong>8-10 Oct 2026</strong> • Auto Cluster Exhibition Centre, Pune
              </td>
            </tr>

            <tr>
              <td style="background:#DCEAF7; padding:15px; text-align:center; font-size:12px;">
                Organizer: <strong>maX Business Media Pvt Ltd</strong>
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

switch (formType) {

  case "visitor-registration":
    subject = "New Visitor Registration - DIEMEX 2026";
    html = generateInwardTemplate({
      title: "New Visitor Registration !",
      lightBg: "#E6F0E8",
      stripColor: "#CFE3D4",
      titleColor: "#0F9D58",
      data
    });
    break;

  case "exhibitor-enquiry":
    subject = "New Exhibitor Enquiry - DIEMEX 2026";
    html = generateInwardTemplate({
      title: "Exhibitor Enquiry !",
      lightBg: "#DCEAF7",
      stripColor: "#BFD6E5",
      titleColor: "#264653",
      data,
      includeSpace: true
    });
    break;

  case "event-brochure":
    subject = "New Brochure Request - DIEMEX 2026";
    html = generateInwardTemplate({
      title: "Brochure Download !",
      lightBg: "#F3E2C8",
      stripColor: "#E5D3B3",
      titleColor: "#F39C12",
      data
    });
    break;

  case "post-show-report":
    subject = "New Post Show Report Request - DIEMEX 2026";
    html = generateInwardTemplate({
      title: "Post Show Report Download !",
      lightBg: "#E9EDC9",
      stripColor: "#DDE2B3",
      titleColor: "#F1C40F",
      data
    });
    break;

  case "delegate-registration":
    subject = "New Delegate Registration - DIEMEX 2026";
    html = generateInwardTemplate({
      title: "New Delegate Registration !",
      lightBg: "#F2D6E5",
      stripColor: "#E7B8CF",
      titleColor: "#AE4A84",
      data
    });
    break;

  default:
    subject = "New Form Submission";
    html = `<p>New submission received</p>`;
}

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
                <h2 style="margin:0; font-size:26px; letter-spacing:1px;">
                  3rd Edition <strong>diemex</strong>
                </h2>
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
                    src="https://your-image-url.com/brochure.jpg" 
                    alt="DIEMEX Brochure"
                    style="width:100%; max-width:450px; border-radius:6px;"
                  />
                </div>

                <!-- BUTTON -->
                <div style="margin:30px 0;">
                  <a href="https://your-download-link.com"
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
                Organizer: <strong>maX Business Media Pvt Ltd</strong><br/>
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
                <h2 style="margin:0; font-size:26px;">
                  3rd Edition <strong>diemex</strong>
                </h2>
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
                    src="https://your-image-url.com/post-show.jpg" 
                    alt="Post Show Report"
                    style="width:100%; max-width:450px; border-radius:6px;"
                  />
                </div>

                <!-- BUTTON -->
                <div style="margin:30px 0;">
                  <a href="https://your-download-link.com"
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
                Organizer: <strong>maX Business Media Pvt Ltd</strong><br/>
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
  subject = "Your Post Show Report - DIEMEX 2026";

  html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>DIEMEX Post Show Report</title>
  </head>

  <body style="margin:0; padding:0; background:#f2f2f2; font-family:Arial, sans-serif;">
    
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center">

          <!-- MAIN CONTAINER -->
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
            
            <!-- TOP STRIP -->
            <tr>
              <td style="background:#ECF0C6; padding:40px 20px; text-align:center;">
                
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="background:#0F2F5C; padding:30px; color:#fff;">
                      <h2 style="margin:0; font-size:26px;">
                        3rd Edition <strong>diemex</strong>
                      </h2>
                      <p style="margin:5px 0 0; font-size:14px;">
                        International Die & Mould Exhibition
                      </p>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>

            <!-- CONTENT -->
            <tr>
              <td style="padding:40px 30px; color:#333;">

                <p style="font-size:16px;">Dear ${data.firstName || 'Valued Customer'},</p>

                <p style="font-size:16px;">
                  Thank you for requesting <strong>DIEMEX 2026</strong> Post Show Report.
                </p>

                <!-- IMAGE -->
                <div style="text-align:center; margin:30px 0;">
                  <img 
                    src="https://your-image-url.com/post-show.jpg" 
                    alt="Post Show Report"
                    style="width:100%; max-width:450px; border-radius:6px;"
                  />
                </div>

                <!-- BUTTON -->
                <div style="text-align:center; margin:30px 0;">
                  <a href="https://your-download-link.com"
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
                Organizer: <strong>maX Business Media Pvt Ltd</strong><br/>
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
                <h2 style="margin:0; font-size:26px;">
                  3rd Edition <strong>diemex</strong>
                </h2>
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

                <!-- BADGE IMAGE -->
                <div style="margin:30px 0;">
                  <img 
                    src="https://your-image-url.com/badge.png" 
                    alt="Visitor Badge"
                    style="width:220px; border-radius:8px;"
                  />
                </div>

                <!-- BUTTON -->
                <div style="margin:30px 0;">
                  <a href="https://your-badge-download-link.com"
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
                    Download Badge
                  </a>
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
                Organizer: <strong>maX Business Media Pvt Ltd</strong><br/>
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
  subject = "Visitor Registration Confirmed - DIEMEX 2026";

  html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Visitor Registration</title>
  </head>

  <body style="margin:0; padding:0; background:#f2f2f2; font-family:Arial, sans-serif;">
    
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center">

          <!-- MAIN CONTAINER -->
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
            
            <!-- TOP STRIP -->
            <tr>
              <td style="background:#D6E9D8; padding:40px 20px; text-align:center;">
                
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="background:#0F2F5C; padding:30px; color:#fff;">
                      <h2 style="margin:0; font-size:26px;">
                        3rd Edition <strong>diemex</strong>
                      </h2>
                      <p style="margin:5px 0 0; font-size:14px;">
                        International Die & Mould Exhibition
                      </p>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>

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

                <!-- BADGE IMAGE -->
                <div style="margin:30px 0;">
                  <img 
                    src="https://your-image-url.com/badge.png" 
                    alt="Visitor Badge"
                    style="width:220px; border-radius:8px;"
                  />
                </div>

                <!-- BUTTON -->
                <div style="margin:30px 0;">
                  <a href="https://your-badge-download-link.com"
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
                    Download Badge
                  </a>
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
                Organizer: <strong>maX Business Media Pvt Ltd</strong><br/>
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
                <h2 style="margin:0; font-size:26px;">
                  3rd Edition <strong>diemex</strong>
                </h2>
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
                Organizer: <strong>maX Business Media Pvt Ltd</strong><br/>
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
  break;case "delegate-registration":
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
                <h2 style="margin:0; font-size:26px;">
                  3rd Edition <strong>diemex</strong>
                </h2>
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

                <div style="margin:30px 0;">
                  <img src="https://your-image-url.com/delegate-badge.png"
                       style="width:220px; border-radius:8px;" />
                </div>

                <a href="https://your-badge-download-link.com"
                   style="background:#0F2F5C; color:#fff; padding:15px 35px;
                          text-decoration:none; border-radius:30px; display:inline-block;">
                  Download Badge
                </a>

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
                Organizer: <strong>maX Business Media Pvt Ltd</strong><br/>
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
  subject = "Delegate Registration Confirmed - DIEMEX 2026";

  html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Delegate Registration</title>
  </head>

  <body style="margin:0; padding:0; background:#f2f2f2; font-family:Arial, sans-serif;">
    
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      
      <!-- TOP COLOR BAND -->
      <tr>
        <td style="background:#AE4A84; height:120px;"></td>
      </tr>

      <!-- CARD -->
      <tr>
        <td align="center" style="margin-top:-80px;">
          
          <table width="600" cellpadding="0" cellspacing="0" border="0"
            style="background:#ffffff; margin-top:-80px; border-radius:8px; overflow:hidden;">
            
            <!-- HEADER -->
            <tr>
              <td align="center" style="background:#0F2F5C; padding:30px; color:#fff;">
                <h2 style="margin:0; font-size:26px;">
                  3rd Edition <strong>diemex</strong>
                </h2>
                <p style="margin:5px 0 0; font-size:14px;">
                  International Die & Mould Exhibition
                </p>
              </td>
            </tr>

            <!-- CONTENT -->
            <tr>
              <td style="padding:40px 30px; color:#333; text-align:center;">

                <h2 style="margin-bottom:10px;">Delegate Registration Confirmed !</h2>
                <hr style="border:none; border-top:1px solid #ddd; width:80%; margin:10px auto 20px;" />

                <p style="text-align:left; font-size:16px;">
                  Dear ${data.firstName || data.name || 'Valued Delegate'},
                </p>

                <p style="text-align:left; font-size:16px;">
                  Thank you for registering to attend <strong>DIEMEX 2026 Conference</strong>.<br/>
                  Below are your registration details and delegate badge.
                </p>

                <!-- BADGE -->
                <div style="margin:30px 0;">
                  <img 
                    src="https://your-image-url.com/delegate-badge.png" 
                    alt="Delegate Badge"
                    style="width:220px; border-radius:8px;"
                  />
                </div>

                <!-- BUTTON -->
                <div style="margin:30px 0;">
                  <a href="https://your-badge-download-link.com"
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
                    Download Badge
                  </a>
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
                Organizer: <strong>maX Business Media Pvt Ltd</strong><br/>
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
  subject = "Delegate Registration Confirmed - DIEMEX 2026";

  html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Delegate Registration</title>
  </head>

  <body style="margin:0; padding:0; background:#AE4A84; font-family:Arial, sans-serif;">
    
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#AE4A84; padding:40px 0;">
      <tr>
        <td align="center">

          <!-- CARD CONTAINER -->
          <table width="600" cellpadding="0" cellspacing="0" border="0" 
            style="background:#ffffff; border-radius:8px; overflow:hidden;">
            
            <!-- HEADER -->
            <tr>
              <td align="center" style="background:#0F2F5C; padding:30px; color:#fff;">
                <h2 style="margin:0; font-size:26px;">
                  3rd Edition <strong>diemex</strong>
                </h2>
                <p style="margin:5px 0 0; font-size:14px;">
                  International Die & Mould Exhibition
                </p>
              </td>
            </tr>

            <!-- CONTENT -->
            <tr>
              <td style="padding:40px 30px; color:#333; text-align:center;">

                <h2 style="margin-bottom:10px;">Delegate Registration Confirmed !</h2>
                <hr style="border:none; border-top:1px solid #ddd; width:80%; margin:10px auto 20px;" />

                <p style="text-align:left; font-size:16px;">
                  Dear ${data.firstName || data.name || 'Valued Delegate'},
                </p>

                <p style="text-align:left; font-size:16px;">
                  Thank you for registering to attend <strong>DIEMEX 2026 Conference</strong>.<br/>
                  Below are your registration details and delegate badge.
                </p>

                <!-- BADGE -->
                <div style="margin:30px 0;">
                  <img 
                    src="https://your-image-url.com/delegate-badge.png" 
                    alt="Delegate Badge"
                    style="width:220px; border-radius:8px;"
                  />
                </div>

                <!-- BUTTON -->
                <div style="margin:30px 0;">
                  <a href="https://your-badge-download-link.com"
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
                    Download Badge
                  </a>
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
                Organizer: <strong>maX Business Media Pvt Ltd</strong><br/>
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
        subject = "Your Delegate Registration Confirmation - DIEMEX Exhibition";
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
              .package-badge {
                display: inline-block;
                background: #28a745;
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
                <h1>Delegate Registration Confirmed! 🎉</h1>
              </div>
              <div class="content">
                <h2>Welcome to DIEMEX Exhibition, ${data.firstName || ''}!</h2>
                <p>Your delegate registration has been successfully completed. Here's a summary of your registration details:</p>
                
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
                  <span class="field-label">Job Title:</span>
                  <span class="field-value">${data.jobTitle || 'Not provided'}</span>
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
                  <span class="field-label">Country:</span>
                  <span class="field-value">${data.country || 'Not provided'}</span>
                </div>
                
                <div class="field">
                  <span class="field-label">Location:</span>
                  <span class="field-value">${data.city || ''}${data.city && data.state ? ', ' : ''}${data.state || ''}</span>
                </div>
                
                ${data.package ? `
                <div class="field">
                  <span class="field-label">Selected Package:</span>
                  <span class="field-value">
                    <span class="package-badge">${data.package.toUpperCase()}</span>
                  </span>
                </div>
                ` : ''}
                
                <hr/>
                
                <p><strong>Event Details:</strong></p>
                <p>📅 Date: [Insert Event Date]<br/>
                📍 Location: [Insert Event Location]<br/>
                🎫 Registration Type: Delegate</p>
                
                <p><strong>Next Steps:</strong></p>
                <ul style="color: #666; margin-bottom: 20px;">
                  <li>Your delegate badge will be available for pickup at the event registration desk</li>
                  <li>You'll receive event updates and important information via email</li>
                  <li>For any questions, please contact our delegate support team</li>
                </ul>
                
                <p>We look forward to welcoming you to the exhibition!</p>
                
                <p>Best regards,<br/>
                <strong>DIEMEX Exhibition Team</strong></p>
              </div>
            </div>
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
          <strong>DIEMEX Partnership Team</strong></p>
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