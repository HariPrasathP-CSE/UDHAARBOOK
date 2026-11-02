import API from './authApi';

export const getReminderSettings = async () => {
  const response = await API.get('/reminders/settings');
  return response.data;
};

export const updateReminderSettings = async (data) => {
  const response = await API.put('/reminders/settings', data);
  return response.data;
};

export const sendManualReminder = async (accountId, data = {}) => {
  const response = await API.post(`/reminders/accounts/${accountId}/send`, data);
  return response.data;
};

export const getAccountReminderHistory = async (accountId) => {
  const response = await API.get(`/reminders/accounts/${accountId}`);
  return response.data;
};

export const listShopReminders = async (params = {}) => {
  const response = await API.get('/reminders', { params });
  return response.data;
};

export const triggerDailyReminderJob = async () => {
  const response = await API.post('/reminders/trigger-job');
  return response.data;
};

