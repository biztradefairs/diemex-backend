// src/models/mongodb/FloorPlan.js
const mongoose = require('mongoose');

const shapeSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['rectangle', 'square', 'circle', 'booth', 'table', 'chair', 'door', 'text']
  },
  x: Number,
  y: Number,
  width: Number,
  height: Number,
  rotation: Number,
  color: String,
  borderColor: String,
  borderWidth: Number,
  text: String,
  fontSize: Number,
  zIndex: Number,
  isLocked: Boolean,
  metadata: {
    boothNumber: String,
    companyName: String,
    status: String,
    category: String
  }
});

const floorPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  floor: String,
  version: {
    type: String,
    default: '1.0'
  },
  image: String,
  shapes: [shapeSchema],
  scale: {
    type: Number,
    default: 0.1
  },
  gridSize: {
    type: Number,
    default: 20
  },
  showGrid: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for search
floorPlanSchema.index({ name: 'text', description: 'text' });
floorPlanSchema.index({ floor: 1 });
floorPlanSchema.index({ 'shapes.type': 1 });

module.exports = mongoose.model('FloorPlan', floorPlanSchema);