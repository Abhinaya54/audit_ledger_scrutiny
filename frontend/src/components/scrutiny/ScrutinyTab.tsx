import { useState, useMemo } from 'react';
import FileUpload from '../common/FileUpload';
import DataTable from '../common/DataTable';
import Disclaimer from '../common/Disclaimer';
import SummaryCards from './SummaryCards';
import CategoryChart from './CategoryChart';
import LiveFilters, { defaultFilters, applyFilters, getSeverity } from './LiveFilters';
import type { FilterState } from './LiveFilters';
import { analyzeFile, exportReport } from '../../api/scrutinyApi';
import { triggerDownload } from '../../utils/format';
import type { ScrutinyResponse, FlaggedRow } from '../../types/scrutiny';

export default function ScrutinyTab() {
  const [file, setFile] = useState<File | null>(null);
  const [useMl, setUseMl] = useState(true);
  const [contamination, setContamination] = useState(0.05);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ScrutinyResponse | null>(null);
  const [filters, setFilters] = useState<FilterState>(defaultFilters());

  const filteredRows = useMemo(() => {
    if (!results) return [];
    return applyFilters(results.flagged_rows, filters);
  }, [results, filters]);

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setFilters(defaultFilters());
    try {
      const data = await analyzeFile(file, useMl, contamination);
      setResults(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!file) return;
    setExporting(true);
    try {
      const blob = await exportReport(file, useMl, contamination, true);
      triggerDownload(blob, 'scrutiny_report.xlsx');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  // Enrich rows with a severity field for the table display
  const displayRows = useMemo(
    () =>
      filteredRows.map((row: FlaggedRow) => ({
        ...row,
        severity: getSeverity(row.scrutiny_category),
      })),
    [filteredRows],
  );

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4 text-sm">
        Upload your General Ledger file (.csv or .xlsx). The engine will apply 6 rule-based checks
        (R1–R6) and an Isolation Forest ML model to flag suspicious transactions.
      </div>

      <FileUpload onFileSelect={setFile} />

      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={useMl}
            onChange={(e) => setUseMl(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 accent-blue-600"
          />
          Enable Isolation Forest (ML)
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          Contamination:
          <input
            type="range"
            min={0.01}
            max={0.2}
            step={0.01}
            value={contamination}
            onChange={(e) => setContamination(parseFloat(e.target.value))}
            disabled={!useMl}
            className="w-32"
          />
          <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
            {contamination.toFixed(2)}
          </span>
        </label>

        <button
          onClick={handleAnalyze}
          disabled={!file || loading}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Running scrutiny analysis...
        </div>
      )}

      {results && (
        <>
          <SummaryCards summary={results.summary} />
          <CategoryChart data={results.category_counts} />

          {/* Live Filters — rule, severity, account, date range */}
          <LiveFilters
            rows={results.flagged_rows}
            filters={filters}
            onChange={setFilters}
          />

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">
              Flagged Transactions (
              {filteredRows.length.toLocaleString()} of{' '}
              {results.flagged_rows.length.toLocaleString()} rows)
            </h3>
            <DataTable rows={displayRows as unknown as Record<string, unknown>[]} />
          </div>

          <Disclaimer />

          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-5 py-2 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            {exporting ? 'Generating report...' : 'Download Scrutiny Report (.xlsx)'}
          </button>
        </>
      )}
    </div>
  );
}
