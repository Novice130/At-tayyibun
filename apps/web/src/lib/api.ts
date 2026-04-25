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
      throw { message: text.slice(0, 200) || `Server error ${response.status}`, statusCode: response.status } as ApiError;
    }
    return text;
  }

  if (!response.ok) {
    throw {
      message: Array.isArray(data?.message) ? data.message.join(', ') : (data?.message || `Server error ${response.status}`),
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
