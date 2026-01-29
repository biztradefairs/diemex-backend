const floorPlanService = require('../services/FloorPlanService');
const CloudinaryService = require('../services/CloudinaryService');
const ExhibitorService = require('../services/ExhibitorService');

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
        version: '1.0.0',
        endpoints: {
          admin: '/floor-plans',
          exhibitor: '/floor-plans/exhibitor-view',
          public: '/floor-plans/public'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get public floor plans
  async getPublicFloorPlans(req, res) {
    try {
      const { page = 1, limit = 100 } = req.query;
      
      const result = await floorPlanService.getAllFloorPlans(
        { isPublic: true },
        Number(page),
        Number(limit),
        null // No user context for public access
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
      console.error('❌ Error fetching public floor plans:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to fetch public floor plans'
      });
    }
  }

  // Get public floor plan by ID
  async getPublicFloorPlanById(req, res) {
    try {
      const floorPlan = await floorPlanService.getFloorPlanById(req.params.id);
      
      // Check if plan is public
      if (!floorPlan.isPublic) {
        return res.status(403).json({
          success: false,
          error: 'This floor plan is not publicly available'
        });
      }
      
      res.json({
        success: true,
        data: floorPlan
      });
    } catch (error) {
      console.error('❌ Get public floor plan error:', error);
      res.status(404).json({
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
        isPublic: req.body.isPublic || false,
        createdBy: req.user.id,
        updatedBy: req.user.id
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

  // Get all floor plans
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

      const { page = 1, limit = 100, search, floor, isPublic } = req.query;

      const filters = {
        search,
        floor,
        isPublic: isPublic !== undefined ? isPublic === 'true' : undefined
      };

      const result = await floorPlanService.getAllFloorPlans(
        filters,
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
        updatedAt: new Date(),
        updatedBy: req.user.id
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
async uploadImage(req, res) {
    try {
      if (!req.file) {
        throw new Error('No file uploaded');
      }
      
      console.log('📤 Uploading file...');
      
      // Check if CloudinaryService exists
      let cloudinaryResult;
      try {
        const CloudinaryService = require('../services/CloudinaryService');
        cloudinaryResult = await CloudinaryService.uploadImage(req.file.buffer, {
          folder: 'floor-plans',
          transformation: [
            { width: 1920, height: 1080, crop: 'limit' },
            { quality: 'auto:good' }
          ]
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
      } catch (cloudinaryError) {
        console.warn('⚠️ Cloudinary not available, using local storage');
        
        // Fallback: Save to local storage
        const fs = require('fs');
        const path = require('path');
        const crypto = require('crypto');
        
        const uploadsDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const filename = `floor-plan-${crypto.randomBytes(8).toString('hex')}-${Date.now()}${path.extname(req.file.originalname)}`;
        const filePath = path.join(uploadsDir, filename);
        
        fs.writeFileSync(filePath, req.file.buffer);
        
        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
        const fileUrl = `${baseUrl}/uploads/${filename}`;
        
        res.json({
          success: true,
          data: {
            url: fileUrl,
            thumbnail: fileUrl,
            publicId: filename
          },
          message: 'Image uploaded to local storage'
        });
      }
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

  // Update booth details
  async updateBoothDetails(req, res) {
    try {
      const { floorPlanId, shapeId } = req.params;
      const boothData = req.body;
      
      // Check permissions
      const floorPlan = await floorPlanService.getFloorPlanById(floorPlanId);
      if (floorPlan.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      const updatedFloorPlan = await floorPlanService.updateBoothDetails(
        floorPlanId,
        shapeId,
        boothData,
        req.user.id
      );
      
      res.json({
        success: true,
        data: updatedFloorPlan,
        message: 'Booth details updated successfully'
      });
    } catch (error) {
      console.error('❌ Update booth details error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get booths by floor plan
  async getBoothsByFloorPlan(req, res) {
    try {
      const { floorPlanId } = req.params;
      const { status, category } = req.query;
      
      const floorPlan = await floorPlanService.getFloorPlanById(floorPlanId);
      
      // Check permissions
      if (!floorPlan.isPublic && floorPlan.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      const booths = (floorPlan.shapes || []).filter(shape => shape.type === 'booth');
      
      // Apply filters
      let filteredBooths = booths;
      if (status) {
        filteredBooths = filteredBooths.filter(booth => booth.metadata?.status === status);
      }
      if (category) {
        filteredBooths = filteredBooths.filter(booth => booth.metadata?.category === category);
      }
      
      res.json({
        success: true,
        data: filteredBooths,
        total: filteredBooths.length,
        statistics: {
          total: booths.length,
          available: booths.filter(b => b.metadata?.status === 'available').length,
          booked: booths.filter(b => b.metadata?.status === 'booked').length,
          reserved: booths.filter(b => b.metadata?.status === 'reserved').length,
          maintenance: booths.filter(b => b.metadata?.status === 'maintenance').length
        }
      });
    } catch (error) {
      console.error('❌ Get booths error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Add booth to floor plan
  async addBoothToFloorPlan(req, res) {
    try {
      const { floorPlanId } = req.params;
      const boothData = req.body;
      
      // Check permissions
      const floorPlan = await floorPlanService.getFloorPlanById(floorPlanId);
      if (floorPlan.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      const updatedFloorPlan = await floorPlanService.addBoothToFloorPlan(
        floorPlanId,
        boothData,
        req.user.id
      );
      
      res.json({
        success: true,
        data: updatedFloorPlan,
        message: 'Booth added successfully'
      });
    } catch (error) {
      console.error('❌ Add booth error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Remove booth from floor plan
  async removeBoothFromFloorPlan(req, res) {
    try {
      const { floorPlanId, shapeId } = req.params;
      
      // Check permissions
      const floorPlan = await floorPlanService.getFloorPlanById(floorPlanId);
      if (floorPlan.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      const updatedFloorPlan = await floorPlanService.removeBoothFromFloorPlan(
        floorPlanId,
        shapeId,
        req.user.id
      );
      
      res.json({
        success: true,
        data: updatedFloorPlan,
        message: 'Booth removed successfully'
      });
    } catch (error) {
      console.error('❌ Remove booth error:', error);
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
      
      // Check permissions
      const existing = await floorPlanService.getFloorPlanById(req.params.id);
      if (existing.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      const updateData = {
        shapes,
        updatedAt: new Date(),
        updatedBy: req.user.id
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
        isPublic: false,
        createdBy: req.user.id,
        updatedBy: req.user.id
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
        // Generate PDF (you would implement this with a PDF library)
        const pdfBuffer = await floorPlanService.generatePDF(floorPlan);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${floorPlan.name}.pdf"`);
        res.send(pdfBuffer);
      } else if (format === 'png') {
        // Generate PNG
        const pngBuffer = await floorPlanService.generatePNG(floorPlan);
        
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="${floorPlan.name}.png"`);
        res.send(pngBuffer);
      } else {
        res.status(400).json({
          success: false,
          error: 'Unsupported format. Use: json, pdf, or png'
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

  // ======================
  // EXHIBITOR ENDPOINTS
  // ======================

  // Get floor plans visible to exhibitor
  async getExhibitorVisibleFloorPlans(req, res) {
    try {
      const { page = 1, limit = 100 } = req.query;
      
      // Get exhibitor's assigned booth number
      const exhibitorData = await ExhibitorService.getExhibitorById(req.user.id);
      
      const filters = {
        isPublic: true
      };
      
      const result = await floorPlanService.getAllFloorPlans(
        filters,
        Number(page),
        Number(limit),
        exhibitorData
      );

      return res.json({
        success: true,
        data: result.floorPlans,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          pages: result.totalPages
        },
        exhibitor: {
          boothNumber: exhibitorData.boothNumber,
          companyName: exhibitorData.company
        }
      });
    } catch (error) {
      console.error('❌ Error fetching exhibitor floor plans:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to fetch floor plans'
      });
    }
  }

  // Get floor plan for exhibitor (with booth highlighting)
  async getFloorPlanForExhibitor(req, res) {
    try {
      const floorPlan = await floorPlanService.getFloorPlanById(req.params.id);
      
      // Check if plan is public
      if (!floorPlan.isPublic) {
        return res.status(403).json({
          success: false,
          error: 'This floor plan is not publicly available'
        });
      }
      
      // Get exhibitor data
      const exhibitorData = await ExhibitorService.getExhibitorById(req.user.id);
      
      // Process shapes to highlight exhibitor's booth
      const processedShapes = await floorPlanService.processShapesForExhibitor(
        floorPlan.shapes,
        exhibitorData
      );
      
      // Find exhibitor's booth
      const exhibitorBooth = processedShapes.find(shape => 
        shape.metadata?.isUserBooth
      );
      
      res.json({
        success: true,
        data: {
          ...floorPlan,
          shapes: processedShapes
        },
        exhibitorBooth: exhibitorBooth || null,
        message: exhibitorBooth ? 'Your booth has been highlighted' : 'No assigned booth found'
      });
    } catch (error) {
      console.error('❌ Get exhibitor view error:', error);
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get exhibitor's booth details
  async getExhibitorBoothDetails(req, res) {
    try {
      const exhibitorData = await ExhibitorService.getExhibitorById(req.user.id);
      
      if (!exhibitorData.boothNumber) {
        return res.status(404).json({
          success: false,
          error: 'No booth assigned to exhibitor'
        });
      }
      
      // Find floor plan with exhibitor's booth
      const boothInfo = await floorPlanService.findBoothByNumber(
        exhibitorData.boothNumber,
        req.user.id
      );
      
      if (!boothInfo) {
        return res.status(404).json({
          success: false,
          error: 'Booth not found in any floor plan'
        });
      }
      
      res.json({
        success: true,
        data: {
          booth: boothInfo.booth,
          floorPlan: boothInfo.floorPlan,
          exhibitor: exhibitorData
        }
      });
    } catch (error) {
      console.error('❌ Get exhibitor booth error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get exhibitor statistics
  async getExhibitorStatistics(req, res) {
    try {
      const exhibitorData = await ExhibitorService.getExhibitorById(req.user.id);
      
      const statistics = await floorPlanService.getExhibitorStatistics(
        exhibitorData,
        req.user.id
      );
      
      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('❌ Exhibitor statistics error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Find booth by number
  async findBoothByNumber(req, res) {
    try {
      const { boothNumber } = req.params;
      
      const boothInfo = await floorPlanService.findBoothByNumber(
        boothNumber,
        req.user.id
      );
      
      if (!boothInfo) {
        return res.status(404).json({
          success: false,
          error: 'Booth not found'
        });
      }
      
      res.json({
        success: true,
        data: boothInfo
      });
    } catch (error) {
      console.error('❌ Find booth error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get neighboring booths
  async getNeighboringBooths(req, res) {
    try {
      const { id: floorPlanId } = req.params;
      
      // Get exhibitor data
      const exhibitorData = await ExhibitorService.getExhibitorById(req.user.id);
      
      if (!exhibitorData.boothNumber) {
        return res.status(404).json({
          success: false,
          error: 'No booth assigned to exhibitor'
        });
      }
      
      const neighbors = await floorPlanService.getNeighboringBooths(
        floorPlanId,
        exhibitorData.boothNumber,
        req.user.id
      );
      
      res.json({
        success: true,
        data: neighbors
      });
    } catch (error) {
      console.error('❌ Get neighbors error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Download floor plan for exhibitor
  async downloadFloorPlanForExhibitor(req, res) {
    try {
      const { id } = req.params;
      
      const floorPlan = await floorPlanService.getFloorPlanById(id);
      
      // Check if plan is public
      if (!floorPlan.isPublic) {
        return res.status(403).json({
          success: false,
          error: 'This floor plan is not publicly available'
        });
      }
      
      // Get exhibitor data
      const exhibitorData = await ExhibitorService.getExhibitorById(req.user.id);
      
      // Generate annotated floor plan
      const annotatedPlan = await floorPlanService.generateAnnotatedFloorPlan(
        floorPlan,
        exhibitorData
      );
      
      // Return as downloadable file
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${floorPlan.name}-${exhibitorData.boothNumber}.pdf"`);
      res.send(annotatedPlan);
      
    } catch (error) {
      console.error('❌ Download error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // ======================
  // ADDITIONAL METHODS
  // ======================

  // Bulk update floor plans
  async bulkUpdateFloorPlans(req, res) {
    try {
      const { updates } = req.body;
      
      if (!Array.isArray(updates)) {
        return res.status(400).json({
          success: false,
          error: 'Updates must be an array'
        });
      }
      
      const results = await floorPlanService.bulkUpdateFloorPlans(
        updates,
        req.user.id
      );
      
      res.json({
        success: true,
        data: results,
        message: `Updated ${results.length} floor plans`
      });
    } catch (error) {
      console.error('❌ Bulk update error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Import floor plans
  async importFloorPlans(req, res) {
    try {
      const { floorPlans } = req.body;
      
      if (!Array.isArray(floorPlans)) {
        return res.status(400).json({
          success: false,
          error: 'Floor plans must be an array'
        });
      }
      
      const importedPlans = await floorPlanService.importFloorPlans(
        floorPlans,
        req.user.id
      );
      
      res.status(201).json({
        success: true,
        data: importedPlans,
        message: `Imported ${importedPlans.length} floor plans`
      });
    } catch (error) {
      console.error('❌ Import error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Import shapes to existing floor plan
  async importShapes(req, res) {
    try {
      const { id } = req.params;
      const { shapes } = req.body;
      
      // Check permissions
      const existing = await floorPlanService.getFloorPlanById(id);
      if (existing.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      if (!Array.isArray(shapes)) {
        return res.status(400).json({
          success: false,
          error: 'Shapes must be an array'
        });
      }
      
      const updatedFloorPlan = await floorPlanService.importShapes(
        id,
        shapes,
        req.user.id
      );
      
      res.json({
        success: true,
        data: updatedFloorPlan,
        message: `Imported ${shapes.length} shapes`
      });
    } catch (error) {
      console.error('❌ Import shapes error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Restore floor plan
  async restoreFloorPlan(req, res) {
    try {
      const { id } = req.params;
      
      // Check permissions
      const existing = await floorPlanService.getFloorPlanById(id);
      if (existing.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      const restoredPlan = await floorPlanService.restoreFloorPlan(id, req.user.id);
      
      res.json({
        success: true,
        data: restoredPlan,
        message: 'Floor plan restored successfully'
      });
    } catch (error) {
      console.error('❌ Restore error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Publish floor plan
  async publishFloorPlan(req, res) {
    try {
      const { id } = req.params;
      
      // Check permissions
      const existing = await floorPlanService.getFloorPlanById(id);
      if (existing.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      const publishedPlan = await floorPlanService.updateFloorPlan(
        id,
        { isPublic: true, updatedAt: new Date(), updatedBy: req.user.id },
        req.user.id
      );
      
      res.json({
        success: true,
        data: publishedPlan,
        message: 'Floor plan published successfully'
      });
    } catch (error) {
      console.error('❌ Publish error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Unpublish floor plan
  async unpublishFloorPlan(req, res) {
    try {
      const { id } = req.params;
      
      // Check permissions
      const existing = await floorPlanService.getFloorPlanById(id);
      if (existing.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      const unpublishedPlan = await floorPlanService.updateFloorPlan(
        id,
        { isPublic: false, updatedAt: new Date(), updatedBy: req.user.id },
        req.user.id
      );
      
      res.json({
        success: true,
        data: unpublishedPlan,
        message: 'Floor plan unpublished successfully'
      });
    } catch (error) {
      console.error('❌ Unpublish error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Search floor plans by name
  async searchFloorPlansByName(req, res) {
    try {
      const { query } = req.query;
      
      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
      }
      
      const results = await floorPlanService.searchFloorPlansByName(
        query,
        req.user.id,
        req.user.role
      );
      
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('❌ Search error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Search floor plans by tags
  async searchFloorPlansByTags(req, res) {
    try {
      const { tags } = req.query;
      
      if (!tags) {
        return res.status(400).json({
          success: false,
          error: 'Tags are required'
        });
      }
      
      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      
      const results = await floorPlanService.searchFloorPlansByTags(
        tagArray,
        req.user.id,
        req.user.role
      );
      
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('❌ Search by tags error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Filter floor plans by booth status
  async filterFloorPlansByBoothStatus(req, res) {
    try {
      const { status } = req.query;
      
      if (!status) {
        return res.status(400).json({
          success: false,
          error: 'Status is required'
        });
      }
      
      const results = await floorPlanService.filterFloorPlansByBoothStatus(
        status,
        req.user.id,
        req.user.role
      );
      
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('❌ Filter by status error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get floor plan metadata
  async getFloorPlanMetadata(req, res) {
    try {
      const floorPlan = await floorPlanService.getFloorPlanById(req.params.id);
      
      // Check permissions
      if (!floorPlan.isPublic && floorPlan.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      // Extract metadata only
      const metadata = {
        id: floorPlan.id,
        name: floorPlan.name,
        description: floorPlan.description,
        image: floorPlan.image,
        thumbnail: floorPlan.thumbnail,
        scale: floorPlan.scale,
        isPublic: floorPlan.isPublic,
        createdAt: floorPlan.createdAt,
        updatedAt: floorPlan.updatedAt,
        statistics: {
          totalShapes: floorPlan.shapes?.length || 0,
          totalBooths: floorPlan.shapes?.filter(s => s.type === 'booth').length || 0,
          availableBooths: floorPlan.shapes?.filter(s => s.type === 'booth' && s.metadata?.status === 'available').length || 0
        }
      };
      
      res.json({
        success: true,
        data: metadata
      });
    } catch (error) {
      console.error('❌ Get metadata error:', error);
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get floor plan versions/history
  async getFloorPlanVersions(req, res) {
    try {
      const versions = await floorPlanService.getFloorPlanVersions(
        req.params.id,
        req.user.id,
        req.user.role
      );
      
      res.json({
        success: true,
        data: versions
      });
    } catch (error) {
      console.error('❌ Get versions error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Share floor plan via link
  async shareFloorPlan(req, res) {
    try {
      const { id } = req.params;
      const { expiresIn = '7d' } = req.body;
      
      // Check permissions
      const existing = await floorPlanService.getFloorPlanById(id);
      if (existing.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      const shareLink = await floorPlanService.generateShareLink(
        id,
        expiresIn,
        req.user.id
      );
      
      res.json({
        success: true,
        data: {
          shareLink,
          expiresAt: shareLink.expiresAt
        },
        message: 'Share link generated successfully'
      });
    } catch (error) {
      console.error('❌ Share error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get shared floor plan
  async getSharedFloorPlan(req, res) {
    try {
      const { shareToken } = req.params;
      
      const sharedPlan = await floorPlanService.getSharedFloorPlan(shareToken);
      
      if (!sharedPlan) {
        return res.status(404).json({
          success: false,
          error: 'Share link expired or invalid'
        });
      }
      
      res.json({
        success: true,
        data: sharedPlan
      });
    } catch (error) {
      console.error('❌ Get shared plan error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Handle booth status webhook
  async handleBoothStatusWebhook(req, res) {
    try {
      const { event, data } = req.body;
      
      if (event === 'booth_status_changed') {
        await floorPlanService.handleBoothStatusChange(data);
      } else if (event === 'exhibitor_assigned') {
        await floorPlanService.handleExhibitorAssignment(data);
      }
      
      res.json({
        success: true,
        message: 'Webhook processed successfully'
      });
    } catch (error) {
      console.error('❌ Webhook error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Handle exhibitor registered webhook
  async handleExhibitorRegisteredWebhook(req, res) {
    try {
      const { exhibitor, boothNumber } = req.body;
      
      await floorPlanService.assignBoothToExhibitor(exhibitor, boothNumber);
      
      res.json({
        success: true,
        message: 'Exhibitor assigned to booth successfully'
      });
    } catch (error) {
      console.error('❌ Exhibitor webhook error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Sync exhibitors with floor plans
  async syncExhibitorsWithFloorPlans(req, res) {
    try {
      const results = await floorPlanService.syncExhibitorsWithFloorPlans();
      
      res.json({
        success: true,
        data: results,
        message: 'Exhibitors synced with floor plans successfully'
      });
    } catch (error) {
      console.error('❌ Sync error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Validate floor plan data
  async validateFloorPlanData(req, res) {
    try {
      const validation = await floorPlanService.validateFloorPlanData(req.body);
      
      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      console.error('❌ Validation error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Generate floor plan preview
  async generateFloorPlanPreview(req, res) {
    try {
      const { floorPlan } = req.body;
      
      const preview = await floorPlanService.generateFloorPlanPreview(floorPlan);
      
      res.json({
        success: true,
        data: preview
      });
    } catch (error) {
      console.error('❌ Preview generation error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Cleanup orphaned shapes
  async cleanupOrphanedShapes(req, res) {
    try {
      const results = await floorPlanService.cleanupOrphanedShapes();
      
      res.json({
        success: true,
        data: results,
        message: 'Cleanup completed successfully'
      });
    } catch (error) {
      console.error('❌ Cleanup error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Backup floor plans
  async backupFloorPlans(req, res) {
    try {
      const backup = await floorPlanService.backupFloorPlans();
      
      res.json({
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          totalPlans: backup.totalPlans,
          backupId: backup.backupId
        },
        message: 'Backup created successfully'
      });
    } catch (error) {
      console.error('❌ Backup error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Restore from backup
  async restoreFromBackup(req, res) {
    try {
      const { backupId } = req.body;
      
      const results = await floorPlanService.restoreFromBackup(backupId);
      
      res.json({
        success: true,
        data: results,
        message: 'Restore completed successfully'
      });
    } catch (error) {
      console.error('❌ Restore error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get floor plan by exhibitor ID
  async getFloorPlanByExhibitorId(req, res) {
    try {
      const { exhibitorId } = req.params;
      
      // Verify permissions
      if (req.user.role !== 'admin' && req.user.id.toString() !== exhibitorId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      const floorPlan = await floorPlanService.getFloorPlanByExhibitorId(exhibitorId);
      
      if (!floorPlan) {
        return res.status(404).json({
          success: false,
          error: 'No floor plan found for this exhibitor'
        });
      }
      
      res.json({
        success: true,
        data: floorPlan
      });
    } catch (error) {
      console.error('❌ Get by exhibitor error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get all booths with exhibitor info
  async getAllBoothsWithExhibitors(req, res) {
    try {
      const { floorPlanId } = req.params;
      
      const floorPlan = await floorPlanService.getFloorPlanById(floorPlanId);
      
      // Check permissions
      if (!floorPlan.isPublic && floorPlan.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      const booths = (floorPlan.shapes || []).filter(shape => shape.type === 'booth');
      
      // Get exhibitor info for each booth
      const boothsWithExhibitors = await Promise.all(
        booths.map(async (booth) => {
          let exhibitorInfo = null;
          if (booth.metadata?.boothNumber) {
            exhibitorInfo = await ExhibitorService.getExhibitorByBoothNumber(
              booth.metadata.boothNumber
            );
          }
          
          return {
            ...booth,
            exhibitor: exhibitorInfo ? {
              id: exhibitorInfo.id,
              name: exhibitorInfo.name,
              company: exhibitorInfo.company,
              email: exhibitorInfo.email,
              phone: exhibitorInfo.phone
            } : null
          };
        })
      );
      
      res.json({
        success: true,
        data: boothsWithExhibitors,
        total: boothsWithExhibitors.length
      });
    } catch (error) {
      console.error('❌ Get booths with exhibitors error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Update multiple booths status
  async updateMultipleBoothsStatus(req, res) {
    try {
      const { floorPlanId } = req.params;
      const { updates } = req.body;
      
      // Check permissions
      const floorPlan = await floorPlanService.getFloorPlanById(floorPlanId);
      if (floorPlan.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      if (!Array.isArray(updates)) {
        return res.status(400).json({
          success: false,
          error: 'Updates must be an array'
        });
      }
      
      const results = await floorPlanService.updateMultipleBoothsStatus(
        floorPlanId,
        updates,
        req.user.id
      );
      
      res.json({
        success: true,
        data: results,
        message: `Updated ${results.length} booths`
      });
    } catch (error) {
      console.error('❌ Update multiple booths error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get floor plan analytics
  async getFloorPlanAnalytics(req, res) {
    try {
      const { id } = req.params;
      
      const floorPlan = await floorPlanService.getFloorPlanById(id);
      
      // Check permissions
      if (!floorPlan.isPublic && floorPlan.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      const analytics = await floorPlanService.getFloorPlanAnalytics(id);
      
      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('❌ Analytics error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Generate booth assignment report
  async generateBoothAssignmentReport(req, res) {
    try {
      const { id } = req.params;
      const { format = 'pdf' } = req.query;
      
      const floorPlan = await floorPlanService.getFloorPlanById(id);
      
      // Check permissions
      if (!floorPlan.isPublic && floorPlan.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      const report = await floorPlanService.generateBoothAssignmentReport(floorPlan, format);
      
      if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="booth-assignment-report-${id}.pdf"`);
        res.send(report);
      } else {
        res.json({
          success: true,
          data: report
        });
      }
    } catch (error) {
      console.error('❌ Report generation error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get floor plan occupancy heatmap
  async getOccupancyHeatmap(req, res) {
    try {
      const { id } = req.params;
      
      const floorPlan = await floorPlanService.getFloorPlanById(id);
      
      // Check permissions
      if (!floorPlan.isPublic && floorPlan.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      const heatmap = await floorPlanService.generateOccupancyHeatmap(floorPlan);
      
      res.json({
        success: true,
        data: heatmap
      });
    } catch (error) {
      console.error('❌ Heatmap error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  async getMasterFloorPlan(req, res) {
    try {
      console.log('📋 Getting master floor plan...');
      
      // Find the master floor plan
      const masterPlan = await floorPlanService.getMasterFloorPlan();
      
      res.json({
        success: true,
        data: masterPlan,
        message: masterPlan ? 'Master floor plan loaded' : 'No master floor plan found'
      });
    } catch (error) {
      console.error('❌ Get master plan error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to load master floor plan'
      });
    }
  }
// src/controllers/FloorPlanController.js
// Add these methods to your existing controller:

// Get master floor plan
async getMasterFloorPlan(req, res) {
  try {
    console.log('📋 Getting master floor plan...');
    
    // Find plan marked as master or the first public plan
    const masterPlan = await floorPlanService.getMasterFloorPlan();
    
    if (!masterPlan) {
      // Return empty response if no master plan exists
      return res.json({
        success: true,
        data: null,
        message: 'No master floor plan found'
      });
    }
    
    res.json({
      success: true,
      data: masterPlan
    });
  } catch (error) {
    console.error('❌ Get master plan error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

async createOrUpdateMasterFloorPlan(req, res) {
    try {
      console.log('📝 Creating/updating master floor plan for user:', req.user.id);
      
      const floorPlanData = {
        ...req.body,
        isMaster: true,
        isPublic: true,
        updatedBy: req.user.id
      };
      
      // If creating new, set createdBy
      if (!req.body.id) {
        floorPlanData.createdBy = req.user.id;
      }
      
      const floorPlan = await floorPlanService.createOrUpdateMasterFloorPlan(floorPlanData, req.user.id);
      
      res.json({
        success: true,
        data: floorPlan,
        message: 'Master floor plan saved successfully'
      });
    } catch (error) {
      console.error('❌ Create/update master plan error:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

 async getFloorPlanForExhibitor(req, res) {
    try {
      console.log('👤 Getting floor plan for exhibitor:', req.user.id);
      
      // Get master floor plan
      const masterPlan = await floorPlanService.getMasterFloorPlan();
      
      if (!masterPlan) {
        return res.json({
          success: true,
          data: null,
          message: 'No floor plan available yet'
        });
      }
      
      // Get exhibitor data (simplified - adjust based on your ExhibitorService)
      let exhibitorData = {
        id: req.user.id,
        name: req.user.name || 'Exhibitor',
        company: req.user.company || 'Unknown Company',
        email: req.user.email,
        phone: req.user.phone || '',
        boothNumber: req.user.boothNumber || null
      };
      
      // Try to get from ExhibitorService if available
      try {
        const ExhibitorService = require('../services/ExhibitorService');
        const exhibitorServiceData = await ExhibitorService.getExhibitorById(req.user.id);
        exhibitorData = { ...exhibitorData, ...exhibitorServiceData };
      } catch (error) {
        console.log('ℹ️ Using simplified exhibitor data');
      }
      
      // Process shapes to highlight exhibitor's booth
      const processedShapes = await floorPlanService.processShapesForExhibitor(
        masterPlan.shapes || [],
        exhibitorData
      );
      
      // Find exhibitor's booth
      const exhibitorBooth = processedShapes.find(shape => 
        shape.metadata?.isUserBooth
      );
      
      res.json({
        success: true,
        data: {
          ...masterPlan,
          shapes: processedShapes
        },
        exhibitorBooth: exhibitorBooth || null,
        exhibitor: exhibitorData,
        message: exhibitorBooth ? 'Your booth has been highlighted' : 'No assigned booth found'
      });
    } catch (error) {
      console.error('❌ Get exhibitor view error:', error);
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }
  // Export floor plan as template
  async exportAsTemplate(req, res) {
    try {
      const { id } = req.params;
      
      const floorPlan = await floorPlanService.getFloorPlanById(id);
      
      // Check permissions
      if (floorPlan.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      const template = await floorPlanService.exportAsTemplate(floorPlan);
      
      res.json({
        success: true,
        data: template,
        message: 'Floor plan exported as template successfully'
      });
    } catch (error) {
      console.error('❌ Export template error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  

  // Clone floor plan structure
  async cloneFloorPlanStructure(req, res) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      
      const floorPlan = await floorPlanService.getFloorPlanById(id);
      
      // Check permissions
      if (!floorPlan.isPublic && floorPlan.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      const clonedPlan = await floorPlanService.cloneFloorPlanStructure(
        floorPlan,
        name,
        description,
        req.user.id
      );
      
      res.status(201).json({
        success: true,
        data: clonedPlan,
        message: 'Floor plan structure cloned successfully'
      });
    } catch (error) {
      console.error('❌ Clone structure error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new FloorPlanController();