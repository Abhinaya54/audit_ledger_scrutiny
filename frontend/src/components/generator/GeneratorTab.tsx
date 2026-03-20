import { useState } from 'react';
import ConfigPanel from './ConfigPanel';
import AnomalyToggles from './AnomalyToggles';
import DataTable from '../common/DataTable';
import MetricCard from '../common/MetricCard';
import { generateData, downloadCsv } from '../../api/generatorApi';
import { formatCurrency, formatNumber, triggerDownload } from '../../utils/format';
import type { GenerateResponse } from '../../types/generator';

const FY_MAP: Record<string, [string, string]> = {
  'Apr 2024 - Mar 2025': ['2024-04-01', '2025-03-31'],
  'Apr 2023 - Mar 2024': ['2023-04-01', '2024-03-31'],
  'Jan 2024 - Dec 2024': ['2024-01-01', '2024-12-31'],
};

function resolveDates(fiscalYear: string, period: string): [string, string] {
  const [fyStart, fyEnd] = FY_MAP[fiscalYear];
  const year = parseInt(fyStart.slice(0, 4));

  const periodMap: Record<string, [string, string]> = {
    'Full Year': [fyStart, fyEnd],
    'Q1 (Apr-Jun)': [`${year}-04-01`, `${year}-06-30`],
    'Q2 (Jul-Sep)': [`${year}-07-01`, `${year}-09-30`],
    'Q3 (Oct-Dec)': [`${year}-10-01`, `${year}-12-31`],
    'Q4 (Jan-Mar)': [`${year + 1}-01-01`, `${year + 1}-03-31`],
  };

  return periodMap[period] || [fyStart, fyEnd];
}

export default function GeneratorTab() {
  const [fiscalYear, setFiscalYear] = useState('Apr 2024 - Mar 2025');
  const [period, setPeriod] = useState('Full Year');
  const [numRows, setNumRows] = useState(50000);
  const [seed, setSeed] = useState(42);
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    inject_r1: true,
    inject_r2: true,
    inject_r3: true,
    inject_r4: true,
    inject_r5: true,
    inject_r6: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<GenerateResponse | null>(null);

  const handleToggle = (key: string, value: boolean) => {
    setToggles((prev) => ({ ...prev, [key]: value }));
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const [startDate, endDate] = resolveDates(fiscalYear, period);
      const data = await generateData({
        start_date: startDate,
        end_date: endDate,
        num_rows: numRows,
        seed,
        inject_r1: toggles.inject_r1,
        inject_r2: toggles.inject_r2,
        inject_r3: toggles.inject_r3,
        inject_r4: toggles.inject_r4,
        inject_r5: toggles.inject_r5,
        inject_r6: toggles.inject_r6,
      });
      setResults(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!results) return;
    try {
      const blob = await downloadCsv(results.download_token);
      triggerDownload(blob, `synthetic_gl_${fiscalYear.slice(-4)}.csv`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Download failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4 text-sm">
        Generate realistic fake General Ledger data for testing. Anomaly patterns matching each
        scrutiny rule can be injected.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <ConfigPanel
            fiscalYear={fiscalYear}
            onFiscalYearChange={setFiscalYear}
            period={period}
            onPeriodChange={setPeriod}
            numRows={numRows}
            onNumRowsChange={setNumRows}
            seed={seed}
            onSeedChange={setSeed}
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <AnomalyToggles toggles={toggles} onChange={handleToggle} />
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Generating...' : 'Generate Dataset'}
      </button>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Generating {numRows.toLocaleString()} rows...
        </div>
      )}

      {results && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <MetricCard label="Total Rows" value={formatNumber(results.stats.total_rows)} />
            <MetricCard label="Amount Mean" value={formatCurrency(results.stats.amount_mean)} />
            <MetricCard label="Round Amounts" value={formatNumber(results.stats.round_amounts)} />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Preview (first 10 rows)</h3>
            <DataTable rows={results.preview} />
          </div>

          <button
            onClick={handleDownload}
            className="px-5 py-2 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700 transition-colors"
          >
            Download Synthetic GL (.csv)
          </button>
        </>
      )}
    </div>
  );
}
