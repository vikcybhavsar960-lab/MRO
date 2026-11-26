import React, { useState } from 'react';
import { X, History, FileSpreadsheet, Download, CheckCircle2, AlertCircle, Clock, Search, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CatalogueImportHistoryRecord } from '../../types/catalogImport';
import { generateErrorWorkbook } from '../../services/catalogImportEngine';
import * as XLSX from 'xlsx';

interface ImportHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportHistoryModal: React.FC<ImportHistoryModalProps> = ({ isOpen, onClose }) => {
  const { catalogueImportHistory } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<CatalogueImportHistoryRecord | null>(null);

  if (!isOpen) return null;

  const filtered = catalogueImportHistory.filter((rec) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (rec.fileName || '').toLowerCase().includes(q) ||
      (rec.id || '').toLowerCase().includes(q) ||
      (rec.uploadedBy || '').toLowerCase().includes(q)
    );
  });

  const handleDownloadHistoricalErrors = (rec: CatalogueImportHistoryRecord) => {
    if (!rec.errorReport || rec.errorReport.length === 0) {
      alert('No errors recorded for this import!');
      return;
    }
    const wb = generateErrorWorkbook(rec.errorReport);
    XLSX.writeFile(wb, `Import_Errors_${rec.id}_${rec.fileName}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-indigo-950">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-indigo-600/30 border border-indigo-500/40 rounded-xl text-indigo-400">
              <History className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Brand Catalogue Import History & Audit Log</h2>
              <p className="text-xs text-slate-400">
                Track historical batch imports, review error reports, and audit changes across suppliers.
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by file name, import ID, or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 font-medium"
            />
          </div>

          <div className="text-xs text-slate-500 font-semibold">
            Total Imports: {catalogueImportHistory.length}
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">No Import History Found</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Upload your first Excel or CSV catalogue to populate the permanent audit history log.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Import ID</th>
                      <th className="py-2.5 px-3">File Name</th>
                      <th className="py-2.5 px-3">Uploaded By</th>
                      <th className="py-2.5 px-3">Date & Time</th>
                      <th className="py-2.5 px-3 text-right">Total Rows</th>
                      <th className="py-2.5 px-3 text-right">New SKUs</th>
                      <th className="py-2.5 px-3 text-right">Updated</th>
                      <th className="py-2.5 px-3 text-right">Errors</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 font-mono text-indigo-700 font-bold">{rec.id}</td>
                        <td className="py-2 px-3 font-medium text-slate-900">{rec.fileName}</td>
                        <td className="py-2 px-3 text-slate-700">{rec.uploadedBy}</td>
                        <td className="py-2 px-3 text-slate-500 text-[11px] font-mono">
                          {rec.uploadDate ? new Date(rec.uploadDate).toLocaleString('en-IN') : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">{rec.totalRows}</td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-700 font-bold">{rec.newRows || 0}</td>
                        <td className="py-2 px-3 text-right font-mono text-amber-700 font-bold">{rec.updatedRows || 0}</td>
                        <td className="py-2 px-3 text-right font-mono text-rose-700 font-bold">{rec.errorRows || 0}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              rec.importStatus === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {rec.importStatus}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedRecord(rec)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold"
                            >
                              Details
                            </button>
                            {rec.errorReport && rec.errorReport.length > 0 && (
                              <button
                                onClick={() => handleDownloadHistoricalErrors(rec)}
                                title="Download Error Excel"
                                className="p-1 hover:bg-rose-100 text-rose-700 rounded"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Detail drawer when selected */}
              {selectedRecord && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      <span>Import Details: {selectedRecord.id} ({selectedRecord.fileName})</span>
                    </h4>
                    <button
                      onClick={() => setSelectedRecord(null)}
                      className="text-slate-400 hover:text-slate-600 font-semibold"
                    >
                      Close Details
                    </button>
                  </div>

                  <p className="text-slate-600">{selectedRecord.importSummary}</p>

                  {selectedRecord.errorReport && selectedRecord.errorReport.length > 0 && (
                    <div className="border border-rose-200 rounded-lg bg-white p-3 space-y-2">
                      <div className="flex items-center justify-between text-rose-800 font-bold">
                        <span>Recorded Error Rows ({selectedRecord.errorReport.length})</span>
                        <button
                          onClick={() => handleDownloadHistoricalErrors(selectedRecord)}
                          className="flex items-center gap-1 text-xs font-semibold text-rose-700 hover:underline"
                        >
                          <Download className="w-3 h-3" /> Download Excel
                        </button>
                      </div>
                      <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 font-mono text-[11px]">
                        {selectedRecord.errorReport.map((err, i) => (
                          <div key={i} className="py-1 flex items-center justify-between text-slate-600">
                            <span>Row {err.row}: {err.originalValue}</span>
                            <span className="text-rose-600">{err.error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
