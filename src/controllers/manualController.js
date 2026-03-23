// src/controllers/manualController.js
const manualService = require('../services/manualService');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// In-memory storage for text sections
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

class ManualController {
  // ==================== TEXT SECTIONS METHODS ====================

  // Get all text sections
  async getAllSections(req, res) {
    try {
      let sections = textSections;
      
      if (req.query.category && req.query.category !== 'all') {
        sections = textSections.filter(s => s.category === req.query.category);
      }

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

      const newSection = {
        id: uuidv4(),
        title: title.trim(),
        content: content.trim(),
        category: category || 'general',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

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

      const sectionIndex = textSections.findIndex(s => s.id === id);
      
      if (sectionIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Section not found'
        });
      }

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

  // ==================== FIXED METHODS ====================

  // Get single manual by ID (combines both text sections and PDFs)
  async getManual(req, res) {
    try {
      const { id } = req.params;
      
      console.log('📡 Fetching manual with ID:', id);
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Manual ID is required'
        });
      }

      // First, try to find in text sections
      const section = textSections.find(s => s.id === id);
      
      if (section) {
        console.log('✅ Found in text sections:', section.title);
        
        // Format section to match the frontend Manual interface
        const formattedSection = {
          id: section.id,
          title: section.title,
          description: section.content,
          category: section.category.charAt(0).toUpperCase() + section.category.slice(1),
          version: '1.0',
          file_name: null,
          file_size: null,
          file_path: null,
          mime_type: 'text/plain',
          last_updated: section.updatedAt || section.createdAt,
          updated_by: 'Admin',
          downloads: 0,
          status: 'published',
          type: 'section'
        };
        
        return res.json({
          success: true,
          data: formattedSection
        });
      }

      // If not found in sections, try PDFs via manualService
      try {
        const result = await manualService.getManualById(id);
        
        if (result && result.data) {
          console.log('✅ Found in PDFs:', result.data.title);
          
          // Format PDF to match the frontend Manual interface
          const formattedPDF = {
            ...result.data,
            type: 'pdf'
          };
          
          return res.json({
            success: true,
            data: formattedPDF
          });
        }
      } catch (pdfError) {
        // PDF not found, continue to 404
        console.log('Not found in PDFs');
      }
      
