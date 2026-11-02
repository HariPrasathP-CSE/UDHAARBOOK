const express = require('express');
const router = express.Router();
const {
  getPlatformStats,
  listUsers,
  toggleUserStatus,
  listShops,
  toggleShopStatus,
  listAdminDisputes,
  resolveAdminDispute
} = require('../controllers/adminController');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

// All admin routes strictly require admin role
router.use(auth, requireRole('admin'));

// Platform Stats
router.get('/stats', getPlatformStats);

// User Management
router.get('/users', listUsers);
router.patch('/users/:id/status', toggleUserStatus);

// Shop Management
router.get('/shops', listShops);
router.patch('/shops/:id/status', toggleShopStatus);

// Dispute Escalations & Resolutions
router.get('/disputes', listAdminDisputes);
router.post('/disputes/:id/resolve', resolveAdminDispute);

module.exports = router;

