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

// Download invoice PDF (for exhibitors) - Professional Style
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
    
    // Create PDF document
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      bufferPages: true,
      info: {
        Title: `Invoice ${invoice.invoiceNumber}`,
        Author: 'Maxx Business Media Pvt. Ltd.',
        Subject: 'Exhibition Invoice'
      }
    });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // ============= HELPER FUNCTIONS =============
    const formatCurrency = (amount) => {
      const num = amount || 0;
      return `Rs. ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
      let words = '';
      if (rupees >= 10000000) words += numToWords(Math.floor(rupees / 10000000)) + ' Crore ';
      let r = rupees % 10000000;
      if (r >= 100000) words += numToWords(Math.floor(r / 100000)) + ' Lakh ';
      r = r % 100000;
      if (r >= 1000) words += numToWords(Math.floor(r / 1000)) + ' Thousand ';
      r = r % 1000;
      if (r >= 100) words += numToWords(Math.floor(r / 100)) + ' Hundred ';
      r = r % 100;
      if (r > 0) words += numToWords(r);
      
      words = words.trim() + ' Rupees Only';
      return words;
    };
    
    // Colors
    const primaryColor = '#1e3a8a';
    const borderColor = '#e5e7eb';
    const textColor = '#1f2937';
    
    // ============= HEADER SECTION =============
    let y = 50;
    
    // LEFT COLUMN - Company Name and Address
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor(primaryColor)
       .text('MAXX BUSINESS MEDIA PVT. LTD.', 50, y);
    
    doc.fontSize(7)
       .font('Helvetica')
       .fillColor('#6b7280')
       .text('T9, Swastik Manandi Arcade, Subedar Chatram Rd,', 50, y + 18)
       .text('VV Giri Colony, Seshadripuram, Bengaluru,', 50, y + 28)
       .text('Karnataka 560020', 50, y + 38)
       .text('GSTIN: 27AAAFM1234G1Z2 | PAN: AAACB1234F', 50, y + 50);
    
    // RIGHT COLUMN - Invoice Details
    const exhibitorInfo = invoice.metadata?.exhibitorInfo || requirementData?.generalInfo || {};
    const invoiceNumber = invoice.invoiceNumber;
    
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#6b7280')
       .text(`Invoice No: ${invoiceNumber}`, 400, y, { align: 'right' })
       .text(`Invoice Date: ${formatDate(invoice.issueDate)}`, 400, y + 12, { align: 'right' })
       .text(`Due Date: ${formatDate(invoice.dueDate)}`, 400, y + 24, { align: 'right' });
    
    // Separator Line after header
    doc.strokeColor(borderColor)
       .lineWidth(1)
       .moveTo(50, y + 70)
       .lineTo(545, y + 70)
       .stroke();
    
    // ============= TAX INVOICE TITLE =============
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fillColor(primaryColor)
       .text('TAX INVOICE', 297, y + 85, { align: 'center' });
    
    // Separator Line after title
    doc.strokeColor(borderColor)
       .lineWidth(1)
       .moveTo(50, y + 105)
       .lineTo(545, y + 105)
       .stroke();
    
    // ============= BILL TO SECTION =============
    let currentY = y + 125;
    
    // Bill To Title with underline
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor(textColor)
       .text('Bill To:', 50, currentY);
    
    // Line under Bill To
    doc.strokeColor(borderColor)
       .lineWidth(0.5)
       .moveTo(50, currentY + 3)
       .lineTo(120, currentY + 3)
       .stroke();
    
    currentY += 15;
    
    // Bill To Details
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor('#4b5563');
    
    doc.text(exhibitorInfo.companyName || 'N/A', 50, currentY);
    currentY += 14;
    doc.text(exhibitorInfo.name || 'N/A', 50, currentY);
    currentY += 14;
    
    const address = exhibitorInfo.address || 'Not provided';
    if (address !== 'Not provided' && address.length > 0) {
      doc.text(address, 50, currentY, { width: 250 });
      currentY += 14;
    }
    
    doc.text(`Phone: ${exhibitorInfo.phone || 'N/A'}`, 50, currentY);
    currentY += 14;
    doc.text(`Email: ${exhibitorInfo.email || 'N/A'}`, 50, currentY);
    currentY += 14;
    doc.text(`GSTIN: ${exhibitorInfo.gstNumber || 'Not registered'}`, 50, currentY);
    currentY += 20;
    
    // ============= ITEMS TABLE =============
    const items = invoice.items || [];
    
    if (items.length === 0) {
      doc.text('No items found for this invoice', 50, currentY);
    } else {
      // Table Headers
      const colX = {
        sno: 50,
        description: 70,
        qty: 300,
        price: 350,
        taxable: 400,
        gst: 450,
        amount: 500
      };
      
      // Header background
      doc.rect(50, currentY - 3, 495, 18).fill('#f0f9ff');
      doc.fillColor(primaryColor);
      doc.fontSize(8).font('Helvetica-Bold');
      
      doc.text('S.No', colX.sno, currentY);
      doc.text('Description', colX.description, currentY, { width: 225 });
      doc.text('Qty', colX.qty, currentY);
      doc.text('Price', colX.price, currentY);
      doc.text('Taxable', colX.taxable, currentY);
      doc.text('GST', colX.gst, currentY);
      doc.text('Amount', colX.amount, currentY);
      
      doc.fillColor(textColor);
      
      // Table Rows
      let tableY = currentY + 18;
      let totalTaxable = 0;
      let totalCGST = 0;
      let totalSGST = 0;
      let totalAmount = 0;
      
      items.forEach((item, index) => {
        const quantity = item.quantity || 1;
        const price = item.unitPrice || 0;
        const taxable = item.total || (quantity * price);
        const gstAmount = taxable * 0.18;
        const cgst = gstAmount / 2;
        const sgst = gstAmount / 2;
        const total = taxable + gstAmount;
        
        totalTaxable += taxable;
        totalCGST += cgst;
        totalSGST += sgst;
        totalAmount += total;
        
        doc.fontSize(8).font('Helvetica');
        doc.text((index + 1).toString(), colX.sno, tableY);
        doc.text(item.description || 'N/A', colX.description, tableY, { width: 225 });
        doc.text(quantity.toString(), colX.qty, tableY);
        doc.text(formatNumber(price), colX.price, tableY);
        doc.text(formatNumber(taxable), colX.taxable, tableY);
        doc.text(formatNumber(gstAmount), colX.gst, tableY);
        doc.text(formatNumber(total), colX.amount, tableY);
        
        tableY += 16;
        
        if (tableY > 700) {
          doc.addPage();
          tableY = 50;
          // Re-draw headers on new page
          doc.rect(50, tableY - 3, 495, 18).fill('#f0f9ff');
          doc.fillColor(primaryColor);
          doc.fontSize(8).font('Helvetica-Bold');
          doc.text('S.No', colX.sno, tableY);
          doc.text('Description', colX.description, tableY, { width: 225 });
          doc.text('Qty', colX.qty, tableY);
          doc.text('Price', colX.price, tableY);
          doc.text('Taxable', colX.taxable, tableY);
          doc.text('GST', colX.gst, tableY);
          doc.text('Amount', colX.amount, tableY);
          doc.fillColor(textColor);
          tableY += 18;
        }
      });
      
      // Table Footer Line
      doc.strokeColor(borderColor)
         .lineWidth(0.5)
         .moveTo(50, tableY)
         .lineTo(545, tableY)
         .stroke();
      
      tableY += 10;
      
      // ============= TOTALS SECTION =============
      const totalGST = totalCGST + totalSGST;
      const securityDeposit = invoice.metadata?.totals?.deposit || 0;
      const grandTotal = totalAmount + securityDeposit;
      
      doc.fontSize(8);
      
      // Right-aligned totals
      const totalsStartX = 380;
      let totalsY = tableY;
      
      doc.text('Total Taxable Value:', totalsStartX, totalsY);
      doc.font('Helvetica-Bold').text(formatNumber(totalTaxable), 510, totalsY, { align: 'right' });
      doc.font('Helvetica');
      
      totalsY += 14;
      doc.text('CGST (9%):', totalsStartX, totalsY);
      doc.font('Helvetica-Bold').text(formatNumber(totalCGST), 510, totalsY, { align: 'right' });
      doc.font('Helvetica');
      
      totalsY += 14;
      doc.text('SGST (9%):', totalsStartX, totalsY);
      doc.font('Helvetica-Bold').text(formatNumber(totalSGST), 510, totalsY, { align: 'right' });
      doc.font('Helvetica');
      
      totalsY += 14;
      doc.text('Total Tax Amount:', totalsStartX, totalsY);
      doc.font('Helvetica-Bold').text(formatNumber(totalGST), 510, totalsY, { align: 'right' });
      doc.font('Helvetica');
      
      if (securityDeposit > 0) {
        totalsY += 14;
        doc.text('Security Deposit:', totalsStartX, totalsY);
        doc.font('Helvetica-Bold').text(formatNumber(securityDeposit), 510, totalsY, { align: 'right' });
        doc.font('Helvetica');
      }
      
      totalsY += 16;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryColor);
      doc.text('Grand Total:', totalsStartX, totalsY);
      doc.text(formatNumber(grandTotal), 510, totalsY, { align: 'right' });
      
      // Total in words
      doc.fontSize(7).font('Helvetica').fillColor('#4b5563');
      doc.text(`Total Amount (in words): ${numberToWords(grandTotal)}`, 50, totalsY + 12);
      
      totalsY += 45;
      
      // ============= BANK DETAILS =============
      doc.fontSize(9).font('Helvetica-Bold').fillColor(primaryColor);
      doc.text('Bank Account Details:', 50, totalsY);
      
      // Line under Bank Details
      doc.strokeColor(borderColor)
         .lineWidth(0.5)
         .moveTo(50, totalsY + 3)
         .lineTo(170, totalsY + 3)
         .stroke();
      
      const bankStartY = totalsY + 18;
      
      doc.fontSize(8).font('Helvetica').fillColor('#4b5563');
      doc.text('Account Holder:', 50, bankStartY);
      doc.font('Helvetica-Bold').text('MAXX BUSINESS MEDIA PRIVATE LIMITED', 140, bankStartY);
      doc.font('Helvetica');
      
      doc.text('Bank Name:', 50, bankStartY + 16);
      doc.font('Helvetica-Bold').text('ICICI BANK LTD.', 140, bankStartY + 16);
      doc.font('Helvetica');
      
      doc.text('Account Number:', 50, bankStartY + 32);
      doc.font('Helvetica-Bold').text('123456789012', 140, bankStartY + 32);
      doc.font('Helvetica');
      
      doc.text('IFSC Code:', 50, bankStartY + 48);
      doc.font('Helvetica-Bold').text('ICIC0001234', 140, bankStartY + 48);
      doc.font('Helvetica');
      
      doc.text('Branch:', 50, bankStartY + 64);
      doc.font('Helvetica-Bold').text('Andheri East, Mumbai', 140, bankStartY + 64);
      doc.font('Helvetica');
      
      const termsStartY = bankStartY + 90;
      
      // ============= TERMS & CONDITIONS =============
      doc.fontSize(9).font('Helvetica-Bold').fillColor(primaryColor);
      doc.text('Terms & Conditions:', 50, termsStartY);
      
      // Line under Terms
      doc.strokeColor(borderColor)
         .lineWidth(0.5)
         .moveTo(50, termsStartY + 3)
         .lineTo(170, termsStartY + 3)
         .stroke();
      
      doc.fontSize(7).font('Helvetica').fillColor('#6b7280');
      const terms = [
        '1. All payments are non-refundable after the event starts.',
        '2. Payment should be made to the mentioned account only.',
        '3. The 30-day return policy is applicable to non-broken products only.',
        '4. All disputes are subject to Mumbai jurisdiction.',
        '5. This is a computer generated invoice and does not require a physical signature.'
      ];
      
      let termsY = termsStartY + 15;
      terms.forEach(term => {
        doc.text(term, 50, termsY);
        termsY += 10;
      });
    }
    
    // ============= FOOTER =============
    const footerY = 780;
    doc.fontSize(6).fillColor('#9ca3af');
    doc.text('Thank you for your business!', 50, footerY, { align: 'center', width: 495 });
    doc.text(`Generated on ${new Date().toLocaleString()}`, 50, footerY + 10, { align: 'center', width: 495 });
    
    // Finalize PDF
    doc.end();
    
    console.log(`✅ PDF generated successfully for invoice: ${invoice.invoiceNumber}`);
    
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
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