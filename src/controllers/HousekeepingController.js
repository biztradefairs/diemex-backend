// src/controllers/HousekeepingController.js
const housekeepingService = require('../services/HousekeepingService');

class HousekeepingController {

  async getConfig(req, res) {
    try {
      const result = await housekeepingService.getConfig();
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateConfig(req, res) {
    try {
      const { ratePerShift, shiftHours } = req.body;

      if (ratePerShift === undefined) {
        return res.status(400).json({
          success: false,
          message: 'ratePerShift is required'
        });
      }

      const result = await housekeepingService.updateConfig(ratePerShift, shiftHours);
      res.json(result);

    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // FIXED: Calculate cost with quantity and days
  async calculateCost(req, res) {
    try {
      const { quantity, days } = req.body;
      
      if (!quantity || quantity < 1) {
        return res.status(400).json({
          success: false,
          message: 'Quantity (number of staff) is required and must be at least 1'
        });
      }

      if (!days || days < 1) {
        return res.status(400).json({
          success: false,
          message: 'Number of days is required and must be at least 1'
        });
      }

      const result = await housekeepingService.calculateCost(parseInt(quantity), parseInt(days));
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // For backward compatibility - calculate with shifts
  async calculateWithShifts(req, res) {
    try {
      const { shifts } = req.body;
      const result = await housekeepingService.calculateWithShifts(shifts);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async calculateCustomHours(req, res) {
    try {
      const { hours, staff } = req.body;
      const result = await housekeepingService.calculateCustomHours(hours, staff);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getRateHistory(req, res) {
    try {
      const result = await housekeepingService.getRateHistory();
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async resetToDefault(req, res) {
    try {
      const result = await housekeepingService.resetToDefault();
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getStatistics(req, res) {
    try {
      const result = await housekeepingService.getStatistics();
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new HousekeepingController();