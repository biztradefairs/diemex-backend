const express = require('express');
const router = express.Router();
const { authenticateExhibitor } = require('../middleware/auth');

// Get all products for exhibitor
router.get('/', authenticateExhibitor, async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Product = modelFactory.getModel('Product');
    
    const products = await Product.findAll({
      where: { exhibitorId: req.user.id }
    });
    
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add product
router.post('/', authenticateExhibitor, async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Product = modelFactory.getModel('Product');
    
    const product = await Product.create({
      ...req.body,
      exhibitorId: req.user.id
    });
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete product
router.delete('/:id', authenticateExhibitor, async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Product = modelFactory.getModel('Product');
    
    await Product.destroy({
      where: {
        id: req.params.id,
        exhibitorId: req.user.id
      }
    });
    
    res.json({
      success: true,
      message: 'Product deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;