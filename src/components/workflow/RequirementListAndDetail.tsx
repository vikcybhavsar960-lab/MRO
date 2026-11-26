import React, { useState, useMemo } from 'react';
import {
  Plus,
  FileText,
  Search,
  Filter,
  Share2,
  Calendar,
  Building,
  CheckCircle,
  Clock,
  ArrowRight,
  Download,
  Upload,
  X,
  Trash2,
  Layers,
  Lock,
  Unlock,
  ShieldCheck,
  FileSpreadsheet,
  Users,
  LayoutGrid,
  Table as TableIcon,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Tag,
  Check,
  DollarSign,
  Receipt,
  Scale,
} from 'lucide-react';
import { useApp, isSuperAdminUser } from '../../context/AppContext';
import { CustomerRequirement, RequirementItem, Vendor } from '../../types';
import { generateWhatsAppShareUrl } from '../../services/pdfService';
import { EarningRulesAndLockModal } from './EarningRulesAndLockModal';
import { RelevantVendorsModal } from './RelevantVendorsModal';
import { BulkRequirementImportModal } from './BulkRequirementImportModal';
import { DirectVendorRateEntryModal } from './DirectVendorRateEntryModal';
import { exportBulkRequirementsToExcel } from '../../services/bulkRequirementImportService';
import { recommendVendorsForRequirement } from '../../services/categoryMatchingService';
import { RequirementRegisterView } from './RequirementRegisterView';

interface RequirementListAndDetailProps {
  onOpenNewModal: () => void;
  onOpenRateModal?: (requirementId: string) => void;
  onSelectOrder: (orderId: string) => void;
}

