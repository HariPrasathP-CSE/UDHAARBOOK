import API from './authApi';

export const getPlatformStats = async () => {
  const response = await API.get('/admin/stats');
  return response.data;
};

export const getAdminUsers = async (params = {}) => {
  const response = await API.get('/admin/users', { params });
  return response.data;
};

export const toggleUserStatus = async (id, isActive) => {
  const response = await API.patch(`/admin/users/${id}/status`, { isActive });
  return response.data;
};

export const getAdminShops = async (params = {}) => {
  const response = await API.get('/admin/shops', { params });
  return response.data;
};

export const toggleShopStatus = async (id, active) => {
  const response = await API.patch(`/admin/shops/${id}/status`, { active });
  return response.data;
};

export const getAdminDisputes = async (params = {}) => {
  const response = await API.get('/admin/disputes', { params });
  return response.data;
};

export const resolveAdminDispute = async (id, data) => {
  const response = await API.post(`/admin/disputes/${id}/resolve`, data);
  return response.data;
};

