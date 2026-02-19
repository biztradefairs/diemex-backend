const express = require('express');
const router = express.Router();
const hostessCategoryController = require('../controllers/HostessCategoryController');
const { authenticate, authorize } = require('../middleware/auth');

// ======================================================
// TEST ROUTE - To verify routes are working
// ======================================================
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Hostess Category API is working!',
    timestamp: new Date().toISOString()
  });
});

// ======================================================
// PUBLIC ROUTES (Accessible without authentication)
// ======================================================

// Get statistics
router.get('/statistics', hostessCategoryController.getStatistics);

// Get all categories with filters - handle both with and without trailing slash
router.get('/', hostessCategoryController.getAllCategories);
router.get('', hostessCategoryController.getAllCategories);

// Get category by type (A or B)
router.get('/type/:type', hostessCategoryController.getCategoryByType);

// Calculate cost
router.post('/calculate', hostessCategoryController.calculateCost);

// Get single category by ID
router.get('/:id', hostessCategoryController.getCategory);

// ======================================================
// ADMIN ROUTES (Protected)
// ======================================================

// Create category
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  hostessCategoryController.createCategory
);
router.post(
  '',
  authenticate,
  authorize(['admin']),
  hostessCategoryController.createCategory
);

// Update category
router.put(
  '/:id',
  authenticate,
  authorize(['admin']),
  hostessCategoryController.updateCategory
);

// Delete category
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  hostessCategoryController.deleteCategory
);

// Bulk update rates
router.patch(
  '/bulk/update',
  authenticate,
  authorize(['admin']),
  hostessCategoryController.bulkUpdateRates
);

// Toggle active status
router.patch(
  '/:id/toggle-status',
  authenticate,
  authorize(['admin']),
  hostessCategoryController.toggleActiveStatus
);

module.exports = router;