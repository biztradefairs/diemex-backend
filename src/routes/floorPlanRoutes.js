// routes/floorPlanRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const BoothService = require('../services/BoothService');

// Configure multer with memory storage and file size limit
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// ==============================
// GET FLOOR PLAN
// ==============================
router.get('/', async (req, res) => {
  try {
    const result = await BoothService.getFloorPlan();
    res.json(result);
  } catch (error) {
    console.error('❌ Get floor plan error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==============================
// UPLOAD FLOOR PLAN IMAGE - FIXED
// ==============================
router.post('/upload-image', (req, res) => {
  // Use multer as middleware with error handling
  upload.single('image')(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({
        success: false,
        error: 'File upload error: ' + err.message
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No image file provided'
        });
      }

      console.log('✅ File received via multer:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        hasBuffer: !!req.file.buffer,
        bufferLength: req.file.buffer?.length
      });

      const userId = req.user?.id || null;
      
      // Pass the multer file object directly - it already has the correct structure
      const result = await BoothService.uploadFloorPlanImage(req.file, userId);
      
      res.json(result);

    } catch (error) {
      console.error('❌ Upload image error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Upload failed'
      });
    }
  });
});

// ==============================
// RESET FLOOR PLAN
// ==============================
router.post('/reset', async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const result = await BoothService.resetFloorPlan(userId);
    res.json(result);
  } catch (error) {
    console.error('❌ Reset error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==============================
// SAVE FLOOR PLAN
// ==============================
router.post('/save-floor-plan', async (req, res) => {
  try {
    const { booths } = req.body;
    const userId = req.user?.id || null;

    const result = await BoothService.saveFloorPlan(booths, userId);
    res.json(result);
  } catch (error) {
    console.error('❌ Save floor plan error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==============================
// ADD BOOTH
// ==============================
router.post('/booth', async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const result = await BoothService.addBooth(req.body, userId);
    res.json(result);
  } catch (error) {
    console.error('❌ Add booth error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==============================
// UPDATE BOOTH
// ==============================
router.put('/booth/:boothId', async (req, res) => {
  try {
    const { boothId } = req.params;
    const userId = req.user?.id || null;
    const result = await BoothService.updateBooth(boothId, req.body, userId);
    res.json(result);
  } catch (error) {
    console.error('❌ Update booth error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==============================
// DELETE BOOTH
// ==============================
router.delete('/booth/:boothId', async (req, res) => {
  try {
    const { boothId } = req.params;
    const userId = req.user?.id || null;
    const result = await BoothService.deleteBooth(boothId, userId);
    res.json(result);
  } catch (error) {
    console.error('❌ Delete booth error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==============================
// GET STATISTICS
// ==============================
router.get('/statistics', async (req, res) => {
  try {
    const result = await BoothService.getBoothStatistics();
    res.json(result);
  } catch (error) {
    console.error('❌ Get statistics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;