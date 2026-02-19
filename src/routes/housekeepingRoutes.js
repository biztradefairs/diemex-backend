const express = require('express');
const router = express.Router();
const housekeepingController = require('../controllers/HousekeepingController');
const { authenticate, authorize } = require('../middleware/auth');

// ======================================================
// TEST ROUTE - To verify routes are working
// ======================================================
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Housekeeping API is working!',
    timestamp: new Date().toISOString()
  });
});

// ======================================================
// PUBLIC ROUTES (Accessible without authentication)
// ======================================================

// Get current configuration
router.get('/config', housekeepingController.getConfig);

// Calculate cost for shifts
router.post('/calculate', housekeepingController.calculateCost);

// Calculate cost for custom hours
router.post('/calculate/custom', housekeepingController.calculateCustomHours);

// Bulk calculate
router.post('/calculate/bulk', housekeepingController.bulkCalculate);

// Get rate history
router.get('/history', housekeepingController.getRateHistory);

// Get statistics
router.get('/statistics', housekeepingController.getStatistics);

// ======================================================
// ADMIN ROUTES (Protected)
// ======================================================

// Update configuration
router.put(
  '/config',
  authenticate,
  authorize(['admin']),
  housekeepingController.updateConfig
);

// Reset to default rate
router.post(
  '/reset',
  authenticate,
  authorize(['admin']),
  housekeepingController.resetToDefault
);

module.exports = router;