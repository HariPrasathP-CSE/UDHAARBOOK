const User = require('../models/User');
const Shop = require('../models/Shop');
const Account = require('../models/Account');
const LedgerEntry = require('../models/LedgerEntry');
const Dispute = require('../models/Dispute');
const { createNotification } = require('../utils/notificationHelper');

// @desc    Get system-wide platform statistics
// @route   GET /api/admin/stats
// @access  Private (Admin only)
const getPlatformStats = async (req, res, next) => {
  try {
    const [
      totalShops,
      activeShops,
      totalUsers,
      shopkeepersCount,
      customersCount,
      adminsCount,
      totalEntries,
      openDisputes,
      escalatedDisputes,
      resolvedDisputes,
      activeAccounts
    ] = await Promise.all([
      Shop.countDocuments(),
      Shop.countDocuments({ active: true }),
      User.countDocuments(),
      User.countDocuments({ role: 'shopkeeper' }),
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ role: 'admin' }),
      LedgerEntry.countDocuments(),
      Dispute.countDocuments({ status: 'open' }),
      Dispute.countDocuments({ status: 'escalated' }),
      Dispute.countDocuments({ status: 'resolved' }),
      Account.countDocuments({ active: true })
    ]);

    // Financial volume
    const volumeAgg = await LedgerEntry.aggregate([
      { $match: { isReversed: { $ne: true }, reversalOf: null } },
      {
        $group: {
          _id: '$type',
          totalPaise: { $sum: '$amountPaise' }
        }
      }
    ]);

    let totalCreditPaise = 0;
    let totalPaymentPaise = 0;
    for (const v of volumeAgg) {
      if (v._id === 'credit') totalCreditPaise = v.totalPaise;
      if (v._id === 'payment') totalPaymentPaise = v.totalPaise;
    }

    res.status(200).json({
      success: true,
      stats: {
        shops: {
          total: totalShops,
          active: activeShops
        },
        users: {
          total: totalUsers,
          shopkeepers: shopkeepersCount,
          customers: customersCount,
          admins: adminsCount
        },
        entries: {
          total: totalEntries,
          totalCreditPaise,
          totalPaymentPaise,
          netOutstandingPaise: totalCreditPaise - totalPaymentPaise
        },
        disputes: {
          open: openDisputes,
          escalated: escalatedDisputes,
          resolved: resolvedDisputes,
          total: openDisputes + escalatedDisputes + resolvedDisputes
        },
        accounts: {
          active: activeAccounts
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    List & search platform users
// @route   GET /api/admin/users
// @access  Private (Admin only)
const listUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};

    if (req.query.role && ['shopkeeper', 'customer', 'admin'].includes(req.query.role)) {
      query.role = req.query.role;
    }

    if (req.query.isActive !== undefined && req.query.isActive !== '') {
      query.isActive = req.query.isActive === 'true';
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      query.$or = [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      users,
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

// @desc    Activate or deactivate user account
// @route   PATCH /api/admin/users/:id/status
// @access  Private (Admin only)
const toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean'
      });
    }

    // Prevent admin from deactivating their own account
    if (id.toString() === req.user.id.toString() && !isActive) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own admin account'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isActive = isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.name} has been ${isActive ? 'activated' : 'deactivated'}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    List & search platform shops
// @route   GET /api/admin/shops
// @access  Private (Admin only)
const listShops = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};

    if (req.query.active !== undefined && req.query.active !== '') {
      query.active = req.query.active === 'true';
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      query.$or = [{ name: searchRegex }, { phone: searchRegex }, { address: searchRegex }];
    }

    const total = await Shop.countDocuments(query);
    const shops = await Shop.find(query)
      .populate('owner', 'name email phone isActive')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Attach customer account count for each shop
    const shopIds = shops.map((s) => s._id);
    const accountCounts = await Account.aggregate([
      { $match: { shop: { $in: shopIds } } },
      { $group: { _id: '$shop', count: { $sum: 1 } } }
    ]);

    const countMap = {};
    for (const ac of accountCounts) {
      countMap[ac._id.toString()] = ac.count;
    }

    const enrichedShops = shops.map((s) => ({
      ...s,
      customerCount: countMap[s._id.toString()] || 0
    }));

    res.status(200).json({
      success: true,
      shops: enrichedShops,
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

// @desc    Activate or deactivate shop
// @route   PATCH /api/admin/shops/:id/status
// @access  Private (Admin only)
const toggleShopStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    if (typeof active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'active must be a boolean'
      });
    }

    const shop = await Shop.findById(id);
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    shop.active = active;
    await shop.save();

    res.status(200).json({
      success: true,
      message: `Shop "${shop.name}" has been ${active ? 'activated' : 'deactivated'}`,
      shop
    });
  } catch (error) {
    next(error);
  }
};

