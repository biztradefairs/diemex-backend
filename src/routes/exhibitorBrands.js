const express = require('express');
const router = express.Router();
const { authenticateExhibitor } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/brands');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'brand-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpg|jpeg|png|gif|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG, GIF, SVG) are allowed'));
    }
  }
});

// ======================
// PUBLIC ROUTES (No Auth Required)
// ======================

// Get all brands for a specific exhibitor (public)
router.get('/:exhibitorId', async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brand = modelFactory.getModel('Brand');
    
    const brands = await Brand.findAll({
      where: { 
        exhibitorId: req.params.exhibitorId,
        isPublic: true // Only show public brands
      },
      order: [['name', 'ASC']]
    });
    
    // Add full URL for logo access
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const brandsWithUrls = brands.map(brand => {
      const brandData = brand.toJSON();
      if (brandData.logoPath) {
        brandData.logoUrl = `${baseUrl}${brandData.logoPath}`;
      }
      return brandData;
    });
    
    res.json({
      success: true,
      data: brandsWithUrls
    });
  } catch (error) {
    console.error('Error fetching public brands:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get single brand by ID (public - if public)
router.get('/:exhibitorId/:brandId', async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brand = modelFactory.getModel('Brand');
    
    const brand = await Brand.findOne({
      where: { 
        id: req.params.brandId,
        exhibitorId: req.params.exhibitorId,
        isPublic: true
      }
    });
    
    if (!brand) {
      return res.status(404).json({
        success: false,
        error: 'Brand not found'
      });
    }
    
    // Add full URL for logo access
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const brandData = brand.toJSON();
    if (brandData.logoPath) {
      brandData.logoUrl = `${baseUrl}${brandData.logoPath}`;
    }
    
    res.json({
      success: true,
      data: brandData
    });
  } catch (error) {
    console.error('Error fetching public brand:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ======================
// PROTECTED ROUTES (Auth Required)
// ======================

// Get all brands for logged-in exhibitor
router.get('/', authenticateExhibitor, async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brand = modelFactory.getModel('Brand');
    
    const brands = await Brand.findAll({
      where: { exhibitorId: req.user.id },
      order: [['name', 'ASC']]
    });
    
    // Add full URL for logo access
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const brandsWithUrls = brands.map(brand => {
      const brandData = brand.toJSON();
      if (brandData.logoPath) {
        brandData.logoUrl = `${baseUrl}${brandData.logoPath}`;
      }
      return brandData;
    });
    
    res.json({
      success: true,
      data: brandsWithUrls
    });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get single brand by ID (for logged-in exhibitor)
router.get('/brand/:id', authenticateExhibitor, async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brand = modelFactory.getModel('Brand');
    
    const brand = await Brand.findOne({
      where: { 
        id: req.params.id,
        exhibitorId: req.user.id
      }
    });
    
    if (!brand) {
      return res.status(404).json({
        success: false,
        error: 'Brand not found'
      });
    }
    
    // Add full URL for logo access
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const brandData = brand.toJSON();
    if (brandData.logoPath) {
      brandData.logoUrl = `${baseUrl}${brandData.logoPath}`;
    }
    
    res.json({
      success: true,
      data: brandData
    });
  } catch (error) {
    console.error('Error fetching brand:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add new brand
router.post('/', authenticateExhibitor, upload.single('logo'), async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brand = modelFactory.getModel('Brand');
    
    const { name, description, website, isPublic = true } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Brand name is required'
      });
    }
    
    // Check if brand with same name already exists for this exhibitor
    const existingBrand = await Brand.findOne({
      where: {
        name: name,
        exhibitorId: req.user.id
      }
    });
    
    if (existingBrand) {
      return res.status(400).json({
        success: false,
        error: 'A brand with this name already exists'
      });
    }
    
    const brandData = {
      name,
      description,
      website,
      isPublic: isPublic === 'true' || isPublic === true,
      exhibitorId: req.user.id,
      logoFileName: req.file ? req.file.originalname : null,
      logoFileSize: req.file ? req.file.size : null,
      logoFileType: req.file ? req.file.mimetype : null,
      logoPath: req.file ? `/uploads/brands/${req.file.filename}` : null
    };
    
    const brand = await Brand.create(brandData);
    
    // Add full URL for logo access
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const brandDataWithUrl = brand.toJSON();
    if (brandDataWithUrl.logoPath) {
      brandDataWithUrl.logoUrl = `${baseUrl}${brandDataWithUrl.logoPath}`;
    }
    
    res.json({
      success: true,
      message: 'Brand added successfully',
      data: brandDataWithUrl
    });
  } catch (error) {
    console.error('Error creating brand:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update brand
router.put('/:id', authenticateExhibitor, async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brand = modelFactory.getModel('Brand');
    
    const brand = await Brand.findOne({
      where: { 
        id: req.params.id,
        exhibitorId: req.user.id
      }
    });
    
    if (!brand) {
      return res.status(404).json({
        success: false,
        error: 'Brand not found'
      });
    }
    
    const { name, description, website, isPublic } = req.body;
    
    // Check if name is being changed and if it conflicts with existing brand
    if (name && name !== brand.name) {
      const existingBrand = await Brand.findOne({
        where: {
          name: name,
          exhibitorId: req.user.id,
          id: { [require('sequelize').Op.ne]: req.params.id }
        }
      });
      
      if (existingBrand) {
        return res.status(400).json({
          success: false,
          error: 'A brand with this name already exists'
        });
      }
    }
    
    await brand.update({
      name: name || brand.name,
      description: description !== undefined ? description : brand.description,
      website: website !== undefined ? website : brand.website,
      isPublic: isPublic !== undefined ? isPublic : brand.isPublic
    });
    
    // Add full URL for logo access
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const brandData = brand.toJSON();
    if (brandData.logoPath) {
      brandData.logoUrl = `${baseUrl}${brandData.logoPath}`;
    }
    
    res.json({
      success: true,
      message: 'Brand updated successfully',
      data: brandData
    });
  } catch (error) {
    console.error('Error updating brand:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete brand
router.delete('/:id', authenticateExhibitor, async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brand = modelFactory.getModel('Brand');
    
    const brand = await Brand.findOne({
      where: { 
        id: req.params.id,
        exhibitorId: req.user.id
      }
    });
    
    if (!brand) {
      return res.status(404).json({
        success: false,
        error: 'Brand not found'
      });
    }
    
    // Delete logo file if exists
    if (brand.logoPath) {
      const filePath = path.join(__dirname, '../..', brand.logoPath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    await brand.destroy();
    
    res.json({
      success: true,
      message: 'Brand deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting brand:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update brand logo
router.put('/:id/logo', authenticateExhibitor, upload.single('logo'), async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brand = modelFactory.getModel('Brand');
    
    const brand = await Brand.findOne({
      where: { 
        id: req.params.id,
        exhibitorId: req.user.id
      }
    });
    
    if (!brand) {
      return res.status(404).json({
        success: false,
        error: 'Brand not found'
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No logo file uploaded'
      });
    }
    
    // Delete old logo if exists
    if (brand.logoPath) {
      const oldFilePath = path.join(__dirname, '../..', brand.logoPath);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }
    
    await brand.update({
      logoFileName: req.file.originalname,
      logoFileSize: req.file.size,
      logoFileType: req.file.mimetype,
      logoPath: `/uploads/brands/${req.file.filename}`
    });
    
    // Add full URL for logo access
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const brandData = brand.toJSON();
    brandData.logoUrl = `${baseUrl}${brandData.logoPath}`;
    
    res.json({
      success: true,
      message: 'Brand logo updated successfully',
      data: brandData
    });
  } catch (error) {
    console.error('Error updating brand logo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;