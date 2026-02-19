const compressedAirService = require('../services/CompressedAirService');

class CompressedAirController {
  // Create new option
  async createOption(req, res) {
    try {
      console.log('Creating compressed air option with data:', req.body);

      const result = await compressedAirService.createOption(req.body);
      
      res.status(201).json({
        success: true,
        data: result.data,
        message: 'Compressed air option created successfully'
      });
    } catch (error) {
      console.error('Error in createOption:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to create compressed air option'
      });
    }
  }

  // Get all options
  async getAllOptions(req, res) {
    try {
      const filters = {
        isActive: req.query.isActive,
        search: req.query.search
      };

      Object.keys(filters).forEach(key => 
        filters[key] === undefined && delete filters[key]
      );

      console.log('Fetching compressed air options with filters:', filters);
      
      const result = await compressedAirService.getAllOptions(filters);
      
      // Add calculated total cost to each option
      const optionsWithTotal = result.data.map(option => {
        const optionData = option.toJSON();
        optionData.totalCost = option.costPerConnection + (option.powerKW * 3500);
        return optionData;
      });
      
      res.json({
        success: true,
        data: optionsWithTotal,
        count: optionsWithTotal.length,
        filters
      });
    } catch (error) {
      console.error('Error in getAllOptions:', error);
      res.status(500).json({ 
        success: false, 
        data: [],
        message: error.message || 'Failed to fetch compressed air options'
      });
    }
  }

  // Get single option by ID
  async getOption(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Option ID is required'
        });
      }

      const result = await compressedAirService.getOptionById(id);
      
      // Add calculated total cost
      const optionData = result.data.toJSON();
      optionData.totalCost = optionData.costPerConnection + (optionData.powerKW * 3500);
      
      res.json({
        success: true,
        data: optionData
      });
    } catch (error) {
      console.error('Error in getOption:', error);
      
      if (error.message === 'Compressed air option not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch compressed air option'
      });
    }
  }

  // Update option
  async updateOption(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Option ID is required'
        });
      }

      console.log('Updating compressed air option with ID:', id);
      
      const result = await compressedAirService.updateOption(id, req.body);
      
      res.json({
        success: true,
        data: result.data,
        message: 'Compressed air option updated successfully'
      });
    } catch (error) {
      console.error('Error in updateOption:', error);
      
      if (error.message === 'Compressed air option not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to update compressed air option'
      });
    }
  }

  // Delete option
  async deleteOption(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Option ID is required'
        });
      }

      const result = await compressedAirService.deleteOption(id);
      
      res.json({
        success: true,
        message: result.message || 'Compressed air option deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteOption:', error);
      
      if (error.message === 'Compressed air option not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to delete compressed air option'
      });
    }
  }

  // Get statistics
  async getStatistics(req, res) {
    try {
      const result = await compressedAirService.getStatistics();
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in getStatistics:', error);
      res.status(200).json({ 
        success: true,
        data: {
          totalOptions: 0,
          activeOptions: 0,
          inactiveOptions: 0,
          costStats: { minCost: 0, maxCost: 0, avgCost: 0 },
          powerStats: { minPower: 0, maxPower: 0, avgPower: 0 }
        }
      });
    }
  }

  // Bulk delete options
  async bulkDeleteOptions(req, res) {
    try {
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please provide an array of option IDs to delete'
        });
      }

      const result = await compressedAirService.bulkDeleteOptions(ids);
      
      res.json({
        success: true,
        message: `Deleted ${result.results.length} items, ${result.errors.length} failed`,
        data: {
          successful: result.results,
          failed: result.errors
        }
      });
    } catch (error) {
      console.error('Error in bulkDeleteOptions:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to bulk delete options'
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

      const result = await compressedAirService.updateDisplayOrder(updates);
      
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

  // Reorder options
  async reorderOptions(req, res) {
    try {
      const result = await compressedAirService.reorderOptions();
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Error in reorderOptions:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to reorder options'
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
          message: 'Option ID is required'
        });
      }
      
      if (isActive === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Active status (isActive) is required'
        });
      }

      const result = await compressedAirService.updateOption(id, { isActive });
      
      res.json({
        success: true,
        data: result.data,
        message: `Status updated to ${isActive ? 'Active' : 'Inactive'}`
      });
    } catch (error) {
      console.error('Error in toggleActiveStatus:', error);
      
      if (error.message === 'Compressed air option not found') {
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
}

module.exports = new CompressedAirController();