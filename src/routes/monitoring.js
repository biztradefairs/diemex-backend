// src/routes/monitoring.js
const express = require('express');
const router = express.Router();

/**
 * @route GET /monitoring/health
 * @desc Health check endpoint
 * @access Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * @route GET /monitoring/metrics
 * @desc Metrics endpoint
 * @access Private (admin only)
 */
router.get('/metrics', (req, res) => {
  const memoryUsage = process.memoryUsage();
  
  res.status(200).json({
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
    },
    cpu: process.cpuUsage(),
    uptime: process.uptime(),
    nodeVersion: process.version
  });
});

module.exports = router;