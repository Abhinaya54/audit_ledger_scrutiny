const API_BASE = import.meta.env.VITE_API_URL || '/api';

function normalizeUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const base = normalizeUrl(API_BASE);
  const response = await fetch(`${base}${path}`, {
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Request failed');
  }
  return response.json();
}

export async function apiDownload(path: string, options?: RequestInit): Promise<Blob> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Download failed');
  }
  return response.blob();
}
