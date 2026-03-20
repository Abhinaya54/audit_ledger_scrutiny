interface AnomalyTogglesProps {
  toggles: Record<string, boolean>;
  onChange: (key: string, value: boolean) => void;
}

const RULES = [
  { key: 'inject_r1', label: 'R1 -- Round Amounts (~15%)' },
  { key: 'inject_r2', label: 'R2 -- Weekend Postings (~5%)' },
  { key: 'inject_r3', label: 'R3 -- Period End Cluster (~8%)' },
  { key: 'inject_r4', label: 'R4 -- Weak Narrations (~10%)' },
  { key: 'inject_r5', label: 'R5 -- Duplicate Rows (~2%)' },
  { key: 'inject_r6', label: 'R6 -- Manual Journals (~20%)' },
];

export default function AnomalyToggles({ toggles, onChange }: AnomalyTogglesProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Anomaly Injection</h3>
      <div className="space-y-2.5">
        {RULES.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={toggles[key] ?? true}
              onChange={(e) => onChange(key, e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 accent-blue-600"
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}
