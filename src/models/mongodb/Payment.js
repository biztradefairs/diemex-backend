// src/models/mongodb/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    index: true
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  exhibitorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exhibitor'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  method: {
    type: String,
    enum: ['credit_card', 'bank_transfer', 'check', 'cash', 'online'],
    required: true
  },
  transactionId: String,
  date: {
    type: Date,
    default: Date.now
  },
  dueDate: Date,
  processedBy: String,
  notes: [{
    text: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  source: {
    type: String,
    default: 'exhibition'
  }
}, {
  timestamps: true
});

// Indexes
paymentSchema.index({ invoiceNumber: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ method: 1 });
paymentSchema.index({ date: -1 });
paymentSchema.index({ exhibitorId: 1 });
paymentSchema.index({ userId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);