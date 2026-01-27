// src/services/FloorPlanService.js
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const CloudinaryService = require('./CloudinaryService');

class FloorPlanService {
  constructor() {
    this._floorPlanModel = null;
  }

  // Get MySQL/Sequelize model
  get FloorPlan() {
    if (!this._floorPlanModel) {
      try {
        const modelFactory = require('../models');
        this._floorPlanModel = modelFactory.getModel('FloorPlan');
        console.log('✅ MySQL FloorPlan model loaded');
      } catch (error) {
        console.warn('⚠️ MySQL FloorPlan model not found');
        this._floorPlanModel = null;
      }
    }
    return this._floorPlanModel;
  }

  // Prepare floor plan data
  async prepareFloorPlanData(data) {
    const sanitized = { ...data };
    
    // Handle image upload to Cloudinary if it's base64
    if (sanitized.image && sanitized.image.startsWith('data:image')) {
      console.log('📤 Uploading image to Cloudinary...');
      try {
        const cloudinaryResult = await CloudinaryService.uploadImage(sanitized.image, {
          folder: 'floor-plans'
        });
        
        // Store Cloudinary URL and public ID
        sanitized.image = cloudinaryResult.url;
        sanitized.imagePublicId = cloudinaryResult.publicId;
        
        // Generate and store thumbnail
        sanitized.thumbnail = CloudinaryService.generateThumbnailUrl(cloudinaryResult.publicId);
        
        console.log('✅ Image uploaded to Cloudinary:', cloudinaryResult.publicId);
      } catch (error) {
        console.error('❌ Cloudinary upload failed:', error.message);
        // If Cloudinary fails, keep the base64 but truncate it
        if (sanitized.image.length > 50000) {
          sanitized.thumbnail = sanitized.image.substring(0, 10000) + '...[truncated]';
          sanitized.image = null;
        }
      }
    }
    
    // Ensure shapes is properly formatted
    if (sanitized.shapes) {
      if (!Array.isArray(sanitized.shapes)) {
        try {
          sanitized.shapes = JSON.parse(sanitized.shapes);
        } catch {
          sanitized.shapes = [];
        }
      }
      
      // Process shapes - ensure each has booth status if applicable
      sanitized.shapes = sanitized.shapes.map(shape => ({
        id: shape.id || uuidv4(),
        ...shape,
        x: Number(shape.x) || 0,
        y: Number(shape.y) || 0,
        width: Number(shape.width) || 50,
        height: Number(shape.height) || 50,
        rotation: Number(shape.rotation) || 0,
        borderWidth: Number(shape.borderWidth) || 2,
        fontSize: Number(shape.fontSize) || 12,
        zIndex: Number(shape.zIndex) || 0,
        // Ensure booth metadata
        metadata: shape.type === 'booth' ? {
          boothNumber: shape.metadata?.boothNumber || '1',
          companyName: shape.metadata?.companyName || '',
          status: shape.metadata?.status || 'available',
          category: shape.metadata?.category || 'General',
          contactPerson: shape.metadata?.contactPerson || '',
          phone: shape.metadata?.phone || '',
          ...shape.metadata
        } : shape.metadata
      }));
    } else {
      sanitized.shapes = [];
    }
    
    // Ensure tags is array
    if (sanitized.tags) {
      if (!Array.isArray(sanitized.tags)) {
        try {
          sanitized.tags = JSON.parse(sanitized.tags);
        } catch {
          sanitized.tags = typeof sanitized.tags === 'string' ? [sanitized.tags] : [];
        }
      }
    } else {
      sanitized.tags = ['exhibition', 'floor-plan'];
    }
    
    // Set defaults
    sanitized.version = sanitized.version || '1.0';
    sanitized.scale = Number(sanitized.scale) || 0.1;
    sanitized.gridSize = Number(sanitized.gridSize) || 20;
    sanitized.showGrid = sanitized.showGrid !== undefined ? Boolean(sanitized.showGrid) : true;
    sanitized.isPublic = Boolean(sanitized.isPublic) || false;
    
    return sanitized;
  }

  // Create floor plan
  async createFloorPlan(floorPlanData, userId) {
    try {
      console.log('📝 Creating floor plan:', floorPlanData.name);
      
      const model = this.FloorPlan;
      if (!model) {
        throw new Error('FloorPlan model not available');
      }
      
      const preparedData = await this.prepareFloorPlanData(floorPlanData);
      
      // Add user info
      preparedData.createdBy = userId;
      preparedData.updatedBy = userId;
      
      const floorPlan = await model.create(preparedData);
      console.log('✅ Floor plan created:', floorPlan.id);
      
      return floorPlan;
    } catch (error) {
      console.error('❌ Create floor plan error:', error.message);
      console.error('Error stack:', error.stack);
      throw new Error(`Failed to create floor plan: ${error.message}`);
    }
  }

