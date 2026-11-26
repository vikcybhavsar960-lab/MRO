import React, { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Building2,
  Mail,
  Phone,
  Briefcase,
  X,
  CheckCircle2,
  Download,
  Trash2,
  Edit,
  UserCheck,
  Building,
  Filter,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PurchaseExecutive } from '../../types';
import * as XLSX from 'xlsx';

export const PurchaseExecutiveMaster: React.FC = () => {
  const {
    purchaseExecutives,
    companies,
    addPurchaseExecutive,
    updatePurchaseExecutive,
    deletePurchaseExecutive,
    requirements,
    setActiveTab,
  } = useApp();

  const [search, setSearch] = useState('');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExec, setEditingExec] = useState<PurchaseExecutive | null>(null);

  // Form State
  const [companyId, setCompanyId] = useState(companies[0]?.id || 'CMP-001');
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('Purchase Executive');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('General Purchase');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [remarks, setRemarks] = useState('');

  // Filtered List
  const filteredExecutives = purchaseExecutives.filter((exec) => {
    const matchesSearch =
      exec.name.toLowerCase().includes(search.toLowerCase()) ||
      exec.companyName.toLowerCase().includes(search.toLowerCase()) ||
      exec.mobile.toLowerCase().includes(search.toLowerCase()) ||
      (exec.email || '').toLowerCase().includes(search.toLowerCase()) ||
      exec.department.toLowerCase().includes(search.toLowerCase()) ||
      exec.designation.toLowerCase().includes(search.toLowerCase());

    const matchesCompany = selectedCompanyFilter === 'ALL' || exec.companyId === selectedCompanyFilter;
    const matchesStatus = selectedStatusFilter === 'ALL' || exec.status === selectedStatusFilter;

    return matchesSearch && matchesCompany && matchesStatus;
  });

  const handleOpenAdd = () => {
    setEditingExec(null);
    setCompanyId(companies[0]?.id || 'CMP-001');
    setName('');
    setDesignation('Purchase Executive');
    setMobile('');
    setEmail('');
    setDepartment('General Purchase');
    setStatus('ACTIVE');
    setRemarks('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (exec: PurchaseExecutive) => {
    setEditingExec(exec);
    setCompanyId(exec.companyId);
    setName(exec.name);
    setDesignation(exec.designation);
    setMobile(exec.mobile);
    setEmail(exec.email || '');
    setDepartment(exec.department);
    setStatus(exec.status);
    setRemarks(exec.remarks || '');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const targetCompany = companies.find((c) => c.id === companyId);
    const targetCompName = targetCompany?.companyName || 'Unknown Company';

    if (editingExec) {
      updatePurchaseExecutive({
        ...editingExec,
        companyId,
        companyName: targetCompName,
        name: name.trim(),
        designation: designation.trim(),
        mobile: mobile.trim(),
        email: email.trim() || undefined,
        department: department.trim(),
        status,
        remarks: remarks.trim() || undefined,
      });
    } else {
      addPurchaseExecutive({
        companyId,
        companyName: targetCompName,
        name: name.trim(),
        designation: designation.trim(),
        mobile: mobile.trim(),
        email: email.trim() || undefined,
        department: department.trim(),
        status,
        remarks: remarks.trim() || undefined,
      });
    }

    setIsModalOpen(false);
  };

  const handleExportExcel = () => {
    const data = filteredExecutives.map((exec, idx) => {
      const execReqs = requirements.filter(
        (r) => r.purchaseExecutiveId === exec.id || r.contactPerson.toLowerCase() === exec.name.toLowerCase()
      );
      return {
        'Sr. No.': idx + 1,
        'Executive ID': exec.id,
        'Executive Name': exec.name,
        'Company Name': exec.companyName,
        'Designation': exec.designation,
        'Mobile Number': exec.mobile,
        'Email Address': exec.email || 'N/A',
        'Department': exec.department,
        'Status': exec.status,
        'Total Requirements Handled': execReqs.length,
        'Remarks': exec.remarks || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchase Executives');
    ws['!cols'] = [
      { wch: 8 },
      { wch: 14 },
      { wch: 24 },
      { wch: 32 },
      { wch: 24 },
      { wch: 18 },
      { wch: 28 },
      { wch: 20 },
      { wch: 12 },
      { wch: 26 },
      { wch: 30 },
    ];
    XLSX.writeFile(wb, `Purchase_Executives_Directory_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <span>Purchase Executive Master</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {purchaseExecutives.length} Executives Mapped
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Maintain customer company purchase officers, procurement managers, and plant buyers for automated RFQ assignment
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Directory</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Purchase Executive</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        <div className="sm:col-span-5 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by executive name, company, mobile, email, department..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>

        <div className="sm:col-span-4">
          <select
            value={selectedCompanyFilter}
            onChange={(e) => setSelectedCompanyFilter(e.target.value)}
            className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="ALL">All Companies ({companies.length})</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3">
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
            className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>
      </div>

      {/* Executives Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Executive Name</th>
                <th className="py-3 px-4">Company Name</th>
                <th className="py-3 px-4">Designation</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Indents Raised</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredExecutives.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No purchase executives found matching the search criteria.
                  </td>
                </tr>
              ) : (
                filteredExecutives.map((exec) => {
                  const execReqs = requirements.filter(
                    (r) =>
                      r.purchaseExecutiveId === exec.id ||
                      r.contactPerson.toLowerCase() === exec.name.toLowerCase()
                  );
                  return (
                    <tr key={exec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                            {exec.name.charAt(0)}
                          </div>
                          <div>
                            <div>{exec.name}</div>
                            <span className="font-mono text-[10px] text-slate-400 font-normal">
                              {exec.id}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-800">{exec.companyName}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {exec.designation}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{exec.department}</td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="font-mono text-[11px] font-bold text-slate-800">{exec.mobile}</div>
                        {exec.email && <div className="text-[11px] text-slate-400">{exec.email}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            exec.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {exec.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md font-bold text-[11px]">
                          {execReqs.length}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(exec)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit Executive"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete/deactivate ${exec.name}?`)) {
                                const res = deletePurchaseExecutive(exec.id);
                                alert(res.message);
                              }
                            }}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Executive"
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

      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-indigo-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-300" />
                <h3 className="font-bold text-base text-white">
                  {editingExec ? 'Edit Purchase Executive' : 'Add New Purchase Executive'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-indigo-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                  required
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName} ({c.companyCode || c.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Purchase Executive Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Patel / Amit Shah"
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Designation</label>
                  <select
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
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
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
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
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="+91 98250 12345"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="officer@company.com"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarks</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Notes, plant site, category focus..."
                  rows={2}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md shadow-indigo-500/20"
                >
                  {editingExec ? 'Update Executive' : 'Save Executive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
