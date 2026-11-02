const { body, param } = require('express-validator');

const raiseDisputeValidator = [
  param('id').isMongoId().withMessage('Valid ledger entry ID is required'),
  body('reason').trim().notEmpty().withMessage('Dispute reason is required')
];

const resolveDisputeValidator = [
  param('id').isMongoId().withMessage('Valid dispute ID is required'),
  body('action')
    .isIn(['accept', 'reject'])
    .withMessage('Action must be either accept or reject'),
  body('note')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Resolution note cannot exceed 500 characters')
];

const escalateDisputeValidator = [
  param('id').isMongoId().withMessage('Valid dispute ID is required'),
  body('reason')
    .optional()
    .isString()
    .withMessage('Escalation reason must be text')
];

module.exports = {
  raiseDisputeValidator,
  resolveDisputeValidator,
  escalateDisputeValidator
};

