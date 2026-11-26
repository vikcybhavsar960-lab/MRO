import React, { useState, useMemo } from 'react';
import {
  Layers,
  Search,
  Filter,
  BookmarkCheck,
  Tag,
  ArrowRight,
  Sparkles,
  Download,
  ExternalLink,
  Plus,
  CheckCircle2,
  Package,
  FileSpreadsheet,
  FileText,
  DollarSign,
  TrendingDown,
  Info,
  ChevronRight,
  Eye,
  Upload,
  History,
  ShieldCheck,
  Clock,
  X,
  Trash2,
  AlertTriangle,
  Check,
  RotateCcw,
  HelpCircle,
  FileCheck,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { ProductItem, BrandMasterItem } from '../../types';
import { CatalogueImportModal } from './CatalogueImportModal';
import { ImportHistoryModal } from './ImportHistoryModal';
import { DuplicateReviewModal } from './DuplicateReviewModal';
import { RateHistoryModal } from './RateHistoryModal';
import { generateCatalogueTemplateWorkbook } from '../../services/catalogImportEngine';
import { resolveApplicableDiscount, calculateCommercialRate } from '../../services/discountAndRateEngine';
import { RateMatchResult } from '../../types/catalogImport';

interface BrandCatalogueBrowserProps {
  onSelectProductForRfq?: (product: ProductItem) => void;
  onSelectProductForDirectRate?: (product: ProductItem) => void;
  onNavigateToProducts?: () => void;
}

export const BrandCatalogueBrowser: React.FC<BrandCatalogueBrowserProps> = ({
  onSelectProductForRfq,
  onSelectProductForDirectRate,
  onNavigateToProducts,
}) => {
  const {
    products,
    brands,
    categories,
    vendors,
    catalogueProducts,
    importBatches,
    fetchCatalogueRateMatch,
    rollbackImportBatch,
    fetchRateHistory,
  } = useApp();

  const [browserTab, setBrowserTab] = useState<'PRODUCTS' | 'RATE_LOOKUP' | 'BATCHES'>('PRODUCTS');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [mrpFilter, setMrpFilter] = useState<'ALL' | 'WITH_MRP' | 'DISCOUNTED'>('ALL');
  const [selectedProductDetails, setSelectedProductDetails] = useState<ProductItem | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isDuplicateReviewOpen, setIsDuplicateReviewOpen] = useState(false);
  const [viewingRateHistoryProduct, setViewingRateHistoryProduct] = useState<ProductItem | null>(null);

  // Rate Matching Engine interactive tester state
  const [lookupQuery, setLookupQuery] = useState('SKF 6006-2RS1 Bearing 10 Nos');
  const [lookupResult, setLookupResult] = useState<RateMatchResult | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Rollback batch state
  const [rollbackConfirmBatchId, setRollbackConfirmBatchId] = useState<string | null>(null);
  const [rollbackNotice, setRollbackNotice] = useState<string | null>(null);

  const handleRunLookup = async (queryText?: string) => {
    const q = (queryText !== undefined ? queryText : lookupQuery).trim();
    if (!q) return;
    setIsLookingUp(true);
    try {
      const res = await fetchCatalogueRateMatch(q);
      setLookupResult(res);
    } catch (err: any) {
      console.error('Rate match error:', err);
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleRollbackBatch = async (batchId: string) => {
    try {
      const res = await rollbackImportBatch(batchId, true);
      if (res.success) {
        setRollbackNotice(`Batch ${batchId} was rolled back successfully (${res.rolledBackCount ?? 0} SKUs removed).`);
        setTimeout(() => setRollbackNotice(null), 6000);
      } else {
        alert(`Rollback notice: ${res.message}`);
      }
    } catch (err: any) {
      alert(`Rollback error: ${err.message}`);
    } finally {
      setRollbackConfirmBatchId(null);
    }
  };

  const toProductItem = (cp: any): ProductItem => ({
    id: cp.id,
    itemName: cp.productName || cp.itemName || '',
    category: cp.category || 'MRO Supplies',
    brand: cp.brand || '',
    partNumber: cp.partCode || cp.partNumber || '',
    modelNumber: cp.modelNumber || '',
    specification: cp.specifications || cp.specification || '',
    uom: cp.uom || 'NOS',
    description: cp.description || '',
    mrp: cp.mrp,
    discountPercentage: cp.discountPercent ?? cp.discountPercentage ?? 0,
    netPurchaseRate: cp.purchaseRate ?? cp.netPurchaseRate ?? cp.approxRate ?? 0,
    approxRate: cp.purchaseRate ?? cp.netPurchaseRate ?? cp.approxRate ?? 0,
    packCode: cp.packCode,
    caseQty: cp.caseQty,
    catalogueVersion: cp.catalogueVersion,
    effectiveDate: cp.effectiveDate,
  });

  // Active products filter
  const activeProducts = useMemo(() => {
    return products.filter((p) => !p.isDeleted);
  }, [products]);

  // Unique brands available from products and Brand Master
  const brandList = useMemo(() => {
    const brandNames = new Set<string>();
    brands.forEach((b) => {
      if (b.name) brandNames.add(b.name.trim());
    });
    activeProducts.forEach((p) => {
      if (p.brand) brandNames.add(p.brand.trim());
    });
    return Array.from(brandNames).sort();
  }, [brands, activeProducts]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return activeProducts.filter((item) => {
      // Brand filter
      if (selectedBrand !== 'ALL' && item.brand?.toLowerCase() !== selectedBrand.toLowerCase()) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'ALL' && item.category?.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }

      // MRP filter
      if (mrpFilter === 'WITH_MRP' && (!item.mrp || item.mrp <= 0)) {
        return false;
      }
      if (mrpFilter === 'DISCOUNTED' && (!item.discountPercentage || item.discountPercentage <= 0)) {
        return false;
      }

      // Multi-attribute search query
      if (q) {
        const matchName = (item.itemName || '').toLowerCase().includes(q);
        const matchBrand = (item.brand || '').toLowerCase().includes(q);
        const matchPart = (item.partNumber || '').toLowerCase().includes(q);
        const matchModel = (item.modelNumber || '').toLowerCase().includes(q);
        const matchMfgCode = (item.manufacturerCode || '').toLowerCase().includes(q);
        const matchDesc = (item.description || '').toLowerCase().includes(q);
        const matchSpec = (item.specification || '').toLowerCase().includes(q);
        const matchCat = (item.category || '').toLowerCase().includes(q);

        if (
          !matchName &&
          !matchBrand &&
          !matchPart &&
          !matchModel &&
          !matchMfgCode &&
          !matchDesc &&
          !matchSpec &&
          !matchCat
        ) {
          return false;
        }
      }

      return true;
    });
  }, [activeProducts, searchTerm, selectedBrand, selectedCategory, mrpFilter]);

  // Export Catalogue to Excel
  const handleExportCatalogue = () => {
    const exportRows = filteredProducts.map((p) => {
      const netRate = p.netPurchaseRate || (p.mrp && p.discountPercentage ? p.mrp * (1 - p.discountPercentage / 100) : p.approxRate || 0);
      return {
        'Brand': p.brand,
        'Product Name': p.itemName,
        'Part Number': p.partNumber,
        'Model Number': p.modelNumber || '',
        'Manufacturer Code': p.manufacturerCode || '',
        'Category': p.category,
        'Sub-Category': p.subCategory || '',
        'MRP (INR)': p.mrp || '',
        'Discount %': p.discountPercentage ? `${p.discountPercentage}%` : '',
        'Net Purchase Rate (INR)': Math.round(netRate),
        'UOM': p.uom,
        'GST %': p.gstRate ? `${p.gstRate}%` : '18%',
        'Technical Specs': p.specification,
        'Description': p.description,
        'Last Updated': p.lastPurchaseDate || '2026-01-15',
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Brand_Catalogue');
    XLSX.writeFile(wb, `MRO_Brand_Catalogue_${selectedBrand === 'ALL' ? 'AllBrands' : selectedBrand}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-indigo-900/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-indigo-600/30 border border-indigo-500/40 rounded-xl text-indigo-400">
                <BookmarkCheck className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Brand Catalogue Browser</h1>
                <p className="text-slate-400 text-sm mt-0.5">
                  Multi-attribute product search across authorized OEM brands, part numbers, models, specifications, and live MRPs.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/30"
              title="Import Excel/CSV catalogue containing thousands of SKUs"
            >
              <Upload className="w-3.5 h-3.5" />
              Import Catalogue
            </button>
            <button
              onClick={() => {
                const wb = generateCatalogueTemplateWorkbook();
                XLSX.writeFile(wb, 'MRO_Brand_Catalogue_Template.xlsx');
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all shadow-2xs"
              title="Download standard 19-column Excel import template"
            >
              <Download className="w-3.5 h-3.5" />
              Template
            </button>
            <button
              onClick={handleExportCatalogue}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <button
              onClick={() => setIsHistoryModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all shadow-2xs"
              title="View historical imports and error reports"
            >
              <History className="w-3.5 h-3.5" />
              Import History
            </button>
            <button
              onClick={() => setIsDuplicateReviewOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl text-xs font-semibold transition-all shadow-2xs"
              title="Review catalogue cleanliness and potential duplicate Part Codes"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Duplicate Review
            </button>
            {onNavigateToProducts && (
              <button
                onClick={onNavigateToProducts}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Master SKUs
              </button>
            )}
          </div>
        </div>

        {/* Quick Brand Badges */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-medium whitespace-nowrap">Popular Brands:</span>
          <button
            onClick={() => setSelectedBrand('ALL')}
            className={`px-3 py-1 rounded-full font-medium transition-colors whitespace-nowrap ${
              selectedBrand === 'ALL'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            All Brands ({activeProducts.length})
          </button>
          {brandList.slice(0, 10).map((brd) => {
            const count = activeProducts.filter((p) => p.brand?.toLowerCase() === brd.toLowerCase()).length;
            return (
              <button
                key={brd}
                onClick={() => setSelectedBrand(brd)}
                className={`px-3 py-1 rounded-full font-medium transition-colors whitespace-nowrap ${
                  selectedBrand === brd
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {brd} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Rollback & System Notice */}
      {rollbackNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between text-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-medium">{rollbackNotice}</span>
          </div>
          <button onClick={() => setRollbackNotice(null)} className="text-emerald-600 hover:text-emerald-800 text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* 3 Main Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setBrowserTab('PRODUCTS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
            browserTab === 'PRODUCTS'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Catalogue SKUs & Current Rates</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${browserTab === 'PRODUCTS' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-700'}`}>
            {activeProducts.length}
          </span>
        </button>

        <button
          onClick={() => {
            setBrowserTab('RATE_LOOKUP');
            if (!lookupResult) {
              handleRunLookup(lookupQuery);
            }
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
            browserTab === 'RATE_LOOKUP'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>Automatic Rate Matching Engine</span>
          <span className="px-1.5 py-0.5 text-[10px] bg-amber-400 text-slate-950 font-extrabold rounded-full tracking-wide">
            LIVE TESTER
          </span>
        </button>

        <button
          onClick={() => setBrowserTab('BATCHES')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
            browserTab === 'BATCHES'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Import Batches & Rollback</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${browserTab === 'BATCHES' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-700'}`}>
            {importBatches?.length || 0}
          </span>
        </button>
      </div>

      {/* TAB 1: PRODUCTS BROWSER */}
      {browserTab === 'PRODUCTS' && (
        <>
          {/* Filter and Search Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Main Search Input */}
              <div className="md:col-span-2 relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Brand, Product Name, Part No, Model, Specs, or Manufacturer Code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Brand Dropdown */}
              <div>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-medium"
                >
                  <option value="ALL">All Brands ({brandList.length})</option>
                  {brandList.map((brd) => (
                    <option key={brd} value={brd}>
                      {brd}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Dropdown */}
              <div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                >
                  <option value="ALL">All Categories ({categories.length})</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sub-filter row */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700">Filter Pricing:</span>
                <button
                  onClick={() => setMrpFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    mrpFilter === 'ALL' ? 'bg-slate-200 text-slate-800 font-semibold' : 'hover:bg-slate-100'
                  }`}
                >
                  All Items
                </button>
                <button
                  onClick={() => setMrpFilter('WITH_MRP')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    mrpFilter === 'WITH_MRP' ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'hover:bg-slate-100'
                  }`}
                >
                  With Listed MRP
                </button>
                <button
                  onClick={() => setMrpFilter('DISCOUNTED')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    mrpFilter === 'DISCOUNTED' ? 'bg-emerald-100 text-emerald-700 font-semibold' : 'hover:bg-slate-100'
                  }`}
                >
                  With Active Discount
                </button>
              </div>

              <div className="text-slate-600">
                Showing <strong className="text-slate-900">{filteredProducts.length}</strong> catalog items
              </div>
            </div>
          </div>

          {/* Catalogue Cards Grid */}
          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
              <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-800">No products found</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                No brand catalogue items matched "{searchTerm}" with the active filters. Try broadening your search or resetting brand/category filters.
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedBrand('ALL');
                  setSelectedCategory('ALL');
                  setMrpFilter('ALL');
                }}
                className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-sm font-semibold transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((prod) => {
                const hasMrp = !!prod.mrp && prod.mrp > 0;
                const discountPercent = prod.discountPercentage || 0;
                const netPurchaseRate =
                  prod.netPurchaseRate ||
                  (hasMrp && discountPercent
                    ? Math.round(prod.mrp! * (1 - discountPercent / 100))
                    : prod.approxRate || 0);

                return (
                  <div
                    key={prod.id}
                    className="bg-white rounded-xl border border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                  >
                    {/* Card Header with Brand Pill */}
                    <div className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-900 text-white rounded-full text-xs font-semibold">
                          <BookmarkCheck className="w-3 h-3 text-indigo-400" />
                          {prod.brand || 'Industrial OEM'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {prod.catalogueVersion && (
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                              {prod.catalogueVersion}
                            </span>
                          )}
                          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {prod.category}
                          </span>
                        </div>
                      </div>

                      <h3 className="font-bold text-slate-900 text-base mt-2 group-hover:text-indigo-600 transition-colors line-clamp-1">
                        {prod.itemName}
                      </h3>

                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                        <span className="font-mono bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded text-slate-800 font-semibold">
                          PN: {prod.partNumber || 'N/A'}
                        </span>
                        {prod.packCode && (
                          <span className="bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-amber-800 text-[11px] font-medium">
                            Pack: {prod.packCode}
                          </span>
                        )}
                        {prod.caseQty && (
                          <span className="bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded text-blue-800 text-[11px] font-medium">
                            Case: {prod.caseQty}
                          </span>
                        )}
                        {prod.modelNumber && (
                          <span className="font-mono bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                            Model: {prod.modelNumber}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                        {prod.specification || prod.description || 'Standard industrial MRO grade component.'}
                      </p>
                    </div>

                    {/* Pricing Box */}
                    <div className="px-4 py-3 bg-slate-50/80 border-t border-b border-slate-100 mt-2">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                            Estimated Purchase Rate
                          </div>
                          <div className="flex items-baseline gap-2 mt-0.5">
                            <span className="text-lg font-bold text-indigo-700">
                              ₹{netPurchaseRate.toLocaleString('en-IN')}
                            </span>
                            <span className="text-xs text-slate-500">/ {prod.uom || 'NOS'}</span>
                          </div>
                        </div>

                        {hasMrp && (
                          <div className="text-right">
                            <div className="text-[11px] text-slate-400 line-through">
                              MRP: ₹{prod.mrp?.toLocaleString('en-IN')}
                            </div>
                            {discountPercent > 0 && (
                              <div className="text-xs font-bold text-emerald-600 flex items-center justify-end gap-0.5">
                                <TrendingDown className="w-3 h-3" />
                                {discountPercent}% OFF
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Action Buttons */}
                    <div className="p-3 bg-white flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedProductDetails(prod)}
                          className="flex items-center gap-1 text-xs text-slate-600 hover:text-indigo-600 font-medium px-2 py-1 rounded transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Specs
                        </button>
                        <button
                          onClick={() => setViewingRateHistoryProduct(prod)}
                          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors"
                          title="Inspect Rate History & Year-over-Year Delta"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Rate Trail
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {onSelectProductForDirectRate && (
                          <button
                            onClick={() => onSelectProductForDirectRate(prod)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                            title="Enter Direct Vendor Rate for this product"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            Enter VQ
                          </button>
                        )}
                        {onSelectProductForRfq && (
                          <button
                            onClick={() => onSelectProductForRfq(prod)}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                            title="Add to active Customer Requirement / RFQ"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add to RFQ
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: AUTOMATIC RATE MATCHING ENGINE TESTER */}
      {browserTab === 'RATE_LOOKUP' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  <span>Automatic Catalogue Rate Matching Engine</span>
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Deterministic 6-level priority matching hierarchy (Part Code 100% &gt; Mfg Code 95% &gt; Brand+Model 90% &gt; Specs). Tests live catalogue resolution against authentic OEM price lists.
                </p>
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Active v2.0 Engine
              </span>
            </div>

            {/* Test Query Input */}
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={lookupQuery}
                    onChange={(e) => setLookupQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRunLookup();
                    }}
                    placeholder="Enter natural procurement requirement (e.g., 'SKF 6006-2RS1 Bearing 10 Nos')..."
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <button
                  onClick={() => handleRunLookup()}
                  disabled={isLookingUp}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 shrink-0 disabled:opacity-50"
                >
                  {isLookingUp ? (
                    <>
                      <RotateCcw className="w-4 h-4 animate-spin" />
                      Matching...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Run Match
                    </>
                  )}
                </button>
              </div>

              {/* Quick Test Chips */}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Quick Test Scenarios:</span>
                {[
                  { label: 'SKF 6006-2RS1 Bearing 10 Nos', note: 'Level 1 Exact (MRP ₹503)' },
                  { label: 'SKF 6006 bearing', note: 'Ambiguous Test (4 Variants)' },
                  { label: 'Schneider LC1D32M7 3P Contactor', note: 'Level 1 Exact (MRP ₹3,450)' },
                  { label: 'Siemens 3RT2026-1BB40 24VDC Contactor', note: 'Level 1 Exact' },
                  { label: 'SKF 6205-2RS1 Deep Groove Ball Bearing', note: 'Level 1 Exact (MRP ₹380)' },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => {
                      setLookupQuery(chip.label);
                      handleRunLookup(chip.label);
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 rounded-lg text-slate-700 font-medium transition-all"
                  >
                    <span>{chip.label}</span>
                    <span className="ml-1 text-[10px] text-slate-500">({chip.note})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Results Display */}
            {lookupResult && (
              <div className="mt-6 border-t border-slate-200 pt-6 space-y-4">
                {/* Status Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                        lookupResult.isAmbiguous
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : lookupResult.matched
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      {lookupResult.isAmbiguous ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5" />
                          AMBIGUOUS PART CODE
                        </>
                      ) : lookupResult.matched ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {lookupResult.ruleLevel} ({lookupResult.confidence}% Confidence)
                        </>
                      ) : (
                        <>
                          <X className="w-3.5 h-3.5" />
                          NO EXACT MATCH FOUND
                        </>
                      )}
                    </span>
                    <span className="text-xs text-slate-600 font-mono">
                      Query: "{lookupResult.rawQuery}"
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {lookupResult.detectedBrand && (
                      <span className="bg-slate-900 text-white px-2.5 py-0.5 rounded-full font-semibold">
                        Brand: {lookupResult.detectedBrand}
                      </span>
                    )}
                    {lookupResult.extractedPartCode && (
                      <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 px-2.5 py-0.5 rounded-full font-mono font-bold">
                        Part Code: {lookupResult.extractedPartCode}
                      </span>
                    )}
                    {lookupResult.extractedQuantity && (
                      <span className="bg-slate-200 text-slate-800 px-2.5 py-0.5 rounded-full font-bold">
                        Qty: {lookupResult.extractedQuantity} {lookupResult.extractedUom || 'NOS'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Ambiguous Candidates Alert */}
                {lookupResult.isAmbiguous && lookupResult.ambiguousCandidates && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Multiple Variants Found in Catalogue for "{lookupResult.extractedPartCode || lookupResult.rawQuery}"</span>
                    </div>
                    <p className="text-xs text-amber-800">
                      The ERP detected multiple distinct manufacturer designations. Select the exact catalogue item required to lock in the verified rate:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
                      {lookupResult.ambiguousCandidates.map((c) => (
                        <div
                          key={c.partCode}
                          className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs hover:border-indigo-400 hover:shadow-sm transition-all flex flex-col justify-between"
                        >
                          <div>
                            <div className="font-mono font-bold text-sm text-slate-900">{c.partCode}</div>
                            <div className="text-xs text-slate-600 line-clamp-1 mt-0.5">{c.productName}</div>
                            <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                              <span>MRP: <strong className="text-slate-800 font-mono">₹{c.mrp}</strong></span>
                              <span className="text-emerald-700 font-bold">{c.discountPercent || 0}% OFF</span>
                            </div>
                            <div className="text-sm font-bold text-indigo-700 font-mono mt-1">
                              Rate: ₹{Math.round(c.purchaseRate || c.mrp * (1 - (c.discountPercent || 0) / 100))}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const chosen = `${lookupResult.detectedBrand || ''} ${c.partCode}`;
                              setLookupQuery(chosen);
                              handleRunLookup(chosen);
                            }}
                            className="mt-3 w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all text-center"
                          >
                            Select This Variant
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Matched Product Rate Card */}
                {lookupResult.matched && lookupResult.product && (
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-slate-900 text-white rounded text-xs font-bold">
                            {lookupResult.product.brand}
                          </span>
                          <span className="font-mono font-bold text-base text-indigo-700">
                            {lookupResult.product.partCode || (lookupResult.product as any).partNumber}
                          </span>
                          {lookupResult.product.packCode && (
                            <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 rounded text-xs font-semibold">
                              Pack Code: {lookupResult.product.packCode}
                            </span>
                          )}
                          {lookupResult.product.caseQty && (
                            <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 rounded text-xs font-semibold">
                              Case Qty: {lookupResult.product.caseQty}
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mt-1">
                          {lookupResult.product.productName || (lookupResult.product as any).itemName}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {lookupResult.product.specifications || (lookupResult.product as any).specification || lookupResult.product.description}
                        </p>
                      </div>

                      {/* Version & Date */}
                      <div className="text-right text-xs text-slate-500">
                        <div>Catalogue Version: <strong className="text-slate-800">{lookupResult.rateSnapshot?.catalogueVersion || lookupResult.product.catalogueVersion || '2026.1'}</strong></div>
                        <div>Effective Date: <strong className="text-slate-800">{lookupResult.rateSnapshot?.effectiveDate || lookupResult.product.effectiveDate || '2026-08-01'}</strong></div>
                        <div className="text-emerald-700 font-semibold mt-1">Verified Snapshot Locked</div>
                      </div>
                    </div>

                    {/* Commercial Pricing Formula Box */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 uppercase">Catalogue List MRP</div>
                        <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                          ₹{lookupResult.rateSnapshot?.mrp?.toLocaleString('en-IN') || lookupResult.product.mrp || 0}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Base list price</div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 uppercase">Applied Discount</div>
                        <div className="text-xl font-bold font-mono text-emerald-700 mt-0.5">
                          {lookupResult.rateSnapshot?.appliedDiscountPercentage ?? lookupResult.product.discountPercent ?? 0}%
                        </div>
                        <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                          {lookupResult.rateSnapshot?.discountSource || 'Brand Master Default'}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 uppercase">Calculated Net Rate</div>
                        <div className="text-xl font-bold font-mono text-indigo-700 mt-0.5">
                          ₹{lookupResult.rateSnapshot?.calculatedPurchaseRate?.toLocaleString('en-IN') || lookupResult.product.purchaseRate || 0}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Per {lookupResult.product.uom || 'NOS'}</div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 uppercase">
                          Line Total ({lookupResult.extractedQuantity || 1} {lookupResult.extractedUom || lookupResult.product.uom || 'NOS'})
                        </div>
                        <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                          ₹{Math.round(
                            (lookupResult.rateSnapshot?.calculatedPurchaseRate || lookupResult.product.purchaseRate || 0) *
                              (lookupResult.extractedQuantity || 1)
                          ).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-indigo-600 font-bold mt-0.5">Commercial Ready</div>
                      </div>
                    </div>

                    {/* Actions on Result */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewingRateHistoryProduct(toProductItem(lookupResult.product!))}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <History className="w-3.5 h-3.5 text-indigo-600" />
                          View Year-over-Year Rate History
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {onSelectProductForRfq && (
                          <button
                            onClick={() => onSelectProductForRfq(toProductItem(lookupResult.product!))}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
                          >
                            <Plus className="w-4 h-4" />
                            Add to RFQ with Locked Rate
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: IMPORT BATCHES & ROLLBACK AUDIT TRAIL */}
      {browserTab === 'BATCHES' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  <span>Catalogue Import Batches & Rollback Audit Trail</span>
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Every catalogue upload creates an atomic batch. Rollbacks cleanly purge newly added catalogue SKUs and restore prior version rates without breaking existing RFQs or PO rate snapshots.
                </p>
              </div>

              <button
                onClick={() => setIsImportModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-600/20"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload New Batch
              </button>
            </div>

            {(!importBatches || importBatches.length === 0) ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
                <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No Import Batches Found</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Upload an Excel or CSV brand catalogue to create versioned batches with rollback capability.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Batch ID & Version</th>
                      <th className="py-3 px-4">Brand</th>
                      <th className="py-3 px-4">Effective Date</th>
                      <th className="py-3 px-4">Items / Changes</th>
                      <th className="py-3 px-4">Uploaded By</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importBatches.map((batch) => {
                      const isRolledBack = batch.status === 'ROLLED_BACK';
                      const isConfirming = rollbackConfirmBatchId === batch.id;

                      return (
                        <tr key={batch.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-slate-900">{batch.id}</div>
                            <div className="text-slate-500 text-[11px]">{batch.catalogueVersion || 'Version 1.0'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 bg-slate-900 text-white rounded font-bold text-[11px]">
                              {batch.brandName}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700">
                            {batch.effectiveDate || '2026-08-01'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{batch.totalItems} total items</div>
                            <div className="text-[11px] text-slate-500">
                              +{batch.insertedItems ?? batch.newItems ?? 0} new, {batch.updatedItems ?? batch.rateChangedItems ?? 0} updated
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-slate-800 font-medium">{batch.importedBy || batch.uploadedBy || 'Admin'}</div>
                            <div className="text-[10px] text-slate-400">
                              {batch.importedAt ? new Date(batch.importedAt).toLocaleDateString('en-IN') : (batch.uploadDate ? new Date(batch.uploadDate).toLocaleDateString('en-IN') : '2026-08-01')}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                isRolledBack
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {batch.status || 'COMMITTED'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isRolledBack ? (
                              <span className="text-[11px] text-slate-400 italic">Rolled back</span>
                            ) : isConfirming ? (
                              <div className="flex items-center justify-end gap-1.5 animate-fade-in">
                                <button
                                  onClick={() => handleRollbackBatch(batch.id)}
                                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setRollbackConfirmBatchId(null)}
                                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[11px]"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setRollbackConfirmBatchId(batch.id)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 ml-auto"
                                title="Rollback all items introduced in this batch"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Rollback Batch
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Details Modal */}
      {selectedProductDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <BookmarkCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-lg">Product Specifications & MRP Details</h3>
              </div>
              <button
                onClick={() => setSelectedProductDetails(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {selectedProductDetails.brand}
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-2">
                  {selectedProductDetails.itemName}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {selectedProductDetails.description}
                </p>
              </div>

              {/* Grid of specs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Part Number</span>
                  <p className="font-mono font-semibold text-slate-800 mt-0.5">
                    {selectedProductDetails.partNumber || 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Model</span>
                  <p className="font-mono font-semibold text-slate-800 mt-0.5">
                    {selectedProductDetails.modelNumber || 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Manufacturer Code</span>
                  <p className="font-mono font-semibold text-slate-800 mt-0.5">
                    {selectedProductDetails.manufacturerCode || 'OEM-SPEC'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Category</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {selectedProductDetails.category}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Sub-Category</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {selectedProductDetails.subCategory || 'General'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">UOM</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {selectedProductDetails.uom || 'NOS'}
                  </p>
                </div>
              </div>

              {/* MRP & Purchase Pricing Engine Details */}
              <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-2">
                <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                  MRP & Discount Architecture
                </h4>
                <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                  <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                    <span className="text-slate-500">Official MRP</span>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                      {selectedProductDetails.mrp
                        ? `₹${selectedProductDetails.mrp.toLocaleString('en-IN')}`
                        : 'Not Listed'}
                    </p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                    <span className="text-slate-500">Discount</span>
                    <p className="text-sm font-bold text-emerald-600 mt-0.5">
                      {selectedProductDetails.discountPercentage
                        ? `${selectedProductDetails.discountPercentage}% OFF`
                        : 'Negotiated'}
                    </p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                    <span className="text-slate-500">Net Purchase Rate</span>
                    <p className="text-sm font-bold text-indigo-700 mt-0.5">
                      ₹
                      {(
                        selectedProductDetails.netPurchaseRate ||
                        (selectedProductDetails.mrp && selectedProductDetails.discountPercentage
                          ? Math.round(
                              selectedProductDetails.mrp *
                                (1 - selectedProductDetails.discountPercentage / 100)
                            )
                          : selectedProductDetails.approxRate || 0)
                      ).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Technical Specifications */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Full Technical Specifications
                </h4>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {selectedProductDetails.specification || 'Standard industrial OEM specification sheet.'}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                HSN Code: <strong className="text-slate-800">{selectedProductDetails.hsnCode || '8482'}</strong> | GST: <strong>{selectedProductDetails.gstRate || 18}%</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedProductDetails(null)}
                  className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Close
                </button>
                {onSelectProductForRfq && (
                  <button
                    onClick={() => {
                      onSelectProductForRfq(selectedProductDetails);
                      setSelectedProductDetails(null);
                    }}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Use in RFQ
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Catalogue Import Modal */}
      <CatalogueImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      {/* Import History Modal */}
      <ImportHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />

      {/* Duplicate Review Modal */}
      <DuplicateReviewModal
        isOpen={isDuplicateReviewOpen}
        onClose={() => setIsDuplicateReviewOpen(false)}
      />

      {/* Rate History & Versioning Modal */}
      {viewingRateHistoryProduct && (
        <RateHistoryModal
          isOpen={!!viewingRateHistoryProduct}
          onClose={() => setViewingRateHistoryProduct(null)}
          partCode={viewingRateHistoryProduct.partNumber}
          brand={viewingRateHistoryProduct.brand}
          productName={viewingRateHistoryProduct.itemName}
          currentMrp={viewingRateHistoryProduct.mrp}
          currentPurchaseRate={viewingRateHistoryProduct.netPurchaseRate || viewingRateHistoryProduct.approxRate}
        />
      )}
    </div>
  );
};
