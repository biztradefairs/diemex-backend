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



// Preview print route (no authentication needed, for preview only)
router.get('/preview/print', async (req, res) => {
  try {
    // In a real scenario, you'd get data from query params or session
    // For now, we'll use a sample or you can pass data via query
    const invoiceData = req.query.data ? JSON.parse(req.query.data) : {
      invoiceNumber: `PREVIEW-${Date.now()}`,
      issueDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      amount: 0,
      items: [],
      metadata: {
        exhibitorInfo: {
          companyName: 'Preview Company',
          name: 'Preview User',
          email: 'preview@example.com',
          phone: 'N/A',
          gstNumber: 'N/A'
        }
      }
    };
    
    const exhibitorInfo = invoiceData.metadata?.exhibitorInfo || {};
    const items = invoiceData.items || [];
    
    // Calculate totals
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
    
    const formatNumber = (num) => {
      return (num || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };
    
    const formatDate = (d) => {
      return new Date(d).toLocaleDateString('en-IN');
    };
    
    // Send HTML response (same HTML as your existing print route)
    res.send(`<!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Invoice Preview</title>
      <style>
        /* Same styles as your existing print route */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Helvetica', 'Arial', sans-serif;
          background: #f0f0f0;
          padding: 40px 20px;
        }
        .invoice-container {
          max-width: 900px;
          margin: 0 auto;
          background: white;
          box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        .invoice { padding: 40px; }
        .header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #1e3a8a;
        }
        .company-info h1 {
          color: #1e3a8a;
          font-size: 18px;
          margin-bottom: 8px;
        }
        .company-info p {
          color: #6b7280;
          font-size: 10px;
          margin: 2px 0;
        }
        .invoice-info { text-align: right; }
        .invoice-info p { font-size: 11px; margin: 4px 0; color: #374151; }
        .invoice-title { text-align: center; margin: 25px 0; }
        .invoice-title h2 { color: #1e3a8a; font-size: 24px; letter-spacing: 2px; }
        .bill-to {
          margin-bottom: 30px;
          padding: 15px;
          background: #f8fafc;
          border-left: 4px solid #1e3a8a;
        }
        .bill-to h3 { font-size: 13px; color: #1e3a8a; margin-bottom: 10px; }
        .bill-to p { font-size: 11px; margin: 4px 0; color: #374151; }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 25px 0;
          font-size: 11px;
        }
        .items-table th {
          background: #1e3a8a;
          color: white;
          padding: 10px 8px;
          text-align: left;
          font-weight: bold;
        }
        .items-table td {
          padding: 8px 8px;
          border-bottom: 1px solid #e5e7eb;
          color: #111827;
        }
        .items-table .text-right { text-align: right; }
        .totals { margin-top: 20px; text-align: right; }
        .totals-table { display: inline-block; width: 280px; }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          font-size: 11px;
        }
        .totals-row.grand-total {
          font-weight: bold;
          font-size: 14px;
          color: #1e3a8a;
          border-top: 2px solid #e5e7eb;
          margin-top: 8px;
          padding-top: 8px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 1px solid #e5e7eb;
        }
        .terms { font-size: 9px; color: #6b7280; }
        .terms h4 { font-size: 10px; margin-bottom: 8px; color: #374151; }
        .terms p { margin: 3px 0; }
        @media print {
          body { background: white; padding: 0; margin: 0; }
          .invoice-container { box-shadow: none; padding: 0; }
          .invoice { padding: 20px; }
          .no-print { display: none; }
          .items-table th {
            background: #1e3a8a !important;
            color: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        .print-btn { text-align: center; margin-bottom: 20px; }
        .print-btn button {
          background: #1e3a8a;
          color: white;
          border: none;
          padding: 12px 30px;
          font-size: 14px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }
        .print-btn button:hover { background: #1e40af; }
        .preview-badge {
          background: #fef3c7;
          color: #92400e;
          text-align: center;
          padding: 8px;
          font-size: 12px;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="preview-badge no-print">⚠️ PREVIEW MODE - This is not an official invoice</div>
      <div class="print-btn no-print">
        <button onclick="window.print();">🖨️ Print Preview</button>
      </div>
      
      <div class="invoice-container">
        <div class="invoice">
          <div class="header">
            <div class="company-info">
              <h1>MAXX BUSINESS MEDIA PVT. LTD.</h1>
              <p>T9, Swastik Manandi Arcade</p>
              <p>Seshadripuram, Bengaluru</p>
              <p>GSTIN: 27AAAFM1234G1Z2</p>
            </div>
            <div class="invoice-info">
              <p><strong>Invoice No:</strong> ${invoiceData.invoiceNumber}</p>
              <p><strong>Invoice Date:</strong> ${formatDate(invoiceData.issueDate)}</p>
              <p><strong>Due Date:</strong> ${formatDate(invoiceData.dueDate)}</p>
            </div>
          </div>
          
          <div class="invoice-title">
            <h2>TAX INVOICE</h2>
          </div>
          
          <div class="bill-to">
            <h3>Bill To:</h3>
            <p><strong>${exhibitorInfo.companyName || 'N/A'}</strong></p>
            <p>${exhibitorInfo.name || 'N/A'}</p>
            <p>Phone: ${exhibitorInfo.phone || 'N/A'}</p>
            <p>Email: ${exhibitorInfo.email || 'N/A'}</p>
            <p>GSTIN: ${exhibitorInfo.gstNumber || 'Not provided'}</p>
          </div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Description</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Price (₹)</th>
                <th class="text-right">Taxable (₹)</th>
                <th class="text-right">CGST (9%)</th>
                <th class="text-right">SGST (9%)</th>
                <th class="text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item, index) => {
                const qty = item.quantity || 1;
                const price = item.unitPrice || 0;
                const taxable = item.total || (qty * price);
                const gst = taxable * 0.18;
                const cgst = gst / 2;
                const sgst = gst / 2;
                const total = taxable + gst;
                return `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${item.description || 'N/A'}</td>
                    <td class="text-right">${qty}</td>
                    <td class="text-right">${formatNumber(price)}</td>
                    <td class="text-right">${formatNumber(taxable)}</td>
                    <td class="text-right">${formatNumber(cgst)}</td>
                    <td class="text-right">${formatNumber(sgst)}</td>
                    <td class="text-right">${formatNumber(total)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
           </table>
          
          <div class="totals">
            <div class="totals-table">
              <div class="totals-row">
                <span>Total Taxable Value:</span>
                <span>₹ ${formatNumber(totalTaxable)}</span>
              </div>
              <div class="totals-row">
                <span>CGST (9%):</span>
                <span>₹ ${formatNumber(totalGST / 2)}</span>
              </div>
              <div class="totals-row">
                <span>SGST (9%):</span>
                <span>₹ ${formatNumber(totalGST / 2)}</span>
              </div>
              <div class="totals-row">
                <span>Total Tax:</span>
                <span>₹ ${formatNumber(totalGST)}</span>
              </div>
              <div class="totals-row grand-total">
                <span><strong>Grand Total:</strong></span>
                <span><strong>₹ ${formatNumber(grandTotal)}</strong></span>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <div class="terms">
              <h4>Terms & Conditions:</h4>
              <p>1. Payment should be made to mentioned account.</p>
              <p>2. No refund after event starts.</p>
              <p>3. Disputes subject to jurisdiction.</p>
              <p>4. This is a computer generated invoice.</p>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>`);
    
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).send('Error generating preview');
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

doc.image('https://res.cloudinary.com/deo4vpw8f/image/upload/v1774687173/maxxlogo_lulkwh.png', 50, y, {
  width: 120
});

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

// Print-friendly HTML invoice page (for printing)
router.get('/:id/print', authenticateAny, async (req, res) => {
  try {
    const { id } = req.params;
    
    const sequelize = require('../config/database').getConnection('mysql');
    
    const [invoices] = await sequelize.query(`
      SELECT * FROM invoices WHERE id = ?
    `, {
      replacements: [id]
    });
    
    if (!invoices || invoices.length === 0) {
      return res.status(404).send('Invoice not found');
    }
    
    const invoice = invoices[0];
    
    // Parse JSON fields
    if (invoice.items && typeof invoice.items === 'string') {
      invoice.items = JSON.parse(invoice.items);
    }
    if (invoice.metadata && typeof invoice.metadata === 'string') {
      invoice.metadata = JSON.parse(invoice.metadata);
    }
    
    const exhibitorInfo = invoice.metadata?.exhibitorInfo || {};
    const items = invoice.items || [];
    
    // Calculate totals
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
    
    const formatNumber = (num) => {
      return (num || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };
    
    const formatDate = (d) => {
      return new Date(d).toLocaleDateString('en-IN');
    };
    
    // Send HTML response
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Invoice ${invoice.invoiceNumber}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            background: #f0f0f0;
            padding: 40px 20px;
          }
          
          .invoice-container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
          }
          
          .invoice {
            padding: 40px;
          }
          
          /* Header Section */
          .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e5e7eb;
          }
          
          .company-info h1 {
            color: #1e3a8a;
            font-size: 20px;
            margin-bottom: 8px;
          }
          
          .company-info p {
            color: #6b7280;
            font-size: 11px;
            margin: 2px 0;
          }
          
          .invoice-info {
            text-align: right;
          }
          
          .invoice-info p {
            font-size: 12px;
            margin: 4px 0;
            color: #374151;
          }
          
          .invoice-title {
            text-align: center;
            margin: 30px 0;
          }
          
          .invoice-title h2 {
            color: #1e3a8a;
            font-size: 28px;
            letter-spacing: 2px;
          }
          
          /* Bill To Section */
          .bill-to {
            margin-bottom: 30px;
            padding: 15px;
            background: #f9fafb;
            border-left: 4px solid #1e3a8a;
          }
          
          .bill-to h3 {
            font-size: 14px;
            color: #1e3a8a;
            margin-bottom: 10px;
          }
          
          .bill-to p {
            font-size: 12px;
            margin: 4px 0;
            color: #374151;
          }
          
          /* Table Styles */
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 30px 0;
            font-size: 12px;
          }
          
          .items-table th {
            background: #e0f2fe;
            color: #1e3a8a;
            padding: 12px 8px;
            text-align: left;
            font-weight: bold;
            border: 1px solid #cbd5e1;
          }
          
          .items-table td {
            padding: 10px 8px;
            border: 1px solid #e5e7eb;
            color: #111827;
          }
          
          .items-table .text-right {
            text-align: right;
          }
          
          /* Totals Section */
          .totals {
            margin-top: 20px;
            text-align: right;
          }
          
          .totals-table {
            display: inline-block;
            width: 300px;
          }
          
          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 12px;
          }
          
          .totals-row.grand-total {
            font-weight: bold;
            font-size: 16px;
            color: #1e3a8a;
            border-top: 2px solid #e5e7eb;
            margin-top: 10px;
            padding-top: 10px;
          }
          
          /* Footer */
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
          
          .terms {
            font-size: 10px;
            color: #6b7280;
          }
          
          .terms h4 {
            font-size: 11px;
            margin-bottom: 8px;
            color: #374151;
          }
          
          .terms p {
            margin: 4px 0;
          }
          
          /* Print Styles */
          @media print {
            body {
              background: white;
              padding: 0;
              margin: 0;
            }
            
            .invoice-container {
              box-shadow: none;
              padding: 0;
            }
            
            .invoice {
              padding: 20px;
            }
            
            .no-print {
              display: none;
            }
            
            .items-table th,
            .items-table td {
              border-color: #000 !important;
            }
          }
          
          /* Print Button */
          .print-btn {
            text-align: center;
            margin-bottom: 20px;
          }
          
          .print-btn button {
            background: #1e3a8a;
            color: white;
            border: none;
            padding: 10px 30px;
            font-size: 14px;
            border-radius: 5px;
            cursor: pointer;
          }
          
          .print-btn button:hover {
            background: #1e40af;
          }
        </style>
      </head>
      <body>
        <div class="print-btn no-print">
          <button onclick="window.print();">🖨️ Print Invoice</button>
        </div>
        
        <div class="invoice-container">
          <div class="invoice">
            <!-- Header -->
            <div class="header">
              <div class="company-info">
                <h1>MAXX BUSINESS MEDIA PVT. LTD.</h1>
                <p>T9, Swastik Manandi Arcade</p>
                <p>Seshadripuram, Bengaluru</p>
                <p>GSTIN: 27AAAFM1234G1Z2</p>
              </div>
              <div class="invoice-info">
                <p><strong>Invoice No:</strong> ${invoice.invoiceNumber}</p>
                <p><strong>Invoice Date:</strong> ${formatDate(invoice.issueDate)}</p>
                <p><strong>Due Date:</strong> ${formatDate(invoice.dueDate)}</p>
              </div>
            </div>
            
            <!-- Title -->
            <div class="invoice-title">
              <h2>TAX INVOICE</h2>
            </div>
            
            <!-- Bill To -->
            <div class="bill-to">
              <h3>Bill To:</h3>
              <p><strong>${exhibitorInfo.companyName || 'N/A'}</strong></p>
              <p>${exhibitorInfo.name || 'N/A'}</p>
              <p>Phone: ${exhibitorInfo.phone || 'N/A'}</p>
              <p>Email: ${exhibitorInfo.email || 'N/A'}</p>
              <p>GSTIN: ${exhibitorInfo.gstNumber || 'Not provided'}</p>
            </div>
            
            <!-- Items Table -->
            <table class="items-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Description</th>
                  <th class="text-right">Qty</th>
                  <th class="text-right">Price (₹)</th>
                  <th class="text-right">Taxable (₹)</th>
                  <th class="text-right">GST (₹)</th>
                  <th class="text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${items.map((item, index) => {
                  const qty = item.quantity || 1;
                  const price = item.unitPrice || 0;
                  const taxable = item.total || (qty * price);
                  const gst = taxable * 0.18;
                  const total = taxable + gst;
                  return `
                    <tr>
                      <td>${index + 1}</td>
                      <td>${item.description || 'N/A'}</td>
                      <td class="text-right">${qty}</td>
                      <td class="text-right">${formatNumber(price)}</td>
                      <td class="text-right">${formatNumber(taxable)}</td>
                      <td class="text-right">${formatNumber(gst)}</td>
                      <td class="text-right">${formatNumber(total)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
            
            <!-- Totals -->
            <div class="totals">
              <div class="totals-table">
                <div class="totals-row">
                  <span>Total Taxable Value:</span>
                  <span>₹ ${formatNumber(totalTaxable)}</span>
                </div>
                <div class="totals-row">
                  <span>CGST (9%):</span>
                  <span>₹ ${formatNumber(totalGST / 2)}</span>
                </div>
                <div class="totals-row">
                  <span>SGST (9%):</span>
                  <span>₹ ${formatNumber(totalGST / 2)}</span>
                </div>
                <div class="totals-row">
                  <span>Total Tax:</span>
                  <span>₹ ${formatNumber(totalGST)}</span>
                </div>
                <div class="totals-row grand-total">
                  <span><strong>Grand Total:</strong></span>
                  <span><strong>₹ ${formatNumber(grandTotal)}</strong></span>
                </div>
              </div>
            </div>
            
            <!-- Footer -->
            <div class="footer">
              <div class="terms">
                <h4>Terms & Conditions:</h4>
                <p>1. Payment should be made to mentioned account.</p>
                <p>2. No refund after event starts.</p>
                <p>3. Disputes subject to jurisdiction.</p>
                <p>4. This is a computer generated invoice.</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
    
  } catch (error) {
    console.error('Error generating print view:', error);
    res.status(500).send('Error generating invoice view');
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