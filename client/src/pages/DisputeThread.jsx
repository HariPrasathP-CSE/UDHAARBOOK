import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDisputeById, resolveDispute, escalateDispute } from '../api/disputeApi';
import { formatCurrency } from '../api/accountApi';
import { useAuth } from '../context/AuthContext';

const DisputeThread = () => {
  const { id } = useParams();
  const { user } = useAuth();

  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [rejectNote, setRejectNote] = useState('');
  const [escalateNote, setEscalateNote] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showEscalateForm, setShowEscalateForm] = useState(false);

  const fetchDispute = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getDisputeById(id);
      setDispute(data.dispute);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load dispute thread');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDispute();
  }, [fetchDispute]);

  const handleAccept = async () => {
    if (!window.confirm('Accepting this dispute will automatically generate an opposite reversing entry to credit/nullify the customer balance. Proceed?')) {
      return;
    }

    try {
      setActionLoading(true);
      await resolveDispute(id, { action: 'accept', note: 'Dispute accepted; reversing entry created' });
      await fetchDispute();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to accept dispute');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectNote.trim()) {
      setError('Please provide an explanation note for rejecting this dispute');
      return;
    }

    try {
      setActionLoading(true);
      await resolveDispute(id, { action: 'reject', note: rejectNote.trim() });
      setShowRejectForm(false);
      setRejectNote('');
      await fetchDispute();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to reject dispute');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEscalate = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await escalateDispute(id, escalateNote.trim());
      setShowEscalateForm(false);
      setEscalateNote('');
      await fetchDispute();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to escalate dispute');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-5 text-center flex-grow-1">
        <div className="spinner-border text-danger" role="status">
          <span className="visually-hidden">Loading dispute details...</span>
        </div>
        <div className="text-muted small mt-2">Loading dispute thread...</div>
      </div>
    );
  }

  if (error && !dispute) {
    return (
      <div className="container py-5 flex-grow-1">
        <div className="alert alert-danger">{error}</div>
        <Link to="/disputes" className="btn btn-outline-secondary">
          &larr; Back to Disputes
        </Link>
      </div>
    );
  }

  const { entry, account, raisedBy, resolvedBy, history = [] } = dispute;
  const isShopOwner = account?.shop?.owner?.toString() === user?.id || account?.shop?.owner?._id?.toString() === user?.id;
  const isCustomer = raisedBy?._id?.toString() === user?.id || raisedBy?.toString() === user?.id;
  const isAdmin = user?.role === 'admin';

  const getStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return <span className="badge bg-danger fs-6 px-3 py-2 text-uppercase">Dispute Open</span>;
      case 'escalated':
        return <span className="badge bg-warning text-dark fs-6 px-3 py-2 text-uppercase">Escalated to Admin</span>;
      case 'resolved':
        return <span className="badge bg-success fs-6 px-3 py-2 text-uppercase">Dispute Resolved</span>;
      default:
        return <span className="badge bg-secondary fs-6 px-3 py-2 text-uppercase">{status}</span>;
    }
  };

  return (
    <div className="container py-4 flex-grow-1">
      {/* Back button */}
      <div className="mb-3">
        <Link to="/disputes" className="text-decoration-none text-secondary small d-inline-flex align-items-center gap-1">
          <i className="bi bi-arrow-left"></i> Back to Disputes
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger py-2 small mb-3">
          <i className="bi bi-exclamation-triangle-fill me-1"></i> {error}
        </div>
      )}

      {/* Header Banner */}
      <div className="p-4 mb-4 bg-white rounded-3 shadow-sm border-start border-4 border-danger">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-danger role-badge">Dispute Case #{dispute._id.slice(-6)}</span>
              <span className="text-muted small">Two-Party Mediation</span>
            </div>
            <h2 className="fw-bold text-dark mb-1">
              Disputed {entry?.type?.toUpperCase()} of {formatCurrency(entry?.amountPaise)}
            </h2>
            <p className="text-secondary mb-0 small">
              Store: <strong>{account?.shop?.name}</strong> &middot; Customer: <strong>{account?.customer?.name}</strong>
            </p>
          </div>
          <div>{getStatusBadge(dispute.status)}</div>
        </div>
      </div>

      <div className="row g-4">
        {/* Left Column: Transaction & Dispute Info */}
        <div className="col-12 col-md-5">
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white pt-3 border-0">
              <h6 className="fw-bold text-dark mb-0">
                <i className="bi bi-file-earmark-text me-2 text-danger"></i>Transaction In Question
              </h6>
            </div>
            <div className="card-body">
              <ul className="list-unstyled mb-0">
                <li className="d-flex justify-content-between py-2 border-bottom">
                  <span className="text-muted small">Amount:</span>
                  <span className="fw-bold fs-5 text-danger">{formatCurrency(entry?.amountPaise)}</span>
                </li>
                <li className="d-flex justify-content-between py-2 border-bottom">
                  <span className="text-muted small">Type:</span>
                  <span className="badge bg-light text-dark border text-uppercase">{entry?.type}</span>
                </li>
                <li className="d-flex justify-content-between py-2 border-bottom">
                  <span className="text-muted small">Entry Date:</span>
                  <span className="small text-secondary">
                    {new Date(entry?.entryDate || entry?.createdAt).toLocaleDateString()}
                  </span>
                </li>
                <li className="d-flex justify-content-between py-2 border-bottom">
                  <span className="text-muted small">Original Note:</span>
                  <span className="small text-secondary">{entry?.note || 'No note provided'}</span>
                </li>
                <li className="d-flex justify-content-between py-2">
                  <span className="text-muted small">Entry ID:</span>
                  <span className="font-monospace small text-muted">#{entry?._id}</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white pt-3 border-0">
              <h6 className="fw-bold text-dark mb-0">
                <i className="bi bi-chat-left-quote me-2 text-danger"></i>Dispute Claim
              </h6>
            </div>
            <div className="card-body">
              <div className="p-3 bg-light rounded border mb-3">
                <div className="text-muted small mb-1">Customer Reason:</div>
                <div className="fw-semibold text-dark">"{dispute.reason}"</div>
                <div className="text-muted small mt-2">
                  Raised by {raisedBy?.name} ({raisedBy?.phone})
                </div>
              </div>

              {dispute.resolution && (
                <div className="p-3 bg-success bg-opacity-10 border border-success rounded">
                  <div className="text-success small fw-bold mb-1">Final Resolution:</div>
                  <div className="small text-dark">{dispute.resolution}</div>
                  {resolvedBy && (
                    <div className="text-muted small mt-1">
                      Resolved by: {resolvedBy.name} ({resolvedBy.role})
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Card */}
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white pt-3 border-0">
              <h6 className="fw-bold text-dark mb-0">
                <i className="bi bi-gear me-2 text-secondary"></i>Resolution Actions
              </h6>
            </div>
            <div className="card-body">
              {dispute.status === 'open' && (isShopOwner || isAdmin) && (
                <div className="d-grid gap-2 mb-3">
                  <button
                    className="btn btn-success fw-semibold d-flex align-items-center justify-content-center gap-2"
                    onClick={handleAccept}
                    disabled={actionLoading}
                  >
                    <i className="bi bi-check-circle"></i>
                    <span>Accept Dispute (Auto-Reverse)</span>
                  </button>

                  <button
                    className="btn btn-outline-danger fw-semibold d-flex align-items-center justify-content-center gap-2"
                    onClick={() => setShowRejectForm(!showRejectForm)}
                    disabled={actionLoading}
                  >
                    <i className="bi bi-x-circle"></i>
                    <span>Reject Dispute with Explanation</span>
                  </button>
                </div>
              )}

              {/* Reject form */}
              {showRejectForm && (
                <form onSubmit={handleReject} className="p-3 bg-light rounded border mb-3">
                  <label className="form-label small fw-semibold text-danger">
                    Explanation for Rejection *
                  </label>
                  <textarea
                    className="form-control mb-2"
                    rows="2"
                    placeholder="Provide bill reference, CCTV check, or store proof..."
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    required
                  ></textarea>
                  <div className="d-flex gap-2">
                    <button type="submit" className="btn btn-danger btn-sm fw-semibold" disabled={actionLoading}>
                      Confirm Rejection
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setShowRejectForm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Escalate action */}
              {dispute.status !== 'escalated' && (isCustomer || isShopOwner || isAdmin) && (
                <div>
                  {!showEscalateForm ? (
                    <button
                      className="btn btn-outline-warning text-dark w-100 fw-semibold d-flex align-items-center justify-content-center gap-2"
                      onClick={() => setShowEscalateForm(true)}
                      disabled={actionLoading}
                    >
                      <i className="bi bi-arrow-up-right-circle"></i>
                      <span>Escalate to Platform Admin</span>
                    </button>
                  ) : (
                    <form onSubmit={handleEscalate} className="p-3 bg-light rounded border">
                      <label className="form-label small fw-semibold text-warning text-dark">
                        Escalation Note for Admin
                      </label>
                      <textarea
                        className="form-control mb-2"
                        rows="2"
                        placeholder="Why do you require platform intervention?"
                        value={escalateNote}
                        onChange={(e) => setEscalateNote(e.target.value)}
                      ></textarea>
                      <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-warning btn-sm fw-semibold" disabled={actionLoading}>
                          Escalate Now
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => setShowEscalateForm(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {dispute.status === 'resolved' && (
                <div className="text-center text-muted small py-2">
                  <i className="bi bi-lock me-1"></i> This dispute case is resolved.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Complete Audit Timeline */}
        <div className="col-12 col-md-7">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white pt-4 px-4 border-0">
              <h5 className="fw-bold text-dark mb-1">
                <i className="bi bi-clock-history me-2 text-primary"></i>Audit Trail & Dispute History
              </h5>
              <p className="text-muted small mb-0">Immutable chronological log of all communications and state changes</p>
            </div>

            <div className="card-body p-4">
              <div className="timeline position-relative">
                {history.map((step, idx) => (
                  <div key={step._id || idx} className="d-flex gap-3 mb-4 position-relative">
                    <div className="timeline-badge flex-shrink-0 mt-1">
                      {step.action === 'dispute_raised' && (
                        <span className="badge bg-danger rounded-circle p-2">
                          <i className="bi bi-exclamation-triangle"></i>
                        </span>
                      )}
                      {step.action === 'accepted_with_reversal' && (
                        <span className="badge bg-success rounded-circle p-2">
                          <i className="bi bi-check-circle"></i>
                        </span>
                      )}
                      {step.action === 'rejected_with_explanation' && (
                        <span className="badge bg-secondary rounded-circle p-2">
                          <i className="bi bi-x-circle"></i>
                        </span>
                      )}
                      {step.action === 'escalated_to_admin' && (
                        <span className="badge bg-warning rounded-circle p-2">
                          <i className="bi bi-shield-exclamation text-dark"></i>
                        </span>
                      )}
                      {!['dispute_raised', 'accepted_with_reversal', 'rejected_with_explanation', 'escalated_to_admin'].includes(step.action) && (
                        <span className="badge bg-primary rounded-circle p-2">
                          <i className="bi bi-dot"></i>
                        </span>
                      )}
                    </div>

                    <div className="p-3 bg-light rounded-3 border flex-grow-1">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="fw-bold text-dark small text-capitalize">
                          {step.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-muted small" style={{ fontSize: '0.75rem' }}>
                          {new Date(step.timestamp).toLocaleString()}
                        </span>
                      </div>

                      <p className="mb-2 text-secondary small">
                        {step.note || 'No additional comment provided'}
                      </p>

                      <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                        Updated by: <strong>{step.updatedBy?.name}</strong> ({step.updatedBy?.role})
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisputeThread;

