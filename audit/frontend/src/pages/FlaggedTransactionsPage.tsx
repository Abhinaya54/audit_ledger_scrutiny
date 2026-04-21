import { useEffect, useMemo, useRef, useState } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

import type { FlaggedRow, ScrutinyResponse } from '../types/scrutiny';
import { formatNumber } from '../utils/format';

type ApprovalStatus = 'pending' | 'approved' | 'rejected';
type WorkspaceTab = 'overview' | 'investigation' | 'documentation';

interface Props {
  results: ScrutinyResponse | null;
  reviewRows: Record<string, unknown>[];
  exporting: boolean;
  approvalStatus: ApprovalStatus;
  workbookName?: string;
  financialYear?: string;
  workbookStatus?: string;
  lastModified?: string;
  onApprove: () => void;
  onReject: () => void;
  onExport: () => void;
  onUploadClick: () => void;
}

interface ControlRow {
  controlName: string;
  triggeredTransactions: number;
  exposure: number;
  status: 'Active' | 'Inactive';
}

interface InvestigationFilters {
  ledgerType: string;
  accountSeries: string;
  financialYear: string;
  quarter: string;
  customThreshold: string;
  amountPreset: '' | 'above500k' | 'top10expenses';
  keyword: string;
  voucherTypes: string[];
  currencies: string[];
}

interface InvestigationWorkspaceState {
  id: string;
  label: string;
  draftFilters: InvestigationFilters;
  appliedFilters: InvestigationFilters;
  queryInput: string;
  appliedQuery: string;
  hasRequested: boolean;
}

function toText(value: unknown): string {
  if (value == null) return '';
  return String(value);
}

