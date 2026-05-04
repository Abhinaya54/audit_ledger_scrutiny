export interface WorkbookEntityConfig {
  entity_name: string;
  financial_year: string;
  ledger_type: string;
  functional_currency: string;
  reporting_currency?: string;
  company_code?: string;
  header_row?: number;
  column_mappings?: Record<string, string>;
}

export interface WorkbookSummary {
  total_entries: number;
  rule_flagged: number;
  ml_flagged: number;
  total_flagged: number;
  pct_flagged: number;
}

export interface Workbook {
  id: string;
  client_name: string;
  financial_year: string;
  functional_currency: string;
  engagement_type?: string;
  status: 'In Progress' | 'Draft' | 'Completed';
  last_modified: string;
  risk_score: number;
  has_entity_config?: boolean;
  entity_config?: WorkbookEntityConfig;
  column_mappings?: Record<string, string>;
  review_rows?: any[];
  analysis_summary?: WorkbookSummary;
  category_counts?: any[];
}

export interface CreateWorkbookPayload {
  client_name: string;
  financial_year: string;
  functional_currency: string;
  engagement_type?: string;
}

export interface SaveWorkbookEntityConfigPayload {
  entity_name: string;
  financial_year: string;
  ledger_type: string;
  functional_currency: string;
  reporting_currency?: string;
  company_code?: string;
}
