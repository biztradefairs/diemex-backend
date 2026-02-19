const rentalItemService = require('../services/RentalItemService');

class RentalItemController {
  // Create new rental item
  async createItem(req, res) {
    try {
      console.log('Creating rental item with data:', {
        body: req.body,
        file: req.file ? {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        } : 'No file'
      });

      const result = await rentalItemService.createItem(req.body, req.file);
      
      res.status(201).json({
        success: true,
        data: result.data,
        message: 'Rental item created successfully'
      });
    } catch (error) {
      console.error('Error in createItem:', error);
      
      // Check for duplicate key error
      if (error.message.includes('Validation error')) {
        return res.status(400).json({
          success: false,
          message: 'Item key already exists. Please use a unique key.'
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to create rental item'
      });
    }
  }

  // Get all rental items
  async getAllItems(req, res) {
    try {
      const filters = {
        category: req.query.category,
        isActive: req.query.isActive,
        search: req.query.search
      };

      Object.keys(filters).forEach(key => 
        filters[key] === undefined && delete filters[key]
      );

      console.log('Fetching rental items with filters:', filters);
      
      const result = await rentalItemService.getAllItems(filters);
      
      res.json({
        success: true,
        data: result.data,
        count: result.data.length,
        filters
      });
    } catch (error) {
      console.error('Error in getAllItems:', error);
      res.status(500).json({ 
        success: false, 
        data: [],
        message: error.message || 'Failed to fetch rental items'
      });
    }
  }

  // Get single rental item by ID
  async getItem(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Item ID is required'
        });
      }

      const result = await rentalItemService.getItemById(id);
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in getItem:', error);
      
      if (error.message === 'Rental item not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch rental item'
      });
    }
  }

  // Update rental item
  async updateItem(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Item ID is required'
        });
      }

      console.log('Updating rental item with ID:', id);
      
      const result = await rentalItemService.updateItem(id, req.body, req.file);
      
      res.json({
        success: true,
        data: result.data,
        message: 'Rental item updated successfully'
      });
    } catch (error) {
      console.error('Error in updateItem:', error);
      
      if (error.message === 'Rental item not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      if (error.message.includes('Validation error')) {
        return res.status(400).json({
          success: false,
          message: 'Item key already exists. Please use a unique key.'
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to update rental item'
      });
    }
  }

  // Delete rental item
  async deleteItem(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Item ID is required'
        });
      }

      const result = await rentalItemService.deleteItem(id);
      
      res.json({
        success: true,
        message: result.message || 'Rental item deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteItem:', error);
      
      if (error.message === 'Rental item not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to delete rental item'
      });
    }
  }

  // Get statistics
  async getStatistics(req, res) {
    try {
      const result = await rentalItemService.getStatistics();
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in getStatistics:', error);
      res.status(200).json({ 
        success: true,
        data: {
          totalItems: 0,
          activeItems: 0,
          inactiveItems: 0,
          categoryStats: [],
          priceStats: { minPrice: 0, maxPrice: 0, avgPrice: 0 }
        }
      });
    }
  }

  // Bulk delete items
  async bulkDeleteItems(req, res) {
    try {
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please provide an array of item IDs to delete'
        });
      }

      const result = await rentalItemService.bulkDeleteItems(ids);
      
      res.json({
        success: true,
        message: `Deleted ${result.results.length} items, ${result.errors.length} failed`,
        data: {
          successful: result.results,
          failed: result.errors
        }
      });
    } catch (error) {
      console.error('Error in bulkDeleteItems:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to bulk delete items'
      });
    }
  }

  // Toggle active status
  async toggleActiveStatus(req, res) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Item ID is required'
        });
      }
      
      if (isActive === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Active status (isActive) is required'
        });
      }

      const result = await rentalItemService.updateItem(id, { isActive });
      
      res.json({
        success: true,
        data: result.data,
        message: `Item ${isActive ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      console.error('Error in toggleActiveStatus:', error);
      
      if (error.message === 'Rental item not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to update status'
      });
    }
  }

  // Update display order
  async updateDisplayOrder(req, res) {
    try {
      const { updates } = req.body;
      
      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please provide an array of display order updates'
        });
      }

      const result = await rentalItemService.updateDisplayOrder(updates);
      
      res.json({
        success: true,
        message: `Updated ${result.results.length} items, ${result.errors.length} failed`,
        data: {
          successful: result.results,
          failed: result.errors
        }
      });
    } catch (error) {
      console.error('Error in updateDisplayOrder:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to update display order'
      });
    }
  }

  // Reorder items
  async reorderItems(req, res) {
    try {
      const result = await rentalItemService.reorderItems();
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Error in reorderItems:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to reorder items'
      });
    }
  }

  // Get items by category
  async getItemsByCategory(req, res) {
    try {
      const { category } = req.params;
      
      if (!category || !['AV', 'IT', 'Other'].includes(category)) {
        return res.status(400).json({
          success: false,
          message: 'Valid category (AV, IT, Other) is required'
        });
      }

      const result = await rentalItemService.getItemsByCategory(category);
      
      res.json({
        success: true,
        data: result.data,
        count: result.data.length,
        category
      });
    } catch (error) {
      console.error('Error in getItemsByCategory:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch items by category'
      });
    }
  }
}

module.exports = new RentalItemController();