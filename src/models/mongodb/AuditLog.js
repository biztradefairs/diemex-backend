// src/models/mongodb/AuditLog.js
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  userEmail: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  details: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  service: {
    type: String,
    default: 'admin-service'
  },
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true
});

// Index for faster queries
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ service: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);