import API from './authApi';

export const getMyShop = async () => {
  const response = await API.get('/shops/me');
  return response.data;
};

export const createMyShop = async (shopData) => {
  const response = await API.post('/shops', shopData);
  return response.data;
};

export const updateMyShop = async (shopData) => {
  const response = await API.put('/shops/me', shopData);
  return response.data;
};

