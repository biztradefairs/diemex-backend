const { Op } = require('sequelize');

class SecurityDepositService {
  constructor() {
    this.SecurityDeposit = null;
  }

  async getSecurityDepositModel() {
    if (!this.SecurityDeposit) {
      try {
        const models = require('../models');
        if (!models.getAllModels().SecurityDeposit) {
          console.log('🔄 SecurityDeposit model not found, initializing models...');
          models.init();
        }
        this.SecurityDeposit = models.getModel('SecurityDeposit');
        console.log('✅ SecurityDeposit model loaded in service');
      } catch (error) {
        console.error('❌ Failed to load SecurityDeposit model:', error);
        throw new Error('SecurityDeposit model not available');
      }
    }
    return this.SecurityDeposit;
  }

  // Create new security deposit configuration
  async createDeposit(data) {
    try {
      const SecurityDeposit = await this.getSecurityDepositModel();

      // Validate category range
      if (data.minSqMtr >= data.maxSqMtr) {
        throw new Error('Minimum square meters must be less than maximum square meters');
      }

      // Check if category already exists
      const existingDeposit = await SecurityDeposit.findOne({
        where: { category: data.category }
      });

      if (existingDeposit) {
        throw new Error(`Security deposit for category ${data.category} already exists`);
      }

      // If displayOrder not provided, set to last order + 1
      if (!data.displayOrder) {
        const lastItem = await SecurityDeposit.findOne({
          order: [['displayOrder', 'DESC']]
        });
        data.displayOrder = lastItem ? lastItem.displayOrder + 1 : 1;
      }

      const deposit = await SecurityDeposit.create({
        category: data.category,
        minSqMtr: parseInt(data.minSqMtr),
        maxSqMtr: parseInt(data.maxSqMtr),
        amountINR: parseInt(data.amountINR) || 0,
        amountUSD: parseInt(data.amountUSD) || 0,
        displayOrder: parseInt(data.displayOrder) || 1,
        isActive: data.isActive === 'true' || data.isActive === true,
        description: data.description || ''
      });

      return { success: true, data: deposit };
    } catch (error) {
      console.error('Error in createDeposit:', error);
      throw new Error(`Error creating security deposit: ${error.message}`);
    }
  }

  // Get all security deposit configurations
  async getAllDeposits(filters = {}) {
    try {
      const SecurityDeposit = await this.getSecurityDepositModel();

      const whereClause = {};

      if (filters.isActive !== undefined && filters.isActive !== 'undefined') {
        whereClause.isActive = filters.isActive === 'true';
      }

      if (filters.category && filters.category !== 'all' && filters.category !== 'undefined') {
        whereClause.category = filters.category;
      }

      const deposits = await SecurityDeposit.findAll({
        where: whereClause,
        order: [['displayOrder', 'ASC']]
      });

      return { success: true, data: deposits };
    } catch (error) {
      console.error('Error in getAllDeposits:', error);
      return { success: true, data: [] };
    }
  }

  // Get active security deposit configurations (for public API)
  async getActiveDeposits() {
    try {
      const SecurityDeposit = await this.getSecurityDepositModel();

      const deposits = await SecurityDeposit.findAll({
        where: { isActive: true },
        order: [['displayOrder', 'ASC'], ['minSqMtr', 'ASC']]
      });

      return { success: true, data: deposits };
    } catch (error) {
      console.error('Error in getActiveDeposits:', error);
      return { success: true, data: [] };
    }
  }

  // Get single security deposit by ID
  async getDepositById(id) {
    try {
      const SecurityDeposit = await this.getSecurityDepositModel();

      const deposit = await SecurityDeposit.findByPk(id);
      if (!deposit) {
        throw new Error('Security deposit not found');
      }
      return { success: true, data: deposit };
    } catch (error) {
      console.error('Error in getDepositById:', error);
      throw new Error(`Error fetching security deposit: ${error.message}`);
    }
  }

  // Update security deposit
  async updateDeposit(id, updateData) {
    try {
      const SecurityDeposit = await this.getSecurityDepositModel();

      const deposit = await SecurityDeposit.findByPk(id);
      if (!deposit) {
        throw new Error('Security deposit not found');
      }

      // Validate range if both are being updated
      const minSqMtr = updateData.minSqMtr !== undefined ? parseInt(updateData.minSqMtr) : deposit.minSqMtr;
      const maxSqMtr = updateData.maxSqMtr !== undefined ? parseInt(updateData.maxSqMtr) : deposit.maxSqMtr;
      
      if (minSqMtr >= maxSqMtr) {
        throw new Error('Minimum square meters must be less than maximum square meters');
      }

      // If category is being changed, check if new category already exists
      if (updateData.category && updateData.category !== deposit.category) {
        const existingDeposit = await SecurityDeposit.findOne({
          where: { category: updateData.category }
        });
        
        if (existingDeposit) {
          throw new Error(`Security deposit for category ${updateData.category} already exists`);
        }
      }

      // Parse numeric values
      if (updateData.amountINR !== undefined) {
        updateData.amountINR = parseInt(updateData.amountINR);
      }
      if (updateData.amountUSD !== undefined) {
        updateData.amountUSD = parseInt(updateData.amountUSD);
      }
      if (updateData.displayOrder !== undefined) {
        updateData.displayOrder = parseInt(updateData.displayOrder);
      }
      if (updateData.isActive !== undefined) {
        updateData.isActive = updateData.isActive === 'true' || updateData.isActive === true;
      }

      await deposit.update(updateData);
      return { success: true, data: deposit };
    } catch (error) {
      console.error('Error in updateDeposit:', error);
      throw new Error(`Error updating security deposit: ${error.message}`);
    }
  }

