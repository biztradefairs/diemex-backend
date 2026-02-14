// src/routes/exhibitorDashboard.js
const express = require('express');
const router = express.Router();
const { authenticateExhibitor } = require('../middleware/auth');

const productRoutes = require('./exhibitorProducts');
// You'll need to create these too
const brandRoutes = require('./exhibitorBrands');
const brochureRoutes = require('./exhibitorBrochures');
const stallRoutes = require('./exhibitorStall');

// All routes require exhibitor authentication
router.use(authenticateExhibitor);

router.use('/products', productRoutes);
router.use('/brands', brandRoutes);
router.use('/brochures', brochureRoutes);
router.use('/stall', stallRoutes);

// ==================== PROFILE ROUTES ====================

// Get exhibitor profile
router.get('/profile', async (req, res) => {
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
    
    res.json({
      success: true,
      data: {
        id: exhibitor.id,
        name: exhibitor.name,
        email: exhibitor.email,
        phone: exhibitor.phone || '',
        company: exhibitor.company,
        sector: exhibitor.sector || '',
        boothNumber: exhibitor.boothNumber || '',
        website: exhibitor.website || '',
        address: exhibitor.address || '',
        description: exhibitor.description || '',
        status: exhibitor.status || 'active',
        createdAt: exhibitor.createdAt,
        updatedAt: exhibitor.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update exhibitor profile
router.put('/profile', async (req, res) => {
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
    
    const updateData = req.body;
    
    // Remove fields that shouldn't be updated by exhibitor
    delete updateData.id;
    delete updateData.email;
    delete updateData.status;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    // Update exhibitor
    await exhibitor.update(updateData);
    
    // Send notification if booth number changed
    if (updateData.boothNumber && updateData.boothNumber !== exhibitor.boothNumber) {
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendNotification('EXHIBITOR_BOOTH_UPDATED', req.user.id, {
          oldBooth: exhibitor.boothNumber,
          newBooth: updateData.boothNumber
        });
      } catch (kafkaError) {
        console.warn('Kafka not available:', kafkaError.message);
      }
    }
    
    res.json({
      success: true,
      data: {
        id: exhibitor.id,
        name: exhibitor.name,
        email: exhibitor.email,
        phone: exhibitor.phone,
        company: exhibitor.company,
        sector: exhibitor.sector,
        boothNumber: exhibitor.boothNumber,
        website: exhibitor.website,
        address: exhibitor.address,
        description: exhibitor.description,
        status: exhibitor.status
      },
      message: 'Profile updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== DASHBOARD ROUTES ====================

// ==================== DASHBOARD ROUTES ====================

// Get exhibitor's complete dashboard data
router.get('/layout', async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Exhibitor = modelFactory.getModel('Exhibitor');
    const FloorPlan = modelFactory.getModel('FloorPlan');

    // =========================
    // Get Logged-in Exhibitor
    // =========================
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

    // =========================
    // Get Active Floor Plan
    // =========================
   let floorPlan;

if (process.env.DB_TYPE === 'mysql') {
  floorPlan = await FloorPlan.findOne({
    where: { isActive: true }
  });
} else {
  floorPlan = await FloorPlan.findOne({ isActive: true });
}


    let boothDetails = null;

    if (floorPlan && exhibitor.boothNumber) {
      const booths = floorPlan.booths || [];

      boothDetails = booths.find(
        booth => booth.boothNumber === exhibitor.boothNumber
      );
    }

    // =========================
    // Get Invoices
    // =========================
    const invoiceService = require('../services/InvoiceService');
    const invoices = await invoiceService.getInvoicesByExhibitor(exhibitor.id);

    // =========================
    // Response
    // =========================
    res.json({
      success: true,
      data: {
        exhibitor: {
          id: exhibitor.id,
          name: exhibitor.name,
          company: exhibitor.company,
          email: exhibitor.email,
          phone: exhibitor.phone || '',
          boothNumber: exhibitor.boothNumber || '',
          stallDetails: exhibitor.stallDetails || '',
          sector: exhibitor.sector || '',
          website: exhibitor.website || '',
          address: exhibitor.address || '',
          description: exhibitor.description || '',
          status: exhibitor.status || 'active'
        },
        floorPlan: floorPlan
          ? {
              id: floorPlan.id,
              name: floorPlan.name,
              gridSize: floorPlan.gridSize
            }
          : null,
        booth: boothDetails || null,
        invoices: invoices || []
      }
    });

  } catch (error) {
    console.error('❌ Layout error:', error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// ==================== INVOICE ROUTES ====================

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
    
    // Verify invoice belongs to exhibitor
    if (invoice.exhibitorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to pay this invoice'
      });
    }
    
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

// ==================== REQUIREMENT ROUTES ====================

// Get exhibitor's requirements
router.get('/requirements', async (req, res) => {
  try {
    // Connect to your requirements service
    // For now, return data from database if available
    const modelFactory = require('../models');
    const Requirement = modelFactory.getModel('Requirement') || null;
    
    if (Requirement) {
      let requirements;
      if (process.env.DB_TYPE === 'mysql') {
        requirements = await Requirement.findAll({
          where: { exhibitorId: req.user.id },
          order: [['createdAt', 'DESC']]
        });
      } else {
        requirements = await Requirement.find({ exhibitorId: req.user.id }).sort({ createdAt: -1 });
      }
      
      res.json({
        success: true,
        data: requirements
      });
    } else {
      // Fallback sample data if Requirement model doesn't exist
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
    }
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
    
    // Validate input
    if (!type || !description) {
      return res.status(400).json({
        success: false,
        error: 'Type and description are required'
      });
    }
    
    // Save requirement to database if model exists
    const modelFactory = require('../models');
    const Requirement = modelFactory.getModel('Requirement') || null;
    
    let requirement;
    if (Requirement) {
      requirement = await Requirement.create({
        type,
        description,
        quantity: quantity || 1,
        exhibitorId: req.user.id,
        status: 'pending'
      });
    } else {
      // Create sample requirement if model doesn't exist
      requirement = {
        id: 'REQ' + Date.now().toString().slice(-6),
        type,
        description,
        quantity: quantity || 1,
        status: 'pending',
        createdAt: new Date()
      };
    }
    
    // Send notification to admin
    try {
      const kafkaProducer = require('../kafka/producer');
      await kafkaProducer.sendNotification('EXHIBITOR_REQUIREMENT_SUBMITTED', req.user.id, {
        type,
        description,
        quantity: quantity || 1
      });
    } catch (kafkaError) {
      console.warn('Kafka not available:', kafkaError.message);
    }
    
    res.json({
      success: true,
      message: 'Requirement submitted successfully',
      data: requirement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== MANUAL ROUTES ====================

// Get manual
router.get('/manual', async (req, res) => {
  try {
    // Get manual sections from database or return static content
    res.json({
      success: true,
      data: {
        sections: [
          {
            id: '1',
            title: 'Event Overview',
            content: 'Welcome to the exhibition. The event will take place from January 29-31, 2024 at the Convention Center.'
          },
          {
            id: '2',
            title: 'Setup Schedule',
            content: 'Setup begins on January 28 from 8:00 AM to 6:00 PM. All exhibitors must complete setup by 6:00 PM.'
          },
          {
            id: '3',
            title: 'Event Hours',
            content: 'Exhibition hours: 9:00 AM - 6:00 PM daily. Networking events: 7:00 PM - 10:00 PM.'
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

module.exports = router;