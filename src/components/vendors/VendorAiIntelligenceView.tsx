import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  FileText,
  FileSpreadsheet,
  AlertTriangle,
  ShieldCheck,
  Bot,
  Search,
  Filter,
  Check,
  X,
  Plus,
  Tag,
  Building,
  Layers,
  ArrowRight,
  Clock,
  History,
  Copy,
  ExternalLink,
  Globe,
  RefreshCw,
  Archive,
  Award,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  Vendor,
  VendorMaterialCategory,
  VendorCatalogProduct,
  CatalogueBatchSummary,
} from '../../types';
import { AiCatalogAnalyzerModal } from './AiCatalogAnalyzerModal';
import { calculateVendorIntelligenceScore } from '../../services/vendorIntelligenceService';

interface VendorAiIntelligenceViewProps {
  vendor: Vendor;
}

export const VendorAiIntelligenceView: React.FC<VendorAiIntelligenceViewProps> = ({ vendor }) => {
  const {
    aiActivityLogs,
    approveVendorMaterialCategory,
    rejectVendorMaterialCategory,
    editVendorMaterialCategory,
    approveAllVendorMaterialCategories,
    approveVendorCatalogProduct,
    rejectVendorCatalogProduct,
    deleteVendorCatalogFile,
    analyzeVendorWebsite,
    manageVendorCatalogueBatch,
  } = useApp();

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<VendorMaterialCategory | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editSubCategoryName, setEditSubCategoryName] = useState('');
  const [editBrands, setEditBrands] = useState('');

  // Website Intelligence state
  const [websiteInputUrl, setWebsiteInputUrl] = useState(vendor.website || vendor.websiteUrls?.[0] || '');
  const [isAnalyzingWebsite, setIsAnalyzingWebsite] = useState(false);
  const [websiteError, setWebsiteError] = useState<string | null>(null);

  // Batch & Source Modals
  const [viewSourceProduct, setViewSourceProduct] = useState<VendorCatalogProduct | null>(null);
  const [compareBatch, setCompareBatch] = useState<CatalogueBatchSummary | null>(null);
  const [batchActionMsg, setBatchActionMsg] = useState<string | null>(null);
  const [confirmForceRollback, setConfirmForceRollback] = useState<{
    batchId: string;
    message: string;
    references: string[];
  } | null>(null);

  // Products inventory search & filters
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('ALL');
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);

  const catalogFiles = vendor.catalogFiles || [];
  const catalogProducts = vendor.catalogProducts || [];
  const catalogueBatches = vendor.catalogueBatches || [];
  const aiCategories = vendor.aiMaterialCategories || [];
  const pendingCategories = aiCategories.filter((c) => c.status === 'PENDING_APPROVAL');
  const liveScore = calculateVendorIntelligenceScore(vendor);
  const displayScore = vendor.intelligenceScore ?? liveScore.totalScore;
  const displayBreakdown = vendor.intelligenceScoreBreakdown || liveScore;

  // Filter products
  const filteredProducts = catalogProducts.filter((p) => {
    const matchesSearch =
      !productSearch ||
      p.productName.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.partNumber && p.partNumber.toLowerCase().includes(productSearch.toLowerCase())) ||
      p.brand.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.specification?.toLowerCase().includes(productSearch.toLowerCase());

    const matchesCat = productCategoryFilter === 'ALL' || p.category === productCategoryFilter;
    const matchesDup = !showDuplicatesOnly || p.isDuplicate;

    return matchesSearch && matchesCat && matchesDup;
  });

  // Vendor-specific activity logs
  const vendorLogs = aiActivityLogs.filter((l) => l.vendorId === vendor.id);

  const handleOpenEdit = (cat: VendorMaterialCategory) => {
    setEditingCategory(cat);
    setEditCategoryName(cat.category);
    setEditSubCategoryName(cat.subCategory || '');
    setEditBrands((cat.brands || []).join(', '));
  };

  const handleSaveEdit = () => {
    if (!editingCategory) return;
    editVendorMaterialCategory(vendor.id, editingCategory.id, {
      category: editCategoryName.trim(),
      subCategory: editSubCategoryName.trim() || undefined,
      brands: editBrands.split(',').map((b) => b.trim()).filter(Boolean),
    });
    setEditingCategory(null);
  };

  const handleAnalyzeWebsite = async () => {
    const targetUrl = websiteInputUrl.trim();
    if (!targetUrl) {
      setWebsiteError('Please enter a valid supplier website URL (e.g., https://4dtechnology.in)');
      return;
    }
    setIsAnalyzingWebsite(true);
    setWebsiteError(null);
    const res = await analyzeVendorWebsite(vendor.id, targetUrl);
    if (!res.success) {
      setWebsiteError(res.error || 'Failed to analyze supplier website.');
    }
    setIsAnalyzingWebsite(false);
  };

  const handleBatchAction = async (
    batchId: string,
    action: 'ARCHIVE' | 'DEACTIVATE' | 'RESTORE' | 'ROLLBACK',
    force: boolean = false
  ) => {
    setBatchActionMsg(null);
    const res = await manageVendorCatalogueBatch(vendor.id, batchId, action, force);
    if (res.requiresConfirmation) {
      setConfirmForceRollback({
        batchId,
        message: res.message,
        references: res.references || [],
      });
      return;
    }
    setBatchActionMsg(res.message);
  };

  return (
    <div className="space-y-6 text-xs text-slate-700">
      {/* 1. TOP KPI DASHBOARD & INTELLIGENCE SCORE CARD (Module 15, 16) */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight flex items-center gap-2 flex-wrap">
                <span>Vendor AI Intelligence & Coverage Dossier</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-400/30">
                  Score: {displayScore}/100 ({displayScore >= 75 ? 'HIGH' : displayScore >= 45 ? 'MEDIUM' : 'LOW'})
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">
                Multi-source supplier profile for <strong>{vendor.companyName}</strong>
                {vendor.dataSources && vendor.dataSources.length > 0 && ` • Sources: ${vendor.dataSources.join(' + ')}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setShowScoreBreakdown((s) => !s)}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Award className="w-3.5 h-3.5 text-amber-300" />
              <span>{showScoreBreakdown ? 'Hide Score Rules' : 'Score Breakdown'}</span>
            </button>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ Analyze Vendor Catalog</span>
            </button>
          </div>
        </div>

        {/* Transparent Score Breakdown */}
        {showScoreBreakdown && (
          <div className="p-3.5 bg-white/10 rounded-xl border border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div>Catalogue Available: <strong>{displayBreakdown.catalogueAvailable}/20</strong></div>
            <div>Website Crawled: <strong>{displayBreakdown.websiteAvailable}/15</strong></div>
            <div>Products Indexed: <strong>{displayBreakdown.productsIdentified}/20</strong></div>
            <div>Brands Identified: <strong>{displayBreakdown.brandsIdentified}/15</strong></div>
            <div>Exact Part Codes: <strong>{displayBreakdown.partCodesIdentified}/15</strong></div>
            <div>Specs Extracted: <strong>{displayBreakdown.specificationsIdentified}/10</strong></div>
            <div>Recently Verified: <strong>{displayBreakdown.recentlyVerified}/5</strong></div>
            <div>Total Intelligence: <strong className="text-emerald-300">{displayScore}/100</strong></div>
          </div>
        )}

        {/* 6 KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="p-3 bg-white/5 rounded-xl border border-white/10">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Files & Batches</span>
            <div className="text-xl font-bold font-mono text-white mt-0.5">
              {catalogFiles.length} <span className="text-[11px] text-slate-400">({catalogueBatches.length} ver)</span>
            </div>
          </div>

          <div className="p-3 bg-white/5 rounded-xl border border-white/10">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Products Indexed</span>
            <div className="text-xl font-bold font-mono text-blue-400 mt-0.5">{catalogProducts.length}</div>
          </div>

          <div className="p-3 bg-white/5 rounded-xl border border-white/10">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Product Families</span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
              {(vendor.productFamilies || Array.from(new Set(catalogProducts.map((p) => p.productFamily).filter(Boolean)))).length}
            </div>
          </div>

          <div className="p-3 bg-white/5 rounded-xl border border-white/10">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Brands Dealing</span>
            <div className="text-xl font-bold font-mono text-purple-400 mt-0.5">
              {(vendor.brandsDealing || vendor.brandsSupplied || []).length}
            </div>
          </div>

          <div className="p-3 bg-white/5 rounded-xl border border-white/10">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Pending Approvals</span>
            <div
              className={`text-xl font-bold font-mono mt-0.5 ${
                pendingCategories.length > 0 ? 'text-amber-400' : 'text-slate-400'
              }`}
            >
              {pendingCategories.length}
            </div>
          </div>

          <div className="p-3 bg-white/5 rounded-xl border border-white/10">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Last Verified</span>
            <div className="text-xs font-mono text-slate-300 mt-1 truncate">
              {vendor.lastAiAnalysisDate || vendor.lastWebsiteAnalysisDate || 'No runs yet'}
            </div>
          </div>
        </div>
      </div>

      {/* 1B. WEBSITE INTELLIGENCE ANALYZER PANEL (Modules 11-13) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-600" />
            <div>
              <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                Supplier Website Intelligence & PDF+Website Fusion
              </h4>
              <p className="text-[11px] text-slate-500">
                Crawl public supplier pages, product lines, OEM brands & downloadable brochure PDFs
              </p>
            </div>
          </div>
          {vendor.lastWebsiteAnalysisDate && (
            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold border border-blue-200">
              Last Crawled: {vendor.lastWebsiteAnalysisDate}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={websiteInputUrl}
            onChange={(e) => setWebsiteInputUrl(e.target.value)}
            placeholder="https://example-supplier.com"
            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800"
          />
          <button
            type="button"
            onClick={handleAnalyzeWebsite}
            disabled={isAnalyzingWebsite}
            className="px-4 py-2 bg-slate-900 hover:bg-black disabled:bg-slate-400 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzingWebsite ? 'animate-spin' : ''}`} />
            <span>{isAnalyzingWebsite ? 'Crawling Website...' : 'Analyse Website'}</span>
          </button>
        </div>

        {websiteError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{websiteError}</span>
          </div>
        )}

        {vendor.websiteIntelligence && (
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-[11px]">
            {vendor.websiteIntelligence.companyOverview && (
              <p className="text-slate-700">
                <strong>Website Overview:</strong> {vendor.websiteIntelligence.companyOverview}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {(() => {
                const pages = vendor.websiteIntelligence.crawledPages || vendor.websiteIntelligence.pagesCrawled || [];
                return (
                  <>
                    <span className="text-slate-500 font-semibold">
                      Crawled Pages ({pages.length}):
                    </span>
                    {pages.map((pg: string, i: number) => (
                      <a
                        key={i}
                        href={pg}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 hover:underline font-mono truncate max-w-[220px]"
                      >
                        {pg}
                      </a>
                    ))}
                  </>
                );
              })()}
            </div>
            {vendor.websiteIntelligence.pdfLinks.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-slate-500 font-semibold">Discovered Brochure PDFs:</span>
                {vendor.websiteIntelligence.pdfLinks.slice(0, 6).map((pdf, i) => (
                  <a
                    key={i}
                    href={pdf.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-0.5 bg-white border border-blue-200 text-blue-700 rounded font-medium hover:bg-blue-50"
                  >
                    {pdf.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 1C. COVERAGE DASHBOARD, ONBOARDING SOURCES & BRAND ASSOCIATIONS (Modules 16, 26, 35) */}
      {(catalogProducts.length > 0 || (vendor.manufacturerAssociations || []).length > 0 || (vendor.brandAssociations || []).length > 0 || (vendor.onboardingSourcesSummary || []).length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <h4 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Category & Product Family Coverage</span>
            </h4>
            <div className="space-y-2">
              {Object.entries(
                catalogProducts.reduce((acc: Record<string, number>, p) => {
                  const k = p.productFamily || p.category || 'General';
                  acc[k] = (acc[k] || 0) + 1;
                  return acc;
                }, {})
              )
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([fam, count]) => {
                  const pct = Math.min(100, Math.round((count / Math.max(1, catalogProducts.length)) * 100));
                  return (
                    <div key={fam} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-semibold text-slate-800">{fam}</span>
                        <span className="font-mono text-slate-600">{count} items ({pct}%)</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-1.5 bg-indigo-600 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>

            {vendor.onboardingSourcesSummary && vendor.onboardingSourcesSummary.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  Onboarding Sources Analyzed ({vendor.onboardingSourcesSummary.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {vendor.onboardingSourcesSummary.map((src, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-medium border border-slate-200"
                    >
                      {src.sourceType}: {src.sourceName} ({src.itemsExtracted} items)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <h4 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Brand & Manufacturer Associations (Evidence-Based)</span>
            </h4>
            {vendor.brandAssociations && vendor.brandAssociations.length > 0 ? (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-1.5 px-2.5">Brand</th>
                      <th className="py-1.5 px-2.5">Relationship</th>
                      <th className="py-1.5 px-2.5 text-center">Prods</th>
                      <th className="py-1.5 px-2.5">Source &amp; Conf</th>
                      <th className="py-1.5 px-2.5">Verified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vendor.brandAssociations.map((ba, idx) => (
                      <tr key={idx} title={ba.evidence || ba.source}>
                        <td className="py-2 px-2.5 font-bold text-slate-900">
                          {ba.brandName}
                          {ba.brandId && <span className="block text-[9px] font-mono text-slate-400">{ba.brandId}</span>}
                        </td>
                        <td className="py-2 px-2.5">
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-800 rounded text-[10px] font-bold border border-blue-200">
                            {ba.relationshipType}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-center font-mono font-bold">{ba.productCount}</td>
                        <td className="py-2 px-2.5 text-slate-600">
                          {ba.source} <span className="font-mono text-emerald-700">({ba.confidence}%)</span>
                        </td>
                        <td className="py-2 px-2.5 font-mono text-[10px] text-slate-500">{ba.lastVerified}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(vendor.manufacturerAssociations && vendor.manufacturerAssociations.length > 0
                  ? vendor.manufacturerAssociations
                  : (vendor.brandsSupplied || []).map((b) => ({
                      brand: b,
                      relationship: 'Listed In Catalogue',
                      evidence: 'Vendor profile',
                    }))
                ).map((assoc, i) => (
                  <div
                    key={i}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2"
                    title={assoc.evidence}
                  >
                    <span className="font-bold text-slate-900">{assoc.brand}</span>
                    <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded text-[9px] font-bold">
                      {assoc.relationship}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1D. CATALOGUE VERSION HISTORY & ROLLBACK MANAGER (Modules 19-23) */}
      {catalogueBatches.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                Catalogue Version History & Batch Manager ({catalogueBatches.length})
              </h4>
            </div>
            {batchActionMsg && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                {batchActionMsg}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">Batch ID & Version</th>
                  <th className="py-2 px-3">Source File</th>
                  <th className="py-2 px-3">Uploaded</th>
                  <th className="py-2 px-3">Diff Summary</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {catalogueBatches.map((batch) => {
                  const bId = batch.id || batch.batchId || batch.version;
                  const bDate = batch.uploadedAt || batch.uploadDate || new Date().toISOString();
                  const bRateChanges = batch.rateChangesCount ?? batch.rateChangedCount ?? 0;
                  return (
                  <tr key={bId} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <div className="font-mono font-bold text-blue-700">{bId}</div>
                      <div className="text-[10px] text-slate-500">
                        {batch.version} {batch.effectiveDate ? `• Eff: ${batch.effectiveDate}` : ''}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{batch.fileName}</td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-500">
                      {new Date(bDate).toLocaleDateString()} • {batch.uploadedBy}
                    </td>
                    <td className="py-2.5 px-3 text-[11px] font-mono">
                      <span className="text-emerald-700">+{batch.newCount ?? 0} new</span> •{' '}
                      <span className="text-blue-700">{bRateChanges} rate Δ</span> •{' '}
                      <span className="text-amber-700">{batch.removedCount ?? 0} missing</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          batch.status === 'CURRENT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : batch.status === 'ARCHIVED'
                              ? 'bg-slate-200 text-slate-700'
                              : batch.status === 'ROLLED_BACK'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {batch.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setCompareBatch(batch)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
                      >
                        Compare
                      </button>
                      {batch.status === 'ARCHIVED' || batch.status === 'ROLLED_BACK' ? (
                        <button
                          type="button"
                          onClick={() => handleBatchAction(bId, 'RESTORE')}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold"
                        >
                          Restore
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleBatchAction(bId, 'ARCHIVE')}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[10px] font-bold"
                          >
                            Archive
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBatchAction(bId, 'ROLLBACK')}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[10px] font-bold"
                          >
                            Rollback
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2A. VENDOR MATERIAL PROFILE: MATERIALS DEALING IN (Requirement 4) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-emerald-600" />
            <div>
              <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                Vendor → Materials Dealing In
              </h4>
              <p className="text-[11px] text-slate-500">
                Approved material categories verified from catalogs, quotations, and vendor master
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[10px] border border-emerald-200 self-start sm:self-auto">
            {(vendor.materialCategories || vendor.productCategories || []).length} Active Dealing Categories
          </span>
        </div>

        {(() => {
          const approvedCategories = aiCategories.filter((c) => c.status === 'APPROVED');
          // If no specific AI approved records, fallback to vendor's materialCategories
          const displayList =
            approvedCategories.length > 0
              ? approvedCategories
              : (vendor.materialCategories || vendor.productCategories || []).map((catName, idx) => ({
                  id: `CAT-LEGACY-${idx}`,
                  category: catName,
                  subCategory: (vendor.subCategories || [])[idx] || 'General Components',
                  brands: vendor.brandsSupplied || [],
                  productsFoundCount: catalogProducts.filter((p) => p.category === catName).length || 1,
                  confidence: 95,
                  sourceDocument: 'Vendor Registration & Master Profile',
                  status: 'APPROVED' as const,
                }));

          if (displayList.length === 0) {
            return (
              <div className="p-6 text-center text-slate-400 text-xs">
                No approved categories recorded yet. Approve suggestions below or analyze a catalog.
              </div>
            );
          }

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100/70 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Sub-Category</th>
                    <th className="py-2.5 px-3">Brands</th>
                    <th className="py-2.5 px-3 text-center">Products Identified</th>
                    <th className="py-2.5 px-3 text-center">AI Confidence</th>
                    <th className="py-2.5 px-3">Source Document</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {displayList.map((cat, idx) => (
                    <tr key={cat.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{cat.category}</td>
                      <td className="py-3 px-3 text-slate-600">{cat.subCategory || '-'}</td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {(cat.brands || []).map((b, i) => (
                            <span key={i} className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded text-[10px] font-mono">
                              {b}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-blue-700">
                        {cat.productsFoundCount}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                          {cat.confidence}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-[11px] truncate max-w-xs" title={cat.sourceDocument}>
                        {cat.sourceDocument}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Approved</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* 2B. AI SUGGESTED CATEGORIES & USER APPROVAL (Requirement 5) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-blue-600" />
            <div>
              <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                AI Suggested Categories (Pending Approval)
              </h4>
              <p className="text-[11px] text-slate-500">
                User Approval Required: Master data will only be permanently updated once approved
              </p>
            </div>
            {pendingCategories.length > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-full text-[10px] animate-pulse">
                {pendingCategories.length} Pending
              </span>
            )}
          </div>

          {pendingCategories.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => approveAllVendorMaterialCategories(vendor.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve All ({pendingCategories.length})</span>
              </button>
            </div>
          )}
        </div>

        {pendingCategories.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs space-y-1">
            <p>All AI category suggestions have been reviewed and approved.</p>
            <p className="text-[11px] text-slate-400">
              Upload a new vendor catalog or quotation to detect additional product categories.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Sub-Category</th>
                  <th className="py-2.5 px-3">Brands Identified</th>
                  <th className="py-2.5 px-3 text-center">Products Found</th>
                  <th className="py-2.5 px-3 text-center">Confidence</th>
                  <th className="py-2.5 px-3">Source Document</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingCategories.map((cat) => {
                  const confidenceBadge =
                    cat.confidence >= 90
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : cat.confidence >= 70
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-rose-100 text-rose-800 border-rose-200';

                  return (
                    <tr key={cat.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-900">
                        <span>{cat.category}</span>
                        {cat.isNewSuggestedCategory && (
                          <span className="ml-1.5 px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded text-[9px] font-mono">
                            New Suggested
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-medium">{cat.subCategory || '-'}</td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {(cat.brands || []).map((b, i) => (
                            <span key={i} className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded text-[10px] font-mono">
                              {b}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold font-mono text-slate-900">
                        {cat.productsFoundCount}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border font-mono ${confidenceBadge}`}>
                          {cat.confidence}%
                        </span>
                        {cat.confidence < 70 && (
                          <div className="text-[9px] text-rose-600 font-bold mt-0.5">Manual Review Required</div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-[11px] truncate max-w-xs" title={cat.sourceDocument}>
                        {cat.sourceDocument}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => approveVendorMaterialCategory(vendor.id, cat.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition-colors shadow-2xs"
                            title="Approve and save to Vendor Materials Dealing In"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleOpenEdit(cat)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors"
                            title="Edit category / sub-category before approving"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => rejectVendorMaterialCategory(vendor.id, cat.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                            title="Reject category"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. UPLOADED VENDOR CATALOG DOCUMENTS (Requirement 1) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
              Analyzed Catalogs, Price Lists & Quotation Documents ({catalogFiles.length})
            </h4>
          </div>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold border border-blue-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload New File</span>
          </button>
        </div>

        {catalogFiles.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">
            No catalog documents uploaded yet. Upload a PDF, Excel, or quotation to start AI analysis.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">File Name</th>
                  <th className="py-2.5 px-3">Upload Date</th>
                  <th className="py-2.5 px-3">File Type</th>
                  <th className="py-2.5 px-3 text-center">Processing Status</th>
                  <th className="py-2.5 px-3 text-center">AI Analysis</th>
                  <th className="py-2.5 px-3 text-center">Products Identified</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {catalogFiles.map((file) => (
                  <tr key={file.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>{file.fileName}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{file.uploadDate}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 font-bold text-slate-700">
                        {file.fileType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                        {file.processingStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {file.aiAnalysisStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold font-mono text-blue-700">
                      {file.productsIdentifiedCount} Items
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => deleteVendorCatalogFile(vendor.id, file.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                        title="Remove file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. AI EXTRACTED PRODUCTS INVENTORY (Requirement 2 & 11) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-3 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h4 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Extracted Product Master Items ({filteredProducts.length} of {catalogProducts.length})</span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Extracted part numbers, dimensions, specifications, and duplicate-detection keys
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Filter by part, model, brand..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Category Filter */}
            <select
              value={productCategoryFilter}
              onChange={(e) => setProductCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
            >
              <option value="ALL">All Categories</option>
              {Array.from(new Set(catalogProducts.map((p) => p.category))).map((c, i) => (
                <option key={i} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Duplicate Filter Toggle */}
            <button
              onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                showDuplicatesOnly
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Duplicates Only
            </button>
          </div>
        </div>

        {catalogProducts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No products extracted yet. Click "+ Analyze Vendor Catalog" to ingest catalog items.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">Product Name</th>
                  <th className="py-2 px-3">Category & Family</th>
                  <th className="py-2 px-3">Brand</th>
                  <th className="py-2 px-3">Exact Part # / Model</th>
                  <th className="py-2 px-3">MRP / Purchase Rate</th>
                  <th className="py-2 px-3">Source</th>
                  <th className="py-2 px-2 text-center">Confidence</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 max-w-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{p.productName}</span>
                        {p.catalogueStatus === 'NOT_PRESENT_IN_LATEST' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                            Not Present in Latest Catalogue
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal line-clamp-1">{p.specification || p.description}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-blue-50 text-blue-800 border border-blue-200">
                        {p.category}
                      </span>
                      <div className="text-[10px] text-emerald-700 mt-0.5 font-semibold">
                        {p.productFamily || p.subCategory || 'General MRO'}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">{p.brand}</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">{p.partNumber || p.modelNumber || '-'}</td>
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                      {p.purchaseRate !== undefined || p.mrp !== undefined ? (
                        <div>
                          {p.purchaseRate !== undefined && (
                            <span className="font-bold text-emerald-700 block">₹{p.purchaseRate.toLocaleString('en-IN')}</span>
                          )}
                          {p.mrp !== undefined && (
                            <span className="text-[10px] text-slate-500">MRP: ₹{p.mrp.toLocaleString('en-IN')}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[10px]">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => setViewSourceProduct(p)}
                        className="text-blue-700 hover:underline font-medium flex items-center gap-1 text-[10px]"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="truncate max-w-[110px]">{p.catalogReference || p.sourceType || 'View Source'}</span>
                      </button>
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono font-bold">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          p.aiConfidence >= 90
                            ? 'text-emerald-700 bg-emerald-50'
                            : p.aiConfidence >= 75
                            ? 'text-amber-700 bg-amber-50'
                            : 'text-rose-700 bg-rose-50'
                        }`}
                      >
                        {p.aiConfidence}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {p.catalogueStatus === 'ARCHIVED' ? (
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          Archived
                        </span>
                      ) : p.approvalStatus === 'APPROVED' ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Active
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {p.approvalStatus !== 'APPROVED' ? (
                          <button
                            onClick={() => approveVendorCatalogProduct(vendor.id, p.id)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            title="Approve product"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => rejectVendorCatalogProduct(vendor.id, p.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Reject product"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. AI ACTIVITY LOG & AUDIT TRAIL (Requirement 13) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-blue-600" />
            <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
              AI Activity Log & Safety Audit Trail ({vendorLogs.length})
            </h4>
          </div>
          <span className="text-[11px] text-slate-400">All AI actions & human approvals are strictly logged</span>
        </div>

        {vendorLogs.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">
            No AI activity logs recorded for this vendor yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Date / Time</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">File / Source</th>
                  <th className="py-2.5 px-3">Items / Categories</th>
                  <th className="py-2.5 px-3">Confidence</th>
                  <th className="py-2.5 px-3">User Action</th>
                  <th className="py-2.5 px-3">Safety Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendorLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">{log.timestamp}</td>
                    <td className="py-2.5 px-3 font-bold text-blue-700">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-[10px] border border-blue-200 font-mono">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 max-w-xs truncate">{log.fileName || 'Quotation / Direct'}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-slate-900">{log.productsCount} items</span>
                      {log.categoriesSuggested.length > 0 && (
                        <div className="text-[10px] text-slate-400 line-clamp-1">
                          {log.categoriesSuggested.join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{log.confidence}%</td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{log.userAction}</td>
                    <td className="py-2.5 px-3 text-slate-500 max-w-sm truncate" title={log.details}>
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Category Modal */}
      {editingCategory && (
        <div role="dialog" aria-modal="true" aria-label="Edit AI Suggested Category" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-bold text-sm text-slate-900">Edit AI Suggested Category</h4>
              <button type="button" aria-label="Close modal" onClick={() => setEditingCategory(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Standard Category</label>
                <input
                  type="text"
                  value={editCategoryName}
                  onChange={(e) => setEditCategoryName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Sub-Category</label>
                <input
                  type="text"
                  value={editSubCategoryName}
                  onChange={(e) => setEditSubCategoryName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Brands (Comma-separated)</label>
                <input
                  type="text"
                  value={editBrands}
                  onChange={(e) => setEditBrands(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setEditingCategory(null)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload & Analyzer Modal */}
      <AiCatalogAnalyzerModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        vendor={vendor}
      />

      {/* View Source Modal */}
      {viewSourceProduct && (
        <div role="dialog" aria-modal="true" aria-label="Source Citation and Verification" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-lg w-full shadow-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="font-bold text-sm text-slate-900">Source Citation & Verification</h4>
              <button type="button" aria-label="Close modal" onClick={() => setViewSourceProduct(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="font-bold text-slate-900">{viewSourceProduct.productName}</div>
              <div className="font-mono text-blue-700">
                {viewSourceProduct.brand} • {viewSourceProduct.partNumber || viewSourceProduct.modelNumber}
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div><strong>Reference:</strong> {viewSourceProduct.catalogReference || 'Catalogue Upload'}</div>
                <div><strong>Page / Source Type:</strong> Page {viewSourceProduct.sourcePage || 1} ({viewSourceProduct.sourceType || 'PDF'})</div>
                {viewSourceProduct.sourceUrl && (
                  <div><strong>URL:</strong> <span className="font-mono break-all">{viewSourceProduct.sourceUrl}</span></div>
                )}
              </div>
              {viewSourceProduct.evidence && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl font-mono text-[11px]">
                  "{viewSourceProduct.evidence}"
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setViewSourceProduct(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Compare Modal */}
      {compareBatch && (
        <div role="dialog" aria-modal="true" aria-label="Batch Snapshot Summary" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="font-bold text-sm text-slate-900">Batch Snapshot Summary: {compareBatch.id || compareBatch.batchId}</h4>
              <button type="button" aria-label="Close modal" onClick={() => setCompareBatch(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">Total Extracted</span>
                <strong className="text-sm">{compareBatch.totalExtracted ?? compareBatch.productsCount ?? 0}</strong>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-emerald-700 block">New Products</span>
                <strong className="text-sm text-emerald-900">+{compareBatch.newCount ?? 0}</strong>
              </div>
              <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-200">
                <span className="text-blue-700 block">Rate Revisions</span>
                <strong className="text-sm text-blue-900">{compareBatch.rateChangesCount ?? compareBatch.rateChangedCount ?? 0}</strong>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-amber-700 block">Removed / Missing</span>
                <strong className="text-sm text-amber-900">{compareBatch.removedCount ?? 0}</strong>
              </div>
            </div>
            <div className="text-[11px] text-slate-600">
              <strong>Brands Detected:</strong> {(compareBatch.brandsDetected || []).join(', ') || 'None'}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setCompareBatch(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dependency-Safe Rollback Confirmation Modal */}
      {confirmForceRollback && (
        <div role="dialog" aria-modal="true" aria-label="Referenced Batch Rollback Confirmation" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-rose-200 space-y-3">
            <h4 className="font-bold text-sm text-rose-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Referenced Batch Rollback Confirmation</span>
            </h4>
            <p className="text-xs text-slate-700">{confirmForceRollback.message}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmForceRollback(null)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const bId = confirmForceRollback.batchId;
                  setConfirmForceRollback(null);
                  await handleBatchAction(bId, 'ROLLBACK', true);
                }}
                className="px-4 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold"
              >
                Confirm Safe Rollback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
