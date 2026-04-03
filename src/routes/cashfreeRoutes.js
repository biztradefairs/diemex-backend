// src/routes/cashfreeRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateExhibitor } = require('../middleware/auth');

// Cashfree routes - To be implemented when needed
// Currently returning 501 Not Implemented

router.post('/create-order', authenticateExhibitor, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Cashfree integration coming soon'
  });
});

router.post('/verify-payment', authenticateExhibitor, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Cashfree integration coming soon'
  });
});

router.get('/order-status/:orderId', authenticateExhibitor, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Cashfree integration coming soon'
  });
});

module.exports = router;