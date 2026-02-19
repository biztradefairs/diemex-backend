const express = require('express');
const router = express.Router();
const securityGuardController = require('../controllers/SecurityGuardController');
const { authenticate, authorize } = require('../middleware/auth');

// ======================================================
// TEST ROUTE - To verify routes are working
// ======================================================
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Security Guard API is working!',
    timestamp: new Date().toISOString()
  });
});

// ======================================================
// PUBLIC ROUTES (Accessible without authentication)
// ======================================================

// Get current configuration
router.get('/config', securityGuardController.getConfig);

// Calculate cost for guards
router.post('/calculate', securityGuardController.calculateCost);

// Get rate history
router.get('/history', securityGuardController.getRateHistory);

// ======================================================
// ADMIN ROUTES (Protected)
// ======================================================

// Update configuration
router.put(
  '/config',
  authenticate,
  authorize(['admin']),
  securityGuardController.updateConfig
);

// Reset to default rate
router.post(
  '/reset',
  authenticate,
  authorize(['admin']),
  securityGuardController.resetToDefault
);

module.exports = router;