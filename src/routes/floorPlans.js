// src/routes/floorPlans.js
const express = require('express');
const router = express.Router();
const floorPlanController = require('../controllers/FloorPlanController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes require authentication
router.use(authenticate);

// Get all floor plans (admin/editor only)
router.get('/', authorize(['admin', 'editor']), floorPlanController.getAllFloorPlans);

// Get single floor plan
router.get('/:id', authorize(['admin', 'editor']), floorPlanController.getFloorPlan);

// Create floor plan (admin/editor only)
router.post('/', authorize(['admin', 'editor']), floorPlanController.createFloorPlan);

// Update floor plan (admin/editor only)
router.put('/:id', authorize(['admin', 'editor']), floorPlanController.updateFloorPlan);

// Delete floor plan (admin only)
router.delete('/:id', authorize(['admin']), floorPlanController.deleteFloorPlan);

// Export floor plan
router.get('/:id/export', authorize(['admin', 'editor']), floorPlanController.exportFloorPlan);

// Duplicate floor plan
router.post('/:id/duplicate', authorize(['admin', 'editor']), floorPlanController.duplicateFloorPlan);

// Upload floor plan image
router.post('/:id/upload-image', authorize(['admin', 'editor']), upload.single('image'), floorPlanController.uploadFloorPlanImage);

module.exports = router;