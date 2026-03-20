import { useState } from 'react';

interface DataTableProps {
  rows: Record<string, unknown>[];
  pageSize?: number;
}

export default function DataTable({ rows, pageSize = 50 }: DataTableProps) {
  const [page, setPage] = useState(0);

  if (rows.length === 0) {
    return <p className="text-slate-500 text-sm py-4 text-center">No data to display.</p>;
  }

  const columns = Object.keys(rows[0]);
  const totalPages = Math.ceil(rows.length / pageSize);
  const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white">
              {columns.map((col) => (
                <th key={col} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr
                key={i}
                className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
              >
                {columns.map((col) => (
                  <td key={col} className="px-3 py-2 whitespace-nowrap text-slate-700 max-w-[300px] truncate">
                    {String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm text-slate-600">
          <span>
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, rows.length)} of{' '}
            {rows.length.toLocaleString()} rows
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 rounded border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-50"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 rounded border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
