// src/routes/housekeepingRoutes.js
const express = require('express');
const router = express.Router();
const housekeepingController = require('../controllers/HousekeepingController');
const {
  authenticate,
  authenticateAny,
  authorize
} = require('../middleware/auth');

// ==================== PUBLIC / EXHIBITOR ROUTES ====================

// Get config (Admin + Exhibitor)
router.get(
  '/config',
  authenticateAny,
  authorize(['admin', 'exhibitor']),
  housekeepingController.getConfig
);

// Calculate cost - For exhibitor form
router.post(
  '/calculate',
  authenticateAny,
  authorize(['admin', 'exhibitor']),
  housekeepingController.calculateCost
);

// Calculate with shifts (for admin)
router.post(
  '/calculate/shifts',
  authenticate,
  authorize(['admin']),
  housekeepingController.calculateWithShifts
);

// Calculate custom hours
router.post(
  '/calculate/custom',
  authenticateAny,
  authorize(['admin', 'exhibitor']),
  housekeepingController.calculateCustomHours
);

// ==================== ADMIN ONLY ROUTES ====================

// Update config
router.put(
  '/config',
  authenticate,
  authorize(['admin']),
  housekeepingController.updateConfig
);

// Get rate history
router.get(
  '/history',
  authenticate,
  authorize(['admin']),
  housekeepingController.getRateHistory
);

// Reset to default
router.post(
  '/reset',
  authenticate,
  authorize(['admin']),
  housekeepingController.resetToDefault
);

// Get statistics
router.get(
  '/stats',
  authenticate,
  authorize(['admin']),
  housekeepingController.getStatistics
);

module.exports = router;