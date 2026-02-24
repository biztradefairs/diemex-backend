const express = require('express');
const router = express.Router();
const emailService = require('../services/EmailService');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

// Store OTPs temporarily (in production, use Redis or database)
const otpStore = new Map();

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP to visitor email
router.post('/send-otp', [
  body('email').isEmail().normalizeEmail(),
  body('name').notEmpty().trim(),
  body('mobile').notEmpty(),
  body('company').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { email, name, mobile, company } = req.body;
    
    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with expiration (5 minutes)
    otpStore.set(email, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      data: { name, mobile, company }
    });

    // Send OTP via email
    const subject = 'Your Verification Code for Exhibition Registration';
    const html = `
      <h2>Email Verification</h2>
      <p>Dear ${name},</p>
      <p>Thank you for registering for the exhibition. Please use the following verification code to complete your registration:</p>
      <h1 style="font-size: 32px; letter-spacing: 5px; background: #f0f0f0; padding: 10px; text-align: center;">${otp}</h1>
      <p>This code will expire in 5 minutes.</p>
      <p><strong>Registration Details:</strong></p>
      <ul>
        <li><strong>Name:</strong> ${name}</li>
        <li><strong>Company:</strong> ${company}</li>
        <li><strong>Mobile:</strong> ${mobile}</li>
        <li><strong>Email:</strong> ${email}</li>
      </ul>
      <p>If you didn't request this verification, please ignore this email.</p>
      <p>Best regards,<br/>Exhibition Team</p>
    `;

    await emailService.sendEmail(email, subject, html);

    res.json({
      success: true,
      message: 'OTP sent successfully',
      expiresIn: 300 // 5 minutes in seconds
    });

  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send OTP' 
    });
  }
});

// Verify OTP and complete registration
router.post('/verify-otp', [
  body('email').isEmail().normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 }).isNumeric(),
  body('name').notEmpty().trim(),
  body('designation').notEmpty().trim(),
  body('company').notEmpty().trim(),
  body('address').notEmpty().trim(),
  body('country').notEmpty().trim(),
  body('state').notEmpty().trim(),
  body('city').notEmpty().trim(),
  body('pinCode').notEmpty().trim(),
  body('mobile').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { email, otp, ...visitorData } = req.body;

    // Check OTP
    const storedData = otpStore.get(email);
    
    if (!storedData) {
      return res.status(400).json({ 
        success: false, 
        error: 'No OTP found for this email. Please request a new one.' 
      });
    }

    if (storedData.expiresAt < Date.now()) {
      otpStore.delete(email);
      return res.status(400).json({ 
        success: false, 
        error: 'OTP has expired. Please request a new one.' 
      });
    }

    if (storedData.otp !== otp) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid OTP. Please try again.' 
      });
    }

    // Clear OTP
    otpStore.delete(email);

    // Save visitor registration to database (you'll need to create a Visitor model)
    // For now, we'll just log and send confirmation emails

    console.log('[v0] Registration successful:', {
      ...visitorData,
      email,
      registeredAt: new Date().toISOString()
    });

    // Send confirmation email to visitor
    const visitorSubject = 'Registration Confirmed - Exhibition';
    const visitorHtml = `
      <h2>Registration Confirmed!</h2>
      <p>Dear ${visitorData.name},</p>
      <p>Thank you for registering for the exhibition. Your registration has been confirmed.</p>
      <hr>
      <h3>Registration Details:</h3>
      <ul>
        <li><strong>Name:</strong> ${visitorData.name}</li>
        <li><strong>Designation:</strong> ${visitorData.designation}</li>
        <li><strong>Company:</strong> ${visitorData.company}</li>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Mobile:</strong> ${visitorData.mobile}</li>
        <li><strong>Address:</strong> ${visitorData.address}, ${visitorData.city}, ${visitorData.state}, ${visitorData.country} - ${visitorData.pinCode}</li>
      </ul>
      <hr>
      <p>We look forward to seeing you at the event!</p>
      <p>Best regards,<br/>Exhibition Team</p>
    `;

    await emailService.sendEmail(email, visitorSubject, visitorHtml);

    // If company name matches an exhibitor, send notification to exhibitor
    const modelFactory = require('../models');
    const Exhibitor = modelFactory.getModel('Exhibitor');
    
    const exhibitor = await Exhibitor.findOne({
      where: { company: visitorData.company }
    });

    if (exhibitor) {
      const exhibitorSubject = 'New Visitor Registration for Your Exhibition';
      const exhibitorHtml = `
        <h2>New Visitor Registration</h2>
        <p>Dear ${exhibitor.name},</p>
        <p>A new visitor has registered for your exhibition:</p>
        <hr>
        <h3>Visitor Details:</h3>
        <ul>
          <li><strong>Name:</strong> ${visitorData.name}</li>
          <li><strong>Designation:</strong> ${visitorData.designation}</li>
          <li><strong>Company:</strong> ${visitorData.company}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Mobile:</strong> ${visitorData.mobile}</li>
        </ul>
        <hr>
        <p>Please contact them for further communication.</p>
        <p>Best regards,<br/>Exhibition Team</p>
      `;

      await emailService.sendEmail(exhibitor.email, exhibitorSubject, exhibitorHtml);
    }

    res.json({
      success: true,
      message: 'Registration completed successfully',
      data: {
        name: visitorData.name,
        email: email,
        company: visitorData.company
      }
    });

  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to complete registration' 
    });
  }
});

// Resend OTP
router.post('/resend-otp', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const { email } = req.body;

    // Check if there's existing OTP data
    const existingData = otpStore.get(email);
    
    if (!existingData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please start registration first' 
      });
    }

    // Generate new OTP
    const newOtp = generateOTP();
    
    // Update store
    otpStore.set(email, {
      ...existingData,
      otp: newOtp,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    // Send new OTP
    const subject = 'New Verification Code for Exhibition Registration';
    const html = `
      <h2>New Verification Code</h2>
      <p>Dear ${existingData.data.name},</p>
      <p>Here is your new verification code:</p>
      <h1 style="font-size: 32px; letter-spacing: 5px; background: #f0f0f0; padding: 10px; text-align: center;">${newOtp}</h1>
      <p>This code will expire in 5 minutes.</p>
      <p>Best regards,<br/>Exhibition Team</p>
    `;

    await emailService.sendEmail(email, subject, html);

    res.json({
      success: true,
      message: 'New OTP sent successfully'
    });

  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to resend OTP' 
    });
  }
});

module.exports = router;