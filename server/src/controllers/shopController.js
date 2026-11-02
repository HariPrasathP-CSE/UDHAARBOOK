const Shop = require('../models/Shop');

// @desc    Get current shopkeeper's shop
// @route   GET /api/shops/me
// @access  Private (shopkeeper)
const getMyShop = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ owner: req.user.id });
    res.status(200).json({
      success: true,
      shop: shop || null
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a shop for current shopkeeper
// @route   POST /api/shops
// @access  Private (shopkeeper)
const createMyShop = async (req, res, next) => {
  try {
    const { name, address, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Shop name and contact phone are required'
      });
    }

    const existingShop = await Shop.findOne({ owner: req.user.id });
    if (existingShop) {
      return res.status(400).json({
        success: false,
        message: 'A shop is already registered for this account'
      });
    }

    const shop = await Shop.create({
      owner: req.user.id,
      name: name.trim(),
      address: (address || '').trim(),
      phone: phone.trim()
    });

    res.status(201).json({
      success: true,
      shop
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update current shopkeeper's shop
// @route   PUT /api/shops/me
// @access  Private (shopkeeper)
const updateMyShop = async (req, res, next) => {
  try {
    const { name, address, phone } = req.body;

    const shop = await Shop.findOne({ owner: req.user.id });
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'No shop found for your account. Please create one first.'
      });
    }

    if (name) shop.name = name.trim();
    if (address !== undefined) shop.address = address.trim();
    if (phone) shop.phone = phone.trim();

    await shop.save();

    res.status(200).json({
      success: true,
      shop
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyShop,
  createMyShop,
  updateMyShop
};

