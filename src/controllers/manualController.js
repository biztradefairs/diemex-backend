// src/controllers/manualController.js
const manualService = require('../services/manualService');
const path = require('path');

class ManualController {
  // Create new manual
  async createManual(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'No file uploaded' 
        });
      }

      console.log('Creating manual with data:', {
        body: req.body,
        file: {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        }
      });

      const result = await manualService.createManual(req.body, req.file);
      
      res.status(201).json({
        success: true,
        data: result.data,
        message: 'Manual created successfully'
      });
    } catch (error) {
      console.error('Error in createManual:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to create manual'
      });
    }
  }

  // Get all manuals with optional filters
  async getAllManuals(req, res) {
    try {
      const filters = {
        status: req.query.status,
        category: req.query.category,
        search: req.query.search
      };
      
      // Remove undefined filters
      Object.keys(filters).forEach(key => 
        filters[key] === undefined && delete filters[key]
      );

      console.log('Fetching manuals with filters:', filters);
      
      const result = await manualService.getAllManuals(filters);
      
      res.json({
        success: true,
        data: result.data,
        count: result.data.length,
        filters: filters
      });
    } catch (error) {
      console.error('Error in getAllManuals:', error);
      res.status(500).json({ 
        success: false, 
        data: [], // Return empty array on error
        message: error.message || 'Failed to fetch manuals'
      });
    }
  }

  // Get single manual by ID
  async getManual(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Manual ID is required'
        });
      }

      console.log('Fetching manual with ID:', id);
      
      const result = await manualService.getManualById(id);
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in getManual:', error);
      
      if (error.message === 'Manual not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch manual'
      });
    }
  }

  // Update manual
  async updateManual(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Manual ID is required'
        });
      }

      console.log('Updating manual with ID:', id);
      
      const result = await manualService.updateManual(
        id, 
        req.body, 
        req.file
      );
      
      res.json({
        success: true,
        data: result.data,
        message: 'Manual updated successfully'
      });
    } catch (error) {
      console.error('Error in updateManual:', error);
      
      if (error.message === 'Manual not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to update manual'
      });
    }
  }

  // Delete manual
  async deleteManual(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Manual ID is required'
        });
      }

      console.log('Deleting manual with ID:', id);
      
      const result = await manualService.deleteManual(id);
      
      res.json({
        success: true,
        message: result.message || 'Manual deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteManual:', error);
      
      if (error.message === 'Manual not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to delete manual'
      });
    }
  }

  // Download manual
  async downloadManual(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Manual ID is required'
        });
      }

      console.log('Downloading manual with ID:', id);
      
      const result = await manualService.downloadManual(id);
      
      // Return in the format expected by frontend
      return res.json({
        success: true,
        data: {
          downloadUrl: result.downloadUrl,
          fileName: result.fileName,
          fileUrl: result.fileUrl,
          mimeType: result.mimeType
        },
        message: 'Download ready'
      });
      
    } catch (error) {
      console.error('Error in downloadManual:', error);
      
      if (error.message === 'Manual not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to download manual'
      });
    }
  }

  // Get manual preview information
  async getPreview(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Manual ID is required'
        });
      }

      console.log('Getting preview for manual ID:', id);
      
      const manual = await manualService.getManualById(id);
      const previewUrl = manualService.getPreviewUrl(manual.data);
      
      res.json({
        success: true,
        data: {
          previewUrl,
          fileType: manual.data.mime_type,
          fileName: manual.data.file_name,
          canPreview: manual.data.mime_type === 'application/pdf' || 
                     manual.data.mime_type.startsWith('image/')
        }
      });
    } catch (error) {
      console.error('Error in getPreview:', error);
      
      if (error.message === 'Manual not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to get preview'
      });
    }
  }

  // Get statistics (public now)
  async getStatistics(req, res) {
    try {
      console.log('Fetching manual statistics');
      
      const result = await manualService.getStatistics();
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in getStatistics:', error);
      // Return default stats on error
      res.status(200).json({ 
        success: true,
        data: {
          totalManuals: 0,
          publishedManuals: 0,
          draftManuals: 0,
          totalDownloads: 0,
          categoryStats: []
        }
      });
    }
  }

  // Bulk delete manuals
  async bulkDeleteManuals(req, res) {
    try {
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please provide an array of manual IDs to delete'
        });
      }

      console.log('Bulk deleting manuals with IDs:', ids);
      
      const results = [];
      const errors = [];
      
      for (const id of ids) {
        try {
          await manualService.deleteManual(id);
          results.push(id);
        } catch (error) {
          errors.push({ id, error: error.message });
        }
      }
      
      res.json({
        success: true,
        message: `Deleted ${results.length} manuals, ${errors.length} failed`,
        data: {
          successful: results,
          failed: errors
        }
      });
    } catch (error) {
      console.error('Error in bulkDeleteManuals:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to bulk delete manuals'
      });
    }
  }

  // Update manual status
  async updateManualStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Manual ID is required'
        });
      }
      
      if (!status || !['published', 'draft'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Valid status (published/draft) is required'
        });
      }

      console.log(`Updating manual ${id} status to: ${status}`);
      
      const result = await manualService.updateManual(id, { status });
      
      res.json({
        success: true,
        data: result.data,
        message: `Manual status updated to ${status}`
      });
    } catch (error) {
      console.error('Error in updateManualStatus:', error);
      
      if (error.message === 'Manual not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to update manual status'
      });
    }
  }

  // Get manuals by category
  async getManualsByCategory(req, res) {
    try {
      const { category } = req.params;
      
      if (!category) {
        return res.status(400).json({
          success: false,
          message: 'Category is required'
        });
      }

      console.log(`Fetching manuals in category: ${category}`);
      
      const result = await manualService.getAllManuals({ category });
      
      res.json({
        success: true,
        data: result.data,
        count: result.data.length,
        category: category
      });
    } catch (error) {
      console.error('Error in getManualsByCategory:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch manuals by category'
      });
    }
  }

  // Get recent manuals
  async getRecentManuals(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 5;
      
      console.log(`Fetching ${limit} recent manuals`);
      
      const result = await manualService.getAllManuals({});
      
      // Sort by last_updated and take the most recent
      const recentManuals = result.data
        .sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated))
        .slice(0, limit);
      
      res.json({
        success: true,
        data: recentManuals,
        count: recentManuals.length
      });
    } catch (error) {
      console.error('Error in getRecentManuals:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch recent manuals'
      });
    }
  }

  // Search manuals
  async searchManuals(req, res) {
    try {
      const { q } = req.query;
      
      if (!q) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }

      console.log(`Searching manuals for: ${q}`);
      
      const result = await manualService.getAllManuals({ search: q });
      
      res.json({
        success: true,
        data: result.data,
        count: result.data.length,
        query: q
      });
    } catch (error) {
      console.error('Error in searchManuals:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to search manuals'
      });
    }
  }

  // Get manual download count
  async getDownloadCount(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Manual ID is required'
        });
      }

      console.log(`Fetching download count for manual ID: ${id}`);
      
      const manual = await manualService.getManualById(id);
      
      res.json({
        success: true,
        data: {
          manualId: id,
          title: manual.data.title,
          downloads: manual.data.downloads
        }
      });
    } catch (error) {
      console.error('Error in getDownloadCount:', error);
      
      if (error.message === 'Manual not found') {
        return res.status(404).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch download count'
      });
    }
  }
}

// Make sure to export the instance
module.exports = new ManualController();