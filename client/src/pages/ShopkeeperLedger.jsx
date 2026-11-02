import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAccountLedger } from '../api/ledgerApi';
import { formatCurrency } from '../api/accountApi';
import AddEntryModal from '../components/AddEntryModal';
import ReverseConfirmModal from '../components/ReverseConfirmModal';
import FilterBar from '../components/FilterBar';
import AgeingChips from '../components/AgeingChips';
import SendReminderModal from '../components/SendReminderModal';
import ReminderHistoryModal from '../components/ReminderHistoryModal';
import StatementDownloadModal from '../components/StatementDownloadModal';

const ShopkeeperLedger = () => {
  const { accountId } = useParams();

  const [ledgerData, setLedgerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: '',
    type: 'all',
    status: 'all',
    startDate: '',
    endDate: '',
    sortBy: 'latest'
  });

  // Modals state
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [addEntryDefaultType, setAddEntryDefaultType] = useState('credit');
  const [entryToReverse, setEntryToReverse] = useState(null);
  const [showSendReminderModal, setShowSendReminderModal] = useState(false);
  const [showReminderHistoryModal, setShowReminderHistoryModal] = useState(false);
  const [showStatementModal, setShowStatementModal] = useState(false);

  // Limit warning toast / banner state
  const [limitWarningBanner, setLimitWarningBanner] = useState(null);

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

  const handleOpenAddModal = (type) => {
    setAddEntryDefaultType(type);
    setShowAddEntryModal(true);
  };

  const handleEntryAdded = (result) => {
    if (result.limitWarning) {
      setLimitWarningBanner(result.limitMessage);
    } else {
      setLimitWarningBanner(null);
    }
    fetchLedger(1);
  };

  const handleEntryReversed = () => {
    setLimitWarningBanner(null);
    fetchLedger(1);
  };

  if (loading && !ledgerData) {
    return (
      <div className="container py-5 text-center flex-grow-1">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Loading customer ledger...</span>
        </div>
        <div className="text-muted small mt-2">Loading customer ledger...</div>
      </div>
    );
  }

  if (error && !ledgerData) {
    return (
      <div className="container py-5 flex-grow-1">
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle-fill me-2"></i> {error}
        </div>
        <Link to="/shopkeeper/dashboard" className="btn btn-outline-secondary">
          &larr; Return to Dashboard
        </Link>
      </div>
    );
  }

  const { account, balance, entries, pagination } = ledgerData || {};
  const netDue = balance?.netBalancePaise || 0;

  return (
    <div className="container py-4 flex-grow-1">
      {/* Navigation header */}
      <div className="mb-3">
        <Link to="/shopkeeper/dashboard" className="text-decoration-none text-secondary small d-inline-flex align-items-center gap-1">
          <i className="bi bi-arrow-left"></i> Back to Customer List
        </Link>
      </div>

      {/* Account Info Banner */}
      <div className="p-4 mb-4 bg-white rounded-3 shadow-sm border-start border-4 border-success">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-success role-badge">Customer Ledger</span>
              <span className="text-muted small">Account ID: {account?._id}</span>
            </div>
            <h2 className="fw-bold text-dark mb-1">{account?.customer?.name}</h2>
            <p className="text-secondary mb-0 small">
              <i className="bi bi-telephone me-1"></i> {account?.customer?.phone}
              {account?.customer?.email && (
                <> &middot; <i className="bi bi-envelope me-1"></i> {account?.customer?.email}</>
              )}
            </p>
          </div>

          <div className="d-flex flex-column align-items-md-end gap-2">
            <div className="d-flex flex-wrap gap-2">
              <button
                className="btn btn-danger fw-semibold d-flex align-items-center gap-2"
                onClick={() => handleOpenAddModal('credit')}
              >
                <i className="bi bi-dash-circle"></i>
                <span>Give Credit (सामान दिया)</span>
              </button>
              <button
                className="btn btn-success fw-semibold d-flex align-items-center gap-2"
                onClick={() => handleOpenAddModal('payment')}
              >
                <i className="bi bi-plus-circle"></i>
                <span>Got Payment (पैसा मिला)</span>
              </button>
            </div>
            <div className="d-flex flex-wrap gap-2 mt-1">
              <button
                className="btn btn-outline-warning text-dark btn-sm d-flex align-items-center gap-1"
                onClick={() => setShowSendReminderModal(true)}
                disabled={netDue <= 0}
                title={netDue <= 0 ? 'Customer has no outstanding dues to remind' : 'Send Payment Reminder'}
              >
                <i className="bi bi-send-fill text-warning"></i>
                <span>Send Reminder</span>
              </button>
              <button
                className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                onClick={() => setShowReminderHistoryModal(true)}
              >
                <i className="bi bi-clock-history"></i>
                <span>Reminder History</span>
              </button>
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
      </div>

      {/* Limit Warning Alert */}
      {limitWarningBanner && (
        <div className="alert alert-warning alert-dismissible fade show d-flex align-items-center gap-2 shadow-sm mb-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill fs-4 text-warning flex-shrink-0"></i>
          <div>
            <strong>Credit Limit Warning Flag:</strong> {limitWarningBanner}
          </div>
          <button type="button" className="btn-close" onClick={() => setLimitWarningBanner(null)}></button>
        </div>
      )}

      {/* Balance Summary Cards */}
      <div className="row g-3 mb-4">
        {/* Net Outstanding Balance */}
        <div className="col-12 col-md-3">
          <div className="card dashboard-card border-0 shadow-sm p-3 bg-white h-100">
            <div className="text-muted small text-uppercase fw-semibold">Net Balance Due</div>
            <div className={`fs-3 fw-bold mt-1 ${netDue > 0 ? 'text-danger' : netDue < 0 ? 'text-success' : 'text-dark'}`}>
              {formatCurrency(Math.abs(netDue))}
            </div>
            <div className="mb-2">
              <AgeingChips ageing={balance?.ageing} compact={true} />
            </div>
            <span className="small text-muted">
              {netDue > 0 ? 'Customer owes you' : netDue < 0 ? 'Advance from customer' : 'All dues settled'}
            </span>
          </div>
        </div>

        {/* Total Credit */}
        <div className="col-12 col-md-3">
          <div className="card dashboard-card border-0 shadow-sm p-3 bg-white h-100">
            <div className="text-muted small text-uppercase fw-semibold">Total Credit Given</div>
            <div className="fs-3 fw-bold text-dark mt-1">
              {formatCurrency(balance?.totalCreditPaise || 0)}
            </div>
            <span className="small text-muted">Active purchases</span>
          </div>
        </div>

        {/* Total Payments */}
        <div className="col-12 col-md-3">
          <div className="card dashboard-card border-0 shadow-sm p-3 bg-white h-100">
            <div className="text-muted small text-uppercase fw-semibold">Total Payments Received</div>
            <div className="fs-3 fw-bold text-success mt-1">
              {formatCurrency(balance?.totalPaymentPaise || 0)}
            </div>
            <span className="small text-muted">Settled amounts</span>
          </div>
        </div>

        {/* Credit Limit */}
        <div className="col-12 col-md-3">
          <div className="card dashboard-card border-0 shadow-sm p-3 bg-white h-100">
            <div className="text-muted small text-uppercase fw-semibold">Credit Limit</div>
            <div className="fs-3 fw-bold text-primary mt-1">
              {formatCurrency(account?.creditLimit || 0)}
            </div>
            <span className={`small fw-semibold ${balance?.limitExceeded ? 'text-danger' : 'text-success'}`}>
              {balance?.limitExceeded ? 'Limit Exceeded!' : 'Within safe credit limit'}
            </span>
          </div>
        </div>
      </div>

      {/* Running Balance Ledger Table */}
      <div className="card border-0 shadow-sm bg-white">
        <div className="card-header bg-white border-0 pt-4 px-4 pb-2">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h5 className="fw-bold text-dark mb-1">
                <i className="bi bi-journal-text me-2 text-success"></i>Ledger Statement & Audit Log
              </h5>
              <p className="text-muted small mb-0">Append-only chronological record with live running balances</p>
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
            showSort={true}
            sortOptions={[
              { label: 'Latest First', value: 'latest' },
              { label: 'Oldest First', value: 'oldest' },
              { label: 'Highest Amount', value: 'amount_high' },
              { label: 'Lowest Amount', value: 'amount_low' }
            ]}
            searchPlaceholder="Search notes or transaction ID..."
          />
        </div>

        <div className="card-body p-0">
          {entries?.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-journal-x fs-1 text-muted mb-2 d-block"></i>
              <h6 className="fw-semibold text-secondary">No ledger entries recorded yet</h6>
              <p className="text-muted small mb-3">Record credit or cash payment to start this account ledger.</p>
              <div className="d-flex justify-content-center gap-2">
                <button className="btn btn-danger btn-sm fw-semibold" onClick={() => handleOpenAddModal('credit')}>
                  Give Credit
                </button>
                <button className="btn btn-success btn-sm fw-semibold" onClick={() => handleOpenAddModal('payment')}>
                  Receive Payment
                </button>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light text-uppercase small text-muted">
                  <tr>
                    <th className="ps-4">Date</th>
                    <th>Description / Note</th>
                    <th>Credit (+)</th>
                    <th>Payment (-)</th>
                    <th>Running Balance</th>
                    <th>Status</th>
                    <th className="text-end pe-4">Action</th>
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

                        <td>
                          <span className={`badge ${
                            entry.status === 'acknowledged'
                              ? 'bg-success'
                              : entry.status === 'disputed'
                              ? 'bg-danger'
                              : entry.status === 'resolved'
                              ? 'bg-info text-dark'
                              : 'bg-warning text-dark'
                          } text-uppercase`}>
                            {entry.status}
                          </span>
                        </td>

                        <td className="text-end pe-4">
                          {entry.status === 'disputed' && (
                            <Link
                              to="/disputes"
                              className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1 me-2"
                              title="Resolve this contested transaction"
                            >
                              <i className="bi bi-shield-exclamation"></i>
                              <span>Resolve Dispute</span>
                            </Link>
                          )}
                          {!isReversed && !isReversal ? (
                            <button
                              className="btn btn-outline-warning btn-sm d-inline-flex align-items-center gap-1"
                              title="Reverse entry with opposite compensating entry"
                              onClick={() => setEntryToReverse(entry)}
                            >
                              <i className="bi bi-arrow-counterclockwise"></i>
                              <span>Reverse</span>
                            </button>
                          ) : (
                            <span className="badge bg-light text-muted border">
                              {isReversed ? 'Reversed' : 'Reversal Entry'}
                            </span>
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

      {/* Modals */}
      <AddEntryModal
        show={showAddEntryModal}
        onHide={() => setShowAddEntryModal(false)}
        account={account}
        currentBalancePaise={netDue}
        onEntryAdded={handleEntryAdded}
      />

      <ReverseConfirmModal
        show={Boolean(entryToReverse)}
        onHide={() => setEntryToReverse(null)}
        entry={entryToReverse}
        onEntryReversed={handleEntryReversed}
      />

      <SendReminderModal
        show={showSendReminderModal}
        onHide={() => setShowSendReminderModal(false)}
        account={account}
        balancePaise={netDue}
        onSuccess={() => fetchLedger(1)}
      />

      <ReminderHistoryModal
        show={showReminderHistoryModal}
        onHide={() => setShowReminderHistoryModal(false)}
        account={account}
      />

      <StatementDownloadModal
        show={showStatementModal}
        onHide={() => setShowStatementModal(false)}
        accountId={account?._id}
        customerName={account?.customer?.name}
      />
    </div>
  );
};

export default ShopkeeperLedger;

