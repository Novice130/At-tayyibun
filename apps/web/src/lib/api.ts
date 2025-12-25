import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  signup: (data: { email: string; password: string; phone: string; firstName: string; gender: string }) =>
    api.post('/auth/signup', data),
  
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  
  me: () => api.get('/auth/me'),
};

// Profiles API
export const profilesApi = {
  browse: (params: { ethnicity?: string; minAge?: number; maxAge?: number; sortBy?: string; order?: string; page?: number }) =>
    api.get('/profiles', { params }),
  
  getById: (publicId: string) =>
    api.get(`/profiles/${publicId}`),
  
  getMyProfile: () =>
    api.get('/profiles/me'),
  
  updateMyProfile: (data: Record<string, unknown>) =>
    api.put('/profiles/me', data),
};

// Requests API
export const requestsApi = {
  create: (targetPublicId: string) =>
    api.post('/requests', { targetPublicId }),
  
  getIncoming: () =>
    api.get('/requests/incoming'),
  
  getOutgoing: () =>
    api.get('/requests/outgoing'),
  
  respond: (requestId: string, approved: boolean, shareItems?: string[]) =>
    api.put(`/requests/${requestId}/respond`, { approved, shareItems }),
};

export default api;
