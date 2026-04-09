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

interface SheetTab {
  id: string;
  label: string;
}

function toText(value: unknown): string {
  if (value == null) return '';
  return String(value);
}

function ExcelGrid() {
  const rows = 30;
  const cols = 26;

  const getColumnLetter = (index: number): string => {
    let label = '';
    let n = index + 1;
    while (n > 0) {
      n--;
      label = String.fromCharCode(65 + (n % 26)) + label;
      n = Math.floor(n / 26);
    }
    return label;
  };

  return (
    <table className="w-full border-collapse text-xs bg-white">
      <thead>
        <tr>
          <th className="w-12 h-6 bg-slate-100 border border-slate-300 text-slate-500 font-normal text-center text-[10px]" />
          {Array.from({ length: cols }).map((_, i) => (
            <th
              key={`col-${i}`}
              className="w-24 h-6 bg-slate-100 border border-slate-300 text-slate-600 font-semibold text-center text-xs"
            >
              {getColumnLetter(i)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <tr key={`row-${rowIdx}`}>
            <td className="w-12 bg-slate-100 border border-slate-300 text-slate-600 font-semibold text-center text-xs">
              {rowIdx + 1}
            </td>
            {Array.from({ length: cols }).map((_, colIdx) => (
              <td
                key={`cell-${rowIdx}-${colIdx}`}
                className="w-24 h-6 border border-slate-200 bg-white hover:bg-blue-50 text-slate-700 px-1 py-0.5 cursor-cell"
              />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
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
  const [sheetTabs, setSheetTabs] = useState<SheetTab[]>([
    { id: 'Sheet1', label: 'Suspicious_Transactions' },
    { id: 'Sheet2', label: 'Summary' },
  ]);
  const [activeSheet, setActiveSheet] = useState('Sheet1');
  const [renamingSheetId, setRenamingSheetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
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

  const addSheet = () => {
    setSheetTabs((prev) => {
      const maxSheetNumber = prev.reduce((max, tab) => {
        const parsed = Number.parseInt(tab.id.replace('Sheet', ''), 10);
        return Number.isNaN(parsed) ? max : Math.max(max, parsed);
      }, 0);
      const nextId = `Sheet${maxSheetNumber + 1}`;
      setActiveSheet(nextId);
      return [...prev, { id: nextId, label: 'New_Sheet' }];
    });
  };

  const startRenameSheet = (tabId: string, currentLabel: string) => {
    setRenamingSheetId(tabId);
    setRenameValue(currentLabel);
  };

  const commitRenameSheet = (tabId: string) => {
    const nextLabel = renameValue.trim();
    if (!nextLabel) {
      setRenamingSheetId(null);
      return;
    }

    setSheetTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, label: nextLabel } : tab)),
    );
    setRenamingSheetId(null);
  };

  const cancelRenameSheet = () => {
    setRenamingSheetId(null);
    setRenameValue('');
  };

  const summaryRows = useMemo(() => {
    const counts = new Map<string, number>();
    filteredRows.forEach((row) => {
      splitCategories(row[anomalyColumn]).forEach((cat) => {
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRows, anomalyColumn]);

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
          {activeSheet === 'Sheet1'
            ? `Showing ${filteredRows.length.toLocaleString()} of ${reviewRows.length.toLocaleString()} suspicious transactions`
            : activeSheet === 'Sheet2'
            ? `Summary for ${filteredRows.length.toLocaleString()} suspicious transactions`
            : `Empty worksheet ${activeSheet}`}
        </div>

        {activeSheet === 'Sheet1' ? (
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
        ) : activeSheet === 'Sheet2' ? (
          <div className="overflow-auto max-h-[68vh]">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-800 text-white">
                  <th className="px-3 py-2 text-left font-semibold border border-slate-700 whitespace-nowrap">Anomaly_Type</th>
                  <th className="px-3 py-2 text-left font-semibold border border-slate-700 whitespace-nowrap">Count</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-10 text-center text-slate-500 border border-slate-200">
                      No anomaly summary available for the current filter.
                    </td>
                  </tr>
                ) : (
                  summaryRows.map((row) => (
                    <tr key={row.type} className="bg-white hover:bg-slate-50">
                      <td className="px-3 py-2 border border-slate-200">{row.type}</td>
                      <td className="px-3 py-2 border border-slate-200 font-semibold">{row.count.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-auto max-h-[68vh]">
            <ExcelGrid />
          </div>
        )}

        <div className="flex items-end gap-1 border-t border-slate-200 bg-slate-100 px-2 pt-2">
          {sheetTabs.map((tab) => (
            <div
              key={tab.id}
              onDoubleClick={() => startRenameSheet(tab.id, tab.label)}
              className={`rounded-t-md border px-4 py-1.5 text-xs font-medium ${
                activeSheet === tab.id
                  ? 'bg-white border-slate-300 border-b-white text-slate-800'
                  : 'bg-slate-200 border-slate-300 text-slate-600 hover:bg-slate-300'
              }`}
            >
              {renamingSheetId === tab.id ? (
                <input
                  autoFocus
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRenameSheet(tab.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitRenameSheet(tab.id);
                    }
                    if (e.key === 'Escape') {
                      cancelRenameSheet();
                    }
                  }}
                  className="w-40 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveSheet(tab.id)}
                  className="text-left"
                  title="Double-click to rename"
                >
                  {tab.id} ({tab.label})
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addSheet}
            aria-label="Add sheet"
            title="Add sheet"
            className="mb-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
          >
            <span className="text-base leading-none">+</span>
          </button>
        </div>
      </div>
    </div>
  );
}
