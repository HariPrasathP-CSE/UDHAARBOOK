import React, { useState, useEffect } from 'react';
import { getAccountReminderHistory } from '../api/reminderApi';
import { formatCurrency } from '../api/accountApi';

const ReminderHistoryModal = ({ show, onHide, account }) => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show && account) {
      fetchHistory();
    }
  }, [show, account]);

  const fetchHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getAccountReminderHistory(account._id);
      setReminders(res.reminders || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch reminder history');
    } finally {
      setLoading(false);
    }
  };

  if (!show || !account) return null;

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content shadow border-0">
          <div className="modal-header bg-light border-bottom">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-clock-history me-2 text-primary"></i>
              Reminder History: {account.customer?.name}
            </h5>
            <button type="button" className="btn-close" onClick={onHide}></button>
          </div>

          <div className="modal-body p-4">
            {error && <div className="alert alert-danger py-2">{error}</div>}

            {loading ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading history...</span>
                </div>
              </div>
            ) : reminders.length === 0 ? (
              <div className="text-center py-4 text-muted">
                <i className="bi bi-inbox fs-2 d-block mb-2 text-secondary"></i>
                No reminders sent to this customer yet.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Date & Time</th>
                      <th>Type</th>
                      <th>Dues Amount</th>
                      <th>Channels</th>
                      <th>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reminders.map((r) => (
                      <tr key={r._id}>
                        <td className="small text-nowrap">
                          {new Date(r.sentAt || r.createdAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              r.type === 'manual' ? 'bg-primary' : 'bg-info text-dark'
                            }`}
                          >
                            {r.type}
                          </span>
                        </td>
                        <td className="fw-semibold text-danger">
                          {formatCurrency(r.amountPaise)}
                        </td>
                        <td>
                          <span className="badge bg-light text-secondary border me-1">
                            <i className="bi bi-bell-fill me-1"></i>In-App
                          </span>
                          <span className="badge bg-light text-secondary border">
                            <i className="bi bi-envelope-fill me-1"></i>Email
                          </span>
                        </td>
                        <td className="small text-muted" style={{ maxWidth: '280px' }}>
                          <div className="text-truncate" title={r.message}>
                            {r.message}
                          </div>
                          {r.emailPreviewUrl && (
                            <a
                              href={r.emailPreviewUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="badge bg-success-subtle text-success text-decoration-none mt-1 d-inline-block"
                            >
                              <i className="bi bi-box-arrow-up-right me-1"></i>Email Preview
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="modal-footer bg-light">
            <button type="button" className="btn btn-secondary" onClick={onHide}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReminderHistoryModal;

