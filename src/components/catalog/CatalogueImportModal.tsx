import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Download,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Search,
  Layers,
  Sparkles,
  Database,
  Check,
  ChevronRight,
  Info,
  Building2,
  Tag,
  Copy,
  FileText,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import {
  autoDetectColumnMapping,
  processImportBatch,
  generateCatalogueTemplateWorkbook,
  generateErrorWorkbook,
  parseDocumentCatalogue,
  DEFAULT_COLUMN_SYNONYMS,
} from '../../services/catalogImportEngine';
import { ImportPreviewRow, ImportSummaryStats, ImportRowAction } from '../../types/catalogImport';

interface CatalogueImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type ImportStep = 'UPLOAD' | 'MAPPING' | 'PREVIEW' | 'COMMITTING' | 'RESULT';

export const CatalogueImportModal: React.FC<CatalogueImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const {
    products,
    brands,
    categories,
    importCatalogueBatch,
    importVersionedCatalogue,
    saveColumnMappingTemplate,
    mappingTemplates,
    currentUser,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<ImportStep>('UPLOAD');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [newTemplateName, setNewTemplateName] = useState('');
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [stats, setStats] = useState<ImportSummaryStats | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'VALID' | 'EXISTING' | 'RATE_CHANGED' | 'NEW' | 'UNCHANGED' | 'ERRORS' | 'DUPLICATES'>('ALL');
  const [searchFilter, setSearchFilter] = useState('');

  // Versioning metadata
  const [catalogueVersion, setCatalogueVersion] = useState<string>('2026.1');
  const [effectiveDate, setEffectiveDate] = useState<string>('2026-08-01');
  const [defaultDiscount, setDefaultDiscount] = useState<number>(20);

  // Commit progress
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState(0);
  const [commitResult, setCommitResult] = useState<{
    added: number;
    updated: number;
    skipped: number;
    total: number;
  } | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  // New Brand Creation mappings
  const [newBrandActions, setNewBrandActions] = useState<Record<string, { action: 'CREATE' | 'MAP'; mappedBrandId?: string }>>({});

  // Document extraction state
  const [isParsingDocument, setIsParsingDocument] = useState(false);
  const [parsingStatusText, setParsingStatusText] = useState('Analyzing Brand Catalogue with AI & OCR...');

  if (!isOpen) return null;

  // Handle file selection and parsing
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSelectedFile(file);
  };

  const processSelectedFile = async (file: File) => {
    setSelectedFile(file);
    const fileNameLower = file.name.toLowerCase();
    const isSpreadsheet =
      fileNameLower.endsWith('.xlsx') ||
      fileNameLower.endsWith('.xls') ||
      fileNameLower.endsWith('.csv');

    if (isSpreadsheet) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const firstSheetName = wb.SheetNames[0];
          const ws = wb.Sheets[firstSheetName];

          const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
          if (jsonRows.length === 0) {
            alert('Uploaded spreadsheet contains no data rows.');
            return;
          }

          const headers = Object.keys(jsonRows[0] || {});
          setRawHeaders(headers);
          setRawRows(jsonRows);

          const detected = autoDetectColumnMapping(headers);
          setFieldMapping(detected);
          setCurrentStep('MAPPING');
        } catch (err: any) {
          alert(`Failed to read spreadsheet file: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    // PDF or Image File Handling (AI & OCR Extraction)
    const isPdf = fileNameLower.endsWith('.pdf') || file.type === 'application/pdf';
    const isImage = /\.(jpe?g|png|webp|bmp|tiff)$/i.test(fileNameLower) || file.type.startsWith('image/');

    if (isPdf || isImage) {
      try {
        setIsParsingDocument(true);
        setParsingStatusText(
          isPdf
            ? 'Extracting multi-item catalogue rows from PDF document using AI & OCR parser...'
            : 'Scanning catalogue image for part codes, specs, and price lists via OCR...'
        );

        const result = await parseDocumentCatalogue(file);
        if (!result.rows || result.rows.length === 0) {
          alert('Could not extract catalogue items from document. Please verify the document format.');
          setIsParsingDocument(false);
          return;
        }

        setRawHeaders(result.headers);
        setRawRows(result.rows);

        const detected = autoDetectColumnMapping(result.headers);
        setFieldMapping(detected);
        setCurrentStep('MAPPING');
      } catch (err: any) {
        alert(`Catalogue Document extraction notice: ${err.message}`);
      } finally {
        setIsParsingDocument(false);
      }
      return;
    }

    alert('Unsupported file format. Please upload an Excel (.xlsx, .xls), CSV (.csv), PDF (.pdf), or Image (.jpg, .png, .webp) file.');
  };

  // Sample catalogue file loader helpers for quick testing
  const handleLoadSamplePdf = () => {
    const dummyPdfContent = `%PDF-1.4\n%Industrial Catalogue\nSchneider Electric Acti9 iC60N MCB 2P 10A A9F74210 MRP 185\nSchneider Electric Acti9 iC60N MCB 2P 16A A9F74216 MRP 195\nSchneider Electric Acti9 iC60N MCB 2P 25A A9F74225 MRP 225\n%%EOF`;
    const blob = new Blob([dummyPdfContent], { type: 'application/pdf' });
    const file = new File([blob], 'Schneider_Electric_Acti9_Catalogue.pdf', { type: 'application/pdf' });
    processSelectedFile(file);
  };

  const handleLoadSampleImage = () => {
    const dummyImageContent = `Sample image base64 data ABB Switchgear Price List`;
    const blob = new Blob([dummyImageContent], { type: 'image/jpeg' });
    const file = new File([blob], 'ABB_Switchgear_Price_List.jpg', { type: 'image/jpeg' });
    processSelectedFile(file);
  };

  // Step 2 -> Step 3: Analyze & Process
  const handleAnalyzeMapping = () => {
    // Validate that essential fields are mapped
    if (!fieldMapping.brand || !fieldMapping.productName || !fieldMapping.partCode) {
      alert('Please map at least Brand Name, Product Name, and Part Code to continue.');
      return;
    }

    const { rows, stats: batchStats } = processImportBatch(
      rawRows,
      fieldMapping,
      products,
      brands,
      categories
    );

    setPreviewRows(rows);
    setStats(batchStats);

    // Identify detected new brands
    const detectedNewBrands: Record<string, { action: 'CREATE' | 'MAP' }> = {};
    rows.forEach((r) => {
      if (r.brandStatus === 'NEW_DETECTED' && !detectedNewBrands[r.brand]) {
        detectedNewBrands[r.brand] = { action: 'CREATE' };
      }
    });
    setNewBrandActions(detectedNewBrands);

    setCurrentStep('PREVIEW');
  };

  // Change action for an individual row
  const handleRowActionChange = (rowIndex: number, newAction: ImportRowAction) => {
    setPreviewRows((prev) => {
      const copy = [...prev];
      copy[rowIndex] = { ...copy[rowIndex], action: newAction };
      return copy;
    });
  };

  // Bulk action update for all rows matching filter
  const handleBulkAction = (action: ImportRowAction) => {
    setPreviewRows((prev) =>
      prev.map((r) => {
        if (!r.isValid && action !== 'SKIP') return r;
        return { ...r, action };
      })
    );
  };

  // Download error excel report
  const handleDownloadErrors = () => {
    const errorEntries: Array<{ row: number; originalValue: string; error: string; correction: string }> = [];

    previewRows.forEach((r) => {
      if (!r.isValid || r.errors.length > 0) {
        r.errors.forEach((err) => {
          errorEntries.push({
            row: r.excelRow,
            originalValue: `${r.brand} | ${r.partCode} | ${r.productName}`,
            error: err,
            correction: err.includes('Part Code')
              ? 'Enter valid manufacturer Part Code'
              : err.includes('MRP')
              ? 'Enter positive numerical MRP'
              : err.includes('Brand')
              ? 'Provide authorized Brand Name'
              : 'Correct data formatting in Excel row',
          });
        });
      }
    });

    if (errorEntries.length === 0) {
      alert('No errors found in this catalogue file!');
      return;
    }

    const wb = generateErrorWorkbook(errorEntries);
    XLSX.writeFile(wb, `Import_Errors_${selectedFile?.name || 'catalogue'}.xlsx`);
  };

  // Download standard template
  const handleDownloadTemplate = () => {
    const wb = generateCatalogueTemplateWorkbook();
    XLSX.writeFile(wb, 'MRO_Brand_Catalogue_Import_Template.xlsx');
  };

  // Final confirmation and commit
  const handleConfirmImport = async () => {
    setIsCommitting(true);
    setCommitProgress(10);
    setCommitError(null);

    try {
      // Collect approved new brands
      const newBrandsToCreate = Object.entries(newBrandActions)
        .filter(([_, conf]) => conf.action === 'CREATE')
        .map(([name]) => ({
          name,
          category: 'General MRO',
        }));

      setCommitProgress(35);

      const historyRecord = {
        fileName: selectedFile?.name || 'Catalogue_Import.xlsx',
        fileSize: selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : '1 MB',
        uploadedBy: currentUser.name || 'Super Admin',
        uploadDate: new Date().toISOString(),
        totalRows: previewRows.length,
        errorRows: stats?.invalidRows || 0,
        duplicateRows: stats?.duplicateRows || 0,
        importStatus: 'COMPLETED' as const,
        errorReport: previewRows
          .filter((r) => !r.isValid)
          .map((r) => ({
            row: r.excelRow,
            originalValue: `${r.brand} - ${r.partCode}`,
            error: r.errors.join('; '),
            correction: 'Check error report',
          })),
        importSummary: `Imported ${stats?.validRows || 0} items (${stats?.newProducts || 0} new, ${stats?.existingProducts || 0} updated)`,
      };

      setCommitProgress(65);

      // Execute batch import
      const result = await importCatalogueBatch(previewRows, newBrandsToCreate, historyRecord);

      // Also register versioned batch with Year-over-Year Rate History & Rollback support
      try {
        const brandName = previewRows[0]?.brand || 'OEM Brand';
        const versionBatch = {
          brandName,
          catalogueVersion: catalogueVersion || '2026.1',
          effectiveDate: effectiveDate || '2026-08-01',
          fileName: selectedFile?.name || 'Catalogue_Import.xlsx',
          defaultDiscountPercent: defaultDiscount || 20,
          items: previewRows.filter((r) => r.isValid && r.action !== 'SKIP').map((r) => ({
            partCode: r.partCode,
            productName: r.productName,
            brand: r.brand,
            mrp: r.mrp || 0,
            discountPercentage: r.discountPercent || defaultDiscount || 20,
            packCode: (r as any).packCode || '',
            caseQty: (r as any).caseQty ? Number((r as any).caseQty) : undefined,
            uom: r.uom || 'NOS',
            modelNumber: r.modelNumber,
            manufacturerCode: r.manufacturerCode,
            category: r.category,
            specification: r.specifications,
            description: r.description,
          })),
        };
        await importVersionedCatalogue(versionBatch);
      } catch (err: any) {
        console.warn('Versioned catalogue registration note:', err);
      }

      setCommitProgress(100);

      if (result.success) {
        setCommitResult({
          added: result.added || 0,
          updated: result.updated || 0,
          skipped: result.skipped || 0,
          total: (result.added || 0) + (result.updated || 0),
        });
        setCurrentStep('RESULT');
        if (onSuccess) onSuccess();
      } else {
        setCommitError(result.error || 'Server rejected catalogue import transaction.');
        setIsCommitting(false);
      }
    } catch (err: any) {
      setCommitError(err.message || 'Network error while committing catalogue data.');
      setIsCommitting(false);
    }
  };

  // Helper to determine if a row has a rate difference
  const isRateChangedRow = (r: ImportPreviewRow) => {
    return (
      r.matchStatus === 'EXACT_MATCH' &&
      r.existingMrp !== undefined &&
      r.mrp !== undefined &&
      Math.abs(r.mrp - r.existingMrp) > 0.01
    );
  };

  // Filter preview rows
  const filteredPreviewRows = previewRows.filter((r) => {
    if (activeTab === 'VALID' && !r.isValid) return false;
    if (activeTab === 'EXISTING' && r.matchStatus !== 'EXACT_MATCH') return false;
    if (activeTab === 'RATE_CHANGED' && !isRateChangedRow(r)) return false;
    if (activeTab === 'UNCHANGED' && (r.matchStatus !== 'EXACT_MATCH' || isRateChangedRow(r))) return false;
    if (activeTab === 'NEW' && r.matchStatus !== 'NEW') return false;
    if (activeTab === 'ERRORS' && r.isValid) return false;
    if (activeTab === 'DUPLICATES' && r.matchStatus !== 'DUPLICATE_IN_FILE') return false;

    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      const mBrand = (r.brand || '').toLowerCase().includes(q);
      const mProd = (r.productName || '').toLowerCase().includes(q);
      const mPart = (r.partCode || '').toLowerCase().includes(q);
      const mCat = (r.category || '').toLowerCase().includes(q);
      if (!mBrand && !mProd && !mPart && !mCat) return false;
    }

    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-indigo-950">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-indigo-600/30 border border-indigo-500/40 rounded-xl text-indigo-400">
              <Database className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Brand Catalogue Import & AI Registration</h2>
              <p className="text-xs text-slate-400">
                Bulk import multi-brand OEM catalogue items with duplicate protection, rate calculation & AI search indexing.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-6">
            <div
              className={`flex items-center gap-2 ${
                currentStep === 'UPLOAD' ? 'text-indigo-600 font-bold' : 'text-slate-500'
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center bg-indigo-100 text-indigo-700">1</span>
              <span>Upload File</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <div
              className={`flex items-center gap-2 ${
                currentStep === 'MAPPING' ? 'text-indigo-600 font-bold' : 'text-slate-500'
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center bg-indigo-100 text-indigo-700">2</span>
              <span>Column Mapping</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <div
              className={`flex items-center gap-2 ${
                currentStep === 'PREVIEW' ? 'text-indigo-600 font-bold' : 'text-slate-500'
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center bg-indigo-100 text-indigo-700">3</span>
              <span>Validation & Preview</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <div
              className={`flex items-center gap-2 ${
                currentStep === 'RESULT' ? 'text-emerald-600 font-bold' : 'text-slate-500'
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center bg-emerald-100 text-emerald-700">4</span>
              <span>Database Verification</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium shadow-2xs transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              Download Excel Template
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {/* STEP 1: UPLOAD */}
          {currentStep === 'UPLOAD' && (
            <div className="max-w-2xl mx-auto space-y-6">
              {isParsingDocument ? (
                <div className="bg-white border-2 border-indigo-200 rounded-2xl p-12 text-center shadow-lg space-y-4">
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Processing Brand Catalogue Document</h3>
                  <p className="text-sm text-indigo-700 font-medium max-w-md mx-auto">
                    {parsingStatusText}
                  </p>
                  <p className="text-xs text-slate-400">
                    Extracting OEM Part Codes, MRP & Purchase Rates, Technical Specifications, and Category Taxonomies...
                  </p>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-white hover:bg-indigo-50/30 rounded-2xl p-10 text-center cursor-pointer transition-all shadow-sm group"
                >
                  <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-inner">
                    <Upload className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Upload Brand Catalogue Document or File</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                    Drag and drop your Excel, CSV, PDF Datasheet, or Image (JPG / PNG) catalogue file here, or click to browse.
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500 flex-wrap">
                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-semibold rounded-md border border-indigo-200">.XLSX / .XLS</span>
                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-semibold rounded-md border border-indigo-200">.CSV</span>
                    <span className="px-2.5 py-1 bg-rose-50 text-rose-700 font-semibold rounded-md border border-rose-200">.PDF (Catalogue)</span>
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-700 font-semibold rounded-md border border-amber-200">.JPG / .PNG / .WEBP</span>
                    <span className="text-slate-400">• Up to 25,000 SKUs</span>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".xlsx, .xls, .csv, .pdf, .jpg, .jpeg, .png, .webp"
                    className="hidden"
                  />
                </div>
              )}

              {/* Quick 1-Click Test Samples */}
              <div className="bg-slate-100/80 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-600 text-center sm:text-left">
                  <span className="font-bold text-slate-800">Quick Test Samples:</span> Test import pipeline without selecting your own file
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <button
                    onClick={handleLoadSamplePdf}
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-rose-600" />
                    Test PDF Import
                  </button>
                  <button
                    onClick={handleLoadSampleImage}
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                    Test Image Import
                  </button>
                </div>
              </div>

              {/* Helpful Tips Card */}
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Info className="w-4 h-4 text-indigo-600" />
                  <span>Important Import Rules & Guidelines</span>
                </div>
                <ul className="text-xs text-slate-600 space-y-2 list-disc pl-5">
                  <li>
                    <strong>Multi-Format Import:</strong> Upload Excel (.xlsx, .xls), CSV (.csv), PDF (.pdf) datasheets, or Image (.jpg, .jpeg, .png, .webp) price lists.
                  </li>
                  <li>
                    <strong>Required Columns:</strong> Brand Name, Product Name, Part Code / Part Number, Product Description, Category.
                  </li>
                  <li>
                    <strong>Duplicate Protection:</strong> Products with existing Part Codes will never be duplicated; you can choose to update rates or skip them.
                  </li>
                  <li>
                    <strong>Rate Calculation:</strong> If you supply MRP and Discount %, the ERP computes <code>Net Purchase Rate = MRP − (MRP × Discount %)</code> automatically.
                  </li>
                  <li>
                    <strong>Instant AI Indexing:</strong> All imported items become immediately searchable in the AI Requirement Matching Engine without reloading the page.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {currentStep === 'MAPPING' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Map Excel Columns to ERP Fields</h3>
                  <p className="text-xs text-slate-500">
                    File: <span className="font-semibold text-slate-700">{selectedFile?.name}</span> ({rawRows.length} rows detected)
                  </p>
                </div>

                {/* Saved Templates */}
                {mappingTemplates.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">Saved Template:</span>
                    <select
                      onChange={(e) => {
                        const tpl = mappingTemplates.find((t) => t.id === e.target.value);
                        if (tpl) setFieldMapping(tpl.mapping);
                      }}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">Select Template...</option>
                      {mappingTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Mapping Grid */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs divide-y divide-slate-100">
                <div className="grid grid-cols-12 gap-3 p-3 bg-slate-50 text-xs font-bold text-slate-700">
                  <div className="col-span-4">ERP Field</div>
                  <div className="col-span-4">Excel Header</div>
                  <div className="col-span-4">First Row Sample</div>
                </div>

                {Object.keys(DEFAULT_COLUMN_SYNONYMS).map((erpField) => {
                  const isRequired = ['brand', 'productName', 'partCode', 'description', 'category'].includes(erpField);
                  const selectedHeader = fieldMapping[erpField] || '';
                  const sampleVal = selectedHeader && rawRows[0] ? rawRows[0][selectedHeader] : '-';

                  return (
                    <div key={erpField} className="grid grid-cols-12 gap-3 p-3 items-center text-xs hover:bg-slate-50/50">
                      <div className="col-span-4 flex items-center gap-2">
                        <span className="font-semibold text-slate-900 capitalize">
                          {erpField.replace(/([A-Z])/g, ' $1')}
                        </span>
                        {isRequired ? (
                          <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-bold">
                            Required
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Optional</span>
                        )}
                      </div>

                      <div className="col-span-4">
                        <select
                          value={selectedHeader}
                          onChange={(e) =>
                            setFieldMapping((prev) => ({ ...prev, [erpField]: e.target.value }))
                          }
                          className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium focus:outline-none focus:ring-2 ${
                            isRequired && !selectedHeader
                              ? 'border-rose-300 bg-rose-50/30 text-rose-800 focus:ring-rose-400'
                              : 'border-slate-200 bg-slate-50/50 text-slate-800 focus:ring-indigo-500/20'
                          }`}
                        >
                          <option value="">-- Do Not Import --</option>
                          {rawHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-4 text-slate-500 font-mono text-[11px] truncate">
                        {String(sampleVal || '-')}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Save template option */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Template name (e.g. Siemens Price List)..."
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-64"
                  />
                  <button
                    onClick={() => {
                      if (!newTemplateName.trim()) {
                        alert('Please enter a template name.');
                        return;
                      }
                      saveColumnMappingTemplate(newTemplateName.trim(), fieldMapping);
                      setNewTemplateName('');
                      alert('Column mapping template saved successfully!');
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                  >
                    Save Mapping Template
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCurrentStep('UPLOAD')}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleAnalyzeMapping}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20"
                  >
                    <span>Validate & Preview</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & VALIDATION */}
          {currentStep === 'PREVIEW' && stats && (
            <div className="space-y-5">
              {/* Stat Summary Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] text-slate-500 font-medium">Total Rows</div>
                  <div className="text-xl font-bold text-slate-900 mt-0.5">{stats.totalRows}</div>
                </div>

                <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200 shadow-2xs">
                  <div className="text-[11px] text-emerald-700 font-medium">Valid Ready</div>
                  <div className="text-xl font-bold text-emerald-700 mt-0.5">{stats.validRows}</div>
                </div>

                <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200 shadow-2xs">
                  <div className="text-[11px] text-blue-700 font-medium">New SKUs</div>
                  <div className="text-xl font-bold text-blue-700 mt-0.5">{stats.newProducts}</div>
                </div>

                <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200 shadow-2xs">
                  <div className="text-[11px] text-amber-700 font-medium">Existing Matches</div>
                  <div className="text-xl font-bold text-amber-700 mt-0.5">{stats.existingProducts}</div>
                </div>

                <div className="bg-purple-50/60 p-3 rounded-xl border border-purple-200 shadow-2xs">
                  <div className="text-[11px] text-purple-700 font-medium">Duplicate Rows</div>
                  <div className="text-xl font-bold text-purple-700 mt-0.5">{stats.duplicateRows}</div>
                </div>

                <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-200 shadow-2xs">
                  <div className="text-[11px] text-rose-700 font-medium">Invalid Errors</div>
                  <div className="text-xl font-bold text-rose-700 mt-0.5">{stats.invalidRows}</div>
                </div>
              </div>

              {/* Brand Auto-Creation Notice if new brands detected */}
              {Object.keys(newBrandActions).length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <Building2 className="w-4 h-4 text-amber-700" />
                    <span>New Brands Detected ({Object.keys(newBrandActions).length})</span>
                  </div>
                  <p className="text-amber-800">
                    The catalogue contains brands not currently in your Brand Master. Choose whether to auto-create them or map to an existing brand:
                  </p>
                  <div className="flex flex-wrap gap-3 pt-1">
                    {Object.keys(newBrandActions).map((bName) => (
                      <div key={bName} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-amber-300">
                        <span className="font-bold text-slate-800">{bName}:</span>
                        <select
                          value={newBrandActions[bName].action}
                          onChange={(e) =>
                            setNewBrandActions((prev) => ({
                              ...prev,
                              [bName]: { action: e.target.value as any },
                            }))
                          }
                          className="px-2 py-0.5 border border-slate-200 rounded text-xs font-semibold bg-slate-50"
                        >
                          <option value="CREATE">+ Auto-Create Brand</option>
                          <option value="MAP">Map to Existing</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Catalogue Versioning Configuration Card */}
              <div className="bg-indigo-50/50 border border-indigo-200/80 rounded-xl p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Catalogue Version & Effective Rate Lock</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Establishes atomic batch tracking and maintains prior year price history while locking historical RFQ/PO rate snapshots.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase">Version / Year</label>
                      <input
                        type="text"
                        value={catalogueVersion}
                        onChange={(e) => setCatalogueVersion(e.target.value)}
                        placeholder="e.g. SKF 2026"
                        className="mt-0.5 px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase">Effective Date</label>
                      <input
                        type="date"
                        value={effectiveDate}
                        onChange={(e) => setEffectiveDate(e.target.value)}
                        className="mt-0.5 px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase">Default Discount %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={defaultDiscount}
                        onChange={(e) => setDefaultDiscount(Number(e.target.value) || 0)}
                        className="mt-0.5 px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Filter Tabs & Bulk Actions */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                  <button
                    onClick={() => setActiveTab('ALL')}
                    className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                      activeTab === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    All Rows ({previewRows.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('NEW')}
                    className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                      activeTab === 'NEW' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    New SKUs ({previewRows.filter((r) => r.matchStatus === 'NEW').length})
                  </button>
                  <button
                    onClick={() => setActiveTab('RATE_CHANGED')}
                    className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                      activeTab === 'RATE_CHANGED' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Rate Changed ({previewRows.filter(isRateChangedRow).length})
                  </button>
                  <button
                    onClick={() => setActiveTab('UNCHANGED')}
                    className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                      activeTab === 'UNCHANGED' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Unchanged ({previewRows.filter((r) => r.matchStatus === 'EXACT_MATCH' && !isRateChangedRow(r)).length})
                  </button>
                  <button
                    onClick={() => setActiveTab('DUPLICATES')}
                    className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                      activeTab === 'DUPLICATES' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Duplicates ({stats.duplicateRows})
                  </button>
                  <button
                    onClick={() => setActiveTab('ERRORS')}
                    className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                      activeTab === 'ERRORS' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Errors ({stats.invalidRows})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter preview..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="pl-8 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-44"
                    />
                  </div>

                  {stats.invalidRows > 0 && (
                    <button
                      onClick={handleDownloadErrors}
                      className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Error Excel
                    </button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 text-slate-700 font-bold z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">Row</th>
                        <th className="py-2.5 px-3">Brand</th>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3">Part Code</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-right">MRP (Delta)</th>
                        <th className="py-2.5 px-3 text-right">Disc %</th>
                        <th className="py-2.5 px-3 text-right">Net Rate</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPreviewRows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-slate-400">
                            No rows found in this filter tab.
                          </td>
                        </tr>
                      ) : (
                        filteredPreviewRows.slice(0, 100).map((r, idx) => {
                          const realIdx = previewRows.findIndex((pr) => pr.excelRow === r.excelRow);
                          const isRateChanged = isRateChangedRow(r);
                          const rateDiff = (r.mrp || 0) - (r.existingMrp || 0);

                          return (
                            <tr
                              key={r.excelRow}
                              className={`hover:bg-slate-50/80 transition-colors ${
                                !r.isValid ? 'bg-rose-50/40' : isRateChanged ? 'bg-amber-50/40' : r.matchStatus === 'EXACT_MATCH' ? 'bg-slate-50/60' : ''
                              }`}
                            >
                              <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                                {r.excelRow}
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-900">
                                {r.brand}
                                {r.brandStatus === 'NEW_DETECTED' && (
                                  <span className="ml-1 px-1 py-0.2 bg-amber-100 text-amber-700 text-[9px] rounded font-bold">
                                    New
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-slate-800 font-medium max-w-xs truncate" title={r.productName}>
                                {r.productName}
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-700 font-semibold">{r.partCode}</td>
                              <td className="py-2 px-3 text-slate-600">{r.category}</td>
                              <td className="py-2 px-3 text-right font-mono text-slate-800">
                                {r.mrp ? (
                                  <div>
                                    <div className="font-bold">₹{r.mrp.toLocaleString('en-IN')}</div>
                                    {isRateChanged && (
                                      <div className="text-[10px] text-amber-700 font-bold flex items-center justify-end gap-1">
                                        <span className="line-through text-slate-400">₹{r.existingMrp}</span>
                                        <span className={rateDiff > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                                          {rateDiff > 0 ? `+₹${rateDiff}` : `-₹${Math.abs(rateDiff)}`}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700">
                                {r.discountPercent ? `${r.discountPercent}%` : `${defaultDiscount}%`}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                                {r.netPurchaseRate ? `₹${Math.round(r.netPurchaseRate).toLocaleString('en-IN')}` : '-'}
                              </td>
                              <td className="py-2 px-3">
                                {r.matchStatus === 'EXACT_MATCH' ? (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] inline-flex items-center gap-1">
                                    <Copy className="w-3 h-3" /> Existing Found
                                  </span>
                                ) : r.matchStatus === 'NEW' ? (
                                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">
                                    New Product
                                  </span>
                                ) : r.matchStatus === 'DUPLICATE_IN_FILE' ? (
                                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-[10px]">
                                    Duplicate Row
                                  </span>
                                ) : (
                                  <span
                                    className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]"
                                    title={r.errors.join('; ')}
                                  >
                                    Invalid ({r.errors.length})
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <select
                                  value={r.action}
                                  onChange={(e) => handleRowActionChange(realIdx, e.target.value as ImportRowAction)}
                                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                >
                                  {r.matchStatus === 'EXACT_MATCH' && <option value="UPDATE">Update Existing</option>}
                                  {r.matchStatus === 'NEW' && <option value="CREATE">Create New</option>}
                                  <option value="SKIP">Skip</option>
                                  <option value="REVIEW">Review</option>
                                </select>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {filteredPreviewRows.length > 100 && (
                  <div className="p-2 bg-slate-50 text-center text-xs text-slate-500 border-t border-slate-200">
                    Showing first 100 of {filteredPreviewRows.length} rows. All {previewRows.length} rows will be processed on confirm.
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setCurrentStep('MAPPING')}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100"
                >
                  Back to Mapping
                </button>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleConfirmImport}
                    disabled={isCommitting || stats.validRows === 0}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Commit Import ({stats.validRows} SKUs)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: RESULT */}
          {currentStep === 'RESULT' && commitResult && (
            <div className="max-w-md mx-auto py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner animate-in zoom-in-75">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Brand Catalogue Successfully Imported!</h3>
              <p className="text-xs text-slate-500">
                Data was committed authoritatively to the central database and is immediately searchable in the AI engine.
              </p>

              <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs space-y-2 text-left shadow-2xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">New Products Added:</span>
                  <span className="font-bold text-slate-900 font-mono">{commitResult.added}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Existing Products Updated:</span>
                  <span className="font-bold text-slate-900 font-mono">{commitResult.updated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Skipped Rows:</span>
                  <span className="font-bold text-slate-500 font-mono">{commitResult.skipped}</span>
                </div>
                <div className="border-t border-slate-100 pt-2 flex justify-between font-bold">
                  <span className="text-slate-700">Total Active Products in Master:</span>
                  <span className="text-emerald-700 font-mono">{commitResult.total}</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition-all"
              >
                Done & Return to Catalogue
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
