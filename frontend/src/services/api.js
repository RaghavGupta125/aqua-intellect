import axios from 'axios';

// In dev, Vite proxies /api → localhost:4000
// In production (Vercel), VITE_API_URL must be set to your Render backend URL
const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ai_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally - redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('ai_token');
      localStorage.removeItem('ai_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Typed API helpers
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
};

export const dashboardApi = {
  summary: () => api.get('/dashboard/summary'),
  plantHealth: () => api.get('/dashboard/plant-health'),
  recentAlarms: () => api.get('/dashboard/recent-alarms'),
};

export const facilitiesApi = {
  list: () => api.get('/facilities'),
  get: (id) => api.get(`/facilities/${id}`),
  create: (data) => api.post('/facilities', data),
  update: (id, data) => api.put(`/facilities/${id}`, data),
  delete: (id) => api.delete(`/facilities/${id}`),
};

export const plantsApi = {
  list: (facilityId) => api.get('/plants', { params: facilityId ? { facility: facilityId } : {} }),
  get: (id) => api.get(`/plants/${id}`),
  create: (data) => api.post('/plants', data),
  update: (id, data) => api.put(`/plants/${id}`, data),
  updateThresholds: (id, data) => api.put(`/plants/${id}/thresholds`, data),
  delete: (id) => api.delete(`/plants/${id}`),
};

export const telemetryApi = {
  history: (plantId, hours = 24) => api.get(`/telemetry/${plantId}`, { params: { hours } }),
  latest: (plantId) => api.get(`/telemetry/${plantId}/latest`),
};

export const alarmsApi = {
  list: (params) => api.get('/alarms', { params }),
  activeCount: () => api.get('/alarms/active/count'),
  acknowledge: (id) => api.post(`/alarms/${id}/acknowledge`),
  resolve: (id) => api.post(`/alarms/${id}/resolve`),
};

export const reportsApi = {
  list: (plantId, period) => api.get(`/reports/${plantId}`, { params: period ? { period } : {} }),
  generate: (plantId, period) => api.post('/reports/generate', { plantId, period }),
  exportCsv: (plantId, hours) => `${BASE_URL}/reports/${plantId}/export/csv?hours=${hours}`,
};