  // Get all floor plans
  async getAllFloorPlans(filters = {}, page = 1, limit = 20) {
    try {
      const model = this.FloorPlan;
      if (!model) {
        throw new Error('FloorPlan model not available');
      }
      
      const offset = (page - 1) * limit;
      
      console.log('📋 Fetching floor plans with filters:', filters);
      
      let where = {};
      
      // Search filter
      if (filters.search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${filters.search}%` } },
          { description: { [Op.like]: `%${filters.search}%` } }
        ];
      }
      
      // Floor filter
      if (filters.floor) {
        where.floor = filters.floor;
      }
      
      // User filter
      if (filters.createdBy) {
        where.createdBy = filters.createdBy;
      }
      
      // Public/private filter
      if (filters.isPublic !== undefined) {
        where.isPublic = filters.isPublic;
      }

      const result = await model.findAndCountAll({
        where,
        limit,
        offset,
        order: [['created_at', 'DESC']],
        attributes: { 
          exclude: ['shapes'] // Exclude large fields for list view
        }
      });
      
      return {
        floorPlans: result.rows,
        total: result.count,
        page,
        totalPages: Math.ceil(result.count / limit),
        limit
      };
    } catch (error) {
      console.error('❌ Get all floor plans error:', error.message);
      throw new Error(`Failed to fetch floor plans: ${error.message}`);
    }
  }

  // Get single floor plan by ID
  async getFloorPlanById(id) {
    try {
      const model = this.FloorPlan;
      if (!model) {
        throw new Error('FloorPlan model not available');
      }
      
      console.log('🔍 Getting floor plan:', id);
      
      const floorPlan = await model.findByPk(id);
      
      if (!floorPlan) {
        throw new Error('Floor plan not found');
      }
      
      return floorPlan.get({ plain: true });
    } catch (error) {
      console.error('❌ Get floor plan error:', error.message);
      throw new Error(`Failed to get floor plan: ${error.message}`);
    }
  }

  // Update floor plan
  async updateFloorPlan(id, updateData, userId) {
    try {
      const model = this.FloorPlan;
      if (!model) {
        throw new Error('FloorPlan model not available');
      }
      
      console.log('✏️ Updating floor plan:', id);
      
      const floorPlan = await model.findByPk(id);
      if (!floorPlan) {
        throw new Error('Floor plan not found');
      }
      
      // Handle image separately if it's being updated
      let imagePublicId = floorPlan.imagePublicId;
      
      if (updateData.image && updateData.image.startsWith('data:image')) {
        try {
          // Delete old image from Cloudinary if exists
          if (imagePublicId) {
            await CloudinaryService.deleteImage(imagePublicId);
          }
          
          // Upload new image
          const cloudinaryResult = await CloudinaryService.uploadImage(updateData.image, {
            folder: 'floor-plans'
          });
          
          updateData.image = cloudinaryResult.url;
          updateData.imagePublicId = cloudinaryResult.publicId;
          updateData.thumbnail = CloudinaryService.generateThumbnailUrl(cloudinaryResult.publicId);
          
        } catch (error) {
          console.error('❌ Cloudinary upload failed:', error.message);
          delete updateData.image; // Remove image if upload fails
        }
      }
      
      const preparedData = await this.prepareFloorPlanData(updateData);
      preparedData.updatedBy = userId;
      preparedData.updatedAt = new Date();
      
      await floorPlan.update(preparedData);
      
      return floorPlan.get({ plain: true });
    } catch (error) {
      console.error('❌ Update floor plan error:', error.message);
      throw new Error(`Failed to update floor plan: ${error.message}`);
    }
  }

  // Delete floor plan
  async deleteFloorPlan(id) {
    try {
      const model = this.FloorPlan;
      if (!model) {
        throw new Error('FloorPlan model not available');
      }
      
      console.log('🗑️ Deleting floor plan:', id);
      
      // Get floor plan to delete image from Cloudinary
      const floorPlan = await model.findByPk(id);
      if (!floorPlan) {
        throw new Error('Floor plan not found');
      }
      
      // Delete image from Cloudinary if exists
      if (floorPlan.imagePublicId) {
        try {
          await CloudinaryService.deleteImage(floorPlan.imagePublicId);
        } catch (error) {
          console.warn('⚠️ Failed to delete Cloudinary image:', error.message);
        }
      }
      
      // Delete from database
      const result = await model.destroy({
        where: { id }
      });
      
      if (result === 0) {
        throw new Error('Floor plan not found');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Delete floor plan error:', error.message);
      throw new Error(`Failed to delete floor plan: ${error.message}`);
    }
  }

  // Get floor plan statistics
  async getStatistics(userId, role) {
    try {
      const model = this.FloorPlan;
      if (!model) {
        throw new Error('FloorPlan model not available');
      }
      
      const where = {};
      if (role !== 'admin') {
        where.createdBy = userId;
      }
      
      const total = await model.count({ where });
      const publicCount = await model.count({ where: { ...where, isPublic: true } });
      const withImages = await model.count({ where: { ...where, image: { [Op.ne]: null } } });
      
      // Get booth status counts from shapes
      const allPlans = await model.findAll({
        where,
        attributes: ['shapes']
      });
      
      let availableBooths = 0;
      let bookedBooths = 0;
      let reservedBooths = 0;
      let maintenanceBooths = 0;
      
      allPlans.forEach(plan => {
        const shapes = plan.shapes || [];
        shapes.forEach(shape => {
          if (shape.type === 'booth' && shape.metadata?.status) {
            switch (shape.metadata.status) {
              case 'available':
                availableBooths++;
                break;
              case 'booked':
                bookedBooths++;
                break;
              case 'reserved':
                reservedBooths++;
                break;
              case 'maintenance':
                maintenanceBooths++;
                break;
            }
          }
        });
      });
      
      return {
        total,
        public: publicCount,
        withImages,
        private: total - publicCount,
        booths: {
          total: availableBooths + bookedBooths + reservedBooths + maintenanceBooths,
          available: availableBooths,
          booked: bookedBooths,
          reserved: reservedBooths,
          maintenance: maintenanceBooths
        }
      };
    } catch (error) {
      console.error('❌ Statistics error:', error.message);
      throw new Error(`Failed to get statistics: ${error.message}`);
    }
  }

  // Update booth status
  async updateBoothStatus(floorPlanId, shapeId, status, userId) {
    try {
      const model = this.FloorPlan;
      if (!model) {
        throw new Error('FloorPlan model not available');
      }
      
      const floorPlan = await model.findByPk(floorPlanId);
      if (!floorPlan) {
        throw new Error('Floor plan not found');
      }
      
      const shapes = floorPlan.shapes || [];
      const shapeIndex = shapes.findIndex(shape => shape.id === shapeId);
      
      if (shapeIndex === -1) {
        throw new Error('Shape not found');
      }
      
      if (shapes[shapeIndex].type !== 'booth') {
        throw new Error('Shape is not a booth');
      }
      
      // Update booth status
      shapes[shapeIndex] = {
        ...shapes[shapeIndex],
        metadata: {
          ...shapes[shapeIndex].metadata,
          status
        }
      };
      
      floorPlan.shapes = shapes;
      floorPlan.updatedBy = userId;
      floorPlan.updatedAt = new Date();
      
      await floorPlan.save();
      
      return floorPlan.get({ plain: true });
    } catch (error) {
      console.error('❌ Update booth status error:', error.message);
      throw new Error(`Failed to update booth status: ${error.message}`);
    }
  }

  // Get booth analytics
  async getBoothAnalytics(userId, role) {
    try {
      const model = this.FloorPlan;
      if (!model) {
        throw new Error('FloorPlan model not available');
      }
      
      const where = {};
      if (role !== 'admin') {
        where.createdBy = userId;
      }
      
      const allPlans = await model.findAll({
        where,
        attributes: ['id', 'name', 'shapes', 'updatedAt']
      });
      
      const analytics = {
        totalBooths: 0,
        byStatus: {
          available: 0,
          booked: 0,
          reserved: 0,
          maintenance: 0
        },
        byCategory: {},
        recentUpdates: []
      };
      
      allPlans.forEach(plan => {
        const shapes = plan.shapes || [];
        const planBooths = shapes.filter(shape => shape.type === 'booth');
        
        analytics.totalBooths += planBooths.length;
        
        planBooths.forEach(booth => {
          // Count by status
          const status = booth.metadata?.status || 'available';
          analytics.byStatus[status] = (analytics.byStatus[status] || 0) + 1;
          
          // Count by category
          const category = booth.metadata?.category || 'Uncategorized';
          analytics.byCategory[category] = (analytics.byCategory[category] || 0) + 1;
          
          // Track recent updates
          if (plan.updatedAt) {
            analytics.recentUpdates.push({
              planId: plan.id,
              planName: plan.name,
              boothId: booth.id,
              boothNumber: booth.metadata?.boothNumber,
              status: status,
              updatedAt: plan.updatedAt
            });
          }
        });
      });
      
      // Sort recent updates by date
      analytics.recentUpdates.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      analytics.recentUpdates = analytics.recentUpdates.slice(0, 10);
      
      return analytics;
    } catch (error) {
      console.error('❌ Booth analytics error:', error.message);
      throw new Error(`Failed to get booth analytics: ${error.message}`);
    }
  }
}

module.exports = new FloorPlanService();