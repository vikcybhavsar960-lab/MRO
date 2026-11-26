import React, { useState } from 'react';
import {
  Users,
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
  Printer,
  Trash2,
  Edit,
  Database,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer } from '../../types';
import { ExportDataModal } from './ExportDataModal';
import { ImportDataModal } from './ImportDataModal';
import { exportCustomersToCSV, generateSingleCustomerDossierPDF } from '../../services/dataExportService';

export const CustomerMaster: React.FC = () => {
  const {
    customers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    requirements,
    customerQuotations,
    customerPOs,
    setSelectedOrderId,
    setActiveTab,
    dataMode,
  } = useApp();

  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // New/Edit customer form state
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('30 Days Net');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [remarks, setRemarks] = useState('');

  const filtered = customers.filter(
    (c) =>
      c.companyName.toLowerCase().includes(search.toLowerCase()) ||
      c.contactPerson.toLowerCase().includes(search.toLowerCase()) ||
      c.city.toLowerCase().includes(search.toLowerCase()) ||
      c.gstin.toLowerCase().includes(search.toLowerCase())
  );

  const activeCustomer = customers.find((c) => c.id === selectedCustomerId) || customers[0];

  // Calculate 360-degree customer profile metrics
  const custReqs = requirements.filter((r) => r.customerId === activeCustomer?.id);
  const custQtns = customerQuotations.filter((q) => q.customerId === activeCustomer?.id);
  const custPOs = customerPOs.filter((p) => p.customerId === activeCustomer?.id);
  const totalBusinessValue = custPOs.reduce((sum, p) => sum + p.poAmount, 0) || custQtns.reduce((sum, q) => sum + q.grandTotal, 0);

  const handleOpenEdit = (cust: Customer) => {
    setCompanyName(cust.companyName);
    setContactPerson(cust.contactPerson);
    setMobile(cust.mobile);
    setEmail(cust.email);
    setAddress(cust.address);
    setCity(cust.city);
    setState(cust.state);
    setPincode(cust.pincode);
    setGstin(cust.gstin);
    setPan(cust.pan);
    setPaymentTerms(cust.paymentTerms);
    setDeliveryAddress(cust.deliveryAddress);
    setRemarks(cust.remarks || '');
    setIsEditModalOpen(true);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const created = addCustomer({
      companyName,
      contactPerson,
      mobile,
      email,
      address,
      city,
      state,
      pincode,
      gstin,
      pan,
      paymentTerms,
      deliveryAddress: deliveryAddress || address,
      remarks,
    });
    setSelectedCustomerId(created.id);
    setIsAddModalOpen(false);
  };

  const handleUpdateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomer) return;
    updateCustomer({
      ...activeCustomer,
      companyName,
      contactPerson,
      mobile,
      email,
      address,
      city,
      state,
      pincode,
      gstin,
      pan,
      paymentTerms,
      deliveryAddress: deliveryAddress || address,
      remarks,
    });
    setIsEditModalOpen(false);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>Customer Master Management</span>
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-300">
              Enterprise Customer Master
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Maintain corporate clients, GSTIN, PAN, credit terms, export reports, and 360° transaction history
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* Export Button */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-xs"
            title="Export customer list to Excel, CSV, JSON, or PDF"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Export Data</span>
          </button>

          {/* Quick CSV Export */}
          <button
            onClick={() => exportCustomersToCSV(customers)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all"
            title="Instant CSV Download"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          {/* Import Button */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-xs"
            title="Import customer records from CSV or JSON"
          >
            <Upload className="w-4 h-4 text-blue-600" />
            <span>Import Data</span>
          </button>

          {/* Register New Customer */}
          <button
            onClick={() => {
              setCompanyName('');
              setContactPerson('');
              setMobile('');
              setEmail('');
              setAddress('');
              setCity('');
              setState('');
              setPincode('');
              setGstin('');
              setPan('');
              setRemarks('');
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Register Customer</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer Directory */}
        <div className="space-y-3">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company, person, GSTIN..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span>Showing {filtered.length} of {customers.length} registered clients</span>
          </div>

          <div className="space-y-2 max-h-[680px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-xl border border-slate-200 p-4 text-xs text-slate-500 space-y-2">
                <p>No customers match your search.</p>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="text-blue-600 font-bold hover:underline"
                >
                  Import Customers from CSV
                </button>
              </div>
            ) : (
              filtered.map((c) => {
                const isSelected = c.id === activeCustomer?.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCustomerId(c.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-600 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-xs text-blue-700">{c.id}</span>
                      <span className="text-[10px] font-bold text-slate-500">{c.city}, {c.state}</span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 leading-snug">{c.companyName}</h4>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <span>{c.contactPerson}</span> • <span>{c.mobile}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: 360-degree Customer Profile */}
        {activeCustomer && (
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Details Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      {activeCustomer.id}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Registered: {activeCustomer.createdAt}</span>
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 mt-1">{activeCustomer.companyName}</h3>
                  <p className="text-xs text-slate-500">{activeCustomer.remarks || 'Tier-1 Industrial Client'}</p>
                </div>

                <div className="flex flex-col sm:items-end gap-2">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Total Lifetime Orders Value
                    </span>
                    <span className="text-lg font-black text-emerald-600 font-mono">
                      ₹{totalBusinessValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  {/* Profile Actions: PDF Dossier, Edit, Delete */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => generateSingleCustomerDossierPDF(activeCustomer, { totalOrders: custReqs.length, totalValue: totalBusinessValue })}
                      className="flex items-center gap-1 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold transition-all"
                      title="Generate and print official Customer Profile Dossier PDF"
                    >
                      <Printer className="w-3.5 h-3.5 text-purple-600" />
                      <span>Print Dossier PDF</span>
                    </button>

                    <button
                      onClick={() => handleOpenEdit(activeCustomer)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all"
                      title="Edit Customer Profile"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to remove ${activeCustomer.companyName}?`)) {
                          deleteCustomer(activeCustomer.id);
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Customer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Contact Person</span>
                  <span className="font-bold text-slate-900">{activeCustomer.contactPerson}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Mobile & Phone</span>
                  <span className="font-bold text-slate-900">{activeCustomer.mobile}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Work Email</span>
                  <span className="font-bold text-slate-900 truncate block">{activeCustomer.email}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">GSTIN</span>
                  <span className="font-mono font-bold text-slate-900">{activeCustomer.gstin}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">PAN Number</span>
                  <span className="font-mono font-bold text-slate-900">{activeCustomer.pan}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Payment Terms</span>
                  <span className="font-semibold text-slate-900">{activeCustomer.paymentTerms}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Delivery Address</span>
                  <span className="text-slate-700">{activeCustomer.deliveryAddress}</span>
                </div>
              </div>
            </div>

            {/* 360 Degree Requirements & Orders History */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-900">
                  Customer Transactions & Orders ({custReqs.length})
                </h4>
                <button
                  onClick={() => setActiveTab('requirements')}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  View in Order Pipeline →
                </button>
              </div>

              {custReqs.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">No requirements logged for this customer.</div>
              ) : (
                <div className="space-y-3">
                  {custReqs.map((req) => (
                    <div
                      key={req.id}
                      onClick={() => setSelectedOrderId(req.id)}
                      className="p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer transition-all flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-700">{req.id}</span>
                          <span className="font-semibold text-slate-800">
                            {req.items.length} line items
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-md">
                          {req.items.map((i) => i.itemName).join(', ')}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                          {req.status.replace(/_/g, ' ')}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrderId(req.id);
                          }}
                          className="text-xs font-bold text-blue-600 hover:underline"
                        >
                          View Traceability
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Export Data Modal */}
      <ExportDataModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        type="CUSTOMERS"
        data={customers}
        filteredData={filtered}
        selectedItem={activeCustomer}
      />

      {/* Import Data Modal */}
      <ImportDataModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        type="CUSTOMERS"
      />

      {/* Edit Customer Modal */}
      {isEditModalOpen && activeCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-base">Edit Customer: {activeCustomer.companyName}</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateCustomer} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Contact Person *</label>
                  <input
                    type="text"
                    required
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mobile *</label>
                  <input
                    type="text"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">GSTIN *</label>
                  <input
                    type="text"
                    required
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">PAN Number *</label>
                  <input
                    type="text"
                    required
                    value={pan}
                    onChange={(e) => setPan(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl uppercase font-mono"
                  />
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
                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">Billing Address</label>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">Delivery Address</label>
                  <textarea
                    rows={2}
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div className="pt-4 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-base">Register New Customer</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveCustomer} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Company Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Bharat Heavy Electricals Ltd"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Person <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Rajesh Khurana"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mobile <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="+91 98200 11223"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="procurement@bhel.in"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">City <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">State <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">GSTIN <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    placeholder="27AAACB0000A1Z5"
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Delivery Address</label>
                <textarea
                  rows={2}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Plant central stores gate address"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold">
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
