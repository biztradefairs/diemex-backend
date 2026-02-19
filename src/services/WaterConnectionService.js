class WaterConnectionService {
  constructor() {
    this.WaterConnectionConfig = null;
  }

  async getWaterConnectionModel() {
    if (!this.WaterConnectionConfig) {
      try {
        const models = require('../models');
        if (!models.getAllModels().WaterConnectionConfig) {
          console.log('🔄 WaterConnectionConfig model not found, initializing models...');
          models.init();
        }
        this.WaterConnectionConfig = models.getModel('WaterConnectionConfig');
        console.log('✅ WaterConnectionConfig model loaded in service');
      } catch (error) {
        console.error('❌ Failed to load WaterConnectionConfig model:', error);
        throw new Error('WaterConnectionConfig model not available');
      }
    }
    return this.WaterConnectionConfig;
  }

  // Get the current configuration (there should only be one record)
  async getConfig() {
    try {
      const WaterConnectionConfig = await this.getWaterConnectionModel();

      // Get the first record (there should only be one)
      let config = await WaterConnectionConfig.findOne();

      // If no config exists, create a default one
      if (!config) {
        config = await WaterConnectionConfig.create({
          costPerConnection: 15000 // Default rate
        });
        console.log('✅ Created default water connection config');
      }

      return { success: true, data: config };
    } catch (error) {
      console.error('Error in getConfig:', error);
      throw new Error(`Error fetching water connection config: ${error.message}`);
    }
  }

  // Update the configuration
  async updateConfig(costPerConnection) {
    try {
      const WaterConnectionConfig = await this.getWaterConnectionModel();

      // Get the first record (there should only be one)
      let config = await WaterConnectionConfig.findOne();

      if (!config) {
        // Create new config if doesn't exist
        config = await WaterConnectionConfig.create({
          costPerConnection: parseInt(costPerConnection) || 0
        });
      } else {
        // Update existing config
        await config.update({
          costPerConnection: parseInt(costPerConnection) || 0
        });
      }

      return { success: true, data: config };
    } catch (error) {
      console.error('Error in updateConfig:', error);
      throw new Error(`Error updating water connection config: ${error.message}`);
    }
  }

  // Calculate total cost for multiple connections
  async calculateCost(numberOfConnections) {
    try {
      const WaterConnectionConfig = await this.getWaterConnectionModel();

      const config = await WaterConnectionConfig.findOne();
      if (!config) {
        throw new Error('Water connection configuration not found');
      }

      const costPerConnection = config.costPerConnection;
      const totalCost = costPerConnection * numberOfConnections;

      return {
        success: true,
        data: {
          costPerConnection,
          numberOfConnections,
          totalCost
        }
      };
    } catch (error) {
      console.error('Error in calculateCost:', error);
      throw new Error(`Error calculating cost: ${error.message}`);
    }
  }

  // Get rate history
  async getRateHistory() {
    try {
      const WaterConnectionConfig = await this.getWaterConnectionModel();

      // For now, just return the current config with timestamps
      const config = await WaterConnectionConfig.findOne();
      
      return {
        success: true,
        data: config ? [{
          costPerConnection: config.costPerConnection,
          updatedAt: config.updatedAt,
          createdAt: config.createdAt
        }] : []
      };
    } catch (error) {
      console.error('Error in getRateHistory:', error);
      return { success: true, data: [] };
    }
  }

  // Reset to default rate
  async resetToDefault() {
    try {
      const WaterConnectionConfig = await this.getWaterConnectionModel();

      let config = await WaterConnectionConfig.findOne();
      
      if (config) {
        await config.update({
          costPerConnection: 15000 // Default rate
        });
      } else {
        config = await WaterConnectionConfig.create({
          costPerConnection: 15000
        });
      }

      return { 
        success: true, 
        data: config,
        message: 'Rate reset to default value (₹15000)'
      };
    } catch (error) {
      console.error('Error in resetToDefault:', error);
      throw new Error(`Error resetting to default: ${error.message}`);
    }
  }

  // Bulk calculation for multiple connection types (if needed in future)
  async bulkCalculate(connections) {
    try {
      const WaterConnectionConfig = await this.getWaterConnectionModel();

      const config = await WaterConnectionConfig.findOne();
      if (!config) {
        throw new Error('Water connection configuration not found');
      }

      const results = connections.map(conn => ({
        ...conn,
        costPerConnection: config.costPerConnection,
        totalCost: config.costPerConnection * conn.quantity
      }));

      const grandTotal = results.reduce((sum, item) => sum + item.totalCost, 0);

      return {
        success: true,
        data: {
          items: results,
          grandTotal,
          rateApplied: config.costPerConnection
        }
      };
    } catch (error) {
      console.error('Error in bulkCalculate:', error);
      throw new Error(`Error in bulk calculation: ${error.message}`);
    }
  }
}

module.exports = new WaterConnectionService();