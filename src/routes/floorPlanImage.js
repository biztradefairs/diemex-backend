const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinaryService = require('../services/CloudinaryService');
const modelFactory = require('../models');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    // ✅ Get model INSIDE handler (after init)
    const FloorPlan = modelFactory.getModel('FloorPlan');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    // ✅ Use your CloudinaryService correctly
    const uploadResult = await cloudinaryService.uploadImage(req.file.buffer);

    let floorPlan = await FloorPlan.findOne({
      where: { isActive: true }
    });

    if (!floorPlan) {
      floorPlan = await FloorPlan.create({
        name: 'Main Floor Plan',
        imageUrl: uploadResult.url,
        booths: []
      });
    } else {
      floorPlan.imageUrl = uploadResult.url;
      await floorPlan.save();
    }

    res.json({
      success: true,
      imageUrl: uploadResult.url
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;