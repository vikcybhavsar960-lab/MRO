import React, { useState } from 'react';
import { X, FileSpreadsheet, CheckCircle2, Download, ExternalLink, RefreshCw, Key, ShieldCheck, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { syncToGoogleSheetsAPI, exportToCsv, SheetExportRow } from '../../services/googleSheetsService';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({ isOpen, onClose }) => {
  const { requirements, customerQuotations, customerPOs, vendorPOs, proformaInvoices } = useApp();
  const [sheetName, setSheetName] = useState(`ProcureMRO_Master_Pipeline_${new Date().toISOString().split('T')[0]}`);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; spreadsheetUrl?: string; message?: string } | null>(null);

  if (!isOpen) return null;

  const rows: SheetExportRow[] = requirements.map((req) => {
    const qtn = customerQuotations.find((q) => q.requirementId === req.id);
    const cpo = customerPOs.find((c) => c.requirementId === req.id);
    const vpo = vendorPOs.find((v) => v.requirementId === req.id);
    const pi = proformaInvoices.find((p) => p.requirementId === req.id);

    const selling = qtn?.grandTotal || (cpo ? cpo.poAmount : 0);
    const purchase = vpo?.totalAmount || (pi ? pi.totalAmount : 0);
    const margin = selling > 0 && purchase > 0 ? selling - purchase : 0;
    const marginPct = selling > 0 ? (margin / selling) * 100 : 0;

    return {
      requirementId: req.id,
      customerName: req.customerName,
      status: req.status,
      itemsSummary: req.items.map((i) => `${i.itemName} (${i.quantity})`).join(', '),
      quotationId: qtn?.id,
      customerPoId: cpo?.customerPoNumber,
      vendorPoId: vpo?.id,
      vendorName: vpo?.vendorName,
      sellingValue: selling,
      purchaseValue: purchase,
      grossMargin: margin,
      marginPercent: marginPct,
      date: req.requirementDate,
    };
  });

  const handleSync = async () => {
    setLoading(true);
    setResult(null);
    const res = await syncToGoogleSheetsAPI(rows, sheetName);
    setLoading(false);
    setResult(res);
  };

  const handleDownloadCsv = () => {
    exportToCsv(rows, `${sheetName}.csv`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Google Sheets Integration</h3>
              <p className="text-xs text-emerald-300 font-medium">Google Workspace OAuth 2.0 API</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          {/* OAuth Scope Verified badge */}
          <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 text-emerald-900 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-xs">OAuth Authorization Active</div>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Authorized Scope: <code className="font-mono bg-emerald-100 px-1 py-0.2 rounded text-[10px]">https://www.googleapis.com/auth/spreadsheets</code>
              </p>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Target Google Spreadsheet Title</label>
            <input
              type="text"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-slate-600">
            <div className="font-bold text-slate-800 text-xs">Data Prepared for Synchronization:</div>
            <p>• Total Supply Chain Orders: <strong>{rows.length} records</strong></p>
            <p>• Columns Included: REQ ID, Customer, Status, Items, QTN, CPO, VPO, Vendor, Selling, Landed Cost, Gross Margin, Margin %</p>
          </div>

          {result && (
            <div className={`p-4 rounded-xl border ${result.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{result.message}</span>
              </div>
              {result.spreadsheetUrl && (
                <a
                  href={result.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 underline"
                >
                  <span>Open Google Spreadsheet</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <button
              onClick={handleDownloadCsv}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-300 font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV File</span>
            </button>

            <button
              onClick={handleSync}
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-md shadow-emerald-500/20"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span>Sync to Google Sheets Now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
