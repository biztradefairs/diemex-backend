// src/routes/floorPlans.js
const express = require('express');
const router = express.Router();
const floorPlanController = require('../controllers/FloorPlanController');
const { authenticate, authorize } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// ======================
// PUBLIC ENDPOINTS (for testing)
// ======================
router.get('/test', floorPlanController.testEndpoint);

// ======================
// PROTECTED ENDPOINTS
// ======================
router.use(authenticate);

// CRUD Operations
router.get('/', authorize(['admin', 'editor', 'viewer']), floorPlanController.getAllFloorPlans);
router.get('/statistics', authorize(['admin', 'editor', 'viewer']), floorPlanController.getStatistics);
router.get('/analytics/booths', authorize(['admin', 'editor']), floorPlanController.getBoothAnalytics);

router.get('/:id', authorize(['admin', 'editor', 'viewer']), floorPlanController.getFloorPlan);
router.post('/', authorize(['admin', 'editor']), floorPlanController.createFloorPlan);
router.put('/:id', authorize(['admin', 'editor']), floorPlanController.updateFloorPlan);
router.delete('/:id', authorize(['admin']), floorPlanController.deleteFloorPlan);

// Image upload
router.post('/upload-image', authorize(['admin', 'editor']), upload.single('image'), floorPlanController.uploadImage);

// Booth operations
router.patch('/:floorPlanId/booths/:shapeId/status', authorize(['admin', 'editor']), floorPlanController.updateBoothStatus);

// Quick operations
router.patch('/:id/quick-save', authorize(['admin', 'editor']), floorPlanController.quickSave);
router.post('/:id/duplicate', authorize(['admin', 'editor']), floorPlanController.duplicateFloorPlan);

// Export
router.get('/:id/export', authorize(['admin', 'editor', 'viewer']), floorPlanController.exportFloorPlan);

module.exports = router;