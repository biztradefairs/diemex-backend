// src/routes/payments.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/PaymentController');
const { authenticate, authorize } = require('../middleware/auth');
const { body } = require('express-validator');

// Validation middleware
const validatePayment = [
  body('amount').isFloat({ min: 0 }),
  body('method').isIn(['credit_card', 'bank_transfer', 'check', 'cash']),
  body('status').optional().isIn(['pending', 'completed', 'failed', 'refunded'])
];

// All routes require authentication
router.use(authenticate);

// Get all payments (admin only)
router.get('/', authorize(['admin']), paymentController.getAllPayments);

// Get payment stats
router.get('/stats', authorize(['admin']), paymentController.getPaymentStats);

// Get single payment
router.get('/:id', authorize(['admin']), paymentController.getPayment);

// Create payment (admin only)
router.post('/', authorize(['admin']), validatePayment, paymentController.createPayment);

// Update payment status (admin only)
router.patch('/:id/status', authorize(['admin']), paymentController.updatePaymentStatus);

// Refund payment (admin only)
router.post('/:id/refund', authorize(['admin']), paymentController.refundPayment);

// Bulk operations
router.post('/bulk/process', authorize(['admin']), paymentController.processBulkPayments);

module.exports = router;