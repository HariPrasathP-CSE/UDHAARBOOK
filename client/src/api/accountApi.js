import API from './authApi';

// Currency helpers: Convert between user-facing Rupees and ledger-level integer paise
export const rupeesToPaise = (rupees) => {
  const num = parseFloat(rupees);
  if (isNaN(num) || num < 0) return 0;
  return Math.round(num * 100);
};

export const paiseToRupees = (paise) => {
  return ((paise || 0) / 100).toFixed(2);
};

export const formatCurrency = (paise) => {
  const rs = (paise || 0) / 100;
  return `₹ ${rs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const addCustomerToShop = async (data) => {
  const response = await API.post('/accounts', data);
  return response.data;
};

export const getShopCustomers = async (params = {}) => {
  const response = await API.get('/accounts', { params });
  return response.data;
};

export const updateCreditLimit = async (accountId, data) => {
  const response = await API.patch(`/accounts/${accountId}/credit-limit`, data);
  return response.data;
};

export const getCustomerShops = async () => {
  const response = await API.get('/accounts/my-shops');
  return response.data;
};

export const downloadStatementPDF = async (accountId, month, customerName = 'statement') => {
  const response = await API.get(`/accounts/${accountId}/statement`, {
    params: { month },
    responseType: 'blob'
  });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', `${customerName.replace(/\s+/g, '_')}_statement_${month || 'period'}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
  return true;
};