function splitCategories(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function rupeesToCr(amount: number): string {
  return `Rs.${(amount / 10000000).toFixed(1)} Cr`;
}

function computeRiskBuckets(flaggedRows: FlaggedRow[]) {
  const initial = {
    high: { count: 0, exposure: 0 },
    medium: { count: 0, exposure: 0 },
    low: { count: 0, exposure: 0 },
  };

  for (const row of flaggedRows) {
    const amount = Math.abs(Number(row.amount) || 0);
    const categories = splitCategories(toText(row.scrutiny_category));

    const isHigh =
      categories.includes('ML Anomaly') ||
      categories.includes('Manual Journal') ||
      amount >= 100000;
    const isMedium =
      categories.includes('Period End') ||
      categories.includes('Weekend Entries') ||
      categories.includes('Duplicate Check') ||
      categories.includes('Round Numbers');

    if (isHigh) {
      initial.high.count += 1;
      initial.high.exposure += amount;
    } else if (isMedium) {
      initial.medium.count += 1;
      initial.medium.exposure += amount;
    } else {
      initial.low.count += 1;
      initial.low.exposure += amount;
    }
  }

  return initial;
}

function rowsByCategory(flaggedRows: FlaggedRow[], name: string): FlaggedRow[] {
  return flaggedRows.filter((row) => splitCategories(toText(row.scrutiny_category)).includes(name));
}

function buildControls(flaggedRows: FlaggedRow[]): ControlRow[] {
  const manual = rowsByCategory(flaggedRows, 'Manual Journal');
  const duplicate = rowsByCategory(flaggedRows, 'Duplicate Check');
  const weakNarration = rowsByCategory(flaggedRows, 'Weak Narration');
  const ml = rowsByCategory(flaggedRows, 'ML Anomaly');
  const periodEnd = rowsByCategory(flaggedRows, 'Period End');
  const weekend = rowsByCategory(flaggedRows, 'Weekend Entries');
  const round = rowsByCategory(flaggedRows, 'Round Numbers');
  const unusualAmount = flaggedRows.filter((row) => Math.abs(Number(row.amount) || 0) >= 150000);

  const sumAmount = (rows: FlaggedRow[]) => rows.reduce((acc, row) => acc + Math.abs(Number(row.amount) || 0), 0);

  return [
    {
      controlName: 'Manual Entry',
      triggeredTransactions: manual.length,
      exposure: sumAmount(manual),
      status: 'Active',
    },
    {
      controlName: 'Unusual Amount',
      triggeredTransactions: unusualAmount.length,
      exposure: sumAmount(unusualAmount),
      status: 'Active',
    },
    {
      controlName: 'Sequence Gap',
      triggeredTransactions: duplicate.length,
      exposure: sumAmount(duplicate),
      status: 'Active',
    },
    {
      controlName: 'Suspicious Keyword',
      triggeredTransactions: weakNarration.length,
      exposure: sumAmount(weakNarration),
      status: 'Inactive',
    },
    {
      controlName: 'Outlier Anomaly',
      triggeredTransactions: ml.length,
      exposure: sumAmount(ml),
      status: 'Active',
    },
    {
      controlName: 'Period End Transaction',
      triggeredTransactions: periodEnd.length,
      exposure: sumAmount(periodEnd),
      status: 'Active',
    },
    {
      controlName: 'Weekend Entry',
      triggeredTransactions: weekend.length,
      exposure: sumAmount(weekend),
      status: 'Active',
    },
    {
      controlName: 'Round Number Pattern',
      triggeredTransactions: round.length,
      exposure: sumAmount(round),
      status: 'Active',
    },
  ];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AU';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatShortDate(value?: string): string {
  if (!value) return 'Recently updated';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const deltaMs = Date.now() - date.getTime();
  const hours = Math.floor(deltaMs / 3600000);
  if (hours < 1) return 'Last modified just now';
  if (hours < 24) return `Last modified ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `Last modified ${days} day${days === 1 ? '' : 's'} ago`;
}

const EMPTY_FILTERS: InvestigationFilters = {
  ledgerType: '',
  accountSeries: '',
  financialYear: '',
  quarter: 'all',
  customThreshold: '',
  amountPreset: '',
  keyword: '',
  voucherTypes: [],
  currencies: [],
};

function cloneFilters(source: InvestigationFilters): InvestigationFilters {
  return {
    ledgerType: source.ledgerType,
    accountSeries: source.accountSeries,
    financialYear: source.financialYear,
    quarter: source.quarter,
    customThreshold: source.customThreshold,
    amountPreset: source.amountPreset,
    keyword: source.keyword,
    voucherTypes: [...source.voucherTypes],
    currencies: [...source.currencies],
  };
}

function createWorkspace(index: number): InvestigationWorkspaceState {
  return {
    id: `tab-${Date.now()}-${index}`,
    label: `Investigation ${index}`,
    draftFilters: cloneFilters(EMPTY_FILTERS),
    appliedFilters: cloneFilters(EMPTY_FILTERS),
    queryInput: '',
    appliedQuery: '',
    hasRequested: false,
  };
}

function getRowValue(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    if (key in row && row[key] != null) {
      return String(row[key]);
    }
  }
  return '';
}

function getRowAmount(row: Record<string, unknown>): number {
  const direct = Number(getRowValue(row, ['amount', 'Amount']));
  if (Number.isFinite(direct) && direct > 0) return Math.abs(direct);

  const debit = Number(getRowValue(row, ['debit', 'Debit']));
  const credit = Number(getRowValue(row, ['credit', 'Credit']));
  if (Number.isFinite(debit) || Number.isFinite(credit)) {
    return Math.abs(Number.isFinite(debit) ? debit : 0) + Math.abs(Number.isFinite(credit) ? credit : 0);
  }
  return 0;
}

function toFileSafeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'audit_working_paper';
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function rowMatchesQuery(row: Record<string, unknown>, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;

  const hay = Object.values(row)
    .map((value) => String(value ?? '').toLowerCase())
    .join(' ');

  const amountMatch = trimmed.match(/(?:above|over|greater than)\s*₹?\s*([\d,]+)/i);
  if (amountMatch) {
    const threshold = Number(amountMatch[1].replace(/,/g, ''));
    if (Number.isFinite(threshold) && getRowAmount(row) <= threshold) {
      return false;
    }
  }

  const tokens = trimmed
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !['show', 'list', 'find', 'transaction', 'transactions', 'above', 'over'].includes(token));

  if (tokens.length === 0) {
    return true;
  }

  return tokens.some((token) => hay.includes(token));
}

export default function FlaggedTransactionsPage({
  results,
  reviewRows,
  exporting,
  approvalStatus,
  workbookName = 'Workbook',
  financialYear = '-',
  workbookStatus = 'In Progress',
  lastModified,
  onApprove,
  onReject,
  onExport,
  onUploadClick,
}: Props) {
  void approvalStatus;
  void onApprove;
  void onReject;

  const today = new Date();
  const preparedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  const [tab, setTab] = useState<WorkspaceTab>('overview');
  const [showFilters, setShowFilters] = useState(true);
  const [investigationTabs, setInvestigationTabs] = useState<InvestigationWorkspaceState[]>([createWorkspace(1)]);
  const [activeInvestigationTabId, setActiveInvestigationTabId] = useState<string>(() => createWorkspace(1).id);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameTabValue, setRenameTabValue] = useState('');
  const documentationEditorHostRef = useRef<HTMLDivElement | null>(null);
  const documentationQuillRef = useRef<Quill | null>(null);
  const [documentationHtml, setDocumentationHtml] = useState<string>(
    () =>
      [
        '<h2>Audit Working Paper - Ledger Scrutiny</h2>',
        `<p>Client: ${escapeHtml(workbookName)}</p>`,
        `<p>Financial Year: ${escapeHtml(financialYear)}</p>`,
        `<p>Prepared by: Auditor Name | Date: ${escapeHtml(preparedDate)}</p>`,
        '<br/>',
        '<h3>Objective</h3>',
        '<p>To identify and document high-risk transactions flagged during general ledger scrutiny analysis.</p>',
        '<br/>',
        '<h3>Scope</h3>',
        `<p>Review of general ledger transactions for the period ${escapeHtml(financialYear)}.</p>`,
        '<br/>',
        '<h3>Findings</h3>',
        '<p>Insert evidence below to document specific transactions requiring attention.</p>',
      ].join(''),
  );
  const [insertedEvidenceIds, setInsertedEvidenceIds] = useState<string[]>([]);

  useEffect(() => {
    const host = documentationEditorHostRef.current;
    if (!host || documentationQuillRef.current) return;

    const quill = new Quill(host, {
      theme: 'snow',
      modules: { toolbar: false },
    });

    documentationQuillRef.current = quill;
    quill.clipboard.dangerouslyPasteHTML(documentationHtml, 'silent');

    quill.on('text-change', () => {
      setDocumentationHtml(quill.root.innerHTML);
    });
  }, [documentationHtml]);

  useEffect(() => {
    const quill = documentationQuillRef.current;
    if (!quill) return;

    if (quill.root.innerHTML !== documentationHtml) {
      const currentSelection = quill.getSelection();
      quill.clipboard.dangerouslyPasteHTML(documentationHtml, 'silent');
      if (currentSelection) {
        quill.setSelection(currentSelection.index, currentSelection.length, 'silent');
      }
    }
  }, [documentationHtml]);

  useEffect(() => {
    if (!investigationTabs.some((item) => item.id === activeInvestigationTabId)) {
      setActiveInvestigationTabId(investigationTabs[0]?.id ?? '');
    }
  }, [investigationTabs, activeInvestigationTabId]);

  if (!results) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h2 className="text-2xl font-semibold text-slate-800 mb-2">No Analysis Yet</h2>
        <p className="text-slate-500 mb-5">Run risk analysis to generate workbook overview.</p>
        <button
          onClick={onUploadClick}
          className="px-5 py-2.5 bg-[#0F766E] text-white rounded-xl text-sm font-semibold hover:bg-[#115E59]"
        >
          Upload General Ledger
        </button>
      </div>
    );
  }

  const flaggedRows = results.flagged_rows;
  const totalExposure = flaggedRows.reduce((acc, row) => acc + Math.abs(Number(row.amount) || 0), 0);
  const risk = computeRiskBuckets(flaggedRows);
  const controls = buildControls(flaggedRows);
  const anomalyEvidenceRows = [...flaggedRows].sort((a, b) => Math.abs(Number(b.amount) || 0) - Math.abs(Number(a.amount) || 0));
  const reviewColumns = reviewRows.length > 0 ? Object.keys(reviewRows[0]) : [];
  const visibleColumns = reviewColumns.slice(0, 8);

  const activeInvestigationTab = useMemo(() => {
    return investigationTabs.find((item) => item.id === activeInvestigationTabId) ?? investigationTabs[0];
  }, [investigationTabs, activeInvestigationTabId]);

  const updateActiveInvestigationTab = (updater: (current: InvestigationWorkspaceState) => InvestigationWorkspaceState) => {
    setInvestigationTabs((prev) =>
      prev.map((item) => (item.id === activeInvestigationTabId ? updater(item) : item)),
    );
  };

  const investigationRows = useMemo(() => {
    if (!activeInvestigationTab?.hasRequested) {
      return [];
    }

    const appliedFilters = activeInvestigationTab.appliedFilters;
    const appliedQuery = activeInvestigationTab.appliedQuery;

    let rows = [...reviewRows];

    rows = rows.filter((row) => {
      if (!appliedFilters.ledgerType) return true;
      const ledger = getRowValue(row, ['ledger_type', 'Ledger Type', 'ledger_name', 'Account']);
      return ledger.toLowerCase().includes(appliedFilters.ledgerType.toLowerCase());
    });

    rows = rows.filter((row) => {
      if (!appliedFilters.accountSeries) return true;
      const account = getRowValue(row, ['account', 'Account', 'ledger_name']);
      return account.includes(appliedFilters.accountSeries);
    });

    rows = rows.filter((row) => {
      if (!appliedFilters.financialYear) return true;
      const year = getRowValue(row, ['fiscal_year', 'Financial Year', 'date', 'Date']);
      return year.toLowerCase().includes(appliedFilters.financialYear.toLowerCase());
    });

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

    rows = rows.filter((row) => rowMatchesQuery(row, appliedQuery));

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

  const insertEvidenceToDocument = (row: FlaggedRow, rowIndex: number) => {
    const evidenceId = `${row.voucher_no || 'voucher'}-${row.date || 'date'}-${rowIndex}`;

    const evidenceHtml = [
      '<p><strong>Evidence</strong></p>',
      `<p>Date: ${escapeHtml(row.date || '-')}</p>`,
      `<p>Journal ID: ${escapeHtml(row.voucher_no || '-')}</p>`,
      `<p>Account: ${escapeHtml(row.ledger_name || '-')}</p>`,
      `<p>Amount: Rs.${escapeHtml(formatNumber(Math.abs(Number(row.amount) || 0)))}</p>`,
      `<p>Category: ${escapeHtml(row.scrutiny_category || '-')}</p>`,
      '<br/>',
    ].join('');

    setDocumentationHtml((prev) => `${prev}${evidenceHtml}`);
    setInsertedEvidenceIds((prev) => (prev.includes(evidenceId) ? prev : [...prev, evidenceId]));
  };

  const handleToolbarMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Keep Quill selection stable while clicking custom toolbar buttons.
    event.preventDefault();
  };

  const getQuill = () => documentationQuillRef.current;

  const ensureQuillSelection = () => {
    const quill = getQuill();
    if (!quill) return null;

    const current = quill.getSelection();
    if (current) {
      return current;
    }

    const length = quill.getLength();
    quill.setSelection(Math.max(0, length - 1), 0, 'silent');
    return quill.getSelection();
  };

  const syncDocumentationFromQuill = () => {
    const quill = getQuill();
    if (!quill) return;
    setDocumentationHtml(quill.root.innerHTML);
  };

  const applyInlineFormat = (format: 'bold' | 'italic' | 'underline') => {
    const quill = getQuill();
    const range = ensureQuillSelection();
    if (!quill || !range) return;

    const current = quill.getFormat(range.index, range.length);
    const nextValue = !Boolean(current[format]);
    quill.format(format, nextValue, 'user');
    syncDocumentationFromQuill();
  };

  const applyListFormat = (listType: 'ordered' | 'bullet') => {
    const quill = getQuill();
    const range = ensureQuillSelection();
    if (!quill || !range) return;

    const current = quill.getFormat(range.index, range.length);
    const nextValue = current.list === listType ? false : listType;
    quill.formatLine(range.index, Math.max(range.length, 1), 'list', nextValue, 'user');
    syncDocumentationFromQuill();
  };

  const applyHeading2 = () => {
    const quill = getQuill();
    const range = ensureQuillSelection();
    if (!quill || !range) return;

    const current = quill.getFormat(range.index, range.length);
    const nextValue = current.header === 2 ? false : 2;
    quill.formatLine(range.index, Math.max(range.length, 1), 'header', nextValue, 'user');
    syncDocumentationFromQuill();
  };

  const handleExportDoc = () => {
    const safeWorkbook = toFileSafeName(workbookName || 'workbook');
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Audit Working Paper</title>
          <style>
            body { font-family: Calibri, Arial, sans-serif; font-size: 12pt; line-height: 1.55; }
            h1 { font-size: 20pt; margin-bottom: 12px; }
            p { margin: 0 0 8px 0; }
            pre { white-space: pre-wrap; font-family: Calibri, Arial, sans-serif; }
          </style>
        </head>
        <body>
          <h1>Audit Working Paper - Ledger Scrutiny</h1>
          ${documentationHtml}
        </body>
      </html>
    `;
    const blob = new Blob([html], { type: 'application/msword' });
    downloadBlob(blob, `${safeWorkbook}_audit_working_paper.doc`);
  };

  const handleExportPdf = async () => {
    const safeWorkbook = toFileSafeName(workbookName || 'workbook');

    try {
      const jspdfModule = await import('jspdf');
      const doc = new jspdfModule.jsPDF({ unit: 'pt', format: 'a4' });
      const marginX = 40;
      const marginY = 40;
      const lineHeight = 18;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);

      const plainText = (documentationQuillRef.current?.getText() || '').trim();
      const lines = doc.splitTextToSize(plainText, pageWidth - marginX * 2);
      let currentY = marginY;

      for (const line of lines) {
        if (currentY > pageHeight - marginY) {
          doc.addPage();
          currentY = marginY;
        }
        doc.text(String(line), marginX, currentY);
        currentY += lineHeight;
      }

      doc.save(`${safeWorkbook}_audit_working_paper.pdf`);
    } catch {
      onExport();
    }
  };

  return (
    <div className="bg-[#f8fafc] min-h-[80vh] border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 bg-white border-b border-slate-200">
        <button
          className="text-slate-600 text-xl font-medium flex items-center gap-2 hover:text-slate-900"
          onClick={onUploadClick}
        >
          <span>‹</span>
          <span>Back to Workbooks</span>
        </button>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-slate-700">
            <p className="text-4xl font-semibold text-slate-900">{workbookName}</p>
            <span className="text-slate-400">|</span>
            <p className="text-3xl">{financialYear}</p>
            <span className="text-slate-400">|</span>
            <span className="text-lg rounded-md px-3 py-1 bg-blue-100 text-blue-700">{workbookStatus}</span>
            <span className="text-slate-400">|</span>
            <p className="text-2xl text-slate-500">{formatShortDate(lastModified)}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">{initials('Auditor User')}</span>
            <span className="w-8 h-8 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center">JD</span>
            <span className="text-sm text-slate-500 ml-1">Collaborators</span>
          </div>
        </div>
      </div>

      <div className="px-6 pt-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-8 text-lg font-medium">
          <TabButton active={tab === 'overview'} onClick={() => setTab('overview')} label="Overview" />
          <TabButton active={tab === 'investigation'} onClick={() => setTab('investigation')} label="Investigation" />
          <TabButton active={tab === 'documentation'} onClick={() => setTab('documentation')} label="Documentation" />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {tab === 'overview' && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-4xl font-semibold text-slate-900">Risk Overview</h2>
                <p className="text-2xl text-slate-600 mt-1">Comprehensive risk analysis of uploaded ledger</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setTab('investigation')}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-lg font-medium text-slate-700 bg-white"
                >
                  Review Source Data
                </button>
                <button
                  onClick={onUploadClick}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-lg font-medium text-slate-700 bg-white"
                >
                  Replace Dataset
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              <KpiCard title="Total Transactions" value={formatNumber(results.summary.total_entries)} />
              <KpiCard title="Total Exposure" value={rupeesToCr(totalExposure)} />
              <KpiCard title="High Risk" value={formatNumber(risk.high.count)} subValue={rupeesToCr(risk.high.exposure)} color="red" />
              <KpiCard title="Medium Risk" value={formatNumber(risk.medium.count)} subValue={rupeesToCr(risk.medium.exposure)} color="amber" />
              <KpiCard title="Low Risk" value={formatNumber(risk.low.count)} subValue={rupeesToCr(risk.low.exposure)} color="green" />
            </div>

            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-3xl font-semibold text-slate-900">Control Point Library</h3>
                  <p className="text-xl text-slate-600 mt-1">Risk detection controls applied to this ledger</p>
                </div>
                <button className="px-4 py-2 border border-slate-300 rounded-xl text-lg font-medium text-slate-700 bg-white">
                  Modify Controls
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-lg font-semibold text-slate-700">Control Name</th>
                      <th className="px-6 py-4 text-lg font-semibold text-slate-700">Triggered Transactions</th>
                      <th className="px-6 py-4 text-lg font-semibold text-slate-700">Exposure</th>
                      <th className="px-6 py-4 text-lg font-semibold text-slate-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {controls.map((row) => (
                      <tr key={row.controlName} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-6 py-4 text-2xl text-slate-800">{row.controlName}</td>
                        <td className="px-6 py-4 text-2xl text-slate-700">{formatNumber(row.triggeredTransactions)}</td>
                        <td className="px-6 py-4 text-2xl text-slate-700">{rupeesToCr(row.exposure)}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`text-lg px-3 py-1 rounded-full ${
                              row.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {tab === 'investigation' && (
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex min-h-[66vh]">
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
                            if (e.key === 'Enter') {
                              commitRenameTab();
                            }
                            if (e.key === 'Escape') {
                              cancelRenameTab();
                            }
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

                <div className="flex-1 overflow-auto">
                  {investigationRows.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-16">
                      <p className="text-3xl text-slate-300 mb-2">No transactions to display</p>
                      <p className="text-2xl">
                        {activeInvestigationTab?.hasRequested
                          ? 'No rows matched this tab filters/query. Try different criteria.'
                          : 'Enter a query below or apply filters to view data'}
                      </p>
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
                      if (e.key === 'Enter') {
                        updateActiveInvestigationTab((current) => ({
                          ...current,
                          appliedQuery: current.queryInput,
                          hasRequested: true,
                        }));
                      }
                    }}
                  />
                  <button
                    className="rounded-2xl bg-[#0F766E] text-white font-semibold px-5 py-2.5"
                    onClick={() =>
                      updateActiveInvestigationTab((current) => ({
                        ...current,
                        appliedQuery: current.queryInput,
                        hasRequested: true,
                      }))
                    }
                  >
                    Run Query
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === 'documentation' && (
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="border-r border-slate-200 min-w-0">
                <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
                  <div className="flex items-center gap-2 text-slate-700">
                    <button type="button" onMouseDown={handleToolbarMouseDown} onClick={() => applyInlineFormat('bold')} className="h-9 w-9 rounded-md border border-slate-300 bg-white text-base font-semibold">B</button>
                    <button type="button" onMouseDown={handleToolbarMouseDown} onClick={() => applyInlineFormat('italic')} className="h-9 w-9 rounded-md border border-slate-300 bg-white text-base italic">I</button>
                    <button type="button" onMouseDown={handleToolbarMouseDown} onClick={() => applyInlineFormat('underline')} className="h-9 w-9 rounded-md border border-slate-300 bg-white text-base underline">U</button>
                    <span className="h-6 w-px bg-slate-300 mx-1" />
                    <button type="button" onMouseDown={handleToolbarMouseDown} onClick={() => applyListFormat('ordered')} className="h-9 w-9 rounded-md border border-slate-300 bg-white text-sm">1.</button>
                    <button type="button" onMouseDown={handleToolbarMouseDown} onClick={() => applyListFormat('bullet')} className="h-9 w-9 rounded-md border border-slate-300 bg-white text-sm">-</button>
                    <span className="h-6 w-px bg-slate-300 mx-1" />
                    <button type="button" onMouseDown={handleToolbarMouseDown} onClick={applyHeading2} className="h-9 px-3 rounded-md border border-slate-300 bg-white text-sm font-semibold">H2</button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleExportPdf}
                      disabled={exporting}
                      className="px-4 py-2 rounded-lg bg-[#0F766E] text-white text-base font-semibold disabled:opacity-50"
                    >
                      {exporting ? 'Generating...' : 'Export as PDF'}
                    </button>
                    <button
                      onClick={handleExportDoc}
                      disabled={exporting}
                      className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-base font-semibold disabled:opacity-50"
                    >
                      Export as DOC
                    </button>
                  </div>
                </div>

                <div className="p-5">
                  <div className="documentation-quill">
                    <div ref={documentationEditorHostRef} />
                  </div>

                </div>
              </div>

              <aside className="bg-[#f8fafc]">
                <div className="px-4 py-4 border-b border-slate-200">
                  <h4 className="text-2xl font-semibold text-slate-900">Selected Evidence</h4>
                  <p className="text-lg text-slate-500 mt-1">{insertedEvidenceIds.length} transactions added</p>
                </div>

                <div className="p-4 space-y-3 max-h-[700px] overflow-y-auto">
                  {anomalyEvidenceRows.map((row, index) => {
                    const evidenceId = `${row.voucher_no || 'voucher'}-${row.date || 'date'}-${index}`;
                    const alreadyAdded = insertedEvidenceIds.includes(evidenceId);

                    return (
                      <article key={evidenceId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="text-sm text-slate-500">Date</p>
                            <p className="text-2xl font-medium text-slate-800">{row.date || '-'}</p>
                          </div>
                          <span className="text-sm px-3 py-1 rounded-lg bg-amber-100 text-amber-800">
                            {splitCategories(toText(row.scrutiny_category))[0] || 'Flagged'}
                          </span>
                        </div>

                        <div className="space-y-2 mb-4">
                          <div>
                            <p className="text-sm text-slate-500">Journal ID</p>
                            <p className="text-xl font-medium text-slate-800">{row.voucher_no || '-'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-500">Account</p>
                            <p className="text-xl font-medium text-slate-800">{row.ledger_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-500">Amount</p>
                            <p className="text-3xl font-semibold text-slate-900">Rs.{formatNumber(Math.abs(Number(row.amount) || 0))}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => insertEvidenceToDocument(row, index)}
                          className={`w-full rounded-lg px-4 py-2.5 text-base font-semibold ${
                            alreadyAdded ? 'bg-slate-200 text-slate-600' : 'bg-[#0F766E] text-white hover:bg-[#115E59]'
                          }`}
                        >
                          {alreadyAdded ? 'Added to Document' : 'Insert into Document'}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </aside>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`pb-3 border-b-2 transition-colors ${
        active ? 'text-blue-600 border-blue-600' : 'text-slate-600 border-transparent hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h5 className="text-base font-semibold text-slate-800 mb-2">{title}</h5>
      {children}
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700 mb-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function KpiCard({
  title,
  value,
  subValue,
  color,
}: {
  title: string;
  value: string;
  subValue?: string;
  color?: 'red' | 'amber' | 'green';
}) {
  const accentClass =
    color === 'red' ? 'border-l-4 border-l-red-500' : color === 'amber' ? 'border-l-4 border-l-amber-500' : color === 'green' ? 'border-l-4 border-l-emerald-500' : '';

  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-6 ${accentClass}`}>
      <p className="text-xl text-slate-500 mb-2">{title}</p>
      <p className="text-5xl font-semibold text-slate-900 leading-none">{value}</p>
      {subValue ? <p className="text-2xl text-slate-600 mt-2">{subValue}</p> : null}
    </div>
  );
}
