const path = require('path')
const fs = require('fs')
const {
  prefillApplicationForm,
  sanitizeApplicationForm,
} = require('../utils/applicationForm')
const { generateApplicationFormPdf } = require('../utils/applicationFormPdf')

function getExhibitorModel() {
  const modelFactory = require('../models')
  return modelFactory.getModel('Exhibitor')
}

function getMetadata(exhibitor) {
  return exhibitor.metadata && typeof exhibitor.metadata === 'object'
    ? { ...exhibitor.metadata }
    : {}
}

function getStoredForm(exhibitor) {
  return getMetadata(exhibitor).applicationForm || null
}

async function saveMetadata(exhibitor, metadata) {
  exhibitor.metadata = metadata
  exhibitor.changed('metadata', true)
  await exhibitor.save()
}

exports.getAdminForm = async (req, res) => {
  try {
    const Exhibitor = getExhibitorModel()
    const exhibitor = await Exhibitor.findByPk(req.params.id)
    if (!exhibitor) {
      return res.status(404).json({ success: false, error: 'Exhibitor not found' })
    }
    const form = prefillApplicationForm(exhibitor, getStoredForm(exhibitor))
    res.json({ success: true, data: form })
  } catch (error) {
    console.error('GET application form error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

exports.saveAdminForm = async (req, res) => {
  try {
    const Exhibitor = getExhibitorModel()
    const exhibitor = await Exhibitor.findByPk(req.params.id)
    if (!exhibitor) {
      return res.status(404).json({ success: false, error: 'Exhibitor not found' })
    }
    const metadata = getMetadata(exhibitor)
    const form = sanitizeApplicationForm(req.body, metadata.applicationForm || {})
    metadata.applicationForm = form
    await saveMetadata(exhibitor, metadata)
    res.json({ success: true, data: form })
  } catch (error) {
    console.error('SAVE application form error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

exports.sendAdminForm = async (req, res) => {
  try {
    const Exhibitor = getExhibitorModel()
    const exhibitor = await Exhibitor.findByPk(req.params.id)
    if (!exhibitor) {
      return res.status(404).json({ success: false, error: 'Exhibitor not found' })
    }
    const metadata = getMetadata(exhibitor)
    const form = sanitizeApplicationForm(req.body, metadata.applicationForm || {})
    form.status = 'sent'
    form.sentAt = new Date().toISOString()
    metadata.applicationForm = form
    await saveMetadata(exhibitor, metadata)

    try {
      const emailService = require('../services/EmailService')
      await emailService.sendEmail(
        exhibitor.email,
        'DIEMEX Application Form – please download, sign and upload',
        `<p>Dear ${exhibitor.name || exhibitor.company},</p>
         <p>Your exhibition application form is ready in the exhibitor dashboard.</p>
         <p>Please log in, open <strong>Application form</strong>, download the PDF, sign it, and upload the signed PDF or Word document.</p>
         <p>Regards,<br/>DIEMEX team</p>`
      )
    } catch (emailError) {
      console.warn('Application form email failed:', emailError.message)
    }

    res.json({ success: true, data: form })
  } catch (error) {
    console.error('SEND application form error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

async function sendPdf(res, exhibitor, form) {
  const buffer = await generateApplicationFormPdf(form, exhibitor)
  const safeName = String(form.companyName || exhibitor.company || 'exhibitor')
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="DIEMEX-Application-Form-${safeName || 'exhibitor'}.pdf"`
  )
  res.send(buffer)
}

exports.downloadAdminPdf = async (req, res) => {
  try {
    const Exhibitor = getExhibitorModel()
    const exhibitor = await Exhibitor.findByPk(req.params.id)
    if (!exhibitor) {
      return res.status(404).json({ success: false, error: 'Exhibitor not found' })
    }
    const form = prefillApplicationForm(exhibitor, getStoredForm(exhibitor))
    await sendPdf(res, exhibitor, form)
  } catch (error) {
    console.error('DOWNLOAD admin application PDF error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

exports.getExhibitorForm = async (req, res) => {
  try {
    const Exhibitor = getExhibitorModel()
    const exhibitor = await Exhibitor.findByPk(req.user.id)
    if (!exhibitor) {
      return res.status(404).json({ success: false, error: 'Exhibitor not found' })
    }
    const stored = getStoredForm(exhibitor)
    if (!stored || stored.status !== 'sent') {
      return res.json({ success: true, data: { sent: false } })
    }
    res.json({
      success: true,
      data: {
        sent: true,
        form: prefillApplicationForm(exhibitor, stored),
      },
    })
  } catch (error) {
    console.error('GET exhibitor application form error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

exports.downloadExhibitorPdf = async (req, res) => {
  try {
    const Exhibitor = getExhibitorModel()
    const exhibitor = await Exhibitor.findByPk(req.user.id)
    if (!exhibitor) {
      return res.status(404).json({ success: false, error: 'Exhibitor not found' })
    }
    const stored = getStoredForm(exhibitor)
    if (!stored || stored.status !== 'sent') {
      return res.status(404).json({ success: false, error: 'Application form has not been sent yet' })
    }
    await sendPdf(res, exhibitor, prefillApplicationForm(exhibitor, stored))
  } catch (error) {
    console.error('DOWNLOAD exhibitor application PDF error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

exports.uploadSignedForm = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Please upload a PDF or Word document' })
    }
    const Exhibitor = getExhibitorModel()
    const exhibitor = await Exhibitor.findByPk(req.user.id)
    if (!exhibitor) {
      return res.status(404).json({ success: false, error: 'Exhibitor not found' })
    }
    const metadata = getMetadata(exhibitor)
    const form = metadata.applicationForm
    if (!form || form.status !== 'sent') {
      fs.unlink(req.file.path, () => {})
      return res.status(400).json({ success: false, error: 'Application form has not been sent yet' })
    }

    if (form.signedUpload?.filePath) {
      const previous = path.join(process.cwd(), form.signedUpload.filePath.replace(/^\//, ''))
      if (fs.existsSync(previous)) fs.unlink(previous, () => {})
    }

    form.signedUpload = {
      fileName: req.file.originalname,
      storedName: req.file.filename,
      url: `/uploads/application-forms/${req.file.filename}`,
      filePath: `/uploads/application-forms/${req.file.filename}`,
      mimeType: req.file.mimetype,
      uploadedAt: new Date().toISOString(),
    }
    metadata.applicationForm = form
    await saveMetadata(exhibitor, metadata)
    res.json({ success: true, data: form })
  } catch (error) {
    console.error('UPLOAD signed application form error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}
