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

// In exhibitorDashboard.js - GET /profile
router.get('/profile', async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Exhibitor = modelFactory.getModel('Exhibitor');

    const exhibitor = await Exhibitor.findByPk(req.user.id);

    if (!exhibitor) {
      return res.status(404).json({
        success: false,
        error: 'Exhibitor not found'
      });
    }

    // Convert to plain object
    const exhibitorData = exhibitor.toJSON();

    // Safely parse stallDetails
    let stallDetails = {};
    if (exhibitorData.stallDetails) {
      if (typeof exhibitorData.stallDetails === 'string') {
        try {
          stallDetails = JSON.parse(exhibitorData.stallDetails);
        } catch (err) {
          console.error('❌ JSON parse error for stallDetails:', err.message);
          stallDetails = {};
        }
      } else {
        stallDetails = exhibitorData.stallDetails;
      }
    }

    // Safely parse metadata
    let metadata = {};
    if (exhibitorData.metadata) {
      if (typeof exhibitorData.metadata === 'string') {
        try {
          metadata = JSON.parse(exhibitorData.metadata);
        } catch (err) {
          console.error('❌ JSON parse error for metadata:', err.message);
          metadata = {};
        }
      } else {
        metadata = exhibitorData.metadata;
      }
    }

    // Build contact person from metadata
    const contactPerson = {
      name: metadata.contact_name || metadata.contactPerson?.name || exhibitorData.name || '',
      jobTitle: metadata.contact_job_title || metadata.contactPerson?.jobTitle || '',
      email: exhibitorData.email || metadata.email || '',
      phone: exhibitorData.phone || metadata.phone || '',
      alternatePhone: metadata.alternate_phone || metadata.contactPerson?.alternatePhone || ''
    };

    // Build exhibition object
    const exhibition = {
      pavilion: metadata.pavilion || metadata.exhibition?.pavilion || '',
      hall: metadata.hall || metadata.exhibition?.hall || '',
      standNumber: exhibitorData.boothNumber || metadata.boothNumber || metadata.exhibition?.standNumber || '',
      floorPlanUrl: metadata.floor_plan_url || metadata.exhibition?.floorPlanUrl || ''
    };

    // Build address object
    const address = {
      street: metadata.address_street || metadata.address?.street || '',
      city: metadata.address_city || metadata.address?.city || '',
      state: metadata.address_state || metadata.address?.state || '',
      country: metadata.address_country || metadata.address?.country || '',
      countryCode: metadata.address_country_code || metadata.address?.countryCode || '',
      postalCode: metadata.address_postal_code || metadata.address?.postalCode || ''
    };

// Parse sector
let sectorArray = [];
if (exhibitorData.sector) {
  if (typeof exhibitorData.sector === 'string') {
    sectorArray = exhibitorData.sector.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (Array.isArray(exhibitorData.sector)) {
    sectorArray = exhibitorData.sector;
  }
} else if (metadata.sector) {
  if (typeof metadata.sector === 'string') {
    sectorArray = metadata.sector.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (Array.isArray(metadata.sector)) {
    sectorArray = metadata.sector;
  }
}

    // Build social media object
    const socialMedia = {
      website: exhibitorData.website || metadata.website || metadata.socialMedia?.website || '',
      linkedin: metadata.linkedin || metadata.socialMedia?.linkedin || '',
      twitter: metadata.twitter || metadata.socialMedia?.twitter || '',
      facebook: metadata.facebook || metadata.socialMedia?.facebook || '',
      instagram: metadata.instagram || metadata.socialMedia?.instagram || ''
    };

    res.json({
      success: true,
      data: {
        id: exhibitorData.id,
        name: exhibitorData.name,
        email: exhibitorData.email,
        phone: exhibitorData.phone || '',
        company: exhibitorData.company,
        sector: sectorArray,
        boothNumber: exhibitorData.boothNumber || '',
        website: exhibitorData.website || '',
        address: exhibitorData.address || '',
        description: metadata.about || exhibitorData.description || '',
        status: exhibitorData.status || 'active',
        createdAt: exhibitorData.createdAt,
        updatedAt: exhibitorData.updatedAt,

        // Company info from metadata
        shortName: metadata.shortName || metadata.short_name || '',
        registrationNumber: metadata.registrationNumber || metadata.registration_number || '',
        yearEstablished: metadata.yearEstablished || metadata.year_established || '',
        companySize: metadata.companySize || metadata.company_size || '',
        companyType: metadata.companyType || metadata.company_type || '',

        // Contact person
        contactPerson: contactPerson,

        // Exhibition
        exhibition: exhibition,

        // Address
        address: address,

        // Business details
        about: metadata.about || '',
        mission: metadata.mission || '',
        vision: metadata.vision || '',

        // Social media
        socialMedia: socialMedia,

        // ✅ Booth fields from stallDetails
        stallDetails: stallDetails,
        boothSize: stallDetails.size || metadata.boothSize || metadata.booth_size || '',
        boothType: stallDetails.type || metadata.boothType || metadata.booth_type || 'standard',
        boothDimensions: stallDetails.dimensions || metadata.boothDimensions || metadata.booth_dimensions || '',
        boothNotes: stallDetails.notes || metadata.boothNotes || metadata.booth_notes || '',
        boothStatus: metadata.boothStatus || metadata.booth_status || stallDetails.status || 'pending',
        boothPrice: stallDetails.price || metadata.boothPrice || metadata.booth_price || '' // CRITICAL: Include price
      }
    });

  } catch (error) {
    console.error('❌ PROFILE ERROR:', error);
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


// Add this to exhibitorDashboard.js
router.get('/booth', async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Exhibitor = modelFactory.getModel('Exhibitor');

    const exhibitor = await Exhibitor.findByPk(req.user.id);

    if (!exhibitor) {
      return res.status(404).json({
        success: false,
        error: 'Exhibitor not found'
      });
    }

    // Safely parse stallDetails
    let stallDetails = {};
    if (exhibitor.stallDetails) {
      if (typeof exhibitor.stallDetails === 'string') {
        try {
          stallDetails = JSON.parse(exhibitor.stallDetails);
        } catch (err) {
          console.error('❌ JSON parse error for stallDetails:', err.message);
          stallDetails = {};
        }
      } else {
        stallDetails = exhibitor.stallDetails;
      }
    }

    res.json({
      success: true,
      data: {
        boothNumber: exhibitor.boothNumber || '',
        stallDetails: stallDetails,
        size: stallDetails.size || '',
        type: stallDetails.type || 'standard',
        dimensions: stallDetails.dimensions || '',
        notes: stallDetails.notes || '',
        price: stallDetails.price || '', // CRITICAL: Include price
        status: stallDetails.status || 'pending'
      }
    });

  } catch (error) {
    console.error('❌ BOOTH ERROR:', error);
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