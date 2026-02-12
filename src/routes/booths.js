const express = require('express');
const router = express.Router();
const boothController = require('../controllers/FloorPlanController');
const { authenticate, authorize } = require('../middleware/auth');

// All booth routes require authentication
router.use(authenticate);

// Get all booths
router.get('/', authorize(['admin', 'editor', 'viewer']), boothController.getAllBooths);

// Get booth statistics
router.get('/statistics', authorize(['admin', 'editor', 'viewer']), boothController.getBoothStatistics);

// Add new booth
router.post('/', authorize(['admin', 'editor']), boothController.addBooth);

// Update booth
router.put('/:boothId', authorize(['admin', 'editor']), boothController.updateBooth);

// Update booth status
router.patch('/:boothId/status', authorize(['admin', 'editor']), boothController.updateBoothStatus);

// Update company name
router.patch('/:boothId/company', authorize(['admin', 'editor']), boothController.updateCompanyName);

// Delete booth
router.delete('/:boothId', authorize(['admin', 'editor']), boothController.deleteBooth);

// Bulk update booths
router.post('/bulk-update', authorize(['admin', 'editor']), boothController.bulkUpdateBooths);

// Reset floor plan to default
router.post('/reset', authorize(['admin']), boothController.resetToDefault);

module.exports = router;