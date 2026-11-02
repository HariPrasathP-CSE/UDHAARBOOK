const { body } = require('express-validator');

const createShopValidator = [
  body('name').trim().notEmpty().withMessage('Shop name is required'),
  body('phone').trim().notEmpty().withMessage('Shop contact phone is required'),
  body('address').optional().isString()
];

const updateShopValidator = [
  body('name').optional().trim().notEmpty().withMessage('Shop name cannot be empty'),
  body('phone').optional().trim().notEmpty().withMessage('Shop contact phone cannot be empty'),
  body('address').optional().isString()
];

module.exports = {
  createShopValidator,
  updateShopValidator,
  shopValidator: createShopValidator
};
