import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getPlatformStats,
  getAdminUsers,
  toggleUserStatus,
  getAdminShops,
  toggleShopStatus,
  getAdminDisputes,
  resolveAdminDispute
} from '../api/adminApi';
import { formatCurrency } from '../api/accountApi';

const AdminDashboard = () => {
  const { user } = useAuth();

  // Active Tab: 'disputes' | 'shops' | 'users'
  const [activeTab, setActiveTab] = useState('disputes');

  // Platform stats state
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Disputes state
  const [disputes, setDisputes] = useState([]);
  const [loadingDisputes, setLoadingDisputes] = useState(false);
  const [disputeFilter, setDisputeFilter] = useState('escalated'); // 'escalated' | 'open' | 'resolved' | 'all'

  // Shops state
  const [shops, setShops] = useState([]);
  const [loadingShops, setLoadingShops] = useState(false);
  const [shopSearch, setShopSearch] = useState('');
  const [shopActiveFilter, setShopActiveFilter] = useState('');

  // Users state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userActiveFilter, setUserActiveFilter] = useState('');

  // Resolution modal state
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [resolveAction, setResolveAction] = useState('accept');
  const [resolveNote, setResolveNote] = useState('');
  const [resolving, setResolving] = useState(false);

  // Alerts
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'disputes') fetchDisputes();
    if (activeTab === 'shops') fetchShops();
    if (activeTab === 'users') fetchUsers();
  }, [activeTab, disputeFilter, shopActiveFilter, userRoleFilter, userActiveFilter]);

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback({ type: '', message: '' }), 4500);
  };

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await getPlatformStats();
      setStats(res.stats);
    } catch (err) {
      console.error('Failed to load platform stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchDisputes = async () => {
    try {
      setLoadingDisputes(true);
      const params = {};
      if (disputeFilter !== 'all') params.status = disputeFilter;
      const res = await getAdminDisputes(params);
      setDisputes(res.disputes || []);
    } catch (err) {
      showFeedback('danger', err.response?.data?.message || 'Failed to load disputes');
    } finally {
      setLoadingDisputes(false);
    }
  };

  const fetchShops = async () => {
    try {
      setLoadingShops(true);
      const params = { search: shopSearch };
      if (shopActiveFilter !== '') params.active = shopActiveFilter;
      const res = await getAdminShops(params);
      setShops(res.shops || []);
    } catch (err) {
      showFeedback('danger', err.response?.data?.message || 'Failed to load shops');
    } finally {
      setLoadingShops(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const params = { search: userSearch };
      if (userRoleFilter !== '') params.role = userRoleFilter;
      if (userActiveFilter !== '') params.isActive = userActiveFilter;
      const res = await getAdminUsers(params);
      setUsers(res.users || []);
    } catch (err) {
      showFeedback('danger', err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleToggleShop = async (shop) => {
    const nextStatus = !shop.active;
    if (
      !window.confirm(
        `Are you sure you want to ${nextStatus ? 'activate' : 'deactivate'} store "${shop.name}"?`
      )
    ) {
      return;
    }
    try {
      await toggleShopStatus(shop._id, nextStatus);
      showFeedback('success', `Shop "${shop.name}" has been ${nextStatus ? 'activated' : 'deactivated'}.`);
      fetchShops();
      fetchStats();
    } catch (err) {
      showFeedback('danger', err.response?.data?.message || 'Failed to update shop status');
    }
  };

  const handleToggleUser = async (targetUser) => {
    const nextStatus = !targetUser.isActive;
    if (
      !window.confirm(
        `Are you sure you want to ${nextStatus ? 'activate' : 'deactivate'} user ${targetUser.name}?`
      )
    ) {
      return;
    }
    try {
      await toggleUserStatus(targetUser._id, nextStatus);
      showFeedback('success', `User ${targetUser.name} has been ${nextStatus ? 'activated' : 'deactivated'}.`);
      fetchUsers();
      fetchStats();
    } catch (err) {
      showFeedback('danger', err.response?.data?.message || 'Failed to update user status');
    }
  };

  const handleOpenResolveModal = (dispute, action) => {
    setSelectedDispute(dispute);
    setResolveAction(action);
    setResolveNote(
      action === 'accept'
        ? 'Customer evidence verified. Entry reversed on ledger by platform admin.'
        : 'Dispute investigated by admin and rejected after verification with shopkeeper records.'
    );
  };

  const handleSubmitResolution = async (e) => {
    e.preventDefault();
    if (!selectedDispute) return;

    setResolving(true);
    try {
      await resolveAdminDispute(selectedDispute._id, {
        action: resolveAction,
        note: resolveNote
      });
      showFeedback(
        'success',
        `Dispute resolved! Entry was ${resolveAction === 'accept' ? 'automatically reversed' : 'maintained'}.`
      );
      setSelectedDispute(null);
      fetchDisputes();
      fetchStats();
    } catch (err) {
      showFeedback('danger', err.response?.data?.message || 'Failed to resolve dispute');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="container py-4 flex-grow-1">
      {/* Top Banner */}
      <div className="p-4 mb-4 bg-white rounded-3 shadow-sm border-start border-4 border-danger">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-danger role-badge">Platform Administrator</span>
              <span className="text-muted small">UdhaarBook Admin Console</span>
            </div>
            <h2 className="fw-bold text-dark mb-1">Central Admin Dashboard</h2>
            <p className="text-secondary mb-0 small">
              Welcome back, <strong>{user?.name}</strong>. Monitor platform metrics, mediate escalated disputes, and manage registered shops & users.
            </p>
          </div>
          <button
            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
            onClick={() => {
              fetchStats();
              if (activeTab === 'disputes') fetchDisputes();
              if (activeTab === 'shops') fetchShops();
              if (activeTab === 'users') fetchUsers();
            }}
          >
            <i className="bi bi-arrow-clockwise"></i>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show mb-4`} role="alert">
          <i
            className={`bi ${
              feedback.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'
            } me-2`}
          ></i>
          {feedback.message}
          <button
            type="button"
            className="btn-close"
            onClick={() => setFeedback({ type: '', message: '' })}
          ></button>
        </div>
      )}

      {/* Metric Cards Row */}
      <div className="row g-3 mb-4">
        {/* Shops Card */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card border-0 shadow-sm rounded-3 h-100 bg-white">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small fw-semibold text-uppercase">Shops</span>
                <span className="badge bg-primary-subtle text-primary p-2 rounded-circle">
                  <i className="bi bi-shop fs-5"></i>
                </span>
              </div>
              <h3 className="fw-bold text-dark mb-1">{stats?.shops?.total || 0}</h3>
              <span className="small text-success">
                <i className="bi bi-check-circle me-1"></i>
                {stats?.shops?.active || 0} Active Stores
              </span>
            </div>
          </div>
        </div>

        {/* Users Card */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card border-0 shadow-sm rounded-3 h-100 bg-white">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small fw-semibold text-uppercase">Platform Users</span>
                <span className="badge bg-success-subtle text-success p-2 rounded-circle">
                  <i className="bi bi-people-fill fs-5"></i>
                </span>
              </div>
              <h3 className="fw-bold text-dark mb-1">{stats?.users?.total || 0}</h3>
              <span className="small text-muted">
                {stats?.users?.shopkeepers || 0} Shops · {stats?.users?.customers || 0} Customers
              </span>
            </div>
          </div>
        </div>

        {/* Ledger Entries Card */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card border-0 shadow-sm rounded-3 h-100 bg-white">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small fw-semibold text-uppercase">Ledger Entries</span>
                <span className="badge bg-info-subtle text-info p-2 rounded-circle">
                  <i className="bi bi-journal-text fs-5"></i>
                </span>
              </div>
              <h3 className="fw-bold text-dark mb-1">{stats?.entries?.total || 0}</h3>
              <span className="small text-danger fw-semibold">
                {formatCurrency(stats?.entries?.netOutstandingPaise || 0)} Net Active Dues
              </span>
            </div>
          </div>
        </div>

        {/* Escalated Disputes Card */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className={`card border-0 shadow-sm rounded-3 h-100 ${
              (stats?.disputes?.escalated || 0) > 0 ? 'bg-warning-subtle border-warning' : 'bg-white'
            }`}
          >
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small fw-semibold text-uppercase">Disputes</span>
                <span className="badge bg-warning text-dark p-2 rounded-circle">
                  <i className="bi bi-shield-exclamation fs-5"></i>
                </span>
              </div>
              <h3 className="fw-bold text-dark mb-1">
                {stats?.disputes?.escalated || 0} Escalated
              </h3>
              <span className="small text-muted">
                {stats?.disputes?.open || 0} Open · {stats?.disputes?.resolved || 0} Resolved
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabbed Management Panel */}
      <div className="card border-0 shadow-sm rounded-3 overflow-hidden">
        <div className="card-header bg-white p-0 border-bottom">
          <ul className="nav nav-tabs card-header-tabs m-0 border-0">
            <li className="nav-item">
              <button
                className={`nav-link py-3 px-4 fw-semibold border-0 ${
                  activeTab === 'disputes' ? 'active text-danger border-bottom border-danger border-3' : 'text-secondary'
                }`}
                onClick={() => setActiveTab('disputes')}
              >
                <i className="bi bi-shield-exclamation me-2"></i>
                Escalated Disputes
                {(stats?.disputes?.escalated || 0) > 0 && (
                  <span className="badge bg-danger ms-2">{stats.disputes.escalated}</span>
                )}
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link py-3 px-4 fw-semibold border-0 ${
                  activeTab === 'shops' ? 'active text-primary border-bottom border-primary border-3' : 'text-secondary'
                }`}
                onClick={() => setActiveTab('shops')}
              >
                <i className="bi bi-shop me-2"></i>
                Shop Management
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link py-3 px-4 fw-semibold border-0 ${
                  activeTab === 'users' ? 'active text-success border-bottom border-success border-3' : 'text-secondary'
                }`}
                onClick={() => setActiveTab('users')}
              >
                <i className="bi bi-people me-2"></i>
                User Accounts
              </button>
            </li>
          </ul>
        </div>

        <div className="card-body p-4">
          {/* TAB 1: DISPUTES */}
          {activeTab === 'disputes' && (
            <div>
              {/* Filter Row */}
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <div className="btn-group btn-group-sm">
                  <button
                    className={`btn ${
                      disputeFilter === 'escalated' ? 'btn-danger' : 'btn-outline-secondary'
                    }`}
                    onClick={() => setDisputeFilter('escalated')}
                  >
                    Escalated to Admin
                  </button>
                  <button
                    className={`btn ${
                      disputeFilter === 'open' ? 'btn-warning text-dark' : 'btn-outline-secondary'
                    }`}
                    onClick={() => setDisputeFilter('open')}
                  >
                    Open at Shop
                  </button>
                  <button
                    className={`btn ${
                      disputeFilter === 'resolved' ? 'btn-success' : 'btn-outline-secondary'
                    }`}
                    onClick={() => setDisputeFilter('resolved')}
                  >
                    Resolved
                  </button>
                  <button
                    className={`btn ${
                      disputeFilter === 'all' ? 'btn-dark' : 'btn-outline-secondary'
                    }`}
                    onClick={() => setDisputeFilter('all')}
                  >
                    All Disputes
                  </button>
                </div>

                <span className="text-muted small">
                  Showing {disputes.length} dispute record(s)
                </span>
              </div>

              {loadingDisputes ? (
                <div className="text-center py-5 text-muted">
                  <div className="spinner-border text-danger mb-2"></div>
                  <div>Loading disputes...</div>
                </div>
              ) : disputes.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-check2-circle fs-1 text-success d-block mb-2"></i>
                  <h5>No Disputes Found</h5>
                  <p className="small mb-0">
                    No disputes match the current filter selection ({disputeFilter}).
                  </p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Date & ID</th>
                        <th>Store & Customer</th>
                        <th>Transaction Details</th>
                        <th>Dispute Reason</th>
                        <th>Status</th>
                        <th className="text-end pe-3">Admin Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {disputes.map((d) => {
                        const entry = d.entry;
                        const account = entry?.account;
                        const shop = account?.shop;
                        const customer = account?.customer;

                        return (
                          <tr key={d._id}>
                            <td className="small text-nowrap">
                              <div className="fw-semibold">
                                {new Date(d.createdAt).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </div>
                              <span className="text-muted font-monospace" style={{ fontSize: '0.75rem' }}>
                                #{d._id.slice(-6)}
                              </span>
                            </td>

                            <td>
                              <div className="fw-semibold text-dark">{shop?.name || 'Store'}</div>
                              <div className="small text-secondary">
                                Customer: <strong>{customer?.name || d.raisedBy?.name}</strong>
                              </div>
                            </td>

                            <td>
                              <div className="d-flex align-items-center gap-1">
                                <span
                                  className={`badge ${
                                    entry?.type === 'credit' ? 'bg-danger' : 'bg-success'
                                  }`}
                                >
                                  {entry?.type}
                                </span>
                                <span className="fw-bold">
                                  {formatCurrency(entry?.amountPaise || 0)}
                                </span>
                              </div>
                              <div className="text-muted small text-truncate" style={{ maxWidth: '200px' }}>
                                {entry?.note || 'No note'}
                              </div>
                            </td>

                            <td style={{ maxWidth: '240px' }}>
                              <div className="small text-dark fw-medium text-wrap">{d.reason}</div>
                              {d.history && d.history.length > 0 && (
                                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                  Last note: {d.history[d.history.length - 1]?.note}
                                </div>
                              )}
                            </td>

                            <td>
                              <span
                                className={`badge ${
                                  d.status === 'escalated'
                                    ? 'bg-danger'
                                    : d.status === 'open'
                                    ? 'bg-warning text-dark'
                                    : 'bg-success'
                                }`}
                              >
                                {d.status}
                              </span>
                              {d.resolution && (
                                <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                                  {d.resolution.replace(/_/g, ' ')}
                                </div>
                              )}
                            </td>

                            <td className="text-end pe-3 text-nowrap">
                              {d.status === 'resolved' ? (
                                <span className="text-muted small">
                                  <i className="bi bi-check-circle me-1"></i>Resolved
                                </span>
                              ) : (
                                <div className="btn-group btn-group-sm">
                                  <button
                                    className="btn btn-outline-success"
                                    onClick={() => handleOpenResolveModal(d, 'accept')}
                                    title="Accept Dispute: Reverse the disputed entry on ledger"
                                  >
                                    <i className="bi bi-check-lg me-1"></i>
                                    Accept & Reverse
                                  </button>
                                  <button
                                    className="btn btn-outline-danger"
                                    onClick={() => handleOpenResolveModal(d, 'reject')}
                                    title="Reject Dispute: Confirm entry is valid"
                                  >
                                    <i className="bi bi-x-lg me-1"></i>
                                    Reject
                                  </button>
                                </div>
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
          )}

          {/* TAB 2: SHOPS */}
          {activeTab === 'shops' && (
            <div>
              {/* Search & Filter Bar */}
              <div className="row g-2 mb-3">
                <div className="col-md-6">
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0">
                      <i className="bi bi-search text-muted"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control border-start-0"
                      placeholder="Search shops by name, address, phone..."
                      value={shopSearch}
                      onChange={(e) => setShopSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchShops()}
                    />
                    <button className="btn btn-primary btn-sm px-3" onClick={fetchShops}>
                      Search
                    </button>
                  </div>
                </div>

                <div className="col-md-3">
                  <select
                    className="form-select"
                    value={shopActiveFilter}
                    onChange={(e) => setShopActiveFilter(e.target.value)}
                  >
                    <option value="">All Shop Statuses</option>
                    <option value="true">Active Only</option>
                    <option value="false">Deactivated Only</option>
                  </select>
                </div>
              </div>

              {loadingShops ? (
                <div className="text-center py-5 text-muted">
                  <div className="spinner-border text-primary mb-2"></div>
                  <div>Loading shops...</div>
                </div>
              ) : shops.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-shop fs-1 d-block mb-2"></i>
                  <h5>No Shops Found</h5>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Store Details</th>
                        <th>Owner</th>
                        <th>Contact</th>
                        <th>Customers</th>
                        <th>Status</th>
                        <th className="text-end pe-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shops.map((s) => (
                        <tr key={s._id}>
                          <td>
                            <div className="fw-semibold text-dark">{s.name}</div>
                            <div className="text-muted small">{s.address || 'Local Market'}</div>
                          </td>
                          <td>
                            <div className="fw-medium text-dark">{s.owner?.name || 'N/A'}</div>
                            <div className="text-muted small">{s.owner?.email}</div>
                          </td>
                          <td className="font-monospace small">{s.phone}</td>
                          <td>
                            <span className="badge bg-light text-dark border">
                              <i className="bi bi-people me-1 text-primary"></i>
                              {s.customerCount || 0} customers
                            </span>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                s.active !== false
                                  ? 'bg-success bg-opacity-10 text-success border border-success'
                                  : 'bg-danger bg-opacity-10 text-danger border border-danger'
                              }`}
                            >
                              {s.active !== false ? 'Active' : 'Deactivated'}
                            </span>
                          </td>
                          <td className="text-end pe-3">
                            <button
                              className={`btn btn-sm ${
                                s.active !== false ? 'btn-outline-danger' : 'btn-outline-success'
                              }`}
                              onClick={() => handleToggleShop(s)}
                            >
                              {s.active !== false ? (
                                <>
                                  <i className="bi bi-slash-circle me-1"></i>
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <i className="bi bi-check-circle me-1"></i>
                                  Activate
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: USERS */}
          {activeTab === 'users' && (
            <div>
              {/* Search & Filter Bar */}
              <div className="row g-2 mb-3">
                <div className="col-md-5">
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0">
                      <i className="bi bi-search text-muted"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control border-start-0"
                      placeholder="Search users by name, email, phone..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                    />
                    <button className="btn btn-primary btn-sm px-3" onClick={fetchUsers}>
                      Search
                    </button>
                  </div>
                </div>

                <div className="col-md-3">
                  <select
                    className="form-select"
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                  >
                    <option value="">All Roles</option>
                    <option value="shopkeeper">Shopkeeper</option>
                    <option value="customer">Customer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="col-md-3">
                  <select
                    className="form-select"
                    value={userActiveFilter}
                    onChange={(e) => setUserActiveFilter(e.target.value)}
                  >
                    <option value="">All Account Statuses</option>
                    <option value="true">Active Only</option>
                    <option value="false">Deactivated Only</option>
                  </select>
                </div>
              </div>

              {loadingUsers ? (
                <div className="text-center py-5 text-muted">
                  <div className="spinner-border text-success mb-2"></div>
                  <div>Loading platform users...</div>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-people fs-1 d-block mb-2"></i>
                  <h5>No Users Found</h5>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>User Name</th>
                        <th>Email & Phone</th>
                        <th>Role</th>
                        <th>Joined</th>
                        <th>Status</th>
                        <th className="text-end pe-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => {
                        const isSelf = u._id === user?.id;

                        return (
                          <tr key={u._id}>
                            <td>
                              <div className="fw-semibold text-dark">
                                {u.name}
                                {isSelf && (
                                  <span className="badge bg-secondary ms-2" style={{ fontSize: '0.65rem' }}>
                                    You
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="small text-dark">{u.email}</div>
                              <div className="text-muted small font-monospace">{u.phone}</div>
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  u.role === 'admin'
                                    ? 'bg-danger'
                                    : u.role === 'shopkeeper'
                                    ? 'bg-success'
                                    : 'bg-info text-dark'
                                }`}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td className="small text-muted">
                              {new Date(u.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  u.isActive !== false
                                    ? 'bg-success bg-opacity-10 text-success border border-success'
                                    : 'bg-danger bg-opacity-10 text-danger border border-danger'
                                }`}
                              >
                                {u.isActive !== false ? 'Active' : 'Deactivated'}
                              </span>
                            </td>
                            <td className="text-end pe-3">
                              <button
                                className={`btn btn-sm ${
                                  u.isActive !== false ? 'btn-outline-danger' : 'btn-outline-success'
                                }`}
                                onClick={() => handleToggleUser(u)}
                                disabled={isSelf}
                                title={isSelf ? 'Cannot deactivate self' : ''}
                              >
                                {u.isActive !== false ? (
                                  <>
                                    <i className="bi bi-person-x me-1"></i>
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <i className="bi bi-person-check me-1"></i>
                                    Activate
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Admin Dispute Resolution Modal */}
      {selectedDispute && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow border-0">
              <div
                className={`modal-header ${
                  resolveAction === 'accept' ? 'bg-success text-white' : 'bg-danger text-white'
                }`}
              >
                <h5 className="modal-title fw-bold">
                  <i
                    className={`bi ${
                      resolveAction === 'accept' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'
                    } me-2`}
                  ></i>
                  {resolveAction === 'accept' ? 'Accept Dispute & Reverse Entry' : 'Reject Dispute'}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setSelectedDispute(null)}
                  disabled={resolving}
                ></button>
              </div>

              <form onSubmit={handleSubmitResolution}>
                <div className="modal-body p-4">
                  <div className="card mb-3 bg-light border-0">
                    <div className="card-body p-3">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="text-muted small">Store:</span>
                        <strong className="text-dark">
                          {selectedDispute.entry?.account?.shop?.name}
                        </strong>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="text-muted small">Customer:</span>
                        <strong className="text-dark">
                          {selectedDispute.entry?.account?.customer?.name || selectedDispute.raisedBy?.name}
                        </strong>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="text-muted small">Disputed Entry:</span>
                        <span className="fw-bold text-danger">
                          {selectedDispute.entry?.type?.toUpperCase()} of{' '}
                          {formatCurrency(selectedDispute.entry?.amountPaise || 0)}
                        </span>
                      </div>
                      <div className="border-top mt-2 pt-2 text-secondary small">
                        <strong>Reason:</strong> {selectedDispute.reason}
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Resolution Action
                    </label>
                    <select
                      className="form-select"
                      value={resolveAction}
                      onChange={(e) => setResolveAction(e.target.value)}
                    >
                      <option value="accept">Accept & Automatically Create Reversing Entry</option>
                      <option value="reject">Reject (Confirm original entry remains valid)</option>
                    </select>
                    <div className="form-text small">
                      {resolveAction === 'accept'
                        ? 'An opposing append-only entry will be created on the ledger, nullifying the disputed amount.'
                        : 'The entry will remain on the ledger with resolved status.'}
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Admin Explanation Note
                    </label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={resolveNote}
                      onChange={(e) => setResolveNote(e.target.value)}
                      required
                    ></textarea>
                    <div className="form-text small">
                      Sent to both the customer and shopkeeper in their notifications.
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setSelectedDispute(null)}
                    disabled={resolving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`btn ${resolveAction === 'accept' ? 'btn-success' : 'btn-danger'}`}
                    disabled={resolving}
                  >
                    {resolving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                        Resolving...
                      </>
                    ) : (
                      'Confirm Resolution'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
