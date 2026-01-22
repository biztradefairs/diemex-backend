// src/routes/exhibitorAuth.js
const express = require('express');
const router = express.Router();
const exhibitorAuthController = require('../controllers/ExhibitorAuthController');
const { authenticateExhibitor } = require('../middleware/auth');
const { body } = require('express-validator');

// Validation middleware
const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

const validateForgotPassword = [
  body('email').isEmail().normalizeEmail()
];

const validateResetPassword = [
  body('token').notEmpty(),
  body('password').isLength({ min: 6 })
];

const validateChangePassword = [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
];

// Public routes
router.post('/login', validateLogin, exhibitorAuthController.login);
router.post('/forgot-password', validateForgotPassword, exhibitorAuthController.forgotPassword);
router.post('/reset-password', validateResetPassword, exhibitorAuthController.resetPassword);

// Protected routes
router.use(authenticateExhibitor);

router.get('/profile', exhibitorAuthController.getProfile);
router.put('/profile', exhibitorAuthController.updateProfile);
router.post('/change-password', validateChangePassword, exhibitorAuthController.changePassword);

module.exports = router;