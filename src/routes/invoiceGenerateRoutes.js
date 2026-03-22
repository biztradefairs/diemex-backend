// src/routes/invoiceGenerateRoutes.js
const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/InvoiceController');
const { authenticate, authorize } = require('../middleware/auth');

// Public routes (with authentication)
router.get('/my-invoices', authenticate, invoiceController.getAllInvoices);
router.get('/my-invoices/:id', authenticate, invoiceController.getInvoice);
router.get('/my-invoices/:id/pdf', authenticate, invoiceController.generateInvoicePdf);
router.get('/my-invoices/:id/details', authenticate, invoiceController.getInvoiceWithDetails);

// Admin routes
router.get('/', authenticate, authorize(['admin']), invoiceController.getAllInvoices);
router.get('/stats', authenticate, authorize(['admin']), invoiceController.getInvoiceStats);
router.get('/:id', authenticate, authorize(['admin']), invoiceController.getInvoice);
router.get('/:id/pdf', authenticate, authorize(['admin']), invoiceController.generateInvoicePdf);
router.get('/:id/details', authenticate, authorize(['admin']), invoiceController.getInvoiceWithDetails);
router.post('/', authenticate, authorize(['admin']), invoiceController.createInvoice);
router.put('/:id', authenticate, authorize(['admin']), invoiceController.updateInvoice);
router.delete('/:id', authenticate, authorize(['admin']), invoiceController.deleteInvoice);
router.post('/bulk', authenticate, authorize(['admin']), invoiceController.bulkGenerateInvoices);
router.post('/:id/send-email', authenticate, authorize(['admin']), invoiceController.sendInvoiceEmail);

module.exports = router;