      console.log('❌ Manual not found with ID:', id);
      return res.status(404).json({
        success: false,
        error: 'Manual not found'
      });
      
    } catch (error) {
      console.error('❌ Error fetching manual:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch manual'
      });
    }
  }

  // Update manual (handles both text sections and PDFs)
  async updateManual(req, res) {
    try {
      const { id } = req.params;
      const { title, description, category, version, status, updated_by } = req.body;
      const file = req.file;
      
      console.log('📤 Updating manual with ID:', id);
      console.log('Update data:', { title, description, category, version, status, hasFile: !!file });
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Manual ID is required'
        });
      }

      // First, check if it's a text section
      const sectionIndex = textSections.findIndex(s => s.id === id);
      
      if (sectionIndex !== -1) {
        // Update text section
        console.log('Updating text section');
        
        textSections[sectionIndex] = {
          ...textSections[sectionIndex],
          title: title || textSections[sectionIndex].title,
          content: description || textSections[sectionIndex].content,
          category: category ? category.toLowerCase() : textSections[sectionIndex].category,
          updatedAt: new Date().toISOString()
        };
        
        const updatedSection = textSections[sectionIndex];
        
        // Format response
        const formattedSection = {
          id: updatedSection.id,
          title: updatedSection.title,
          description: updatedSection.content,
          category: updatedSection.category.charAt(0).toUpperCase() + updatedSection.category.slice(1),
          version: '1.0',
          file_name: null,
          file_size: null,
          file_path: null,
          mime_type: 'text/plain',
          last_updated: updatedSection.updatedAt,
          updated_by: updated_by || 'Admin',
          downloads: 0,
          status: 'published',
          type: 'section'
        };
        
        return res.json({
          success: true,
          data: formattedSection,
          message: 'Section updated successfully'
        });
      }
      
      // If not a section, try to update as PDF via manualService
      try {
        const updateData = {
          title,
          description,
          category,
          version,
          status,
          updated_by
        };
        
        const result = await manualService.updateManual(id, updateData, file);
        
        if (result && result.data) {
          console.log('✅ PDF updated successfully');
          
          return res.json({
            success: true,
            data: { ...result.data, type: 'pdf' },
            message: 'Manual updated successfully'
          });
        }
      } catch (pdfError) {
        console.error('Error updating PDF:', pdfError);
        
        if (pdfError.message === 'Manual not found') {
          return res.status(404).json({
            success: false,
            error: 'Manual not found'
          });
        }
        
        throw pdfError;
      }
      
      return res.status(404).json({
        success: false,
        error: 'Manual not found'
      });
      
    } catch (error) {
      console.error('❌ Error updating manual:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update manual'
      });
    }
  }

  // Delete manual (handles both text sections and PDFs)
  async deleteManual(req, res) {
    try {
      const { id } = req.params;
      
      console.log('🗑️ Deleting manual with ID:', id);
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Manual ID is required'
        });
      }

      // Check if it's a text section
      const sectionIndex = textSections.findIndex(s => s.id === id);
      
      if (sectionIndex !== -1) {
        // Delete text section
        textSections.splice(sectionIndex, 1);
        console.log('✅ Text section deleted');
        
        return res.json({
          success: true,
          message: 'Section deleted successfully'
        });
      }
      
      // If not a section, try to delete as PDF
      try {
        await manualService.deleteManual(id);
        console.log('✅ PDF deleted successfully');
        
        return res.json({
          success: true,
          message: 'Manual deleted successfully'
        });
      } catch (pdfError) {
        if (pdfError.message === 'Manual not found') {
          return res.status(404).json({
            success: false,
            error: 'Manual not found'
          });
        }
        throw pdfError;
      }
      
    } catch (error) {
      console.error('❌ Error deleting manual:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete manual'
      });
    }
  }

  // ==================== EXISTING PDF METHODS ====================

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
        data: { ...result.data, type: 'pdf' },
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

  async getAllPDFs(req, res) {
    try {
      const result = await manualService.getAllManuals({});
      const pdfs = result.data || [];
      
      res.json({
        success: true,
        data: pdfs.map(pdf => ({ ...pdf, type: 'pdf' })),
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

  async getPDFById(req, res) {
    try {
      const { id } = req.params;
      const result = await manualService.getManualById(id);
      
      if (!result.data) {
        return res.status(404).json({
          success: false,
          message: 'PDF not found'
        });
      }

      res.json({
        success: true,
        data: { ...result.data, type: 'pdf' }
      });
    } catch (error) {
      console.error('Error in getPDFById:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch PDF'
      });
    }
  }

  async deletePDF(req, res) {
    try {
      const { id } = req.params;
      const result = await manualService.deleteManual(id);
      
      res.json({
        success: true,
        message: result.message || 'PDF deleted successfully'
      });
    } catch (error) {
      console.error('Error in deletePDF:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to delete PDF'
      });
    }
  }

  async downloadPDF(req, res) {
    try {
      const { id } = req.params;
      const result = await manualService.downloadManual(id);
      
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
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to download PDF'
      });
    }
  }

  // ==================== EXISTING METHODS ====================

  async createManual(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'No file uploaded' 
        });
      }

      const result = await manualService.createManual(req.body, req.file);
      
      res.status(201).json({
        success: true,
        data: { ...result.data, type: 'pdf' },
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

      const result = await manualService.getAllManuals(filters);
      
      res.json({
        success: true,
        data: result.data.map(manual => ({ ...manual, type: 'pdf' })),
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

  async getAllManualsForAdmin(req, res) {
    try {
      // Get PDFs from manualService
      const pdfsResult = await manualService.getAllManuals({});
      const pdfs = pdfsResult.data || [];
      
      // Get text sections
      const sections = textSections || [];
      
      // Format text sections
      const formattedSections = sections.map(section => ({
        id: section.id,
        title: section.title,
        description: section.content.substring(0, 100) + (section.content.length > 100 ? '...' : ''),
        category: section.category.charAt(0).toUpperCase() + section.category.slice(1),
        version: '1.0',
        file_name: null,
        file_size: '0 KB',
        mime_type: 'text/plain',
        last_updated: section.updatedAt || section.createdAt || new Date().toISOString(),
        updated_by: 'Admin',
        downloads: 0,
        status: 'published',
        type: 'section'
      }));

      // Format PDFs
      const formattedPDFs = pdfs.map(pdf => ({
        ...pdf,
        type: 'pdf'
      }));

      // Combine both
      let allManuals = [...formattedSections, ...formattedPDFs];

      // Apply filters
      if (req.query.category && req.query.category !== 'all') {
        const categoryLower = req.query.category.toLowerCase();
        allManuals = allManuals.filter(m => 
          m.category.toLowerCase() === categoryLower
        );
      }

      if (req.query.search) {
        const searchTerm = req.query.search.toLowerCase();
        allManuals = allManuals.filter(m => 
          m.title.toLowerCase().includes(searchTerm) || 
          (m.description && m.description.toLowerCase().includes(searchTerm))
        );
      }

      // Sort by last_updated
      allManuals.sort((a, b) => 
        new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
      );

      res.json({
        success: true,
        data: allManuals,
        count: allManuals.length
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

  async getAdminStatistics(req, res) {
    try {
      const pdfsResult = await manualService.getAllManuals({});
      const pdfs = pdfsResult.data || [];
      const sections = textSections || [];
      
      const totalManuals = pdfs.length + sections.length;
      const publishedManuals = pdfs.filter(p => p.status === 'published').length + sections.length;
      const draftManuals = pdfs.filter(p => p.status === 'draft').length;
      const totalDownloads = pdfs.reduce((sum, p) => sum + (p.downloads || 0), 0);
      
      const categoryMap = new Map();
      
      pdfs.forEach(pdf => {
        const cat = pdf.category || 'General';
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
      });
      
      sections.forEach(section => {
        const cat = section.category.charAt(0).toUpperCase() + section.category.slice(1);
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

  async downloadManual(req, res) {
    try {
      const { id } = req.params;
      const result = await manualService.downloadManual(id);
      
      return res.json({
        success: true,
        data: {
          downloadUrl: result.downloadUrl,
          fileName: result.fileName,
          fileUrl: result.fileUrl,
          mimeType: result.mimeType
        }
      });
    } catch (error) {
      console.error('Error in downloadManual:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to download manual'
      });
    }
  }

  async getPreview(req, res) {
    try {
      const { id } = req.params;
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
      
      if (!status || !['published', 'draft'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Valid status (published/draft) is required'
        });
      }

      const result = await manualService.updateManual(id, { status });
      
      res.json({
        success: true,
        data: { ...result.data, type: 'pdf' },
        message: `Manual status updated to ${status}`
      });
    } catch (error) {
      console.error('Error in updateManualStatus:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to update manual status'
      });
    }
  }

  async getManualsByCategory(req, res) {
    try {
      const { category } = req.params;
      const result = await manualService.getAllManuals({ category });
      
      res.json({
        success: true,
        data: result.data.map(manual => ({ ...manual, type: 'pdf' })),
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
        data: recentManuals.map(manual => ({ ...manual, type: 'pdf' })),
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
        data: result.data.map(manual => ({ ...manual, type: 'pdf' })),
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

  async getDownloadCount(req, res) {
    try {
      const { id } = req.params;
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
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch download count'
      });
    }
  }
}

module.exports = new ManualController();