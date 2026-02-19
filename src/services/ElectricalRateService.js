const { Op } = require('sequelize');

class ElectricalRateService {
  constructor() {
    this.ElectricalRate = null;
  }

  async getElectricalRateModel() {
    if (!this.ElectricalRate) {
      try {
        const models = require('../models');
        if (!models.getAllModels().ElectricalRate) {
          console.log('🔄 ElectricalRate model not found, initializing models...');
          models.init();
        }
        this.ElectricalRate = models.getModel('ElectricalRate');
        console.log('✅ ElectricalRate model loaded in service');
      } catch (error) {
        console.error('❌ Failed to load ElectricalRate model:', error);
        throw new Error('ElectricalRate model not available');
      }
    }
    return this.ElectricalRate;
  }

  async createRate(data) {
    try {
      const ElectricalRate = await this.getElectricalRateModel();

      // If this rate is active, check for conflicts with existing active rates of same type
      if (data.isActive) {
        await this.checkActiveRateConflict(data.type, data.effectiveFrom, data.effectiveTo);
      }

      const rate = await ElectricalRate.create({
        type: data.type,
        ratePerKW: parseInt(data.ratePerKW) || 0,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo || null,
        isActive: data.isActive === 'true' || data.isActive === true,
        description: data.description || ''
      });

      return { success: true, data: rate };
    } catch (error) {
      console.error('Error in createRate:', error);
      throw new Error(`Error creating electrical rate: ${error.message}`);
    }
  }

  async getAllRates(filters = {}) {
    try {
      const ElectricalRate = await this.getElectricalRateModel();

      const whereClause = {};

      if (filters.type && filters.type !== 'all' && filters.type !== 'undefined') {
        whereClause.type = filters.type;
      }

      if (filters.isActive !== undefined && filters.isActive !== 'undefined') {
        whereClause.isActive = filters.isActive === 'true';
      }

      if (filters.search && filters.search.trim() !== '') {
        whereClause[Op.or] = [
          { description: { [Op.like]: `%${filters.search}%` } }
        ];
      }

      // Filter by effective date
      if (filters.effectiveDate) {
        whereClause.effectiveFrom = { [Op.lte]: filters.effectiveDate };
        whereClause[Op.or] = [
          { effectiveTo: { [Op.gte]: filters.effectiveDate } },
          { effectiveTo: null }
        ];
      }

      const rates = await ElectricalRate.findAll({
        where: whereClause,
        order: [
          ['isActive', 'DESC'],
          ['effectiveFrom', 'DESC']
        ]
      });

      return { success: true, data: rates };
    } catch (error) {
      console.error('Error in getAllRates:', error);
      return { success: true, data: [] };
    }
  }

  async getRateById(id) {
    try {
      const ElectricalRate = await this.getElectricalRateModel();

      const rate = await ElectricalRate.findByPk(id);
      if (!rate) {
        throw new Error('Electrical rate not found');
      }
      return { success: true, data: rate };
    } catch (error) {
      console.error('Error in getRateById:', error);
      throw new Error(`Error fetching electrical rate: ${error.message}`);
    }
  }

  async updateRate(id, updateData) {
    try {
      const ElectricalRate = await this.getElectricalRateModel();

      const rate = await ElectricalRate.findByPk(id);
      if (!rate) {
        throw new Error('Electrical rate not found');
      }

      // Check for conflicts if this rate is being set to active
      if (updateData.isActive === true || (updateData.isActive === undefined && rate.isActive)) {
        await this.checkActiveRateConflict(
          updateData.type || rate.type,
          updateData.effectiveFrom || rate.effectiveFrom,
          updateData.effectiveTo || rate.effectiveTo,
          id
        );
      }

      // Parse fields
      if (updateData.ratePerKW) {
        updateData.ratePerKW = parseInt(updateData.ratePerKW);
      }
      if (updateData.isActive !== undefined) {
        updateData.isActive = updateData.isActive === 'true' || updateData.isActive === true;
      }

      await rate.update(updateData);
      return { success: true, data: rate };
    } catch (error) {
      console.error('Error in updateRate:', error);
      throw new Error(`Error updating electrical rate: ${error.message}`);
    }
  }

  async deleteRate(id) {
    try {
      const ElectricalRate = await this.getElectricalRateModel();

      const rate = await ElectricalRate.findByPk(id);
      if (!rate) {
        throw new Error('Electrical rate not found');
      }

      await rate.destroy();
      return { success: true, message: 'Electrical rate deleted successfully' };
    } catch (error) {
      console.error('Error in deleteRate:', error);
      throw new Error(`Error deleting electrical rate: ${error.message}`);
    }
  }

