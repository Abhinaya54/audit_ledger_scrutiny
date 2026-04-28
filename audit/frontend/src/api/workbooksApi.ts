import { apiFetch } from './client';
import type {
  CreateWorkbookPayload,
  SaveWorkbookEntityConfigPayload,
  Workbook,
} from '../types/workbook';
import type { ScrutinyResponse } from '../types/scrutiny';

export async function getWorkbooks(token: string): Promise<Workbook[]> {
  return apiFetch<Workbook[]>('/api/workbooks', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createWorkbook(token: string, payload: CreateWorkbookPayload): Promise<Workbook> {
  return apiFetch<Workbook>('/api/workbooks', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function getWorkbookById(token: string, workbookId: string): Promise<Workbook> {
  return apiFetch<Workbook>(`/api/workbooks/${workbookId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function saveWorkbookEntityConfig(
  token: string,
  workbookId: string,
  payload: SaveWorkbookEntityConfigPayload,
): Promise<Workbook> {
  return apiFetch<Workbook>(`/api/workbooks/${workbookId}/entity-config`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function ingestWorkbook(
  token: string,
  workbookId: string,
  file: File,
  useMl: boolean,
  contamination: number,
): Promise<ScrutinyResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('use_ml', String(useMl));
  formData.append('contamination', String(contamination));

  return apiFetch<ScrutinyResponse>(`/api/workbooks/${workbookId}/ingest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
}
