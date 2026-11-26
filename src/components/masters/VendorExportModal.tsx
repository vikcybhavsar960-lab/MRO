import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileCode,
  CheckCircle2,
  X,
  Filter,
  Building,
  Check,
  ShieldAlert,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Vendor } from '../../types';
import {
  exportVendorsToExcel,
  exportVendorsToCSV,
  generateVendorDirectoryPDF,
  generateSingleVendorDossierPDF,
  VENDOR_EXPORT_COLUMNS,
  filterVendorsForExport,
  VendorExportOptions,
} from '../../services/dataExportService';
import { useApp } from '../../context/AppContext';

interface VendorExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendors: Vendor[];
  filteredVendors: Vendor[];
  selectedVendor?: Vendor | null;
  initialBrandFilter?: string;
  initialCategoryFilter?: string;
  initialCityFilter?: string;
}

export const VendorExportModal: React.FC<VendorExportModalProps> = ({
  isOpen,
  onClose,
  vendors,
  filteredVendors,
  selectedVendor,
  initialBrandFilter = 'ALL',
  initialCategoryFilter = 'ALL',
  initialCityFilter = 'ALL',
}) => {
  const { categories, brands, currentUser } = useApp();

  const [format, setFormat] = useState<'XLSX' | 'CSV' | 'PDF'>('XLSX');
  const [scope, setScope] = useState<'ALL' | 'FILTERED' | 'SELECTED'>('FILTERED');

  // Export filters
  const [selectedBrands, setSelectedBrands] = useState<string[]>(
    initialBrandFilter && initialBrandFilter !== 'ALL' ? [initialBrandFilter] : []
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialCategoryFilter && initialCategoryFilter !== 'ALL' ? [initialCategoryFilter] : []
  );
  const [selectedCity, setSelectedCity] = useState<string>(initialCityFilter || 'ALL');
  const [activeOnly, setActiveOnly] = useState<boolean>(false);

  // Column selection
  const [columnPreset, setColumnPreset] = useState<'ALL' | 'STANDARD' | 'CONTACTS'>('ALL');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    VENDOR_EXPORT_COLUMNS.map((c) => c.key)
  );
  const [includeBankDetails, setIncludeBankDetails] = useState<boolean>(false);

  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  // Compute unique cities across vendors
  const allCities = Array.from(new Set(vendors.map((v) => v.city).filter(Boolean))).sort();

  // Base list depending on scope
  let baseList: Vendor[] = [];
  if (scope === 'ALL') {
    baseList = vendors;
  } else if (scope === 'FILTERED') {
    baseList = filteredVendors;
  } else if (scope === 'SELECTED' && selectedVendor) {
    baseList = [selectedVendor];
  } else {
    baseList = vendors;
  }

  // Apply extra modal filters to preview count
  const exportOptions: VendorExportOptions = {
    activeOnly,
    cityFilter: selectedCity,
    brandFilter: selectedBrands.length > 0 ? selectedBrands : undefined,
    categoryFilter: selectedCategories.length > 0 ? selectedCategories : undefined,
    includeBankDetails,
    selectedColumns,
  };

  const finalVendorsToExport = filterVendorsForExport(baseList, exportOptions);

  const isSuperAdminOrAccounts =
    currentUser?.role === 'SUPER_ADMIN' ||
    (currentUser?.role as string) === 'ADMIN' ||
    (currentUser?.role as string) === 'Admin' ||
    currentUser?.role === 'ACCOUNTS_USER';

  const handleToggleColumn = (colKey: string) => {
    if (selectedColumns.includes(colKey)) {
      if (selectedColumns.length > 2) {
        setSelectedColumns(selectedColumns.filter((k) => k !== colKey));
      }
    } else {
      setSelectedColumns([...selectedColumns, colKey]);
    }
  };

  const handleSelectPreset = (preset: 'ALL' | 'STANDARD' | 'CONTACTS') => {
    setColumnPreset(preset);
    if (preset === 'ALL') {
      setSelectedColumns(VENDOR_EXPORT_COLUMNS.map((c) => c.key));
    } else if (preset === 'STANDARD') {
      setSelectedColumns([
        'srNo',
        'vendorId',
        'vendorName',
        'contactPerson',
        'mobile',
        'email',
        'city',
        'gstin',
        'materialCategories',
        'brandsSupplied',
        'paymentTerms',
        'status',
      ]);
    } else if (preset === 'CONTACTS') {
      setSelectedColumns([
        'srNo',
        'vendorId',
        'vendorName',
        'contactPerson',
        'mobile',
        'alternateMobile',
        'email',
        'address',
        'city',
        'state',
        'pincode',
      ]);
    }
  };

  const handleExecuteExport = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const filenameBase = `MRO_Vendors_${scope.toLowerCase()}_${timestamp}`;

    if (format === 'XLSX') {
      exportVendorsToExcel(finalVendorsToExport, {
        ...exportOptions,
        filename: `${filenameBase}.xlsx`,
      });
    } else if (format === 'CSV') {
      exportVendorsToCSV(finalVendorsToExport, `${filenameBase}.csv`, exportOptions);
    } else if (format === 'PDF') {
      if (scope === 'SELECTED' && selectedVendor) {
        generateSingleVendorDossierPDF(selectedVendor);
      } else {
        generateVendorDirectoryPDF(
          finalVendorsToExport,
          `MRO Certified Vendor Registry (${scope === 'ALL' ? 'Complete Master' : 'Filtered Selection'})`
        );
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl text-white">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Export Vendor Registry</h3>
              <p className="text-xs text-slate-400">
                Generate clean, formatted Excel (.xlsx), CSV, or PDF directory with multiple brands & categories
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {/* Format Selection */}
          <div className="space-y-2">
            <label className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block">
              1. Choose Export Format
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  id: 'XLSX',
                  name: 'Excel Workbook (.xlsx)',
                  desc: 'Formatted, frozen headers, autofilters, comma-separated brands',
                  icon: FileSpreadsheet,
                  color: 'text-emerald-600',
                  badge: 'Recommended',
                },
                {
                  id: 'CSV',
                  name: 'CSV Spreadsheet (.csv)',
                  desc: 'Universal comma-delimited with UTF-8 BOM encoding',
                  icon: FileCode,
                  color: 'text-blue-600',
                },
                {
                  id: 'PDF',
                  name: 'Executive PDF Directory',
                  desc: 'Landscape formatted procurement registry',
                  icon: FileText,
                  color: 'text-rose-600',
                },
              ].map((f) => {
                const Icon = f.icon;
                const isSelected = format === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormat(f.id as any)}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-500'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    {f.badge && (
                      <span className="absolute top-2 right-2 px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-black text-[9px]">
                        {f.badge}
                      </span>
                    )}
                    <Icon className={`w-5 h-5 ${f.color} mb-1.5`} />
                    <div className="font-bold text-slate-900 text-xs">{f.name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{f.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scope Selection */}
          <div className="space-y-2">
            <label className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block">
              2. Vendor Record Scope
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setScope('FILTERED')}
                className={`p-2.5 rounded-xl border font-bold text-center transition-all ${
                  scope === 'FILTERED'
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Filtered List ({filteredVendors.length})
              </button>

              <button
                type="button"
                onClick={() => setScope('ALL')}
                className={`p-2.5 rounded-xl border font-bold text-center transition-all ${
                  scope === 'ALL'
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                All Registered ({vendors.length})
              </button>

              <button
                type="button"
                disabled={!selectedVendor}
                onClick={() => setScope('SELECTED')}
                className={`p-2.5 rounded-xl border font-bold text-center transition-all ${
                  scope === 'SELECTED'
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50'
                }`}
              >
                Active Selected ({selectedVendor ? '1' : '0'})
              </button>
            </div>
          </div>

          {/* Additional Export Filtering */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                3. Refine Export Filters
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                {finalVendorsToExport.length} of {vendors.length} vendors matched
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Filter by Brands */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Brand Filter</label>
                <select
                  value={selectedBrands[0] || 'ALL'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedBrands(val === 'ALL' ? [] : [val]);
                  }}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="ALL">All Brands (Any)</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter by Category */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Material Category</label>
                <select
                  value={selectedCategories[0] || 'ALL'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedCategories(val === 'ALL' ? [] : [val]);
                  }}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter by City */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">City</label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="ALL">All Cities</option>
                  {allCities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="activeVendorsCheck"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300"
              />
              <label htmlFor="activeVendorsCheck" className="font-bold text-slate-700 cursor-pointer">
                Export ACTIVE (Certified) Vendors only (exclude Inactive / Blocked)
              </label>
            </div>
          </div>

          {/* Column Customization */}
          {format !== 'PDF' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  4. Select Columns to Include
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('ALL')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      columnPreset === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    All 21 Columns
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('STANDARD')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      columnPreset === 'STANDARD' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Directory
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('CONTACTS')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      columnPreset === 'CONTACTS' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Contact / Address
                  </button>
                </div>
              </div>

              {/* Grid of columns */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                {VENDOR_EXPORT_COLUMNS.map((col) => {
                  const isChecked = selectedColumns.includes(col.key);
                  return (
                    <button
                      key={col.key}
                      type="button"
                      onClick={() => handleToggleColumn(col.key)}
                      className={`p-1.5 text-left rounded text-[11px] font-medium flex items-center justify-between transition-colors ${
                        isChecked
                          ? 'bg-blue-50 text-blue-900 font-bold border border-blue-200'
                          : 'bg-white text-slate-600 border border-slate-100 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{col.label}</span>
                      {isChecked && <Check className="w-3 h-3 text-blue-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Sensitive Bank Details Authorization Checkbox */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="exportBankDetailsCheck"
                      disabled={!isSuperAdminOrAccounts}
                      checked={includeBankDetails}
                      onChange={(e) => setIncludeBankDetails(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded border-amber-300"
                    />
                    <label htmlFor="exportBankDetailsCheck" className="font-bold text-xs text-amber-950 cursor-pointer">
                      Include Sensitive Bank Coordinates in Export
                    </label>
                  </div>
                  <p className="text-[10px] text-amber-700 leading-snug">
                    Per security compliance, vendor bank accounts, IFSC codes, and branches are only exported when explicitly authorized.
                    {!isSuperAdminOrAccounts && ' (Restricted to Super Admin and Accounts roles).'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Export Summary Banner */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between text-blue-950">
            <div>
              <div className="font-bold text-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Ready to Download: {finalVendorsToExport.length} Vendor Records</span>
              </div>
              <p className="text-[11px] text-blue-700 mt-0.5">
                Multi-brand rule applied: Multiple brands displayed in the same cell separated by commas.
              </p>
            </div>
            <span className="font-mono font-black text-sm bg-blue-600 text-white px-2.5 py-1 rounded-lg">
              {format}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-medium">
            Database transactions: <strong>{finalVendorsToExport.length} rows</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-white"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={finalVendorsToExport.length === 0 || downloadSuccess}
              onClick={handleExecuteExport}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-xs disabled:opacity-50 shadow-blue-500/20"
            >
              <Download className="w-4 h-4" />
              <span>
                {downloadSuccess
                  ? 'Downloaded!'
                  : `Download ${format} (${finalVendorsToExport.length})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
