const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop is required']
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer is required']
    },
    creditLimit: {
      type: Number,
      required: [true, 'Credit limit is required'],
      default: 0,
      min: [0, 'Credit limit cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer paise value'
      }
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Unique compound index: One account per shop-customer pair
accountSchema.index({ shop: 1, customer: 1 }, { unique: true });

module.exports = mongoose.model('Account', accountSchema);

