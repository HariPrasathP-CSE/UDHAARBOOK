const express = require('express');
const router = express.Router();
const authRoutes = require('./authRoutes');
const shopRoutes = require('./shopRoutes');
const accountRoutes = require('./accountRoutes');
const ledgerRoutes = require('./ledgerRoutes');
const disputeRoutes = require('./disputeRoutes');
const notificationRoutes = require('./notificationRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const reminderRoutes = require('./reminderRoutes');
const adminRoutes = require('./adminRoutes');

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    app: 'UdhaarBook API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Mount modular sub-routes
router.use('/auth', authRoutes);
router.use('/shops', shopRoutes);
router.use('/accounts', accountRoutes);
router.use('/ledgers', ledgerRoutes);
router.use('/disputes', disputeRoutes);
router.use('/notifications', notificationRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reminders', reminderRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
