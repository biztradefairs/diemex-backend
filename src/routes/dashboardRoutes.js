// routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/DashboardController');
const { authenticate, authorize } = require('../middleware/auth');

// Health check (public)
router.get('/health', dashboardController.getHealth);

// Protected routes - require authentication
router.use(authenticate);

// Admin only routes
router.get('/summary',
  authorize(['admin']),
  dashboardController.getSummary
);

router.get('/users/stats',
  authorize(['admin']),
  dashboardController.getUserStats
);

router.get('/exhibitors/stats',
  authorize(['admin']),
  dashboardController.getExhibitorStats
);

router.get('/visitors/stats',
  authorize(['admin']),
  dashboardController.getVisitorStats
);

router.get('/activities/recent',
  authorize(['admin', 'editor']),
  dashboardController.getRecentActivities
);

module.exports = router;