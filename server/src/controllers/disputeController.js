const Dispute = require('../models/Dispute');
const LedgerEntry = require('../models/LedgerEntry');
const Account = require('../models/Account');
const Shop = require('../models/Shop');
const User = require('../models/User');
const { createNotification } = require('../utils/notificationHelper');
const { calculateAccountBalance } = require('./ledgerController');

// Helper to check access to a dispute
const checkDisputeAccess = async (dispute, user) => {
  if (user.role === 'admin') return true;

  const account = await Account.findById(dispute.account).populate('shop');
  if (!account) return false;

  if (user.role === 'customer' && account.customer.toString() === user.id) {
    return true;
  }

  if (user.role === 'shopkeeper' && account.shop.owner.toString() === user.id) {
    return true;
  }

  return false;
};

// @desc    Customer acknowledges a pending ledger entry
// @route   POST /api/ledgers/:id/acknowledge
// @access  Private (customer)
const acknowledgeEntry = async (req, res, next) => {
  try {
    const entry = await LedgerEntry.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Ledger entry not found' });
    }

    const account = await Account.findById(entry.account).populate('shop customer');
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    // Verify user is the customer of this account
    if (account.customer._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only the account customer can acknowledge this entry'
      });
    }

    if (entry.status === 'acknowledged') {
      return res.status(400).json({
        success: false,
        message: 'Entry is already acknowledged'
      });
    }

    entry.status = 'acknowledged';
    await entry.save();

    // Notify shopkeeper
    const amountRs = (entry.amountPaise / 100).toFixed(2);
    await createNotification({
      recipient: account.shop.owner,
      sender: req.user.id,
      type: 'entry_acknowledged',
      title: 'Credit Entry Acknowledged',
      message: `${account.customer.name} verified and acknowledged your ${entry.type} entry of ₹${amountRs}.`,
      data: {
        accountId: account._id,
        entryId: entry._id
      }
    });

    res.status(200).json({
      success: true,
      entry
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Customer raises a dispute on a pending entry
// @route   POST /api/ledgers/:id/dispute
// @access  Private (customer)
const disputeEntry = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a clear reason for disputing this entry'
      });
    }

    const entry = await LedgerEntry.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Ledger entry not found' });
    }

    const account = await Account.findById(entry.account).populate('shop customer');
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    // Verify user is the customer of this account
    if (account.customer._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only the account customer can dispute this entry'
      });
    }

    // Check if dispute already exists for this entry
    const existingDispute = await Dispute.findOne({ entry: entry._id });
    if (existingDispute) {
      return res.status(400).json({
        success: false,
        message: 'A dispute has already been raised for this entry',
        dispute: existingDispute
      });
    }

    // Update entry status
    entry.status = 'disputed';
    await entry.save();

    // Create dispute record
    const dispute = await Dispute.create({
      entry: entry._id,
      account: account._id,
      raisedBy: req.user.id,
      reason: reason.trim(),
      status: 'open',
      history: [
        {
          status: 'open',
          action: 'dispute_raised',
          note: reason.trim(),
          updatedBy: req.user.id,
          timestamp: new Date()
        }
      ]
    });

    // Notify shopkeeper
    const amountRs = (entry.amountPaise / 100).toFixed(2);
    await createNotification({
      recipient: account.shop.owner,
      sender: req.user.id,
      type: 'entry_disputed',
      title: 'Entry Disputed by Customer',
      message: `${account.customer.name} disputed ${entry.type} entry of ₹${amountRs}: "${reason.trim()}".`,
      data: {
        accountId: account._id,
        entryId: entry._id,
        disputeId: dispute._id
      }
    });

    res.status(201).json({
      success: true,
      dispute,
      entry
    });
  } catch (error) {
    next(error);
  }
};

