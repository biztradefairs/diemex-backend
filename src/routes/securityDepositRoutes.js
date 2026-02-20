const express = require('express');
const router = express.Router();
const securityDepositController = require('../controllers/SecurityDepositController');
const { authenticate, authorize } = require('../middleware/auth');

// ======================================================
// TEST ROUTE - To verify routes are working
// ======================================================
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Security Deposit API is working!',
    timestamp: new Date().toISOString()
  });
});

// ======================================================
// PUBLIC ROUTES (Accessible without authentication)
// Used by exhibitor form to fetch active deposit options
// ======================================================

// Get active deposits only (for exhibitor form)
router.get('/active', securityDepositController.getActiveDeposits);

// Get statistics
router.get('/statistics', securityDepositController.getStatistics);

// Get all deposits with filters - handle both with and without trailing slash
router.get('/', securityDepositController.getAllDeposits);
router.get('', securityDepositController.getAllDeposits);

// Get deposits by category
router.get('/category/:category', securityDepositController.getDepositsByCategory);

// Get single deposit by ID
router.get('/:id', securityDepositController.getDeposit);

// ======================================================
// ADMIN ROUTES (Protected)
// ======================================================

// Create deposit
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  securityDepositController.createDeposit
);
router.post(
  '',
  authenticate,
  authorize(['admin']),
  securityDepositController.createDeposit
);

// Update deposit
router.put(
  '/:id',
  authenticate,
  authorize(['admin']),
  securityDepositController.updateDeposit
);

// Delete deposit
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  securityDepositController.deleteDeposit
);

// Bulk delete deposits
router.delete(
  '/bulk/delete',
  authenticate,
  authorize(['admin']),
  securityDepositController.bulkDeleteDeposits
);

// Update display order
router.patch(
  '/display-order/update',
  authenticate,
  authorize(['admin']),
  securityDepositController.updateDisplayOrder
);

// Reorder all deposits
router.post(
  '/reorder',
  authenticate,
  authorize(['admin']),
  securityDepositController.reorderDeposits
);

// Toggle active status
router.patch(
  '/:id/toggle-status',
  authenticate,
  authorize(['admin']),
  securityDepositController.toggleActiveStatus
);

module.exports = router;