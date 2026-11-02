const express = require('express');
const router = express.Router();
const {
  createEntry,
  reverseEntry,
  getAccountBalance,
  getAccountLedger,
  listShopLedger
} = require('../controllers/ledgerController');
const {
  acknowledgeEntry,
  disputeEntry
} = require('../controllers/disputeController');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const validate = require('../middleware/validate');
const { createEntryValidator, reverseEntryValidator } = require('../validators/ledgerValidators');

// All ledger routes require authentication
router.use(auth);

// Shop-wide ledger listing with filters
router.get('/', requireRole('shopkeeper'), listShopLedger);

// Account ledger queries (accessible by shopkeeper, customer, admin)
router.get('/accounts/:accountId', getAccountLedger);
router.get('/accounts/:accountId/balance', getAccountBalance);

// Shopkeeper ledger mutations
router.post('/', requireRole('shopkeeper'), validate(createEntryValidator), createEntry);
router.post('/:id/reverse', requireRole('shopkeeper'), validate(reverseEntryValidator), reverseEntry);

// Customer entry verification actions
router.post('/:id/acknowledge', acknowledgeEntry);
router.post('/:id/dispute', disputeEntry);

module.exports = router;
