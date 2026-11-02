import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { getMyShop } from '../api/shopApi';
import { getShopCustomers, formatCurrency } from '../api/accountApi';
import { getShopkeeperDashboardData } from '../api/dashboardApi';
import ShopModal from '../components/ShopModal';
import AddCustomerModal from '../components/AddCustomerModal';
import EditCreditLimitModal from '../components/EditCreditLimitModal';
import FilterBar from '../components/FilterBar';
import AgeingChips from '../components/AgeingChips';
import ReminderSettingsModal from '../components/ReminderSettingsModal';
import SendReminderModal from '../components/SendReminderModal';
import StatementDownloadModal from '../components/StatementDownloadModal';

const ShopkeeperDashboard = () => {
  const { user } = useAuth();

  // Dashboard analytics state
  const [dashboardData, setDashboardData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  // Shop & Customers state
  const [shop, setShop] = useState(null);
  const [loadingShop, setLoadingShop] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [customerFilters, setCustomerFilters] = useState({
    search: '',
    minBalance: '',
    minBalanceRupees: '',
    sortBy: 'balance_desc'
  });
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [error, setError] = useState('');

  // Modals state
  const [showShopModal, setShowShopModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [selectedAccountForEdit, setSelectedAccountForEdit] = useState(null);
  const [showReminderSettingsModal, setShowReminderSettingsModal] = useState(false);
  const [selectedAccountForReminder, setSelectedAccountForReminder] = useState(null);
  const [selectedAccountForStatement, setSelectedAccountForStatement] = useState(null);

  // Fetch dashboard analytics
  const fetchDashboard = async () => {
    try {
      setLoadingDashboard(true);
      const data = await getShopkeeperDashboardData();
      setDashboardData(data);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoadingDashboard(false);
    }
  };

  // Fetch shop profile
  const fetchShop = async () => {
    try {
      setLoadingShop(true);
      const data = await getMyShop();
      setShop(data.shop);
    } catch (err) {
      setError('Could not load shop details');
    } finally {
      setLoadingShop(false);
    }
  };

  // Fetch customers with filters
  const fetchCustomers = useCallback(async (pageToLoad = 1, currentFilters = customerFilters) => {
    try {
      setLoadingAccounts(true);
      const params = {
        page: pageToLoad,
        limit: 10,
        search: currentFilters.search,
        minBalance: currentFilters.minBalance,
        sortBy: currentFilters.sortBy
      };
      const data = await getShopCustomers(params);
      setAccounts(data.accounts || []);
      setPagination(data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      setError('Could not load customer accounts');
    } finally {
      setLoadingAccounts(false);
    }
  }, [customerFilters]);

  useEffect(() => {
    fetchShop();
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (shop) {
      fetchCustomers(1, customerFilters);
    }
  }, [shop, fetchCustomers, customerFilters]);

  const handleFilterChange = (newFilters) => {
    setCustomerFilters(newFilters);
    fetchCustomers(1, newFilters);
  };

  const handleShopSaved = (updatedShop) => {
    setShop(updatedShop);
    fetchDashboard();
    fetchCustomers(1, customerFilters);
  };

  const handleCustomerAdded = () => {
    fetchDashboard();
    fetchCustomers(1, customerFilters);
  };

  const handleCreditLimitUpdated = (updatedAccount) => {
    setAccounts((prev) =>
      prev.map((acc) => (acc._id === updatedAccount._id ? updatedAccount : acc))
    );
    fetchDashboard();
  };

  // Chart data formatting
  const ageingTotals = dashboardData?.ageingTotals || { days0_7Paise: 0, days8_30Paise: 0, days30PlusPaise: 0 };
  const ageingChartData = [
    { name: '0–7 Days', amount: Number(((ageingTotals.days0_7Paise || 0) / 100).toFixed(2)), color: '#198754' },
    { name: '8–30 Days', amount: Number(((ageingTotals.days8_30Paise || 0) / 100).toFixed(2)), color: '#ffc107' },
    { name: '30+ Days', amount: Number(((ageingTotals.days30PlusPaise || 0) / 100).toFixed(2)), color: '#dc3545' }
  ];

  const trend6Months = dashboardData?.trend6Months || [];

  return (
    <div className="container py-4 flex-grow-1">
      {/* Top Banner */}
      <div className="p-4 mb-4 bg-white rounded-3 shadow-sm border-start border-4 border-success">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-success role-badge">Shopkeeper Workspace</span>
              <span className="text-muted small">UdhaarBook Analytics</span>
            </div>
            <h2 className="fw-bold text-dark mb-1">
              {shop ? shop.name : `Welcome, ${user?.name}!`}
            </h2>
            <p className="text-secondary mb-0 small">
              {shop
                ? `${shop.address || 'Local Market'} · Phone: ${shop.phone}`
                : 'Set up your shop profile to start onboarding customers and maintaining credit balances.'}
            </p>
          </div>

          <div className="d-flex gap-2">
            {shop ? (
              <>
                <button
                  className="btn btn-primary btn-sm d-flex align-items-center gap-2 fw-semibold"
                  onClick={() => setShowAddCustomerModal(true)}
                >
                  <i className="bi bi-person-plus"></i>
                  <span>Add Customer</span>
                </button>
                <button
                  className="btn btn-outline-warning text-dark btn-sm d-flex align-items-center gap-2 fw-semibold"
                  onClick={() => setShowReminderSettingsModal(true)}
                >
                  <i className="bi bi-bell-fill text-warning"></i>
                  <span>Reminder Settings</span>
                </button>
                <button
                  className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2"
                  onClick={() => setShowShopModal(true)}
                >
                  <i className="bi bi-gear"></i>
                  <span>Edit Shop</span>
                </button>
              </>
            ) : (
              <button
                className="btn btn-success fw-semibold d-flex align-items-center gap-2"
                onClick={() => setShowShopModal(true)}
              >
                <i className="bi bi-shop"></i>
                <span>Create Shop Profile</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger py-2 small mb-4">
          <i className="bi bi-exclamation-triangle-fill me-1"></i> {error}
        </div>
      )}

      {/* No shop alert */}
      {!loadingShop && !shop && (
        <div className="card border-0 shadow-sm text-center p-5 mb-4 bg-white">
          <div className="mb-3 text-warning">
            <i className="bi bi-shop fs-1"></i>
          </div>
          <h4 className="fw-bold text-dark">Shop Profile Required</h4>
          <p className="text-muted small mb-4" style={{ maxWidth: '450px', margin: '0 auto' }}>
            Before accessing credit metrics and charts, please register your store details.
          </p>
          <div>
            <button className="btn btn-success px-4 fw-semibold" onClick={() => setShowShopModal(true)}>
              Register Store Profile
            </button>
          </div>
        </div>
      )}

      {/* KPI Metric Cards */}
      {shop && (
        <>
          <div className="row g-3 mb-4">
            {/* Total Outstanding */}
            <div className="col-12 col-sm-6 col-md-3">
              <div className="card dashboard-card border-0 shadow-sm p-3 bg-white h-100">
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <span className="text-muted small text-uppercase fw-semibold">Total Outstanding</span>
                  <i className="bi bi-wallet2 text-danger fs-5"></i>
                </div>
                <div className="fs-3 fw-bold text-danger mt-1">
                  {formatCurrency(dashboardData?.totalOutstandingPaise || 0)}
                </div>
                <div className="small text-muted mt-auto pt-1">
                  Across {dashboardData?.totalCustomers || 0} customer khatas
                </div>
              </div>
            </div>

            {/* Collection Rate */}
            <div className="col-12 col-sm-6 col-md-3">
              <div className="card dashboard-card border-0 shadow-sm p-3 bg-white h-100">
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <span className="text-muted small text-uppercase fw-semibold">Collection Rate</span>
                  <i className="bi bi-percent text-success fs-5"></i>
                </div>
                <div className="fs-3 fw-bold text-success mt-1">
                  {dashboardData?.collectionRate || 0}%
                </div>
                <div className="progress mt-2" style={{ height: '6px' }}>
                  <div
                    className="progress-bar bg-success"
                    role="progressbar"
                    style={{ width: `${Math.min(100, dashboardData?.collectionRate || 0)}%` }}
                  ></div>
                </div>
                <div className="small text-muted mt-1">Total recoveries ÷ credit</div>
              </div>
            </div>

            {/* 30+ Days Overdue (High Risk) */}
            <div className="col-12 col-sm-6 col-md-3">
              <div className="card dashboard-card border-0 shadow-sm p-3 bg-white h-100">
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <span className="text-muted small text-uppercase fw-semibold">30+ Days Overdue</span>
                  <i className="bi bi-exclamation-triangle-fill text-danger fs-5"></i>
                </div>
                <div className="fs-3 fw-bold text-danger mt-1">
                  {formatCurrency(ageingTotals.days30PlusPaise || 0)}
                </div>
                <div className="small text-muted mt-auto pt-1">
                  High-risk ageing dues (FIFO)
                </div>
              </div>
            </div>

            {/* Quick Disputes & Audits */}
            <div className="col-12 col-sm-6 col-md-3">
              <div className="card dashboard-card border-0 shadow-sm p-3 bg-white h-100">
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <span className="text-muted small text-uppercase fw-semibold">Disputes Hub</span>
                  <i className="bi bi-shield-exclamation text-primary fs-5"></i>
                </div>
                <div className="fs-3 fw-bold text-dark mt-1">
                  <Link to="/disputes" className="text-decoration-none text-dark">
                    Review <i className="bi bi-arrow-right fs-5"></i>
                  </Link>
                </div>
                <div className="small text-muted mt-auto pt-1">
                  Two-party contested records
                </div>
              </div>
            </div>
          </div>

          {/* Recharts Visualizations */}
          <div className="row g-4 mb-4">
            {/* Ageing Bar Chart */}
            <div className="col-12 col-lg-5">
              <div className="card dashboard-card border-0 shadow-sm p-3 bg-white h-100">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h6 className="fw-bold text-dark mb-0">Due Ageing Breakdown</h6>
                    <span className="text-muted small">FIFO payment allocation in ₹</span>
                  </div>
                  <span className="badge bg-light text-secondary border">Real-time</span>
                </div>

                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer>
                    <BarChart data={ageingChartData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(val) => [`₹ ${Number(val).toLocaleString('en-IN')}`, 'Due Amount']} />
                      <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                        {ageingChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="pt-2 border-top mt-2">
                  <AgeingChips ageing={ageingTotals} />
                </div>
              </div>
            </div>

            {/* 6-Month Trend Chart */}
            <div className="col-12 col-lg-7">
              <div className="card dashboard-card border-0 shadow-sm p-3 bg-white h-100">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h6 className="fw-bold text-dark mb-0">6-Month Trend (Credit vs. Recovery)</h6>
                    <span className="text-muted small">Monthly sales given on credit vs cash collected</span>
                  </div>
                  <span className="badge bg-light text-secondary border">6 Months</span>
                </div>

                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <LineChart data={trend6Months} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(val) => [`₹ ${Number(val).toLocaleString('en-IN')}`]} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Line type="monotone" dataKey="creditRupees" name="Credit Given (₹)" stroke="#dc3545" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="paymentRupees" name="Payment Collected (₹)" stroke="#198754" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Top 5 Debtors Table */}
          <div className="card border-0 shadow-sm bg-white mb-4">
            <div className="card-header bg-white border-0 pt-4 px-4 pb-2">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="fw-bold text-dark mb-1">
                    <i className="bi bi-trophy me-2 text-warning"></i>Top 5 Debtors
                  </h5>
                  <p className="text-muted small mb-0">Customers with the highest outstanding dues requiring recovery</p>
                </div>
                <span className="badge bg-danger bg-opacity-10 text-danger border border-danger">
                  Priority Focus
                </span>
              </div>
            </div>

            <div className="card-body p-0">
              {dashboardData?.topDebtors?.length === 0 ? (
                <div className="text-center py-4 text-muted small">No outstanding debtor balances recorded.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light small text-muted text-uppercase">
                      <tr>
                        <th className="ps-4">Rank & Customer</th>
                        <th>Phone</th>
                        <th>Outstanding Balance</th>
                        <th>Ageing Breakdown (FIFO)</th>
                        <th>Credit Limit</th>
                        <th className="text-end pe-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData?.topDebtors?.map((deb, idx) => (
                        <tr key={deb.accountId}>
                          <td className="ps-4">
                            <div className="d-flex align-items-center gap-2">
                              <span className="badge bg-dark rounded-circle p-2" style={{ width: '24px', height: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                {idx + 1}
                              </span>
                              <div className="fw-bold text-dark">{deb.customer?.name}</div>
                            </div>
                          </td>
                          <td>
                            <span className="badge bg-light text-dark border font-monospace">
                              {deb.customer?.phone}
                            </span>
                          </td>
                          <td>
                            <span className="fw-bold text-danger fs-6">
                              {formatCurrency(deb.balancePaise)}
                            </span>
                          </td>
                          <td>
                            <AgeingChips ageing={deb.ageing} compact={true} />
                          </td>
                          <td>
                            <span className="text-muted small">
                              {formatCurrency(deb.creditLimitPaise)}
                            </span>
                          </td>
                          <td className="text-end pe-4">
                            <Link
                              to={`/shopkeeper/accounts/${deb.accountId}/ledger`}
                              className="btn btn-outline-primary btn-sm fw-semibold"
                            >
                              Ledger &rarr;
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

          {/* Customer Accounts Section with FilterBar */}
          <div className="card border-0 shadow-sm bg-white" id="customers">
            <div className="card-header bg-white border-0 pt-4 px-4 pb-2">
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                <div>
                  <h5 className="fw-bold text-dark mb-1">
                    <i className="bi bi-people me-2 text-success"></i>All Customer Accounts
                  </h5>
                  <p className="text-muted small mb-0">Filter by minimum balance, search by name or contact number</p>
                </div>
                <button
                  className="btn btn-primary btn-sm fw-semibold"
                  onClick={() => setShowAddCustomerModal(true)}
                >
                  <i className="bi bi-person-plus me-1"></i> Add Customer
                </button>
              </div>
            </div>

            <div className="card-body px-4 pt-2 pb-0">
              {/* Reusable FilterBar */}
              <FilterBar
                filters={customerFilters}
                onChange={handleFilterChange}
                searchPlaceholder="Search customer name or phone..."
                showMinBalance={true}
                showSort={true}
                sortOptions={[
                  { label: 'Highest Due First', value: 'balance_desc' },
                  { label: 'Lowest Due First', value: 'balance_asc' },
                  { label: 'Name (A-Z)', value: 'name_asc' },
                  { label: 'Recently Added', value: 'createdAt_desc' }
                ]}
              />
            </div>

            <div className="card-body p-0">
              {loadingAccounts ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-success" role="status">
                    <span className="visually-hidden">Loading customers...</span>
                  </div>
                </div>
              ) : accounts.length === 0 ? (
                <div className="text-center py-5 px-3">
                  <i className="bi bi-person-slash fs-1 text-muted mb-2 d-block"></i>
                  <h6 className="fw-semibold text-secondary">No customer accounts matched your criteria</h6>
                  <p className="text-muted small mb-0">Try clearing your filters or adding a new customer.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light text-uppercase small text-muted">
                      <tr>
                        <th className="ps-4">Customer</th>
                        <th>Phone</th>
                        <th>Net Balance Due</th>
                        <th>FIFO Ageing</th>
                        <th>Credit Limit</th>
                        <th>Status</th>
                        <th className="text-end pe-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((acc) => (
                        <tr key={acc._id}>
                          <td className="ps-4">
                            <div className="fw-semibold text-dark">{acc.customer?.name}</div>
                            <div className="text-muted small">{acc.customer?.email}</div>
                          </td>
                          <td>
                            <span className="badge bg-light text-dark border font-monospace">
                              <i className="bi bi-telephone me-1 text-muted"></i>
                              {acc.customer?.phone}
                            </span>
                          </td>
                          <td>
                            <span className={`fw-bold ${acc.balancePaise > 0 ? 'text-danger' : acc.balancePaise < 0 ? 'text-success' : 'text-dark'}`}>
                              {formatCurrency(acc.balancePaise || 0)}
                            </span>
                          </td>
                          <td>
                            <AgeingChips ageing={acc.ageing} compact={true} />
                          </td>
                          <td>
                            <span className="text-muted small">
                              {formatCurrency(acc.creditLimit)}
                            </span>
                          </td>
                          <td>
                            {acc.active !== false ? (
                              <span className="badge bg-success bg-opacity-10 text-success border border-success">
                                Active
                              </span>
                            ) : (
                              <span className="badge bg-danger bg-opacity-10 text-danger border border-danger">
                                Suspended
                              </span>
                            )}
                          </td>
                          <td className="text-end pe-4 text-nowrap">
                            <Link
                              to={`/shopkeeper/accounts/${acc._id}/ledger`}
                              className="btn btn-success btn-sm d-inline-flex align-items-center gap-1 me-1"
                            >
                              <i className="bi bi-journal-text"></i>
                              <span>Ledger</span>
                            </Link>
                            <button
                              className="btn btn-outline-warning text-dark btn-sm d-inline-flex align-items-center gap-1 me-1"
                              onClick={() => setSelectedAccountForReminder(acc)}
                              disabled={(acc.balancePaise || 0) <= 0}
                              title={(acc.balancePaise || 0) <= 0 ? 'No outstanding dues to remind' : 'Send Reminder'}
                            >
                              <i className="bi bi-send-fill text-warning"></i>
                              <span>Remind</span>
                            </button>
                            <button
                              className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1 me-1"
                              onClick={() => setSelectedAccountForStatement(acc)}
                              title="Download Statement PDF"
                            >
                              <i className="bi bi-file-earmark-pdf"></i>
                            </button>
                            <button
                              className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
                              onClick={() => setSelectedAccountForEdit(acc)}
                              title="Edit Credit Limit"
                            >
                              <i className="bi bi-pencil-square"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="card-footer bg-white border-0 py-3 px-4 d-flex justify-content-between align-items-center">
                <span className="small text-muted">
                  Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </span>
                <div className="btn-group btn-group-sm">
                  <button
                    className="btn btn-outline-secondary"
                    disabled={pagination.page <= 1}
                    onClick={() => fetchCustomers(pagination.page - 1)}
                  >
                    Previous
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchCustomers(pagination.page + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      <ShopModal
        show={showShopModal}
        onHide={() => setShowShopModal(false)}
        existingShop={shop}
        onShopSaved={handleShopSaved}
      />

      <AddCustomerModal
        show={showAddCustomerModal}
        onHide={() => setShowAddCustomerModal(false)}
        onCustomerAdded={handleCustomerAdded}
      />

      <EditCreditLimitModal
        show={Boolean(selectedAccountForEdit)}
        onHide={() => setSelectedAccountForEdit(null)}
        account={selectedAccountForEdit}
        onUpdated={handleCreditLimitUpdated}
      />

      <ReminderSettingsModal
        show={showReminderSettingsModal}
        onHide={() => setShowReminderSettingsModal(false)}
        onSettingsSaved={() => fetchDashboard()}
      />

      <SendReminderModal
        show={Boolean(selectedAccountForReminder)}
        onHide={() => setSelectedAccountForReminder(null)}
        account={selectedAccountForReminder}
        balancePaise={selectedAccountForReminder?.balancePaise || 0}
        onSuccess={() => {
          fetchDashboard();
          fetchCustomers(pagination.page, customerFilters);
        }}
      />

      <StatementDownloadModal
        show={Boolean(selectedAccountForStatement)}
        onHide={() => setSelectedAccountForStatement(null)}
        accountId={selectedAccountForStatement?._id}
        customerName={selectedAccountForStatement?.customer?.name}
      />
    </div>
  );
};

export default ShopkeeperDashboard;
