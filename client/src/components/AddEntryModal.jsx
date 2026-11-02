import React, { useState } from 'react';
import { createLedgerEntry } from '../api/ledgerApi';
import { rupeesToPaise } from '../api/accountApi';

const AddEntryModal = ({ show, onHide, account, currentBalancePaise = 0, onEntryAdded }) => {
  const [formData, setFormData] = useState({
    type: 'credit',
    amountRupees: '',
    note: '',
    entryDate: new Date().toISOString().split('T')[0]
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!show || !account) return null;

  const handleClose = () => {
    setError('');
    setFormData({
      type: 'credit',
      amountRupees: '',
      note: '',
      entryDate: new Date().toISOString().split('T')[0]
    });
    onHide();
  };

  const amountPaise = rupeesToPaise(formData.amountRupees);
  const prospectiveBalancePaise =
    formData.type === 'credit'
      ? currentBalancePaise + amountPaise
      : currentBalancePaise - amountPaise;

  const isExceedingLimit = Boolean(
    formData.type === 'credit' &&
    account.creditLimit > 0 &&
    prospectiveBalancePaise > account.creditLimit
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (amountPaise <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        accountId: account._id,
        type: formData.type,
        amountPaise,
        note: formData.note.trim(),
        entryDate: formData.entryDate
      };

      const result = await createLedgerEntry(payload);
      onEntryAdded(result);
      handleClose();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to record ledger entry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow border-0">
          <div className={`modal-header ${formData.type === 'credit' ? 'bg-danger' : 'bg-success'} text-white`}>
            <h5 className="modal-title fw-bold">
              <i className={`bi ${formData.type === 'credit' ? 'bi-dash-circle' : 'bi-plus-circle'} me-2`}></i>
              {formData.type === 'credit' ? 'Give Credit ( सामान दिया )' : 'Receive Payment ( पैसा मिला )'}
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={handleClose}></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              {error && (
                <div className="alert alert-danger py-2 small" role="alert">
                  <i className="bi bi-exclamation-circle me-1"></i> {error}
                </div>
              )}

              {/* Customer context */}
              <div className="p-3 bg-light rounded border mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-bold text-dark">{account.customer?.name}</div>
                    <div className="text-muted small">Phone: {account.customer?.phone}</div>
                  </div>
                  <div className="text-end">
                    <span className="text-muted small d-block">Approved Limit</span>
                    <span className="fw-bold text-dark">
                      ₹ {(account.creditLimit / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Entry Type selector */}
              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary d-block">Transaction Type</label>
                <div className="row g-2">
                  <div className="col-6">
                    <input
                      type="radio"
                      className="btn-check"
                      name="entryType"
                      id="typeCredit"
                      value="credit"
                      checked={formData.type === 'credit'}
                      onChange={() => setFormData({ ...formData, type: 'credit' })}
                    />
                    <label className="btn btn-outline-danger w-100 py-2 d-flex align-items-center justify-content-center gap-2 fw-semibold" htmlFor="typeCredit">
                      <i className="bi bi-box-arrow-up-right"></i> Credit (Give)
                    </label>
                  </div>
                  <div className="col-6">
                    <input
                      type="radio"
                      className="btn-check"
                      name="entryType"
                      id="typePayment"
                      value="payment"
                      checked={formData.type === 'payment'}
                      onChange={() => setFormData({ ...formData, type: 'payment' })}
                    />
                    <label className="btn btn-outline-success w-100 py-2 d-flex align-items-center justify-content-center gap-2 fw-semibold" htmlFor="typePayment">
                      <i className="bi bi-box-arrow-in-down-left"></i> Payment (Get)
                    </label>
                  </div>
                </div>
              </div>

              {/* Amount */}
              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary">Amount (₹) *</label>
                <div className="input-group">
                  <span className="input-group-text bg-light">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-control form-control-lg fw-bold"
                    placeholder="0.00"
                    value={formData.amountRupees}
                    onChange={(e) => setFormData({ ...formData, amountRupees: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-text small">
                  Stored as {amountPaise} integer paise.
                </div>
              </div>

              {/* Limit warning banner */}
              {isExceedingLimit && (
                <div className="alert alert-warning py-2 small d-flex align-items-start gap-2 mb-3">
                  <i className="bi bi-exclamation-triangle-fill text-warning fs-5 flex-shrink-0"></i>
                  <div>
                    <strong>Credit Limit Exceeded:</strong> New balance of{' '}
                    <strong>₹ {(prospectiveBalancePaise / 100).toFixed(2)}</strong> exceeds approved limit of{' '}
                    <strong>₹ {(account.creditLimit / 100).toFixed(2)}</strong>. Entry will be recorded with a limit warning flag.
                  </div>
                </div>
              )}

              {/* Description / Note */}
              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary">Details / Items / Note</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Rice 5kg, Mustard oil, Sugar 2kg"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                />
              </div>

              {/* Date */}
              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary">Entry Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.entryDate}
                  onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="modal-footer bg-light">
              <button type="button" className="btn btn-outline-secondary" onClick={handleClose} disabled={saving}>
                Cancel
              </button>
              <button
                type="submit"
                className={`btn ${formData.type === 'credit' ? 'btn-danger' : 'btn-success'} fw-semibold`}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Recording...
                  </>
                ) : (
                  formData.type === 'credit' ? 'Record Credit' : 'Record Payment'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddEntryModal;

