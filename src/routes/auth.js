// routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { authenticate, authorize } = require('../middleware/auth');

// Admin/User Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    console.log(`🔐 Login attempt for: ${email}`);

    const modelFactory = require('../models');
    const User = modelFactory.getModel('User');

    // Find user by email
    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user) {
      console.log('❌ User not found');
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    console.log(`✅ User found: ${user.email}`);
    console.log(`👤 Role: ${user.role}`);
    console.log(`🔑 Stored password hash: ${user.password.substring(0, 20)}...`);

    // Compare password using bcrypt
    const isValidPassword = await bcrypt.compare(password, user.password);

    console.log(`🔐 Password valid: ${isValidPassword}`);

    if (!isValidPassword) {
      // For debugging - DO NOT USE IN PRODUCTION
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Attempted password:', password);
        // Test if the password might be stored as plain text
        const isPlainTextMatch = password === user.password;
        if (isPlainTextMatch) {
          console.log('⚠️ WARNING: Password appears to be stored as plain text!');
        }
      }

      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Account is not active'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '7d' }
    );

    // Remove sensitive data
    const userData = user.toJSON();
    delete userData.password;
    delete userData.resetPasswordToken;
    delete userData.resetPasswordExpires;

    console.log(`✅ Login successful for: ${email}`);

    res.json({
      success: true,
      data: {
        token,
        user: userData
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get current user profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const modelFactory = require('../models');
    const User = modelFactory.getModel('User');

    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires'] }
    });

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
});

// Refresh token
router.post('/refresh', authenticate, async (req, res) => {
  try {
    const newToken = jwt.sign(
      {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: { token: newToken }
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh token'
    });
  }
});

// Logout (optional - client side just discards token)
router.post('/logout', authenticate, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Change password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    const modelFactory = require('../models');
    const User = modelFactory.getModel('User');

    const user = await User.findByPk(req.user.id);

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await user.update({ password: hashedPassword });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
});

// Forgot password (optional)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const modelFactory = require('../models');
    const User = modelFactory.getModel('User');
    const crypto = require('crypto');

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Save to user (you'll need to add these fields to your model)
    await user.update({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: new Date(Date.now() + 3600000) // 1 hour
    });

    // TODO: Send email with reset link
    // const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    res.json({
      success: true,
      message: 'Password reset email sent'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process request'
    });
  }
});

// Reset password (optional)
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const crypto = require('crypto');

    const resetTokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const modelFactory = require('../models');
    const User = modelFactory.getModel('User');

    const user = await User.findOne({
      where: {
        resetPasswordToken: resetTokenHash,
        resetPasswordExpires: { [require('sequelize').Op.gt]: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset fields
    await user.update({
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null
    });

    res.json({
      success: true,
      message: 'Password reset successful'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password'
    });
  }
});

module.exports = router;