// src/routes/manualSectionRoutes.js
const express = require('express');
const router = express.Router();
const manualSectionController = require('../controllers/manualSectionController');
const { authenticate, authorize } = require('../middleware/auth');

// Public routes (for exhibitor view)
router.get('/', manualSectionController.getAllSections);

// Protected routes (admin only)
router.post(
  '/', 
  authenticate, 
  authorize(['admin']), 
  manualSectionController.createSection
);

module.exports = router;