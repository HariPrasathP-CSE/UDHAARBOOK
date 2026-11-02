import React, { useState } from 'react';
import { addCustomerToShop, rupeesToPaise } from '../api/accountApi';

const AddCustomerModal = ({ show, onHide, onCustomerAdded }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    creditLimitRupees: '2000' // default ₹2,000
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [newCustomerNotice, setNewCustomerNotice] = useState(null);

  if (!show) return null;

  const handleClose = () => {
    setNewCustomerNotice(null);
    setError('');
    setFormData({ name: '', phone: '', email: '', creditLimitRupees: '2000' });
    onHide();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        creditLimit: rupeesToPaise(formData.creditLimitRupees)
      };

      const result = await addCustomerToShop(payload);

      if (result.createdNewUser) {
        setNewCustomerNotice({
          phone: result.account.customer.phone,
          tempPassword: result.tempPassword
        });
      } else {
        onCustomerAdded(result.account);
        handleClose();
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to add customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow border-0">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-person-plus me-2"></i>
              Add Customer to Ledger
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={handleClose}></button>
          </div>

          {newCustomerNotice ? (
            <div className="modal-body p-4 text-center">
              <div className="d-inline-flex p-3 rounded-circle bg-success bg-opacity-10 text-success mb-3">
                <i className="bi bi-check-circle fs-1"></i>
              </div>
              <h5 className="fw-bold text-dark">Customer Account Created!</h5>
              <p className="text-secondary small">
                A new customer account was created for phone <strong>{newCustomerNotice.phone}</strong>.
              </p>

              <div className="p-3 bg-light rounded border text-start my-3">
                <div className="text-muted small">Temporary Login Password:</div>
                <div className="d-flex align-items-center justify-content-between mt-1">
                  <code className="fs-5 fw-bold text-primary">{newCustomerNotice.tempPassword}</code>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => navigator.clipboard.writeText(newCustomerNotice.tempPassword)}
                    title="Copy to clipboard"
                  >
                    <i className="bi bi-clipboard"></i> Copy
                  </button>
                </div>
                <div className="text-muted small mt-2">
                  The customer can log in using their phone/email and this temporary password to view their ledger.
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary w-100 fw-semibold"
                onClick={() => {
                  onCustomerAdded();
                  handleClose();
                }}
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="modal-body p-4">
                {error && (
                  <div className="alert alert-danger py-2 small" role="alert">
                    <i className="bi bi-exclamation-circle me-1"></i> {error}
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label small fw-semibold text-secondary">Customer Phone Number *</label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="e.g. 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                  <div className="form-text small">
                    If this phone is already on UdhaarBook, their profile will be linked automatically.
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold text-secondary">Full Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Anand Sharma"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold text-secondary">Email Address (Optional)</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="e.g. anand@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold text-secondary">Initial Credit Limit (₹)</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light">₹</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      className="form-control"
                      placeholder="e.g. 2000"
                      value={formData.creditLimitRupees}
                      onChange={(e) => setFormData({ ...formData, creditLimitRupees: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-text small">Stored securely as integer paise in the database.</div>
                </div>
              </div>

              <div className="modal-footer bg-light">
                <button type="button" className="btn btn-outline-secondary" onClick={handleClose} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary fw-semibold" disabled={saving}>
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Linking...
                    </>
                  ) : (
                    'Link Customer'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddCustomerModal;

