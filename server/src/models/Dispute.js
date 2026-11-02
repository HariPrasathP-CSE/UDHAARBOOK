const mongoose = require('mongoose');

const disputeHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true
    },
    action: {
      type: String,
      required: true
    },
    note: {
      type: String,
      default: ''
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const disputeSchema = new mongoose.Schema(
  {
    entry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LedgerEntry',
      required: [true, 'Ledger entry is required'],
      unique: true,
      index: true
    },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'Account is required'],
      index: true
    },
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Raised by user is required']
    },
    reason: {
      type: String,
      required: [true, 'Dispute reason is required'],
      trim: true,
      maxlength: [1000, 'Reason cannot exceed 1000 characters']
    },
    status: {
      type: String,
      enum: ['open', 'resolved', 'escalated'],
      default: 'open',
      index: true
    },
    resolution: {
      type: String,
      trim: true,
      default: ''
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    history: [disputeHistorySchema]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Dispute', disputeSchema);

