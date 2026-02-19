const securityGuardService = require('../services/SecurityGuardService');

class SecurityGuardController {
  // Get current configuration
  async getConfig(req, res) {
    try {
      console.log('Fetching security guard configuration');
      
      const result = await securityGuardService.getConfig();
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in getConfig:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch security guard configuration'
      });
    }
  }

  // Update configuration
  async updateConfig(req, res) {
    try {
      const { ratePerGuardPerDay } = req.body;
      
      if (ratePerGuardPerDay === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Rate per guard per day is required'
        });
      }

      if (ratePerGuardPerDay < 0) {
        return res.status(400).json({
          success: false,
          message: 'Rate cannot be negative'
        });
      }

      console.log('Updating security guard rate to:', ratePerGuardPerDay);
      
      const result = await securityGuardService.updateConfig(ratePerGuardPerDay);
      
      res.json({
        success: true,
        data: result.data,
        message: 'Security guard rate updated successfully'
      });
    } catch (error) {
      console.error('Error in updateConfig:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to update security guard rate'
      });
    }
  }

  // Calculate cost
  async calculateCost(req, res) {
    try {
      const { guards, days } = req.body;
      
      if (!guards || guards < 1) {
        return res.status(400).json({
          success: false,
          message: 'Number of guards is required and must be at least 1'
        });
      }

      if (!days || days < 1) {
        return res.status(400).json({
          success: false,
          message: 'Number of days is required and must be at least 1'
        });
      }

      const result = await securityGuardService.calculateCost(guards, days);
      
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

  // Get rate history
  async getRateHistory(req, res) {
    try {
      const result = await securityGuardService.getRateHistory();
      
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
      const result = await securityGuardService.resetToDefault();
      
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
}

module.exports = new SecurityGuardController();