const express = require('express');
const router = express.Router();
const { getMyShop, createMyShop, updateMyShop } = require('../controllers/shopController');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const validate = require('../middleware/validate');
const { createShopValidator, updateShopValidator } = require('../validators/shopValidators');

// All shop endpoints are for shopkeepers
router.use(auth);

router.get('/me', requireRole('shopkeeper'), getMyShop);
router.post('/', requireRole('shopkeeper'), validate(createShopValidator), createMyShop);
router.put('/me', requireRole('shopkeeper'), validate(updateShopValidator), updateMyShop);

module.exports = router;

