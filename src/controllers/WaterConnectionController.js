const waterConnectionService = require('../services/WaterConnectionService');

class WaterConnectionController {
  // Get current configuration
  async getConfig(req, res) {
    try {
      console.log('Fetching water connection configuration');
      
      const result = await waterConnectionService.getConfig();
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in getConfig:', error);
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

      if (costPerConnection < 0) {
        return res.status(400).json({
          success: false,
          message: 'Cost cannot be negative'
        });
      }

      console.log('Updating water connection cost to:', costPerConnection);
      
      const result = await waterConnectionService.updateConfig(costPerConnection);
      
      res.json({
        success: true,
        data: result.data,
        message: 'Water connection rate updated successfully'
      });
    } catch (error) {
      console.error('Error in updateConfig:', error);
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

      const result = await waterConnectionService.calculateCost(connections);
      
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

  // Bulk calculate for multiple connection types
  async bulkCalculate(req, res) {
    try {
      const { connections } = req.body;
      
      if (!connections || !Array.isArray(connections) || connections.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please provide an array of connections'
        });
      }

      // Validate each connection
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
      const result = await waterConnectionService.getRateHistory();
      
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
      const result = await waterConnectionService.resetToDefault();
      
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

  // Get statistics (if needed)
  async getStatistics(req, res) {
    try {
      const config = await waterConnectionService.getConfig();
      
      // You can expand this with more stats if needed
      res.json({
        success: true,
        data: {
          currentRate: config.data.costPerConnection,
          lastUpdated: config.data.updatedAt,
          createdAt: config.data.createdAt
        }
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

module.exports = new WaterConnectionController();