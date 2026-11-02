import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCustomerDashboardData } from '../api/dashboardApi';
import { formatCurrency } from '../api/accountApi';
import { acknowledgeLedgerEntry } from '../api/disputeApi';
import DisputeModal from '../components/DisputeModal';
import AgeingChips from '../components/AgeingChips';

const CustomerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [selectedEntryForDispute, setSelectedEntryForDispute] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const data = await getCustomerDashboardData();
      setDashboardData(data);
    } catch (err) {
      setError('Could not load customer dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleAcknowledge = async (entryId) => {
    try {
      setProcessingId(entryId);
      setError('');
      await acknowledgeLedgerEntry(entryId);
      setActionSuccess('Transaction acknowledged successfully!');
      setTimeout(() => setActionSuccess(''), 4000);
      await fetchDashboard();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to acknowledge entry');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDisputeCreated = () => {
    setActionSuccess('Dispute submitted! The shopkeeper has been notified.');
    setTimeout(() => setActionSuccess(''), 4000);
    fetchDashboard();
  };

  const { totalOwedPaise = 0, shopsSummary = [], pendingEntries = [], pendingCount = 0 } = dashboardData || {};

  return (
    <div className="container py-4 flex-grow-1">
      {/* Header Banner */}
      <div className="p-4 mb-4 bg-white rounded-3 shadow-sm border-start border-4 border-info">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-info text-dark role-badge">Customer Portal</span>
              <span className="text-muted small">UdhaarBook Transparency</span>
            </div>
            <h2 className="fw-bold text-dark mb-1">Welcome back, {user?.name}!</h2>
            <p className="text-secondary mb-0 small">
              Review your shop credit balances, verify new entries, and inspect FIFO due ageing.
            </p>
          </div>
          <div className="d-flex gap-2">
            <Link to="/customer/shops" className="btn btn-outline-info text-dark btn-sm d-flex align-items-center gap-2">
              <i className="bi bi-shop"></i>
              <span>All Stores</span>
            </Link>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="alert alert-success py-2 small d-flex align-items-center gap-2 mb-3">
          <i className="bi bi-check-circle-fill fs-5"></i>
          <div>{actionSuccess}</div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger py-2 small mb-3">
          <i className="bi bi-exclamation-triangle-fill me-1"></i> {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        {/* Total Owed Across Stores */}
        <div className="col-12 col-md-4">
          <div className="card dashboard-card border-0 shadow-sm p-3 bg-white h-100">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="text-muted small text-uppercase fw-semibold">Total Amount Owed</span>
              <i className="bi bi-wallet2 text-danger fs-5"></i>
            </div>
            <div className="fs-3 fw-bold text-danger mt-1">
              {formatCurrency(totalOwedPaise)}
            </div>
            <span className="small text-muted">Across {shopsSummary.length} connected stores</span>
          </div>
        </div>

        {/* Pending Actions */}
        <div className="col-12 col-md-4">
          <div className="card dashboard-card border-0 shadow-sm p-3 bg-white h-100">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="text-muted small text-uppercase fw-semibold">Awaiting Your Response</span>
              <i className="bi bi-bell text-warning fs-5"></i>
            </div>
            <div className={`fs-3 fw-bold mt-1 ${pendingCount > 0 ? 'text-warning' : 'text-success'}`}>
              {pendingCount}
            </div>
            <span className="small text-muted">
              {pendingCount > 0 ? 'Entries need acknowledgement' : 'All transactions up to date'}
            </span>
          </div>
        </div>

        {/* Disputes Status */}
        <div className="col-12 col-md-4">
          <div className="card dashboard-card border-0 shadow-sm p-3 bg-white h-100">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="text-muted small text-uppercase fw-semibold">Disputes Hub</span>
              <i className="bi bi-shield-exclamation text-primary fs-5"></i>
            </div>
            <div className="fs-3 fw-bold text-dark mt-1">
              <Link to="/disputes" className="text-decoration-none text-dark">
                View Disputes &rarr;
              </Link>
            </div>
            <span className="small text-muted">Contested transaction history</span>
          </div>
        </div>
      </div>

      {/* Pending Entries Awaiting Customer Review Widget */}
      {pendingEntries.length > 0 && (
        <div className="card border-0 shadow-sm bg-white mb-4">
          <div className="card-header bg-warning bg-opacity-10 border-0 pt-3 px-4 pb-2">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h6 className="fw-bold text-dark mb-0">
                  <i className="bi bi-bell-fill text-warning me-2"></i>
                  Entries Awaiting Your Action ({pendingEntries.length})
                </h6>
                <span className="text-muted small">Please confirm or dispute these purchases</span>
              </div>
              <span className="badge bg-warning text-dark">Action Required</span>
            </div>
          </div>

          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light small text-muted text-uppercase">
                  <tr>
                    <th className="ps-4">Store</th>
                    <th>Date</th>
                    <th>Type & Amount</th>
                    <th>Item Note</th>
                    <th className="text-end pe-4">Response</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingEntries.map((entry) => (
                    <tr key={entry._id}>
                      <td className="ps-4">
                        <div className="fw-bold text-dark">{entry.account?.shop?.name}</div>
                        <div className="text-muted small">{entry.account?.shop?.phone}</div>
                      </td>
                      <td className="text-nowrap small text-secondary">
                        {new Date(entry.entryDate || entry.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <span className={`fw-bold ${entry.type === 'credit' ? 'text-danger' : 'text-success'}`}>
                          {entry.type === 'credit' ? '+ ' : '- '}
                          {formatCurrency(entry.amountPaise)}
                        </span>
                        <span className="badge bg-light text-secondary border ms-2 text-uppercase" style={{ fontSize: '0.65rem' }}>
                          {entry.type}
                        </span>
                      </td>
                      <td className="small text-secondary">{entry.note || 'No note'}</td>
                      <td className="text-end pe-4 text-nowrap">
                        <button
                          className="btn btn-success btn-sm me-1"
                          onClick={() => handleAcknowledge(entry._id)}
                          disabled={processingId === entry._id}
                        >
                          {processingId === entry._id ? (
                            <span className="spinner-border spinner-border-sm"></span>
                          ) : (
                            <i className="bi bi-check-lg me-1"></i>
                          )}
                          Acknowledge
                        </button>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => setSelectedEntryForDispute(entry)}
                          disabled={processingId === entry._id}
                        >
                          <i className="bi bi-exclamation-octagon me-1"></i>
                          Dispute
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Connected Stores Overview with FIFO Ageing Chips */}
      <div className="card border-0 shadow-sm bg-white">
        <div className="card-header bg-white border-0 pt-4 px-4 pb-2">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h5 className="fw-bold text-dark mb-1">
                <i className="bi bi-shop me-2 text-info"></i>Your Connected Stores & Ageing
              </h5>
              <p className="text-muted small mb-0">Track your outstanding credit and due ageing per store</p>
            </div>
            <span className="badge bg-light text-secondary border">
              Total {shopsSummary.length} Stores
            </span>
          </div>
        </div>

        <div className="card-body p-0">
          {shopsSummary.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-shop-window fs-1 d-block mb-2"></i>
              No connected store accounts found yet.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light small text-muted text-uppercase">
                  <tr>
                    <th className="ps-4">Store</th>
                    <th>Contact Phone</th>
                    <th>Current Due</th>
                    <th>Due Ageing Breakdown (FIFO)</th>
                    <th>Credit Limit</th>
                    <th className="text-end pe-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shopsSummary.map((item) => (
                    <tr key={item.accountId}>
                      <td className="ps-4">
                        <div className="fw-bold text-dark">{item.shop?.name}</div>
                        <div className="text-muted small">{item.shop?.address}</div>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border font-monospace">
                          {item.shop?.phone}
                        </span>
                      </td>
                      <td>
                        <span className={`fw-bold ${item.balancePaise > 0 ? 'text-danger' : item.balancePaise < 0 ? 'text-success' : 'text-dark'}`}>
                          {formatCurrency(item.balancePaise || 0)}
                        </span>
                      </td>
                      <td>
                        <AgeingChips ageing={item.ageing} compact={true} />
                      </td>
                      <td>
                        <span className="text-muted small">
                          {formatCurrency(item.creditLimitPaise)}
                        </span>
                      </td>
                      <td className="text-end pe-4">
                        <Link
                          to={`/customer/accounts/${item.accountId}/ledger`}
                          className="btn btn-outline-info text-dark btn-sm fw-semibold"
                        >
                          View Ledger &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Dispute Modal */}
      <DisputeModal
        show={Boolean(selectedEntryForDispute)}
        onHide={() => setSelectedEntryForDispute(null)}
        entry={selectedEntryForDispute}
        onDisputeCreated={handleDisputeCreated}
      />
    </div>
  );
};

export default CustomerDashboard;
