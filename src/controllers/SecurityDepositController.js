const securityDepositService = require('../services/SecurityDepositService');

class SecurityDepositController {
  // Create new security deposit
  async createDeposit(req, res) {
    try {
      console.log('Creating security deposit with data:', req.body);

      const result = await securityDepositService.createDeposit(req.body);
      
      res.status(201).json({
        success: true,
        data: result.data,
        message: 'Security deposit created successfully'
      });
    } catch (error) {
      console.error('Error in createDeposit:', error);
      
      // Check for validation errors
      if (error.message.includes('already exists')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      if (error.message.includes('less than maximum')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to create security deposit'
      });
    }
  }

  // Get all security deposits (admin)
  async getAllDeposits(req, res) {
    try {
      const filters = {
        isActive: req.query.isActive,
        category: req.query.category
      };

      Object.keys(filters).forEach(key => 
        filters[key] === undefined && delete filters[key]
      );

      console.log('Fetching security deposits with filters:', filters);
      
      const result = await securityDepositService.getAllDeposits(filters);
      
      res.json({
        success: true,
        data: result.data,
        count: result.data.length,
        filters
      });
    } catch (error) {
      console.error('Error in getAllDeposits:', error);
      res.status(500).json({ 
        success: false, 
        data: [],
        message: error.message || 'Failed to fetch security deposits'
      });
    }
  }

  // Get active security deposits (public - for exhibitor form)
  async getActiveDeposits(req, res) {
    try {
      const result = await securityDepositService.getActiveDeposits();
      
      res.json({
        success: true,
        data: result.data,
        count: result.data.length
      });
    } catch (error) {
      console.error('Error in getActiveDeposits:', error);
      res.status(500).json({ 
        success: false, 
        data: [],
        message: error.message || 'Failed to fetch security deposits'
      });
    }
  }

  // Get single security deposit by ID
  async getDeposit(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Deposit ID is required'
        });
      }

      const result = await securityDepositService.getDepositById(id);
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in getDeposit:', error);
      
      if (error.message === 'Security deposit not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch security deposit'
      });
    }
  }

  // Update security deposit
  async updateDeposit(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Deposit ID is required'
        });
      }

      console.log('Updating security deposit with ID:', id, 'Data:', req.body);
      
      const result = await securityDepositService.updateDeposit(id, req.body);
      
      res.json({
        success: true,
        data: result.data,
        message: 'Security deposit updated successfully'
      });
    } catch (error) {
      console.error('Error in updateDeposit:', error);
      
      if (error.message === 'Security deposit not found') {
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
      
      if (error.message.includes('less than maximum')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to update security deposit'
      });
    }
  }

  // Delete security deposit
  async deleteDeposit(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Deposit ID is required'
        });
      }

      const result = await securityDepositService.deleteDeposit(id);
      
      res.json({
        success: true,
        message: result.message || 'Security deposit deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteDeposit:', error);
      
      if (error.message === 'Security deposit not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to delete security deposit'
      });
    }
  }

  // Get statistics
  async getStatistics(req, res) {
    try {
      const result = await securityDepositService.getStatistics();
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in getStatistics:', error);
      res.status(200).json({ 
        success: true,
        data: {
          totalDeposits: 0,
          activeDeposits: 0,
          inactiveDeposits: 0,
          categoryStats: [],
          priceStats: { minINR: 0, maxINR: 0, avgINR: 0, minUSD: 0, maxUSD: 0, avgUSD: 0 }
        }
      });
    }
  }

  // Bulk delete deposits
  async bulkDeleteDeposits(req, res) {
    try {
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please provide an array of deposit IDs to delete'
        });
      }

      const result = await securityDepositService.bulkDeleteDeposits(ids);
      
      res.json({
        success: true,
        message: `Deleted ${result.results.length} deposits, ${result.errors.length} failed`,
        data: {
          successful: result.results,
          failed: result.errors
        }
      });
    } catch (error) {
      console.error('Error in bulkDeleteDeposits:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to bulk delete deposits'
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
          message: 'Deposit ID is required'
        });
      }
      
      if (isActive === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Active status (isActive) is required'
        });
      }

      const result = await securityDepositService.toggleActiveStatus(id, isActive);
      
      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } catch (error) {
      console.error('Error in toggleActiveStatus:', error);
      
      if (error.message === 'Security deposit not found') {
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

      const result = await securityDepositService.updateDisplayOrder(updates);
      
      res.json({
        success: true,
        message: `Updated ${result.results.length} deposits, ${result.errors.length} failed`,
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

  // Reorder deposits
  async reorderDeposits(req, res) {
    try {
      const result = await securityDepositService.reorderDeposits();
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Error in reorderDeposits:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to reorder deposits'
      });
    }
  }

  // Get deposits by category
  async getDepositsByCategory(req, res) {
    try {
      const { category } = req.params;
      
      if (!category || !['0-36', '37-100', '101+'].includes(category)) {
        return res.status(400).json({
          success: false,
          message: 'Valid category (0-36, 37-100, 101+) is required'
        });
      }

      const SecurityDeposit = await securityDepositService.getSecurityDepositModel();
      
      const deposits = await SecurityDeposit.findAll({
        where: { 
          category,
          isActive: true 
        },
        order: [['displayOrder', 'ASC']]
      });

      res.json({
        success: true,
        data: deposits,
        count: deposits.length,
        category
      });
    } catch (error) {
      console.error('Error in getDepositsByCategory:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch deposits by category'
      });
    }
  }
}

module.exports = new SecurityDepositController();