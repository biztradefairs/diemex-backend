const { Op } = require('sequelize');

class BoothService {
  constructor() {
    this._floorPlanModel = null;
  }

  get FloorPlan() {
    if (!this._floorPlanModel) {
      const modelFactory = require('../models');
      this._floorPlanModel = modelFactory.getModel('FloorPlan');
    }
    return this._floorPlanModel;
  }

  // Get all booths from the active floor plan
  async getAllBooths(userId, role) {
    try {
      const model = this.FloorPlan;
      if (!model) throw new Error('FloorPlan model not available');

      // Get the active floor plan (first one or create default)
      let floorPlan = await model.findOne({
        where: { isActive: true },
        order: [['createdAt', 'DESC']]
      });

      if (!floorPlan) {
        // Create default floor plan with sample booths
        floorPlan = await model.create({
          name: 'Main Exhibition Floor',
          booths: this.getDefaultBooths(),
          isActive: true,
          createdBy: userId || 1
        });
      }

      return {
        success: true,
        data: floorPlan.booths || [],
        floorPlanId: floorPlan.id
      };
    } catch (error) {
      console.error('❌ Get all booths error:', error);
      throw error;
    }
  }

  // Get default booths for new floor plan
  getDefaultBooths() {
    const booths = [];
    const rows = 4;
    const cols = 6;
    const startX = 50;
    const startY = 50;
    const boothWidth = 120;
    const boothHeight = 80;
    const spacing = 20;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const boothNumber = `${String.fromCharCode(65 + row)}${col + 1}`;
        booths.push({
          id: `booth-${Date.now()}-${row}-${col}`,
          boothNumber,
          companyName: '',
          status: 'available',
          x: startX + col * (boothWidth + spacing),
          y: startY + row * (boothHeight + spacing),
          width: boothWidth,
          height: boothHeight
        });
      }
    }
    return booths;
  }

  // Add new booth
  async addBooth(boothData, userId) {
    try {
      const model = this.FloorPlan;
      if (!model) throw new Error('FloorPlan model not available');

      const floorPlan = await model.findOne({
        where: { isActive: true }
      });

      if (!floorPlan) {
        throw new Error('No active floor plan found');
      }

      const booths = floorPlan.booths || [];
      
      // Generate booth number if not provided
      if (!boothData.boothNumber) {
        const maxNumber = booths
          .map(b => parseInt(b.boothNumber.replace(/[^0-9]/g, '')) || 0)
          .reduce((max, num) => Math.max(max, num), 0);
        
        const nextNumber = maxNumber + 1;
        boothData.boothNumber = `B${nextNumber}`;
      }

      const newBooth = {
        id: `booth-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        ...boothData,
        status: boothData.status || 'available',
        companyName: boothData.companyName || ''
      };

      booths.push(newBooth);
      floorPlan.booths = booths;
      floorPlan.updatedBy = userId;
      await floorPlan.save();

      return {
        success: true,
        data: newBooth,
        message: 'Booth added successfully'
      };
    } catch (error) {
      console.error('❌ Add booth error:', error);
      throw error;
    }
  }

  // Update booth
  async updateBooth(boothId, updateData, userId) {
    try {
      const model = this.FloorPlan;
      if (!model) throw new Error('FloorPlan model not available');

      const floorPlan = await model.findOne({
        where: { isActive: true }
      });

      if (!floorPlan) {
        throw new Error('No active floor plan found');
      }

      let booths = floorPlan.booths || [];
      const boothIndex = booths.findIndex(b => b.id === boothId);

      if (boothIndex === -1) {
        throw new Error('Booth not found');
      }

      // Update booth data
      booths[boothIndex] = {
        ...booths[boothIndex],
        ...updateData,
        id: boothId // Ensure ID doesn't change
      };

      floorPlan.booths = booths;
      floorPlan.updatedBy = userId;
      await floorPlan.save();

      return {
        success: true,
        data: booths[boothIndex],
        message: 'Booth updated successfully'
      };
    } catch (error) {
      console.error('❌ Update booth error:', error);
      throw error;
    }
  }

  // Update booth status
  async updateBoothStatus(boothId, status, userId) {
    return this.updateBooth(boothId, { status }, userId);
  }

  // Update company name
  async updateCompanyName(boothId, companyName, userId) {
    return this.updateBooth(boothId, { companyName }, userId);
  }

  // Delete booth
  async deleteBooth(boothId, userId) {
    try {
      const model = this.FloorPlan;
      if (!model) throw new Error('FloorPlan model not available');

      const floorPlan = await model.findOne({
        where: { isActive: true }
      });

      if (!floorPlan) {
        throw new Error('No active floor plan found');
      }

      let booths = floorPlan.booths || [];
      const initialLength = booths.length;
      
      booths = booths.filter(b => b.id !== boothId);

      if (booths.length === initialLength) {
        throw new Error('Booth not found');
      }

      floorPlan.booths = booths;
      floorPlan.updatedBy = userId;
      await floorPlan.save();

      return {
        success: true,
        message: 'Booth deleted successfully'
      };
    } catch (error) {
      console.error('❌ Delete booth error:', error);
      throw error;
    }
  }

  // Bulk update booths
  async bulkUpdateBooths(updates, userId) {
    try {
      const model = this.FloorPlan;
      if (!model) throw new Error('FloorPlan model not available');

      const floorPlan = await model.findOne({
        where: { isActive: true }
      });

      if (!floorPlan) {
        throw new Error('No active floor plan found');
      }

      let booths = floorPlan.booths || [];
      const updatedBooths = [];

      updates.forEach(update => {
        const index = booths.findIndex(b => b.id === update.id);
        if (index !== -1) {
          booths[index] = { ...booths[index], ...update };
          updatedBooths.push(booths[index]);
        }
      });

      floorPlan.booths = booths;
      floorPlan.updatedBy = userId;
      await floorPlan.save();

      return {
        success: true,
        data: updatedBooths,
        message: `Updated ${updatedBooths.length} booths`
      };
    } catch (error) {
      console.error('❌ Bulk update error:', error);
      throw error;
    }
  }

  // Get booth statistics
  async getBoothStatistics() {
    try {
      const model = this.FloorPlan;
      if (!model) throw new Error('FloorPlan model not available');

      const floorPlan = await model.findOne({
        where: { isActive: true }
      });

      const booths = floorPlan?.booths || [];
      
      const stats = {
        total: booths.length,
        available: booths.filter(b => b.status === 'available').length,
        booked: booths.filter(b => b.status === 'booked').length,
        reserved: booths.filter(b => b.status === 'reserved').length,
        occupied: booths.filter(b => b.companyName && b.companyName.trim() !== '').length
      };

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('❌ Get statistics error:', error);
      throw error;
    }
  }

  // Reset floor plan to default
  async resetToDefault(userId) {
    try {
      const model = this.FloorPlan;
      if (!model) throw new Error('FloorPlan model not available');

      const floorPlan = await model.findOne({
        where: { isActive: true }
      });

      if (floorPlan) {
        floorPlan.booths = this.getDefaultBooths();
        floorPlan.updatedBy = userId;
        await floorPlan.save();
      } else {
        await model.create({
          name: 'Main Exhibition Floor',
          booths: this.getDefaultBooths(),
          isActive: true,
          createdBy: userId
        });
      }

      return {
        success: true,
        message: 'Floor plan reset to default'
      };
    } catch (error) {
      console.error('❌ Reset error:', error);
      throw error;
    }
  }
}

module.exports = new BoothService();