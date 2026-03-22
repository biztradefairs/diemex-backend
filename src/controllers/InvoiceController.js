// src/controllers/InvoiceController.js
const invoiceService = require('../services/InvoiceService');
const pdfGenerationService = require('../services/PDFGenerationService');

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

  // Generate PDF with full details
  async generateInvoicePdf(req, res) {
    try {
      const invoice = await invoiceService.getInvoiceById(req.params.id);
      
      // Get requirement data if available
      let requirementData = null;
      if (invoice.metadata?.requirementsId) {
        try {
          const modelFactory = require('../models');
          const Requirement = modelFactory.getModel('Requirement');
          const requirement = await Requirement.findByPk(invoice.metadata.requirementsId);
          requirementData = requirement?.data || null;
        } catch (error) {
          console.warn('Could not fetch requirement data:', error.message);
        }
      }
      
      const pdfBuffer = await pdfGenerationService.generateInvoicePDF(invoice, requirementData);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
      
    } catch (error) {
      console.error('PDF Generation Error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Generate and send invoice PDF via email
  async sendInvoiceEmail(req, res) {
    try {
      const { email } = req.body;
      const invoice = await invoiceService.getInvoiceById(req.params.id);
      
      if (!email) {
        throw new Error('Email address is required');
      }
      
      // Generate PDF
      let requirementData = null;
      if (invoice.metadata?.requirementsId) {
        try {
          const modelFactory = require('../models');
          const Requirement = modelFactory.getModel('Requirement');
          const requirement = await Requirement.findByPk(invoice.metadata.requirementsId);
          requirementData = requirement?.data || null;
        } catch (error) {
          console.warn('Could not fetch requirement data:', error.message);
        }
      }
      
      const pdfBuffer = await pdfGenerationService.generateInvoicePDF(invoice, requirementData);
      
      // Send email with PDF attachment
      const emailService = require('../services/EmailService');
      await emailService.sendInvoiceEmail({
        to: email,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        pdfBuffer,
        dueDate: invoice.dueDate
      });
      
      res.json({
        success: true,
        message: `Invoice email sent to ${email}`
      });
      
    } catch (error) {
      console.error('Email sending error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get invoice with full details for display
  async getInvoiceWithDetails(req, res) {
    try {
      const invoice = await invoiceService.getInvoiceById(req.params.id);
      
      // Get requirement data
      let requirementData = null;
      if (invoice.metadata?.requirementsId) {
        try {
          const modelFactory = require('../models');
          const Requirement = modelFactory.getModel('Requirement');
          const requirement = await Requirement.findByPk(invoice.metadata.requirementsId);
          requirementData = requirement?.data || null;
        } catch (error) {
          console.warn('Could not fetch requirement data:', error.message);
        }
      }
      
      // Combine invoice with requirement data
      const fullData = {
        ...invoice.toJSON(),
        exhibitorDetails: invoice.metadata?.exhibitorInfo || requirementData?.generalInfo || {},
        boothDetails: requirementData?.boothDetails || {},
        services: invoice.items || [],
        paymentDetails: invoice.metadata?.paymentInfo || {},
        totals: invoice.metadata?.totals || {
          subtotal: invoice.amount,
          gst: invoice.amount * 0.18,
          total: invoice.amount
        }
      };
      
      res.json({
        success: true,
        data: fullData
      });
      
    } catch (error) {
      console.error('Error fetching invoice with details:', error);
      res.status(404).json({
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
      const invoices = await Promise.all(
        req.body.map(data => invoiceService.createInvoice({
          ...data,
          invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
        }))
      );
      
      res.json({
        success: true,
        data: invoices,
        message: `${invoices.length} invoices generated successfully`
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