// @desc    View escalated & all disputes for admin
// @route   GET /api/admin/disputes
// @access  Private (Admin only)
const listAdminDisputes = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.status) {
      query.status = req.query.status;
    }

    const total = await Dispute.countDocuments(query);
    const disputes = await Dispute.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('raisedBy', 'name email phone role')
      .populate('resolvedBy', 'name email phone role')
      .populate('history.updatedBy', 'name role email')
      .populate({
        path: 'entry',
        populate: [
          { path: 'createdBy', select: 'name email role' },
          {
            path: 'account',
            populate: [
              { path: 'shop', select: 'name phone owner' },
              { path: 'customer', select: 'name phone email' }
            ]
          }
        ]
      });

    res.status(200).json({
      success: true,
      disputes,
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

// @desc    Admin resolves an escalated dispute (accept or reject with a note)
// @route   POST /api/admin/disputes/:id/resolve
// @access  Private (Admin only)
const resolveAdminDispute = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, note } = req.body;

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either "accept" or "reject"'
      });
    }

    const dispute = await Dispute.findById(id).populate({
      path: 'entry',
      populate: {
        path: 'account',
        populate: [
          { path: 'shop', select: 'name owner phone' },
          { path: 'customer', select: 'name email' }
        ]
      }
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found'
      });
    }

    if (dispute.status === 'resolved') {
      return res.status(400).json({
        success: false,
        message: 'This dispute has already been resolved'
      });
    }

    const entry = dispute.entry;
    if (!entry) {
      return res.status(400).json({
        success: false,
        message: 'Associated ledger entry not found'
      });
    }

    let reversingEntry = null;

    if (action === 'accept') {
      // Customer's claim accepted by admin: auto-create opposite reversing entry
      const reverseType = entry.type === 'credit' ? 'payment' : 'credit';
      reversingEntry = await LedgerEntry.create({
        account: entry.account._id,
        type: reverseType,
        amountPaise: entry.amountPaise,
        note: `[Admin Resolution] Reversal of ${entry.type} entry ${entry._id}. Reason: ${note || 'Dispute accepted by platform admin'}`,
        entryDate: new Date(),
        status: 'resolved',
        createdBy: req.user.id,
        reversalOf: entry._id
      });

      entry.status = 'resolved';
      entry.isReversed = true;
      await entry.save();

      dispute.status = 'resolved';
      dispute.resolution = 'accepted_by_admin';
      dispute.resolvedBy = req.user.id;
      dispute.history.push({
        status: 'resolved',
        action: 'admin_accepted',
        note: `Admin accepted dispute and reversed entry. Note: ${note || 'None'}`,
        updatedBy: req.user.id,
        timestamp: new Date()
      });
    } else {
      // Customer's claim rejected by admin: entry remains valid
      entry.status = 'resolved';
      await entry.save();

      dispute.status = 'resolved';
      dispute.resolution = 'rejected_by_admin';
      dispute.resolvedBy = req.user.id;
      dispute.history.push({
        status: 'resolved',
        action: 'admin_rejected',
        note: `Admin rejected dispute. Note: ${note || 'None'}`,
        updatedBy: req.user.id,
        timestamp: new Date()
      });
    }

    await dispute.save();

    // Notify Customer
    await createNotification({
      recipient: dispute.raisedBy,
      sender: req.user.id,
      type: 'dispute_resolved',
      title: `Dispute ${action === 'accept' ? 'Accepted' : 'Rejected'} by Admin`,
      message: `Admin has reviewed and ${action}ed your dispute for entry ₹${entry.amountPaise / 100}. ${note ? `Note: ${note}` : ''}`,
      data: { disputeId: dispute._id, entryId: entry._id }
    });

    // Notify Shopkeeper
    if (entry.account?.shop?.owner) {
      await createNotification({
        recipient: entry.account.shop.owner,
        sender: req.user.id,
        type: 'dispute_resolved',
        title: `Escalated Dispute Resolved by Admin`,
        message: `Admin resolved dispute for entry ₹${entry.amountPaise / 100} with action: ${action}. ${note ? `Note: ${note}` : ''}`,
        data: { disputeId: dispute._id, entryId: entry._id }
      });
    }

    res.status(200).json({
      success: true,
      message: `Dispute resolved by admin (${action}ed)`,
      dispute,
      reversingEntry
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPlatformStats,
  listUsers,
  toggleUserStatus,
  listShops,
  toggleShopStatus,
  listAdminDisputes,
  resolveAdminDispute
};
