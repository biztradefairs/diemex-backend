const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinaryService = require('../services/CloudinaryService');
const { authenticateExhibitor } = require('../middleware/auth');

// ============================
// Multer Config (Memory)
// ============================
const storage = multer.memoryStorage();

const upload = multer({
  
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// ============================
// Upload File
// ============================
router.post(
  '/',
  authenticateExhibitor,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const folder = req.body.folder || 'exhibitor-files';

      // Determine correct resource type
      let resourceType = 'image';

      if (req.file.mimetype === 'application/pdf') {
        resourceType = 'raw';
      } else if (!req.file.mimetype.startsWith('image/')) {
        resourceType = 'raw';
      }

      const result = await cloudinaryService.uploadFile(
        req.file.buffer,
        {
          folder,
          resource_type: resourceType,
          type: 'upload',
          access_mode: 'public'
        }
      );

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
      console.error('❌ Upload error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ============================
// Delete File
// ============================
router.delete('/:publicId', authenticateExhibitor, async (req, res) => {
  try {
    const { publicId } = req.params;

    await cloudinaryService.deleteFile(publicId);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;