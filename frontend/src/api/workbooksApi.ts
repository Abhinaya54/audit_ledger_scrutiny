import { apiClient } from './client';
import { authApi } from './authApi';

export interface Workbook {
  id: string;
  client_name: string;
  financial_year: string;
  functional_currency: string;
  engagement_type?: string;
  status?: string;
  risk_score?: number;
  has_entity_config?: boolean;
  entity_config?: Record<string, any>;
  column_mappings?: Record<string, string>;
  review_rows?: any[];
  analysis_summary?: Record<string, any>;
  category_counts?: any[];
  last_modified?: string;
}

function _token(): string {
  const token = authApi.getToken();
  if (!token) throw new Error('Not authenticated');
  return token;
}
export const workbooksApi = {
  // List all workbooks for the current user
  listWorkbooks: async (): Promise<Workbook[]> => {
    return apiClient.get('/api/workbooks', _token());
  },

  // Create a new workbook
  createWorkbook: async (data: {
    client_name: string;
    financial_year: string;
    functional_currency: string;
    engagement_type: string;
  }): Promise<Workbook> => {
    return apiClient.post('/api/workbooks', data, _token());
  },

  // Get a specific workbook
  getWorkbook: async (workbookId: string): Promise<Workbook> => {
    return apiClient.get(`/api/workbooks/${workbookId}`, _token());
  },

  // Save entity configuration
  saveEntityConfig: async (workbookId: string, config: Record<string, any>): Promise<Workbook> => {
    return apiClient.put(`/api/workbooks/${workbookId}/entity-config`, config, _token());
  },

  // Ingest a file for analysis
  ingestFile: async (
    workbookId: string,
    file: File,
    useMl: boolean = true,
    contamination: number = 0.05
  ): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('use_ml', String(useMl));
    formData.append('contamination', String(contamination));

    return apiClient.postFormData(`/api/workbooks/${workbookId}/ingest`, formData, _token());
  },
};

