const { Op } = require('sequelize');
const cloudinaryService = require('./CloudinaryService');

class RentalItemService {
  constructor() {
    this.RentalItem = null;
  }

  async getRentalItemModel() {
    if (!this.RentalItem) {
      try {
        const models = require('../models');
        if (!models.getAllModels().RentalItem) {
          console.log('🔄 RentalItem model not found, initializing models...');
          models.init();
        }
        this.RentalItem = models.getModel('RentalItem');
        console.log('✅ RentalItem model loaded in service');
      } catch (error) {
        console.error('❌ Failed to load RentalItem model:', error);
        throw new Error('RentalItem model not available');
      }
    }
    return this.RentalItem;
  }

  async createItem(data, file) {
    try {
      const RentalItem = await this.getRentalItemModel();

      let imageUrl = null;
      let cloudinaryPublicId = null;

      // Upload image to Cloudinary if file exists
      if (file) {
        const uploadResult = await cloudinaryService.uploadImage(file.buffer, {
          folder: 'exhibition-rentals',
          resource_type: 'image',
          access_mode: 'public'
        });
        imageUrl = uploadResult.secure_url || uploadResult.url;
        cloudinaryPublicId = uploadResult.public_id;
      }

      // If displayOrder not provided, set to last order + 1
      if (!data.displayOrder) {
        const lastItem = await RentalItem.findOne({
          order: [['displayOrder', 'DESC']]
        });
        data.displayOrder = lastItem ? lastItem.displayOrder + 1 : 1;
      }

      const item = await RentalItem.create({
        itemKey: data.itemKey.toLowerCase().replace(/\s+/g, ''),
        description: data.description,
        costFor3Days: parseInt(data.costFor3Days) || 0,
        category: data.category || 'Other',
        imageUrl,
        cloudinaryPublicId,
        isActive: data.isActive === 'true' || data.isActive === true,
        displayOrder: parseInt(data.displayOrder) || 1
      });

      return { success: true, data: item };
    } catch (error) {
      console.error('Error in createItem:', error);
      throw new Error(`Error creating rental item: ${error.message}`);
    }
  }

  async getAllItems(filters = {}) {
    try {
      const RentalItem = await this.getRentalItemModel();

      const whereClause = {};

      if (filters.category && filters.category !== 'all' && filters.category !== 'undefined') {
        whereClause.category = filters.category;
      }

      if (filters.isActive !== undefined && filters.isActive !== 'undefined') {
        whereClause.isActive = filters.isActive === 'true';
      }

      if (filters.search && filters.search.trim() !== '') {
        whereClause[Op.or] = [
          { description: { [Op.like]: `%${filters.search}%` } },
          { itemKey: { [Op.like]: `%${filters.search}%` } }
        ];
      }

      const items = await RentalItem.findAll({
        where: whereClause,
        order: [['displayOrder', 'ASC']]
      });

      return { success: true, data: items };
    } catch (error) {
      console.error('Error in getAllItems:', error);
      return { success: true, data: [] };
    }
  }

  async getItemById(id) {
    try {
      const RentalItem = await this.getRentalItemModel();

      const item = await RentalItem.findByPk(id);
      if (!item) {
        throw new Error('Rental item not found');
      }
      return { success: true, data: item };
    } catch (error) {
      console.error('Error in getItemById:', error);
      throw new Error(`Error fetching rental item: ${error.message}`);
    }
  }

  async updateItem(id, updateData, file = null) {
    try {
      const RentalItem = await this.getRentalItemModel();

      const item = await RentalItem.findByPk(id);
      if (!item) {
        throw new Error('Rental item not found');
      }

      // Handle image upload if new file is provided
      if (file) {
        // Delete old image from Cloudinary if exists
        if (item.cloudinaryPublicId) {
          await cloudinaryService.deleteImage(item.cloudinaryPublicId).catch(() => {
            console.log('Failed to delete old image from Cloudinary, but continuing...');
          });
        }

        // Upload new image
        const uploadResult = await cloudinaryService.uploadImage(file.buffer, {
          folder: 'exhibition-rentals',
          resource_type: 'image',
          access_mode: 'public'
        });

        updateData.imageUrl = uploadResult.secure_url || uploadResult.url;
        updateData.cloudinaryPublicId = uploadResult.public_id;
      }

      // Update fields
      if (updateData.itemKey) {
        updateData.itemKey = updateData.itemKey.toLowerCase().replace(/\s+/g, '');
      }
      if (updateData.costFor3Days) {
        updateData.costFor3Days = parseInt(updateData.costFor3Days);
      }
      if (updateData.displayOrder) {
        updateData.displayOrder = parseInt(updateData.displayOrder);
      }
      if (updateData.isActive !== undefined) {
        updateData.isActive = updateData.isActive === 'true' || updateData.isActive === true;
      }

      await item.update(updateData);
      return { success: true, data: item };
    } catch (error) {
      console.error('Error in updateItem:', error);
      throw new Error(`Error updating rental item: ${error.message}`);
    }
  }

