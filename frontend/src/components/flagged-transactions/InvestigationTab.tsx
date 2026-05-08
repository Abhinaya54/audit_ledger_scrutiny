import { useState, useMemo, useEffect } from 'react';
import { FilterSection, CheckRow } from './ui';
import { 
  createWorkspace, 
  cloneFilters, 
  EMPTY_FILTERS, 
  getRowValue, 
  getRowAmount, 
  rowMatchesQuery,
  splitCategories,
  toText
} from './utils';
import type { InvestigationWorkspaceState } from './types';
import { nlQueryApi } from '@/api/nlQueryApi';

interface InvestigationTabProps {
  reviewRows: Record<string, unknown>[];
  totalEntries: number;
}

export default function InvestigationTab({ reviewRows, totalEntries }: InvestigationTabProps) {
  const [showFilters, setShowFilters] = useState(true);
  const [investigationTabs, setInvestigationTabs] = useState<InvestigationWorkspaceState[]>([createWorkspace(1)]);
  const [activeInvestigationTabId, setActiveInvestigationTabId] = useState<string>(() => investigationTabs[0].id);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameTabValue, setRenameTabValue] = useState('');

  const activeInvestigationTab = useMemo(() => {
    return investigationTabs.find((item) => item.id === activeInvestigationTabId) ?? investigationTabs[0];
  }, [investigationTabs, activeInvestigationTabId]);

  const updateActiveInvestigationTab = (updater: (current: InvestigationWorkspaceState) => InvestigationWorkspaceState) => {
    setInvestigationTabs((prev) =>
      prev.map((item) => (item.id === activeInvestigationTabId ? updater(item) : item)),
    );
  };

  useEffect(() => {
    if (!investigationTabs.some((item) => item.id === activeInvestigationTabId)) {
      setActiveInvestigationTabId(investigationTabs[0]?.id ?? '');
    }
  }, [investigationTabs, activeInvestigationTabId]);

  // Reset investigation tabs when dataset changes
  useEffect(() => {
    if (totalEntries === 0) return;
    const newTab = createWorkspace(1);
    setInvestigationTabs([newTab]);
    setActiveInvestigationTabId(newTab.id);
  }, [totalEntries]);

  const handleRunQuery = async () => {
    if (!activeInvestigationTab || !activeInvestigationTab.queryInput.trim()) return;

    updateActiveInvestigationTab((curr) => ({ ...curr, isLoading: true, nlError: null }));

    try {
      const result = await nlQueryApi.parse(activeInvestigationTab.queryInput);
      
      updateActiveInvestigationTab((curr) => ({
        ...curr,
        appliedQuery: curr.queryInput,
        nlResult: result,
        nlError: null,
        isLoading: false,
        hasRequested: true,
      }));
    } catch (err: any) {
      const message = err?.message || 'Query analysis failed. Using text search fallback.';
      console.error('NL Query failed:', err);
      updateActiveInvestigationTab((curr) => ({
        ...curr,
        appliedQuery: curr.queryInput,
        nlResult: null,
        nlError: message,
        isLoading: false,
        hasRequested: true,
      }));
    }
  };

  const investigationRows = useMemo(() => {
    // Always start with all rows, allowing users to see data before querying

    const appliedFilters = activeInvestigationTab.appliedFilters;
    const appliedQuery = activeInvestigationTab.appliedQuery;

    let rows = [...reviewRows];

    const hasAnyFilter = 
      appliedQuery.trim() !== '' ||
      activeInvestigationTab.nlResult !== null ||
      Object.entries(appliedFilters).some(([k, v]) => {
        if (k === 'quarter') return v !== 'all';
        if (Array.isArray(v)) return v.length > 0;
        return v !== '';
      });

    // If no filters are applied, only show flagged transactions by default
    if (!hasAnyFilter) {
      rows = rows.filter(row => {
        const cat = getRowValue(row, ['scrutiny_category', 'Scrutiny Category']);
        return cat && cat.trim() !== '';
      });
    }

    rows = rows.filter((row) => {
      if (!appliedFilters.ledgerType) return true;
      const ledger = getRowValue(row, ['ledger_type', 'Ledger Type', 'ledger_name', 'Account']);
      return ledger.toLowerCase().includes(appliedFilters.ledgerType.toLowerCase());
    });

    rows = rows.filter((row) => {
      if (!appliedFilters.accountSeries) return true;
      const account = getRowValue(row, ['account', 'Account', 'ledger_name']);
      return account.toLowerCase().includes(appliedFilters.accountSeries.toLowerCase());
    });

    rows = rows.filter((row) => {
      if (!appliedFilters.financialYear) return true;
      const year = getRowValue(row, ['fiscal_year', 'Financial Year', 'date', 'Date']);
      return year.toLowerCase().includes(appliedFilters.financialYear.toLowerCase());
    });

    rows = rows.filter((row) => {
      if (appliedFilters.quarter === 'all' || !appliedFilters.quarter) return true;
      const dateValue = getRowValue(row, ['date', 'Date', 'transaction_date', 'Transaction Date']);
      const parsed = new Date(dateValue);
      if (Number.isNaN(parsed.getTime())) return true;
      const month = parsed.getMonth();
      const quarterMap: Record<string, number[]> = {
        q1: [0, 1, 2],
        q2: [3, 4, 5],
        q3: [6, 7, 8],
        q4: [9, 10, 11],
      };
      return quarterMap[appliedFilters.quarter]?.includes(month) ?? true;
    });

    if (activeInvestigationTab.nlResult) {
      const { filters, matched_controls } = activeInvestigationTab.nlResult;

      if (matched_controls.length > 0) {
        rows = rows.filter((row) => {
          const cats = splitCategories(getRowValue(row, ['scrutiny_category', 'Scrutiny Category']));
          return matched_controls.some((ctrl) => cats.includes(ctrl));
        });
      }

      if (filters.amount_min !== undefined) {
        rows = rows.filter((row) => getRowAmount(row) >= filters.amount_min);
      }
      if (filters.amount_max !== undefined) {
        rows = rows.filter((row) => getRowAmount(row) <= filters.amount_max);
      }
      if (filters.voucher_types && filters.voucher_types.length > 0) {
        rows = rows.filter((row) => {
          const vType = getRowValue(row, ['voucher_type', 'Voucher Type']).toLowerCase();
          return filters.voucher_types.some((t: string) => vType.includes(t.toLowerCase()));
        });
      }
      if (filters.months && filters.months.length > 0) {
        rows = rows.filter((row) => {
          const dateValue = getRowValue(row, ['date', 'Date']);
          const parsed = new Date(dateValue);
          if (Number.isNaN(parsed.getTime())) return true;
          return filters.months.includes(parsed.getMonth() + 1);
        });
      }
      if (filters.quarters && filters.quarters.length > 0) {
        rows = rows.filter((row) => {
          const dateValue = getRowValue(row, ['date', 'Date']);
          const parsed = new Date(dateValue);
          if (Number.isNaN(parsed.getTime())) return true;
          const q = Math.floor(parsed.getMonth() / 3) + 1;
          return filters.quarters.includes(q);
        });
      }
    } else {
      rows = rows.filter((row) => rowMatchesQuery(row, appliedQuery));
    }

    rows = rows.filter((row) => {
      if (!appliedFilters.keyword.trim()) return true;
      const narration = getRowValue(row, ['narration', 'Narration', 'description']);
      return narration.toLowerCase().includes(appliedFilters.keyword.trim().toLowerCase());
    });

    if (appliedFilters.voucherTypes.length > 0) {
      rows = rows.filter((row) => {
        const voucher = getRowValue(row, ['voucher_type', 'Voucher Type']).toLowerCase();
        return appliedFilters.voucherTypes.some((type) => voucher.includes(type.toLowerCase()));
      });
    }

    if (appliedFilters.currencies.length > 0) {
      rows = rows.filter((row) => {
        const currency = getRowValue(row, ['currency', 'Currency']).toUpperCase();
        return appliedFilters.currencies.some((value) => currency.includes(value));
      });
    }

    const customThreshold = Number(appliedFilters.customThreshold.replace(/,/g, ''));
    if (Number.isFinite(customThreshold) && customThreshold > 0) {
      rows = rows.filter((row) => getRowAmount(row) >= customThreshold);
    }

    if (appliedFilters.amountPreset === 'above500k') {
      rows = rows.filter((row) => getRowAmount(row) >= 500000);
    }

    if (appliedFilters.amountPreset === 'top10expenses') {
      const sorted = [...rows].sort((a, b) => getRowAmount(b) - getRowAmount(a));
      const topCount = Math.max(1, Math.floor(sorted.length * 0.1));
      rows = sorted.slice(0, topCount);
    }

    return rows.slice(0, 300);
  }, [reviewRows, activeInvestigationTab]);

  const updateMultiSelect = (bucket: 'voucherTypes' | 'currencies', value: string, checked: boolean) => {
    updateActiveInvestigationTab((current) => {
      const existing = current.draftFilters[bucket];
      const next = checked ? [...existing, value] : existing.filter((item) => item !== value);
      return {
        ...current,
        draftFilters: {
          ...current.draftFilters,
          [bucket]: next,
        },
      };
    });
  };

  const addInvestigationTab = () => {
    const nextIndex = investigationTabs.length + 1;
    const nextTab = createWorkspace(nextIndex);
    setInvestigationTabs((prev) => [...prev, nextTab]);
    setActiveInvestigationTabId(nextTab.id);
  };

  const startRenameTab = (tabId: string) => {
    const current = investigationTabs.find((item) => item.id === tabId);
    if (!current) return;
    setRenamingTabId(tabId);
    setRenameTabValue(current.label);
  };

  const commitRenameTab = () => {
    if (!renamingTabId) return;
    const nextLabel = renameTabValue.trim();
    if (nextLabel) {
      setInvestigationTabs((prev) =>
        prev.map((item) => (item.id === renamingTabId ? { ...item, label: nextLabel } : item)),
      );
    }
    setRenamingTabId(null);
    setRenameTabValue('');
  };

  const cancelRenameTab = () => {
    setRenamingTabId(null);
    setRenameTabValue('');
  };

  const reviewColumns = reviewRows.length > 0 ? Object.keys(reviewRows[0]) : [];
  const visibleColumns = reviewColumns.slice(0, 8);

  return (
    <section className="bg-white border-t-0 border-slate-200 h-full flex flex-col overflow-hidden">
      <div className="flex flex-1 min-h-0">
        {showFilters && (
          <aside className="w-[360px] border-r border-slate-200 bg-white p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-2xl font-semibold text-slate-900">Filters</h4>
              <button className="text-sm text-blue-600" onClick={() => setShowFilters(false)}>Hide filters</button>
            </div>

            <FilterSection title="Ledger Type">
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={activeInvestigationTab?.draftFilters.ledgerType ?? ''}
                onChange={(e) =>
                  updateActiveInvestigationTab((current) => ({
                    ...current,
                    draftFilters: { ...current.draftFilters, ledgerType: e.target.value },
                  }))
                }
              >
                <option value="">Select Ledger</option>
                <option value="General Ledger">General Ledger</option>
              </select>
            </FilterSection>

            <FilterSection title="Account Series">
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={activeInvestigationTab?.draftFilters.accountSeries ?? ''}
                onChange={(e) =>
                  updateActiveInvestigationTab((current) => ({
                    ...current,
                    draftFilters: { ...current.draftFilters, accountSeries: e.target.value },
                  }))
                }
              >
                <option value="">Select Account Series</option>
                <option value="1000">1000-1999: Assets</option>
                <option value="2000">2000-2999: Liabilities</option>
                <option value="3000">3000-3999: Equity</option>
                <option value="4000">4000-4999: Revenue / Income</option>
                <option value="5000">5000-5999: Cost of Goods Sold (COGS)</option>
                <option value="6000">6000-7999: Expenses</option>
              </select>
            </FilterSection>

            <FilterSection title="Time Period">
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-2"
                value={activeInvestigationTab?.draftFilters.financialYear ?? ''}
                onChange={(e) =>
                  updateActiveInvestigationTab((current) => ({
                    ...current,
                    draftFilters: { ...current.draftFilters, financialYear: e.target.value },
                  }))
                }
              >
                <option value="">Select Financial Year</option>
                <option value="2023">FY 2023-24</option>
                <option value="2024">FY 2024-25</option>
              </select>
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={activeInvestigationTab?.draftFilters.quarter ?? 'all'}
                onChange={(e) =>
                  updateActiveInvestigationTab((current) => ({
                    ...current,
                    draftFilters: { ...current.draftFilters, quarter: e.target.value },
                  }))
                }
              >
                <option value="all">All Quarters</option>
                <option value="q1">Q1</option>
                <option value="q2">Q2</option>
                <option value="q3">Q3</option>
                <option value="q4">Q4</option>
              </select>
            </FilterSection>

            <FilterSection title="Amount Filters">
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-2"
                placeholder="Enter custom threshold (e.g., 500000)"
                value={activeInvestigationTab?.draftFilters.customThreshold ?? ''}
                onChange={(e) =>
                  updateActiveInvestigationTab((current) => ({
                    ...current,
                    draftFilters: { ...current.draftFilters, customThreshold: e.target.value },
                  }))
                }
              />
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={activeInvestigationTab?.draftFilters.amountPreset === 'above500k'}
                    onChange={() =>
                      updateActiveInvestigationTab((current) => ({
                        ...current,
                        draftFilters: { ...current.draftFilters, amountPreset: 'above500k' },
                      }))
                    }
                  />
                  Above Rs.5,00,000
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={activeInvestigationTab?.draftFilters.amountPreset === 'top10expenses'}
                    onChange={() =>
                      updateActiveInvestigationTab((current) => ({
                        ...current,
                        draftFilters: { ...current.draftFilters, amountPreset: 'top10expenses' },
                      }))
                    }
                  />
                  Top 10% of expenses
                </label>
              </div>
            </FilterSection>

            <FilterSection title="Keyword Search">
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                placeholder="Search by keyword (e.g., adjustment, rent, being)"
                value={activeInvestigationTab?.draftFilters.keyword ?? ''}
                onChange={(e) =>
                  updateActiveInvestigationTab((current) => ({
                    ...current,
                    draftFilters: { ...current.draftFilters, keyword: e.target.value },
                  }))
                }
              />
            </FilterSection>

            <FilterSection title="Voucher Type">
              {['Journal', 'Payment', 'Receipt', 'Contra', 'Other'].map((item) => (
                <CheckRow
                  key={item}
                  label={item === 'Journal' ? 'Journal entries only' : item}
                  checked={activeInvestigationTab?.draftFilters.voucherTypes.includes(item) ?? false}
                  onChange={(checked) => updateMultiSelect('voucherTypes', item, checked)}
                />
              ))}
            </FilterSection>

            <FilterSection title="Currency">
              {['INR', 'USD', 'EUR', 'GBP'].map((item) => (
                <CheckRow
                  key={item}
                  label={item}
                  checked={activeInvestigationTab?.draftFilters.currencies.includes(item) ?? false}
                  onChange={(checked) => updateMultiSelect('currencies', item, checked)}
                />
              ))}
            </FilterSection>

            <div className="mt-5 space-y-2">
              <button
                className="w-full rounded-xl bg-[#0F766E] text-white font-semibold py-2.5"
                onClick={() =>
                  updateActiveInvestigationTab((current) => ({
                    ...current,
                    appliedFilters: cloneFilters(current.draftFilters),
                    hasRequested: true,
                  }))
                }
              >
                Apply Filters
              </button>
              <button
                className="w-full rounded-xl border border-slate-300 text-slate-700 font-semibold py-2.5"
                onClick={() => {
                  updateActiveInvestigationTab((current) => ({
                    ...current,
                    draftFilters: cloneFilters(EMPTY_FILTERS),
                    appliedFilters: cloneFilters(EMPTY_FILTERS),
                    queryInput: '',
                    appliedQuery: '',
                    nlResult: null,
                    nlError: null,
                    hasRequested: false,
                  }));
                }}
              >
                Reset Filters
              </button>
            </div>
          </aside>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          {!showFilters && (
            <div className="px-4 py-2 border-b border-slate-200 bg-slate-50">
              <button className="text-sm text-blue-600" onClick={() => setShowFilters(true)}>Show filters</button>
            </div>
          )}

          <div className="px-4 pt-2 border-b border-slate-200 flex items-center gap-2">
            {investigationTabs.map((workspace) => (
              <div key={workspace.id} className="flex items-center gap-1">
                {renamingTabId === workspace.id ? (
                  <input
                    autoFocus
                    className="px-3 py-1.5 text-sm border border-blue-300 rounded-md min-w-[140px]"
                    value={renameTabValue}
                    onChange={(e) => setRenameTabValue(e.target.value)}
                    onBlur={commitRenameTab}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRenameTab();
                      if (e.key === 'Escape') cancelRenameTab();
                    }}
                  />
                ) : (
                  <button
                    className={`px-4 py-2 border-b-2 text-sm ${
                      workspace.id === activeInvestigationTabId
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500'
                    }`}
                    onClick={() => {
                      if (workspace.id === activeInvestigationTabId) {
                        startRenameTab(workspace.id);
                      } else {
                        setActiveInvestigationTabId(workspace.id);
                      }
                    }}
                  >
                    {workspace.label}
                  </button>
                )}
              </div>
            ))}
            <button
              className="text-slate-500 text-sm font-semibold px-3 py-1.5 border border-slate-200 rounded-lg hover:text-slate-700 hover:border-slate-300"
              aria-label="Add tab"
              onClick={addInvestigationTab}
            >
              + New Tab
            </button>
          </div>

          <div className="flex-1 overflow-auto bg-slate-50">
            {activeInvestigationTab?.nlResult && (
              <div className="px-6 py-3 bg-white border-b border-slate-200 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">INTENT</span>
                  <p className="text-sm text-slate-700 font-medium italic">"{activeInvestigationTab.nlResult.intent}"</p>
                  <span className="text-xs text-slate-400 ml-auto">via {activeInvestigationTab.nlResult.parser_used} parser</span>
                </div>
                {activeInvestigationTab.nlResult.matched_controls.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-500 font-medium">Controls:</span>
                    {activeInvestigationTab.nlResult.matched_controls.map((ctrl) => (
                      <span key={ctrl} className="px-2 py-0.5 bg-teal-50 text-teal-700 text-xs font-medium rounded border border-teal-200">{ctrl}</span>
                    ))}
                  </div>
                )}
                {activeInvestigationTab.nlResult.assumptions.length > 0 && (
                  <div className="flex items-center gap-2 text-slate-500 text-xs">
                    <span className="font-medium">Assumptions:</span>
                    <span>{activeInvestigationTab.nlResult.assumptions.join(' · ')}</span>
                  </div>
                )}
                {activeInvestigationTab.nlResult.warnings.map((w, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 text-xs">
                    <span>⚠️</span>
                    <p>{w}</p>
                  </div>
                ))}
              </div>
            )}
            {activeInvestigationTab?.nlError && !activeInvestigationTab?.nlResult && (
              <div className="px-6 py-3 bg-red-50 border-b border-red-200">
                <div className="flex items-center gap-2 text-red-600 text-xs">
                  <span>⚠️</span>
                  <p className="font-medium">Query analysis unavailable — using text search fallback.</p>
                  <span className="text-red-400 ml-1">{activeInvestigationTab.nlError}</span>
                </div>
              </div>
            )}

            {investigationRows.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-16">
                {activeInvestigationTab?.isLoading ? (
                   <div className="flex flex-col items-center gap-3">
                     <div className="w-10 h-10 border-4 border-[#0F766E] border-t-transparent rounded-full animate-spin"></div>
                     <p className="text-xl font-medium text-slate-600">Analyzing query...</p>
                   </div>
                ) : (
                  <>
                    <p className="text-3xl text-slate-300 mb-2">No transactions to display</p>
                    <p className="text-2xl">
                      {activeInvestigationTab?.hasRequested
                        ? 'No rows matched this tab filters/query. Try different criteria.'
                        : 'Enter a query below or apply filters to view data'}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <table className="w-full min-w-max text-left">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    {(visibleColumns.length > 0 ? visibleColumns : ['No Data']).map((column) => (
                      <th key={column} className="px-4 py-3 text-sm font-semibold text-slate-700 whitespace-nowrap">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {investigationRows.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-100">
                      {visibleColumns.map((column) => (
                        <td key={`${idx}-${column}`} className="px-4 py-2.5 text-sm text-slate-700 whitespace-nowrap">
                          {toText(row[column]) || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-3 border-t border-slate-200 bg-white flex items-center gap-2">
            <input
              className="flex-1 border-2 border-[#0F766E] rounded-2xl px-4 py-2.5 text-sm"
              placeholder="List round-value transactions above Rs.1,00,000"
              value={activeInvestigationTab?.queryInput ?? ''}
              onChange={(e) =>
                updateActiveInvestigationTab((current) => ({
                  ...current,
                  queryInput: e.target.value,
                }))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRunQuery();
              }}
            />
            <button
              className="rounded-2xl bg-[#0F766E] text-white font-semibold px-5 py-2.5 disabled:opacity-50"
              disabled={activeInvestigationTab?.isLoading}
              onClick={handleRunQuery}
            >
              {activeInvestigationTab?.isLoading ? 'Running...' : 'Run Query'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
