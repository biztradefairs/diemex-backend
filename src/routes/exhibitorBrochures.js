const express = require('express');
const router = express.Router();
const { authenticateExhibitor } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/brochures');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'brochure-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|ppt|pptx|jpg|jpeg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, Word, PowerPoint, and image files are allowed'));
    }
  }
});

// ======================
// PUBLIC ROUTES (No Auth Required)
// ======================

// Get all brochures for a specific exhibitor (public)
router.get('/:exhibitorId', async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brochure = modelFactory.getModel('Brochure');
    
    const brochures = await Brochure.findAll({
      where: { 
        exhibitorId: req.params.exhibitorId,
        isPublic: true // Only show public brochures
      },
      order: [['createdAt', 'DESC']]
    });
    
    // Add full URL for file access
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const brochuresWithUrls = brochures.map(brochure => {
      const brochureData = brochure.toJSON();
      if (brochureData.filePath) {
        brochureData.fileUrl = `${baseUrl}${brochureData.filePath}`;
      }
      return brochureData;
    });
    
    res.json({
      success: true,
      data: brochuresWithUrls
    });
  } catch (error) {
    console.error('Error fetching public brochures:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get single brochure by ID (public - if public)
router.get('/:exhibitorId/:brochureId', async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brochure = modelFactory.getModel('Brochure');
    
    const brochure = await Brochure.findOne({
      where: { 
        id: req.params.brochureId,
        exhibitorId: req.params.exhibitorId,
        isPublic: true
      }
    });
    
    if (!brochure) {
      return res.status(404).json({
        success: false,
        error: 'Brochure not found'
      });
    }
    
    // Add full URL for file access
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const brochureData = brochure.toJSON();
    if (brochureData.filePath) {
      brochureData.fileUrl = `${baseUrl}${brochureData.filePath}`;
    }
    
    res.json({
      success: true,
      data: brochureData
    });
  } catch (error) {
    console.error('Error fetching public brochure:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Download brochure file (public)
router.get('/:exhibitorId/:brochureId/download', async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brochure = modelFactory.getModel('Brochure');
    
    const brochure = await Brochure.findOne({
      where: { 
        id: req.params.brochureId,
        exhibitorId: req.params.exhibitorId,
        isPublic: true
      }
    });
    
    if (!brochure || !brochure.filePath) {
      return res.status(404).json({
        success: false,
        error: 'Brochure not found'
      });
    }
    
    const filePath = path.join(__dirname, '../..', brochure.filePath);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    res.download(filePath, brochure.fileName || 'brochure.pdf');
  } catch (error) {
    console.error('Error downloading brochure:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ======================
// PROTECTED ROUTES (Auth Required)
// ======================

// Get all brochures for logged-in exhibitor
router.get('/', authenticateExhibitor, async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brochure = modelFactory.getModel('Brochure');
    
    const brochures = await Brochure.findAll({
      where: { exhibitorId: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    
    // Add full URL for file access
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const brochuresWithUrls = brochures.map(brochure => {
      const brochureData = brochure.toJSON();
      if (brochureData.filePath) {
        brochureData.fileUrl = `${baseUrl}${brochureData.filePath}`;
      }
      return brochureData;
    });
    
    res.json({
      success: true,
      data: brochuresWithUrls
    });
  } catch (error) {
    console.error('Error fetching brochures:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get single brochure by ID (for logged-in exhibitor)
router.get('/brochure/:id', authenticateExhibitor, async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brochure = modelFactory.getModel('Brochure');
    
    const brochure = await Brochure.findOne({
      where: { 
        id: req.params.id,
        exhibitorId: req.user.id
      }
    });
    
    if (!brochure) {
      return res.status(404).json({
        success: false,
        error: 'Brochure not found'
      });
    }
    
    // Add full URL for file access
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const brochureData = brochure.toJSON();
    if (brochureData.filePath) {
      brochureData.fileUrl = `${baseUrl}${brochureData.filePath}`;
    }
    
    res.json({
      success: true,
      data: brochureData
    });
  } catch (error) {
    console.error('Error fetching brochure:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add new brochure
router.post('/', authenticateExhibitor, upload.single('file'), async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brochure = modelFactory.getModel('Brochure');
    
    const { title, description, isPublic = true } = req.body;
    
    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required'
      });
    }
    
    const brochureData = {
      title,
      description,
      isPublic: isPublic === 'true' || isPublic === true,
      exhibitorId: req.user.id,
      fileName: req.file ? req.file.originalname : null,
      fileSize: req.file ? req.file.size : null,
      fileType: req.file ? req.file.mimetype : null,
      filePath: req.file ? `/uploads/brochures/${req.file.filename}` : null
    };
    
    const brochure = await Brochure.create(brochureData);
    
    // Add full URL for file access
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const brochureDataWithUrl = brochure.toJSON();
    if (brochureDataWithUrl.filePath) {
      brochureDataWithUrl.fileUrl = `${baseUrl}${brochureDataWithUrl.filePath}`;
    }
    
    res.json({
      success: true,
      message: 'Brochure added successfully',
      data: brochureDataWithUrl
    });
  } catch (error) {
    console.error('Error creating brochure:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update brochure
router.put('/:id', authenticateExhibitor, async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brochure = modelFactory.getModel('Brochure');
    
    const brochure = await Brochure.findOne({
      where: { 
        id: req.params.id,
        exhibitorId: req.user.id
      }
    });
    
    if (!brochure) {
      return res.status(404).json({
        success: false,
        error: 'Brochure not found'
      });
    }
    
    const { title, description, isPublic } = req.body;
    
    await brochure.update({
      title: title || brochure.title,
      description: description !== undefined ? description : brochure.description,
      isPublic: isPublic !== undefined ? isPublic : brochure.isPublic
    });
    
    // Add full URL for file access
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const brochureData = brochure.toJSON();
    if (brochureData.filePath) {
      brochureData.fileUrl = `${baseUrl}${brochureData.filePath}`;
    }
    
    res.json({
      success: true,
      message: 'Brochure updated successfully',
      data: brochureData
    });
  } catch (error) {
    console.error('Error updating brochure:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete brochure
router.delete('/:id', authenticateExhibitor, async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brochure = modelFactory.getModel('Brochure');
    
    const brochure = await Brochure.findOne({
      where: { 
        id: req.params.id,
        exhibitorId: req.user.id
      }
    });
    
    if (!brochure) {
      return res.status(404).json({
        success: false,
        error: 'Brochure not found'
      });
    }
    
    // Delete file if exists
    if (brochure.filePath) {
      const filePath = path.join(__dirname, '../..', brochure.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    await brochure.destroy();
    
    res.json({
      success: true,
      message: 'Brochure deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting brochure:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update brochure file
router.put('/:id/file', authenticateExhibitor, upload.single('file'), async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brochure = modelFactory.getModel('Brochure');
    
    const brochure = await Brochure.findOne({
      where: { 
        id: req.params.id,
        exhibitorId: req.user.id
      }
    });
    
    if (!brochure) {
      return res.status(404).json({
        success: false,
        error: 'Brochure not found'
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }
    
    // Delete old file if exists
    if (brochure.filePath) {
      const oldFilePath = path.join(__dirname, '../..', brochure.filePath);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }
    
    await brochure.update({
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      filePath: `/uploads/brochures/${req.file.filename}`
    });
    
    // Add full URL for file access
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const brochureData = brochure.toJSON();
    brochureData.fileUrl = `${baseUrl}${brochureData.filePath}`;
    
    res.json({
      success: true,
      message: 'Brochure file updated successfully',
      data: brochureData
    });
  } catch (error) {
    console.error('Error updating brochure file:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;