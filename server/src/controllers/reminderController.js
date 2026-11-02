const Shop = require('../models/Shop');
const Account = require('../models/Account');
const Reminder = require('../models/Reminder');
const { calculateAccountAgeing } = require('../utils/ageingHelper');
const { createNotification } = require('../utils/notificationHelper');
const { sendReminderEmail } = require('../utils/mailHelper');
const { runDailyReminderJob } = require('../jobs/reminderJob');

// @desc    Get current shop's reminder settings
// @route   GET /api/reminders/settings
// @access  Private (Shopkeeper)
const getReminderSettings = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ owner: req.user.id });
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found. Please create a shop profile first.'
      });
    }

    res.status(200).json({
      success: true,
      settings: shop.reminderSettings || {
        enabled: false,
        frequencyDays: 7,
        minOverdueDays: 8,
        messageTemplate:
          'Dear {customerName}, this is a gentle reminder that your outstanding balance of ₹{amount} at {shopName} is overdue. Kindly clear your dues at your earliest convenience.'
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update current shop's reminder settings
// @route   PUT /api/reminders/settings
// @access  Private (Shopkeeper)
const updateReminderSettings = async (req, res, next) => {
  try {
    const { enabled, frequencyDays, minOverdueDays, messageTemplate } = req.body;

    const shop = await Shop.findOne({ owner: req.user.id });
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    if (!shop.reminderSettings) {
      shop.reminderSettings = {};
    }

    if (typeof enabled === 'boolean') shop.reminderSettings.enabled = enabled;
    if (frequencyDays !== undefined) {
      const days = parseInt(frequencyDays, 10);
      if (days < 1) {
        return res.status(400).json({
          success: false,
          message: 'frequencyDays must be at least 1 day'
        });
      }
      shop.reminderSettings.frequencyDays = days;
    }
    if (minOverdueDays !== undefined) {
      const days = parseInt(minOverdueDays, 10);
      if (days < 1) {
        return res.status(400).json({
          success: false,
          message: 'minOverdueDays must be at least 1 day'
        });
      }
      shop.reminderSettings.minOverdueDays = days;
    }
    if (messageTemplate !== undefined && messageTemplate.trim() !== '') {
      shop.reminderSettings.messageTemplate = messageTemplate.trim();
    }

    await shop.save();

    res.status(200).json({
      success: true,
      message: 'Reminder settings updated successfully',
      settings: shop.reminderSettings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send manual reminder now to a customer
// @route   POST /api/reminders/accounts/:accountId/send
// @access  Private (Shopkeeper)
const sendManualReminder = async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const { message: customMessage } = req.body;

    const account = await Account.findById(accountId)
      .populate('shop')
      .populate('customer', 'name email phone');

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    // Verify shopkeeper ownership
    if (
      req.user.role !== 'admin' &&
      (!account.shop || account.shop.owner.toString() !== req.user.id.toString())
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send reminders for this customer'
      });
    }

    // Compute balance and ageing
    const ageingData = await calculateAccountAgeing(account._id);
    if (ageingData.netBalancePaise <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer has no outstanding balance to remind'
      });
    }

    const shop = account.shop;
    const customer = account.customer;
    const formattedAmount = (ageingData.netBalancePaise / 100).toFixed(2);

    // Prepare message
    let finalMessage = customMessage;
    if (!finalMessage) {
      const template =
        shop.reminderSettings?.messageTemplate ||
        'Dear {customerName}, this is a gentle reminder that your outstanding balance of ₹{amount} at {shopName} is overdue. Kindly clear your dues at your earliest convenience.';
      finalMessage = template
        .replace(/{customerName}/g, customer.name)
        .replace(/{amount}/g, formattedAmount)
        .replace(/{shopName}/g, shop.name);
    }

    // 1. Send in-app notification
    const notification = await createNotification({
      recipient: customer._id,
      sender: req.user.id,
      type: 'payment_reminder',
      title: `Payment Reminder: ${shop.name}`,
      message: finalMessage,
      data: {
        accountId: account._id,
        shopId: shop._id,
        amountPaise: ageingData.netBalancePaise
      }
    });

    // 2. Send email notification
    const emailResult = await sendReminderEmail({
      to: customer.email,
      customerName: customer.name,
      shopName: shop.name,
      amountPaise: ageingData.netBalancePaise,
      customMessage: finalMessage,
      shopPhone: shop.phone
    });

    // 3. Log Reminder record
    const reminder = await Reminder.create({
      shop: shop._id,
      account: account._id,
      customer: customer._id,
      amountPaise: ageingData.netBalancePaise,
      type: 'manual',
      channel: 'both',
      status: 'sent',
      message: finalMessage,
      emailSent: emailResult.success,
      inAppSent: !!notification,
      emailPreviewUrl: emailResult.previewUrl,
      sentBy: req.user.id,
      sentAt: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Reminder sent successfully',
      reminder,
      emailPreviewUrl: emailResult.previewUrl
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get reminder history for an account
// @route   GET /api/reminders/accounts/:accountId
// @access  Private (Shopkeeper owner, Account customer, or Admin)
const getAccountReminderHistory = async (req, res, next) => {
  try {
    const { accountId } = req.params;

    const account = await Account.findById(accountId).populate('shop');
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    const isOwner =
      req.user.role === 'shopkeeper' &&
      account.shop &&
      account.shop.owner.toString() === req.user.id.toString();

    const isCustomer =
      req.user.role === 'customer' &&
      account.customer.toString() === req.user.id.toString();

    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isCustomer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view reminder history for this account'
      });
    }

    const reminders = await Reminder.find({ account: accountId })
      .sort({ sentAt: -1 })
      .populate('sentBy', 'name email')
      .lean();

    res.status(200).json({
      success: true,
      reminders
    });
  } catch (error) {
    next(error);
  }
};

// @desc    List all reminders sent by current shop (paginated)
// @route   GET /api/reminders
// @access  Private (Shopkeeper)
const listShopReminders = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ owner: req.user.id });
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const total = await Reminder.countDocuments({ shop: shop._id });
    const reminders = await Reminder.find({ shop: shop._id })
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('customer', 'name email phone')
      .populate('account', 'creditLimit active')
      .populate('sentBy', 'name email');

    res.status(200).json({
      success: true,
      reminders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Trigger automated reminder daily job on demand
// @route   POST /api/reminders/trigger-job
// @access  Private (Shopkeeper or Admin)
const triggerReminderJob = async (req, res, next) => {
  try {
    const stats = await runDailyReminderJob();
    res.status(200).json({
      success: true,
      message: 'Automated daily reminder job executed',
      stats
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getReminderSettings,
  updateReminderSettings,
  sendManualReminder,
  getAccountReminderHistory,
  listShopReminders,
  triggerReminderJob
};

