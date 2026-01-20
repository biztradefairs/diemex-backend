// src/services/PaymentService.js
const { Op } = require('sequelize');

class PaymentService {
  constructor() {
    this._paymentModel = null;
    this._invoiceModel = null;
  }

  // Lazy getter for Payment model
  get Payment() {
    if (!this._paymentModel) {
      const modelFactory = require('../models');
      this._paymentModel = modelFactory.getModel('Payment');
    }
    return this._paymentModel;
  }

  // Lazy getter for Invoice model
  get Invoice() {
    if (!this._invoiceModel) {
      const modelFactory = require('../models');
      this._invoiceModel = modelFactory.getModel('Invoice');
    }
    return this._invoiceModel;
  }

  async createPayment(paymentData) {
    try {
      // Generate transaction ID if not provided
      if (!paymentData.transactionId) {
        paymentData.transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      const payment = await this.Payment.create(paymentData);
      
      // Update invoice status if payment is successful
      if (payment.status === 'completed' && payment.invoiceId) {
        await this.updateInvoiceStatus(payment.invoiceId, 'paid', payment.id);
      }
      
      // Send notification
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendNotification('PAYMENT_RECEIVED', payment.userId, {
          paymentId: payment.id,
          amount: payment.amount,
          status: payment.status
        });
        await kafkaProducer.sendAuditLog('PAYMENT_CREATED', payment.userId, {
          paymentId: payment.id,
          amount: payment.amount,
          method: payment.method
        });
      } catch (kafkaError) {
        console.warn('Kafka not available:', kafkaError.message);
      }

      return payment;
    } catch (error) {
      throw new Error(`Failed to create payment: ${error.message}`);
    }
  }

  async getAllPayments(filters = {}, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      let query = {};
      
      if (filters.search) {
        if (process.env.DB_TYPE === 'mysql') {
          query[Op.or] = [
            { invoiceNumber: { [Op.like]: `%${filters.search}%` } },
            { transactionId: { [Op.like]: `%${filters.search}%` } }
          ];
        } else {
          query.$or = [
            { invoiceNumber: { $regex: filters.search, $options: 'i' } },
            { transactionId: { $regex: filters.search, $options: 'i' } }
          ];
        }
      }
      
      if (filters.status && filters.status !== 'all') {
        query.status = filters.status;
      }
      
      if (filters.method && filters.method !== 'all') {
        query.method = filters.method;
      }
      
      if (filters.startDate && filters.endDate) {
        if (process.env.DB_TYPE === 'mysql') {
          query.date = {
            [Op.between]: [new Date(filters.startDate), new Date(filters.endDate)]
          };
        } else {
          query.date = {
            $gte: new Date(filters.startDate),
            $lte: new Date(filters.endDate)
          };
        }
      }

      let payments, total;
      
      if (process.env.DB_TYPE === 'mysql') {
        const result = await this.Payment.findAndCountAll({
          where: query,
          limit,
          offset,
          order: [['date', 'DESC']]
        });
        
        payments = result.rows;
        total = result.count;
      } else {
        payments = await this.Payment.find(query)
          .skip(offset)
          .limit(limit)
          .sort({ date: -1 });
        
        total = await this.Payment.countDocuments(query);
      }

      return {
        payments,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      throw new Error(`Failed to fetch payments: ${error.message}`);
    }
  }

  async getPaymentById(id) {
    try {
      let payment;
      
      if (process.env.DB_TYPE === 'mysql') {
        payment = await this.Payment.findByPk(id);
      } else {
        payment = await this.Payment.findById(id);
      }
      
      if (!payment) {
        throw new Error('Payment not found');
      }
      
      return payment;
    } catch (error) {
      throw new Error(`Failed to fetch payment: ${error.message}`);
    }
  }

