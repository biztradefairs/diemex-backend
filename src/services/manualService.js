// src/services/manualService.js
const Manual = require('../models/mysql/Manual');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs').promises;

class ManualService {
  // Create a new manual
  async createManual(manualData, file) {
    try {
      // Handle file upload
      const fileName = `${Date.now()}-${file.originalname}`;
      const filePath = path.join(__dirname, '../../uploads/manuals', fileName);
      
      // Save file to disk
      await fs.writeFile(filePath, file.buffer);

      const manual = await Manual.create({
        title: manualData.title,
        description: manualData.description,
        category: manualData.category,
        version: manualData.version || '1.0',
        file_path: `/uploads/manuals/${fileName}`,
        file_name: file.originalname,
        file_size: this.formatFileSize(file.size),
        mime_type: file.mimetype,
        last_updated: new Date().toISOString().split('T')[0],
        updated_by: manualData.updated_by || 'Admin',
        status: manualData.status || 'draft',
        downloads: 0,
        metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString()
        }
      });

      return { success: true, data: manual };
    } catch (error) {
      throw new Error(`Error creating manual: ${error.message}`);
    }
  }

  // Get all manuals with filters
  async getAllManuals(filters = {}) {
    try {
      const whereClause = {};

      if (filters.status) {
        whereClause.status = filters.status;
      }

      if (filters.category && filters.category !== 'all') {
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

      return { success: true, data: manuals };
    } catch (error) {
      throw new Error(`Error fetching manuals: ${error.message}`);
    }
  }

  // Get manual by ID
  async getManualById(id) {
    try {
      const manual = await Manual.findByPk(id);
      if (!manual) {
        throw new Error('Manual not found');
      }
      return { success: true, data: manual };
    } catch (error) {
      throw new Error(`Error fetching manual: ${error.message}`);
    }
  }

  // Update manual
  async updateManual(id, updateData, file = null) {
    try {
      const manual = await Manual.findByPk(id);
      if (!manual) {
        throw new Error('Manual not found');
      }

      // If new file is uploaded
      if (file) {
        // Delete old file
        const oldFilePath = path.join(__dirname, '../..', manual.file_path);
        await fs.unlink(oldFilePath).catch(() => {}); // Ignore if file doesn't exist

        // Save new file
        const fileName = `${Date.now()}-${file.originalname}`;
        const filePath = path.join(__dirname, '../../uploads/manuals', fileName);
        await fs.writeFile(filePath, file.buffer);

        updateData.file_path = `/uploads/manuals/${fileName}`;
        updateData.file_name = file.originalname;
        updateData.file_size = this.formatFileSize(file.size);
        updateData.mime_type = file.mimetype;
      }

      updateData.last_updated = new Date().toISOString().split('T')[0];
      
      await manual.update(updateData);
      return { success: true, data: manual };
    } catch (error) {
      throw new Error(`Error updating manual: ${error.message}`);
    }
  }

  // Delete manual
  async deleteManual(id) {
    try {
      const manual = await Manual.findByPk(id);
      if (!manual) {
        throw new Error('Manual not found');
      }

      // Delete file from disk
      const filePath = path.join(__dirname, '../..', manual.file_path);
      await fs.unlink(filePath).catch(() => {}); // Ignore if file doesn't exist

      await manual.destroy();
      return { success: true, message: 'Manual deleted successfully' };
    } catch (error) {
      throw new Error(`Error deleting manual: ${error.message}`);
    }
  }

  // Download manual
  async downloadManual(id) {
    try {
      const manual = await Manual.findByPk(id);
      if (!manual) {
        throw new Error('Manual not found');
      }

      // Increment download count
      await manual.increment('downloads');
      
      return { 
        success: true, 
        filePath: manual.file_path,
        fileName: manual.file_name,
        mimeType: manual.mime_type 
      };
    } catch (error) {
      throw new Error(`Error downloading manual: ${error.message}`);
    }
  }

  // Get statistics
  async getStatistics() {
    try {
      const totalManuals = await Manual.count();
      const publishedManuals = await Manual.count({ where: { status: 'published' } });
      const draftManuals = await Manual.count({ where: { status: 'draft' } });
      
      const totalDownloads = await Manual.sum('downloads');
      
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
          totalDownloads: totalDownloads || 0,
          categoryStats
        }
      };
    } catch (error) {
      throw new Error(`Error getting statistics: ${error.message}`);
    }
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