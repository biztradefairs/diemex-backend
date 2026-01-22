// src/services/ExhibitorService.js
const { Op } = require('sequelize');

class ExhibitorService {
  constructor() {
    // Don't load models in constructor
    this._exhibitorModel = null;
  }

  get Exhibitor() {
    if (!this._exhibitorModel) {
      const modelFactory = require('../models');
      this._exhibitorModel = modelFactory.getModel('Exhibitor');
    }
    return this._exhibitorModel;
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
      
      let query = {};
      
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
      throw new Error(`Failed to fetch exhibitors: ${error.message}`);
    }
  }

  async getExhibitorById(id) {
    try {
      let exhibitor;
      
      if (process.env.DB_TYPE === 'mysql') {
        exhibitor = await this.Exhibitor.findByPk(id);
      } else {
        exhibitor = await this.Exhibitor.findById(id);
      }
      
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
      throw new Error(`Failed to delete exhibitor: ${error.message}`);
    }
  }
  // src/services/ExhibitorService.js (update createExhibitor method)
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
    
    // Send welcome email with password
    try {
      const emailService = require('../services/EmailService');
      await emailService.sendExhibitorWelcome(exhibitor, exhibitorData.password);
    } catch (emailError) {
      console.warn('Failed to send welcome email:', emailError.message);
    }
    
    // Generate initial invoice
    try {
      await this.generateInitialInvoice(exhibitor);
    } catch (invoiceError) {
      console.warn('Failed to generate initial invoice:', invoiceError.message);
    }
    
    // Send notifications
    try {
      const kafkaProducer = require('../kafka/producer');
      await kafkaProducer.sendNotification('EXHIBITOR_REGISTERED', null, {
        exhibitorId: exhibitor.id,
        company: exhibitor.company,
        email: exhibitor.email
      });
      
      await kafkaProducer.sendAuditLog('EXHIBITOR_CREATED', null, {
        company: exhibitor.company,
        email: exhibitor.email,
        boothNumber: exhibitor.boothNumber
      });
    } catch (kafkaError) {
      console.warn('Kafka not available:', kafkaError.message);
    }

    return exhibitor;
  } catch (error) {
    throw new Error(`Failed to create exhibitor: ${error.message}`);
  }
}

async generateInitialInvoice(exhibitor) {
  try {
    const invoiceService = require('./InvoiceService');
    
    // Generate invoice based on booth type/price
    const invoiceData = {
      exhibitorId: exhibitor.id,
      company: exhibitor.company,
      amount: 4500, // Default amount, can be configurable
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      items: [
        {
          description: 'Exhibition Booth Booking',
          quantity: 1,
          unitPrice: 4000,
          total: 4000
        },
        {
          description: 'Registration Fee',
          quantity: 1,
          unitPrice: 500,
          total: 500
        }
      ],
      notes: 'Initial booking invoice'
    };
    
    const invoice = await invoiceService.createInvoice(invoiceData);
    
    // Send invoice email
    try {
      const emailService = require('../services/EmailService');
      await emailService.sendInvoiceEmail(exhibitor, invoice);
    } catch (emailError) {
      console.warn('Failed to send invoice email:', emailError.message);
    }
    
    return invoice;
  } catch (error) {
    throw new Error(`Failed to generate initial invoice: ${error.message}`);
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
      throw new Error(`Failed to get exhibitor stats: ${error.message}`);
    }
  }
}

module.exports = new ExhibitorService();