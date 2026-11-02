const express = require('express');
const router = express.Router();
const {
  getShopkeeperDashboard,
  getCustomerDashboard
} = require('../controllers/dashboardController');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

router.use(auth);

router.get('/shopkeeper', requireRole('shopkeeper'), getShopkeeperDashboard);
router.get('/customer', requireRole('customer'), getCustomerDashboard);

module.exports = router;

