// src/controllers/manualController.js
const manualService = require('../services/manualService');

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

      const result = await manualService.createManual(req.body, req.file);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

  // Get all manuals
  async getAllManuals(req, res) {
    try {
      const filters = {
        status: req.query.status,
        category: req.query.category,
        search: req.query.search
      };
      
      const result = await manualService.getAllManuals(filters);
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

  // Get single manual
  async getManual(req, res) {
    try {
      const result = await manualService.getManualById(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(404).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

  // Update manual
  async updateManual(req, res) {
    try {
      const result = await manualService.updateManual(
        req.params.id, 
        req.body, 
        req.file
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

  // Delete manual
  async deleteManual(req, res) {
    try {
      const result = await manualService.deleteManual(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

  // Download manual
  async downloadManual(req, res) {
    try {
      const result = await manualService.downloadManual(req.params.id);
      
      // Send file for download
      res.download(
        path.join(__dirname, '..', result.filePath),
        result.fileName,
        {
          headers: {
            'Content-Type': result.mimeType
          }
        }
      );
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

  // Get statistics
  async getStatistics(req, res) {
    try {
      const result = await manualService.getStatistics();
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }
}

module.exports = new ManualController();