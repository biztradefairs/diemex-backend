const { Op, Sequelize } = require('sequelize');
const PDFDocument = require('pdfkit');

class InvoiceService {
  constructor() {
    this._invoiceModel = null;
    this._exhibitorModel = null;
  }

  get Invoice() {
    if (!this._invoiceModel) {
      const modelFactory = require('../models');
      this._invoiceModel = modelFactory.getModel('Invoice');
      if (!this._invoiceModel) {
        throw new Error('Invoice model not found. Make sure models are initialized.');
      }
    }
    return this._invoiceModel;
  }

  get Exhibitor() {
    if (!this._exhibitorModel) {
      const modelFactory = require('../models');
      this._exhibitorModel = modelFactory.getModel('Exhibitor');
    }
    return this._exhibitorModel;
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
    } catch (error) {
      // Fallback to timestamp-based number
      const timestamp = Date.now();
      return `INV-${new Date().getFullYear()}-${timestamp.toString().slice(-8)}`;
    }
  }

  async getAllInvoices(filters = {}, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      let where = {};
      
      // Search filter
      if (filters.search) {
        where[Op.or] = [
          { invoiceNumber: { [Op.like]: `%${filters.search}%` } },
          { company: { [Op.like]: `%${filters.search}%` } }
        ];
      }
      
      // Status filter
      if (filters.status && filters.status !== 'all') {
        where.status = filters.status;
      }
      
      // Exhibitor filter
      if (filters.exhibitorId) {
        where.exhibitorId = filters.exhibitorId;
      }
      
      // Date range filter
      if (filters.startDate && filters.endDate) {
        where.dueDate = {
          [Op.between]: [new Date(filters.startDate), new Date(filters.endDate)]
        };
      }

      // Use Sequelize findAndCountAll
      const result = await this.Invoice.findAndCountAll({
        where,
        limit,
        offset,
        order: [['dueDate', 'ASC']]
      });

      return {
        invoices: result.rows,
        total: result.count,
        page,
        totalPages: Math.ceil(result.count / limit)
      };
    } catch (error) {
      throw new Error(`Failed to fetch invoices: ${error.message}`);
    }
  }

  async getInvoiceById(id) {
    try {
      const invoice = await this.Invoice.findByPk(id);
      
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
      const invoice = await this.Invoice.findByPk(id);
      if (!invoice) throw new Error('Invoice not found');
      
      await invoice.update(updateData);
      return invoice;
    } catch (error) {
      throw new Error(`Failed to update invoice: ${error.message}`);
    }
  }

  async deleteInvoice(id) {
    try {
      const invoice = await this.Invoice.findByPk(id);
      if (!invoice) throw new Error('Invoice not found');
      
      await invoice.destroy();
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete invoice: ${error.message}`);
    }
  }

  async generateInvoicePdf(invoiceId) {
    try {
      const invoice = await this.getInvoiceById(invoiceId);
      
      // Get exhibitor info if exists
      let exhibitor = null;
      if (invoice.exhibitorId) {
        exhibitor = await this.Exhibitor.findByPk(invoice.exhibitorId);
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
      
      if (invoice.items && Array.isArray(invoice.items)) {
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
      // Get total amount for paid invoices
      const totalAmount = await this.Invoice.sum('amount', {
        where: { status: 'paid' }
      });
      
      // Get pending amount
      const pendingAmount = await this.Invoice.sum('amount', {
        where: { status: 'pending' }
      });
      
      // Get overdue amount
      const overdueAmount = await this.Invoice.sum('amount', {
        where: {
          status: 'pending',
          dueDate: { [Op.lt]: new Date() }
        }
      });
      
      // Get counts by status
      const byStatus = await this.Invoice.findAll({
        attributes: [
          'status',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
          [Sequelize.fn('SUM', Sequelize.col('amount')), 'total']
        ],
        group: ['status']
      });
      
      return {
        totalAmount: totalAmount || 0,
        pendingAmount: pendingAmount || 0,
        overdueAmount: overdueAmount || 0,
        byStatus
      };
    } catch (error) {
      throw new Error(`Failed to get invoice stats: ${error.message}`);
    }
  }

  async getOverdueInvoices() {
    try {
      const now = new Date();
      const overdueInvoices = await this.Invoice.findAll({
        where: {
          status: 'pending',
          dueDate: { [Op.lt]: now }
        },
        order: [['dueDate', 'ASC']]
      });
      
      return overdueInvoices;
    } catch (error) {
      throw new Error(`Failed to get overdue invoices: ${error.message}`);
    }
  }

  async getInvoiceByNumber(invoiceNumber) {
    try {
      const invoice = await this.Invoice.findOne({ where: { invoiceNumber } });
      
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
      const invoices = await this.Invoice.findAll({
        where: { exhibitorId },
        order: [['dueDate', 'DESC']]
      });
      
      return invoices;
    } catch (error) {
      throw new Error(`Failed to get invoices by exhibitor: ${error.message}`);
    }
  }
}

module.exports = new InvoiceService();