// src/services/InvoiceService.js
const { Op } = require('sequelize');
const PDFDocument = require('pdfkit');

class InvoiceService {
  constructor() {
    this._invoiceModel = null;
    this._exhibitorModel = null;
    this._paymentModel = null;
  }

  // Lazy getter for Invoice model
  get Invoice() {
    if (!this._invoiceModel) {
      const modelFactory = require('../models');
      this._invoiceModel = modelFactory.getModel('Invoice');
    }
    return this._invoiceModel;
  }

  // Lazy getter for Exhibitor model
  get Exhibitor() {
    if (!this._exhibitorModel) {
      const modelFactory = require('../models');
      this._exhibitorModel = modelFactory.getModel('Exhibitor');
    }
    return this._exhibitorModel;
  }

  // Lazy getter for Payment model
  get Payment() {
    if (!this._paymentModel) {
      const modelFactory = require('../models');
      this._paymentModel = modelFactory.getModel('Payment');
    }
    return this._paymentModel;
  }

  async createInvoice(invoiceData) {
    try {
      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber();
      
      const invoice = await this.Invoice.create({
        ...invoiceData,
        invoiceNumber,
        status: 'pending',
        issueDate: new Date()
      });
      
      // Send notification
      if (invoice.exhibitorId) {
        try {
          const kafkaProducer = require('../kafka/producer');
          const exhibitor = await this.Exhibitor.findByPk(invoice.exhibitorId);
          if (exhibitor) {
            await kafkaProducer.sendNotification('INVOICE_CREATED', null, {
              invoiceId: invoice.id,
              invoiceNumber: invoiceNumber,
              company: exhibitor.company,
              amount: invoice.amount
            });
          }
        } catch (kafkaError) {
          console.warn('Kafka not available for notification:', kafkaError.message);
        }
      }
      
      // Send audit log
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendAuditLog('INVOICE_CREATED', null, {
          invoiceId: invoice.id,
          invoiceNumber: invoiceNumber,
          amount: invoice.amount
        });
      } catch (kafkaError) {
        console.warn('Kafka not available for audit log:', kafkaError.message);
      }

      return invoice;
    } catch (error) {
      throw new Error(`Failed to create invoice: ${error.message}`);
    }
  }

  async generateInvoiceNumber() {
    try {
      const year = new Date().getFullYear();
      const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
      const prefix = `INV-${year}${month}-`;
      
      if (process.env.DB_TYPE === 'mysql') {
        const lastInvoice = await this.Invoice.findOne({
          where: {
            invoiceNumber: {
              [Op.like]: `${prefix}%`
            }
          },
          order: [['createdAt', 'DESC']]
        });
        
        let nextNumber = 1;
        if (lastInvoice) {
          const lastNumber = parseInt(lastInvoice.invoiceNumber.replace(prefix, ''));
          nextNumber = lastNumber + 1;
        }
        
        return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
      } else {
        const lastInvoice = await this.Invoice.findOne({
          invoiceNumber: { $regex: `^${prefix}` }
        }).sort({ createdAt: -1 });
        
        let nextNumber = 1;
        if (lastInvoice) {
          const lastNumber = parseInt(lastInvoice.invoiceNumber.replace(prefix, ''));
          nextNumber = lastNumber + 1;
        }
        
        return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
      }
    } catch (error) {
      // Fallback to timestamp-based number
      const timestamp = Date.now();
      return `INV-${new Date().getFullYear()}-${timestamp.toString().slice(-8)}`;
    }
  }

  async getAllInvoices(filters = {}, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      let query = {};
      
      if (filters.search) {
        if (process.env.DB_TYPE === 'mysql') {
          query[Op.or] = [
            { invoiceNumber: { [Op.like]: `%${filters.search}%` } },
            { company: { [Op.like]: `%${filters.search}%` } }
          ];
        } else {
          query.$or = [
            { invoiceNumber: { $regex: filters.search, $options: 'i' } },
            { company: { $regex: filters.search, $options: 'i' } }
          ];
        }
      }
      
      if (filters.status && filters.status !== 'all') {
        query.status = filters.status;
      }
      
      if (filters.exhibitorId) {
        query.exhibitorId = filters.exhibitorId;
      }
      
      if (filters.startDate && filters.endDate) {
        if (process.env.DB_TYPE === 'mysql') {
          query.dueDate = {
            [Op.between]: [new Date(filters.startDate), new Date(filters.endDate)]
          };
        } else {
          query.dueDate = {
            $gte: new Date(filters.startDate),
            $lte: new Date(filters.endDate)
          };
        }
      }

      let invoices, total;
      
      if (process.env.DB_TYPE === 'mysql') {
        const result = await this.Invoice.findAndCountAll({
          where: query,
          limit,
          offset,
          order: [['dueDate', 'ASC']]
        });
        
        invoices = result.rows;
        total = result.count;
      } else {
        invoices = await this.Invoice.find(query)
          .skip(offset)
          .limit(limit)
          .sort({ dueDate: 1 });
        
        total = await this.Invoice.countDocuments(query);
      }

      return {
        invoices,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      throw new Error(`Failed to fetch invoices: ${error.message}`);
    }
  }

  async getInvoiceById(id) {
    try {
      let invoice;
      
      if (process.env.DB_TYPE === 'mysql') {
        invoice = await this.Invoice.findByPk(id);
      } else {
        invoice = await this.Invoice.findById(id);
      }
      
      if (!invoice) {
        throw new Error('Invoice not found');
      }
      
      return invoice;
    } catch (error) {
      throw new Error(`Failed to fetch invoice: ${error.message}`);
    }
  }

  async updateInvoice(id, updateData) {
    try {
      let invoice;
      
      if (process.env.DB_TYPE === 'mysql') {
        invoice = await this.Invoice.findByPk(id);
        if (!invoice) throw new Error('Invoice not found');
        await invoice.update(updateData);
      } else {
        invoice = await this.Invoice.findByIdAndUpdate(
          id,
          updateData,
          { new: true, runValidators: true }
        );
        if (!invoice) throw new Error('Invoice not found');
      }

      // Send audit log
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendAuditLog('INVOICE_UPDATED', null, {
          invoiceId: id,
          invoiceNumber: invoice.invoiceNumber
        });
      } catch (kafkaError) {
        console.warn('Kafka not available for audit log:', kafkaError.message);
      }

      return invoice;
    } catch (error) {
      throw new Error(`Failed to update invoice: ${error.message}`);
    }
  }

  async deleteInvoice(id) {
    try {
      let result;
      
      if (process.env.DB_TYPE === 'mysql') {
        const invoice = await this.Invoice.findByPk(id);
        if (!invoice) throw new Error('Invoice not found');
        await invoice.destroy();
        result = { success: true };
      } else {
        result = await this.Invoice.findByIdAndDelete(id);
        if (!result) throw new Error('Invoice not found');
      }

      // Send audit log
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendAuditLog('INVOICE_DELETED', null, {
          invoiceId: id
        });
      } catch (kafkaError) {
        console.warn('Kafka not available for audit log:', kafkaError.message);
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to delete invoice: ${error.message}`);
    }
  }

  async generateInvoicePdf(invoiceId) {
    try {
      const invoice = await this.getInvoiceById(invoiceId);
      
      // Get exhibitor info
      let exhibitor = null;
      if (invoice.exhibitorId) {
        if (process.env.DB_TYPE === 'mysql') {
          exhibitor = await this.Exhibitor.findByPk(invoice.exhibitorId);
        } else {
          exhibitor = await this.Exhibitor.findById(invoice.exhibitorId);
        }
      }
      
      // Create PDF document
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4'
      });
      
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      
      // Header
      doc.fontSize(24).fillColor('#2c3e50').text('INVOICE', { align: 'center' });
      doc.moveDown();
      
      // Invoice details
      doc.fontSize(12).fillColor('#34495e');
      doc.text(`Invoice Number: ${invoice.invoiceNumber}`);
      doc.text(`Issue Date: ${new Date(invoice.issueDate).toLocaleDateString()}`);
      doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`);
      doc.text(`Status: ${invoice.status.toUpperCase()}`);
      doc.moveDown();
      
      // Bill To
      doc.fontSize(14).fillColor('#2c3e50').text('Bill To:', { underline: true });
      doc.fontSize(12).fillColor('#34495e');
      doc.text(invoice.company);
      if (exhibitor) {
        doc.text(`Contact: ${exhibitor.name || ''}`);
        doc.text(`Email: ${exhibitor.email || ''}`);
        doc.text(`Phone: ${exhibitor.phone || ''}`);
      }
      doc.moveDown();
      
      // Items table
      doc.fontSize(14).fillColor('#2c3e50').text('Invoice Items', { underline: true });
      doc.moveDown();
      
      // Table header
      doc.fontSize(10).fillColor('#7f8c8d');
      doc.text('Description', 50, doc.y);
      doc.text('Quantity', 300, doc.y);
      doc.text('Amount', 400, doc.y, { width: 100, align: 'right' });
      doc.moveDown();
      doc.strokeColor('#bdc3c7').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();
      
      // Items
      doc.fontSize(10).fillColor('#2c3e50');
      let totalAmount = 0;
      
      if (invoice.items && invoice.items.length > 0) {
        invoice.items.forEach((item) => {
          const amount = item.amount * (item.quantity || 1);
          totalAmount += amount;
          
          doc.text(item.description, 50, doc.y);
          doc.text((item.quantity || 1).toString(), 300, doc.y);
          doc.text(`$${amount.toFixed(2)}`, 400, doc.y, { width: 100, align: 'right' });
          doc.moveDown();
        });
      } else {
        doc.text('No items', 50, doc.y);
        doc.moveDown();
      }
      
      doc.moveDown();
      doc.strokeColor('#bdc3c7').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();
      
      // Total
      doc.fontSize(12).fillColor('#2c3e50');
      doc.text('Total Amount:', 400, doc.y, { width: 100, align: 'right' });
      doc.text(`$${totalAmount.toFixed(2)}`, 450, doc.y, { width: 100, align: 'right' });
      doc.moveDown(2);
      
      // Notes
      if (invoice.notes) {
        doc.fontSize(10).fillColor('#7f8c8d').text('Notes:', { underline: true });
        doc.text(invoice.notes);
        doc.moveDown();
      }
      
      // Footer
      doc.fontSize(8).fillColor('#95a5a6').text('Thank you for your business!', { align: 'center' });
      doc.text('This is a computer-generated invoice.', { align: 'center' });
      
      doc.end();
      
      // Wait for PDF to finish
      return new Promise((resolve, reject) => {
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          resolve(pdfBuffer);
        });
        
        doc.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Failed to generate PDF: ${error.message}`);
    }
  }

  async getInvoiceStats() {
    try {
      if (process.env.DB_TYPE === 'mysql') {
        const { Sequelize } = require('sequelize');
        
        const totalAmount = await this.Invoice.sum('amount', {
          where: { status: 'paid' }
        });
        
        const pendingAmount = await this.Invoice.sum('amount', {
          where: { status: 'pending' }
        });
        
        const overdueAmount = await this.Invoice.sum('amount', {
          where: {
            status: 'pending',
            dueDate: { [Op.lt]: new Date() }
          }
        });
        
        const byStatus = await this.Invoice.findAll({
          attributes: [
            'status',
            [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
            [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
          ],
          group: ['status']
        });
        
        // Get monthly invoice totals
        const monthlyInvoices = await this.Invoice.findAll({
          attributes: [
            [Sequelize.fn('DATE_FORMAT', Sequelize.col('issueDate'), '%Y-%m'), 'month'],
            [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
            [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
          ],
          where: {
            issueDate: { [Op.gte]: new Date(new Date().setMonth(new Date().getMonth() - 6)) }
          },
          group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('issueDate'), '%Y-%m')],
          order: [[Sequelize.fn('DATE_FORMAT', Sequelize.col('issueDate'), '%Y-%m'), 'ASC']]
        });
        
        return {
          totalAmount: totalAmount || 0,
          pendingAmount: pendingAmount || 0,
          overdueAmount: overdueAmount || 0,
          byStatus,
          monthlyInvoices
        };
      } else {
        const totalAmount = await this.Invoice.aggregate([
          { $match: { status: 'paid' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        const pendingAmount = await this.Invoice.aggregate([
          { $match: { status: 'pending' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        const overdueAmount = await this.Invoice.aggregate([
          { $match: { 
            status: 'pending',
            dueDate: { $lt: new Date() }
          }},
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        const byStatus = await this.Invoice.aggregate([
          { $group: { 
            _id: '$status',
            count: { $sum: 1 },
            total: { $sum: '$amount' }
          }}
        ]);
        
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const monthlyInvoices = await this.Invoice.aggregate([
          { $match: { issueDate: { $gte: sixMonthsAgo } } },
          { $group: { 
            _id: { 
              year: { $year: '$issueDate' },
              month: { $month: '$issueDate' }
            },
            count: { $sum: 1 },
            total: { $sum: '$amount' }
          }},
          { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);
        
        return {
          totalAmount: totalAmount[0]?.total || 0,
          pendingAmount: pendingAmount[0]?.total || 0,
          overdueAmount: overdueAmount[0]?.total || 0,
          byStatus,
          monthlyInvoices
        };
      }
    } catch (error) {
      throw new Error(`Failed to get invoice stats: ${error.message}`);
    }
  }

  async getOverdueInvoices() {
    try {
      const now = new Date();
      let overdueInvoices;
      
      if (process.env.DB_TYPE === 'mysql') {
        overdueInvoices = await this.Invoice.findAll({
          where: {
            status: 'pending',
            dueDate: { [Op.lt]: now }
          },
          order: [['dueDate', 'ASC']]
        });
      } else {
        overdueInvoices = await this.Invoice.find({
          status: 'pending',
          dueDate: { $lt: now }
        }).sort({ dueDate: 1 });
      }
      
      return overdueInvoices;
    } catch (error) {
      throw new Error(`Failed to get overdue invoices: ${error.message}`);
    }
  }

  async getInvoiceByNumber(invoiceNumber) {
    try {
      let invoice;
      
      if (process.env.DB_TYPE === 'mysql') {
        invoice = await this.Invoice.findOne({ where: { invoiceNumber } });
      } else {
        invoice = await this.Invoice.findOne({ invoiceNumber });
      }
      
      if (!invoice) {
        throw new Error('Invoice not found');
      }
      
      return invoice;
    } catch (error) {
      throw new Error(`Failed to get invoice by number: ${error.message}`);
    }
  }

  async markInvoiceAsPaid(invoiceId, paymentId = null) {
    try {
      return await this.updateInvoice(invoiceId, {
        status: 'paid',
        paidDate: new Date(),
        ...(paymentId ? { paymentId } : {})
      });
    } catch (error) {
      throw new Error(`Failed to mark invoice as paid: ${error.message}`);
    }
  }

  async getInvoicesByExhibitor(exhibitorId) {
    try {
      let invoices;
      
      if (process.env.DB_TYPE === 'mysql') {
        invoices = await this.Invoice.findAll({
          where: { exhibitorId },
          order: [['dueDate', 'DESC']]
        });
      } else {
        invoices = await this.Invoice.find({ exhibitorId }).sort({ dueDate: -1 });
      }
      
      return invoices;
    } catch (error) {
      throw new Error(`Failed to get invoices by exhibitor: ${error.message}`);
    }
  }
}

module.exports = new InvoiceService();