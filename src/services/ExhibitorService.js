const { Op, Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');

class ExhibitorService {
  constructor() {
    this._exhibitorModel = null;
  }

  get Exhibitor() {
    if (!this._exhibitorModel) {
      const modelFactory = require('../models');
      this._exhibitorModel = modelFactory.getModel('Exhibitor');
      if (!this._exhibitorModel) {
        throw new Error('Exhibitor model not found. Make sure models are initialized.');
      }
    }
    return this._exhibitorModel;
  }

  async createExhibitor(exhibitorData) {
    try {
      // Generate random password if not provided
      if (!exhibitorData.password) {
        exhibitorData.password = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      }
      
      // Hash password
      exhibitorData.password = await bcrypt.hash(exhibitorData.password, 10);
      
      // Set default status
      if (!exhibitorData.status) {
        exhibitorData.status = 'active';
      }
      
      const exhibitor = await this.Exhibitor.create(exhibitorData);
      
      // Send welcome email
      try {
        const emailService = require('../services/EmailService');
        await emailService.sendExhibitorWelcome(exhibitor, exhibitorData.password);
      } catch (emailError) {
        console.warn('Failed to send welcome email:', emailError.message);
      }
      
      return exhibitor;
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new Error('Email already exists');
      }
      throw new Error(`Failed to create exhibitor: ${error.message}`);
    }
  }

  async getAllExhibitors(filters = {}, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      let where = {};
      
      // Search filter
      if (filters.search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${filters.search}%` } },
          { company: { [Op.like]: `%${filters.search}%` } },
          { email: { [Op.like]: `%${filters.search}%` } }
        ];
      }
      
      // Sector filter
      if (filters.sector && filters.sector !== 'all') {
        where.sector = filters.sector;
      }
      
      // Status filter
      if (filters.status && filters.status !== 'all') {
        where.status = filters.status;
      }

      // Use Sequelize findAndCountAll
      const result = await this.Exhibitor.findAndCountAll({
        where,
        limit,
        offset,
        order: [['createdAt', 'DESC']],
        attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires'] }
      });

      return {
        exhibitors: result.rows,
        total: result.count,
        page,
        totalPages: Math.ceil(result.count / limit)
      };
    } catch (error) {
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
      
      return exhibitor;
    } catch (error) {
      throw new Error(`Failed to fetch exhibitor: ${error.message}`);
    }
  }

  async updateExhibitor(id, updateData) {
    try {
      const exhibitor = await this.Exhibitor.findByPk(id);
      if (!exhibitor) throw new Error('Exhibitor not found');
      
      // Don't update password here
      delete updateData.password;
      delete updateData.resetPasswordToken;
      delete updateData.resetPasswordExpires;
      
      await exhibitor.update(updateData);
      
      return exhibitor;
    } catch (error) {
      throw new Error(`Failed to update exhibitor: ${error.message}`);
    }
  }

  async deleteExhibitor(id) {
    try {
      const exhibitor = await this.Exhibitor.findByPk(id);
      if (!exhibitor) throw new Error('Exhibitor not found');
      
      await exhibitor.destroy();
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete exhibitor: ${error.message}`);
    }
  }

  async getExhibitorStats() {
    try {
      // Get count by status using Sequelize
      const byStatus = await this.Exhibitor.findAll({
        attributes: [
          'status',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
        ],
        group: ['status']
      });

      // Get count by sector
      const bySector = await this.Exhibitor.findAll({
        attributes: [
          'sector',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
        ],
        where: {
          sector: { [Op.not]: null }
        },
        group: ['sector']
      });

      return {
        byStatus,
        bySector
      };
    } catch (error) {
      throw new Error(`Failed to get exhibitor stats: ${error.message}`);
    }
  }

  async getExhibitorByEmail(email) {
    try {
      const exhibitor = await this.Exhibitor.findOne({ 
        where: { email },
        attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires'] }
      });
      
      if (!exhibitor) {
        throw new Error('Exhibitor not found');
      }
      
      return exhibitor;
    } catch (error) {
      throw new Error(`Failed to fetch exhibitor: ${error.message}`);
    }
  }

  async getExhibitorWithPassword(email) {
    try {
      const exhibitor = await this.Exhibitor.findOne({ where: { email } });
      
      if (!exhibitor) {
        throw new Error('Exhibitor not found');
      }
      
      return exhibitor;
    } catch (error) {
      throw new Error(`Failed to fetch exhibitor: ${error.message}`);
    }
  }

  async updatePassword(id, password) {
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const exhibitor = await this.Exhibitor.findByPk(id);
      
      if (!exhibitor) throw new Error('Exhibitor not found');
      
      await exhibitor.update({ 
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null
      });
      
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to update password: ${error.message}`);
    }
  }

  async setResetToken(email, token, expires) {
    try {
      const exhibitor = await this.Exhibitor.findOne({ where: { email } });
      
      if (!exhibitor) {
        return false; // Don't reveal if email exists
      }
      
      await exhibitor.update({
        resetPasswordToken: token,
        resetPasswordExpires: expires
      });
      
      return true;
    } catch (error) {
      throw new Error(`Failed to set reset token: ${error.message}`);
    }
  }

  async getExhibitorByResetToken(token) {
    try {
      const exhibitor = await this.Exhibitor.findOne({
        where: {
          resetPasswordToken: token,
          resetPasswordExpires: { [Op.gt]: new Date() }
        }
      });
      
      if (!exhibitor) {
        throw new Error('Invalid or expired token');
      }
      
      return exhibitor;
    } catch (error) {
      throw new Error(`Failed to fetch exhibitor by token: ${error.message}`);
    }
  }
}

module.exports = new ExhibitorService();