import React, { useState } from 'react';
import { reverseLedgerEntry } from '../api/ledgerApi';
import { formatCurrency } from '../api/accountApi';

const ReverseConfirmModal = ({ show, onHide, entry, onEntryReversed }) => {
  const [reversing, setReversing] = useState(false);
  const [error, setError] = useState('');

  if (!show || !entry) return null;

  const handleConfirm = async () => {
    setError('');
    setReversing(true);

    try {
      const result = await reverseLedgerEntry(entry._id);
      onEntryReversed(result);
      onHide();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to reverse entry');
    } finally {
      setReversing(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow border-0">
          <div className="modal-header bg-warning text-dark">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-arrow-counterclockwise me-2"></i>
              Reverse Ledger Entry
            </h5>
            <button type="button" className="btn-close" onClick={onHide}></button>
          </div>

          <div className="modal-body p-4">
            {error && (
              <div className="alert alert-danger py-2 small mb-3">
                <i className="bi bi-exclamation-circle me-1"></i> {error}
              </div>
            )}

            <p className="text-secondary small mb-3">
              Are you sure you want to reverse this entry? In accordance with append-only ledger rules,
              the original record is never deleted; an opposite compensating entry will be recorded.
            </p>

            <div className="p-3 bg-light rounded border mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="text-muted small">Entry Type:</span>
                <span className={`badge ${entry.type === 'credit' ? 'bg-danger' : 'bg-success'} text-uppercase`}>
                  {entry.type}
                </span>
              </div>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="text-muted small">Amount:</span>
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
                  <span className="text-muted small">Note:</span>
                  <span className="text-secondary small text-truncate" style={{ maxWidth: '220px' }}>
                    {entry.note}
                  </span>
                </div>
              )}
            </div>

            <div className="alert alert-info py-2 small mb-0 d-flex align-items-center gap-2">
              <i className="bi bi-info-circle-fill fs-5"></i>
              <div>
                A new <strong>{entry.type === 'credit' ? 'Payment' : 'Credit'}</strong> entry of{' '}
                <strong>{formatCurrency(entry.amountPaise)}</strong> will be created referencing entry #{entry._id.slice(-6)}.
              </div>
            </div>
          </div>

          <div className="modal-footer bg-light">
            <button type="button" className="btn btn-outline-secondary" onClick={onHide} disabled={reversing}>
              Cancel
            </button>
            <button type="button" className="btn btn-warning fw-semibold" onClick={handleConfirm} disabled={reversing}>
              {reversing ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Reversing...
                </>
              ) : (
                'Confirm Reversal'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReverseConfirmModal;

