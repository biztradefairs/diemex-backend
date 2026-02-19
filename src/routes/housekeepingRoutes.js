const express = require('express');
const router = express.Router();
const housekeepingController = require('../controllers/HousekeepingController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/config', authenticate, authorize(['admin']), housekeepingController.getConfig);
router.put('/config', authenticate, authorize(['admin']), housekeepingController.updateConfig);
router.post('/calculate', housekeepingController.calculateCost);
router.post('/calculate/custom', housekeepingController.calculateCustomHours);
router.get('/history', authenticate, authorize(['admin']), housekeepingController.getRateHistory);
router.post('/reset', authenticate, authorize(['admin']), housekeepingController.resetToDefault);
router.get('/stats', authenticate, authorize(['admin']), housekeepingController.getStatistics);

module.exports = router;
