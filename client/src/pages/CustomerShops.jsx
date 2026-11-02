import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCustomerShops, formatCurrency } from '../api/accountApi';
import { useAuth } from '../context/AuthContext';

const CustomerShops = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchShops = async () => {
    try {
      setLoading(true);
      const data = await getCustomerShops();
      setAccounts(data.accounts || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to fetch linked shops');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShops();
  }, []);

  return (
    <div className="container py-4 flex-grow-1">
      {/* Page Header */}
      <div className="p-4 mb-4 bg-white rounded-3 shadow-sm border-start border-4 border-info">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-info text-dark role-badge">Customer Portal</span>
              <span className="text-muted small">UdhaarBook Transparency</span>
            </div>
            <h2 className="fw-bold text-dark mb-1">My Connected Stores</h2>
            <p className="text-secondary mb-0 small">
              View all neighbourhood shops where you hold an active credit account and check your approved credit limit.
            </p>
          </div>
          <div>
            <button className="btn btn-outline-info text-dark btn-sm d-flex align-items-center gap-2" onClick={fetchShops}>
              <i className="bi bi-arrow-clockwise"></i>
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger py-2 small mb-4">
          <i className="bi bi-exclamation-triangle-fill me-1"></i> {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-info" role="status">
            <span className="visually-hidden">Loading shops...</span>
          </div>
          <div className="text-muted small mt-2">Loading your connected stores...</div>
        </div>
      ) : accounts.length === 0 ? (
        <div className="card border-0 shadow-sm text-center p-5">
          <div className="mb-3 text-muted">
            <i className="bi bi-shop-window fs-1"></i>
          </div>
          <h5 className="fw-bold text-dark">No Stores Linked Yet</h5>
          <p className="text-muted small mb-3" style={{ maxWidth: '420px', margin: '0 auto' }}>
            Give your phone number (<strong>{user?.phone}</strong>) to your local shopkeeper. Once they add you to their UdhaarBook, their store and your credit limit will appear here.
          </p>
        </div>
      ) : (
        <div className="row g-4">
          {accounts.map((acc) => (
            <div key={acc._id} className="col-12 col-md-6 col-lg-4">
              <div className="card dashboard-card border-0 shadow-sm h-100">
                <div className="card-body d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <span className="badge bg-success bg-opacity-10 text-success border border-success">
                      <i className="bi bi-check-circle me-1"></i> Linked Store
                    </span>
                    <span className="badge bg-light text-secondary border">
                      {new Date(acc.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h5 className="fw-bold text-dark mb-1">
                    <i className="bi bi-shop text-primary me-2"></i>
                    {acc.shop?.name || 'Local Store'}
                  </h5>

                  <p className="text-muted small mb-3">
                    <i className="bi bi-geo-alt me-1"></i>
                    {acc.shop?.address || 'Local Neighbourhood Store'}
                  </p>

                  <div className="p-3 bg-light rounded-3 border mb-3 mt-auto">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="text-muted small">Credit Limit Allowed:</span>
                      <span className="fw-bold text-success fs-5">
                        {formatCurrency(acc.creditLimit)}
                      </span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center small text-secondary">
                      <span>Owner Contact:</span>
                      <span className="fw-semibold">{acc.shop?.phone || acc.shop?.owner?.phone || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-top d-flex justify-content-between align-items-center">
                    <span className="small text-muted">
                      Status: <span className="text-success fw-semibold">Active Ledger</span>
                    </span>
                    <Link to={`/customer/accounts/${acc._id}/ledger`} className="btn btn-primary btn-sm fw-semibold">
                      <i className="bi bi-journal-text me-1"></i> View Ledger
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerShops;

