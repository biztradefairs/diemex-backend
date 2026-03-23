// src/routes/extraRequirementsRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

// =============================================
// ADMIN ROUTES
// =============================================

// Get all extra requirements (admin)
router.get('/admin/all', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    
    const sequelize = require('../config/database').getConnection('mysql');
    
    if (!sequelize) {
      throw new Error('Database connection not available');
    }
    
    // Define the extra requirement types
    const extraTypes = [
      'furniture', 
      'av & it rentals', 
      'electrical load', 
      'hostess rates', 
      'compressed air', 
      'water connection', 
      'security guard', 
      'housekeeping', 
      'security deposit'
    ];
    
    // Build the WHERE clause for types
    const typePlaceholders = extraTypes.map(() => '?').join(',');
    let whereClause = `WHERE type IN (${typePlaceholders})`;
    const replacements = [...extraTypes];
    
    // Add status filter
    if (status && status !== 'all') {
      whereClause += ' AND status = ?';
      replacements.push(status);
    }
    
    // Add search filter
    if (search) {
      whereClause += ' AND (description LIKE ? OR data LIKE ?)';
      replacements.push(`%${search}%`, `%${search}%`);
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Get all extra requirements
    const [requirements] = await sequelize.query(`
      SELECT * FROM requirements 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, {
      replacements: [...replacements, parseInt(limit), offset]
    });
    
    // Get total count
    const [totalResult] = await sequelize.query(`
      SELECT COUNT(*) as total FROM requirements ${whereClause}
    `, {
      replacements
    });
    
    const total = totalResult[0]?.total || 0;
    
    // Parse JSON data field and group by exhibitor
    const groupedRequirements = {};
    
    for (const req of requirements) {
      let parsedData = {};
      if (req.data) {
        try {
          parsedData = typeof req.data === 'string' ? JSON.parse(req.data) : req.data;
        } catch (e) {
          console.error('Error parsing requirement data:', e);
          parsedData = {};
        }
      }
      
      const exhibitorId = req.exhibitorId;
      
      if (!groupedRequirements[exhibitorId]) {
        // Get exhibitor details
        let exhibitor = {};
        try {
          const [exhibitors] = await sequelize.query(`
            SELECT id, name, companyName, email, phone, stallNumber, contactPerson 
            FROM exhibitors 
            WHERE id = ?
          `, {
            replacements: [exhibitorId]
          });
          exhibitor = exhibitors[0] || {};
        } catch (err) {
          console.error('Error fetching exhibitor:', err);
        }
        
        groupedRequirements[exhibitorId] = {
          id: req.id,
          requirementId: req.id,
          exhibitorId: exhibitorId,
          stallNumber: exhibitor.stallNumber || parsedData?.stallNumber,
          companyName: exhibitor.companyName || exhibitor.name || parsedData?.companyName || 'Unknown Company',
          contactPerson: exhibitor.contactPerson || exhibitor.name || parsedData?.contactPerson || 'Unknown',
          email: exhibitor.email || parsedData?.email || 'unknown@email.com',
          phone: exhibitor.phone || parsedData?.phone || 'N/A',
          status: req.status,
          submittedAt: req.createdAt,
          updatedAt: req.updatedAt,
          notes: parsedData?.notes || '',
          items: [],
          metadata: {
            boothArea: parsedData?.boothArea,
            boothLocation: parsedData?.boothLocation,
            eventName: parsedData?.eventName,
            eventDate: parsedData?.eventDate,
            address: parsedData?.address
          }
        };
      }
      
      // Add item to the list
      groupedRequirements[exhibitorId].items.push({
        id: req.id,
        type: req.type,
        quantity: req.quantity || 1,
        description: req.description,
        specifications: parsedData?.specifications,
        unitPrice: req.cost,
        totalPrice: req.cost ? req.cost * (req.quantity || 1) : undefined,
        status: req.status
      });
    }
    
    const formattedRequirements = Object.values(groupedRequirements);
    
    res.json({
      success: true,
      data: formattedRequirements,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Error fetching extra requirements:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get single requirement by ID (admin)
router.get('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const sequelize = require('../config/database').getConnection('mysql');
    
    if (!sequelize) {
      throw new Error('Database connection not available');
    }
    
    // Get all requirements with this exhibitor ID or requirement ID
    let [requirements] = await sequelize.query(`
      SELECT * FROM requirements 
      WHERE id = ? OR exhibitorId = ?
      ORDER BY created_at DESC
    `, {
      replacements: [id, id]
    });
    
    if (!requirements || requirements.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Requirement not found'
      });
    }
    
    // Get exhibitor details
    const exhibitorId = requirements[0].exhibitorId;
    let exhibitor = {};
    try {
      const [exhibitors] = await sequelize.query(`
        SELECT id, name, companyName, email, phone, stallNumber, contactPerson 
        FROM exhibitors 
        WHERE id = ?
      `, {
        replacements: [exhibitorId]
      });
      exhibitor = exhibitors[0] || {};
    } catch (err) {
      console.error('Error fetching exhibitor:', err);
    }
    
    // Parse all requirement data
    const items = [];
    let combinedData = {};
    
    for (const req of requirements) {
      let parsedData = {};
      if (req.data) {
        try {
          parsedData = typeof req.data === 'string' ? JSON.parse(req.data) : req.data;
        } catch (e) {
          console.error('Error parsing requirement data:', e);
          parsedData = {};
        }
      }
      
      combinedData = { ...combinedData, ...parsedData };
      
      items.push({
        id: req.id,
        type: req.type,
        quantity: req.quantity || 1,
        description: req.description,
        specifications: parsedData?.specifications,
        unitPrice: req.cost,
        totalPrice: req.cost ? req.cost * (req.quantity || 1) : undefined,
        status: req.status
      });
    }
    
    const requirement = {
      id: requirements[0].id,
      requirementId: requirements[0].id,
      exhibitorId: exhibitorId,
      stallNumber: exhibitor.stallNumber || combinedData?.stallNumber,
      companyName: exhibitor.companyName || exhibitor.name || combinedData?.companyName || 'Unknown Company',
      contactPerson: exhibitor.contactPerson || exhibitor.name || combinedData?.contactPerson || 'Unknown',
      email: exhibitor.email || combinedData?.email || 'unknown@email.com',
      phone: exhibitor.phone || combinedData?.phone || 'N/A',
      status: requirements[0].status,
      submittedAt: requirements[0].createdAt,
      updatedAt: requirements[0].updatedAt,
      notes: combinedData?.notes || '',
      adminNotes: combinedData?.adminNotes || '',
      items: items,
      metadata: {
        boothArea: combinedData?.boothArea,
        boothLocation: combinedData?.boothLocation,
        eventName: combinedData?.eventName,
        eventDate: combinedData?.eventDate,
        address: combinedData?.address,
        city: combinedData?.city,
        state: combinedData?.state,
        pincode: combinedData?.pincode
      }
    };
    
    res.json({
      success: true,
      data: requirement
    });
    
  } catch (error) {
    console.error('Error fetching requirement details:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update requirement status (admin)
router.put('/admin/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;
    
    const sequelize = require('../config/database').getConnection('mysql');
    
    if (!sequelize) {
      throw new Error('Database connection not available');
    }
    
    // Get existing requirement to preserve data
    const [existing] = await sequelize.query(`
      SELECT * FROM requirements WHERE id = ? OR exhibitorId = ?
    `, {
      replacements: [id, id]
    });
    
    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Requirement not found'
      });
    }
    
    // Update all requirements for this exhibitor
    const exhibitorId = existing[0].exhibitorId;
    
    await sequelize.query(`
      UPDATE requirements 
      SET status = ?, updated_at = NOW()
      WHERE exhibitorId = ?
    `, {
      replacements: [status, exhibitorId]
    });
    
    // Update admin notes in the data field
    for (const req of existing) {
      let parsedData = {};
      if (req.data) {
        try {
          parsedData = typeof req.data === 'string' ? JSON.parse(req.data) : req.data;
        } catch (e) {
          parsedData = {};
        }
      }
      
      parsedData.adminNotes = adminNotes;
      parsedData.updatedBy = req.user?.id;
      parsedData.updatedAt = new Date().toISOString();
      
      await sequelize.query(`
        UPDATE requirements 
        SET data = ?, updated_at = NOW()
        WHERE id = ?
      `, {
        replacements: [JSON.stringify(parsedData), req.id]
      });
    }
    
    // Get updated requirements
    const [updated] = await sequelize.query(`
      SELECT * FROM requirements WHERE exhibitorId = ?
    `, {
      replacements: [exhibitorId]
    });
    
    // Format response
    let exhibitor = {};
    try {
      const [exhibitors] = await sequelize.query(`
        SELECT id, name, companyName, email, phone, stallNumber, contactPerson 
        FROM exhibitors 
        WHERE id = ?
      `, {
        replacements: [exhibitorId]
      });
      exhibitor = exhibitors[0] || {};
    } catch (err) {
      console.error('Error fetching exhibitor:', err);
    }
    
    const items = [];
    let combinedData = {};
    
    for (const req of updated) {
      let parsedData = {};
      if (req.data) {
        try {
          parsedData = typeof req.data === 'string' ? JSON.parse(req.data) : req.data;
        } catch (e) {
          parsedData = {};
        }
      }
      
      combinedData = { ...combinedData, ...parsedData };
      
      items.push({
        id: req.id,
        type: req.type,
        quantity: req.quantity || 1,
        description: req.description,
        status: req.status
      });
    }
    
    const requirement = {
      id: updated[0].id,
      requirementId: updated[0].id,
      exhibitorId: exhibitorId,
      stallNumber: exhibitor.stallNumber,
      companyName: exhibitor.companyName || exhibitor.name || 'Unknown',
      contactPerson: exhibitor.contactPerson || exhibitor.name || 'Unknown',
      email: exhibitor.email || 'unknown@email.com',
      phone: exhibitor.phone || 'N/A',
      status: status,
      submittedAt: updated[0].createdAt,
      updatedAt: new Date().toISOString(),
      notes: combinedData?.notes,
      adminNotes: adminNotes,
      items: items,
      metadata: {
        boothArea: combinedData?.boothArea,
        boothLocation: combinedData?.boothLocation,
        eventName: combinedData?.eventName,
        eventDate: combinedData?.eventDate
      }
    };
    
    res.json({
      success: true,
      data: requirement,
      message: 'Requirement updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating requirement:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get requirement stats (admin)
router.get('/admin/stats', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const sequelize = require('../config/database').getConnection('mysql');
    
    if (!sequelize) {
      throw new Error('Database connection not available');
    }
    
    const extraTypes = [
      'furniture', 
      'av & it rentals', 
      'electrical load', 
      'hostess rates', 
      'compressed air', 
      'water connection', 
      'security guard', 
      'housekeeping', 
      'security deposit'
    ];
    
    const typePlaceholders = extraTypes.map(() => '?').join(',');
    
    const [stats] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        COUNT(DISTINCT exhibitorId) as uniqueExhibitors
      FROM requirements
      WHERE type IN (${typePlaceholders})
    `, {
      replacements: extraTypes
    });
    
    res.json({
      success: true,
      data: stats[0] || {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        completed: 0,
        uniqueExhibitors: 0
      }
    });
    
  } catch (error) {
    console.error('Error fetching requirement stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get requirements by exhibitor (admin)
router.get('/admin/exhibitor/:exhibitorId', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { exhibitorId } = req.params;
    
    const sequelize = require('../config/database').getConnection('mysql');
    
    const [requirements] = await sequelize.query(`
      SELECT * FROM requirements 
      WHERE exhibitorId = ?
      ORDER BY created_at DESC
    `, {
      replacements: [exhibitorId]
    });
    
    // Parse JSON fields
    const parsedRequirements = requirements.map(req => {
      let parsedData = {};
      if (req.data) {
        try {
          parsedData = typeof req.data === 'string' ? JSON.parse(req.data) : req.data;
        } catch (e) {
          parsedData = {};
        }
      }
      
      return {
        ...req,
        data: parsedData
      };
    });
    
    res.json({
      success: true,
      data: parsedRequirements
    });
    
  } catch (error) {
    console.error('Error fetching exhibitor requirements:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;