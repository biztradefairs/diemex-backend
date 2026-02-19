const housekeepingService = require('../services/HousekeepingService');

class HousekeepingController {
  // Get current configuration
  async getConfig(req, res) {
    try {
      console.log('Fetching housekeeping configuration');
      
      const result = await housekeepingService.getConfig();
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in getConfig:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch housekeeping configuration'
      });
    }
  }

  // Update configuration
  async updateConfig(req, res) {
    try {
      const { chargesPerShift, shiftHours } = req.body;
      
      if (chargesPerShift === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Charges per shift is required'
        });
      }

      if (chargesPerShift < 0) {
        return res.status(400).json({
          success: false,
          message: 'Charges cannot be negative'
        });
      }

      console.log('Updating housekeeping rate to:', chargesPerShift);
      
      const result = await housekeepingService.updateConfig(chargesPerShift, shiftHours);
      
      res.json({
        success: true,
        data: result.data,
        message: 'Housekeeping rate updated successfully'
      });
    } catch (error) {
      console.error('Error in updateConfig:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to update housekeeping rate'
      });
    }
  }

  // Calculate cost for shifts
  async calculateCost(req, res) {
    try {
      const { shifts } = req.body;
      
      if (!shifts || shifts < 1) {
        return res.status(400).json({
          success: false,
          message: 'Number of shifts is required and must be at least 1'
        });
      }

      const result = await housekeepingService.calculateCost(shifts);
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in calculateCost:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to calculate cost'
      });
    }
  }

  // Calculate cost for custom hours
  async calculateCustomHours(req, res) {
    try {
      const { hours, staff } = req.body;
      
      if (!hours || hours < 1) {
        return res.status(400).json({
          success: false,
          message: 'Number of hours is required and must be at least 1'
        });
      }

      const numberOfStaff = staff || 1;
      const result = await housekeepingService.calculateCustomHours(hours, numberOfStaff);
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in calculateCustomHours:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to calculate custom hours cost'
      });
    }
  }

  // Bulk calculate
  async bulkCalculate(req, res) {
    try {
      const { shifts } = req.body;
      
      if (!shifts || !Array.isArray(shifts) || shifts.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please provide an array of shifts'
        });
      }

      // Validate each shift
      for (const shift of shifts) {
        if (!shift.shifts || shift.shifts < 1) {
          return res.status(400).json({
            success: false,
            message: 'Each shift must have a valid number of shifts'
          });
        }
      }

      const result = await housekeepingService.bulkCalculate(shifts);
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in bulkCalculate:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to calculate bulk costs'
      });
    }
  }

  // Get rate history
  async getRateHistory(req, res) {
    try {
      const result = await housekeepingService.getRateHistory();
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in getRateHistory:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch rate history'
      });
    }
  }

  // Reset to default
  async resetToDefault(req, res) {
    try {
      const result = await housekeepingService.resetToDefault();
      
      res.json({
        success: true,
        data: result.data,
        message: result.message || 'Rate reset to default successfully'
      });
    } catch (error) {
      console.error('Error in resetToDefault:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to reset to default'
      });
    }
  }

  // Get statistics
  async getStatistics(req, res) {
    try {
      const result = await housekeepingService.getStatistics();
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in getStatistics:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch statistics'
      });
    }
  }
}

module.exports = new HousekeepingController();