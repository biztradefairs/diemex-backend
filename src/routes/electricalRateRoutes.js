const express = require('express');
const router = express.Router();
const electricalRateController = require('../controllers/ElectricalRateController');
const { authenticate, authorize, authenticateAny } = require('../middleware/auth');

// ======================================================
// TEST ROUTE - To verify routes are working
// ======================================================
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Electrical Rate API is working!',
    timestamp: new Date().toISOString()
  });
});

// ======================================================
// PUBLIC ROUTES (Accessible without authentication)
// ======================================================

// Get statistics
router.get('/statistics', electricalRateController.getStatistics);

// Get active rate by type
router.get(
  '/active/:type',
  authenticateAny,
  authorize(['admin', 'exhibitor']),
  electricalRateController.getActiveRate
);

// Get all rates with filters - handle both with and without trailing slash
router.get('/', electricalRateController.getAllRates);
router.get('', electricalRateController.getAllRates);

// Get single rate by ID
router.get('/:id', electricalRateController.getRate);

// ======================================================
// ADMIN ROUTES (Protected)
// ======================================================

// Create rate
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  electricalRateController.createRate
);
router.post(
  '',
  authenticate,
  authorize(['admin']),
  electricalRateController.createRate
);

// Update rate
router.put(
  '/:id',
  authenticate,
  authorize(['admin']),
  electricalRateController.updateRate
);

// Delete rate
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  electricalRateController.deleteRate
);

// Bulk delete rates
router.delete(
  '/bulk/delete',
  authenticate,
  authorize(['admin']),
  electricalRateController.bulkDeleteRates
);

// Toggle active status
router.patch(
  '/:id/toggle-status',
  authenticate,
  authorize(['admin']),
  electricalRateController.toggleActiveStatus
);

module.exports = router;