const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const validate = require('../middleware/validate');
const { registerValidator, loginValidator } = require('../validators/authValidators');

// Public routes
router.post('/register', validate(registerValidator), register);
router.post('/login', validate(loginValidator), login);

// Protected routes
router.get('/me', auth, getMe);

// Role-protected verification routes
router.get('/role/shopkeeper', auth, requireRole('shopkeeper'), (req, res) => {
  res.status(200).json({ success: true, message: 'Shopkeeper access verified', role: req.user.role });
});

router.get('/role/customer', auth, requireRole('customer'), (req, res) => {
  res.status(200).json({ success: true, message: 'Customer access verified', role: req.user.role });
});

router.get('/role/admin', auth, requireRole('admin'), (req, res) => {
  res.status(200).json({ success: true, message: 'Admin access verified', role: req.user.role });
});

module.exports = router;
