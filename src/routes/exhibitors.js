const router = require('express').Router();
const exhibitorController = require('../controllers/ExhibitorController');

// Public routes
router.get('/', exhibitorController.getAllExhibitors);
router.get('/stats', exhibitorController.getExhibitorStats);

router.get('/:id/products', async (req, res) => {
  try {
    const Product = modelFactory.getModel('Product');

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

// ==========================
// PUBLIC: Exhibitor Brands
// ==========================
router.get('/:id/brands', async (req, res) => {
  try {
    const Brand = modelFactory.getModel('Brand');

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

// ==========================
// PUBLIC: Exhibitor Brochures
// ==========================
router.get('/:id/brochures', async (req, res) => {
  try {
    const Brochure = modelFactory.getModel('Brochure');

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
router.get('/:id', exhibitorController.getExhibitor);



// Protected routes
router.post('/', exhibitorController.createExhibitor);
router.put('/:id', exhibitorController.updateExhibitor);
router.delete('/:id', exhibitorController.deleteExhibitor);
router.post('/bulk/update-status', exhibitorController.bulkUpdateStatus);

// Add resend credentials route
router.post('/:id/resend-credentials', exhibitorController.resendCredentials);

module.exports = router;