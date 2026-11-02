import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'shopkeeper' // Default choice
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await register(formData);
      const user = response.user;

      // Navigate directly to role-appropriate dashboard
      if (user.role === 'shopkeeper') {
        navigate('/shopkeeper/dashboard', { replace: true });
      } else if (user.role === 'customer') {
        navigate('/customer/dashboard', { replace: true });
      } else if (user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Registration failed. Please check your details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container py-5 d-flex justify-content-center align-items-center flex-grow-1">
      <div className="card auth-card border-0 shadow">
        <div className="card-body p-4 p-sm-5">
          <div className="text-center mb-4">
            <div className="d-inline-flex p-3 rounded-circle bg-success bg-opacity-10 text-success mb-3">
              <i className="bi bi-person-plus fs-2"></i>
            </div>
            <h3 className="fw-bold text-dark">Register for UdhaarBook</h3>
            <p className="text-muted small">Choose your role to get started with the digital credit ledger</p>
          </div>

          {error && (
            <div className="alert alert-danger py-2 small d-flex align-items-center gap-2" role="alert">
              <i className="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label small fw-semibold text-secondary">Full Name</label>
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0">
                  <i className="bi bi-person text-muted"></i>
                </span>
                <input
                  type="text"
                  name="name"
                  className="form-control bg-light border-start-0"
                  placeholder="e.g. Ramesh Kumar"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-semibold text-secondary">Email Address</label>
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0">
                  <i className="bi bi-envelope text-muted"></i>
                </span>
                <input
                  type="email"
                  name="email"
                  className="form-control bg-light border-start-0"
                  placeholder="ramesh@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-semibold text-secondary">Phone Number</label>
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0">
                  <i className="bi bi-phone text-muted"></i>
                </span>
                <input
                  type="tel"
                  name="phone"
                  className="form-control bg-light border-start-0"
                  placeholder="9876543210"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-semibold text-secondary">Password</label>
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0">
                  <i className="bi bi-lock text-muted"></i>
                </span>
                <input
                  type="password"
                  name="password"
                  className="form-control bg-light border-start-0"
                  placeholder="At least 6 characters"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label small fw-semibold text-secondary d-block">Account Role</label>
              <div className="row g-2">
                <div className="col-4">
                  <input
                    type="radio"
                    className="btn-check"
                    name="role"
                    id="role-shopkeeper"
                    value="shopkeeper"
                    checked={formData.role === 'shopkeeper'}
                    onChange={handleChange}
                  />
                  <label className="btn btn-outline-success w-100 d-flex flex-column align-items-center py-2" htmlFor="role-shopkeeper">
                    <i className="bi bi-shop fs-5 mb-1"></i>
                    <span className="small fw-semibold">Shopkeeper</span>
                  </label>
                </div>

                <div className="col-4">
                  <input
                    type="radio"
                    className="btn-check"
                    name="role"
                    id="role-customer"
                    value="customer"
                    checked={formData.role === 'customer'}
                    onChange={handleChange}
                  />
                  <label className="btn btn-outline-info w-100 d-flex flex-column align-items-center py-2 text-dark" htmlFor="role-customer">
                    <i className="bi bi-person-check fs-5 mb-1"></i>
                    <span className="small fw-semibold">Customer</span>
                  </label>
                </div>

                <div className="col-4">
                  <input
                    type="radio"
                    className="btn-check"
                    name="role"
                    id="role-admin"
                    value="admin"
                    checked={formData.role === 'admin'}
                    onChange={handleChange}
                  />
                  <label className="btn btn-outline-secondary w-100 d-flex flex-column align-items-center py-2" htmlFor="role-admin">
                    <i className="bi bi-shield-lock fs-5 mb-1"></i>
                    <span className="small fw-semibold">Admin</span>
                  </label>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-success w-100 py-2 fw-semibold shadow-sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Creating Account...
                </>
              ) : (
                'Register & Continue'
              )}
            </button>
          </form>

          <div className="mt-4 pt-3 border-top text-center small text-muted">
            Already have an account?{' '}
            <Link to="/login" className="text-primary text-decoration-none fw-semibold">
              Sign in here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;

