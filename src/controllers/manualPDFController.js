// src/controllers/manualPDFController.js
const cloudinary = require('cloudinary').v2;

class ManualPDFController {
  async uploadPDF(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'No file uploaded' 
        });
      }

      const { title, category } = req.body;

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.buffer, {
        folder: 'exhibition-manuals/pdfs',
        resource_type: 'raw',
        public_id: `manual-${Date.now()}`
      });

      const pdfData = {
        id: Date.now().toString(),
        title,
        fileName: req.file.originalname,
        fileSize: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
        uploadDate: new Date().toISOString().split('T')[0],
        category,
        url: result.secure_url,
        downloads: 0
      };

      // Save to database
      // await db.manualPDFs.insert(pdfData);

      res.status(201).json({
        success: true,
        data: pdfData
      });
    } catch (error) {
      console.error('Error uploading PDF:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

  async getAllPDFs(req, res) {
    try {
      // Fetch from database
      // const pdfs = await db.manualPDFs.findAll();
      
      const pdfs = []; // Your database results
      
      res.json({
        success: true,
        data: pdfs
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }
}

module.exports = new ManualPDFController();