// src/routes/exhibitorDashboard.js
const express = require('express');
const router = express.Router();
const { authenticateExhibitor } = require('../middleware/auth');

// All routes require exhibitor authentication
router.use(authenticateExhibitor);

// Get exhibitor's stall layout
router.get('/layout', async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Exhibitor = modelFactory.getModel('Exhibitor');
    
    let exhibitor;
    if (process.env.DB_TYPE === 'mysql') {
      exhibitor = await Exhibitor.findByPk(req.user.id);
    } else {
      exhibitor = await Exhibitor.findById(req.user.id);
    }
    
    if (!exhibitor) {
      return res.status(404).json({
        success: false,
        error: 'Exhibitor not found'
      });
    }
    
    // Get floor plan service
    const floorPlanService = require('../services/FloorPlanService');
    
    // Get all floor plans to find exhibitor's booth
    const floorPlans = await floorPlanService.getAllFloorPlans({}, 1, 100);
    
    // Find the booth in floor plans
    let boothDetails = null;
    let floorPlan = null;
    
    for (const fp of floorPlans.floorPlans) {
      if (fp.shapes && Array.isArray(fp.shapes)) {
        const booth = fp.shapes.find(shape => 
          shape.metadata && shape.metadata.boothNumber === exhibitor.boothNumber
        );
        if (booth) {
          boothDetails = booth;
          floorPlan = fp;
          break;
        }
      }
    }
    
    // Get invoice service
    const invoiceService = require('../services/InvoiceService');
    const invoices = await invoiceService.getInvoicesByExhibitor(exhibitor.id);
    
    res.json({
      success: true,
      data: {
        exhibitor: {
          id: exhibitor.id,
          name: exhibitor.name,
          company: exhibitor.company,
          email: exhibitor.email,
          phone: exhibitor.phone,
          boothNumber: exhibitor.boothNumber,
          stallDetails: exhibitor.stallDetails
        },
        floorPlan: floorPlan ? {
          id: floorPlan.id,
          name: floorPlan.name,
          floor: floorPlan.floor,
          scale: floorPlan.scale,
          gridSize: floorPlan.gridSize
        } : null,
        booth: boothDetails,
        invoices: invoices
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get exhibitor's invoices
router.get('/invoices', async (req, res) => {
  try {
    const invoiceService = require('../services/InvoiceService');
    const invoices = await invoiceService.getInvoicesByExhibitor(req.user.id);
    
    res.json({
      success: true,
      data: invoices
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get exhibitor's requirements
router.get('/requirements', async (req, res) => {
  try {
    // This would connect to your requirements service
    // For now, return sample data
    res.json({
      success: true,
      data: [
        {
          id: 'REQ001',
          type: 'electrical',
          description: 'Additional power outlet',
          status: 'approved',
          cost: 150
        },
        {
          id: 'REQ002',
          type: 'furniture',
          description: 'Extra chairs',
          status: 'pending',
          cost: 80
        }
      ]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Submit requirement
router.post('/requirements', async (req, res) => {
  try {
    const { type, description, quantity } = req.body;
    
    // Save requirement to database
    // This would connect to your requirements service
    
    // Send notification to admin
    try {
      const kafkaProducer = require('../kafka/producer');
      await kafkaProducer.sendNotification('EXHIBITOR_REQUIREMENT_SUBMITTED', req.user.id, {
        type,
        description,
        quantity
      });
    } catch (kafkaError) {
      console.warn('Kafka not available:', kafkaError.message);
    }
    
    res.json({
      success: true,
      message: 'Requirement submitted successfully',
      data: {
        id: 'REQ' + Date.now().toString().slice(-6),
        type,
        description,
        quantity,
        status: 'pending'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get manual
router.get('/manual', async (req, res) => {
  try {
    // Get manual sections
    res.json({
      success: true,
      data: {
        sections: [
          {
            id: '1',
            title: 'Event Overview',
            content: 'Welcome to the exhibition...'
          },
          {
            id: '2',
            title: 'Setup Schedule',
            content: 'Setup begins on January 28...'
          }
        ]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Download invoice PDF
router.get('/invoices/:id/pdf', async (req, res) => {
  try {
    const invoiceService = require('../services/InvoiceService');
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
});

// Make payment
router.post('/invoices/:id/pay', async (req, res) => {
  try {
    const { method, transactionId } = req.body;
    
    const invoiceService = require('../services/InvoiceService');
    const paymentService = require('../services/PaymentService');
    
    // Get invoice
    const invoice = await invoiceService.getInvoiceById(req.params.id);
    
    // Create payment
    const payment = await paymentService.createPayment({
      invoiceId: invoice.id,
      exhibitorId: req.user.id,
      amount: invoice.amount,
      method: method || 'online',
      transactionId: transactionId || `TXN-${Date.now()}`,
      status: 'completed',
      notes: 'Payment made from exhibitor portal'
    });
    
    // Mark invoice as paid
    await invoiceService.markInvoiceAsPaid(invoice.id, payment.id);
    
    // Send confirmation email
    try {
      const emailService = require('../services/EmailService');
      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      
      let exhibitor;
      if (process.env.DB_TYPE === 'mysql') {
        exhibitor = await Exhibitor.findByPk(req.user.id);
      } else {
        exhibitor = await Exhibitor.findById(req.user.id);
      }
      
      if (exhibitor) {
        await emailService.sendPaymentConfirmation(exhibitor, payment);
      }
    } catch (emailError) {
      console.warn('Failed to send payment confirmation:', emailError.message);
    }
    
    // Send notification to admin
    try {
      const kafkaProducer = require('../kafka/producer');
      await kafkaProducer.sendNotification('EXHIBITOR_PAYMENT_MADE', req.user.id, {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        method: method
      });
    } catch (kafkaError) {
      console.warn('Kafka not available:', kafkaError.message);
    }
    
    res.json({
      success: true,
      message: 'Payment successful',
      data: {
        payment,
        invoice: {
          ...invoice.toJSON(),
          status: 'paid'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;