export interface ApiError {
  message: string;
  statusCode: number;
}

const API_URL = '/api';

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers,
    });
  } catch {
    throw { message: 'Cannot connect to server. Please ensure the API is running.', statusCode: 503 } as ApiError;
  }

  const contentType = response.headers.get('content-type') || '';
  let data: any = null;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    if (!response.ok) {
      const isHtml = text.trim().toLowerCase().startsWith('<!doctype html>') || text.toLowerCase().includes('<html');
      const message = isHtml 
        ? `Network or firewall error (${response.status}). The request was blocked by Cloudflare or a proxy.` 
        : (text.slice(0, 200) || `Server error ${response.status}`);
      
      throw { message, statusCode: response.status } as ApiError;
    }
    return text;
  }

  if (!response.ok) {
    let message: string;
    if (typeof data === 'string' && data.trim()) {
      message = data.trim();
    } else if (Array.isArray(data?.message)) {
      message = data.message.join(', ');
    } else if (typeof data?.message === 'string' && data.message.trim()) {
      message = data.message.trim();
    } else if (response.status === 429) {
      message = 'Too many requests. Please wait a moment and try again.';
    } else {
      message = `Server error ${response.status}`;
    }

    throw {
      message,
      statusCode: response.status,
    } as ApiError;
  }

  return data;
}

export const api = {
  get: (endpoint: string) => fetchWithAuth(endpoint),
  post: (endpoint: string, body: any = {}) => 
    fetchWithAuth(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint: string, body: any = {}) => 
    fetchWithAuth(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (endpoint: string, body: any = {}) => 
    fetchWithAuth(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (endpoint: string) => 
    fetchWithAuth(endpoint, { method: 'DELETE' }),
};
