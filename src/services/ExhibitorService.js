// src/services/ExhibitorService.js
const { Op } = require('sequelize');

class ExhibitorService {
  constructor() {
    this._exhibitorModel = null;
  }

  // Get Exhibitor model with error handling
  get Exhibitor() {
    if (!this._exhibitorModel) {
      const modelFactory = require('../models');
      this._exhibitorModel = modelFactory.getModel('Exhibitor');
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
      const exhibitor = await this.Exhibitor.create(exhibitorData);
      
      // Send notification for new exhibitor
      const kafkaProducer = require('../kafka/producer');
      await kafkaProducer.sendNotification('EXHIBITOR_REGISTERED', null, {
        exhibitorId: exhibitor.id,
        company: exhibitor.company,
        status: exhibitor.status
      });

      // Send audit log
      await kafkaProducer.sendAuditLog('EXHIBITOR_CREATED', null, {
        company: exhibitor.company,
        email: exhibitor.email
      });

      return exhibitor;
    } catch (error) {
      throw new Error(`Failed to create exhibitor: ${error.message}`);
    }
  }

  async getAllExhibitors(filters = {}, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      let where = {};
      
      if (filters.search) {
        if (process.env.DB_TYPE === 'mysql') {
          query[Op.or] = [
            { name: { [Op.like]: `%${filters.search}%` } },
            { company: { [Op.like]: `%${filters.search}%` } },
            { email: { [Op.like]: `%${filters.search}%` } }
          ];
        } else {
          query.$or = [
            { name: { $regex: filters.search, $options: 'i' } },
            { company: { $regex: filters.search, $options: 'i' } },
            { email: { $regex: filters.search, $options: 'i' } }
          ];
        }
      }
      
      if (filters.sector && filters.sector !== 'all') {
        query.sector = filters.sector;
      }
      
      if (filters.status && filters.status !== 'all') {
        query.status = filters.status;
      }

      let exhibitors, total;
      
      if (process.env.DB_TYPE === 'mysql') {
        const result = await this.Exhibitor.findAndCountAll({
          where: query,
          limit,
          offset,
          order: [['createdAt', 'DESC']]
        });
        
        exhibitors = result.rows;
        total = result.count;
      } else {
        exhibitors = await this.Exhibitor.find(query)
          .skip(offset)
          .limit(limit)
          .sort({ createdAt: -1 });
        
        total = await this.Exhibitor.countDocuments(query);
      }

      return {
        exhibitors,
        total,
        page,
        totalPages: Math.ceil(total / limit)
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
      let exhibitor;
      
      if (process.env.DB_TYPE === 'mysql') {
        exhibitor = await this.Exhibitor.findByPk(id);
        if (!exhibitor) throw new Error('Exhibitor not found');
        
        const kafkaProducer = require('../kafka/producer');
        // Send notification if status changed
        if (updateData.status && updateData.status !== exhibitor.status) {
          await kafkaProducer.sendNotification('EXHIBITOR_STATUS_CHANGED', null, {
            exhibitorId: id,
            company: exhibitor.company,
            oldStatus: exhibitor.status,
            newStatus: updateData.status
          });
        }
        
        await exhibitor.update(updateData);
        
        // Send audit log
        await kafkaProducer.sendAuditLog('EXHIBITOR_UPDATED', null, {
          exhibitorId: id,
          updatedFields: Object.keys(updateData)
        });
      } else {
        const kafkaProducer = require('../kafka/producer');
        // Check if status is being changed
        if (updateData.status) {
          const current = await this.Exhibitor.findById(id);
          if (current && updateData.status !== current.status) {
            await kafkaProducer.sendNotification('EXHIBITOR_STATUS_CHANGED', null, {
              exhibitorId: id,
              company: current.company,
              oldStatus: current.status,
              newStatus: updateData.status
            });
          }
        }
        
        exhibitor = await this.Exhibitor.findByIdAndUpdate(
          id,
          updateData,
          { new: true, runValidators: true }
        );
        if (!exhibitor) throw new Error('Exhibitor not found');
        
        // Send audit log
        await kafkaProducer.sendAuditLog('EXHIBITOR_UPDATED', null, {
          exhibitorId: id,
          updatedFields: Object.keys(updateData)
        });
      }

      return exhibitor;
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
      let result;
      
      const kafkaProducer = require('../kafka/producer');
      
      if (process.env.DB_TYPE === 'mysql') {
        const exhibitor = await this.Exhibitor.findByPk(id);
        if (!exhibitor) throw new Error('Exhibitor not found');
        await exhibitor.destroy();
        result = { success: true };
      } else {
        result = await this.Exhibitor.findByIdAndDelete(id);
        if (!result) throw new Error('Exhibitor not found');
      }

      // Send audit log
      await kafkaProducer.sendAuditLog('EXHIBITOR_DELETED', null, {
        exhibitorId: id
      });

      return result;
    } catch (error) {
      console.error('❌ Error deleting exhibitor:', error);
      throw new Error(`Failed to delete exhibitor: ${error.message}`);
    }
  }

  async getExhibitorStats() {
    try {
      if (process.env.DB_TYPE === 'mysql') {
        const { Sequelize } = require('sequelize');
        const stats = await this.Exhibitor.findAll({
          attributes: [
            'status',
            [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
          ],
          group: ['status']
        });

        const sectors = await this.Exhibitor.findAll({
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
          byStatus: stats,
          bySector: sectors
        };
      } else {
        const byStatus = await this.Exhibitor.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const bySector = await this.Exhibitor.aggregate([
          { $match: { sector: { $ne: null } } },
          { $group: { _id: '$sector', count: { $sum: 1 } } }
        ]);

        return {
          byStatus,
          bySector
        };
      }
    } catch (error) {
      console.error('❌ Error getting exhibitor stats:', error);
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