// src/models/mongodb/Media.js
const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    index: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true,
    min: 0
  },
  path: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['image', 'video', 'document', 'audio', 'other'],
    required: true
  },
  dimensions: String,
  duration: Number,
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  uploadedBy: String,
  description: String,
  tags: [String],
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes
mediaSchema.index({ filename: 1 });
mediaSchema.index({ type: 1 });
mediaSchema.index({ userId: 1 });
mediaSchema.index({ createdAt: -1 });
mediaSchema.index({ tags: 1 });
mediaSchema.index({ originalName: 'text', description: 'text' });

module.exports = mongoose.model('Media', mediaSchema);