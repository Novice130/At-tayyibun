const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  token?: string;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}/api${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'API request failed');
  }

  return data;
}

// Auth
export const api = {
  auth: {
    signup: (data: any) => request('/auth/signup', { method: 'POST', body: data }),
    logout: (token: string) => request('/auth/logout', { method: 'POST', token }),
  },

  profiles: {
    browse: (token: string, params?: any) => request(`/profiles?${new URLSearchParams(params)}`, { token }),
    getPublic: (publicId: string) => request(`/profiles/${publicId}`),
    getMe: (token: string) => request('/profiles/me', { token }),
    create: (token: string, data: any) => request('/profiles', { method: 'POST', body: data, token }),
    update: (token: string, data: any) => request('/profiles/me', { method: 'PUT', body: data, token }),
  },

  photos: {
    getAvatar: (token: string) => request('/photos/avatar', { method: 'POST', token }),
  },

  requests: {
    send: (token: string, data: any) => request('/requests', { method: 'POST', body: data, token }),
    getSent: (token: string) => request('/requests/sent', { token }),
    getReceived: (token: string) => request('/requests/received', { token }),
    respond: (token: string, id: string, data: any) => request(`/requests/${id}/respond`, { method: 'PUT', body: data, token }),
  },

  skip: {
    create: (token: string, data: any) => request('/skip', { method: 'POST', body: data, token }),
  },

  messages: {
    getConversations: (token: string) => request('/messages/conversations', { token }),
    get: (token: string, publicId: string) => request(`/messages/${publicId}`, { token }),
    send: (token: string, publicId: string, content: string) => request(`/messages/${publicId}`, { method: 'POST', body: { content }, token }),
  },

  ads: {
    get: (token: string) => request('/ads', { token }),
  },

  coupons: {
    get: (token: string) => request('/coupons', { token }),
  },

  admin: {
    getStats: (token: string) => request('/admin/stats', { token }),
    getUsers: (token: string, params?: any) => request(`/admin/users?${new URLSearchParams(params)}`, { token }),
  },
};
