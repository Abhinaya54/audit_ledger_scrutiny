import { apiFetch, apiDownload } from './client';
import type { ScrutinyResponse } from '../types/scrutiny';

export async function analyzeFile(
  file: File,
  useMl: boolean,
  contamination: number,
): Promise<ScrutinyResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('use_ml', String(useMl));
  formData.append('contamination', String(contamination));

  return apiFetch<ScrutinyResponse>('/api/scrutiny/analyze', {
    method: 'POST',
    body: formData,
  });
}

export async function exportReport(
  file: File,
  _useMl: boolean,
  contamination: number,
): Promise<Blob> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('use_ml', 'false');   // skip ML for export — avoids OOM on free tier
  formData.append('contamination', String(contamination));

  return apiDownload('/api/scrutiny/export', {
    method: 'POST',
    body: formData,
  });
}
