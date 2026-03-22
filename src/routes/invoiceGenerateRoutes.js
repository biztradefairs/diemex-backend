// src/routes/invoiceGenerateRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const invoiceService = require('../services/InvoiceService');

// Generate invoice from requirements
router.post('/generate-from-requirements', authenticate, async (req, res) => {
  try {
    const {
      requirementsId,
      exhibitorId,
      exhibitorInfo,
      paymentInfo,
      items,
      totals,
      invoiceNumber,
      issueDate,
      dueDate,
      notes
    } = req.body;

    // Validate required fields
    if (!requirementsId || !exhibitorInfo || !items || !totals) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: requirementsId, exhibitorInfo, items, totals'
      });
    }

    // Ensure items have proper structure
    const formattedItems = items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total
    }));

    // Add GST as a separate line item if not already included
    if (totals.gst > 0 && !formattedItems.some(item => item.description.includes('GST'))) {
      formattedItems.push({
        description: 'GST (18%) on Services',
        quantity: 1,
        unitPrice: totals.gst,
        total: totals.gst
      });
    }

    // Create invoice data
    const invoiceData = {
      requirementsId,
      exhibitorId: exhibitorId || req.user.id,
      exhibitorInfo: {
        name: exhibitorInfo.name,
        companyName: exhibitorInfo.companyName,
        email: exhibitorInfo.email,
        phone: exhibitorInfo.phone,
        address: exhibitorInfo.address,
        gstNumber: exhibitorInfo.gstNumber,
        boothNumber: exhibitorInfo.boothNumber
      },
      paymentInfo: paymentInfo || {},
      items: formattedItems,
      totals: {
        subtotal: totals.servicesTotal,
        gst: totals.gst,
        total: totals.total,
        deposit: totals.deposit
      },
      invoiceNumber: invoiceNumber || `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`,
      issueDate: issueDate || new Date().toISOString(),
      dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      notes: notes || `Thank you for your exhibition registration. This invoice includes all services requested.\n\nBooth Number: ${exhibitorInfo.boothNumber || 'To be assigned'}`
    };

    // Create invoice
    const invoice = await invoiceService.createInvoice(invoiceData);

    res.json({
      success: true,
      message: 'Invoice generated successfully',
      data: invoice
    });

  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;