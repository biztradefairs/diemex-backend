// src/routes/invoiceGenerateRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authenticateAny, authorize } = require('../middleware/auth');

// =============================================
// PUBLIC / EXHIBITOR ROUTES (with authentication)
// =============================================

// Generate invoice from requirements (for exhibitors after submission)
router.post('/generate-from-requirements', authenticateAny, async (req, res) => {
  try {
    console.log('📝 Generating invoice from requirements...');
    console.log('User:', req.user);
    
    const { 
      requirementsId, 
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
    const sequelize = require('../config/database').getConnection('mysql');
    
    // Get the requirement data
    const [requirements] = await sequelize.query(`
      SELECT * FROM requirements WHERE id = ?
    `, {
      replacements: [requirementsId]
    });
    
    if (!requirements || requirements.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Requirement not found'
      });
    }
    
    const requirement = requirements[0];
    const exhibitorId = req.user?.id || requirement.exhibitorId;
    
    // Check if invoice already exists for this requirement
    let existingInvoice = null;
    try {
      const [invoices] = await sequelize.query(`
        SELECT * FROM invoices 
        WHERE JSON_EXTRACT(metadata, '$.requirementsId') = ?
        LIMIT 1
      `, {
        replacements: [requirementsId]
      });
      
      if (invoices && invoices.length > 0) {
        existingInvoice = invoices[0];
        if (existingInvoice.metadata && typeof existingInvoice.metadata === 'string') {
          existingInvoice.metadata = JSON.parse(existingInvoice.metadata);
        }
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
    
    // Create invoice number
    const finalInvoiceNumber = invoiceNumber || `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`;
    const finalIssueDate = issueDate || new Date().toISOString();
    const finalDueDate = dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    
    // Generate UUID for invoice
    const invoiceId = require('crypto').randomUUID();
    const now = new Date();
    
    // Check if invoices table has required columns
    const [columns] = await sequelize.query(`SHOW COLUMNS FROM invoices`);
    const columnNames = columns.map(c => c.Field);
    
    console.log('Available invoice columns:', columnNames);
    
    // Build insert query dynamically
const insertFields = [
  'id',
  'invoiceNumber',
  'company',
  'amount',
  'status',
  'dueDate',
  'issueDate',
  'created_at',
  'updated_at'
];

const insertValues = [
  invoiceId,
  finalInvoiceNumber,
  exhibitorInfo?.companyName || '',
  totals?.total || 0,
  'pending',
  finalDueDate,
  finalIssueDate,
  now,
  now
];
    
    // Add exhibitorId if column exists
    if (columnNames.includes('exhibitorId')) {
      insertFields.push('exhibitorId');
      insertValues.push(exhibitorId);
    }
    
    // Add items if column exists
    if (columnNames.includes('items')) {
      insertFields.push('items');
      insertValues.push(JSON.stringify(items || []));
    }
    
    // Add notes if column exists
    if (columnNames.includes('notes')) {
      insertFields.push('notes');
      insertValues.push(notes || 'Thank you for your exhibition registration');
    }
    
    // Add metadata if column exists
    if (columnNames.includes('metadata')) {
      const metadata = {
        requirementsId,
        exhibitorInfo,
        paymentInfo,
        totals,
        generatedAt: now.toISOString(),
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      };
      insertFields.push('metadata');
      insertValues.push(JSON.stringify(metadata));
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
    
    const invoice = createdInvoice[0];
    if (invoice.metadata && typeof invoice.metadata === 'string') {
      invoice.metadata = JSON.parse(invoice.metadata);
    }
    if (invoice.items && typeof invoice.items === 'string') {
      invoice.items = JSON.parse(invoice.items);
    }
    
    console.log('✅ Invoice generated successfully:', invoiceId);
    
    res.json({
      success: true,
      data: invoice,
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

// Get invoice by requirements ID (for exhibitors)
router.get('/by-requirements/:requirementsId', authenticateAny, async (req, res) => {
  try {
    const { requirementsId } = req.params;
    
    const sequelize = require('../config/database').getConnection('mysql');
    
    const [invoices] = await sequelize.query(`
      SELECT * FROM invoices 
      WHERE JSON_EXTRACT(metadata, '$.requirementsId') = ?
      ORDER BY created_at DESC
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
    
    const invoice = invoices[0];
    if (invoice.metadata && typeof invoice.metadata === 'string') {
      invoice.metadata = JSON.parse(invoice.metadata);
    }
    if (invoice.items && typeof invoice.items === 'string') {
      invoice.items = JSON.parse(invoice.items);
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

// Get my invoices (for exhibitors)
router.get('/my-invoices', authenticateAny, async (req, res) => {
  try {
    const sequelize = require('../config/database').getConnection('mysql');
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    
    let invoices = [];
    
    if (userId) {
      const [results] = await sequelize.query(`
        SELECT * FROM invoices 
        WHERE exhibitorId = ? 
        ORDER BY created_at DESC
      `, {
        replacements: [userId]
      });
      invoices = results;
    }
    
    // Also try to find by email in metadata
    if (userEmail) {
      const [emailResults] = await sequelize.query(`
        SELECT * FROM invoices 
        WHERE JSON_EXTRACT(metadata, '$.exhibitorInfo.email') = ?
        ORDER BY created_at DESC
      `, {
        replacements: [userEmail]
      });
      
      // Merge unique invoices
      const existingIds = new Set(invoices.map(i => i.id));
      for (const inv of emailResults) {
        if (!existingIds.has(inv.id)) {
          invoices.push(inv);
        }
      }
    }
    
    // Parse JSON fields
    const parsedInvoices = invoices.map(inv => {
      if (inv.metadata && typeof inv.metadata === 'string') {
        inv.metadata = JSON.parse(inv.metadata);
      }
      if (inv.items && typeof inv.items === 'string') {
        inv.items = JSON.parse(inv.items);
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

router.get('/:id/download', authenticateAny, async (req, res) => {
  try {
    const { id } = req.params;

    const sequelize = require('../config/database').getConnection('mysql');

    const [invoices] = await sequelize.query(
      `SELECT * FROM invoices WHERE id = ?`,
      { replacements: [id] }
    );

    if (!invoices.length) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const invoice = invoices[0];

    if (invoice.items && typeof invoice.items === 'string') {
      invoice.items = JSON.parse(invoice.items);
    }
    if (invoice.metadata && typeof invoice.metadata === 'string') {
      invoice.metadata = JSON.parse(invoice.metadata);
    }

    const exhibitorInfo = invoice.metadata?.exhibitorInfo || {};
    const items = invoice.items || [];

    const PDFDocument = require('pdfkit');

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`
    );

    doc.pipe(res);

    // ================= HELPERS =================
    const formatNumber = (num) =>
      (num || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    const formatDate = (d) =>
      new Date(d).toLocaleDateString('en-IN');

    // ================= CALCULATIONS =================
    let totalTaxable = 0;
    let totalGST = 0;
    let grandTotal = 0;

    items.forEach((item) => {
      const taxable = item.total || 0;
      const gst = taxable * 0.18;

      totalTaxable += taxable;
      totalGST += gst;
      grandTotal += taxable + gst;
    });

    const totalCGST = totalGST / 2;
    const totalSGST = totalGST / 2;

    // ================= HEADER =================
    let y = 50;

    doc.fontSize(16)
      .font('Helvetica-Bold')
      .fillColor('#1e3a8a')
      .text('MAXX BUSINESS MEDIA PVT. LTD.', 50, y);

    doc.fontSize(8)
      .font('Helvetica')
      .fillColor('#6b7280')
      .text('T9, Swastik Manandi Arcade', 50, y + 20)
      .text('Seshadripuram, Bengaluru', 50, y + 30)
      .text('GSTIN: 27AAAFM1234G1Z2', 50, y + 42);

    doc.fontSize(9)
      .fillColor('#374151')
      .text(`Invoice No: ${invoice.invoiceNumber}`, 350, y, { align: 'right' })
      .text(`Invoice Date: ${formatDate(invoice.issueDate)}`, 350, y + 15, { align: 'right' })
      .text(`Due Date: ${formatDate(invoice.dueDate)}`, 350, y + 30, { align: 'right' });

    doc.moveTo(50, y + 70).lineTo(550, y + 70).stroke('#e5e7eb');

    // ================= TITLE =================
    doc.fontSize(20)
      .font('Helvetica-Bold')
      .fillColor('#1e3a8a')
      .text('TAX INVOICE', 50, y + 85, { align: 'center', width: 500 });

    doc.moveTo(50, y + 110).lineTo(550, y + 110).stroke('#e5e7eb');

    // ================= BILL TO =================
    let currentY = y + 130;

    doc.fontSize(11).font('Helvetica-Bold').text('Bill To:', 50, currentY);

    currentY += 15;

    doc.fontSize(9).font('Helvetica').fillColor('#374151');

    doc.text(exhibitorInfo.companyName || 'N/A', 50, currentY);
    currentY += 14;
    doc.text(exhibitorInfo.name || 'N/A', 50, currentY);
    currentY += 14;
    doc.text(`Phone: ${exhibitorInfo.phone || 'N/A'}`, 50, currentY);
    currentY += 14;
    doc.text(`Email: ${exhibitorInfo.email || 'N/A'}`, 50, currentY);
    currentY += 14;
    doc.text(`GSTIN: ${exhibitorInfo.gstNumber || 'Not provided'}`, 50, currentY);

    // ================= TABLE =================
    let tableY = currentY + 30;

    doc.rect(50, tableY, 500, 20).fill('#e0f2fe');

    doc.fillColor('#1e3a8a')
      .font('Helvetica-Bold')
      .fontSize(9);

    doc.text('S.No', 55, tableY + 5);
    doc.text('Description', 90, tableY + 5);
    doc.text('Qty', 320, tableY + 5);
    doc.text('Price', 360, tableY + 5);
    doc.text('Taxable', 410, tableY + 5);
    doc.text('GST', 460, tableY + 5);
    doc.text('Amount', 500, tableY + 5);

    tableY += 25;

    doc.font('Helvetica').fillColor('#111827');

    items.forEach((item, index) => {
      const yPos = tableY + index * 18;

      const qty = item.quantity || 1;
      const price = item.unitPrice || 0;
      const taxable = item.total || qty * price;
      const gst = taxable * 0.18;
      const total = taxable + gst;

      doc.text(index + 1, 55, yPos);
      doc.text(item.description || 'N/A', 90, yPos, { width: 220 });
      doc.text(qty, 320, yPos);
      doc.text(formatNumber(price), 360, yPos);
      doc.text(formatNumber(taxable), 410, yPos);
      doc.text(formatNumber(gst), 460, yPos);
      doc.text(formatNumber(total), 500, yPos);
    });

    // ================= TOTAL =================
    let totalsY = tableY + items.length * 20 + 20;

    doc.fontSize(9).font('Helvetica');

    doc.text('Total Taxable Value:', 350, totalsY);
    doc.text(formatNumber(totalTaxable), 500, totalsY, { align: 'right' });

    totalsY += 15;

    doc.text('CGST (9%):', 350, totalsY);
    doc.text(formatNumber(totalCGST), 500, totalsY, { align: 'right' });

    totalsY += 15;

    doc.text('SGST (9%):', 350, totalsY);
    doc.text(formatNumber(totalSGST), 500, totalsY, { align: 'right' });

    totalsY += 15;

    doc.text('Total Tax:', 350, totalsY);
    doc.text(formatNumber(totalGST), 500, totalsY, { align: 'right' });

    totalsY += 20;

    doc.font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#1e3a8a');

    doc.text('Grand Total:', 350, totalsY);
    doc.text(formatNumber(grandTotal), 500, totalsY, { align: 'right' });

    // ================= TERMS =================
    let termsY = totalsY + 40;

    doc.fontSize(9).font('Helvetica-Bold').text('Terms & Conditions:', 50, termsY);

    termsY += 15;

    doc.fontSize(8).font('Helvetica').fillColor('#6b7280');

    [
      '1. Payment should be made to mentioned account.',
      '2. No refund after event starts.',
      '3. Disputes subject to jurisdiction.'
    ].forEach((term) => {
      doc.text(term, 50, termsY);
      termsY += 12;
    });

    doc.end();

  } catch (error) {
    console.error('PDF Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
// Get invoice with details (for exhibitors)
router.get('/:id/details', authenticateAny, async (req, res) => {
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
      paymentDetails: invoice.metadata?.paymentInfo || requirementData?.paymentDetails || {},
      totals: invoice.metadata?.totals || {
        servicesTotal: invoice.amount,
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

// Get single invoice (for exhibitors)
router.get('/:id', authenticateAny, async (req, res) => {
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
    
    res.json({
      success: true,
      data: invoice
    });
    
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Download invoice PDF (for exhibitors)
router.get('/:id/pdf', authenticateAny, async (req, res) => {
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
    
    // Get requirement data for full details
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
    
    // For now, return JSON response
    // You'll need to implement actual PDF generation
    res.json({
      success: true,
      message: 'PDF generation endpoint - implement with PDFKit',
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

// Send invoice email (for exhibitors)
router.post('/:id/send-email', authenticateAny, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }
    
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
    if (invoice.metadata && typeof invoice.metadata === 'string') {
      invoice.metadata = JSON.parse(invoice.metadata);
    }
    
    // Here you would send the actual email with PDF attachment
    // For now, just return success
    
    res.json({
      success: true,
      message: `Email sent to ${email}`,
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

// =============================================
// ADMIN ONLY ROUTES
// =============================================

// Get all invoices (admin)
router.get('/admin/all', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    
    const sequelize = require('../config/database').getConnection('mysql');
    
    let whereClause = '';
    const replacements = [];
    
    if (status && status !== 'all') {
      whereClause = 'WHERE status = ?';
      replacements.push(status);
    }
    
    if (search) {
      if (whereClause) {
        whereClause += ' AND (invoiceNumber LIKE ? OR company LIKE ?)';
      } else {
        whereClause = 'WHERE (invoiceNumber LIKE ? OR company LIKE ?)';
      }
      replacements.push(`%${search}%`, `%${search}%`);
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const [invoices] = await sequelize.query(`
      SELECT * FROM invoices 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, {
      replacements: [...replacements, parseInt(limit), offset]
    });
    
    const [totalResult] = await sequelize.query(`
      SELECT COUNT(*) as total FROM invoices ${whereClause}
    `, {
      replacements
    });
    
    const total = totalResult[0]?.total || 0;
    
    // Parse JSON fields
    const parsedInvoices = invoices.map(inv => {
      if (inv.metadata && typeof inv.metadata === 'string') {
        inv.metadata = JSON.parse(inv.metadata);
      }
      if (inv.items && typeof inv.items === 'string') {
        inv.items = JSON.parse(inv.items);
      }
      return inv;
    });
    
    res.json({
      success: true,
      data: parsedInvoices,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Error fetching all invoices:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get invoice stats (admin)
router.get('/admin/stats', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const sequelize = require('../config/database').getConnection('mysql');
    
    const [stats] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue,
        SUM(amount) as totalAmount,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paidAmount,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pendingAmount
      FROM invoices
    `);
    
    res.json({
      success: true,
      data: stats[0]
    });
    
  } catch (error) {
    console.error('Error fetching invoice stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update invoice status (admin)
router.put('/admin/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    const sequelize = require('../config/database').getConnection('mysql');
    
    await sequelize.query(`
      UPDATE invoices 
      SET status = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `, {
      replacements: [status, notes, new Date(), id]
    });
    
    const [updated] = await sequelize.query(`
      SELECT * FROM invoices WHERE id = ?
    `, {
      replacements: [id]
    });
    
    const invoice = updated[0];
    if (invoice.metadata && typeof invoice.metadata === 'string') {
      invoice.metadata = JSON.parse(invoice.metadata);
    }
    
    res.json({
      success: true,
      data: invoice,
      message: 'Invoice updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;