  // Delete security deposit
  async deleteDeposit(id) {
    try {
      const SecurityDeposit = await this.getSecurityDepositModel();

      const deposit = await SecurityDeposit.findByPk(id);
      if (!deposit) {
        throw new Error('Security deposit not found');
      }

      await deposit.destroy();
      
      // Reorder remaining items
      await this.reorderDeposits();
      
      return { success: true, message: 'Security deposit deleted successfully' };
    } catch (error) {
      console.error('Error in deleteDeposit:', error);
      throw new Error(`Error deleting security deposit: ${error.message}`);
    }
  }

  // Reorder all deposits
  async reorderDeposits() {
    try {
      const SecurityDeposit = await this.getSecurityDepositModel();
      
      const deposits = await SecurityDeposit.findAll({
        order: [['displayOrder', 'ASC']]
      });

      // Update display orders sequentially
      for (let i = 0; i < deposits.length; i++) {
        await deposits[i].update({ displayOrder: i + 1 });
      }

      return { success: true, message: 'Deposits reordered successfully' };
    } catch (error) {
      console.error('Error in reorderDeposits:', error);
      throw new Error(`Error reordering deposits: ${error.message}`);
    }
  }

  // Update display order
  async updateDisplayOrder(updates) {
    try {
      const SecurityDeposit = await this.getSecurityDepositModel();
      const results = [];
      const errors = [];

      for (const item of updates) {
        try {
          const deposit = await SecurityDeposit.findByPk(item.id);
          if (deposit) {
            await deposit.update({ displayOrder: item.displayOrder });
            results.push(item.id);
          } else {
            errors.push({ id: item.id, error: 'Deposit not found' });
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

  // Toggle active status
  async toggleActiveStatus(id, isActive) {
    try {
      const SecurityDeposit = await this.getSecurityDepositModel();

      const deposit = await SecurityDeposit.findByPk(id);
      if (!deposit) {
        throw new Error('Security deposit not found');
      }

      await deposit.update({ isActive });
      
      return { 
        success: true, 
        data: deposit,
        message: `Deposit ${isActive ? 'activated' : 'deactivated'} successfully` 
      };
    } catch (error) {
      console.error('Error in toggleActiveStatus:', error);
      throw new Error(`Error toggling status: ${error.message}`);
    }
  }

  // Get statistics
  async getStatistics() {
    try {
      const SecurityDeposit = await this.getSecurityDepositModel();
      const sequelize = SecurityDeposit.sequelize;

      const totalDeposits = await SecurityDeposit.count();
      const activeDeposits = await SecurityDeposit.count({ where: { isActive: true } });
      const inactiveDeposits = await SecurityDeposit.count({ where: { isActive: false } });

      const categoryStats = await SecurityDeposit.findAll({
        attributes: [
          'category',
          [sequelize.fn('COUNT', sequelize.col('category')), 'count'],
          [sequelize.fn('SUM', sequelize.col('amountINR')), 'totalINR'],
          [sequelize.fn('SUM', sequelize.col('amountUSD')), 'totalUSD']
        ],
        group: ['category']
      });

      const priceStats = await SecurityDeposit.findAll({
        attributes: [
          [sequelize.fn('MIN', sequelize.col('amountINR')), 'minINR'],
          [sequelize.fn('MAX', sequelize.col('amountINR')), 'maxINR'],
          [sequelize.fn('AVG', sequelize.col('amountINR')), 'avgINR'],
          [sequelize.fn('MIN', sequelize.col('amountUSD')), 'minUSD'],
          [sequelize.fn('MAX', sequelize.col('amountUSD')), 'maxUSD'],
          [sequelize.fn('AVG', sequelize.col('amountUSD')), 'avgUSD']
        ],
        raw: true
      });

      return {
        success: true,
        data: {
          totalDeposits,
          activeDeposits,
          inactiveDeposits,
          categoryStats: categoryStats || [],
          priceStats: priceStats[0] || {
            minINR: 0,
            maxINR: 0,
            avgINR: 0,
            minUSD: 0,
            maxUSD: 0,
            avgUSD: 0
          }
        }
      };
    } catch (error) {
      console.error('Error in getStatistics:', error);
      return {
        success: true,
        data: {
          totalDeposits: 0,
          activeDeposits: 0,
          inactiveDeposits: 0,
          categoryStats: [],
          priceStats: { minINR: 0, maxINR: 0, avgINR: 0, minUSD: 0, maxUSD: 0, avgUSD: 0 }
        }
      };
    }
  }

  // Bulk delete deposits
  async bulkDeleteDeposits(ids) {
    try {
      const SecurityDeposit = await this.getSecurityDepositModel();
      const results = [];
      const errors = [];

      for (const id of ids) {
        try {
          const deposit = await SecurityDeposit.findByPk(id);
          if (deposit) {
            await deposit.destroy();
            results.push(id);
          } else {
            errors.push({ id, error: 'Deposit not found' });
          }
        } catch (error) {
          errors.push({ id, error: error.message });
        }
      }

      // Reorder remaining deposits
      if (results.length > 0) {
        await this.reorderDeposits();
      }

      return { success: true, results, errors };
    } catch (error) {
      console.error('Error in bulkDeleteDeposits:', error);
      throw new Error(`Error bulk deleting deposits: ${error.message}`);
    }
  }
}

module.exports = new SecurityDepositService();