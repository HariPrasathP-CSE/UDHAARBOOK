import React, { useState } from 'react';
import { downloadStatementPDF } from '../api/accountApi';

const StatementDownloadModal = ({ show, onHide, accountId, customerName = 'statement' }) => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const setLastMonth = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    setSelectedMonth(d.toISOString().slice(0, 7));
  };

  const handleDownload = async () => {
    if (!accountId) return;
    setDownloading(true);
    setError('');
    try {
      await downloadStatementPDF(accountId, selectedMonth, customerName);
      onHide();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate statement PDF');
    } finally {
      setDownloading(false);
    }
  };

  if (!show) return null;

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow border-0">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-file-earmark-pdf-fill me-2"></i>
              Download Ledger Statement
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onHide}
              disabled={downloading}
            ></button>
          </div>

          <div className="modal-body p-4">
            {error && <div className="alert alert-danger py-2">{error}</div>}

            <p className="text-muted small mb-3">
              Generate an official PDF statement containing the shop header, opening balance, all credit and payment entries for the selected billing month, net closing balance, and FIFO ageing breakdown.
            </p>

            <div className="mb-3">
              <label className="form-label fw-semibold">
                Select Billing Month
              </label>
              <input
                type="month"
                className="form-control form-control-lg"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                max={currentMonth}
                required
              />
            </div>

            <div className="d-flex gap-2 mb-3">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setSelectedMonth(currentMonth)}
              >
                Current Month
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={setLastMonth}
              >
                Previous Month
              </button>
            </div>

            <div className="card bg-light border-0">
              <div className="card-body p-3">
                <div className="d-flex align-items-center text-secondary small">
                  <i className="bi bi-info-circle-fill text-primary me-2 fs-5"></i>
                  <span>
                    Format: Verified A4 PDF with table lines and page numbers.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer bg-light">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onHide}
              disabled={downloading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary fw-semibold"
              onClick={handleDownload}
              disabled={downloading || !selectedMonth}
            >
              {downloading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                  Generating PDF...
                </>
              ) : (
                <>
                  <i className="bi bi-download me-1"></i>
                  Download PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatementDownloadModal;

