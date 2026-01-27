const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

class ExhibitorService {
  constructor() {
    this._exhibitorModel = null;
  }

  // Get Exhibitor model with error handling
  get Exhibitor() {
    if (!this._exhibitorModel) {
      try {
        const modelFactory = require('../models');
        
        // Check if model factory is initialized
        if (typeof modelFactory.getModel !== 'function') {
          throw new Error('Model factory not properly initialized');
        }
        
        const exhibitorModel = modelFactory.getModel('Exhibitor');
        
        if (!exhibitorModel) {
          throw new Error('Exhibitor model not found in factory');
        }
        
        this._exhibitorModel = exhibitorModel;
        console.log('✅ Exhibitor model loaded successfully');
        
      } catch (error) {
        console.error('❌ Failed to get Exhibitor model:', error.message);
        console.error('Available models:', Object.keys(require('../models').getAllModels() || {}));
        throw new Error(`Failed to get Exhibitor model: ${error.message}`);
      }
    }
    return this._exhibitorModel;
  }

  async testConnection() {
    try {
      const count = await this.Exhibitor.count();
      console.log(`✅ Exhibitor model connection test: ${count} records found`);
      return true;
    } catch (error) {
      console.error('❌ Exhibitor model connection test failed:', error.message);
      return false;
    }
  }

  async createExhibitor(exhibitorData) {
    try {
      console.log('Creating exhibitor with data:', exhibitorData);
      
      // Validate required fields
      if (!exhibitorData.email) {
        throw new Error('Email is required');
      }
      
      if (!exhibitorData.company) {
        throw new Error('Company name is required');
      }
      
      // Map frontend properties to backend properties
      const mappedData = {
        name: exhibitorData.name || '',
        email: exhibitorData.email,
        company: exhibitorData.company,
        phone: exhibitorData.phone || '',
        sector: exhibitorData.sector || '',
        boothNumber: exhibitorData.booth || exhibitorData.boothNumber || '',
        website: exhibitorData.website || '',
        address: exhibitorData.address || '',
        status: exhibitorData.status || 'active',
        stallDetails: exhibitorData.stallDetails || {},
        metadata: exhibitorData.metadata || {}
      };
      
      // Generate random password if not provided
      let plainPassword = exhibitorData.password;
      if (!plainPassword) {
        plainPassword = Math.random().toString(36).slice(-8);
      }
      
      // Hash password
      mappedData.password = await bcrypt.hash(plainPassword, 10);
      
      console.log('Creating exhibitor with mapped data:', mappedData);
      
      const exhibitor = await this.Exhibitor.create(mappedData);
      
      // Remove password from response
      const exhibitorResponse = exhibitor.toJSON();
      delete exhibitorResponse.password;
      delete exhibitorResponse.resetPasswordToken;
      delete exhibitorResponse.resetPasswordExpires;
      
      console.log('✅ Exhibitor created successfully:', exhibitor.id);
      
      // Send welcome email
      try {
        const emailService = require('./EmailService');
        await emailService.sendExhibitorWelcome(exhibitor, plainPassword);
      } catch (emailError) {
        console.warn('⚠️ Failed to send welcome email:', emailError.message);
      }
      
      return exhibitorResponse;
      
    } catch (error) {
      console.error('❌ Error creating exhibitor:', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new Error('Email already exists');
      }
      if (error.name === 'SequelizeValidationError') {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(`Failed to create exhibitor: ${error.message}`);
    }
  }

  async getAllExhibitors(filters = {}, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      let where = {};
      
      // Build search query
      if (filters.search && filters.search !== 'undefined' && filters.search !== '') {
        where[Op.or] = [
          { name: { [Op.like]: `%${filters.search}%` } },
          { company: { [Op.like]: `%${filters.search}%` } },
          { email: { [Op.like]: `%${filters.search}%` } },
          { phone: { [Op.like]: `%${filters.search}%` } }
        ];
      }
      
      if (filters.sector && filters.sector !== 'all' && filters.sector !== 'undefined') {
        where.sector = filters.sector;
      }
      
      if (filters.status && filters.status !== 'all' && filters.status !== 'undefined') {
        where.status = filters.status;
      }
      
      console.log('Querying exhibitors with filters:', JSON.stringify(where));
      
      const { count, rows } = await this.Exhibitor.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']],
        attributes: { 
          exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires'] 
        }
      });
      
      // Map backend properties to frontend properties
      const exhibitors = rows.map(exhibitor => {
        const exhibitorData = exhibitor.toJSON();
        return {
          id: exhibitorData.id,
          name: exhibitorData.name,
          email: exhibitorData.email,
          phone: exhibitorData.phone,
          company: exhibitorData.company,
          sector: exhibitorData.sector,
          booth: exhibitorData.boothNumber || '',
          status: exhibitorData.status,
          registrationDate: exhibitorData.registrationDate || exhibitorData.createdAt,
          website: exhibitorData.website,
          address: exhibitorData.address,
          stallDetails: exhibitorData.stallDetails,
          createdAt: exhibitorData.createdAt,
          updatedAt: exhibitorData.updatedAt
        };
      });
      
      console.log(`✅ Found ${count} exhibitors, returning ${exhibitors.length} for page ${page}`);
      
