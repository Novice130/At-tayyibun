export interface ApiError {
  message: string;
  statusCode: number;
}

const API_URL = '/api';
console.log('API_URL configured as:', API_URL);

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw {
      message: data.message || 'Something went wrong',
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
