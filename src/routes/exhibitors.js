const express = require('express');
const router = express.Router();
const exhibitorController = require('../controllers/ExhibitorController');

// Import middleware correctly
const { authenticate, authorize, authMiddleware } = require('../middleware/auth');

// Admin routes (protected with authentication and admin role)
router.post('/', authenticate, authorize(['admin']), exhibitorController.createExhibitor);
router.get('/', authenticate, authorize(['admin', 'editor']), exhibitorController.getAllExhibitors);
router.get('/stats', authenticate, authorize(['admin', 'editor']), exhibitorController.getExhibitorStats);
router.get('/export', authenticate, authorize(['admin', 'editor']), exhibitorController.exportExhibitors);
router.put('/bulk-status', authenticate, authorize(['admin']), exhibitorController.bulkUpdateStatus);
router.get('/with-passwords', authenticate, authorize(['admin']), exhibitorController.getExhibitorsWithPasswords);
// router.get('/admin/with-passwords', authenticate, authorize(['admin']), exhibitorController.getExhibitorsWithPasswords);

// Public routes (no authentication required for these)
router.get('/:id', exhibitorController.getExhibitor); // Public access to exhibitor details
router.put('/:id', authenticate, authorize(['admin']), exhibitorController.updateExhibitor);
router.delete('/:id', authenticate, authorize(['admin']), exhibitorController.deleteExhibitor);

// Alternative: Using authMiddleware (combined authenticate + authorize)
// router.get('/', authMiddleware(['admin', 'editor']), exhibitorController.getAllExhibitors);

module.exports = router;