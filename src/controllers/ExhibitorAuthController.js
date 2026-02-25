const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const emailService = require('../services/EmailService');

class ExhibitorAuthController {
  // Enhanced login with debugging
  async login(req, res) {
    try {
      console.log('\n🔐 LOGIN ATTEMPT - ENHANCED');
      console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
      
      const { email, password } = req.body;
      
      if (!email || !password) {
        console.log('❌ Missing email or password');
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
      }
      
      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      
      const cleanEmail = email.toLowerCase().trim();
      console.log('📧 Searching for email:', cleanEmail);
      
      // Find exhibitor
      const exhibitor = await Exhibitor.findOne({
        where: { email: cleanEmail }
      });
      
      if (!exhibitor) {
        console.log('❌ Exhibitor not found');
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }
      
      console.log('✅ Found exhibitor:', {
        id: exhibitor.id,
        name: exhibitor.name,
        email: exhibitor.email,
        status: exhibitor.status
      });
      
      // Check if password field exists and is valid
      if (!exhibitor.password) {
        console.log('❌ No password field in exhibitor record');
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }
      
      console.log('🔑 Stored password hash (first 30 chars):', exhibitor.password.substring(0, 30));
      console.log('🔑 Hash length:', exhibitor.password.length);
      console.log('🔄 Comparing password...');
      
      // Check password using bcrypt directly
      const isValid = await bcrypt.compare(password, exhibitor.password);
      console.log('🔑 Password comparison result:', isValid);
      
      if (!isValid) {
        console.log('❌ Password comparison failed');
        
        // Check metadata for original password
        if (exhibitor.metadata) {
          try {
            const metadata = typeof exhibitor.metadata === 'string' 
              ? JSON.parse(exhibitor.metadata) 
              : exhibitor.metadata;
            
            console.log('📝 Metadata found:', metadata);
            
            if (metadata.originalPassword) {
              console.log('🔍 Original password from metadata:', metadata.originalPassword);
              console.log('🔍 Testing with original password...');
              const checkWithOriginal = await bcrypt.compare(metadata.originalPassword, exhibitor.password);
              console.log('🔑 Check with original password:', checkWithOriginal);
              
              // If original password works, use it
              if (checkWithOriginal) {
                console.log('ℹ️ Original password from metadata works');
                // Continue with login
              }
            }
          } catch (metaError) {
            console.log('⚠️ Could not parse metadata:', metaError.message);
          }
        }
        
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }
      
      // Check account status
      const status = exhibitor.status?.toLowerCase();
      console.log('📊 Account status:', status);
      
      if (!['approved', 'active'].includes(status)) {
        return res.status(403).json({
          success: false,
          error: `Account is ${status}. Please contact administrator.`
        });
      }
      
      // Generate JWT token
      const jwtSecret = process.env.JWT_SECRET || 'exhibitor-secret-key-change-in-production';
      const token = jwt.sign(
        {
          id: exhibitor.id,
          email: exhibitor.email,
          company: exhibitor.company,
          name: exhibitor.name,
          role: 'exhibitor',
          status: exhibitor.status
        },
        jwtSecret,
        { expiresIn: '7d' }
      );
      
      // Update last login
      await exhibitor.update({ lastLogin: new Date() });
      
      // Prepare response
      const frontendStatus = exhibitor.status === 'approved' ? 'active' : exhibitor.status;
      
      const responseData = {
        token,
        exhibitor: {
          id: exhibitor.id,
          name: exhibitor.name,
          email: exhibitor.email,
          phone: exhibitor.phone,
          company: exhibitor.company,
          sector: exhibitor.sector,
          booth: exhibitor.boothNumber,
          status: frontendStatus,
          createdAt: exhibitor.createdAt
        }
      };
      
      console.log('🎉 Login successful!');
      
      res.json({
        success: true,
        data: responseData,
        message: 'Login successful'
      });
      
    } catch (error) {
      console.error('🔥 Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Request password reset (forgot password)
   * POST /api/auth/exhibitor/forgot-password
   */
  async forgotPassword(req, res) {
    try {
      console.log('\n🔐 PASSWORD RESET REQUEST');
      console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
      
      const { email, captchaToken } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required'
        });
      }

      // Verify reCAPTCHA if enabled
      if (captchaToken && process.env.RECAPTCHA_SECRET_KEY) {
        try {
          const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${captchaToken}`
          });
          const recaptchaData = await recaptchaResponse.json();
          
          if (!recaptchaData.success) {
            console.log('❌ reCAPTCHA verification failed:', recaptchaData);
            return res.status(400).json({
              success: false,
              error: 'reCAPTCHA verification failed'
            });
          }
          console.log('✅ reCAPTCHA verified successfully');
        } catch (recaptchaError) {
          console.error('❌ reCAPTCHA error:', recaptchaError);
          // Continue without reCAPTCHA if it fails (optional)
        }
      }

      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      
      const cleanEmail = email.toLowerCase().trim();
      console.log('📧 Searching for exhibitor with email:', cleanEmail);
      
      // Find exhibitor by email
      const exhibitor = await Exhibitor.findOne({
        where: { email: cleanEmail }
      });

      // Always return success (security best practice - don't reveal if email exists)
      if (!exhibitor) {
        console.log('❌ Exhibitor not found, but returning success for security');
        return res.json({
          success: true,
          message: 'If your email is registered, you will receive a password reset link'
        });
      }

      console.log('✅ Exhibitor found:', {
        id: exhibitor.id,
        name: exhibitor.name,
        email: exhibitor.email,
        status: exhibitor.status
      });

      // Generate reset token (valid for 1 hour)
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

      console.log('🔑 Reset token generated:', resetToken.substring(0, 20) + '...');
      console.log('⏰ Token expires:', resetTokenExpiry);

      // Save token to exhibitor record
      await exhibitor.update({
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetTokenExpiry
      });

      // Create reset URL
      const frontendUrl = process.env.FRONTEND_URL || 'https://dimex-ruby.vercel.app/';
      const resetUrl = `${frontendUrl}/forgot-password/${resetToken}`;

      console.log('🔗 Reset URL:', resetUrl);

      // Send email using your email service
      try {
        const emailResult = await emailService.sendPasswordResetEmail(
          exhibitor.email,
          exhibitor.name || exhibitor.companyName || 'Exhibitor',
          resetUrl
        );

        if (!emailResult.success) {
          console.error('❌ Failed to send password reset email:', emailResult.error);
          // Don't fail the request, but log it
        } else {
          console.log('✅ Password reset email sent successfully to:', exhibitor.email);
        }
      } catch (emailError) {
        console.error('❌ Email service error:', emailError);
        // Still return success to user for security
      }

      res.json({
        success: true,
        message: 'Password reset link sent to your email'
      });

    } catch (error) {
      console.error('❌ Forgot password error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process password reset request'
      });
    }
  }

  /**
   * Reset password with token
   * POST /api/auth/exhibitor/reset-password-with-token
   */
  async resetPasswordWithToken(req, res) {
    try {
      console.log('\n🔄 RESET PASSWORD WITH TOKEN');
      console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
      
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({
          success: false,
          error: 'Token and password are required'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 6 characters'
        });
      }

      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      const { Op } = require('sequelize');

      // Find exhibitor with valid token
      const exhibitor = await Exhibitor.findOne({
        where: {
          resetPasswordToken: token,
          resetPasswordExpires: { [Op.gt]: new Date() }
        }
      });

      if (!exhibitor) {
        console.log('❌ Invalid or expired token:', token.substring(0, 20) + '...');
        return res.status(400).json({
          success: false,
          error: 'Password reset token is invalid or has expired'
        });
      }

      console.log('✅ Valid token found for exhibitor:', exhibitor.email);

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update exhibitor
      await exhibitor.update({
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null
      });

      console.log('✅ Password updated successfully for:', exhibitor.email);

      // Send confirmation email
      try {
        await emailService.sendPasswordResetConfirmation(
          exhibitor.email,
          exhibitor.name || exhibitor.companyName || 'Exhibitor'
        );
        console.log('✅ Confirmation email sent');
      } catch (emailError) {
        console.error('❌ Failed to send confirmation email:', emailError);
        // Don't fail the request
      }

      res.json({
        success: true,
        message: 'Password reset successful'
      });

    } catch (error) {
      console.error('❌ Reset password error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset password'
      });
    }
  }

  /**
   * Validate reset token
   * GET /api/auth/exhibitor/validate-reset-token/:token
   */
  async validateResetToken(req, res) {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Token is required'
        });
      }

      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      const { Op } = require('sequelize');

      const exhibitor = await Exhibitor.findOne({
        where: {
          resetPasswordToken: token,
          resetPasswordExpires: { [Op.gt]: new Date() }
        },
        attributes: ['id', 'email', 'name']
      });

      if (!exhibitor) {
        return res.status(400).json({
          success: false,
          error: 'Token is invalid or has expired'
        });
      }

      res.json({
        success: true,
        message: 'Token is valid',
        data: {
          email: exhibitor.email,
          name: exhibitor.name
        }
      });

    } catch (error) {
      console.error('❌ Token validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate token'
      });
    }
  }

  // Reset password endpoint (existing)
  async resetPassword(req, res) {
    try {
      const { email, newPassword } = req.body;
      
      console.log('\n🔄 RESET PASSWORD - USING MODEL HOOK');
      
      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      
      const exhibitor = await Exhibitor.findOne({
        where: { email: email.toLowerCase().trim() }
      });
      
      if (!exhibitor) {
        return res.status(404).json({
          success: false,
          error: 'Exhibitor not found'
        });
      }
      
      console.log('📝 Before update - current hash:', exhibitor.password?.substring(0, 30));
      
      // Update with _originalPassword so hook can store it
      await exhibitor.update({
        password: newPassword, // Pass plain password, let hook hash it
        _originalPassword: newPassword // For metadata
      });
      
      // Refresh to get updated data
      await exhibitor.reload();
      
      console.log('📝 After update - new hash:', exhibitor.password?.substring(0, 30));
      
      // Verify
      const isValid = await bcrypt.compare(newPassword, exhibitor.password);
      
      console.log('✅ Password verification:', isValid);
      
      res.json({
        success: true,
        message: 'Password reset successfully',
        data: {
          email: exhibitor.email,
          verified: isValid,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('Reset error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Direct fix password endpoint (uses raw SQL)
  async fixPasswordDirect(req, res) {
    try {
      const { email, password } = req.body;
      
      console.log('\n🔧 FIXING PASSWORD DIRECTLY FOR:', email);
      
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
      }
      
      const sequelize = require('../config/database').getConnection('mysql');
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Direct SQL update to bypass any hooks
      const query = `
        UPDATE exhibitors 
        SET password = ?, 
            metadata = JSON_SET(
              COALESCE(metadata, '{}'),
              '$.originalPassword', ?,
              '$.fixedAt', NOW(),
              '$.fixedBy', 'direct-fix'
            ),
            updatedAt = NOW()
        WHERE email = ?
      `;
      
      const [result] = await sequelize.query(query, {
        replacements: [hashedPassword, password, email.toLowerCase().trim()]
      });
      
      console.log('✅ Direct fix completed, affected rows:', result.affectedRows);
      
      res.json({
        success: true,
        message: 'Password fixed directly via SQL',
        data: {
          email: email,
          password: password,
          affectedRows: result.affectedRows,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('Direct fix error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Test body parsing
  async testBodyParsing(req, res) {
    try {
      console.log('\n🧪 TESTING BODY PARSING');
      console.log('📦 Request body:', req.body);
      console.log('📦 Body type:', typeof req.body);
      console.log('📦 Body keys:', Object.keys(req.body || {}));
      
      res.json({
        success: true,
        body: req.body,
        bodyType: typeof req.body,
        bodyKeys: Object.keys(req.body || {})
      });
      
    } catch (error) {
      console.error('Test error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get profile
  async getProfile(req, res) {
    try {
      const exhibitorId = req.user?.id;
      if (!exhibitorId) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
      }
      
      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      
      const exhibitor = await Exhibitor.findByPk(exhibitorId, {
        attributes: { exclude: ['password'] }
      });
      
      if (!exhibitor) {
        return res.status(404).json({
          success: false,
          error: 'Exhibitor not found'
        });
      }
      
      res.json({
        success: true,
        data: exhibitor
      });
    } catch (error) {
      console.error('Profile error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Simple test endpoint
  async testLogin(req, res) {
    console.log('🧪 Test login endpoint called');
    res.json({
      success: true,
      message: 'Auth endpoint is working',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new ExhibitorAuthController();