/**
 * AUTH STORE (Zustand)
 *
 * Holds: user, tokens, loading, error
 * Actions: login, register, logout, updateUser, loadUser
 *
 * Zustand is a tiny (~1kb) state manager.
 * We use the "set" pattern – no reducers needed.
 * State is persisted in localStorage via manual read on init.
 */

import { create } from 'zustand';
import { authAPI, saveTokens, clearTokens } from '../services/api';

const useAuthStore = create((set, get) => ({
  // ── State ──────────────────────────────────────────────────────────────────
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  isAuthenticated: !!localStorage.getItem('accessToken'),
  isLoading: false,
  error: null,

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * login – send credentials, save tokens + user to localStorage
   */
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authAPI.login({ email, password });
      const { user, accessToken, refreshToken } = data.data;

      saveTokens(accessToken, refreshToken);
      localStorage.setItem('user', JSON.stringify(user));

      set({ user, isAuthenticated: true, isLoading: false });
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed. Please try again.';
      set({ error: message, isLoading: false });
      return { success: false, message };
    }
  },

  /**
   * register – create account, auto-login on success
   */
  register: async (firstName, lastName, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authAPI.register({ firstName, lastName, email, password });
      const { user, accessToken, refreshToken } = data.data;

      saveTokens(accessToken, refreshToken);
      localStorage.setItem('user', JSON.stringify(user));

      set({ user, isAuthenticated: true, isLoading: false });
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed.';
      set({ error: message, isLoading: false });
      return { success: false, message };
    }
  },

  /**
   * logout – call API (invalidates refresh token) then clear local state
   */
  logout: async () => {
    try {
      await authAPI.logout();
    } catch {
      // If API call fails, still clear local state
    }
    clearTokens();
    set({ user: null, isAuthenticated: false, error: null });
  },

  /**
   * loadUser – fetch fresh user data from /me endpoint.
   * Called on app mount to ensure stored user is still valid.
   */
  loadUser: async () => {
    if (!localStorage.getItem('accessToken')) return;
    set({ isLoading: true });
    try {
      const { data } = await authAPI.getMe();
      const user = data.data.user;
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      // Token invalid or expired – clear everything
      clearTokens();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  /**
   * updateUser – optimistically update local user state
   * after a successful profile update.
   */
  updateUser: (updates) => {
    const updated = { ...get().user, ...updates };
    localStorage.setItem('user', JSON.stringify(updated));
    set({ user: updated });
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;