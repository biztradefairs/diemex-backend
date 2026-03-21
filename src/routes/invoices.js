// src/routes/invoices.js
const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/InvoiceController');
const { authenticate, authorize } = require('../middleware/auth');

// Public routes (with authentication)
router.use(authenticate);

// Get my invoices (exhibitor)
router.get('/my-invoices', async (req, res) => {
  try {
    const invoices = await invoiceController.getInvoicesByExhibitor(req.user.id);
    res.json({ success: true, data: invoices });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single invoice
router.get('/:id', async (req, res) => {
  try {
    const invoice = await invoiceController.getInvoiceById(req.params.id);
    
    // Check if user has access
    if (req.user.role !== 'admin' && invoice.exhibitorId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// Download invoice PDF
router.get('/:id/download', async (req, res) => {
  try {
    const pdfBuffer = await invoiceController.generateInvoicePdf(req.params.id);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin routes
router.get('/admin/all', authorize(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const result = await invoiceController.getAllInvoices({ search, status }, page, limit);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/admin/stats', authorize(['admin']), async (req, res) => {
  try {
    const stats = await invoiceController.getInvoiceStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/admin/create', authorize(['admin']), async (req, res) => {
  try {
    const invoice = await invoiceController.createInvoice(req.body);
    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/admin/:id', authorize(['admin']), async (req, res) => {
  try {
    const invoice = await invoiceController.updateInvoice(req.params.id, req.body);
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/admin/:id', authorize(['admin']), async (req, res) => {
  try {
    await invoiceController.deleteInvoice(req.params.id);
    res.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;