const express = require('express');
const router = express.Router();
const boothController = require('../controllers/FloorPlanController');
const multer = require('multer');
const { authenticate, authorize, authenticateExhibitor, authenticateAny } = require('../middleware/auth');

// Multer config
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

/* =========================================
   GLOBAL FLOOR PLAN (ALL ROLES)
========================================= */

router.get('/floor-plan', authenticateAny, boothController.getFloorPlan);


/* =========================================
   ADMIN / EDITOR / VIEWER ROUTES
========================================= */

// All routes below require authentication
router.use(authenticate);

// Get all booths
router.get(
  '/',
  authorize(['admin', 'editor', 'viewer']),
  boothController.getAllBooths
);

// Get booth statistics
router.get(
  '/statistics',
  authorize(['admin', 'editor', 'viewer']),
  boothController.getBoothStatistics
);

// Upload floor plan image
router.post(
  '/upload-image',
  authorize(['admin', 'editor']),
  upload.single('image'),
  boothController.uploadFloorPlanImage
);

// Save floor plan
router.post(
  '/save-floor-plan',
  authorize(['admin', 'editor']),
  boothController.saveFloorPlan
);

// Export floor plan
router.get(
  '/export',
  authorize(['admin', 'editor', 'viewer']),
  boothController.exportFloorPlan
);

// Add new booth
router.post(
  '/',
  authorize(['admin', 'editor']),
  boothController.addBooth
);

// Update booth position
router.patch(
  '/:boothId/position',
  authorize(['admin', 'editor']),
  boothController.updateBoothPosition
);

// Update booth status
router.patch(
  '/:boothId/status',
  authorize(['admin', 'editor']),
  boothController.updateBoothStatus
);

// Update company name
router.patch(
  '/:boothId/company',
  authorize(['admin', 'editor']),
  boothController.updateCompanyName
);

// Delete booth
router.delete(
  '/:boothId',
  authorize(['admin', 'editor']),
  boothController.deleteBooth
);

// Reset floor plan
router.post(
  '/reset',
  authorize(['admin']),
  boothController.resetFloorPlan
);

module.exports = router;