  async deleteItem(id) {
    try {
      const RentalItem = await this.getRentalItemModel();

      const item = await RentalItem.findByPk(id);
      if (!item) {
        throw new Error('Rental item not found');
      }

      // Delete image from Cloudinary if exists
      if (item.cloudinaryPublicId) {
        await cloudinaryService.deleteImage(item.cloudinaryPublicId).catch((error) => {
          console.log('Failed to delete from Cloudinary:', error.message);
        });
      }

      await item.destroy();
      
      // Reorder remaining items
      await this.reorderItems();
      
      return { success: true, message: 'Rental item deleted successfully' };
    } catch (error) {
      console.error('Error in deleteItem:', error);
      throw new Error(`Error deleting rental item: ${error.message}`);
    }
  }

  async reorderItems() {
    try {
      const RentalItem = await this.getRentalItemModel();
      
      const items = await RentalItem.findAll({
        order: [['displayOrder', 'ASC']]
      });

      // Update display orders sequentially
      for (let i = 0; i < items.length; i++) {
        await items[i].update({ displayOrder: i + 1 });
      }

      return { success: true, message: 'Items reordered successfully' };
    } catch (error) {
      console.error('Error in reorderItems:', error);
      throw new Error(`Error reordering items: ${error.message}`);
    }
  }

  async updateDisplayOrder(updates) {
    try {
      const RentalItem = await this.getRentalItemModel();
      const results = [];
      const errors = [];

      for (const item of updates) {
        try {
          const rentalItem = await RentalItem.findByPk(item.id);
          if (rentalItem) {
            await rentalItem.update({ displayOrder: item.displayOrder });
            results.push(item.id);
          } else {
            errors.push({ id: item.id, error: 'Item not found' });
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
      const RentalItem = await this.getRentalItemModel();
      const sequelize = RentalItem.sequelize;

      const totalItems = await RentalItem.count();
      const activeItems = await RentalItem.count({ where: { isActive: true } });
      const inactiveItems = await RentalItem.count({ where: { isActive: false } });

      const categoryStats = await RentalItem.findAll({
        attributes: [
          'category',
          [sequelize.fn('COUNT', sequelize.col('category')), 'count'],
          [sequelize.fn('SUM', sequelize.col('costFor3Days')), 'totalValue']
        ],
        group: ['category']
      });

      const priceStats = await RentalItem.findAll({
        attributes: [
          [sequelize.fn('MIN', sequelize.col('costFor3Days')), 'minPrice'],
          [sequelize.fn('MAX', sequelize.col('costFor3Days')), 'maxPrice'],
          [sequelize.fn('AVG', sequelize.col('costFor3Days')), 'avgPrice']
        ],
        raw: true
      });

      return {
        success: true,
        data: {
          totalItems,
          activeItems,
          inactiveItems,
          categoryStats: categoryStats || [],
          priceStats: priceStats[0] || {
            minPrice: 0,
            maxPrice: 0,
            avgPrice: 0
          }
        }
      };
    } catch (error) {
      console.error('Error in getStatistics:', error);
      return {
        success: true,
        data: {
          totalItems: 0,
          activeItems: 0,
          inactiveItems: 0,
          categoryStats: [],
          priceStats: { minPrice: 0, maxPrice: 0, avgPrice: 0 }
        }
      };
    }
  }

  async bulkDeleteItems(ids) {
    try {
      const RentalItem = await this.getRentalItemModel();
      const results = [];
      const errors = [];

      for (const id of ids) {
        try {
          const item = await RentalItem.findByPk(id);
          if (item) {
            if (item.cloudinaryPublicId) {
              await cloudinaryService.deleteImage(item.cloudinaryPublicId).catch(() => {});
            }
            await item.destroy();
            results.push(id);
          } else {
            errors.push({ id, error: 'Item not found' });
          }
        } catch (error) {
          errors.push({ id, error: error.message });
        }
      }

      // Reorder remaining items
      if (results.length > 0) {
        await this.reorderItems();
      }

      return { success: true, results, errors };
    } catch (error) {
      console.error('Error in bulkDeleteItems:', error);
      throw new Error(`Error bulk deleting items: ${error.message}`);
    }
  }

  async getItemsByCategory(category) {
    try {
      const RentalItem = await this.getRentalItemModel();

      const items = await RentalItem.findAll({
        where: { 
          category,
          isActive: true 
        },
        order: [['displayOrder', 'ASC']]
      });

      return { success: true, data: items };
    } catch (error) {
      console.error('Error in getItemsByCategory:', error);
      return { success: true, data: [] };
    }
  }
}

module.exports = new RentalItemService();