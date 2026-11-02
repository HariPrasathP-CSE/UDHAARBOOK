import React, { useState, useEffect } from 'react';
import { sendManualReminder } from '../api/reminderApi';
import { formatCurrency } from '../api/accountApi';

const SendReminderModal = ({ show, onHide, account, balancePaise, onSuccess }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    if (show && account) {
      setError('');
      setSuccessData(null);
      const customerName = account.customer?.name || 'Valued Customer';
      const formattedAmount = ((balancePaise || 0) / 100).toFixed(2);
      setMessage(
        `Dear ${customerName}, this is a gentle reminder that your outstanding balance of ₹${formattedAmount} is overdue. Kindly clear your dues at your earliest convenience.`
      );
    }
  }, [show, account, balancePaise]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!account) return;

    setSending(true);
    setError('');
    setSuccessData(null);

    try {
      const res = await sendManualReminder(account._id, { message });
      setSuccessData(res);
      if (onSuccess) onSuccess(res.reminder);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reminder');
    } finally {
      setSending(false);
    }
  };

  if (!show || !account) return null;

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow border-0">
          <div className="modal-header bg-warning-subtle text-dark border-bottom">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-send-fill text-warning me-2"></i>
              Send Payment Reminder Now
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onHide}
              disabled={sending}
            ></button>
          </div>

          <form onSubmit={handleSend}>
            <div className="modal-body p-4">
              {error && <div className="alert alert-danger py-2">{error}</div>}

              {successData ? (
                <div className="alert alert-success">
                  <h6 className="fw-bold mb-2">
                    <i className="bi bi-check-circle-fill me-2"></i>
                    Reminder Sent Successfully!
                  </h6>
                  <p className="small mb-2">
                    In-app notification and email reminder were successfully dispatched to{' '}
                    <strong>{account.customer?.name}</strong>.
                  </p>
                  {successData.emailPreviewUrl && (
                    <div className="mt-2 pt-2 border-top">
                      <span className="small text-muted me-2">Development Ethereal Email Preview:</span>
                      <a
                        href={successData.emailPreviewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm btn-outline-success"
                      >
                        <i className="bi bi-box-arrow-up-right me-1"></i>
                        View Email
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="card mb-3 bg-light border-0">
                    <div className="card-body py-2 px-3">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="text-muted small">Customer:</span>
                        <strong className="text-dark">{account.customer?.name}</strong>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="text-muted small">Email:</span>
                        <span className="small text-dark">{account.customer?.email}</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="text-muted small">Current Outstanding:</span>
                        <span className="badge bg-danger fs-6">
                          {formatCurrency(balancePaise)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Reminder Message
                    </label>
                    <textarea
                      className="form-control"
                      rows="4"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                    ></textarea>
                    <div className="form-text">
                      Dispatched immediately via In-App Notification and Email.
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer bg-light">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onHide}
                disabled={sending}
              >
                {successData ? 'Close' : 'Cancel'}
              </button>
              {!successData && (
                <button
                  type="submit"
                  className="btn btn-warning text-dark fw-bold"
                  disabled={sending || (balancePaise || 0) <= 0}
                >
                  {sending ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                      Sending...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send me-1"></i>
                      Send Reminder Now
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SendReminderModal;

