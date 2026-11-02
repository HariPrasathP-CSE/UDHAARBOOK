import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead
} from '../api/notificationApi';

const NotificationBell = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const fetchUnread = async () => {
    try {
      const data = await getUnreadNotificationCount();
      setUnreadCount(data.count || 0);
    } catch (err) {
      // Ignore background notification polling errors
    }
  };

  const fetchList = async () => {
    try {
      setLoading(true);
      const data = await getNotifications({ limit: 15 });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, []);

  const toggleDropdown = () => {
    if (!isOpen) {
      fetchList();
    }
    setIsOpen(!isOpen);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.read) {
        await markNotificationRead(notif._id);
        setNotifications((prev) =>
          prev.map((n) => (n._id === notif._id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      setIsOpen(false);

      // Route to destination
      if (notif.data?.disputeId) {
        navigate(`/disputes/${notif.data.disputeId}`);
      } else if (notif.data?.accountId) {
        navigate(`/customer/accounts/${notif.data.accountId}/ledger`);
      }
    } catch (err) {
      console.error('Error opening notification:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  return (
    <div className="position-relative" ref={dropdownRef}>
      <button
        type="button"
        className="btn btn-dark position-relative p-2 rounded-circle border-0 text-light"
        onClick={toggleDropdown}
        title="Notifications"
        style={{ width: '40px', height: '40px' }}
      >
        <i className="bi bi-bell fs-5"></i>
        {unreadCount > 0 && (
          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-dark">
            {unreadCount > 99 ? '99+' : unreadCount}
            <span className="visually-hidden">unread notifications</span>
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="dropdown-menu dropdown-menu-end show shadow-lg border-0 p-0"
          style={{
            position: 'absolute',
            top: '48px',
            right: 0,
            width: '340px',
            maxWidth: '90vw',
            zIndex: 1050,
            borderRadius: '0.75rem',
            overflow: 'hidden'
          }}
        >
          <div className="p-3 bg-dark text-white d-flex justify-content-between align-items-center">
            <span className="fw-bold small">
              <i className="bi bi-bell-fill me-2 text-warning"></i>Notifications
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                className="btn btn-link btn-sm text-white-50 text-decoration-none p-0"
                style={{ fontSize: '0.75rem' }}
                onClick={handleMarkAllRead}
              >
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {loading ? (
              <div className="text-center py-4 text-muted">
                <div className="spinner-border spinner-border-sm text-primary mb-2"></div>
                <div className="small">Loading alerts...</div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-4 text-muted">
                <i className="bi bi-bell-slash fs-3 d-block mb-1"></i>
                <span className="small">No notifications yet</span>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif._id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3 border-bottom d-flex align-items-start gap-2 ${
                    !notif.read ? 'bg-light' : 'bg-white'
                  }`}
                  style={{ cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                >
                  <div className="mt-1 flex-shrink-0">
                    {notif.type === 'new_entry' && <i className="bi bi-journal-plus text-primary fs-5"></i>}
                    {notif.type === 'entry_acknowledged' && <i className="bi bi-check-circle-fill text-success fs-5"></i>}
                    {notif.type === 'entry_disputed' && <i className="bi bi-exclamation-triangle-fill text-danger fs-5"></i>}
                    {notif.type === 'dispute_resolved' && <i className="bi bi-shield-check text-info fs-5"></i>}
                    {notif.type === 'dispute_escalated' && <i className="bi bi-arrow-up-circle-fill text-warning fs-5"></i>}
                    {notif.type === 'payment_reminder' && <i className="bi bi-clock-history text-warning fs-5"></i>}
                    {!['new_entry', 'entry_acknowledged', 'entry_disputed', 'dispute_resolved', 'dispute_escalated', 'payment_reminder'].includes(notif.type) && (
                      <i className="bi bi-bell text-secondary fs-5"></i>
                    )}
                  </div>
                  <div className="flex-grow-1 overflow-hidden">
                    <div className="d-flex justify-content-between align-items-baseline">
                      <span className={`small ${!notif.read ? 'fw-bold text-dark' : 'text-secondary'}`}>
                        {notif.title}
                      </span>
                      {!notif.read && (
                        <span className="badge bg-primary rounded-pill p-1" style={{ fontSize: '0.5rem' }}>&nbsp;</span>
                      )}
                    </div>
                    <p className="mb-1 text-muted small text-truncate" style={{ fontSize: '0.8rem' }}>
                      {notif.message}
                    </p>
                    <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                      {new Date(notif.createdAt).toLocaleDateString()} &middot; {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;

