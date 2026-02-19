const { Op } = require('sequelize');

class CompressedAirService {
  constructor() {
    this.CompressedAirOption = null;
  }

  async getCompressedAirModel() {
    if (!this.CompressedAirOption) {
      try {
        const models = require('../models');
        if (!models.getAllModels().CompressedAirOption) {
          console.log('🔄 CompressedAirOption model not found, initializing models...');
          models.init();
        }
        this.CompressedAirOption = models.getModel('CompressedAirOption');
        console.log('✅ CompressedAirOption model loaded in service');
      } catch (error) {
        console.error('❌ Failed to load CompressedAirOption model:', error);
        throw new Error('CompressedAirOption model not available');
      }
    }
    return this.CompressedAirOption;
  }

  async createOption(data) {
    try {
      const CompressedAirOption = await this.getCompressedAirModel();

      // If displayOrder is not provided, set to last order + 1
      if (!data.displayOrder) {
        const lastOption = await CompressedAirOption.findOne({
          order: [['displayOrder', 'DESC']]
        });
        data.displayOrder = lastOption ? lastOption.displayOrder + 1 : 1;
      }

      const option = await CompressedAirOption.create({
        cfmRange: data.cfmRange,
        costPerConnection: parseInt(data.costPerConnection) || 0,
        powerKW: parseFloat(data.powerKW) || 0,
        isActive: data.isActive === 'true' || data.isActive === true,
        displayOrder: parseInt(data.displayOrder) || 1
      });

      return { success: true, data: option };
    } catch (error) {
      console.error('Error in createOption:', error);
      throw new Error(`Error creating compressed air option: ${error.message}`);
    }
  }

  async getAllOptions(filters = {}) {
    try {
      const CompressedAirOption = await this.getCompressedAirModel();

      const whereClause = {};

      if (filters.isActive !== undefined && filters.isActive !== 'undefined') {
        whereClause.isActive = filters.isActive === 'true';
      }

      if (filters.search && filters.search.trim() !== '') {
        whereClause[Op.or] = [
          { cfmRange: { [Op.like]: `%${filters.search}%` } }
        ];
      }

      const options = await CompressedAirOption.findAll({
        where: whereClause,
        order: [['displayOrder', 'ASC']]
      });

      return { success: true, data: options };
    } catch (error) {
      console.error('Error in getAllOptions:', error);
      return { success: true, data: [] };
    }
  }

  async getOptionById(id) {
    try {
      const CompressedAirOption = await this.getCompressedAirModel();

      const option = await CompressedAirOption.findByPk(id);
      if (!option) {
        throw new Error('Compressed air option not found');
      }
      return { success: true, data: option };
    } catch (error) {
      console.error('Error in getOptionById:', error);
      throw new Error(`Error fetching compressed air option: ${error.message}`);
    }
  }

  async updateOption(id, updateData) {
    try {
      const CompressedAirOption = await this.getCompressedAirModel();

      const option = await CompressedAirOption.findByPk(id);
      if (!option) {
        throw new Error('Compressed air option not found');
      }

      // Parse numeric fields
      if (updateData.costPerConnection) {
        updateData.costPerConnection = parseInt(updateData.costPerConnection);
      }
      if (updateData.powerKW) {
        updateData.powerKW = parseFloat(updateData.powerKW);
      }
      if (updateData.displayOrder) {
        updateData.displayOrder = parseInt(updateData.displayOrder);
      }
      if (updateData.isActive !== undefined) {
        updateData.isActive = updateData.isActive === 'true' || updateData.isActive === true;
      }

      await option.update(updateData);
      return { success: true, data: option };
    } catch (error) {
      console.error('Error in updateOption:', error);
      throw new Error(`Error updating compressed air option: ${error.message}`);
    }
  }

  async deleteOption(id) {
    try {
      const CompressedAirOption = await this.getCompressedAirModel();

      const option = await CompressedAirOption.findByPk(id);
      if (!option) {
        throw new Error('Compressed air option not found');
      }

      await option.destroy();
      
      // Reorder remaining options
      await this.reorderOptions();
      
      return { success: true, message: 'Compressed air option deleted successfully' };
    } catch (error) {
      console.error('Error in deleteOption:', error);
      throw new Error(`Error deleting compressed air option: ${error.message}`);
    }
  }

