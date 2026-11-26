import React, { useState } from 'react';
import {
  X,
  Upload,
  FileText,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Bot,
  Layers,
  Tag,
  Building,
  Check,
  ChevronRight,
  Info,
  ShieldCheck,
  RotateCcw,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  ExternalLink,
  CheckSquare,
  Square,
  HelpCircle,
  Database,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Vendor, VendorCatalogProduct, VendorMaterialCategory } from '../../types';
import {
  SAMPLE_CATALOG_TEMPLATES,
  analyzeVendorCatalog,
  STANDARDIZED_MRO_CATEGORIES,
  detectDuplicateProduct,
  VendorAnalysisResult,
} from '../../services/aiCatalogService';
import { SuspiciousExtractedItem, SpreadsheetColumnInspection } from '../../services/contentClassificationEngine';
import { BrandDetectionItem, CatalogueDiffSummary } from '../../types';

interface AiCatalogAnalyzerModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: Vendor;
}

interface EditableExtractedProduct extends Omit<VendorCatalogProduct, 'id'> {
  tempId: string;
  selected: boolean;
  duplicateResolution?: 'USE_EXISTING' | 'UPDATE_EXISTING' | 'CREATE_SEPARATE';
  candidateMatches?: Array<{ productId: string; itemName: string; brand: string; partNumber?: string; confidence: number }>;
  matchedProductName?: string;
}

