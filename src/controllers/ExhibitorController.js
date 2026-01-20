// src/controllers/ExhibitorController.js
const exhibitorService = require('../services/ExhibitorService');

class ExhibitorController {
  async createExhibitor(req, res) {
    try {
      const exhibitor = await exhibitorService.createExhibitor(req.body);
      
      res.status(201).json({
        success: true,
        data: exhibitor
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getAllExhibitors(req, res) {
    try {
      const { page = 1, limit = 10, search, sector, status } = req.query;
      
      const filters = {};
      if (search) filters.search = search;
      if (sector) filters.sector = sector;
      if (status) filters.status = status;
      
      const result = await exhibitorService.getAllExhibitors(filters, parseInt(page), parseInt(limit));
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getExhibitor(req, res) {
    try {
      const exhibitor = await exhibitorService.getExhibitorById(req.params.id);
      
      res.json({
        success: true,
        data: exhibitor
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateExhibitor(req, res) {
    try {
      const exhibitor = await exhibitorService.updateExhibitor(req.params.id, req.body);
      
      res.json({
        success: true,
        data: exhibitor
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteExhibitor(req, res) {
    try {
      await exhibitorService.deleteExhibitor(req.params.id);
      
      res.json({
        success: true,
        message: 'Exhibitor deleted successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getExhibitorStats(req, res) {
    try {
      const stats = await exhibitorService.getExhibitorStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async bulkUpdateStatus(req, res) {
    try {
      const { ids, status } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new Error('No exhibitor IDs provided');
      }
      
      const results = await Promise.all(
        ids.map(id => exhibitorService.updateExhibitor(id, { status }))
      );
      
      res.json({
        success: true,
        data: results,
        message: `Updated ${results.length} exhibitors to ${status} status`
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async exportExhibitors(req, res) {
    try {
      const { format = 'csv' } = req.query;
      const exhibitors = await exhibitorService.getAllExhibitors({}, 1, 1000); // Get all exhibitors
      
      if (format === 'csv') {
        let csv = 'ID,Name,Email,Company,Sector,Booth,Status,Registration Date\n';
        
        exhibitors.exhibitors.forEach(exhibitor => {
          csv += `${exhibitor.id},${exhibitor.name},${exhibitor.email},${exhibitor.company},${exhibitor.sector || ''},${exhibitor.booth || ''},${exhibitor.status},${exhibitor.registrationDate}\n`;
        });
        
        res.header('Content-Type', 'text/csv');
        res.attachment(`exhibitors-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
      } else if (format === 'json') {
        res.json({
          success: true,
          data: exhibitors.exhibitors
        });
      } else {
        throw new Error('Unsupported format');
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new ExhibitorController();