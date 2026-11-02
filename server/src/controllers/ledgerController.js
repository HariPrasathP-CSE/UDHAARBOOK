const mongoose = require('mongoose');
const LedgerEntry = require('../models/LedgerEntry');
const Account = require('../models/Account');
const Shop = require('../models/Shop');
const { createNotification } = require('../utils/notificationHelper');
const { calculateAccountAgeing } = require('../utils/ageingHelper');

// Helper to calculate active balance excluding reversed pairs
const calculateAccountBalance = async (accountId) => {
  const accountObjectId = new mongoose.Types.ObjectId(accountId);

  const result = await LedgerEntry.aggregate([
    {
      $match: {
        account: accountObjectId,
        isReversed: { $ne: true },
        reversalOf: null
      }
    },
    {
      $group: {
        _id: null,
        totalCreditPaise: {
          $sum: {
            $cond: [{ $eq: ['$type', 'credit'] }, '$amountPaise', 0]
          }
        },
        totalPaymentPaise: {
          $sum: {
            $cond: [{ $eq: ['$type', 'payment'] }, '$amountPaise', 0]
          }
        }
      }
    }
  ]);

  const totals = result[0] || { totalCreditPaise: 0, totalPaymentPaise: 0 };
  const netBalancePaise = totals.totalCreditPaise - totals.totalPaymentPaise;

  return {
    totalCreditPaise: totals.totalCreditPaise,
    totalPaymentPaise: totals.totalPaymentPaise,
    netBalancePaise
  };
};

// Helper to verify user permissions on an account
const checkAccountAccess = async (accountId, user) => {
  const account = await Account.findById(accountId)
    .populate('shop', 'name owner phone address')
    .populate('customer', 'name phone email');

  if (!account) {
    const error = new Error('Account not found');
    error.statusCode = 404;
    throw error;
  }

  if (user.role === 'admin') {
    return account;
  }

  if (user.role === 'shopkeeper') {
    if (account.shop.owner.toString() !== user.id) {
      const error = new Error('Access denied: You do not own the shop associated with this account');
      error.statusCode = 403;
      throw error;
    }
    return account;
  }

  if (user.role === 'customer') {
    if (account.customer._id.toString() !== user.id) {
      const error = new Error('Access denied: You do not have permission to access this account ledger');
      error.statusCode = 403;
      throw error;
    }
    return account;
  }

  const error = new Error('Unauthorized role');
  error.statusCode = 403;
  throw error;
};

