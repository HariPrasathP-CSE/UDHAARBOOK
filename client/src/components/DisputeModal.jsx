import React, { useState } from 'react';
import { disputeLedgerEntry } from '../api/disputeApi';
import { formatCurrency } from '../api/accountApi';

const DisputeModal = ({ show, onHide, entry, onDisputeCreated }) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!show || !entry) return null;

  const handleClose = () => {
    setReason('');
    setError('');
    onHide();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a specific reason for disputing this entry');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const result = await disputeLedgerEntry(entry._id, reason.trim());
      onDisputeCreated(result);
      handleClose();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to submit dispute');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow border-0">
          <div className="modal-header bg-danger text-white">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-exclamation-octagon me-2"></i>
              Dispute Ledger Entry
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={handleClose}></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              {error && (
                <div className="alert alert-danger py-2 small mb-3">
                  <i className="bi bi-exclamation-triangle-fill me-1"></i> {error}
                </div>
              )}

              <p className="text-secondary small mb-3">
                If you believe this record is inaccurate, raise a dispute with your reason.
                The shopkeeper will be notified to review, accept (auto-reversal), or explain.
              </p>

              {/* Entry Details Card */}
              <div className="p-3 bg-light rounded border mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="text-muted small">Transaction Type:</span>
                  <span className={`badge ${entry.type === 'credit' ? 'bg-danger' : 'bg-success'} text-uppercase`}>
                    {entry.type}
                  </span>
                </div>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="text-muted small">Recorded Amount:</span>
                  <span className="fw-bold fs-5 text-dark">
                    {formatCurrency(entry.amountPaise)}
                  </span>
                </div>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="text-muted small">Date:</span>
                  <span className="text-secondary small">
                    {new Date(entry.entryDate || entry.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {entry.note && (
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="text-muted small">Shop Note:</span>
                    <span className="text-secondary small">{entry.note}</span>
                  </div>
                )}
              </div>

              {/* Reason input */}
              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary">
                  Reason for Dispute *
                </label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="e.g. I did not take these items; Price charged is ₹300 instead of ₹200; Already paid in cash."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  autoFocus
                ></textarea>
                <div className="form-text small">
                  Be specific so the shopkeeper can verify store records or bills.
                </div>
              </div>
            </div>

            <div className="modal-footer bg-light">
              <button type="button" className="btn btn-outline-secondary" onClick={handleClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-danger fw-semibold" disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Submitting...
                  </>
                ) : (
                  'Raise Dispute'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DisputeModal;

