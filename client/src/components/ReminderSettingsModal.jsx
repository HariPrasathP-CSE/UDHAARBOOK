import React, { useState, useEffect } from 'react';
import { getReminderSettings, updateReminderSettings, triggerDailyReminderJob } from '../api/reminderApi';

const ReminderSettingsModal = ({ show, onHide, onSettingsSaved }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [triggeringJob, setTriggeringJob] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [formData, setFormData] = useState({
    enabled: false,
    frequencyDays: 7,
    minOverdueDays: 8,
    messageTemplate:
      'Dear {customerName}, this is a gentle reminder that your outstanding balance of ₹{amount} at {shopName} is overdue. Kindly clear your dues at your earliest convenience.'
  });

  useEffect(() => {
    if (show) {
      loadSettings();
      setError('');
      setSuccessMsg('');
    }
  }, [show]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await getReminderSettings();
      if (res.settings) {
        setFormData({
          enabled: res.settings.enabled ?? false,
          frequencyDays: res.settings.frequencyDays || 7,
          minOverdueDays: res.settings.minOverdueDays || 8,
          messageTemplate:
            res.settings.messageTemplate ||
            'Dear {customerName}, this is a gentle reminder that your outstanding balance of ₹{amount} at {shopName} is overdue. Kindly clear your dues at your earliest convenience.'
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load reminder settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await updateReminderSettings(formData);
      setSuccessMsg('Reminder settings updated successfully!');
      if (onSettingsSaved) onSettingsSaved(res.settings);
      setTimeout(() => {
        onHide();
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRunJob = async () => {
    setTriggeringJob(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await triggerDailyReminderJob();
      setSuccessMsg(
        `Automated job executed: ${res.stats?.remindersSent || 0} sent, ${res.stats?.remindersSkipped || 0} skipped.`
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to execute reminder job');
    } finally {
      setTriggeringJob(false);
    }
  };

  if (!show) return null;

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content shadow border-0">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-bell-fill me-2"></i>
              Automated Payment Reminder Settings
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onHide}
            ></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              {error && <div className="alert alert-danger py-2">{error}</div>}
              {successMsg && <div className="alert alert-success py-2">{successMsg}</div>}

              {loading ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading settings...</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="card mb-3 bg-light border-0">
                    <div className="card-body">
                      <div className="form-check form-switch fs-5">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="enabledSwitch"
                          checked={formData.enabled}
                          onChange={(e) =>
                            setFormData({ ...formData, enabled: e.target.checked })
                          }
                        />
                        <label className="form-check-label fw-bold ms-2" htmlFor="enabledSwitch">
                          Enable Daily Automated Reminders
                        </label>
                      </div>
                      <div className="text-muted small ms-4 ps-2 mt-1">
                        When enabled, a background job runs daily at 10:00 AM to check overdue accounts and dispatch in-app notifications and email reminders.
                      </div>
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">
                        <i className="bi bi-clock-history me-1 text-primary"></i>
                        Reminder Frequency (Days)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="90"
                        className="form-control"
                        value={formData.frequencyDays}
                        onChange={(e) =>
                          setFormData({ ...formData, frequencyDays: parseInt(e.target.value, 10) || 1 })
                        }
                        required
                      />
                      <div className="form-text">
                        Minimum days between consecutive reminders for the same customer.
                      </div>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold">
                        <i className="bi bi-exclamation-triangle me-1 text-warning"></i>
                        Min Overdue Threshold (Days)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="180"
                        className="form-control"
                        value={formData.minOverdueDays}
                        onChange={(e) =>
                          setFormData({ ...formData, minOverdueDays: parseInt(e.target.value, 10) || 1 })
                        }
                        required
                      />
                      <div className="form-text">
                        Only remind customers with dues at least this many days old.
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      <i className="bi bi-chat-left-text me-1 text-primary"></i>
                      Message Template
                    </label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={formData.messageTemplate}
                      onChange={(e) =>
                        setFormData({ ...formData, messageTemplate: e.target.value })
                      }
                      required
                    ></textarea>
                    <div className="form-text d-flex justify-content-between">
                      <span>
                        Placeholders: <code>{'{customerName}'}</code>, <code>{'{amount}'}</code>, <code>{'{shopName}'}</code>
                      </span>
                    </div>
                  </div>

                  <div className="card bg-info-subtle border-0">
                    <div className="card-body p-3">
                      <h6 className="card-subtitle mb-1 fw-bold text-info-emphasis">
                        <i className="bi bi-eye me-1"></i> Preview:
                      </h6>
                      <p className="card-text small mb-0 fst-italic text-secondary">
                        "{formData.messageTemplate
                          .replace(/{customerName}/g, 'Rahul Sharma')
                          .replace(/{amount}/g, '450.00')
                          .replace(/{shopName}/g, 'My Store')}"
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer bg-light d-flex justify-content-between">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={handleRunJob}
                disabled={triggeringJob || loading}
              >
                {triggeringJob ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                    Running Job...
                  </>
                ) : (
                  <>
                    <i className="bi bi-play-circle me-1"></i>
                    Trigger Job Now
                  </>
                )}
              </button>

              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onHide}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || loading}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                      Saving...
                    </>
                  ) : (
                    'Save Settings'
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ReminderSettingsModal;

