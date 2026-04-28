import { X } from 'lucide-react';

interface DatasetReviewPanelProps {
  onClose: () => void;
}

export default function DatasetReviewPanel({ onClose }: DatasetReviewPanelProps) {
  // Mock data - in real app, this would come from workbook context
  const datasetInfo = {
    fileName: 'Acme_GL_FY2023-24.xlsx',
    uploadedAt: 'March 10, 2026 at 2:34 PM',
    rowCount: 12842,
    sheetCount: 3,
    columnMappings: [
      { source: 'Transaction Date', mapped: 'Date' },
      { source: 'Voucher Number', mapped: 'Voucher No' },
      { source: 'Account Code', mapped: 'Account' },
      { source: 'Description', mapped: 'Narration' },
      { source: 'Debit Amount', mapped: 'Debit' },
      { source: 'Credit Amount', mapped: 'Credit' },
      { source: 'Currency Code', mapped: 'Currency' },
    ],
    dataHealth: {
      completeness: 98.5,
      duplicates: 12,
      blankNarrations: 234,
      invalidDates: 0,
    },
    previewRows: [
      {
        date: '01-Apr-2023',
        voucherNo: 'JV-001',
        account: 'Cash',
        narration: 'Opening balance',
        debit: '₹50,000',
        credit: '—',
      },
      {
        date: '02-Apr-2023',
        voucherNo: 'PV-102',
        account: 'Rent Expense',
        narration: 'Monthly rent payment',
        debit: '₹25,000',
        credit: '—',
      },
      {
        date: '03-Apr-2023',
        voucherNo: 'RV-045',
        account: 'Sales Revenue',
        narration: 'Invoice #1234',
        debit: '—',
        credit: '₹75,000',
      },
    ],
  };

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
                <span className="text-gray-900 font-medium">{datasetInfo.fileName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Uploaded:</span>
                <span className="text-gray-900">{datasetInfo.uploadedAt}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Rows:</span>
                <span className="text-gray-900">{datasetInfo.rowCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Sheet Count:</span>
                <span className="text-gray-900">{datasetInfo.sheetCount}</span>
              </div>
            </div>
          </div>

          {/* Column Mappings */}
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
                  {datasetInfo.columnMappings.map((mapping, index) => (
                    <tr key={index} className="border-t border-gray-200">
                      <td className="px-4 py-2 text-sm text-gray-700">{mapping.source}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 font-medium">{mapping.mapped}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Data Health Summary */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Data Health Summary</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Completeness</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${datasetInfo.dataHealth.completeness}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-900 font-medium">
                    {datasetInfo.dataHealth.completeness}%
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Duplicate Rows:</span>
                <span className="text-gray-900">{datasetInfo.dataHealth.duplicates}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Blank Narrations:</span>
                <span className="text-gray-900">{datasetInfo.dataHealth.blankNarrations}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Invalid Dates:</span>
                <span className="text-gray-900">{datasetInfo.dataHealth.invalidDates}</span>
              </div>
            </div>
          </div>

          {/* Data Preview */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Data Preview (First 3 Rows)</h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs text-gray-600">Date</th>
                      <th className="px-3 py-2 text-left text-xs text-gray-600">Voucher No</th>
                      <th className="px-3 py-2 text-left text-xs text-gray-600">Account</th>
                      <th className="px-3 py-2 text-left text-xs text-gray-600">Narration</th>
                      <th className="px-3 py-2 text-right text-xs text-gray-600">Debit</th>
                      <th className="px-3 py-2 text-right text-xs text-gray-600">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datasetInfo.previewRows.map((row, index) => (
                      <tr key={index} className="border-t border-gray-200">
                        <td className="px-3 py-2 text-gray-700">{row.date}</td>
                        <td className="px-3 py-2 text-gray-700">{row.voucherNo}</td>
                        <td className="px-3 py-2 text-gray-700">{row.account}</td>
                        <td className="px-3 py-2 text-gray-700">{row.narration}</td>
                        <td className="px-3 py-2 text-gray-700 text-right">{row.debit}</td>
                        <td className="px-3 py-2 text-gray-700 text-right">{row.credit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
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