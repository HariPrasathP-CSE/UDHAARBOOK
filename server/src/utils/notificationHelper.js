const Notification = require('../models/Notification');

const createNotification = async ({
  recipient,
  sender = null,
  type = 'general',
  title,
  message,
  data = {}
}) => {
  try {
    if (!recipient || !title || !message) return null;

    const notification = await Notification.create({
      recipient,
      sender,
      type,
      title,
      message,
      data
    });

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error.message);
    return null;
  }
};

module.exports = { createNotification };

