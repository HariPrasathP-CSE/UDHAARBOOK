import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Unauthorized = () => {
  const { user } = useAuth();

  const getDashboardPath = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'shopkeeper':
        return '/shopkeeper/dashboard';
      case 'customer':
        return '/customer/dashboard';
      case 'admin':
        return '/admin/dashboard';
      default:
        return '/login';
    }
  };

  return (
    <div className="container py-5 d-flex justify-content-center align-items-center flex-grow-1">
      <div className="card border-0 shadow text-center p-4 p-md-5" style={{ maxWidth: '480px' }}>
        <div className="mb-3 text-danger">
          <i className="bi bi-shield-slash fs-1"></i>
        </div>
        <h3 className="fw-bold text-dark mb-2">Access Denied (403)</h3>
        <p className="text-muted small mb-4">
          You do not have the required permissions to access this page. Your account role is{' '}
          <span className="badge bg-secondary text-uppercase">{user?.role || 'Guest'}</span>.
        </p>
        <div>
          <Link to={getDashboardPath()} className="btn btn-primary px-4 fw-semibold">
            Return to My Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;

