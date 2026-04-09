import { useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import LiveFilters from '../components/scrutiny/LiveFilters';
import type { FilterState } from '../components/scrutiny/LiveFilters';
import Disclaimer from '../components/common/Disclaimer';
import type { ScrutinyResponse, DisplayRow } from '../types/scrutiny';

/* ── Display helpers ── */
const CATEGORY_LABELS: Record<string, string> = {
  'ML Anomaly': 'AI Detection',
  'Round Numbers': 'Round Amounts',
  'Weekend Entries': 'Weekend Posting',
  'Weak Narration': 'Insufficient Description',
  'Period End': 'Period-End Concentration',
  'Duplicate Check': 'Duplicate Entry',
  'Manual Journal': 'Manual Entry',
};

function toDisplay(raw: string) {
  return CATEGORY_LABELS[raw] ?? raw;
}

function computeRiskScore(row: DisplayRow): number {
  const base = { High: 82, Medium: 57, Low: 32 }[row.severity] ?? 32;
  if (row.ml_anomaly_score != null && row.ml_anomaly_flag === -1) {
    const norm = Math.min(100, Math.max(0, Math.round(Math.abs(row.ml_anomaly_score) * 200)));
    return Math.max(base, norm);
  }
  return base;
}

function RiskBadge({ score }: { score: number }) {
  const cls =
    score >= 75
      ? 'bg-red-50 text-red-700 border-red-200'
      : score >= 50
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-green-50 text-green-700 border-green-200';
  return (
    <span className={`inline-block text-[10px] font-bold border px-1.5 py-0.5 rounded-full ${cls}`}>
      {score}
    </span>
  );
}

/* ── Props ── */
interface Props {
  results: ScrutinyResponse | null;
  rows: DisplayRow[];
  filters: FilterState;
  exporting: boolean;
  onFiltersChange: (f: FilterState) => void;
  onExport: () => void;
  onUploadClick: () => void;
  onInsightsClick: () => void;
}

const PIE_COLORS = ['#EF4444', '#F59E0B', '#10B981'];

/* ── Empty state ── */
function EmptyState({ onUploadClick }: { onUploadClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mb-5">
        <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-slate-800 mb-2">No Results Yet</h2>
      <p className="text-sm text-slate-400 mb-6 max-w-xs">Run an analysis first to see suspicious transactions.</p>
      <button
        onClick={onUploadClick}
        className="px-5 py-2.5 bg-[#0F766E] text-white rounded-xl text-sm font-semibold hover:bg-[#115E59] transition-colors"
      >
        Upload & Analyze
      </button>
    </div>
  );
}

/* ── Main component ── */
export default function FlaggedTransactionsPage({
  results, rows, filters, exporting, onFiltersChange, onExport, onUploadClick, onInsightsClick,
}: Props) {
  const [showHighOnly, setShowHighOnly] = useState(false);
  const [sortByRisk, setSortByRisk] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  if (!results) return <EmptyState onUploadClick={onUploadClick} />;

  const enriched = useMemo(
    () => rows.map((r) => ({ ...r, _riskScore: computeRiskScore(r) })),
    [rows],
  );

  const displayed = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let list = showHighOnly ? enriched.filter((r) => r._riskScore >= 75) : enriched;
    if (q) {
      list = list.filter((r) =>
        [
          r.voucher_no,
          r.date,
          r.ledger_name,
          r.narration,
          r.scrutiny_category,
          r.scrutiny_reason,
          String(r.amount),
        ]
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }
    if (sortByRisk) list = [...list].sort((a, b) => b._riskScore - a._riskScore);
    return list;
  }, [enriched, showHighOnly, sortByRisk, searchTerm]);

  /* Severity breakdown for pie */
  const severityCounts = useMemo(() => {
    const high = rows.filter((r) => r.severity === 'High').length;
    const med = rows.filter((r) => r.severity === 'Medium').length;
    const low = rows.filter((r) => r.severity === 'Low').length;
    return [
      { name: 'High Risk', value: high },
      { name: 'Medium Risk', value: med },
      { name: 'Low Risk', value: low },
    ].filter((d) => d.value > 0);
  }, [rows]);

  /* Category bar data */
  const categoryData = useMemo(
    () =>
      [...results.category_counts]
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
        .map((c) => ({ name: toDisplay(c.category), count: c.count })),
    [results.category_counts],
  );

  const activeFilters =
    filters.rules.length + filters.severities.length + filters.accounts.length +
    (filters.dateFrom || filters.dateTo ? 1 : 0);

  const COLS = [
    { key: 'date', label: 'Date' },
    { key: 'ledger_name', label: 'Ledger / Account' },
    { key: 'amount', label: 'Amount' },
    { key: 'narration', label: 'Narration' },
    { key: 'scrutiny_category', label: 'Anomaly Type' },
    { key: '_riskScore', label: 'Risk Score' },
    { key: 'severity', label: 'Flag' },
  ] as const;

  const ROW_BG: Record<string, string> = {
    High:   'bg-red-50/60 border-l-4 border-l-red-400',
    Medium: 'bg-amber-50/50 border-l-4 border-l-amber-400',
    Low:    'bg-white border-l-4 border-l-transparent',
  };

  const FLAG_BADGE: Record<string, string> = {
    High:   'bg-red-100 text-red-700',
    Medium: 'bg-amber-100 text-amber-700',
    Low:    'bg-slate-100 text-slate-600',
  };

  return (
    <div className="space-y-6">
      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Category bar — 3 cols */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-1">Anomaly Category Breakdown</h3>
          <p className="text-xs text-slate-400 mb-4">Number of suspicious transactions per rule</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={categoryData} margin={{ top: 0, right: 10, bottom: 20, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: '#94a3b8' }}
                interval={0}
                angle={-20}
                textAnchor="end"
              />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <ReTooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" name="Transactions" fill="#0F766E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Risk pie — 2 cols */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-1">Risk Distribution</h3>
          <p className="text-xs text-slate-400 mb-2">High / Medium / Low severity</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={severityCounts} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                {severityCounts.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <ReTooltip formatter={(v) => Number(v).toLocaleString()} />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-1 mt-1">
            {severityCounts.map((d, i) => (
              <div key={d.name} className="text-center">
                <p className="text-sm font-bold" style={{ color: PIE_COLORS[i] }}>{d.value}</p>
                <p className="text-[10px] text-slate-400">{d.name.split(' ')[0]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800">
            {displayed.length.toLocaleString()} suspicious transactions
          </span>
          {activeFilters > 0 && (
            <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full font-medium">
              {activeFilters} filter{activeFilters > 1 ? 's' : ''} active
            </span>
          )}
        </div>

        <div className="relative w-full max-w-xs">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-4.35-4.35m0 0A7.5 7.5 0 1 0 6.15 6.15a7.5 7.5 0 0 0 10.5 10.5Z"
            />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search detections"
            className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-700 focus:border-teal-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* High risk toggle */}
          <button
            onClick={() => setShowHighOnly((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              showHighOnly
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:text-red-600'
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {showHighOnly ? 'High Risk Only ✓' : 'Show High Risk Only'}
          </button>

          {/* Sort by risk */}
          <button
            onClick={() => setSortByRisk((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              sortByRisk
                ? 'bg-[#0F766E] text-white border-[#0F766E]'
                : 'bg-white text-slate-600 border-slate-200 hover:border-[#0F766E] hover:text-[#0F766E]'
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
            </svg>
            {sortByRisk ? 'By Risk Score ✓' : 'Sort by Risk Score'}
          </button>

          {/* Export */}
          <button
            onClick={onExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            {exporting ? (
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            )}
            {exporting ? 'Exporting...' : 'Export Report'}
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <LiveFilters rows={results.flagged_rows} filters={filters} onChange={onFiltersChange} />

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                {COLS.map((col) => (
                  <th key={col.key} className="px-4 py-3 text-left font-semibold uppercase tracking-wider whitespace-nowrap text-[10px]">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={COLS.length} className="text-center py-10 text-slate-400 text-sm">
                    No transactions match the current filters
                  </td>
                </tr>
              ) : (
                displayed.slice(0, 200).map((row, i) => (
                  <tr
                    key={i}
                    className={`${ROW_BG[row.severity] ?? 'bg-white'} border-b border-slate-100 last:border-0 hover:brightness-[0.97] transition-all`}
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                      {row.date.slice(0, 10)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap font-medium text-slate-800 max-w-[160px] truncate">
                      {row.ledger_name}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap font-semibold text-slate-800">
                      ₹{Math.abs(row.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 max-w-[200px] truncate">
                      {row.narration || '—'}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                        {toDisplay(row.scrutiny_category.split(',')[0].trim())}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <RiskBadge score={row._riskScore} />
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${FLAG_BADGE[row.severity]}`}>
                        {row.severity}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {displayed.length > 200 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400 text-center bg-slate-50">
            Showing first 200 of {displayed.length.toLocaleString()} rows. Export for full data.
          </div>
        )}
      </div>

      <Disclaimer />

      {/* View insights CTA */}
      <div className="flex justify-end">
        <button
          onClick={onInsightsClick}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          View Insights & Report
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