  async updatePaymentStatus(id, status, notes = '') {
    try {
      let payment;
      
      if (process.env.DB_TYPE === 'mysql') {
        payment = await this.Payment.findByPk(id);
        if (!payment) throw new Error('Payment not found');
        
        const oldStatus = payment.status;
        await payment.update({ 
          status,
          notes: payment.notes ? `${payment.notes}\n${notes}` : notes
        });
        
        // Send notification if status changed
        if (oldStatus !== status) {
          try {
            const kafkaProducer = require('../kafka/producer');
            await kafkaProducer.sendNotification('PAYMENT_STATUS_CHANGED', payment.userId, {
              paymentId: payment.id,
              oldStatus,
              newStatus: status,
              amount: payment.amount
            });
          } catch (kafkaError) {
            console.warn('Kafka not available for notification:', kafkaError.message);
          }
        }
        
        // Update invoice status if payment is completed
        if (status === 'completed' && payment.invoiceId) {
          await this.updateInvoiceStatus(payment.invoiceId, 'paid', payment.id);
        }
      } else {
        const updateData = { 
          status,
          $push: { 
            notes: { 
              text: notes,
              timestamp: new Date()
            }
          }
        };
        
        payment = await this.Payment.findByIdAndUpdate(
          id,
          updateData,
          { new: true, runValidators: true }
        );
        if (!payment) throw new Error('Payment not found');
      }

      // Send audit log
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendAuditLog('PAYMENT_STATUS_UPDATED', null, {
          paymentId: id,
          oldStatus: payment.previous?.status || 'unknown',
          newStatus: status
        });
      } catch (kafkaError) {
        console.warn('Kafka not available for audit log:', kafkaError.message);
      }

      return payment;
    } catch (error) {
      throw new Error(`Failed to update payment status: ${error.message}`);
    }
  }

  async getPaymentStats(timeRange = 'month') {
    try {
      const now = new Date();
      let startDate;
      
      switch (timeRange) {
        case 'day':
          startDate = new Date(now.setDate(now.getDate() - 1));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case 'year':
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        default:
          startDate = new Date(0);
      }
      
      if (process.env.DB_TYPE === 'mysql') {
        const { Sequelize } = require('sequelize');
        
        const totalRevenue = await this.Payment.sum('amount', {
          where: {
            status: 'completed',
            date: { [Op.gte]: startDate }
          }
        });
        
        const totalPayments = await this.Payment.count({
          where: {
            status: 'completed',
            date: { [Op.gte]: startDate }
          }
        });
        
        const pendingAmount = await this.Payment.sum('amount', {
          where: {
            status: 'pending',
            date: { [Op.gte]: startDate }
          }
        });
        
        const byMethod = await this.Payment.findAll({
          attributes: [
            'method',
            [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
            [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
          ],
          where: {
            status: 'completed',
            date: { [Op.gte]: startDate }
          },
          group: ['method']
        });
        
        return {
          totalRevenue: totalRevenue || 0,
          totalPayments: totalPayments || 0,
          pendingAmount: pendingAmount || 0,
          byMethod
        };
      } else {
        const totalRevenue = await this.Payment.aggregate([
          { $match: { 
            status: 'completed',
            date: { $gte: startDate }
          }},
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        const totalPayments = await this.Payment.countDocuments({
          status: 'completed',
          date: { $gte: startDate }
        });
        
        const pendingAmount = await this.Payment.aggregate([
          { $match: { 
            status: 'pending',
            date: { $gte: startDate }
          }},
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        const byMethod = await this.Payment.aggregate([
          { $match: { 
            status: 'completed',
            date: { $gte: startDate }
          }},
          { $group: { 
            _id: '$method',
            count: { $sum: 1 },
            total: { $sum: '$amount' }
          }}
        ]);
        
        return {
          totalRevenue: totalRevenue[0]?.total || 0,
          totalPayments: totalPayments || 0,
          pendingAmount: pendingAmount[0]?.total || 0,
          byMethod
        };
      }
    } catch (error) {
      throw new Error(`Failed to get payment stats: ${error.message}`);
    }
  }

  async updateInvoiceStatus(invoiceId, status, paymentId = null) {
    try {
      const updateData = { 
        status,
        ...(status === 'paid' && paymentId ? { paidDate: new Date() } : {})
      };
      
      if (process.env.DB_TYPE === 'mysql') {
        await this.Invoice.update(updateData, { where: { id: invoiceId } });
      } else {
        await this.Invoice.findByIdAndUpdate(invoiceId, updateData);
      }
      
      // Send notification
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendNotification('INVOICE_STATUS_CHANGED', null, {
          invoiceId,
          status,
          paymentId
        });
      } catch (kafkaError) {
        console.warn('Kafka not available for notification:', kafkaError.message);
      }
    } catch (error) {
      console.error('Failed to update invoice status:', error.message);
    }
  }

  async getPaymentsByInvoice(invoiceId) {
    try {
      let payments;
      
      if (process.env.DB_TYPE === 'mysql') {
        payments = await this.Payment.findAll({
          where: { invoiceId },
          order: [['date', 'DESC']]
        });
      } else {
        payments = await this.Payment.find({ invoiceId }).sort({ date: -1 });
      }
      
      return payments;
    } catch (error) {
      throw new Error(`Failed to get payments by invoice: ${error.message}`);
    }
  }

  async getRecentPayments(limit = 10) {
    try {
      let payments;
      
      if (process.env.DB_TYPE === 'mysql') {
        payments = await this.Payment.findAll({
          limit,
          order: [['date', 'DESC']]
        });
      } else {
        payments = await this.Payment.find()
          .limit(limit)
          .sort({ date: -1 });
      }
      
      return payments;
    } catch (error) {
      throw new Error(`Failed to get recent payments: ${error.message}`);
    }
  }
}

module.exports = new PaymentService();