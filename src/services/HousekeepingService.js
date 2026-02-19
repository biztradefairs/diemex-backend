class HousekeepingService {
  constructor() {
    this.HousekeepingConfig = null;
  }

  async getHousekeepingModel() {
    if (!this.HousekeepingConfig) {
      try {
        const models = require('../models');
        if (!models.getAllModels().HousekeepingConfig) {
          console.log('🔄 HousekeepingConfig model not found, initializing models...');
          models.init();
        }
        this.HousekeepingConfig = models.getModel('HousekeepingConfig');
        console.log('✅ HousekeepingConfig model loaded in service');
      } catch (error) {
        console.error('❌ Failed to load HousekeepingConfig model:', error);
        throw new Error('HousekeepingConfig model not available');
      }
    }
    return this.HousekeepingConfig;
  }

  // Get the current configuration (there should only be one record)
  async getConfig() {
    try {
      const HousekeepingConfig = await this.getHousekeepingModel();

      // Get the first record (there should only be one)
      let config = await HousekeepingConfig.findOne();

      // If no config exists, create a default one
      if (!config) {
        config = await HousekeepingConfig.create({
          chargesPerShift: 2000, // Default rate
          shiftHours: 10,
          description: 'Charges per shift (10 hours)'
        });
        console.log('✅ Created default housekeeping config');
      }

      return { success: true, data: config };
    } catch (error) {
      console.error('Error in getConfig:', error);
      throw new Error(`Error fetching housekeeping config: ${error.message}`);
    }
  }

  // Update the configuration
  async updateConfig(chargesPerShift, shiftHours = 10) {
    try {
      const HousekeepingConfig = await this.getHousekeepingModel();

      // Get the first record (there should only be one)
      let config = await HousekeepingConfig.findOne();

      if (!config) {
        // Create new config if doesn't exist
        config = await HousekeepingConfig.create({
          chargesPerShift: parseInt(chargesPerShift) || 0,
          shiftHours: parseInt(shiftHours) || 10
        });
      } else {
        // Update existing config
        const updateData = {
          chargesPerShift: parseInt(chargesPerShift) || 0
        };
        
        if (shiftHours) {
          updateData.shiftHours = parseInt(shiftHours);
        }

        await config.update(updateData);
      }

      return { success: true, data: config };
    } catch (error) {
      console.error('Error in updateConfig:', error);
      throw new Error(`Error updating housekeeping config: ${error.message}`);
    }
  }

  // Calculate cost for multiple shifts
  async calculateCost(numberOfShifts) {
    try {
      const HousekeepingConfig = await this.getHousekeepingModel();

      const config = await HousekeepingConfig.findOne();
      if (!config) {
        throw new Error('Housekeeping configuration not found');
      }

      const chargesPerShift = config.chargesPerShift;
      const totalCost = chargesPerShift * numberOfShifts;

      return {
        success: true,
        data: {
          chargesPerShift,
          shiftHours: config.shiftHours,
          numberOfShifts,
          totalCost
        }
      };
    } catch (error) {
      console.error('Error in calculateCost:', error);
      throw new Error(`Error calculating cost: ${error.message}`);
    }
  }

  // Calculate cost for custom hours
  async calculateCustomHours(hours, numberOfStaff = 1) {
    try {
      const HousekeepingConfig = await this.getHousekeepingModel();

      const config = await HousekeepingConfig.findOne();
      if (!config) {
        throw new Error('Housekeeping configuration not found');
      }

      // Calculate hourly rate
      const hourlyRate = config.chargesPerShift / config.shiftHours;
      const totalCost = hourlyRate * hours * numberOfStaff;

      return {
        success: true,
        data: {
          chargesPerShift: config.chargesPerShift,
          shiftHours: config.shiftHours,
          hourlyRate: Math.round(hourlyRate * 100) / 100,
          hours,
          numberOfStaff,
          totalCost: Math.round(totalCost)
        }
      };
    } catch (error) {
      console.error('Error in calculateCustomHours:', error);
      throw new Error(`Error calculating custom hours cost: ${error.message}`);
    }
  }

  // Get rate history
  async getRateHistory() {
    try {
      const HousekeepingConfig = await this.getHousekeepingModel();

      // For now, just return the current config with timestamps
      const config = await HousekeepingConfig.findOne();
      
      return {
        success: true,
        data: config ? [{
          chargesPerShift: config.chargesPerShift,
          shiftHours: config.shiftHours,
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
      const HousekeepingConfig = await this.getHousekeepingModel();

      let config = await HousekeepingConfig.findOne();
      
      if (config) {
        await config.update({
          chargesPerShift: 2000, // Default rate
          shiftHours: 10
        });
      } else {
        config = await HousekeepingConfig.create({
          chargesPerShift: 2000,
          shiftHours: 10
        });
      }

      return { 
        success: true, 
        data: config,
        message: 'Rate reset to default value (₹2000 per 10-hour shift)'
      };
    } catch (error) {
      console.error('Error in resetToDefault:', error);
      throw new Error(`Error resetting to default: ${error.message}`);
    }
  }

  // Bulk calculation for multiple shifts/staff
  async bulkCalculate(shifts) {
    try {
      const HousekeepingConfig = await this.getHousekeepingModel();

      const config = await HousekeepingConfig.findOne();
      if (!config) {
        throw new Error('Housekeeping configuration not found');
      }

      const results = shifts.map(shift => ({
        ...shift,
        chargesPerShift: config.chargesPerShift,
        totalCost: config.chargesPerShift * shift.shifts
      }));

      const grandTotal = results.reduce((sum, item) => sum + item.totalCost, 0);

      return {
        success: true,
        data: {
          items: results,
          grandTotal,
          rateApplied: config.chargesPerShift
        }
      };
    } catch (error) {
      console.error('Error in bulkCalculate:', error);
      throw new Error(`Error in bulk calculation: ${error.message}`);
    }
  }

  // Get statistics
  async getStatistics() {
    try {
      const config = await this.getConfig();
      
      return {
        success: true,
        data: {
          currentRate: config.data.chargesPerShift,
          shiftHours: config.data.shiftHours,
          hourlyRate: Math.round((config.data.chargesPerShift / config.data.shiftHours) * 100) / 100,
          lastUpdated: config.data.updatedAt,
          createdAt: config.data.createdAt
        }
      };
    } catch (error) {
      console.error('Error in getStatistics:', error);
      throw new Error(`Error fetching statistics: ${error.message}`);
    }
  }
}

module.exports = new HousekeepingService();