// src/services/manualService.js
const { Op } = require('sequelize');
const cloudinaryService = require('./CloudinaryService');

class ManualService {
  constructor() {
    this.Manual = null;
  }

  // Get Manual model with lazy initialization
  async getManualModel() {
    if (!this.Manual) {
      try {
        const models = require('../models');
        
        if (!models.getAllModels().Manual) {
          console.log('🔄 Manual model not found, initializing models...');
          models.init();
        }
        
        this.Manual = models.getModel('Manual');
        console.log('✅ Manual model loaded in service');
      } catch (error) {
        console.error('❌ Failed to load Manual model:', error);
        throw new Error('Manual model not available');
      }
    }
    return this.Manual;
  }

  // Create a new manual
  async createManual(manualData, file) {
    try {
      const Manual = await this.getManualModel();
      
      // Upload file to Cloudinary
      const uploadResult = await cloudinaryService.uploadImage(file.buffer, {
        folder: 'exhibition-manuals',
        resource_type: 'raw',
        access_mode: 'public'
      });

      const manual = await Manual.create({
        title: manualData.title,
        description: manualData.description || '',
        category: manualData.category || 'General',
        version: manualData.version || '1.0',
        file_path: uploadResult.secure_url || uploadResult.url,
        file_name: file.originalname,
        file_size: this.formatFileSize(file.size),
        mime_type: file.mimetype,
        last_updated: new Date().toISOString().split('T')[0],
        updated_by: manualData.updated_by || 'Admin',
        status: manualData.status || 'draft',
        downloads: 0,
        metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
          cloudinaryPublicId: uploadResult.public_id,
          cloudinaryFormat: uploadResult.format,
          cloudinaryBytes: uploadResult.bytes
        }
      });

      return { success: true, data: manual };
    } catch (error) {
      console.error('Error in createManual:', error);
      throw new Error(`Error creating manual: ${error.message}`);
    }
  }

  // Get all manuals with filters
  async getAllManuals(filters = {}) {
    try {
      const Manual = await this.getManualModel();

      const whereClause = {};

      if (filters.status) {
        whereClause.status = filters.status;
      }

      if (filters.category && filters.category !== 'all' && filters.category !== 'undefined') {
        whereClause.category = filters.category;
      }

      if (filters.search) {
        whereClause[Op.or] = [
          { title: { [Op.like]: `%${filters.search}%` } },
          { description: { [Op.like]: `%${filters.search}%` } },
          { category: { [Op.like]: `%${filters.search}%` } }
        ];
      }

      const manuals = await Manual.findAll({
        where: whereClause,
        order: [['last_updated', 'DESC']]
      });

      return { success: true, data: manuals || [] };
    } catch (error) {
      console.error('Error in getAllManuals:', error);
      return { success: true, data: [] };
    }
  }

  // Get manual by ID
  async getManualById(id) {
    try {
      const Manual = await this.getManualModel();

      const manual = await Manual.findByPk(id);
      if (!manual) {
        throw new Error('Manual not found');
      }
      return { success: true, data: manual };
    } catch (error) {
      console.error('Error in getManualById:', error);
      throw new Error(`Error fetching manual: ${error.message}`);
    }
  }

  // Update manual
  async updateManual(id, updateData, file = null) {
    try {
      const Manual = await this.getManualModel();

      const manual = await Manual.findByPk(id);
      if (!manual) {
        throw new Error('Manual not found');
      }

      // If new file is uploaded
      if (file) {
        // Delete old file from Cloudinary
        if (manual.metadata?.cloudinaryPublicId) {
          await cloudinaryService.deleteImage(manual.metadata.cloudinaryPublicId).catch(() => {
            console.log('Failed to delete old file from Cloudinary, but continuing...');
          });
        }

        // Upload new file to Cloudinary
        const uploadResult = await cloudinaryService.uploadImage(file.buffer, {
          folder: 'exhibition-manuals',
          resource_type: 'raw',
          access_mode: 'public'
        });

        updateData.file_path = uploadResult.secure_url || uploadResult.url;
        updateData.file_name = file.originalname;
        updateData.file_size = this.formatFileSize(file.size);
        updateData.mime_type = file.mimetype;
        updateData.metadata = {
          ...manual.metadata,
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
          cloudinaryPublicId: uploadResult.public_id,
          cloudinaryFormat: uploadResult.format,
          cloudinaryBytes: uploadResult.bytes
        };
      }

      updateData.last_updated = new Date().toISOString().split('T')[0];
      
      await manual.update(updateData);
      return { success: true, data: manual };
    } catch (error) {
      console.error('Error in updateManual:', error);
      throw new Error(`Error updating manual: ${error.message}`);
    }
  }

  // Delete manual
  async deleteManual(id) {
    try {
      const Manual = await this.getManualModel();

      const manual = await Manual.findByPk(id);
      if (!manual) {
        throw new Error('Manual not found');
      }

      // Delete file from Cloudinary
      if (manual.metadata?.cloudinaryPublicId) {
        await cloudinaryService.deleteImage(manual.metadata.cloudinaryPublicId).catch((error) => {
          console.log('Failed to delete from Cloudinary:', error.message);
        });
      }

      await manual.destroy();
      return { success: true, message: 'Manual deleted successfully' };
    } catch (error) {
      console.error('Error in deleteManual:', error);
      throw new Error(`Error deleting manual: ${error.message}`);
    }
  }

  // Download manual
  async downloadManual(id) {
    try {
      const Manual = await this.getManualModel();

      const manual = await Manual.findByPk(id);
      if (!manual) {
        throw new Error('Manual not found');
      }

      // Increment download count
      await manual.increment('downloads');
      
      // Generate Cloudinary download URL
      let downloadUrl = manual.file_path;
      
      // If it's a Cloudinary URL, add attachment flag
      if (manual.file_path.includes('cloudinary.com')) {
        // Replace /upload/ with /upload/fl_attachment/
        downloadUrl = manual.file_path.replace('/upload/', '/upload/fl_attachment/');
      }
      
      return { 
        success: true, 
        fileUrl: manual.file_path,
        fileName: manual.file_name,
        mimeType: manual.mime_type,
        downloadUrl: downloadUrl
      };
    } catch (error) {
      console.error('Error in downloadManual:', error);
      throw new Error(`Error downloading manual: ${error.message}`);
    }
  }

  // Get statistics
  async getStatistics() {
    try {
      const Manual = await this.getManualModel();
      const sequelize = Manual.sequelize;
      
      const totalManuals = await Manual.count();
      const publishedManuals = await Manual.count({ where: { status: 'published' } });
      const draftManuals = await Manual.count({ where: { status: 'draft' } });
      
      const totalDownloads = await Manual.sum('downloads') || 0;
      
      const categoryStats = await Manual.findAll({
        attributes: [
          'category',
          [sequelize.fn('COUNT', sequelize.col('category')), 'count']
        ],
        group: ['category']
      });

      return {
        success: true,
        data: {
          totalManuals,
          publishedManuals,
          draftManuals,
          totalDownloads,
          categoryStats: categoryStats || []
        }
      };
    } catch (error) {
      console.error('Error in getStatistics:', error);
      return {
        success: true,
        data: {
          totalManuals: 0,
          publishedManuals: 0,
          draftManuals: 0,
          totalDownloads: 0,
          categoryStats: []
        }
      };
    }
  }

  // Get preview URL
  getPreviewUrl(manual) {
    if (!manual || !manual.mime_type) return null;
    
    const mimeType = manual.mime_type;
    
    if (mimeType === 'application/pdf' && manual.file_path.includes('cloudinary.com')) {
      // For PDF preview
      return manual.file_path.replace('/upload/', '/upload/fl_attachment/');
    }
    
    if (mimeType.startsWith('image/') && manual.metadata?.cloudinaryPublicId) {
      return cloudinaryService.generateOptimizedUrl(manual.metadata.cloudinaryPublicId);
    }
    
    return manual.file_path;
  }

  // Format file size
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = new ManualService();