import type { NLQueryResponse } from '@/api/nlQueryApi';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type WorkspaceTab = 'overview' | 'investigation' | 'documentation';

export interface ControlRow {
  controlName: string;
  triggeredTransactions: number;
  exposure: number;
  status: 'Active' | 'Inactive';
}

export interface InvestigationFilters {
  ledgerType: string;
  accountSeries: string;
  financialYear: string;
  quarter: string;
  customThreshold: string;
  amountPreset: '' | 'above500k' | 'top10expenses';
  keyword: string;
  voucherTypes: string[];
  currencies: string[];
}

export interface InvestigationWorkspaceState {
  id: string;
  label: string;
  draftFilters: InvestigationFilters;
  appliedFilters: InvestigationFilters;
  queryInput: string;
  appliedQuery: string;
  nlResult: NLQueryResponse | null;
  nlError: string | null;
  isLoading: boolean;
  hasRequested: boolean;
}
