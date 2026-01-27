// src/controllers/ExhibitorController.js
const exhibitorService = require('../services/ExhibitorService');

class ExhibitorController {
  // Create new exhibitor
  async createExhibitor(req, res) {
    try {
      const exhibitor = await exhibitorService.createExhibitor(req.body);
      
      res.status(201).json({
        success: true,
        data: exhibitor
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

// controllers/ExhibitorController.js - Update getAllExhibitors method
async getAllExhibitors(req, res) {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      sector, 
      status,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      includePassword = false
    } = req.query;
    
    // Only allow password inclusion for admins
    const isAdmin = req.user && req.user.role === 'admin';
    const shouldIncludePassword = isAdmin && (includePassword === 'true' || includePassword === true);
    
    console.log('🔍 GET /exhibitors called with:', {
      page, limit, search, sector, status,
      includePassword, isAdmin, shouldIncludePassword,
      user: req.user ? { id: req.user.id, role: req.user.role, email: req.user.email } : 'no user'
    });
    
    // Build filter conditions
    const filters = {};
    if (search) {
      filters.search = search;
    }
    if (sector && sector !== 'all') {
      filters.sector = sector;
    }
    if (status && status !== 'all') {
      filters.status = status;
    }
    
    console.log('📊 Calling exhibitorService.getAllExhibitors with:', {
      filters, page, limit, shouldIncludePassword
    });
    
    // Get exhibitors with optional password inclusion
    const result = await exhibitorService.getAllExhibitors(
      filters, 
      parseInt(page), 
      parseInt(limit),
      shouldIncludePassword
    );
    
    console.log('✅ Service returned:', {
      hasResult: !!result,
      exhibitorCount: result ? result.exhibitors.length : 0,
      total: result ? result.total : 0,
      firstExhibitor: result && result.exhibitors.length > 0 ? {
        id: result.exhibitors[0].id,
        name: result.exhibitors[0].name,
        email: result.exhibitors[0].email,
        company: result.exhibitors[0].company,
        hasPassword: 'password' in result.exhibitors[0],
        password: result.exhibitors[0].password ? '******' : 'none'
      } : 'no exhibitors'
    });
    
    if (!result) {
      return res.status(200).json({
        success: true,
        data: {
          data: [], // Using 'data' as the frontend expects
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0
        }
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        data: result.exhibitors, // Changed from 'exhibitors' to 'data'
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching exhibitors:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

  // Get single exhibitor by ID with all details
  async getExhibitor(req, res) {
    try {
      const { id } = req.params;
      const { includePassword = false } = req.query;
      
      console.log(`Fetching exhibitor ${id}, includePassword: ${includePassword}`);
      
      const exhibitor = await exhibitorService.getExhibitorById(id, includePassword);
      
      if (!exhibitor) {
        return res.status(404).json({
          success: false,
          error: 'Exhibitor not found'
        });
      }
      
      // Convert to plain object if needed
      let exhibitorData = exhibitor;
      if (exhibitor.toJSON) {
        exhibitorData = exhibitor.toJSON();
      }
      
      // Include password if requested (admin only)
      if (includePassword && exhibitor.password) {
        exhibitorData.password = exhibitor.password;
      }
      
      res.status(200).json({
        success: true,
        data: exhibitorData
      });
      
    } catch (error) {
      console.error(`Error fetching exhibitor ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // Update exhibitor
  async updateExhibitor(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      console.log(`Updating exhibitor ${id}:`, updateData);
      
      const exhibitor = await exhibitorService.updateExhibitor(id, updateData);
      
      if (!exhibitor) {
        return res.status(404).json({
          success: false,
          error: 'Exhibitor not found'
        });
      }
      
      res.status(200).json({
        success: true,
        data: exhibitor
      });
      
    } catch (error) {
      console.error(`Error updating exhibitor:`, error);
      res.status(400).json({
        success: false,
        error: error.message,
        details: error.errors ? error.errors.map(e => e.message) : undefined
      });
    }
  }

  // Delete exhibitor
  async deleteExhibitor(req, res) {
    try {
      const { id } = req.params;
      
      console.log(`Deleting exhibitor ${id}`);
      
      const result = await exhibitorService.deleteExhibitor(id);
      
      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Exhibitor not found'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Exhibitor deleted successfully',
        data: result
      });
      
    } catch (error) {
      console.error(`Error deleting exhibitor ${req.params.id}:`, error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get exhibitor statistics
  async getExhibitorStats(req, res) {
    try {
      console.log('Fetching exhibitor statistics');
      
      const stats = await exhibitorService.getExhibitorStats();
      
      res.status(200).json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      console.error('Error fetching exhibitor stats:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Bulk update status
  async bulkUpdateStatus(req, res) {
    try {
      const { ids, status } = req.body;
      
      console.log('Bulk updating exhibitors:', { ids, status });
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No exhibitor IDs provided'
        });
      }
      
      if (!status || typeof status !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Invalid status provided'
        });
      }
      
      const results = await exhibitorService.bulkUpdateStatus(ids, status);
      
      res.status(200).json({
        success: true,
        data: results,
        message: `Updated ${results.length} exhibitors to ${status} status`
      });
      
    } catch (error) {
      console.error('Error in bulk update:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Export exhibitors
  async exportExhibitors(req, res) {
    try {
      const { format = 'csv' } = req.query;
      
      console.log(`Exporting exhibitors in ${format} format`);
      
      const exhibitors = await exhibitorService.getAllExhibitors({}, 1, 10000);
      
      if (format === 'csv') {
        // Generate CSV
        const header = 'ID,Name,Email,Company,Sector,Booth,Status,Registration Date,Phone,Website,Address\n';
        
        let csv = header;
        exhibitors.exhibitors.forEach(exhibitor => {
          csv += `"${exhibitor.id || ''}","${exhibitor.name || ''}","${exhibitor.email || ''}","${exhibitor.company || ''}","${exhibitor.sector || ''}","${exhibitor.boothNumber || ''}","${exhibitor.status || ''}","${exhibitor.createdAt || ''}","${exhibitor.phone || ''}","${exhibitor.website || ''}","${exhibitor.address || ''}"\n`;
        });
        
        res.header('Content-Type', 'text/csv');
        res.attachment(`exhibitors-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
        
      } else if (format === 'json') {
        res.status(200).json({
          success: true,
          data: exhibitors.exhibitors
        });
      } else {
        return res.status(400).json({
          success: false,
          error: 'Unsupported format. Use "csv" or "json"'
        });
      }
      
    } catch (error) {
      console.error('Error exporting exhibitors:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

// controllers/ExhibitorController.js
// Add this method to your existing controller

async getExhibitorsWithPasswords(req, res) {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      sector, 
      status,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;
    
    console.log('🔑 Fetching exhibitors WITH PASSWORDS (admin)');
    
    // Build filter conditions
    const filters = {};
    if (search) {
      filters.search = search;
    }
    if (sector && sector !== 'all') {
      filters.sector = sector;
    }
    if (status && status !== 'all') {
      filters.status = status;
    }
    
    console.log('Admin filters:', { page, limit, filters });
    
    // Get exhibitors with passwords using the existing service method
    // We'll modify the getAllExhibitors method to include passwords
    const result = await exhibitorService.getAllExhibitorsWithPasswords(
      filters, 
      parseInt(page), 
      parseInt(limit),
      sortBy,
      sortOrder
    );
    
    if (!result || !result.exhibitors) {
      return res.status(200).json({
        success: true,
        data: {
          exhibitors: [],
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0
        }
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        exhibitors: result.exhibitors,
        total: result.total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(result.total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching exhibitors with passwords:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch exhibitors',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
}

module.exports = new ExhibitorController();