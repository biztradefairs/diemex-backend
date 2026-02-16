// src/routes/manualRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const manualController = require('../controllers/ManualController');
const { authenticate, authorize } = require('../middleware/auth');

// ======================
// Multer Configuration
// ======================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, Excel, and PowerPoint files are allowed.'));
    }
  }
});

// ======================================================
// PUBLIC ROUTES (Accessible without authentication)
// ======================================================

// Get statistics - MOVED TO TOP to avoid conflict
router.get('/statistics/overview', manualController.getStatistics);

// Get all manuals with filters
router.get('/', manualController.getAllManuals);

// Search manuals
router.get('/search', manualController.searchManuals);

// Get recent manuals
router.get('/recent', manualController.getRecentManuals);

// Get manuals by category
router.get('/category/:category', manualController.getManualsByCategory);

// Download manual
router.get('/:id/download', manualController.downloadManual);

// Preview manual
router.get('/:id/preview', manualController.getPreview);

// Get download count
router.get('/:id/download-count', manualController.getDownloadCount);

// Get single manual by ID - MUST be last
router.get('/:id', manualController.getManual);

// ======================================================
// ADMIN ROUTES (Protected)
// ======================================================

// Create manual
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  upload.single('file'),
  manualController.createManual
);

// Update manual
router.put(
  '/:id',
  authenticate,
  authorize(['admin']),
  upload.single('file'),
  manualController.updateManual
);

// Delete manual
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  manualController.deleteManual
);

// Bulk delete manuals
router.delete(
  '/bulk/delete',
  authenticate,
  authorize(['admin']),
  manualController.bulkDeleteManuals
);

// Update manual status
router.patch(
  '/:id/status',
  authenticate,
  authorize(['admin']),
  manualController.updateManualStatus
);

module.exports = router;