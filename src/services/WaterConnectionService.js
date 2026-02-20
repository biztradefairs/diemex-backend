const { v4: uuidv4 } = require('uuid');

class WaterConnectionService {
  constructor() {
    this.WaterConnectionConfig = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const models = require('../models');
      
      // Initialize models if not already done
      if (!models.getAllModels().WaterConnectionConfig) {
        models.init();
      }
      
      this.WaterConnectionConfig = models.getModel('WaterConnectionConfig');
      
      // Sync the model (create table if not exists)
      await this.WaterConnectionConfig.sync({ alter: true });
      console.log('✅ WaterConnectionConfig model synced');
      
      // Create default config if none exists
      const count = await this.WaterConnectionConfig.count();
      if (count === 0) {
        await this.WaterConnectionConfig.create({
          costPerConnection: 15000
        });
        console.log('✅ Created default water connection config');
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize WaterConnectionService:', error);
      throw error;
    }
  }

  async getConfig() {
    await this.initialize();
    
    try {
      let config = await this.WaterConnectionConfig.findOne();
      
      if (!config) {
        config = await this.WaterConnectionConfig.create({
          costPerConnection: 15000
        });
      }
      
      return { 
        success: true, 
        data: {
          id: config.id,
          costPerConnection: config.costPerConnection,
          createdAt: config.created_at || config.createdAt,
          updatedAt: config.updated_at || config.updatedAt
        }
      };
    } catch (error) {
      console.error('Error in getConfig:', error);
      throw new Error(`Error fetching water connection config: ${error.message}`);
    }
  }

  async updateConfig(costPerConnection) {
    await this.initialize();
    
    try {
      let config = await this.WaterConnectionConfig.findOne();
      
      if (!config) {
        config = await this.WaterConnectionConfig.create({
          costPerConnection: parseInt(costPerConnection)
        });
      } else {
        config.costPerConnection = parseInt(costPerConnection);
        await config.save();
      }
      
      return { 
        success: true, 
        data: {
          id: config.id,
          costPerConnection: config.costPerConnection,
          createdAt: config.created_at || config.createdAt,
          updatedAt: config.updated_at || config.updatedAt
        }
      };
    } catch (error) {
      console.error('Error in updateConfig:', error);
      throw new Error(`Error updating water connection config: ${error.message}`);
    }
  }

  async calculateCost(numberOfConnections) {
    await this.initialize();
    
    try {
      const config = await this.WaterConnectionConfig.findOne();
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

  async getRateHistory() {
    await this.initialize();
    
    try {
      const configs = await this.WaterConnectionConfig.findAll({
        order: [['updated_at', 'DESC']],
        limit: 10
      });
      
      const history = configs.map(config => ({
        costPerConnection: config.costPerConnection,
        updatedAt: config.updated_at || config.updatedAt
      }));
      
      return { success: true, data: history };
    } catch (error) {
      console.error('Error in getRateHistory:', error);
      return { success: true, data: [] };
    }
  }

  async resetToDefault() {
    await this.initialize();
    
    try {
      let config = await this.WaterConnectionConfig.findOne();
      
      if (config) {
        config.costPerConnection = 15000;
        await config.save();
      } else {
        config = await this.WaterConnectionConfig.create({
          costPerConnection: 15000
        });
      }

      return { 
        success: true, 
        data: {
          id: config.id,
          costPerConnection: config.costPerConnection,
          createdAt: config.created_at || config.createdAt,
          updatedAt: config.updated_at || config.updatedAt
        },
        message: 'Rate reset to default value (₹15000)'
      };
    } catch (error) {
      console.error('Error in resetToDefault:', error);
      throw new Error(`Error resetting to default: ${error.message}`);
    }
  }

  async bulkCalculate(connections) {
    await this.initialize();
    
    try {
      const config = await this.WaterConnectionConfig.findOne();
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

  async getStatistics() {
    await this.initialize();
    
    try {
      const config = await this.WaterConnectionConfig.findOne();
      const totalUpdates = await this.WaterConnectionConfig.count();
      
      return {
        success: true,
        data: {
          currentRate: config?.costPerConnection || 15000,
          createdAt: config?.created_at || config?.createdAt,
          lastUpdated: config?.updated_at || config?.updatedAt,
          totalUpdates
        }
      };
    } catch (error) {
      console.error('Error in getStatistics:', error);
      throw new Error(`Error fetching statistics: ${error.message}`);
    }
  }
}

module.exports = new WaterConnectionService();