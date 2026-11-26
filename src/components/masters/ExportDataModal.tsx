import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileCode,
  CheckCircle2,
  X,
  Filter,
  Users,
  Building,
  Printer,
  Sparkles,
} from 'lucide-react';
import { Customer, Vendor } from '../../types';
import {
  exportCustomersToCSV,
  exportVendorsToCSV,
  exportDataToJSON,
  generateCustomerDirectoryPDF,
  generateSingleCustomerDossierPDF,
  generateVendorDirectoryPDF,
  generateSingleVendorDossierPDF,
} from '../../services/dataExportService';

interface ExportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'CUSTOMERS' | 'VENDORS';
  data: Customer[] | Vendor[];
  filteredData: Customer[] | Vendor[];
  selectedItem?: Customer | Vendor | null;
}

export const ExportDataModal: React.FC<ExportDataModalProps> = ({
  isOpen,
  onClose,
  type,
  data,
  filteredData,
  selectedItem,
}) => {
  const [scope, setScope] = useState<'ALL' | 'FILTERED' | 'SELECTED'>('ALL');
  const [format, setFormat] = useState<'CSV' | 'JSON' | 'PDF'>('CSV');
  const [preset, setPreset] = useState<'ALL_FIELDS' | 'STATUTORY' | 'CONTACTS'>('ALL_FIELDS');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const isCustomer = type === 'CUSTOMERS';

  // Determine export list
  let targetItems: (Customer | Vendor)[] = [];
  if (scope === 'ALL') {
    targetItems = data;
  } else if (scope === 'FILTERED') {
    targetItems = filteredData;
  } else if (scope === 'SELECTED' && selectedItem) {
    targetItems = [selectedItem];
  } else {
    targetItems = data;
  }

  const handleExport = () => {
    const timestamp = new Date().toISOString().split('T')[0];

    if (isCustomer) {
      const custList = targetItems as Customer[];
      if (format === 'CSV') {
        exportCustomersToCSV(custList, undefined, `ProcureMRO_Customers_${scope.toLowerCase()}_${timestamp}.csv`);
      } else if (format === 'JSON') {
        exportDataToJSON(custList, `ProcureMRO_Customers_${scope.toLowerCase()}_${timestamp}.json`);
      } else if (format === 'PDF') {
        if (scope === 'SELECTED' && selectedItem) {
          generateSingleCustomerDossierPDF(selectedItem as Customer);
        } else {
          generateCustomerDirectoryPDF(custList, `${scope === 'ALL' ? 'All Registered Clients' : 'Filtered Search Results'}`);
        }
      }
    } else {
      const vendList = targetItems as Vendor[];
      if (format === 'CSV') {
        exportVendorsToCSV(vendList, `ProcureMRO_Vendors_${scope.toLowerCase()}_${timestamp}.csv`);
      } else if (format === 'JSON') {
        exportDataToJSON(vendList, `ProcureMRO_Vendors_${scope.toLowerCase()}_${timestamp}.json`);
      } else if (format === 'PDF') {
        if (scope === 'SELECTED' && selectedItem) {
          generateSingleVendorDossierPDF(selectedItem as Vendor);
        } else {
          generateVendorDirectoryPDF(vendList, `${scope === 'ALL' ? 'All Certified Suppliers' : 'Filtered Search Results'}`);
        }
      }
    }

    setDownloadSuccess(true);
    setTimeout(() => {
      setDownloadSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400">
              {isCustomer ? <Users className="w-5 h-5" /> : <Building className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-base">
                Export {isCustomer ? 'Customer Master Data' : 'Vendor & Supplier Data'}
              </h3>
              <p className="text-xs text-slate-400">
                Generate CSV spreadsheets, structured JSON backup, or formal PDF reports
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5 text-xs text-slate-700">
          {/* 1. Choose Scope */}
          <div>
            <label className="font-bold text-slate-800 block mb-2">1. Select Record Scope</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setScope('ALL')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  scope === 'ALL'
                    ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="block font-bold text-xs">All Records</span>
                <span className="text-[11px] text-slate-500 font-normal">
                  Total: {data.length} {isCustomer ? 'Clients' : 'Vendors'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setScope('FILTERED')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  scope === 'FILTERED'
                    ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="block font-bold text-xs">Filtered List</span>
                <span className="text-[11px] text-slate-500 font-normal">
                  Matching: {filteredData.length} records
                </span>
              </button>

              <button
                type="button"
                onClick={() => setScope('SELECTED')}
                disabled={!selectedItem}
                className={`p-3 rounded-xl border text-left transition-all ${
                  scope === 'SELECTED'
                    ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold shadow-xs'
                    : !selectedItem
                    ? 'opacity-40 cursor-not-allowed border-slate-200 bg-slate-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="block font-bold text-xs">Active Profile</span>
                <span className="text-[11px] text-slate-500 font-normal truncate block">
                  {selectedItem ? (selectedItem as any).companyName : 'None selected'}
                </span>
              </button>
            </div>
          </div>

          {/* 2. Choose Format */}
          <div>
            <label className="font-bold text-slate-800 block mb-2">2. Select Export Format</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormat('CSV')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center ${
                  format === 'CSV'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet className={`w-5 h-5 ${format === 'CSV' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span className="font-bold text-xs">Excel / CSV</span>
                <span className="text-[10px] text-slate-500 font-normal">Spreadsheet tabular</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('JSON')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center ${
                  format === 'JSON'
                    ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <FileCode className={`w-5 h-5 ${format === 'JSON' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className="font-bold text-xs">JSON Backup</span>
                <span className="text-[10px] text-slate-500 font-normal">Raw structured data</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('PDF')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center ${
                  format === 'PDF'
                    ? 'border-purple-600 bg-purple-50 text-purple-900 font-bold shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <FileText className={`w-5 h-5 ${format === 'PDF' ? 'text-purple-600' : 'text-slate-400'}`} />
                <span className="font-bold text-xs">Formatted PDF</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  {scope === 'SELECTED' ? 'Single Dossier' : 'Directory Matrix'}
                </span>
              </button>
            </div>
          </div>

          {/* 3. Preview Box */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-700">Preview Export Manifest:</span>
              <span className="font-bold text-blue-600 bg-white px-2 py-0.5 rounded border border-blue-200">
                {targetItems.length} records selected
              </span>
            </div>

            <div className="max-h-28 overflow-y-auto divide-y divide-slate-200 text-[11px] bg-white rounded-lg border border-slate-200 p-2 font-mono">
              {targetItems.slice(0, 3).map((item, idx) => (
                <div key={item.id} className="py-1 flex justify-between items-center">
                  <span className="font-bold text-slate-800">{item.id}: {item.companyName}</span>
                  <span className="text-slate-500 text-[10px]">{item.city}, {item.state}</span>
                </div>
              ))}
              {targetItems.length > 3 && (
                <div className="py-1 text-slate-400 text-center font-sans text-[10px]">
                  + {targetItems.length - 3} more records included in output file
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs"
          >
            Cancel
          </button>

          <button
            onClick={handleExport}
            disabled={targetItems.length === 0}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all ${
              downloadSuccess
                ? 'bg-emerald-600'
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
            }`}
          >
            {downloadSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Downloaded Successfully!</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Generate & Download Export ({format})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
