const cron = require('node-cron');
const Shop = require('../models/Shop');
const Account = require('../models/Account');
const Reminder = require('../models/Reminder');
const { calculateAccountAgeing } = require('../utils/ageingHelper');
const { createNotification } = require('../utils/notificationHelper');
const { sendReminderEmail } = require('../utils/mailHelper');

/**
 * Executes the daily reminder job.
 * Scans all shops with automated reminders enabled, finds overdue accounts,
 * verifies the frequency window, and sends in-app + email notifications.
 */
const runDailyReminderJob = async () => {
  console.log('[ReminderJob] Starting daily automated reminder job...');
  const stats = {
    shopsProcessed: 0,
    accountsEvaluated: 0,
    remindersSent: 0,
    remindersSkipped: 0
  };

  try {
    const shops = await Shop.find({ 'reminderSettings.enabled': true });
    stats.shopsProcessed = shops.length;

    for (const shop of shops) {
      const frequencyDays = shop.reminderSettings?.frequencyDays || 7;
      const minOverdueDays = shop.reminderSettings?.minOverdueDays || 8;
      const messageTemplate =
        shop.reminderSettings?.messageTemplate ||
        'Dear {customerName}, this is a gentle reminder that your outstanding balance of ₹{amount} at {shopName} is overdue. Kindly clear your dues at your earliest convenience.';

      const accounts = await Account.find({ shop: shop._id, active: true }).populate('customer');

      for (const account of accounts) {
        stats.accountsEvaluated++;

        if (!account.customer) continue;

        const ageingData = await calculateAccountAgeing(account._id);
        if (ageingData.netBalancePaise <= 0) continue;

        // Check if dues meet overdue threshold
        const now = Date.now();
        const hasOverdueCredit = ageingData.unpaidCredits.some((credit) => {
          const daysOld = (now - new Date(credit.entryDate).getTime()) / (1000 * 60 * 60 * 24);
          return daysOld >= minOverdueDays;
        });

        if (!hasOverdueCredit) continue;

        // Verify frequency window
        const frequencyWindowStart = new Date(now - frequencyDays * 24 * 60 * 60 * 1000);
        const recentReminder = await Reminder.findOne({
          account: account._id,
          sentAt: { $gte: frequencyWindowStart },
          status: 'sent'
        });

        if (recentReminder) {
          stats.remindersSkipped++;
          continue;
        }

        // Render message template
        const formattedAmount = (ageingData.netBalancePaise / 100).toFixed(2);
        const renderedMessage = messageTemplate
          .replace(/{customerName}/g, account.customer.name)
          .replace(/{amount}/g, formattedAmount)
          .replace(/{shopName}/g, shop.name);

        // 1. In-app notification
        const notification = await createNotification({
          recipient: account.customer._id,
          sender: shop.owner,
          type: 'payment_reminder',
          title: `Payment Reminder: ${shop.name}`,
          message: renderedMessage,
          data: {
            accountId: account._id,
            shopId: shop._id,
            amountPaise: ageingData.netBalancePaise
          }
        });

        // 2. Email notification
        const emailResult = await sendReminderEmail({
          to: account.customer.email,
          customerName: account.customer.name,
          shopName: shop.name,
          amountPaise: ageingData.netBalancePaise,
          customMessage: renderedMessage,
          shopPhone: shop.phone
        });

        // 3. Log Reminder record
        await Reminder.create({
          shop: shop._id,
          account: account._id,
          customer: account.customer._id,
          amountPaise: ageingData.netBalancePaise,
          type: 'automated',
          channel: 'both',
          status: 'sent',
          message: renderedMessage,
          emailSent: emailResult.success,
          inAppSent: !!notification,
          emailPreviewUrl: emailResult.previewUrl,
          sentBy: null,
          sentAt: new Date()
        });

        stats.remindersSent++;
      }
    }

    console.log('[ReminderJob] Job completed successfully:', stats);
    return stats;
  } catch (error) {
    console.error('[ReminderJob] Error running reminder job:', error.message);
    return stats;
  }
};

/**
 * Initializes the node-cron scheduled job.
 */
let scheduledTask = null;
const startReminderCron = (cronExpression = '0 10 * * *') => {
  if (scheduledTask) {
    scheduledTask.stop();
  }
  scheduledTask = cron.schedule(cronExpression, runDailyReminderJob);
  console.log(`[ReminderJob] Scheduled daily reminder cron with schedule: "${cronExpression}"`);
  return scheduledTask;
};

module.exports = {
  runDailyReminderJob,
  startReminderCron
};

