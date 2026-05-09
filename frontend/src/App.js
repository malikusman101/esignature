/**
 * APP.JS – Root component
 *
 * Sets up React Router v6 routes:
 *  /               → redirect to dashboard or login
 *  /login          → LoginPage
 *  /register       → RegisterPage
 *  /dashboard      → DashboardPage           (protected)
 *  /documents      → DocumentsListPage       (protected)
 *  /documents/new  → UploadDocumentPage      (protected)
 *  /documents/:id  → DocumentDetailPage      (protected)
 *  /sign/:token    → SigningPage             (public)
 *  /verify-email/:token → VerifyEmailPage   (public)
 *  /forgot-password → ForgotPasswordPage    (public)
 *  /reset-password/:token → ResetPasswordPage (public)
 *  /profile        → ProfilePage            (protected)
 *
 * ProtectedRoute wraps authenticated pages.
 * On app mount we call loadUser() to rehydrate auth state.
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';

// Pages
import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';
import DashboardPage from './pages/Dashboard';
import DocumentsPage from './pages/Document';
import DocumentDetailPage from './pages/DocumentDetails';
import UploadDocumentPage from './pages/UploadDocument';
import SigningPage from './pages/Signing';
import ProfilePage from './pages/Profile';
// import ForgotPasswordPage from './pages/';
// import ResetPasswordPage from './pages/ResetPasswordPage';
// import VerifyEmailPage from './pages/VerifyEmailPage';

// ── ProtectedRoute ────────────────────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// ── PublicOnlyRoute ───────────────────────────────────────────────────────────
// Redirects authenticated users away from login/register
const PublicOnlyRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />;
};

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const loadUser = useAuthStore((s) => s.loadUser);

  // On mount: verify stored token is still valid
  useEffect(() => {
    loadUser();
  }, []); // eslint-disable-line

  return (
    <BrowserRouter>
      {/* Global toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1a1a2e',
            color: '#fff',
            borderRadius: '10px',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />

      <Routes>
        {/* Root */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Public only (redirect if logged in) */}
        <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />

        {/* Fully public */}
        <Route path="/sign/:token" element={<SigningPage />} />

        {/* Protected */}
        <Route path="/dashboard" element={<PublicOnlyRoute><DashboardPage /></PublicOnlyRoute>} />
        <Route path="/documents" element={<PublicOnlyRoute><DocumentsPage /></PublicOnlyRoute>} />
        <Route path="/documents/new" element={<PublicOnlyRoute><UploadDocumentPage /></PublicOnlyRoute>} />
        <Route path="/documents/:id" element={<PublicOnlyRoute><DocumentDetailPage /></PublicOnlyRoute>} />
        <Route path="/profile" element={<PublicOnlyRoute><ProfilePage /></PublicOnlyRoute>} />

        {/* 404 fallback */}
        <Route path="*" element={
          <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', fontFamily: 'sans-serif' }}>
            <h1 style={{ fontSize: 80, margin: 0, color: '#1a1a2e' }}>404</h1>
            <p style={{ color: '#666' }}>Page not found</p>
            <a href="/dashboard" style={{ color: '#1a1a2e', fontWeight: 600 }}>← Back to Dashboard</a>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}