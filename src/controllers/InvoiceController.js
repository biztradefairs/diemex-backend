const invoiceService = require('../services/InvoiceService');

class InvoiceController {
  async createInvoice(req, res) {
    try {
      const invoice = await invoiceService.createInvoice(req.body);
      res.status(201).json({
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

  async getAllInvoices(req, res) {
    try {
      const { page = 1, limit = 10, search, status } = req.query;
      
      const filters = {};
      if (search) filters.search = search;
      if (status) filters.status = status;
      
      const result = await invoiceService.getAllInvoices(filters, parseInt(page), parseInt(limit));
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getInvoice(req, res) {
    try {
      const invoice = await invoiceService.getInvoiceById(req.params.id);
      
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
      const invoice = await invoiceService.updateInvoice(req.params.id, req.body);
      
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
      await invoiceService.deleteInvoice(req.params.id);
      
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
      const pdfBuffer = await invoiceService.generateInvoicePdf(req.params.id);
      
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
      
      // For now, just return success
      res.json({
        success: true,
        message: 'Invoice email would be sent to: ' + email
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
      const stats = await invoiceService.getInvoiceStats();
      
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
      // Simplified version - just create one invoice
      const invoice = await invoiceService.createInvoice({
        ...req.body,
        invoiceNumber: `INV-${Date.now()}`
      });
      
      res.json({
        success: true,
        data: [invoice],
        message: 'Invoice generated successfully'
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