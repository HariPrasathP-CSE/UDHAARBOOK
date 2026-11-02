const { body } = require('express-validator');

const registerValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').trim().isEmail().withMessage('Please provide a valid email address'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .optional()
    .isIn(['shopkeeper', 'customer', 'admin'])
    .withMessage('Role must be one of: shopkeeper, customer, admin')
];

const loginValidator = [
  body('email')
    .optional()
    .trim(),
  body('identifier')
    .optional()
    .trim(),
  body('password').notEmpty().withMessage('Password is required'),
  body().custom((value) => {
    if (!value.email && !value.identifier) {
      throw new Error('Please provide email or phone number');
    }
    return true;
  })
];

module.exports = {
  registerValidator,
  loginValidator
};

