// src/controllers/manualController.js
const manualService = require('../services/manualService');
const { v4: uuidv4 } = require('uuid');

// In-memory storage for text sections (replace with database later)

let textSections = [
  {
    id: '1',
    title: 'Event Overview',
    content: 'Welcome to the Annual Tech Expo 2024. This event brings together industry leaders, innovators, and technology enthusiasts from around the world.',
    category: 'general',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    title: 'Setup Schedule',
    content: 'Exhibitor setup: January 28, 2024 (8:00 AM - 6:00 PM)\nEvent days: January 29-31, 2024 (9:00 AM - 5:00 PM)\nBreakdown: February 1, 2024 (8:00 AM - 6:00 PM)',
    category: 'setup',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '3',
    title: 'Rules & Regulations',
    content: '1. All displays must be within allocated stall boundaries\n2. Fire regulations must be strictly followed\n3. No amplified sound without prior approval\n4. All materials must be fire-retardant\n5. No blocking of aisles or emergency exits',
    category: 'rules',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '4',
    title: 'Contact Information',
    content: 'Event Coordinator: Sarah Johnson\nPhone: +1 (555) 123-4567\nEmail: sarah@techexpo2024.com\nEmergency Contact: Security Desk - Extension 911',
    category: 'contact',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '5',
    title: 'Electrical Requirements',
    content: 'Standard stalls include 2 power outlets (110V). Additional power requirements must be requested at least 2 weeks before the event.',
    category: 'setup',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '6',
    title: 'Shipping & Logistics',
    content: 'All shipments must arrive between January 25-27, 2024. Use the provided shipping labels and include your stall number on all packages.',
    category: 'general',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];
global.textSections = textSections;

class ManualController {
  // ==================== TEXT SECTIONS METHODS ====================

  // Get all text sections
  async getAllSections(req, res) {
    try {
      // Filter by category if provided
      let sections = textSections;
      
      if (req.query.category && req.query.category !== 'all') {
        sections = textSections.filter(s => s.category === req.query.category);
      }

      // Search if provided
      if (req.query.search) {
        const searchTerm = req.query.search.toLowerCase();
        sections = sections.filter(s => 
          s.title.toLowerCase().includes(searchTerm) || 
          s.content.toLowerCase().includes(searchTerm)
        );
      }

      res.json({
        success: true,
        data: sections,
        count: sections.length
      });
    } catch (error) {
      console.error('Error in getAllSections:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch sections',
        data: []
      });
    }
  }

  // Get single section by ID
  async getSectionById(req, res) {
    try {
      const { id } = req.params;
      
      const section = textSections.find(s => s.id === id);
      
      if (!section) {
        return res.status(404).json({
          success: false,
          message: 'Section not found'
        });
      }

      res.json({
        success: true,
        data: section
      });
    } catch (error) {
      console.error('Error in getSectionById:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch section'
      });
    }
  }

  // Create new text section
  async createSection(req, res) {
    try {
      const { title, content, category } = req.body;
      
      // Validation
      if (!title || !title.trim()) {
        return res.status(400).json({ 
          success: false, 
          message: 'Title is required' 
        });
      }

      if (!content || !content.trim()) {
        return res.status(400).json({ 
          success: false, 
          message: 'Content is required' 
        });
      }

      // Create new section
      const newSection = {
        id: uuidv4(),
        title: title.trim(),
        content: content.trim(),
        category: category || 'general',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Add to array (replace with database insert)
      textSections.push(newSection);
      
      console.log('✅ Created new section:', newSection);

      res.status(201).json({
        success: true,
        data: newSection,
        message: 'Manual section created successfully'
      });
    } catch (error) {
      console.error('❌ Error in createSection:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to create section'
      });
    }
  }

  // Update text section
  async updateSection(req, res) {
    try {
      const { id } = req.params;
      const { title, content, category } = req.body;

      // Find section
      const sectionIndex = textSections.findIndex(s => s.id === id);
      
      if (sectionIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Section not found'
        });
      }

      // Update section
      textSections[sectionIndex] = {
        ...textSections[sectionIndex],
        title: title || textSections[sectionIndex].title,
        content: content || textSections[sectionIndex].content,
        category: category || textSections[sectionIndex].category,
        updatedAt: new Date().toISOString()
      };

      res.json({
        success: true,
        data: textSections[sectionIndex],
        message: 'Section updated successfully'
      });
    } catch (error) {
      console.error('Error in updateSection:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to update section'
      });
    }
  }

  // Delete text section
  async deleteSection(req, res) {
    try {
      const { id } = req.params;

      const sectionIndex = textSections.findIndex(s => s.id === id);
      
      if (sectionIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Section not found'
        });
      }

      // Remove section
      textSections.splice(sectionIndex, 1);

      res.json({
        success: true,
        message: 'Section deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteSection:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to delete section'
      });
    }
  }

  // Bulk delete sections
  async bulkDeleteSections(req, res) {
    try {
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please provide an array of section IDs to delete'
        });
      }

      const results = [];
      const errors = [];
      
      for (const id of ids) {
        const index = textSections.findIndex(s => s.id === id);
        if (index !== -1) {
          textSections.splice(index, 1);
          results.push(id);
        } else {
          errors.push({ id, error: 'Section not found' });
        }
      }
      
      res.json({
        success: true,
        message: `Deleted ${results.length} sections, ${errors.length} failed`,
        data: {
          successful: results,
          failed: errors
        }
      });
    } catch (error) {
      console.error('Error in bulkDeleteSections:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to bulk delete sections'
      });
    }
  }

  // ==================== PDF METHODS ====================

  // Upload PDF (using existing manualService)
  async uploadPDF(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'No file uploaded' 
        });
      }

      const { title, category, description } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Title is required'
        });
      }

      console.log('Uploading PDF:', {
        title,
        category,
        file: req.file.originalname
      });

      // Use existing manualService to handle upload
      const result = await manualService.createManual(
        { 
          title: title.trim(),
          description: description || '',
          category: category || 'general',
          type: 'pdf',
          status: 'published'
        }, 
        req.file
      );

      res.status(201).json({
        success: true,
        data: result.data,
        message: 'PDF uploaded successfully'
      });
    } catch (error) {
      console.error('Error in uploadPDF:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to upload PDF'
      });
    }
  }

  // Get all PDFs
  async getAllPDFs(req, res) {
    try {
      // Get all manuals and filter for PDFs
      const result = await manualService.getAllManuals({});
      
      // You might want to add a type field to distinguish PDFs
      const pdfs = result.data.filter(manual => 
        manual.mime_type === 'application/pdf' || 
        manual.category?.toLowerCase().includes('pdf')
      );

      res.json({
        success: true,
        data: pdfs,
        count: pdfs.length
      });
    } catch (error) {
      console.error('Error in getAllPDFs:', error);
      res.status(500).json({ 
        success: false, 
        data: [],
        message: error.message || 'Failed to fetch PDFs'
      });
    }
  }

  // Get PDF by ID
  async getPDFById(req, res) {
    try {
      const { id } = req.params;
      
      const result = await manualService.getManualById(id);
      
      if (!result.data || result.data.mime_type !== 'application/pdf') {
        return res.status(404).json({
          success: false,
          message: 'PDF not found'
        });
      }

      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in getPDFById:', error);
      
      if (error.message === 'Manual not found') {
        return res.status(404).json({ 
          success: false, 
          message: 'PDF not found' 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch PDF'
      });
    }
  }

  // Delete PDF
  async deletePDF(req, res) {
    try {
      const { id } = req.params;
      
      // First check if it's a PDF
      const manual = await manualService.getManualById(id);
      
      if (!manual.data || manual.data.mime_type !== 'application/pdf') {
        return res.status(404).json({
          success: false,
          message: 'PDF not found'
        });
      }

      const result = await manualService.deleteManual(id);
      
      res.json({
        success: true,
        message: result.message || 'PDF deleted successfully'
      });
    } catch (error) {
      console.error('Error in deletePDF:', error);
      
      if (error.message === 'Manual not found') {
        return res.status(404).json({ 
          success: false, 
          message: 'PDF not found' 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to delete PDF'
      });
    }
  }

  // Download PDF
  async downloadPDF(req, res) {
    try {
      const { id } = req.params;
      
      const result = await manualService.downloadManual(id);
      
      // Redirect to the file URL or send file
      if (result.fileUrl) {
        return res.redirect(result.fileUrl);
      }

      res.json({
        success: true,
        data: {
          downloadUrl: result.downloadUrl,
          fileName: result.fileName
        }
      });
    } catch (error) {
      console.error('Error in downloadPDF:', error);
      
      if (error.message === 'Manual not found') {
        return res.status(404).json({ 
          success: false, 
          message: 'PDF not found' 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to download PDF'
      });
    }
  }

  // ==================== EXISTING METHODS ====================
  // (Keep all your existing methods here - createManual, getAllManuals, etc.)
  
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

  async getAllManuals(req, res) {
    try {
      const filters = {
        status: req.query.status,
        category: req.query.category,
        search: req.query.search
      };
      
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
        data: [],
        message: error.message || 'Failed to fetch manuals'
      });
    }
  }

  async getManual(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Manual ID is required'
        });
      }

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

  async updateManual(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Manual ID is required'
        });
      }

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

  async deleteManual(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Manual ID is required'
        });
      }

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

  async downloadManual(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Manual ID is required'
        });
      }

      const result = await manualService.downloadManual(id);
      
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

  async getPreview(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Manual ID is required'
        });
      }

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

  async getStatistics(req, res) {
    try {
      const result = await manualService.getStatistics();
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error in getStatistics:', error);
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

  async bulkDeleteManuals(req, res) {
    try {
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please provide an array of manual IDs to delete'
        });
      }

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

  async getManualsByCategory(req, res) {
    try {
      const { category } = req.params;
      
      if (!category) {
        return res.status(400).json({
          success: false,
          message: 'Category is required'
        });
      }

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

  async getRecentManuals(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 5;
      
      const result = await manualService.getAllManuals({});
      
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

  async searchManuals(req, res) {
    try {
      const { q } = req.query;
      
      if (!q) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }

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
  // Add this method to your manualController.js - this will return ALL manuals in the format your frontend expects

// Get all manuals for admin exhibition page (combines text sections and PDFs)
async getAllManualsForAdmin(req, res) {
  try {
    // 1. Get PDFs from manualService
    const pdfsResult = await manualService.getAllManuals({});
    const pdfs = pdfsResult.data || [];
    
    // 2. Get text sections from your in-memory array or database
    // Using the textSections array from your controller
    const textSections = global.textSections || []; // Make sure this is accessible
    
    // 3. Transform text sections to match the Manual interface expected by frontend
    const formattedSections = textSections.map(section => ({
      id: section.id,
      title: section.title,
      description: section.content.substring(0, 100) + (section.content.length > 100 ? '...' : ''),
      category: section.category.charAt(0).toUpperCase() + section.category.slice(1), // Capitalize first letter
      version: '1.0',
      file_path: '',
      file_name: '',
      file_size: '0 KB',
      mime_type: 'text/plain',
      last_updated: section.updatedAt || section.createdAt || new Date().toISOString().split('T')[0],
      updated_by: 'Admin',
      downloads: 0,
      status: 'published',
      metadata: {},
      type: 'section' // Add type to distinguish
    }));

    // 4. Transform PDFs to match the Manual interface
    const formattedPDFs = pdfs.map(pdf => ({
      id: pdf.id,
      title: pdf.title,
      description: pdf.description || pdf.title,
      category: pdf.category || 'General',
      version: pdf.version || '1.0',
      file_path: pdf.file_path || '',
      file_name: pdf.file_name || '',
      file_size: pdf.file_size || '0 KB',
      mime_type: pdf.mime_type || 'application/pdf',
      last_updated: pdf.last_updated || new Date().toISOString().split('T')[0],
      updated_by: pdf.updated_by || 'Admin',
      downloads: pdf.downloads || 0,
      status: pdf.status || 'published',
      metadata: pdf.metadata || {},
      type: 'pdf'
    }));

    // 5. Combine both
    const allManuals = [...formattedSections, ...formattedPDFs];

    // 6. Apply filters if any
    let filteredManuals = allManuals;
    
    if (req.query.category && req.query.category !== 'all') {
      filteredManuals = filteredManuals.filter(m => 
        m.category.toLowerCase() === req.query.category.toLowerCase()
      );
    }

    if (req.query.search) {
      const searchTerm = req.query.search.toLowerCase();
      filteredManuals = filteredManuals.filter(m => 
        m.title.toLowerCase().includes(searchTerm) || 
        m.description.toLowerCase().includes(searchTerm)
      );
    }

    // 7. Sort by last_updated (newest first)
    filteredManuals.sort((a, b) => 
      new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
    );

    res.json({
      success: true,
      data: filteredManuals,
      count: filteredManuals.length
    });

  } catch (error) {
    console.error('Error in getAllManualsForAdmin:', error);
    res.status(500).json({ 
      success: false, 
      data: [],
      message: error.message || 'Failed to fetch manuals'
    });
  }
}

// Also add this method to get statistics for admin
async getAdminStatistics(req, res) {
  try {
    // Get PDFs
    const pdfsResult = await manualService.getAllManuals({});
    const pdfs = pdfsResult.data || [];
    
    // Get text sections
    const textSections = global.textSections || [];
    
    const totalManuals = pdfs.length + textSections.length;
    const publishedManuals = pdfs.filter(p => p.status === 'published').length + 
                            textSections.filter(s => s.status !== 'draft').length;
    const draftManuals = pdfs.filter(p => p.status === 'draft').length;
    
    const totalDownloads = pdfs.reduce((sum, p) => sum + (p.downloads || 0), 0);
    
    // Category stats
    const categoryMap = new Map();
    
    [...pdfs, ...textSections].forEach(item => {
      const cat = item.category || 'General';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    });
    
    const categoryStats = Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count
    }));

    res.json({
      success: true,
      data: {
        totalManuals,
        publishedManuals,
        draftManuals,
        totalDownloads,
        categoryStats
      }
    });

  } catch (error) {
    console.error('Error in getAdminStatistics:', error);
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
  async getDownloadCount(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Manual ID is required'
        });
      }

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

module.exports = new ManualController();