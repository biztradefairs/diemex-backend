const express = require('express');
const router = express.Router();
const { authenticateExhibitor } = require('../middleware/auth');

// Get all brands for exhibitor
router.get('/', authenticateExhibitor, async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brand = modelFactory.getModel('Brand');
    
    const brands = await Brand.findAll({
      where: { exhibitorId: req.user.id }
    });
    
    res.json({
      success: true,
      data: brands
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add brand
router.post('/', authenticateExhibitor, async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brand = modelFactory.getModel('Brand');
    
    const brand = await Brand.create({
      ...req.body,
      exhibitorId: req.user.id
    });
    
    res.json({
      success: true,
      data: brand
    });
  } catch (error) {
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
    
    await Brand.destroy({
      where: {
        id: req.params.id,
        exhibitorId: req.user.id
      }
    });
    
    res.json({
      success: true,
      message: 'Brand deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;