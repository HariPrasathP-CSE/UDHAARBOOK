import React, { useState, useEffect } from 'react';
import { createMyShop, updateMyShop } from '../api/shopApi';

const ShopModal = ({ show, onHide, existingShop, onShopSaved }) => {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: ''
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existingShop) {
      setFormData({
        name: existingShop.name || '',
        address: existingShop.address || '',
        phone: existingShop.phone || ''
      });
    } else {
      setFormData({ name: '', address: '', phone: '' });
    }
    setError('');
  }, [existingShop, show]);

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      let result;
      if (existingShop) {
        result = await updateMyShop(formData);
      } else {
        result = await createMyShop(formData);
      }
      onShopSaved(result.shop);
      onHide();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save shop details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow border-0">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-shop me-2"></i>
              {existingShop ? 'Edit Shop Profile' : 'Register Your Shop'}
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

              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary">Shop Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Ramesh Kirana & General Store"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary">Contact Phone *</label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="e.g. 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary">Shop Address</label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Street, Landmark, City/Town"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                ></textarea>
              </div>
            </div>

            <div className="modal-footer bg-light">
              <button type="button" className="btn btn-outline-secondary" onClick={onHide} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-success fw-semibold" disabled={saving}>
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Saving...
                  </>
                ) : (
                  existingShop ? 'Update Shop' : 'Create Shop'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ShopModal;

