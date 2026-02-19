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
      const { chargesPerShift, shiftHours } = req.body;

      if (chargesPerShift === undefined) {
        return res.status(400).json({
          success: false,
          message: 'chargesPerShift is required'
        });
      }

      const result = await housekeepingService.updateConfig(chargesPerShift, shiftHours);
      res.json(result);

    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async calculateCost(req, res) {
    try {
      const { shifts } = req.body;
      const result = await housekeepingService.calculateCost(shifts);
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
