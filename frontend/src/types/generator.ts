export interface GenerateRequest {
  start_date: string;
  end_date: string;
  num_rows: number;
  seed: number;
  inject_r1: boolean;
  inject_r2: boolean;
  inject_r3: boolean;
  inject_r4: boolean;
  inject_r5: boolean;
  inject_r6: boolean;
}

export interface GenerateStats {
  total_rows: number;
  amount_mean: number;
  round_amounts: number;
}

export interface GenerateResponse {
  stats: GenerateStats;
  preview: Record<string, unknown>[];
  download_token: string;
}
