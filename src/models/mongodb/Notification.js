// src/models/mongodb/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['WELCOME', 'ARTICLE_PUBLISHED', 'EXHIBITOR_STATUS_CHANGED', 
           'PAYMENT_RECEIVED', 'INVOICE_CREATED', 'SYSTEM_ALERT']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  expiresAt: Date
}, {
  timestamps: true
});

// Index for unread notifications
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

module.exports = mongoose.model('Notification', notificationSchema);