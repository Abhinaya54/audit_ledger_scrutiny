import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Loader2, Copy, Download, RefreshCw, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import FiltersSidebar from '../components/FiltersSidebar';
import QueryBox from '../components/QueryBox';

interface Tab {
  id: string;
  label: string;
  transactions: Transaction[];
  lastRefreshed: Date | null;
}

interface Transaction {
  id: string;
  date: string;
  voucherNo: string;
  account: string;
  narration: string;
  debit: string;
  credit: string;
  balance: string;
  currency: string;
  scrutinyCategory: string;
  scrutinyReason: string;
}

interface ActiveFilter {
  id: string;
  label: string;
  value: string;
}

interface DashboardProps {
  embedded?: boolean;
  workbookId?: string;
  analysisSummary?: Record<string, any>;
}

export default function Dashboard({ embedded = false, analysisSummary }: DashboardProps) {
  const navigate = useNavigate();
  const [tabs, setTabs] = useState<Tab[]>([
    { id: '1', label: 'Tab 1', transactions: [], lastRefreshed: null }
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [isLoading, setIsLoading] = useState(false);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showMenuForTab, setShowMenuForTab] = useState<string | null>(null);
  const [showReuploadModal, setShowReuploadModal] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  // Load real flagged transactions from analysis summary
  useEffect(() => {
    if (!analysisSummary) return;
    const flaggedRows = analysisSummary.flagged_rows || [];
    if (flaggedRows.length === 0) return;

    const mappedTransactions: Transaction[] = flaggedRows.map((row: any, index: number) => ({
      id: String(index + 1),
      date: row.date || '',
      voucherNo: row.journal_id || row.voucher_no || '',
      account: row.account_name || row.account || '',
      narration: row.narration || '',
      debit: row.debit ? `₹${Number(row.debit).toLocaleString()}` : '',
      credit: row.credit ? `₹${Number(row.credit).toLocaleString()}` : '',
      balance: row.balance ? `₹${Number(row.balance).toLocaleString()}` : '',
      currency: row.currency || 'INR',
      scrutinyCategory: row.scrutiny_category || 'Unknown',
      scrutinyReason: row.scrutiny_reason || '',
    }));

    setTabs(prevTabs =>
      prevTabs.map(tab =>
        tab.id === activeTabId
          ? { ...tab, transactions: mappedTransactions, lastRefreshed: new Date() }
          : tab
      )
    );
  }, [analysisSummary, activeTabId]);

  const addTab = () => {
    const newTabNumber = tabs.length + 1;
    const newTab: Tab = {
      id: String(newTabNumber),
      label: `Tab ${newTabNumber}`,
      transactions: [],
      lastRefreshed: null
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[0].id);
    }
  };

  const startRenaming = (tabId: string, currentLabel: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingTabId(tabId);
    setRenameValue(currentLabel);
    setShowMenuForTab(null);
  };

  const finishRenaming = () => {
    if (renamingTabId && renameValue.trim()) {
      setTabs(tabs.map(tab =>
        tab.id === renamingTabId ? { ...tab, label: renameValue.trim() } : tab
      ));
    }
    setRenamingTabId(null);
    setRenameValue('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      finishRenaming();
    } else if (e.key === 'Escape') {
      setRenamingTabId(null);
      setRenameValue('');
    }
  };

  const handleQuery = (query: string) => {
    console.log('Query submitted:', query);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };

  const handleApplyFilters = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };

  const handleResetFilters = () => {
    setActiveFilters([]);
    setTabs(prevTabs =>
      prevTabs.map(tab =>
        tab.id === activeTabId
          ? { ...tab, transactions: [], lastRefreshed: null }
          : tab
      )
    );
  };

  const removeFilter = (filterId: string) => {
    const newFilters = activeFilters.filter(f => f.id !== filterId);
    setActiveFilters(newFilters);
    if (newFilters.length === 0) {
      setTabs(prevTabs =>
        prevTabs.map(tab =>
          tab.id === activeTabId
            ? { ...tab, transactions: [], lastRefreshed: null }
            : tab
        )
      );
    }
  };

  const handleDownloadReport = () => {
    console.log('Download report for tab:', activeTabId);
  };

  const handleReuploadData = () => {
    setShowReuploadModal(true);
  };

  const getTimeSinceRefresh = (lastRefreshed: Date | null): string => {
    if (!lastRefreshed) return '';
    const seconds = Math.floor((new Date().getTime() - lastRefreshed.getTime()) / 1000);
    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  };

  const handleAddToDocumentation = (transaction: Transaction) => {
    toast.success('Transaction added to Documentation');
    console.log('Added to documentation:', transaction);
  };

  return (
    <div className={`flex flex-col bg-gray-50 overflow-hidden ${embedded ? 'h-full' : 'h-screen'}`}>
      {/* Header */}
      {!embedded && (
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => navigate('/risk-intelligence')}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Risk Dashboard
              </button>
              <h1 className="text-xl text-gray-900">Transaction Investigation</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleReuploadData}
                className="px-4 py-2 text-sm bg-white text-gray-700 rounded border border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Re-upload data
              </button>
              <button
                onClick={handleDownloadReport}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <FiltersSidebar
          onApplyFilters={handleApplyFilters}
          onResetFilters={handleResetFilters}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="bg-white border-b border-gray-200 flex items-center px-4 flex-shrink-0">
            {tabs.map(tab => (
              <div key={tab.id} className="relative">
                <div
                  className={`px-4 py-3 text-sm border-b-2 transition-colors flex items-center gap-2 group cursor-pointer ${
                    activeTabId === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {renamingTabId === tab.id ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={finishRenaming}
                      onKeyDown={handleRenameKeyDown}
                      autoFocus
                      className="w-32 px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <span onClick={() => setActiveTabId(tab.id)}>{tab.label}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenuForTab(showMenuForTab === tab.id ? null : tab.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-gray-200 rounded"
                        type="button"
                      >
                        <MoreHorizontal className="w-3 h-3" />
                      </button>
                      {tabs.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            closeTab(tab.id, e);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          type="button"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </>
                  )}
                </div>

                {showMenuForTab === tab.id && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowMenuForTab(null)}
                    />
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg py-1 z-20 min-w-[120px]">
                      <button
                        onClick={(e) => startRenaming(tab.id, tab.label, e)}
                        className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100"
                      >
                        Rename tab
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            <button
              onClick={addTab}
              className="px-3 py-3 text-gray-400 hover:text-gray-600 transition-colors"
              title="Add new tab"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Results Section */}
          <div className="flex-1 overflow-auto bg-white pb-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">Loading transactions...</p>
                </div>
              </div>
            ) : activeTab && activeTab.transactions.length > 0 ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab.lastRefreshed?.getTime() || 'empty'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-gray-500">
                        Results update only when 'Apply Filters' is clicked or a query is submitted.
                      </p>
                      {activeTab.lastRefreshed && (
                        <p className="text-xs text-gray-600 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" />
                          Results refreshed {getTimeSinceRefresh(activeTab.lastRefreshed)}
                        </p>
                      )}
                    </div>
                  </div>

                  {activeFilters.length > 0 && (
                    <div className="px-4 py-3 border-b border-gray-200 bg-blue-50">
                      <div className="flex items-start gap-3">
                        <span className="text-xs text-gray-600 pt-1.5 whitespace-nowrap">Active Filters:</span>
                        <div className="flex flex-wrap gap-2">
                          {activeFilters.map(filter => (
                            <div
                              key={filter.id}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-blue-200 rounded-full text-xs text-gray-700"
                            >
                              <span>
                                <span className="font-medium">{filter.label}:</span> {filter.value}
                              </span>
                              <button
                                onClick={() => removeFilter(filter.id)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                                title={`Remove ${filter.label} filter`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs text-gray-600 border-b">Date</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-600 border-b">Voucher No</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-600 border-b">Account</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-600 border-b">Narration</th>
                        <th className="px-4 py-3 text-right text-xs text-gray-600 border-b">Debit</th>
                        <th className="px-4 py-3 text-right text-xs text-gray-600 border-b">Credit</th>
                        <th className="px-4 py-3 text-right text-xs text-gray-600 border-b">Balance</th>
                        <th className="px-4 py-3 text-center text-xs text-gray-600 border-b">Currency</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-600 border-b">Scrutiny Category</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-600 border-b w-80">Scrutiny Reason</th>
                        <th className="px-4 py-3 text-center text-xs text-gray-600 border-b w-20">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTab.transactions.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-gray-50 border-b border-gray-100">
                          <td className="px-4 py-3 text-sm text-gray-700">{transaction.date}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{transaction.voucherNo}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{transaction.account}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {transaction.narration || <span className="text-gray-400 italic">No narration</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 text-right">{transaction.debit}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 text-right">{transaction.credit}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 text-right">{transaction.balance}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-center">{transaction.currency}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className="inline-block px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs">
                              {transaction.scrutinyCategory}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 w-80">{transaction.scrutinyReason}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleAddToDocumentation(transaction)}
                              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                              title="Add to Documentation"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[400px] text-gray-400">
                <div className="text-center">
                  <p className="text-sm">No transactions to display</p>
                  <p className="text-xs mt-1">Enter a query below or apply filters to view data</p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Docked Query Bar */}
          <div className="bg-white border-t border-gray-200 px-6 py-5 flex-shrink-0" style={{ boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.04)' }}>
            <QueryBox onQuery={handleQuery} />
          </div>
        </div>
      </div>

      {/* Reupload Data Modal */}
      {showReuploadModal && (
        <div className="fixed inset-0 z-50 backdrop-blur-md bg-white bg-opacity-10 flex items-center justify-center p-6">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full relative">
            <button
              onClick={() => setShowReuploadModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-6">
              <h2 className="text-lg text-left text-gray-900 mb-4">Re-upload ledger?</h2>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to re-upload the ledger?<br />
                Doing so will terminate the current session and clear all current analysis.
              </p>
              <div className="flex justify-between gap-3">
                <button
                  onClick={() => setShowReuploadModal(false)}
                  className="flex-1 px-4 py-3 text-sm bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowReuploadModal(false);
                    navigate('/');
                  }}
                  className="flex-1 px-4 py-3 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Yes, re-upload ledger
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

