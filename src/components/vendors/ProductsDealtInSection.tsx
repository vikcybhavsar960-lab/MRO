import React, { useState, useMemo } from 'react';
import { Plus, X, Search, Check, Layers, BookmarkCheck, AlertCircle, CheckCircle2, Package } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Vendor } from '../../types';

interface ProductsDealtInSectionProps {
  vendor?: Vendor | null;
  // Staged props when used inside Add New Vendor modal before vendor is saved
  stagedMappings?: Array<{
    id?: string;
    productName: string;
    productType?: string;
    category?: string;
    brand?: string;
  }>;
  onStagedAdd?: (item: { productName: string; category?: string; brand?: string }) => void;
  onStagedRemove?: (index: number) => void;
  className?: string;
}

export const ProductsDealtInSection: React.FC<ProductsDealtInSectionProps> = ({
  vendor,
  stagedMappings,
  onStagedAdd,
  onStagedRemove,
  className = '',
}) => {
  const {
    categories,
    brands,
    productTypes,
    vendorProductMappings,
    addProductTypeToVendor,
    removeProductTypeFromVendor,
    addProductTypeToMaster,
  } = useApp();

  // Search query in the Product Master toolbar
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');

  // Optional Brand & Category selections
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [customBrandInput, setCustomBrandInput] = useState<string>('');
  const [isCustomBrand, setIsCustomBrand] = useState<boolean>(false);

  // Status alerts
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

interface VendorProductItem {
  id?: string;
  productName: string;
  category?: string;
  brand?: string;
  index?: number;
}

  // List of active products currently associated with this vendor
  const vendorProducts = useMemo<VendorProductItem[]>(() => {
    if (vendor && vendor.id) {
      return vendorProductMappings
        .filter((m) => m.vendorId === vendor.id && m.status !== 'INACTIVE')
        .map((m) => ({
          id: m.id,
          productName: m.productName || m.productType || '',
          category: m.category,
          brand: m.brand && m.brand !== 'Generic' ? m.brand : undefined,
        }));
    }
    if (stagedMappings) {
      return stagedMappings.map((m, idx) => ({
        id: m.id,
        productName: m.productName,
        category: m.category,
        brand: m.brand,
        index: idx,
      }));
    }
    return [];
  }, [vendor, vendorProductMappings, stagedMappings]);

  // Combined list of selectable brands
  const selectableBrands = useMemo(() => {
    const list: string[] = [];
    if (vendor?.brandsSupplied) {
      vendor.brandsSupplied.forEach((b) => {
        if (b && !list.includes(b)) list.push(b);
      });
    }
    brands.forEach((b) => {
      if (b.name && !list.includes(b.name)) list.push(b.name);
    });
    return list.sort();
  }, [vendor, brands]);

  // Effective brand
  const effectiveBrand = isCustomBrand ? customBrandInput.trim() : selectedBrand.trim();

  // Filtered Product Types from Global Master matching search
  const filteredProductTypes = useMemo(() => {
    const q = productSearchQuery.toLowerCase().trim();
    if (!q) return productTypes;
    return productTypes.filter(
      (pt) =>
        pt.name.toLowerCase().includes(q) ||
        (pt.category && pt.category.toLowerCase().includes(q))
    );
  }, [productTypes, productSearchQuery]);

  // Add / Create Product Type (One-Click)
  const handleAddProductType = async (rawName: string) => {
    const cleanName = rawName.trim();
    setErrorMessage('');
    setSuccessMessage('');

    if (!cleanName) return;

    try {
      if (vendor && vendor.id) {
        // Live Vendor mode: Save to database & vendor mapping in 1 click
        await addProductTypeToVendor(
          vendor.id,
          cleanName,
          selectedCategory || undefined,
          effectiveBrand || undefined
        );
        setSuccessMessage(`Added "${cleanName}" to ${vendor.companyName}!`);
      } else if (onStagedAdd) {
        // Staged mode: ensure in master & stage in form
        await addProductTypeToMaster(cleanName, selectedCategory || undefined);
        onStagedAdd({
          productName: cleanName,
          category: selectedCategory || undefined,
          brand: effectiveBrand || undefined,
        });
        setSuccessMessage(`Added "${cleanName}" to master & staged for vendor.`);
      }

      setProductSearchQuery('');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to add product type.');
    }
  };

  // Toggle selection: if already linked, remove; if not linked, link!
  const handleToggleProductSelection = async (productTypeName: string) => {
    setErrorMessage('');
    setSuccessMessage('');

    const norm = productTypeName.toLowerCase().trim();
    const existing = vendorProducts.find(
      (vp) => vp.productName.toLowerCase().trim() === norm
    );

    if (existing) {
      // Unselect / Remove
      if (existing.id && vendor) {
        try {
          await removeProductTypeFromVendor(existing.id);
          setSuccessMessage(`Removed "${productTypeName}" from ${vendor.companyName}. (Global master preserved)`);
          setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err: any) {
          setErrorMessage(err?.message || 'Failed to remove product type.');
        }
      } else if (existing.index !== undefined && onStagedRemove) {
        onStagedRemove(existing.index);
      }
    } else {
      // Select / Add
      await handleAddProductType(productTypeName);
    }
  };

  // Remove directly from badge chip
  const handleRemoveChip = async (item: { id?: string; index?: number; productName: string }) => {
    setErrorMessage('');
    setSuccessMessage('');

    if (item.id && vendor) {
      try {
        await removeProductTypeFromVendor(item.id);
        setSuccessMessage(`Removed "${item.productName}" from ${vendor.companyName}.`);
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to remove product type.');
      }
    } else if (item.index !== undefined && onStagedRemove) {
      onStagedRemove(item.index);
    }
  };

  // Check if typed query exactly matches any existing product type in master
  const hasExactMatchInMaster = productTypes.some(
    (pt) => pt.name.toLowerCase().trim() === productSearchQuery.toLowerCase().trim()
  );

  return (
    <div className={`p-4 bg-blue-50/60 rounded-xl border border-blue-200 space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <label className="font-bold text-blue-950 block text-xs flex items-center gap-1.5">
            <Package className="w-4 h-4 text-blue-700" />
            <span>Products Dealt In (Search & Multi-select) *</span>
          </label>
          <p className="text-[11px] text-blue-700 mt-0.5">
            Select products (MCB, MCCB, SPD, Bearings, Sensors, Valves, etc.) or type any new product type to add to master in one click.
          </p>
        </div>
        <span className="font-bold text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full shrink-0">
          {vendorProducts.length} selected
        </span>
      </div>

      {/* Error & Success Banners */}
      {errorMessage && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-rose-500 hover:text-rose-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-500 hover:text-emerald-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Selected Products Chips with X to remove individual products */}
      <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-xl border border-blue-200 min-h-[42px] items-center">
        {vendorProducts.length === 0 ? (
          <span className="text-slate-400 italic text-xs px-1">
            No products selected yet. Search below or click items to add.
          </span>
        ) : (
          vendorProducts.map((item, idx) => (
            <span
              key={item.id || `${item.productName}-${idx}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 text-white rounded-lg font-bold text-xs shadow-2xs"
            >
              <span>{item.productName}</span>
              {item.brand && (
                <span className="text-[10px] bg-blue-700/80 px-1 py-0.2 rounded font-normal">
                  ({item.brand})
                </span>
              )}
              <button
                type="button"
                onClick={() => handleRemoveChip(item)}
                className="hover:bg-blue-700 rounded-full p-0.5 transition-colors cursor-pointer"
                title={`Remove ${item.productName}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
      </div>

      {/* Optional Brand & Category Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div>
          <label className="text-[11px] font-bold text-slate-700 block mb-1 flex items-center gap-1">
            <Layers className="w-3 h-3 text-slate-400" />
            <span>Material Category</span>
            <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-lg bg-white text-xs text-slate-800 font-medium focus:ring-1 focus:ring-blue-500"
          >
            <option value="">-- All Categories (Optional) --</option>
            {categories.map((c) => (
              <option key={c.id || c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <BookmarkCheck className="w-3 h-3 text-slate-400" />
              <span>Brand / Manufacturer</span>
              <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setIsCustomBrand(!isCustomBrand);
                if (!isCustomBrand) setCustomBrandInput('');
                else setSelectedBrand('');
              }}
              className="text-[10px] text-blue-600 hover:text-blue-800 font-bold"
            >
              {isCustomBrand ? 'Pick Existing' : '+ Type Brand'}
            </button>
          </div>

          {isCustomBrand ? (
            <input
              type="text"
              value={customBrandInput}
              onChange={(e) => setCustomBrandInput(e.target.value)}
              placeholder="e.g. Schneider Electric, SKF..."
              className="w-full p-2 border border-blue-300 rounded-lg bg-white text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-blue-500"
            />
          ) : (
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white text-xs text-slate-800 font-medium focus:ring-1 focus:ring-blue-500"
            >
              <option value="">-- None / Generic (Optional) --</option>
              {selectableBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Product Search & Add Toolbar (Identical to Brand Name pattern) */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={productSearchQuery}
              onChange={(e) => setProductSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (productSearchQuery.trim()) {
                    handleAddProductType(productSearchQuery.trim());
                  }
                }
              }}
              placeholder="Search product master or type new (e.g. MCB, MCCB, SPD, Bearings, Sensors)..."
              className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Direct Add Product Button if query is typed */}
          {productSearchQuery.trim() && (
            <button
              type="button"
              onClick={() => handleAddProductType(productSearchQuery.trim())}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shrink-0 flex items-center gap-1 shadow-2xs text-xs cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {hasExactMatchInMaster
                  ? `Select "${productSearchQuery.trim()}"`
                  : `Add "${productSearchQuery.trim()}" to Master`}
              </span>
            </button>
          )}
        </div>

        {/* Product Catalog Pills / Grid from Master */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-44 overflow-y-auto p-1.5 bg-white border border-slate-200 rounded-lg">
          {filteredProductTypes.length === 0 ? (
            <div className="col-span-full py-4 text-center text-slate-400 text-xs">
              No matching product type in master. Click <strong>+ Add "{productSearchQuery.trim()}"</strong> above to add it to master immediately!
            </div>
          ) : (
            filteredProductTypes.map((pt) => {
              const isChecked = vendorProducts.some(
                (vp) => vp.productName.toLowerCase().trim() === pt.name.toLowerCase().trim()
              );
              return (
                <button
                  type="button"
                  key={pt.id || pt.name}
                  onClick={() => handleToggleProductSelection(pt.name)}
                  className={`px-2.5 py-1.5 text-left rounded-lg text-[11px] font-medium transition-all flex items-center justify-between cursor-pointer ${
                    isChecked
                      ? 'bg-blue-50 text-blue-900 font-bold border border-blue-300'
                      : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                  }`}
                  title={isChecked ? `Click to remove "${pt.name}"` : `Click to add "${pt.name}"`}
                >
                  <span className="truncate">{pt.name}</span>
                  {isChecked && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
