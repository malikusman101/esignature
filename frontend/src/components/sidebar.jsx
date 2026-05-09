/**
 * SIDEBAR COMPONENT
 *
 * Persistent left-side navigation for authenticated pages.
 * Shows: logo, nav links, user info, logout button.
 *
 * Uses NavLink from react-router-dom which automatically
 * adds the "active" class when the link matches the current URL.
 */

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, PlusCircle, User, LogOut, Pen
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { to: '/dashboard',    label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/documents',    label: 'Documents',  icon: FileText },
  { to: '/documents/new', label: 'New Document', icon: PlusCircle },
  { to: '/profile',      label: 'Profile',    icon: User },
];

const styles = {
  sidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: 'var(--sidebar-w)',
    height: '100vh',
    background: 'var(--primary)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
    padding: '0',
    overflowY: 'auto',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '24px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    color: '#fff',
  },
  logoIcon: {
    width: 34,
    height: 34,
    background: 'var(--accent)',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logoText: {
    fontSize: 18,
    fontWeight: 700,
    fontFamily: 'var(--font-display)',
    color: '#fff',
    letterSpacing: '-0.3px',
  },
  nav: {
    flex: 1,
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 8,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    fontWeight: 500,
    transition: 'all 0.15s',
    textDecoration: 'none',
  },
  navLinkActive: {
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
  },
  footer: {
    padding: '16px 12px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    marginBottom: 8,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: 'var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 700,
    fontSize: 13,
    flexShrink: 0,
  },
  userName: { fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.3 },
  userEmail: { fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1 },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '9px 12px',
    borderRadius: 8,
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
};

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()
    : '?';

  return (
    <aside style={styles.sidebar}>
      {/* Logo */}
      <div style={styles.logo}>
        <div style={styles.logoIcon}>
          <Pen size={16} color="#fff" strokeWidth={2.5} />
        </div>
        <span style={styles.logoText}>eSign</span>
      </div>

      {/* Navigation */}
      <nav style={styles.nav}>
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
          >
            <Icon size={17} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div style={styles.footer}>
        {user && (
          <div style={styles.userInfo}>
            <div style={styles.avatar}>{initials}</div>
            <div>
              <div style={styles.userName}>{user.firstName} {user.lastName}</div>
              <div style={styles.userEmail}>{user.plan} plan</div>
            </div>
          </div>
        )}
        <button
          style={styles.logoutBtn}
          onClick={handleLogout}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; e.currentTarget.style.background = 'transparent'; }}
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
}