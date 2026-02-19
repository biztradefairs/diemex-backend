const hostessCategoryService = require('../services/HostessCategoryService');

class HostessCategoryController {
  // Create new category
  async createCategory(req, res) {
    try {
      console.log('Creating hostess category with data:', req.body);

      const result = await hostessCategoryService.createCategory(req.body);
      
      res.status(201).json({
        success: true,
        data: result.data,
        message: 'Hostess category created successfully'
      });
    } catch (error) {
      console.error('Error in createCategory:', error);
      
      if (error.message.includes('already exists')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to create hostess category'
      });
    }
  }

  // Get all categories
  async getAllCategories(req, res) {
    try {
      const filters = {
        isActive: req.query.isActive,
        category: req.query.category
      };

      Object.keys(filters).forEach(key => 
        filters[key] === undefined && delete filters[key]
      );

      console.log('Fetching hostess categories with filters:', filters);
      
      const result = await hostessCategoryService.getAllCategories(filters);
      
      res.json({
        success: true,
        data: result.data,
        count: result.data.length,
        filters
      });
    } catch (error) {
      console.error('Error in getAllCategories:', error);
      res.status(500).json({ 
        success: false, 
        data: [],
        message: error.message || 'Failed to fetch hostess categories'
      });
    }
  }

  // Get single category by ID
  async getCategory(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Category ID is required'
        });
      }

      const result = await hostessCategoryService.getCategoryById(id);
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in getCategory:', error);
      
      if (error.message === 'Hostess category not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch hostess category'
      });
    }
  }

  // Get category by type (A or B)
  async getCategoryByType(req, res) {
    try {
      const { type } = req.params;
      
      if (!type || !['A', 'B'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Valid category type (A or B) is required'
        });
      }

      const result = await hostessCategoryService.getCategoryByType(type);
      
      if (!result.data) {
        return res.status(404).json({
          success: false,
          message: `No active category found for type ${type}`
        });
      }
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in getCategoryByType:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch category by type'
      });
    }
  }

  // Update category
  async updateCategory(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Category ID is required'
        });
      }

      console.log('Updating hostess category with ID:', id);
      
      const result = await hostessCategoryService.updateCategory(id, req.body);
      
      res.json({
        success: true,
        data: result.data,
        message: 'Hostess category updated successfully'
      });
    } catch (error) {
      console.error('Error in updateCategory:', error);
      
      if (error.message === 'Hostess category not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      if (error.message.includes('already exists')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to update hostess category'
      });
    }
  }

  // Delete category
  async deleteCategory(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Category ID is required'
        });
      }

      const result = await hostessCategoryService.deleteCategory(id);
      
      res.json({
        success: true,
        message: result.message || 'Hostess category deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteCategory:', error);
      
      if (error.message === 'Hostess category not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to delete hostess category'
      });
    }
  }

  // Get statistics
  async getStatistics(req, res) {
    try {
      const result = await hostessCategoryService.getStatistics();
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in getStatistics:', error);
      res.status(200).json({ 
        success: true,
        data: {
          totalCategories: 0,
          activeCategories: 0,
          inactiveCategories: 0,
          rateStats: { minRate: 0, maxRate: 0, avgRate: 0 },
          categoryRates: []
        }
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
          message: 'Category ID is required'
        });
      }
      
      if (isActive === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Active status (isActive) is required'
        });
      }

      const result = await hostessCategoryService.updateCategory(id, { isActive });
      
      res.json({
        success: true,
        data: result.data,
        message: `Category ${isActive ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      console.error('Error in toggleActiveStatus:', error);
      
      if (error.message === 'Hostess category not found') {
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

  // Calculate cost
  async calculateCost(req, res) {
    try {
      const { category, days, hours } = req.body;
      
      if (!category || !['A', 'B'].includes(category)) {
        return res.status(400).json({
          success: false,
          message: 'Valid category (A or B) is required'
        });
      }

      if (!days || days < 1) {
        return res.status(400).json({
          success: false,
          message: 'Number of days is required and must be at least 1'
        });
      }

      const result = await hostessCategoryService.calculateCost(category, days, hours);
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in calculateCost:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to calculate cost'
      });
    }
  }

  // Bulk update rates
  async bulkUpdateRates(req, res) {
    try {
      const { updates } = req.body;
      
      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please provide an array of rate updates'
        });
      }

      const result = await hostessCategoryService.bulkUpdateRates(updates);
      
      res.json({
        success: true,
        message: `Updated ${result.results.length} categories, ${result.errors.length} failed`,
        data: {
          successful: result.results,
          failed: result.errors
        }
      });
    } catch (error) {
      console.error('Error in bulkUpdateRates:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to bulk update rates'
      });
    }
  }
}

module.exports = new HostessCategoryController();