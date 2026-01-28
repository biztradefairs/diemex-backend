// src/services/ExhibitorService.js
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class ExhibitorService {
  constructor() {
    this._exhibitorModel = null;
  }

  get Exhibitor() {
    if (!this._exhibitorModel) {
      const modelFactory = require('../models');
      this._exhibitorModel = modelFactory.getModel('Exhibitor');
    }
    return this._exhibitorModel;
  }

  // SIMPLE: Create exhibitor with admin-provided password
  async createExhibitor(exhibitorData) {
    try {
      console.log('\n🎯 CREATING EXHIBITOR (SIMPLE MODE)');
      console.log('Data received:', JSON.stringify(exhibitorData, null, 2));
      
const plainPassword = exhibitorData.password;

const hashedPassword = await bcrypt.hash(plainPassword, 10);
exhibitorData.password = hashedPassword;

exhibitorData.metadata = JSON.stringify({
  originalPassword: plainPassword,
  createdBy: 'admin',
  createdAt: new Date().toISOString()
});

      
      const exhibitor = await this.Exhibitor.create(exhibitorData);
      
      // Show in terminal
      console.log('\n========================================');
      console.log('✅ EXHIBITOR CREATED SUCCESSFULLY');
      console.log('========================================');
      console.log('📧 Email:', exhibitor.email);
      console.log('🔑 Password:', exhibitorData.originalPassword);
      console.log('🏢 Company:', exhibitor.company);
      console.log('👤 Contact:', exhibitor.name);
      console.log('========================================\n');
      
      // Return response with original password
      const response = exhibitor.toJSON();
      response.originalPassword = exhibitorData.originalPassword; // Show original password
      
      // Don't expose hash in response
      delete response.password;
      
      return response;
    } catch (error) {
      console.error('❌ Create exhibitor error:', error);
      throw new Error(`Failed to create exhibitor: ${error.message}`);
    }
  }

  // SIMPLE: Login - just check bcrypt hash
  async login(email, password) {
    try {
      console.log('\n🔐 LOGIN ATTEMPT');
      console.log('Email:', email);
      
      const exhibitor = await this.Exhibitor.findOne({
        where: { email: email.toLowerCase().trim() }
      });
      
      if (!exhibitor) {
        console.log('❌ No exhibitor found');
        throw new Error('Invalid email or password');
      }
      
      // SIMPLE: Just check bcrypt password
      const isValid = await bcrypt.compare(password, exhibitor.password);
      
      if (!isValid) {
        console.log('❌ Password incorrect');
        throw new Error('Invalid email or password');
      }
      
      console.log('✅ Login successful');
      return exhibitor;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // SIMPLE: Get all exhibitors with password info
  async getAllExhibitors(filters = {}, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      // Build query
      let where = {};
      if (filters.search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${filters.search}%` } },
          { company: { [Op.like]: `%${filters.search}%` } },
          { email: { [Op.like]: `%${filters.search}%` } }
        ];
      }
      
      if (filters.status && filters.status !== 'all') {
        where.status = filters.status;
      }
      
      // Get exhibitors
      const result = await this.Exhibitor.findAndCountAll({
        where,
        limit,
        offset,
        order: [['createdAt', 'DESC']],
        raw: true
      });
      
      // Format response with original passwords from metadata
      const exhibitors = result.rows.map(row => {
        let originalPassword = null;
        let metadata = {};
        
        if (row.metadata) {
          try {
            metadata = typeof row.metadata === 'string' 
              ? JSON.parse(row.metadata) 
              : row.metadata;
            
            originalPassword = metadata.originalPassword || null;
          } catch {
            metadata = {};
          }
        }
        
        return {
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          company: row.company,
          sector: row.sector,
          booth: row.boothNumber,
          status: row.status,
          website: row.website,
          originalPassword: originalPassword, // Show original password
          createdAt: row.createdAt
        };
      });
      
      return {
        exhibitors,
        total: result.count,
        page,
        limit,
        totalPages: Math.ceil(result.count / limit)
      };
    } catch (error) {
      console.error('Get exhibitors error:', error);
      throw new Error(`Failed to fetch exhibitors: ${error.message}`);
    }
  }

  // SIMPLE: Get single exhibitor
  async getExhibitorById(id) {
    try {
      const exhibitor = await this.Exhibitor.findByPk(id);
      
      if (!exhibitor) {
        throw new Error('Exhibitor not found');
      }
      
      const exhibitorData = exhibitor.toJSON();
      
      // Get original password from metadata
      let originalPassword = null;
      if (exhibitorData.metadata) {
        try {
          const metadata = typeof exhibitorData.metadata === 'string'
            ? JSON.parse(exhibitorData.metadata)
            : exhibitorData.metadata;
          originalPassword = metadata.originalPassword || null;
        } catch {
          // ignore
        }
      }
      
      // Don't show hash in response
      delete exhibitorData.password;
      exhibitorData.originalPassword = originalPassword;
      
      return exhibitorData;
    } catch (error) {
      console.error('Get exhibitor error:', error);
      throw new Error(`Failed to fetch exhibitor: ${error.message}`);
    }
  }

  // SIMPLE: Update exhibitor
  async updateExhibitor(id, updateData) {
    try {
      const exhibitor = await this.Exhibitor.findByPk(id);
      
      if (!exhibitor) {
        throw new Error('Exhibitor not found');
      }
      
      // If password is being updated, hash it
      if (updateData.password) {
        const hashedPassword = await bcrypt.hash(updateData.password, 10);
        updateData.password = hashedPassword;
        
        // Update metadata with new original password
        let metadata = {};
        if (exhibitor.metadata) {
          try {
            metadata = typeof exhibitor.metadata === 'string'
              ? JSON.parse(exhibitor.metadata)
              : exhibitor.metadata;
          } catch {
            metadata = {};
          }
        }
        
        metadata.originalPassword = updateData.originalPassword || updateData.password;
        updateData.metadata = JSON.stringify(metadata);
        
        console.log('🔐 Password updated for:', exhibitor.email);
        console.log('New original password:', updateData.originalPassword || updateData.password);
      }
      
      await exhibitor.update(updateData);
      return exhibitor;
    } catch (error) {
      console.error('Update error:', error);
      throw new Error(`Failed to update exhibitor: ${error.message}`);
    }
  }

  // SIMPLE: Delete exhibitor
  async deleteExhibitor(id) {
    try {
      const exhibitor = await this.Exhibitor.findByPk(id);
      
      if (!exhibitor) {
        throw new Error('Exhibitor not found');
      }
      
      console.log('🗑️ Deleting exhibitor:', exhibitor.email);
      await exhibitor.destroy();
      
      return { success: true };
    } catch (error) {
      console.error('Delete error:', error);
      throw new Error(`Failed to delete exhibitor: ${error.message}`);
    }
  }
}

module.exports = new ExhibitorService();