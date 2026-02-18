// src/controllers/manualSectionController.js
const { v4: uuidv4 } = require('uuid');

class ManualSectionController {
  // Create new manual section (text only)
  async createSection(req, res) {
    try {
      const { title, content, category } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({ 
          success: false, 
          message: 'Title and content are required' 
        });
      }

      // Create section object matching your frontend ManualSection type
      const newSection = {
        id: uuidv4(),
        title,
        content, // This is the text content that will be displayed
        category: category || 'general',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Store in database (you need to implement this based on your DB)
      // await db.manualSections.insert(newSection);

      res.status(201).json({
        success: true,
        data: newSection,
        message: 'Manual section created successfully'
      });
    } catch (error) {
      console.error('Error creating manual section:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to create manual section'
      });
    }
  }

  // Get all sections for exhibitor view
  async getAllSections(req, res) {
    try {
      // Fetch from database
      // const sections = await db.manualSections.findAll();
      
      // For now, return sample data matching your frontend
      const sections = [
        {
          id: '1',
          title: 'Event Overview',
          content: 'Welcome to the Annual Tech Expo 2024. This event brings together industry leaders, innovators, and technology enthusiasts from around the world.',
          category: 'general'
        },
        {
          id: '2',
          title: 'Setup Schedule',
          content: 'Exhibitor setup: January 28, 2024 (8:00 AM - 6:00 PM)\nEvent days: January 29-31, 2024 (9:00 AM - 5:00 PM)\nBreakdown: February 1, 2024 (8:00 AM - 6:00 PM)',
          category: 'setup'
        }
      ];

      res.json({
        success: true,
        data: sections
      });
    } catch (error) {
      console.error('Error fetching sections:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch sections'
      });
    }
  }
}

module.exports = new ManualSectionController();