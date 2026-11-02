import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
        return '/';
    }
  };

  const getRoleBadgeClass = () => {
    switch (user?.role) {
      case 'shopkeeper':
        return 'bg-success';
      case 'customer':
        return 'bg-info text-dark';
      case 'admin':
        return 'bg-purple bg-opacity-75 text-white';
      default:
        return 'bg-secondary';
    }
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
      <div className="container">
        <Link className="navbar-brand d-flex align-items-center gap-2" to={getDashboardPath()}>
          <i className="bi bi-book-half fs-4 text-warning"></i>
          <span>UdhaarBook</span>
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-indicator"><span className="navbar-toggler-icon"></span></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            {isAuthenticated && (
              <>
                <li className="nav-item">
                  <Link className="nav-link active" to={getDashboardPath()}>
                    <i className="bi bi-speedometer2 me-1"></i> Dashboard
                  </Link>
                </li>
                {user?.role === 'shopkeeper' && (
                  <>
                    <li className="nav-item">
                      <Link className="nav-link" to="/shopkeeper/dashboard">
                        <i className="bi bi-people me-1"></i> Customers
                      </Link>
                    </li>
                    <li className="nav-item">
                      <span className="nav-link text-white-50">
                        <i className="bi bi-journal-text me-1"></i> Credit Ledger
                      </span>
                    </li>
                  </>
                )}
                {user?.role === 'customer' && (
                  <>
                    <li className="nav-item">
                      <Link className="nav-link" to="/customer/shops">
                        <i className="bi bi-shop me-1"></i> My Connected Stores
                      </Link>
                    </li>
                    <li className="nav-item">
                      <span className="nav-link text-white-50">
                        <i className="bi bi-wallet2 me-1"></i> My Khata
                      </span>
                    </li>
                  </>
                )}
                {user?.role === 'admin' && (
                  <>
                    <li className="nav-item">
                      <Link className="nav-link" to="/admin/dashboard">
                        <i className="bi bi-shield-lock me-1"></i> Admin Console
                      </Link>
                    </li>
                  </>
                )}
                <li className="nav-item">
                  <Link className="nav-link" to="/disputes">
                    <i className="bi bi-shield-exclamation me-1"></i> Disputes
                  </Link>
                </li>
              </>
            )}
          </ul>

          <div className="d-flex align-items-center gap-3">
            {isAuthenticated ? (
              <div className="d-flex align-items-center gap-3">
                <NotificationBell />
                <div className="text-end d-none d-sm-block">
                  <div className="text-light fw-semibold small">{user.name}</div>
                  <span className={`badge rounded-pill ${getRoleBadgeClass()} role-badge`}>
                    {user.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1"
                >
                  <i className="bi bi-box-arrow-right"></i>
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="d-flex gap-2">
                <Link to="/login" className="btn btn-outline-light btn-sm">
                  Login
                </Link>
                <Link to="/register" className="btn btn-warning btn-sm fw-semibold">
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

