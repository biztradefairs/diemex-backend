const boothService = require('../services/FloorPlanService');

class BoothController {
  // Get all booths
  async getAllBooths(req, res) {
    try {
      const result = await boothService.getAllBooths(req.user?.id, req.user?.role);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Add new booth
  async addBooth(req, res) {
    try {
      const result = await boothService.addBooth(req.body, req.user?.id);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Update booth
  async updateBooth(req, res) {
    try {
      const { boothId } = req.params;
      const result = await boothService.updateBooth(boothId, req.body, req.user?.id);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Update booth status
  async updateBoothStatus(req, res) {
    try {
      const { boothId } = req.params;
      const { status } = req.body;
      
      if (!['available', 'booked', 'reserved'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status. Must be: available, booked, reserved'
        });
      }

      const result = await boothService.updateBoothStatus(boothId, status, req.user?.id);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Update company name
  async updateCompanyName(req, res) {
    try {
      const { boothId } = req.params;
      const { companyName } = req.body;
      
      const result = await boothService.updateCompanyName(boothId, companyName, req.user?.id);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Delete booth
  async deleteBooth(req, res) {
    try {
      const { boothId } = req.params;
      const result = await boothService.deleteBooth(boothId, req.user?.id);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Bulk update booths
  async bulkUpdateBooths(req, res) {
    try {
      const { updates } = req.body;
      const result = await boothService.bulkUpdateBooths(updates, req.user?.id);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get booth statistics
  async getBoothStatistics(req, res) {
    try {
      const result = await boothService.getBoothStatistics();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Reset floor plan to default
  async resetToDefault(req, res) {
    try {
      const result = await boothService.resetToDefault(req.user?.id);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new BoothController();