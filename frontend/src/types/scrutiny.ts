export interface ScrutinySummary {
  total_entries: number;
  rule_flagged: number;
  ml_flagged: number;
  total_flagged: number;
  pct_flagged: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface FlaggedRow {
  voucher_no: string;
  date: string;
  ledger_name: string;
  amount: number;
  dr_cr: string;
  narration: string;
  voucher_type: string;
  posted_by?: string;
  cost_center?: string;
  fiscal_year?: string;
  scrutiny_category: string;
  scrutiny_reason: string;
  ml_anomaly_flag?: number;
  ml_anomaly_score?: number;
}

export interface ScrutinyResponse {
  summary: ScrutinySummary;
  category_counts: CategoryCount[];
  flagged_rows: FlaggedRow[];
  review_rows: Record<string, unknown>[];
}

export type MappingStatus = 'mapped' | 'derived' | 'missing' | 'defaulted';

export interface CanonicalMapping {
  canonical: string;
  source_column: string | null;
  required: boolean;
  status: MappingStatus;
}

export interface SchemaPreviewResponse {
  original_columns: string[];
  normalised_columns: string[];
  mappings: CanonicalMapping[];
  missing_required: string[];
}

export type DisplayRow = FlaggedRow & { severity: 'High' | 'Medium' | 'Low' };