// @desc    List disputes (filtered by role and query)
// @route   GET /api/disputes
// @access  Private
const listDisputes = async (req, res, next) => {
  try {
    const { status, accountId } = req.query;
    const query = {};

    if (status) query.status = status;
    if (accountId) query.account = accountId;

    if (req.user.role === 'customer') {
      query.raisedBy = req.user.id;
    } else if (req.user.role === 'shopkeeper') {
      const shop = await Shop.findOne({ owner: req.user.id });
      if (!shop) {
        return res.status(200).json({ success: true, disputes: [] });
      }
      const shopAccounts = await Account.find({ shop: shop._id }).select('_id');
      query.account = { $in: shopAccounts.map((a) => a._id) };
    }

    const disputes = await Dispute.find(query)
      .sort({ updatedAt: -1 })
      .populate('entry')
      .populate('raisedBy', 'name phone email')
      .populate('resolvedBy', 'name role')
      .populate({
        path: 'account',
        populate: [
          { path: 'customer', select: 'name phone email' },
          { path: 'shop', select: 'name phone address owner' }
        ]
      })
      .populate('history.updatedBy', 'name role');

    res.status(200).json({
      success: true,
      disputes
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dispute by ID
// @route   GET /api/disputes/:id
// @access  Private
const getDisputeById = async (req, res, next) => {
  try {
    const dispute = await Dispute.findById(req.params.id)
      .populate('entry')
      .populate('raisedBy', 'name phone email')
      .populate('resolvedBy', 'name role')
      .populate({
        path: 'account',
        populate: [
          { path: 'customer', select: 'name phone email' },
          { path: 'shop', select: 'name phone address owner' }
        ]
      })
      .populate('history.updatedBy', 'name role');

    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }

    const hasAccess = await checkDisputeAccess(dispute, req.user);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied to this dispute' });
    }

    res.status(200).json({
      success: true,
      dispute
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dispute for a specific ledger entry
// @route   GET /api/disputes/entry/:entryId
// @access  Private
const getDisputeByEntry = async (req, res, next) => {
  try {
    const dispute = await Dispute.findOne({ entry: req.params.entryId })
      .populate('entry')
      .populate('raisedBy', 'name phone email')
      .populate('resolvedBy', 'name role')
      .populate('history.updatedBy', 'name role');

    res.status(200).json({
      success: true,
      dispute: dispute || null
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Shopkeeper (or Admin) resolves a dispute (accept or reject)
// @route   POST /api/disputes/:id/resolve
// @access  Private (shopkeeper or admin)
const resolveDispute = async (req, res, next) => {
  try {
    const { action, note } = req.body; // action: 'accept' | 'reject'

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either "accept" or "reject"'
      });
    }

    const dispute = await Dispute.findById(req.params.id).populate('entry account');
    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }

    const account = await Account.findById(dispute.account).populate('shop customer');
    if (req.user.role === 'shopkeeper' && account.shop.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You do not own the shop associated with this dispute'
      });
    }

    if (dispute.status === 'resolved') {
      return res.status(400).json({
        success: false,
        message: 'This dispute has already been resolved'
      });
    }

    const originalEntry = await LedgerEntry.findById(dispute.entry._id);
    let reversalEntry = null;

    if (action === 'accept') {
      // Auto-create reversing entry if not already reversed
      if (!originalEntry.isReversed) {
        const oppositeType = originalEntry.type === 'credit' ? 'payment' : 'credit';
        const reversalNote = `Dispute Accepted Reversal: ${note || originalEntry.note || 'Resolved customer dispute'}`;

        reversalEntry = await LedgerEntry.create({
          account: account._id,
          type: oppositeType,
          amountPaise: originalEntry.amountPaise,
          note: reversalNote,
          entryDate: new Date(),
          status: 'resolved',
          createdBy: req.user.id,
          reversalOf: originalEntry._id
        });

        originalEntry.isReversed = true;
      }

      originalEntry.status = 'resolved';
      await originalEntry.save();

      dispute.status = 'resolved';
      dispute.resolvedBy = req.user.id;
      dispute.resolution = `Accepted: ${note || 'Reversing entry created'}`;
      dispute.history.push({
        status: 'resolved',
        action: 'accepted_with_reversal',
        note: note || 'Dispute accepted by shopkeeper; reversing entry automatically created',
        updatedBy: req.user.id,
        timestamp: new Date()
      });

      // Notify customer
      await createNotification({
        recipient: account.customer._id,
        sender: req.user.id,
        type: 'dispute_resolved',
        title: 'Dispute Accepted',
        message: `${account.shop.name} accepted your dispute for ${originalEntry.type} of ₹${(originalEntry.amountPaise / 100).toFixed(2)}. An automatic reversal entry was generated.`,
        data: {
          accountId: account._id,
          entryId: originalEntry._id,
          disputeId: dispute._id
        }
      });
    } else if (action === 'reject') {
      // Reject with note
      if (!note || !note.trim()) {
        return res.status(400).json({
          success: false,
          message: 'A note explaining the reason for rejection is required'
        });
      }

      originalEntry.status = 'resolved';
      await originalEntry.save();

      dispute.status = 'resolved';
      dispute.resolvedBy = req.user.id;
      dispute.resolution = `Rejected: ${note.trim()}`;
      dispute.history.push({
        status: 'resolved',
        action: 'rejected_with_explanation',
        note: note.trim(),
        updatedBy: req.user.id,
        timestamp: new Date()
      });

      // Notify customer
      await createNotification({
        recipient: account.customer._id,
        sender: req.user.id,
        type: 'dispute_resolved',
        title: 'Dispute Rejected',
        message: `${account.shop.name} rejected your dispute: "${note.trim()}". You may escalate to platform admin if unresolved.`,
        data: {
          accountId: account._id,
          entryId: originalEntry._id,
          disputeId: dispute._id
        }
      });
    }

    await dispute.save();

    // Recalculate account balance
    const updatedBalance = await calculateAccountBalance(account._id);

    res.status(200).json({
      success: true,
      dispute,
      reversalEntry,
      balancePaise: updatedBalance.netBalancePaise
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Escalate a dispute to admin
// @route   POST /api/disputes/:id/escalate
// @access  Private (shopkeeper or customer)
const escalateDispute = async (req, res, next) => {
  try {
    const { note } = req.body;

    const dispute = await Dispute.findById(req.params.id).populate('entry account');
    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }

    const account = await Account.findById(dispute.account).populate('shop customer');
    const isCustomer = account.customer._id.toString() === req.user.id;
    const isShopkeeper = account.shop.owner.toString() === req.user.id;

    if (!isCustomer && !isShopkeeper && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only parties involved in this dispute or an admin can escalate'
      });
    }

    dispute.status = 'escalated';
    dispute.history.push({
      status: 'escalated',
      action: 'escalated_to_admin',
      note: (note || 'Escalated to platform admin for independent review').trim(),
      updatedBy: req.user.id,
      timestamp: new Date()
    });

    await dispute.save();

    // Notify other party
    const otherRecipient = isCustomer ? account.shop.owner : account.customer._id;
    await createNotification({
      recipient: otherRecipient,
      sender: req.user.id,
      type: 'dispute_escalated',
      title: 'Dispute Escalated to Admin',
      message: `${req.user.name} escalated dispute #${dispute._id.toString().slice(-6)} to Platform Admin for mediation.`,
      data: {
        accountId: account._id,
        disputeId: dispute._id
      }
    });

    // Notify all admins
    const admins = await User.find({ role: 'admin' }).select('_id');
    for (const admin of admins) {
      await createNotification({
        recipient: admin._id,
        sender: req.user.id,
        type: 'dispute_escalated',
        title: 'New Dispute Escalation',
        message: `Dispute on account ${account.customer.name} @ ${account.shop.name} escalated to admin.`,
        data: {
          accountId: account._id,
          disputeId: dispute._id
        }
      });
    }

    res.status(200).json({
      success: true,
      dispute
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  acknowledgeEntry,
  disputeEntry,
  listDisputes,
  getDisputeById,
  getDisputeByEntry,
  resolveDispute,
  escalateDispute
};

