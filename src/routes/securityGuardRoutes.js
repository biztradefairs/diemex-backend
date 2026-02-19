const express = require('express');
const router = express.Router();
const securityGuardController = require('../controllers/SecurityGuardController');
const { authenticate, authenticateAny, authorize } = require('../middleware/auth');

/* ===============================
   SHARED ROUTES
================================= */

router.get(
  '/config',
  authenticateAny,
  authorize(['admin', 'exhibitor']),
  securityGuardController.getConfig
);

router.post('/calculate', securityGuardController.calculateCost);

/* ===============================
   ADMIN ONLY
================================= */

router.put(
  '/config',
  authenticate,
  authorize(['admin']),
  securityGuardController.updateConfig
);

router.post(
  '/reset',
  authenticate,
  authorize(['admin']),
  securityGuardController.resetToDefault
);

module.exports = router;
