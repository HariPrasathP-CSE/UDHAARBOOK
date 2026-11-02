import React, { useState, useEffect } from 'react';
import { updateCreditLimit, rupeesToPaise, paiseToRupees } from '../api/accountApi';

const EditCreditLimitModal = ({ show, onHide, account, onUpdated }) => {
  const [creditLimitRupees, setCreditLimitRupees] = useState('0');
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account) {
      setCreditLimitRupees(paiseToRupees(account.creditLimit));
      setActive(account.active !== false);
    }
    setError('');
  }, [account, show]);

  if (!show || !account) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const payload = {
        creditLimit: rupeesToPaise(creditLimitRupees),
        active
      };

      const result = await updateCreditLimit(account._id, payload);
      onUpdated(result.account);
      onHide();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update credit limit');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow border-0">
          <div className="modal-header bg-dark text-white">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-pencil-square me-2"></i>
              Edit Credit Limit
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onHide}></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              {error && (
                <div className="alert alert-danger py-2 small" role="alert">
                  <i className="bi bi-exclamation-circle me-1"></i> {error}
                </div>
              )}

              <div className="p-3 bg-light rounded border mb-3">
                <div className="fw-semibold text-dark">{account.customer?.name}</div>
                <div className="text-muted small">
                  Phone: {account.customer?.phone} | Email: {account.customer?.email}
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary">Credit Limit (₹) *</label>
                <div className="input-group">
                  <span className="input-group-text bg-light">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control"
                    value={creditLimitRupees}
                    onChange={(e) => setCreditLimitRupees(e.target.value)}
                    required
                  />
                </div>
                <div className="form-text small">
                  Stored as {rupeesToPaise(creditLimitRupees)} integer paise.
                </div>
              </div>

              <div className="form-check form-switch mt-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="activeSwitch"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                <label className="form-check-label fw-semibold text-secondary small" htmlFor="activeSwitch">
                  Account Active for Credit Entries
                </label>
              </div>
            </div>

            <div className="modal-footer bg-light">
              <button type="button" className="btn btn-outline-secondary" onClick={onHide} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary fw-semibold" disabled={saving}>
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditCreditLimitModal;

