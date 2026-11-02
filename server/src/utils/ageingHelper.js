const LedgerEntry = require('../models/LedgerEntry');

/**
 * Calculates due ageing buckets for an account using FIFO payment allocation.
 * Unpaid credit is allocated to:
 * - 0–7 days
 * - 8–30 days
 * - 30+ days
 *
 * @param {string|ObjectId} accountId
 * @param {Date} [asOfDate=new Date()]
 * @returns {Promise<Object>}
 */
const calculateAccountAgeing = async (accountId, asOfDate = new Date()) => {
  // Fetch all active, non-reversed entries for this account
  const entries = await LedgerEntry.find({
    account: accountId,
    isReversed: { $ne: true },
    reversalOf: null
  }).sort({ entryDate: 1, createdAt: 1 });

  // Separate credits and sum payments
  const creditEntries = [];
  let totalPaymentPaise = 0;
  let totalCreditPaise = 0;

  for (const entry of entries) {
    if (entry.type === 'credit') {
      creditEntries.push(entry);
      totalCreditPaise += entry.amountPaise;
    } else if (entry.type === 'payment') {
      totalPaymentPaise += entry.amountPaise;
    }
  }

  // FIFO payment allocation
  let remainingPayments = totalPaymentPaise;
  let days0_7Paise = 0;
  let days8_30Paise = 0;
  let days30PlusPaise = 0;

  const nowMs = asOfDate.getTime();
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  const unpaidCredits = [];

  for (const credit of creditEntries) {
    if (remainingPayments >= credit.amountPaise) {
      // Fully settled by past payments under FIFO
      remainingPayments -= credit.amountPaise;
    } else {
      // Partially or fully unpaid credit
      const unpaidAmount = credit.amountPaise - remainingPayments;
      remainingPayments = 0;

      const creditDate = new Date(credit.entryDate || credit.createdAt).getTime();
      const ageInDays = Math.max(0, Math.floor((nowMs - creditDate) / MS_PER_DAY));

      unpaidCredits.push({
        entryId: credit._id,
        entryDate: credit.entryDate || credit.createdAt,
        unpaidAmount,
        ageInDays
      });

      if (ageInDays <= 7) {
        days0_7Paise += unpaidAmount;
      } else if (ageInDays <= 30) {
        days8_30Paise += unpaidAmount;
      } else {
        days30PlusPaise += unpaidAmount;
      }
    }
  }

  const netBalancePaise = totalCreditPaise - totalPaymentPaise;

  return {
    days0_7Paise,
    days8_30Paise,
    days30PlusPaise,
    ageing: {
      '0-7': days0_7Paise,
      '8-30': days8_30Paise,
      '30+': days30PlusPaise
    },
    unpaidCredits,
    totalCreditPaise,
    totalPaymentPaise,
    netBalancePaise,
    advancePaymentPaise: remainingPayments
  };
};

module.exports = { calculateAccountAgeing };

