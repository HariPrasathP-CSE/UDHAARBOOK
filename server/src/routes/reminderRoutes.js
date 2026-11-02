const express = require('express');
const router = express.Router();
const {
  getReminderSettings,
  updateReminderSettings,
  sendManualReminder,
  getAccountReminderHistory,
  listShopReminders,
  triggerReminderJob
} = require('../controllers/reminderController');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const validate = require('../middleware/validate');
const { updateReminderSettingsValidator, sendReminderValidator } = require('../validators/reminderValidators');

// All reminder endpoints require authentication
router.use(auth);

// Settings
router.get('/settings', requireRole('shopkeeper'), getReminderSettings);
router.put('/settings', requireRole('shopkeeper'), validate(updateReminderSettingsValidator), updateReminderSettings);

// Manual trigger & history
router.post('/accounts/:accountId/send', requireRole('shopkeeper', 'admin'), validate(sendReminderValidator), sendManualReminder);
router.get('/accounts/:accountId', getAccountReminderHistory);

// Shop-wide list & job trigger
router.get('/', requireRole('shopkeeper'), listShopReminders);
router.post('/trigger-job', requireRole('shopkeeper', 'admin'), triggerReminderJob);

module.exports = router;

