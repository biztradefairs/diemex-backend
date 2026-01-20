// src/routes/exhibitors.js
const express = require('express');
const router = express.Router();
const exhibitorController = require('../controllers/ExhibitorController');
const { authenticate, authorize } = require('../middleware/auth');
const { body } = require('express-validator');

// Validation middleware
const validateExhibitor = [
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('company').notEmpty().trim()
];

// All routes require authentication
router.use(authenticate);

// Get all exhibitors (admin/editor only)
router.get('/', authorize(['admin', 'editor']), exhibitorController.getAllExhibitors);

// Get exhibitor stats
router.get('/stats', authorize(['admin', 'editor']), exhibitorController.getExhibitorStats);

// Get single exhibitor
router.get('/:id', authorize(['admin', 'editor']), exhibitorController.getExhibitor);

// Create exhibitor (admin only)
router.post('/', authorize(['admin']), validateExhibitor, exhibitorController.createExhibitor);

// Update exhibitor (admin/editor only)
router.put('/:id', authorize(['admin', 'editor']), exhibitorController.updateExhibitor);

// Delete exhibitor (admin only)
router.delete('/:id', authorize(['admin']), exhibitorController.deleteExhibitor);

// Bulk operations
router.post('/bulk/update-status', authorize(['admin']), exhibitorController.bulkUpdateStatus);

// Export exhibitors
router.get('/export/data', authorize(['admin', 'editor']), exhibitorController.exportExhibitors);

module.exports = router;