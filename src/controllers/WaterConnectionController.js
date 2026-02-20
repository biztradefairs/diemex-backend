const waterConnectionService = require('../services/WaterConnectionService');

class WaterConnectionController {
  // Get current configuration
  async getConfig(req, res) {
    try {
      console.log('📊 Fetching water connection configuration');
      const result = await waterConnectionService.getConfig();
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('❌ Error in getConfig:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch water connection configuration'
      });
    }
  }

  // Update configuration
  async updateConfig(req, res) {
    try {
      const { costPerConnection } = req.body;
      
      if (costPerConnection === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Cost per connection is required'
        });
      }

      const cost = parseInt(costPerConnection);
      if (isNaN(cost) || cost < 0) {
        return res.status(400).json({
          success: false,
          message: 'Cost must be a valid positive number'
        });
      }

      console.log('📝 Updating water connection cost to:', cost);
      const result = await waterConnectionService.updateConfig(cost);
      
      res.json({
        success: true,
        data: result.data,
        message: 'Water connection rate updated successfully'
      });
    } catch (error) {
      console.error('❌ Error in updateConfig:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to update water connection rate'
      });
    }
  }

  // Calculate cost
  async calculateCost(req, res) {
    try {
      const { connections } = req.body;
      
      if (!connections || connections < 1) {
        return res.status(400).json({
          success: false,
          message: 'Number of connections is required and must be at least 1'
        });
      }

      const result = await waterConnectionService.calculateCost(parseInt(connections));
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('❌ Error in calculateCost:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to calculate cost'
      });
    }
  }

  // Get rate history
  async getRateHistory(req, res) {
    try {
      const result = await waterConnectionService.getRateHistory();
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('❌ Error in getRateHistory:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch rate history'
      });
    }
  }

  // Reset to default
  async resetToDefault(req, res) {
    try {
      const result = await waterConnectionService.resetToDefault();
      
      res.json({
        success: true,
        data: result.data,
        message: result.message || 'Rate reset to default successfully'
      });
    } catch (error) {
      console.error('❌ Error in resetToDefault:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to reset to default'
      });
    }
  }

  // Get statistics
  async getStatistics(req, res) {
    try {
      const result = await waterConnectionService.getStatistics();
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('❌ Error in getStatistics:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch statistics'
      });
    }
  }

  // Bulk calculate
  async bulkCalculate(req, res) {
    try {
      const { connections } = req.body;
      
      if (!connections || !Array.isArray(connections) || connections.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please provide an array of connections'
        });
      }

      for (const conn of connections) {
        if (!conn.quantity || conn.quantity < 1) {
          return res.status(400).json({
            success: false,
            message: 'Each connection must have a valid quantity'
          });
        }
      }

      const result = await waterConnectionService.bulkCalculate(connections);
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('❌ Error in bulkCalculate:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to calculate bulk costs'
      });
    }
  }
}

module.exports = new WaterConnectionController();