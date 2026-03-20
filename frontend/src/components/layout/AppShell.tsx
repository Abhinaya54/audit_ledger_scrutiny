import { useState } from 'react';
import ScrutinyTab from '../scrutiny/ScrutinyTab';
import GeneratorTab from '../generator/GeneratorTab';

const TABS = ['Scrutiny Engine', 'Generate Test Data'] as const;

export default function AppShell() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <h1 className="text-2xl font-bold text-slate-800">Ledger Scrutiny Assistant</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Audit Intelligence Suite — Synthetic Data Generator + Anomaly Detection
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 mt-6">
        <div className="flex border-b border-slate-200">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === i
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="py-6">
          {activeTab === 0 && <ScrutinyTab />}
          {activeTab === 1 && <GeneratorTab />}
        </div>
      </div>
    </div>
  );
}
