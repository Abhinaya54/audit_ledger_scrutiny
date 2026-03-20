interface ConfigPanelProps {
  fiscalYear: string;
  onFiscalYearChange: (v: string) => void;
  period: string;
  onPeriodChange: (v: string) => void;
  numRows: number;
  onNumRowsChange: (v: number) => void;
  seed: number;
  onSeedChange: (v: number) => void;
}

const FISCAL_YEARS = [
  'Apr 2024 - Mar 2025',
  'Apr 2023 - Mar 2024',
  'Jan 2024 - Dec 2024',
];

const PERIODS = ['Full Year', 'Q1 (Apr-Jun)', 'Q2 (Jul-Sep)', 'Q3 (Oct-Dec)', 'Q4 (Jan-Mar)'];

export default function ConfigPanel({
  fiscalYear,
  onFiscalYearChange,
  period,
  onPeriodChange,
  numRows,
  onNumRowsChange,
  seed,
  onSeedChange,
}: ConfigPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Fiscal Year</label>
        <select
          value={fiscalYear}
          onChange={(e) => onFiscalYearChange(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          {FISCAL_YEARS.map((fy) => (
            <option key={fy} value={fy}>
              {fy}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Period</label>
        <select
          value={period}
          onChange={(e) => onPeriodChange(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Number of rows: {numRows.toLocaleString()}
        </label>
        <input
          type="range"
          min={1000}
          max={100000}
          step={1000}
          value={numRows}
          onChange={(e) => onNumRowsChange(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-slate-400">
          <span>1,000</span>
          <span>100,000</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Random Seed</label>
        <input
          type="number"
          min={0}
          max={9999}
          value={seed}
          onChange={(e) => onSeedChange(parseInt(e.target.value) || 0)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>
    </div>
  );
}
