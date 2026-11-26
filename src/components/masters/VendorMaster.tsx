import React, { useState, useMemo, useEffect } from 'react';
import {
  Building,
  Plus,
  Search,
  Star,
  Phone,
  Mail,
  MapPin,
  FileText,
  Truck,
  CreditCard,
  CheckCircle,
  X,
  Download,
  Upload,
  FileSpreadsheet,
  Trash2,
  Edit,
  Tag,
  History,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Filter,
  Sparkles,
  Layers,
  LayoutList,
  Columns2,
  BookmarkCheck,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Archive,
  RefreshCw,
  Eye,
  Check,
  Package,
  Globe,
} from 'lucide-react';
import { useApp, isSuperAdminUser } from '../../context/AppContext';
import { Vendor, VendorImportJob } from '../../types';
import { VendorExportModal } from './VendorExportModal';
import { ImportDataModal } from './ImportDataModal';
import { downloadVendorMasterTemplate } from '../../services/bulkRequirementImportService';
import { VendorAiIntelligenceView } from '../vendors/VendorAiIntelligenceView';
import { AiCatalogAnalyzerModal } from '../vendors/AiCatalogAnalyzerModal';
import { VendorSearchAndMatchModal } from '../vendors/VendorSearchAndMatchModal';
import { BrandMaster } from './BrandMaster';
import { VendorProductMappingSection } from '../vendors/VendorProductMappingSection';
import { ProductsDealtInSection } from '../vendors/ProductsDealtInSection';
import { VendorOnboardingWizardModal } from './VendorOnboardingWizardModal';

