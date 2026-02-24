// routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { authenticate, authorize } = require('../middleware/auth');

// Admin/User Login with debugging
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('\n🔐 LOGIN ATTEMPT');
    console.log('📧 Email:', email);
    console.log('🔑 Password provided:', password ? 'Yes' : 'No');
    console.log('🌐 Origin:', req.get('origin'));
    console.log('🔗 URL:', req.originalUrl);

    if (!email || !password) {
      console.log('❌ Missing credentials');
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const modelFactory = require('../models');
    const User = modelFactory.getModel('User');

    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user) {
      console.log('❌ User not found in database');
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    console.log('✅ User found:', user.email);
    console.log('👤 Role:', user.role);
    console.log('🔑 Stored password hash length:', user.password.length);
    console.log('🔑 Stored password starts with:', user.password.substring(0, 10) + '...');
    console.log('🔑 Is bcrypt hash?', user.password.startsWith('$2a$') || user.password.startsWith('$2b$'));

    // Compare password using bcrypt
    const isValidPassword = await bcrypt.compare(password, user.password);

    console.log('🔐 Password valid:', isValidPassword);

    if (!isValidPassword) {
      // Check if password might be stored as plain text (debug only)
      if (password === user.password) {
        console.log('⚠️ WARNING: Password appears to be stored as plain text!');
        console.log('🔄 Attempting to fix by re-hashing...');
        
        const hashedPassword = await bcrypt.hash(password, 10);
        await user.update({ password: hashedPassword });
        console.log('✅ Password has been re-hashed');
        
        // Try again with the new hash
        const recheck = await bcrypt.compare(password, user.password);
        console.log('🔐 Re-check after rehash:', recheck);
        
        if (recheck) {
          // Proceed with login
          console.log('✅ Login successful after rehash');
        } else {
          return res.status(401).json({
            success: false,
            error: 'Invalid email or password'
          });
        }
      } else {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }
    }

    // Check if user is active
    if (user.status !== 'active') {
      console.log('❌ User not active:', user.status);
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

    console.log('✅ Login successful, token generated');

    // Return user data (without password)
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status
        }
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
router.post('/refresh-token', authenticate, async (req, res) => {
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

// Logout
router.post('/logout', authenticate, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;