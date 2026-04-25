// controllers/DashboardController.js
const dashboardService = require('../services/DashboardService');

class DashboardController {
  async getSummary(req, res) {
    try {
      const summary = await dashboardService.getDashboardSummary();
      
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('Error getting dashboard summary:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get dashboard summary'
      });
    }
  }

  async getHealth(req, res) {
    try {
      const health = await dashboardService.getSystemHealth();
      
      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      console.error('Error getting system health:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get system health'
      });
    }
  }

  async getUserStats(req, res) {
    try {
      const models = await dashboardService.getModels();
      const userStats = await dashboardService.getUserStats(models);
      
      res.json({
        success: true,
        data: userStats
      });
    } catch (error) {
      console.error('Error getting user stats:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get user stats'
      });
    }
  }

  async getExhibitorStats(req, res) {
    try {
      const models = await dashboardService.getModels();
      const exhibitorStats = await dashboardService.getExhibitorStats(models);
      
      res.json({
        success: true,
        data: exhibitorStats
      });
    } catch (error) {
      console.error('Error getting exhibitor stats:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get exhibitor stats'
      });
    }
  }

  

  async getVisitorStats(req, res) {
    try {
      const models = await dashboardService.getModels();
      const visitorStats = await dashboardService.getVisitorStats(models);
      
      res.json({
        success: true,
        data: visitorStats
      });
    } catch (error) {
      console.error('Error getting visitor stats:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get visitor stats'
      });
    }
  }

  async getRecentActivities(req, res) {
    try {
      const models = await dashboardService.getModels();
      const activities = await dashboardService.getRecentActivities(models);
      
      res.json({
        success: true,
        data: activities
      });
    } catch (error) {
      console.error('Error getting recent activities:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get recent activities'
      });
    }
  }
}

module.exports = new DashboardController();