export const VendorMaster: React.FC = () => {
  const {
    vendors,
    archivedVendors,
    addVendor,
    updateVendor,
    deleteVendor,
    restoreVendor,
    permanentlyDeleteVendor,
    purgeArchivedVendors,
    vendorQuotes,
    vendorPOs,
    dispatches,
    categories,
    brands,
    addBrand,
    requirements,
    rfqs,
    auditLogs,
    vendorProductMappings,
    products,
    addProduct,
    addProductsBulk,
    bulkAddVendorProductMappings,
    deleteVendorProductMapping,
    currentUser,
    purgeAllVendors,
    listVendorOnboardingJobs,
    pollVendorOnboardingJob,
  } = useApp();

  const isSuperAdmin = isSuperAdminUser(currentUser);

  // Search & Filters state
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [cityFilter, setCityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showArchived, setShowArchived] = useState<boolean>(false);

  // Pagination State
  const [pageSize, setPageSize] = useState<number | 'ALL'>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Layout View mode: Table (full directory) vs Split (cards + detail dossier)
  const [viewMode, setViewMode] = useState<'table' | 'split'>('table');

  const [selectedVendorId, setSelectedVendorId] = useState<string>(vendors[0]?.id || '');
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<
    'information' | 'brands' | 'categories' | 'products' | 'rfqs' | 'orders' | 'audit' | 'ai-analyzer'
  >('information');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addVendorMode, setAddVendorMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAiAnalyzerModalOpen, setIsAiAnalyzerModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isBrandMasterModalOpen, setIsBrandMasterModalOpen] = useState(false);

  // Form states for Add / Edit Vendor
  const [vendorFormError, setVendorFormError] = useState<string | null>(null);
  const [isSavingVendor, setIsSavingVendor] = useState(false);
  const [backgroundImportJob, setBackgroundImportJob] = useState<VendorImportJob | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [country, setCountry] = useState('India');
  const [website, setWebsite] = useState('');
  const [vendorType, setVendorType] = useState<
    'Manufacturer' | 'Distributor' | 'Authorised Dealer' | 'Stockist' | 'Service Provider' | 'Manufacturer & Distributor'
  >('Distributor');
  const [launchAnalyzerAfterSave, setLaunchAnalyzerAfterSave] = useState(false);
  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [alternateMobile, setAlternateMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('30 Days Net');
  const [creditPeriod, setCreditPeriod] = useState('30 Days');
  const [deliveryTerms, setDeliveryTerms] = useState('Door Delivery / Ex-Works');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  // Multi-brand selection state
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [brandSearchQuery, setBrandSearchQuery] = useState('');
  const [customBrandInput, setCustomBrandInput] = useState('');

  const [msmeStatus, setMsmeStatus] = useState<string>('Small');
  const [vendorStatus, setVendorStatus] = useState<'ACTIVE' | 'INACTIVE' | 'BLOCKED'>('ACTIVE');
  const [remarks, setRemarks] = useState('');
  const [bankAccount, setBankAccount] = useState('9210200889912');
  const [bankName, setBankName] = useState('HDFC Bank');
  const [bankIfsc, setBankIfsc] = useState('HDFC0000060');

  // Products & Brands Section Staging state inside Add / Edit Modal
  const [vendorProductsList, setVendorProductsList] = useState<Array<{
    id?: string;
    productName: string;
    category: string;
    subCategory?: string;
    brand: string;
    modelNumber?: string;
    partNumber?: string;
    specification?: string;
    description?: string;
    uom: string;
    status: 'ACTIVE' | 'INACTIVE';
    supplyType?: any;
    availability?: any;
    isNewGlobalProduct?: boolean;
  }>>([]);

  // Staging Product Form fields (Workflow steps 5 to 10)
  const [stgCategory, setStgCategory] = useState<string>('Bearings');
  const [stgSubCategory, setStgSubCategory] = useState<string>('');
  const [stgBrand, setStgBrand] = useState<string>('SKF');
  const [stgProductSource, setStgProductSource] = useState<'EXISTING' | 'NEW'>('EXISTING');
  const [stgSelectedProductId, setStgSelectedProductId] = useState<string>('');
  const [stgProductName, setStgProductName] = useState<string>('');
  const [stgModelNumber, setStgModelNumber] = useState<string>('');
  const [stgPartNumber, setStgPartNumber] = useState<string>('');
  const [stgSpecification, setStgSpecification] = useState<string>('');
  const [stgDescription, setStgDescription] = useState<string>('');
  const [stgUom, setStgUom] = useState<string>('NOS');
  const [stgProductSearch, setStgProductSearch] = useState<string>('');
  const [stgShowAddBrandInline, setStgShowAddBrandInline] = useState<boolean>(false);
  const [stgNewBrandName, setStgNewBrandName] = useState<string>('');
  const [productAddError, setProductAddError] = useState<string>('');

  // Track any active/ready background Vendor Catalogue Import Job when modal is closed
  useEffect(() => {
    let active = true;
    const checkJobs = async () => {
      const savedId = typeof window !== 'undefined' ? localStorage.getItem('mro_active_vendor_import_job') : null;
      if (savedId) {
        const job = await pollVendorOnboardingJob(savedId);
        if (!active) return;
        if (job && ['UPLOADING', 'PROCESSING', 'VALIDATING', 'READY_FOR_REVIEW', 'COMMITTING'].includes(job.status)) {
          setBackgroundImportJob(job);
          return;
        }
      }
      const all = await listVendorOnboardingJobs();
      if (!active) return;
      const live = all.find((j) => ['UPLOADING', 'PROCESSING', 'VALIDATING', 'READY_FOR_REVIEW', 'COMMITTING'].includes(j.status));
      setBackgroundImportJob(live || null);
    };
    void checkJobs();
    const timer = setInterval(() => {
      if (!isAddModalOpen) void checkJobs();
    }, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [isAddModalOpen]);

  // Compute unique cities
  const allCities = Array.from(new Set(vendors.map((v) => v.city).filter(Boolean))).sort();

  // Compute all unique brands across Brand Master and existing vendors
  const allKnownBrands = Array.from(
    new Set([
      ...brands.map((b) => b.name),
      ...vendors.flatMap((v) => v.brandsSupplied || []),
    ])
  ).sort();

  const allVendors = useMemo(() => {
    const map = new Map<string, Vendor>();
    vendors.forEach((v) => map.set(v.id, v));
    archivedVendors.forEach((v) => {
      if (!map.has(v.id)) map.set(v.id, v);
    });
    return Array.from(map.values());
  }, [vendors, archivedVendors]);

  // Total counts for active vs archived tabs
  const totalActiveVendors = allVendors.filter((v) => !v.isDeleted).length;
  const totalArchivedVendors = allVendors.filter((v) => !!v.isDeleted).length;

  // Filter vendors based on all criteria (Requirement 6: Product, Brand, Category, Model/Part# search)
  const filteredVendors = allVendors.filter((v) => {
    // Respect active vs soft-deleted filter (Permanent database persistence)
    if (showArchived ? !v.isDeleted : v.isDeleted) return false;

    const vCats =
      v.materialCategories && v.materialCategories.length > 0
        ? v.materialCategories
        : v.productCategories || [];
    const vBrands = v.brandsSupplied || [];
    const vMappings = vendorProductMappings.filter(
      (m) => m.vendorId === v.id && m.status !== 'INACTIVE'
    );

    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (v.companyName || '').toLowerCase().includes(q) ||
      (v.contactPerson || '').toLowerCase().includes(q) ||
      (v.city || '').toLowerCase().includes(q) ||
      (v.mobile || '').includes(q) ||
      (v.email && v.email.toLowerCase().includes(q)) ||
      (v.gstin && v.gstin.toLowerCase().includes(q)) ||
      vBrands.some((b) => (b || '').toLowerCase().includes(q)) ||
      vCats.some((c) => (c || '').toLowerCase().includes(q)) ||
      vMappings.some(
        (m) =>
          (m.productName || '').toLowerCase().includes(q) ||
          (m.brand && m.brand.toLowerCase().includes(q)) ||
          (m.category && m.category.toLowerCase().includes(q)) ||
          (m.subCategory && m.subCategory.toLowerCase().includes(q)) ||
          (m.modelNumber && m.modelNumber.toLowerCase().includes(q)) ||
          (m.partNumber && m.partNumber.toLowerCase().includes(q)) ||
          (m.specification && m.specification.toLowerCase().includes(q)) ||
          (m.description && m.description.toLowerCase().includes(q))
      );

    const matchesBrand =
      brandFilter === 'ALL' ||
      vBrands.some((b) => (b || '').toLowerCase().trim() === brandFilter.toLowerCase().trim()) ||
      vMappings.some((m) => (m.brand || '').toLowerCase().trim() === brandFilter.toLowerCase().trim());

    const matchesCategory =
      categoryFilter === 'ALL' ||
      vCats.some((c) => (c || '').toLowerCase().trim() === categoryFilter.toLowerCase().trim()) ||
      vMappings.some((m) => (m.category || '').toLowerCase().trim() === categoryFilter.toLowerCase().trim());

    const matchesCity =
      cityFilter === 'ALL' || (v.city || '').toLowerCase().trim() === cityFilter.toLowerCase().trim();

    const matchesStatus =
      statusFilter === 'ALL' || (v.status || 'ACTIVE') === statusFilter;

    return matchesSearch && matchesBrand && matchesCategory && matchesCity && matchesStatus;
  });

  // Pagination calculation
  const totalFiltered = filteredVendors.length;
  const totalPages = pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(totalFiltered / (pageSize as number)));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedVendors = pageSize === 'ALL'
    ? filteredVendors
    : filteredVendors.slice((safeCurrentPage - 1) * (pageSize as number), safeCurrentPage * (pageSize as number));

  const startRecord = totalFiltered === 0 ? 0 : (pageSize === 'ALL' ? 1 : (safeCurrentPage - 1) * (pageSize as number) + 1);
  const endRecord = pageSize === 'ALL' ? totalFiltered : Math.min(safeCurrentPage * (pageSize as number), totalFiltered);

  const activeVendor =
    vendors.find((v) => v.id === selectedVendorId) || filteredVendors[0] || vendors[0];

  const vendorQuotesList = vendorQuotes.filter((q) => q.vendorId === activeVendor?.id);
  const vendorOrdersList = vendorPOs.filter((o) => o.vendorId === activeVendor?.id);
  const vendorDispatchesList = dispatches.filter((d) => d.vendorId === activeVendor?.id);

  const hasActiveFilters =
    search !== '' ||
    brandFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    cityFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    showArchived;

  const handleResetFilters = () => {
    setSearch('');
    setBrandFilter('ALL');
    setCategoryFilter('ALL');
    setCityFilter('ALL');
    setStatusFilter('ALL');
    setShowArchived(false);
    setCurrentPage(1);
  };

  const handleOpenAdd = () => {
    setVendorFormError(null);
    setEditingVendor(null);
    setCompanyName('');
    setLegalName('');
    setCountry('India');
    setWebsite('');
    setVendorType('Distributor');
    setLaunchAnalyzerAfterSave(false);
    setContactPerson('');
    setMobile('');
    setAlternateMobile('');
    setEmail('');
    setAddress('');
    setCity('');
    setState('');
    setPincode('');
    setGstin('');
    setPan('');
    setPaymentTerms('30 Days Net');
    setCreditPeriod('30 Days');
    setDeliveryTerms('Door Delivery / Ex-Works');
    setSelectedCategories([]);
    setCategorySearchQuery('');
    setSelectedBrands([]);
    setBrandSearchQuery('');
    setCustomBrandInput('');
    setMsmeStatus('Small');
    setVendorStatus('ACTIVE');
    setRemarks('');
    setBankAccount('9210200889912');
    setBankName('HDFC Bank');
    setBankIfsc('HDFC0000060');

    // Reset Products & Brands Section
    setVendorProductsList([]);
    const defaultCat = categories[0]?.name || 'Bearings';
    setStgCategory(defaultCat);
    const catObj = categories.find((c) => c.name === defaultCat);
    setStgSubCategory(catObj?.subCategories?.[0] || '');
    setStgBrand(brands[0]?.name || 'SKF');
    setStgProductSource('EXISTING');
    setStgSelectedProductId('');
    setStgProductName('');
    setStgModelNumber('');
    setStgPartNumber('');
    setStgSpecification('');
    setStgDescription('');
    setStgUom('NOS');
    setStgProductSearch('');
    setStgShowAddBrandInline(false);
    setStgNewBrandName('');
    setProductAddError('');
    setAddVendorMode('AUTO');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (v: Vendor) => {
    setVendorFormError(null);
    setSelectedVendorId(v.id);
    setEditingVendor(v);
    setCompanyName(v.companyName || '');
    setLegalName(v.legalName || '');
    setCountry(v.country || 'India');
    setWebsite(v.website || '');
    setVendorType((v.vendorType as any) || 'Distributor');
    setLaunchAnalyzerAfterSave(false);
    setContactPerson(v.contactPerson || '');
    setMobile(v.mobile || '');
    setAlternateMobile(v.alternateMobile || '');
    setEmail(v.email || '');
    setAddress(v.address || '');
    setCity(v.city || '');
    setState(v.state || '');
    setPincode(v.pincode || '');
    setGstin(v.gstin);
    setPan(v.pan);
    setPaymentTerms(v.paymentTerms);
    setCreditPeriod(v.creditPeriod || '30 Days');
    setDeliveryTerms(v.deliveryTerms);
    setSelectedCategories(
      v.materialCategories && v.materialCategories.length > 0
        ? v.materialCategories
        : v.productCategories || []
    );
    setCategorySearchQuery('');
    setSelectedBrands(v.brandsSupplied && v.brandsSupplied.length > 0 ? [...v.brandsSupplied] : []);
    setBrandSearchQuery('');
    setCustomBrandInput('');
    setMsmeStatus(v.msmeStatus || 'Small');
    setVendorStatus(v.status || 'ACTIVE');
    setRemarks(v.remarks || '');
    setBankAccount(v.bankDetails?.accountNumber || '');
    setBankName(v.bankDetails?.bankName || 'HDFC Bank');
    setBankIfsc(v.bankDetails?.ifscCode || '');

    // Populate existing product associations for this vendor
    const existingMappings = vendorProductMappings
      .filter((m) => m.vendorId === v.id && m.status !== 'INACTIVE')
      .map((m) => ({
        id: m.id,
        productName: m.productName,
        category: m.category,
        subCategory: m.subCategory,
        brand: m.brand,
        modelNumber: m.modelNumber,
        partNumber: m.partNumber,
        specification: m.specification,
        description: m.description,
        uom: m.uom || 'NOS',
        status: m.status || 'ACTIVE',
        supplyType: m.supplyType || 'Authorized Distributor',
        availability: m.availability || 'Regular Stock',
        isNewGlobalProduct: false,
      }));
    setVendorProductsList(existingMappings);

    const defaultCat = (v.materialCategories && v.materialCategories[0]) || categories[0]?.name || 'Bearings';
    setStgCategory(defaultCat);
    const catObj = categories.find((c) => c.name === defaultCat);
    setStgSubCategory(catObj?.subCategories?.[0] || '');
    setStgBrand((v.brandsSupplied && v.brandsSupplied[0]) || brands[0]?.name || 'SKF');
    setStgProductSource('EXISTING');
    setStgSelectedProductId('');
    setStgProductName('');
    setStgModelNumber('');
    setStgPartNumber('');
    setStgSpecification('');
    setStgDescription('');
    setStgUom('NOS');
    setStgProductSearch('');
    setStgShowAddBrandInline(false);
    setStgNewBrandName('');
    setProductAddError('');
    setIsEditModalOpen(true);
  };

  // Toggle Category selection
  const handleToggleCategorySelection = (catName: string) => {
    if (selectedCategories.includes(catName)) {
      if (selectedCategories.length > 1) {
        setSelectedCategories(selectedCategories.filter((c) => c !== catName));
      }
    } else {
      setSelectedCategories([...selectedCategories, catName]);
    }
  };

  // Brand selection helpers
  const handleToggleBrandSelection = (brandName: string) => {
    const clean = brandName.trim();
    if (!clean) return;

    const exists = selectedBrands.some(
      (b) => b.toLowerCase().trim() === clean.toLowerCase().trim()
    );

    if (exists) {
      if (selectedBrands.length > 1) {
        setSelectedBrands(
          selectedBrands.filter((b) => b.toLowerCase().trim() !== clean.toLowerCase().trim())
        );
      }
    } else {
      setSelectedBrands([...selectedBrands, clean]);
    }
  };

  const handleRemoveBrand = (brandName: string) => {
    if (selectedBrands.length > 1) {
      setSelectedBrands(
        selectedBrands.filter((b) => b.toLowerCase().trim() !== brandName.toLowerCase().trim())
      );
    }
  };

  const handleAddNewCustomBrand = (brandName: string) => {
    const clean = brandName.trim();
    if (!clean) return;

    // Check if already selected
    const alreadySelected = selectedBrands.some(
      (b) => b.toLowerCase().trim() === clean.toLowerCase().trim()
    );
    if (!alreadySelected) {
      setSelectedBrands([...selectedBrands, clean]);
    }

    // Also register in Brand Master if not yet there
    const inBrandMaster = brands.some(
      (b) => b.name.toLowerCase().trim() === clean.toLowerCase().trim()
    );
    if (!inBrandMaster) {
      addBrand({
        name: clean,
        code: clean.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'BRD',
        category: selectedCategories[0] || 'General MRO',
        categories: selectedCategories.length > 0 ? selectedCategories : ['General MRO'],
        description: `Directly registered during vendor setup (${clean})`,
        isActive: true,
      });
    }

    setCustomBrandInput('');
    setBrandSearchQuery('');
  };

  // Selecting an existing product from Product Master
  const handleSelectExistingProduct = (prodId: string) => {
    setStgSelectedProductId(prodId);
    if (!prodId) return;
    const p = products.find((it) => it.id === prodId);
    if (!p) return;
    setStgProductName(p.itemName);
    if (p.category) setStgCategory(p.category);
    if (p.subCategory) setStgSubCategory(p.subCategory);
    if (p.brand) setStgBrand(p.brand);
    setStgModelNumber(p.modelNumber || '');
    setStgPartNumber(p.partNumber || '');
    setStgSpecification(p.specification || '');
    setStgDescription(p.description || '');
    setStgUom(p.uom || 'NOS');
  };

  // Workflow Step 10: Add Product to Staged List
  const handleAddProductToVendor = () => {
    setProductAddError('');
    const prodName = stgProductName.trim();
    const brandName = stgBrand.trim();
    const catName = stgCategory.trim();

    if (!prodName) {
      setProductAddError('Please enter or select a Product Name.');
      return;
    }
    if (!catName) {
      setProductAddError('Please select a Material Category.');
      return;
    }
    if (!brandName) {
      setProductAddError('Please select or specify a Brand.');
      return;
    }

    // Check if already added to this vendor's staged product list
    const alreadyInList = vendorProductsList.some(
      (p) =>
        p.productName.toLowerCase().trim() === prodName.toLowerCase().trim() &&
        p.brand.toLowerCase().trim() === brandName.toLowerCase().trim() &&
        (p.partNumber || '').toLowerCase().trim() === (stgPartNumber || '').toLowerCase().trim()
    );

    if (alreadyInList) {
      setProductAddError(`"${prodName}" (${brandName}) is already added to this vendor's product list.`);
      return;
    }

    // Ensure brand is present in selectedBrands
    if (!selectedBrands.some((b) => b.toLowerCase().trim() === brandName.toLowerCase().trim())) {
      setSelectedBrands((prev) => [...prev, brandName]);
    }

    // Ensure category is present in selectedCategories
    if (!selectedCategories.some((c) => c.toLowerCase().trim() === catName.toLowerCase().trim())) {
      setSelectedCategories((prev) => [...prev, catName]);
    }

    // Register brand in Brand Master if not known
    const brandKnown = brands.some(
      (b) => b.name.toLowerCase().trim() === brandName.toLowerCase().trim()
    );
    if (!brandKnown) {
      addBrand({
        name: brandName,
        code: brandName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'BRD',
        category: catName,
        categories: [catName],
        description: `Registered during product mapping for ${brandName}`,
        isActive: true,
      });
    }

    const isNew = stgProductSource === 'NEW';

    const newEntry = {
      id: `VPM-TMP-${Date.now()}-${vendorProductsList.length + 1}`,
      productName: prodName,
      category: catName,
      subCategory: stgSubCategory.trim(),
      brand: brandName,
      modelNumber: stgModelNumber.trim(),
      partNumber: stgPartNumber.trim(),
      specification: stgSpecification.trim(),
      description: stgDescription.trim(),
      uom: stgUom.trim() || 'NOS',
      status: 'ACTIVE' as const,
      supplyType: 'Authorized Distributor',
      availability: 'Regular Stock',
      isNewGlobalProduct: isNew,
    };

    setVendorProductsList((prev) => [...prev, newEntry]);

    // Reset fields for the next product
    setStgSelectedProductId('');
    setStgProductName('');
    setStgModelNumber('');
    setStgPartNumber('');
    setStgSpecification('');
    setStgDescription('');
    setProductAddError('');
  };

  // Remove product association from vendor without deleting global product
  const handleRemoveProductAssociation = (idx: number) => {
    setVendorProductsList((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setVendorFormError(null);

    const normName = companyName.trim().toLowerCase();
    const normGst = gstin.trim().toLowerCase();

    const duplicate = vendors.find(
      (v) =>
        (normName && v.companyName?.trim().toLowerCase() === normName) ||
        (normGst && v.gstin && v.gstin.trim().toLowerCase() === normGst)
    );

    if (duplicate) {
      setVendorFormError(
        `A vendor with ${duplicate.companyName?.trim().toLowerCase() === normName ? `company name "${duplicate.companyName}"` : `GSTIN "${duplicate.gstin}"`} is already registered (${duplicate.id}). Duplicate vendor addition is blocked.`
      );
      return;
    }

    // Include all brands and categories from associated products and typed search input
    const typedBrand = brandSearchQuery.trim();
    const effectiveBrands = typedBrand && !selectedBrands.some(b => b.toLowerCase().trim() === typedBrand.toLowerCase())
      ? [...selectedBrands, typedBrand]
      : selectedBrands;

    const allBrands = Array.from(
      new Set([...effectiveBrands, ...vendorProductsList.map((p) => p.brand).filter(Boolean)])
    );
    const allCats = Array.from(
      new Set([...selectedCategories, ...vendorProductsList.map((p) => p.category).filter(Boolean)])
    );

    setIsSavingVendor(true);
    try {
      const created = await addVendor({
        companyName: companyName.trim(),
        legalName: legalName.trim() || undefined,
        country: country.trim() || 'India',
        website: website.trim() || undefined,
        vendorType,
        contactPerson,
        mobile,
        alternateMobile,
        email,
        address,
        city,
        state,
        pincode,
        gstin: gstin.trim().toUpperCase(),
        pan: pan.trim().toUpperCase(),
        bankDetails: {
          accountName: companyName.trim(),
          accountNumber: bankAccount || '9210200889912',
          bankName: bankName || 'HDFC Bank',
          ifscCode: bankIfsc || 'HDFC0000060',
          branch: city,
        },
        paymentTerms,
        creditPeriod,
        deliveryTerms,
        productCategories: allCats,
        materialCategories: allCats,
        brandsSupplied: allBrands,
        msmeStatus,
        status: vendorStatus,
        remarks,
        rating: 4.8,
      });

      // Save newly created global products to Product Master in one atomic batch
      const newGlobalProductsToAdd: Array<Omit<any, 'id'>> = [];
      for (const p of vendorProductsList) {
        if (p.isNewGlobalProduct) {
          const exists = products.some(
            (prod) =>
              prod.itemName.toLowerCase().trim() === p.productName.toLowerCase().trim() &&
              prod.brand.toLowerCase().trim() === p.brand.toLowerCase().trim() &&
              (!p.partNumber || (prod.partNumber || '').toLowerCase().trim() === p.partNumber.toLowerCase().trim())
          );
          if (!exists) {
            newGlobalProductsToAdd.push({
              itemName: p.productName,
              category: p.category,
              subCategory: p.subCategory,
              brand: p.brand,
              modelNumber: p.modelNumber || '',
              partNumber: p.partNumber || '',
              specification: p.specification || '',
              uom: p.uom || 'NOS',
              description: p.description || p.specification || '',
              status: 'ACTIVE',
            });
          }
        }
      }
      if (newGlobalProductsToAdd.length > 0) {
        addProductsBulk(newGlobalProductsToAdd);
      }

      // Persist vendor-product associations to backend using verified server vendor ID
      if (vendorProductsList.length > 0) {
        await bulkAddVendorProductMappings(created.id, vendorProductsList, created);
      }

      setSelectedVendorId(created.id);
      setIsAddModalOpen(false);
      if (launchAnalyzerAfterSave) {
        setLaunchAnalyzerAfterSave(false);
        setViewMode('split');
        setActiveDetailTab('ai-analyzer');
        setIsAiAnalyzerModalOpen(true);
      }
    } catch (err: any) {
      setVendorFormError(err?.message || 'Database rejected vendor registration. Please verify fields and retry.');
    } finally {
      setIsSavingVendor(false);
    }
  };

  const handleUpdateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetVendor = editingVendor || activeVendor;
    if (!targetVendor) return;
    setVendorFormError(null);

    const normName = companyName.trim().toLowerCase();
    const normGst = gstin.trim().toLowerCase();

    const duplicate = vendors.find(
      (v) =>
        v.id !== targetVendor.id &&
        ((normName && v.companyName?.trim().toLowerCase() === normName) ||
         (normGst && v.gstin && v.gstin.trim().toLowerCase() === normGst))
    );

    if (duplicate) {
      setVendorFormError(
        `Another vendor with ${duplicate.companyName?.trim().toLowerCase() === normName ? `company name "${duplicate.companyName}"` : `GSTIN "${duplicate.gstin}"`} already exists (${duplicate.id}). Please use a unique company name.`
      );
      return;
    }

    const typedBrand = brandSearchQuery.trim();
    const effectiveBrands = typedBrand && !selectedBrands.some(b => b.toLowerCase().trim() === typedBrand.toLowerCase())
      ? [...selectedBrands, typedBrand]
      : selectedBrands;

    const allBrands = Array.from(
      new Set([...effectiveBrands, ...vendorProductsList.map((p) => p.brand).filter(Boolean)])
    );
    const allCats = Array.from(
      new Set([...selectedCategories, ...vendorProductsList.map((p) => p.category).filter(Boolean)])
    );

    setIsSavingVendor(true);
    try {
      const savedUpdated = await updateVendor({
        ...targetVendor,
        companyName: companyName.trim(),
        legalName: legalName.trim() || undefined,
        country: country.trim() || 'India',
        website: website.trim() || undefined,
        vendorType,
        contactPerson,
        mobile,
        alternateMobile,
        email,
        address,
        city,
        state,
        pincode,
        gstin: gstin.trim().toUpperCase(),
        pan: pan.trim().toUpperCase(),
        bankDetails: {
          accountName: companyName.trim(),
          accountNumber: bankAccount || targetVendor.bankDetails?.accountNumber || '',
          bankName: bankName || targetVendor.bankDetails?.bankName || '',
          ifscCode: bankIfsc || targetVendor.bankDetails?.ifscCode || '',
          branch: city,
        },
        paymentTerms,
        creditPeriod,
        deliveryTerms,
        productCategories: allCats,
        materialCategories: allCats,
        brandsSupplied: allBrands,
        msmeStatus,
        status: vendorStatus,
        remarks,
      });

      // Save newly created global products to Product Master in one atomic batch
      const newGlobalProductsForUpdate: Array<Omit<any, 'id'>> = [];
      for (const p of vendorProductsList) {
        if (p.isNewGlobalProduct) {
          const exists = products.some(
            (prod) =>
              prod.itemName.toLowerCase().trim() === p.productName.toLowerCase().trim() &&
              prod.brand.toLowerCase().trim() === p.brand.toLowerCase().trim() &&
              (!p.partNumber || (prod.partNumber || '').toLowerCase().trim() === p.partNumber.toLowerCase().trim())
          );
          if (!exists) {
            newGlobalProductsForUpdate.push({
              itemName: p.productName,
              category: p.category,
              subCategory: p.subCategory,
              brand: p.brand,
              modelNumber: p.modelNumber || '',
              partNumber: p.partNumber || '',
              specification: p.specification || '',
              uom: p.uom || 'NOS',
              description: p.description || p.specification || '',
              status: 'ACTIVE',
            });
          }
        }
      }
      if (newGlobalProductsForUpdate.length > 0) {
        addProductsBulk(newGlobalProductsForUpdate);
      }

      // Find previous active mappings for this vendor
      const previousMappings = vendorProductMappings.filter(
        (m) => m.vendorId === savedUpdated.id && m.status !== 'INACTIVE'
      );
      const currentIds = new Set(vendorProductsList.map((p) => p.id).filter(Boolean));

      // Deactivate removed mappings without deleting global products
      for (const prev of previousMappings) {
        if (!currentIds.has(prev.id)) {
          await deleteVendorProductMapping(prev.id);
        }
      }

      // Persist new / retained mappings
      if (vendorProductsList.length > 0) {
        await bulkAddVendorProductMappings(savedUpdated.id, vendorProductsList, savedUpdated);
      }

      setSelectedVendorId(savedUpdated.id);
      setEditingVendor(null);
      setIsEditModalOpen(false);
    } catch (err: any) {
      setVendorFormError(err?.message || 'Database rejected vendor update. Please verify fields and retry.');
    } finally {
      setIsSavingVendor(false);
    }
  };

  const handleDeleteVendor = (id: string) => {
    const v = allVendors.find((item) => item.id === id);
    if (confirm(`Move vendor "${v?.companyName || id}" to Archived Registry? You can restore this record at any time without data loss.`)) {
      deleteVendor(id, 'Archived by user from Vendor Master');
    }
  };

  const handleRestoreVendor = async (id: string) => {
    const ok = await restoreVendor(id);
    if (ok) {
      setSelectedVendorId(id);
      setShowArchived(false);
    }
  };

  const handlePermanentlyDeleteVendor = async (id: string) => {
    if (isSuperAdmin) {
      // Direct deletion without blocking dialogs
      await permanentlyDeleteVendor(id);
      return;
    }
    const v = allVendors.find((item) => item.id === id);
    if (confirm(`CRITICAL WARNING: Permanently delete vendor "${v?.companyName || id}" from the live ERP database? This supplier will be completely deleted and cannot be restored.`)) {
      await permanentlyDeleteVendor(id);
    }
  };

  const handleEmptyRecycleBin = async () => {
    if (isSuperAdmin) {
      await purgeArchivedVendors();
      setShowArchived(false);
      return;
    }
    if (confirm(`Empty Recycle Bin? All ${totalArchivedVendors} archived suppliers will be permanently deleted from the database. This action cannot be reversed.`)) {
      await purgeArchivedVendors();
      setShowArchived(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Vendor & OEM Partner Master</h2>
            <span className="hidden sm:inline-block px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 rounded-full border border-blue-200">
              Multiple Brands Supported
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Certified industrial supplier directory with multi-brand mapping (SKF, FAG, Timken, Bosch, Festo, Siemens, etc.) and complete data export.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Brand Master Button */}
          <button
            onClick={() => setIsBrandMasterModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-2xs"
            title="Manage OEM Brands, add new brands or view supplier coverage"
          >
            <BookmarkCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>OEM Brand Master ({brands.length})</span>
          </button>

          {/* Download Template */}
          <button
            onClick={downloadVendorMasterTemplate}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-2xs"
            title="Download Excel template with product columns, part numbers, rates, and brand auto-enrichment"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel Template (with Products)</span>
          </button>

          {/* Import Vendors */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Import Vendors</span>
          </button>

          {/* Export Vendors Button (Prominent & Clearly Visible) */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all shadow-blue-500/20"
            title="Export filtered or complete vendor list to Excel (.xlsx), CSV, or PDF"
          >
            <Download className="w-4 h-4 text-white" />
            <span>Export Vendors</span>
          </button>

          {/* Analyze Vendor Catalog with AI */}
          <button
            onClick={() => setIsAiAnalyzerModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
            title="Upload and analyze vendor catalog with AI"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>+ Analyze Catalog</span>
          </button>

          {/* Add New Vendor */}
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Vendor</span>
          </button>
        </div>
      </div>

      {/* Background Catalogue Import Job Banner (persists when user leaves wizard) */}
      {backgroundImportJob && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              {backgroundImportJob.status === 'READY_FOR_REVIEW' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <RefreshCw className="w-4 h-4 animate-spin" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-indigo-950 truncate">
                {backgroundImportJob.status === 'READY_FOR_REVIEW'
                  ? `Catalogue Ready for Review: ${backgroundImportJob.fileName}`
                  : `Importing Vendor Catalogue: ${backgroundImportJob.fileName}`}
              </div>
              <div className="text-[11px] text-indigo-700">
                {backgroundImportJob.currentStage} • {backgroundImportJob.progressPercent}% • Products detected: {backgroundImportJob.productsDetected}
                {backgroundImportJob.totalPages > 0 ? ` • Pages: ${backgroundImportJob.pagesProcessed}/${backgroundImportJob.totalPages}` : ''}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setAddVendorMode('AUTO');
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shrink-0 transition-colors"
          >
            {backgroundImportJob.status === 'READY_FOR_REVIEW' ? 'Review & Commit Vendor' : 'View Live Import Progress'}
          </button>
        </div>
      )}

      {/* Comprehensive Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by vendor name, contact person, mobile, GSTIN, brands (e.g. SKF), or city..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* View Mode Toggle: Table View vs Split View */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>AI Multi-Facet Match</span>
            </button>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Full Table View with all columns"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>Table View</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                  viewMode === 'split'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Split Dossier View"
              >
                <Columns2 className="w-3.5 h-3.5" />
                <span>Split View</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Dropdowns Row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
          {/* Brand Filter */}
          <div className="flex items-center gap-1.5">
            <BookmarkCheck className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-slate-500 font-medium">Brand:</span>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 max-w-[170px] truncate"
            >
              <option value="ALL">All Brands ({allKnownBrands.length})</option>
              {allKnownBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Material Category Filter */}
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-slate-500 font-medium">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 max-w-[170px] truncate"
            >
              <option value="ALL">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* City Filter */}
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-slate-500 font-medium">City:</span>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 max-w-[140px] truncate"
            >
              <option value="ALL">All Cities ({allCities.length})</option>
              {allCities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="BLOCKED">BLOCKED</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs transition-colors"
            >
              <RotateCcw className="w-3 h-3 text-slate-500" />
              <span>Reset Filters</span>
            </button>
          )}

          {/* Showing Counter Badge & Active/Archived Tabs */}
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setShowArchived(false);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                  !showArchived
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Active Suppliers ({totalActiveVendors})
              </button>
              {totalArchivedVendors > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowArchived(true);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${
                    showArchived
                      ? 'bg-amber-100 text-amber-900 shadow-2xs'
                      : 'text-amber-700 hover:text-amber-900'
                  }`}
                  title="View soft-deleted suppliers that can be restored with 1 click"
                >
                  <Archive className="w-3 h-3 text-amber-600" />
                  <span>Archived ({totalArchivedVendors})</span>
                </button>
              )}
            </div>

            <div className="text-slate-500 font-medium text-[11px] whitespace-nowrap">
              Showing <strong>{startRecord}-{endRecord}</strong> of <strong>{totalFiltered}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Main Vendor Content */}
      {viewMode === 'table' ? (
        /* TABLE VIEW (Full Detailed Table with Sticky Frozen Columns, Dual Pagination, and Permanent Delete) */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col">
          {/* Recycle Bin Banner if viewing archived */}
          {showArchived && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-900 flex items-center justify-center shrink-0">
                  <Archive className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <span className="font-bold text-amber-950 block text-xs">
                    Recycle Bin / Archived Suppliers ({totalArchivedVendors} records)
                  </span>
                  <span className="text-[11px] text-amber-800">
                    These suppliers are soft-deleted and hidden from active procurement. You can restore them or delete them permanently.
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setShowArchived(false)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg font-bold text-xs transition-colors"
                >
                  Back to Active
                </button>
                <button
                  type="button"
                  onClick={handleEmptyRecycleBin}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs transition-colors shadow-xs"
                  title="Purge all archived suppliers permanently from database"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Empty Recycle Bin</span>
                </button>
              </div>
            </div>
          )}

          {/* Top Quick Pagination Bar (No need to scroll down to navigate pages or change rows per page) */}
          <div className="bg-slate-50/90 px-4 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <span>
                Showing <strong className="text-slate-900">{startRecord}-{endRecord}</strong> of{' '}
                <strong className="text-slate-900">{totalFiltered}</strong>{' '}
                {showArchived ? 'archived suppliers' : 'suppliers'}
              </span>
              {pageSize !== 'ALL' && (
                <span className="hidden sm:inline text-slate-400">
                  • Page <strong>{safeCurrentPage}</strong> of <strong>{totalPages}</strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium text-[11px]">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                    setPageSize(val);
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-300 rounded px-2 py-0.5 font-bold text-xs text-slate-800"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value="ALL">All ({totalFiltered})</option>
                </select>
              </div>

              {pageSize !== 'ALL' && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={safeCurrentPage <= 1}
                    className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700"
                    title="First Page"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safeCurrentPage <= 1}
                    className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 text-xs font-bold text-slate-700">
                    {safeCurrentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage >= totalPages}
                    className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700"
                    title="Next Page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safeCurrentPage >= totalPages}
                    className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700"
                    title="Last Page"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Scrollable Container with sticky header & frozen first/last columns */}
          <div className="overflow-x-auto max-h-[520px] sm:max-h-[560px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
            <table className="w-full text-left text-xs border-collapse min-w-[1300px]">
              <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px] shadow-2xs">
                <tr>
                  <th className="py-3 px-3.5 sticky left-0 top-0 bg-slate-100 z-30 border-r border-slate-200 shadow-2xs w-[90px]">Vendor ID</th>
                  <th className="py-3 px-3.5 sticky left-[90px] top-0 bg-slate-100 z-30 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] min-w-[200px]">Vendor Name</th>
                  <th className="py-3 px-3.5">Contact Person</th>
                  <th className="py-3 px-3.5">Mobile Number</th>
                  <th className="py-3 px-3.5">Email</th>
                  <th className="py-3 px-3.5">City</th>
                  <th className="py-3 px-3.5">GSTIN</th>
                  <th className="py-3 px-3.5">Material Categories</th>
                  <th className="py-3 px-3.5">Brands Supplied</th>
                  <th className="py-3 px-3.5">Payment Terms</th>
                  <th className="py-3 px-3.5">Vendor Status</th>
                  <th className="py-3 px-3.5 text-right sticky right-0 top-0 bg-slate-100 z-30 border-l border-slate-200 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)] min-w-[140px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedVendors.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      <Building className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-sm text-slate-600">
                        {showArchived ? 'No archived suppliers found' : 'No matching suppliers found'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {showArchived
                          ? 'Deleted suppliers are safely stored here for recovery without data loss.'
                          : 'Try clearing or modifying the brand, category, city, or search filters.'}
                      </p>
                      {hasActiveFilters && (
                        <button
                          onClick={handleResetFilters}
                          className="mt-3 px-3.5 py-1.5 bg-blue-50 text-blue-700 font-bold rounded-lg border border-blue-200"
                        >
                          Clear All Filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedVendors.map((v) => {
                    const cats =
                      v.materialCategories && v.materialCategories.length > 0
                        ? v.materialCategories
                        : v.productCategories || [];
                    const brandsList = v.brandsSupplied || [];

                    return (
                      <tr
                        key={v.id}
                        className={`hover:bg-slate-50/70 transition-colors group cursor-pointer ${
                          v.isDeleted ? 'bg-amber-50/30' : ''
                        }`}
                        onClick={() => {
                          setSelectedVendorId(v.id);
                        }}
                      >
                        {/* Vendor ID (Sticky Left Column 1) */}
                        <td className="py-3 px-3.5 font-mono font-bold text-blue-700 whitespace-nowrap sticky left-0 bg-white group-hover:bg-slate-50 z-20 border-r border-slate-200 w-[90px]">
                          {v.id}
                        </td>

                        {/* Vendor Name (Sticky Left Column 2) */}
                        <td className="py-3 px-3.5 sticky left-[90px] bg-white group-hover:bg-slate-50 z-20 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] min-w-[200px]">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm whitespace-nowrap">{v.companyName}</span>
                            {typeof v.intelligenceScore === 'number' && v.intelligenceScore > 0 && (
                              <span
                                className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold font-mono shrink-0"
                                title="Automated Vendor Intelligence Score"
                              >
                                IQ {v.intelligenceScore}/100
                              </span>
                            )}
                            {v.isDeleted && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded border border-amber-300 shrink-0">
                                ARCHIVED
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {v.vendorType && (
                              <span className="text-[10px] text-slate-500 font-semibold">
                                {v.vendorType}
                              </span>
                            )}
                            {v.msmeStatus && (
                              <span className="text-[10px] text-slate-500 font-medium">
                                • MSME {v.msmeStatus}
                              </span>
                            )}
                            {v.website && (
                              <span className="text-[10px] text-blue-600 font-medium truncate max-w-[140px]">
                                • {v.website.replace(/^https?:\/\//i, '')}
                              </span>
                            )}
                            {(() => {
                              const vProds = vendorProductMappings.filter((m) => m.vendorId === v.id && m.status !== 'INACTIVE');
                              if (vProds.length === 0) return null;
                              const q = search.toLowerCase().trim();
                              const matchedProd = q ? vProds.find((m) =>
                                m.productName.toLowerCase().includes(q) ||
                                (m.brand && m.brand.toLowerCase().includes(q)) ||
                                (m.modelNumber && m.modelNumber.toLowerCase().includes(q)) ||
                                (m.partNumber && m.partNumber.toLowerCase().includes(q)) ||
                                (m.category && m.category.toLowerCase().includes(q)) ||
                                (m.subCategory && m.subCategory.toLowerCase().includes(q)) ||
                                (m.specification && m.specification.toLowerCase().includes(q))
                              ) : null;

                              return (
                                <div className="flex items-center gap-1">
                                  <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded text-[9px] font-bold border border-blue-200">
                                    {vProds.length} products
                                  </span>
                                  {matchedProd && (
                                    <span className="px-1.5 py-0.2 bg-amber-50 text-amber-800 rounded text-[9px] font-bold border border-amber-300">
                                      Match: {matchedProd.productName} ({matchedProd.brand} {matchedProd.modelNumber || matchedProd.partNumber || ''})
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </td>

                        {/* Contact Person */}
                        <td className="py-3 px-3.5 text-slate-800 font-medium whitespace-nowrap">
                          {v.contactPerson}
                        </td>

                        {/* Mobile Number */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <a
                            href={`tel:${v.mobile}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono text-blue-600 hover:underline font-bold"
                          >
                            {v.mobile}
                          </a>
                          {v.alternateMobile && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              Alt: {v.alternateMobile}
                            </div>
                          )}
                        </td>

                        {/* Email */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <a
                            href={`mailto:${v.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-slate-600 hover:text-blue-600 truncate block max-w-[150px]"
                            title={v.email}
                          >
                            {v.email}
                          </a>
                        </td>

                        {/* City */}
                        <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap">
                          {v.city}, {v.state}
                        </td>

                        {/* GSTIN */}
                        <td className="py-3 px-3.5 font-mono font-bold text-slate-700 text-[11px] whitespace-nowrap">
                          {v.gstin || '-'}
                        </td>

                        {/* Material Categories */}
                        <td className="py-3 px-3.5 max-w-xs">
                          <div className="flex flex-wrap gap-1">
                            {cats.slice(0, 2).map((c, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium truncate max-w-[120px]"
                              >
                                {c}
                              </span>
                            ))}
                            {cats.length > 2 && (
                              <span className="px-1.5 py-0.5 text-slate-500 bg-slate-100 rounded text-[10px] font-bold">
                                +{cats.length - 2}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Brands Supplied (Multi-brand badge chips) */}
                        <td className="py-3 px-3.5 max-w-sm">
                          <div className="flex flex-wrap gap-1">
                            {brandsList.slice(0, 3).map((b, i) => (
                              <span
                                key={i}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  brandFilter !== 'ALL' &&
                                  b.toLowerCase().trim() === brandFilter.toLowerCase().trim()
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-blue-50 text-blue-800 border-blue-200'
                                }`}
                              >
                                {b}
                              </span>
                            ))}
                            {brandsList.length > 3 && (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                                +{brandsList.length - 3} more
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Payment Terms */}
                        <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap">
                          {v.paymentTerms}
                        </td>

                        {/* Vendor Status */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              v.isDeleted
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : (v.status || 'ACTIVE') === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : (v.status || 'ACTIVE') === 'INACTIVE'
                                ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {v.isDeleted ? 'ARCHIVED' : (v.status || 'ACTIVE')}
                          </span>
                        </td>

                        {/* Actions (Sticky Right Column) */}
                        <td className="py-3 px-3.5 text-right whitespace-nowrap sticky right-0 bg-white group-hover:bg-slate-50 z-20 border-l border-slate-200 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.08)] min-w-[140px]">
                          <div
                            className="flex items-center justify-end gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {v.isDeleted ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleRestoreVendor(v.id)}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg transition-colors shadow-xs"
                                  title="Restore this supplier back to Active Registry"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Restore</span>
                                </button>
                                <button
                                  onClick={() => handlePermanentlyDeleteVendor(v.id)}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 border border-rose-300 font-bold text-[11px] rounded-lg transition-colors"
                                  title="Permanently remove from live database (Super Admin)"
                                >
                                  <Trash2 className="w-3 h-3 text-rose-600" />
                                  <span>Delete Permanently</span>
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedVendorId(v.id);
                                    setViewMode('split');
                                  }}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="View Vendor Dossier"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleOpenEdit(v)}
                                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                  title="Edit Vendor"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleDeleteVendor(v.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Archive Vendor (Safe Soft Delete)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Bottom Pagination Bar (Requirement 3: 50, 100, 200, All, Last Page button, Clear Total Count) */}
          <div className="bg-slate-50 p-3 sm:px-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            {/* Left: Total Vendor Count and Range */}
            <div className="flex items-center gap-2 text-slate-600 text-xs">
              <span>
                Showing <strong className="text-slate-900">{startRecord}</strong> to{' '}
                <strong className="text-slate-900">{endRecord}</strong> of{' '}
                <strong className="text-slate-900">{totalFiltered}</strong>{' '}
                {showArchived ? 'archived suppliers' : 'suppliers'}
              </span>
              <span className="hidden md:inline-block text-slate-400">•</span>
              <span className="hidden md:inline-block text-slate-500 font-medium">
                (Total in ERP Cloud DB: <strong>{vendors.length}</strong>)
              </span>
            </div>

            {/* Center: Page Size Selector (50, 100, 200, All) */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                  setPageSize(val);
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 font-bold text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value="ALL">All ({totalFiltered})</option>
              </select>
            </div>

            {/* Right: Pagination Controls with Last Page Button */}
            {pageSize !== 'ALL' && (
              <div className="flex items-center gap-1.5">
                {/* First Page Button */}
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition-colors"
                  title="First Page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>

                {/* Previous Page Button */}
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Current Page of Total */}
                <span className="px-2.5 py-1 font-semibold text-slate-700 text-xs">
                  Page <strong className="text-slate-900">{safeCurrentPage}</strong> of{' '}
                  <strong className="text-slate-900">{totalPages}</strong>
                </span>

                {/* Next Page Button */}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition-colors"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Last Page Button (Required by user!) */}
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safeCurrentPage >= totalPages}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-bold transition-colors shadow-2xs"
                  title="Jump to Last Page"
                >
                  <span>Last</span>
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* SPLIT DOSSIER VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Side: Vendor Directory Cards */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Suppliers ({filteredVendors.length})</span>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="text-blue-600 font-bold hover:underline"
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
              {filteredVendors.map((v) => {
                const isSelected = activeVendor?.id === v.id;
                const cats =
                  v.materialCategories && v.materialCategories.length > 0
                    ? v.materialCategories
                    : v.productCategories || [];
                const brandsList = v.brandsSupplied || [];

                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVendorId(v.id)}
                    className={`p-4 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/40 shadow-xs ring-1 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] font-bold text-blue-700">{v.id}</span>
                          {v.vendorType && (
                            <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 font-bold rounded text-[9px] border border-indigo-200">
                              {v.vendorType}
                            </span>
                          )}
                          {typeof v.intelligenceScore === 'number' && v.intelligenceScore > 0 && (
                            <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-800 font-bold rounded text-[9px] font-mono border border-emerald-200">
                              IQ {v.intelligenceScore}/100
                            </span>
                          )}
                          {v.msmeStatus && (
                            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 font-bold rounded text-[9px]">
                              MSME {v.msmeStatus}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm mt-0.5">{v.companyName}</h4>
                        <div className="text-[11px] text-slate-500">
                          {v.contactPerson} • {v.city}, {v.state}{v.country && v.country !== 'India' ? `, ${v.country}` : ''}
                        </div>
                        {(() => {
                          const vProds = vendorProductMappings.filter((m) => m.vendorId === v.id && m.status !== 'INACTIVE');
                          if (vProds.length === 0) return null;
                          const q = search.toLowerCase().trim();
                          const matchedProd = q ? vProds.find((m) =>
                            m.productName.toLowerCase().includes(q) ||
                            (m.brand && m.brand.toLowerCase().includes(q)) ||
                            (m.modelNumber && m.modelNumber.toLowerCase().includes(q)) ||
                            (m.partNumber && m.partNumber.toLowerCase().includes(q)) ||
                            (m.category && m.category.toLowerCase().includes(q)) ||
                            (m.subCategory && m.subCategory.toLowerCase().includes(q)) ||
                            (m.specification && m.specification.toLowerCase().includes(q))
                          ) : null;

                          return (
                            <div className="mt-1 flex items-center gap-1 flex-wrap">
                              <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded text-[9px] font-bold border border-blue-200">
                                {vProds.length} prods
                              </span>
                              {matchedProd && (
                                <span className="px-1.5 py-0.2 bg-amber-50 text-amber-800 rounded text-[9px] font-bold border border-amber-300">
                                  Match: {matchedProd.productName} ({matchedProd.brand})
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="flex items-center gap-1 font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{v.rating || 4.8}</span>
                      </div>
                    </div>

                    {/* Brands Badge Chips */}
                    {brandsList.length > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                        <span className="text-slate-400 font-bold text-[10px] uppercase">Brands:</span>
                        <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                          {brandsList.slice(0, 3).map((b, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.2 bg-blue-50 text-blue-800 rounded border border-blue-200"
                            >
                              {b}
                            </span>
                          ))}
                          {brandsList.length > 3 && (
                            <span className="text-slate-400 text-[10px]">
                              +{brandsList.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Multi-Categories Tags */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {cats.slice(0, 3).map((c, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700"
                        >
                          {c}
                        </span>
                      ))}
                      {cats.length > 3 && (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">
                          +{cats.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Side: Active Vendor Comprehensive Dossier */}
          {activeVendor && (
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {activeVendor.id}
                      </span>
                      <h3 className="font-bold text-lg text-slate-900">{activeVendor.companyName}</h3>
                      {activeVendor.vendorType && (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-bold">
                          {activeVendor.vendorType}
                        </span>
                      )}
                      {typeof activeVendor.intelligenceScore === 'number' && activeVendor.intelligenceScore > 0 && (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-[10px] font-bold font-mono">
                          IQ {activeVendor.intelligenceScore}/100
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>
                        Contact: <strong>{activeVendor.contactPerson}</strong> • {activeVendor.city}, {activeVendor.state}
                        {activeVendor.country ? `, ${activeVendor.country}` : ''}
                      </span>
                      {activeVendor.website && (
                        <a
                          href={activeVendor.website.startsWith('http') ? activeVendor.website : `https://${activeVendor.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
                        >
                          <Globe className="w-3 h-3" />
                          <span>{activeVendor.website.replace(/^https?:\/\//i, '')}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAiAnalyzerModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Catalogue</span>
                    </button>

                    <button
                      onClick={() => handleOpenEdit(activeVendor)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit Profile</span>
                    </button>

                    <button
                      onClick={() => handleDeleteVendor(activeVendor.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Delete Vendor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* "What This Vendor Deals In" Dossier Intelligence Summary Card */}
                <div className="p-3.5 bg-gradient-to-r from-slate-50 via-blue-50/40 to-indigo-50/50 border border-indigo-200/80 rounded-xl space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span className="font-bold text-slate-900">What This Vendor Deals In</span>
                      {activeVendor.intelligenceConfidence && (
                        <span className="px-2 py-0.5 rounded bg-white border border-indigo-200 text-indigo-700 text-[10px] font-bold">
                          {activeVendor.intelligenceConfidence} Confidence
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveDetailTab('ai-analyzer')}
                      className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1"
                    >
                      <span>Open Full AI Intelligence</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                        Brands Handled
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {(activeVendor.brandsDealing?.length ? activeVendor.brandsDealing : activeVendor.brandsSupplied || []).length === 0 ? (
                          <span className="text-slate-400 italic text-[11px]">Upload catalogue or analyse website to detect brands</span>
                        ) : (
                          (activeVendor.brandsDealing?.length ? activeVendor.brandsDealing : activeVendor.brandsSupplied || [])
                            .slice(0, 6)
                            .map((b, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-white border border-blue-200 text-blue-800 rounded text-[10px] font-bold"
                              >
                                {b}
                              </span>
                            ))
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                        Product Families & Categories
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {(activeVendor.productFamilies?.length ? activeVendor.productFamilies : activeVendor.materialCategories || activeVendor.productCategories || []).length === 0 ? (
                          <span className="text-slate-400 italic text-[11px]">No product families classified yet</span>
                        ) : (
                          (activeVendor.productFamilies?.length ? activeVendor.productFamilies : activeVendor.materialCategories || activeVendor.productCategories || [])
                            .slice(0, 5)
                            .map((f, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-white border border-indigo-200 text-indigo-800 rounded text-[10px] font-semibold"
                              >
                                {f}
                              </span>
                            ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary Cards (Requested: Total Brands, Total Categories, Total Products, Active Products) */}
                {(() => {
                  const mergedBrands = Array.from(
                    new Set([...(activeVendor.brandsSupplied || []), ...(activeVendor.brandsDealing || [])].filter(Boolean))
                  );
                  const mergedCats = Array.from(
                    new Set(
                      [
                        ...(activeVendor.materialCategories || []),
                        ...(activeVendor.productCategories || []),
                        ...(activeVendor.productFamilies || []),
                      ].filter(Boolean)
                    )
                  );
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pb-2">
                      <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                        <span className="text-[10px] font-bold text-blue-700 uppercase block">Total Brands Handled</span>
                        <span className="text-xl font-black text-blue-950 mt-0.5">{mergedBrands.length}</span>
                        <span className="text-[10px] text-blue-600 block truncate mt-0.5">
                          {mergedBrands.slice(0, 2).join(', ') || 'No brands registered'}
                        </span>
                      </div>

                      <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                        <span className="text-[10px] font-bold text-indigo-700 uppercase block">Total Categories Handled</span>
                        <span className="text-xl font-black text-indigo-950 mt-0.5">{mergedCats.length}</span>
                        <span className="text-[10px] text-indigo-600 block truncate mt-0.5">
                          {mergedCats.slice(0, 2).join(', ') || 'No categories'}
                        </span>
                      </div>

                      <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
                        <span className="text-[10px] font-bold text-purple-700 uppercase block">Total Products Registered</span>
                        <span className="text-xl font-black text-purple-950 mt-0.5">
                          {vendorProductMappings.filter((m) => m.vendorId === activeVendor.id).length}
                        </span>
                        <span className="text-[10px] text-purple-600 block mt-0.5">Catalogue & Mappings</span>
                      </div>

                      <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase block">Active Products Count</span>
                        <span className="text-xl font-black text-emerald-950 mt-0.5">
                          {vendorProductMappings.filter((m) => m.vendorId === activeVendor.id && m.status === 'ACTIVE').length}
                        </span>
                        <span className="text-[10px] text-emerald-600 block mt-0.5">Active for RFQ matching</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Primary Section: Products Dealt In (One-Click Master Add) */}
                <ProductsDealtInSection vendor={activeVendor} className="border border-blue-200/80 bg-blue-50/20" />

                {/* Navigation Tabs (Requested: Information, Brands Supplied, Material Categories, Products & Materials Supplied, RFQ/Quotation History, Purchase Order History, Audit History) */}
                <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-2 text-xs font-bold">
                  <button
                    onClick={() => setActiveDetailTab('information')}
                    className={`px-3 py-1.5 rounded-xl transition-all ${
                      activeDetailTab === 'information' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Information
                  </button>

                  <button
                    onClick={() => setActiveDetailTab('brands')}
                    className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ${
                      activeDetailTab === 'brands' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    <span>
                      Brands Supplied (
                      {Array.from(new Set([...(activeVendor.brandsSupplied || []), ...(activeVendor.brandsDealing || [])].filter(Boolean))).length}
                      )
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveDetailTab('categories')}
                    className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ${
                      activeDetailTab === 'categories' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>
                      Material Categories (
                      {Array.from(new Set([...(activeVendor.materialCategories || []), ...(activeVendor.productCategories || []), ...(activeVendor.productFamilies || [])].filter(Boolean))).length}
                      )
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveDetailTab('products')}
                    className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                      activeDetailTab === 'products'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-blue-700 bg-blue-50/70 hover:bg-blue-100'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5 text-blue-400" />
                    <span>Products & Materials Supplied</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-600 text-white font-mono">
                      {vendorProductMappings.filter((m) => m.vendorId === activeVendor.id).length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveDetailTab('rfqs')}
                    className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ${
                      activeDetailTab === 'rfqs' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>RFQ / Quotation History</span>
                  </button>

                  <button
                    onClick={() => setActiveDetailTab('orders')}
                    className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ${
                      activeDetailTab === 'orders' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Purchase Orders ({vendorPOs.filter((po) => po.vendorId === activeVendor.id).length})</span>
                  </button>

                  <button
                    onClick={() => setActiveDetailTab('audit')}
                    className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ${
                      activeDetailTab === 'audit' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Audit History</span>
                  </button>

                  <button
                    onClick={() => setActiveDetailTab('ai-analyzer')}
                    className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 ml-auto ${
                      activeDetailTab === 'ai-analyzer' ? 'bg-amber-600 text-white' : ''
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>AI Intelligence</span>
                  </button>
                </div>

                {/* TAB 1: Information */}
                {activeDetailTab === 'information' && (
                  <div className="space-y-4 text-xs">
                    {/* Legal & Status Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Vendor Code</span>
                        <span className="font-mono font-bold text-blue-700">{activeVendor.vendorCode || activeVendor.id}</span>
                      </div>

                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">GSTIN</span>
                        <span className="font-mono font-bold text-slate-900">{activeVendor.gstin}</span>
                      </div>

                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">PAN</span>
                        <span className="font-mono font-bold text-slate-900">{activeVendor.pan}</span>
                      </div>

                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Status</span>
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          {activeVendor.status || 'ACTIVE'}
                        </span>
                      </div>
                    </div>

                    {/* Legal Entity, Vendor Type, Country & Website */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 sm:col-span-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Legal / Registered Entity Name</span>
                        <span className="font-bold text-slate-900 block">
                          {activeVendor.legalName || activeVendor.companyName}
                        </span>
                      </div>

                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Vendor Type & Country</span>
                        <span className="font-semibold text-slate-900 block">
                          {activeVendor.vendorType || 'Distributor'} • {activeVendor.country || 'India'}
                        </span>
                      </div>

                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Official Website</span>
                        {activeVendor.website ? (
                          <a
                            href={activeVendor.website.startsWith('http') ? activeVendor.website : `https://${activeVendor.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-blue-600 hover:underline truncate flex items-center gap-1"
                          >
                            <Globe className="w-3 h-3 shrink-0" />
                            <span className="truncate">{activeVendor.website.replace(/^https?:\/\//i, '')}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">Not registered</span>
                        )}
                      </div>
                    </div>

                    {/* Contact Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Contact Person</span>
                        <span className="font-bold text-slate-900 text-xs block">{activeVendor.contactPerson}</span>
                        <span className="text-[11px] text-slate-500">Key Account Representative</span>
                      </div>

                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Mobile Number</span>
                        <a href={`tel:${activeVendor.mobile}`} className="font-bold text-blue-600 block">
                          {activeVendor.mobile}
                        </a>
                        {activeVendor.alternateMobile && (
                          <span className="text-[10px] text-slate-400 font-mono block">
                            Alt: {activeVendor.alternateMobile}
                          </span>
                        )}
                      </div>

                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Email Address</span>
                        <a href={`mailto:${activeVendor.email}`} className="font-bold text-blue-600 truncate block">
                          {activeVendor.email}
                        </a>
                      </div>
                    </div>

                    {/* Additional Multi-Department Contacts from Auto-Onboarding */}
                    {activeVendor.contacts && activeVendor.contacts.length > 0 && (
                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          Extracted Contact Directory ({activeVendor.contacts.length})
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {activeVendor.contacts.map((ct, idx) => (
                            <div key={ct.id || idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] space-y-0.5">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-slate-900">{ct.name || ct.department || 'Contact'}</span>
                                <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded text-[9px] font-bold">
                                  {ct.isPrimary ? 'Primary' : ct.department || 'General'}
                                </span>
                              </div>
                              {ct.email && <div className="text-blue-600 truncate">{ct.email}</div>}
                              {(ct.mobile || ct.landline || ct.whatsapp) && (
                                <div className="font-mono text-slate-600">
                                  {[ct.mobile, ct.landline, ct.whatsapp].filter(Boolean).join(' • ')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Address & Commercial Terms */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Registered Address</span>
                          {typeof activeVendor.profileCompletionScore === 'number' && (
                            <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              Profile {activeVendor.profileCompletionScore}% Complete
                            </span>
                          )}
                        </div>
                        <span className="text-slate-800 leading-relaxed block">
                          {activeVendor.address}, {activeVendor.city}, {activeVendor.state} {activeVendor.pincode ? `- ${activeVendor.pincode}` : ''}
                        </span>
                        {activeVendor.structuredAddress?.industrialEstateOrArea && (
                          <span className="text-[10px] text-slate-500 block">
                            Industrial Area / Zone: {activeVendor.structuredAddress.industrialEstateOrArea}
                          </span>
                        )}
                      </div>

                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Commercial & Payment Terms</span>
                        <span className="font-medium text-slate-800 block">
                          Payment: <strong>{activeVendor.paymentTerms}</strong>
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          Credit: {activeVendor.creditPeriod || '30 Days'} • Delivery: {activeVendor.deliveryTerms || 'Standard'}
                        </span>
                      </div>
                    </div>

                    {/* Bank Coordinates */}
                    {activeVendor.bankDetails && (
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Bank Coordinates</span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                          <div>
                            <span className="text-slate-500 block">Bank Name</span>
                            <span className="font-bold text-slate-800">{activeVendor.bankDetails.bankName}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Account Number</span>
                            <span className="font-mono font-bold text-slate-800">{activeVendor.bankDetails.accountNumber}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">IFSC Code</span>
                            <span className="font-mono font-bold text-slate-800">{activeVendor.bankDetails.ifscCode}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Branch</span>
                            <span className="text-slate-800">{activeVendor.bankDetails.branch || activeVendor.city}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Remarks */}
                    {activeVendor.remarks && (
                      <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                        <span className="font-bold block mb-0.5">Remarks / Supplier Notes</span>
                        <p>{activeVendor.remarks}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: Brands Supplied */}
                {activeDetailTab === 'brands' && (
                  <div className="space-y-4 text-xs">
                    <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-200 space-y-3">
                      {(() => {
                        const tabBrands = Array.from(
                          new Set([...(activeVendor.brandsSupplied || []), ...(activeVendor.brandsDealing || [])].filter(Boolean))
                        );
                        return (
                          <>
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-bold text-blue-950 text-sm block">
                                  Brands Handled ({tabBrands.length} Registered Brands)
                                </span>
                                <span className="text-[11px] text-blue-700">
                                  Suppliers receive highest priority in RFQ auto-matching when exact brands match customer indents.
                                </span>
                              </div>
                              <button
                                onClick={() => handleOpenEdit(activeVendor)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                + Manage Brands
                              </button>
                            </div>

                            <div className="flex flex-wrap gap-2 pt-2">
                              {tabBrands.length === 0 ? (
                                <div className="p-4 text-center text-slate-400 bg-white rounded-xl border border-blue-100 w-full">
                                  No brands tagged for this vendor. Click "Manage Brands" to register supplied brands.
                                </div>
                              ) : (
                                tabBrands.map((b, idx) => {
                                  const prodCount = vendorProductMappings.filter(
                                    (m) => m.vendorId === activeVendor.id && m.brand.toLowerCase() === b.toLowerCase()
                                  ).length;
                                  const assoc = activeVendor.brandAssociations?.find(
                                    (ba) => ba.brandName.toLowerCase() === b.toLowerCase()
                                  );
                                  return (
                                    <div
                                      key={idx}
                                      className="px-3 py-1.5 bg-white border border-blue-300 text-blue-900 rounded-xl shadow-2xs font-semibold text-xs flex items-center gap-2"
                                      title={assoc ? `${assoc.relationshipType} • Source: ${assoc.source} (${assoc.confidence}%)` : b}
                                    >
                                      <BookmarkCheck className="w-3.5 h-3.5 text-blue-600" />
                                      <span>{b}</span>
                                      {assoc?.relationshipType && (
                                        <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-800 text-[9px] rounded border border-indigo-200 font-bold">
                                          {assoc.relationshipType}
                                        </span>
                                      )}
                                      {prodCount > 0 && (
                                        <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[10px] rounded-full font-mono font-bold">
                                          {prodCount} prods
                                        </span>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            {activeVendor.brandAssociations && activeVendor.brandAssociations.length > 0 && (
                              <div className="mt-3 overflow-x-auto bg-white rounded-xl border border-blue-200">
                                <table className="w-full text-left text-[11px]">
                                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                                    <tr>
                                      <th className="py-2 px-3">Brand</th>
                                      <th className="py-2 px-3">Relationship Type</th>
                                      <th className="py-2 px-3">Source</th>
                                      <th className="py-2 px-3 text-center">Confidence</th>
                                      <th className="py-2 px-3">Last Verified</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {activeVendor.brandAssociations.map((ba, idx) => (
                                      <tr key={idx}>
                                        <td className="py-2 px-3 font-bold text-slate-900">{ba.brandName}</td>
                                        <td className="py-2 px-3 text-blue-800 font-semibold">{ba.relationshipType}</td>
                                        <td className="py-2 px-3 text-slate-600">{ba.source}</td>
                                        <td className="py-2 px-3 text-center font-mono">{ba.confidence}%</td>
                                        <td className="py-2 px-3 font-mono text-slate-500">{ba.lastVerified}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* TAB 3: Material Categories */}
                {activeDetailTab === 'categories' && (
                  <div className="space-y-4 text-xs">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900 text-sm block">
                            Material Categories & Subcategories
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Hierarchy classifications associated with this supplier
                          </span>
                        </div>
                        <button
                          onClick={() => handleOpenEdit(activeVendor)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold"
                        >
                          + Edit Categories
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        {(activeVendor.materialCategories || activeVendor.productCategories || []).map((cat, idx) => {
                          const catProducts = vendorProductMappings.filter(
                            (m) => m.vendorId === activeVendor.id && m.category.toLowerCase() === cat.toLowerCase()
                          ).length;
                          return (
                            <div
                              key={idx}
                              className="px-3 py-2 bg-white border border-slate-200 rounded-xl shadow-2xs text-xs space-y-1"
                            >
                              <div className="flex items-center gap-2">
                                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                                <span className="font-bold text-slate-900">{cat}</span>
                                <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[10px] font-mono">
                                  {catProducts} items
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: Products & Materials Supplied */}
                {activeDetailTab === 'products' && (
                  <VendorProductMappingSection
                    vendor={activeVendor}
                    onOpenAiAnalyzer={() => setIsAiAnalyzerModalOpen(true)}
                  />
                )}

                {/* TAB 5: RFQ / Quotation History */}
                {activeDetailTab === 'rfqs' && (
                  <div className="space-y-3 text-xs">
                    {(() => {
                      const activeVendorQuotes = vendorQuotes.filter((q) => q.vendorId === activeVendor.id);
                      if (activeVendorQuotes.length === 0) {
                        return (
                          <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                            <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                            <p className="font-bold text-sm text-slate-600">No quotation records found</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              When quotations are submitted for RFQs by this vendor, their complete pricing and quote references will be shown here.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2">
                          {activeVendorQuotes.map((q) => (
                            <div
                              key={q.id}
                              className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between shadow-2xs"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-blue-700">{q.id}</span>
                                  <span className="text-slate-400">•</span>
                                  <span className="font-bold text-slate-900">RFQ: {q.requirementId}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-1">
                                  Customer: {q.customerName || 'Direct'} • Line items: {q.items.length} • Valid until: {q.validUntil || 'N/A'}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="font-mono font-bold text-slate-900 text-sm block">
                                  ₹{q.items.reduce((s, it) => s + (it.resellerPrice || it.unitRate || 0) * (it.quantity || 1), 0).toLocaleString('en-IN')}
                                </span>
                                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                                  Active Quotation
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* TAB 6: Purchase Order History */}
                {activeDetailTab === 'orders' && (
                  <div className="space-y-3 text-xs">
                    {(() => {
                      const activeVendorPOs = vendorPOs.filter((po) => po.vendorId === activeVendor.id);
                      if (activeVendorPOs.length === 0) {
                        return (
                          <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                            <Truck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                            <p className="font-bold text-sm text-slate-600">No purchase orders recorded yet</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Issued purchase orders for this vendor will be archived here.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2">
                          {activeVendorPOs.map((po) => (
                            <div
                              key={po.id}
                              className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between shadow-2xs"
                            >
                              <div>
                                <div className="font-mono font-bold text-slate-900 text-sm">{po.id}</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  Date: {po.poDate} • Items: {po.items.length} • Delivery: {po.deliveryDate || 'Standard'}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="font-black text-blue-700 font-mono block text-sm">
                                  ₹{po.totalAmount.toLocaleString('en-IN')}
                                </span>
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded text-[10px] font-bold">
                                  {po.status || 'ISSUED'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* TAB 7: Audit History */}
                {activeDetailTab === 'audit' && (
                  <div className="space-y-3 text-xs">
                    {(() => {
                      const activeVendorAudit = auditLogs.filter(
                        (a) =>
                          a.recordNumber === activeVendor.id ||
                          a.recordNumber === activeVendor.vendorCode ||
                          a.remarks?.includes(activeVendor.companyName) ||
                          a.entityId === activeVendor.id
                      );

                      if (activeVendorAudit.length === 0) {
                        return (
                          <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                            <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                            <p className="font-bold text-sm text-slate-600">No specific audit entries logged</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Vendor creation, product mapping, and catalog changes will show here.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2">
                          {activeVendorAudit.map((log) => (
                            <div
                              key={log.id}
                              className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900">{log.action}</span>
                                  <span className="text-slate-400">•</span>
                                  <span className="text-slate-500">{log.user} ({log.role})</span>
                                </div>
                                <p className="text-slate-700 text-[11px]">{log.remarks || log.details}</p>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-3">
                                {log.timestamp}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* TAB: AI Intelligence */}
                {activeDetailTab === 'ai-analyzer' && (
                  <VendorAiIntelligenceView vendor={activeVendor} />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SMART AUTO-ONBOARDING WIZARD (Option A Default) */}
      {isAddModalOpen && !isEditModalOpen && addVendorMode === 'AUTO' && (
        <VendorOnboardingWizardModal
          isOpen={true}
          onClose={() => setIsAddModalOpen(false)}
          onSuccessVendorSaved={(savedId) => {
            setSelectedVendorId(savedId);
            setIsAddModalOpen(false);
            setViewMode('split');
            setActiveDetailTab('information');
          }}
          onOpenExistingVendor={(existingId) => {
            setSelectedVendorId(existingId);
            setIsAddModalOpen(false);
            setViewMode('split');
            setActiveDetailTab('information');
          }}
          onSwitchToManual={(prefill) => {
            if (prefill) {
              if (prefill.companyName) setCompanyName(prefill.companyName);
              if (prefill.legalName) setLegalName(prefill.legalName);
              if (prefill.vendorType) setVendorType(prefill.vendorType);
              if (prefill.website) setWebsite(prefill.website);
              if (prefill.country) setCountry(prefill.country);
              if (prefill.contactPerson) setContactPerson(prefill.contactPerson);
              if (prefill.email) setEmail(prefill.email);
              if (prefill.mobile) setMobile(prefill.mobile);
              if (prefill.alternateMobile) setAlternateMobile(prefill.alternateMobile);
              if (prefill.address) setAddress(prefill.address);
              if (prefill.city) setCity(prefill.city);
              if (prefill.state) setState(prefill.state);
              if (prefill.pincode) setPincode(prefill.pincode);
              if (prefill.gstin) setGstin(prefill.gstin);
              if (prefill.pan) setPan(prefill.pan);
              if (prefill.brands && prefill.brands.length > 0) setSelectedBrands(prefill.brands);
              if (prefill.categories && prefill.categories.length > 0) setSelectedCategories(prefill.categories);
              if (prefill.products && prefill.products.length > 0) {
                setVendorProductsList(
                  prefill.products.map((p, idx) => ({
                    id: `VPM-PRE-${Date.now()}-${idx}`,
                    productName: p.productName,
                    category: p.category || 'Mechanical Components',
                    subCategory: p.subCategory || '',
                    brand: p.brand || 'Generic',
                    modelNumber: p.modelNumber || p.partNumber || '',
                    partNumber: p.partNumber || p.modelNumber || '',
                    specification: p.specification || '',
                    description: p.description || '',
                    uom: p.uom || 'NOS',
                    status: 'ACTIVE',
                    isNewGlobalProduct: p.matchStatus !== 'EXACT_MATCH',
                  }))
                );
              }
            }
            setAddVendorMode('MANUAL');
          }}
        />
      )}

      {/* ADD (Option B Manual Entry) / EDIT VENDOR MODAL (Requirement 1: Searchable Multi-Select Brands Supplied) */}
      {((isAddModalOpen && addVendorMode === 'MANUAL') || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">
                  {isEditModalOpen ? `Edit Supplier: ${(editingVendor || activeVendor)?.companyName}` : 'Register Certified Supplier (Option B — Manual Entry)'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {!isEditModalOpen && (
                  <button
                    type="button"
                    onClick={() => setAddVendorMode('AUTO')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Option A: Auto Onboarding</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                    setEditingVendor(null);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Form */}
            <form
              onSubmit={isEditModalOpen ? handleUpdateVendor : handleSaveVendor}
              className="p-6 overflow-y-auto space-y-4 text-xs flex-1"
            >
              {/* Optional Excel Template & Bulk Upload prompt */}
              {!isEditModalOpen && (
                <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                    </div>
                    <div>
                      <span className="font-bold text-emerald-950 block">
                        Bulk registering vendors with full product data?
                      </span>
                      <span className="text-[11px] text-emerald-800">
                        The Excel template includes the Products Dealt In column and auto-enriches categories, HSN codes, UOM, and GST rates as per brand (SKF, ABB, Festo, Siemens, etc.).
                      </span>

                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={downloadVendorMasterTemplate}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg font-bold text-[11px] shadow-2xs transition-colors"
                      title="Download Excel Template with Product Columns and Brand Auto-Enrichment"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Download Excel Template</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddModalOpen(false);
                        setIsImportModalOpen(true);
                      }}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-[11px] shadow-2xs transition-colors"
                      title="Switch to Excel / CSV Bulk Importer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Import Excel</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Duplicate Error Banner */}
              {vendorFormError && (
                <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl flex items-start gap-3 animate-in fade-in duration-150 shadow-xs">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-xs text-rose-950">{vendorFormError}</p>
                    <p className="text-[11px] text-rose-700 mt-0.5">
                      Duplicate vendor entries are strictly prevented to protect database integrity. Please edit the existing vendor record or use a unique company name/GSTIN.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVendorFormError(null)}
                    className="text-rose-400 hover:text-rose-700 p-0.5 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">Company / OEM Partner Name *</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => {
                      setCompanyName(e.target.value);
                      if (vendorFormError) setVendorFormError(null);
                    }}
                    placeholder="e.g. Apex Industrial Bearings Pvt Ltd"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                  />
                  {(() => {
                    const norm = companyName.trim().toLowerCase();
                    if (!norm) return null;
                    const dup = vendors.find(
                      (v) => (!isEditModalOpen || v.id !== (editingVendor || activeVendor)?.id) && v.companyName?.trim().toLowerCase() === norm
                    );
                    if (!dup) return null;
                    return (
                      <div className="mt-1.5 p-2 bg-amber-50 border border-amber-300 rounded-lg text-[11px] text-amber-900 font-semibold flex items-center gap-1.5 animate-in fade-in">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>
                          Duplicate Notice: Supplier <strong>"{dup.companyName}"</strong> already exists in ERP ({dup.id}{dup.isDeleted ? ' - Currently in Archive' : ''}). Please use a unique name.
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Legal / Registered Entity Name</label>
                  <input
                    type="text"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="e.g. 4D Technology & Automation Systems Pvt Ltd"
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Vendor Type</label>
                  <select
                    value={vendorType}
                    onChange={(e) => setVendorType(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold"
                  >
                    <option value="Manufacturer">Manufacturer (OEM)</option>
                    <option value="Distributor">Distributor</option>
                    <option value="Authorised Dealer">Authorised Dealer</option>
                    <option value="Manufacturer & Distributor">Manufacturer & Distributor</option>
                    <option value="Stockist">Stockist / Trader</option>
                    <option value="Service Provider">Service Provider</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Official Website URL</label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://4dtechnology.in"
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Country</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="India"
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Key Contact Person *</label>
                  <input
                    type="text"
                    required
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Rajesh Kulkarni"
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="sales@apexindustrial.com"
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mobile / Primary Phone *</label>
                  <input
                    type="text"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="+91 98220 99887"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Alternate Mobile Number</label>
                  <input
                    type="text"
                    value={alternateMobile}
                    onChange={(e) => setAlternateMobile(e.target.value)}
                    placeholder="+91 98450 11223"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">Company Address *</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Plot / Street / MIDC Area"
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">City & State *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                      className="w-full p-2.5 border border-slate-300 rounded-xl"
                    />
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="State"
                      className="w-full p-2.5 border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">PIN Code</label>
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="411001"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">GSTIN *</label>
                  <input
                    type="text"
                    required
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    placeholder="27AABCA1234F1ZN"
                    className="w-full p-2.5 border border-slate-300 rounded-xl uppercase font-mono"
                  />
                  {(() => {
                    const normGst = gstin.trim().toUpperCase();
                    if (normGst.length < 15 || normGst.startsWith('27AAAPV0000')) return null;
                    const dup = vendors.find(
                      (v) => (!isEditModalOpen || v.id !== (editingVendor || activeVendor)?.id) && v.gstin && v.gstin.trim().toUpperCase() === normGst
                    );
                    if (!dup) return null;
                    return (
                      <div className="mt-1.5 p-2 bg-amber-50 border border-amber-300 rounded-lg text-[11px] text-amber-900 font-semibold flex items-center gap-1.5 animate-in fade-in">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>
                          GSTIN Notice: Already linked to <strong>"{dup.companyName}"</strong> ({dup.id}).
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">PAN Number *</label>
                  <input
                    type="text"
                    required
                    value={pan}
                    onChange={(e) => setPan(e.target.value)}
                    placeholder="AABCA1234F"
                    className="w-full p-2.5 border border-slate-300 rounded-xl uppercase font-mono"
                  />
                </div>
              </div>

              {/* REQUIREMENT: Products Dealt In Section (One-Click Master Add) */}
              <ProductsDealtInSection
                vendor={isEditModalOpen ? (editingVendor || activeVendor) : null}
                stagedMappings={vendorProductsList}
                onStagedAdd={(item) => {
                  setVendorProductsList((prev) => [
                    ...prev,
                    {
                      productName: item.productName,
                      category: item.category || "General",
                      brand: item.brand || "Generic",
                      uom: "NOS",
                      status: "ACTIVE",
                    },
                  ]);
                }}
                onStagedRemove={(idx) => {
                  setVendorProductsList((prev) => prev.filter((_, i) => i !== idx));
                }}
              />

              {/* REQUIREMENT 1: Searchable Multi-Select Field: BRANDS SUPPLIED */}
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-bold text-blue-950 block text-xs flex items-center gap-1.5">
                      <BookmarkCheck className="w-4 h-4 text-blue-700" />
                      <span>Brands Supplied (Search & Multi-select — or auto-detect from Catalogue)</span>
                    </label>
                    <p className="text-[11px] text-blue-700 mt-0.5">
                      Select multiple OEM brands (SKF, FAG, Timken, NBC, Bosch, Siemens, Festo, etc.). You can also add custom brands directly.
                    </p>
                  </div>
                  <span className="font-bold text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                    {selectedBrands.length} selected
                  </span>
                </div>

                {/* Selected Brands Chips with X to remove individual brands */}
                <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-xl border border-blue-200 min-h-[42px] items-center">
                  {selectedBrands.length === 0 ? (
                    <span className="text-slate-400 italic text-xs px-1">
                      No brands selected yet. Search below or type to add.
                    </span>
                  ) : (
                    selectedBrands.map((brandName, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 text-white rounded-lg font-bold text-xs shadow-2xs"
                      >
                        <span>{brandName}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveBrand(brandName)}
                          className="hover:bg-blue-700 rounded-full p-0.5 transition-colors"
                          title={`Remove ${brandName}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Brand Search & Add Toolbar */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={brandSearchQuery}
                        onChange={(e) => setBrandSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (brandSearchQuery.trim()) {
                              handleAddNewCustomBrand(brandSearchQuery);
                            }
                          }
                        }}
                        placeholder="Search brand master (e.g. SKF, Timken, Bosch, Festo, Schneider)..."
                        className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Direct Add Brand Button if typed query doesn't match */}
                    {brandSearchQuery.trim() && (
                      <button
                        type="button"
                        onClick={() => handleAddNewCustomBrand(brandSearchQuery)}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shrink-0 flex items-center gap-1 shadow-2xs text-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add "{brandSearchQuery.trim()}"</span>
                      </button>
                    )}
                  </div>

                  {/* Brand Catalog Pills / Grid from Master */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-white border border-slate-200 rounded-lg">
                    {allKnownBrands
                      .filter((b) =>
                        b.toLowerCase().includes(brandSearchQuery.toLowerCase().trim())
                      )
                      .map((brandName) => {
                        const isChecked = selectedBrands.some(
                          (sb) => sb.toLowerCase().trim() === brandName.toLowerCase().trim()
                        );
                        return (
                          <button
                            type="button"
                            key={brandName}
                            onClick={() => handleToggleBrandSelection(brandName)}
                            className={`px-2.5 py-1.5 text-left rounded-lg text-[11px] font-medium transition-all flex items-center justify-between ${
                              isChecked
                                ? 'bg-blue-50 text-blue-900 font-bold border border-blue-300'
                                : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                            }`}
                          >
                            <span className="truncate">{brandName}</span>
                            {isChecked && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Material Categories Multi-Select */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900 block">
                    Material Categories (Multi-select — optional before catalogue scan)
                  </label>
                  <span className="text-[11px] font-bold text-blue-700">
                    {selectedCategories.length} selected
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 pb-2">
                  {selectedCategories.map((cat, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 text-white rounded-lg text-xs font-bold"
                    >
                      <span>{cat}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleCategorySelection(cat)}
                        className="hover:bg-slate-700 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <input
                  type="text"
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  placeholder="Filter categories (e.g. Bearings, Belts, Pumps, Fasteners)..."
                  className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg"
                />

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-32 overflow-y-auto p-1 bg-white border border-slate-200 rounded-lg">
                  {categories
                    .filter((c) => c.name.toLowerCase().includes(categorySearchQuery.toLowerCase()))
                    .map((c) => {
                      const isChecked = selectedCategories.includes(c.name);
                      return (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => handleToggleCategorySelection(c.name)}
                          className={`px-2 py-1 text-left rounded text-[11px] font-medium transition-colors flex items-center justify-between ${
                            isChecked
                              ? 'bg-blue-50 text-blue-900 font-bold border border-blue-200'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className="truncate">{c.name}</span>
                          {isChecked && <CheckCircle className="w-3 h-3 text-blue-600 shrink-0" />}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Terms and Classifications */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">MSME Classification</label>
                  <select
                    value={msmeStatus}
                    onChange={(e) => setMsmeStatus(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="Micro">Micro Enterprise</option>
                    <option value="Small">Small Enterprise</option>
                    <option value="Medium">Medium Enterprise</option>
                    <option value="Large">Large / Non-MSME</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Payment Terms</label>
                  <input
                    type="text"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Credit Period</label>
                  <input
                    type="text"
                    value={creditPeriod}
                    onChange={(e) => setCreditPeriod(e.target.value)}
                    placeholder="30 Days"
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Delivery Terms</label>
                  <input
                    type="text"
                    value={deliveryTerms}
                    onChange={(e) => setDeliveryTerms(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Vendor Status</label>
                  <select
                    value={vendorStatus}
                    onChange={(e) => setVendorStatus(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="ACTIVE">ACTIVE (Certified)</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="BLOCKED">BLOCKED</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Remarks</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Authorized channel partner notes"
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Bank Details */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-800 block text-xs">Bank Account Coordinates</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-0.5">Bank Name</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="HDFC Bank"
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-0.5">Account Number</label>
                    <input
                      type="text"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      placeholder="9210200889912"
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-0.5">IFSC Code</label>
                    <input
                      type="text"
                      value={bankIfsc}
                      onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                      placeholder="HDFC0000060"
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="pt-4 border-t flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLaunchAnalyzerAfterSave(false);
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                    setEditingVendor(null);
                  }}
                  className="px-4 py-2 border rounded-xl font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                {!isEditModalOpen && (
                  <button
                    type="submit"
                    disabled={isSavingVendor}
                    onClick={() => setLaunchAnalyzerAfterSave(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-xl font-bold shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isSavingVendor ? 'Saving...' : 'Save & Upload Catalogue'}</span>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSavingVendor}
                  onClick={() => setLaunchAnalyzerAfterSave(false)}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-xl font-bold shadow-xs shadow-blue-500/20"
                >
                  {isSavingVendor ? 'Saving & Verifying...' : isEditModalOpen ? 'Save Changes' : 'Register Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXPORT VENDORS MODAL (Requirement 3, 4, 5) */}
      {isExportModalOpen && (
        <VendorExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          vendors={vendors}
          filteredVendors={filteredVendors}
          selectedVendor={activeVendor}
          initialBrandFilter={brandFilter}
          initialCategoryFilter={categoryFilter}
          initialCityFilter={cityFilter}
        />
      )}

      {/* IMPORT VENDORS MODAL (Requirement 6) */}
      {isImportModalOpen && (
        <ImportDataModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          type="VENDORS"
        />
      )}

      {/* BRAND MASTER MODAL (Requirement 1: Allow brands to be managed separately) */}
      {isBrandMasterModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <BookmarkCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base">Brand & OEM Master Management</h3>
              </div>
              <button
                onClick={() => setIsBrandMasterModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <BrandMaster
                onSelectBrandFilter={(bName) => {
                  setBrandFilter(bName);
                  setIsBrandMasterModalOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* AI Catalog Analyzer Modal */}
      {isAiAnalyzerModalOpen && activeVendor && (
        <AiCatalogAnalyzerModal
          isOpen={isAiAnalyzerModalOpen}
          onClose={() => setIsAiAnalyzerModalOpen(false)}
          vendor={activeVendor}
        />
      )}

      {/* Deep Multi-Facet Search & Match Modal */}
      {isSearchModalOpen && (
        <VendorSearchAndMatchModal
          isOpen={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
          onSelectVendorForRfq={(vId) => {
            setSelectedVendorId(vId);
            setIsSearchModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
