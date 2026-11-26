import React, { useState, useEffect } from 'react';
import {
  X,
  Building,
  Users,
  Calendar,
  Hash,
  FileText,
  AlertCircle,
  Save,
  CheckCircle2,
  Trash2,
  Plus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CustomerRequirement, RequirementItem } from '../../types';

interface EditRequirementModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirement: CustomerRequirement | null;
  onSuccess?: () => void;
}

export const EditRequirementModal: React.FC<EditRequirementModalProps> = ({
  isOpen,
  onClose,
  requirement,
  onSuccess,
}) => {
  const { companies, purchaseExecutives, updateRequirement } = useApp();

  const [companyId, setCompanyId] = useState('');
  const [purchaseExecutiveId, setPurchaseExecutiveId] = useState('');
  const [rfqNumber, setRfqNumber] = useState('');
  const [requirementDate, setRequirementDate] = useState('');
  const [requirementSource, setRequirementSource] = useState('Email');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [status, setStatus] = useState<any>('NEW_REQUIREMENT');
  const [remarks, setRemarks] = useState('');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [items, setItems] = useState<RequirementItem[]>([]);

  useEffect(() => {
    if (requirement) {
      setCompanyId(requirement.companyId || requirement.customerId);
      setPurchaseExecutiveId(requirement.purchaseExecutiveId || '');
      setRfqNumber(requirement.rfqNumber || requirement.id);
      setRequirementDate(requirement.requirementDate || requirement.receivedRequirementDate || '');
      setRequirementSource(requirement.requirementSource || 'Email');
      setReferenceNumber(requirement.referenceNumber || '');
      setStatus(requirement.status || 'NEW_REQUIREMENT');
      setRemarks(requirement.remarks || '');
      setPriority((requirement.priority as any) || 'Medium');
      setItems(requirement.items || []);
    }
  }, [requirement]);

  if (!isOpen || !requirement) return null;

  // Filter purchase executives by selected company
  const availableExecutives = purchaseExecutives.filter(
    (pe) =>
      pe.companyId === companyId ||
      pe.companyName.toLowerCase() ===
        companies.find((c) => c.id === companyId)?.companyName.toLowerCase()
  );

  const handleCompanyChange = (newCompId: string) => {
    setCompanyId(newCompId);
    const validExecs = purchaseExecutives.filter(
      (pe) =>
        pe.companyId === newCompId ||
        pe.companyName.toLowerCase() ===
          companies.find((c) => c.id === newCompId)?.companyName.toLowerCase()
    );
    setPurchaseExecutiveId(validExecs[0]?.id || '');
  };

  const handleItemChange = (index: number, field: keyof RequirementItem, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      alert('A requirement must have at least one line item.');
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedComp = companies.find((c) => c.id === companyId);
    const selectedExec = purchaseExecutives.find((pe) => pe.id === purchaseExecutiveId);

    const compName = selectedComp?.companyName || requirement.companyName || requirement.customerName;
    const execName = selectedExec?.name || requirement.purchaseExecutiveName || requirement.contactPerson;

    const updated: CustomerRequirement = {
      ...requirement,
      companyId,
      companyName: compName,
      companyCode: (selectedComp as any)?.companyCode || companyId,
      customerId: companyId,
      customerName: compName,
      purchaseExecutiveId,
      purchaseExecutiveName: execName,
      purchaseExecutiveDesignation: selectedExec?.designation || requirement.purchaseExecutiveDesignation,
      purchaseExecutiveMobile: selectedExec?.mobile || requirement.purchaseExecutiveMobile,
      purchaseExecutiveEmail: selectedExec?.email || requirement.purchaseExecutiveEmail,
      contactPerson: execName,
      customerMobile: selectedExec?.mobile || requirement.customerMobile,
      customerEmail: selectedExec?.email || requirement.customerEmail,
      rfqNumber,
      requirementDate,
      receivedRequirementDate: requirementDate,
      requirementSource,
      referenceNumber: referenceNumber.trim() || undefined,
      status,
      priority,
      remarks,
      items: items.map((it) => ({
        ...it,
        purchaseExecutiveId: selectedExec?.id || it.purchaseExecutiveId,
        purchaseExecutiveName: selectedExec?.name || it.purchaseExecutiveName,
        purchaseExecutiveDesignation: selectedExec?.designation || it.purchaseExecutiveDesignation,
      })),
    };

    updateRequirement(updated);
    if (onSuccess) onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base sm:text-lg text-white">
                Edit Customer Requirement & RFQ
              </h3>
              <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {requirement.id}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Updates to buyer company or purchase executive are recorded in the audit history
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Company & Executive Card */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-4 h-4 text-blue-600" />
              <span>Buyer Organization & Procurement Executive</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Company */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <select
                  value={companyId}
                  onChange={(e) => handleCompanyChange(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName} ({c.companyCode || c.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Purchase Executive */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Purchase Executive <span className="text-red-500">*</span>
                </label>
                <select
                  value={purchaseExecutiveId}
                  onChange={(e) => setPurchaseExecutiveId(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  {availableExecutives.length > 0 ? (
                    availableExecutives.map((pe) => (
                      <option key={pe.id} value={pe.id}>
                        {pe.name} – {pe.designation}
                      </option>
                    ))
                  ) : (
                    <option value="">No executives found for this company</option>
                  )}
                </select>
              </div>

              {/* RFQ Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  RFQ Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={rfqNumber}
                  onChange={(e) => setRfqNumber(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-mono font-bold text-blue-800"
                  required
                />
              </div>

              {/* Requirement Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Requirement Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={requirementDate}
                  onChange={(e) => setRequirementDate(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-medium"
                  required
                />
              </div>

              {/* Requirement Source */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Requirement Source
                </label>
                <select
                  value={requirementSource}
                  onChange={(e) => setRequirementSource(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-medium"
                >
                  <option value="Email">Email</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Phone">Phone</option>
                  <option value="Manual">Manual</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Reference Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reference Number
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. PO-IND-9021"
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-medium"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Requirement Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-bold"
                >
                  <option value="NEW_REQUIREMENT">NEW REQUIREMENT</option>
                  <option value="ENQUIRY_SENT">ENQUIRY SENT</option>
                  <option value="RATE_RECEIVED">RATE RECEIVED</option>
                  <option value="QUOTATION_SENT">QUOTATION SENT</option>
                  <option value="PO_RECEIVED">PO RECEIVED</option>
                  <option value="ORDER_CLOSED">ORDER CLOSED</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-medium"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              {/* Remarks */}
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">Remarks</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Technical clarifications, remarks..."
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-medium"
                />
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Line Items ({items.length})
              </h4>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Item Name</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3">Brand</th>
                    <th className="py-2 px-3">Qty</th>
                    <th className="py-2 px-3">UOM</th>
                    <th className="py-2 px-3">Target Price (₹)</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it, idx) => (
                    <tr key={it.id || idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={it.itemName}
                          onChange={(e) => handleItemChange(idx, 'itemName', e.target.value)}
                          className="w-full p-1 border border-slate-200 rounded font-semibold text-slate-900 text-xs"
                          required
                        />
                      </td>
                      <td className="py-2 px-3 text-slate-600 font-medium">
                        {it.category || 'General'}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={it.brand || ''}
                          onChange={(e) => handleItemChange(idx, 'brand', e.target.value)}
                          className="w-24 p-1 border border-slate-200 rounded text-xs"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          value={it.quantity}
                          min={1}
                          onChange={(e) =>
                            handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)
                          }
                          className="w-16 p-1 border border-slate-200 rounded font-bold text-xs"
                          required
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={it.uom}
                          onChange={(e) => handleItemChange(idx, 'uom', e.target.value)}
                          className="w-16 p-1 border border-slate-200 rounded text-xs uppercase font-mono"
                          required
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          value={it.targetPrice || ''}
                          onChange={(e) =>
                            handleItemChange(idx, 'targetPrice', parseFloat(e.target.value) || 0)
                          }
                          className="w-24 p-1 border border-slate-200 rounded font-mono text-xs"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20"
            >
              <Save className="w-4 h-4" />
              <span>Save & Update Requirement</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
