const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema(
  {
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'Account is required'],
      index: true
    },
    type: {
      type: String,
      enum: {
        values: ['credit', 'payment'],
        message: '{VALUE} is not a valid entry type (must be credit or payment)'
      },
      required: [true, 'Entry type is required']
    },
    amountPaise: {
      type: Number,
      required: [true, 'Amount in paise is required'],
      min: [1, 'Amount must be at least 1 paisa'],
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer paise value'
      }
    },
    note: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Note cannot exceed 500 characters']
    },
    entryDate: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'acknowledged', 'disputed', 'resolved'],
        message: '{VALUE} is not a valid status'
      },
      default: 'pending'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by user is required']
    },
    reversalOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LedgerEntry',
      default: null
    },
    isReversed: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Indexes for fast ledger lookups, filtering, and aggregation
ledgerEntrySchema.index({ account: 1, entryDate: 1 });
ledgerEntrySchema.index({ account: 1, status: 1 });
ledgerEntrySchema.index({ status: 1 });
ledgerEntrySchema.index({ entryDate: 1 });
ledgerEntrySchema.index({ reversalOf: 1 });
ledgerEntrySchema.index({ account: 1, createdAt: 1 });

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);

