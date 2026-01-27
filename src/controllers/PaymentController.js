// src/controllers/PaymentController.js - UPDATED
const paymentService = require('../services/PaymentService');

class PaymentController {
  constructor() {
    // Ensure service is initialized for all routes
    this.initializeService();
  }

  async initializeService() {
    try {
      console.log('🔧 PaymentController: Initializing PaymentService...');
      // This ensures the service is ready when requests come in
      await paymentService.ensureInitialized();
      console.log('✅ PaymentController: PaymentService initialized');
    } catch (error) {
      console.error('❌ PaymentController: Failed to initialize PaymentService:', error);
    }
  }

  async createPayment(req, res) {
    try {
      console.log('📝 PaymentController: Creating payment request received');
      
      const paymentData = {
        ...req.body,
        processedBy: req.user.id
      };
      
      const payment = await paymentService.createPayment(paymentData);
      
      res.status(201).json({
        success: true,
        data: payment,
        message: 'Payment created successfully'
      });
    } catch (error) {
      console.error('❌ PaymentController: Error creating payment:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getAllPayments(req, res) {
    try {
      console.log('📋 PaymentController: Get all payments request received');
      
      const { 
        page = 1, 
        limit = 10, 
        search, 
        status, 
        method,
        startDate,
        endDate 
      } = req.query;
      
      const filters = {};
      if (search) filters.search = search;
      if (status) filters.status = status;
      if (method) filters.method = method;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      
      const result = await paymentService.getAllPayments(filters, parseInt(page), parseInt(limit));
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('❌ PaymentController: Error getting all payments:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getPayment(req, res) {
    try {
      console.log(`🔍 PaymentController: Get payment request for ID: ${req.params.id}`);
      
      const payment = await paymentService.getPaymentById(req.params.id);
      
      res.json({
        success: true,
        data: payment
      });
    } catch (error) {
      console.error(`❌ PaymentController: Error getting payment ${req.params.id}:`, error);
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  async updatePaymentStatus(req, res) {
    try {
      console.log(`🔄 PaymentController: Update payment status request for ID: ${req.params.id}`);
      
      const { status, notes } = req.body;
      
      const payment = await paymentService.updatePaymentStatus(req.params.id, status, notes);
      
      res.json({
        success: true,
        data: payment,
        message: `Payment status updated to ${status}`
      });
    } catch (error) {
      console.error(`❌ PaymentController: Error updating payment status for ${req.params.id}:`, error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getPaymentStats(req, res) {
    try {
      console.log('📊 PaymentController: Get payment stats request received');
      
      const { timeRange = 'month' } = req.query;
      const stats = await paymentService.getPaymentStats(timeRange);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('❌ PaymentController: Error getting payment stats:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async processBulkPayments(req, res) {
    try {
      console.log('📦 PaymentController: Process bulk payments request received');
      
      const { payments } = req.body;
      
      if (!payments || !Array.isArray(payments)) {
        throw new Error('Payments array is required');
      }
      
      console.log(`📦 Processing ${payments.length} payments in bulk`);
      
      const results = await Promise.all(
        payments.map(payment => paymentService.createPayment({
          ...payment,
          processedBy: req.user.id
        }))
      );
      
      res.json({
        success: true,
        data: results,
        message: `Processed ${results.length} payments successfully`
      });
    } catch (error) {
      console.error('❌ PaymentController: Error processing bulk payments:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async refundPayment(req, res) {
    try {
      console.log(`💸 PaymentController: Refund payment request for ID: ${req.params.id}`);
      
      const { reason } = req.body;
      
      if (!reason) {
        throw new Error('Refund reason is required');
      }
      
      const result = await paymentService.refundPayment(req.params.id, reason);
      
      res.json({
        success: true,
        data: result,
        message: 'Payment refunded successfully'
      });
    } catch (error) {
      console.error(`❌ PaymentController: Error refunding payment ${req.params.id}:`, error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getPaymentsByInvoice(req, res) {
    try {
      console.log(`🔍 PaymentController: Get payments by invoice request for invoice: ${req.params.invoiceId}`);
      
      const payments = await paymentService.getPaymentsByInvoice(req.params.invoiceId);
      
      res.json({
        success: true,
        data: payments
      });
    } catch (error) {
      console.error(`❌ PaymentController: Error getting payments for invoice ${req.params.invoiceId}:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getRecentPayments(req, res) {
    try {
      console.log('📋 PaymentController: Get recent payments request received');
      
      const limit = parseInt(req.query.limit) || 10;
      const payments = await paymentService.getRecentPayments(limit);
      
      res.json({
        success: true,
        data: payments
      });
    } catch (error) {
      console.error('❌ PaymentController: Error getting recent payments:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

// Create instance and initialize
const paymentController = new PaymentController();
module.exports = paymentController;