// src/routes/manualRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const manualController = require('../controllers/manualController');
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
// TEXT SECTIONS ROUTES (for exhibitor manual content)
// ======================================================

// Get all text sections (public)
router.get('/sections', manualController.getAllSections);

// Get single section by ID (public)
router.get('/sections/:id', manualController.getSectionById);

// Create new text section (admin only)
router.post(
  '/sections',
  authenticate,
  authorize(['admin']),
  manualController.createSection
);

// Update text section (admin only)
router.put(
  '/sections/:id',
  authenticate,
  authorize(['admin']),
  manualController.updateSection
);

// Delete text section (admin only)
router.delete(
  '/sections/:id',
  authenticate,
  authorize(['admin']),
  manualController.deleteSection
);

// Bulk delete sections (admin only)
router.delete(
  '/sections/bulk/delete',
  authenticate,
  authorize(['admin']),
  manualController.bulkDeleteSections
);

// ======================================================
// PDF ROUTES (separate from text sections)
// ======================================================

// Get all PDFs (public)
router.get('/pdfs', manualController.getAllPDFs);

// Get PDF by ID (public)
router.get('/pdfs/:id', manualController.getPDFById);

// Download PDF (public)
router.get('/pdfs/:id/download', manualController.downloadPDF);

// Upload PDF (admin only)
router.post(
  '/pdfs/upload',
  authenticate,
  authorize(['admin']),
  upload.single('file'),
  manualController.uploadPDF
);

// Delete PDF (admin only)
router.delete(
  '/pdfs/:id',
  authenticate,
  authorize(['admin']),
  manualController.deletePDF
);

// ======================================================
// EXISTING PUBLIC ROUTES
// ======================================================

// Get statistics
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

router.get('/admin/all', manualController.getAllManualsForAdmin);

// Get statistics for admin exhibition page
router.get('/admin/statistics', manualController.getAdminStatistics);

// ======================================================
// EXISTING ADMIN ROUTES (Protected)
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