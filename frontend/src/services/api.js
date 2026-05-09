/**
 * API SERVICE
 *
 * Single axios instance used throughout the app.
 *
 * Request interceptor  → injects Bearer token from localStorage
 * Response interceptor → on 401, attempts to refresh the access token
 *                        using the stored refresh token, then retries
 *                        the original request.  If refresh also fails,
 *                        logs the user out.
 */

import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const getTokens = () => ({
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
});

const saveTokens = (accessToken, refreshToken) => {
  localStorage.setItem('accessToken', accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
};

const clearTokens = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
};

// ── Request interceptor ────────────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const { accessToken } = getTokens();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor ───────────────────────────────────────────────────────
let isRefreshing = false;
let failedQueue = []; // requests waiting for the new token

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh on 401, and only once per request (_retry flag)
    if (error.response?.status === 401 && !originalRequest._retry) {
      const { refreshToken } = getTokens();

      if (!refreshToken) {
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until the refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const { accessToken: newAccess, refreshToken: newRefresh } = data.data;

        saveTokens(newAccess, newRefresh);
        api.defaults.headers.common.Authorization = `Bearer ${newAccess}`;
        processQueue(null, newAccess);

        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  updateMe: (data) => api.put('/auth/me', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  verifyEmail: (token) => api.get(`/auth/verify/${token}`),
};

// ── Documents ─────────────────────────────────────────────────────────────────
export const documentsAPI = {
  upload: (formData) => api.post('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getAll: (params) => api.get('/documents', { params }),
  getOne: (id) => api.get(`/documents/${id}`),
  update: (id, data) => api.put(`/documents/${id}`, data),
  send: (id, data) => api.post(`/documents/${id}/send`, data),
  remind: (id) => api.post(`/documents/${id}/remind`),
  void: (id, reason) => api.post(`/documents/${id}/void`, { reason }),
  download: (id) => api.get(`/documents/${id}/download`, { responseType: 'blob' }),
  downloadAudit: (id) => api.get(`/documents/${id}/audit`, { responseType: 'blob' }),
  getStats: () => api.get('/documents/stats'),
};

// ── Signing (public) ──────────────────────────────────────────────────────────
export const signingAPI = {
  getSigningData: (token) => api.get(`/sign/${token}`),
  submit: (token, fields) => api.post(`/sign/${token}/submit`, { fields }),
  decline: (token, reason) => api.post(`/sign/${token}/decline`, { reason }),
  getFileUrl: (token) => `${BASE_URL}/sign/${token}/file`,
};

export { saveTokens, clearTokens };
export default api;