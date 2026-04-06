const router = require('express').Router();
const exhibitorController = require('../controllers/ExhibitorController');
const modelFactory = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

// ------------------------------
// PUBLIC ROUTES
// ------------------------------

router.get('/', exhibitorController.getAllExhibitors);

// ------------------------------
// STATS ROUTES (FIXED)
// ------------------------------

// Get exhibitor statistics (admin only - to avoid conflict)
router.get('/stats/count', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const sequelize = require('../config/database').getConnection('mysql');
    
    // Get total exhibitors count
    const [exhibitorCount] = await sequelize.query(`
      SELECT COUNT(*) as total FROM exhibitors WHERE status IN ('active', 'approved', 'pending')
    `);
    
    // Get pending verifications count
    const [pendingCount] = await sequelize.query(`
      SELECT COUNT(*) as pending FROM invoices 
      WHERE status = 'pending' 
      AND JSON_EXTRACT(metadata, '$.paymentVerification.status') = 'pending_verification'
    `);
    
    // Get total revenue
    const [revenue] = await sequelize.query(`
      SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = 'paid'
    `);
    
    // Get this month's registrations
    const [monthlyRegistrations] = await sequelize.query(`
      SELECT COUNT(*) as count FROM exhibitors 
      WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) 
      AND YEAR(created_at) = YEAR(CURRENT_DATE())
    `);
    
    res.json({
      success: true,
      data: {
        totalExhibitors: exhibitorCount[0]?.total || 0,
        pendingVerifications: pendingCount[0]?.pending || 0,
        totalRevenue: revenue[0]?.total || 0,
        monthlyRegistrations: monthlyRegistrations[0]?.count || 0
      }
    });
    
  } catch (error) {
    console.error('Error fetching exhibitor stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// If you need general stats (without /count) - make it admin only or rename
router.get('/stats/general', authenticate, authorize(['admin']), exhibitorController.getExhibitorStats);

// ------------------------------
// GET PRODUCTS
// ------------------------------
router.get('/:id/products', async (req, res) => {
  try {
    const Product = modelFactory.getModel('Product');

    const products = await Product.findAll({
      where: {
        exhibitorId: req.params.id
      }
    });

    res.json({ success: true, data: products });

  } catch (error) {
    console.error('Products Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ------------------------------
// GET BRANDS
// ------------------------------
router.get('/:id/brands', async (req, res) => {
  try {
    const Brand = modelFactory.getModel('Brand');

    const brands = await Brand.findAll({
      where: {
        exhibitorId: req.params.id
      }
    });

    res.json({ success: true, data: brands });

  } catch (error) {
    console.error('Brands Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ------------------------------
// GET BROCHURES
// ------------------------------
router.get('/:id/brochures', async (req, res) => {
  try {
    const Brochure = modelFactory.getModel('Brochure');

    const brochures = await Brochure.findAll({
      where: {
        exhibitorId: req.params.id
      }
    });

    res.json({ success: true, data: brochures });

  } catch (error) {
    console.error('Brochures Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ------------------------------
// GET SINGLE EXHIBITOR
// ------------------------------
router.get('/:id', exhibitorController.getExhibitor);

// ------------------------------
// PROTECTED ROUTES (ADMIN ONLY)
// ------------------------------

router.post('/', authenticate, authorize(['admin']), exhibitorController.createExhibitor);
router.put('/:id', authenticate, authorize(['admin']), exhibitorController.updateExhibitor);
router.delete('/:id', authenticate, authorize(['admin']), exhibitorController.deleteExhibitor);
router.post('/bulk/update-status', authenticate, authorize(['admin']), exhibitorController.bulkUpdateStatus);
router.post('/:id/resend-credentials', authenticate, authorize(['admin']), exhibitorController.resendCredentials);

module.exports = router;