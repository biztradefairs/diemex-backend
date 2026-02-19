const { Op } = require('sequelize');

class HostessCategoryService {
  constructor() {
    this.HostessCategory = null;
  }

  async getHostessCategoryModel() {
    if (!this.HostessCategory) {
      try {
        const models = require('../models');
        if (!models.getAllModels().HostessCategory) {
          console.log('🔄 HostessCategory model not found, initializing models...');
          models.init();
        }
        this.HostessCategory = models.getModel('HostessCategory');
        console.log('✅ HostessCategory model loaded in service');
      } catch (error) {
        console.error('❌ Failed to load HostessCategory model:', error);
        throw new Error('HostessCategory model not available');
      }
    }
    return this.HostessCategory;
  }

  async createCategory(data) {
    try {
      const HostessCategory = await this.getHostessCategoryModel();

      // Check if category already exists
      const existingCategory = await HostessCategory.findOne({
        where: { category: data.category }
      });

      if (existingCategory) {
        throw new Error(`Category ${data.category} already exists. You can update the existing category instead.`);
      }

      const category = await HostessCategory.create({
        category: data.category,
        ratePerDay: parseInt(data.ratePerDay) || 0,
        workingHours: parseInt(data.workingHours) || 8,
        description: data.description || '',
        isActive: data.isActive === 'true' || data.isActive === true
      });

      return { success: true, data: category };
    } catch (error) {
      console.error('Error in createCategory:', error);
      throw new Error(`Error creating hostess category: ${error.message}`);
    }
  }

  async getAllCategories(filters = {}) {
    try {
      const HostessCategory = await this.getHostessCategoryModel();

      const whereClause = {};

      if (filters.isActive !== undefined && filters.isActive !== 'undefined') {
        whereClause.isActive = filters.isActive === 'true';
      }

      if (filters.category && filters.category !== 'undefined') {
        whereClause.category = filters.category;
      }

      const categories = await HostessCategory.findAll({
        where: whereClause,
        order: [['category', 'ASC']]
      });

      return { success: true, data: categories };
    } catch (error) {
      console.error('Error in getAllCategories:', error);
      return { success: true, data: [] };
    }
  }

  async getCategoryById(id) {
    try {
      const HostessCategory = await this.getHostessCategoryModel();

      const category = await HostessCategory.findByPk(id);
      if (!category) {
        throw new Error('Hostess category not found');
      }
      return { success: true, data: category };
    } catch (error) {
      console.error('Error in getCategoryById:', error);
      throw new Error(`Error fetching hostess category: ${error.message}`);
    }
  }

  async getCategoryByType(categoryType) {
    try {
      const HostessCategory = await this.getHostessCategoryModel();

      const category = await HostessCategory.findOne({
        where: { 
          category: categoryType,
          isActive: true
        }
      });

      return { success: true, data: category };
    } catch (error) {
      console.error('Error in getCategoryByType:', error);
      return { success: true, data: null };
    }
  }

  async updateCategory(id, updateData) {
    try {
      const HostessCategory = await this.getHostessCategoryModel();

      const category = await HostessCategory.findByPk(id);
      if (!category) {
        throw new Error('Hostess category not found');
      }

      // If changing category, check if new category already exists
      if (updateData.category && updateData.category !== category.category) {
        const existingCategory = await HostessCategory.findOne({
          where: { 
            category: updateData.category,
            id: { [Op.ne]: id }
          }
        });

        if (existingCategory) {
          throw new Error(`Category ${updateData.category} already exists.`);
        }
      }

      // Parse numeric fields
      if (updateData.ratePerDay) {
        updateData.ratePerDay = parseInt(updateData.ratePerDay);
      }
      if (updateData.workingHours) {
        updateData.workingHours = parseInt(updateData.workingHours);
      }
      if (updateData.isActive !== undefined) {
        updateData.isActive = updateData.isActive === 'true' || updateData.isActive === true;
      }

      await category.update(updateData);
      return { success: true, data: category };
    } catch (error) {
      console.error('Error in updateCategory:', error);
      throw new Error(`Error updating hostess category: ${error.message}`);
    }
  }

