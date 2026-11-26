import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Tag,
  Building,
  Edit2,
  Trash2,
  Power,
  Sparkles,
  Info,
  ChevronRight,
  ChevronDown,
  X,
  ExternalLink,
  BookOpen,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MaterialCategory, Vendor } from '../../types';
import { getVendorCountByCategory, recommendCategoryForRequirement } from '../../services/categoryMatchingService';

export const CategoryMaster: React.FC = () => {
  const { categories, addCategory, updateCategory, deleteCategory, toggleCategoryStatus, addKeywordToCategory, vendors, setActiveTab } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | null>(null);

  // Modals state
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MaterialCategory | null>(null);
  const [isAddKeywordModalOpen, setIsAddKeywordModalOpen] = useState(false);
  const [keywordCatTarget, setKeywordCatTarget] = useState<MaterialCategory | null>(null);
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [isMappedVendorsModalOpen, setIsMappedVendorsModalOpen] = useState(false);
  const [mappedVendorsCat, setMappedVendorsCat] = useState<MaterialCategory | null>(null);
  const [isHierarchyModalOpen, setIsHierarchyModalOpen] = useState(false);
  const [hierarchyFilter, setHierarchyFilter] = useState('');
  const [expandedCatIds, setExpandedCatIds] = useState<string[]>(['CAT-003', 'CAT-004', 'CAT-031', 'CAT-032']);

  // Live Test Classifier state
  const [testItemName, setTestItemName] = useState('');
  const [testResult, setTestResult] = useState<any>(null);

  // Form states for Add/Edit
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSubCategories, setFormSubCategories] = useState('');
  const [formKeywords, setFormKeywords] = useState('');
  const [formExamples, setFormExamples] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Calculate vendor count mapping
  const vendorCounts = getVendorCountByCategory(categories, vendors);

  // Filtered list
  const filteredCategories = categories.filter((cat) => {
    const kws = cat.keywords || [];
    const subCats = cat.subCategories || [];
    const matchesSearch =
      (cat.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cat.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cat.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      kws.some((k) => (k || '').toLowerCase().includes(searchTerm.toLowerCase())) ||
      subCats.some((sc) => (sc || '').toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      statusFilter === 'ALL' || (statusFilter === 'ACTIVE' && cat.isActive) || (statusFilter === 'DISABLED' && !cat.isActive);

    return matchesSearch && matchesStatus;
  });

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormName('');
    setFormCode('');
    setFormDescription('');
    setFormSubCategories('');
    setFormKeywords('');
    setFormExamples('');
    setFormIsActive(true);
    setErrorMessage('');
    setIsAddEditModalOpen(true);
  };

  const handleOpenEdit = (cat: MaterialCategory) => {
    setEditingCategory(cat);
    setFormName(cat.name || '');
    setFormCode(cat.code || '');
    setFormDescription(cat.description || '');
    setFormSubCategories((cat.subCategories || []).join(', '));
    setFormKeywords((cat.keywords || []).join(', '));
    setFormExamples((cat.itemExamples || []).join(', '));
    setFormIsActive(cat.isActive !== false);
    setErrorMessage('');
    setIsAddEditModalOpen(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setErrorMessage('Category Name is required');
      return;
    }

    const subCats = formSubCategories
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const kws = formKeywords
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const egs = formExamples
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingCategory) {
      updateCategory({
        ...editingCategory,
        name: formName.trim(),
        code: formCode.trim().toUpperCase() || formName.substring(0, 3).toUpperCase(),
        description: formDescription.trim(),
        subCategories: subCats.length > 0 ? subCats : ['Standard'],
        keywords: kws.length > 0 ? kws : [formName.toLowerCase()],
        itemExamples: egs,
        isActive: formIsActive,
      });
    } else {
      addCategory({
        name: formName.trim(),
        code: formCode.trim().toUpperCase() || formName.substring(0, 3).toUpperCase(),
        description: formDescription.trim(),
        subCategories: subCats.length > 0 ? subCats : ['Standard'],
        keywords: kws.length > 0 ? kws : [formName.toLowerCase()],
        itemExamples: egs,
        isActive: formIsActive,
      });
    }

    setIsAddEditModalOpen(false);
  };

  const handleDeleteCategory = (cat: MaterialCategory) => {
    const res = deleteCategory(cat.id);
    if (!res.success) {
      alert(res.message);
    }
  };

  const handleOpenAddKeyword = (cat: MaterialCategory) => {
    setKeywordCatTarget(cat);
    setNewKeywordInput('');
    setIsAddKeywordModalOpen(true);
  };

  const handleSaveKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (keywordCatTarget && newKeywordInput.trim()) {
      addKeywordToCategory(keywordCatTarget.id, newKeywordInput.trim());
      setIsAddKeywordModalOpen(false);
    }
  };

  const handleOpenMappedVendors = (cat: MaterialCategory) => {
    setMappedVendorsCat(cat);
    setIsMappedVendorsModalOpen(true);
  };

  const handleTestClassifier = () => {
    if (!testItemName.trim()) return;
    const res = recommendCategoryForRequirement({ itemName: testItemName }, categories);
    setTestResult(res);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Material Category Master</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Industrial material taxonomies, sub-categories, smart alias keywords & auto-vendor matching
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsHierarchyModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
          >
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Taxonomy Hierarchy Explorer</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs shadow-blue-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Category</span>
          </button>
        </div>
      </div>

      {/* Live AI Category Recommendation Tester & Learning Widget */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-4 sm:p-5 rounded-2xl border border-blue-800/40 text-white shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-xs uppercase tracking-wider text-blue-300">
              Smart Auto-Category Recommendation Engine
            </span>
          </div>
          <span className="text-[11px] text-slate-300">
            Tests keyword detection on items like "SKF 6206 bearing", "Siemens 5A Fuse", or "Timing Belt HTD 424-8M"
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={testItemName}
              onChange={(e) => setTestItemName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTestClassifier()}
              placeholder="Type an item (e.g. SKF 6206 2RS Bearing, Siemens 5A Fuse, MOSIL FG800 Grease)..."
              className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleTestClassifier}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors shrink-0 shadow-xs"
          >
            Classify & Find Suppliers
          </button>
        </div>

        {testResult && (
          <div className="p-3 bg-white/10 rounded-xl border border-white/15 text-xs space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-300">Recommended Category:</span>
                <span className="px-2.5 py-0.5 bg-blue-500 text-white font-bold rounded-md">
                  {testResult.category}
                </span>
                <span className="text-[11px] text-emerald-300 font-mono font-bold">
                  {testResult.confidence}% Confidence
                </span>
              </div>
              {testResult.subCategory && (
                <div className="text-[11px] text-slate-300">
                  Sub-category: <strong className="text-white">{testResult.subCategory}</strong>
                </div>
              )}
            </div>

            {testResult.matchedKeywords && testResult.matchedKeywords.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                <span className="text-slate-400">Matched Keywords:</span>
                {testResult.matchedKeywords.map((kw: string, idx: number) => (
                  <span key={idx} className="px-1.5 py-0.5 bg-slate-800 text-amber-300 font-mono rounded text-[10px]">
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search categories, codes, subcategories, keywords..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
          >
            <option value="ALL">All Categories ({categories.length})</option>
            <option value="ACTIVE">Active Only ({categories.filter((c) => c.isActive).length})</option>
            <option value="DISABLED">Disabled ({categories.filter((c) => !c.isActive).length})</option>
          </select>
        </div>
      </div>

      {/* Category Master Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Category Name & Code</th>
                <th className="py-3 px-4">Sub-Categories</th>
                <th className="py-3 px-4">Keywords / Aliases</th>
                <th className="py-3 px-4 text-center">Mapped Vendors</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredCategories.map((cat) => {
                const count = vendorCounts[cat.name] || 0;
                return (
                  <tr key={cat.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Category & Code */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {cat.code}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{cat.name}</div>
                          <div className="text-[11px] text-slate-400 line-clamp-1">{cat.description}</div>
                        </div>
                      </div>
                    </td>

                    {/* Sub-categories */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 flex-wrap max-w-xs">
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                          {(cat.subCategories || []).length} sub-types
                        </span>
                        <span className="text-[11px] text-slate-600 truncate">
                          {(cat.subCategories || []).slice(0, 2).join(', ')}
                          {(cat.subCategories || []).length > 2 && ` +${(cat.subCategories || []).length - 2} more`}
                        </span>
                      </div>
                    </td>

                    {/* Keywords */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 flex-wrap max-w-sm">
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded">
                          {(cat.keywords || []).length} keywords
                        </span>
                        <div className="flex items-center gap-1 flex-wrap">
                          {(cat.keywords || []).slice(0, 3).map((kw, i) => (
                            <span key={i} className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {kw}
                            </span>
                          ))}
                          <button
                            onClick={() => handleOpenAddKeyword(cat)}
                            title="Add new keyword alias"
                            className="text-[10px] text-blue-600 hover:text-blue-800 font-bold hover:underline"
                          >
                            +Add
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Vendors mapped */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleOpenMappedVendors(cat)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                          count > 0
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                        }`}
                        title="Click to view all vendors mapped to this category"
                      >
                        <Building className="w-3.5 h-3.5" />
                        <span>{count} Vendors</span>
                      </button>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => toggleCategoryStatus(cat.id)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          cat.isActive
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {cat.isActive ? <CheckCircle className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-slate-400" />}
                        <span>{cat.isActive ? 'Active' : 'Disabled'}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(cat)}
                          title="Edit Category"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenAddKeyword(cat)}
                          title="Add Keyword Alias"
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          <Tag className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          title="Delete Category"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Category Modal */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <span>{editingCategory ? `Edit Category: ${editingCategory.name}` : 'Add New Material Category'}</span>
              </h3>
              <button
                onClick={() => setIsAddEditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-bold text-slate-700">Category Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Bearings, Pneumatic, Valves..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Code (3-4 chars)</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="e.g. BRG, PNE"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Industrial scope, primary use, components covered..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Sub-Categories (Comma-separated)</label>
                <input
                  type="text"
                  value={formSubCategories}
                  onChange={(e) => setFormSubCategories(e.target.value)}
                  placeholder="Deep Groove Ball Bearings, Taper Roller Bearings, Pillow Block Units..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                />
                <span className="text-[10px] text-slate-400">Allows sub-classification for fine-grained vendor matching</span>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Keywords & Aliases (Comma-separated) *</label>
                <textarea
                  rows={3}
                  value={formKeywords}
                  onChange={(e) => setFormKeywords(e.target.value)}
                  placeholder="bearing, 6205, 6206, 6305, skf, fag, timken, taper roller, spherical bearing..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px]"
                />
                <span className="text-[10px] text-slate-400">
                  Critical for auto-recommendation! Include part numbers, common brands, and synonyms.
                </span>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Catalog Item Examples (Comma-separated)</label>
                <input
                  type="text"
                  value={formExamples}
                  onChange={(e) => setFormExamples(e.target.value)}
                  placeholder="6206 2RS Bearing, SKF 6305 Deep Groove Ball Bearing..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveCat"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <label htmlFor="isActiveCat" className="font-bold text-slate-700 cursor-pointer">
                  Active (Available for automatic recommendations and vendor mapping)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs shadow-blue-500/20"
                >
                  {editingCategory ? 'Update Category' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Keyword Alias Modal */}
      {isAddKeywordModalOpen && keywordCatTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-600" />
                <span>Add Keyword to: {keywordCatTarget.name}</span>
              </h3>
              <button
                onClick={() => setIsAddKeywordModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Add a new keyword, part number, brand, or alias so the system will automatically recommend{' '}
              <strong>{keywordCatTarget.name}</strong> when users type this term.
            </p>

            <form onSubmit={handleSaveKeyword} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">New Keyword / Part # / Alias</label>
                <input
                  type="text"
                  value={newKeywordInput}
                  onChange={(e) => setNewKeywordInput(e.target.value)}
                  placeholder="e.g. NTN, 6206, HTD 424-8M, S7-1200..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm"
                  autoFocus
                  required
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <div className="font-bold text-slate-700">Existing Keywords:</div>
                <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto font-mono text-[10px]">
                  {(keywordCatTarget.keywords || []).map((k, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">
                      {k}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddKeywordModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs"
                >
                  Add Keyword
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mapped Vendors Modal */}
      {isMappedVendorsModalOpen && mappedVendorsCat && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-2xl border border-slate-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Building className="w-5 h-5 text-emerald-600" />
                  <span>Vendors Mapped to: {mappedVendorsCat.name}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Suppliers registered in the Vendor Master dealing in {mappedVendorsCat.name}
                </p>
              </div>
              <button
                onClick={() => setIsMappedVendorsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const mapped = vendors.filter((v) => {
                const cats = v.materialCategories && v.materialCategories.length > 0 ? v.materialCategories : v.productCategories || [];
                return cats.some((c) => c.toLowerCase() === mappedVendorsCat.name.toLowerCase());
              });

              if (mapped.length === 0) {
                return (
                  <div className="p-8 text-center space-y-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-xs text-slate-500">
                      No vendors currently mapped to <strong>{mappedVendorsCat.name}</strong>.
                    </p>
                    <button
                      onClick={() => {
                        setIsMappedVendorsModalOpen(false);
                        setActiveTab('vendors');
                      }}
                      className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold"
                    >
                      Open Vendor Master to Map Suppliers
                    </button>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {mapped.map((v) => (
                    <div
                      key={v.id}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 bg-white transition-all space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-mono text-[11px] font-bold text-blue-700">{v.id}</div>
                          <h4 className="font-bold text-sm text-slate-900">{v.companyName}</h4>
                          <div className="text-slate-500 text-[11px]">
                            {v.contactPerson} • {v.city}, {v.state}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold text-[10px]">
                          ⭐ {v.rating} / 5.0
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 text-[11px]">
                        <span className="text-slate-400">All Categories:</span>
                        {(v.materialCategories || v.productCategories || []).map((c, i) => (
                          <span
                            key={i}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              c.toLowerCase() === mappedVendorsCat.name.toLowerCase()
                                ? 'bg-blue-100 text-blue-800 font-bold'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {c}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                        <div>Phone: <strong>{v.mobile}</strong> • Email: <strong>{v.email}</strong></div>
                        <button
                          onClick={() => {
                            setIsMappedVendorsModalOpen(false);
                            setActiveTab('vendors');
                          }}
                          className="text-blue-600 font-bold hover:underline flex items-center gap-0.5"
                        >
                          <span>View Profile</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Taxonomy Hierarchy Explorer Modal */}
      {isHierarchyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-600" />
                  <span>Category → Subcategory → Product Type Hierarchy</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete configurable industrial classification hierarchy for accurate vendor mapping and RFQ matching
                </p>
              </div>
              <button
                onClick={() => setIsHierarchyModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shrink-0 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={hierarchyFilter}
                  onChange={(e) => setHierarchyFilter(e.target.value)}
                  placeholder="Filter across Category, Subcategory, or Product Types..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExpandedCatIds(categories.map((c) => c.id))}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold"
                >
                  Expand All
                </button>
                <button
                  onClick={() => setExpandedCatIds([])}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {/* Tree View Container */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {categories
                .filter((cat) => {
                  if (!hierarchyFilter) return true;
                  const term = hierarchyFilter.toLowerCase();
                  return (
                    (cat.name || '').toLowerCase().includes(term) ||
                    (cat.code || '').toLowerCase().includes(term) ||
                    (cat.subCategories || []).some((sc) => (sc || '').toLowerCase().includes(term)) ||
                    (cat.keywords || []).some((kw) => (kw || '').toLowerCase().includes(term))
                  );
                })
                .map((cat) => {
                  const isExpanded = expandedCatIds.includes(cat.id);
                  const vCount = vendorCounts[cat.name] || 0;
                  const subCats = cat.subCategories || [];
                  return (
                    <div
                      key={cat.id}
                      className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs transition-all"
                    >
                      {/* Level 1: Category Header */}
                      <div
                        onClick={() => {
                          setExpandedCatIds((prev) =>
                            prev.includes(cat.id) ? prev.filter((id) => id !== cat.id) : [...prev, cat.id]
                          );
                        }}
                        className="p-3.5 bg-slate-50/80 hover:bg-blue-50/50 cursor-pointer flex items-center justify-between transition-colors border-b border-slate-100"
                      >
                        <div className="flex items-center gap-2.5">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-blue-600 shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                            {cat.code || 'CAT'}
                          </span>
                          <div>
                            <span className="font-bold text-xs text-slate-900">{cat.name}</span>
                            <span className="text-[11px] text-slate-400 ml-2">({subCats.length} subcategories)</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700">
                            {vCount} Mapped Vendors
                          </span>
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded font-extrabold uppercase ${
                              cat.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {cat.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                      </div>

                      {/* Level 2 & 3: Subcategories & Product Types */}
                      {isExpanded && (
                        <div className="p-4 bg-white space-y-3">
                          <div className="text-[11px] text-slate-500">{cat.description}</div>

                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Subcategories & Product Types Hierarchy ({subCats.length})
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                              {subCats.map((sub, idx) => (
                                <div
                                  key={idx}
                                  className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-blue-200 hover:shadow-2xs transition-all flex items-start gap-2"
                                >
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                  <div className="min-w-0">
                                    <div className="font-semibold text-xs text-slate-800 truncate" title={sub}>
                                      {sub}
                                    </div>
                                    <div className="text-[10px] text-slate-400">Level 2 Taxonomy</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {cat.itemExamples && cat.itemExamples.length > 0 && (
                            <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap text-[11px]">
                              <span className="text-slate-400 font-medium">Verified Item Examples:</span>
                              {cat.itemExamples.map((ex, i) => (
                                <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono">
                                  {ex}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end shrink-0">
              <button
                onClick={() => setIsHierarchyModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl"
              >
                Close Explorer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
