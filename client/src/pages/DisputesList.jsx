import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listDisputes } from '../api/disputeApi';
import { formatCurrency } from '../api/accountApi';
import { useAuth } from '../context/AuthContext';

const DisputesList = () => {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | open | escalated | resolved
  const [error, setError] = useState('');

  const fetchDisputes = async (statusFilter = filter) => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const data = await listDisputes(params);
      setDisputes(data.disputes || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load disputes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes(filter);
  }, [filter]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return <span className="badge bg-danger text-uppercase">Open</span>;
      case 'escalated':
        return <span className="badge bg-warning text-dark text-uppercase">Escalated</span>;
      case 'resolved':
        return <span className="badge bg-success text-uppercase">Resolved</span>;
      default:
        return <span className="badge bg-secondary text-uppercase">{status}</span>;
    }
  };

  return (
    <div className="container py-4 flex-grow-1">
      {/* Header Banner */}
      <div className="p-4 mb-4 bg-white rounded-3 shadow-sm border-start border-4 border-danger">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-danger role-badge">Dispute Management</span>
              <span className="text-muted small">UdhaarBook Resolution</span>
            </div>
            <h2 className="fw-bold text-dark mb-1">Disputes & Escalations</h2>
            <p className="text-secondary mb-0 small">
              Review and resolve contested credit transactions to maintain trust and ledger accuracy.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger py-2 small mb-3">
          <i className="bi bi-exclamation-circle me-1"></i> {error}
        </div>
      )}

      {/* Filter Tabs */}
      <ul className="nav nav-pills mb-4 gap-2">
        <li className="nav-item">
          <button
            className={`btn btn-sm ${filter === 'all' ? 'btn-dark' : 'btn-outline-secondary'}`}
            onClick={() => setFilter('all')}
          >
            All Disputes
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`btn btn-sm ${filter === 'open' ? 'btn-danger' : 'btn-outline-danger'}`}
            onClick={() => setFilter('open')}
          >
            Open Claims
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`btn btn-sm ${filter === 'escalated' ? 'btn-warning text-dark' : 'btn-outline-warning text-dark'}`}
            onClick={() => setFilter('escalated')}
          >
            Escalated to Admin
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`btn btn-sm ${filter === 'resolved' ? 'btn-success' : 'btn-outline-success'}`}
            onClick={() => setFilter('resolved')}
          >
            Resolved Cases
          </button>
        </li>
      </ul>

      {/* Content Table / Cards */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-danger" role="status">
            <span className="visually-hidden">Loading disputes...</span>
          </div>
          <div className="text-muted small mt-2">Loading cases...</div>
        </div>
      ) : disputes.length === 0 ? (
        <div className="card border-0 shadow-sm text-center p-5 bg-white">
          <div className="mb-2 text-muted">
            <i className="bi bi-shield-check fs-1 text-success"></i>
          </div>
          <h5 className="fw-bold text-dark">No Disputes Found</h5>
          <p className="text-muted small mb-0">
            {filter === 'all'
              ? 'All transactions are currently acknowledged or without dispute.'
              : `No disputes found under status "${filter}".`}
          </p>
        </div>
      ) : (
        <div className="row g-3">
          {disputes.map((disp) => {
            const entry = disp.entry;
            const account = disp.account;
            const otherParty =
              user?.role === 'customer' ? account?.shop?.name : account?.customer?.name;

            return (
              <div key={disp._id} className="col-12 col-md-6 col-lg-4">
                <div className="card dashboard-card border-0 shadow-sm h-100 bg-white">
                  <div className="card-body d-flex flex-column">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="badge bg-light text-secondary border font-monospace">
                        #{disp._id.slice(-6)}
                      </span>
                      {getStatusBadge(disp.status)}
                    </div>

                    <h5 className="fw-bold text-dark mb-1">
                      {entry?.type?.toUpperCase()} {formatCurrency(entry?.amountPaise)}
                    </h5>

                    <div className="text-muted small mb-2">
                      <i className="bi bi-person me-1"></i> With: <strong>{otherParty}</strong>
                    </div>

                    <div className="p-3 bg-light rounded border mb-3 flex-grow-1">
                      <div className="text-muted small mb-1">Reason:</div>
                      <div className="small text-dark text-truncate" style={{ maxHeight: '48px' }}>
                        "{disp.reason}"
                      </div>
                    </div>

                    <div className="d-flex justify-content-between align-items-center pt-2 border-top mt-auto">
                      <span className="small text-muted" style={{ fontSize: '0.75rem' }}>
                        {new Date(disp.createdAt).toLocaleDateString()}
                      </span>
                      <Link to={`/disputes/${disp._id}`} className="btn btn-outline-danger btn-sm fw-semibold">
                        View Thread &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DisputesList;

