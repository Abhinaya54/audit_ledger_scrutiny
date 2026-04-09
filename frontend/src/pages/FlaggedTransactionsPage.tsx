import { useMemo, useState } from 'react';
import type { ScrutinyResponse } from '../types/scrutiny';

type ApprovalStatus = 'pending' | 'approved' | 'rejected';

interface Props {
  results: ScrutinyResponse | null;
  reviewRows: Record<string, unknown>[];
  exporting: boolean;
  approvalStatus: ApprovalStatus;
  onApprove: () => void;
  onReject: () => void;
  onExport: () => void;
  onUploadClick: () => void;
}

function toText(value: unknown): string {
  if (value == null) return '';
  return String(value);
}

function splitCategories(value: unknown): string[] {
  return toText(value)
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export default function FlaggedTransactionsPage({
  results,
  reviewRows,
  exporting,
  approvalStatus,
  onApprove,
  onReject,
  onExport,
  onUploadClick,
}: Props) {
  const [anomalyFilter, setAnomalyFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  if (!results) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mb-5">
          <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">No Suspicious Transactions Yet</h2>
        <p className="text-sm text-slate-400 mb-6 max-w-xs">Run analysis on the upload page to start auditor review.</p>
        <button
          onClick={onUploadClick}
          className="px-5 py-2.5 bg-[#0F766E] text-white rounded-xl text-sm font-semibold hover:bg-[#115E59] transition-colors"
        >
          Upload & Analyze
        </button>
      </div>
    );
  }

  const columns = reviewRows.length > 0 ? Object.keys(reviewRows[0]) : [];
  const anomalyColumn = columns.find((c) => c === 'Anomaly_Type') ?? 'Anomaly_Type';
  const reasonColumn = columns.find((c) => c === 'Reason') ?? 'Reason';

  const anomalyOptions = useMemo(() => {
    const set = new Set<string>();
    reviewRows.forEach((row) => {
      splitCategories(row[anomalyColumn]).forEach((cat) => set.add(cat));
    });
    return ['All', ...Array.from(set).sort()];
  }, [reviewRows, anomalyColumn]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    let rows = reviewRows.filter((row) => {
      const rowCategories = splitCategories(row[anomalyColumn]);
      if (anomalyFilter !== 'All' && !rowCategories.includes(anomalyFilter)) {
        return false;
      }

      if (!q) return true;
      return columns.some((col) => toText(row[col]).toLowerCase().includes(q));
    });

    if (sortBy) {
      rows = [...rows].sort((a, b) => {
        const av = toText(a[sortBy]);
        const bv = toText(b[sortBy]);
        const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return rows;
  }, [reviewRows, anomalyFilter, searchTerm, columns, anomalyColumn, sortBy, sortDir]);

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(col);
    setSortDir('asc');
  };

  const canExport = approvalStatus === 'approved';

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Suspicious Transactions</h2>
            <p className="text-xs text-slate-500 mt-1">
              Review anomalies, approve the audit decision, then download the report.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              approvalStatus === 'approved'
                ? 'bg-emerald-100 text-emerald-700'
                : approvalStatus === 'rejected'
                ? 'bg-red-100 text-red-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {approvalStatus === 'approved'
                ? 'Approved'
                : approvalStatus === 'rejected'
                ? 'Rejected'
                : 'Pending Review'}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            value={anomalyFilter}
            onChange={(e) => setAnomalyFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
          >
            {anomalyOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'All' ? 'All Anomaly Types' : opt}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search rows"
            className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
          />

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              onClick={onReject}
              className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100"
            >
              Reject
            </button>
            <button
              onClick={onApprove}
              className="px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100"
            >
              Approve
            </button>
            <button
              onClick={onExport}
              disabled={!canExport || exporting}
              className="px-4 py-1.5 rounded-lg bg-[#0F766E] text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#115E59]"
            >
              {exporting ? 'Generating...' : 'Download Report'}
            </button>
          </div>
        </div>

        {!canExport && (
          <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Export is disabled until the auditor approves the suspicious transactions.
          </p>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 text-xs text-slate-600 font-medium">
          Showing {filteredRows.length.toLocaleString()} of {reviewRows.length.toLocaleString()} suspicious transactions
        </div>

        <div className="overflow-auto max-h-[68vh]">
          <table className="w-full min-w-max border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-800 text-white">
                {columns.map((col) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="px-3 py-2 text-left font-semibold border border-slate-700 whitespace-nowrap cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>{col}</span>
                      {sortBy === col && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(columns.length, 1)} className="px-4 py-10 text-center text-slate-500 border border-slate-200">
                    No rows match the selected anomaly filter or search term.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const hasAnomaly = toText(row[anomalyColumn]).trim().length > 0;
                  return (
                    <tr
                      key={idx}
                      className={hasAnomaly ? 'bg-amber-50/60 hover:bg-amber-100/50' : 'bg-white hover:bg-slate-50'}
                    >
                      {columns.map((col) => (
                        <td
                          key={`${idx}-${col}`}
                          className={`px-3 py-2 border border-slate-200 align-top ${
                            col === anomalyColumn || col === reasonColumn
                              ? 'max-w-[340px] whitespace-normal break-words'
                              : 'whitespace-nowrap'
                          }`}
                        >
                          {toText(row[col]) || '-'}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
