import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthUser } from '../types/auth';
import { createWorkbook, getWorkbooks } from '../api/workbooksApi';
import type { Workbook } from '../types/workbook';

interface WorkbookRow {
  id: string;
  clientName: string;
  financialYear: string;
  functionalCurrency: string;
  engagementType: string;
  status: 'In Progress' | 'Draft' | 'Completed';
  lastModified: string;
  riskScore: number;
}

interface WorkbookForm {
  clientName: string;
  financialYear: string;
  functionalCurrency: string;
  engagementType: string;
}

const DEFAULT_FORM: WorkbookForm = {
  clientName: '',
  financialYear: '',
  functionalCurrency: 'INR - Indian Rupee',
  engagementType: '',
};

const CURRENCY_OPTIONS = [
  'INR - Indian Rupee',
  'USD - US Dollar',
  'EUR - Euro',
  'GBP - British Pound',
  'AED - UAE Dirham',
];

function mapWorkbookRow(item: Workbook): WorkbookRow {
  return {
    id: item.id,
    clientName: item.client_name,
    financialYear: item.financial_year,
    functionalCurrency: item.functional_currency,
    engagementType: item.engagement_type ?? '',
    status: item.status,
    lastModified: toRelativeTime(item.last_modified),
    riskScore: item.risk_score,
  };
}

function toRelativeTime(isoValue: string): string {
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) return 'Recently updated';

  const deltaMs = Date.now() - parsed.getTime();
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function statusClass(status: WorkbookRow['status']): string {
  if (status === 'In Progress') {
    return 'bg-cyan-100 text-cyan-800';
  }
  if (status === 'Completed') {
    return 'bg-emerald-100 text-emerald-700';
  }
  return 'bg-slate-100 text-slate-600';
}