      return {
        exhibitors,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      };
      
    } catch (error) {
      console.error('❌ Error fetching exhibitors:', error);
      console.error('Error stack:', error.stack);
      throw new Error(`Failed to fetch exhibitors: ${error.message}`);
    }
  }

  async getExhibitorById(id) {
    try {
      const exhibitor = await this.Exhibitor.findByPk(id, {
        attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires'] }
      });
      
      if (!exhibitor) {
        throw new Error('Exhibitor not found');
      }
      
      const exhibitorData = exhibitor.toJSON();
      
      // Map to frontend format
      return {
        id: exhibitorData.id,
        name: exhibitorData.name,
        email: exhibitorData.email,
        phone: exhibitorData.phone,
        company: exhibitorData.company,
        sector: exhibitorData.sector,
        booth: exhibitorData.boothNumber || '',
        status: exhibitorData.status,
        registrationDate: exhibitorData.registrationDate || exhibitorData.createdAt,
        website: exhibitorData.website,
        address: exhibitorData.address,
        stallDetails: exhibitorData.stallDetails,
        createdAt: exhibitorData.createdAt,
        updatedAt: exhibitorData.updatedAt
      };
      
    } catch (error) {
      console.error('❌ Error fetching exhibitor:', error);
      throw new Error(`Failed to fetch exhibitor: ${error.message}`);
    }
  }

  async updateExhibitor(id, updateData) {
    try {
      const exhibitor = await this.Exhibitor.findByPk(id);
      if (!exhibitor) {
        throw new Error('Exhibitor not found');
      }
      
      console.log('Updating exhibitor', id, 'with data:', updateData);
      
      // Map frontend properties to backend properties
      const mappedData = {};
      
      if (updateData.name !== undefined) mappedData.name = updateData.name;
      if (updateData.email !== undefined) mappedData.email = updateData.email;
      if (updateData.phone !== undefined) mappedData.phone = updateData.phone;
      if (updateData.company !== undefined) mappedData.company = updateData.company;
      if (updateData.sector !== undefined) mappedData.sector = updateData.sector;
      if (updateData.booth !== undefined) mappedData.boothNumber = updateData.booth;
      if (updateData.status !== undefined) mappedData.status = updateData.status;
      if (updateData.website !== undefined) mappedData.website = updateData.website;
      if (updateData.address !== undefined) mappedData.address = updateData.address;
      if (updateData.stallDetails !== undefined) mappedData.stallDetails = updateData.stallDetails;
      
      await exhibitor.update(mappedData);
      
      // Get updated exhibitor data
      const updatedExhibitor = await this.Exhibitor.findByPk(id, {
        attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires'] }
      });
      
      const exhibitorData = updatedExhibitor.toJSON();
      
      // Map to frontend format
      return {
        id: exhibitorData.id,
        name: exhibitorData.name,
        email: exhibitorData.email,
        phone: exhibitorData.phone,
        company: exhibitorData.company,
        sector: exhibitorData.sector,
        booth: exhibitorData.boothNumber || '',
        status: exhibitorData.status,
        registrationDate: exhibitorData.registrationDate || exhibitorData.createdAt,
        website: exhibitorData.website,
        address: exhibitorData.address,
        stallDetails: exhibitorData.stallDetails,
        createdAt: exhibitorData.createdAt,
        updatedAt: exhibitorData.updatedAt
      };
      
    } catch (error) {
      console.error('❌ Error updating exhibitor:', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new Error('Email already exists');
      }
      if (error.name === 'SequelizeValidationError') {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(`Failed to update exhibitor: ${error.message}`);
    }
  }

  async deleteExhibitor(id) {
    try {
      const exhibitor = await this.Exhibitor.findByPk(id);
      if (!exhibitor) {
        throw new Error('Exhibitor not found');
      }
      
      await exhibitor.destroy();
      console.log(`✅ Exhibitor ${id} deleted successfully`);
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ Error deleting exhibitor:', error);
      throw new Error(`Failed to delete exhibitor: ${error.message}`);
    }
  }

  async getExhibitorStats() {
    try {
      console.log('Getting exhibitor stats...');
      
      const sequelize = this.Exhibitor.sequelize;
      
      // Get status stats
      const statusStats = await this.Exhibitor.findAll({
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('status')), 'count']
        ],
        group: ['status'],
        raw: true
      });
      
      // Get sector stats
      const sectorStats = await this.Exhibitor.findAll({
        attributes: [
          'sector',
          [sequelize.fn('COUNT', sequelize.col('sector')), 'count']
        ],
        where: {
          sector: { [Op.not]: null }
        },
        group: ['sector'],
        raw: true
      });
      
      // Get total count
      const total = await this.Exhibitor.count();
      
      // Format for frontend
      const byStatus = statusStats.map(stat => ({
        _id: stat.status,
        count: parseInt(stat.count)
      }));
      
      const bySector = sectorStats.map(stat => ({
        _id: stat.sector,
        count: parseInt(stat.count)
      }));
      
      console.log('✅ Exhibitor stats:', {
        total,
        byStatus,
        bySector: bySector.length
      });
      
      return {
        total,
        byStatus,
        bySector
      };
      
    } catch (error) {
      console.error('❌ Error getting exhibitor stats:', error);
      throw new Error(`Failed to get exhibitor stats: ${error.message}`);
    }
  }
}

module.exports = new ExhibitorService();