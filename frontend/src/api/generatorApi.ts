import { apiFetch, apiDownload } from './client';
import type { GenerateRequest, GenerateResponse } from '../types/generator';

export async function generateData(req: GenerateRequest): Promise<GenerateResponse> {
  return apiFetch<GenerateResponse>('/api/generator/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
}

export async function downloadCsv(token: string): Promise<Blob> {
  return apiDownload(`/api/generator/download/${token}`);
}
