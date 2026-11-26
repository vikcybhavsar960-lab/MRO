import React, { useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  X,
  AlertCircle,
  Users,
  Building,
  Layers,
  HelpCircle,
  Download,
  Package,
  Sparkles,
  Tag,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  parseCustomersCSV,
  parseCustomersExcel,
  parseVendorsCSV,
  parseVendorsExcel,
  parseProductsCSV,
  parseProductsExcel,
  downloadSampleCustomerCSV,
  downloadSampleVendorCSV,
  downloadSampleVendorExcel,
  downloadSampleProductCSV,
} from '../../services/dataExportService';
import { AlertTriangle } from 'lucide-react';

interface ImportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'CUSTOMERS' | 'VENDORS' | 'PRODUCTS';
}

export const ImportDataModal: React.FC<ImportDataModalProps> = ({
  isOpen,
  onClose,
  type,
}) => {
  const { importCustomersList, importVendorsList, importProductsList, vendors } = useApp();
  const [inputText, setInputText] = useState('');
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
  const [importResult, setImportResult] = useState<{
    totalUploaded: number;
    successfullyImported: number;
    skipped: number;
    failed: number;
    errorDetails: string[];
  } | null>(null);
  const [showErrorReport, setShowErrorReport] = useState<boolean>(false);

  if (!isOpen) return null;

  const isCustomer = type === 'CUSTOMERS';
  const isVendor = type === 'VENDORS';
  const isProduct = type === 'PRODUCTS';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          if (isVendor) {
            const parsed = parseVendorsExcel(buffer);
            if (parsed.length === 0) {
              setErrorMsg('No valid vendor rows detected in Excel file. Please ensure column headers match.');
              setPreviewItems([]);
            } else {
              setPreviewItems(parsed);
              setErrorMsg(null);
            }
          } else if (isProduct) {
            const parsed = parseProductsExcel(buffer);
            if (parsed.length === 0) {
              setErrorMsg('No valid product rows detected in Excel file. Please ensure column headers like "Item Name", "Brand", "Part Number" exist.');
              setPreviewItems([]);
            } else {
              setPreviewItems(parsed);
              setErrorMsg(null);
            }
          } else if (isCustomer) {
            const parsed = parseCustomersExcel(buffer);
            if (parsed.length === 0) {
              setErrorMsg('No valid customer rows detected in Excel file. Please ensure column headers like "Company Name", "Contact Person" exist.');
              setPreviewItems([]);
            } else {
              setPreviewItems(parsed);
              setErrorMsg(null);
            }
          }
        } catch (err: any) {
          setErrorMsg(`Error parsing Excel workbook: ${err.message || 'Invalid format'}`);
          setPreviewItems([]);
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInputText(content);
      parseContent(content, file.name.endsWith('.json'));
    };
    reader.readAsText(file);
  };

  const parseContent = (content: string, isJson: boolean) => {
    setErrorMsg(null);
    setImportResult(null);
    try {
      if (isJson || content.trim().startsWith('[') || content.trim().startsWith('{')) {
        const parsed = JSON.parse(content);
        const list = Array.isArray(parsed)
          ? parsed
          : parsed.data?.customers || parsed.data?.vendors || parsed.data?.products || [];
        if (list.length === 0) {
          setErrorMsg('No valid array of records found in JSON.');
          setPreviewItems([]);
        } else {
          setPreviewItems(list);
        }
      } else {
        // CSV parsing
        if (isCustomer) {
          const parsed = parseCustomersCSV(content);
          if (parsed.length === 0) {
            setErrorMsg('Could not detect valid customer rows in CSV. Please verify column headers.');
            setPreviewItems([]);
          } else {
            setPreviewItems(parsed);
          }
        } else if (isVendor) {
          const parsed = parseVendorsCSV(content);
          if (parsed.length === 0) {
            setErrorMsg('Could not detect valid vendor rows in CSV. Please verify column headers.');
            setPreviewItems([]);
          } else {
            setPreviewItems(parsed);
          }
        } else {
          const parsed = parseProductsCSV(content);
          if (parsed.length === 0) {
            setErrorMsg('Could not detect valid product items in CSV. Please check column headers.');
            setPreviewItems([]);
          } else {
            setPreviewItems(parsed);
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(`Parsing failed: ${err.message || 'Invalid format'}`);
      setPreviewItems([]);
    }
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    if (text.trim().length > 10) {
      parseContent(text, false);
    } else {
      setPreviewItems([]);
    }
  };

  const handleCommitImport = () => {
    if (previewItems.length === 0) return;

    let res: any;
    if (isCustomer) {
      res = importCustomersList(previewItems);
    } else if (isVendor) {
      res = importVendorsList(previewItems);
    } else {
      res = importProductsList(previewItems);
    }

    const total = previewItems.length;
    const imported = typeof res === 'object' && res.successfullyImported !== undefined ? res.successfullyImported : Number(res);
    const skipped = typeof res === 'object' && res.skipped !== undefined ? res.skipped : 0;
    const failed = typeof res === 'object' && res.failed !== undefined ? res.failed : 0;
    const errorDetails = typeof res === 'object' && Array.isArray(res.errorDetails) ? res.errorDetails : [];

    setSuccessCount(imported);
    setImportResult({
      totalUploaded: total,
      successfullyImported: imported,
      skipped,
      failed,
      errorDetails,
    });
  };

  const downloadErrorReportCSV = () => {
    if (!importResult || importResult.errorDetails.length === 0) return;
    const csvContent = '\uFEFF' + ['Error #,Detail', ...importResult.errorDetails.map((e, i) => `${i + 1},"${e.replace(/"/g, '""')}"`)].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Import_Exceptions_Report_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sampleCustomerCSV = `Company Name,Contact Person,Mobile,Email,GSTIN,PAN,City,State,Payment Terms
Tata Motors Car Plant,Anand Verma,+91 98220 99887,anand.verma@tatamotors.com,27AAACT2727Q1ZW,AAACT2727Q,Pune,Maharashtra,30 Days Net
Mahindra Aerospace,Rajeev Menon,+91 98450 11223,rajeev.menon@mahindra.com,29AAACM1234D1ZF,AAACM1234D,Bengaluru,Karnataka,45 Days Net`;

  const sampleVendorCSV = `Company Name,Contact Person,Mobile,Email,GSTIN,PAN,Brands,Products / Items Dealt In,Rating,City,State
Precision Bearings Co,Suresh Patel,+91 98220 44556,sales@precisionbearing.in,27AAACP1234F1ZX,AAACP1234F,"SKF, Timken","Deep Groove Ball Bearing 6205-2RSH; Spherical Roller Bearing 22212; Pillow Block UCF 205; Tapered Roller Bearing 30205",4.9,Pune,Maharashtra
Apex Industrial Drives,Nitin Deshmukh,+91 98450 77889,nitin@apexdrives.com,27AAACA9988K1ZV,AAACA9988K,"ABB, Siemens","3-Phase Induction Motor 5.5kW IE3; Low Voltage AC Drive ACS580 11kW; Air Circuit Breaker 1600A",4.8,Nashik,Maharashtra
Fenner Power Transmission,Rahul Shinde,+91 98220 33441,sales@fennerdist.in,27AAACF4455M1Z8,AAACF4455M,"Fenner, Gates","Industrial V-Belt B-52; Flange Coupling FCL 140; Timing Belt 8M-1200",4.9,Pune,Maharashtra`;

  const sampleProductCSV = `Item Name,Category,Sub Category,Brand,Part Number,Specification,UOM,Indicative Rate (INR),HSN Code,GST Rate (%),Stock Qty
Deep Groove Ball Bearing 6205-2RSH,Bearing,Deep Groove,SKF,6205-2RSH,"d=25mm, D=52mm, B=15mm, Rubber seals",NOS,485.00,84821010,18,120
3-Phase Induction Motor 5.5kW,Motor,Induction,ABB,M2BAX 132SMB4,"5.5kW / 7.5HP, 1450 RPM, 415V, IP55",NOS,32500.00,85015210,18,8
Flange Mounted Flexible Coupling FCL 140,Machine spare,Coupling,Fenner,FCL-140-PB,"Max bore 42mm, Nominal torque 160 Nm",SET,2150.00,84836090,18,25`;

  const sampleCSV = isCustomer ? sampleCustomerCSV : isVendor ? sampleVendorCSV : sampleProductCSV;

  const handleDownloadTemplate = () => {
    if (isCustomer) {
      downloadSampleCustomerCSV();
    } else if (isVendor) {
      downloadSampleVendorCSV();
    } else {
      downloadSampleProductCSV();
    }
  };

  const getEntityTitle = () => {
    if (isCustomer) return 'Customer Directory';
    if (isVendor) return 'Vendor Suppliers & Products Dealt In';
    return 'Product Catalog';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/30 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              {isCustomer ? <Users className="w-5 h-5" /> : isVendor ? <Building className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-base">
                Import {getEntityTitle()}
              </h3>
              <p className="text-xs text-slate-400">
                Bulk upload via CSV, Excel (.xlsx), or JSON into Live Enterprise Cloud Database
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 text-xs text-slate-700">
          {/* Template Download Ribbon */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-slate-800">Need standard template with headers?</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {isVendor && (
                  <button
                    type="button"
                    onClick={downloadSampleVendorExcel}
                    className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-all"
                    title="Download complete Excel workbook with Product Data columns and Brand Auto-Enrichment Guide"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Excel Template (.xlsx)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold shadow-xs transition-all"
                  title="Download CSV format template"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample CSV</span>
                </button>
              </div>
            </div>

            {isVendor && (
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-lg font-medium border border-emerald-200/60">
                <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>
                  <strong>Product Module Included:</strong> Simply list products in <code>Products / Items Dealt In</code> (separated by semicolons). Brands (e.g. SKF, ABB, Festo, Siemens) automatically auto-fill Category, HSN, UOM, and 18% GST without needing separate part numbers or rates!
                </span>
              </div>
            )}

          </div>

          {/* File Upload Option */}
          <div>
            <label className="font-bold text-slate-800 block mb-1">
              Upload Excel (.xlsx), CSV, or JSON File
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.json"
              onChange={handleFileUpload}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between text-slate-500 text-[11px] pt-1">
            <span>Or paste raw CSV or JSON data below:</span>
            <button
              type="button"
              onClick={() => handleTextChange(sampleCSV)}
              className="text-blue-600 hover:underline font-semibold"
            >
              Load Sample Data
            </button>
          </div>

          {/* Raw Text Area */}
          <textarea
            value={inputText}
            onChange={(e) => handleTextChange(e.target.value)}
            rows={4}
            placeholder={`Paste CSV headers and rows or JSON array...\nExample:\n${sampleCSV.split('\n').slice(0, 2).join('\n')}`}
            className="w-full p-2.5 text-[11px] font-mono border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500"
          />

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Import Result Summary Card */}
          {importResult && (
            <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3 border border-emerald-500/30">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>Import Completed</span>
                </span>
                <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                  ERP Cloud DB Synced
                </span>
              </div>

              {/* 4 Stat Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60 text-center">
                  <span className="text-[10px] text-slate-400 block font-semibold">Total Uploaded</span>
                  <span className="text-lg font-bold text-white font-mono">{importResult.totalUploaded}</span>
                </div>
                <div className="bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-700/50 text-center">
                  <span className="text-[10px] text-emerald-400 block font-semibold">Successfully Added</span>
                  <span className="text-lg font-bold text-emerald-300 font-mono">+{importResult.successfullyImported}</span>
                </div>
                <div className="bg-amber-950/40 p-2.5 rounded-lg border border-amber-700/50 text-center">
                  <span className="text-[10px] text-amber-400 block font-semibold">Skipped (Existing)</span>
                  <span className="text-lg font-bold text-amber-300 font-mono">{importResult.skipped}</span>
                </div>
                <div className="bg-rose-950/40 p-2.5 rounded-lg border border-rose-700/50 text-center">
                  <span className="text-[10px] text-rose-400 block font-semibold">Failed / Invalid</span>
                  <span className="text-lg font-bold text-rose-300 font-mono">{importResult.failed}</span>
                </div>
              </div>

              {/* Error / Skip details & Download */}
              {importResult.errorDetails.length > 0 && (
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-300 font-medium">
                      {importResult.errorDetails.length} notes/exceptions recorded:
                    </span>
                    <button
                      type="button"
                      onClick={downloadErrorReportCSV}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 text-[10px] font-bold rounded-lg border border-slate-700 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download Exceptions CSV</span>
                    </button>
                  </div>
                  <div className="max-h-24 overflow-y-auto bg-slate-950 p-2 rounded text-[10px] text-slate-400 font-mono space-y-1">
                    {importResult.errorDetails.slice(0, 10).map((err, i) => (
                      <div key={i} className="truncate">• {err}</div>
                    ))}
                    {importResult.errorDetails.length > 10 && (
                      <div className="text-slate-500 italic">+ {importResult.errorDetails.length - 10} more in downloaded report</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preview of Parsed Rows (shown only before import) */}
          {!importResult && previewItems.length > 0 && (() => {
            const totalDetectedProducts = isVendor
              ? previewItems.reduce((acc, v) => acc + (v.parsedProducts?.length || 0), 0)
              : 0;

            const existingDuplicatesCount = isVendor
              ? previewItems.filter((v) => {
                  const norm = (v.companyName || v.vendorName || '').toLowerCase().trim();
                  const gst = (v.gstin || '').toUpperCase().trim();
                  const isRealGst = gst.length === 15 && !gst.startsWith('27AAAPV0000');
                  return vendors.some(
                    (ex) =>
                      (norm && ex.companyName?.toLowerCase().trim() === norm) ||
                      (isRealGst && ex.gstin?.toUpperCase().trim() === gst)
                  );
                }).length
              : 0;

            return (
              <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Parsed: {previewItems.length} {isVendor ? 'Vendors' : isProduct ? 'Products' : 'Customers'}
                      {totalDetectedProducts > 0 && ` • ${totalDetectedProducts} Products Detected`}
                    </span>
                  </span>
                  {totalDetectedProducts > 0 ? (
                    <span className="text-[10px] text-emerald-800 bg-emerald-100 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 self-start sm:self-auto">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      <span>Auto-linking as per Brand</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-700 font-medium">Ready to commit to database</span>
                  )}
                </div>

                {existingDuplicatesCount > 0 && (
                  <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>Duplicate Protection Active:</strong> {existingDuplicatesCount} vendor{existingDuplicatesCount > 1 ? 's' : ''} in this file already exist in the live database. They will be safely skipped to avoid duplicate entries.
                    </span>
                  </div>
                )}

                <div className="max-h-40 overflow-y-auto divide-y divide-emerald-200 bg-white rounded-lg border border-emerald-200 p-2 text-[11px]">
                  {previewItems.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="py-1.5 flex flex-col gap-0.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <span>{item.companyName || item.itemName}</span>
                          {item.brandsSupplied && item.brandsSupplied.length > 0 && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-700 font-bold rounded border border-blue-200">
                              {item.brandsSupplied.join(', ')}
                            </span>
                          )}
                        </span>
                        <span className="text-slate-500 text-[10px] shrink-0 font-mono">
                          {item.city || item.partNumber || item.brand || item.category || item.gstin}
                        </span>
                      </div>

                      {/* Display products linked to this vendor */}
                      {item.parsedProducts && item.parsedProducts.length > 0 && (
                        <div className="text-[10px] text-slate-600 flex items-center gap-1 pl-1">
                          <Package className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate">
                            <strong className="text-emerald-800 font-semibold">{item.parsedProducts.length} items:</strong>{' '}
                            {item.parsedProducts.map((p: any) => `${p.productName} (${p.brand})`).join(' • ')}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  {previewItems.length > 5 && (
                    <div className="py-1 text-slate-400 text-center font-sans text-[10px]">
                      + {previewItems.length - 5} more records
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs"
          >
            {importResult ? 'Close' : 'Cancel'}
          </button>

          {importResult ? (
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Done (All Valid Data Saved)</span>
            </button>
          ) : (
            <button
              onClick={handleCommitImport}
              disabled={previewItems.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>Import {previewItems.length} Records to Database</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