// @desc    Create a ledger entry (credit or payment)
// @route   POST /api/ledgers
// @access  Private (shopkeeper)
const createEntry = async (req, res, next) => {
  try {
    const { accountId, type, amountPaise, note, entryDate } = req.body;

    if (!accountId || !type || amountPaise === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide accountId, type (credit or payment), and amountPaise'
      });
    }

    if (!['credit', 'payment'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Entry type must be either credit or payment'
      });
    }

    const amount = Number(amountPaise);
    if (isNaN(amount) || amount <= 0 || !Number.isInteger(amount)) {
      return res.status(400).json({
        success: false,
        message: 'amountPaise must be a positive integer in paise (1 rupee = 100 paise)'
      });
    }

    // Verify shopkeeper owns this account's shop
    const account = await checkAccountAccess(accountId, req.user);

    // Calculate current balance before this entry
    const currentBalance = await calculateAccountBalance(accountId);

    // Calculate prospective balance
    const prospectiveBalance =
      type === 'credit'
        ? currentBalance.netBalancePaise + amount
        : currentBalance.netBalancePaise - amount;

    // Check credit limit warning flag (Warn, don't block!)
    const limitWarning = Boolean(
      type === 'credit' &&
      account.creditLimit > 0 &&
      prospectiveBalance > account.creditLimit
    );

    const limitMessage = limitWarning
      ? `Limit warning: This credit entry of ₹${(amount / 100).toFixed(2)} raises total dues to ₹${(prospectiveBalance / 100).toFixed(2)}, exceeding approved credit limit of ₹${(account.creditLimit / 100).toFixed(2)}.`
      : null;

    // Create append-only ledger entry
    const entry = await LedgerEntry.create({
      account: account._id,
      type,
      amountPaise: amount,
      note: (note || '').trim(),
      entryDate: entryDate ? new Date(entryDate) : new Date(),
      status: 'pending',
      createdBy: req.user.id
    });

    const populatedEntry = await LedgerEntry.findById(entry._id)
      .populate('createdBy', 'name role');

    // Notify customer about newly recorded entry
    await createNotification({
      recipient: account.customer._id || account.customer,
      sender: req.user.id,
      type: 'new_entry',
      title: `New ${type === 'credit' ? 'Credit' : 'Payment'} Entry`,
      message: `${account.shop?.name || 'Shop'} recorded a ${type} of ₹${(amount / 100).toFixed(2)}${note ? ` (${note})` : ''}. Please review and acknowledge.`,
      data: {
        accountId: account._id,
        entryId: entry._id
      }
    });

    res.status(201).json({
      success: true,
      entry: populatedEntry,
      balancePaise: prospectiveBalance,
      limitWarning,
      limitMessage
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reverse an existing entry (creates opposite entry, never edits/deletes)
// @route   POST /api/ledgers/:id/reverse
// @access  Private (shopkeeper)
const reverseEntry = async (req, res, next) => {
  try {
    const originalEntry = await LedgerEntry.findById(req.params.id);

    if (!originalEntry) {
      return res.status(404).json({
        success: false,
        message: 'Ledger entry not found'
      });
    }

    // Verify shopkeeper owns this account's shop
    const account = await checkAccountAccess(originalEntry.account, req.user);

    // Prevent reversing an already reversed entry or a reversal entry
    if (originalEntry.isReversed) {
      return res.status(400).json({
        success: false,
        message: 'This entry has already been reversed'
      });
    }

    if (originalEntry.reversalOf) {
      return res.status(400).json({
        success: false,
        message: 'Cannot reverse a reversal entry'
      });
    }

    // Create opposite entry: credit reverses to payment, payment reverses to credit
    const oppositeType = originalEntry.type === 'credit' ? 'payment' : 'credit';
    const reversalNote = `Reversal of ${originalEntry.type} entry #${originalEntry._id}: ${originalEntry.note || ''}`.trim();

    const reversal = await LedgerEntry.create({
      account: account._id,
      type: oppositeType,
      amountPaise: originalEntry.amountPaise,
      note: reversalNote,
      entryDate: new Date(),
      status: 'resolved',
      createdBy: req.user.id,
      reversalOf: originalEntry._id
    });

    // Mark original entry as reversed
    originalEntry.isReversed = true;
    await originalEntry.save();

    // Recalculate account balance
    const updatedBalance = await calculateAccountBalance(account._id);

    const populatedReversal = await LedgerEntry.findById(reversal._id)
      .populate('createdBy', 'name role')
      .populate('reversalOf', 'type amountPaise note entryDate');

    res.status(201).json({
      success: true,
      reversalEntry: populatedReversal,
      originalEntry: {
        _id: originalEntry._id,
        isReversed: originalEntry.isReversed
      },
      balancePaise: updatedBalance.netBalancePaise
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get account balance summary & ageing
// @route   GET /api/ledgers/accounts/:accountId/balance
// @access  Private (shopkeeper, customer, admin)
const getAccountBalance = async (req, res, next) => {
  try {
    const account = await checkAccountAccess(req.params.accountId, req.user);
    const balance = await calculateAccountBalance(account._id);
    const ageing = await calculateAccountAgeing(account._id);

    res.status(200).json({
      success: true,
      balance: {
        ...balance,
        ageing: {
          days0_7Paise: ageing.days0_7Paise,
          days8_30Paise: ageing.days8_30Paise,
          days30PlusPaise: ageing.days30PlusPaise
        },
        creditLimitPaise: account.creditLimit,
        limitExceeded: Boolean(
          account.creditLimit > 0 && balance.netBalancePaise > account.creditLimit
        )
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get account ledger entries with running balance & rich filters
// @route   GET /api/ledgers/accounts/:accountId
// @access  Private (shopkeeper, customer, admin)
const getAccountLedger = async (req, res, next) => {
  try {
    const account = await checkAccountAccess(req.params.accountId, req.user);

    const {
      startDate,
      dateFrom,
      endDate,
      dateTo,
      status,
      type,
      search,
      sortBy
    } = req.query;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));

    // Fetch all entries chronologically to compute accurate running balance
    const allChronologicalEntries = await LedgerEntry.find({ account: account._id })
      .sort({ entryDate: 1, createdAt: 1 })
      .populate('createdBy', 'name role')
      .populate('reversalOf', '_id type amountPaise note');

    // Compute running balances chronologically
    let runningBalance = 0;
    let entriesWithRunningBalance = allChronologicalEntries.map((entry) => {
      const obj = entry.toObject();

      if (entry.type === 'credit') {
        runningBalance += entry.amountPaise;
      } else if (entry.type === 'payment') {
        runningBalance -= entry.amountPaise;
      }

      obj.runningBalancePaise = runningBalance;
      return obj;
    });

    // Apply filters
    const fromDate = startDate || dateFrom;
    const toDate = endDate || dateTo;

    if (fromDate) {
      const start = new Date(fromDate);
      entriesWithRunningBalance = entriesWithRunningBalance.filter(
        (e) => new Date(e.entryDate || e.createdAt) >= start
      );
    }

    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      entriesWithRunningBalance = entriesWithRunningBalance.filter(
        (e) => new Date(e.entryDate || e.createdAt) <= end
      );
    }

    if (status && status !== 'all') {
      entriesWithRunningBalance = entriesWithRunningBalance.filter((e) => e.status === status);
    }

    if (type && type !== 'all') {
      entriesWithRunningBalance = entriesWithRunningBalance.filter((e) => e.type === type);
    }

    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      entriesWithRunningBalance = entriesWithRunningBalance.filter(
        (e) =>
          (e.note && e.note.toLowerCase().includes(term)) ||
          e._id.toString().includes(term)
      );
    }

    // Apply sorting
    if (sortBy === 'oldest') {
      // Keep chronological
    } else if (sortBy === 'amount_high') {
      entriesWithRunningBalance.sort((a, b) => b.amountPaise - a.amountPaise);
    } else if (sortBy === 'amount_low') {
      entriesWithRunningBalance.sort((a, b) => a.amountPaise - b.amountPaise);
    } else {
      // Default: latest first
      entriesWithRunningBalance.reverse();
    }

    const totalFiltered = entriesWithRunningBalance.length;
    const skip = (page - 1) * limit;
    const paginatedEntries = entriesWithRunningBalance.slice(skip, skip + limit);

    const balanceSummary = await calculateAccountBalance(account._id);
    const ageing = await calculateAccountAgeing(account._id);

    res.status(200).json({
      success: true,
      account: {
        _id: account._id,
        shop: account.shop,
        customer: account.customer,
        creditLimit: account.creditLimit,
        active: account.active
      },
      balance: {
        ...balanceSummary,
        ageing: {
          days0_7Paise: ageing.days0_7Paise,
          days8_30Paise: ageing.days8_30Paise,
          days30PlusPaise: ageing.days30PlusPaise
        },
        creditLimitPaise: account.creditLimit,
        limitExceeded: Boolean(
          account.creditLimit > 0 && balanceSummary.netBalancePaise > account.creditLimit
        )
      },
      entries: paginatedEntries,
      pagination: {
        total: totalFiltered,
        page,
        limit,
        totalPages: Math.ceil(totalFiltered / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    List shop-wide ledger entries with filters
// @route   GET /api/ledgers
// @access  Private (shopkeeper)
const listShopLedger = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ owner: req.user.id });
    if (!shop) {
      return res.status(200).json({ success: true, entries: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } });
    }

    const {
      customerId,
      accountId,
      type,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    const accountFilter = { shop: shop._id };
    if (accountId) accountFilter._id = accountId;
    if (customerId) accountFilter.customer = customerId;

    const shopAccounts = await Account.find(accountFilter).select('_id');
    const accountIds = shopAccounts.map((a) => a._id);

    const entryFilter = { account: { $in: accountIds } };

    if (type && type !== 'all') entryFilter.type = type;
    if (status && status !== 'all') entryFilter.status = status;

    if (startDate || endDate) {
      entryFilter.entryDate = {};
      if (startDate) entryFilter.entryDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        entryFilter.entryDate.$lte = end;
      }
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const total = await LedgerEntry.countDocuments(entryFilter);

    const entries = await LedgerEntry.find(entryFilter)
      .sort({ entryDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('createdBy', 'name role')
      .populate({
        path: 'account',
        select: 'customer creditLimit',
        populate: { path: 'customer', select: 'name phone email' }
      });

    res.status(200).json({
      success: true,
      entries,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10))
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createEntry,
  reverseEntry,
  getAccountBalance,
  getAccountLedger,
  listShopLedger,
  calculateAccountBalance
};
