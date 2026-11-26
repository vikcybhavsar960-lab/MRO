import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Search,
  Filter,
  Package,
  Tag,
  CheckCircle2,
  X,
  Download,
  Upload,
  FileSpreadsheet,
  FileCode,
  FileText,
  Edit2,
  Trash2,
  Sparkles,
  BookmarkCheck,
  Check,
  RotateCcw,
  Archive,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ProductItem } from '../../types';
import { getBrandEnrichment } from '../../utils/brandAutoEnrichment';
import {
  exportProductsToCSV,
  exportDataToJSON,
  generateProductCatalogPDF,
} from '../../services/dataExportService';
import { ImportDataModal } from './ImportDataModal';

export const ProductMaster: React.FC = () => {
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    restoreProduct,
    brands,
    addBrand,
    dataMode,
    pushNotification,
  } = useApp();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [showArchived, setShowArchived] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);

  // Form state
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('Bearing');
  const [subCategory, setSubCategory] = useState('');
  const [brand, setBrand] = useState('SKF');
  const [brandSearchQuery, setBrandSearchQuery] = useState('');
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [autoEnrichNotice, setAutoEnrichNotice] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [specification, setSpecification] = useState('');
  const [uom, setUom] = useState('NOS');
  const [description, setDescription] = useState('');
  const [approxRate, setApproxRate] = useState<number>(0);
  const [hsnCode, setHsnCode] = useState('84821010');
  const [gstRate, setGstRate] = useState<number>(18);
  const [stockQty, setStockQty] = useState<number>(50);

  const categories = [
    'ALL',
    'Bearing',
    'Machine spare',
    'Electrical item',
    'Motor',
    'Pump',
    'Lubricant',
    'Instrument',
    'HVAC spare',
    'Industrial consumable',
  ];

  const allCategoryOptions = Array.from(
    new Set([
      'Bearing',
      'Machine spare',
      'Electrical item',
      'Motor',
      'Pump',
      'Lubricant',
      'Instrument',
      'HVAC spare',
      'Industrial consumable',
      category,
    ].filter(Boolean))
  ).sort();

  const handleSelectBrand = (brandName: string) => {
    setBrand(brandName);
    setBrandSearchQuery('');
    setIsBrandDropdownOpen(false);

    // Auto-enrich other attributes as per brand!
    const enrichment = getBrandEnrichment(brandName, brands);
    if (enrichment.category) {
      setCategory(enrichment.category);
    }
    if (enrichment.defaultHsn) {
      setHsnCode(enrichment.defaultHsn);
    }
    if (enrichment.defaultGst) {
      setGstRate(enrichment.defaultGst);
    }
    if (enrichment.defaultUom) {
      setUom(enrichment.defaultUom);
    }
    setAutoEnrichNotice(`⚡ Auto-configured Category (${enrichment.category}), HSN (${enrichment.defaultHsn}), and GST (${enrichment.defaultGst}%) as per brand "${enrichment.canonicalName}"`);
    setTimeout(() => setAutoEnrichNotice(''), 4500);
  };

  const handleAddNewBrand = (typedName: string) => {
    const clean = typedName.trim();
    if (!clean) return;
    const enrichment = getBrandEnrichment(clean, brands);
    addBrand({
      name: enrichment.canonicalName,
      code: enrichment.code,
      category: enrichment.category,
      categories: enrichment.subCategories,
      description: enrichment.description,
      countryOfOrigin: enrichment.country,
      isActive: true,
    });
    handleSelectBrand(enrichment.canonicalName);
  };

  // Total counts for active vs archived products
  const totalActive = products.filter((p) => !p.isDeleted).length;
  const totalArchived = products.filter((p) => !!p.isDeleted).length;

  const filtered = products.filter((p) => {
    // Respect soft-delete status (Permanent database protection)
    if (showArchived ? !p.isDeleted : p.isDeleted) return false;

    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      [
        p.itemName,
        p.sourceProductName,
        p.normalizedProductName,
        p.productDesignation,
        p.partNumber,
        p.manufacturerCode,
        p.modelNumber,
        p.brand,
        p.productFamily,
        p.category,
        p.subCategory,
        p.specification,
        p.description,
        p.hsnCode,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));

    const matchesCat = categoryFilter === 'ALL' || p.category === categoryFilter;

    return matchesSearch && matchesCat;
  });

  const handleOpenAdd = () => {
    setItemName('');
    setCategory('Bearing');
    setSubCategory('');
    setBrand('SKF');
    setBrandSearchQuery('');
    setIsBrandDropdownOpen(false);
    setAutoEnrichNotice('');
    setPartNumber('');
    setModelNumber('');
    setSpecification('');
    setUom('NOS');
    setDescription('');
    setApproxRate(0);
    setHsnCode('84821010');
    setGstRate(18);
    setStockQty(50);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (prod: ProductItem) => {
    setEditingProduct(prod);
    setItemName(prod.itemName);
    setCategory(prod.category);
    setSubCategory(prod.subCategory || '');
    setBrand(prod.brand);
    setBrandSearchQuery('');
    setIsBrandDropdownOpen(false);
    setAutoEnrichNotice('');
    setPartNumber(prod.partNumber);
    setModelNumber(prod.modelNumber || '');
    setSpecification(prod.specification || '');
    setUom(prod.uom);
    setDescription(prod.description || '');
    setApproxRate(prod.approxRate || 0);
    setHsnCode(prod.hsnCode || '84821010');
    setGstRate(prod.gstRate ?? 18);
    setStockQty(prod.stockQty ?? 0);
    setIsEditModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    addProduct({
      itemName,
      category,
      subCategory,
      brand,
      partNumber,
      modelNumber,
      specification,
      uom,
      description,
      approxRate,
      hsnCode,
      gstRate,
      stockQty,
    });
    setIsAddModalOpen(false);
  };

  const handleUpdateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    updateProduct({
      ...editingProduct,
      itemName,
      category,
      subCategory,
      brand,
      partNumber,
      modelNumber,
      specification,
      uom,
      description,
      approxRate,
      hsnCode,
      gstRate,
      stockQty,
    });
    setIsEditModalOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Move item "${name}" to Archived Products? You can restore this item at any time without data loss.`)) {
      deleteProduct(id, 'Archived by user from Product Master');
      pushNotification('Item Archived', `Moved ${name} to archived repository.`, 'WARNING');
    }
  };

  const handleRestore = async (id: string, name: string) => {
    const ok = await restoreProduct(id);
    if (ok) {
      pushNotification('Item Restored', `Restored ${name} to active catalog.`, 'SUCCESS');
    }
  };

  const handleExportPDF = () => {
    const doc = generateProductCatalogPDF(filtered, 'MRO Industrial Catalog');
    doc.save(`ProcureMRO_Product_Catalog_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <span>Product Master & Catalog</span>
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-300">
              Enterprise Product Master
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Central repository of standardized industrial parts, OEM part numbers, specifications, HSN codes, and UOM
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* Quick CSV Export */}
          <button
            onClick={() => exportProductsToCSV(filtered)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-xs"
            title="Download Product Catalog as CSV (Excel compatible)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          {/* PDF Catalog */}
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-xs"
            title="Download printable Product Catalog PDF"
          >
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Catalog PDF</span>
          </button>

          {/* Import Button */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-xs"
            title="Import products from CSV or JSON spreadsheet"
          >
            <Upload className="w-4 h-4 text-blue-600" />
            <span>Import Products</span>
          </button>

          {/* Add Product Button */}
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Master Item</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search part #, HSN, brand, item name..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          {/* Active vs Archived Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setShowArchived(false)}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                !showArchived ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active ({totalActive})
            </button>
            {totalArchived > 0 && (
              <button
                type="button"
                onClick={() => setShowArchived(true)}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${
                  showArchived ? 'bg-amber-100 text-amber-900 shadow-2xs' : 'text-amber-700 hover:text-amber-900'
                }`}
                title="View soft-deleted products"
              >
                <Archive className="w-3 h-3 text-amber-600" />
                <span>Archived ({totalArchived})</span>
              </button>
            )}
          </div>

          <span className="text-xs font-bold text-slate-500 shrink-0">Category:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                categoryFilter === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Item Name & SKU</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Brand / OEM</th>
                <th className="py-3 px-4">Part # / Model</th>
                <th className="py-3 px-4">HSN & Tax</th>
                <th className="py-3 px-4">UOM</th>
                <th className="py-3 px-4 text-right">Approx Rate</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.map((prod) => (
                <tr key={prod.id} className={`hover:bg-slate-50 transition-colors group ${prod.isDeleted ? 'bg-amber-50/30' : ''}`}>
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {prod.id}
                      </span>
                      <span>{prod.itemName}</span>
                      {prod.isDeleted && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-bold rounded border border-amber-300">
                          ARCHIVED
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 font-normal mt-0.5 max-w-sm truncate">
                      {prod.specification || prod.description}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                      {prod.category} {prod.subCategory && `• ${prod.subCategory}`}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800">{prod.brand}</td>
                  <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                    {prod.partNumber}
                    {prod.modelNumber && (
                      <div className="text-[10px] text-slate-400 font-normal">{prod.modelNumber}</div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">
                    <div>HSN: {prod.hsnCode || '8482'}</div>
                    <span className="text-[10px] font-bold text-emerald-700">GST: {prod.gstRate ?? 18}%</span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-800">{prod.uom}</td>
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-right">
                    {prod.approxRate ? `₹${prod.approxRate.toLocaleString('en-IN')}` : '-'}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
                      {prod.isDeleted ? (
                        <button
                          onClick={() => handleRestore(prod.id, prod.itemName)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg transition-colors shadow-xs"
                          title="Restore item to active catalog"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleOpenEdit(prod)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Item Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(prod.id, prod.itemName)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Archive Item (Safe Soft Delete)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    No products found matching your search. Add a new item or import from CSV.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Register Master Catalog Item</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Item Description / Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Deep Groove Ball Bearing 6205-2RSH"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {allCategoryOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Subcategory</label>
                  <input
                    type="text"
                    value={subCategory}
                    onChange={(e) => setSubCategory(e.target.value)}
                    placeholder="e.g. Deep Groove, Spherical Roller"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Brand / OEM Selector with Instant Search, Quick Picks & +Add New Brand */}
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-blue-950 text-xs flex items-center gap-1.5">
                    <BookmarkCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Brand / OEM Manufacturer *</span>
                  </label>
                  {brand && (
                    <span className="text-[10px] text-blue-800 font-bold bg-white px-2 py-0.5 rounded-full border border-blue-200">
                      Active: {brand}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={brandSearchQuery !== '' ? brandSearchQuery : brand}
                        onChange={(e) => {
                          setBrandSearchQuery(e.target.value);
                          setBrand(e.target.value);
                          setIsBrandDropdownOpen(true);
                        }}
                        onFocus={() => setIsBrandDropdownOpen(true)}
                        placeholder="Search existing brand or type to add new (SKF, Timken, ABB)..."
                        className="w-full pl-8 pr-8 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold text-slate-800"
                        required
                      />
                      {(brandSearchQuery || brand) && (
                        <button
                          type="button"
                          onClick={() => {
                            setBrand('');
                            setBrandSearchQuery('');
                            setIsBrandDropdownOpen(true);
                          }}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {brandSearchQuery.trim() && !brands.some((b) => b.name.toLowerCase() === brandSearchQuery.trim().toLowerCase()) && (
                      <button
                        type="button"
                        onClick={() => handleAddNewBrand(brandSearchQuery)}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shrink-0 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add "{brandSearchQuery.trim()}"</span>
                      </button>
                    )}
                  </div>

                  {/* Brand Dropdown Menu */}
                  {isBrandDropdownOpen && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                      {brandSearchQuery.trim() && !brands.some((b) => b.name.toLowerCase() === brandSearchQuery.trim().toLowerCase()) && (
                        <button
                          type="button"
                          onClick={() => handleAddNewBrand(brandSearchQuery)}
                          className="w-full p-2.5 text-left bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold flex items-center justify-between"
                        >
                          <span className="flex items-center gap-1.5">
                            <Plus className="w-3.5 h-3.5 text-blue-600" />
                            <span>Add new brand "{brandSearchQuery.trim()}" to Master</span>
                          </span>
                          <span className="text-[10px] bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded font-semibold">
                            Auto-enrich
                          </span>
                        </button>
                      )}

                      {brands
                        .filter((b) => !brandSearchQuery || b.name.toLowerCase().includes(brandSearchQuery.toLowerCase()))
                        .slice(0, 10)
                        .map((b) => (
                          <button
                            type="button"
                            key={b.id}
                            onClick={() => handleSelectBrand(b.name)}
                            className="w-full p-2 text-left hover:bg-slate-50 flex items-center justify-between text-slate-700"
                          >
                            <span className="font-bold text-slate-800">{b.name}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {b.category || 'MRO Brand'}
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Popular Brand Pills */}
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="text-[10px] text-slate-400 font-medium">Quick Select:</span>
                  {['SKF', 'Timken', 'FAG', 'Festo', 'ABB', 'Siemens', 'Fenner', 'Schneider', 'Bosch', 'TVS'].map((b) => (
                    <button
                      type="button"
                      key={b}
                      onClick={() => handleSelectBrand(b)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        brand.toLowerCase() === b.toLowerCase()
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-white hover:bg-blue-50 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>

                {autoEnrichNotice && (
                  <div className="p-1.5 bg-emerald-100/70 border border-emerald-300 rounded-lg text-emerald-900 text-[10px] flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-emerald-700 shrink-0" />
                    <span className="font-medium">{autoEnrichNotice}</span>
                  </div>
                )}
              </div>

              {/* Part Number & UOM Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Part Number <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={partNumber}
                    onChange={(e) => setPartNumber(e.target.value)}
                    placeholder="6205-2RSH"
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">UOM</label>
                  <select
                    value={uom}
                    onChange={(e) => setUom(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="NOS">NOS</option>
                    <option value="SET">SET</option>
                    <option value="MTR">MTR</option>
                    <option value="KG">KG</option>
                    <option value="LTR">LTR</option>
                    <option value="BOX">BOX</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">HSN Code</label>
                  <input
                    type="text"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    placeholder="84821010"
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">GST Rate (%)</label>
                  <select
                    value={gstRate}
                    onChange={(e) => setGstRate(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                  >
                    <option value={5}>5% GST</option>
                    <option value={12}>12% GST</option>
                    <option value={18}>18% GST</option>
                    <option value={28}>28% GST</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Indicative Rate (INR)</label>
                  <input
                    type="number"
                    value={approxRate || ''}
                    onChange={(e) => setApproxRate(Number(e.target.value))}
                    placeholder="e.g. 485"
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Technical Specification</label>
                <textarea
                  rows={2}
                  value={specification}
                  onChange={(e) => setSpecification(e.target.value)}
                  placeholder="Dimensions, clearance, temperature tolerance, load rating..."
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md shadow-blue-500/20"
                >
                  Save Master Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Update Product Catalog Item</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Item Description / Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {allCategoryOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Subcategory</label>
                  <input
                    type="text"
                    value={subCategory}
                    onChange={(e) => setSubCategory(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Brand / OEM Selector with Instant Search, Quick Picks & +Add New Brand */}
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-blue-950 text-xs flex items-center gap-1.5">
                    <BookmarkCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Brand / OEM Manufacturer *</span>
                  </label>
                  {brand && (
                    <span className="text-[10px] text-blue-800 font-bold bg-white px-2 py-0.5 rounded-full border border-blue-200">
                      Active: {brand}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={brandSearchQuery !== '' ? brandSearchQuery : brand}
                        onChange={(e) => {
                          setBrandSearchQuery(e.target.value);
                          setBrand(e.target.value);
                          setIsBrandDropdownOpen(true);
                        }}
                        onFocus={() => setIsBrandDropdownOpen(true)}
                        placeholder="Search existing brand or type to add new..."
                        className="w-full pl-8 pr-8 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold text-slate-800"
                        required
                      />
                      {(brandSearchQuery || brand) && (
                        <button
                          type="button"
                          onClick={() => {
                            setBrand('');
                            setBrandSearchQuery('');
                            setIsBrandDropdownOpen(true);
                          }}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {brandSearchQuery.trim() && !brands.some((b) => b.name.toLowerCase() === brandSearchQuery.trim().toLowerCase()) && (
                      <button
                        type="button"
                        onClick={() => handleAddNewBrand(brandSearchQuery)}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shrink-0 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add "{brandSearchQuery.trim()}"</span>
                      </button>
                    )}
                  </div>

                  {/* Brand Dropdown Menu */}
                  {isBrandDropdownOpen && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                      {brandSearchQuery.trim() && !brands.some((b) => b.name.toLowerCase() === brandSearchQuery.trim().toLowerCase()) && (
                        <button
                          type="button"
                          onClick={() => handleAddNewBrand(brandSearchQuery)}
                          className="w-full p-2.5 text-left bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold flex items-center justify-between"
                        >
                          <span className="flex items-center gap-1.5">
                            <Plus className="w-3.5 h-3.5 text-blue-600" />
                            <span>Add new brand "{brandSearchQuery.trim()}" to Master</span>
                          </span>
                          <span className="text-[10px] bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded font-semibold">
                            Auto-enrich
                          </span>
                        </button>
                      )}

                      {brands
                        .filter((b) => !brandSearchQuery || b.name.toLowerCase().includes(brandSearchQuery.toLowerCase()))
                        .slice(0, 10)
                        .map((b) => (
                          <button
                            type="button"
                            key={b.id}
                            onClick={() => handleSelectBrand(b.name)}
                            className="w-full p-2 text-left hover:bg-slate-50 flex items-center justify-between text-slate-700"
                          >
                            <span className="font-bold text-slate-800">{b.name}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {b.category || 'MRO Brand'}
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Popular Brand Pills */}
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="text-[10px] text-slate-400 font-medium">Quick Select:</span>
                  {['SKF', 'Timken', 'FAG', 'Festo', 'ABB', 'Siemens', 'Fenner', 'Schneider', 'Bosch', 'TVS'].map((b) => (
                    <button
                      type="button"
                      key={b}
                      onClick={() => handleSelectBrand(b)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        brand.toLowerCase() === b.toLowerCase()
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-white hover:bg-blue-50 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>

                {autoEnrichNotice && (
                  <div className="p-1.5 bg-emerald-100/70 border border-emerald-300 rounded-lg text-emerald-900 text-[10px] flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-emerald-700 shrink-0" />
                    <span className="font-medium">{autoEnrichNotice}</span>
                  </div>
                )}
              </div>

              {/* Part Number & UOM Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Part Number <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={partNumber}
                    onChange={(e) => setPartNumber(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">UOM</label>
                  <select
                    value={uom}
                    onChange={(e) => setUom(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="NOS">NOS</option>
                    <option value="SET">SET</option>
                    <option value="MTR">MTR</option>
                    <option value="KG">KG</option>
                    <option value="LTR">LTR</option>
                    <option value="BOX">BOX</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">HSN Code</label>
                  <input
                    type="text"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">GST Rate (%)</label>
                  <select
                    value={gstRate}
                    onChange={(e) => setGstRate(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                  >
                    <option value={5}>5% GST</option>
                    <option value={12}>12% GST</option>
                    <option value={18}>18% GST</option>
                    <option value={28}>28% GST</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Indicative Rate (INR)</label>
                  <input
                    type="number"
                    value={approxRate || ''}
                    onChange={(e) => setApproxRate(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Technical Specification</label>
                <textarea
                  rows={2}
                  value={specification}
                  onChange={(e) => setSpecification(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md shadow-blue-500/20"
                >
                  Update Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      <ImportDataModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        type="PRODUCTS"
      />
    </div>
  );
};
