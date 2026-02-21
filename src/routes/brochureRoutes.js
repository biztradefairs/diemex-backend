const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { authenticateExhibitor } = require('../middleware/auth');

// Get all brochures for logged-in exhibitor
router.get('/', authenticateExhibitor, async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brochure = modelFactory.getModel('Brochure');

    const brochures = await Brochure.findAll({
      where: { exhibitorId: req.user.id },
      order: [['createdAt', 'DESC']],
    });

    // Add full URLs for files
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const brochuresWithUrls = brochures.map(brochure => {
      const data = brochure.toJSON();
      if (data.filePath) {
        data.fileUrl = `${baseUrl}${data.filePath}`;
      }
      return data;
    });

    res.json({
      success: true,
      data: brochuresWithUrls,
    });
  } catch (error) {
    console.error('Error fetching brochures:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Serve brochure file directly
router.get('/file/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../uploads/brochures', filename);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      error: 'File not found'
    });
  }

  // Send the file
  res.sendFile(filePath);
});

// Download brochure
router.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../uploads/brochures', filename);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      error: 'File not found'
    });
  }

  // Set headers for download
  res.download(filePath, filename, (err) => {
    if (err) {
      console.error('Download error:', err);
      res.status(500).json({
        success: false,
        error: 'Error downloading file'
      });
    }
  });
});

module.exports = router;