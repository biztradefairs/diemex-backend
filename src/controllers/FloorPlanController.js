// src/controllers/FloorPlanController.js
const floorPlanService = require('../services/FloorPlanService');

class FloorPlanController {
  async createFloorPlan(req, res) {
    try {
      const floorPlanData = {
        ...req.body,
        createdBy: req.user.id,
        updatedBy: req.user.id
      };
      
      const floorPlan = await floorPlanService.createFloorPlan(floorPlanData);
      
      res.status(201).json({
        success: true,
        data: floorPlan
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getAllFloorPlans(req, res) {
    try {
      const { page = 1, limit = 10, search, floor } = req.query;
      
      const filters = {};
      if (search) filters.search = search;
      if (floor) filters.floor = floor;
      
      const result = await floorPlanService.getAllFloorPlans(filters, parseInt(page), parseInt(limit));
      
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

  async getFloorPlan(req, res) {
    try {
      const floorPlan = await floorPlanService.getFloorPlanById(req.params.id);
      
      res.json({
        success: true,
        data: floorPlan
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateFloorPlan(req, res) {
    try {
      const updateData = {
        ...req.body,
        updatedBy: req.user.id
      };
      
      const floorPlan = await floorPlanService.updateFloorPlan(req.params.id, updateData);
      
      res.json({
        success: true,
        data: floorPlan
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteFloorPlan(req, res) {
    try {
      await floorPlanService.deleteFloorPlan(req.params.id);
      
      res.json({
        success: true,
        message: 'Floor plan deleted successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async exportFloorPlan(req, res) {
    try {
      const { format = 'json' } = req.query;
      const result = await floorPlanService.exportFloorPlan(req.params.id, format);
      
      if (format === 'json') {
        res.json({
          success: true,
          data: result.data
        });
      } else if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename || 'floor-plan.pdf'}"`);
        res.send(result.data);
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

  async duplicateFloorPlan(req, res) {
    try {
      const { newName } = req.body;
      const duplicate = await floorPlanService.duplicateFloorPlan(req.params.id, newName);
      
      res.status(201).json({
        success: true,
        data: duplicate,
        message: 'Floor plan duplicated successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async uploadFloorPlanImage(req, res) {
    try {
      if (!req.file) {
        throw new Error('No file uploaded');
      }
      
      const imageUrl = `/uploads/${req.file.filename}`;
      
      // Update floor plan with image
      if (req.params.id) {
        await floorPlanService.updateFloorPlan(req.params.id, { image: imageUrl });
      }
      
      res.json({
        success: true,
        data: {
          url: imageUrl,
          filename: req.file.filename,
          size: req.file.size
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new FloorPlanController();