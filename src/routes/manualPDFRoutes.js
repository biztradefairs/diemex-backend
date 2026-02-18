// src/routes/manualPDFRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const pdfController = require('../controllers/manualPDFController');
const { authenticate, authorize } = require('../middleware/auth');

// Public route - get all PDFs
router.get('/', pdfController.getAllPDFs);

// Admin only - upload PDF
router.post(
  '/upload',
  authenticate,
  authorize(['admin']),
  upload.single('file'),
  pdfController.uploadPDF
);

module.exports = router;