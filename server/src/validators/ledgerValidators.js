const { body, param } = require('express-validator');

const createEntryValidator = [
  body('accountId').isMongoId().withMessage('Valid account ID is required'),
  body('type')
    .isIn(['credit', 'payment'])
    .withMessage('Entry type must be either credit or payment'),
  body('amountPaise')
    .isInt({ min: 1 })
    .withMessage('Amount must be a positive integer in paise (min 1 paisa)'),
  body('note')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Note cannot exceed 500 characters')
];

const reverseEntryValidator = [
  param('id').isMongoId().withMessage('Valid ledger entry ID is required')
];

module.exports = {
  createEntryValidator,
  reverseEntryValidator
};

