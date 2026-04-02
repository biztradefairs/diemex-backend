// controllers/VisitorController.js
const visitorService = require('../services/VisitorService');

class VisitorController {
  async getVisitorStats(req, res) {
    try {
      const { startDate, endDate, company } = req.query;
      const stats = await visitorService.getVisitorStats({ startDate, endDate, company });
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting visitor stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get visitor statistics'
      });
    }
  }

  async getAllVisitors(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const { search, startDate, endDate, company } = req.query;
      
      const result = await visitorService.getAllVisitors(page, limit, {
        search,
        startDate,
        endDate,
        company
      });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error getting visitors:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get visitors'
      });
    }
  }

  async getVisitorById(req, res) {
    try {
      const { id } = req.params;
      const visitor = await visitorService.getVisitorById(id);
      
      if (!visitor) {
        return res.status(404).json({
          success: false,
          error: 'Visitor not found'
        });
      }
      
      res.json({
        success: true,
        data: visitor
      });
    } catch (error) {
      console.error('Error getting visitor:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get visitor'
      });
    }
  }

  async getVisitorsByCompany(req, res) {
    try {
      const { company } = req.params;
      const visitors = await visitorService.getVisitorsByCompany(company);
      
      res.json({
        success: true,
        data: visitors
      });
    } catch (error) {
      console.error('Error getting visitors by company:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get visitors'
      });
    }
  }
}

module.exports = new VisitorController();