  async deleteCategory(id) {
    try {
      const HostessCategory = await this.getHostessCategoryModel();

      const category = await HostessCategory.findByPk(id);
      if (!category) {
        throw new Error('Hostess category not found');
      }

      await category.destroy();
      return { success: true, message: 'Hostess category deleted successfully' };
    } catch (error) {
      console.error('Error in deleteCategory:', error);
      throw new Error(`Error deleting hostess category: ${error.message}`);
    }
  }

  async getStatistics() {
    try {
      const HostessCategory = await this.getHostessCategoryModel();
      const sequelize = HostessCategory.sequelize;

      const totalCategories = await HostessCategory.count();
      const activeCategories = await HostessCategory.count({ where: { isActive: true } });
      const inactiveCategories = await HostessCategory.count({ where: { isActive: false } });

      const rateStats = await HostessCategory.findAll({
        attributes: [
          [sequelize.fn('MIN', sequelize.col('ratePerDay')), 'minRate'],
          [sequelize.fn('MAX', sequelize.col('ratePerDay')), 'maxRate'],
          [sequelize.fn('AVG', sequelize.col('ratePerDay')), 'avgRate']
        ],
        raw: true
      });

      // Get rates by category
      const categoryRates = await HostessCategory.findAll({
        attributes: ['category', 'ratePerDay', 'workingHours', 'isActive'],
        order: [['category', 'ASC']]
      });

      return {
        success: true,
        data: {
          totalCategories,
          activeCategories,
          inactiveCategories,
          rateStats: rateStats[0] || {
            minRate: 0,
            maxRate: 0,
            avgRate: 0
          },
          categoryRates: categoryRates || []
        }
      };
    } catch (error) {
      console.error('Error in getStatistics:', error);
      return {
        success: true,
        data: {
          totalCategories: 0,
          activeCategories: 0,
          inactiveCategories: 0,
          rateStats: { minRate: 0, maxRate: 0, avgRate: 0 },
          categoryRates: []
        }
      };
    }
  }

  async bulkUpdateRates(updates) {
    try {
      const HostessCategory = await this.getHostessCategoryModel();
      const results = [];
      const errors = [];

      for (const update of updates) {
        try {
          const category = await HostessCategory.findOne({
            where: { category: update.category }
          });

          if (category) {
            await category.update({
              ratePerDay: parseInt(update.ratePerDay) || category.ratePerDay,
              workingHours: parseInt(update.workingHours) || category.workingHours
            });
            results.push(update.category);
          } else {
            errors.push({ category: update.category, error: 'Category not found' });
          }
        } catch (error) {
          errors.push({ category: update.category, error: error.message });
        }
      }

      return { success: true, results, errors };
    } catch (error) {
      console.error('Error in bulkUpdateRates:', error);
      throw new Error(`Error bulk updating rates: ${error.message}`);
    }
  }

  async calculateCost(categoryType, days, hours = null) {
    try {
      const HostessCategory = await this.getHostessCategoryModel();

      const category = await HostessCategory.findOne({
        where: { 
          category: categoryType,
          isActive: true
        }
      });

      if (!category) {
        throw new Error(`No active category found for type ${categoryType}`);
      }

      let totalCost = category.ratePerDay * days;

      // If hours are specified and different from standard, adjust cost
      if (hours && hours !== category.workingHours) {
        const hourlyRate = category.ratePerDay / category.workingHours;
        totalCost = hourlyRate * hours * days;
      }

      return {
        success: true,
        data: {
          category: category.category,
          ratePerDay: category.ratePerDay,
          workingHours: category.workingHours,
          days: days,
          hours: hours || category.workingHours,
          totalCost: Math.round(totalCost)
        }
      };
    } catch (error) {
      console.error('Error in calculateCost:', error);
      throw new Error(`Error calculating cost: ${error.message}`);
    }
  }
}

module.exports = new HostessCategoryService();