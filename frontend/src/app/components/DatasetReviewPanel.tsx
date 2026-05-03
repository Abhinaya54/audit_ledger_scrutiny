import { X } from 'lucide-react';
import { useWorkbook } from '../context/WorkbookContext';

interface DatasetReviewPanelProps {
  onClose: () => void;
  uploadedFile?: File;
  reviewRows?: any[];
  columnMappings?: Record<string, string>;
  availableColumns?: string[];
}

export default function DatasetReviewPanel({ 
  onClose, 
  uploadedFile,
  reviewRows = [],
  columnMappings = {},
  availableColumns = []
}: DatasetReviewPanelProps) {
  const { workbookData } = useWorkbook();

  // File information
  const fileName = uploadedFile?.name || 'No file uploaded';
  const uploadedAt = uploadedFile 
    ? new Date(uploadedFile.lastModified).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Unknown';

  const dataRows = reviewRows.length > 0 ? reviewRows : workbookData?.csvData || [];
  const rowCount = dataRows.length;
  const effectiveColumns = availableColumns.length
    ? availableColumns
    : dataRows.length > 0
    ? Object.keys(dataRows[0])
    : [];
  const columnCount = effectiveColumns.length;
  const sheetCount = uploadedFile?.name?.endsWith('.xlsx') ? 1 : 0;

  // Build column mappings list
  const mappingsList = columnMappings 
    ? Object.entries(columnMappings).map(([systemField, sourceCol]) => ({
        source: sourceCol,
        mapped: systemField,
      }))
    : [];

  // Preview data - first 3 rows from parsed CSV or backend review rows
  const previewRows = dataRows.slice(0, 3);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-[800px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg text-gray-900 font-medium">Dataset Review</h2>
            <p className="text-sm text-gray-500 mt-1">Read-only view of uploaded source data</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* File Information */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">File Information</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">File Name:</span>
                <span className="text-gray-900 font-medium">{fileName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Uploaded:</span>
                <span className="text-gray-900">{uploadedAt}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Rows:</span>
                <span className="text-gray-900">{rowCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Columns:</span>
                <span className="text-gray-900">{columnCount}</span>
              </div>
              {sheetCount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Sheet Count:</span>
                  <span className="text-gray-900">{sheetCount}</span>
                </div>
              )}
            </div>
          </div>

          {/* Column Mappings */}
          {mappingsList.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Column Mappings</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs text-gray-600">Source Column</th>
                      <th className="px-4 py-2 text-left text-xs text-gray-600">Mapped To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappingsList.map((mapping, index) => (
                      <tr key={index} className="border-t border-gray-200">
                        <td className="px-4 py-2 text-sm text-gray-700">{mapping.source}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 font-medium">{mapping.mapped}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Data Preview */}
          {previewRows.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Data Preview (First {previewRows.length} Rows)</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {availableColumns.slice(0, 6).map((col) => (
                          <th key={col} className="px-3 py-2 text-left text-xs text-gray-600 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-t border-gray-200">
                          {availableColumns.slice(0, 6).map((col) => (
                            <td key={`${rowIndex}-${col}`} className="px-3 py-2 text-gray-700 whitespace-nowrap truncate">
                              {String(row[col] || '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {rowCount === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No data loaded yet. Upload a file to see preview.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}