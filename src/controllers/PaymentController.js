// src/controllers/PaymentController.js
const paymentService = require('../services/PaymentService');

class PaymentController {
  async createPayment(req, res) {
    try {
      const paymentData = {
        ...req.body,
        processedBy: req.user.id
      };
      
      const payment = await paymentService.createPayment(paymentData);
      
      res.status(201).json({
        success: true,
        data: payment
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getAllPayments(req, res) {
    try {
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
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getPayment(req, res) {
    try {
      const payment = await paymentService.getPaymentById(req.params.id);
      
      res.json({
        success: true,
        data: payment
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  async updatePaymentStatus(req, res) {
    try {
      const { status, notes } = req.body;
      
      const payment = await paymentService.updatePaymentStatus(req.params.id, status, notes);
      
      res.json({
        success: true,
        data: payment,
        message: `Payment status updated to ${status}`
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getPaymentStats(req, res) {
    try {
      const { timeRange = 'month' } = req.query;
      const stats = await paymentService.getPaymentStats(timeRange);
      
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

  async processBulkPayments(req, res) {
    try {
      const { payments } = req.body;
      
      if (!payments || !Array.isArray(payments)) {
        throw new Error('Payments array is required');
      }
      
      const results = await Promise.all(
        payments.map(payment => paymentService.createPayment({
          ...payment,
          processedBy: req.user.id
        }))
      );
      
      res.json({
        success: true,
        data: results,
        message: `Processed ${results.length} payments`
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async refundPayment(req, res) {
    try {
      const { reason } = req.body;
      
      // Mark payment as refunded
      const payment = await paymentService.updatePaymentStatus(
        req.params.id, 
        'refunded', 
        `Refunded: ${reason}`
      );
      
      // Create a negative payment for the refund
      const refundPayment = await paymentService.createPayment({
        amount: -payment.amount,
        invoiceId: payment.invoiceId,
        method: payment.method,
        status: 'completed',
        notes: `Refund for payment ${payment.id}: ${reason}`,
        processedBy: req.user.id
      });
      
      res.json({
        success: true,
        data: {
          originalPayment: payment,
          refundPayment
        },
        message: 'Payment refunded successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new PaymentController();