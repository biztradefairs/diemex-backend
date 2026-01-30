const exhibitorService = require('../services/ExhibitorService');

class ExhibitorController {
   async createExhibitor(req, res) {
    try {
      console.log('\n🎯 CREATE EXHIBITOR REQUEST');
      console.log('Data:', JSON.stringify(req.body, null, 2));
      
      const data = req.body;
      
      // Check required fields
      const requiredFields = ['name', 'email', 'password', 'company'];
      const missingFields = requiredFields.filter(field => !data[field]);
      
      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`
        });
      }
      
      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format'
        });
      }
      
      // Check if email already exists
      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      const existingExhibitor = await Exhibitor.findOne({
        where: { email: data.email.toLowerCase().trim() }
      });
      
      if (existingExhibitor) {
        return res.status(400).json({
          success: false,
          error: 'Email already exists'
        });
      }
      
      // Store original password before hashing
      const originalPassword = data.password;
      
      // Prepare exhibitor data
      const exhibitorData = {
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        company: data.company.trim(),
        password: data.password,
        phone: data.phone || '',
        sector: data.sector || '',
        boothNumber: data.boothNumber || '',
        status: data.status || 'pending',
        originalPassword: originalPassword
      };
      
      // Save to database
      const exhibitor = await Exhibitor.create(exhibitorData);
      
      // 🔴 IMPORTANT: Send welcome email with credentials
      try {
        const emailService = require('../services/EmailService');
        await emailService.sendExhibitorWelcome(exhibitor, originalPassword);
        console.log('✅ Welcome email sent to:', exhibitor.email);
      } catch (emailError) {
        console.warn('⚠️ Failed to send welcome email:', emailError.message);
        // Don't fail the whole request if email fails
        // You might want to log this to a monitoring service
      }
      
      // Show in terminal
      console.log('\n========================================');
      console.log('✅ EXHIBITOR CREATED SUCCESSFULLY');
      console.log('========================================');
      console.log('📧 Email:', exhibitor.email);
      console.log('🔑 Original Password:', originalPassword);
      console.log('🔑 Hashed Password:', exhibitor.password?.substring(0, 20) + '...');
      console.log('🏢 Company:', exhibitor.company);
      console.log('👤 Contact:', exhibitor.name);
      console.log('📊 Status:', exhibitor.status);
      console.log('========================================\n');
      
      // Get metadata for original password
      let originalPasswordFromMetadata = null;
      if (exhibitor.metadata) {
        try {
          const metadata = JSON.parse(exhibitor.metadata);
          originalPasswordFromMetadata = metadata.originalPassword;
        } catch (error) {
          console.error('Error parsing metadata:', error);
        }
      }
      
      // Return response
      const response = exhibitor.toJSON();
      response.originalPassword = originalPasswordFromMetadata || originalPassword;
      delete response.password;
      delete response.resetPasswordToken;
      delete response.resetPasswordExpires;
      
      res.status(201).json({
        success: true,
        data: response,
        message: 'Exhibitor created successfully. Welcome email sent.'
      });
      
    } catch (error) {
      console.error('❌ Create exhibitor error:', error);
      
      let errorMessage = 'Failed to create exhibitor';
      if (error.name === 'SequelizeUniqueConstraintError') {
        errorMessage = 'Email already exists';
      } else if (error.name === 'SequelizeValidationError') {
        errorMessage = error.errors.map(e => e.message).join(', ');
      }
      
      res.status(400).json({
        success: false,
        error: errorMessage,
        details: error.errors ? error.errors.map(e => e.message) : undefined
      });
    }
  }
// Resend credentials to exhibitor
async resendCredentials(req, res) {
  try {
    const { id } = req.params;
    
    console.log('📧 Resending credentials for exhibitor:', id);
    
    const modelFactory = require('../models');
    const bcrypt = require('bcryptjs');
    const Exhibitor = modelFactory.getModel('Exhibitor');
    const emailService = require('../services/EmailService');
    
    const exhibitor = await Exhibitor.findByPk(id);
    
    if (!exhibitor) {
      return res.status(404).json({
        success: false,
        error: 'Exhibitor not found'
      });
    }
    
    // Get original password from metadata or generate new one
    let originalPassword = null;
    if (exhibitor.metadata) {
      try {
        const metadata = JSON.parse(exhibitor.metadata);
        originalPassword = metadata.originalPassword;
      } catch (error) {
        console.warn('Could not parse metadata:', error.message);
      }
    }
    
    // If no original password, generate a new one (QUICKLY)
    if (!originalPassword) {
      // Simple password generation - don't waste time
      originalPassword = Math.random().toString(36).slice(-10) + '!@#'; // Quick generation
      
      // Hash password with lower rounds for speed (development only)
      const hashedPassword = await bcrypt.hash(originalPassword, 8); // ⬅️ Lower rounds = faster
      
      // Update metadata
      let metadata = {};
      if (exhibitor.metadata) {
        try {
          metadata = JSON.parse(exhibitor.metadata);
        } catch {}
      }
      
      metadata.originalPassword = originalPassword;
      metadata.credentialsResentAt = new Date().toISOString();
      
      // Quick update - don't wait for full save
      await exhibitor.update({ 
        password: hashedPassword,
        metadata: JSON.stringify(metadata)
      }).catch(err => {
        console.warn('Update failed but continuing:', err.message);
      });
      
      console.log('🔑 Generated new password for:', exhibitor.email);
    }
    
    // Send email ASYNCHRONOUSLY - don't wait for it
    emailService.sendExhibitorWelcome(exhibitor, originalPassword)
      .then(() => {
        console.log('✅ Email sent successfully to:', exhibitor.email);
      })
      .catch(err => {
        console.warn('⚠️ Email sending failed:', err.message);
      });
    
    // Return IMMEDIATELY without waiting for email
    console.log('✅ Credentials process started for:', exhibitor.email);
    
    res.json({
      success: true,
      message: 'Credentials email process started successfully',
      data: {
        email: exhibitor.email,
        timestamp: new Date().toISOString(),
        note: 'Email is being sent in the background'
      }
    });
    
  } catch (error) {
    console.error('❌ Resend credentials error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process request: ' + error.message
    });
  }
}

async getAllExhibitors(req, res) {
  try {
    const { page = 1, limit = 10, search = '', sector = '', status = '' } = req.query;
    const modelFactory = require('../models');
    const { Op } = require('sequelize');
    const Exhibitor = modelFactory.getModel('Exhibitor');
    
    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { company: { [Op.like]: `%${search}%` } }
      ];
    }
    if (sector) where.sector = sector;
    if (status && status !== 'all') {
      // Map frontend status to database status
      const dbStatus = status === 'active' ? 'approved' : status;
      where.status = dbStatus;
    }
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    
    const { count, rows } = await Exhibitor.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [['createdAt', 'DESC']]
    });
    
    // Format response - map "approved" to "active" for frontend
    const formatted = rows.map(exhibitor => {
      const data = exhibitor.toJSON();
      
      // Get original password
      let originalPassword = null;
      if (data.metadata) {
        try {
          const metadata = JSON.parse(data.metadata);
          originalPassword = metadata.originalPassword;
        } catch {}
      }
      
      // Map database status to frontend status
      const frontendStatus = data.status === 'approved' ? 'active' : data.status;
      
      return {
        id: data.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company,
        sector: data.sector,
        booth: data.boothNumber,
        status: frontendStatus, // Use mapped status
        originalPassword: originalPassword,
        createdAt: data.createdAt
      };
    });
    
    res.json({
      success: true,
      data: formatted,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum)
      }
    });
  } catch (error) {
    console.error('Get all error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

  // Get exhibitor statistics
  async getExhibitorStats(req, res) {
    try {
      console.log('📊 Getting exhibitor statistics');
      
      const modelFactory = require('../models');
      const { Sequelize } = require('sequelize');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      
      // Get total count
      const total = await Exhibitor.count();
      
      // Get counts by status
      const byStatus = await Exhibitor.findAll({
        attributes: [
          'status',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      });
      
      // Get counts by sector
      const bySector = await Exhibitor.findAll({
        attributes: [
          'sector',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
        ],
        where: {
          sector: {
            [Sequelize.Op.ne]: null
          }
        },
        group: ['sector'],
        raw: true
      });
      
      res.json({
        success: true,
        data: {
          total,
          byStatus: byStatus.map(item => ({
            _id: item.status,
            count: item.count
          })),
          bySector: bySector.map(item => ({
            _id: item.sector,
            count: item.count
          }))
        }
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get single exhibitor
  async getExhibitor(req, res) {
    try {
      const { id } = req.params;
      console.log('Get exhibitor:', id);
      
      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      
      const exhibitor = await Exhibitor.findByPk(id);
      
      if (!exhibitor) {
        return res.status(404).json({
          success: false,
          error: 'Exhibitor not found'
        });
      }
      
      const data = exhibitor.toJSON();
      
      // Get original password from metadata
      let originalPassword = null;
      if (data.metadata) {
        try {
          const metadata = JSON.parse(data.metadata);
          originalPassword = metadata.originalPassword || null;
        } catch {
          // ignore
        }
      }
      
      // Don't show hash
      delete data.password;
      delete data.resetPasswordToken;
      delete data.resetPasswordExpires;
      data.originalPassword = originalPassword;
      
      res.json({
        success: true,
        data: data
      });
    } catch (error) {
      console.error('Get exhibitor error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

async updateExhibitor(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log('🔧 Update exhibitor:', id);
    console.log('📦 Update data:', updateData);

    const modelFactory = require('../models');
    const Exhibitor = modelFactory.getModel('Exhibitor');

    const exhibitor = await Exhibitor.findByPk(id);
    if (!exhibitor) {
      return res.status(404).json({
        success: false,
        error: 'Exhibitor not found'
      });
    }

    // MAP "active" to "approved" for database compatibility
    if (updateData.status === 'active') {
      updateData.status = 'approved';
      console.log('🔄 Mapped "active" to "approved" for database');
    }

    // Use raw SQL to avoid Sequelize issues
    const sequelize = require('../config/database').getConnection('mysql');
    
    // Build update parts
    const updates = [];
    const values = [];
    
    if (updateData.name !== undefined) {
      updates.push('name = ?');
      values.push(updateData.name);
    }
    if (updateData.email !== undefined) {
      updates.push('email = ?');
      values.push(updateData.email);
    }
    if (updateData.phone !== undefined) {
      updates.push('phone = ?');
      values.push(updateData.phone);
    }
    if (updateData.company !== undefined) {
      updates.push('company = ?');
      values.push(updateData.company);
    }
    if (updateData.sector !== undefined) {
      updates.push('sector = ?');
      values.push(updateData.sector);
    }
    if (updateData.boothNumber !== undefined) {
      updates.push('boothNumber = ?');
      values.push(updateData.boothNumber);
    }
    if (updateData.status !== undefined) {
      updates.push('status = ?');
      values.push(updateData.status);
    }
    
    updates.push('updatedAt = ?');
    values.push(new Date());
    
    values.push(id); // For WHERE clause
    
    const query = `UPDATE exhibitors SET ${updates.join(', ')} WHERE id = ?`;
    console.log('📝 Executing query:', query);
    console.log('📝 With values:', values);
    
    await sequelize.query(query, {
      replacements: values
    });
    
    console.log('✅ Update successful');
    
    // Get updated exhibitor
    const updatedExhibitor = await Exhibitor.findByPk(id);
    const response = updatedExhibitor.toJSON();
    
    // Map "approved" back to "active" for frontend
    if (response.status === 'approved') {
      response.status = 'active';
    }
    
    delete response.password;
    
    res.json({
      success: true,
      data: response,
      message: 'Exhibitor updated successfully'
    });
    
  } catch (error) {
    console.error('❌ Update error:', error.message);
    res.status(400).json({
      success: false,
      error: 'Failed to update exhibitor: ' + error.message
    });
  }
}

  // Delete exhibitor
  async deleteExhibitor(req, res) {
    try {
      const { id } = req.params;
      
      console.log('Delete exhibitor:', id);
      
      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      
      const exhibitor = await Exhibitor.findByPk(id);
      
      if (!exhibitor) {
        return res.status(404).json({
          success: false,
          error: 'Exhibitor not found'
        });
      }
      
      console.log('🗑️ Deleting exhibitor:', exhibitor.email);
      await exhibitor.destroy();
      
      res.json({
        success: true,
        message: 'Exhibitor deleted successfully'
      });
    } catch (error) {
      console.error('Delete error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Bulk update status
  async bulkUpdateStatus(req, res) {
    try {
      const { ids, status } = req.body;
      
      console.log('Bulk update status:', { ids, status });
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No exhibitor IDs provided'
        });
      }
      
      if (!status) {
        return res.status(400).json({
          success: false,
          error: 'Status is required'
        });
      }
      
      // Validate status
      const validStatuses = ['pending', 'active', 'inactive', 'approved', 'rejected'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }
      
      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      
      const [affectedCount] = await Exhibitor.update(
        { status },
        {
          where: {
            id: ids
          }
        }
      );
      
      res.json({
        success: true,
        data: {
          affectedCount,
          message: `Updated status for ${affectedCount} exhibitor(s)`
        }
      });
    } catch (error) {
      console.error('Bulk update error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new ExhibitorController();