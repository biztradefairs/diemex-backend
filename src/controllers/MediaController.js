// src/controllers/MediaController.js
const MediaService = require('../services/MediaService');
const path = require('path');
const fs = require('fs');

class MediaController {
  /**
   * Upload a single media file
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async uploadMedia(req, res) {
    try {
      // Validate file exists
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      // Extract user info from request
      const metadata = {
        userId: req.user?.id || null,
        uploadedBy: req.user?.username || req.user?.email || 'System',
        description: req.body.description || null,
        tags: req.body.tags ? JSON.parse(req.body.tags) : [],
        metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {}
      };

      // Upload media through service
      const media = await MediaService.uploadMedia(req.file, metadata);

      return res.status(201).json({
        success: true,
        data: media,
        message: 'Media uploaded successfully'
      });
    } catch (error) {
      console.error('Upload media error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Bulk upload multiple media files
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async bulkUpload(req, res) {
    try {
      // Validate files exist
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded'
        });
      }

      // Extract user info from request
      const metadata = {
        userId: req.user?.id || null,
        uploadedBy: req.user?.username || req.user?.email || 'System',
        description: req.body.description || null,
        tags: req.body.tags ? JSON.parse(req.body.tags) : [],
        metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {}
      };

      // Upload all files
      const uploadPromises = req.files.map(file => 
        MediaService.uploadMedia(file, metadata)
          .catch(err => ({ error: err.message, file: file.originalname }))
      );

      const results = await Promise.all(uploadPromises);

      // Separate successful uploads and errors
      const successfulUploads = results.filter(result => !result.error);
      const failedUploads = results.filter(result => result.error);

      return res.status(200).json({
        success: true,
        data: {
          uploaded: successfulUploads,
          failed: failedUploads
        },
        message: `Uploaded ${successfulUploads.length} files successfully, ${failedUploads.length} failed`
      });
    } catch (error) {
      console.error('Bulk upload error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get all media with pagination and filters
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getAllMedia(req, res) {
    try {
      // Extract query parameters
      const { 
        page = 1, 
        limit = 20, 
        search, 
        type, 
        userId,
        tags 
      } = req.query;

      // Build filters object
      const filters = {};
      if (search) filters.search = search;
      if (type) filters.type = type;
      if (userId) filters.userId = userId;
      if (tags) filters.tags = tags.split(',');

      // Get media from service
      const result = await MediaService.getAllMedia(
        filters, 
        parseInt(page), 
        parseInt(limit)
      );

      return res.status(200).json({
        success: true,
        data: result,
        message: 'Media retrieved successfully'
      });
    } catch (error) {
      console.error('Get all media error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get a single media by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getMedia(req, res) {
    try {
      const { id } = req.params;

      // Validate ID
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Media ID is required'
        });
      }

      // Get media from service
      const media = await MediaService.getMediaById(id);

      if (!media) {
        return res.status(404).json({
          success: false,
          error: 'Media not found'
        });
      }

      // Check permissions (users can only view their own media unless admin/editor)
      if (!['admin', 'editor'].includes(req.user.role) && media.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to view this media'
        });
      }

      return res.status(200).json({
        success: true,
        data: media,
        message: 'Media retrieved successfully'
      });
    } catch (error) {
      console.error('Get media error:', error);
      if (error.message === 'Media not found') {
        return res.status(404).json({
          success: false,
          error: 'Media not found'
        });
      }
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update media metadata
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateMedia(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Validate ID
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Media ID is required'
        });
      }

      // Validate update data
      if (!updateData || Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No update data provided'
        });
      }

      // Get current media to check permissions
      const currentMedia = await MediaService.getMediaById(id);
      
      if (!currentMedia) {
        return res.status(404).json({
          success: false,
          error: 'Media not found'
        });
      }

      // Check permissions (users can only update their own media unless admin/editor)
      if (!['admin', 'editor'].includes(req.user.role) && currentMedia.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to update this media'
        });
      }

      // Parse JSON fields if they exist
      if (updateData.tags && typeof updateData.tags === 'string') {
        updateData.tags = JSON.parse(updateData.tags);
      }
      
      if (updateData.metadata && typeof updateData.metadata === 'string') {
        updateData.metadata = JSON.parse(updateData.metadata);
      }

      // Update media
      const updatedMedia = await MediaService.updateMedia(id, updateData);

      return res.status(200).json({
        success: true,
        data: updatedMedia,
        message: 'Media updated successfully'
      });
    } catch (error) {
      console.error('Update media error:', error);
      if (error.message === 'Media not found') {
        return res.status(404).json({
          success: false,
          error: 'Media not found'
        });
      }
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Delete a media file
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deleteMedia(req, res) {
    try {
      const { id } = req.params;

      // Validate ID
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Media ID is required'
        });
      }

      // Get current media to check permissions
      const currentMedia = await MediaService.getMediaById(id);
      
      if (!currentMedia) {
        return res.status(404).json({
          success: false,
          error: 'Media not found'
        });
      }

      // Check permissions (users can only delete their own media unless admin)
      // Note: Route already restricts to admin only, but double-checking
      if (req.user.role !== 'admin' && currentMedia.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to delete this media'
        });
      }

      // Delete media
      const result = await MediaService.deleteMedia(id);

      return res.status(200).json({
        success: true,
        data: result,
        message: 'Media deleted successfully'
      });
    } catch (error) {
      console.error('Delete media error:', error);
      if (error.message === 'Media not found') {
        return res.status(404).json({
          success: false,
          error: 'Media not found'
        });
      }
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get media statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getMediaStats(req, res) {
    try {
      const stats = await MediaService.getMediaStats();

      // Format stats for better readability
      const formattedStats = {
        ...stats,
        totalSize: this.formatBytes(stats.totalSize),
        averageSize: this.formatBytes(parseFloat(stats.averageSize) || 0)
      };

      return res.status(200).json({
        success: true,
        data: formattedStats,
        message: 'Media statistics retrieved successfully'
      });
    } catch (error) {
      console.error('Get media stats error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Cleanup orphaned files
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async cleanupOrphanedFiles(req, res) {
    try {
      const { days = 7 } = req.body;

      // Validate days parameter
      if (isNaN(days) || days < 1) {
        return res.status(400).json({
          success: false,
          error: 'Days must be a positive number'
        });
      }

      // Perform cleanup
      const result = await MediaService.cleanupOrphanedFiles(parseInt(days));

      return res.status(200).json({
        success: true,
        data: result,
        message: `Cleaned up ${result.deleted} orphaned files`
      });
    } catch (error) {
      console.error('Cleanup orphaned files error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Helper method to format bytes to human readable format
   * @param {number} bytes - Bytes to format
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get media by type (not in routes but useful for internal use)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getMediaByType(req, res) {
    try {
      const { type } = req.params;
      const { limit = 20 } = req.query;

      // Validate type
      if (!type) {
        return res.status(400).json({
          success: false,
          error: 'Media type is required'
        });
      }

      const media = await MediaService.getMediaByType(type, parseInt(limit));

      return res.status(200).json({
        success: true,
        data: media,
        message: `Media of type ${type} retrieved successfully`
      });
    } catch (error) {
      console.error('Get media by type error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Add tags to media (not in routes but useful for internal use)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async addTagsToMedia(req, res) {
    try {
      const { id } = req.params;
      const { tags } = req.body;

      // Validate inputs
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Media ID is required'
        });
      }

      if (!tags || !Array.isArray(tags) || tags.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Tags array is required and must not be empty'
        });
      }

      // Add tags
      const media = await MediaService.addTagsToMedia(id, tags);

      return res.status(200).json({
        success: true,
        data: media,
        message: 'Tags added to media successfully'
      });
    } catch (error) {
      console.error('Add tags to media error:', error);
      if (error.message === 'Media not found') {
        return res.status(404).json({
          success: false,
          error: 'Media not found'
        });
      }
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new MediaController();