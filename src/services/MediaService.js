// src/services/MediaService.js
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

class MediaService {
  constructor() {
    this._mediaModel = null;
  }

  // Lazy getter for Media model
  get Media() {
    if (!this._mediaModel) {
      const modelFactory = require('../models');
      this._mediaModel = modelFactory.getModel('Media');
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

      // Send audit log
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendAuditLog('MEDIA_UPLOADED', metadata.userId, {
          mediaId: media.id,
          filename: file.originalname,
          type: media.type,
          size: file.size
        });
      } catch (kafkaError) {
        console.warn('Kafka not available for audit log:', kafkaError.message);
      }

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
      
      let query = {};
      
      if (filters.search) {
        if (process.env.DB_TYPE === 'mysql') {
          query[Op.or] = [
            { filename: { [Op.like]: `%${filters.search}%` } },
            { originalName: { [Op.like]: `%${filters.search}%` } },
            { description: { [Op.like]: `%${filters.search}%` } }
          ];
        } else {
          query.$or = [
            { filename: { $regex: filters.search, $options: 'i' } },
            { originalName: { $regex: filters.search, $options: 'i' } },
            { description: { $regex: filters.search, $options: 'i' } }
          ];
        }
      }
      
      if (filters.type && filters.type !== 'all') {
        query.type = filters.type;
      }
      
      if (filters.userId) {
        query.userId = filters.userId;
      }
      
      if (filters.tags && filters.tags.length > 0) {
        if (process.env.DB_TYPE === 'mysql') {
          query.tags = { [Op.overlap]: filters.tags };
        } else {
          query.tags = { $in: filters.tags };
        }
      }

      let media, total;
      
      if (process.env.DB_TYPE === 'mysql') {
        const result = await this.Media.findAndCountAll({
          where: query,
          limit,
          offset,
          order: [['createdAt', 'DESC']]
        });
        
        media = result.rows;
        total = result.count;
      } else {
        media = await this.Media.find(query)
          .skip(offset)
          .limit(limit)
          .sort({ createdAt: -1 });
        
        total = await this.Media.countDocuments(query);
      }

      return {
        media,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      throw new Error(`Failed to fetch media: ${error.message}`);
    }
  }

  async getMediaById(id) {
    try {
      let media;
      
      if (process.env.DB_TYPE === 'mysql') {
        media = await this.Media.findByPk(id);
      } else {
        media = await this.Media.findById(id);
      }
      
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
      let media;
      
      if (process.env.DB_TYPE === 'mysql') {
        media = await this.Media.findByPk(id);
      } else {
        media = await this.Media.findById(id);
      }
      
      if (!media) {
        throw new Error('Media not found');
      }

      // Delete physical file
      if (media.path && fs.existsSync(media.path)) {
        fs.unlinkSync(media.path);
      }

      // Delete database record
      if (process.env.DB_TYPE === 'mysql') {
        await media.destroy();
      } else {
        await this.Media.findByIdAndDelete(id);
      }

      // Send audit log
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendAuditLog('MEDIA_DELETED', media.userId, {
          mediaId: id,
          filename: media.originalName
        });
      } catch (kafkaError) {
        console.warn('Kafka not available for audit log:', kafkaError.message);
      }

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete media: ${error.message}`);
    }
  }

  async updateMedia(id, updateData) {
    try {
      let media;
      
      if (process.env.DB_TYPE === 'mysql') {
        media = await this.Media.findByPk(id);
        if (!media) throw new Error('Media not found');
        await media.update(updateData);
      } else {
        media = await this.Media.findByIdAndUpdate(
          id,
          updateData,
          { new: true, runValidators: true }
        );
        if (!media) throw new Error('Media not found');
      }

      return media;
    } catch (error) {
      throw new Error(`Failed to update media: ${error.message}`);
    }
  }

  async getMediaStats() {
    try {
      if (process.env.DB_TYPE === 'mysql') {
        const { Sequelize } = require('sequelize');
        
        const totalSize = await this.Media.sum('size') || 0;
        const totalCount = await this.Media.count();

        const byType = await this.Media.findAll({
          attributes: [
            'type',
            [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
            [Sequelize.fn('SUM', Sequelize.col('size')), 'totalSize']
          ],
          group: ['type']
        });

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
      } else {
        // MongoDB
        const totalSizeAgg = await this.Media.aggregate([
          { $group: { _id: null, total: { $sum: '$size' } } }
        ]);
        
        const byType = await this.Media.aggregate([
          { $group: { 
            _id: '$type', 
            count: { $sum: 1 }, 
            totalSize: { $sum: '$size' }
          }}
        ]);
        
        const recentUploads = await this.Media.find()
          .sort({ createdAt: -1 })
          .limit(10);
        
        const totalCount = await this.Media.countDocuments();
        const totalSize = totalSizeAgg[0]?.total || 0;

        return {
          totalSize,
          totalCount,
          byType,
          recentUploads,
          averageSize: totalCount > 0 ? (totalSize / totalCount).toFixed(2) : 0
        };
      }
    } catch (error) {
      throw new Error(`Failed to get media stats: ${error.message}`);
    }
  }

  async cleanupOrphanedFiles(days = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      let orphanedFiles = [];
      
      if (process.env.DB_TYPE === 'mysql') {
        // Find media records older than cutoff date without references
        orphanedFiles = await this.Media.findAll({
          where: {
            createdAt: { [Op.lt]: cutoffDate }
          }
        });
      } else {
        orphanedFiles = await this.Media.find({
          createdAt: { $lt: cutoffDate }
        });
      }
      
      let deletedCount = 0;
      
      for (const file of orphanedFiles) {
        try {
          // Delete physical file
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
          
          // Delete database record
          if (process.env.DB_TYPE === 'mysql') {
            await file.destroy();
          } else {
            await this.Media.findByIdAndDelete(file.id);
          }
          
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
      let media;
      
      if (process.env.DB_TYPE === 'mysql') {
        media = await this.Media.findAll({
          where: { type },
          limit,
          order: [['createdAt', 'DESC']]
        });
      } else {
        media = await this.Media.find({ type })
          .limit(limit)
          .sort({ createdAt: -1 });
      }
      
      return media;
    } catch (error) {
      throw new Error(`Failed to get media by type: ${error.message}`);
    }
  }

  async addTagsToMedia(id, tags) {
    try {
      let media;
      
      if (process.env.DB_TYPE === 'mysql') {
        media = await this.Media.findByPk(id);
        if (!media) throw new Error('Media not found');
        
        const existingTags = media.tags || [];
        const newTags = [...new Set([...existingTags, ...tags])];
        
        await media.update({ tags: newTags });
      } else {
        media = await this.Media.findByIdAndUpdate(
          id,
          { $addToSet: { tags: { $each: tags } } },
          { new: true }
        );
        if (!media) throw new Error('Media not found');
      }
      
      return media;
    } catch (error) {
      throw new Error(`Failed to add tags to media: ${error.message}`);
    }
  }
}

module.exports = new MediaService();