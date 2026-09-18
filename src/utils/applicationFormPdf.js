const PDFDocument = require('pdfkit')
const { APPLICATION_RULES, RATES } = require('./applicationForm')

function inr(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function row(doc, y, left, right, width = 495) {
  doc.rect(50, y, width, 22).stroke('#9ca3af')
  doc.font('Helvetica').fontSize(8).fillColor('#4b5563').text(left, 56, y + 7, { width: 210 })
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text(right || '—', 270, y + 6, { width: 265 })
  return y + 22
}

function moneyRow(doc, y, label, value, opts = {}) {
  const height = opts.tall ? 26 : 22
  if (opts.fill) doc.rect(50, y, 495, height).fill(opts.fill)
  doc.rect(50, y, 495, height).stroke('#9ca3af')
  doc.fillColor(opts.bold ? '#111827' : '#4b5563')
    .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(opts.bold ? 10 : 8)
    .text(label, 56, y + (opts.tall ? 8 : 7), { width: 300 })
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827')
    .text(value, 360, y + (opts.tall ? 8 : 6), { width: 175, align: 'right' })
  return y + height
}

function generateApplicationFormPdf(form, exhibitor = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true })
    const chunks = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const totals = form.totals || {}
    const company = form.companyName || exhibitor.company || 'Exhibitor'

    doc.rect(40, 36, 515, 52).fill('#06162F')
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16).text('DIEMEX', 50, 46)
    doc.font('Helvetica').fontSize(9).fillColor('#82C6EB').text('Exhibition Application Form', 50, 68)
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff')
      .text('SPACE BOOKING', 360, 52, { width: 180, align: 'right' })
    doc.font('Helvetica').fontSize(8).fillColor('#cbd5e1')
      .text(company, 360, 70, { width: 180, align: 'right' })

    let y = 102
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#06162F').text('Company Information', 50, y)
    y = 122
    y = row(doc, y, 'GST No.', form.gstNo)
    y = row(doc, y, 'Name of the Company', form.companyName)
    y = row(doc, y, 'Contact Person', form.contactPerson)
    y = row(doc, y, 'Designation', form.designation)
    y = row(doc, y, 'Address', form.address)
    y = row(doc, y, 'City', form.city)
    y = row(doc, y, 'Pincode', form.pincode)
    y = row(doc, y, 'State', form.state)
    y = row(doc, y, 'Telephone', form.telephone)
    y = row(doc, y, 'Mobile', form.mobile)
    y = row(doc, y, 'E-mail Address', form.email)

    y += 16
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#06162F').text('Participation Expenses', 50, y)
    y += 18

    const shellMark = form.shellScheme ? '[x]' : '[ ]'
    const bareMark = form.bareSpace ? '[x]' : '[ ]'
    const twoMark = form.twoSideOpen ? '[x]' : '[ ]'
    const threeMark = form.threeSideOpen ? '[x]' : '[ ]'

    y = moneyRow(doc, y, `${shellMark} Stall Type – Shell Scheme  (Rs. ${RATES.shellPerSqm.toLocaleString('en-IN')} / SQM)   ${form.shellScheme ? `${totals.shellSqm || 0} SQ.M` : ''}`, inr(totals.shellAmount))
    y = moneyRow(doc, y, `${bareMark} Stall Type – Bare Space  (Rs. ${RATES.barePerSqm.toLocaleString('en-IN')} / SQM)   ${form.bareSpace ? `${totals.bareSqm || 0} SQ.M` : ''}`, inr(totals.bareAmount))
    y = moneyRow(doc, y, `${twoMark} Open Side Charges – 2 Side Open @ 15% of Space Charges`, inr(totals.twoSideAmount))
    y = moneyRow(doc, y, `${threeMark} Open Side Charges – 3 Side Open @ 25% of Space Charges`, inr(totals.threeSideAmount))
    y = moneyRow(doc, y, 'Total', inr(totals.total), { bold: true, fill: '#f8fafc' })
    y = moneyRow(doc, y, `GST @ ${RATES.gstPercent}%`, inr(totals.gstAmount))
    y = moneyRow(doc, y, 'Total Amount Payable', inr(totals.totalPayable), { bold: true, fill: '#eff6ff', tall: true })
    y = moneyRow(doc, y, `Advance Payment (${RATES.advancePercent}%)`, inr(totals.advance))
    y = moneyRow(doc, y, 'Balance Amount Payable', inr(totals.balance), { bold: true })

    y += 16
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#06162F').text('Office Use Only', 50, y)
    y += 18
    y = row(doc, y, 'Stall No.', form.stallNo)
    y = row(doc, y, 'Booked By', form.bookedBy)
    y = row(doc, y, 'Date', form.date)
    y = row(doc, y, 'Place', form.place)
    y = row(doc, y, 'Confirmation / Signature', form.confirmation ? 'Confirmed' : '')
    y = row(doc, y, 'Signature with Rubber Stamp', form.rubberStamp ? 'Yes' : '')

    doc.addPage()
    doc.rect(40, 36, 515, 40).fill('#06162F')
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14).text('Rules and Regulations', 50, 48)

    y = 96
    doc.font('Helvetica').fontSize(9).fillColor('#111827')
    APPLICATION_RULES.forEach((rule, index) => {
      const text = `${index + 1}. ${rule}`
      const height = doc.heightOfString(text, { width: 495 }) + 8
      if (y + height > 760) {
        doc.addPage()
        y = 50
      }
      doc.text(text, 50, y, { width: 495, align: 'justify' })
      y += height
    })

    y += 20
    doc.font('Helvetica-Bold').fontSize(9).text('Exhibitor confirmation', 50, y)
    y += 16
    doc.font('Helvetica').fontSize(8).fillColor('#4b5563')
      .text('I/We have read the rules and regulations and confirm participation as per this application. Please sign and upload the completed document from the exhibitor dashboard.', 50, y, { width: 495 })

    y += 50
    doc.moveTo(50, y).lineTo(250, y).stroke('#9ca3af')
    doc.moveTo(320, y).lineTo(545, y).stroke('#9ca3af')
    doc.fontSize(8).fillColor('#6b7280').text('Authorised Signatory', 50, y + 6)
    doc.text('Company Rubber Stamp', 320, y + 6)

    const range = doc.bufferedPageRange()
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(i)
      doc.fontSize(8).fillColor('#9ca3af')
        .text('DIEMEX | Application Form | Confidential', 50, 810, { width: 300 })
        .text(`Page ${i + 1} of ${range.count}`, 400, 810, { width: 145, align: 'right' })
    }

    doc.end()
  })
}

module.exports = { generateApplicationFormPdf }
