const router = require('express').Router();
const exhibitorController = require('../controllers/ExhibitorController');
const modelFactory = require('../models');

// ------------------------------
// PUBLIC ROUTES
// ------------------------------

router.get('/', exhibitorController.getAllExhibitors);
router.get('/stats', exhibitorController.getExhibitorStats);

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
// PROTECTED ROUTES
// ------------------------------

router.post('/', exhibitorController.createExhibitor);
router.put('/:id', exhibitorController.updateExhibitor);
router.delete('/:id', exhibitorController.deleteExhibitor);
router.post('/bulk/update-status', exhibitorController.bulkUpdateStatus);
router.post('/:id/resend-credentials', exhibitorController.resendCredentials);

module.exports = router;