// src/services/manualService.js
const path = require('path');
const axios = require('axios');
const { Op } = require('sequelize');
const cloudinaryService = require('./CloudinaryService');

const MIME_EXTENSIONS = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/plain': '.txt'
};

const EXTENSION_MIME = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain'
};

class ManualService {
  constructor() {
    this.Manual = null;
  }

  toPlain(row) {
    if (!row) return row;
    if (typeof row.toJSON === 'function') return row.toJSON();
    if (row.dataValues) return { ...row.dataValues };
    return row;
  }

  getFileExtension(fileName = '', mimeType = '') {
    const fromName = path.extname(fileName || '').toLowerCase();
    if (fromName && EXTENSION_MIME[fromName]) return fromName;
    return MIME_EXTENSIONS[mimeType] || fromName || '';
  }

  ensureFileName(fileName, mimeType) {
    const original = String(fileName || 'document').replace(/[/\\?%*:|"<>]/g, '_').trim() || 'document';
    const ext = this.getFileExtension(original, mimeType);
    if (!ext) return original;
    if (original.toLowerCase().endsWith(ext)) return original;
    return `${original}${ext}`;
  }

  resolveMimeType(fileName, mimeType) {
    if (mimeType && mimeType !== 'application/octet-stream') return mimeType;
    const ext = this.getFileExtension(fileName, mimeType);
    return EXTENSION_MIME[ext] || mimeType || 'application/octet-stream';
  }

  getCloudinaryUploadOptions(file) {
    const originalName = file.originalname || 'document';
    const ext = path.extname(originalName);
    const base = path.basename(originalName, ext).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'document';
    return {
      folder: 'exhibition-manuals',
      resource_type: 'raw',
      type: 'upload',
      access_mode: 'public',
      use_filename: true,
      unique_filename: true,
      filename_override: originalName,
      public_id: `${base}-${Date.now()}${ext}`
    };
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
      
      const uploadResult = await cloudinaryService.uploadFile(
        file.buffer,
        this.getCloudinaryUploadOptions(file)
      );

      const filePath = uploadResult.secure_url || uploadResult.url;
      const publicId = uploadResult.public_id || uploadResult.publicId;

      const manual = await Manual.create({
        title: manualData.title,
        description: manualData.description || '',
        category: manualData.category || 'General',
        version: manualData.version || '1.0',
        file_path: filePath,
        file_name: file.originalname,
        file_size: this.formatFileSize(file.size),
        mime_type: file.mimetype,
        last_updated: new Date().toISOString().split('T')[0],
        updated_by: manualData.updated_by || 'Admin',
        status: manualData.status || 'published',
        downloads: 0,
        metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
          cloudinaryPublicId: publicId,
          cloudinaryFormat: uploadResult.format,
          cloudinaryBytes: uploadResult.bytes
        }
      });

      return { success: true, data: this.toPlain(manual) };
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

      return { success: true, data: (manuals || []).map((manual) => this.toPlain(manual)) };
    } catch (error) {
      console.error('Error in getAllManuals:', error);
      return { success: true, data: [] };
    }
  }

// src/services/manualService.js
// Make sure this method exists

async getManualById(id) {
  try {
    console.log('Getting manual by ID:', id);

    // ✅ FIX: Load model properly
    const Manual = await this.getManualModel();

    const manual = await Manual.findByPk(id);

    if (!manual) {
      throw new Error('Manual not found');
    }

    return {
      success: true,
      data: this.toPlain(manual)
    };
  } catch (error) {
    console.error('Error in getManualById:', error);
    throw error;
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
        await cloudinaryService.deleteFile(manual.metadata.cloudinaryPublicId, 'raw').catch(() => {
          console.log('Failed to delete old file from Cloudinary, but continuing...');
        });
      }

        // Upload new file to Cloudinary
        const uploadResult = await cloudinaryService.uploadFile(
          file.buffer,
          this.getCloudinaryUploadOptions(file)
        );

        updateData.file_path = uploadResult.secure_url || uploadResult.url;
        updateData.file_name = file.originalname;
        updateData.file_size = this.formatFileSize(file.size);
        updateData.mime_type = file.mimetype;
        updateData.metadata = {
          ...manual.metadata,
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
          cloudinaryPublicId: uploadResult.public_id || uploadResult.publicId,
          cloudinaryFormat: uploadResult.format,
          cloudinaryBytes: uploadResult.bytes
        };
      }

      updateData.last_updated = new Date().toISOString().split('T')[0];
      
      await manual.update(updateData);
      return { success: true, data: this.toPlain(manual) };
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
        await cloudinaryService.deleteFile(manual.metadata.cloudinaryPublicId, 'raw').catch((error) => {
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
      const file = await this.streamManualFile(id);
      return {
        success: true,
        fileUrl: file.fileUrl,
        fileName: file.fileName,
        mimeType: file.mimeType,
        downloadUrl: file.fileUrl,
        buffer: file.buffer
      };
    } catch (error) {
      console.error('Error in downloadManual:', error);
      throw new Error(`Error downloading manual: ${error.message}`);
    }
  }

  async streamManualFile(id) {
    const Manual = await this.getManualModel();
    const manual = await Manual.findByPk(id);
    if (!manual || !manual.file_path) {
      throw new Error('Manual not found');
    }

    const fileName = this.ensureFileName(
      manual.file_name || manual.metadata?.originalName,
      manual.mime_type
    );
    const mimeType = this.resolveMimeType(fileName, manual.mime_type);

    const fileResponse = await axios.get(manual.file_path, {
      responseType: 'arraybuffer',
      timeout: 120000
    });

    await manual.increment('downloads');

    return {
      buffer: Buffer.from(fileResponse.data),
      fileName,
      mimeType,
      fileUrl: manual.file_path
    };
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