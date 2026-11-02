import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getAccountLedger } from '../api/ledgerApi';
import { formatCurrency } from '../api/accountApi';
import { acknowledgeLedgerEntry, getDisputeByEntry } from '../api/disputeApi';
import DisputeModal from '../components/DisputeModal';
import FilterBar from '../components/FilterBar';
import AgeingChips from '../components/AgeingChips';
import StatementDownloadModal from '../components/StatementDownloadModal';

const CustomerLedger = () => {
  const { accountId } = useParams();
  const navigate = useNavigate();

  const [ledgerData, setLedgerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: '',
    type: 'all',
    status: 'all',
    startDate: '',
    endDate: ''
  });
  const [selectedEntryForDispute, setSelectedEntryForDispute] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [showStatementModal, setShowStatementModal] = useState(false);

  const fetchLedger = useCallback(async (pageToLoad = 1, currentFilters = filters) => {
    try {
      setLoading(true);
      const data = await getAccountLedger(accountId, { page: pageToLoad, limit: 20, ...currentFilters });
      setLedgerData(data);
      setPage(data.pagination.page);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  }, [accountId, filters]);

  useEffect(() => {
    fetchLedger(1, filters);
  }, [accountId]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    fetchLedger(1, newFilters);
  };

  const handleAcknowledge = async (entryId) => {
    try {
      setProcessingId(entryId);
      setError('');
      await acknowledgeLedgerEntry(entryId);
      setActionSuccess('Entry acknowledged successfully!');
      setTimeout(() => setActionSuccess(''), 4000);
      await fetchLedger(page);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to acknowledge entry');
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewDispute = async (entryId) => {
    try {
      const data = await getDisputeByEntry(entryId);
      if (data.dispute) {
        navigate(`/disputes/${data.dispute._id}`);
      } else {
        navigate('/disputes');
      }
    } catch (err) {
      navigate('/disputes');
    }
  };

  const handleDisputeCreated = () => {
    setActionSuccess('Dispute submitted! The shopkeeper has been alerted to review it.');
    setTimeout(() => setActionSuccess(''), 5000);
    fetchLedger(page);
  };

  if (loading && !ledgerData) {
    return (
      <div className="container py-5 text-center flex-grow-1">
        <div className="spinner-border text-info" role="status">
          <span className="visually-hidden">Loading ledger...</span>
        </div>
        <div className="text-muted small mt-2">Loading store ledger statement...</div>
      </div>
    );
  }

  if (error && !ledgerData) {
    return (
      <div className="container py-5 flex-grow-1">
        <div className="alert alert-danger">{error}</div>
        <Link to="/customer/shops" className="btn btn-outline-secondary">
          &larr; Return to My Stores
        </Link>
      </div>
    );
  }

  const { account, balance, entries, pagination } = ledgerData || {};
  const netDue = balance?.netBalancePaise || 0;
  const pendingCount = entries?.filter((e) => e.status === 'pending' && !e.isReversed).length || 0;

  return (
    <div className="container py-4 flex-grow-1">
      {/* Back button */}
      <div className="mb-3">
        <Link to="/customer/shops" className="text-decoration-none text-secondary small d-inline-flex align-items-center gap-1">
          <i className="bi bi-arrow-left"></i> Back to Connected Stores
        </Link>
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

      {/* Pending acknowledgement alert */}
      {pendingCount > 0 && (
        <div className="alert alert-warning py-3 px-4 shadow-sm mb-4 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-3">
            <i className="bi bi-bell-fill fs-3 text-warning"></i>
            <div>
              <h6 className="fw-bold text-dark mb-0">Action Required: {pendingCount} Pending Transaction(s)</h6>
              <div className="small text-secondary">
                Please review your store entries below. Click <strong>Acknowledge</strong> to confirm or <strong>Dispute</strong> if incorrect.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Store Header Banner */}
      <div className="p-4 mb-4 bg-white rounded-3 shadow-sm border-start border-4 border-info">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-info text-dark role-badge">Customer Ledger</span>
              <span className="text-muted small">Two-Party Verified</span>
            </div>
            <h2 className="fw-bold text-dark mb-1">{account?.shop?.name}</h2>
            <p className="text-secondary mb-0 small">
              <i className="bi bi-geo-alt me-1"></i> {account?.shop?.address || 'Local Market'}
              &middot; <i className="bi bi-telephone me-1"></i> {account?.shop?.phone}
            </p>
          </div>

          <div className="d-flex flex-column align-items-md-end gap-2">
            <div className="text-md-end">
              <span className="text-muted small d-block">Approved Credit Limit</span>
              <span className="fs-4 fw-bold text-success">
                {formatCurrency(account?.creditLimit || 0)}
              </span>
            </div>
            <button
              className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
              onClick={() => setShowStatementModal(true)}
            >
              <i className="bi bi-file-earmark-pdf"></i>
              <span>Download Statement</span>
            </button>
          </div>
        </div>
      </div>

      {/* Balance Summary Cards */}
      <div className="row g-3 mb-4">
        {/* Net Outstanding Balance */}
        <div className="col-12 col-md-4">
          <div className="card dashboard-card border-0 shadow-sm p-3 bg-white h-100">
            <div className="text-muted small text-uppercase fw-semibold">Your Total Due</div>
            <div className={`fs-3 fw-bold mt-1 ${netDue > 0 ? 'text-danger' : netDue < 0 ? 'text-success' : 'text-dark'}`}>
              {formatCurrency(Math.abs(netDue))}
            </div>
            <div className="mb-2">
              <AgeingChips ageing={balance?.ageing} compact={true} />
            </div>
            <span className="small text-muted">
              {netDue > 0 ? 'Payable to store' : netDue < 0 ? 'Advance credit in store' : 'All accounts settled'}
            </span>
          </div>
        </div>

        {/* Total Credits */}
        <div className="col-12 col-md-4">
          <div className="card dashboard-card border-0 shadow-sm p-3 bg-white h-100">
            <div className="text-muted small text-uppercase fw-semibold">Total Purchases (Credit)</div>
            <div className="fs-3 fw-bold text-dark mt-1">
              {formatCurrency(balance?.totalCreditPaise || 0)}
            </div>
            <span className="small text-muted">Goods taken on credit</span>
          </div>
        </div>

        {/* Total Payments */}
        <div className="col-12 col-md-4">
          <div className="card dashboard-card border-0 shadow-sm p-3 bg-white h-100">
            <div className="text-muted small text-uppercase fw-semibold">Total Payments Paid</div>
            <div className="fs-3 fw-bold text-success mt-1">
              {formatCurrency(balance?.totalPaymentPaise || 0)}
            </div>
            <span className="small text-muted">Cash & UPI settled</span>
          </div>
        </div>
      </div>

      {/* Running Balance Ledger Table */}
      <div className="card border-0 shadow-sm bg-white">
        <div className="card-header bg-white border-0 pt-4 px-4 pb-2">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h5 className="fw-bold text-dark mb-1">
                <i className="bi bi-card-checklist me-2 text-info"></i>Store Transaction History
              </h5>
              <p className="text-muted small mb-0">Two-party verification: acknowledge agreed entries or dispute discrepancies</p>
            </div>
            <span className="badge bg-light text-secondary border">
              Total {pagination?.total || 0} Records
            </span>
          </div>
        </div>

        {/* Reusable FilterBar */}
        <div className="px-4 pt-2 pb-0">
          <FilterBar
            filters={filters}
            onChange={handleFilterChange}
            showType={true}
            showStatus={true}
            showDateRange={true}
            searchPlaceholder="Search by item note or transaction ID..."
          />
        </div>

        <div className="card-body p-0">
          {entries?.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-journal-check fs-1 text-muted mb-2 d-block"></i>
              <h6 className="fw-semibold text-secondary">No entries recorded in this ledger yet</h6>
              <p className="text-muted small">When your shopkeeper records purchases or payments, they will appear here.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light text-uppercase small text-muted">
                  <tr>
                    <th className="ps-4">Date</th>
                    <th>Details / Items</th>
                    <th>Credit (+)</th>
                    <th>Payment (-)</th>
                    <th>Running Balance</th>
                    <th className="pe-4 text-end">Two-Party Status / Action</th>
                  </tr>
                </thead>
                <tbody>
                  {entries?.map((entry) => {
                    const isReversed = entry.isReversed;
                    const isReversal = Boolean(entry.reversalOf);

                    return (
                      <tr key={entry._id} className={isReversed ? 'table-light text-muted' : ''}>
                        <td className="ps-4 text-nowrap">
                          <div className={`fw-semibold ${isReversed ? 'text-decoration-line-through text-muted' : 'text-dark'}`}>
                            {new Date(entry.entryDate || entry.createdAt).toLocaleDateString()}
                          </div>
                          <span className="text-muted font-monospace" style={{ fontSize: '0.7rem' }}>
                            #{entry._id.slice(-6)}
                          </span>
                        </td>

                        <td>
                          <div className={isReversed ? 'text-decoration-line-through text-muted' : 'text-dark'}>
                            {entry.note || (entry.type === 'credit' ? 'Credit Purchase' : 'Payment Received')}
                          </div>
                          {isReversal && (
                            <span className="badge bg-secondary bg-opacity-25 text-dark border small">
                              Compensating Reversal
                            </span>
                          )}
                          {isReversed && (
                            <span className="badge bg-warning text-dark ms-1 small">
                              Reversed
                            </span>
                          )}
                        </td>

                        <td>
                          {entry.type === 'credit' ? (
                            <span className={`fw-bold text-danger ${isReversed ? 'text-decoration-line-through' : ''}`}>
                              {formatCurrency(entry.amountPaise)}
                            </span>
                          ) : (
                            <span className="text-muted">&mdash;</span>
                          )}
                        </td>

                        <td>
                          {entry.type === 'payment' ? (
                            <span className={`fw-bold text-success ${isReversed ? 'text-decoration-line-through' : ''}`}>
                              {formatCurrency(entry.amountPaise)}
                            </span>
                          ) : (
                            <span className="text-muted">&mdash;</span>
                          )}
                        </td>

                        <td>
                          <span className="fw-bold text-dark font-monospace">
                            {formatCurrency(entry.runningBalancePaise)}
                          </span>
                        </td>

                        <td className="pe-4 text-end">
                          {entry.status === 'pending' && !isReversed ? (
                            <div className="d-inline-flex gap-1">
                              <button
                                className="btn btn-success btn-sm d-inline-flex align-items-center gap-1"
                                onClick={() => handleAcknowledge(entry._id)}
                                disabled={processingId === entry._id}
                                title="Acknowledge this record"
                              >
                                {processingId === entry._id ? (
                                  <span className="spinner-border spinner-border-sm"></span>
                                ) : (
                                  <i className="bi bi-check-lg"></i>
                                )}
                                <span>Acknowledge</span>
                              </button>
                              <button
                                className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1"
                                onClick={() => setSelectedEntryForDispute(entry)}
                                disabled={processingId === entry._id}
                                title="Dispute this record"
                              >
                                <i className="bi bi-exclamation-octagon"></i>
                                <span>Dispute</span>
                              </button>
                            </div>
                          ) : entry.status === 'disputed' ? (
                            <div className="d-inline-flex align-items-center gap-2">
                              <span className="badge bg-danger text-uppercase">Disputed</span>
                              <button
                                className="btn btn-outline-secondary btn-sm"
                                onClick={() => handleViewDispute(entry._id)}
                              >
                                View Thread
                              </button>
                            </div>
                          ) : entry.status === 'acknowledged' ? (
                            <span className="badge bg-success bg-opacity-10 text-success border border-success px-2 py-1">
                              <i className="bi bi-check-circle me-1"></i> Acknowledged
                            </span>
                          ) : entry.status === 'resolved' ? (
                            <div className="d-inline-flex align-items-center gap-1">
                              <span className="badge bg-info bg-opacity-25 text-dark border border-info px-2 py-1">
                                <i className="bi bi-shield-check me-1"></i> Resolved
                              </span>
                              <button
                                className="btn btn-link btn-sm text-decoration-none p-0 ms-1 text-muted small"
                                onClick={() => handleViewDispute(entry._id)}
                              >
                                Details
                              </button>
                            </div>
                          ) : (
                            <span className="badge bg-secondary text-uppercase">{entry.status}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination controls */}
        {pagination?.totalPages > 1 && (
          <div className="card-footer bg-white border-0 py-3 px-4 d-flex justify-content-between align-items-center">
            <span className="small text-muted">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} entries)
            </span>
            <div className="btn-group btn-group-sm">
              <button
                className="btn btn-outline-secondary"
                disabled={pagination.page <= 1}
                onClick={() => fetchLedger(pagination.page - 1)}
              >
                Previous
              </button>
              <button
                className="btn btn-outline-secondary"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchLedger(pagination.page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dispute Modal */}
      <DisputeModal
        show={Boolean(selectedEntryForDispute)}
        onHide={() => setSelectedEntryForDispute(null)}
        entry={selectedEntryForDispute}
        onDisputeCreated={handleDisputeCreated}
      />

      <StatementDownloadModal
        show={showStatementModal}
        onHide={() => setShowStatementModal(false)}
        accountId={account?._id}
        customerName={account?.shop?.name}
      />
    </div>
  );
};

export default CustomerLedger;
