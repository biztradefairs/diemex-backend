const invoiceService = require('../services/InvoiceService');

class InvoiceController {
  async createInvoice(req, res) {
    const invoice = await invoiceService.createInvoice(req.body);
    res.status(201).json({ success: true, data: invoice });
  }

  async getAllInvoices(req, res) {
    const result = await invoiceService.getAllInvoices(
      req.query,
      Number(req.query.page || 1),
      Number(req.query.limit || 10)
    );
    res.json({ success: true, data: result });
  }

  async getInvoice(req, res) {
    try {
      const invoice = await this.invoiceService.getInvoiceById(req.params.id);
      
      res.json({
        success: true,
        data: invoice
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateInvoice(req, res) {
    try {
      const invoice = await this.invoiceService.updateInvoice(req.params.id, req.body);
      
      res.json({
        success: true,
        data: invoice
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteInvoice(req, res) {
    try {
      await this.invoiceService.deleteInvoice(req.params.id);
      
      res.json({
        success: true,
        message: 'Invoice deleted successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async generateInvoicePdf(req, res) {
    try {
      const pdfBuffer = await this.invoiceService.generateInvoicePdf(req.params.id);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${req.params.id}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async sendInvoiceEmail(req, res) {
    try {
      const { email } = req.body;
      
      if (!email) {
        throw new Error('Email address is required');
      }
      
      const result = await this.invoiceService.sendInvoiceEmail(req.params.id, email);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getInvoiceStats(req, res) {
    try {
      const stats = await this.invoiceService.getInvoiceStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async bulkGenerateInvoices(req, res) {
    try {
      const { exhibitorIds, templateId, amount, dueDate } = req.body;
      
      if (!exhibitorIds || !Array.isArray(exhibitorIds)) {
        throw new Error('Exhibitor IDs are required');
      }
      
      const results = await Promise.all(
        exhibitorIds.map(async (exhibitorId) => {
          // Get exhibitor model
          const modelFactory = require('../models');
          const Exhibitor = modelFactory.getModel('Exhibitor');
          
          let exhibitor;
          
          if (process.env.DB_TYPE === 'mysql') {
            exhibitor = await Exhibitor.findByPk(exhibitorId);
          } else {
            exhibitor = await Exhibitor.findById(exhibitorId);
          }
          
          if (!exhibitor) {
            throw new Error(`Exhibitor ${exhibitorId} not found`);
          }
          
          // Create invoice for exhibitor
          return this.invoiceService.createInvoice({
            exhibitorId: exhibitor.id,
            company: exhibitor.company,
            amount: amount || 1000,
            dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            items: [
              {
                description: 'Exhibition Booth Fee',
                amount: amount || 1000,
                quantity: 1
              }
            ],
            notes: 'Auto-generated invoice'
          });
        })
      );
      
      res.json({
        success: true,
        data: results,
        message: `Generated ${results.length} invoices`
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new InvoiceController();