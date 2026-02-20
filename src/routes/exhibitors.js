const router = require('express').Router();
const exhibitorController = require('../controllers/ExhibitorController');
const modelFactory = require('../models'); // ✅ IMPORTANT

// ==============================
// PUBLIC ROUTES
// ==============================

// Get all exhibitors
router.get('/', exhibitorController.getAllExhibitors);

// Get exhibitor stats
router.get('/stats', exhibitorController.getExhibitorStats);

// ==============================
// PUBLIC: Exhibitor Products
// ==============================
router.get('/:id/products', async (req, res) => {
  try {
    const Product = modelFactory.getModel('Product');

    if (!Product) {
      return res.status(500).json({
        success: false,
        error: 'Product model not initialized'
      });
    }

    const products = await Product.findAll({
      where: { exhibitorId: req.params.id }
    });

    res.json({
      success: true,
      data: products
    });

  } catch (error) {
    console.error('Error fetching exhibitor products:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==============================
// PUBLIC: Exhibitor Brands
// ==============================
router.get('/:id/brands', async (req, res) => {
  try {
    const Brand = modelFactory.getModel('Brand');

    if (!Brand) {
      return res.status(500).json({
        success: false,
        error: 'Brand model not initialized'
      });
    }

    const brands = await Brand.findAll({
      where: {
        exhibitorId: req.params.id,
        isPublic: true
      }
    });

    res.json({
      success: true,
      data: brands
    });

  } catch (error) {
    console.error('Error fetching exhibitor brands:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==============================
// PUBLIC: Exhibitor Brochures
// ==============================
router.get('/:id/brochures', async (req, res) => {
  try {
    const Brochure = modelFactory.getModel('Brochure');

    if (!Brochure) {
      return res.status(500).json({
        success: false,
        error: 'Brochure model not initialized'
      });
    }

    const brochures = await Brochure.findAll({
      where: {
        exhibitorId: req.params.id,
        isPublic: true
      }
    });

    res.json({
      success: true,
      data: brochures
    });

  } catch (error) {
    console.error('Error fetching exhibitor brochures:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get single exhibitor
router.get('/:id', exhibitorController.getExhibitor);

// ==============================
// PROTECTED ROUTES
// ==============================

// Create exhibitor
router.post('/', exhibitorController.createExhibitor);

// Update exhibitor
router.put('/:id', exhibitorController.updateExhibitor);

// Delete exhibitor
router.delete('/:id', exhibitorController.deleteExhibitor);

// Bulk status update
router.post('/bulk/update-status', exhibitorController.bulkUpdateStatus);

// Resend credentials
router.post('/:id/resend-credentials', exhibitorController.resendCredentials);

module.exports = router;