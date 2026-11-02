import API from './authApi';

export const getNotifications = async (params = {}) => {
  const response = await API.get('/notifications', { params });
  return response.data;
};

export const getUnreadNotificationCount = async () => {
  const response = await API.get('/notifications/unread-count');
  return response.data;
};

export const markNotificationRead = async (id) => {
  const response = await API.patch(`/notifications/${id}/read`);
  return response.data;
};

export const markAllNotificationsRead = async () => {
  const response = await API.put('/notifications/mark-all-read');
  return response.data;
};

