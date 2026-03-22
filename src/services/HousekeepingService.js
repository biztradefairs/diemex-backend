// src/services/HousekeepingService.js
class HousekeepingService {
  constructor() {
    this.HousekeepingConfig = null;
  }

  async getHousekeepingModel() {
    if (!this.HousekeepingConfig) {
      const models = require('../models');
      if (!models.getAllModels().HousekeepingConfig) {
        models.init();
      }
      this.HousekeepingConfig = models.getModel('HousekeepingConfig');
    }
    return this.HousekeepingConfig;
  }

  async getConfig() {
    try {
      const HousekeepingConfig = await this.getHousekeepingModel();
      let config = await HousekeepingConfig.findOne();

      if (!config) {
        config = await HousekeepingConfig.create({
          ratePerStaffPerDay: 2000,
          shiftHours: 10
        });
      }

      return {
        success: true,
        data: {
          id: config.id,
          ratePerShift: config.ratePerStaffPerDay,  // Changed from chargesPerShift
          shiftHours: config.shiftHours,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt
        }
      };
    } catch (error) {
      throw new Error(`Error fetching housekeeping config: ${error.message}`);
    }
  }

  // FIXED: Calculate cost with quantity and days
  async calculateCost(quantity, days) {
    try {
      const { data: config } = await this.getConfig();
      
      // quantity = number of staff
      // days = number of days
      // total cost = quantity * days * ratePerShift
      const totalCost = quantity * days * config.ratePerShift;

      return {
        success: true,
        data: {
          ratePerShift: config.ratePerShift,
          shiftHours: config.shiftHours,
          quantity: quantity,
          days: days,
          totalCost: totalCost
        }
      };
    } catch (error) {
      throw new Error(`Error calculating cost: ${error.message}`);
    }
  }

  // Calculate with shifts (backward compatibility)
  async calculateWithShifts(numberOfShifts) {
    try {
      const { data: config } = await this.getConfig();
      const totalCost = config.ratePerShift * numberOfShifts;

      return {
        success: true,
        data: {
          ratePerShift: config.ratePerShift,
          shiftHours: config.shiftHours,
          numberOfShifts,
          totalCost
        }
      };
    } catch (error) {
      throw new Error(`Error calculating cost: ${error.message}`);
    }
  }

  async calculateCustomHours(hours, numberOfStaff = 1) {
    try {
      const { data: config } = await this.getConfig();
      const hourlyRate = config.ratePerShift / config.shiftHours;
      const totalCost = hourlyRate * hours * numberOfStaff;

      return {
        success: true,
        data: {
          ratePerShift: config.ratePerShift,
          shiftHours: config.shiftHours,
          hourlyRate: Math.round(hourlyRate),
          hours,
          numberOfStaff,
          totalCost: Math.round(totalCost)
        }
      };
    } catch (error) {
      throw new Error(`Error calculating custom hours: ${error.message}`);
    }
  }

  async updateConfig(ratePerShift, shiftHours) {
    try {
      const HousekeepingConfig = await this.getHousekeepingModel();
      let config = await HousekeepingConfig.findOne();

      if (!config) {
        config = await HousekeepingConfig.create({
          ratePerStaffPerDay: parseInt(ratePerShift) || 2000,
          shiftHours: parseInt(shiftHours) || 10
        });
      } else {
        await config.update({
          ratePerStaffPerDay: parseInt(ratePerShift) || config.ratePerStaffPerDay,
          shiftHours: shiftHours ? parseInt(shiftHours) : config.shiftHours
        });
      }

      return this.getConfig();
    } catch (error) {
      throw new Error(`Error updating housekeeping config: ${error.message}`);
    }
  }

  async resetToDefault() {
    try {
      const HousekeepingConfig = await this.getHousekeepingModel();
      let config = await HousekeepingConfig.findOne();

      if (config) {
        await config.update({
          ratePerStaffPerDay: 2000,
          shiftHours: 10
        });
      } else {
        config = await HousekeepingConfig.create({
          ratePerStaffPerDay: 2000,
          shiftHours: 10
        });
      }

      return this.getConfig();
    } catch (error) {
      throw new Error(`Error resetting rate: ${error.message}`);
    }
  }

  async getRateHistory() {
    try {
      const { data: config } = await this.getConfig();
      return {
        success: true,
        data: [{
          ratePerShift: config.ratePerShift,
          shiftHours: config.shiftHours,
          updatedAt: config.updatedAt,
          createdAt: config.createdAt
        }]
      };
    } catch (error) {
      return { success: true, data: [] };
    }
  }

  async getStatistics() {
    try {
      const { data: config } = await this.getConfig();
      return {
        success: true,
        data: {
          currentRate: config.ratePerShift,
          shiftHours: config.shiftHours,
          hourlyRate: Math.round(config.ratePerShift / config.shiftHours),
          createdAt: config.createdAt,
          lastUpdated: config.updatedAt
        }
      };
    } catch (error) {
      throw new Error(`Error fetching statistics: ${error.message}`);
    }
  }
}

module.exports = new HousekeepingService();