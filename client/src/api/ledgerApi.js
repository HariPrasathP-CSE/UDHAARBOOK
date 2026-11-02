import API from './authApi';

export const createLedgerEntry = async (entryData) => {
  const response = await API.post('/ledgers', entryData);
  return response.data;
};

export const reverseLedgerEntry = async (entryId) => {
  const response = await API.post(`/ledgers/${entryId}/reverse`);
  return response.data;
};

export const getAccountLedger = async (accountId, params = {}) => {
  const response = await API.get(`/ledgers/accounts/${accountId}`, { params });
  return response.data;
};

export const getAccountBalance = async (accountId) => {
  const response = await API.get(`/ledgers/accounts/${accountId}/balance`);
  return response.data;
};

