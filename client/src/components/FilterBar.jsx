import React, { useState } from 'react';

const FilterBar = ({
  filters = {},
  onChange,
  onReset,
  showSearch = true,
  searchPlaceholder = 'Search...',
  showType = false,
  showStatus = false,
  showDateRange = false,
  showMinBalance = false,
  showSort = false,
  sortOptions = []
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleFieldChange = (field, value) => {
    onChange({ ...filters, [field]: value });
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
    } else {
      onChange({
        search: '',
        type: 'all',
        status: 'all',
        startDate: '',
        endDate: '',
        minBalance: '',
        sortBy: sortOptions[0]?.value || ''
      });
    }
  };

  const hasActiveFilters = Boolean(
    filters.search ||
    (filters.type && filters.type !== 'all') ||
    (filters.status && filters.status !== 'all') ||
    filters.startDate ||
    filters.endDate ||
    filters.minBalance ||
    (filters.sortBy && filters.sortBy !== sortOptions[0]?.value)
  );

  return (
    <div className="bg-light p-3 rounded-3 border mb-3">
      <div className="row g-2 align-items-center">
        {/* Search */}
        {showSearch && (
          <div className="col-12 col-md">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-white border-end-0">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder={searchPlaceholder}
                value={filters.search || ''}
                onChange={(e) => handleFieldChange('search', e.target.value)}
              />
              {filters.search && (
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={() => handleFieldChange('search', '')}
                >
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Quick Type Filter */}
        {showType && (
          <div className="col-6 col-md-auto">
            <select
              className="form-select form-select-sm"
              value={filters.type || 'all'}
              onChange={(e) => handleFieldChange('type', e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="credit">Credit (Given)</option>
              <option value="payment">Payment (Received)</option>
            </select>
          </div>
        )}

        {/* Quick Status Filter */}
        {showStatus && (
          <div className="col-6 col-md-auto">
            <select
              className="form-select form-select-sm"
              value={filters.status || 'all'}
              onChange={(e) => handleFieldChange('status', e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="disputed">Disputed</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        )}

        {/* Quick Sort */}
        {showSort && sortOptions.length > 0 && (
          <div className="col-6 col-md-auto">
            <select
              className="form-select form-select-sm"
              value={filters.sortBy || sortOptions[0]?.value}
              onChange={(e) => handleFieldChange('sortBy', e.target.value)}
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Toggle Advanced Filters Button */}
        {(showDateRange || showMinBalance) && (
          <div className="col-6 col-md-auto">
            <button
              type="button"
              className={`btn btn-sm w-100 ${showAdvanced ? 'btn-secondary text-white' : 'btn-outline-secondary'}`}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <i className="bi bi-sliders me-1"></i> More Filters
            </button>
          </div>
        )}

        {/* Reset button */}
        {hasActiveFilters && (
          <div className="col-12 col-md-auto">
            <button
              type="button"
              className="btn btn-outline-danger btn-sm w-100"
              onClick={handleReset}
              title="Reset all filters"
            >
              <i className="bi bi-arrow-counterclockwise me-1"></i> Reset
            </button>
          </div>
        )}
      </div>

      {/* Advanced Filter Collapse */}
      {showAdvanced && (showDateRange || showMinBalance) && (
        <div className="row g-2 mt-2 pt-2 border-top">
          {showDateRange && (
            <>
              <div className="col-12 col-sm-6 col-md-3">
                <label className="form-label small text-muted mb-1">From Date</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={filters.startDate || ''}
                  onChange={(e) => handleFieldChange('startDate', e.target.value)}
                />
              </div>
              <div className="col-12 col-sm-6 col-md-3">
                <label className="form-label small text-muted mb-1">To Date</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={filters.endDate || ''}
                  onChange={(e) => handleFieldChange('endDate', e.target.value)}
                />
              </div>
            </>
          )}

          {showMinBalance && (
            <div className="col-12 col-sm-6 col-md-3">
              <label className="form-label small text-muted mb-1">Min Outstanding (₹)</label>
              <input
                type="number"
                min="0"
                step="50"
                placeholder="e.g. 500"
                className="form-control form-control-sm"
                value={filters.minBalanceRupees || ''}
                onChange={(e) => {
                  const rs = e.target.value;
                  const paise = rs ? Math.round(Number(rs) * 100) : '';
                  onChange({ ...filters, minBalanceRupees: rs, minBalance: paise });
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterBar;

