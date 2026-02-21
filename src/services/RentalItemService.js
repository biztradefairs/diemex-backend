const { Op } = require('sequelize');
const cloudinaryService = require('./CloudinaryService');

class RentalItemService {
  constructor() {
    this.RentalItem = null;
  }

  // =====================================
  // LOAD MODEL
  // =====================================
  async getRentalItemModel() {
    if (!this.RentalItem) {
      const models = require('../models');
      if (!models.getAllModels().RentalItem) {
        models.init();
      }
      this.RentalItem = models.getModel('RentalItem');
      console.log('✅ RentalItem model loaded');
    }
    return this.RentalItem;
  }

  // =====================================
  // CREATE ITEM
  // =====================================
  async createItem(data, file) {
    const RentalItem = await this.getRentalItemModel();
    const sequelize = RentalItem.sequelize;
    const transaction = await sequelize.transaction();

    try {
      let imageUrl = null;
      let cloudinaryPublicId = null;

      if (file) {
        const upload = await cloudinaryService.uploadFile(file.buffer, {
          folder: 'exhibition-rentals',
          resource_type: 'image'
        });

        imageUrl = upload.url;
        cloudinaryPublicId = upload.publicId;
      }

      // Auto display order
      let displayOrder = parseInt(data.displayOrder);
      if (!displayOrder) {
        const lastItem = await RentalItem.findOne({
          order: [['displayOrder', 'DESC']],
          transaction
        });
        displayOrder = lastItem ? lastItem.displayOrder + 1 : 1;
      }

      const item = await RentalItem.create({
        itemKey: data.itemKey?.toLowerCase().replace(/\s+/g, ''),
        description: data.description,
        costFor3Days: parseInt(data.costFor3Days) || 0,
        category: data.category || 'Other',
        imageUrl,
        cloudinaryPublicId,
        isActive: data.isActive === 'true' || data.isActive === true,
        displayOrder
      }, { transaction });

      await transaction.commit();
      return { success: true, data: item };

    } catch (error) {
      await transaction.rollback();
      console.error('Error in createItem:', error);
      throw new Error(`Error creating rental item: ${error.message}`);
    }
  }

  // =====================================
  // GET ALL ITEMS (FILTERS)
  // =====================================
  async getAllItems(filters = {}) {
    const RentalItem = await this.getRentalItemModel();

    try {
      const whereClause = {};

      if (filters.category && filters.category !== 'all') {
        whereClause.category = filters.category;
      }

      if (filters.isActive !== undefined) {
        whereClause.isActive = filters.isActive === 'true';
      }

      if (filters.search?.trim()) {
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

  // =====================================
  // GET BY ID
  // =====================================
  async getItemById(id) {
    const RentalItem = await this.getRentalItemModel();

    const item = await RentalItem.findByPk(id);
    if (!item) throw new Error('Rental item not found');

    return { success: true, data: item };
  }

  // =====================================
  // UPDATE ITEM
  // =====================================
  async updateItem(id, updateData, file = null) {
    const RentalItem = await this.getRentalItemModel();
    const sequelize = RentalItem.sequelize;
    const transaction = await sequelize.transaction();

    try {
      const item = await RentalItem.findByPk(id, { transaction });
      if (!item) throw new Error('Rental item not found');

      if (file) {
        if (item.cloudinaryPublicId) {
          await cloudinaryService.deleteFile(item.cloudinaryPublicId, 'image').catch(() => {});
        }

        const upload = await cloudinaryService.uploadFile(file.buffer, {
          folder: 'exhibition-rentals',
          resource_type: 'image'
        });

        updateData.imageUrl = upload.url;
        updateData.cloudinaryPublicId = upload.publicId;
      }

      if (updateData.itemKey) {
        updateData.itemKey = updateData.itemKey.toLowerCase().replace(/\s+/g, '');
      }

      if (updateData.costFor3Days !== undefined) {
        updateData.costFor3Days = parseInt(updateData.costFor3Days) || 0;
      }

      if (updateData.displayOrder !== undefined) {
        updateData.displayOrder = parseInt(updateData.displayOrder) || 1;
      }

      if (updateData.isActive !== undefined) {
        updateData.isActive =
          updateData.isActive === 'true' || updateData.isActive === true;
      }

      await item.update(updateData, { transaction });
      await transaction.commit();

      return { success: true, data: item };

    } catch (error) {
      await transaction.rollback();
      console.error('Error in updateItem:', error);
      throw new Error(`Error updating rental item: ${error.message}`);
    }
  }

  // =====================================
  // DELETE ITEM
  // =====================================
  async deleteItem(id) {
    const RentalItem = await this.getRentalItemModel();
    const sequelize = RentalItem.sequelize;
    const transaction = await sequelize.transaction();

    try {
      const item = await RentalItem.findByPk(id, { transaction });
      if (!item) throw new Error('Rental item not found');

      if (item.cloudinaryPublicId) {
        await cloudinaryService.deleteFile(item.cloudinaryPublicId, 'image').catch(() => {});
      }

      await item.destroy({ transaction });
      await transaction.commit();

      await this.reorderItems();
      return { success: true, message: 'Rental item deleted successfully' };

    } catch (error) {
      await transaction.rollback();
      console.error('Error in deleteItem:', error);
      throw new Error(`Error deleting rental item: ${error.message}`);
    }
  }

  // =====================================
  // REORDER ITEMS
  // =====================================
  async reorderItems() {
    const RentalItem = await this.getRentalItemModel();

    const items = await RentalItem.findAll({
      order: [['displayOrder', 'ASC']]
    });

    for (let i = 0; i < items.length; i++) {
      await items[i].update({ displayOrder: i + 1 });
    }

    return { success: true };
  }

  // =====================================
  // BULK DELETE
  // =====================================
  async bulkDeleteItems(ids) {
    const RentalItem = await this.getRentalItemModel();
    const results = [];
    const errors = [];

    for (const id of ids) {
      try {
        const item = await RentalItem.findByPk(id);
        if (!item) {
          errors.push({ id, error: 'Item not found' });
          continue;
        }

        if (item.cloudinaryPublicId) {
          await cloudinaryService.deleteFile(item.cloudinaryPublicId, 'image').catch(() => {});
        }

        await item.destroy();
        results.push(id);

      } catch (error) {
        errors.push({ id, error: error.message });
      }
    }

    if (results.length > 0) {
      await this.reorderItems();
    }

    return { success: true, results, errors };
  }

  // =====================================
  // UPDATE DISPLAY ORDER
  // =====================================
  async updateDisplayOrder(updates) {
    const RentalItem = await this.getRentalItemModel();

    for (const item of updates) {
      const rentalItem = await RentalItem.findByPk(item.id);
      if (rentalItem) {
        await rentalItem.update({ displayOrder: item.displayOrder });
      }
    }

    return { success: true };
  }

  // =====================================
  // GET ITEMS BY CATEGORY
  // =====================================
  async getItemsByCategory(category) {
    const RentalItem = await this.getRentalItemModel();

    const items = await RentalItem.findAll({
      where: {
        category,
        isActive: true
      },
      order: [['displayOrder', 'ASC']]
    });

    return { success: true, data: items };
  }

  // =====================================
  // STATISTICS
  // =====================================
  async getStatistics() {
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

    return {
      success: true,
      data: {
        totalItems,
        activeItems,
        inactiveItems,
        categoryStats
      }
    };
  }
}

module.exports = new RentalItemService();