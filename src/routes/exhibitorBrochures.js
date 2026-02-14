const express = require('express');
const router = express.Router();
const { authenticateExhibitor } = require('../middleware/auth');

// Get all brochures for exhibitor
router.get('/', authenticateExhibitor, async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brochure = modelFactory.getModel('Brochure');
    
    const brochures = await Brochure.findAll({
      where: { exhibitorId: req.user.id }
    });
    
    res.json({
      success: true,
      data: brochures
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add brochure
router.post('/', authenticateExhibitor, async (req, res) => {
  try {
    const modelFactory = require('../models');
    const Brochure = modelFactory.getModel('Brochure');
    
    const brochure = await Brochure.create({
      ...req.body,
      exhibitorId: req.user.id
    });
    
    res.json({
      success: true,
      data: brochure
    });
  } catch (error) {
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
    
    await Brochure.destroy({
      where: {
        id: req.params.id,
        exhibitorId: req.user.id
      }
    });
    
    res.json({
      success: true,
      message: 'Brochure deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;