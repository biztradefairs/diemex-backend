const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

class MediaService {
  constructor() {
    this._mediaModel = null;
  }

  get Media() {
    if (!this._mediaModel) {
      const modelFactory = require('../models');
      this._mediaModel = modelFactory.getModel('Media');
      if (!this._mediaModel) {
        throw new Error('Media model not found. Make sure models are initialized.');
      }
    }
    return this._mediaModel;
  }

  async uploadMedia(file, metadata = {}) {
    try {
      const mediaData = {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: file.path,
        url: `/uploads/${file.filename}`,
        type: this.getFileType(file.mimetype),
        ...metadata
      };

      if (file.mimetype.startsWith('image/')) {
        mediaData.dimensions = metadata.dimensions || 'unknown';
      } else if (file.mimetype.startsWith('video/')) {
        mediaData.duration = metadata.duration || null;
      }

      const media = await this.Media.create(mediaData);
      return media;
    } catch (error) {
      // Clean up uploaded file if database operation fails
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new Error(`Failed to upload media: ${error.message}`);
    }
  }

  getFileType(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf')) return 'document';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'document';
    return 'other';
  }

  async getAllMedia(filters = {}, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      
      let where = {};
      
      // Search filter
      if (filters.search) {
        where[Op.or] = [
          { filename: { [Op.like]: `%${filters.search}%` } },
          { originalName: { [Op.like]: `%${filters.search}%` } },
          { description: { [Op.like]: `%${filters.search}%` } }
        ];
      }
      
      // Type filter
      if (filters.type && filters.type !== 'all') {
        where.type = filters.type;
      }
      
      // User filter
      if (filters.userId) {
        where.userId = filters.userId;
      }
      
      // Tags filter (assuming tags is a JSON column)
      if (filters.tags && filters.tags.length > 0) {
        // For JSON column search in MySQL
        where.tags = { [Op.overlap]: filters.tags };
      }

      // Use Sequelize findAndCountAll
      const result = await this.Media.findAndCountAll({
        where,
        limit,
        offset,
        order: [['createdAt', 'DESC']]
      });

      return {
        media: result.rows,
        total: result.count,
        page,
        totalPages: Math.ceil(result.count / limit)
      };
    } catch (error) {
      throw new Error(`Failed to fetch media: ${error.message}`);
    }
  }

  async getMediaById(id) {
    try {
      const media = await this.Media.findByPk(id);
      
      if (!media) {
        throw new Error('Media not found');
      }
      
      return media;
    } catch (error) {
      throw new Error(`Failed to fetch media: ${error.message}`);
    }
  }

  async deleteMedia(id) {
    try {
      const media = await this.Media.findByPk(id);
      if (!media) {
        throw new Error('Media not found');
      }

      // Delete physical file
      if (media.path && fs.existsSync(media.path)) {
        fs.unlinkSync(media.path);
      }

      // Delete database record
      await media.destroy();
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete media: ${error.message}`);
    }
  }

  async updateMedia(id, updateData) {
    try {
      const media = await this.Media.findByPk(id);
      if (!media) throw new Error('Media not found');
      
      await media.update(updateData);
      return media;
    } catch (error) {
      throw new Error(`Failed to update media: ${error.message}`);
    }
  }

  async getMediaStats() {
    try {
      // Get total size
      const totalSize = await this.Media.sum('size') || 0;
      
      // Get total count
      const totalCount = await this.Media.count();

      // Get by type
      const { Sequelize } = require('sequelize');
      const byType = await this.Media.findAll({
        attributes: [
          'type',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
          [Sequelize.fn('SUM', Sequelize.col('size')), 'totalSize']
        ],
        group: ['type']
      });

      // Get recent uploads
      const recentUploads = await this.Media.findAll({
        limit: 10,
        order: [['createdAt', 'DESC']]
      });

      return { 
        totalSize, 
        totalCount, 
        byType, 
        recentUploads,
        averageSize: totalCount > 0 ? (totalSize / totalCount).toFixed(2) : 0
      };
    } catch (error) {
      throw new Error(`Failed to get media stats: ${error.message}`);
    }
  }

  async cleanupOrphanedFiles(days = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const orphanedFiles = await this.Media.findAll({
        where: {
          createdAt: { [Op.lt]: cutoffDate }
        }
      });
      
      let deletedCount = 0;
      
      for (const file of orphanedFiles) {
        try {
          // Delete physical file
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
          
          // Delete database record
          await file.destroy();
          deletedCount++;
        } catch (error) {
          console.warn(`Failed to delete orphaned file ${file.id}:`, error.message);
        }
      }
      
      return {
        deleted: deletedCount,
        total: orphanedFiles.length
      };
    } catch (error) {
      throw new Error(`Failed to cleanup orphaned files: ${error.message}`);
    }
  }

  async getMediaByType(type, limit = 20) {
    try {
      const media = await this.Media.findAll({
        where: { type },
        limit,
        order: [['createdAt', 'DESC']]
      });
      
      return media;
    } catch (error) {
      throw new Error(`Failed to get media by type: ${error.message}`);
    }
  }

  async addTagsToMedia(id, tags) {
    try {
      const media = await this.Media.findByPk(id);
      if (!media) throw new Error('Media not found');
      
      const existingTags = media.tags || [];
      const newTags = [...new Set([...existingTags, ...tags])];
      
      await media.update({ tags: newTags });
      return media;
    } catch (error) {
      throw new Error(`Failed to add tags to media: ${error.message}`);
    }
  }
}

module.exports = new MediaService();