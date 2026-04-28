const API_BASE_URL = '/api';

function _headers(token?: string, contentType = true): Record<string, string> {
  const h: Record<string, string> = {};
  if (contentType) h['Content-Type'] = 'application/json';
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function _parseError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body.detail) return body.detail;
    if (body.message) return body.message;
    return JSON.stringify(body);
  } catch {
    try {
      const text = await response.text();
      return text || `API error: ${response.status}`;
    } catch {
      return `API error: ${response.status}`;
    }
  }
}

export const apiClient = {
  get: async (endpoint: string, token?: string) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: _headers(token, false),
    });
    if (!response.ok) throw new Error(await _parseError(response));
    return response.json();
  },

  post: async (endpoint: string, data?: any, token?: string) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: _headers(token),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(await _parseError(response));
    return response.json();
  },

  postFormData: async (endpoint: string, formData: FormData, token?: string) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: _headers(token, false),
      body: formData,
    });
    if (!response.ok) throw new Error(await _parseError(response));
    return response.json();
  },

  postFormDataBlob: async (endpoint: string, formData: FormData, token?: string) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: _headers(token, false),
      body: formData,
    });
    if (!response.ok) throw new Error(await _parseError(response));
    return response.blob();
  },

  put: async (endpoint: string, data?: any, token?: string) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: _headers(token),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(await _parseError(response));
    return response.json();
  },

  delete: async (endpoint: string, token?: string) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: _headers(token, false),
    });
    if (!response.ok) throw new Error(await _parseError(response));
    return response.json();
  },
};
