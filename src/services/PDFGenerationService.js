// src/services/PDFGenerationService.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PDFGenerationService {
  constructor() {
    this.fontsPath = path.join(__dirname, '../fonts');
    this.tempPath = path.join(__dirname, '../temp');
    
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempPath)) {
      fs.mkdirSync(this.tempPath, { recursive: true });
    }
  }

  /**
   * Generate Invoice PDF with all exhibitor details
   * @param {Object} invoice - Invoice data from database
   * @param {Object} requirementData - Complete requirement submission data
   * @returns {Promise<Buffer>} PDF buffer
   */
  async generateInvoicePDF(invoice, requirementData) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: `Invoice ${invoice.invoiceNumber}`,
            Author: 'DIEMEX Exhibition',
            Subject: 'Exhibition Invoice',
            Keywords: 'invoice, exhibition, payment'
          }
        });

        const chunks = [];
        
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add logo and header
        this.addHeader(doc, invoice);
        
        // Add invoice details
        this.addInvoiceDetails(doc, invoice);
        
        // Add exhibitor information
        this.addExhibitorInfo(doc, invoice, requirementData);
        
        // Add booth details
        this.addBoothDetails(doc, requirementData);
        
        // Add services table
        this.addServicesTable(doc, invoice.items || []);
        
        // Add totals
        this.addTotals(doc, invoice);
        
        // Add payment details
        this.addPaymentDetails(doc, invoice);
        
        // Add terms and conditions
        this.addTermsAndConditions(doc);
        
        // Add footer
        this.addFooter(doc);
        
        doc.end();
        
      } catch (error) {
        reject(error);
      }
    });
  }

  addHeader(doc, invoice) {
    // Logo placeholder - you can add actual logo later
    doc.rect(50, 45, 100, 40).fill('#1e3a8a');
    doc.fillColor('white')
       .fontSize(12)
       .text('DIEMEX', 55, 55, { align: 'left' })
       .fontSize(8)
       .text('Exhibition', 55, 70);
    
    // Title
    doc.fillColor('#1f2937')
       .fontSize(24)
       .font('Helvetica-Bold')
       .text('INVOICE', 400, 50, { align: 'right' });
    
    doc.moveTo(50, 100)
       .lineTo(550, 100)
       .stroke('#e5e7eb');
  }

  addInvoiceDetails(doc, invoice) {
    doc.fontSize(10)
       .fillColor('#4b5563')
       .text('Invoice Details', 50, 120, { underline: true });
    
    doc.fillColor('#111827')
       .fontSize(9);
    
    const detailsY = 140;
    doc.text(`Invoice Number:`, 50, detailsY);
    doc.font('Helvetica-Bold')
       .text(invoice.invoiceNumber, 150, detailsY);
    
    doc.font('Helvetica')
       .text(`Invoice Date:`, 50, detailsY + 15);
    doc.font('Helvetica-Bold')
       .text(new Date(invoice.issueDate).toLocaleDateString('en-IN'), 150, detailsY + 15);
    
    doc.font('Helvetica')
       .text(`Due Date:`, 50, detailsY + 30);
    doc.font('Helvetica-Bold')
       .text(new Date(invoice.dueDate).toLocaleDateString('en-IN'), 150, detailsY + 30);
    
    doc.font('Helvetica')
       .text(`Status:`, 50, detailsY + 45);
    
    const statusColor = invoice.status === 'paid' ? '#10b981' : '#f59e0b';
    doc.fillColor(statusColor)
       .font('Helvetica-Bold')
       .text(invoice.status.toUpperCase(), 150, detailsY + 45);
    
    doc.fillColor('#111827');
  }

  addExhibitorInfo(doc, invoice, requirementData) {
    doc.fontSize(10)
       .fillColor('#4b5563')
       .text('Exhibitor Information', 50, 210, { underline: true });
    
    const exhibitor = invoice.exhibitorInfo || requirementData?.generalInfo || {};
    const company = invoice.company || exhibitor.companyName || '';
    
    doc.fillColor('#111827')
       .fontSize(9);
    
    let yPos = 230;
    
    doc.font('Helvetica-Bold')
       .text('Company Name:', 50, yPos);
    doc.font('Helvetica')
       .text(company || 'Not provided', 150, yPos);
    
    yPos += 20;
    doc.font('Helvetica-Bold')
       .text('Contact Person:', 50, yPos);
    doc.font('Helvetica')
       .text(`${exhibitor.title || ''} ${exhibitor.firstName || ''} ${exhibitor.lastName || ''}`.trim() || 'Not provided', 150, yPos);
    
    yPos += 20;
    doc.font('Helvetica-Bold')
       .text('Designation:', 50, yPos);
    doc.font('Helvetica')
       .text(exhibitor.designation || 'Not provided', 150, yPos);
    
    yPos += 20;
    doc.font('Helvetica-Bold')
       .text('Mobile:', 50, yPos);
    doc.font('Helvetica')
       .text(exhibitor.mobile || 'Not provided', 150, yPos);
    
    yPos += 20;
    doc.font('Helvetica-Bold')
       .text('Email:', 50, yPos);
    doc.font('Helvetica')
       .text(exhibitor.email || 'Not provided', 150, yPos);
    
    yPos += 20;
    doc.font('Helvetica-Bold')
       .text('GST Number:', 50, yPos);
    doc.font('Helvetica')
       .text(exhibitor.gstNumber || 'Not provided', 150, yPos);
  }

  addBoothDetails(doc, requirementData) {
    const booth = requirementData?.boothDetails || {};
    const security = requirementData?.securityDeposit || {};
    
    doc.fontSize(10)
       .fillColor('#4b5563')
       .text('Booth & Security Details', 50, 360, { underline: true });
    
    doc.fillColor('#111827')
       .fontSize(9);
    
    let yPos = 380;
    
    doc.font('Helvetica-Bold')
       .text('Booth Number:', 50, yPos);
    doc.font('Helvetica')
       .text(booth.boothNo || 'Not assigned', 150, yPos);
    
    yPos += 20;
    doc.font('Helvetica-Bold')
       .text('Area Booked:', 50, yPos);
    doc.font('Helvetica')
       .text(booth.sqMtrBooked ? `${booth.sqMtrBooked} sq.m` : 'Not specified', 150, yPos);
    
    yPos += 20;
    doc.font('Helvetica-Bold')
       .text('Contractor Company:', 50, yPos);
    doc.font('Helvetica')
       .text(booth.contractorCompany || 'Not provided', 150, yPos);
    
    yPos += 20;
    doc.font('Helvetica-Bold')
       .text('Security Deposit:', 50, yPos);
    doc.font('Helvetica')
       .text(`₹${security.amountINR?.toLocaleString() || 0}`, 150, yPos);
  }

  addServicesTable(doc, items) {
    doc.fontSize(10)
       .fillColor('#4b5563')
       .text('Services & Items', 50, 460, { underline: true });
    
    const startY = 480;
    let currentY = startY;
    
    // Table headers
    doc.fillColor('#1f2937')
       .font('Helvetica-Bold')
       .fontSize(9);
    
    doc.text('Description', 50, currentY);
    doc.text('Qty', 350, currentY);
    doc.text('Unit Price', 400, currentY);
    doc.text('Total', 480, currentY);
    
    currentY += 5;
    doc.moveTo(50, currentY)
       .lineTo(550, currentY)
       .stroke('#e5e7eb');
    
    currentY += 10;
    
    // Table rows
    doc.font('Helvetica')
       .fontSize(8);
    
    if (items && items.length > 0) {
      items.forEach((item, index) => {
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }
        
        // Truncate long descriptions
        let description = item.description || 'Item';
        if (description.length > 40) {
          description = description.substring(0, 37) + '...';
        }
        
        doc.text(description, 50, currentY);
        doc.text(item.quantity?.toString() || '1', 350, currentY);
        doc.text(`₹${(item.unitPrice || 0).toLocaleString()}`, 400, currentY);
        doc.text(`₹${(item.total || 0).toLocaleString()}`, 480, currentY);
        
        currentY += 20;
      });
    } else {
      doc.text('No items listed', 50, currentY);
      currentY += 20;
    }
    
    return currentY;
  }

  addTotals(doc, invoice) {
    const totals = invoice.metadata?.totals || {};
    const itemsTotal = invoice.items?.reduce((sum, item) => sum + (item.total || 0), 0) || 0;
    const gst = totals.gst || (itemsTotal * 0.18);
    const deposit = totals.deposit || 0;
    const grandTotal = invoice.amount || (itemsTotal + gst + deposit);
    
    let yPos = 650;
    
    // Check if we need a new page
    if (yPos > 700) {
      doc.addPage();
      yPos = 50;
    }
    
    doc.fillColor('#4b5563')
       .fontSize(9);
    
    // Draw totals box
    doc.rect(350, yPos - 10, 200, 100)
       .stroke('#e5e7eb');
    
    doc.font('Helvetica')
       .text('Subtotal:', 370, yPos);
    doc.font('Helvetica-Bold')
       .text(`₹${itemsTotal.toLocaleString()}`, 500, yPos, { align: 'right' });
    
    yPos += 20;
    doc.font('Helvetica')
       .text('GST (18%):', 370, yPos);
    doc.font('Helvetica-Bold')
       .text(`₹${gst.toLocaleString()}`, 500, yPos, { align: 'right' });
    
    yPos += 20;
    doc.font('Helvetica')
       .text('Security Deposit:', 370, yPos);
    doc.font('Helvetica-Bold')
       .text(`₹${deposit.toLocaleString()}`, 500, yPos, { align: 'right' });
    
    yPos += 25;
    doc.moveTo(350, yPos - 5)
       .lineTo(550, yPos - 5)
       .stroke('#e5e7eb');
    
    doc.font('Helvetica-Bold')
       .fontSize(11)
       .fillColor('#1f2937')
       .text('GRAND TOTAL:', 370, yPos);
    doc.fillColor('#10b981')
       .fontSize(12)
       .text(`₹${grandTotal.toLocaleString()}`, 500, yPos, { align: 'right' });
  }

  addPaymentDetails(doc, invoice) {
    const paymentInfo = invoice.metadata?.paymentInfo || {};
    const exhibitorInfo = invoice.metadata?.exhibitorInfo || {};
    
    doc.addPage();
    
    doc.fontSize(10)
       .fillColor('#4b5563')
       .text('Payment Information', 50, 50, { underline: true });
    
    doc.fillColor('#111827')
       .fontSize(9);
    
    let yPos = 70;
    
    doc.font('Helvetica-Bold')
       .text('Payment Mode:', 50, yPos);
    doc.font('Helvetica')
       .text(paymentInfo.paymentMode || 'Not specified', 150, yPos);
    
    yPos += 20;
    doc.font('Helvetica-Bold')
       .text('Transaction ID:', 50, yPos);
    doc.font('Helvetica')
       .text(paymentInfo.transactionId || 'Not provided', 150, yPos);
    
    yPos += 20;
    doc.font('Helvetica-Bold')
       .text('Transaction Date:', 50, yPos);
    doc.font('Helvetica')
       .text(paymentInfo.transactionDate ? new Date(paymentInfo.transactionDate).toLocaleDateString('en-IN') : 'Not provided', 150, yPos);
    
    yPos += 20;
    doc.font('Helvetica-Bold')
       .text('Amount Paid:', 50, yPos);
    doc.font('Helvetica')
       .text(`₹${paymentInfo.paidAmount?.toLocaleString() || '0'}`, 150, yPos);
    
    yPos += 40;
    doc.font('Helvetica-Bold')
       .text('Bank Transfer Details:', 50, yPos);
    
    yPos += 20;
    doc.font('Helvetica')
       .fontSize(8);
    
    const bankDetails = [
      'Account Name: Maxx Business Media Pvt. Ltd.',
      'Account Number: 272605000632',
      'IFSC Code: ICIC0002726',
      'Bank: ICICI Bank',
      'Branch: New Delhi'
    ];
    
    bankDetails.forEach(detail => {
      doc.text(detail, 50, yPos);
      yPos += 15;
    });
  }

  addTermsAndConditions(doc) {
    doc.addPage();
    
    doc.fontSize(10)
       .fillColor('#4b5563')
       .text('Terms & Conditions', 50, 50, { underline: true });
    
    doc.fontSize(8)
       .fillColor('#4b5563');
    
    const terms = [
      '1. Payment must be made within 30 days of invoice date.',
      '2. Late payments may incur additional charges.',
      '3. All prices are in Indian Rupees (INR).',
      '4. GST is applicable as per government regulations.',
      '5. Security deposit is refundable after the exhibition, subject to no damages.',
      '6. Cancellation policy: 50% refund if cancelled 30 days before event.',
      '7. Booth assignment is subject to availability and organizer discretion.',
      '8. Exhibitors must comply with all exhibition rules and regulations.',
      '9. Organizers reserve the right to modify terms with prior notice.',
      '10. For any queries, contact: accounts@diemex.com'
    ];
    
    let yPos = 80;
    terms.forEach(term => {
      doc.text(term, 50, yPos, { width: 500 });
      yPos += 20;
    });
  }

  addFooter(doc) {
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      
      // Footer on each page
      doc.fontSize(8)
         .fillColor('#9ca3af')
         .text(
           'DIEMEX Exhibition | www.diemex.com | support@diemex.com | +91 1234567890',
           50,
           doc.page.height - 50,
           { align: 'center', width: doc.page.width - 100 }
         );
      
      // Page numbers
      doc.text(
        `Page ${i + 1} of ${pages.count}`,
        doc.page.width - 100,
        doc.page.height - 50,
        { align: 'right' }
      );
    }
  }
}

module.exports = new PDFGenerationService();