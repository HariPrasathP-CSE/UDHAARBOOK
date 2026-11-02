const mongoose = require('mongoose');
const Shop = require('../models/Shop');
const Account = require('../models/Account');
const LedgerEntry = require('../models/LedgerEntry');
const { calculateAccountAgeing } = require('../utils/ageingHelper');

// @desc    Get Shopkeeper Dashboard data (ageing, top debtors, collection rate, 6-month trend)
// @route   GET /api/dashboard/shopkeeper
// @access  Private (shopkeeper)
const getShopkeeperDashboard = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ owner: req.user.id });
    if (!shop) {
      return res.status(200).json({
        success: true,
        shop: null,
        totalOutstandingPaise: 0,
        collectionRate: 0,
        ageingTotals: { days0_7Paise: 0, days8_30Paise: 0, days30PlusPaise: 0 },
        topDebtors: [],
        trend6Months: [],
        totalCustomers: 0
      });
    }

    // Get all shop accounts
    const accounts = await Account.find({ shop: shop._id, active: true })
      .populate('customer', 'name phone email');

    let totalOutstandingPaise = 0;
    let totalCreditsShopPaise = 0;
    let totalPaymentsShopPaise = 0;

    const shopAgeingTotals = {
      days0_7Paise: 0,
      days8_30Paise: 0,
      days30PlusPaise: 0
    };

    const debtorList = [];

    // Calculate ageing for each account using FIFO
    for (const account of accounts) {
      const ageing = await calculateAccountAgeing(account._id);

      totalCreditsShopPaise += ageing.totalCreditPaise;
      totalPaymentsShopPaise += ageing.totalPaymentPaise;

      if (ageing.netBalancePaise > 0) {
        totalOutstandingPaise += ageing.netBalancePaise;
        shopAgeingTotals.days0_7Paise += ageing.days0_7Paise;
        shopAgeingTotals.days8_30Paise += ageing.days8_30Paise;
        shopAgeingTotals.days30PlusPaise += ageing.days30PlusPaise;
      }

      debtorList.push({
        accountId: account._id,
        customer: account.customer,
        balancePaise: ageing.netBalancePaise,
        creditLimitPaise: account.creditLimit,
        ageing: {
          days0_7Paise: ageing.days0_7Paise,
          days8_30Paise: ageing.days8_30Paise,
          days30PlusPaise: ageing.days30PlusPaise
        }
      });
    }

    // Sort to get top 5 debtors
    debtorList.sort((a, b) => b.balancePaise - a.balancePaise);
    const topDebtors = debtorList.slice(0, 5);

    // Collection rate: (total payments / total credits) * 100
    const collectionRate =
      totalCreditsShopPaise > 0
        ? Math.min(100, Number(((totalPaymentsShopPaise / totalCreditsShopPaise) * 100).toFixed(1)))
        : 100;

    // 6-Month Trend (Past 6 months chronological)
    const now = new Date();
    const trend6Months = [];
    const accountIds = accounts.map((a) => a._id);

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthName = startOfMonth.toLocaleString('en-US', { month: 'short' });
      const year = startOfMonth.getFullYear();
      const monthLabel = `${monthName} ${year}`;

      const monthlyStats = await LedgerEntry.aggregate([
        {
          $match: {
            account: { $in: accountIds },
            isReversed: { $ne: true },
            reversalOf: null,
            entryDate: { $gte: startOfMonth, $lte: endOfMonth }
          }
        },
        {
          $group: {
            _id: null,
            creditPaise: {
              $sum: {
                $cond: [{ $eq: ['$type', 'credit'] }, '$amountPaise', 0]
              }
            },
            paymentPaise: {
              $sum: {
                $cond: [{ $eq: ['$type', 'payment'] }, '$amountPaise', 0]
              }
            }
          }
        }
      ]);

      const monthCredits = monthlyStats[0]?.creditPaise || 0;
      const monthPayments = monthlyStats[0]?.paymentPaise || 0;

      trend6Months.push({
        month: monthLabel,
        creditPaise: monthCredits,
        paymentPaise: monthPayments,
        creditRupees: Number((monthCredits / 100).toFixed(2)),
        paymentRupees: Number((monthPayments / 100).toFixed(2)),
        netRupees: Number(((monthCredits - monthPayments) / 100).toFixed(2))
      });
    }

    res.status(200).json({
      success: true,
      shop,
      totalOutstandingPaise,
      collectionRate,
      ageingTotals: shopAgeingTotals,
      topDebtors,
      trend6Months,
      totalCustomers: accounts.length
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Customer Dashboard data (total owed per shop, pending entries)
// @route   GET /api/dashboard/customer
// @access  Private (customer)
const getCustomerDashboard = async (req, res, next) => {
  try {
    const accounts = await Account.find({ customer: req.user.id, active: true })
      .populate('shop', 'name phone address');

    let totalOwedPaise = 0;
    const shopsSummary = [];
    const accountIds = [];

    for (const account of accounts) {
      accountIds.push(account._id);
      const ageing = await calculateAccountAgeing(account._id);

      if (ageing.netBalancePaise > 0) {
        totalOwedPaise += ageing.netBalancePaise;
      }

      const pendingCount = await LedgerEntry.countDocuments({
        account: account._id,
        status: 'pending',
        isReversed: { $ne: true }
      });

      shopsSummary.push({
        accountId: account._id,
        shop: account.shop,
        balancePaise: ageing.netBalancePaise,
        creditLimitPaise: account.creditLimit,
        ageing: {
          days0_7Paise: ageing.days0_7Paise,
          days8_30Paise: ageing.days8_30Paise,
          days30PlusPaise: ageing.days30PlusPaise
        },
        pendingCount
      });
    }

    // Pending entries awaiting customer response across all shops
    const pendingEntries = await LedgerEntry.find({
      account: { $in: accountIds },
      status: 'pending',
      isReversed: { $ne: true }
    })
      .sort({ entryDate: -1 })
      .populate({
        path: 'account',
        select: 'shop creditLimit',
        populate: { path: 'shop', select: 'name phone' }
      });

    res.status(200).json({
      success: true,
      totalOwedPaise,
      shopsSummary,
      pendingEntries,
      pendingCount: pendingEntries.length
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getShopkeeperDashboard,
  getCustomerDashboard
};

