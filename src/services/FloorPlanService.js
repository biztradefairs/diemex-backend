// services/BoothService.js
const { Op } = require('sequelize');
const cloudinaryService = require('./CloudinaryService');

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

  // Upload floor plan image to Cloudinary
  async uploadFloorPlanImage(imageFile, userId) {
    try {
      console.log('📤 Uploading floor plan image to Cloudinary...');
      
      // Upload to Cloudinary
      const uploadResult = await cloudinaryService.uploadImage(imageFile, {
        folder: 'exhibition-floor-plans',
        resource_type: 'image'
      });

      // Create or update floor plan with image
      let floorPlan = await this.FloorPlan.findOne({
        where: { isActive: true }
      });

      if (!floorPlan) {
        floorPlan = await this.FloorPlan.create({
          name: 'Main Exhibition Floor',
          baseImageUrl: uploadResult.url,
          cloudinaryPublicId: uploadResult.publicId,
          imageWidth: uploadResult.width,
          imageHeight: uploadResult.height,
          booths: [],
          referencePoints: [],
          isActive: true,
          createdBy: userId
        });
      } else {
        // Delete old image from Cloudinary if exists
        if (floorPlan.cloudinaryPublicId) {
          try {
            await cloudinaryService.deleteImage(floorPlan.cloudinaryPublicId);
          } catch (error) {
            console.warn('Failed to delete old image:', error.message);
          }
        }

        // Update with new image
        floorPlan.baseImageUrl = uploadResult.url;
        floorPlan.cloudinaryPublicId = uploadResult.publicId;
        floorPlan.imageWidth = uploadResult.width;
        floorPlan.imageHeight = uploadResult.height;
        floorPlan.updatedBy = userId;
        await floorPlan.save();
      }

      return {
        success: true,
        data: {
          id: floorPlan.id,
          baseImageUrl: floorPlan.baseImageUrl,
          imageWidth: floorPlan.imageWidth,
          imageHeight: floorPlan.imageHeight,
          booths: floorPlan.booths || []
        },
        message: 'Floor plan image uploaded successfully'
      };
    } catch (error) {
      console.error('❌ Upload floor plan error:', error);
      throw error;
    }
  }

  // Add booth with percentage-based positioning
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

      if (!floorPlan.imageWidth || !floorPlan.imageHeight) {
        throw new Error('Floor plan image dimensions not set');
      }

      const booths = floorPlan.booths || [];
      
      // Convert pixel coordinates to percentages if provided
      let xPercent = boothData.xPercent;
      let yPercent = boothData.yPercent;
      
      if (boothData.x !== undefined && boothData.y !== undefined) {
        // Convert absolute pixels to percentages
        xPercent = (boothData.x / floorPlan.imageWidth) * 100;
        yPercent = (boothData.y / floorPlan.imageHeight) * 100;
      }

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
        boothNumber: boothData.boothNumber,
        companyName: boothData.companyName || '',
        status: boothData.status || 'available',
        // Store as percentages relative to image size
        xPercent: parseFloat(xPercent.toFixed(4)),
        yPercent: parseFloat(yPercent.toFixed(4)),
        widthPercent: boothData.widthPercent || 10, // Default 10% of image width
        heightPercent: boothData.heightPercent || 8, // Default 8% of image height
        // Store absolute dimensions for reference
        width: boothData.width || 120,
        height: boothData.height || 80,
        // Store text position
        labelXPercent: parseFloat((xPercent + 2).toFixed(4)),
        labelYPercent: parseFloat((yPercent - 2).toFixed(4)),
        // Store status dot position
        dotXPercent: parseFloat((xPercent + 8).toFixed(4)),
        dotYPercent: parseFloat((yPercent - 2).toFixed(4)),
        // Additional metadata
        metadata: boothData.metadata || {}
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

  // Update booth position (percentage-based)
  async updateBoothPosition(boothId, positionData, userId) {
    try {
      const model = this.FloorPlan;
      if (!model) throw new Error('FloorPlan model not available');

      const floorPlan = await model.findOne({
        where: { isActive: true }
      });

      if (!floorPlan) {
        throw new Error('No active floor plan found');
      }

      if (!floorPlan.imageWidth || !floorPlan.imageHeight) {
        throw new Error('Floor plan image dimensions not set');
      }

      let booths = floorPlan.booths || [];
      const boothIndex = booths.findIndex(b => b.id === boothId);

      if (boothIndex === -1) {
        throw new Error('Booth not found');
      }

      const booth = booths[boothIndex];
      
      // Update position
      if (positionData.x !== undefined && positionData.y !== undefined) {
        // Convert absolute pixels to percentages
        booth.xPercent = (positionData.x / floorPlan.imageWidth) * 100;
        booth.yPercent = (positionData.y / floorPlan.imageHeight) * 100;
        booth.labelXPercent = parseFloat((booth.xPercent + 2).toFixed(4));
        booth.labelYPercent = parseFloat((booth.yPercent - 2).toFixed(4));
        booth.dotXPercent = parseFloat((booth.xPercent + 8).toFixed(4));
        booth.dotYPercent = parseFloat((booth.yPercent - 2).toFixed(4));
      }

      if (positionData.width && positionData.height) {
        booth.widthPercent = (positionData.width / floorPlan.imageWidth) * 100;
        booth.heightPercent = (positionData.height / floorPlan.imageHeight) * 100;
        booth.width = positionData.width;
        booth.height = positionData.height;
      }

      booths[boothIndex] = booth;
      floorPlan.booths = booths;
      floorPlan.updatedBy = userId;
      await floorPlan.save();

      return {
        success: true,
        data: booth,
        message: 'Booth position updated successfully'
      };
    } catch (error) {
      console.error('❌ Update booth position error:', error);
      throw error;
    }
  }

  // Get floor plan with image and booths
  async getFloorPlan() {
    try {
      const model = this.FloorPlan;
      if (!model) throw new Error('FloorPlan model not available');

      const floorPlan = await model.findOne({
        where: { isActive: true },
        order: [['createdAt', 'DESC']]
      });

      if (!floorPlan) {
        return {
          success: true,
          data: {
            baseImageUrl: null,
            imageWidth: null,
            imageHeight: null,
            booths: []
          }
        };
      }

      return {
        success: true,
        data: {
          id: floorPlan.id,
          name: floorPlan.name,
          baseImageUrl: floorPlan.baseImageUrl,
          imageWidth: floorPlan.imageWidth,
          imageHeight: floorPlan.imageHeight,
          booths: floorPlan.booths || []
        }
      };
    } catch (error) {
      console.error('❌ Get floor plan error:', error);
      throw error;
    }
  }

  // Export floor plan as image with overlays
  async exportFloorPlan() {
    try {
      const floorPlan = await this.getFloorPlan();
      if (!floorPlan.data.baseImageUrl) {
        throw new Error('No floor plan image found');
      }

      // Generate a temporary URL with overlays using Cloudinary
      const overlayString = this.generateCloudinaryOverlay(floorPlan.data.booths);
      
      const cloudinary = require('cloudinary').v2;
      const exportUrl = cloudinary.url(floorPlan.data.cloudinaryPublicId, {
        transformation: [
          { width: floorPlan.data.imageWidth, height: floorPlan.data.imageHeight, crop: 'scale' },
          ...overlayString
        ],
        secure: true
      });

      return {
        success: true,
        data: {
          exportUrl,
          imageUrl: floorPlan.data.baseImageUrl
        }
      };
    } catch (error) {
      console.error('❌ Export floor plan error:', error);
      throw error;
    }
  }

  // Generate Cloudinary overlay string for booths
  generateCloudinaryOverlay(booths) {
    const overlays = [];
    
    booths.forEach((booth, index) => {
      const statusColors = {
        available: 'green',
        booked: 'blue',
        reserved: 'orange'
      };

      const color = statusColors[booth.status] || 'gray';
      
      // Add booth box overlay
      overlays.push({
        overlay: {
          font_family: 'Arial',
          font_size: 20,
          text: booth.boothNumber
        },
        color: 'white',
        background: color,
        gravity: 'north_west',
        x: Math.round((booth.xPercent / 100) * floorPlan.data.imageWidth),
        y: Math.round((booth.yPercent / 100) * floorPlan.data.imageHeight),
        width: Math.round((booth.widthPercent / 100) * floorPlan.data.imageWidth),
        height: Math.round((booth.heightPercent / 100) * floorPlan.data.imageHeight),
        border: `2px_solid_${color}`
      });

      // Add status dot
      if (booth.status !== 'available') {
        overlays.push({
          overlay: {
            font_family: 'Arial',
            font_size: 30,
            text: '●'
          },
          color: color,
          gravity: 'north_west',
          x: Math.round((booth.dotXPercent / 100) * floorPlan.data.imageWidth),
          y: Math.round((booth.dotYPercent / 100) * floorPlan.data.imageHeight)
        });
      }

      // Add company name if exists
      if (booth.companyName) {
        overlays.push({
          overlay: {
            font_family: 'Arial',
            font_size: 14,
            text: booth.companyName.substring(0, 20)
          },
          color: 'black',
          background: 'white',
          gravity: 'north_west',
          x: Math.round((booth.xPercent / 100) * floorPlan.data.imageWidth),
          y: Math.round((booth.yPercent / 100) * floorPlan.data.imageHeight + 30)
        });
      }
    });

    return overlays;
  }

  // Reset floor plan
  async resetFloorPlan(userId) {
    try {
      const model = this.FloorPlan;
      if (!model) throw new Error('FloorPlan model not available');

      const floorPlan = await model.findOne({
        where: { isActive: true }
      });

      if (floorPlan) {
        // Delete image from Cloudinary
        if (floorPlan.cloudinaryPublicId) {
          try {
            await cloudinaryService.deleteImage(floorPlan.cloudinaryPublicId);
          } catch (error) {
            console.warn('Failed to delete image:', error.message);
          }
        }

        floorPlan.baseImageUrl = null;
        floorPlan.cloudinaryPublicId = null;
        floorPlan.imageWidth = null;
        floorPlan.imageHeight = null;
        floorPlan.booths = [];
        floorPlan.referencePoints = [];
        floorPlan.updatedBy = userId;
        await floorPlan.save();
      }

      return {
        success: true,
        message: 'Floor plan reset successfully'
      };
    } catch (error) {
      console.error('❌ Reset floor plan error:', error);
      throw error;
    }
  }

  // Get booth statistics
  async getBoothStatistics() {
    try {
      const floorPlan = await this.getFloorPlan();
      const booths = floorPlan.data.booths || [];
      
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

  // Update booth status
  async updateBoothStatus(boothId, status, userId) {
    return this.updateBooth(boothId, { status }, userId);
  }

  // Update company name
  async updateCompanyName(boothId, companyName, userId) {
    return this.updateBooth(boothId, { companyName }, userId);
  }

  // Generic booth update
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

      booths[boothIndex] = {
        ...booths[boothIndex],
        ...updateData,
        id: boothId
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
  // services/BoothService.js - Add this method
async saveFloorPlan(booths, userId) {
  try {
    const model = this.FloorPlan;
    if (!model) throw new Error('FloorPlan model not available');

    const floorPlan = await model.findOne({
      where: { isActive: true }
    });

    if (!floorPlan) {
      throw new Error('No active floor plan found');
    }

    // Update the booths with any new metadata
    const existingBooths = floorPlan.booths || [];
    
    // Merge existing booths with updated ones
    const updatedBooths = booths.map(newBooth => {
      const existingBooth = existingBooths.find(b => b.id === newBooth.id);
      return {
        ...existingBooth,
        ...newBooth,
        // Preserve important fields
        id: newBooth.id || existingBooth?.id,
        boothNumber: newBooth.boothNumber || existingBooth?.boothNumber,
        xPercent: newBooth.xPercent ?? existingBooth?.xPercent,
        yPercent: newBooth.yPercent ?? existingBooth?.yPercent,
        widthPercent: newBooth.widthPercent ?? existingBooth?.widthPercent,
        heightPercent: newBooth.heightPercent ?? existingBooth?.heightPercent,
        // Update metadata with latest values
        metadata: {
          ...existingBooth?.metadata,
          ...newBooth.metadata,
          companyName: newBooth.companyName || newBooth.metadata?.companyName || existingBooth?.companyName,
          status: newBooth.status || newBooth.metadata?.status || existingBooth?.status || 'available',
          amenities: newBooth.metadata?.amenities || existingBooth?.metadata?.amenities || [],
          restrictions: newBooth.metadata?.restrictions || existingBooth?.metadata?.restrictions || []
        }
      };
    });

    floorPlan.booths = updatedBooths;
    floorPlan.updatedBy = userId;
    await floorPlan.save();

    return {
      success: true,
      data: {
        id: floorPlan.id,
        booths: floorPlan.booths
      },
      message: 'Floor plan saved successfully'
    };
  } catch (error) {
    console.error('❌ Save floor plan error:', error);
    throw error;
  }
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
}

module.exports = new BoothService();