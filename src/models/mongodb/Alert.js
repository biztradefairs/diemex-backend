// src/models/mongodb/Alert.js
const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['error', 'warning', 'info', 'success'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  source: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  acknowledged: {
    type: Boolean,
    default: false
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  acknowledgedAt: Date,
  data: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  expiresAt: Date
}, {
  timestamps: true
});

// TTL index for auto-cleanup
alertSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Indexes
alertSchema.index({ type: 1 });
alertSchema.index({ severity: 1 });
alertSchema.index({ acknowledged: 1 });
alertSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);