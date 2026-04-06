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

// Download invoice PDF (for exhibitors) - SleekBill Style
router.get('/:id/download', authenticateAny, async (req, res) => {
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
    
    // Generate PDF using PDFKit
    const PDFDocument = require('pdfkit');
    const fs = require('fs');
    const path = require('path');
    
    // Create PDF document
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      info: {
        Title: `Invoice ${invoice.invoiceNumber}`,
        Author: 'Maxx Business Media Pvt. Ltd.',
        Subject: 'Exhibition Invoice'
      }
    });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // ============= HELPER FUNCTIONS =============
    const formatCurrency = (amount) => {
      const num = amount || 0;
      return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };
    
    const formatNumber = (amount) => {
      const num = amount || 0;
      return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    
    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    };
    
    const numberToWords = (num) => {
      if (!num) return 'Zero Rupees Only';
      const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
      const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
      
      const numToWords = (n) => {
        if (n < 20) return a[n];
        return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
      };
      
      const rupees = Math.floor(num);
      const paise = Math.round((num - rupees) * 100);
      
      let words = '';
      if (rupees >= 10000000) words += numToWords(Math.floor(rupees / 10000000)) + ' Crore ';
      rupees %= 10000000;
      if (rupees >= 100000) words += numToWords(Math.floor(rupees / 100000)) + ' Lakh ';
      rupees %= 100000;
      if (rupees >= 1000) words += numToWords(Math.floor(rupees / 1000)) + ' Thousand ';
      rupees %= 1000;
      if (rupees >= 100) words += numToWords(Math.floor(rupees / 100)) + ' Hundred ';
      rupees %= 100;
      if (rupees > 0) words += numToWords(rupees);
      
      words = words.trim() + ' Rupees';
      if (paise > 0) words += ' and ' + numToWords(paise) + ' Paise';
      words += ' Only';
      
      return words;
    };
    
    // Colors
    const primaryColor = '#1e3a8a';
    const borderColor = '#e5e7eb';
    const textColor = '#1f2937';
    
    // ============= HEADER SECTION - SleekBill Style =============
    let y = 50;
    
    // Try to load and add logo (Left side)
    const logoUrl = 'https://res.cloudinary.com/deo4vpw8f/image/upload/v1774094980/speakers/avatars/suexnf73ytsmdzooski2.png';
    
    try {
      // Fetch logo from URL
      const https = require('https');
      const logoResponse = await new Promise((resolve, reject) => {
        https.get(logoUrl, (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', reject);
        });
      });
      
      // Add logo to PDF (left side)
      doc.image(logoResponse, 50, y, { width: 60, height: 60 });
    } catch (err) {
      console.log('Could not load logo, continuing without it:', err.message);
    }
    
    // Company Name and Details (Right side of logo)
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .fillColor(primaryColor)
       .text('MAXX BUSINESS MEDIA PVT. LTD.', 130, y + 5, { align: 'left' });
    
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#4b5563')
       .text('T9, Swastik Manandi Arcade, Subedar Chatram Rd,', 130, y + 28, { align: 'left' })
       .text('VV Giri Colony, Seshadripuram, Bengaluru, Karnataka 560020', 130, y + 40, { align: 'left' });
    
    doc.fontSize(7)
       .fillColor('#6b7280')
       .text('Email: info@maxxbusinessmedia.com | Phone: +91 22 1234 5678', 130, y + 55, { align: 'left' });
    
    // GST and Other IDs below company name
    doc.fontSize(6)
       .fillColor('#6b7280')
       .text('GSTIN: 27AAAFM1234G1Z2 | PAN: AAACB1234F | CIN: U12345MH2020PTC123456', 130, y + 68, { align: 'left' });
    
    // Separator Line
    doc.strokeColor(borderColor)
       .lineWidth(1)
       .moveTo(50, y + 85)
       .lineTo(545, y + 85)
       .stroke();
    
    doc.moveDown(2);
    
    // INVOICE Title
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fillColor(primaryColor)
       .text('TAX INVOICE', { align: 'center' });
    
    doc.moveDown(1);
    
    // ============= INVOICE INFO & BILL TO - Two Column Layout =============
    const infoY = doc.y;
    
    // Left Column - Invoice Details
    doc.fontSize(9)
       .font('Helvetica-Bold')
       .fillColor(textColor)
       .text('Invoice Details:', 50, infoY);
    
    doc.font('Helvetica')
       .fillColor('#4b5563');
    
    const leftX = 50;
    let leftY = infoY + 15;
    
    doc.text('Invoice No:', leftX, leftY)
       .font('Helvetica-Bold')
       .text(invoice.invoiceNumber, leftX + 70, leftY)
       .font('Helvetica');
    
    leftY += 18;
    doc.text('Invoice Date:', leftX, leftY)
       .font('Helvetica-Bold')
       .text(formatDate(invoice.issueDate), leftX + 70, leftY)
       .font('Helvetica');
    
    leftY += 18;
    doc.text('Due Date:', leftX, leftY)
       .font('Helvetica-Bold')
       .text(formatDate(invoice.dueDate), leftX + 70, leftY)
       .font('Helvetica');
    
    leftY += 18;
    doc.text('Order No:', leftX, leftY)
       .font('Helvetica-Bold')
       .text(invoice.metadata?.requirementsId?.slice(-8) || 'N/A', leftX + 70, leftY)
       .font('Helvetica');
    
    leftY += 18;
    doc.text('Order Date:', leftX, leftY)
       .font('Helvetica-Bold')
       .text(formatDate(invoice.created_at), leftX + 70, leftY)
       .font('Helvetica');
    
    // Right Column - Bill To
    const rightX = 300;
    const exhibitorInfo = invoice.metadata?.exhibitorInfo || requirementData?.generalInfo || {};
    const boothInfo = requirementData?.boothDetails || {};
    
    doc.font('Helvetica-Bold')
       .text('Bill To:', rightX, infoY);
    
    doc.font('Helvetica')
       .fillColor('#4b5563');
    
    let rightY = infoY + 15;
    doc.text(exhibitorInfo.companyName || 'N/A', rightX, rightY);
    rightY += 15;
    doc.text(exhibitorInfo.name || 'N/A', rightX, rightY);
    rightY += 15;
    doc.text(exhibitorInfo.address || 'Not provided', rightX, rightY);
    rightY += 15;
    doc.text(`Phone: ${exhibitorInfo.phone || 'N/A'}`, rightX, rightY);
    rightY += 15;
    doc.text(`Email: ${exhibitorInfo.email || 'N/A'}`, rightX, rightY);
    rightY += 15;
    doc.text(`GSTIN: ${exhibitorInfo.gstNumber || 'Not registered'}`, rightX, rightY);
    
    // Move to bottom of the taller column
    const maxY = Math.max(leftY, rightY);
    doc.y = maxY + 20;
    
    // ============= ITEMS TABLE =============
    const tableTop = doc.y;
    const items = invoice.items || [];
    
    // Calculate GST breakdown per item
    const itemsWithGST = items.map(item => {
      const taxableValue = item.total || (item.quantity * item.unitPrice);
      const gstRate = item.gstRate || 18;
      const cgst = taxableValue * (gstRate / 2) / 100;
      const sgst = taxableValue * (gstRate / 2) / 100;
      const igst = 0;
      return {
        ...item,
        taxableValue,
        gstRate,
        cgst,
        sgst,
        igst,
        totalWithGST: taxableValue + cgst + sgst
      };
    });
    
    // Table Headers
    const colPositions = {
      sno: 50,
      description: 80,
      hsn: 280,
      qty: 330,
      price: 370,
      taxable: 420,
      gst: 470,
      amount: 520
    };
    
    // Header background
    doc.rect(50, tableTop - 5, 495, 25).fill('#f0f9ff');
    doc.fillColor(primaryColor);
    
    doc.fontSize(7)
       .font('Helvetica-Bold')
       .text('S.No', colPositions.sno, tableTop)
       .text('Item Description', colPositions.description, tableTop, { width: 195 })
       .text('HSN/SAC', colPositions.hsn, tableTop)
       .text('Qty', colPositions.qty, tableTop)
       .text('Price (₹)', colPositions.price, tableTop)
       .text('Taxable (₹)', colPositions.taxable, tableTop)
       .text('GST (₹)', colPositions.gst, tableTop)
       .text('Amount (₹)', colPositions.amount, tableTop);
    
    doc.fillColor(textColor);
    
    // Table Rows
    let currentY = tableTop + 25;
    let totalTaxable = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalAmount = 0;
    
    itemsWithGST.forEach((item, index) => {
      const quantity = item.quantity || 1;
      const price = item.unitPrice || 0;
      const taxable = item.taxableValue;
      const gstAmount = item.cgst + item.sgst;
      const total = item.totalWithGST;
      
      totalTaxable += taxable;
      totalCGST += item.cgst;
      totalSGST += item.sgst;
      totalAmount += total;
      
      doc.fontSize(7)
         .font('Helvetica')
         .text((index + 1).toString(), colPositions.sno, currentY)
         .text(item.description || 'N/A', colPositions.description, currentY, { width: 190 })
         .text('', colPositions.hsn, currentY)
         .text(quantity.toString(), colPositions.qty, currentY)
         .text(formatNumber(price), colPositions.price, currentY)
         .text(formatNumber(taxable), colPositions.taxable, currentY)
         .text(formatNumber(gstAmount), colPositions.gst, currentY)
         .text(formatNumber(total), colPositions.amount, currentY);
      
      currentY += 20;
      
      doc.fillColor(textColor);
      
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
        doc.rect(50, currentY - 5, 495, 25).fill('#f0f9ff');
        doc.fillColor(primaryColor);
        doc.fontSize(7).font('Helvetica-Bold')
           .text('S.No', colPositions.sno, currentY)
           .text('Item Description', colPositions.description, currentY)
           .text('HSN/SAC', colPositions.hsn, currentY)
           .text('Qty', colPositions.qty, currentY)
           .text('Price (₹)', colPositions.price, currentY)
           .text('Taxable (₹)', colPositions.taxable, currentY)
           .text('GST (₹)', colPositions.gst, currentY)
           .text('Amount (₹)', colPositions.amount, currentY);
        doc.fillColor(textColor);
        currentY += 25;
      }
    });
    
    // Table Footer Line
    doc.strokeColor(borderColor)
       .lineWidth(0.5)
       .moveTo(50, currentY)
       .lineTo(545, currentY)
       .stroke();
    
    currentY += 10;
    
    // ============= TOTALS SECTION =============
    const totalGST = totalCGST + totalSGST;
    const securityDeposit = invoice.metadata?.totals?.deposit || 0;
    const grandTotal = totalAmount + securityDeposit;
    
    // Right-aligned totals
    const totalsX = 380;
    let totalsY = currentY;
    
    doc.fontSize(8);
    
    doc.text('Total Taxable Value:', totalsX, totalsY)
       .font('Helvetica-Bold')
       .text(formatNumber(totalTaxable), totalsX + 120, totalsY)
       .font('Helvetica');
    
    totalsY += 16;
    doc.text('CGST (9%):', totalsX, totalsY)
       .font('Helvetica-Bold')
       .text(formatNumber(totalCGST), totalsX + 120, totalsY)
       .font('Helvetica');
    
    totalsY += 16;
    doc.text('SGST (9%):', totalsX, totalsY)
       .font('Helvetica-Bold')
       .text(formatNumber(totalSGST), totalsX + 120, totalsY)
       .font('Helvetica');
    
    totalsY += 16;
    doc.text('Total Tax Amount:', totalsX, totalsY)
       .font('Helvetica-Bold')
       .text(formatNumber(totalGST), totalsX + 120, totalsY)
       .font('Helvetica');
    
    if (securityDeposit > 0) {
      totalsY += 16;
      doc.text('Security Deposit:', totalsX, totalsY)
         .font('Helvetica-Bold')
         .text(formatNumber(securityDeposit), totalsX + 120, totalsY)
         .font('Helvetica');
    }
    
    totalsY += 20;
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor(primaryColor)
       .text('Grand Total:', totalsX, totalsY)
       .text(formatNumber(grandTotal), totalsX + 120, totalsY);
    
    // Total in words
    doc.fontSize(7)
       .font('Helvetica')
       .fillColor('#4b5563')
       .text(`Total Amount (in words): ${numberToWords(grandTotal)}`, 50, totalsY + 10);
    
    totalsY += 40;
    
    // ============= BANK DETAILS SECTION =============
    doc.fontSize(8)
       .font('Helvetica-Bold')
       .fillColor(primaryColor)
       .text('Account Holder Name:', 50, totalsY);
    
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#4b5563')
       .text('MAXX BUSINESS MEDIA PRIVATE LIMITED', 160, totalsY);
    
    doc.fontSize(8)
       .font('Helvetica-Bold')
       .text('Bank Name:', 50, totalsY + 16);
    
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#4b5563')
       .text('ICICI BANK LTD.', 160, totalsY + 16);
    
    doc.fontSize(8)
       .font('Helvetica-Bold')
       .text('Account Number:', 50, totalsY + 32);
    
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#4b5563')
       .text('123456789012', 160, totalsY + 32);
    
    doc.fontSize(8)
       .font('Helvetica-Bold')
       .text('IFSC Code:', 50, totalsY + 48);
    
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#4b5563')
       .text('ICIC0001234', 160, totalsY + 48);
    
    doc.fontSize(8)
       .font('Helvetica-Bold')
       .text('Branch:', 50, totalsY + 64);
    
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#4b5563')
       .text('Andheri East, Mumbai', 160, totalsY + 64);
    
    const bankY = totalsY + 90;
    
    // ============= TERMS & CONDITIONS =============
    doc.fontSize(7)
       .font('Helvetica-Bold')
       .fillColor(primaryColor)
       .text('Terms & Conditions:', 50, bankY);
    
    doc.fontSize(6)
       .font('Helvetica')
       .fillColor('#6b7280');
    
    const terms = [
      '1. Goods once sold will not be taken back.',
      '2. Payment should be made to the mentioned account only.',
      '3. The 30-day return policy is applicable to non-broken products only.',
      '4. All disputes are subject to Mumbai jurisdiction.',
      '5. This is a computer generated invoice and does not require a physical signature.'
    ];
    
    let termsYPos = bankY + 12;
    terms.forEach(term => {
      doc.text(term, 50, termsYPos);
      termsYPos += 10;
    });
    
    // ============= NOTES SECTION =============
    if (invoice.notes || invoice.metadata?.notes) {
      termsYPos += 8;
      doc.fontSize(7)
         .font('Helvetica-Bold')
         .fillColor(primaryColor)
         .text('Notes:', 50, termsYPos);
      
      doc.fontSize(6)
         .font('Helvetica')
         .fillColor('#6b7280')
         .text(invoice.notes || invoice.metadata?.notes || '', 50, termsYPos + 12, { width: 495 });
    }
    
    // ============= FOOTER =============
    const footerY = 780;
    
    doc.fontSize(6)
       .fillColor('#9ca3af')
       .text('Thank you for your business!', 50, footerY, { align: 'center', width: 495 })
       .text(`This invoice is generated on ${new Date().toLocaleString()}`, 50, footerY + 10, { align: 'center', width: 495 });
    
    // Finalize PDF
    doc.end();
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
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