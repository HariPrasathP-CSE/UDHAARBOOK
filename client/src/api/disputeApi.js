import API from './authApi';

export const acknowledgeLedgerEntry = async (entryId) => {
  const response = await API.post(`/ledgers/${entryId}/acknowledge`);
  return response.data;
};

export const disputeLedgerEntry = async (entryId, reason) => {
  const response = await API.post(`/ledgers/${entryId}/dispute`, { reason });
  return response.data;
};

export const listDisputes = async (params = {}) => {
  const response = await API.get('/disputes', { params });
  return response.data;
};

export const getDisputeById = async (id) => {
  const response = await API.get(`/disputes/${id}`);
  return response.data;
};

export const getDisputeByEntry = async (entryId) => {
  const response = await API.get(`/disputes/entry/${entryId}`);
  return response.data;
};

export const resolveDispute = async (id, data) => {
  const response = await API.post(`/disputes/${id}/resolve`, data);
  return response.data;
};

export const escalateDispute = async (id, note) => {
  const response = await API.post(`/disputes/${id}/escalate`, { note });
  return response.data;
};

