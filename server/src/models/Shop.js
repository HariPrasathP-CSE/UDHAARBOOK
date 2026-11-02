const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Shop owner is required'],
      unique: true
    },
    name: {
      type: String,
      required: [true, 'Shop name is required'],
      trim: true,
      maxlength: [100, 'Shop name cannot exceed 100 characters']
    },
    address: {
      type: String,
      trim: true,
      default: ''
    },
    phone: {
      type: String,
      required: [true, 'Shop contact phone is required'],
      trim: true
    },
    reminderSettings: {
      enabled: {
        type: Boolean,
        default: false
      },
      frequencyDays: {
        type: Number,
        default: 7,
        min: 1
      },
      minOverdueDays: {
        type: Number,
        default: 8,
        min: 1
      },
      messageTemplate: {
        type: String,
        default: 'Dear {customerName}, this is a gentle reminder that your outstanding balance of ₹{amount} at {shopName} is overdue. Kindly clear your dues at your earliest convenience.'
      }
    },
    active: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Shop', shopSchema);

