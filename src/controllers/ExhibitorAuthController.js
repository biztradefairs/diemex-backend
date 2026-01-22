// src/controllers/ExhibitorAuthController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailService = require('../services/EmailService');

class ExhibitorAuthController {
  async login(req, res) {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
      }

      // Get exhibitor model
      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      
      // Find exhibitor by email
      let exhibitor;
      if (process.env.DB_TYPE === 'mysql') {
        exhibitor = await Exhibitor.findOne({ where: { email } });
      } else {
        exhibitor = await Exhibitor.findOne({ email });
      }
      
      if (!exhibitor) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Check if exhibitor is active
      if (exhibitor.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: 'Account is not active. Please contact administrator.'
        });
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, exhibitor.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Update last login
      exhibitor.lastLogin = new Date();
      if (process.env.DB_TYPE === 'mysql') {
        await exhibitor.save();
      } else {
        await Exhibitor.findByIdAndUpdate(exhibitor._id, { lastLogin: new Date() });
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          id: exhibitor.id,
          email: exhibitor.email,
          company: exhibitor.company,
          role: 'exhibitor'
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Send notification
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendAuditLog('EXHIBITOR_LOGIN', exhibitor.id, {
          company: exhibitor.company,
          email: exhibitor.email
        });
      } catch (kafkaError) {
        console.warn('Kafka not available:', kafkaError.message);
      }

      res.json({
        success: true,
        data: {
          token,
          exhibitor: {
            id: exhibitor.id,
            name: exhibitor.name,
            email: exhibitor.email,
            company: exhibitor.company,
            phone: exhibitor.phone,
            boothNumber: exhibitor.boothNumber,
            stallDetails: exhibitor.stallDetails
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required'
        });
      }

      // Get exhibitor model
      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      
      // Find exhibitor by email
      let exhibitor;
      if (process.env.DB_TYPE === 'mysql') {
        exhibitor = await Exhibitor.findOne({ where: { email } });
      } else {
        exhibitor = await Exhibitor.findOne({ email });
      }
      
      if (!exhibitor) {
        // For security, don't reveal if email exists
        return res.json({
          success: true,
          message: 'If an account exists with this email, you will receive a password reset link'
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
      
      // Set token expiration (1 hour)
      const resetPasswordExpires = new Date(Date.now() + 3600000);
      
      // Update exhibitor
      if (process.env.DB_TYPE === 'mysql') {
        await Exhibitor.update(
          {
            resetPasswordToken: resetTokenHash,
            resetPasswordExpires
          },
          { where: { id: exhibitor.id } }
        );
      } else {
        await Exhibitor.findByIdAndUpdate(exhibitor._id, {
          resetPasswordToken: resetTokenHash,
          resetPasswordExpires
        });
      }

      // Send reset email
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
      
      await emailService.sendPasswordResetExhibitor(exhibitor, resetUrl);

      // Send audit log
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendAuditLog('EXHIBITOR_PASSWORD_RESET_REQUEST', exhibitor.id, {
          company: exhibitor.company,
          email: exhibitor.email
        });
      } catch (kafkaError) {
        console.warn('Kafka not available:', kafkaError.message);
      }

      res.json({
        success: true,
        message: 'Password reset link sent to email'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async resetPassword(req, res) {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({
          success: false,
          error: 'Token and password are required'
        });
      }

      // Hash the token
      const resetTokenHash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
      
      // Get exhibitor model
      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      
      // Find exhibitor by reset token
      let exhibitor;
      if (process.env.DB_TYPE === 'mysql') {
        exhibitor = await Exhibitor.findOne({
          where: {
            resetPasswordToken: resetTokenHash,
            resetPasswordExpires: { [require('sequelize').Op.gt]: new Date() }
          }
        });
      } else {
        exhibitor = await Exhibitor.findOne({
          resetPasswordToken: resetTokenHash,
          resetPasswordExpires: { $gt: new Date() }
        });
      }
      
      if (!exhibitor) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired token'
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Update exhibitor
      if (process.env.DB_TYPE === 'mysql') {
        await Exhibitor.update(
          {
            password: hashedPassword,
            resetPasswordToken: null,
            resetPasswordExpires: null
          },
          { where: { id: exhibitor.id } }
        );
      } else {
        await Exhibitor.findByIdAndUpdate(exhibitor._id, {
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpires: null
        });
      }

      // Send confirmation email
      await emailService.sendPasswordResetConfirmation(exhibitor);

      // Send audit log
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendAuditLog('EXHIBITOR_PASSWORD_RESET', exhibitor.id, {
          company: exhibitor.company,
          email: exhibitor.email
        });
      } catch (kafkaError) {
        console.warn('Kafka not available:', kafkaError.message);
      }

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const exhibitorId = req.user.id;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current and new passwords are required'
        });
      }

      // Get exhibitor model
      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      
      // Find exhibitor
      let exhibitor;
      if (process.env.DB_TYPE === 'mysql') {
        exhibitor = await Exhibitor.findByPk(exhibitorId);
      } else {
        exhibitor = await Exhibitor.findById(exhibitorId);
      }
      
      if (!exhibitor) {
        return res.status(404).json({
          success: false,
          error: 'Exhibitor not found'
        });
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, exhibitor.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Current password is incorrect'
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update exhibitor
      if (process.env.DB_TYPE === 'mysql') {
        await exhibitor.update({ password: hashedPassword });
      } else {
        await Exhibitor.findByIdAndUpdate(exhibitorId, { password: hashedPassword });
      }

      // Send audit log
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendAuditLog('EXHIBITOR_PASSWORD_CHANGED', exhibitorId, {
          company: exhibitor.company,
          email: exhibitor.email
        });
      } catch (kafkaError) {
        console.warn('Kafka not available:', kafkaError.message);
      }

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getProfile(req, res) {
    try {
      const exhibitorId = req.user.id;
      
      // Get exhibitor model
      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      
      // Find exhibitor
      let exhibitor;
      if (process.env.DB_TYPE === 'mysql') {
        exhibitor = await Exhibitor.findByPk(exhibitorId);
      } else {
        exhibitor = await Exhibitor.findById(exhibitorId);
      }
      
      if (!exhibitor) {
        return res.status(404).json({
          success: false,
          error: 'Exhibitor not found'
        });
      }

      // Don't send password
      exhibitor.password = undefined;
      exhibitor.resetPasswordToken = undefined;
      exhibitor.resetPasswordExpires = undefined;

      res.json({
        success: true,
        data: exhibitor
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateProfile(req, res) {
    try {
      const exhibitorId = req.user.id;
      const updateData = req.body;
      
      // Remove sensitive fields
      delete updateData.password;
      delete updateData.resetPasswordToken;
      delete updateData.resetPasswordExpires;
      delete updateData.id;
      delete updateData._id;

      // Get exhibitor model
      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      
      // Update exhibitor
      let exhibitor;
      if (process.env.DB_TYPE === 'mysql') {
        exhibitor = await Exhibitor.findByPk(exhibitorId);
        if (!exhibitor) {
          return res.status(404).json({
            success: false,
            error: 'Exhibitor not found'
          });
        }
        await exhibitor.update(updateData);
      } else {
        exhibitor = await Exhibitor.findByIdAndUpdate(
          exhibitorId,
          updateData,
          { new: true, runValidators: true }
        );
        if (!exhibitor) {
          return res.status(404).json({
            success: false,
            error: 'Exhibitor not found'
          });
        }
      }

      // Send audit log
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendAuditLog('EXHIBITOR_PROFILE_UPDATED', exhibitorId, {
          company: exhibitor.company,
          updatedFields: Object.keys(updateData)
        });
      } catch (kafkaError) {
        console.warn('Kafka not available:', kafkaError.message);
      }

      // Don't send password
      exhibitor.password = undefined;
      exhibitor.resetPasswordToken = undefined;
      exhibitor.resetPasswordExpires = undefined;

      res.json({
        success: true,
        data: exhibitor,
        message: 'Profile updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new ExhibitorAuthController();