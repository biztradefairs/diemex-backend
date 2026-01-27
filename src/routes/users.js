const express = require('express');
const router = express.Router();
const userController = require('../controllers/UserController');
const { authenticate, authorize } = require('../middleware/auth');
const { body } = require('express-validator');

// Validation middleware
const validateUser = [
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').optional().isLength({ min: 6 })
];

// Public routes (no authentication required)
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], userController.login);

router.post('/register', validateUser, userController.register);

// Protected routes - require authentication
router.use(authenticate);

// Profile routes (accessible by any authenticated user)
router.get('/profile/me', userController.getProfile);
router.put('/profile/me', [
  body('name').optional().trim(),
  body('phone').optional().trim()
], userController.updateProfile);
router.post('/logout', userController.logout);
router.post('/refresh-token', userController.refreshToken);

// Admin-only routes (require admin role)
router.get('/', authorize(['admin']), userController.getAllUsers);
router.get('/:id', authorize(['admin']), userController.getUser);
router.post('/', authorize(['admin']), validateUser, userController.register);
router.put('/:id', authorize(['admin']), userController.updateUser);
router.delete('/:id', authorize(['admin']), userController.deleteUser);

module.exports = router;