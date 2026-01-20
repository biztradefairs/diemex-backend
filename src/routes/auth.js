// src/routes/auth.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/AuthController');

// Validation middleware
const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

const validateRegister = [
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
];

// Routes
router.post('/login', validateLogin, authController.login);
router.post('/register', validateRegister, authController.register);
router.post('/logout', authController.logout);
router.post('/refresh-token', authController.refreshToken);

module.exports = router;