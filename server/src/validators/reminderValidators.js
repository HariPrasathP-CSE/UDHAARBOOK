const { body, param } = require('express-validator');

const updateReminderSettingsValidator = [
  body('enabled').optional().isBoolean().withMessage('enabled must be a boolean'),
  body('frequencyDays')
    .optional()
    .isInt({ min: 1 })
    .withMessage('frequencyDays must be an integer >= 1'),
  body('minOverdueDays')
    .optional()
    .isInt({ min: 1 })
    .withMessage('minOverdueDays must be an integer >= 1'),
  body('messageTemplate').optional().isString().withMessage('messageTemplate must be text')
];

const sendReminderValidator = [
  param('accountId').isMongoId().withMessage('Valid account ID is required'),
  body('message').optional().isString().withMessage('Message must be text')
];

module.exports = {
  updateReminderSettingsValidator,
  sendReminderValidator
};

