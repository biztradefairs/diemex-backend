const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinaryService = require('../services/CloudinaryService');
const { authenticateExhibitor } = require('../middleware/auth');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Upload endpoint
router.post('/', authenticateExhibitor, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const folder = req.body.folder || 'exhibitor-files';
    
    // Upload to Cloudinary
    const result = await cloudinaryService.uploadImage(req.file.buffer, {
      folder: folder,
      resource_type: req.file.mimetype.startsWith('image/') ? 'image' : 'auto'
    });

    res.json({
      success: true,
      data: {
        url: result.url,
        publicId: result.publicId,
        format: result.format,
        bytes: result.bytes
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete from Cloudinary
router.delete('/:publicId', authenticateExhibitor, async (req, res) => {
  try {
    const { publicId } = req.params;
    await cloudinaryService.deleteImage(publicId);
    
    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;