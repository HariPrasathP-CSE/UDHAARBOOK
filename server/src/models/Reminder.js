const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop is required'],
      index: true
    },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'Account is required'],
      index: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer is required'],
      index: true
    },
    amountPaise: {
      type: Number,
      required: [true, 'Outstanding amount in paise is required'],
      min: [1, 'Amount must be greater than 0']
    },
    type: {
      type: String,
      enum: ['manual', 'automated'],
      default: 'manual',
      index: true
    },
    channel: {
      type: String,
      enum: ['in_app', 'email', 'both'],
      default: 'both'
    },
    status: {
      type: String,
      enum: ['sent', 'skipped', 'failed'],
      default: 'sent'
    },
    message: {
      type: String,
      required: [true, 'Reminder message is required'],
      trim: true
    },
    emailSent: {
      type: Boolean,
      default: false
    },
    inAppSent: {
      type: Boolean,
      default: false
    },
    emailPreviewUrl: {
      type: String,
      default: null
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    sentAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Reminder', reminderSchema);

