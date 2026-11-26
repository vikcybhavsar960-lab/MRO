import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Tag,
  Layers,
  Sparkles,
  AlertCircle,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
  X,
  FileDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import {
  Vendor,
  VendorProductMapping,
  VendorSupplyType,
  VendorProductAvailability,
  VendorProductStatus,
} from '../../types';
import { ProductsDealtInSection } from './ProductsDealtInSection';

interface VendorProductMappingSectionProps {
  vendor: Vendor;
  onOpenAiAnalyzer?: () => void;
}

export const VendorProductMappingSection: React.FC<VendorProductMappingSectionProps> = ({
  vendor,
  onOpenAiAnalyzer,
}) => {
  const {
    vendorProductMappings,
    addVendorProductMapping,
    updateVendorProductMapping,
    deleteVendorProductMapping,
    bulkAddVendorProductMappings,
    categories,
    brands,
    addBrand,
  } = useApp();

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | VendorProductStatus>('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('ALL');
  const [supplyTypeFilter, setSupplyTypeFilter] = useState<string>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Modals state
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<VendorProductMapping | null>(null);

  // Form states for Add / Edit
  const [formProductName, setFormProductName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formSubCategory, setFormSubCategory] = useState('');
  const [formProductType, setFormProductType] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formModelNumber, setFormModelNumber] = useState('');
  const [formPartNumber, setFormPartNumber] = useState('');
  const [formSpecification, setFormSpecification] = useState('');
  const [formRating, setFormRating] = useState('');
  const [formSize, setFormSize] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formUom, setFormUom] = useState('NOS');
  const [formSupplyType, setFormSupplyType] = useState<VendorSupplyType>('Authorized Distributor');
  const [formAvailability, setFormAvailability] = useState<VendorProductAvailability>('Regular Stock');
  const [formStatus, setFormStatus] = useState<VendorProductStatus>('ACTIVE');
  const [formRemarks, setFormRemarks] = useState('');

  // Excel Import states
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Partial<VendorProductMapping>[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Vendor's products
  const vendorProducts = useMemo(() => {
    return vendorProductMappings.filter((m) => m.vendorId === vendor.id);
  }, [vendorProductMappings, vendor.id]);

  // Derived filter options
  const vendorCategories = useMemo(() => {
    return Array.from(new Set(vendorProducts.map((p) => p.category).filter(Boolean))).sort();
  }, [vendorProducts]);

  const vendorBrands = useMemo(() => {
    return Array.from(new Set(vendorProducts.map((p) => p.brand).filter(Boolean))).sort();
  }, [vendorProducts]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return vendorProducts.filter((p) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.productName.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        (p.modelNumber && p.modelNumber.toLowerCase().includes(q)) ||
        (p.partNumber && p.partNumber.toLowerCase().includes(q)) ||
        (p.specification && p.specification.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q) ||
        (p.subCategory && p.subCategory.toLowerCase().includes(q));

      const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
      const matchesBrand = brandFilter === 'ALL' || p.brand === brandFilter;
      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
      const matchesAvailability = availabilityFilter === 'ALL' || p.availability === availabilityFilter;
      const matchesSupplyType = supplyTypeFilter === 'ALL' || p.supplyType === supplyTypeFilter;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesBrand &&
        matchesStatus &&
        matchesAvailability &&
        matchesSupplyType
      );
    });
  }, [
    vendorProducts,
    search,
    categoryFilter,
    brandFilter,
    statusFilter,
    availabilityFilter,
    supplyTypeFilter,
  ]);

  // Paginated items
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  // Reset pagination on filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, brandFilter, statusFilter, availabilityFilter, supplyTypeFilter]);

  // Handle open add modal
  const handleOpenAdd = () => {
    setEditingMapping(null);
    setFormProductName('');
    setFormCategory(categories[0]?.name || 'Electrical');
    setFormSubCategory('');
    setFormProductType('');
    setFormBrand(vendor.brandsSupplied?.[0] || 'Generic');
    setFormModelNumber('');
    setFormPartNumber('');
    setFormSpecification('');
    setFormRating('');
    setFormSize('');
    setFormDescription('');
    setFormUom('NOS');
    setFormSupplyType('Authorized Distributor');
    setFormAvailability('Regular Stock');
    setFormStatus('ACTIVE');
    setFormRemarks('');
    setIsAddEditModalOpen(true);
  };

  // Handle open edit modal
  const handleOpenEdit = (mapping: VendorProductMapping) => {
    setEditingMapping(mapping);
    setFormProductName(mapping.productName);
    setFormCategory(mapping.category);
    setFormSubCategory(mapping.subCategory || '');
    setFormProductType(mapping.productType || '');
    setFormBrand(mapping.brand);
    setFormModelNumber(mapping.modelNumber || '');
    setFormPartNumber(mapping.partNumber || '');
    setFormSpecification(mapping.specification || '');
    setFormRating(mapping.rating || '');
    setFormSize(mapping.size || '');
    setFormDescription(mapping.description || '');
    setFormUom(mapping.uom || 'NOS');
    setFormSupplyType(mapping.supplyType || 'Authorized Distributor');
    setFormAvailability(mapping.availability || 'Regular Stock');
    setFormStatus(mapping.status || 'ACTIVE');
    setFormRemarks(mapping.remarks || '');
    setIsAddEditModalOpen(true);
  };

  // Save add/edit
  const handleSaveAddEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProductName.trim() || !formCategory.trim() || !formBrand.trim()) {
      alert('Product Name, Category, and Brand are required fields.');
      return;
    }

    if (editingMapping) {
      await updateVendorProductMapping({
        ...editingMapping,
        productName: formProductName.trim(),
        category: formCategory.trim(),
        subCategory: formSubCategory.trim() || undefined,
        productType: formProductType.trim() || formSubCategory.trim() || undefined,
        brand: formBrand.trim(),
        modelNumber: formModelNumber.trim() || undefined,
        partNumber: formPartNumber.trim() || undefined,
        specification: formSpecification.trim() || undefined,
        rating: formRating.trim() || undefined,
        size: formSize.trim() || undefined,
        description: formDescription.trim() || undefined,
        uom: formUom,
        supplyType: formSupplyType,
        availability: formAvailability,
        status: formStatus,
        remarks: formRemarks.trim() || undefined,
      });
    } else {
      await addVendorProductMapping({
        vendorId: vendor.id,
        vendorCode: vendor.vendorCode || vendor.id,
        vendorName: vendor.companyName,
        productName: formProductName.trim(),
        category: formCategory.trim(),
        subCategory: formSubCategory.trim() || undefined,
        productType: formProductType.trim() || formSubCategory.trim() || undefined,
        brand: formBrand.trim(),
        modelNumber: formModelNumber.trim() || undefined,
        partNumber: formPartNumber.trim() || undefined,
        specification: formSpecification.trim() || undefined,
        rating: formRating.trim() || undefined,
        size: formSize.trim() || undefined,
        description: formDescription.trim() || undefined,
        uom: formUom,
        supplyType: formSupplyType,
        availability: formAvailability,
        status: formStatus,
        remarks: formRemarks.trim() || undefined,
      });
    }

    setIsAddEditModalOpen(false);
  };

  // Toggle active/inactive
  const handleToggleStatus = async (mapping: VendorProductMapping) => {
    const nextStatus: VendorProductStatus = mapping.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await updateVendorProductMapping({
      ...mapping,
      status: nextStatus,
    });
  };

  // Delete product
  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to remove this product mapping from this supplier?')) {
      await deleteVendorProductMapping(id);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = vendorProducts.map((p, idx) => ({
      'S.No': idx + 1,
      'Product / Material Name': p.productName,
      'Category': p.category,
      'Subcategory': p.subCategory || '',
      'Product Type': p.productType || '',
      'Brand / Make': p.brand,
      'Model Number': p.modelNumber || '',
      'Part Number': p.partNumber || '',
      'Specification / Rating / Size': p.specification || p.rating || p.size || '',
      'UOM': p.uom,
      'Supply Type': p.supplyType,
      'Availability': p.availability,
      'Status': p.status,
      'Remarks': p.remarks || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products_Supplied');
    const safeName = vendor.companyName.replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `${safeName}_Products_Materials_Supplied_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Download Sample Template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Product / Material Name': 'SKF 6205-2RS Deep Groove Ball Bearing',
        'Category': 'Bearings',
        'Subcategory': 'Deep Groove Ball Bearings',
        'Product Type': 'Ball Bearing',
        'Brand / Make': 'SKF',
        'Model Number': '6205-2RS',
        'Part Number': '6205-2RS1/C3',
        'Specification': '25x52x15mm Rubber Sealed C3 Clearance',
        'UOM': 'NOS',
        'Supply Type': 'Authorized Distributor',
        'Availability': 'Regular Stock',
        'Status': 'ACTIVE',
        'Remarks': 'Standard warehouse stock',
      },
      {
        'Product / Material Name': 'Schneider Acti9 32A TP MCB 10kA C-Curve',
        'Category': 'Electrical',
        'Subcategory': 'Miniature Circuit Breakers (MCB)',
        'Product Type': 'MCB',
        'Brand / Make': 'Schneider Electric',
        'Model Number': 'A9F74332',
        'Part Number': 'iC60N 3P 32A',
        'Specification': 'Triple Pole 32A 10kA C-Curve 415V',
        'UOM': 'NOS',
        'Supply Type': 'Dealer',
        'Availability': 'Regular Stock',
        'Status': 'ACTIVE',
        'Remarks': 'Original Schneider authorized packaging',
      },
      {
        'Product / Material Name': 'Festo DNC-40-100-PPV-A Pneumatic Cylinder',
        'Category': 'Mechanical and Industrial',
        'Subcategory': 'Pneumatic Components',
        'Product Type': 'Pneumatic Cylinder',
        'Brand / Make': 'Festo',
        'Model Number': 'DNC-40-100',
        'Part Number': '163354',
        'Specification': 'Bore 40mm, Stroke 100mm, Double Acting Cushioning',
        'UOM': 'NOS',
        'Supply Type': 'Authorized Distributor',
        'Availability': 'Order Based',
        'Status': 'ACTIVE',
        'Remarks': 'Lead time 3-4 days',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Product_Import_Template');
    XLSX.writeFile(wb, 'MRO_Vendor_Product_Mapping_Template.xlsx');
  };

  // Parse Excel for Import
  const handleFileImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImportFile(file);
      setImportErrors([]);

      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(sheet);

        if (rawJson.length === 0) {
          setImportErrors(['Uploaded file contains no rows.']);
          setImportPreview([]);
          return;
        }

        const parsedList: Partial<VendorProductMapping>[] = [];
        const errs: string[] = [];

        rawJson.forEach((row, idx) => {
          const rowNum = idx + 2;
          const name = row['Product / Material Name'] || row['Product Name'] || row['Item Name'] || row['Material Name'] || row['productName'];
          const cat = row['Category'] || row['Material Category'] || row['category'] || 'General Industrial Spares';
          const brand = row['Brand / Make'] || row['Brand'] || row['Make'] || row['brand'] || 'Generic';

          if (!name) {
            errs.push(`Row ${rowNum}: Missing Product Name`);
            return;
          }

          parsedList.push({
            productName: String(name).trim(),
            category: String(cat).trim(),
            subCategory: String(row['Subcategory'] || row['subCategory'] || '').trim(),
            productType: String(row['Product Type'] || row['productType'] || row['Subcategory'] || '').trim(),
            brand: String(brand).trim(),
            modelNumber: String(row['Model Number'] || row['modelNumber'] || row['Model'] || '').trim(),
            partNumber: String(row['Part Number'] || row['partNumber'] || '').trim(),
            specification: String(row['Specification / Rating / Size'] || row['Specification'] || row['specification'] || '').trim(),
            rating: String(row['Rating'] || row['rating'] || '').trim(),
            size: String(row['Size'] || row['size'] || '').trim(),
            description: String(row['Description'] || row['description'] || '').trim(),
            uom: String(row['UOM'] || row['uom'] || 'NOS').trim().toUpperCase(),
            supplyType: (row['Supply Type'] || 'Authorized Distributor') as VendorSupplyType,
            availability: (row['Availability'] || 'Regular Stock') as VendorProductAvailability,
            status: 'ACTIVE',
            remarks: String(row['Remarks'] || 'Bulk Excel Import').trim(),
          });
        });

        setImportPreview(parsedList);
        setImportErrors(errs);
      } catch (err: any) {
        setImportErrors([`Failed to parse Excel file: ${err.message}`]);
      }
    }
  };

  // Submit Bulk Import
  const handleConfirmImport = async () => {
    if (importPreview.length === 0) return;
    setIsImporting(true);
    try {
      const result = await bulkAddVendorProductMappings(vendor.id, importPreview);
      setIsImportModalOpen(false);
      setImportFile(null);
      setImportPreview([]);
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* One-Click Add Product Type to Master & Vendor */}
      <ProductsDealtInSection vendor={vendor} />

      {/* Top Banner & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <h4 className="font-bold text-slate-900 text-sm">
              Products & Materials Supplied Registry
            </h4>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 font-mono">
              {vendorProducts.length} Products
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Exact products handled by {vendor.companyName} with brands, part numbers, specs, and stock availability.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenAiAnalyzer && (
            <button
              onClick={onOpenAiAnalyzer}
              className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Catalog Analyzer</span>
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Excel Import</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={vendorProducts.length === 0}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export ({vendorProducts.length})</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5 text-xs">
        <div className="sm:col-span-2 relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by product, part #, model, specs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium truncate"
          >
            <option value="ALL">All Categories ({vendorCategories.length})</option>
            {vendorCategories.map((c, i) => (
              <option key={i} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium truncate"
          >
            <option value="ALL">All Brands ({vendorBrands.length})</option>
            {vendorBrands.map((b, i) => (
              <option key={i} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value)}
            className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium truncate"
          >
            <option value="ALL">All Availability</option>
            <option value="Regular Stock">Regular Stock</option>
            <option value="Order Based">Order Based</option>
            <option value="Special Order">Special Order</option>
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-3.5">Product Name & Code</th>
                <th className="py-3 px-3.5">Category & Subcategory</th>
                <th className="py-3 px-3.5">Brand / Make</th>
                <th className="py-3 px-3.5">Specification / Size</th>
                <th className="py-3 px-3.5">UOM</th>
                <th className="py-3 px-3.5">Supply Type</th>
                <th className="py-3 px-3.5">Availability</th>
                <th className="py-3 px-3.5 text-center">Status</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-sm text-slate-600">No products registered yet</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Add products manually, import from an Excel sheet, or upload a catalog via AI.
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <button
                        onClick={handleOpenAdd}
                        className="px-3.5 py-1.5 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700"
                      >
                        + Add First Product
                      </button>
                      <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-100"
                      >
                        Excel Import
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Product Name & Code */}
                      <td className="py-3 px-3.5 max-w-[220px]">
                        <div className="font-bold text-slate-900 text-xs line-clamp-1">{p.productName}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {(p.partNumber || p.modelNumber) && (
                            <span className="font-mono text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded font-semibold">
                              {p.partNumber || p.modelNumber}
                            </span>
                          )}
                          {p.productType && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              Type: {p.productType}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category & Subcategory */}
                      <td className="py-3 px-3.5">
                        <span className="font-semibold text-slate-800 block text-xs">{p.category}</span>
                        {p.subCategory && (
                          <span className="text-[10px] text-slate-500 block truncate max-w-[140px]">
                            {p.subCategory}
                          </span>
                        )}
                      </td>

                      {/* Brand */}
                      <td className="py-3 px-3.5">
                        <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md font-semibold text-xs">
                          {p.brand}
                        </span>
                      </td>

                      {/* Specs */}
                      <td className="py-3 px-3.5 max-w-[180px]">
                        <span className="text-[11px] text-slate-700 line-clamp-2">
                          {p.specification || p.rating || p.size || p.description || '—'}
                        </span>
                      </td>

                      {/* UOM */}
                      <td className="py-3 px-3.5 font-mono text-[11px] text-slate-600 font-bold">
                        {p.uom || 'NOS'}
                      </td>

                      {/* Supply Type */}
                      <td className="py-3 px-3.5">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium whitespace-nowrap">
                          {p.supplyType}
                        </span>
                      </td>

                      {/* Availability */}
                      <td className="py-3 px-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                            p.availability === 'Regular Stock'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : p.availability === 'Order Based'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {p.availability}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3.5 text-center">
                        <button
                          onClick={() => handleToggleStatus(p)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                            p.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                          title="Click to toggle status"
                        >
                          {p.status}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Product Mapping"
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

        {/* Pagination Footer */}
        {filteredProducts.length > itemsPerPage && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              Showing <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> to{' '}
              <strong>{Math.min(currentPage * itemsPerPage, filteredProducts.length)}</strong> of{' '}
              <strong>{filteredProducts.length}</strong> products
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ADD / EDIT PRODUCT MODAL */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Package className="w-5 h-5 text-blue-400" />
                <h4 className="font-bold text-base">
                  {editingMapping ? 'Edit Product & Material' : 'Register Product Supplied'}
                </h4>
              </div>
              <button
                onClick={() => setIsAddEditModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAddEdit} className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Product / Material Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SKF 6205-2RS Deep Groove Ball Bearing"
                  value={formProductName}
                  onChange={(e) => setFormProductName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Material Category *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Subcategory</label>
                  <input
                    type="text"
                    placeholder="e.g. Deep Groove Ball Bearings"
                    value={formSubCategory}
                    onChange={(e) => setFormSubCategory(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Product Type</label>
                  <input
                    type="text"
                    placeholder="e.g. Ball Bearing, MCB"
                    value={formProductType}
                    onChange={(e) => setFormProductType(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Brand / Make *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SKF, Schneider, Festo"
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Model Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 6205-2RS"
                    value={formModelNumber}
                    onChange={(e) => setFormModelNumber(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Part Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 6205-2RS1/C3"
                    value={formPartNumber}
                    onChange={(e) => setFormPartNumber(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Specification / Size</label>
                  <input
                    type="text"
                    placeholder="e.g. 25x52x15mm, 32A 10kA"
                    value={formSpecification}
                    onChange={(e) => setFormSpecification(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Rating / Class</label>
                  <input
                    type="text"
                    placeholder="e.g. 415V, IP65, Class 150"
                    value={formRating}
                    onChange={(e) => setFormRating(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Unit of Measure (UOM)</label>
                  <select
                    value={formUom}
                    onChange={(e) => setFormUom(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="NOS">NOS (Numbers)</option>
                    <option value="MTR">MTR (Meters)</option>
                    <option value="SET">SET</option>
                    <option value="KG">KG (Kilograms)</option>
                    <option value="LTR">LTR (Liters)</option>
                    <option value="PKT">PKT (Packets)</option>
                    <option value="BOX">BOX</option>
                    <option value="PAIR">PAIR</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Supply Type</label>
                  <select
                    value={formSupplyType}
                    onChange={(e) => setFormSupplyType(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="Manufacturer">Manufacturer</option>
                    <option value="Authorized Distributor">Authorized Distributor</option>
                    <option value="Dealer">Dealer</option>
                    <option value="Trader">Trader</option>
                    <option value="Service Provider">Service Provider</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Stock Availability</label>
                  <select
                    value={formAvailability}
                    onChange={(e) => setFormAvailability(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="Regular Stock">Regular Stock</option>
                    <option value="Order Based">Order Based</option>
                    <option value="Special Order">Special Order</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Technical Description</label>
                <textarea
                  rows={2}
                  placeholder="Detailed engineering notes, materials, tolerance, certifications..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Remarks / Internal Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Lead time 2 days, OEM certified"
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 -mx-6 -mb-6">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20"
                >
                  {editingMapping ? 'Update Product' : 'Save Product to Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXCEL BULK IMPORT MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <h4 className="font-bold text-base">Bulk Import Products via Excel / CSV</h4>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportFile(null);
                  setImportPreview([]);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
              {/* Template Download Prompt */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-blue-900 block">Download Excel Format Template</span>
                  <span className="text-[11px] text-blue-700">
                    Use our pre-formatted template with standard MRO columns (Product Name, Brand, Category, etc.)
                  </span>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-2xs"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Download .XLSX</span>
                </button>
              </div>

              {/* Upload Drop Zone */}
              <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-6 text-center bg-slate-50 relative cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileImportChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                <p className="font-bold text-slate-800 text-xs">
                  {importFile ? importFile.name : 'Select or drop your filled Excel / CSV product list'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Supports XLSX, XLS, and CSV files</p>
              </div>

              {/* Errors */}
              {importErrors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-rose-800 text-[11px]">
                  <span className="font-bold flex items-center gap-1.5 text-rose-900">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Import Warnings ({importErrors.length})</span>
                  </span>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {importErrors.slice(0, 5).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview */}
              {importPreview.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      Previewing {importPreview.length} items to import:
                    </span>
                    <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                      Valid rows detected
                    </span>
                  </div>

                  <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {importPreview.slice(0, 8).map((p, idx) => (
                      <div key={idx} className="p-2.5 bg-white text-[11px] flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900 block">{p.productName}</span>
                          <span className="text-slate-500">
                            {p.category} • {p.brand} {p.partNumber ? `• PN: ${p.partNumber}` : ''}
                          </span>
                        </div>
                        <span className="font-mono text-slate-400 text-[10px]">{p.uom}</span>
                      </div>
                    ))}
                    {importPreview.length > 8 && (
                      <div className="p-2 text-center text-slate-400 text-[10px] bg-slate-50">
                        +{importPreview.length - 8} more items
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportFile(null);
                  setImportPreview([]);
                }}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={importPreview.length === 0 || isImporting}
                onClick={handleConfirmImport}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20"
              >
                {isImporting ? 'Importing Products...' : `Import ${importPreview.length} Products`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
