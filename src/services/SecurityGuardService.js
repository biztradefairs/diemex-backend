class SecurityGuardService {
  constructor() {
    this.SecurityGuardConfig = null;
  }

  async getSecurityGuardModel() {
    if (!this.SecurityGuardConfig) {
      try {
        const models = require('../models');
        if (!models.getAllModels().SecurityGuardConfig) {
          console.log('🔄 SecurityGuardConfig model not found, initializing models...');
          models.init();
        }
        this.SecurityGuardConfig = models.getModel('SecurityGuardConfig');
        console.log('✅ SecurityGuardConfig model loaded in service');
      } catch (error) {
        console.error('❌ Failed to load SecurityGuardConfig model:', error);
        throw new Error('SecurityGuardConfig model not available');
      }
    }
    return this.SecurityGuardConfig;
  }

  // Get the current configuration (there should only be one record)
  async getConfig() {
    try {
      const SecurityGuardConfig = await this.getSecurityGuardModel();

      // Get the first record (there should only be one)
      let config = await SecurityGuardConfig.findOne();

      // If no config exists, create a default one
      if (!config) {
        config = await SecurityGuardConfig.create({
          ratePerGuardPerDay: 2500 // Default rate
        });
        console.log('✅ Created default security guard config');
      }

      return { success: true, data: config };
    } catch (error) {
      console.error('Error in getConfig:', error);
      throw new Error(`Error fetching security guard config: ${error.message}`);
    }
  }

  // Update the configuration
  async updateConfig(ratePerGuardPerDay) {
    try {
      const SecurityGuardConfig = await this.getSecurityGuardModel();

      // Get the first record (there should only be one)
      let config = await SecurityGuardConfig.findOne();

      if (!config) {
        // Create new config if doesn't exist
        config = await SecurityGuardConfig.create({
          ratePerGuardPerDay: parseInt(ratePerGuardPerDay) || 0
        });
      } else {
        // Update existing config
        await config.update({
          ratePerGuardPerDay: parseInt(ratePerGuardPerDay) || 0
        });
      }

      return { success: true, data: config };
    } catch (error) {
      console.error('Error in updateConfig:', error);
      throw new Error(`Error updating security guard config: ${error.message}`);
    }
  }

  // Calculate cost for guards
  async calculateCost(numberOfGuards, numberOfDays) {
    try {
      const SecurityGuardConfig = await this.getSecurityGuardModel();

      const config = await SecurityGuardConfig.findOne();
      if (!config) {
        throw new Error('Security guard configuration not found');
      }

      const ratePerDay = config.ratePerGuardPerDay;
      const totalCost = ratePerDay * numberOfGuards * numberOfDays;

      return {
        success: true,
        data: {
          ratePerGuardPerDay: ratePerDay,
          numberOfGuards,
          numberOfDays,
          totalCost
        }
      };
    } catch (error) {
      console.error('Error in calculateCost:', error);
      throw new Error(`Error calculating cost: ${error.message}`);
    }
  }

  // Get rate history (could be expanded with a separate table if needed)
  async getRateHistory() {
    try {
      const SecurityGuardConfig = await this.getSecurityGuardModel();

      // For now, just return the current config with timestamps
      const config = await SecurityGuardConfig.findOne();
      
      return {
        success: true,
        data: config ? [{
          ratePerGuardPerDay: config.ratePerGuardPerDay,
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
      const SecurityGuardConfig = await this.getSecurityGuardModel();

      let config = await SecurityGuardConfig.findOne();
      
      if (config) {
        await config.update({
          ratePerGuardPerDay: 2500 // Default rate
        });
      } else {
        config = await SecurityGuardConfig.create({
          ratePerGuardPerDay: 2500
        });
      }

      return { 
        success: true, 
        data: config,
        message: 'Rate reset to default value (₹2500)'
      };
    } catch (error) {
      console.error('Error in resetToDefault:', error);
      throw new Error(`Error resetting to default: ${error.message}`);
    }
  }
}

module.exports = new SecurityGuardService();