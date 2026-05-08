import React, { useEffect, useRef, useState } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { FlaggedRow } from '../../types/scrutiny';
import { formatNumber } from '../../utils/format';
import { downloadBlob, escapeHtml, toFileSafeName } from './utils';

interface DocumentationTabProps {
  workbookName: string;
  financialYear: string;
  anomalyEvidenceRows: FlaggedRow[];
  exporting: boolean;
  onExport: () => void;
}

export default function DocumentationTab({
  workbookName,
  financialYear,
  anomalyEvidenceRows,
  exporting,
  onExport,
}: DocumentationTabProps) {
  const documentationEditorHostRef = useRef<HTMLDivElement | null>(null);
  const documentationQuillRef = useRef<Quill | null>(null);

  const today = new Date();
  const preparedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

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
        '</br>',
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
    event.preventDefault();
  };

  const getQuill = () => documentationQuillRef.current;

  const ensureQuillSelection = () => {
    const quill = getQuill();
    if (!quill) return null;
    const current = quill.getSelection();
    if (current) return current;
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
  );
}
