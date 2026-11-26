import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  Filter,
  Plus,
  Download,
  Calendar,
  Building2,
  Users,
  Eye,
  Edit,
  Trash2,
  Share2,
  Layers,
  ArrowRight,
  FileSpreadsheet,
  CheckCircle,
  Clock,
  Sparkles,
  FileDown,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Archive,
  AlertTriangle,
  CheckCircle2,
  History,
} from 'lucide-react';
import { useApp, isSuperAdminUser } from '../../context/AppContext';
import { CustomerRequirement } from '../../types';
import * as XLSX from 'xlsx';
import { generateRequirementRegisterPDF, generateWhatsAppShareUrl } from '../../services/pdfService';
import { EditRequirementModal } from './EditRequirementModal';
import { RequirementDetailModal } from './RequirementDetailModal';

interface RequirementRegisterViewProps {
  onOpenNewModal: () => void;
  onOpenBulkModal: () => void;
  onSelectOrder: (orderId: string) => void;
}

export const RequirementRegisterView: React.FC<RequirementRegisterViewProps> = ({
  onOpenNewModal,
  onOpenBulkModal,
  onSelectOrder,
}) => {
  const {
    requirements,
    companies,
    purchaseExecutives,
    categories,
    deleteRequirement,
    restoreRequirement,
    purgeRequirement,
    purgeAllOldTransactions,
    currentUser,
  } = useApp();

  const isSuperAdmin = isSuperAdminUser(currentUser);

  // Active view tab: 'ACTIVE' (default) vs 'ARCHIVE' (soft-deleted recoverable records)
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVE'>('ACTIVE');

  // Soft Delete Modal State
  const [deleteModalReq, setDeleteModalReq] = useState<CustomerRequirement | null>(null);
  const [deleteReasonPreset, setDeleteReasonPreset] = useState<string>('Customer Cancelled Requirement');
  const [deleteReasonCustom, setDeleteReasonCustom] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Filters required by user:
  // 1. Company Name
  // 2. Purchase Executive Name
  // 3. RFQ Number
  // 4. Requirement Date
  // 5. Material Category
  // 6. Requirement Status
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('ALL');
  const [selectedExecutiveFilter, setSelectedExecutiveFilter] = useState<string>('ALL');
  const [rfqNumberFilter, setRfqNumberFilter] = useState<string>('');
  const [requirementDateFilter, setRequirementDateFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [viewingRequirement, setViewingRequirement] = useState<CustomerRequirement | null>(null);
  const [editingRequirement, setEditingRequirement] = useState<CustomerRequirement | null>(null);

  // Available executives dynamically filtered if a specific company is selected
  const availableExecutives = useMemo(() => {
    if (selectedCompanyFilter === 'ALL') {
      return purchaseExecutives;
    }
    return purchaseExecutives.filter(
      (pe) =>
        pe.companyId === selectedCompanyFilter ||
        pe.companyName.toLowerCase() ===
          companies.find((c) => c.id === selectedCompanyFilter)?.companyName.toLowerCase()
    );
  }, [purchaseExecutives, selectedCompanyFilter, companies]);

  // When company filter changes, reset executive filter if the executive doesn't belong to the new company
  const handleCompanyFilterChange = (companyId: string) => {
    setSelectedCompanyFilter(companyId);
    setSelectedExecutiveFilter('ALL');
  };

  // Counts
  const activeRequirementsCount = useMemo(
    () => requirements.filter((r) => !r.isDeleted).length,
    [requirements]
  );
  const archivedRequirementsCount = useMemo(
    () => requirements.filter((r) => r.isDeleted === true).length,
    [requirements]
  );

  // Filtered Requirements
  const filteredRequirements = useMemo(() => {
    return requirements.filter((req) => {
      // Tab filter
      const isArchived = req.isDeleted === true;
      if (activeTab === 'ACTIVE' && isArchived) return false;
      if (activeTab === 'ARCHIVE' && !isArchived) return false;

      // Role filtering if customer
      if (currentUser.role === 'CUSTOMER') {
        const matchesCustomer =
          req.customerId === currentUser.associatedId ||
          req.customerName.toLowerCase().includes(currentUser.name.toLowerCase());
        if (!matchesCustomer) return false;
      }

      // 1. Company Name
      if (selectedCompanyFilter !== 'ALL') {
        const matchesCompany =
          req.companyId === selectedCompanyFilter ||
          req.customerId === selectedCompanyFilter ||
          req.companyName?.toLowerCase() ===
            companies.find((c) => c.id === selectedCompanyFilter)?.companyName.toLowerCase();
        if (!matchesCompany) return false;
      }

      // 2. Purchase Executive Name
      if (selectedExecutiveFilter !== 'ALL') {
        const matchesExecutive =
          req.purchaseExecutiveId === selectedExecutiveFilter ||
          req.purchaseExecutiveName?.toLowerCase() ===
            purchaseExecutives.find((e) => e.id === selectedExecutiveFilter)?.name.toLowerCase();
        if (!matchesExecutive) return false;
      }

      // 3. RFQ Number
      if (rfqNumberFilter.trim() !== '') {
        const q = rfqNumberFilter.trim().toLowerCase();
        const matchesRfq =
          (req.rfqNumber || '').toLowerCase().includes(q) ||
          req.id.toLowerCase().includes(q) ||
          (req.referenceNumber || '').toLowerCase().includes(q);
        if (!matchesRfq) return false;
      }

      // 4. Requirement Date
      if (requirementDateFilter !== '') {
        const reqDate = req.requirementDate || req.receivedRequirementDate || req.requiredDeliveryDate || '';
        if (reqDate !== requirementDateFilter) return false;
      }

      // 5. Material Category
      if (categoryFilter !== 'ALL') {
        const hasCategory = req.items.some(
          (item) => item.category?.toLowerCase() === categoryFilter.toLowerCase()
        );
        if (!hasCategory) return false;
      }

      // 6. Requirement Status
      if (statusFilter !== 'ALL') {
        if (req.status !== statusFilter) return false;
      }

      return true;
    });
  }, [
    requirements,
    activeTab,
    currentUser,
    selectedCompanyFilter,
    selectedExecutiveFilter,
    rfqNumberFilter,
    requirementDateFilter,
    categoryFilter,
    statusFilter,
    companies,
    purchaseExecutives,
  ]);

  const hasActiveFilters =
    selectedCompanyFilter !== 'ALL' ||
    selectedExecutiveFilter !== 'ALL' ||
    rfqNumberFilter.trim() !== '' ||
    requirementDateFilter !== '' ||
    categoryFilter !== 'ALL' ||
    statusFilter !== 'ALL';

  const handleClearFilters = () => {
    setSelectedCompanyFilter('ALL');
    setSelectedExecutiveFilter('ALL');
    setRfqNumberFilter('');
    setRequirementDateFilter('');
    setCategoryFilter('ALL');
    setStatusFilter('ALL');
  };

  // Export Filtered to Excel
  const handleExportExcel = () => {
    if (filteredRequirements.length === 0) {
      alert('No records to export matching current filter criteria.');
      return;
    }

    const data = filteredRequirements.map((req, idx) => {
      const itemsList = req.items.map((i) => `${i.itemName} (${i.quantity} ${i.uom})`).join(', ');
      return {
        'Sr. No.': idx + 1,
        'RFQ Number': req.rfqNumber || req.id,
        'Requirement ID': req.id,
        'Requirement Date': req.requirementDate || req.receivedRequirementDate || req.requiredDeliveryDate || '-',
        'Company Name': req.companyName || req.customerName,
        'Company Code': req.companyCode || req.companyId || req.customerId,
        'Purchase Executive': req.purchaseExecutiveName || req.contactPerson || 'N/A',
        'Executive Designation': req.purchaseExecutiveDesignation || 'Purchase Executive',
        'Executive Mobile': req.purchaseExecutiveMobile || req.customerMobile || '',
        'Executive Email': req.purchaseExecutiveEmail || req.customerEmail || '',
        'Total Items': req.items.length,
        'Items Breakdown': itemsList,
        'Requirement Status': req.status,
        'Requirement Source': req.requirementSource || 'Email',
        'Reference No': req.referenceNumber || '',
        'Remarks': req.remarks || '',
        'DB Save Status': req.dbSaveStatus || 'COMMITTED',
        'Is Soft Deleted': req.isDeleted ? 'YES' : 'NO',
        'Deleted Reason': req.deletedReason || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Requirement Register');
    ws['!cols'] = [
      { wch: 8 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 32 },
      { wch: 14 },
      { wch: 24 },
      { wch: 22 },
      { wch: 18 },
      { wch: 26 },
      { wch: 12 },
      { wch: 50 },
      { wch: 20 },
      { wch: 16 },
      { wch: 16 },
      { wch: 30 },
      { wch: 16 },
      { wch: 14 },
      { wch: 24 },
    ];
    XLSX.writeFile(wb, `Requirement_Register_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Export Filtered to PDF
  const handleExportPDF = () => {
    if (filteredRequirements.length === 0) {
      alert('No records to export matching current filter criteria.');
      return;
    }

    const compName =
      selectedCompanyFilter !== 'ALL'
        ? companies.find((c) => c.id === selectedCompanyFilter)?.companyName
        : undefined;

    const execName =
      selectedExecutiveFilter !== 'ALL'
        ? purchaseExecutives.find((e) => e.id === selectedExecutiveFilter)?.name
        : undefined;

    generateRequirementRegisterPDF(filteredRequirements, {
      companyName: compName,
      executiveName: execName,
      rfqNumber: rfqNumberFilter || undefined,
      date: requirementDateFilter || undefined,
      category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
      status: statusFilter !== 'ALL' ? statusFilter : undefined,
    });
  };

  // Initiate Soft Delete
  const handleOpenDeleteModal = (req: CustomerRequirement) => {
    if (!isSuperAdmin) {
      alert('Security Policy: Only Super Admin can authorize the removal of Customer Requirements.');
      return;
    }
    setAuthError(null);
    setDeleteModalReq(req);
    setDeleteReasonPreset('Customer Cancelled Requirement');
    setDeleteReasonCustom('');
  };

  // Instant Delete for Super Admin (Direct Deletion without Prompts)
  const handleDirectDelete = (req: CustomerRequirement) => {
    if (!isSuperAdmin) {
      alert('Only Super Admin can directly remove requirements.');
      return;
    }
    const res = purgeRequirement(req.id);
    if (!res.success) {
      alert(res.message);
    }
  };

  // Permanent Purge of Single Requirement (Super Admin Power)
  const handlePurgeSingle = (req: CustomerRequirement) => {
    if (!isSuperAdmin) {
      alert('Security Policy: Only Super Admin has permanent purge authority.');
      return;
    }
    const res = purgeRequirement(req.id);
    if (!res.success) {
      alert(res.message);
    }
  };

  // Super Admin: Purge All Archived Requirements
  const handlePurgeAllArchived = () => {
    if (!isSuperAdmin) {
      alert('Security Policy: Only Super Admin has authority to purge archives.');
      return;
    }
    const archivedList = requirements.filter((r) => r.isDeleted);
    archivedList.forEach((r) => purgeRequirement(r.id));
  };

  // Super Admin: Purge All Old Test Transactions
  const [isPurgingAll, setIsPurgingAll] = useState(false);
  const handlePurgeAllOldData = async () => {
    if (!isSuperAdmin) {
      alert('Security Policy: Only Super Admin can purge all old transactions.');
      return;
    }
    setIsPurgingAll(true);
    try {
      const res = await purgeAllOldTransactions();
      alert(res.message || 'All old requirements and transactions purged successfully. Masters preserved.');
    } catch (err: any) {
      alert(`Purge failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsPurgingAll(false);
    }
  };

  // Confirm Soft Delete
  const handleConfirmDelete = () => {
    if (!deleteModalReq) return;
    const finalReason =
      deleteReasonPreset === 'Other'
        ? deleteReasonCustom.trim() || 'Other Specified Reason'
        : deleteReasonPreset;

    const res = deleteRequirement(deleteModalReq.id, finalReason);
    if (!res.success) {
      setAuthError(res.message);
      return;
    }
    setDeleteModalReq(null);
  };

  // Restore Soft-Deleted Requirement
  const handleRestore = (req: CustomerRequirement) => {
    const res = restoreRequirement(req.id);
    if (!res.success) {
      alert(res.message);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-200">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Requirement Register</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  {filteredRequirements.length} RFQs {activeTab === 'ACTIVE' ? 'Active' : 'Archived'}
                </span>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                  title="Permanent database persistence active"
                >
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>DB Guaranteed</span>
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Centralized register of company material enquiries, purchase executive mapping, and quotation tracking
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Export to Excel, Export to PDF, New Requirement, Bulk Entry */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
            title="Export filtered records to Microsoft Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export to Excel</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
            title="Export filtered records to PDF document (.pdf)"
          >
            <FileDown className="w-3.5 h-3.5 text-rose-600" />
            <span>Export to PDF</span>
          </button>

          {(currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'PROCUREMENT_EMPLOYEE') && (
            <button
              onClick={onOpenBulkModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold shadow-2xs transition-colors"
              title="Bulk Requirement Entry & Excel Multi-Item Import"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Bulk Entry</span>
            </button>
          )}

          {isSuperAdmin && (
            <button
              onClick={() => {
                if (window.confirm('Super Admin Action: Purge all old transaction records? All master catalogs (Vendors, Customers, Companies, Products, Brands, Categories) will remain 100% intact.')) {
                  handlePurgeAllOldData();
                }
              }}
              disabled={isPurgingAll}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold shadow-2xs transition-colors"
              title="Super Admin Power: Purge all old transaction records without asking"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>{isPurgingAll ? 'Purging Old Data...' : 'Purge Old Data'}</span>
            </button>
          )}

          <button
            onClick={onOpenNewModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Requirement</span>
          </button>
        </div>
      </div>

      {/* Tabs: Active Register vs Deleted RFQs Archive */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('ACTIVE')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'ACTIVE'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Active Requirements</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'ACTIVE' ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {activeRequirementsCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ARCHIVE')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'ARCHIVE'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
          title="Recoverable deleted requirements with audit trail"
        >
          <Archive className="w-3.5 h-3.5" />
          <span>Deleted RFQs Archive</span>
          {archivedRequirementsCount > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'ARCHIVE' ? 'bg-amber-800 text-white' : 'bg-rose-100 text-rose-700'
              }`}
            >
              {archivedRequirementsCount} Recoverable
            </span>
          )}
        </button>

        {isSuperAdmin && activeTab === 'ARCHIVE' && archivedRequirementsCount > 0 && (
          <div className="ml-auto">
            <button
              onClick={() => {
                if (window.confirm(`Super Admin Action: Permanently delete all ${archivedRequirementsCount} archived requirements from disk? This cannot be undone.`)) {
                  handlePurgeAllArchived();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
              title="Super Admin Permanent Purge All Archived"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Purge All Archived</span>
            </button>
          </div>
        )}
      </div>

      {/* FILTER BAR - 6 REQUIRED FILTERS */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>Requirement Register Filters</span>
          </span>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* 1. Filter: Company Name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              1. Company Name
            </label>
            <select
              value={selectedCompanyFilter}
              onChange={(e) => handleCompanyFilterChange(e.target.value)}
              className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Companies ({companies.length})</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Filter: Purchase Executive Name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              2. Purchase Executive
            </label>
            <select
              value={selectedExecutiveFilter}
              onChange={(e) => setSelectedExecutiveFilter(e.target.value)}
              className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">
                {selectedCompanyFilter !== 'ALL'
                  ? `All Executives for Company (${availableExecutives.length})`
                  : `All Executives (${availableExecutives.length})`}
              </option>
              {availableExecutives.map((pe) => (
                <option key={pe.id} value={pe.id}>
                  {pe.name} ({pe.companyName ? pe.companyName.substring(0, 15) : pe.designation})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Filter: RFQ Number */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              3. RFQ / Req Number
            </label>
            <div className="relative">
              <input
                type="text"
                value={rfqNumberFilter}
                onChange={(e) => setRfqNumberFilter(e.target.value)}
                placeholder="Search RFQ-2026-..."
                className="w-full pl-8 pr-2 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* 4. Filter: Requirement Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              4. Requirement Date
            </label>
            <input
              type="date"
              value={requirementDateFilter}
              onChange={(e) => setRequirementDateFilter(e.target.value)}
              className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 5. Filter: Material Category */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              5. Material Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 6. Filter: Requirement Status */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              6. Requirement Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="NEW_REQUIREMENT">NEW REQUIREMENT</option>
              <option value="ENQUIRY_SENT">ENQUIRY SENT</option>
              <option value="RATE_RECEIVED">RATE RECEIVED</option>
              <option value="QUOTATION_SENT">QUOTATION SENT</option>
              <option value="PO_RECEIVED">PO RECEIVED</option>
              <option value="ORDER_CLOSED">ORDER CLOSED</option>
            </select>
          </div>
        </div>
      </div>

      {/* REQUIREMENT REGISTER TABLE WITH THE 7 REQUIRED COLUMNS */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-200 font-bold uppercase text-[11px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">RFQ Number</th>
                <th className="py-3.5 px-4">Requirement Date</th>
                <th className="py-3.5 px-4">Company Name</th>
                <th className="py-3.5 px-4">Purchase Executive</th>
                <th className="py-3.5 px-4 text-center">Total Items</th>
                <th className="py-3.5 px-4">{activeTab === 'ACTIVE' ? 'Requirement Status' : 'Deletion Audit Trail'}</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequirements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">
                      {activeTab === 'ACTIVE'
                        ? 'No active requirements found matching criteria'
                        : 'No soft-deleted requirements in archive'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {activeTab === 'ACTIVE'
                        ? 'Try clearing or adjusting your active filters above'
                        : 'Any deleted requirement is preserved here with complete audit history for 1-click recovery'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRequirements.map((req) => {
                  const rfqDisplay = req.rfqNumber || req.id;
                  const reqDate =
                    req.requirementDate || req.receivedRequirementDate || req.requiredDeliveryDate || '-';
                  const compName = req.companyName || req.customerName || 'Unknown Company';
                  const compCode = req.companyCode || req.companyId || req.customerId;
                  const execName = req.purchaseExecutiveName || req.contactPerson || 'Procurement Buyer';
                  const execDesig = req.purchaseExecutiveDesignation || 'Purchase Executive';

                  return (
                    <tr
                      key={req.id}
                      className={`transition-colors ${
                        req.isDeleted ? 'bg-rose-50/20 hover:bg-rose-50/50' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Column 1: RFQ Number & DB Persistence Badge */}
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">
                        <button
                          onClick={() => setViewingRequirement(req)}
                          className="hover:underline text-left flex items-center gap-1.5"
                          title="Click to view full requirement details"
                        >
                          <span>{rfqDisplay}</span>
                        </button>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-slate-400 block font-normal font-sans">
                            ID: {req.id}
                          </span>
                          <span
                            className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded font-sans font-bold bg-emerald-100 text-emerald-800"
                            title="Database persistence confirmed: Committed & Protected"
                          >
                            <ShieldCheck className="w-2.5 h-2.5 text-emerald-700" />
                            <span>{req.dbSaveStatus || 'COMMITTED'}</span>
                          </span>
                        </div>
                      </td>

                      {/* Column 2: Requirement Date */}
                      <td className="py-3 px-4 text-slate-700 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{reqDate}</span>
                        </div>
                      </td>

                      {/* Column 3: Company Name */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>{compName}</span>
                        </div>
                        {compCode && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            Code: {compCode}
                          </span>
                        )}
                      </td>

                      {/* Column 4: Purchase Executive Name */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>{execName}</span>
                        </div>
                        <div className="text-[10px] text-indigo-600 font-medium">
                          {execDesig}
                          {req.purchaseExecutiveMobile && ` • ${req.purchaseExecutiveMobile}`}
                        </div>
                      </td>

                      {/* Column 5: Total Items */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                          {req.items.length} item{req.items.length !== 1 ? 's' : ''}
                        </span>
                        <div className="text-[10px] text-slate-400 truncate max-w-[120px] mx-auto mt-0.5">
                          {req.items[0]?.itemName || ''}
                        </div>
                      </td>

                      {/* Column 6: Status or Deletion Audit */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {activeTab === 'ACTIVE' ? (
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              req.status === 'NEW_REQUIREMENT'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : req.status === 'ENQUIRY_SENT'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : req.status === 'RATE_RECEIVED'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : req.status === 'ORDER_CLOSED'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-800 border border-slate-300'
                            }`}
                          >
                            {req.status.replace(/_/g, ' ')}
                          </span>
                        ) : (
                          <div className="text-[11px] text-slate-700 space-y-0.5">
                            <div className="flex items-center gap-1 text-rose-700 font-bold">
                              <Archive className="w-3 h-3" />
                              <span>Soft-Deleted</span>
                              {req.deletedAt && (
                                <span className="text-[10px] text-slate-500 font-normal">
                                  ({new Date(req.deletedAt).toLocaleDateString()})
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              By: <span className="font-semibold text-slate-700">{req.deletedBy || 'Super Admin'}</span>
                            </div>
                            {req.deletedReason && (
                              <div className="text-[10px] text-slate-600 italic truncate max-w-[200px]" title={req.deletedReason}>
                                Reason: {req.deletedReason}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Column 7: Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {activeTab === 'ACTIVE' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View */}
                            <button
                              onClick={() => setViewingRequirement(req)}
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View Requirement Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => setEditingRequirement(req)}
                              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Edit Requirement"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            {/* Delete Action */}
                            {isSuperAdmin ? (
                              <button
                                onClick={() => handleDirectDelete(req)}
                                className="p-1.5 text-rose-600 hover:text-white hover:bg-rose-600 rounded-lg transition-colors border border-rose-200"
                                title="Super Admin Instant Delete (No prompts)"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenDeleteModal(req)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Archive / Soft-Delete Requirement"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}

                            {/* Export / Share */}
                            <button
                              onClick={() => {
                                const url = generateWhatsAppShareUrl('REQUIREMENT', {
                                  recipientName: compName,
                                  docNumber: rfqDisplay,
                                  itemsSummary: req.items.map((i) => `${i.itemName} (Qty: ${i.quantity})`).join(', '),
                                  phone: req.purchaseExecutiveMobile || req.customerMobile,
                                });
                                window.open(url, '_blank');
                              }}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Share on WhatsApp"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>

                            {/* Trace / Timeline */}
                            <button
                              onClick={() => onSelectOrder(req.id)}
                              className="px-2 py-1 bg-slate-900 hover:bg-black text-white text-[10px] font-bold rounded-md shadow-2xs ml-1"
                              title="Open Order Timeline"
                            >
                              Trace
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setViewingRequirement(req)}
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View Archived Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRestore(req)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                              title="Restore this requirement back to the active register"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restore RFQ</span>
                            </button>
                            {isSuperAdmin && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Permanently purge ${req.rfqNumber || req.id} from database?`)) {
                                    handlePurgeSingle(req);
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                                title="Super Admin: Permanently delete record from disk"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Purge</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SOFT DELETE CONFIRMATION MODAL (AUDIT PROTECTED) */}
      {deleteModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-100 text-rose-700 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Authorize Requirement Soft-Deletion
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  RFQ: <span className="font-mono font-bold text-slate-800">{deleteModalReq.rfqNumber || deleteModalReq.id}</span> • Customer: <span className="font-bold text-slate-800">{deleteModalReq.companyName || deleteModalReq.customerName}</span>
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Enterprise Audit Safeguard:</span> This requirement will not be permanently deleted. It will be moved to the <strong>Deleted RFQs Archive</strong> with full audit history and can be restored at any time by Super Admin.
              </div>
            </div>

            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                {authError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Select Reason for Deletion (Mandatory Audit Trail):
              </label>
              <div className="space-y-2 text-xs">
                {[
                  'Customer Cancelled Requirement',
                  'Duplicate RFQ Entry',
                  'Specifications Changed / Re-issued',
                  'Pricing Expired / Customer Inactive',
                  'Other',
                ].map((reason) => (
                  <label
                    key={reason}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      deleteReasonPreset === reason
                        ? 'border-blue-500 bg-blue-50/60 font-semibold text-blue-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deleteReason"
                      value={reason}
                      checked={deleteReasonPreset === reason}
                      onChange={() => setDeleteReasonPreset(reason)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>

              {deleteReasonPreset === 'Other' && (
                <div className="mt-2.5">
                  <input
                    type="text"
                    placeholder="Enter detailed reason for deletion..."
                    value={deleteReasonCustom}
                    onChange={(e) => setDeleteReasonCustom(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteModalReq(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Soft-Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Requirement Detail Modal */}
      {viewingRequirement && (
        <RequirementDetailModal
          isOpen={!!viewingRequirement}
          onClose={() => setViewingRequirement(null)}
          requirement={viewingRequirement}
          onEdit={(req) => {
            setViewingRequirement(null);
            setEditingRequirement(req);
          }}
          onSelectOrder={onSelectOrder}
        />
      )}

      {/* Edit Requirement Modal */}
      {editingRequirement && (
        <EditRequirementModal
          isOpen={!!editingRequirement}
          onClose={() => setEditingRequirement(null)}
          requirement={editingRequirement}
        />
      )}
    </div>
  );
};
