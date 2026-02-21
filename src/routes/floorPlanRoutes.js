const express = require('express');
const router = express.Router();
const multer = require('multer');
const BoothService = require('../services/BoothService');
const upload = multer({ storage: multer.memoryStorage() });

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
// UPLOAD FLOOR PLAN IMAGE
// ==============================
router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    const userId = req.user?.id || null; // if using auth
    const result = await BoothService.uploadFloorPlanImage(req.file, userId);

    res.json(result);

  } catch (error) {
    console.error('❌ Upload image error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
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

module.exports = router;