  async reorderOptions() {
    try {
      const CompressedAirOption = await this.getCompressedAirModel();
      
      const options = await CompressedAirOption.findAll({
        order: [['displayOrder', 'ASC']]
      });

      // Update display orders sequentially
      for (let i = 0; i < options.length; i++) {
        await options[i].update({ displayOrder: i + 1 });
      }

      return { success: true, message: 'Options reordered successfully' };
    } catch (error) {
      console.error('Error in reorderOptions:', error);
      throw new Error(`Error reordering options: ${error.message}`);
    }
  }

  async updateDisplayOrder(updates) {
    try {
      const CompressedAirOption = await this.getCompressedAirModel();
      const results = [];
      const errors = [];

      for (const item of updates) {
        try {
          const option = await CompressedAirOption.findByPk(item.id);
          if (option) {
            await option.update({ displayOrder: item.displayOrder });
            results.push(item.id);
          } else {
            errors.push({ id: item.id, error: 'Option not found' });
          }
        } catch (error) {
          errors.push({ id: item.id, error: error.message });
        }
      }

      return { success: true, results, errors };
    } catch (error) {
      console.error('Error in updateDisplayOrder:', error);
      throw new Error(`Error updating display order: ${error.message}`);
    }
  }

  async getStatistics() {
    try {
      const CompressedAirOption = await this.getCompressedAirModel();
      const sequelize = CompressedAirOption.sequelize;

      const totalOptions = await CompressedAirOption.count();
      const activeOptions = await CompressedAirOption.count({ where: { isActive: true } });
      const inactiveOptions = await CompressedAirOption.count({ where: { isActive: false } });

      // Get min, max, avg values
      const stats = await CompressedAirOption.findAll({
        attributes: [
          [sequelize.fn('MIN', sequelize.col('costPerConnection')), 'minCost'],
          [sequelize.fn('MAX', sequelize.col('costPerConnection')), 'maxCost'],
          [sequelize.fn('AVG', sequelize.col('costPerConnection')), 'avgCost'],
          [sequelize.fn('MIN', sequelize.col('powerKW')), 'minPower'],
          [sequelize.fn('MAX', sequelize.col('powerKW')), 'maxPower'],
          [sequelize.fn('AVG', sequelize.col('powerKW')), 'avgPower']
        ],
        raw: true
      });

      return {
        success: true,
        data: {
          totalOptions,
          activeOptions,
          inactiveOptions,
          costStats: stats[0] || {
            minCost: 0,
            maxCost: 0,
            avgCost: 0
          },
          powerStats: stats[0] || {
            minPower: 0,
            maxPower: 0,
            avgPower: 0
          }
        }
      };
    } catch (error) {
      console.error('Error in getStatistics:', error);
      return {
        success: true,
        data: {
          totalOptions: 0,
          activeOptions: 0,
          inactiveOptions: 0,
          costStats: { minCost: 0, maxCost: 0, avgCost: 0 },
          powerStats: { minPower: 0, maxPower: 0, avgPower: 0 }
        }
      };
    }
  }

  async bulkDeleteOptions(ids) {
    try {
      const CompressedAirOption = await this.getCompressedAirModel();
      const results = [];
      const errors = [];

      for (const id of ids) {
        try {
          const option = await CompressedAirOption.findByPk(id);
          if (option) {
            await option.destroy();
            results.push(id);
          } else {
            errors.push({ id, error: 'Option not found' });
          }
        } catch (error) {
          errors.push({ id, error: error.message });
        }
      }

      // Reorder remaining options
      if (results.length > 0) {
        await this.reorderOptions();
      }

      return { success: true, results, errors };
    } catch (error) {
      console.error('Error in bulkDeleteOptions:', error);
      throw new Error(`Error bulk deleting options: ${error.message}`);
    }
  }
}

module.exports = new CompressedAirService();