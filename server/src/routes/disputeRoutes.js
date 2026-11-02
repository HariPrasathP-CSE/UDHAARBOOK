const express = require('express');
const router = express.Router();
const {
  listDisputes,
  getDisputeById,
  getDisputeByEntry,
  resolveDispute,
  escalateDispute
} = require('../controllers/disputeController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { resolveDisputeValidator, escalateDisputeValidator } = require('../validators/disputeValidators');

// All dispute routes require authentication
router.use(auth);

router.get('/', listDisputes);
router.get('/:id', getDisputeById);
router.get('/entry/:entryId', getDisputeByEntry);
router.post('/:id/resolve', validate(resolveDisputeValidator), resolveDispute);
router.post('/:id/escalate', validate(escalateDisputeValidator), escalateDispute);

module.exports = router;

