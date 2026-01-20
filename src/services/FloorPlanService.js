// src/services/FloorPlanService.js
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

class FloorPlanService {
  constructor() {
    this._floorPlanModel = null;
  }

  // Lazy getter for FloorPlan model
  get FloorPlan() {
    if (!this._floorPlanModel) {
      const modelFactory = require('../models');
      this._floorPlanModel = modelFactory.getModel('FloorPlan');
    }
    return this._floorPlanModel;
  }

  async createFloorPlan(floorPlanData) {
    try {
      const floorPlan = await this.FloorPlan.create({
        ...floorPlanData,
        version: '1.0'
      });
      
      // Send audit log
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendAuditLog('FLOOR_PLAN_CREATED', floorPlanData.createdBy, {
          floorPlanId: floorPlan.id,
          name: floorPlan.name,
          floor: floorPlan.floor
        });
      } catch (kafkaError) {
        console.warn('Kafka not available for audit log:', kafkaError.message);
      }

      return floorPlan;
    } catch (error) {
      throw new Error(`Failed to create floor plan: ${error.message}`);
    }
  }

  async getAllFloorPlans(filters = {}, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      let query = {};
      
      if (filters.search) {
        if (process.env.DB_TYPE === 'mysql') {
          query[Op.or] = [
            { name: { [Op.like]: `%${filters.search}%` } },
            { description: { [Op.like]: `%${filters.search}%` } }
          ];
        } else {
          query.$or = [
            { name: { $regex: filters.search, $options: 'i' } },
            { description: { $regex: filters.search, $options: 'i' } }
          ];
        }
      }
      
      if (filters.floor && filters.floor !== 'all') {
        query.floor = filters.floor;
      }
      
      if (filters.createdBy) {
        query.createdBy = filters.createdBy;
      }

      let floorPlans, total;
      
      if (process.env.DB_TYPE === 'mysql') {
        const result = await this.FloorPlan.findAndCountAll({
          where: query,
          limit,
          offset,
          order: [['createdAt', 'DESC']]
        });
        
        floorPlans = result.rows;
        total = result.count;
      } else {
        floorPlans = await this.FloorPlan.find(query)
          .skip(offset)
          .limit(limit)
          .sort({ createdAt: -1 });
        
        total = await this.FloorPlan.countDocuments(query);
      }

      return {
        floorPlans,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      throw new Error(`Failed to fetch floor plans: ${error.message}`);
    }
  }

  async getFloorPlanById(id) {
    try {
      let floorPlan;
      
      if (process.env.DB_TYPE === 'mysql') {
        floorPlan = await this.FloorPlan.findByPk(id);
      } else {
        floorPlan = await this.FloorPlan.findById(id);
      }
      
      if (!floorPlan) {
        throw new Error('Floor plan not found');
      }
      
      return floorPlan;
    } catch (error) {
      throw new Error(`Failed to fetch floor plan: ${error.message}`);
    }
  }

  async updateFloorPlan(id, updateData) {
    try {
      let floorPlan;
      
      if (process.env.DB_TYPE === 'mysql') {
        floorPlan = await this.FloorPlan.findByPk(id);
        if (!floorPlan) throw new Error('Floor plan not found');
        
        // Increment version if shapes or layout is updated
        if (updateData.shapes || updateData.scale || updateData.gridSize) {
          const currentVersion = parseFloat(floorPlan.version) || 1.0;
          updateData.version = (currentVersion + 0.1).toFixed(1);
        }
        
        await floorPlan.update(updateData);
      } else {
        // Increment version if shapes are updated
        if (updateData.shapes || updateData.scale || updateData.gridSize) {
          const current = await this.FloorPlan.findById(id);
          if (current) {
            const currentVersion = parseFloat(current.version) || 1.0;
            updateData.version = (currentVersion + 0.1).toFixed(1);
          }
        }
        
        floorPlan = await this.FloorPlan.findByIdAndUpdate(
          id,
          updateData,
          { new: true, runValidators: true }
        );
        if (!floorPlan) throw new Error('Floor plan not found');
      }

      // Send audit log
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendAuditLog('FLOOR_PLAN_UPDATED', updateData.updatedBy, {
          floorPlanId: id,
          name: floorPlan.name,
          version: floorPlan.version
        });
      } catch (kafkaError) {
        console.warn('Kafka not available for audit log:', kafkaError.message);
      }

      return floorPlan;
    } catch (error) {
      throw new Error(`Failed to update floor plan: ${error.message}`);
    }
  }

  async deleteFloorPlan(id) {
    try {
      let floorPlan;
      
      if (process.env.DB_TYPE === 'mysql') {
        floorPlan = await this.FloorPlan.findByPk(id);
      } else {
        floorPlan = await this.FloorPlan.findById(id);
      }
      
      if (!floorPlan) {
        throw new Error('Floor plan not found');
      }

      // Delete associated image if exists
      if (floorPlan.image) {
        const imagePath = path.join(process.env.UPLOAD_PATH || './uploads', floorPlan.image);
        if (fs.existsSync(imagePath)) {
          try {
            fs.unlinkSync(imagePath);
          } catch (fileError) {
            console.warn(`Failed to delete floor plan image: ${fileError.message}`);
          }
        }
      }

      // Delete database record
      if (process.env.DB_TYPE === 'mysql') {
        await floorPlan.destroy();
      } else {
        await this.FloorPlan.findByIdAndDelete(id);
      }

      // Send audit log
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendAuditLog('FLOOR_PLAN_DELETED', null, {
          floorPlanId: id,
          name: floorPlan.name
        });
      } catch (kafkaError) {
        console.warn('Kafka not available for audit log:', kafkaError.message);
      }

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete floor plan: ${error.message}`);
    }
  }

  async addShapeToFloorPlan(floorPlanId, shapeData) {
    try {
      const floorPlan = await this.getFloorPlanById(floorPlanId);
      
      const shapes = floorPlan.shapes || [];
      shapes.push(shapeData);
      
      return await this.updateFloorPlan(floorPlanId, {
        shapes,
        updatedBy: shapeData.createdBy || null
      });
    } catch (error) {
      throw new Error(`Failed to add shape to floor plan: ${error.message}`);
    }
  }

  async removeShapeFromFloorPlan(floorPlanId, shapeIndex) {
    try {
      const floorPlan = await this.getFloorPlanById(floorPlanId);
      
      const shapes = floorPlan.shapes || [];
      if (shapeIndex >= 0 && shapeIndex < shapes.length) {
        shapes.splice(shapeIndex, 1);
        
        return await this.updateFloorPlan(floorPlanId, { shapes });
      } else {
        throw new Error('Invalid shape index');
      }
    } catch (error) {
      throw new Error(`Failed to remove shape from floor plan: ${error.message}`);
    }
  }

  async updateShapeInFloorPlan(floorPlanId, shapeIndex, shapeData) {
    try {
      const floorPlan = await this.getFloorPlanById(floorPlanId);
      
      const shapes = floorPlan.shapes || [];
      if (shapeIndex >= 0 && shapeIndex < shapes.length) {
        shapes[shapeIndex] = { ...shapes[shapeIndex], ...shapeData };
        
        return await this.updateFloorPlan(floorPlanId, { shapes });
      } else {
        throw new Error('Invalid shape index');
      }
    } catch (error) {
      throw new Error(`Failed to update shape in floor plan: ${error.message}`);
    }
  }

  async getFloorPlansByFloor(floor) {
    try {
      let floorPlans;
      
      if (process.env.DB_TYPE === 'mysql') {
        floorPlans = await this.FloorPlan.findAll({
          where: { floor },
          order: [['name', 'ASC']]
        });
      } else {
        floorPlans = await this.FloorPlan.find({ floor }).sort({ name: 1 });
      }
      
      return floorPlans;
    } catch (error) {
      throw new Error(`Failed to get floor plans by floor: ${error.message}`);
    }
  }

  async duplicateFloorPlan(id, newName = null, createdBy = null) {
    try {
      const floorPlan = await this.getFloorPlanById(id);
      
      const duplicateData = {
        ...floorPlan.toJSON(),
        id: undefined,
        _id: undefined,
        name: newName || `${floorPlan.name} (Copy)`,
        version: '1.0',
        createdBy,
        updatedBy: createdBy,
        createdAt: undefined,
        updatedAt: undefined
      };
      
      const duplicate = await this.createFloorPlan(duplicateData);
      
      // Send audit log
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendAuditLog('FLOOR_PLAN_DUPLICATED', createdBy, {
          originalId: id,
          duplicateId: duplicate.id,
          name: duplicate.name
        });
      } catch (kafkaError) {
        console.warn('Kafka not available for audit log:', kafkaError.message);
      }

      return duplicate;
    } catch (error) {
      throw new Error(`Failed to duplicate floor plan: ${error.message}`);
    }
  }

  async exportFloorPlan(id, format = 'json') {
    try {
      const floorPlan = await this.getFloorPlanById(id);
      
      if (format === 'json') {
        return {
          type: 'json',
          data: floorPlan,
          filename: `${floorPlan.name.replace(/\s+/g, '-')}-${floorPlan.version}.json`
        };
      } else {
        // For other formats (PDF, image), you would implement conversion logic here
        throw new Error(`Export format ${format} not yet implemented`);
      }
    } catch (error) {
      throw new Error(`Failed to export floor plan: ${error.message}`);
    }
  }

  async searchShapesInFloorPlans(searchTerm) {
    try {
      let floorPlans;
      
      if (process.env.DB_TYPE === 'mysql') {
        // MySQL JSON search for shapes
        floorPlans = await this.FloorPlan.findAll({
          where: {
            shapes: {
              [Op.like]: `%${searchTerm}%`
            }
          }
        });
      } else {
        // MongoDB text search in shapes
        floorPlans = await this.FloorPlan.find({
          $or: [
            { 'shapes.text': { $regex: searchTerm, $options: 'i' } },
            { 'shapes.metadata.boothNumber': { $regex: searchTerm, $options: 'i' } },
            { 'shapes.metadata.companyName': { $regex: searchTerm, $options: 'i' } }
          ]
        });
      }
      
      return floorPlans;
    } catch (error) {
      throw new Error(`Failed to search shapes in floor plans: ${error.message}`);
    }
  }
}

module.exports = new FloorPlanService();