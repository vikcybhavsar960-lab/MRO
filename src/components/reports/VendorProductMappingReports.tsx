import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  Building,
  Package,
  BookmarkCheck,
  Layers,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  BarChart2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { VendorProductMapping, VendorProductStatus } from '../../types';

export const VendorProductMappingReports: React.FC = () => {
  const {
    vendors,
    products,
    categories,
    brands,
    vendorProductMappings,
    updateVendorProductMapping,
    setActiveTab,
  } = useApp();

  type ReportTab =
    | 'VENDOR_WISE'
    | 'PRODUCT_WISE'
    | 'BRAND_WISE'
    | 'CATEGORY_WISE'
    | 'UNMAPPED'
    | 'INACTIVE'
    | 'COVERAGE_ANALYSIS';

  const [activeTab, setReportActiveTab] = useState<ReportTab>('VENDOR_WISE');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendorFilter, setSelectedVendorFilter] = useState('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('ALL');

  // Summary Metrics
  const totalSuppliersCount = vendors.length;
  const totalProductsMapped = vendorProductMappings.length;
  const activeProductsMapped = vendorProductMappings.filter((m) => m.status === 'ACTIVE').length;
  const distinctBrandsCount = Array.from(new Set(vendorProductMappings.map((m) => m.brand).filter(Boolean))).length;

  // Unmapped products (in master products but not in vendorProductMappings)
  const unmappedProducts = useMemo(() => {
    return products.filter((prod) => {
      const mappedVendors = vendorProductMappings.filter(
        (m) =>
          m.status === 'ACTIVE' &&
          (m.productName.toLowerCase().trim() === prod.itemName.toLowerCase().trim() ||
            (prod.partNumber && m.partNumber?.toLowerCase().trim() === prod.partNumber.toLowerCase().trim()))
      );
      return mappedVendors.length === 0;
    });
  }, [products, vendorProductMappings]);

  // Inactive mappings
  const inactiveMappings = useMemo(() => {
    return vendorProductMappings.filter((m) => m.status === 'INACTIVE');
  }, [vendorProductMappings]);

  // Category coverage matrix
  const categoryCoverageMatrix = useMemo(() => {
    return categories.map((cat) => {
      const catMappings = vendorProductMappings.filter(
        (m) => m.category.toLowerCase().trim() === cat.name.toLowerCase().trim() && m.status === 'ACTIVE'
      );
      const suppliers = Array.from(new Set(catMappings.map((m) => m.vendorName || m.vendorId)));
      const catBrands = Array.from(new Set(catMappings.map((m) => m.brand).filter(Boolean)));

      let coverageStatus: 'HEALTHY' | 'SINGLE_SOURCE' | 'ZERO_COVERAGE' = 'ZERO_COVERAGE';
      if (suppliers.length >= 2) coverageStatus = 'HEALTHY';
      else if (suppliers.length === 1) coverageStatus = 'SINGLE_SOURCE';

      return {
        category: cat.name,
        code: cat.code || 'CAT',
        subCategoriesCount: (cat.subCategories || []).length,
        totalProducts: catMappings.length,
        suppliersCount: suppliers.length,
        suppliers,
        brandsCount: catBrands.length,
        brands: catBrands,
        coverageStatus,
      };
    });
  }, [categories, vendorProductMappings]);

  // Export handlers
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    if (activeTab === 'VENDOR_WISE') {
      const data = vendorProductMappings.map((m, idx) => ({
        'S.No': idx + 1,
        'Vendor Code': m.vendorCode || m.vendorId,
        'Vendor Name': m.vendorName || 'Supplier',
        'Product Name': m.productName,
        'Category': m.category,
        'Subcategory': m.subCategory || '',
        'Brand': m.brand,
        'Model Number': m.modelNumber || '',
        'Part Number': m.partNumber || '',
        'Specification': m.specification || '',
        'UOM': m.uom,
        'Supply Type': m.supplyType,
        'Availability': m.availability,
        'Status': m.status,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Vendor_Wise_Products');
      XLSX.writeFile(wb, `Vendor_Wise_Products_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (activeTab === 'PRODUCT_WISE') {
      const data = products.map((p, idx) => {
        const suppliers = vendorProductMappings.filter(
          (m) =>
            m.productName.toLowerCase().trim() === p.itemName.toLowerCase().trim() ||
            (p.partNumber && m.partNumber?.toLowerCase().trim() === p.partNumber.toLowerCase().trim())
        );
        return {
          'S.No': idx + 1,
          'Product Name': p.itemName,
          'Part Number': p.partNumber || '',
          'Category': p.category,
          'Brand': p.brand,
          'UOM': p.uom,
          'Suppliers Count': suppliers.length,
          'Suppliers List': suppliers.map((s) => `${s.vendorName} (${s.availability})`).join('; ') || 'None',
        };
      });
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Product_Wise_Vendors');
      XLSX.writeFile(wb, `Product_Wise_Vendors_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (activeTab === 'BRAND_WISE') {
      const allKnownBrands = Array.from(
        new Set([...brands.map((b) => b.name), ...vendorProductMappings.map((m) => m.brand)])
      ).sort();
      const data = allKnownBrands.map((b, idx) => {
        const brandMappings = vendorProductMappings.filter(
          (m) => m.brand.toLowerCase() === b.toLowerCase() && m.status === 'ACTIVE'
        );
        const suppliers = Array.from(new Set(brandMappings.map((m) => m.vendorName)));
        return {
          'S.No': idx + 1,
          'Brand / Make': b,
          'Active Products': brandMappings.length,
          'Suppliers Count': suppliers.length,
          'Suppliers List': suppliers.join('; ') || 'None',
        };
      });
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Brand_Wise_Vendors');
      XLSX.writeFile(wb, `Brand_Wise_Vendors_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (activeTab === 'CATEGORY_WISE' || activeTab === 'COVERAGE_ANALYSIS') {
      const data = categoryCoverageMatrix.map((c, idx) => ({
        'S.No': idx + 1,
        'Category Name': c.category,
        'Category Code': c.code,
        'Active Products Count': c.totalProducts,
        'Suppliers Count': c.suppliersCount,
        'Suppliers': c.suppliers.join('; '),
        'Brands Count': c.brandsCount,
        'Brands': c.brands.join('; '),
        'Coverage Status': c.coverageStatus,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Category_Coverage');
      XLSX.writeFile(wb, `Category_Coverage_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (activeTab === 'UNMAPPED') {
      const data = unmappedProducts.map((p, idx) => ({
        'S.No': idx + 1,
        'Product Name': p.itemName,
        'Part Number': p.partNumber || '',
        'Category': p.category,
        'Brand': p.brand,
        'UOM': p.uom,
        'Status': 'Zero Active Suppliers',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Unmapped_Products');
      XLSX.writeFile(wb, `Unmapped_Products_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (activeTab === 'INACTIVE') {
      const data = inactiveMappings.map((m, idx) => ({
        'S.No': idx + 1,
        'Vendor Name': m.vendorName,
        'Product Name': m.productName,
        'Brand': m.brand,
        'Category': m.category,
        'Part Number': m.partNumber || '',
        'Status': 'INACTIVE',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Inactive_Mappings');
      XLSX.writeFile(wb, `Inactive_Mappings_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Metrics */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Vendor Product Mapping & Material Coverage Reports
                </h3>
                <p className="text-xs text-slate-500">
                  Comprehensive audit of supplier capabilities, brand distribution, and procurement coverage gaps.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Export Active Tab to Excel</span>
            </button>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl">
            <span className="text-[10px] font-bold text-blue-800 uppercase block">Total Suppliers</span>
            <span className="text-xl font-black text-blue-950 mt-0.5">{totalSuppliersCount}</span>
            <span className="text-[10px] text-blue-700 block">Registered vendors</span>
          </div>

          <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl">
            <span className="text-[10px] font-bold text-indigo-800 uppercase block">Products Registered</span>
            <span className="text-xl font-black text-indigo-950 mt-0.5">{totalProductsMapped}</span>
            <span className="text-[10px] text-indigo-700 block">{activeProductsMapped} active mappings</span>
          </div>

          <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl">
            <span className="text-[10px] font-bold text-purple-800 uppercase block">Brands Represented</span>
            <span className="text-xl font-black text-purple-950 mt-0.5">{distinctBrandsCount}</span>
            <span className="text-[10px] text-purple-700 block">OEMs & manufacturers</span>
          </div>

          <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl">
            <span className="text-[10px] font-bold text-rose-800 uppercase block">Unmapped Products</span>
            <span className="text-xl font-black text-rose-950 mt-0.5">{unmappedProducts.length}</span>
            <span className="text-[10px] text-rose-700 block">0 active suppliers</span>
          </div>

          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl">
            <span className="text-[10px] font-bold text-amber-800 uppercase block">Inactive Mappings</span>
            <span className="text-xl font-black text-amber-950 mt-0.5">{inactiveMappings.length}</span>
            <span className="text-[10px] text-amber-700 block">Temporarily paused</span>
          </div>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 border-b border-slate-200 text-xs font-bold">
          <button
            onClick={() => setReportActiveTab('VENDOR_WISE')}
            className={`px-3 py-2 rounded-xl transition-all ${
              activeTab === 'VENDOR_WISE'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            1. Vendor-wise Products
          </button>

          <button
            onClick={() => setReportActiveTab('PRODUCT_WISE')}
            className={`px-3 py-2 rounded-xl transition-all ${
              activeTab === 'PRODUCT_WISE'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            2. Product-wise Vendors
          </button>

          <button
            onClick={() => setReportActiveTab('BRAND_WISE')}
            className={`px-3 py-2 rounded-xl transition-all ${
              activeTab === 'BRAND_WISE'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            3. Brand-wise Vendors
          </button>

          <button
            onClick={() => setReportActiveTab('CATEGORY_WISE')}
            className={`px-3 py-2 rounded-xl transition-all ${
              activeTab === 'CATEGORY_WISE'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            4. Category-wise Coverage
          </button>

          <button
            onClick={() => setReportActiveTab('UNMAPPED')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'UNMAPPED'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-700 bg-rose-50/70 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>5. Unmapped Products ({unmappedProducts.length})</span>
          </button>

          <button
            onClick={() => setReportActiveTab('INACTIVE')}
            className={`px-3 py-2 rounded-xl transition-all ${
              activeTab === 'INACTIVE'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            6. Inactive Mappings ({inactiveMappings.length})
          </button>

          <button
            onClick={() => setReportActiveTab('COVERAGE_ANALYSIS')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'COVERAGE_ANALYSIS'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>7. Supply Risk Analysis</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Filter by product, supplier, brand, category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Quick Filters:</span>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 max-w-[150px] truncate"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab 1: Vendor-wise Products */}
        {activeTab === 'VENDOR_WISE' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3.5">Vendor</th>
                  <th className="py-3 px-3.5">Product & Part Number</th>
                  <th className="py-3 px-3.5">Category & Subcategory</th>
                  <th className="py-3 px-3.5">Brand</th>
                  <th className="py-3 px-3.5">Specification</th>
                  <th className="py-3 px-3.5">UOM</th>
                  <th className="py-3 px-3.5">Supply Type</th>
                  <th className="py-3 px-3.5">Availability</th>
                  <th className="py-3 px-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendorProductMappings
                  .filter((m) => {
                    const q = searchTerm.toLowerCase().trim();
                    const matchesSearch =
                      !q ||
                      (m.vendorName && m.vendorName.toLowerCase().includes(q)) ||
                      m.productName.toLowerCase().includes(q) ||
                      m.brand.toLowerCase().includes(q) ||
                      m.category.toLowerCase().includes(q);
                    const matchesCat =
                      selectedCategoryFilter === 'ALL' || m.category === selectedCategoryFilter;
                    return matchesSearch && matchesCat;
                  })
                  .map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3.5">
                        <span className="font-bold text-slate-900 block">{m.vendorName || m.vendorId}</span>
                        <span className="font-mono text-[10px] text-blue-700">{m.vendorCode || m.vendorId}</span>
                      </td>
                      <td className="py-3 px-3.5 max-w-[200px]">
                        <span className="font-semibold text-slate-900 block line-clamp-1">{m.productName}</span>
                        {(m.partNumber || m.modelNumber) && (
                          <span className="font-mono text-[10px] text-slate-500 font-bold">
                            PN: {m.partNumber || m.modelNumber}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="font-medium text-slate-800 block">{m.category}</span>
                        {m.subCategory && <span className="text-[10px] text-slate-500">{m.subCategory}</span>}
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-semibold">
                          {m.brand}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 max-w-[160px] text-[11px] text-slate-600 line-clamp-2">
                        {m.specification || '—'}
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-700">{m.uom}</td>
                      <td className="py-3 px-3.5 text-slate-600">{m.supplyType}</td>
                      <td className="py-3 px-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.availability === 'Regular Stock'
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-blue-50 text-blue-800'
                          }`}
                        >
                          {m.availability}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Product-wise Vendors */}
        {activeTab === 'PRODUCT_WISE' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3.5">Product Name & Part #</th>
                  <th className="py-3 px-3.5">Category</th>
                  <th className="py-3 px-3.5">Brand / Make</th>
                  <th className="py-3 px-3.5">UOM</th>
                  <th className="py-3 px-3.5 text-center">Suppliers Count</th>
                  <th className="py-3 px-3.5">Mapped Suppliers & Availability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products
                  .filter((p) => {
                    const q = searchTerm.toLowerCase().trim();
                    return (
                      !q ||
                      p.itemName.toLowerCase().includes(q) ||
                      p.brand.toLowerCase().includes(q) ||
                      (p.partNumber && p.partNumber.toLowerCase().includes(q))
                    );
                  })
                  .map((p) => {
                    const matchedSuppliers = vendorProductMappings.filter(
                      (m) =>
                        m.status === 'ACTIVE' &&
                        (m.productName.toLowerCase().trim() === p.itemName.toLowerCase().trim() ||
                          (p.partNumber && m.partNumber?.toLowerCase().trim() === p.partNumber.toLowerCase().trim()))
                    );

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3.5 max-w-[220px]">
                          <span className="font-bold text-slate-900 block">{p.itemName}</span>
                          {p.partNumber && (
                            <span className="font-mono text-[10px] text-slate-500 font-bold">
                              PN: {p.partNumber}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-slate-800 font-medium">{p.category}</td>
                        <td className="py-3 px-3.5">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-semibold">
                            {p.brand}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 font-mono font-bold text-slate-700">{p.uom}</td>
                        <td className="py-3 px-3.5 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              matchedSuppliers.length >= 2
                                ? 'bg-emerald-100 text-emerald-800'
                                : matchedSuppliers.length === 1
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {matchedSuppliers.length} supplier(s)
                          </span>
                        </td>
                        <td className="py-3 px-3.5">
                          {matchedSuppliers.length === 0 ? (
                            <span className="text-rose-600 italic">No mapped suppliers (procurement gap)</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {matchedSuppliers.map((s, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-medium text-slate-800"
                                >
                                  <strong>{s.vendorName}</strong> ({s.availability})
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Brand-wise Vendors */}
        {activeTab === 'BRAND_WISE' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3.5">Brand / Make</th>
                  <th className="py-3 px-3.5 text-center">Active Products Registered</th>
                  <th className="py-3 px-3.5 text-center">Certified Suppliers Count</th>
                  <th className="py-3 px-3.5">Authorized Suppliers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from(
                  new Set([...brands.map((b) => b.name), ...vendorProductMappings.map((m) => m.brand)])
                )
                  .sort()
                  .filter((b) => !searchTerm || b.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((b, idx) => {
                    const brandProducts = vendorProductMappings.filter(
                      (m) => m.brand.toLowerCase() === b.toLowerCase() && m.status === 'ACTIVE'
                    );
                    const suppliers = Array.from(new Set(brandProducts.map((m) => m.vendorName || m.vendorId)));

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3.5 font-bold text-slate-900 text-sm flex items-center gap-2">
                          <BookmarkCheck className="w-4 h-4 text-blue-600" />
                          <span>{b}</span>
                        </td>
                        <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-800">
                          {brandProducts.length}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              suppliers.length >= 2
                                ? 'bg-emerald-100 text-emerald-800'
                                : suppliers.length === 1
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {suppliers.length} vendor(s)
                          </span>
                        </td>
                        <td className="py-3 px-3.5">
                          {suppliers.length === 0 ? (
                            <span className="text-slate-400 italic">No supplier registered for this brand</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {suppliers.map((s, i) => (
                                <span
                                  key={i}
                                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-800 shadow-2xs"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Category-wise Coverage */}
        {activeTab === 'CATEGORY_WISE' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3.5">Category Name & Code</th>
                  <th className="py-3 px-3.5 text-center">Products Count</th>
                  <th className="py-3 px-3.5 text-center">Suppliers Count</th>
                  <th className="py-3 px-3.5">Suppliers List</th>
                  <th className="py-3 px-3.5">Key Brands Covered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categoryCoverageMatrix
                  .filter((c) => !searchTerm || c.category.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-indigo-600" />
                          <span>{c.category}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">{c.code}</span>
                      </td>
                      <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-800">
                        {c.totalProducts}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            c.suppliersCount >= 2
                              ? 'bg-emerald-100 text-emerald-800'
                              : c.suppliersCount === 1
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {c.suppliersCount}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 max-w-[240px]">
                        {c.suppliers.length === 0 ? (
                          <span className="text-rose-600 italic">No supplier mapped</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {c.suppliers.map((s, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px]"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5 max-w-[200px]">
                        <div className="flex flex-wrap gap-1">
                          {c.brands.slice(0, 4).map((b, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.2 bg-blue-50 text-blue-800 rounded text-[10px] font-mono"
                            >
                              {b}
                            </span>
                          ))}
                          {c.brands.length > 4 && (
                            <span className="text-[10px] text-slate-400">+{c.brands.length - 4}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 5: Unmapped Products */}
        {activeTab === 'UNMAPPED' && (
          <div className="space-y-3">
            <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>
                  The following {unmappedProducts.length} items exist in Product Master but have NO active supplier mapped.
                </span>
              </span>
              <button
                onClick={() => setActiveTab('vendors')}
                className="text-xs font-bold text-rose-700 hover:underline"
              >
                Go to Vendor Master to map suppliers →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-3.5">Product Name</th>
                    <th className="py-3 px-3.5">Part Number</th>
                    <th className="py-3 px-3.5">Category</th>
                    <th className="py-3 px-3.5">Brand</th>
                    <th className="py-3 px-3.5">UOM</th>
                    <th className="py-3 px-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unmappedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-emerald-700 bg-emerald-50/50">
                        <CheckCircle className="w-8 h-8 mx-auto mb-1 text-emerald-600" />
                        <p className="font-bold text-sm">All products are covered by at least one certified supplier!</p>
                      </td>
                    </tr>
                  ) : (
                    unmappedProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-rose-50/30 transition-colors">
                        <td className="py-3 px-3.5 font-bold text-slate-900">{p.itemName}</td>
                        <td className="py-3 px-3.5 font-mono text-slate-600">{p.partNumber || '—'}</td>
                        <td className="py-3 px-3.5 text-slate-700">{p.category}</td>
                        <td className="py-3 px-3.5 font-semibold text-slate-800">{p.brand}</td>
                        <td className="py-3 px-3.5 font-mono font-bold text-slate-600">{p.uom}</td>
                        <td className="py-3 px-3.5 text-center">
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full font-bold text-[10px]">
                            0 Active Suppliers
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 6: Inactive Mappings */}
        {activeTab === 'INACTIVE' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3.5">Vendor</th>
                  <th className="py-3 px-3.5">Product Name</th>
                  <th className="py-3 px-3.5">Brand</th>
                  <th className="py-3 px-3.5">Category</th>
                  <th className="py-3 px-3.5">Part Number</th>
                  <th className="py-3 px-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inactiveMappings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No inactive mappings found. All supplier products are active.
                    </td>
                  </tr>
                ) : (
                  inactiveMappings.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3.5 font-bold text-slate-900">{m.vendorName}</td>
                      <td className="py-3 px-3.5 text-slate-800 font-medium">{m.productName}</td>
                      <td className="py-3 px-3.5 font-semibold text-slate-700">{m.brand}</td>
                      <td className="py-3 px-3.5 text-slate-600">{m.category}</td>
                      <td className="py-3 px-3.5 font-mono text-slate-500">{m.partNumber || '—'}</td>
                      <td className="py-3 px-3.5 text-center">
                        <button
                          onClick={() => updateVendorProductMapping({ ...m, status: 'ACTIVE' })}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                        >
                          Reactivate
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 7: Supply Risk Analysis */}
        {activeTab === 'COVERAGE_ANALYSIS' && (
          <div className="p-5 space-y-4">
            <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-200 space-y-1">
              <h4 className="font-bold text-indigo-950 text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-indigo-600" />
                <span>Single Source & Zero Coverage Risk Matrix</span>
              </h4>
              <p className="text-xs text-indigo-800 leading-relaxed">
                Categories with only 1 supplier expose manufacturing plants to single-source pricing and lead-time risks.
                Categories with 0 suppliers cause RFQ turnaround bottlenecks.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {categoryCoverageMatrix.map((c, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border text-xs space-y-2.5 transition-all ${
                    c.coverageStatus === 'HEALTHY'
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : c.coverageStatus === 'SINGLE_SOURCE'
                      ? 'bg-amber-50/50 border-amber-300 shadow-2xs'
                      : 'bg-rose-50/50 border-rose-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-slate-900 text-sm block">{c.category}</span>
                      <span className="text-[10px] font-mono text-slate-500">{c.code}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.coverageStatus === 'HEALTHY'
                          ? 'bg-emerald-100 text-emerald-800'
                          : c.coverageStatus === 'SINGLE_SOURCE'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-rose-100 text-rose-900'
                      }`}
                    >
                      {c.coverageStatus === 'HEALTHY'
                        ? 'Healthy (2+ Suppliers)'
                        : c.coverageStatus === 'SINGLE_SOURCE'
                        ? 'Single Source Risk'
                        : 'Zero Suppliers Gap'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Suppliers:</span>
                      <strong className="text-slate-800">{c.suppliersCount}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Products:</span>
                      <strong className="text-slate-800">{c.totalProducts}</strong>
                    </div>
                  </div>

                  {c.suppliers.length > 0 && (
                    <div className="text-[11px] text-slate-600 truncate">
                      Suppliers: <strong>{c.suppliers.join(', ')}</strong>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
