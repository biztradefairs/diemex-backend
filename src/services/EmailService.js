const { Resend } = require("resend");
const sgMail = require("@sendgrid/mail");
const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.initialized = false;
    this.provider = null;
    this.resend = null;
    this.smtp = null;
    this.sendgridReady = false;
    this.from = null;
    this.init();
  }

  cleanFrom(value, fallback) {
    const raw = String(value || fallback || "").trim().replace(/^['"]|['"]$/g, "");
    return raw || fallback;
  }

  init() {
    if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
      try {
        this.resend = new Resend(process.env.RESEND_API_KEY);
        this.from = this.cleanFrom(process.env.RESEND_FROM);
        this.provider = this.provider || "resend";
        this.initialized = true;
        console.log("✅ Email Service: Resend ready");
      } catch (error) {
        console.error("❌ Failed to initialize Resend:", error.message);
      }
    }

    if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM) {
      try {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        this.sendgridReady = true;
        this.from = this.from || this.cleanFrom(process.env.SENDGRID_FROM);
        this.provider = this.provider || "sendgrid";
        this.initialized = true;
        console.log("✅ Email Service: SendGrid configured");
      } catch (error) {
        console.error("❌ Failed to initialize SendGrid:", error.message);
      }
    }

    if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        this.smtp = nodemailer.createTransport({
          host: process.env.EMAIL_HOST,
          port: Number(process.env.EMAIL_PORT || 587),
          secure: String(process.env.EMAIL_PORT) === "465",
          auth: {
            user: process.env.EMAIL_USER,
            pass: String(process.env.EMAIL_PASS || "").replace(/^['"]|['"]$/g, "").replace(/\s+/g, ""),
          },
        });
        this.smtpFrom = this.cleanFrom(process.env.EMAIL_FROM, process.env.EMAIL_USER);
        this.from = this.from || this.smtpFrom;
        this.provider = this.provider || "smtp";
        this.initialized = true;
        console.log("✅ Email Service: SMTP ready");
        console.log(`📧 SMTP from: ${this.smtpFrom}`);
      } catch (error) {
        console.error("❌ Failed to initialize SMTP:", error.message);
      }
    }

    if (!this.initialized) {
      console.error("❌ Email service is not configured. Set Resend, SendGrid, or SMTP credentials.");
    }
  }

  async sendViaResend(to, subject, html, attachments) {
    const payload = { from: this.cleanFrom(process.env.RESEND_FROM, this.from), to, subject, html };
    if (attachments) payload.attachments = attachments;
    const response = await this.resend.emails.send(payload);
    return { success: true, messageId: response.data?.id, provider: "resend" };
  }

  async sendViaSendGrid(to, subject, html, attachments) {
    const message = {
      to,
      from: this.cleanFrom(process.env.SENDGRID_FROM, this.from),
      subject,
      html,
    };
    if (attachments) message.attachments = attachments;
    const response = await sgMail.send(message);
    return {
      success: true,
      messageId: response?.[0]?.headers?.["x-message-id"],
      provider: "sendgrid",
    };
  }

  async sendViaSmtp(to, subject, html, attachments) {
    const info = await this.smtp.sendMail({
      from: this.smtpFrom,
      to,
      subject,
      html,
      attachments,
    });
    return { success: true, messageId: info.messageId, provider: "smtp" };
  }

  async sendEmail(to, subject, html) {
    if (!this.initialized) {
      console.error("❌ Email service not initialized");
      return { success: false, error: "Email service not initialized" };
    }

    const attempts = [];
    const errors = [];

    if (this.resend) attempts.push(["resend", () => this.sendViaResend(to, subject, html)]);
    if (this.sendgridReady) attempts.push(["sendgrid", () => this.sendViaSendGrid(to, subject, html)]);
    if (this.smtp) attempts.push(["smtp", () => this.sendViaSmtp(to, subject, html)]);

    for (const [name, send] of attempts) {
      try {
        console.log(`📧 Attempting to send email via ${name}:`);
        console.log(`   To: ${to}`);
        console.log(`   Subject: ${subject}`);
        const result = await send();
        console.log(`✅ Email sent successfully to ${to} via ${name}`);
        return result;
      } catch (error) {
        const detail = error.response?.body || error.message;
        console.error(`❌ Email send error (${name}):`, detail);
        errors.push(`${name}: ${error.message}`);
      }
    }

    return {
      success: false,
      error: errors.join(" | ") || "All email providers failed",
    };
  }

  async sendEmailWithAttachment({ to, subject, html, attachment }) {
    if (!this.initialized) {
      console.error("❌ Email service not initialized");
      return { success: false, error: "Email service not initialized" };
    }

    const sendgridAttachment = attachment
      ? [{
          content: Buffer.isBuffer(attachment.content)
            ? attachment.content.toString("base64")
            : attachment.content,
          filename: attachment.filename,
          type: attachment.contentType || "application/octet-stream",
          disposition: attachment.cid ? "inline" : "attachment",
          contentId: attachment.cid,
        }]
      : undefined;

    const resendAttachment = attachment
      ? [{
          filename: attachment.filename,
          content: Buffer.isBuffer(attachment.content)
            ? attachment.content.toString("base64")
            : attachment.content,
          content_id: attachment.cid,
        }]
      : undefined;

    const smtpAttachment = attachment
      ? [{
          filename: attachment.filename,
          content: attachment.content,
          cid: attachment.cid,
          contentType: attachment.contentType,
        }]
      : undefined;

    const attempts = [];
    if (this.resend) attempts.push(["resend", () => this.sendViaResend(to, subject, html, resendAttachment)]);
    if (this.sendgridReady) attempts.push(["sendgrid", () => this.sendViaSendGrid(to, subject, html, sendgridAttachment)]);
    if (this.smtp) attempts.push(["smtp", () => this.sendViaSmtp(to, subject, html, smtpAttachment)]);

    const errors = [];
    for (const [name, send] of attempts) {
      try {
        const result = await send();
        console.log(`✅ Email with attachment sent successfully to ${to} via ${name}`);
        return result;
      } catch (error) {
        console.error(`❌ Email attachment error (${name}):`, error.response?.body || error.message);
        errors.push(`${name}: ${error.message}`);
      }
    }

    return {
      success: false,
      error: errors.join(" | ") || "All email providers failed",
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
      </head>

      <body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding:40px 0;">

              <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;">

                <tr>
                  <td style="background:#004D9F;padding:40px;text-align:center;">
                    <h1 style="color:#fff;margin:0;">DIEMEX</h1>
                    <p style="color:#fff;">Exhibitor Portal</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:40px;">

                    <h2>Password Reset Request</h2>

                    <p>Hello <strong>${name || "Exhibitor"}</strong>,</p>

                    <p>
                      We received a request to reset your password.
                    </p>

                    <div style="text-align:center;margin:40px 0;">
                      <a
                        href="${resetUrl}"
                        style="
                          background:#004D9F;
                          color:#fff;
                          text-decoration:none;
                          padding:15px 30px;
                          border-radius:50px;
                          display:inline-block;
                        "
                      >
                        Reset Password
                      </a>
                    </div>

                    <p>This link expires in 1 hour.</p>

                    <p>
                      If the button does not work, copy this URL:
                    </p>

                    <p
                      style="
                        background:#f1f1f1;
                        padding:15px;
                        border-radius:8px;
                        word-break:break-all;
                      "
                    >
                      ${resetUrl}
                    </p>

                    <hr />

                    <p style="font-size:12px;color:#999;">
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
   * Password reset success
   */
  async sendPasswordResetConfirmation(email, name) {
    const subject =
      "✅ Password Reset Successful - DIEMEX Exhibitor Portal";

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:40px;">

        <div
          style="
            max-width:600px;
            margin:auto;
            background:#fff;
            border-radius:12px;
            overflow:hidden;
          "
        >

          <div
            style="
              background:#28a745;
              padding:40px;
              text-align:center;
              color:#fff;
            "
          >
            <h1>Password Reset Successful</h1>
          </div>

          <div style="padding:40px;">

            <p>Hello ${name || "Exhibitor"},</p>

            <p>
              Your password has been successfully reset.
            </p>

            <div style="text-align:center;margin-top:30px;">
              <a
                href="${process.env.FRONTEND_URL || "http://localhost:3000"}/login"
                style="
                  background:#004D9F;
                  color:#fff;
                  text-decoration:none;
                  padding:15px 30px;
                  border-radius:50px;
                "
              >
                Go To Login
              </a>
            </div>

            <hr style="margin-top:40px;" />

            <p style="font-size:12px;color:#999;">
              This email was sent to ${email}
            </p>

          </div>

        </div>

      </body>
      </html>
    `;

    return this.sendEmail(email, subject, html);
  }

  /**
   * Exhibitor welcome
   */
  async sendExhibitorWelcome(exhibitor, plainPassword) {
    const subject =
      "Welcome to DIEMEX Exhibitor Portal - Login Credentials";

    const html = `
      <h2>Welcome to DIEMEX Exhibition Portal</h2>

      <p>Dear ${exhibitor.name},</p>

      <p>Your exhibitor account has been created successfully.</p>

      <hr>

      <p><strong>Email:</strong> ${exhibitor.email}</p>

      <p><strong>Password:</strong> ${plainPassword}</p>

      <hr>

      <p>
        Please login and change your password immediately for security.
      </p>

      <p>
        Login here:
        ${process.env.FRONTEND_URL || "http://localhost:3000"}/login
      </p>

      <p>
        Best regards,<br />
        DIEMEX Exhibition Team
      </p>
    `;

    return this.sendEmail(exhibitor.email, subject, html);
  }

  /**
   * Visitor OTP
   */
  async sendVisitorOTP(email, name, otp) {
    const subject = "Your Verification Code - DIEMEX 2027";
    const greeting = name || "Valued Visitor";

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="margin:0; padding:0; background:#f2f2f2; font-family:Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="background:#D6E9D8; padding:40px 0 0;">
              <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#0F2F5C; border-radius:6px 6px 0 0; color:#fff;">
                <tr>
                  <td align="center" style="padding:30px;">
                    <img src="https://res.cloudinary.com/deo4vpw8f/image/upload/v1774691470/di_logo_kqo9pa.png" style="max-width:220px; display:block; margin:0 auto;" />
                    <p style="margin:5px 0 0; font-size:14px;">International Die & Mould Exhibition</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff; border-radius:0 0 6px 6px;">
                <tr>
                  <td style="padding:40px 30px; color:#333; text-align:center;">
                    <h2 style="margin-bottom:10px;">Verify Your Email</h2>
                    <hr style="border:none; border-top:1px solid #ddd; width:80%; margin:10px auto 20px;" />
                    <p style="text-align:left; font-size:16px;">Dear ${greeting},</p>
                    <p style="text-align:left; font-size:16px;">
                      Thank you for registering to attend <strong>DIEMEX 2027</strong>.<br/>
                      Use this verification code to continue your visitor registration.
                    </p>
                    <div style="margin:30px 0; font-size:36px; letter-spacing:8px; font-weight:bold; color:#0F2F5C; padding:16px; background:#f5f5f5; border-radius:8px;">
                      ${otp}
                    </div>
                    <p style="font-size:15px;">This code expires in 10 minutes. Do not share it with anyone.</p>
                    <p style="font-size:13px; color:#666;">If you did not request this code, you can ignore this email.</p>
                    <p style="text-align:left; margin-top:20px;">
                      Best regards,<br/>
                      <strong>DIEMEX 2027 Team</strong>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#1E5AA6; color:#fff; padding:15px; text-align:center; font-size:14px;">
                    <strong>24-26 Mar 2027</strong> • Auto Cluster Exhibition Centre, Pune, India
                  </td>
                </tr>
                <tr>
                  <td style="background:#E6EEF7; padding:20px; font-size:12px; color:#333; text-align:center;">
                    Organizer: <img src="https://res.cloudinary.com/deo4vpw8f/image/upload/v1774687173/maxxlogo_lulkwh.png" style="max-width:220px; display:block; margin:0 auto;" /><br/>
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

    return this.sendEmail(email, subject, html);
  }

  /**
   * Visitor confirmation
   */
  async sendVisitorConfirmation(visitorData) {
    const subject = "Registration Confirmed - DIEMEX Exhibition";

    const html = `
      <h2>Registration Confirmed!</h2>

      <p>Dear ${visitorData.name},</p>

      <p>
        Your registration for DIEMEX Exhibition
        has been successfully completed.
      </p>

      <hr>

      <p><strong>Name:</strong> ${visitorData.name}</p>
      <p><strong>Company:</strong> ${visitorData.company}</p>
      <p><strong>Email:</strong> ${visitorData.email}</p>

      <hr>

      <p>We look forward to seeing you at the exhibition!</p>

      <p>
        Best regards,<br />
        DIEMEX Team
      </p>
    `;

    return this.sendEmail(visitorData.email, subject, html);
  }

  /**
   * Invoice email
   */
  async sendInvoiceEmail({
    to,
    invoiceNumber,
    amount,
    pdfBuffer,
    dueDate,
  }) {
    try {
      const subject = `Invoice ${invoiceNumber} from DIEMEX Exhibition`;

      const html = `
        <!DOCTYPE html>
        <html>
        <body style="font-family:Arial,sans-serif;">

          <div style="max-width:600px;margin:auto;">

            <h1>DIEMEX Exhibition</h1>

            <h2>Invoice ${invoiceNumber}</h2>

            <p>Dear Exhibitor,</p>

            <p>
              Please find your invoice attached.
            </p>

            <hr />

            <p>
              <strong>Invoice Number:</strong>
              ${invoiceNumber}
            </p>

            <p>
              <strong>Amount:</strong>
              ₹${amount.toLocaleString()}
            </p>

            <p>
              <strong>Due Date:</strong>
              ${new Date(dueDate).toLocaleDateString("en-IN")}
            </p>

            <hr />

            <p>
              Best regards,<br />
              DIEMEX Team
            </p>

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
        },
      });
    } catch (error) {
      console.error("❌ Failed to send invoice email:", error);

      throw error;
    }
  }

  /**
   * Test Resend config
   */
  async testConnection() {
    if (
      !process.env.RESEND_API_KEY ||
      !process.env.RESEND_FROM
    ) {
      throw new Error(
        "Resend environment variables missing"
      );
    }

    console.log("✅ Resend configuration OK");
    console.log(`📧 From: ${process.env.RESEND_FROM}`);

    return true;
  }
}

module.exports = new EmailService();