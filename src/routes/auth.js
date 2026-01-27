const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const { authenticate } = require('../middleware/auth');
const { body } = require('express-validator');

// Validation middleware
const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().trim()
];

const validateRegister = [
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
];

// Routes (these are now handled by users.js, but keeping for backward compatibility)
router.post('/login', validateLogin, AuthController.login);
router.post('/register', validateRegister, AuthController.register);
router.post('/logout', authenticate, AuthController.logout);
router.post('/refresh-token', authenticate, AuthController.refreshToken);

module.exports = router;