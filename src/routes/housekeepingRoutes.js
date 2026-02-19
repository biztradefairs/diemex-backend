const express = require('express');
const router = express.Router();
const housekeepingController = require('../controllers/HousekeepingController');
const {
  authenticate,
  authenticateAny,
  authorize
} = require('../middleware/auth');

/* ==================================================
   SHARED ROUTES (Admin + Exhibitor)
================================================== */

// Get config (Admin + Exhibitor)
router.get(
  '/config',
  authenticateAny,
  authorize(['admin', 'exhibitor']),
  housekeepingController.getConfig
);

// Calculate cost (Public or authenticated)
router.post('/calculate', housekeepingController.calculateCost);
router.post('/calculate/custom', housekeepingController.calculateCustomHours);

/* ==================================================
   ADMIN ONLY ROUTES
================================================== */

router.put(
  '/config',
  authenticate,
  authorize(['admin']),
  housekeepingController.updateConfig
);

router.get(
  '/history',
  authenticate,
  authorize(['admin']),
  housekeepingController.getRateHistory
);

router.post(
  '/reset',
  authenticate,
  authorize(['admin']),
  housekeepingController.resetToDefault
);

router.get(
  '/stats',
  authenticate,
  authorize(['admin']),
  housekeepingController.getStatistics
);

module.exports = router;
