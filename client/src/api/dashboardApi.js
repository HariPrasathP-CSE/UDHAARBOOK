import API from './authApi';

export const getShopkeeperDashboardData = async () => {
  const response = await API.get('/dashboard/shopkeeper');
  return response.data;
};

export const getCustomerDashboardData = async () => {
  const response = await API.get('/dashboard/customer');
  return response.data;
};

