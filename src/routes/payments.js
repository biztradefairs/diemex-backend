// src/routes/payments.js - UPDATED
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/PaymentController');
const { authenticate, authorize } = require('../middleware/auth');
const { body } = require('express-validator');

// Validation middleware
const validatePayment = [
  body('invoiceNumber').optional().isString(),
  body('amount').isFloat({ min: 0 }),
  body('method').isIn(['credit_card', 'bank_transfer', 'check', 'cash', 'online']),
  body('status').optional().isIn(['pending', 'completed', 'failed', 'refunded'])
];

const validateBulkPayments = [
  body('payments').isArray().withMessage('Payments must be an array'),
  body('payments.*.amount').isFloat({ min: 0 }),
  body('payments.*.method').isIn(['credit_card', 'bank_transfer', 'check', 'cash', 'online'])
];

// All routes require authentication
router.use(authenticate);

// Get all payments (admin only)
router.get('/', authorize(['admin']), paymentController.getAllPayments);

// Get payment stats
router.get('/stats', authorize(['admin']), paymentController.getPaymentStats);

// Get single payment
router.get('/:id', authorize(['admin']), paymentController.getPayment);

// Get payments by invoice
router.get('/invoice/:invoiceId', authorize(['admin']), paymentController.getPaymentsByInvoice);

// Get recent payments
router.get('/recent/latest', authorize(['admin']), paymentController.getRecentPayments);

// Create payment (admin only)
router.post('/', authorize(['admin']), validatePayment, paymentController.createPayment);

// Update payment status (admin only)
router.patch('/:id/status', authorize(['admin']), paymentController.updatePaymentStatus);

// Refund payment (admin only)
router.post('/:id/refund', authorize(['admin']), paymentController.refundPayment);

// Bulk operations
router.post('/bulk/process', authorize(['admin']), validateBulkPayments, paymentController.processBulkPayments);

module.exports = router;