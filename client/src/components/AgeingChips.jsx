import React from 'react';
import { formatCurrency } from '../api/accountApi';

const AgeingChips = ({ ageing, compact = false }) => {
  if (!ageing) return null;

  const { days0_7Paise = 0, days8_30Paise = 0, days30PlusPaise = 0 } = ageing;

  if (compact) {
    return (
      <div className="d-flex flex-wrap gap-1 align-items-center">
        {days0_7Paise > 0 && (
          <span className="badge bg-success bg-opacity-10 text-success border border-success" title="0–7 days old (Recent)">
            0-7d: {formatCurrency(days0_7Paise)}
          </span>
        )}
        {days8_30Paise > 0 && (
          <span className="badge bg-warning bg-opacity-10 text-dark border border-warning" title="8–30 days old (Moderate)">
            8-30d: {formatCurrency(days8_30Paise)}
          </span>
        )}
        {days30PlusPaise > 0 && (
          <span className="badge bg-danger bg-opacity-10 text-danger border border-danger fw-bold" title="30+ days old (Overdue)">
            30+d: {formatCurrency(days30PlusPaise)}
          </span>
        )}
        {days0_7Paise === 0 && days8_30Paise === 0 && days30PlusPaise === 0 && (
          <span className="badge bg-light text-secondary border">No Due</span>
        )}
      </div>
    );
  }

  return (
    <div className="d-flex flex-wrap gap-2 align-items-center">
      <span className="badge bg-success bg-opacity-10 text-success border border-success px-2 py-1" title="0–7 days old">
        <i className="bi bi-clock me-1"></i> 0-7d: {formatCurrency(days0_7Paise)}
      </span>
      <span className="badge bg-warning bg-opacity-10 text-dark border border-warning px-2 py-1" title="8–30 days old">
        <i className="bi bi-hourglass-split me-1"></i> 8-30d: {formatCurrency(days8_30Paise)}
      </span>
      <span className="badge bg-danger bg-opacity-10 text-danger border border-danger px-2 py-1 fw-bold" title="30+ days overdue">
        <i className="bi bi-exclamation-triangle me-1"></i> 30+d: {formatCurrency(days30PlusPaise)}
      </span>
    </div>
  );
};

export default AgeingChips;

