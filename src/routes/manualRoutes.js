// src/routes/manualRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const manualController = require('../controllers/manualController');
const { authenticate, authorize } = require('../middleware/auth');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'));
    }
  }
});

// Admin routes
router.post('/',
  authenticate,
  authorize(['admin']),
  upload.single('file'),
  manualController.createManual
);

router.put('/:id',
  authenticate,
  authorize(['admin']),
  upload.single('file'),
  manualController.updateManual
);

router.delete('/:id',
  authenticate,
  authorize(['admin']),
  manualController.deleteManual
);

router.get('/statistics',
  authenticate,
  authorize(['admin']),
  manualController.getStatistics
);

// Public routes (accessible to exhibitors)
router.get('/', manualController.getAllManuals);
router.get('/:id', manualController.getManual);
router.get('/:id/download', manualController.downloadManual);

module.exports = router;