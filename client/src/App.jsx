import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Unauthorized from './pages/Unauthorized';
import ShopkeeperDashboard from './pages/ShopkeeperDashboard';
import ShopkeeperLedger from './pages/ShopkeeperLedger';
import CustomerDashboard from './pages/CustomerDashboard';
import CustomerShops from './pages/CustomerShops';
import CustomerLedger from './pages/CustomerLedger';
import DisputesList from './pages/DisputesList';
import DisputeThread from './pages/DisputeThread';
import AdminDashboard from './pages/AdminDashboard';

// Root redirect based on authentication state and role
const HomeRedirect = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center flex-grow-1 py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  switch (user.role) {
    case 'shopkeeper':
      return <Navigate to="/shopkeeper/dashboard" replace />;
    case 'customer':
      return <Navigate to="/customer/dashboard" replace />;
    case 'admin':
      return <Navigate to="/admin/dashboard" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="d-flex flex-column min-vh-100">
          <Navbar />

          <main className="flex-grow-1 d-flex flex-column">
            <Routes>
              {/* Root redirect */}
              <Route path="/" element={<HomeRedirect />} />

              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/unauthorized" element={<Unauthorized />} />

              {/* Protected Shopkeeper routes */}
              <Route element={<ProtectedRoute allowedRoles={['shopkeeper']} />}>
                <Route path="/shopkeeper/dashboard" element={<ShopkeeperDashboard />} />
                <Route path="/shopkeeper/accounts/:accountId/ledger" element={<ShopkeeperLedger />} />
              </Route>

              {/* Protected Customer routes */}
              <Route element={<ProtectedRoute allowedRoles={['customer']} />}>
                <Route path="/customer/dashboard" element={<CustomerDashboard />} />
                <Route path="/customer/shops" element={<CustomerShops />} />
                <Route path="/customer/accounts/:accountId/ledger" element={<CustomerLedger />} />
              </Route>

              {/* Protected Admin routes */}
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
              </Route>

              {/* Shared Protected routes for all authenticated roles */}
              <Route element={<ProtectedRoute allowedRoles={['shopkeeper', 'customer', 'admin']} />}>
                <Route path="/disputes" element={<DisputesList />} />
                <Route path="/disputes/:id" element={<DisputeThread />} />
              </Route>

              {/* Fallback route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <footer className="bg-white border-top py-3 text-center text-muted small mt-auto">
            <div className="container">
              <span>UdhaarBook &copy; {new Date().getFullYear()} &middot; Digital Credit Ledger for Small Shops &middot; Two-Party Transparency</span>
            </div>
          </footer>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

