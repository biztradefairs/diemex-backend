const express = require('express');
const router = express.Router();
const compressedAirController = require('../controllers/CompressedAirController');
const { authenticate, authorize } = require('../middleware/auth');

// ======================================================
// TEST ROUTE - To verify routes are working
// ======================================================
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Compressed Air API is working!',
    timestamp: new Date().toISOString()
  });
});

// ======================================================
// PUBLIC ROUTES (Accessible without authentication)
// ======================================================

// Get statistics
router.get('/statistics', compressedAirController.getStatistics);

// Get all options with filters - handle both with and without trailing slash
router.get('/', compressedAirController.getAllOptions);
router.get('', compressedAirController.getAllOptions);

// Get single option by ID
router.get('/:id', compressedAirController.getOption);

// ======================================================
// ADMIN ROUTES (Protected)
// ======================================================

// Create option
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  compressedAirController.createOption
);
router.post(
  '',
  authenticate,
  authorize(['admin']),
  compressedAirController.createOption
);

// Update option
router.put(
  '/:id',
  authenticate,
  authorize(['admin']),
  compressedAirController.updateOption
);

// Delete option
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  compressedAirController.deleteOption
);

// Bulk delete options
router.delete(
  '/bulk/delete',
  authenticate,
  authorize(['admin']),
  compressedAirController.bulkDeleteOptions
);

// Update display order
router.patch(
  '/display-order/update',
  authenticate,
  authorize(['admin']),
  compressedAirController.updateDisplayOrder
);

// Reorder all options
router.post(
  '/reorder',
  authenticate,
  authorize(['admin']),
  compressedAirController.reorderOptions
);

// Toggle active status
router.patch(
  '/:id/toggle-status',
  authenticate,
  authorize(['admin']),
  compressedAirController.toggleActiveStatus
);

module.exports = router;