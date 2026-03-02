// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/UserController');
const { authenticate, authorize, hasPermission, isOwner } = require('../middleware/auth');
const { body } = require('express-validator');

// Validation middleware
const validateUser = [
  body('name').notEmpty().withMessage('Name is required').trim(),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['admin', 'editor', 'viewer']).withMessage('Invalid role'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status')
];

// Public routes (no authentication required)
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], userController.login);

router.post('/register', validateUser, userController.register);

router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], userController.forgotPassword);

router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 6 })
], userController.resetPassword);

// ==================== PROTECTED ROUTES ====================
router.use(authenticate);

// Profile routes - accessible by any authenticated user
router.get('/profile/me', userController.getProfile);
router.put('/profile/me', [
  body('name').optional().trim(),
  body('phone').optional().trim()
], userController.updateProfile);
router.post('/logout', userController.logout);
router.post('/refresh-token', userController.refreshToken);
router.post('/change-password', [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], userController.changePassword);

// ==================== ADMIN ONLY ROUTES ====================
// User management - full CRUD for admins only
router.get('/',
  authorize('admin'),
  userController.getAllUsers
);

router.get('/stats',
  authorize('admin'),
  userController.getUserStats
);

router.get('/:id',
  authorize('admin'),
  userController.getUser
);

router.post('/',
  authorize('admin'),
  validateUser,
  userController.register
);

router.put('/:id',
  authorize('admin'),
  validateUser,
  userController.updateUser
);

router.delete('/:id',
  authorize('admin'),
  userController.deleteUser
);

router.patch('/:id/status',
  authorize('admin'),
  userController.toggleUserStatus
);

router.post('/:id/reset-password',
  authorize('admin'),
  userController.adminResetPassword
);

// ==================== EDITOR ROUTES ====================
// Editors can view users but not modify them
router.get('/editors/view',
  authorize('editor', 'admin'),
  hasPermission('users', 'read'),
  userController.getAllUsers
);

// ==================== VIEWER ROUTES ====================
// Viewers have very limited access
router.get('/viewers/profile/:id',
  authorize('viewer', 'editor', 'admin'),
  isOwner('id'),
  userController.getUser
);

module.exports = router;