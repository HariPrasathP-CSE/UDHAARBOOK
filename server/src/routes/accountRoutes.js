const express = require('express');
const router = express.Router();
const {
  addCustomer,
  updateCreditLimit,
  listShopCustomers,
  getMyShops
} = require('../controllers/accountController');
const { getAccountStatement } = require('../controllers/statementController');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const validate = require('../middleware/validate');
const { addCustomerValidator, updateCreditLimitValidator } = require('../validators/accountValidators');

// All account endpoints require auth
router.use(auth);

// Statement endpoint: accessible by shopkeeper and that customer
router.get('/:id/statement', getAccountStatement);

// Customer endpoints
router.get('/my-shops', requireRole('customer'), getMyShops);

// Shopkeeper endpoints
router.post('/', requireRole('shopkeeper'), validate(addCustomerValidator), addCustomer);
router.get('/', requireRole('shopkeeper'), listShopCustomers);
router.patch('/:id/credit-limit', requireRole('shopkeeper'), validate(updateCreditLimitValidator), updateCreditLimit);

module.exports = router;

