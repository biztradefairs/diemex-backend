const express = require('express');
const router = express.Router();
const waterConnectionController = require('../controllers/WaterConnectionController');
const { authenticate, authenticateAny, authorize } = require('../middleware/auth');

/* ===============================
   SHARED ROUTES
================================= */

router.get(
  '/config',
  authenticateAny,
  authorize(['admin', 'exhibitor']),
  waterConnectionController.getConfig
);

router.post('/calculate', waterConnectionController.calculateCost);
router.post('/calculate/bulk', waterConnectionController.bulkCalculate);
router.get('/statistics', waterConnectionController.getStatistics);

/* ===============================
   ADMIN ONLY
================================= */

router.put(
  '/config',
  authenticate,
  authorize(['admin']),
  waterConnectionController.updateConfig
);

router.post(
  '/reset',
  authenticate,
  authorize(['admin']),
  waterConnectionController.resetToDefault
);

module.exports = router;
