// src/routes/invoiceGenerateRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

// Generate invoice from requirements
router.post('/generate-from-requirements', authenticate, async (req, res) => {
  try {
    console.log('📝 Generating invoice from requirements...');
    
    const { 
      requirementsId, 
      exhibitorId, 
      exhibitorInfo, 
      paymentInfo, 
      items, 
      totals,
      invoiceNumber,
      issueDate,
      dueDate,
      notes 
    } = req.body;
    
    if (!requirementsId) {
      return res.status(400).json({
        success: false,
        error: 'Requirements ID is required'
      });
    }
    
    const modelFactory = require('../models');
    const Invoice = modelFactory.getModel('Invoice');
    const Requirement = modelFactory.getModel('Requirement');
    
    // Check if invoice already exists for this requirement
    let existingInvoice = null;
    try {
      const sequelize = require('../config/database').getConnection('mysql');
      const [invoices] = await sequelize.query(`
        SELECT * FROM invoices 
        WHERE JSON_EXTRACT(metadata, '$.requirementsId') = ?
      `, {
        replacements: [requirementsId]
      });
      
      if (invoices && invoices.length > 0) {
        existingInvoice = invoices[0];
      }
    } catch (error) {
      console.log('No existing invoice found or metadata query failed');
    }
    
    if (existingInvoice) {
      return res.json({
        success: true,
        data: existingInvoice,
        message: 'Invoice already exists for this requirement'
      });
    }
    
    // Create invoice number if not provided
    const finalInvoiceNumber = invoiceNumber || `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`;
    const finalIssueDate = issueDate || new Date().toISOString();
    const finalDueDate = dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    
    // Create invoice data
    const invoiceData = {
      invoiceNumber: finalInvoiceNumber,
      exhibitorId: exhibitorId || req.user.id,
      company: exhibitorInfo?.companyName || '',
      amount: totals?.total || 0,
      status: 'pending',
      dueDate: finalDueDate,
      issueDate: finalIssueDate,
      items: items || [],
      notes: notes || 'Thank you for your exhibition registration',
      metadata: {
        requirementsId,
        exhibitorInfo,
        paymentInfo,
        totals,
        generatedAt: new Date().toISOString()
      }
    };
    
    console.log('Creating invoice with data:', {
      invoiceNumber: invoiceData.invoiceNumber,
      amount: invoiceData.amount,
      requirementsId
    });
    
    // Create invoice using raw SQL to avoid model issues
    const sequelize = require('../config/database').getConnection('mysql');
    const invoiceId = require('crypto').randomUUID();
    const now = new Date();
    
    // Check if invoices table has required columns
    const [columns] = await sequelize.query(`SHOW COLUMNS FROM invoices`);
    const columnNames = columns.map(c => c.Field);
    
    // Build insert query dynamically
    const insertFields = ['id', 'invoiceNumber', 'company', 'amount', 'status', 'dueDate', 'issueDate', 'createdAt', 'updatedAt'];
    const insertValues = [invoiceId, finalInvoiceNumber, invoiceData.company, invoiceData.amount, 'pending', finalDueDate, finalIssueDate, now, now];
    
    // Add exhibitorId if column exists
    if (columnNames.includes('exhibitorId')) {
      insertFields.push('exhibitorId');
      insertValues.push(invoiceData.exhibitorId);
    }
    
    // Add items if column exists
    if (columnNames.includes('items')) {
      insertFields.push('items');
      insertValues.push(JSON.stringify(items || []));
    }
    
    // Add notes if column exists
    if (columnNames.includes('notes')) {
      insertFields.push('notes');
      insertValues.push(invoiceData.notes);
    }
    
    // Add metadata if column exists
    if (columnNames.includes('metadata')) {
      insertFields.push('metadata');
      insertValues.push(JSON.stringify(invoiceData.metadata));
    }
    
    const placeholders = insertValues.map(() => '?').join(', ');
    const query = `INSERT INTO invoices (${insertFields.join(', ')}) VALUES (${placeholders})`;
    
    console.log('Executing invoice insert query');
    await sequelize.query(query, {
      replacements: insertValues
    });
    
    // Get the created invoice
    const [createdInvoice] = await sequelize.query(`
      SELECT * FROM invoices WHERE id = ?
    `, {
      replacements: [invoiceId]
    });
    
    console.log('✅ Invoice generated successfully:', invoiceId);
    
    res.json({
      success: true,
      data: createdInvoice[0] || { id: invoiceId, invoiceNumber: finalInvoiceNumber },
      message: 'Invoice generated successfully'
    });
    
  } catch (error) {
    console.error('❌ Error generating invoice:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get invoice by requirements ID
router.get('/by-requirements/:requirementsId', authenticate, async (req, res) => {
  try {
    const { requirementsId } = req.params;
    
    const sequelize = require('../config/database').getConnection('mysql');
    
    const [invoices] = await sequelize.query(`
      SELECT * FROM invoices 
      WHERE JSON_EXTRACT(metadata, '$.requirementsId') = ?
      ORDER BY createdAt DESC
      LIMIT 1
    `, {
      replacements: [requirementsId]
    });
    
    if (!invoices || invoices.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found for this requirement'
      });
    }
    
    // Parse JSON fields
    const invoice = invoices[0];
    if (invoice.items && typeof invoice.items === 'string') {
      invoice.items = JSON.parse(invoice.items);
    }
    if (invoice.metadata && typeof invoice.metadata === 'string') {
      invoice.metadata = JSON.parse(invoice.metadata);
    }
    
    res.json({
      success: true,
      data: invoice
    });
    
  } catch (error) {
    console.error('Error fetching invoice by requirements:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get invoice with details
router.get('/:id/details', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const sequelize = require('../config/database').getConnection('mysql');
    
    const [invoices] = await sequelize.query(`
      SELECT * FROM invoices WHERE id = ?
    `, {
      replacements: [id]
    });
    
    if (!invoices || invoices.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    
    const invoice = invoices[0];
    
    // Parse JSON fields
    if (invoice.items && typeof invoice.items === 'string') {
      invoice.items = JSON.parse(invoice.items);
    }
    if (invoice.metadata && typeof invoice.metadata === 'string') {
      invoice.metadata = JSON.parse(invoice.metadata);
    }
    
    // Get requirement data if available
    let requirementData = null;
    if (invoice.metadata?.requirementsId) {
      const [requirements] = await sequelize.query(`
        SELECT * FROM requirements WHERE id = ?
      `, {
        replacements: [invoice.metadata.requirementsId]
      });
      
      if (requirements && requirements.length > 0) {
        const req = requirements[0];
        if (req.data && typeof req.data === 'string') {
          requirementData = JSON.parse(req.data);
        } else {
          requirementData = req.data;
        }
      }
    }
    
    // Combine invoice with requirement data
    const fullData = {
      ...invoice,
      exhibitorDetails: invoice.metadata?.exhibitorInfo || requirementData?.generalInfo || {},
      boothDetails: requirementData?.boothDetails || {},
      services: invoice.items || [],
      paymentDetails: invoice.metadata?.paymentInfo || {},
      totals: invoice.metadata?.totals || {
        subtotal: invoice.amount,
        gst: invoice.amount * 0.18,
        total: invoice.amount
      }
    };
    
    res.json({
      success: true,
      data: fullData
    });
    
  } catch (error) {
    console.error('Error fetching invoice with details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Download invoice PDF
router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First get invoice details
    const sequelize = require('../config/database').getConnection('mysql');
    
    const [invoices] = await sequelize.query(`
      SELECT * FROM invoices WHERE id = ?
    `, {
      replacements: [id]
    });
    
    if (!invoices || invoices.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    
    const invoice = invoices[0];
    
    // Parse JSON fields
    if (invoice.items && typeof invoice.items === 'string') {
      invoice.items = JSON.parse(invoice.items);
    }
    if (invoice.metadata && typeof invoice.metadata === 'string') {
      invoice.metadata = JSON.parse(invoice.metadata);
    }
    
    // Get requirement data
    let requirementData = null;
    if (invoice.metadata?.requirementsId) {
      const [requirements] = await sequelize.query(`
        SELECT * FROM requirements WHERE id = ?
      `, {
        replacements: [invoice.metadata.requirementsId]
      });
      
      if (requirements && requirements.length > 0) {
        const req = requirements[0];
        if (req.data && typeof req.data === 'string') {
          requirementData = JSON.parse(req.data);
        } else {
          requirementData = req.data;
        }
      }
    }
    
    // Generate PDF (you'll need to implement PDF generation)
    // For now, return a simple response
    res.json({
      success: true,
      message: 'PDF generation endpoint - implement PDF generation here',
      data: {
        invoice,
        requirementData
      }
    });
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Send invoice email
router.post('/:id/send-email', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }
    
    // Get invoice details
    const sequelize = require('../config/database').getConnection('mysql');
    
    const [invoices] = await sequelize.query(`
      SELECT * FROM invoices WHERE id = ?
    `, {
      replacements: [id]
    });
    
    if (!invoices || invoices.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    
    const invoice = invoices[0];
    
    // Parse metadata
    if (invoice.metadata && typeof invoice.metadata === 'string') {
      invoice.metadata = JSON.parse(invoice.metadata);
    }
    
    // For now, just return success
    res.json({
      success: true,
      message: `Email would be sent to ${email}`,
      data: {
        to: email,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount
      }
    });
    
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get my invoices (for exhibitor)
router.get('/my-invoices', authenticate, async (req, res) => {
  try {
    const sequelize = require('../config/database').getConnection('mysql');
    
    const [invoices] = await sequelize.query(`
      SELECT * FROM invoices 
      WHERE exhibitorId = ? OR JSON_EXTRACT(metadata, '$.exhibitorInfo.email') = ?
      ORDER BY createdAt DESC
    `, {
      replacements: [req.user.id, req.user.email]
    });
    
    // Parse JSON fields
    const parsedInvoices = invoices.map(inv => {
      if (inv.items && typeof inv.items === 'string') {
        inv.items = JSON.parse(inv.items);
      }
      if (inv.metadata && typeof inv.metadata === 'string') {
        inv.metadata = JSON.parse(inv.metadata);
      }
      return inv;
    });
    
    res.json({
      success: true,
      data: parsedInvoices
    });
    
  } catch (error) {
    console.error('Error fetching my invoices:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;