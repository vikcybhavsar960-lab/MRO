import React, { useState } from 'react';
import {
  BookmarkCheck,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Building,
  Tag,
  Globe,
  ExternalLink,
  Download,
  CheckCircle2,
  XCircle,
  X,
  AlertCircle,
  Sparkles,
  Layers,
  ArrowUpDown,
  Percent,
  CheckSquare,
  Square,
  Image as ImageIcon,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BrandMasterItem } from '../../types';
import { BulkBrandDiscountModal } from '../catalog/BulkBrandDiscountModal';
import { generateCollisionSafeSeqId } from '../../utils/idGenerator';
import * as XLSX from 'xlsx';

interface BrandMasterProps {
  onSelectBrandFilter?: (brandName: string) => void;
  onNavigateToVendors?: () => void;
}

export const BrandMaster: React.FC<BrandMasterProps> = ({
  onSelectBrandFilter,
  onNavigateToVendors,
}) => {
  const { brands, addBrand, updateBrand, deleteBrand, categories, vendors } = useApp();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [brandTypeFilter, setBrandTypeFilter] = useState<'ALL' | 'GLOBAL_OEM' | 'LOCAL_BRAND'>('ALL');
  const [sortField, setSortField] = useState<'name' | 'vendors' | 'createdAt'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<BrandMasterItem | null>(null);
  const [viewingVendorsForBrand, setViewingVendorsForBrand] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isBulkDiscountModalOpen, setIsBulkDiscountModalOpen] = useState(false);
  const [bulkDiscountBrand, setBulkDiscountBrand] = useState<string>('');

  // Bulk selection state
  const [selectedBrandIds, setSelectedBrandIds] = useState<Set<string>>(new Set());

  // Form state
  const [formName, setFormName] = useState('');
  const [formGlobalBrandId, setFormGlobalBrandId] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formAliases, setFormAliases] = useState('');
  const [formManufacturer, setFormManufacturer] = useState('');
  const [formLogoUrl, setFormLogoUrl] = useState('');
  const [formCategory, setFormCategory] = useState('Bearings');
  const [formCategories, setFormCategories] = useState<string[]>(['Bearings']);
  const [formDescription, setFormDescription] = useState('');
  const [formCountry, setFormCountry] = useState('India');
  const [formWebsite, setFormWebsite] = useState('');
  const [formBrandType, setFormBrandType] = useState<'GLOBAL_OEM' | 'LOCAL_BRAND'>('GLOBAL_OEM');
  const [formIsActive, setFormIsActive] = useState(true);
  const [brandInputError, setBrandInputError] = useState<string | null>(null);

  // Helper to normalize strings for variation and conflict detection
  const normalizeBrandStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  const checkBrandVariationConflict = (
    name: string,
    aliasesStr: string,
    currentId?: string
  ): { conflict: boolean; message?: string } => {
    const targetNorm = normalizeBrandStr(name);
    const targetAliases = aliasesStr
      .split(',')
      .map((a) => normalizeBrandStr(a.trim()))
      .filter(Boolean);

    for (const b of brands) {
      if (currentId && b.id === currentId) continue;
      const bNorm = normalizeBrandStr(b.name);
      if (bNorm === targetNorm) {
        return {
          conflict: true,
          message: `Brand variation detected: "${name}" conflicts with existing brand "${b.name}" (${b.globalBrandId || b.id}). If this is an alternative spelling, consider adding it as an alias to the existing brand instead of creating a duplicate.`,
        };
      }
      const existingAliases = (b.aliases || []).map(normalizeBrandStr);
      if (existingAliases.includes(targetNorm)) {
        return {
          conflict: true,
          message: `"${name}" is already registered as an alias under brand "${b.name}".`,
        };
      }
      for (const alias of targetAliases) {
        if (alias === bNorm) {
          return {
            conflict: true,
            message: `Alias "${alias}" conflicts with existing brand "${b.name}".`,
          };
        }
        if (existingAliases.includes(alias)) {
          return {
            conflict: true,
            message: `Alias "${alias}" conflicts with alias of "${b.name}".`,
          };
        }
      }
    }
    return { conflict: false };
  };

  // Validation function: Detect bogus entries like "parss cad", CAD drawing files, part numbers, or generic file names
  const validateBrandInput = (name: string): { isValid: boolean; error?: string } => {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      return { isValid: false, error: 'Brand name is required.' };
    }
    if (trimmed.length < 2) {
      return { isValid: false, error: 'Brand name is too short (minimum 2 characters).' };
    }

    const lower = trimmed.toLowerCase();

    // Check CAD drawing terms or engineering file terms (User specifically reported "parss cad")
    const cadMistakeTerms = [
      'parss cad',
      'part cad',
      'parts cad',
      '.cad',
      '.dwg',
      '.dxf',
      '.step',
      '.stp',
      'cad drawing',
      'cad file',
      'autocad',
      'solidworks',
      'draft rev',
    ];

    if (cadMistakeTerms.some((t) => lower.includes(t))) {
      return {
        isValid: false,
        error: `Mistake Detected: "${trimmed}" looks like a CAD drawing file or engineering draft specification ('parss cad'), not a valid manufacturer brand. Please enter a valid OEM brand (e.g. SKF, Siemens, Festo) or a genuine local manufacturer.`,
      };
    }

    // Check file extensions
    if (/\.(pdf|xlsx|xls|csv|png|jpg|jpeg|docx|zip|dwg|dxf|cad|step)$/i.test(trimmed)) {
      return {
        isValid: false,
        error: `Mistake Detected: "${trimmed}" contains a file extension. Brands must be valid OEM/company names.`,
      };
    }

    // Pure numbers or dimension notation (e.g. 6205, 100x50, 1/2")
    if (/^\d+$/.test(trimmed) || /^[\d\s\.\,\-\*x\/]+(mm|inch|in|cm|m)?$/i.test(trimmed)) {
      return {
        isValid: false,
        error: `Mistake Detected: "${trimmed}" appears to be a part number or dimension rather than a brand name.`,
      };
    }

    // Generic placeholders
    const placeholders = ['null', 'undefined', 'n/a', 'none', 'unknown', 'sample', 'test brand', 'temp'];
    if (placeholders.includes(lower)) {
      return {
        isValid: false,
        error: `"${trimmed}" is a placeholder. Please enter a genuine OEM or supplier brand.`,
      };
    }

    return { isValid: true };
  };

  // Helper to determine if a brand is recognized as Global OEM
  const isRecognizedGlobalOem = (brand: BrandMasterItem): boolean => {
    if (brand.brandType === 'GLOBAL_OEM') return true;
    if (brand.brandType === 'LOCAL_BRAND') return false;
    const norm = brand.name.toLowerCase().trim();
    const globalList = [
      'skf', 'fag', 'timken', 'nsk', 'ntn', 'ina', 'koyo', 'schaeffler',
      'siemens', 'abb', 'schneider', 'schneider electric', 'l&t', 'larsen & toubro', 'legrand', 'havells', 'polycab', 'finolex',
      'festo', 'smc', 'parker', 'rexroth', 'bosch rexroth', 'bosch', 'janatics', 'norgren', 'camozzi',
      'omron', 'mitsubishi', 'delta', 'danfoss', 'allen-bradley', 'rockwell', 'honeywell', 'yokogawa', 'endress+hauser',
      'uflow', 'ksb', 'grundfos', 'cri', 'forbes marshall', 'spirax sarco', 'audco',
      '3m', 'loctite', 'henkel', 'taparia', 'stanley', 'makita', 'dewalt'
    ];
    return globalList.some((g) => norm === g || norm.includes(g));
  };

  // Count vendors supplying each brand
  const getSupplyingVendors = (brandName: string) => {
    const q = brandName.toLowerCase().trim();
    return vendors.filter((v) =>
      (v.brandsSupplied || []).some((b) => b.toLowerCase().trim() === q)
    );
  };

  // Filter brands
  const filteredBrands = brands.filter((brand) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      brand.name.toLowerCase().includes(q) ||
      (brand.code && brand.code.toLowerCase().includes(q)) ||
      (brand.category && brand.category.toLowerCase().includes(q)) ||
      (brand.description && brand.description.toLowerCase().includes(q));

    const matchesCategory =
      selectedCategory === 'ALL' ||
      brand.category === selectedCategory ||
      (brand.categories && brand.categories.includes(selectedCategory));

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && brand.isActive) ||
      (statusFilter === 'INACTIVE' && !brand.isActive);

    const isGlobal = isRecognizedGlobalOem(brand);
    const matchesType =
      brandTypeFilter === 'ALL' ||
      (brandTypeFilter === 'GLOBAL_OEM' && isGlobal) ||
      (brandTypeFilter === 'LOCAL_BRAND' && !isGlobal);

    return matchesSearch && matchesCategory && matchesStatus && matchesType;
  });

  // Sort brands
  const sortedBrands = [...filteredBrands].sort((a, b) => {
    if (sortField === 'name') {
      return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    }
    if (sortField === 'vendors') {
      const countA = getSupplyingVendors(a.name).length;
      const countB = getSupplyingVendors(b.name).length;
      return sortAsc ? countA - countB : countB - countA;
    }
    return sortAsc ? (a.createdAt || '').localeCompare(b.createdAt || '') : (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleOpenAdd = () => {
    const nextGlobalId = generateCollisionSafeSeqId(
      'GBRD',
      brands.map((b) => ({ id: b.globalBrandId || b.id })),
      [],
      undefined,
      3
    );
    setFormGlobalBrandId(nextGlobalId);
    setFormName('');
    setFormCode('');
    setFormAliases('');
    setFormManufacturer('');
    setFormLogoUrl('');
    setFormCategory(categories[0]?.name || 'Bearings');
    setFormCategories([categories[0]?.name || 'Bearings']);
    setFormDescription('');
    setFormCountry('India');
    setFormWebsite('');
    setFormBrandType('GLOBAL_OEM');
    setFormIsActive(true);
    setBrandInputError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (brand: BrandMasterItem) => {
    setEditingBrand(brand);
    setFormGlobalBrandId(brand.globalBrandId || brand.id);
    setFormName(brand.name);
    setFormCode(brand.code || '');
    setFormAliases((brand.aliases || []).join(', '));
    setFormManufacturer(brand.manufacturer || '');
    setFormLogoUrl(brand.logoUrl || '');
    setFormCategory(brand.category || categories[0]?.name || 'Bearings');
    setFormCategories(brand.categories && brand.categories.length > 0 ? brand.categories : [brand.category || 'Bearings']);
    setFormDescription(brand.description || '');
    setFormCountry(brand.countryOfOrigin || 'India');
    setFormWebsite(brand.website || '');
    setFormBrandType(brand.brandType || (isRecognizedGlobalOem(brand) ? 'GLOBAL_OEM' : 'LOCAL_BRAND'));
    setFormIsActive(brand.isActive);
    setBrandInputError(null);
  };

  const handleSaveBrand = (e: React.FormEvent) => {
    e.preventDefault();
    setBrandInputError(null);

    // Run mistake validation
    const validation = validateBrandInput(formName);
    if (!validation.isValid) {
      setBrandInputError(validation.error || 'Invalid brand name');
      showNotification('error', validation.error || 'Invalid brand name');
      return;
    }

    // Check duplicate or alias variations (e.g. Abb vs ABB)
    const conflictCheck = checkBrandVariationConflict(formName.trim(), formAliases);
    if (conflictCheck.conflict) {
      setBrandInputError(conflictCheck.message || 'Duplicate or conflicting brand detected');
      showNotification('error', conflictCheck.message || 'Duplicate brand detected');
      return;
    }

    const aliasesArray = formAliases
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    const created = addBrand({
      name: formName.trim(),
      globalBrandId: formGlobalBrandId.trim() || undefined,
      code: formCode.trim().toUpperCase() || formName.trim().toUpperCase().slice(0, 4),
      aliases: aliasesArray,
      manufacturer: formManufacturer.trim() || undefined,
      logoUrl: formLogoUrl.trim() || undefined,
      category: formCategory,
      categories: formCategories.length > 0 ? formCategories : [formCategory],
      description: formDescription.trim(),
      countryOfOrigin: formCountry.trim(),
      website: formWebsite.trim(),
      brandType: formBrandType,
      isActive: formIsActive,
      status: formIsActive ? 'ACTIVE' : 'INACTIVE',
    });

    setIsAddModalOpen(false);
    showNotification('success', `Brand "${created.name}" (${formBrandType === 'GLOBAL_OEM' ? 'Global OEM' : 'Local Brand'}) registered successfully with Global ID ${formGlobalBrandId}.`);
  };

  const handleUpdateBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBrand) return;
    setBrandInputError(null);

    const validation = validateBrandInput(formName);
    if (!validation.isValid) {
      setBrandInputError(validation.error || 'Invalid brand name');
      showNotification('error', validation.error || 'Invalid brand name');
      return;
    }

    // Check duplicate or alias variations
    const conflictCheck = checkBrandVariationConflict(formName.trim(), formAliases, editingBrand.id);
    if (conflictCheck.conflict) {
      setBrandInputError(conflictCheck.message || 'Conflicting brand variation detected');
      showNotification('error', conflictCheck.message || 'Conflicting brand variation detected');
      return;
    }

    const aliasesArray = formAliases
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    updateBrand({
      ...editingBrand,
      name: formName.trim(),
      globalBrandId: formGlobalBrandId.trim() || editingBrand.globalBrandId || editingBrand.id,
      code: formCode.trim().toUpperCase() || formName.trim().toUpperCase().slice(0, 4),
      aliases: aliasesArray,
      manufacturer: formManufacturer.trim() || undefined,
      logoUrl: formLogoUrl.trim() || undefined,
      category: formCategory,
      categories: formCategories.length > 0 ? formCategories : [formCategory],
      description: formDescription.trim(),
      countryOfOrigin: formCountry.trim(),
      website: formWebsite.trim(),
      brandType: formBrandType,
      isActive: formIsActive,
      status: formIsActive ? 'ACTIVE' : 'INACTIVE',
    });

    setEditingBrand(null);
    showNotification('success', `Brand "${formName.trim()}" updated successfully.`);
  };

  // Bulk Actions
  const handleToggleSelectAll = () => {
    if (selectedBrandIds.size === sortedBrands.length) {
      setSelectedBrandIds(new Set());
    } else {
      setSelectedBrandIds(new Set(sortedBrands.map((b) => b.id)));
    }
  };

  const handleToggleSelectBrand = (id: string) => {
    const next = new Set(selectedBrandIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedBrandIds(next);
  };

  const handleBulkActivate = () => {
    selectedBrandIds.forEach((id) => {
      const b = brands.find((item) => item.id === id);
      if (b && !b.isActive) {
        updateBrand({ ...b, isActive: true, status: 'ACTIVE' });
      }
    });
    showNotification('success', `Marked ${selectedBrandIds.size} selected brand(s) as ACTIVE.`);
    setSelectedBrandIds(new Set());
  };

  const handleBulkDeactivate = () => {
    selectedBrandIds.forEach((id) => {
      const b = brands.find((item) => item.id === id);
      if (b && b.isActive) {
        updateBrand({ ...b, isActive: false, status: 'INACTIVE' });
      }
    });
    showNotification('success', `Marked ${selectedBrandIds.size} selected brand(s) as INACTIVE.`);
    setSelectedBrandIds(new Set());
  };

  const handleDeleteBrand = (brand: BrandMasterItem) => {
    if (confirm(`Are you sure you want to delete brand "${brand.name}"?`)) {
      const res = deleteBrand(brand.id);
      if (res.success) {
        showNotification('success', res.message);
      } else {
        showNotification('error', res.message);
      }
    }
  };

  const handleToggleStatus = (brand: BrandMasterItem) => {
    updateBrand({
      ...brand,
      isActive: !brand.isActive,
    });
    showNotification(
      'success',
      `Brand "${brand.name}" marked as ${!brand.isActive ? 'ACTIVE' : 'INACTIVE'}.`
    );
  };

  const handleExportBrands = () => {
    const rows = sortedBrands.map((b, idx) => {
      const supplying = getSupplyingVendors(b.name);
      return {
        'Sr. No.': idx + 1,
        'Brand ID': b.id,
        'Brand Name': b.name,
        'Brand Code': b.code || '',
        'Primary Category': b.category || '',
        'Associated Categories': (b.categories || []).join(', '),
        'Supplying Vendors Count': supplying.length,
        'Supplying Vendors': supplying.map((v) => v.companyName).join(', '),
        'Country of Origin': b.countryOfOrigin || '',
        'Website': b.website || '',
        'Status': b.isActive ? 'ACTIVE' : 'INACTIVE',
        'Description': b.description || '',
        'Created Date': b.createdAt || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 8 },
      { wch: 12 },
      { wch: 22 },
      { wch: 14 },
      { wch: 24 },
      { wch: 32 },
      { wch: 16 },
      { wch: 36 },
      { wch: 18 },
      { wch: 26 },
      { wch: 14 },
      { wch: 35 },
      { wch: 14 },
    ];
    if (rows.length > 0 && ws['!ref']) {
      ws['!autofilter'] = { ref: ws['!ref'] };
      ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }];
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Brands_Master');
    XLSX.writeFile(wb, `MRO_Brand_Master_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const vendorsForActiveBrand = viewingVendorsForBrand
    ? getSupplyingVendors(viewingVendorsForBrand)
    : [];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-bold transition-all shadow-md animate-in fade-in slide-in-from-top-2 ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Brand & OEM Master Registry</h2>
            <span className="hidden sm:inline-block px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 rounded-full border border-blue-200">
              {brands.length} Brands Registered
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage approved OEM brands (SKF, FAG, Timken, Bosch, Siemens, Festo, etc.) and link them directly to vendor supply portfolios.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToVendors && (
            <button
              onClick={onNavigateToVendors}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors"
            >
              <Building className="w-3.5 h-3.5 text-slate-600" />
              <span>View Vendor Directory</span>
            </button>
          )}

          <button
            onClick={() => {
              setBulkDiscountBrand(brands[0]?.name || '');
              setIsBulkDiscountModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
          >
            <Percent className="w-3.5 h-3.5 text-amber-300" />
            <span>Bulk Brand Discount</span>
          </button>

          <button
            onClick={handleExportBrands}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export Brands (.xlsx)</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Brand</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Brands</span>
          <span className="text-2xl font-black text-slate-900">{brands.length}</span>
          <span className="text-[11px] text-slate-500 block mt-0.5">Approved in MRO Master</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Active Brands</span>
          <span className="text-2xl font-black text-emerald-600">
            {brands.filter((b) => b.isActive).length}
          </span>
          <span className="text-[11px] text-slate-500 block mt-0.5">Available for vendor tagging</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Supplied by Vendors</span>
          <span className="text-2xl font-black text-blue-600">
            {brands.filter((b) => getSupplyingVendors(b.name).length > 0).length}
          </span>
          <span className="text-[11px] text-slate-500 block mt-0.5">Linked to certified suppliers</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Vendor Registry Count</span>
          <span className="text-2xl font-black text-slate-900">{vendors.length}</span>
          <span className="text-[11px] text-slate-500 block mt-0.5">Active supplier directory</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brand by name, code (e.g. SKF, FAG, Timken), or description..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Global vs Local Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setBrandTypeFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              brandTypeFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Brands ({brands.length})
          </button>
          <button
            type="button"
            onClick={() => setBrandTypeFilter('GLOBAL_OEM')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              brandTypeFilter === 'GLOBAL_OEM'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-indigo-700 hover:text-indigo-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Global OEM ({brands.filter(isRecognizedGlobalOem).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setBrandTypeFilter('LOCAL_BRAND')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              brandTypeFilter === 'LOCAL_BRAND'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-amber-800 hover:text-amber-900'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Local Brand ({brands.filter((b) => !isRecognizedGlobalOem(b)).length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 font-medium">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 max-w-[180px] truncate"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>

          <button
            onClick={() => {
              if (sortField === 'name') setSortAsc(!sortAsc);
              else {
                setSortField('name');
                setSortAsc(true);
              }
            }}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-colors"
            title="Sort alphabetically"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Name {sortField === 'name' ? (sortAsc ? 'A-Z' : 'Z-A') : ''}</span>
          </button>
        </div>
      </div>

      {/* Bulk Action Floating Bar */}
      {selectedBrandIds.size > 0 && (
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2 font-bold">
            <CheckSquare className="w-4 h-4 text-amber-300" />
            <span>{selectedBrandIds.size} Brand(s) Selected</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleBulkActivate}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs"
            >
              Activate Selected
            </button>
            <button
              type="button"
              onClick={handleBulkDeactivate}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-bold shadow-xs"
            >
              Deactivate Selected
            </button>
            <button
              type="button"
              onClick={() => {
                const firstId = Array.from(selectedBrandIds)[0];
                const b = brands.find((item) => item.id === firstId);
                if (b) setBulkDiscountBrand(b.name);
                setIsBulkDiscountModalOpen(true);
              }}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg font-bold shadow-xs flex items-center gap-1"
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Apply Bulk Discount</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedBrandIds(new Set())}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Brands Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={selectedBrandIds.size === sortedBrands.length && sortedBrands.length > 0}
                    onChange={handleToggleSelectAll}
                    className="rounded text-blue-600"
                  />
                </th>
                <th className="py-3 px-4">Brand & Global ID</th>
                <th className="py-3 px-4">Tier / Type</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Primary Category</th>
                <th className="py-3 px-4">Associated Categories</th>
                <th className="py-3 px-4 text-center">Supplying Vendors</th>
                <th className="py-3 px-4">Origin</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedBrands.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <BookmarkCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-sm text-slate-600">No matching brands found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Try adjusting your search query or category filters, or click "Add Brand" to create one.
                    </p>
                  </td>
                </tr>
              ) : (
                sortedBrands.map((b) => {
                  const supplying = getSupplyingVendors(b.name);
                  const isSelected = selectedBrandIds.has(b.id);

                  return (
                    <tr
                      key={b.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isSelected ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectBrand(b.id)}
                          className="rounded text-blue-600"
                        />
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {b.logoUrl ? (
                            <img
                              src={b.logoUrl}
                              alt={b.name}
                              className="w-8 h-8 rounded-lg object-contain bg-slate-50 border border-slate-200 p-0.5 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-black flex items-center justify-center text-xs shrink-0">
                              {b.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-sm">{b.name}</span>
                              <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded border border-slate-200">
                                {b.globalBrandId || b.id}
                              </span>
                            </div>
                            {b.aliases && b.aliases.length > 0 && (
                              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                <span className="text-[10px] text-slate-400 font-medium">aka:</span>
                                {b.aliases.slice(0, 3).map((a, i) => (
                                  <span
                                    key={i}
                                    className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[9px] font-mono"
                                  >
                                    {a}
                                  </span>
                                ))}
                                {b.aliases.length > 3 && (
                                  <span className="text-[9px] text-slate-400 font-bold">
                                    +{b.aliases.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                            {b.description && (
                              <div className="text-[11px] text-slate-500 max-w-xs truncate mt-0.5" title={b.description}>
                                {b.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Tier / Type */}
                      <td className="py-3 px-4">
                        {isRecognizedGlobalOem(b) ? (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs">
                            <Globe className="w-3 h-3 text-indigo-500" />
                            <span>Global OEM</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs">
                            <Building className="w-3 h-3 text-amber-600" />
                            <span>Local Brand</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {b.code || b.name.slice(0, 4).toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {b.category || 'General MRO'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(b.categories || [b.category || 'General MRO']).slice(0, 2).map((cat, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                              {cat}
                            </span>
                          ))}
                          {(b.categories || []).length > 2 && (
                            <span className="px-1 py-0.5 text-slate-400 text-[10px] font-bold">
                              +{(b.categories || []).length - 2}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {supplying.length > 0 ? (
                          <button
                            onClick={() => setViewingVendorsForBrand(b.name)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-full font-bold text-[11px] transition-colors"
                            title="Click to view vendors supplying this brand"
                          >
                            <Building className="w-3 h-3" />
                            <span>{supplying.length} vendor{supplying.length > 1 ? 's' : ''}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">None linked</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {b.countryOfOrigin || '—'}
                      </td>

                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleStatus(b)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                            b.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {b.isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-slate-400" />
                              <span>Inactive</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setBulkDiscountBrand(b.name);
                              setIsBulkDiscountModalOpen(true);
                            }}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title={`Set Bulk Brand Discount for ${b.name}`}
                          >
                            <Percent className="w-3.5 h-3.5" />
                          </button>
                          {onSelectBrandFilter && (
                            <button
                              onClick={() => onSelectBrandFilter(b.name)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title={`Filter vendors supplying ${b.name}`}
                            >
                              <Filter className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEdit(b)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit Brand"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteBrand(b)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Brand"
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

      {/* Add / Edit Brand Modal */}
      {(isAddModalOpen || editingBrand) && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-6 flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <BookmarkCheck className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">
                  {editingBrand ? `Edit Brand: ${editingBrand.name}` : 'Register New OEM Brand'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingBrand(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={editingBrand ? handleUpdateBrand : handleSaveBrand}
              className="p-6 space-y-4 text-xs"
            >
              {/* Global Brand ID & Name */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Global Brand ID</label>
                  <input
                    type="text"
                    value={formGlobalBrandId}
                    onChange={(e) => setFormGlobalBrandId(e.target.value)}
                    placeholder="GBRD-001"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono uppercase font-bold bg-slate-50 text-blue-700"
                  />
                </div>

                <div className="col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">Official Brand Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormName(val);
                      if (val.trim()) {
                        const chk = validateBrandInput(val);
                        setBrandInputError(chk.isValid ? null : chk.error || null);
                      } else {
                        setBrandInputError(null);
                      }
                    }}
                    placeholder="e.g. SKF, Timken, Bosch, Festo"
                    className={`w-full p-2.5 border rounded-xl font-bold ${
                      brandInputError ? 'border-rose-400 bg-rose-50/30 text-rose-900' : 'border-slate-300'
                    }`}
                  />
                  {brandInputError && (
                    <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-800 font-bold flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <span>{brandInputError}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Aliases & Short Code */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">
                    Brand Aliases / Variations
                  </label>
                  <input
                    type="text"
                    value={formAliases}
                    onChange={(e) => setFormAliases(e.target.value)}
                    placeholder="e.g. ABB, A.B.B., Asea Brown Boveri"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-medium"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Comma-separated. Used for duplicate & typo detection across RFQ items.
                  </span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Brand Code</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SKF, BSH"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono uppercase"
                  />
                </div>
              </div>

              {/* Manufacturer & Logo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Official Manufacturer Entity</label>
                  <input
                    type="text"
                    value={formManufacturer}
                    onChange={(e) => setFormManufacturer(e.target.value)}
                    placeholder="e.g. SKF Group / SKF India Ltd"
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Logo URL or Upload</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={formLogoUrl}
                      onChange={(e) => setFormLogoUrl(e.target.value)}
                      placeholder="https://... or upload"
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-[11px]"
                    />
                    <label className="px-2.5 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl cursor-pointer text-slate-600 shrink-0">
                      <ImageIcon className="w-4 h-4" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => {
                              if (typeof reader.result === 'string') {
                                setFormLogoUrl(reader.result);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Brand Tier / Classification */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Brand Classification *</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFormBrandType('GLOBAL_OEM')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      formBrandType === 'GLOBAL_OEM'
                        ? 'bg-indigo-50/80 border-indigo-400 ring-1 ring-indigo-400 text-indigo-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Globe className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-xs font-bold">Global OEM Brand</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-normal">
                      Recognized international OEM (SKF, ABB, Festo, Siemens, Bosch, etc.)
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormBrandType('LOCAL_BRAND')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      formBrandType === 'LOCAL_BRAND'
                        ? 'bg-amber-50/80 border-amber-400 ring-1 ring-amber-400 text-amber-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Building className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-xs font-bold">Local / Domestic Brand</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-normal">
                      Custom supplier brand, domestic fabricator, or specialized workshop
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Primary Material Category *</label>
                <select
                  value={formCategory}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormCategory(val);
                    if (!formCategories.includes(val)) {
                      setFormCategories([...formCategories, val]);
                    }
                  }}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Associated Categories</label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl max-h-24 overflow-y-auto">
                  {categories.slice(0, 15).map((c) => {
                    const isChecked = formCategories.includes(c.name);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            if (formCategories.length > 1) {
                              setFormCategories(formCategories.filter((item) => item !== c.name));
                            }
                          } else {
                            setFormCategories([...formCategories, c.name]);
                          }
                        }}
                        className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                          isChecked
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Country of Origin</label>
                  <input
                    type="text"
                    value={formCountry}
                    onChange={(e) => setFormCountry(e.target.value)}
                    placeholder="e.g. Germany, Sweden, India"
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Website URL</label>
                  <input
                    type="url"
                    value={formWebsite}
                    onChange={(e) => setFormWebsite(e.target.value)}
                    placeholder="https://..."
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description / Product Overview</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Key products, certifications, authorized distribution network..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="brandActiveCheck"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
                />
                <label htmlFor="brandActiveCheck" className="font-bold text-slate-800 text-xs cursor-pointer">
                  Active Brand (Available for tagging in Add/Edit Vendor forms)
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingBrand(null);
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs shadow-blue-500/20"
                >
                  {editingBrand ? 'Save Changes' : 'Register Brand'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplying Vendors Drawer / Modal */}
      {viewingVendorsForBrand && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-base">Vendors Supplying "{viewingVendorsForBrand}"</h3>
                  <p className="text-[11px] text-slate-400">
                    {vendorsForActiveBrand.length} certified vendor(s) supply this brand
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingVendorsForBrand(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1 text-xs">
              {vendorsForActiveBrand.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  No vendors currently linked to this brand.
                </div>
              ) : (
                vendorsForActiveBrand.map((v) => (
                  <div
                    key={v.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-400 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-700 text-[10px] bg-blue-50 px-2 py-0.5 rounded">
                            {v.id}
                          </span>
                          <span className="font-bold text-slate-900 text-sm">{v.companyName}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {v.contactPerson} • {v.city}, {v.state} • Mobile: {v.mobile}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold text-[10px]">
                        {v.status || 'ACTIVE'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                        All Brands Supplied by this vendor:
                      </span>
                      <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                        {(v.brandsSupplied || []).map((b, i) => (
                          <span
                            key={i}
                            className={`px-1.5 py-0.5 rounded border ${
                              b.toLowerCase().trim() === viewingVendorsForBrand.toLowerCase().trim()
                                ? 'bg-blue-600 text-white font-bold border-blue-600'
                                : 'bg-white text-slate-700 border-slate-200'
                            }`}
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs">
              {onSelectBrandFilter && (
                <button
                  onClick={() => {
                    onSelectBrandFilter(viewingVendorsForBrand);
                    setViewingVendorsForBrand(null);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold"
                >
                  Filter in Vendor Directory
                </button>
              )}
              <button
                onClick={() => setViewingVendorsForBrand(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl font-semibold hover:bg-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Brand Discount Modal */}
      <BulkBrandDiscountModal
        isOpen={isBulkDiscountModalOpen}
        onClose={() => setIsBulkDiscountModalOpen(false)}
        initialBrand={bulkDiscountBrand}
      />
    </div>
  );
};
