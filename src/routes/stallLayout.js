const { authenticate, authorize } = require('../middleware/auth')
const express = require('express')
const { defaultLayout, readLayout, writeLayout } = require('../utils/stallLayoutStore')
const router = express.Router()

router.get('/', (_req, res) => {
  res.json({ success: true, data: readLayout() })
})

router.put('/', authenticate, authorize(['admin']), (req, res) => {
  try {
    const current = readLayout()
    const next = {
      ...current,
      availableColor: req.body.availableColor || current.availableColor,
      bookedColor: req.body.bookedColor || current.bookedColor,
      scale: Number(req.body.scale) || current.scale,
      canvasWidth: Number(req.body.canvasWidth) || current.canvasWidth,
      canvasHeight: Number(req.body.canvasHeight) || current.canvasHeight,
      halls: Array.isArray(req.body.halls) ? req.body.halls : current.halls,
      stalls: Array.isArray(req.body.stalls) ? req.body.stalls : current.stalls,
    }
    writeLayout(next)
    res.json({ success: true, data: readLayout() })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

module.exports = router
module.exports.defaultLayout = defaultLayout
