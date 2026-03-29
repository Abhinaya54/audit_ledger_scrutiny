import { useState } from 'react';

interface DataTableProps {
  rows: Record<string, unknown>[];
  pageSize?: number;
  rowClassName?: (row: Record<string, unknown>) => string | undefined;
  hiddenColumns?: string[];
}

export default function DataTable({
  rows,
  pageSize = 50,
  rowClassName,
  hiddenColumns = [],
}: DataTableProps) {
  const [page, setPage] = useState(0);

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
        </svg>
        <p className="text-sm font-medium">No data to display</p>
      </div>
    );
  }

  const allColumns = Object.keys(rows[0]);
  const columns = allColumns.filter((c) => !hiddenColumns.includes(c));
  const totalPages = Math.ceil(rows.length / pageSize);
  const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#134E4A] text-white">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider whitespace-nowrap"
                >
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => {
              const custom = rowClassName?.(row);
              const base = custom ?? (i % 2 === 0 ? 'bg-white' : 'bg-slate-50');
              return (
                <tr
                  key={i}
                  className={`${base} hover:brightness-[0.97] transition-all border-b border-slate-100 last:border-0`}
                >
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="px-4 py-2.5 whitespace-nowrap text-slate-700 max-w-[280px] truncate text-xs"
                    >
                      {String(row[col] ?? '')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-slate-500">
            Showing {(page * pageSize + 1).toLocaleString()}–
            {Math.min((page + 1) * pageSize, rows.length).toLocaleString()} of{' '}
            {rows.length.toLocaleString()} rows
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500 px-2">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
