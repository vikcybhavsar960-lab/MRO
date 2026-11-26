import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  X,
  Building,
  CheckCircle,
  Phone,
  Mail,
  MapPin,
  Star,
  Sparkles,
  Layers,
  Tag,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Vendor } from '../../types';
import { searchVendorsMultiFacet, STANDARDIZED_MRO_CATEGORIES } from '../../services/aiCatalogService';

interface VendorSearchAndMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVendorForRfq?: (vendorId: string) => void;
}

export const VendorSearchAndMatchModal: React.FC<VendorSearchAndMatchModalProps> = ({
  isOpen,
  onClose,
  onSelectVendorForRfq,
}) => {
  const { vendors, categories, setActiveTab } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedSubCategory, setSelectedSubCategory] = useState('ALL');
  const [brandFilter, setBrandFilter] = useState('');
  const [partNumberFilter, setPartNumberFilter] = useState('');

  // Available sub-categories for active category
  const availableSubCategories = useMemo(() => {
    if (selectedCategory === 'ALL') return [];
    const catObj = STANDARDIZED_MRO_CATEGORIES.find(
      (c) => c.category.toLowerCase() === selectedCategory.toLowerCase()
    );
    return catObj ? catObj.subCategories : [];
  }, [selectedCategory]);

  const searchResults = useMemo(() => {
    return searchVendorsMultiFacet(vendors, {
      text: searchQuery,
      category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
      subCategory: selectedSubCategory !== 'ALL' ? selectedSubCategory : undefined,
      brand: brandFilter.trim() || undefined,
      partNumber: partNumberFilter.trim() || undefined,
    });
  }, [vendors, searchQuery, selectedCategory, selectedSubCategory, brandFilter, partNumberFilter]);

  if (!isOpen) return null;

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('ALL');
    setSelectedSubCategory('ALL');
    setBrandFilter('');
    setPartNumberFilter('');
  };

  const handleQuickPreset = (preset: string) => {
    setSearchQuery(preset);
    setSelectedCategory('ALL');
    setSelectedSubCategory('ALL');
    setBrandFilter('');
    setPartNumberFilter('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>Multi-Facet AI Vendor Search</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-200 font-mono">
                  Deep Catalog Matching
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                Search suppliers across Products, Categories, Sub-categories, Brands, Part Numbers, and Keywords
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Multi-Facet Filters */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
          {/* Main Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search e.g. 'Festo Pneumatic Valve', 'SKF 6205 Bearing', 'LC1D25 Contactor', 'Polycab Cable'..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] pb-1">
            <span className="text-slate-400 font-semibold shrink-0">Try Searches:</span>
            {['Festo Pneumatic Valve', 'SKF 6205-2RS Bearing', 'Schneider TeSys Contactor', 'Polycab 4 Core Armoured Cable'].map(
              (p, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickPreset(p)}
                  className="px-2.5 py-1 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-full font-medium shrink-0 transition-colors shadow-2xs"
                >
                  {p}
                </button>
              )
            )}
          </div>

          {/* Advanced Multi-Facet Filter Row */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-200/80 text-xs">
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-0.5 uppercase">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedSubCategory('ALL');
                }}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
              >
                <option value="ALL">All Categories (30)</option>
                {STANDARDIZED_MRO_CATEGORIES.map((c, i) => (
                  <option key={i} value={c.category}>
                    {c.category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-0.5 uppercase">Sub-Category</label>
              <select
                value={selectedSubCategory}
                onChange={(e) => setSelectedSubCategory(e.target.value)}
                disabled={availableSubCategories.length === 0}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="ALL">
                  {availableSubCategories.length > 0 ? 'All Sub-Categories' : 'Select Category first'}
                </option>
                {availableSubCategories.map((s, i) => (
                  <option key={i} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-0.5 uppercase">Brand / OEM</label>
              <input
                type="text"
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                placeholder="e.g. SKF, Siemens, Festo"
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-0.5 uppercase">Part / Model #</label>
              <input
                type="text"
                value={partNumberFilter}
                onChange={(e) => setPartNumberFilter(e.target.value)}
                placeholder="e.g. 6205-2RS, LC1D25"
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Results Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Matched Suppliers: <strong className="text-slate-900">{searchResults.length}</strong>
            </span>
            {(searchQuery || selectedCategory !== 'ALL' || brandFilter || partNumberFilter) && (
              <button onClick={clearFilters} className="text-blue-600 hover:underline font-bold">
                Clear Filters
              </button>
            )}
          </div>

          {searchResults.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs space-y-2">
              <Building className="w-10 h-10 mx-auto text-slate-300" />
              <p className="font-bold text-slate-600">No matching vendors found for this search.</p>
              <p>Try searching by broader brand name, category keyword, or clear specific filters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {searchResults.map((res) => {
                const v = res.vendor;
                const matchBadgeColor =
                  res.matchScore >= 90
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : res.matchScore >= 75
                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                    : 'bg-slate-100 text-slate-700 border-slate-200';

                return (
                  <div
                    key={v.id}
                    className="p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-400 shadow-2xs hover:shadow-sm transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div className="p-2 bg-slate-100 text-slate-700 rounded-lg shrink-0 mt-0.5">
                          <Building className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 text-sm">{v.companyName}</h4>
                            <span className="font-mono text-[10px] font-bold text-blue-700">{v.id}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {v.contactPerson} • {v.city}, {v.state}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border font-mono ${matchBadgeColor}`}>
                          {res.matchScore}% Match
                        </span>
                      </div>
                    </div>

                    {/* Match Reasons Pill Grid */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      {res.matchReasons.map((reason, rIdx) => (
                        <span
                          key={rIdx}
                          className="px-2 py-0.5 bg-slate-50 text-slate-700 rounded-md border border-slate-200 font-medium flex items-center gap-1"
                        >
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          <span>{reason}</span>
                        </span>
                      ))}
                    </div>

                    {/* Contact Bar */}
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                      <div className="flex items-center gap-4">
                        <a href={`tel:${v.mobile}`} className="flex items-center gap-1 text-slate-700 hover:text-blue-600">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{v.mobile}</span>
                        </a>
                        <a href={`mailto:${v.email}`} className="flex items-center gap-1 text-slate-700 hover:text-blue-600">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{v.email}</span>
                        </a>
                      </div>

                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="font-semibold text-slate-600">Catalog Inventory:</span>
                        <span className="font-bold text-blue-700 font-mono">
                          {((v.catalogProducts || []).length + (v.productsSupplied || []).length)} products mapped
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
