// controllers/FloorPlanController.js
const boothService = require('../services/FloorPlanService');

class BoothController {
  // Get all booths
  async getAllBooths(req, res) {
    try {
      const result = await boothService.getFloorPlan();
      res.json({
        success: true,
        data: result.data.booths || [],
        floorPlanId: result.data.id
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get floor plan with image
  async getFloorPlan(req, res) {
    try {
      const result = await boothService.getFloorPlan();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

// controllers/FloorPlanController.js

async uploadFloorPlanImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    console.log('Controller received file:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Pass the ENTIRE req.file object, not just the buffer
    const result = await boothService.uploadFloorPlanImage(req.file, req.user?.id);
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Controller upload error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}
  // Export floor plan
  async exportFloorPlan(req, res) {
    try {
      const result = await boothService.exportFloorPlan();
      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Add new booth
  async addBooth(req, res) {
    try {
      const result = await boothService.addBooth(req.body, req.user?.id);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Update booth position
  async updateBoothPosition(req, res) {
    try {
      const { boothId } = req.params;
      const result = await boothService.updateBoothPosition(boothId, req.body, req.user?.id);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Update booth status
  async updateBoothStatus(req, res) {
    try {
      const { boothId } = req.params;
      const { status } = req.body;
      
      if (!['available', 'booked', 'reserved'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status. Must be: available, booked, reserved'
        });
      }

      const result = await boothService.updateBoothStatus(boothId, status, req.user?.id);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Update company name
  async updateCompanyName(req, res) {
    try {
      const { boothId } = req.params;
      const { companyName } = req.body;
      
      const result = await boothService.updateCompanyName(boothId, companyName, req.user?.id);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Delete booth
  async deleteBooth(req, res) {
    try {
      const { boothId } = req.params;
      const result = await boothService.deleteBooth(boothId, req.user?.id);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get booth statistics
  async getBoothStatistics(req, res) {
    try {
      const result = await boothService.getBoothStatistics();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

async saveFloorPlan(req, res) {
  try {
    const { baseImageUrl } = req.body;
    const userId = req.user?.id;

    const modelFactory = require('../models');
    const FloorPlan = modelFactory.getModel('FloorPlan');

    const floorPlan = await FloorPlan.findOne({
      where: { isActive: true, isMaster: true }
    });

    if (!floorPlan) {
      return res.status(404).json({
        success: false,
        error: 'No active floor plan found'
      });
    }

    // Only update image
    if (baseImageUrl) {
      floorPlan.baseImageUrl = baseImageUrl;
    }

    floorPlan.updatedBy = userId;
    await floorPlan.save();

    return res.json({
      success: true,
      message: 'Floor plan image saved successfully'
    });

  } catch (error) {
    console.error('❌ Save floor plan error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

  // Reset floor plan
  async resetFloorPlan(req, res) {
    try {
      const result = await boothService.resetFloorPlan(req.user?.id);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new BoothController();