export const RequirementListAndDetail: React.FC<RequirementListAndDetailProps> = ({
  onOpenNewModal,
  onOpenRateModal,
  onSelectOrder,
}) => {
  const {
    requirements,
    customers,
    currentUser,
    categories,
    vendors,
    vendorQuotes,
    setActiveTab,
    assignVendorToRequirementItem,
    deleteRequirement,
    purgeRequirement,
  } = useApp();

  const isSuperAdmin = isSuperAdminUser(currentUser);

  // View mode: Register vs Bulk Dashboard Table vs Cards
  const [viewMode, setViewMode] = useState<'REGISTER' | 'BULK_TABLE' | 'CARDS'>('REGISTER');

  // Filters
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [subCategoryFilter, setSubCategoryFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [auditReqId, setAuditReqId] = useState<string | null>(null);
  const [selectedReqForVendors, setSelectedReqForVendors] = useState<CustomerRequirement | null>(null);
  const [selectedItemForVendors, setSelectedItemForVendors] = useState<RequirementItem | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [directRateReqId, setDirectRateReqId] = useState<string | null>(null);

  // Filter based on role if Customer and strictly exclude soft-deleted requirements
  const visibleRequirements = useMemo(() => {
    return requirements.filter((req) => {
      if (req.isDeleted) return false;
      if (currentUser.role === 'CUSTOMER') {
        return (
          req.customerId === currentUser.associatedId ||
          req.customerName.toLowerCase().includes(currentUser.name.toLowerCase())
        );
      }
      return true;
    });
  }, [requirements, currentUser]);

  // Sub-categories list for active category filter
  const availableSubCategories = useMemo(() => {
    if (categoryFilter === 'ALL') return [];
    const cat = categories.find((c) => c.name.toLowerCase() === categoryFilter.toLowerCase());
    return cat ? cat.subCategories : [];
  }, [categoryFilter, categories]);

  // Flatten requirements into individual item rows for Bulk Requirement Dashboard
  const flattenedItemRows = useMemo(() => {
    const rows: Array<{
      req: CustomerRequirement;
      item: RequirementItem;
      requirementId: string;
      customerName: string;
      itemName: string;
      description: string;
      specification: string;
      category: string;
      recommendedCategory: string;
      subCategory?: string;
      quantity: number;
      uom: string;
      requiredDate: string;
      receivedDate: string;
      expectedDeliveryDate?: string;
      priority: string;
      status: string;
      recommendedVendorCount: number;
      recommendedVendorsList: ReturnType<typeof recommendVendorsForRequirement>;
      selectedVendorId?: string;
      selectedVendorName?: string;
      rfqStatus: string;
      remarks: string;
    }> = [];

    visibleRequirements.forEach((req) => {
      req.items.forEach((item) => {
        const itemCategory = item.category || item.recommendedCategory || 'Bearings';
        const recVendors = recommendVendorsForRequirement(
          {
            category: itemCategory,
            subCategory: item.subCategory,
            itemName: item.itemName,
            description: item.specification,
          },
          vendors,
          requirements
        );

        let rfqStatus = 'Rate Pending';
        if (req.status === 'RATE_RECEIVED') rfqStatus = 'Rates Received';
        else if (['QUOTATION_SUBMITTED', 'QUOTATION_SENT', 'PO_RECEIVED', 'IN_TRANSIT', 'DISPATCHED', 'DELIVERED', 'ORDER_CLOSED'].includes(req.status)) {
          rfqStatus = 'Quoted / Ordered';
        }

        rows.push({
          req,
          item,
          requirementId: req.id,
          customerName: req.customerName,
          itemName: item.itemName,
          description: item.specification || item.description || item.partNumber || '-',
          specification: item.specification || '',
          category: itemCategory,
          recommendedCategory: item.recommendedCategory || itemCategory,
          subCategory: item.subCategory,
          quantity: item.quantity,
          uom: item.uom,
          requiredDate: item.receivedRequirementDate || req.receivedRequirementDate || req.requirementDate || item.requiredDeliveryDate || req.requiredDeliveryDate || '-',
          receivedDate: item.receivedRequirementDate || req.receivedRequirementDate || req.requirementDate || item.requiredDeliveryDate || req.requiredDeliveryDate || '-',
          expectedDeliveryDate: item.expectedDeliveryDate || req.expectedDeliveryDate || '',
          priority: item.priority || req.priority || 'Medium',
          status: req.status,
          recommendedVendorCount: recVendors.length,
          recommendedVendorsList: recVendors,
          selectedVendorId: item.selectedVendorId,
          selectedVendorName: item.selectedVendorName,
          rfqStatus,
          remarks: item.remarks || req.remarks || '',
        });
      });
    });

    return rows;
  }, [visibleRequirements, vendors, requirements]);

  // Filter flattened rows
  const filteredDashboardRows = useMemo(() => {
    return flattenedItemRows.filter((row) => {
      // Text search
      const q = filterText.toLowerCase().trim();
      const matchesText =
        !q ||
        row.requirementId.toLowerCase().includes(q) ||
        row.customerName.toLowerCase().includes(q) ||
        row.itemName.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q) ||
        (row.subCategory && row.subCategory.toLowerCase().includes(q)) ||
        (row.selectedVendorName && row.selectedVendorName.toLowerCase().includes(q));

      // Category filter
      const matchesCategory =
        categoryFilter === 'ALL' ||
        row.category.toLowerCase() === categoryFilter.toLowerCase();

      // Sub-category filter
      const matchesSubCategory =
        subCategoryFilter === 'ALL' ||
        (row.subCategory && row.subCategory.toLowerCase() === subCategoryFilter.toLowerCase());

      // Priority filter
      const matchesPriority =
        priorityFilter === 'ALL' || row.priority.toLowerCase() === priorityFilter.toLowerCase();

      // Status filter
      const matchesStatus =
        statusFilter === 'ALL' || row.status === statusFilter;

      // Date Range filter
      let matchesDate = true;
      if (startDate && row.requiredDate !== '-') {
        matchesDate = matchesDate && row.requiredDate >= startDate;
      }
      if (endDate && row.requiredDate !== '-') {
        matchesDate = matchesDate && row.requiredDate <= endDate;
      }

      return (
        matchesText &&
        matchesCategory &&
        matchesSubCategory &&
        matchesPriority &&
        matchesStatus &&
        matchesDate
      );
    });
  }, [
    flattenedItemRows,
    filterText,
    categoryFilter,
    subCategoryFilter,
    priorityFilter,
    statusFilter,
    startDate,
    endDate,
  ]);

  // Filter for Card View
  const filteredCardReqs = useMemo(() => {
    return visibleRequirements.filter((req) => {
      const q = filterText.toLowerCase().trim();
      const matchesText =
        !q ||
        req.id.toLowerCase().includes(q) ||
        req.customerName.toLowerCase().includes(q) ||
        req.contactPerson.toLowerCase().includes(q) ||
        req.items.some(
          (i) =>
            i.itemName.toLowerCase().includes(q) ||
            (i.partNumber || '').toLowerCase().includes(q) ||
            i.category.toLowerCase().includes(q)
        );

      const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;

      const matchesCategory =
        categoryFilter === 'ALL' ||
        req.items.some((i) => i.category.toLowerCase() === categoryFilter.toLowerCase());

      const matchesPriority =
        priorityFilter === 'ALL' ||
        (req.priority && req.priority.toLowerCase() === priorityFilter.toLowerCase());

      return matchesText && matchesStatus && matchesCategory && matchesPriority;
    });
  }, [visibleRequirements, filterText, statusFilter, categoryFilter, priorityFilter]);

  const handleShareWhatsApp = (req: CustomerRequirement) => {
    const url = generateWhatsAppShareUrl('REQUIREMENT', {
      recipientName: req.customerName,
      docNumber: req.id,
      itemsSummary: req.items.map((i) => `${i.itemName} (Qty: ${i.quantity})`).join(', '),
      phone: req.customerMobile,
    });
    window.open(url, '_blank');
  };

  const handleExportDashboardExcel = () => {
    exportBulkRequirementsToExcel(
      filteredDashboardRows.map((r) => ({
        requirementId: r.requirementId,
        customerName: r.customerName,
        itemName: r.itemName,
        description: r.description,
        category: r.category,
        subCategory: r.subCategory,
        quantity: r.quantity,
        uom: r.uom,
        requiredDate: r.requiredDate,
        priority: r.priority,
        status: r.status,
        recommendedVendorCount: r.recommendedVendorCount,
        selectedVendor: r.selectedVendorName || 'Not Selected',
        rfqStatus: r.rfqStatus,
        remarks: r.remarks,
      }))
    );
  };

  const clearAllFilters = () => {
    setFilterText('');
    setStatusFilter('ALL');
    setCategoryFilter('ALL');
    setSubCategoryFilter('ALL');
    setPriorityFilter('ALL');
    setStartDate('');
    setEndDate('');
  };

  const hasActiveFilters =
    filterText !== '' ||
    statusFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    subCategoryFilter !== 'ALL' ||
    priorityFilter !== 'ALL' ||
    startDate !== '' ||
    endDate !== '';

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Customer Requirements & Bulk Dashboard
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Stage 1 of 10: Automatic category recommendation, ranked supplier matching, and Excel bulk management
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* View Mode Toggle: Register vs Bulk Table vs Cards */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('REGISTER')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'REGISTER'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Requirement Register with Company & Purchase Executive filters and PDF/Excel export"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Requirement Register</span>
            </button>

            <button
              onClick={() => setViewMode('BULK_TABLE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'BULK_TABLE'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Bulk Requirement Dashboard Table"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Bulk Items Grid</span>
            </button>

            <button
              onClick={() => setViewMode('CARDS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'CARDS'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Visual Multi-Item Cards View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards View</span>
            </button>
          </div>

          {(currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'PROCUREMENT_EMPLOYEE') && (
            <button
              onClick={() => setIsBulkImportOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold shadow-xs transition-all"
              title="Upload multi-row Excel (.xlsx) bill of materials"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Bulk Import (Excel)</span>
            </button>
          )}

          {(currentUser.role === 'SUPER_ADMIN' ||
            currentUser.role === 'PROCUREMENT_EMPLOYEE' ||
            currentUser.role === 'CUSTOMER') && (
            <button
              onClick={onOpenNewModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Requirement</span>
            </button>
          )}
        </div>
      </div>

      {viewMode === 'REGISTER' && (
        <RequirementRegisterView
          onOpenNewModal={onOpenNewModal}
          onOpenBulkModal={() => setIsBulkImportOpen(true)}
          onSelectOrder={onSelectOrder}
        />
      )}

      {viewMode !== 'REGISTER' && (
        <>
          {/* KPI Stats Quick Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Requirements
              </span>
              <div className="text-xl font-bold font-mono text-slate-800 mt-0.5">
                {visibleRequirements.length} orders
              </div>
            </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Line Items Tracked
          </span>
          <div className="text-xl font-bold font-mono text-blue-700 mt-0.5">
            {flattenedItemRows.length} items
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Suppliers Assigned
          </span>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-0.5">
            {flattenedItemRows.filter((r) => r.selectedVendorName).length} / {flattenedItemRows.length}
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            High Priority Spares
          </span>
          <div className="text-xl font-bold font-mono text-rose-700 mt-0.5">
            {flattenedItemRows.filter((r) => r.priority === 'High').length} items
          </div>
        </div>
      </div>

      {/* Comprehensive Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search box */}
          <div className="relative">
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search Req #, Item, Spec, Customer..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setSubCategoryFilter('ALL');
              }}
              className="w-full text-xs py-1.5 px-2.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-800"
            >
              <option value="ALL">All Material Categories (30)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sub-Category Filter */}
          <div>
            <select
              value={subCategoryFilter}
              onChange={(e) => setSubCategoryFilter(e.target.value)}
              disabled={availableSubCategories.length === 0}
              className="w-full text-xs py-1.5 px-2.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-800 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="ALL">
                {availableSubCategories.length > 0 ? 'All Sub-Categories' : 'Select Category first'}
              </option>
              {availableSubCategories.map((sub, sIdx) => (
                <option key={sIdx} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full text-xs py-1.5 px-2.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-800"
            >
              <option value="ALL">All Priorities</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>
          </div>
        </div>

        {/* Date Range, Status & Actions Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 font-medium">Status:</span>
            {['ALL', 'NEW_REQUIREMENT', 'ENQUIRY_SENT', 'RATE_RECEIVED', 'ORDER_CLOSED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-colors ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-slate-600">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Received:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1 border border-slate-300 rounded text-xs"
              />
              <span>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1 border border-slate-300 rounded text-xs"
              />
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="px-2.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-semibold"
              >
                Clear Filters
              </button>
            )}

            <button
              onClick={handleExportDashboardExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all shadow-2xs"
              title="Download Excel spreadsheet of the dashboard items"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Dashboard (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: BULK REQUIREMENT DASHBOARD (Table View with all 13 columns specified in Prompt) */}
      {viewMode === 'BULK_TABLE' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-blue-600" />
              <span className="font-bold text-slate-800">
                Bulk Requirement Dashboard
              </span>
              <span className="text-slate-400 font-mono">
                ({filteredDashboardRows.length} item records)
              </span>
            </div>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Click any Recommended Vendor badge to view ranked suppliers or assign instantly
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100/70 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="py-3 px-3">Requirement ID</th>
                  <th className="py-3 px-3">Item Name</th>
                  <th className="py-3 px-3">Description / Spec</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-2 text-center">Qty & UOM</th>
                  <th className="py-3 px-3">Received Date</th>
                  <th className="py-3 px-2">Priority</th>
                  <th className="py-3 px-3">Req Status</th>
                  <th className="py-3 px-3 text-center">Rec. Vendors</th>
                  <th className="py-3 px-3">Selected Vendor</th>
                  <th className="py-3 px-3">Rate Status</th>
                  <th className="py-3 px-3">Remarks</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredDashboardRows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-400 text-xs">
                      No requirement line items found matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredDashboardRows.map((row, idx) => {
                    return (
                      <tr key={`${row.requirementId}-${row.item.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                        {/* 1. Requirement ID */}
                        <td className="py-3 px-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                          <button
                            onClick={() => onSelectOrder(row.requirementId)}
                            className="hover:underline flex items-center gap-1 text-left"
                            title="View 12-stage order pipeline"
                          >
                            <span>{row.requirementId}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </button>
                          <div className="text-[10px] font-normal text-slate-400">{row.customerName}</div>
                        </td>

                        {/* 2. Item Name */}
                        <td className="py-3 px-3 font-bold text-slate-900 max-w-xs">
                          {row.itemName}
                        </td>

                        {/* 3. Description */}
                        <td className="py-3 px-3 text-slate-600 max-w-xs truncate" title={row.description}>
                          {row.description}
                        </td>

                        {/* 4. Category */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-blue-50 text-blue-800 border border-blue-200">
                            {row.category}
                          </span>
                          {row.subCategory && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {row.subCategory}
                            </div>
                          )}
                        </td>

                        {/* 5. Quantity & UOM */}
                        <td className="py-3 px-2 font-mono font-bold text-slate-900 text-center whitespace-nowrap">
                          {row.quantity} {row.uom}
                        </td>

                        {/* 6. Received Date */}
                        <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                          <div>{row.receivedDate || row.requiredDate}</div>
                          {row.expectedDeliveryDate && (
                            <div className="text-[10px] text-slate-400 font-sans">
                              Exp: {row.expectedDeliveryDate}
                            </div>
                          )}
                        </td>

                        {/* 7. Priority */}
                        <td className="py-3 px-2 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              row.priority === 'High'
                                ? 'bg-rose-100 text-rose-700'
                                : row.priority === 'Low'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {row.priority}
                          </span>
                        </td>

                        {/* 8. Requirement Status */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              row.status === 'NEW_REQUIREMENT'
                                ? 'bg-blue-100 text-blue-800'
                                : row.status === 'ENQUIRY_SENT'
                                ? 'bg-amber-100 text-amber-800'
                                : row.status === 'RATE_RECEIVED'
                                ? 'bg-purple-100 text-purple-800'
                                : row.status === 'ORDER_CLOSED'
                                ? 'bg-slate-100 text-slate-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {row.status.replace(/_/g, ' ')}
                          </span>
                        </td>

                        {/* 9. Recommended Vendor Count */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSelectedReqForVendors(row.req);
                              setSelectedItemForVendors(row.item);
                            }}
                            className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors inline-flex items-center gap-1 shadow-2xs"
                            title="Click to view full ranked vendor dossier and previous supplies"
                          >
                            <Building className="w-3 h-3 text-emerald-600" />
                            <span>{row.recommendedVendorCount} Vendors</span>
                          </button>
                        </td>

                        {/* 10. Selected Vendor */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {row.selectedVendorName ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1 w-max">
                              <Check className="w-3 h-3" />
                              <span>{row.selectedVendorName}</span>
                            </span>
                          ) : row.recommendedVendorsList.length > 0 ? (
                            <button
                              onClick={() => {
                                const top = row.recommendedVendorsList[0];
                                assignVendorToRequirementItem(
                                  row.requirementId,
                                  row.item.id,
                                  top.vendorId,
                                  top.vendorName
                                );
                              }}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 transition-colors"
                              title={`Accept recommended supplier #${1}: ${row.recommendedVendorsList[0].vendorName}`}
                            >
                              + Accept #{row.recommendedVendorsList[0].vendorName.slice(0, 14)}...
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">None Tagged</span>
                          )}
                        </td>

                        {/* 11. RFQ/Quotation Status */}
                        <td className="py-3 px-3 text-[11px] whitespace-nowrap font-medium text-slate-600">
                          {row.rfqStatus}
                        </td>

                        {/* 12. Remarks */}
                        <td className="py-3 px-3 text-[11px] text-slate-500 max-w-xs truncate" title={row.remarks}>
                          {row.remarks || '-'}
                        </td>

                        {/* 13. Actions */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                if (onOpenRateModal) onOpenRateModal(row.requirementId);
                                else setDirectRateReqId(row.requirementId);
                              }}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition-colors flex items-center gap-1 shadow-2xs"
                              title="Direct Vendor Rate Entry"
                            >
                              <DollarSign className="w-3 h-3" />
                              <span>Enter Rate</span>
                            </button>

                            <button
                              onClick={() => {
                                setSelectedReqForVendors(row.req);
                                setSelectedItemForVendors(row.item);
                              }}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[11px] font-bold transition-colors"
                              title="Inspect matched suppliers and contact details"
                            >
                              Suppliers
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
      )}

      {/* VIEW MODE 2: CARD PIPELINE VIEW */}
      {viewMode === 'CARDS' && (
        <div className="space-y-4">
          {filteredCardReqs.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500 text-xs">
              No requirements found matching current criteria.
            </div>
          ) : (
            filteredCardReqs.map((req) => (
              <div
                key={req.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-blue-300 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-extrabold font-mono text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                      {req.id}
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{req.customerName}</h3>
                      <p className="text-xs text-slate-500">
                        Attn: {req.contactPerson} • {req.customerMobile}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {req.commercialLock?.isLocked && (
                      <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-400 text-amber-950 shadow-xs">
                        <Lock className="w-3 h-3" />
                        <span>COMMERCIALS LOCKED</span>
                      </span>
                    )}

                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        req.status === 'NEW_REQUIREMENT'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : req.status === 'ENQUIRY_SENT'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : req.status === 'RATE_RECEIVED'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : req.status === 'ORDER_CLOSED'
                          ? 'bg-slate-100 text-slate-800 border border-slate-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {req.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {/* Items List inside Requirement */}
                <div className="mt-4">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Line Items ({(req.items || []).length})</span>
                    <span className="text-slate-500 font-normal">
                      Received: <strong className="text-slate-700">{req.receivedRequirementDate || req.requirementDate || req.requiredDeliveryDate}</strong>
                      {req.expectedDeliveryDate && (
                        <span className="ml-2 pl-2 border-l border-slate-300">
                          Expected Delivery: <strong className="text-slate-700">{req.expectedDeliveryDate}</strong>
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Item Description</th>
                          <th className="py-2.5 px-3">Part # / Model</th>
                          <th className="py-2.5 px-3">Category & Brand</th>
                          <th className="py-2.5 px-3">Qty & UOM</th>
                          <th className="py-2.5 px-3">Target Price</th>
                          <th className="py-2.5 px-3 text-right">Vendor Matching</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(req.items || []).map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-semibold text-slate-900">
                              {item.itemName}
                              <div className="text-[10px] text-slate-400 font-normal">{item.specification}</div>
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">
                              {item.partNumber}
                            </td>
                            <td className="py-2 px-3">
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-700">
                                {item.category} • {item.brand}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-900">
                              {item.quantity} {item.uom}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-700">
                              {item.targetPrice ? `₹${item.targetPrice.toLocaleString('en-IN')}` : '-'}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                onClick={() => {
                                  setSelectedReqForVendors(req);
                                  setSelectedItemForVendors(item);
                                }}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold"
                              >
                                {item.selectedVendorName ? item.selectedVendorName : 'View Suppliers'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium">Attachments:</span>
                    {(req.attachments || []).length > 0 ? (
                      (req.attachments || []).map((att, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium border border-slate-200 flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3 text-slate-400" />
                          <span>{att.name}</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">None attached</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Direct Vendor Rate Entry Action */}
                    <button
                      onClick={() => {
                        if (onOpenRateModal) onOpenRateModal(req.id);
                        else setDirectRateReqId(req.id);
                      }}
                      className="px-3 py-1.5 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 font-bold shadow-xs flex items-center gap-1.5 transition-colors"
                      title="Direct Vendor Rate Entry"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Add Vendor Rate</span>
                    </button>

                    {/* Direct Rate Comparison Action if quotes exist */}
                    {vendorQuotes.some((q) => q.requirementId === req.id) && (
                      <button
                        onClick={() => setActiveTab('rate-comparison')}
                        className="px-2.5 py-1.5 rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-bold border border-indigo-200 flex items-center gap-1.5 transition-colors"
                        title="Proceed to Rate Comparison & Sourcing"
                      >
                        <Scale className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Compare Rates</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setSelectedReqForVendors(req);
                        setSelectedItemForVendors((req.items || [])[0]);
                      }}
                      className="px-2.5 py-1 rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 font-bold border border-blue-200 flex items-center gap-1.5 transition-colors shadow-2xs"
                      title="View ranked certified suppliers and past quotation history"
                    >
                      <Building className="w-3.5 h-3.5 text-blue-600" />
                      <span>View Relevant Vendors</span>
                    </button>

                    <button
                      onClick={() => setAuditReqId(req.id)}
                      className="px-2.5 py-1 rounded-lg text-slate-700 bg-slate-50 hover:bg-slate-100 font-semibold border border-slate-300 flex items-center gap-1.5 transition-colors"
                      title="Audit earning rules, check what was verified right, and open or lock"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span className="hidden sm:inline">Earning Rules & Lock</span>
                    </button>

                    <button
                      onClick={() => handleShareWhatsApp(req)}
                      className="px-2.5 py-1 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-semibold border border-emerald-200 flex items-center gap-1 transition-colors"
                      title="Share via WhatsApp"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </button>

                    <button
                      onClick={() => onSelectOrder(req.id)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg font-bold shadow-xs transition-colors flex items-center gap-1"
                    >
                      <span>Order Timeline</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    {isSuperAdmin && (
                      <button
                        onClick={() => {
                          purgeRequirement(req.id);
                        }}
                        className="px-2.5 py-1.5 text-rose-600 hover:text-white hover:bg-rose-600 rounded-lg font-bold border border-rose-200 transition-colors flex items-center gap-1 shadow-2xs"
                        title="Permanent Delete (Super Admin Power - No Prompts)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      </>
      )}

      {/* Earning Rules & Lock / Mail Verification Modal */}
      {auditReqId && (
        <EarningRulesAndLockModal
          isOpen={!!auditReqId}
          onClose={() => setAuditReqId(null)}
          requirementId={auditReqId}
        />
      )}

      {/* Relevant Vendors Modal */}
      {selectedReqForVendors && (
        <RelevantVendorsModal
          isOpen={!!selectedReqForVendors}
          onClose={() => {
            setSelectedReqForVendors(null);
            setSelectedItemForVendors(null);
          }}
          requirement={selectedReqForVendors}
          item={selectedItemForVendors}
        />
      )}

      {/* Bulk Requirement Import Modal */}
      <BulkRequirementImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
      />

      {/* Direct Vendor Rate Entry Modal */}
      {directRateReqId && (
        <DirectVendorRateEntryModal
          isOpen={!!directRateReqId}
          onClose={() => setDirectRateReqId(null)}
          defaultRequirementId={directRateReqId}
          onSuccess={() => setDirectRateReqId(null)}
        />
      )}
    </div>
  );
};
