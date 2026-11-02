const bcrypt = require('bcryptjs');
const Account = require('../models/Account');
const Shop = require('../models/Shop');
const User = require('../models/User');
const { calculateAccountAgeing } = require('../utils/ageingHelper');

// Helper to normalize integer paise
const parsePaise = (value) => {
  const num = Number(value);
  if (isNaN(num) || num < 0) return 0;
  return Math.round(num);
};

// @desc    Add a customer to shopkeeper's shop
// @route   POST /api/accounts
// @access  Private (shopkeeper)
const addCustomer = async (req, res, next) => {
  try {
    const { email, phone, name, creditLimit } = req.body;

    if (!phone && !email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either customer phone or email'
      });
    }

    // Ensure shopkeeper owns a shop
    const shop = await Shop.findOne({ owner: req.user.id });
    if (!shop) {
      return res.status(400).json({
        success: false,
        message: 'No shop found. Please create a shop profile first.'
      });
    }

    // Look for existing user
    const orQuery = [];
    if (phone) orQuery.push({ phone: phone.trim() });
    if (email) orQuery.push({ email: email.toLowerCase().trim() });

    let customer = await User.findOne({ $or: orQuery });
    let createdNewUser = false;
    const tempPassword = 'TempPass@123';

    if (!customer) {
      // Auto-generate customer user if not found
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(tempPassword, salt);

      const customerPhone = (phone || '').trim();
      const customerEmail = email
        ? email.toLowerCase().trim()
        : `cust_${customerPhone || Date.now()}@udhaarbook.local`;

      customer = await User.create({
        name: (name || `Customer ${customerPhone || 'User'}`).trim(),
        email: customerEmail,
        phone: customerPhone || `ph_${Date.now()}`,
        passwordHash,
        role: 'customer'
      });

      createdNewUser = true;
    }

    // Check if account already exists for this shop & customer
    let account = await Account.findOne({
      shop: shop._id,
      customer: customer._id
    });

    const parsedCreditLimit = parsePaise(creditLimit);

    if (account) {
      if (account.active) {
        return res.status(400).json({
          success: false,
          message: 'Customer is already linked to your shop'
        });
      }
      // Reactivate previously inactive account
      account.active = true;
      account.creditLimit = parsedCreditLimit;
      await account.save();
    } else {
      account = await Account.create({
        shop: shop._id,
        customer: customer._id,
        creditLimit: parsedCreditLimit,
        active: true
      });
    }

    const populatedAccount = await Account.findById(account._id)
      .populate('customer', 'name email phone role')
      .populate('shop', 'name phone address');

    res.status(201).json({
      success: true,
      account: populatedAccount,
      createdNewUser,
      tempPassword: createdNewUser ? tempPassword : null
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update credit limit for a customer account
// @route   PATCH /api/accounts/:id/credit-limit
// @access  Private (shopkeeper)
const updateCreditLimit = async (req, res, next) => {
  try {
    const { creditLimit, active } = req.body;

    // Verify shopkeeper owns this account's shop
    const shop = await Shop.findOne({ owner: req.user.id });
    if (!shop) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You do not own a shop'
      });
    }

    const account = await Account.findOne({
      _id: req.params.id,
      shop: shop._id
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found for this shop'
      });
    }

    if (creditLimit !== undefined) {
      const parsed = Number(creditLimit);
      if (isNaN(parsed) || parsed < 0) {
        return res.status(400).json({
          success: false,
          message: 'Credit limit must be a positive integer in paise'
        });
      }
      account.creditLimit = Math.round(parsed);
    }

    if (active !== undefined) {
      account.active = Boolean(active);
    }

    await account.save();

    const populated = await Account.findById(account._id)
      .populate('customer', 'name email phone')
      .populate('shop', 'name phone');

    res.status(200).json({
      success: true,
      account: populated
    });
  } catch (error) {
    next(error);
  }
};

// @desc    List and search own shop customers with ageing & balance filters
// @route   GET /api/accounts
// @access  Private (shopkeeper)
const listShopCustomers = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ owner: req.user.id });
    if (!shop) {
      return res.status(200).json({
        success: true,
        accounts: [],
        pagination: { total: 0, page: 1, limit: 10, totalPages: 0 }
      });
    }

    const {
      search,
      minBalance,
      active,
      sortBy
    } = req.query;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));

    const accountFilter = { shop: shop._id };
    if (active !== undefined && active !== 'all') {
      accountFilter.active = active === 'true' || active === true;
    }

    if (search && search.trim()) {
      const term = search.trim();
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: term, $options: 'i' } },
          { phone: { $regex: term, $options: 'i' } },
          { email: { $regex: term, $options: 'i' } }
        ]
      }).select('_id');

      const userIds = matchingUsers.map((u) => u._id);
      accountFilter.customer = { $in: userIds };
    }

    const allAccounts = await Account.find(accountFilter)
      .populate('customer', 'name email phone createdAt');

    // Attach balance & ageing data
    let accountsWithData = await Promise.all(
      allAccounts.map(async (acc) => {
        const obj = acc.toObject();
        const ageing = await calculateAccountAgeing(acc._id);
        obj.balancePaise = ageing.netBalancePaise;
        obj.ageing = {
          days0_7Paise: ageing.days0_7Paise,
          days8_30Paise: ageing.days8_30Paise,
          days30PlusPaise: ageing.days30PlusPaise
        };
        return obj;
      })
    );

    // Filter by minBalance
    if (minBalance !== undefined && minBalance !== '') {
      const minVal = Number(minBalance);
      if (!isNaN(minVal)) {
        accountsWithData = accountsWithData.filter((a) => a.balancePaise >= minVal);
      }
    }

    // Sort accounts
    if (sortBy === 'balance_desc') {
      accountsWithData.sort((a, b) => b.balancePaise - a.balancePaise);
    } else if (sortBy === 'balance_asc') {
      accountsWithData.sort((a, b) => a.balancePaise - b.balancePaise);
    } else if (sortBy === 'name_asc') {
      accountsWithData.sort((a, b) =>
        (a.customer?.name || '').localeCompare(b.customer?.name || '')
      );
    } else {
      // Default: createdAt desc
      accountsWithData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const total = accountsWithData.length;
    const skip = (page - 1) * limit;
    const paginatedAccounts = accountsWithData.slice(skip, skip + limit);

    res.status(200).json({
      success: true,
      accounts: paginatedAccounts,
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

// @desc    List customer's linked shops & accounts
// @route   GET /api/accounts/my-shops
// @access  Private (customer)
const getMyShops = async (req, res, next) => {
  try {
    const accounts = await Account.find({
      customer: req.user.id,
      active: true
    })
      .populate({
        path: 'shop',
        select: 'name address phone owner createdAt',
        populate: {
          path: 'owner',
          select: 'name phone email'
        }
      })
      .sort({ updatedAt: -1 });

    const accountsWithAgeing = await Promise.all(
      accounts.map(async (acc) => {
        const obj = acc.toObject();
        const ageing = await calculateAccountAgeing(acc._id);
        obj.balancePaise = ageing.netBalancePaise;
        obj.ageing = {
          days0_7Paise: ageing.days0_7Paise,
          days8_30Paise: ageing.days8_30Paise,
          days30PlusPaise: ageing.days30PlusPaise
        };
        return obj;
      })
    );

    res.status(200).json({
      success: true,
      accounts: accountsWithAgeing
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addCustomer,
  updateCreditLimit,
  listShopCustomers,
  getMyShops
};