export const AiCatalogAnalyzerModal: React.FC<AiCatalogAnalyzerModalProps> = ({
  isOpen,
  onClose,
  vendor,
}) => {
  const { saveCatalogAnalysisToVendor, brands, products: systemProducts } = useApp();

  // Wizard Steps: 'upload' -> 'review' -> 'saved'
  const [currentStep, setCurrentStep] = useState<'upload' | 'review' | 'saved'>('upload');

  // Input states
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number | null>(null);
  const [customTextSnippet, setCustomTextSnippet] = useState('');
  const [batchVersionInput, setBatchVersionInput] = useState('');
  const [effectiveDateInput, setEffectiveDateInput] = useState('');

  // Analysis progress states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStageText, setAnalysisStageText] = useState('Initializing extraction...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Review states
  const [extractedProducts, setExtractedProducts] = useState<EditableExtractedProduct[]>([]);
  const [suggestedCategories, setSuggestedCategories] = useState<Omit<VendorMaterialCategory, 'id'>[]>([]);
  const [brandsDetected, setBrandsDetected] = useState<BrandDetectionItem[]>([]);
  const [detectedFamilies, setDetectedFamilies] = useState<string[]>([]);
  const [catalogueDiff, setCatalogueDiff] = useState<CatalogueDiffSummary | undefined>();
  const [analysisMeta, setAnalysisMeta] = useState<{
    pageCount?: number;
    ocrUsed?: boolean;
    extractionMethod?: string;
    warnings?: string[];
    cacheHit?: boolean;
  }>({});
  const [suspiciousItems, setSuspiciousItems] = useState<SuspiciousExtractedItem[]>([]);
  const [extractionSummary, setExtractionSummary] = useState<VendorAnalysisResult['extractionSummary']>();
  const [spreadsheetPreview, setSpreadsheetPreview] = useState<SpreadsheetColumnInspection | undefined>();
  const [columnMappingOverride, setColumnMappingOverride] = useState<Record<string, string>>({});
  const [showColumnMapper, setShowColumnMapper] = useState(false);
  const [showSuspiciousReport, setShowSuspiciousReport] = useState(false);
  const [editingSuspiciousId, setEditingSuspiciousId] = useState<string | null>(null);
  const [suspiciousDraft, setSuspiciousDraft] = useState<{
    productName: string;
    brand: string;
    partNumber: string;
    category: string;
  }>({ productName: '', brand: '', partNumber: '', category: '' });
  const [vendorProfile, setVendorProfile] = useState<VendorAnalysisResult['vendorProfile'] | undefined>();
  const [catalogFileName, setCatalogFileName] = useState<string>('');
  const [catalogFileType, setCatalogFileType] = useState<string>('PDF');

  // Review Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [selectedConfidenceFilter, setSelectedConfidenceFilter] = useState('ALL');
  const [selectedReviewStatusFilter, setSelectedReviewStatusFilter] = useState('ALL');

  // Inline editing & View Source modal state
  const [editingItem, setEditingItem] = useState<EditableExtractedProduct | null>(null);
  const [viewSourceItem, setViewSourceItem] = useState<EditableExtractedProduct | null>(null);

  // Final saved state
  const [savedCount, setSavedCount] = useState<number>(0);
  const [savedBatchId, setSavedBatchId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
      setSelectedTemplateIndex(null);
      setErrorMessage(null);
    }
  };

  const handleSelectTemplate = (index: number) => {
    setSelectedTemplateIndex(index);
    setSelectedFiles([]);
    setErrorMessage(null);
  };

  const handleStartAnalysis = async (customMapping?: Record<string, string>) => {
    setIsAnalyzing(true);
    setAnalysisProgress(15);
    setAnalysisStageText('Preparing document & reading pages / sheets...');
    setErrorMessage(null);

    try {
      let analysisResult: VendorAnalysisResult;

      if (selectedTemplateIndex !== null) {
        const tmpl = SAMPLE_CATALOG_TEMPLATES[selectedTemplateIndex];
        setAnalysisProgress(40);
        setAnalysisStageText('Extracting products, exact part codes, rates & brands...');
        analysisResult = await analyzeVendorCatalog({
          vendorId: vendor.id,
          vendorName: vendor.companyName,
          existingBrands: brands,
          existingProducts: systemProducts,
          existingVendorCatalog: vendor.catalogProducts || [],
          columnMappingOverride: customMapping,
          file: {
            name: tmpl.fileName,
            type: tmpl.fileType,
            size: 154000,
            textContent: tmpl.rawText,
          },
        });
        setCatalogFileName(tmpl.fileName);
        setCatalogFileType(tmpl.fileType);
      } else if (selectedFiles.length > 0) {
        const file = selectedFiles[0];
        setAnalysisProgress(40);
        setAnalysisStageText('Running multi-page PDF / OCR & Product Master matching...');
        analysisResult = await analyzeVendorCatalog({
          vendorId: vendor.id,
          vendorName: vendor.companyName,
          existingBrands: brands,
          existingProducts: systemProducts,
          existingVendorCatalog: vendor.catalogProducts || [],
          columnMappingOverride: customMapping,
          file,
        });
        setCatalogFileName(file.name);
        setCatalogFileType(analysisResult.fileType || 'PDF');
      } else if (customTextSnippet.trim()) {
        const name = `${vendor.companyName.replace(/\s+/g, '_')}_Quick_Paste.txt`;
        setAnalysisProgress(40);
        setAnalysisStageText('Parsing structured lines & checking Brand Master...');
        analysisResult = await analyzeVendorCatalog({
          vendorId: vendor.id,
          vendorName: vendor.companyName,
          existingBrands: brands,
          existingProducts: systemProducts,
          existingVendorCatalog: vendor.catalogProducts || [],
          columnMappingOverride: customMapping,
          file: {
            name,
            type: 'TEXT',
            size: customTextSnippet.length,
            textContent: customTextSnippet,
          },
        });
        setCatalogFileName(name);
        setCatalogFileType('TEXT');
      } else {
        throw new Error('Please select an upload file, sample template, or paste catalog text to analyze.');
      }

      setAnalysisProgress(85);
      setAnalysisStageText('Comparing against existing vendor catalogue & preparing review...');

      const existing = vendor.catalogProducts || [];
      const mapped: EditableExtractedProduct[] = analysisResult.products.map((p, idx) => {
        const dup = detectDuplicateProduct(p, existing);
        return {
          ...p,
          tempId: `TMP-${Date.now()}-${idx + 1}`,
          selected: p.reviewStatus !== 'Unidentified',
          isDuplicate: dup.isDuplicate,
          duplicateOfId: dup.duplicateOf?.id,
          duplicateResolution:
            dup.isDuplicate || p.matchStatus === 'EXACT_MATCH' ? 'UPDATE_EXISTING' : 'CREATE_SEPARATE',
        };
      });

      setExtractedProducts(mapped);
      setSuggestedCategories(analysisResult.suggestedCategories || []);
      setBrandsDetected(analysisResult.brandsDetected || []);
      setDetectedFamilies(
        analysisResult.productFamilies ||
          Array.from(new Set(mapped.map((m) => m.productFamily).filter(Boolean) as string[]))
      );
      setCatalogueDiff(analysisResult.catalogueDiff);
      setSuspiciousItems(analysisResult.suspiciousItems || []);
      setExtractionSummary(analysisResult.extractionSummary);
      setSpreadsheetPreview(analysisResult.spreadsheetPreview);
      if (analysisResult.spreadsheetPreview?.autoMapping) {
        setColumnMappingOverride(customMapping || analysisResult.spreadsheetPreview.autoMapping);
      }
      setShowSuspiciousReport((analysisResult.suspiciousItems || []).length > 0);
      setAnalysisMeta({
        pageCount: analysisResult.pageCount,
        ocrUsed: analysisResult.ocrUsed,
        extractionMethod: analysisResult.extractionMethod,
        warnings: analysisResult.warnings,
        cacheHit: analysisResult.cacheHit,
      });
      setVendorProfile(analysisResult.vendorProfile);
      setAnalysisProgress(100);
      setCurrentStep('review');
    } catch (err: any) {
      console.error('Catalog analysis error:', err);
      setErrorMessage(err.message || 'Failed to analyze catalog');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Selection handlers
  const handleToggleSelect = (tempId: string) => {
    setExtractedProducts((prev) =>
      prev.map((p) => (p.tempId === tempId ? { ...p, selected: !p.selected } : p))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setExtractedProducts((prev) => prev.map((p) => ({ ...p, selected: select })));
  };

  // Edit item handlers
  const handleSaveItemEdit = (updated: EditableExtractedProduct) => {
    setExtractedProducts((prev) =>
      prev.map((p) => (p.tempId === updated.tempId ? { ...updated, reviewStatus: 'Verified' } : p))
    );
    setEditingItem(null);
  };

  const handleDeleteItem = (tempId: string) => {
    setExtractedProducts((prev) => prev.filter((p) => p.tempId !== tempId));
  };

  // Toggle category status
  const handleToggleCategoryStatus = (catIndex: number, newStatus: 'APPROVED' | 'REJECTED') => {
    setSuggestedCategories((prev) =>
      prev.map((c, idx) => (idx === catIndex ? { ...c, status: newStatus } : c))
    );
  };

  // Save to Database
  const handleSaveToDatabase = async () => {
    setIsSaving(true);
    try {
      const selectedItems = extractedProducts.filter((p) => p.selected);
      if (selectedItems.length === 0) {
        throw new Error('Please select at least one product to save.');
      }

      const approvedCategories = suggestedCategories.filter((c) => c.status === 'APPROVED');
      const confirmedNewBrands = brandsDetected
        .filter((b) => !b.isExisting && b.confirmed !== false)
        .map((b) => b.name);

      const catalogFileEntry = {
        id: `CATFILE-${Date.now()}`,
        vendorId: vendor.id,
        fileName: catalogFileName,
        fileType: catalogFileType,
        uploadDate: new Date().toISOString().split('T')[0],
        processingStatus: 'ANALYZED',
        aiAnalysisStatus: 'COMPLETED',
        productsIdentifiedCount: selectedItems.length,
      };

      const catalogProductsPayload = selectedItems.map((p) => ({
        vendorId: vendor.id,
        catalogFileName,
        productName: p.productName,
        sourceProductName: p.sourceProductName,
        normalizedProductName: p.normalizedProductName,
        productDesignation: p.productDesignation,
        manufacturerCode: p.manufacturerCode,
        category: p.category,
        subCategory: p.subCategory,
        productFamily: p.productFamily,
        productType: p.productType,
        brand: p.brand,
        modelNumber: p.modelNumber,
        partNumber: p.partNumber,
        specification: p.specification,
        application: p.application,
        size: p.size,
        uom: p.uom,
        mrp: p.mrp,
        basicRate: p.basicRate,
        discountPercent: p.discountPercent,
        purchaseRate: p.purchaseRate,
        rate: p.rate,
        currency: p.currency,
        effectiveDate: p.effectiveDate || effectiveDateInput || undefined,
        sourcePage: p.sourcePage,
        sourceType: p.sourceType || catalogFileType,
        sourceUrl: p.sourceUrl,
        imageUrl: p.imageUrl,
        detailUrl: p.detailUrl,
        catalogueRow: p.catalogueRow,
        originalSourceText: p.originalSourceText,
        extractionDate: p.extractionDate,
        aiAnalysisVersion: p.aiAnalysisVersion,
        contentClass: p.contentClass,
        validationScore: p.validationScore,
        validationBreakdown: p.validationBreakdown,
        catalogReference: p.catalogReference,
        description: p.description,
        evidence: p.evidence,
        matchedProductId: p.matchedProductId,
        matchPriority: p.matchPriority,
        matchStatus: p.matchStatus,
        duplicateResolution: p.duplicateResolution,
        aiConfidence: p.aiConfidence,
        confidenceLevel: p.confidenceLevel,
        reviewStatus: p.reviewStatus,
        approvalStatus: 'APPROVED',
      }));

      const suggestedCategoriesPayload = approvedCategories.map((c) => ({
        ...c,
        vendorId: vendor.id,
        status: 'APPROVED',
      }));

      const outcome = await saveCatalogAnalysisToVendor(vendor.id, {
        catalogFile: catalogFileEntry,
        catalogProducts: catalogProductsPayload,
        suggestedCategories: suggestedCategoriesPayload,
        vendorProfile,
        brandsDetected,
        confirmedNewBrands,
        batchVersion: batchVersionInput.trim() || undefined,
        effectiveDate: effectiveDateInput.trim() || undefined,
        sourceType: catalogFileType,
      });

      if (outcome.success) {
        setSavedCount(selectedItems.length);
        setSavedBatchId(outcome.batchId || '');
        if (outcome.diff) setCatalogueDiff(outcome.diff);
        setCurrentStep('saved');
      } else {
        throw new Error('Failed to persist vendor catalog to database.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving to database');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinishAndClose = () => {
    setCurrentStep('upload');
    setSelectedFiles([]);
    setSelectedTemplateIndex(null);
    setCustomTextSnippet('');
    setExtractedProducts([]);
    onClose();
  };

  // Filtered products list for review table
  const filteredProducts = extractedProducts.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.productName.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      (p.partNumber && p.partNumber.toLowerCase().includes(q)) ||
      (p.modelNumber && p.modelNumber.toLowerCase().includes(q)) ||
      (p.specification && p.specification.toLowerCase().includes(q)) ||
      p.category.toLowerCase().includes(q);

    const matchesCategory =
      selectedCategoryFilter === 'ALL' ||
      p.category.toLowerCase() === selectedCategoryFilter.toLowerCase();

    const matchesConfidence =
      selectedConfidenceFilter === 'ALL' ||
      p.confidenceLevel === selectedConfidenceFilter;

    const matchesStatus =
      selectedReviewStatusFilter === 'ALL' ||
      p.reviewStatus === selectedReviewStatusFilter;

    return matchesSearch && matchesCategory && matchesConfidence && matchesStatus;
  });

  const selectedCount = extractedProducts.filter((p) => p.selected).length;
  const distinctBrands = Array.from(new Set(extractedProducts.map((p) => p.brand).filter((b) => b && b !== 'Unconfirmed')));
  const distinctCategories = Array.from(new Set(extractedProducts.map((p) => p.category)));
  const highConfidenceCount = extractedProducts.filter((p) => p.confidenceLevel === 'High').length;
  const needsReviewCount = extractedProducts.filter((p) => p.reviewStatus === 'Needs Review' || p.reviewStatus === 'Unidentified').length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Intelligent Vendor Catalog Analysis"
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">Intelligent Vendor Catalog Analysis</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-200 font-mono">
                  Gemini 3.1 Flash-Lite
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-medium">
                  MRO Specialist Engine
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Target Supplier: <strong className="text-white">{vendor.companyName}</strong> ({vendor.vendorCode || vendor.id})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Step Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs bg-white/10 px-3 py-1 rounded-xl">
              <span className={`px-2 py-0.5 rounded-lg ${currentStep === 'upload' ? 'bg-blue-600 font-bold' : 'text-slate-400'}`}>
                1. Upload
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className={`px-2 py-0.5 rounded-lg ${currentStep === 'review' ? 'bg-blue-600 font-bold' : 'text-slate-400'}`}>
                2. Review & Edit
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className={`px-2 py-0.5 rounded-lg ${currentStep === 'saved' ? 'bg-emerald-600 font-bold' : 'text-slate-400'}`}>
                3. Saved
              </span>
            </div>

            <button
              type="button"
              aria-label="Close modal"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* STEP 1: UPLOAD & INGESTION */}
          {currentStep === 'upload' && (
            <div className="space-y-5">
              {/* Instructions Pill */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50/60 rounded-2xl border border-blue-200/80 flex items-start gap-3.5 text-xs text-blue-950">
                <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-blue-900">
                    Industrial Catalog & MRO Classification Assistant
                  </h4>
                  <p className="text-blue-800/90 text-xs leading-relaxed">
                    Upload supplier product catalogs, price sheets, line cards, or datasheets (PDF, Excel XLSX/XLS, CSV, or photos).
                    The system inspects real content to identify individual products, extract brands/models/specs, verify evidence,
                    and map them to standard categories before saving to database.
                  </p>
                </div>
              </div>

              {/* Upload Zone */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Option A: Upload Supplier Catalog Document (PDF, Excel, CSV, Images)
                </label>
                <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 sm:p-8 text-center bg-slate-50/70 hover:bg-blue-50/30 transition-all cursor-pointer relative group">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg,.webp"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    disabled={isAnalyzing}
                  />
                  <div className="space-y-3">
                    <div className="w-14 h-14 bg-white rounded-2xl shadow-xs border border-slate-200 flex items-center justify-center mx-auto text-blue-600 group-hover:scale-105 transition-transform">
                      <Upload className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {selectedFiles.length > 0
                          ? `${selectedFiles.length} file(s) selected: ${selectedFiles.map((f) => f.name).join(', ')}`
                          : 'Click to select or drag and drop catalog files'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Supported: Multi-page PDF catalogs (with OCR), Excel (.xlsx/.xls), CSV product lists, and technical datasheets
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instant 1-Click Preloaded Industrial Catalog Templates */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span>Option B: Test with Pre-Loaded Real-World Industrial Catalogs</span>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md font-mono text-[10px] font-bold">
                      1-Click Verification
                    </span>
                  </label>
                  {selectedTemplateIndex !== null && (
                    <button
                      onClick={() => setSelectedTemplateIndex(null)}
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SAMPLE_CATALOG_TEMPLATES.map((tmpl, idx) => {
                    const isSelected = selectedTemplateIndex === idx;
                    const Icon =
                      tmpl.fileType === 'EXCEL'
                        ? FileSpreadsheet
                        : tmpl.fileType === 'WORD'
                        ? FileCode
                        : FileText;

                    return (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => handleSelectTemplate(idx)}
                        className={`w-full p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <Icon className={`w-5 h-5 ${isSelected ? 'text-blue-600' : 'text-slate-500'}`} />
                            <span className="text-xs font-bold text-slate-900">{tmpl.title}</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 rounded-md text-slate-700 font-semibold">
                            {tmpl.fileType}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                          {tmpl.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Option C: Paste Raw Catalog Text */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Option C: Or Paste Raw Industrial Catalog / Quotation Lines
                </label>
                <textarea
                  rows={3}
                  value={customTextSnippet}
                  onChange={(e) => {
                    setCustomTextSnippet(e.target.value);
                    if (e.target.value.trim()) setSelectedTemplateIndex(null);
                  }}
                  placeholder="e.g. SKF 6205-2RS Deep Groove Ball Bearing 25x52x15mm, Festo VUVS Solenoid Valve 24V DC, Schneider LC1D25 Contactor 25A 230V AC..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  disabled={isAnalyzing}
                />
              </div>

              {/* Optional Batch Version & Effective Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Catalogue Version / Year (Optional)
                  </label>
                  <input
                    type="text"
                    value={batchVersionInput}
                    onChange={(e) => setBatchVersionInput(e.target.value)}
                    placeholder="e.g. 2026 Price List v1"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Effective Date (Optional — left blank if not printed)
                  </label>
                  <input
                    type="date"
                    value={effectiveDateInput}
                    onChange={(e) => setEffectiveDateInput(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-700 flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Progress Bar when analyzing */}
              {isAnalyzing && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span className="font-bold flex items-center gap-2 text-blue-700">
                      <Sparkles className="w-4 h-4 animate-spin text-blue-600" />
                      {analysisStageText}
                    </span>
                    <span className="font-mono text-xs font-bold text-blue-900">{analysisProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${analysisProgress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Extracting exact part codes, brands, product families, MRP/purchase rates, page citations, and matching Product Master...
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: INTERACTIVE REVIEW & VERIFICATION */}
          {currentStep === 'review' && (
            <div className="space-y-5">
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                  <p className="text-[11px] text-blue-800 font-medium">Extracted Products</p>
                  <p className="text-xl font-bold text-blue-950 mt-0.5">{extractedProducts.length}</p>
                  <p className="text-[10px] text-blue-700">{selectedCount} selected to save</p>
                </div>

                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                  <p className="text-[11px] text-indigo-800 font-medium">Distinct Brands</p>
                  <p className="text-xl font-bold text-indigo-950 mt-0.5">{distinctBrands.length}</p>
                  <p className="text-[10px] text-indigo-700 truncate">{distinctBrands.slice(0, 3).join(', ')}</p>
                </div>

                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
                  <p className="text-[11px] text-purple-800 font-medium">Categories Identified</p>
                  <p className="text-xl font-bold text-purple-950 mt-0.5">{distinctCategories.length}</p>
                  <p className="text-[10px] text-purple-700">{suggestedCategories.length} suggested</p>
                </div>

                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                  <p className="text-[11px] text-emerald-800 font-medium">High Confidence</p>
                  <p className="text-xl font-bold text-emerald-950 mt-0.5">
                    {extractedProducts.length > 0 ? Math.round((highConfidenceCount / extractedProducts.length) * 100) : 0}%
                  </p>
                  <p className="text-[10px] text-emerald-700">{highConfidenceCount} items verified</p>
                </div>

                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                  <p className="text-[11px] text-amber-800 font-medium">Needs Review</p>
                  <p className="text-xl font-bold text-amber-950 mt-0.5">{needsReviewCount}</p>
                  <p className="text-[10px] text-amber-700">Unconfirmed brand/cat</p>
                </div>
              </div>

              {/* Extraction Metadata, Classification Summary & Column Mapping */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-[11px] text-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900">Source Inspection:</span>
                    <span className="px-2 py-0.5 bg-white border border-slate-200 rounded font-mono">
                      {analysisMeta.pageCount || 1} page(s)
                    </span>
                    <span className="px-2 py-0.5 bg-white border border-slate-200 rounded font-mono">
                      Method: {analysisMeta.extractionMethod || 'TEXT'}
                    </span>
                    {analysisMeta.ocrUsed && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold">OCR Active</span>
                    )}
                    {analysisMeta.cacheHit && (
                      <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 rounded font-bold">Cached Result</span>
                    )}
                    {extractionSummary && (
                      <>
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-mono font-bold">
                          Detected: {extractionSummary.totalDetected}
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono font-bold">
                          Valid: {extractedProducts.filter((p) => p.reviewStatus !== 'Needs Review').length}
                        </span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono font-bold">
                          Review: {needsReviewCount}
                        </span>
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-mono font-bold">
                          Rejected: {suspiciousItems.filter((s) => s.status !== 'ACCEPTED' && s.status !== 'IGNORED').length}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {spreadsheetPreview && spreadsheetPreview.headers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowColumnMapper((v) => !v)}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold"
                      >
                        {showColumnMapper ? 'Hide Column Mapper' : 'Customize Excel/CSV Columns'}
                      </button>
                    )}
                    {suspiciousItems.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowSuspiciousReport((v) => !v)}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg font-bold"
                      >
                        {showSuspiciousReport ? 'Hide' : 'Show'} Suspicious Report ({suspiciousItems.filter((s) => s.status !== 'ACCEPTED' && s.status !== 'IGNORED').length})
                      </button>
                    )}
                  </div>
                </div>
                {analysisMeta.warnings && analysisMeta.warnings.length > 0 && (
                  <div className="text-amber-700 font-medium">{analysisMeta.warnings[0]}</div>
                )}

                {showColumnMapper && spreadsheetPreview && spreadsheetPreview.headers.length > 0 && (
                  <div className="p-3 bg-white border border-indigo-200 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-indigo-950">CSV / Excel Column Mapping Override</span>
                      <button
                        type="button"
                        disabled={isAnalyzing}
                        onClick={() => handleStartAnalysis(columnMappingOverride)}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-lg font-bold"
                      >
                        {isAnalyzing ? 'Re-Analyzing...' : 'Re-Run With Custom Mapping'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { key: 'brand', label: 'Brand' },
                        { key: 'partNumber', label: 'Part Code' },
                        { key: 'productDesignation', label: 'Designation' },
                        { key: 'productName', label: 'Product Name' },
                        { key: 'description', label: 'Description' },
                        { key: 'specification', label: 'Specification' },
                        { key: 'category', label: 'Category' },
                        { key: 'mrp', label: 'MRP' },
                        { key: 'discountPercent', label: 'Discount %' },
                        { key: 'purchaseRate', label: 'Purchase Rate' },
                        { key: 'uom', label: 'UOM' },
                      ].map((f) => (
                        <div key={f.key}>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">{f.label}</label>
                          <select
                            value={columnMappingOverride[f.key] || ''}
                            onChange={(e) => setColumnMappingOverride((prev) => ({ ...prev, [f.key]: e.target.value }))}
                            className="w-full p-1 border border-slate-300 rounded text-[11px]"
                          >
                            <option value="">-- Auto / None --</option>
                            {spreadsheetPreview.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {showSuspiciousReport && suspiciousItems.length > 0 && (
                  <div className="p-3 bg-white border border-rose-200 rounded-xl space-y-2 max-h-64 overflow-y-auto">
                    <div className="font-bold text-rose-900 text-xs">
                      Suspicious &amp; Rejected Noise / Ambiguous Blocks ({suspiciousItems.length})
                    </div>
                    {suspiciousItems.map((s) => (
                      <div key={s.id} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">
                              {s.rejectionCategory}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-mono font-bold text-[10px]">
                              {s.score}/100
                            </span>
                            {s.status && (
                              <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-bold">
                                {s.status}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {s.status !== 'ACCEPTED' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newProd: EditableExtractedProduct = {
                                      tempId: `PROM-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                                      selected: true,
                                      vendorId: vendor.id,
                                      catalogFileName,
                                      productName: s.suggestedProductName || s.rawText.slice(0, 80),
                                      sourceProductName: s.suggestedProductName || s.rawText.slice(0, 80),
                                      normalizedProductName: s.suggestedProductName || s.rawText.slice(0, 80),
                                      productDesignation: s.suggestedPartCode || s.suggestedProductName || '',
                                      description: s.rawText,
                                      brand: s.suggestedBrand || 'Unconfirmed',
                                      partNumber: s.suggestedPartCode || '',
                                      modelNumber: s.suggestedPartCode || '',
                                      category: s.suggestedCategory || 'Industrial Supplies',
                                      uom: 'NOS',
                                      keywords: [s.suggestedCategory || 'Industrial Supplies', s.suggestedBrand || '', s.suggestedPartCode || ''].filter(Boolean),
                                      sourcePage: s.sourcePage,
                                      catalogueRow: s.catalogueRow,
                                      originalSourceText: s.rawText,
                                      evidence: s.rawText,
                                      reviewStatus: 'Verified',
                                      approvalStatus: 'APPROVED',
                                      matchStatus: 'NEW_PRODUCT',
                                      aiConfidence: Math.max(70, s.score),
                                      confidenceLevel: 'Medium',
                                      validationScore: s.score,
                                    };
                                    setExtractedProducts((prev) => [newProd, ...prev]);
                                    setSuspiciousItems((prev) =>
                                      prev.map((item) => (item.id === s.id ? { ...item, status: 'ACCEPTED' } : item))
                                    );
                                  }}
                                  className="px-2 py-0.5 bg-emerald-600 text-white rounded font-bold text-[10px]"
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSuspiciousId(editingSuspiciousId === s.id ? null : s.id);
                                    setSuspiciousDraft({
                                      productName: s.suggestedProductName || s.rawText.slice(0, 80),
                                      brand: s.suggestedBrand || '',
                                      partNumber: s.suggestedPartCode || '',
                                      category: s.suggestedCategory || 'Industrial Supplies',
                                    });
                                  }}
                                  className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px]"
                                >
                                  Edit
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setSuspiciousItems((prev) =>
                                  prev.map((item) => (item.id === s.id ? { ...item, status: 'REJECTED' } : item))
                                )
                              }
                              className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setSuspiciousItems((prev) =>
                                  prev.map((item) => (item.id === s.id ? { ...item, status: 'IGNORED' } : item))
                                )
                              }
                              className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-bold text-[10px]"
                            >
                              Ignore
                            </button>
                          </div>
                        </div>
                        <div className="font-mono text-[10px] text-slate-800 truncate" title={s.rawText}>
                          {s.rawText}
                        </div>
                        <div className="text-[10px] text-slate-500">{s.reason}</div>
                        {editingSuspiciousId === s.id && (
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-1.5 pt-1">
                            <input
                              type="text"
                              value={suspiciousDraft.productName}
                              onChange={(e) => setSuspiciousDraft((d) => ({ ...d, productName: e.target.value }))}
                              placeholder="Product Name"
                              className="p-1 border border-slate-300 rounded bg-white text-[11px]"
                            />
                            <input
                              type="text"
                              value={suspiciousDraft.brand}
                              onChange={(e) => setSuspiciousDraft((d) => ({ ...d, brand: e.target.value }))}
                              placeholder="Brand"
                              className="p-1 border border-slate-300 rounded bg-white text-[11px]"
                            />
                            <input
                              type="text"
                              value={suspiciousDraft.partNumber}
                              onChange={(e) => setSuspiciousDraft((d) => ({ ...d, partNumber: e.target.value }))}
                              placeholder="Part Code"
                              className="p-1 border border-slate-300 rounded bg-white text-[11px] font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newProd: EditableExtractedProduct = {
                                  tempId: `PROM-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                                  selected: true,
                                  vendorId: vendor.id,
                                  catalogFileName,
                                  productName: suspiciousDraft.productName.trim() || s.rawText.slice(0, 80),
                                  sourceProductName: suspiciousDraft.productName.trim() || s.rawText.slice(0, 80),
                                  normalizedProductName: suspiciousDraft.productName.trim() || s.rawText.slice(0, 80),
                                  productDesignation: suspiciousDraft.partNumber.trim() || suspiciousDraft.productName.trim(),
                                  description: s.rawText,
                                  brand: suspiciousDraft.brand.trim() || 'Unconfirmed',
                                  partNumber: suspiciousDraft.partNumber.trim(),
                                  modelNumber: suspiciousDraft.partNumber.trim(),
                                  category: suspiciousDraft.category.trim() || 'Industrial Supplies',
                                  uom: 'NOS',
                                  keywords: [suspiciousDraft.category.trim() || 'Industrial Supplies', suspiciousDraft.brand.trim(), suspiciousDraft.partNumber.trim()].filter(Boolean),
                                  sourcePage: s.sourcePage,
                                  catalogueRow: s.catalogueRow,
                                  originalSourceText: s.rawText,
                                  evidence: s.rawText,
                                  reviewStatus: 'Verified',
                                  approvalStatus: 'APPROVED',
                                  matchStatus: 'NEW_PRODUCT',
                                  aiConfidence: 95,
                                  confidenceLevel: 'High',
                                  validationScore: 95,
                                };
                                setExtractedProducts((prev) => [newProd, ...prev]);
                                setSuspiciousItems((prev) =>
                                  prev.map((item) => (item.id === s.id ? { ...item, status: 'ACCEPTED' } : item))
                                );
                                setEditingSuspiciousId(null);
                              }}
                              className="px-2 py-1 bg-blue-600 text-white rounded font-bold text-[10px]"
                            >
                              Save &amp; Promote
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Catalogue Re-Upload Diff Banner (Module 20) */}
              {catalogueDiff && catalogueDiff.totalExisting > 0 && (
                <div className="p-4 bg-gradient-to-r from-amber-50 via-blue-50/60 to-emerald-50 border border-amber-300 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Re-Upload Catalogue Comparison vs Existing ({catalogueDiff.totalExisting} active items)</span>
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                    <div className="p-2 bg-white rounded-lg border border-emerald-200">
                      <span className="text-slate-500 block">New Products</span>
                      <strong className="text-emerald-700 text-sm">+{catalogueDiff.newProducts.length}</strong>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-blue-200">
                      <span className="text-slate-500 block">Updated Specs</span>
                      <strong className="text-blue-700 text-sm">{catalogueDiff.updatedProducts.length}</strong>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-indigo-200">
                      <span className="text-slate-500 block">Rate Revisions</span>
                      <strong className="text-indigo-700 text-sm">{catalogueDiff.changedRates.length}</strong>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-amber-300">
                      <span className="text-slate-500 block">Missing in Latest</span>
                      <strong className="text-amber-800 text-sm">{catalogueDiff.removedProducts.length}</strong>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-500 block">Unchanged</span>
                      <strong className="text-slate-700 text-sm">{catalogueDiff.unchangedProducts.length}</strong>
                    </div>
                  </div>
                  {catalogueDiff.removedProducts.length > 0 && (
                    <p className="text-[11px] text-amber-900">
                      Note: {catalogueDiff.removedProducts.length} previously stocked item(s) not present in this file will be tagged{' '}
                      <strong>Not Present in Latest Catalogue</strong> without deleting historical RFQs or POs.
                    </p>
                  )}
                </div>
              )}

              {/* Brands Detected Section — Existing vs New Brand Confirmation (Module 10, 28) */}
              {brandsDetected.length > 0 && (
                <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      <span>Brands Detected ({brandsDetected.length}) — Master Reconciliation</span>
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      Confirm any "New Brand Detected" to register it in OEM Brand Master
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {brandsDetected.map((bd, idx) => (
                      <div
                        key={bd.name + idx}
                        className={`p-2.5 rounded-xl border text-xs flex items-start justify-between gap-2 ${
                          bd.isExisting ? 'bg-slate-50 border-slate-200' : 'bg-indigo-50/70 border-indigo-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900">{bd.name}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                bd.isExisting ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-600 text-white'
                              }`}
                            >
                              {bd.isExisting ? 'Existing Master' : 'New Brand Detected'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-600 mt-0.5 flex items-center gap-1.5">
                            <span>{bd.productsCount} item(s)</span>
                            <span>•</span>
                            <span className="font-semibold text-blue-700">{bd.relationship}</span>
                          </div>
                        </div>
                        {!bd.isExisting && (
                          <label className="flex items-center gap-1 text-[10px] font-bold text-indigo-900 cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={bd.confirmed !== false}
                              onChange={(e) =>
                                setBrandsDetected((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, confirmed: e.target.checked } : item))
                                )
                              }
                              className="rounded text-indigo-600"
                            />
                            <span>Add</span>
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Supplier Dealings Profile & Product Families */}
              {vendorProfile && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Building className="w-4 h-4 text-indigo-600" />
                      <span>Supplier Dealings Profile & Product Families for {vendor.companyName}</span>
                    </h4>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Source: {catalogFileName} ({catalogFileType})
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] text-slate-600 font-medium">Categories:</span>
                    {distinctCategories.map((cat, idx) => {
                      const count = extractedProducts.filter((p) => p.category === cat).length;
                      return (
                        <span
                          key={idx}
                          className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 shadow-2xs flex items-center gap-1.5"
                        >
                          <Layers className="w-3 h-3 text-blue-600" />
                          <span>{cat}</span>
                          <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[10px] rounded-full font-bold">
                            {count}
                          </span>
                        </span>
                      );
                    })}

                    {detectedFamilies.length > 0 && (
                      <>
                        <span className="text-[11px] text-slate-600 font-medium ml-1">Product Families:</span>
                        {detectedFamilies.map((fam, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-[11px] font-semibold"
                          >
                            {fam}
                          </span>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Suggested Categories for Vendor Master */}
              {suggestedCategories.length > 0 && (
                <div className="p-4 bg-indigo-50/50 border border-indigo-200/80 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-indigo-600" />
                        <span>Suggested Material Categories to Add to Vendor Profile</span>
                      </h4>
                      <p className="text-[11px] text-indigo-800 mt-0.5">
                        These categories were detected from evidence in the catalog. Review and approve to register them under {vendor.companyName}.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <button
                        onClick={() =>
                          setSuggestedCategories((prev) => prev.map((c) => ({ ...c, status: 'APPROVED' })))
                        }
                        className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline"
                      >
                        Approve All Categories
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {suggestedCategories.map((c, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border text-xs transition-all ${
                          c.status === 'APPROVED'
                            ? 'bg-emerald-50 border-emerald-300 shadow-xs'
                            : c.status === 'REJECTED'
                            ? 'bg-rose-50/50 border-rose-200 opacity-60'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-bold text-slate-900 block">{c.category}</span>
                            {c.subCategory && (
                              <span className="text-[11px] text-slate-500 block">{c.subCategory}</span>
                            )}
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              c.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : c.status === 'REJECTED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {c.status === 'APPROVED' ? 'Approved' : c.status === 'REJECTED' ? 'Rejected' : 'Pending'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                          <span className="text-[10px] text-slate-500 font-mono">
                            {c.productsFoundCount} item(s) found
                          </span>
                          <div className="flex items-center gap-1.5">
                            {c.status !== 'APPROVED' ? (
                              <button
                                onClick={() => handleToggleCategoryStatus(idx, 'APPROVED')}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold"
                              >
                                Approve
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleCategoryStatus(idx, 'REJECTED')}
                                className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px]"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Product Results Table Filter Bar */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">
                      Extracted Products ({filteredProducts.length} items)
                    </h4>
                    <span className="text-xs text-slate-500">
                      (Selected {selectedCount} of {extractedProducts.length} to save)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSelectAll(true)}
                      className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Select All</span>
                    </button>
                    <button
                      onClick={() => handleSelectAll(false)}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Deselect All</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Search name, part #, brand, spec..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <select
                      value={selectedCategoryFilter}
                      onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="ALL">All Categories ({distinctCategories.length})</option>
                      {distinctCategories.map((cat, idx) => (
                        <option key={idx} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <select
                      value={selectedConfidenceFilter}
                      onChange={(e) => setSelectedConfidenceFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="ALL">All Confidence Levels</option>
                      <option value="High">High Confidence</option>
                      <option value="Medium">Medium Confidence</option>
                      <option value="Low">Low Confidence</option>
                    </select>
                  </div>

                  <div>
                    <select
                      value={selectedReviewStatusFilter}
                      onChange={(e) => setSelectedReviewStatusFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="ALL">All Review Statuses</option>
                      <option value="Verified">Verified</option>
                      <option value="Needs Review">Needs Review</option>
                      <option value="Unidentified">Unidentified</option>
                    </select>
                  </div>
                </div>

                {/* Table Container */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
                  <div className="overflow-x-auto max-h-[380px]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50/90 text-slate-700 sticky top-0 z-10 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3 w-10 text-center">Save</th>
                          <th className="p-3">Product Name & Exact Part Code</th>
                          <th className="p-3">Category & Family</th>
                          <th className="p-3">Brand / Make</th>
                          <th className="p-3">MRP / Purchase Rate</th>
                          <th className="p-3">Product Master Match</th>
                          <th className="p-3">Source & Evidence</th>
                          <th className="p-3 text-center">Confidence</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredProducts.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="p-8 text-center text-slate-400">
                              No products match the selected filters.
                            </td>
                          </tr>
                        ) : (
                          filteredProducts.map((p) => {
                            const isDup = p.isDuplicate || p.matchStatus === 'EXACT_MATCH' || p.matchStatus === 'SIMILAR_MATCH';

                            return (
                              <tr
                                key={p.tempId}
                                className={`hover:bg-blue-50/30 transition-colors ${
                                  p.selected ? 'bg-blue-50/10' : 'opacity-60 bg-slate-50/20'
                                }`}
                              >
                                {/* Checkbox */}
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={p.selected}
                                    onChange={() => handleToggleSelect(p.tempId)}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                </td>

                                {/* Product Name & Exact Part Number */}
                                <td className="p-3 max-w-[260px]">
                                  <div className="font-bold text-slate-900 line-clamp-1" title={p.productName}>
                                    {p.productName}
                                  </div>
                                  {p.sourceProductName && p.sourceProductName !== p.productName && (
                                    <div className="text-[10px] text-slate-500 truncate" title={p.sourceProductName}>
                                      Source: <span className="font-mono">{p.sourceProductName}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    {(p.partNumber || p.modelNumber) && (
                                      <span className="font-mono text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-800 rounded font-bold border border-slate-200">
                                        {p.partNumber || p.modelNumber}
                                      </span>
                                    )}
                                    {p.productDesignation && p.productDesignation !== p.partNumber && (
                                      <span className="font-mono text-[10px] px-1.5 py-0.2 bg-indigo-50 text-indigo-700 rounded border border-indigo-200">
                                        {p.productDesignation}
                                      </span>
                                    )}
                                    <span className="text-[10px] text-slate-400 font-mono">{p.uom || 'NOS'}</span>
                                  </div>
                                  {p.specification && (
                                    <div className="text-[10px] text-slate-500 truncate mt-0.5" title={p.specification}>
                                      {p.specification}
                                    </div>
                                  )}
                                </td>

                                {/* Category & Family */}
                                <td className="p-3">
                                  <span className="font-semibold text-slate-800 block">{p.category}</span>
                                  <span className="text-[10px] text-emerald-700 font-semibold block">
                                    {p.productFamily || p.subCategory || 'General MRO'}
                                  </span>
                                </td>

                                {/* Brand */}
                                <td className="p-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                      p.brand === 'Unconfirmed'
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    }`}
                                  >
                                    {p.brand}
                                  </span>
                                </td>

                                {/* MRP / Purchase Rate */}
                                <td className="p-3 whitespace-nowrap font-mono">
                                  {p.mrp !== undefined || p.purchaseRate !== undefined ? (
                                    <div className="space-y-0.5">
                                      {p.purchaseRate !== undefined && (
                                        <div className="font-bold text-emerald-700">
                                          Rate: ₹{p.purchaseRate.toLocaleString('en-IN')}
                                        </div>
                                      )}
                                      {p.mrp !== undefined && (
                                        <div className="text-[10px] text-slate-500">
                                          MRP: ₹{p.mrp.toLocaleString('en-IN')}
                                          {p.discountPercent ? ` (-${p.discountPercent}%)` : ''}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 italic">Not printed</span>
                                  )}
                                </td>

                                {/* Product Master Match & Duplicate Resolution */}
                                <td className="p-3 max-w-[180px] space-y-1">
                                  <span
                                    className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                      p.matchStatus === 'EXACT_MATCH'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : p.matchStatus === 'SIMILAR_MATCH'
                                          ? 'bg-blue-100 text-blue-800'
                                          : p.matchStatus === 'AMBIGUOUS_MATCH'
                                            ? 'bg-amber-100 text-amber-800'
                                            : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {p.matchStatus || 'NEW_PRODUCT'}
                                  </span>
                                  {p.matchStatus === 'AMBIGUOUS_MATCH' && p.candidateMatches && p.candidateMatches.length > 0 && (
                                    <select
                                      value={p.matchedProductId || ''}
                                      onChange={(e) => {
                                        const chosenId = e.target.value;
                                        setExtractedProducts((prev) =>
                                          prev.map((item) =>
                                            item.tempId === p.tempId
                                              ? {
                                                  ...item,
                                                  matchedProductId: chosenId || undefined,
                                                  matchStatus: chosenId ? 'SIMILAR_MATCH' : 'NEW_PRODUCT',
                                                }
                                              : item
                                          )
                                        );
                                      }}
                                      className="w-full text-[10px] p-1 border border-amber-300 rounded bg-amber-50 font-medium"
                                    >
                                      <option value="">Create Separate</option>
                                      {p.candidateMatches.map((cm) => (
                                        <option key={cm.productId} value={cm.productId}>
                                          Link: {cm.brand} {cm.partNumber || cm.itemName} ({cm.confidence}%)
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                  {isDup && p.matchStatus !== 'AMBIGUOUS_MATCH' && (
                                    <select
                                      value={p.duplicateResolution || 'UPDATE_EXISTING'}
                                      onChange={(e) => {
                                        const val = e.target.value as any;
                                        setExtractedProducts((prev) =>
                                          prev.map((item) =>
                                            item.tempId === p.tempId ? { ...item, duplicateResolution: val } : item
                                          )
                                        );
                                      }}
                                      className="w-full text-[10px] p-1 border border-slate-200 rounded bg-white text-slate-700"
                                    >
                                      <option value="UPDATE_EXISTING">Update Existing</option>
                                      <option value="USE_EXISTING">Use Existing Only</option>
                                      <option value="CREATE_SEPARATE">Create Separate</option>
                                    </select>
                                  )}
                                </td>

                                {/* Source & View Source Button */}
                                <td className="p-3 max-w-[160px]">
                                  <button
                                    type="button"
                                    onClick={() => setViewSourceItem(p)}
                                    className="text-left px-2 py-1 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-lg text-[10px] text-blue-700 font-semibold flex items-center gap-1 transition-colors"
                                  >
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                    <span className="truncate max-w-[120px]">
                                      {p.catalogReference || `Page ${p.sourcePage || 1}`}
                                    </span>
                                  </button>
                                </td>

                                {/* Confidence */}
                                <td className="p-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      p.reviewStatus === 'Needs Review' || p.brand === 'Unconfirmed' || (p.aiConfidence || 0) < 70
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    {p.aiConfidence || 90}% {p.reviewStatus === 'Needs Review' ? '• Review' : ''}
                                  </span>
                                </td>

                                {/* Actions */}
                                <td className="p-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => setEditingItem(p)}
                                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                      title="Edit product classification"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteItem(p.tempId)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                      title="Remove from extraction"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS CONFIRMATION */}
          {currentStep === 'saved' && (
            <div className="p-8 bg-emerald-50/80 rounded-2xl border border-emerald-200 text-center space-y-4 max-w-lg mx-auto">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle className="w-9 h-9" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-emerald-950">Catalogue Batch Committed & Verified!</h4>
                <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                  Saved <strong>{savedCount}</strong> products {savedBatchId ? `(Batch ${savedBatchId})` : ''} directly to{' '}
                  <strong className="text-emerald-950">{vendor.companyName}</strong>'s Vendor Intelligence Dossier.
                </p>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-emerald-200 text-xs text-slate-700 text-left space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-900 font-bold">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span>Post-Commit Verification Passed</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Vendor Intelligence Score, Brand Associations, Product Families, Rate History, and Versioned Batch History have been updated and verified in the live ERP database.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleFinishAndClose}
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-2"
                >
                  <span>Close & View Vendor Intelligence</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          {currentStep === 'upload' && (
            <>
              <button
                onClick={onClose}
                disabled={isAnalyzing}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={() => handleStartAnalysis()}
                disabled={
                  isAnalyzing ||
                  (selectedFiles.length === 0 && selectedTemplateIndex === null && !customTextSnippet.trim())
                }
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isAnalyzing ? 'Analyzing with AI...' : 'Run Intelligent Catalog Analysis'}</span>
              </button>
            </>
          )}

          {currentStep === 'review' && (
            <>
              <button
                onClick={() => setCurrentStep('upload')}
                disabled={isSaving}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Re-Analyze Different File</span>
              </button>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 hidden sm:inline">
                  {selectedCount} item(s) selected
                </span>

                <button
                  onClick={handleSaveToDatabase}
                  disabled={isSaving || selectedCount === 0}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2"
                >
                  <Database className="w-4 h-4" />
                  <span>
                    {isSaving
                      ? 'Saving to Database...'
                      : `Save ${selectedCount} Products to Vendor & Product Master`}
                  </span>
                </button>
              </div>
            </>
          )}

          {currentStep === 'saved' && (
            <div className="w-full flex justify-end">
              <button
                onClick={handleFinishAndClose}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Product Classification Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-400" />
                <span>Edit Product Classification</span>
              </h4>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Product Name</label>
                <input
                  type="text"
                  value={editingItem.productName}
                  onChange={(e) => setEditingItem({ ...editingItem, productName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={editingItem.category}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    {STANDARDIZED_MRO_CATEGORIES.map((c, i) => (
                      <option key={i} value={c.category}>
                        {c.category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Subcategory</label>
                  <input
                    type="text"
                    value={editingItem.subCategory || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, subCategory: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Brand / Make</label>
                  <input
                    type="text"
                    value={editingItem.brand}
                    onChange={(e) => setEditingItem({ ...editingItem, brand: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Model / Part Number</label>
                  <input
                    type="text"
                    value={editingItem.partNumber || editingItem.modelNumber || ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        partNumber: e.target.value,
                        modelNumber: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Technical Specification</label>
                  <input
                    type="text"
                    value={editingItem.specification || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, specification: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Unit of Measure (UOM)</label>
                  <select
                    value={editingItem.uom || 'NOS'}
                    onChange={(e) => setEditingItem({ ...editingItem, uom: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="NOS">NOS</option>
                    <option value="MTR">MTR</option>
                    <option value="SET">SET</option>
                    <option value="KG">KG</option>
                    <option value="LTR">LTR</option>
                    <option value="PKT">PKT</option>
                    <option value="BOX">BOX</option>
                    <option value="PAIR">PAIR</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveItemEdit(editingItem)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Source Modal (Module 18 Source Traceability) */}
      {viewSourceItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Source Traceability and Extraction Proof"
          className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Source Traceability & Extraction Proof</span>
              </h4>
              <button
                type="button"
                aria-label="Close source citation modal"
                onClick={() => setViewSourceItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Product & Part Code</span>
                <p className="font-bold text-slate-900 text-sm">{viewSourceItem.productName}</p>
                <p className="font-mono text-blue-700 font-semibold">
                  {viewSourceItem.brand} • {viewSourceItem.partNumber || viewSourceItem.modelNumber || 'No Part Code'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Source Document / URL</span>
                  <span className="font-semibold text-slate-800 break-all">
                    {viewSourceItem.catalogReference || catalogFileName}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Page / Type</span>
                  <span className="font-mono font-bold text-slate-800">
                    Page {viewSourceItem.sourcePage || 1} ({viewSourceItem.sourceType || catalogFileType})
                  </span>
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Extracted Verbatim Snippet</span>
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl font-mono text-[11px] text-slate-800 whitespace-pre-wrap">
                  "{viewSourceItem.evidence || 'Matched directly inside structured table row.'}"
                </div>
              </div>
            </div>
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setViewSourceItem(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
