const express = require('express');
const router = express.Router();
const {
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead
} = require('../controllers/notificationController');
const auth = require('../middleware/auth');

// All notification routes require authentication
router.use(auth);

router.get('/', listNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/:id/read', markRead);
router.put('/mark-all-read', markAllRead);

module.exports = router;

