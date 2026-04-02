// routes/exhibitorStatsRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const modelFactory = require('../models');
const { getVisitorStats } = require('../services/googleAnalytics');

// Simple endpoint to get exhibitor count
router.get('/count', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const models = await modelFactory.init();
    const Exhibitor = models.Exhibitor;
    
    // Get all counts
    const total = await Exhibitor.count();
    const active = await Exhibitor.count({ where: { status: 'active' } });
    const pending = await Exhibitor.count({ where: { status: 'pending' } });
    const approved = await Exhibitor.count({ where: { status: 'approved' } });
    const rejected = await Exhibitor.count({ where: { status: 'rejected' } });
    const inactive = await Exhibitor.count({ where: { status: 'inactive' } });
    
    // Get recent exhibitors
    const recent = await Exhibitor.findAll({
      attributes: ['id', 'name', 'company', 'email', 'status', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 10
    });
    
    res.json({
      success: true,
      data: {
        total,
        active,
        pending,
        approved,
        rejected,
        inactive,
        recent
      }
    });
  } catch (error) {
    console.error('Error getting exhibitor stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/api/visitor-stats', authenticate, authorize(['admin']), (req, res) => {
  const stats = getVisitorStats();
  res.json({
    success: true,
    data: stats
  });
});

// Simple endpoint to get visitor count from Google Analytics or your DB
router.get('/visitor-count', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const total = await getVisitorStats();

    res.json({
      success: true,
      data: {
        total,
        source: 'google-analytics'
      }
    });

  } catch (error) {
    console.error('GA Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
async function getTodayVisitorCount(Visitor) {
  if (!Visitor) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return await Visitor.count({
    where: {
      createdAt: { [require('sequelize').Op.gte]: today }
    }
  });
}

async function getThisWeekVisitorCount(Visitor) {
  if (!Visitor) return 0;
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  return await Visitor.count({
    where: {
      createdAt: { [require('sequelize').Op.gte]: weekStart }
    }
  });
}

module.exports = router;