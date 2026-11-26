import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Search,
  Building,
  Mail,
  Phone,
  MapPin,
  FileText,
  DollarSign,
  TrendingUp,
  X,
  CheckCircle2,
  ExternalLink,
  Download,
  Upload,
  FileSpreadsheet,
  Trash2,
  Edit,
  UserCheck,
  UserPlus,
  Users,
  Shield,
  Briefcase,
  AlertCircle,
  Hash,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Company, PurchaseExecutive } from '../../types';
import * as XLSX from 'xlsx';

export const CompanyMaster: React.FC = () => {
  const {
    companies,
    addCompany,
    updateCompany,
    deleteCompany,
    purchaseExecutives,
    addPurchaseExecutive,
    updatePurchaseExecutive,
    deletePurchaseExecutive,
    requirements,
    customerQuotations,
    customerPOs,
    setSelectedOrderId,
    setActiveTab,
  } = useApp();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(companies[0]?.id || 'CMP-001');

  // Company Modals
  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false);
  const [isEditCompanyOpen, setIsEditCompanyOpen] = useState(false);

  // Purchase Executive Modals
  const [isAddExecOpen, setIsAddExecOpen] = useState(false);
  const [isEditExecOpen, setIsEditExecOpen] = useState(false);
  const [execToEdit, setExecToEdit] = useState<PurchaseExecutive | null>(null);

  // Company Form state
  const [companyName, setCompanyName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [remarks, setRemarks] = useState('');

  // Purchase Executive Form state
  const [execName, setExecName] = useState('');
  const [execDesignation, setExecDesignation] = useState('Purchase Executive');
  const [execMobile, setExecMobile] = useState('');
  const [execEmail, setExecEmail] = useState('');
  const [execDepartment, setExecDepartment] = useState('General Purchase');
  const [execStatus, setExecStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [execRemarks, setExecRemarks] = useState('');

  // Filtered companies
  const filteredCompanies = companies.filter((c) => {
    const matchesSearch =
      c.companyName.toLowerCase().includes(search.toLowerCase()) ||
      (c.companyCode || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.gstin || c.gstNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.city || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.state || '').toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCompany =
    companies.find((c) => c.id === selectedCompanyId) || filteredCompanies[0] || companies[0];

  const linkedExecutives = purchaseExecutives.filter(
    (pe) => pe.companyId === activeCompany?.id || pe.companyName === activeCompany?.companyName
  );

  const linkedReqs = requirements.filter(
    (r) => r.companyId === activeCompany?.id || r.customerId === activeCompany?.id
  );
  const linkedQtns = customerQuotations.filter((q) => q.customerId === activeCompany?.id);
  const linkedPOs = customerPOs.filter((p) => p.customerId === activeCompany?.id);
  const totalValue =
    linkedPOs.reduce((sum, p) => sum + (p.poAmount || 0), 0) ||
    linkedQtns.reduce((sum, q) => sum + (q.grandTotal || 0), 0);

  // Open Edit Company
  const handleOpenEditCompany = (comp: Company) => {
    setCompanyName(comp.companyName);
    setGstNumber(comp.gstin || comp.gstNumber || '');
    setAddress(comp.address || '');
    setCity(comp.city || '');
    setState(comp.state || '');
    setPincode(comp.pincode || '');
    setStatus(comp.status || 'ACTIVE');
    setRemarks(comp.remarks || '');
    setIsEditCompanyOpen(true);
  };

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    if (isEditCompanyOpen && activeCompany) {
      updateCompany({
        ...activeCompany,
        companyName: companyName.trim(),
        gstin: gstNumber.trim().toUpperCase(),
        gstNumber: gstNumber.trim().toUpperCase(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        status,
        remarks: remarks.trim(),
      });
      setIsEditCompanyOpen(false);
    } else {
      const created = addCompany({
        companyName: companyName.trim(),
        gstin: gstNumber.trim().toUpperCase(),
        gstNumber: gstNumber.trim().toUpperCase(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        status,
        remarks: remarks.trim(),
      });
      setSelectedCompanyId(created.id);
      setIsAddCompanyOpen(false);
    }
  };

  // Open Edit Executive
  const handleOpenEditExec = (exec: PurchaseExecutive) => {
    setExecToEdit(exec);
    setExecName(exec.name);
    setExecDesignation(exec.designation);
    setExecMobile(exec.mobile);
    setExecEmail(exec.email || '');
    setExecDepartment(exec.department);
    setExecStatus(exec.status);
    setExecRemarks(exec.remarks || '');
    setIsEditExecOpen(true);
  };

  const handleSaveExecutive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!execName.trim() || !activeCompany) return;

    if (isEditExecOpen && execToEdit) {
      updatePurchaseExecutive({
        ...execToEdit,
        name: execName.trim(),
        designation: execDesignation.trim(),
        mobile: execMobile.trim(),
        email: execEmail.trim() || undefined,
        department: execDepartment.trim(),
        status: execStatus,
        remarks: execRemarks.trim() || undefined,
      });
      setIsEditExecOpen(false);
      setExecToEdit(null);
    } else {
      addPurchaseExecutive({
        companyId: activeCompany.id,
        companyName: activeCompany.companyName,
        name: execName.trim(),
        designation: execDesignation.trim(),
        mobile: execMobile.trim(),
        email: execEmail.trim() || undefined,
        department: execDepartment.trim(),
        status: execStatus,
        remarks: execRemarks.trim() || undefined,
      });
      setIsAddExecOpen(false);
    }
    // Reset form
    setExecName('');
    setExecMobile('');
    setExecEmail('');
    setExecRemarks('');
  };

  // Export to Excel
  const handleExportCompaniesExcel = () => {
    const exportData = companies.map((c, index) => {
      const execs = purchaseExecutives.filter((pe) => pe.companyId === c.id);
      const reqCount = requirements.filter((r) => r.companyId === c.id || r.customerId === c.id).length;
      return {
        'Sr. No.': index + 1,
        'Company Code': c.companyCode || c.id,
        'Company Name': c.companyName,
        'GST Number': c.gstin || c.gstNumber || 'N/A',
        'Address': c.address,
        'City': c.city,
        'State': c.state,
        'PIN Code': c.pincode,
        'Status': c.status,
        'Purchase Executives': execs.map((e) => `${e.name} (${e.designation} - ${e.mobile})`).join('; ') || 'None',
        'Total Requirements': reqCount,
        'Remarks': c.remarks || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Company Master');

    // Auto fit column widths
    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 14 },
      { wch: 32 },
      { wch: 18 },
      { wch: 35 },
      { wch: 16 },
      { wch: 16 },
      { wch: 10 },
      { wch: 12 },
      { wch: 45 },
      { wch: 18 },
      { wch: 30 },
    ];

    XLSX.writeFile(workbook, `Company_Master_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <span>Company Master</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {companies.length} Companies Registered
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage customer companies, GST details, plant locations, and linked purchase executives for RFQ routing
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportCompaniesExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => {
              setCompanyName('');
              setGstNumber('');
              setAddress('');
              setCity('');
              setState('');
              setPincode('');
              setStatus('ACTIVE');
              setRemarks('');
              setIsAddCompanyOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Company</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
            <span>Total Companies</span>
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{companies.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Customer enterprise accounts</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
            <span>Active Companies</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {companies.filter((c) => c.status === 'ACTIVE').length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Approved for active procurement</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
            <span>Purchase Executives</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-indigo-600">{purchaseExecutives.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Direct buyer contacts mapped</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
            <span>Linked Requirements</span>
            <FileText className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{requirements.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Inward indents & RFQ records</div>
        </div>
      </div>

      {/* Main Grid: Left List + Right Detail Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Search & Company List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Search & Filters */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by company name, code, GST, city..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[11px] font-semibold text-slate-500 mr-1">Status:</span>
              {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    statusFilter === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Company Cards List */}
          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {filteredCompanies.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-xs">
                No companies match your filters.
              </div>
            ) : (
              filteredCompanies.map((comp) => {
                const execs = purchaseExecutives.filter((pe) => pe.companyId === comp.id);
                const isSelected = comp.id === activeCompany?.id;
                return (
                  <div
                    key={comp.id}
                    onClick={() => setSelectedCompanyId(comp.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-50/60 border-blue-500 shadow-xs ring-1 ring-blue-500/30'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {comp.companyCode || comp.id}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              comp.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {comp.status}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {comp.companyName}
                        </h4>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            {comp.city}, {comp.state}
                          </span>
                          {comp.gstin && (
                            <span className="font-mono text-slate-600 font-semibold">
                              GST: {comp.gstin}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-[11px] font-bold border border-indigo-200">
                          <Users className="w-3 h-3" />
                          <span>{execs.length} Execs</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Company Details + Multiple Purchase Executives (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {activeCompany ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              {/* Card Header */}
              <div className="p-5 border-b border-slate-100 bg-linear-to-r from-slate-50 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 font-mono text-xs font-bold bg-blue-100 text-blue-800 rounded">
                      {activeCompany.companyCode || activeCompany.id}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        activeCompany.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {activeCompany.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">{activeCompany.companyName}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {activeCompany.address ? `${activeCompany.address}, ` : ''}
                      {activeCompany.city}, {activeCompany.state} - {activeCompany.pincode}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditCompany(activeCompany)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Company</span>
                  </button>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          `Are you sure you want to remove or deactivate ${activeCompany.companyName}?`
                        )
                      ) {
                        const res = deleteCompany(activeCompany.id);
                        alert(res.message);
                      }
                    }}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete or Deactivate Company"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Company Info Grid */}
              <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs border-b border-slate-100 bg-slate-50/40">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block">GST Number</span>
                  <span className="font-mono font-bold text-slate-800 text-xs">
                    {activeCompany.gstin || activeCompany.gstNumber || 'Not Registered'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block">City / State</span>
                  <span className="font-bold text-slate-800">
                    {activeCompany.city}, {activeCompany.state}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block">PIN Code</span>
                  <span className="font-mono font-bold text-slate-800">{activeCompany.pincode || '—'}</span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block">Payment Terms</span>
                  <span className="font-medium text-slate-700">{activeCompany.paymentTerms || '30 Days Net'}</span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block">Total Requirements</span>
                  <span className="font-bold text-blue-600">{linkedReqs.length} Indents</span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block">Total Order Volume</span>
                  <span className="font-mono font-bold text-emerald-700">
                    ₹{totalValue.toLocaleString('en-IN')}
                  </span>
                </div>
                {activeCompany.remarks && (
                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-[11px] font-semibold text-slate-400 block">Internal Remarks</span>
                    <p className="text-slate-600 text-xs italic mt-0.5">{activeCompany.remarks}</p>
                  </div>
                )}
              </div>

              {/* MULTIPLE PURCHASE EXECUTIVES SECTION */}
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-600" />
                      <span>Purchase Executives Mapped to {activeCompany.companyName}</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Selectable in Requirement Entry & RFQ generation. Multiple executives per company supported.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setExecName('');
                      setExecDesignation('Purchase Executive');
                      setExecMobile('');
                      setExecEmail('');
                      setExecDepartment('General Purchase');
                      setExecStatus('ACTIVE');
                      setExecRemarks('');
                      setIsAddExecOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Add Executive</span>
                  </button>
                </div>

                {linkedExecutives.length === 0 ? (
                  <div className="p-6 bg-indigo-50/40 rounded-xl border border-dashed border-indigo-200 text-center">
                    <Users className="w-8 h-8 text-indigo-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">No purchase executives mapped yet</p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                      Add executives for {activeCompany.companyName} so your team can assign RFQs to the correct buyer.
                    </p>
                    <button
                      onClick={() => setIsAddExecOpen(true)}
                      className="mt-3 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold"
                    >
                      + Add First Executive
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {linkedExecutives.map((exec) => (
                      <div
                        key={exec.id}
                        className="p-3.5 bg-slate-50 hover:bg-slate-100/70 rounded-xl border border-slate-200 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">{exec.name}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                              {exec.designation}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                exec.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {exec.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-600 flex-wrap">
                            <span className="flex items-center gap-1 font-mono">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {exec.mobile}
                            </span>
                            {exec.email && (
                              <span className="flex items-center gap-1 text-slate-500">
                                <Mail className="w-3 h-3 text-slate-400" />
                                {exec.email}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-slate-500">
                              <Briefcase className="w-3 h-3 text-slate-400" />
                              Dept: {exec.department}
                            </span>
                          </div>
                          {exec.remarks && (
                            <p className="text-[11px] text-slate-500 italic">{exec.remarks}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                          <button
                            onClick={() => handleOpenEditExec(exec)}
                            className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Remove or deactivate executive ${exec.name}?`)) {
                                const res = deletePurchaseExecutive(exec.id);
                                alert(res.message);
                              }
                            }}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                            title="Remove Executive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Requirements from this Company */}
              <div className="p-5 border-t border-slate-100 bg-slate-50/30">
                <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Recent RFQ Requirements ({linkedReqs.length})</span>
                  <button
                    onClick={() => setActiveTab('requirements')}
                    className="text-blue-600 text-[11px] font-semibold hover:underline"
                  >
                    View All in Register →
                  </button>
                </h4>
                {linkedReqs.length === 0 ? (
                  <p className="text-xs text-slate-400">No requirements raised yet for this company.</p>
                ) : (
                  <div className="space-y-1.5">
                    {linkedReqs.slice(0, 3).map((r) => (
                      <div
                        key={r.id}
                        onClick={() => {
                          setSelectedOrderId(r.id);
                          setActiveTab('requirements');
                        }}
                        className="p-2 bg-white rounded-lg border border-slate-200 text-xs flex items-center justify-between hover:bg-slate-50 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-700">{r.id}</span>
                          <span className="font-medium text-slate-800">{r.items.length} item(s)</span>
                          {r.purchaseExecutiveName && (
                            <span className="text-[11px] text-slate-500">
                              via <strong>{r.purchaseExecutiveName}</strong>
                            </span>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {r.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400">
              Select a company from the list to view full details and linked purchase executives.
            </div>
          )}
        </div>
      </div>

      {/* ADD / EDIT COMPANY MODAL */}
      {(isAddCompanyOpen || isEditCompanyOpen) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base text-white">
                  {isEditCompanyOpen ? 'Edit Company Record' : 'Register New Customer Company'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsAddCompanyOpen(false);
                  setIsEditCompanyOpen(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. ABC Industries / Tata Steel Tubes"
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">GST Number</label>
                  <input
                    type="text"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. 24AABCA1234D1Z5"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Company Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Plot/Gate/Plant address"
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="State"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Pincode</label>
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="PIN Code"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarks</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Notes, plant divisions, special procurement conditions..."
                  rows={2}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddCompanyOpen(false);
                    setIsEditCompanyOpen(false);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md shadow-blue-500/20"
                >
                  {isEditCompanyOpen ? 'Update Company' : 'Save Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT PURCHASE EXECUTIVE MODAL */}
      {(isAddExecOpen || isEditExecOpen) && activeCompany && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-indigo-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-300" />
                <div>
                  <h3 className="font-bold text-base text-white">
                    {isEditExecOpen ? 'Edit Purchase Executive' : 'Add Purchase Executive'}
                  </h3>
                  <p className="text-[11px] text-indigo-200">For {activeCompany.companyName}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddExecOpen(false);
                  setIsEditExecOpen(false);
                }}
                className="p-1 rounded-lg text-indigo-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExecutive} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Purchase Executive Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={execName}
                  onChange={(e) => setExecName(e.target.value)}
                  placeholder="e.g. Rahul Patel / Amit Shah"
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Designation</label>
                  <select
                    value={execDesignation}
                    onChange={(e) => setExecDesignation(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="Purchase Executive">Purchase Executive</option>
                    <option value="Senior Purchase Executive">Senior Purchase Executive</option>
                    <option value="Procurement Manager">Procurement Manager</option>
                    <option value="DGM Purchase">DGM Purchase</option>
                    <option value="Stores & Purchase Incharge">Stores & Purchase Incharge</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={execDepartment}
                    onChange={(e) => setExecDepartment(e.target.value)}
                    placeholder="e.g. Mechanical / Electrical"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={execMobile}
                    onChange={(e) => setExecMobile(e.target.value)}
                    placeholder="+91 98250 12345"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={execEmail}
                    onChange={(e) => setExecEmail(e.target.value)}
                    placeholder="rahul@company.com"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Status</label>
                <select
                  value={execStatus}
                  onChange={(e) => setExecStatus(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarks</label>
                <textarea
                  value={execRemarks}
                  onChange={(e) => setExecRemarks(e.target.value)}
                  placeholder="Item categories handled, shift timing, special notes..."
                  rows={2}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddExecOpen(false);
                    setIsEditExecOpen(false);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md shadow-indigo-500/20"
                >
                  {isEditExecOpen ? 'Update Executive' : 'Save Executive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
