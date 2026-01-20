// src/routes/users.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/UserController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get all users (admin only)
router.get('/', authorize(['admin']), userController.getAllUsers);

// Get single user
router.get('/:id', authorize(['admin']), userController.getUser);

// Create user (admin only)
router.post('/', authorize(['admin']), userController.register);

// Update user (admin or self)
router.put('/:id', authorize(['admin']), userController.updateUser);

// Delete user (admin only)
router.delete('/:id', authorize(['admin']), userController.deleteUser);

// Profile routes
router.get('/profile/me', userController.getProfile);
router.put('/profile/me', userController.updateProfile);

module.exports = router;