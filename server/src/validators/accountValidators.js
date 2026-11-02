const { body, param } = require('express-validator');

const addCustomerValidator = [
  body('creditLimit')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Credit limit must be a positive integer in paise')
];

const updateCreditLimitValidator = [
  param('id').isMongoId().withMessage('Valid account ID is required'),
  body('creditLimit')
    .isInt({ min: 0 })
    .withMessage('Credit limit must be a non-negative integer in paise')
];

module.exports = {
  addCustomerValidator,
  updateCreditLimitValidator
};

