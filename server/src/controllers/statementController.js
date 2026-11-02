const Account = require('../models/Account');
const Shop = require('../models/Shop');
const { generateStatementPDF } = require('../utils/statementHelper');

// @desc    Download monthly ledger account statement as PDF
// @route   GET /api/accounts/:id/statement?month=YYYY-MM
// @access  Private (Shopkeeper owner, Account customer, or Admin)
const getAccountStatement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { month } = req.query;

    const account = await Account.findById(id)
      .populate('shop')
      .populate('customer', 'name email phone');

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    // RBAC: Shopkeeper who owns the shop, or Customer who belongs to the account, or Admin
    const isOwner =
      req.user.role === 'shopkeeper' &&
      account.shop &&
      account.shop.owner.toString() === req.user.id.toString();

    const isAccountCustomer =
      req.user.role === 'customer' &&
      account.customer &&
      account.customer._id.toString() === req.user.id.toString();

    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAccountCustomer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view or download this account statement'
      });
    }

    // Determine month string
    let monthStr = month;
    if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
      const now = new Date();
      monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    const filename = `statement-${account.customer?.name || 'account'}-${monthStr}.pdf`.replace(
      /\s+/g,
      '_'
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await generateStatementPDF(account, monthStr, res);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAccountStatement
};

