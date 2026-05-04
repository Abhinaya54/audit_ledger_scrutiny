export interface WorkbookEntityConfig {
  entity_name: string;
  financial_year: string;
  ledger_type: string;
  functional_currency: string;
  reporting_currency?: string | null;
  company_code?: string | null;
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
  engagement_type?: string | null;
  status: 'In Progress' | 'Draft' | 'Completed';
  last_modified: string;
  risk_score: number;
  has_entity_config?: boolean;
  entity_config?: WorkbookEntityConfig | null;
  latest_summary?: WorkbookSummary | null;
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
