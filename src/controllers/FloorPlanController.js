// src/controllers/FloorPlanController.js
const floorPlanService = require('../services/FloorPlanService');
const CloudinaryService = require('../services/CloudinaryService');

class FloorPlanController {
  // Test endpoint
  async testEndpoint(req, res) {
    try {
      // Test Cloudinary connection
      const cloudinaryStatus = await CloudinaryService.testConnection();
      
      res.json({
        success: true,
        message: 'Floor Plans API is working!',
        cloudinary: cloudinaryStatus ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Create floor plan
  async createFloorPlan(req, res) {
    try {
      console.log('📝 Creating floor plan for user:', req.user.id);
      
      const floorPlanData = {
        ...req.body,
        isPublic: req.body.isPublic || false
      };
      
      const floorPlan = await floorPlanService.createFloorPlan(floorPlanData, req.user.id);
      
      res.status(201).json({
        success: true,
        data: floorPlan,
        message: 'Floor plan created successfully'
      });
    } catch (error) {
      console.error('❌ Create error:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

async getAllFloorPlans(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  try {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const { page = 1, limit = 100 } = req.query;

    const result = await floorPlanService.getAllFloorPlans(
      req.query,
      Number(page),
      Number(limit),
      req.user
    );

    return res.json({
      success: true,
      data: result.floorPlans,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.totalPages
      }
    });

  } catch (error) {
    console.error('❌ Error fetching floor plans:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fetch floor plans'
    });
  }
}


  // Get single floor plan
  async getFloorPlan(req, res) {
    try {
      const floorPlan = await floorPlanService.getFloorPlanById(req.params.id);
      
      // Check permissions
      if (!floorPlan.isPublic && floorPlan.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      res.json({
        success: true,
        data: floorPlan
      });
    } catch (error) {
      console.error('❌ Get error:', error);
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  // Update floor plan
  async updateFloorPlan(req, res) {
    try {
      // Check permissions
      const existing = await floorPlanService.getFloorPlanById(req.params.id);
      if (existing.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'You can only update your own floor plans'
        });
      }
      
      const updateData = {
        ...req.body,
        updatedAt: new Date()
      };
      
      const floorPlan = await floorPlanService.updateFloorPlan(req.params.id, updateData, req.user.id);
      
      res.json({
        success: true,
        data: floorPlan,
        message: 'Floor plan updated successfully'
      });
    } catch (error) {
      console.error('❌ Update error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Delete floor plan
  async deleteFloorPlan(req, res) {
    try {
      // Check permissions
      const existing = await floorPlanService.getFloorPlanById(req.params.id);
      if (existing.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'You can only delete your own floor plans'
        });
      }
      
      await floorPlanService.deleteFloorPlan(req.params.id);
      
      res.json({
        success: true,
        message: 'Floor plan deleted successfully'
      });
    } catch (error) {
      console.error('❌ Delete error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Upload image to Cloudinary
  async uploadImage(req, res) {
    try {
      if (!req.file) {
        throw new Error('No file uploaded');
      }
      
      console.log('📤 Uploading file to Cloudinary...');
      
      const cloudinaryResult = await CloudinaryService.uploadImage(req.file.buffer, {
        folder: 'floor-plans'
      });
      
      // Generate thumbnail
      const thumbnailUrl = CloudinaryService.generateThumbnailUrl(cloudinaryResult.publicId);
      
      res.json({
        success: true,
        data: {
          url: cloudinaryResult.url,
          thumbnail: thumbnailUrl,
          publicId: cloudinaryResult.publicId,
          width: cloudinaryResult.width,
          height: cloudinaryResult.height,
          size: cloudinaryResult.bytes
        },
        message: 'Image uploaded successfully'
      });
    } catch (error) {
      console.error('❌ Upload error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Update booth status
  async updateBoothStatus(req, res) {
    try {
      const { floorPlanId, shapeId } = req.params;
      const { status } = req.body;
      
      if (!['available', 'booked', 'reserved', 'maintenance'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status. Must be: available, booked, reserved, or maintenance'
        });
      }
      
      // Check permissions
      const floorPlan = await floorPlanService.getFloorPlanById(floorPlanId);
      if (floorPlan.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      const updatedFloorPlan = await floorPlanService.updateBoothStatus(
        floorPlanId,
        shapeId,
        status,
        req.user.id
      );
      
      res.json({
        success: true,
        data: updatedFloorPlan,
        message: `Booth status updated to ${status}`
      });
    } catch (error) {
      console.error('❌ Update booth status error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get statistics
  async getStatistics(req, res) {
    try {
      const stats = await floorPlanService.getStatistics(req.user.id, req.user.role);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('❌ Statistics error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get booth analytics
  async getBoothAnalytics(req, res) {
    try {
      const analytics = await floorPlanService.getBoothAnalytics(req.user.id, req.user.role);
      
      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('❌ Booth analytics error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Quick save
  async quickSave(req, res) {
    try {
      const { shapes } = req.body;
      
      const updateData = {
        shapes,
        updatedAt: new Date()
      };
      
      const floorPlan = await floorPlanService.updateFloorPlan(req.params.id, updateData, req.user.id);
      
      res.json({
        success: true,
        data: floorPlan,
        message: 'Auto-saved successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Quick save error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Duplicate floor plan
  async duplicateFloorPlan(req, res) {
    try {
      const { newName } = req.body;
      
      // Get original floor plan
      const original = await floorPlanService.getFloorPlanById(req.params.id);
      
      // Check permissions
      if (original.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      // Create duplicate data
      const duplicateData = {
        name: newName || `${original.name} (Copy)`,
        description: original.description,
        floor: original.floor,
        image: original.image,
        shapes: original.shapes,
        scale: original.scale,
        gridSize: original.gridSize,
        showGrid: original.showGrid,
        tags: original.tags,
        isPublic: false
      };
      
      const duplicate = await floorPlanService.createFloorPlan(duplicateData, req.user.id);
      
      res.status(201).json({
        success: true,
        data: duplicate,
        message: 'Floor plan duplicated successfully'
      });
    } catch (error) {
      console.error('❌ Duplicate error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Export floor plan
  async exportFloorPlan(req, res) {
    try {
      const floorPlan = await floorPlanService.getFloorPlanById(req.params.id);
      
      // Check permissions
      if (!floorPlan.isPublic && floorPlan.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      const { format = 'json' } = req.query;
      
      if (format === 'json') {
        res.json({
          success: true,
          data: floorPlan
        });
      } else if (format === 'pdf') {
        // For PDF export, you would use a PDF generation library
        // This is a simplified version
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${floorPlan.name}.pdf"`);
        
        const pdfContent = `Floor Plan: ${floorPlan.name}\n\n`;
        res.send(pdfContent);
      } else {
        res.status(400).json({
          success: false,
          error: 'Unsupported format'
        });
      }
    } catch (error) {
      console.error('❌ Export error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new FloorPlanController();