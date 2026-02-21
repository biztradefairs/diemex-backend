const express = require('express');
const router = express.Router();
const { authenticateExhibitor } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ======================================================
// 📁 Upload Directory (Global & Safe)
// ======================================================
const uploadBaseDir = path.join(process.cwd(), 'uploads');
const brochureUploadDir = path.join(uploadBaseDir, 'brochures');

// Ensure base upload folder exists
if (!fs.existsSync(brochureUploadDir)) {
  fs.mkdirSync(brochureUploadDir, { recursive: true });
  console.log('📁 Created brochures upload directory:', brochureUploadDir);
}

// ======================================================
// 📦 Multer Configuration
// ======================================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, brochureUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix =
      Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'brochure-' + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes =
      /pdf|doc|docx|ppt|pptx|jpg|jpeg|png/;

    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    const mimetype =
      allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Only PDF, Word, PowerPoint, and image files are allowed'
        )
      );
    }
  },
});

// ======================================================
// 📥 GET All Brochures (Logged-in Exhibitor)
// ======================================================
router.get('/', authenticateExhibitor, async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brochure = modelFactory.getModel('Brochure');

    const brochures = await Brochure.findAll({
      where: { exhibitorId: req.user.id },
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      data: brochures,
    });
  } catch (error) {
    console.error('Error fetching brochures:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ======================================================
// 📤 CREATE Brochure
// ======================================================
router.post(
  '/',
  authenticateExhibitor,
  upload.single('file'),
  async (req, res) => {
    try {
      const modelFactory = require('../models');
      const Brochure = modelFactory.getModel('Brochure');

      const { title, description, isPublic = true } = req.body;

      // Validation
      if (!title) {
        return res.status(400).json({
          success: false,
          error: 'Title is required',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'File is required',
        });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const filePath = `/uploads/brochures/${req.file.filename}`;
      const fileUrl = `${baseUrl}${filePath}`;

      const brochure = await Brochure.create({
        name: title,
        description: description || '',
        isPublic:
          isPublic === 'true' || isPublic === true,
        exhibitorId: req.user.id,

        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        filePath: filePath,
        fileUrl: fileUrl,
      });

      res.json({
        success: true,
        message: 'Brochure uploaded successfully',
        data: brochure,
      });
    } catch (error) {
      console.error('Error creating brochure:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ======================================================
// 🗑 DELETE Brochure
// ======================================================
router.delete('/:id', authenticateExhibitor, async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brochure = modelFactory.getModel('Brochure');

    const brochure = await Brochure.findOne({
      where: {
        id: req.params.id,
        exhibitorId: req.user.id,
      },
    });

    if (!brochure) {
      return res.status(404).json({
        success: false,
        error: 'Brochure not found',
      });
    }

    // Remove file from disk
    if (brochure.filePath) {
      const fullPath = path.join(process.cwd(), brochure.filePath);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log('🗑 Deleted file:', fullPath);
      }
    }

    await brochure.destroy();

    res.json({
      success: true,
      message: 'Brochure deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting brochure:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;