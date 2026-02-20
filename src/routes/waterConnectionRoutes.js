const express = require('express');
const router = express.Router();
const waterConnectionController = require('../controllers/WaterConnectionController');
const { authenticate, authorize } = require('../middleware/auth');

// ======================================================
// PUBLIC ROUTES (No authentication required)
// ======================================================

// Get current configuration
router.get('/config', waterConnectionController.getConfig);

// Calculate cost for connections
router.post('/calculate', waterConnectionController.calculateCost);

// Bulk calculate for multiple connection types
router.post('/calculate/bulk', waterConnectionController.bulkCalculate);

// Get rate history
router.get('/history', waterConnectionController.getRateHistory);

// Get statistics
router.get('/statistics', waterConnectionController.getStatistics);

// ======================================================
// ADMIN ROUTES (Authentication required)
// ======================================================

// Update configuration
router.put('/config', authenticate, authorize(['admin']), waterConnectionController.updateConfig);

// Reset to default rate
router.post('/reset', authenticate, authorize(['admin']), waterConnectionController.resetToDefault);

module.exports = router;