const electricalRateService = require('../services/ElectricalRateService');

class ElectricalRateController {
  // Create new rate
  async createRate(req, res) {
    try {
      console.log('Creating electrical rate with data:', req.body);

      const result = await electricalRateService.createRate(req.body);
      
      res.status(201).json({
        success: true,
        data: result.data,
        message: 'Electrical rate created successfully'
      });
    } catch (error) {
      console.error('Error in createRate:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to create electrical rate'
      });
    }
  }

  // Get all rates
  async getAllRates(req, res) {
    try {
      const filters = {
        type: req.query.type,
        isActive: req.query.isActive,
        search: req.query.search,
        effectiveDate: req.query.effectiveDate
      };

      Object.keys(filters).forEach(key => 
        filters[key] === undefined && delete filters[key]
      );

      console.log('Fetching electrical rates with filters:', filters);
      
      const result = await electricalRateService.getAllRates(filters);
      
      res.json({
        success: true,
        data: result.data,
        count: result.data.length,
        filters
      });
    } catch (error) {
      console.error('Error in getAllRates:', error);
      res.status(500).json({ 
        success: false, 
        data: [],
        message: error.message || 'Failed to fetch electrical rates'
      });
    }
  }

  // Get single rate by ID
  async getRate(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Rate ID is required'
        });
      }

      const result = await electricalRateService.getRateById(id);
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in getRate:', error);
      
      if (error.message === 'Electrical rate not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch electrical rate'
      });
    }
  }

  // Update rate
  async updateRate(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Rate ID is required'
        });
      }

      console.log('Updating electrical rate with ID:', id);
      
      const result = await electricalRateService.updateRate(id, req.body);
      
      res.json({
        success: true,
        data: result.data,
        message: 'Electrical rate updated successfully'
      });
    } catch (error) {
      console.error('Error in updateRate:', error);
      
      if (error.message === 'Electrical rate not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      if (error.message.includes('Active rate conflict')) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to update electrical rate'
      });
    }
  }

  // Delete rate
  async deleteRate(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Rate ID is required'
        });
      }

      const result = await electricalRateService.deleteRate(id);
      
      res.json({
        success: true,
        message: result.message || 'Electrical rate deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteRate:', error);
      
      if (error.message === 'Electrical rate not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to delete electrical rate'
      });
    }
  }

  // Get active rate
  async getActiveRate(req, res) {
    try {
      const { type } = req.params;
      const { date } = req.query;

      if (!type || !['temporary', 'exhibition', 'both'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Valid rate type (temporary, exhibition, both) is required'
        });
      }

      const result = await electricalRateService.getActiveRate(type, date);
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in getActiveRate:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch active rate'
      });
    }
  }

  // Get statistics
  async getStatistics(req, res) {
    try {
      const result = await electricalRateService.getStatistics();
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in getStatistics:', error);
      res.status(200).json({ 
        success: true,
        data: {
          totalRates: 0,
          activeRates: 0,
          inactiveRates: 0,
          typeStats: [],
          rateStats: { minRate: 0, maxRate: 0, avgRate: 0 }
        }
      });
    }
  }

  // Bulk delete rates
  async bulkDeleteRates(req, res) {
    try {
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please provide an array of rate IDs to delete'
        });
      }

      const result = await electricalRateService.bulkDeleteRates(ids);
      
      res.json({
        success: true,
        message: `Deleted ${result.results.length} items, ${result.errors.length} failed`,
        data: {
          successful: result.results,
          failed: result.errors
        }
      });
    } catch (error) {
      console.error('Error in bulkDeleteRates:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to bulk delete rates'
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
          message: 'Rate ID is required'
        });
      }
      
      if (isActive === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Active status (isActive) is required'
        });
      }

      const result = await electricalRateService.updateRate(id, { isActive });
      
      res.json({
        success: true,
        data: result.data,
        message: `Rate ${isActive ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      console.error('Error in toggleActiveStatus:', error);
      
      if (error.message === 'Electrical rate not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      if (error.message.includes('Active rate conflict')) {
        return res.status(409).json({
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

module.exports = new ElectricalRateController();