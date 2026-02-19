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

  // ===============================
  // GET CONFIG
  // ===============================
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

      // 🔥 Return frontend-compatible structure
      return {
        success: true,
        data: {
          id: config.id,
          chargesPerShift: config.ratePerStaffPerDay,
          shiftHours: config.shiftHours,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt
        }
      };
    } catch (error) {
      throw new Error(`Error fetching housekeeping config: ${error.message}`);
    }
  }

  // ===============================
  // UPDATE CONFIG
  // ===============================
  async updateConfig(chargesPerShift, shiftHours) {
    try {
      const HousekeepingConfig = await this.getHousekeepingModel();

      let config = await HousekeepingConfig.findOne();

      if (!config) {
        config = await HousekeepingConfig.create({
          ratePerStaffPerDay: parseInt(chargesPerShift) || 0,
          shiftHours: parseInt(shiftHours) || 10
        });
      } else {
        await config.update({
          ratePerStaffPerDay: parseInt(chargesPerShift) || config.ratePerStaffPerDay,
          shiftHours: shiftHours ? parseInt(shiftHours) : config.shiftHours
        });
      }

      return this.getConfig();
    } catch (error) {
      throw new Error(`Error updating housekeeping config: ${error.message}`);
    }
  }

  // ===============================
  // CALCULATE SHIFTS
  // ===============================
  async calculateCost(numberOfShifts) {
    try {
      const { data: config } = await this.getConfig();

      const totalCost = config.chargesPerShift * numberOfShifts;

      return {
        success: true,
        data: {
          chargesPerShift: config.chargesPerShift,
          shiftHours: config.shiftHours,
          numberOfShifts,
          totalCost
        }
      };
    } catch (error) {
      throw new Error(`Error calculating cost: ${error.message}`);
    }
  }

  // ===============================
  // CUSTOM HOURS
  // ===============================
  async calculateCustomHours(hours, numberOfStaff = 1) {
    try {
      const { data: config } = await this.getConfig();

      const hourlyRate = config.chargesPerShift / config.shiftHours;
      const totalCost = hourlyRate * hours * numberOfStaff;

      return {
        success: true,
        data: {
          chargesPerShift: config.chargesPerShift,
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

  // ===============================
  // RESET DEFAULT
  // ===============================
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

  // ===============================
  // HISTORY
  // ===============================
  async getRateHistory() {
    try {
      const { data: config } = await this.getConfig();

      return {
        success: true,
        data: [{
          chargesPerShift: config.chargesPerShift,
          shiftHours: config.shiftHours,
          updatedAt: config.updatedAt,
          createdAt: config.createdAt
        }]
      };
    } catch (error) {
      return { success: true, data: [] };
    }
  }

  // ===============================
  // STATISTICS
  // ===============================
  async getStatistics() {
    try {
      const { data: config } = await this.getConfig();

      return {
        success: true,
        data: {
          currentRate: config.chargesPerShift,
          shiftHours: config.shiftHours,
          hourlyRate: Math.round(config.chargesPerShift / config.shiftHours),
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
