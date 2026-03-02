const exhibitorService = require('../services/ExhibitorService');

class ExhibitorController {
  // CREATE EXHIBITOR
  async createExhibitor(req, res) {
    try {
      console.log('\n🎯 CREATE EXHIBITOR REQUEST');
      
      const data = req.body;
      const bcrypt = require('bcryptjs');
      
      // Required fields
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
      
      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      
      // Check if email exists
      const existingExhibitor = await Exhibitor.findOne({
        where: { email: data.email.toLowerCase().trim() }
      });
      
      if (existingExhibitor) {
        return res.status(400).json({
          success: false,
          error: 'Email already exists'
        });
      }
      
      // Store original password
      const originalPassword = data.password;
      
      // Prepare stall details with all fields including price
      const stallDetails = {
        size: data.boothSize || data.stallDetails?.size || '3m x 3m',
        type: data.boothType || data.stallDetails?.type || 'standard',
        dimensions: data.boothDimensions || data.stallDetails?.dimensions || '',
        notes: data.boothNotes || data.stallDetails?.notes || '',
        price: data.boothPrice || data.stallDetails?.price || data.price || ''
      };
      
      console.log('🏪 Stall details with price:', stallDetails);
      
      // Store original password in metadata
      const metadata = {
        originalPassword: originalPassword,
        createdAt: new Date().toISOString(),
        createdBy: req.user?.id || 'system'
      };
      
      // Create exhibitor
      const exhibitor = await Exhibitor.create({
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        company: data.company.trim(),
        password: originalPassword, // This will be hashed by a hook
        phone: data.phone || '',
        sector: data.sector || '',
        boothNumber: data.boothNumber || '',
        stallDetails: stallDetails,
        status: data.status || 'pending',
        metadata: metadata
      });
      
      console.log('✅ Exhibitor created:', exhibitor.email);
      console.log('🔑 Original password stored in metadata');
      console.log('🏪 Stall details with price:', stallDetails);
      
      // Send welcome email
      const emailService = require('../services/EmailService');
      emailService.sendExhibitorWelcome(exhibitor, originalPassword)
        .then(() => console.log('✅ Welcome email sent'))
        .catch(err => console.warn('⚠️ Email failed:', err.message));
      
      // Return response
      const response = exhibitor.toJSON();
      response.originalPassword = originalPassword;
      delete response.password;
      
      // Add stall details to response
      response.boothSize = stallDetails.size;
      response.boothType = stallDetails.type;
      response.boothDimensions = stallDetails.dimensions;
      response.boothNotes = stallDetails.notes;
      response.boothPrice = stallDetails.price;
      
      res.status(201).json({
        success: true,
        data: response,
        message: 'Exhibitor created successfully'
      });
      
    } catch (error) {
      console.error('❌ Create error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // GET ALL EXHIBITORS
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
      
      // Format response
      const formatted = rows.map(exhibitor => {
        const data = exhibitor.toJSON();
        
        // Get original password from metadata
        let originalPassword = null;
        if (data.metadata) {
          try {
            const metadata = typeof data.metadata === 'string' 
              ? JSON.parse(data.metadata) 
              : data.metadata;
            originalPassword = metadata.originalPassword || null;
          } catch (e) {
            console.warn('Failed to parse metadata for:', data.email);
          }
        }
        
        // Get stall details with all fields including price
        let boothSize = '';
        let boothType = 'standard';
        let boothDimensions = '';
        let boothNotes = '';
        let boothPrice = '';
        
        if (data.stallDetails) {
          try {
            const stallDetails = typeof data.stallDetails === 'string' 
              ? JSON.parse(data.stallDetails) 
              : data.stallDetails;
            boothSize = stallDetails.size || '';
            boothType = stallDetails.type || 'standard';
            boothDimensions = stallDetails.dimensions || '';
            boothNotes = stallDetails.notes || '';
            boothPrice = stallDetails.price || '';
          } catch (e) {
            console.warn('Failed to parse stallDetails for:', data.email);
          }
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
          boothNumber: data.boothNumber,
          boothSize: boothSize,
          boothType: boothType,
          boothDimensions: boothDimensions,
          boothNotes: boothNotes,
          boothPrice: boothPrice,
          status: frontendStatus,
          originalPassword: originalPassword,
          createdAt: data.createdAt,
          stallDetails: data.stallDetails
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

  // GET EXHIBITOR STATISTICS
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
            count: parseInt(item.count)
          })),
          bySector: bySector.map(item => ({
            _id: item.sector,
            count: parseInt(item.count)
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

  // GET SINGLE EXHIBITOR
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
          const metadata = typeof data.metadata === 'string' 
            ? JSON.parse(data.metadata) 
            : data.metadata;
          originalPassword = metadata.originalPassword || null;
        } catch (e) {
          console.warn('Failed to parse metadata for:', data.email);
        }
      }
      
      // Parse stallDetails to include all fields
      let stallDetails = data.stallDetails;
      if (stallDetails && typeof stallDetails === 'string') {
        try {
          stallDetails = JSON.parse(stallDetails);
        } catch (e) {
          stallDetails = {};
        }
      }
      
      // Don't show hash
      delete data.password;
      delete data.resetPasswordToken;
      delete data.resetPasswordExpires;
      
      // Add original password and parsed stallDetails
      data.originalPassword = originalPassword;
      data.stallDetails = stallDetails;
      
      // Add individual fields for easier access
      data.boothSize = stallDetails?.size || '';
      data.boothType = stallDetails?.type || 'standard';
      data.boothDimensions = stallDetails?.dimensions || '';
      data.boothNotes = stallDetails?.notes || '';
      data.boothPrice = stallDetails?.price || '';
      
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

  // UPDATE EXHIBITOR
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

      // Handle stall details update - PRESERVE ALL FIELDS including price
      if (updateData.stallDetails || updateData.boothSize || updateData.boothType || 
          updateData.boothDimensions || updateData.boothNotes || updateData.boothPrice) {
        
        // Get existing stall details or create new
        let stallDetails = exhibitor.stallDetails || {};
        
        // Parse if it's a string
        if (typeof stallDetails === 'string') {
          try {
            stallDetails = JSON.parse(stallDetails);
          } catch {
            stallDetails = {};
          }
        }
        
        // Merge with new data
        stallDetails = {
          ...stallDetails,
          size: updateData.boothSize || updateData.stallDetails?.size || stallDetails.size || '',
          type: updateData.boothType || updateData.stallDetails?.type || stallDetails.type || 'standard',
          dimensions: updateData.boothDimensions || updateData.stallDetails?.dimensions || stallDetails.dimensions || '',
          notes: updateData.boothNotes || updateData.stallDetails?.notes || stallDetails.notes || '',
          price: updateData.boothPrice || updateData.stallDetails?.price || stallDetails.price || ''
        };
        
        updateData.stallDetails = stallDetails;
        console.log('🏪 Updated stallDetails with price:', stallDetails);
      }

      // Handle metadata update - PRESERVE ORIGINAL PASSWORD
      if (updateData.metadata || updateData.originalPassword) {
        let metadata = exhibitor.metadata || {};
        
        // Parse if it's a string
        if (typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata);
          } catch {
            metadata = {};
          }
        }
        
        // Merge with new data, but preserve originalPassword if not explicitly changed
        metadata = {
          ...metadata,
          ...updateData.metadata,
          updatedAt: new Date().toISOString()
        };
        
        // If a new password is provided, update it in metadata
        if (updateData.originalPassword) {
          metadata.originalPassword = updateData.originalPassword;
        }
        
        updateData.metadata = metadata;
      }

      // Handle password update separately
      if (updateData.password) {
        // Password will be hashed by model hook
        console.log('🔑 Password will be updated');
        
        // Also update metadata with new password if provided
        if (!updateData.metadata) {
          let metadata = exhibitor.metadata || {};
          if (typeof metadata === 'string') {
            try {
              metadata = JSON.parse(metadata);
            } catch {
              metadata = {};
            }
          }
          metadata.originalPassword = updateData.password;
          metadata.passwordUpdatedAt = new Date().toISOString();
          updateData.metadata = metadata;
        }
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
      if (updateData.website !== undefined) {
        updates.push('website = ?');
        values.push(updateData.website);
      }
      if (updateData.address !== undefined) {
        updates.push('address = ?');
        values.push(updateData.address);
      }
      if (updateData.stallDetails !== undefined) {
        updates.push('stallDetails = ?');
        values.push(JSON.stringify(updateData.stallDetails));
      }
      if (updateData.metadata !== undefined) {
        updates.push('metadata = ?');
        values.push(JSON.stringify(updateData.metadata));
      }
      if (updateData.status !== undefined) {
        updates.push('status = ?');
        values.push(updateData.status);
      }
      if (updateData.password !== undefined) {
        // Hash the password before storing
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(updateData.password, salt);
        updates.push('password = ?');
        values.push(hashedPassword);
      }
      
      updates.push('updatedAt = ?');
      values.push(new Date());
      
      values.push(id); // For WHERE clause
      
      const query = `UPDATE exhibitors SET ${updates.join(', ')} WHERE id = ?`;
      console.log('📝 Executing query');
      
      await sequelize.query(query, {
        replacements: values
      });
      
      console.log('✅ Update successful');
      
      // Get updated exhibitor
      const updatedExhibitor = await Exhibitor.findByPk(id);
      const response = updatedExhibitor.toJSON();
      
      // Parse stallDetails to include price in response
      if (response.stallDetails) {
        if (typeof response.stallDetails === 'string') {
          try {
            response.stallDetails = JSON.parse(response.stallDetails);
          } catch {
            response.stallDetails = {};
          }
        }
      }
      
      // Parse metadata
      if (response.metadata) {
        if (typeof response.metadata === 'string') {
          try {
            response.metadata = JSON.parse(response.metadata);
          } catch {
            response.metadata = {};
          }
        }
        response.originalPassword = response.metadata.originalPassword || null;
      }
      
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

  // DELETE EXHIBITOR
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

  // BULK UPDATE STATUS
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

  // RESEND CREDENTIALS
  async resendCredentials(req, res) {
    try {
      const { id } = req.params;
      
      console.log('📧 Resending credentials for exhibitor:', id);
      
      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      const emailService = require('../services/EmailService');
      
      const exhibitor = await Exhibitor.findByPk(id);
      
      if (!exhibitor) {
        return res.status(404).json({
          success: false,
          error: 'Exhibitor not found'
        });
      }
      
      // Get original password from metadata
      let originalPassword = null;
      let metadata = {};
      
      if (exhibitor.metadata) {
        try {
          metadata = typeof exhibitor.metadata === 'string' 
            ? JSON.parse(exhibitor.metadata) 
            : exhibitor.metadata;
          originalPassword = metadata.originalPassword;
        } catch (error) {
          console.warn('Could not parse metadata:', error.message);
        }
      }
      
      // If no password in metadata, generate one and store it
      if (!originalPassword) {
        originalPassword = this.generateRandomPassword();
        
        // Update metadata
        metadata.originalPassword = originalPassword;
        metadata.passwordGeneratedAt = new Date().toISOString();
        metadata.passwordResetRequired = true;
        
        await exhibitor.update({ metadata });
        
        console.log('🔑 Generated new password for exhibitor without stored password');
      }
      
      console.log('🔑 Sending original password to:', exhibitor.email);
      
      // Send email with credentials
      emailService.sendExhibitorWelcome(exhibitor, originalPassword)
        .then(() => {
          console.log('✅ Credentials email sent successfully');
        })
        .catch((emailError) => {
          console.warn('⚠️ Email sending failed:', emailError.message);
        });
      
      // Return response immediately
      res.json({
        success: true,
        message: 'Credentials have been sent to email',
        data: {
          email: exhibitor.email,
          timestamp: new Date().toISOString(),
          note: originalPassword ? 'Original credentials sent' : 'New credentials generated and sent'
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

  // HELPER: Generate random password
  generateRandomPassword() {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    
    // Ensure at least one of each required character type
    password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ".charAt(Math.floor(Math.random() * 26));
    password += "abcdefghijklmnopqrstuvwxyz".charAt(Math.floor(Math.random() * 26));
    password += "0123456789".charAt(Math.floor(Math.random() * 10));
    password += "!@#$%^&*".charAt(Math.floor(Math.random() * 8));
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}

module.exports = new ExhibitorController();