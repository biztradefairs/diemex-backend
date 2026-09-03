const express = require('express');
const { body, param, validationResult } = require('express-validator');
const passService = require('../services/PassService');

const router = express.Router();

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: errors.array()[0]?.msg || 'Invalid request',
      errors: errors.array()
    });
  }
  return null;
}

function handleError(res, error) {
  const status = error.status || 500;
  return res.status(status).json({
    success: false,
    error: error.message || 'Something went wrong',
    ...(error.resendIn ? { resendIn: error.resendIn } : {})
  });
}

router.post(
  '/send-otp',
  [
    body('countryCode').notEmpty().withMessage('Country code is required'),
    body('mobile').notEmpty().withMessage('Mobile number is required'),
    body('channel').isIn(['sms', 'whatsapp']).withMessage('Choose SMS or WhatsApp')
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;
    try {
      const result = await passService.sendOtp({
        countryCode: req.body.countryCode,
        nationalNumber: req.body.mobile,
        channel: req.body.channel
      });
      res.json(result);
    } catch (error) {
      handleError(res, error);
    }
  }
);

router.post(
  '/resend-otp',
  [
    body('countryCode').notEmpty().withMessage('Country code is required'),
    body('mobile').notEmpty().withMessage('Mobile number is required'),
    body('channel').isIn(['sms', 'whatsapp']).withMessage('Choose SMS or WhatsApp')
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;
    try {
      const result = await passService.sendOtp({
        countryCode: req.body.countryCode,
        nationalNumber: req.body.mobile,
        channel: req.body.channel
      });
      res.json({ ...result, message: `New OTP sent via ${req.body.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}` });
    } catch (error) {
      handleError(res, error);
    }
  }
);

router.post(
  '/verify-otp',
  [
    body('countryCode').notEmpty().withMessage('Country code is required'),
    body('mobile').notEmpty().withMessage('Mobile number is required'),
    body('otp').isLength({ min: 4, max: 4 }).withMessage('Enter the 4-digit OTP').isNumeric()
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;
    try {
      const result = await passService.verifyOtp({
        countryCode: req.body.countryCode,
        nationalNumber: req.body.mobile,
        otp: req.body.otp
      });
      res.json(result);
    } catch (error) {
      handleError(res, error);
    }
  }
);

router.post(
  '/register',
  [
    body('verificationToken').notEmpty().withMessage('Verification token is required'),
    body('name').trim().notEmpty().withMessage('Full name is required'),
    body('company').trim().notEmpty().withMessage('Company name is required'),
    body('interests').isArray({ min: 1 }).withMessage('Select at least one interest')
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;
    try {
      const { verificationToken, ...payload } = req.body;
      const result = await passService.completeRegistration({ verificationToken, payload });
      res.json(result);
    } catch (error) {
      handleError(res, error);
    }
  }
);

router.post(
  '/resend-pass',
  async (req, res) => {
    try {
      const result = await passService.resendPass({
        verificationToken: req.body.verificationToken,
        publicCode: req.body.publicCode,
        channel: req.body.channel
      });
      res.json(result);
    } catch (error) {
      handleError(res, error);
    }
  }
);

router.get(
  '/:code',
  [param('code').notEmpty()],
  async (req, res) => {
    try {
      const pass = await passService.getPassByCode(req.params.code);
      res.json({ success: true, pass });
    } catch (error) {
      handleError(res, error);
    }
  }
);

router.post(
  '/check-in',
  [body('code').notEmpty().withMessage('Pass code is required')],
  async (req, res) => {
    if (handleValidation(req, res)) return;
    try {
      const result = await passService.checkIn(req.body.code);
      res.json(result);
    } catch (error) {
      handleError(res, error);
    }
  }
);

module.exports = router;
