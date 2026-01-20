// src/routes/invoices.js
const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/InvoiceController');
const { authenticate, authorize } = require('../middleware/auth');
const { body } = require('express-validator');

// Validation middleware
const validateInvoice = [
  body('company').notEmpty().trim(),
  body('amount').isFloat({ min: 0 }),
  body('dueDate').isISO8601()
];

// All routes require authentication
router.use(authenticate);

// Get all invoices (admin only)
router.get('/', authorize(['admin']), invoiceController.getAllInvoices);

// Get invoice stats
router.get('/stats', authorize(['admin']), invoiceController.getInvoiceStats);

// Get single invoice
router.get('/:id', authorize(['admin']), invoiceController.getInvoice);

// Create invoice (admin only)
router.post('/', authorize(['admin']), validateInvoice, invoiceController.createInvoice);

// Update invoice (admin only)
router.put('/:id', authorize(['admin']), invoiceController.updateInvoice);

// Delete invoice (admin only)
router.delete('/:id', authorize(['admin']), invoiceController.deleteInvoice);

// Generate PDF
router.get('/:id/pdf', authorize(['admin']), invoiceController.generateInvoicePdf);

// Send email
router.post('/:id/send-email', authorize(['admin']), invoiceController.sendInvoiceEmail);

// Bulk generate invoices
router.post('/bulk/generate', authorize(['admin']), invoiceController.bulkGenerateInvoices);

module.exports = router;