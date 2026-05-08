import { apiClient } from './client';

export interface NLQueryRequest {
  query: string;
  parser_type?: 'auto' | 'deterministic' | 'llm';
  entity_thresholds?: Record<string, number>;
}

export interface NLQueryResponse {
  matched_controls: string[];
  filters: Record<string, any>;
  intent: string;
  assumptions: string[];
  rationale: string;
  warnings: string[];
  parser_used: 'deterministic' | 'llm';
}

export const nlQueryApi = {
  parse: async (query: string, parserType: 'auto' | 'deterministic' | 'llm' = 'auto', entityThresholds?: Record<string, number>): Promise<NLQueryResponse> => {
    return apiClient.post('/api/nl-query/parse', {
      query,
      parser_type: parserType,
      entity_thresholds: entityThresholds,
    });
  },
};