function riskClass(score: number): string {
  if (score >= 80) return 'text-red-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-emerald-600';
}

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AU';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function PostLoginWorkbooksPage({
  user,
  token,
  onLogout,
  onOpenWorkbook,
}: {
  user: AuthUser;
  token: string;
  onLogout: () => void;
  onOpenWorkbook: (workbookId: string) => void;
}) {
  const [workbooks, setWorkbooks] = useState<WorkbookRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<WorkbookForm>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setApiError('Session token missing. Please login again.');
        setLoadingRows(false);
        return;
      }

      try {
        const rows = await getWorkbooks(token);
        setWorkbooks(rows.map(mapWorkbookRow));
        setApiError(null);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unable to load workbooks.';
        setApiError(message);
      } finally {
        setLoadingRows(false);
      }
    };

    void load();
  }, [token]);

  const canCreate = useMemo(
    () =>
      form.clientName.trim().length >= 2 &&
      form.financialYear.trim().length >= 4 &&
      form.functionalCurrency.trim().length > 0,
    [form.clientName, form.financialYear, form.functionalCurrency],
  );

  const openCreateModal = () => {
    setForm(DEFAULT_FORM);
    setFormError(null);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setFormError(null);
  };

  const updateForm = (key: keyof WorkbookForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreateWorkbook = async () => {
    if (!canCreate) {
      setFormError('Client Name, Financial Year, and Functional Currency are required.');
      return;
    }

    setCreating(true);
    try {
      const created = await createWorkbook(token, {
        client_name: form.clientName.trim(),
        financial_year: form.financialYear.trim(),
        functional_currency: form.functionalCurrency,
        engagement_type: form.engagementType.trim() || undefined,
      });
      setWorkbooks((prev) => [mapWorkbookRow(created), ...prev]);
      setApiError(null);
      closeCreateModal();
      onOpenWorkbook(created.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to create workbook.';
      setFormError(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-slate-800">
      <header className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-4xl leading-tight font-semibold tracking-[-0.015em] text-slate-900">
              General Ledger Scrutiny
            </h1>
            <p className="text-xl text-slate-500 mt-1">Enterprise Audit Intelligence Platform</p>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-4 rounded-xl px-3 py-2 hover:bg-slate-50 transition-colors"
            title="Logout"
          >
            <span className="w-10 h-10 rounded-full bg-[#0f766e] text-white text-sm font-semibold flex items-center justify-center">
              {userInitials(user.name)}
            </span>
            <span className="text-left">
              <span className="block text-lg font-semibold text-slate-900 leading-tight">{user.name}</span>
              <span className="block text-sm text-slate-500 leading-tight">{user.email}</span>
            </span>
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      </header>

      <main className="px-8 py-10">
        <section className="max-w-[1280px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
            <div>
              <h2 className="text-5xl font-semibold tracking-[-0.02em] text-slate-900">Workbooks</h2>
              <p className="text-2xl text-slate-600 mt-1">Manage audit engagement workbooks</p>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-3 rounded-2xl bg-[#0f766e] text-white text-xl font-semibold px-7 py-4 shadow-sm hover:bg-[#115e59] transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
              </svg>
              Create New Workbook
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {apiError && (
              <div className="mx-6 mt-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {apiError}
              </div>
            )}

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-7 py-5 text-xl font-semibold text-slate-700">Client Name</th>
                  <th className="px-7 py-5 text-xl font-semibold text-slate-700">Financial Year</th>
                  <th className="px-7 py-5 text-xl font-semibold text-slate-700">Status</th>
                  <th className="px-7 py-5 text-xl font-semibold text-slate-700">Last Modified</th>
                  <th className="px-7 py-5 text-xl font-semibold text-slate-700">Risk Score</th>
                </tr>
              </thead>
              <tbody>
                {loadingRows ? (
                  <tr>
                    <td colSpan={5} className="px-7 py-10 text-center text-slate-500 text-lg">
                      Loading workbooks...
                    </td>
                  </tr>
                ) : workbooks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-7 py-10 text-center text-slate-500 text-lg">
                      No workbooks yet. Click Create New Workbook to add your first one.
                    </td>
                  </tr>
                ) : workbooks.map((workbook) => (
                  <tr
                    key={workbook.id}
                    className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50 cursor-pointer"
                    onClick={() => onOpenWorkbook(workbook.id)}
                  >
                    <td className="px-7 py-7 text-2xl font-medium text-slate-800">{workbook.clientName}</td>
                    <td className="px-7 py-7 text-2xl text-slate-600">{workbook.financialYear}</td>
                    <td className="px-7 py-7">
                      <span className={`inline-flex px-4 py-2 rounded-lg text-lg font-medium ${statusClass(workbook.status)}`}>
                        {workbook.status}
                      </span>
                    </td>
                    <td className="px-7 py-7 text-2xl text-slate-600">{workbook.lastModified}</td>
                    <td className={`px-7 py-7 text-3xl font-semibold ${riskClass(workbook.riskScore)}`}>
                      {workbook.riskScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-[560px] bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200">
              <h3 className="text-3xl font-semibold text-slate-900">Create New Workbook</h3>
              <p className="text-lg text-slate-500 mt-1">Set up a new audit engagement workbook</p>
            </div>

            <div className="px-6 py-5 space-y-4">
              <FormField label="Client Name" required>
                <input
                  value={form.clientName}
                  onChange={(e) => updateForm('clientName', e.target.value)}
                  placeholder="e.g., Acme Corporation Ltd."
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/35"
                />
              </FormField>

              <FormField label="Financial Year" required>
                <input
                  value={form.financialYear}
                  onChange={(e) => updateForm('financialYear', e.target.value)}
                  placeholder="e.g., FY 2023-24"
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/35"
                />
              </FormField>

              <FormField label="Functional Currency" required>
                <select
                  value={form.functionalCurrency}
                  onChange={(e) => updateForm('functionalCurrency', e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/35"
                >
                  {CURRENCY_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Engagement Type">
                <input
                  value={form.engagementType}
                  onChange={(e) => updateForm('engagementType', e.target.value)}
                  placeholder="e.g., Statutory Audit (optional)"
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/35"
                />
              </FormField>

              {formError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
              <button
                type="button"
                onClick={closeCreateModal}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-lg font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreateWorkbook()}
                disabled={!canCreate || creating}
                className="flex-1 rounded-xl bg-[#0f766e] px-4 py-2.5 text-lg font-semibold text-white hover:bg-[#115e59] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Workbook'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-lg font-semibold text-slate-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