  async getActiveRate(type, date = new Date().toISOString().split('T')[0]) {
    try {
      const ElectricalRate = await this.getElectricalRateModel();

      const whereClause = {
        isActive: true,
        effectiveFrom: { [Op.lte]: date }
      };

      if (type !== 'both') {
        whereClause[Op.or] = [
          { type: type },
          { type: 'both' }
        ];
      } else {
        whereClause.type = 'both';
      }

      whereClause[Op.or] = [
        { effectiveTo: { [Op.gte]: date } },
        { effectiveTo: null }
      ];

      const rate = await ElectricalRate.findOne({
        where: whereClause,
        order: [['effectiveFrom', 'DESC']]
      });

      return { success: true, data: rate };
    } catch (error) {
      console.error('Error in getActiveRate:', error);
      return { success: true, data: null };
    }
  }

  async getStatistics() {
    try {
      const ElectricalRate = await this.getElectricalRateModel();
      const sequelize = ElectricalRate.sequelize;

      const totalRates = await ElectricalRate.count();
      const activeRates = await ElectricalRate.count({ where: { isActive: true } });
      const inactiveRates = await ElectricalRate.count({ where: { isActive: false } });

      const typeStats = await ElectricalRate.findAll({
        attributes: [
          'type',
          [sequelize.fn('COUNT', sequelize.col('type')), 'count']
        ],
        group: ['type']
      });

      const rateStats = await ElectricalRate.findAll({
        attributes: [
          [sequelize.fn('MIN', sequelize.col('ratePerKW')), 'minRate'],
          [sequelize.fn('MAX', sequelize.col('ratePerKW')), 'maxRate'],
          [sequelize.fn('AVG', sequelize.col('ratePerKW')), 'avgRate']
        ],
        raw: true
      });

      return {
        success: true,
        data: {
          totalRates,
          activeRates,
          inactiveRates,
          typeStats: typeStats || [],
          rateStats: rateStats[0] || {
            minRate: 0,
            maxRate: 0,
            avgRate: 0
          }
        }
      };
    } catch (error) {
      console.error('Error in getStatistics:', error);
      return {
        success: true,
        data: {
          totalRates: 0,
          activeRates: 0,
          inactiveRates: 0,
          typeStats: [],
          rateStats: { minRate: 0, maxRate: 0, avgRate: 0 }
        }
      };
    }
  }

  async checkActiveRateConflict(type, effectiveFrom, effectiveTo, excludeId = null) {
    try {
      const ElectricalRate = await this.getElectricalRateModel();

      const whereClause = {
        isActive: true,
        [Op.or]: [
          { type: type },
          { type: 'both' }
        ]
      };

      if (type === 'both') {
        whereClause[Op.or] = [
          { type: 'both' },
          { type: 'temporary' },
          { type: 'exhibition' }
        ];
      }

      // Date overlap condition
      whereClause[Op.and] = [
        {
          effectiveFrom: { [Op.lte]: effectiveTo || '9999-12-31' }
        },
        {
          [Op.or]: [
            { effectiveTo: { [Op.gte]: effectiveFrom } },
            { effectiveTo: null }
          ]
        }
      ];

      if (excludeId) {
        whereClause.id = { [Op.ne]: excludeId };
      }

      const conflictingRates = await ElectricalRate.findAll({ where: whereClause });

      if (conflictingRates.length > 0) {
        throw new Error(`Active rate conflict: Another active rate exists for the same period`);
      }

      return true;
    } catch (error) {
      throw error;
    }
  }

  async bulkDeleteRates(ids) {
    try {
      const ElectricalRate = await this.getElectricalRateModel();
      const results = [];
      const errors = [];

      for (const id of ids) {
        try {
          const rate = await ElectricalRate.findByPk(id);
          if (rate) {
            await rate.destroy();
            results.push(id);
          } else {
            errors.push({ id, error: 'Rate not found' });
          }
        } catch (error) {
          errors.push({ id, error: error.message });
        }
      }

      return { success: true, results, errors };
    } catch (error) {
      console.error('Error in bulkDeleteRates:', error);
      throw new Error(`Error bulk deleting rates: ${error.message}`);
    }
  }
}

module.exports = new ElectricalRateService();