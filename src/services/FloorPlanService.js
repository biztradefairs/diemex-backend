const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

class FloorPlanService {
  constructor() {
    this._floorPlanModel = null;
  }

  get FloorPlan() {
    if (!this._floorPlanModel) {
      const modelFactory = require('../models');
      this._floorPlanModel = modelFactory.getModel('FloorPlan');
      if (!this._floorPlanModel) {
        console.warn('⚠️ FloorPlan model not found, using MongoDB model');
        // Try MongoDB model
        this._floorPlanModel = modelFactory.getModel('MongoFloorPlan');
        if (!this._floorPlanModel) {
          throw new Error('FloorPlan model not found. Make sure models are initialized.');
        }
      }
    }
    return this._floorPlanModel;
  }

  async createFloorPlan(floorPlanData) {
    try {
      const floorPlan = await this.FloorPlan.create({
        ...floorPlanData,
        version: '1.0'
      });
      
      return floorPlan;
    } catch (error) {
      throw new Error(`Failed to create floor plan: ${error.message}`);
    }
  }

  async getAllFloorPlans(filters = {}, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      let where = {};
      
      // Search filter
      if (filters.search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${filters.search}%` } },
          { description: { [Op.like]: `%${filters.search}%` } }
        ];
      }
      
      // Floor filter
      if (filters.floor && filters.floor !== 'all') {
        where.floor = filters.floor;
      }
      
      // Creator filter
      if (filters.createdBy) {
        where.createdBy = filters.createdBy;
      }

      // Check if using Sequelize or Mongoose
      if (typeof this.FloorPlan.findAndCountAll === 'function') {
        // Sequelize
        const result = await this.FloorPlan.findAndCountAll({
          where,
          limit,
          offset,
          order: [['createdAt', 'DESC']]
        });
        
        return {
          floorPlans: result.rows,
          total: result.count,
          page,
          totalPages: Math.ceil(result.count / limit)
        };
      } else {
        // Mongoose
        const floorPlans = await this.FloorPlan.find(where)
          .skip(offset)
          .limit(limit)
          .sort({ createdAt: -1 });
        
        const total = await this.FloorPlan.countDocuments(where);
        
        return {
          floorPlans,
          total,
          page,
          totalPages: Math.ceil(total / limit)
        };
      }
    } catch (error) {
      throw new Error(`Failed to fetch floor plans: ${error.message}`);
    }
  }
}
module.exports = new FloorPlanService();