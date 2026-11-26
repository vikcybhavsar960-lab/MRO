import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle,
  AlertTriangle,
  X,
  Sparkles,
  Plus,
  Trash2,
  Building,
  Users,
  Layers,
  Save,
  RotateCcw,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  parseRequirementExcelFile,
  downloadRequirementExcelTemplate,
} from '../../services/bulkRequirementImportService';
import * as XLSX from 'xlsx';

export interface BulkEntryRow {
  id: string;
  itemName: string;
  specification: string;
  category: string;
  brand: string;
  quantity: number;
  uom: string;
  purchaseExecutiveId?: string;
  remarks: string;
}

interface BulkRequirementImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const BulkRequirementImportModal: React.FC<BulkRequirementImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const {
    companies,
    customers,
    purchaseExecutives,
    categories,
    vendors,
    requirements,
    rfqs,
    addRequirement,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Company selection
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    companies[0]?.id || customers[0]?.id || 'CMP-001'
  );

  // Available executives for the selected company
  const companyExecutives = purchaseExecutives.filter(
    (pe) =>
      (pe.companyId === selectedCompanyId ||
        pe.companyName.toLowerCase() ===
          companies.find((c) => c.id === selectedCompanyId)?.companyName.toLowerCase()) &&
      pe.status === 'ACTIVE'
  );

  // 2. Default Purchase Executive
  const [selectedExecutiveId, setSelectedExecutiveId] = useState<string>(
    companyExecutives[0]?.id || ''
  );

  // "Different Purchase Executive per Requirement" toggle
  const [differentExecPerRow, setDifferentExecPerRow] = useState(false);

  // Generated RFQ Number preview
  const [rfqNumber, setRfqNumber] = useState<string>(() => {
    const year = new Date().getFullYear();
    let maxSeq = 0;
    const allSeen: any[] = [...(requirements || []), ...(rfqs || [])];
    try {
      const lsReq = localStorage.getItem('erp_live_requirements');
      if (lsReq) {
        const parsed = JSON.parse(lsReq);
        if (Array.isArray(parsed)) allSeen.push(...parsed);
      }
      const lsRfq = localStorage.getItem('erp_live_rfqs');
      if (lsRfq) {
        const parsed = JSON.parse(lsRfq);
        if (Array.isArray(parsed)) allSeen.push(...parsed);
      }
      const lsDel = localStorage.getItem('erp_deleted_requirements');
      if (lsDel) {
        const parsed = JSON.parse(lsDel);
        if (Array.isArray(parsed)) {
          parsed.forEach((tid: string) => allSeen.push({ id: tid, rfqNumber: tid }));
        }
      }
    } catch {}

    allSeen.forEach((r) => {
      const match = (r?.rfqNumber || r?.id || '').match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    });
    const nextSeq = Math.max(maxSeq + 1, 5);
    return `RFQ-${year}-${String(nextSeq).padStart(5, '0')}`;
  });

  const [requirementSource, setRequirementSource] = useState('Email');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [requirementRemarks, setRequirementRemarks] = useState('');

  // 3. Grid Rows
  const createEmptyRow = (customId?: string): BulkEntryRow => ({
    id: customId || `ROW-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    itemName: '',
    specification: '',
    category: categories[0]?.name || 'Bearings',
    brand: '',
    quantity: 1,
    uom: 'NOS',
    purchaseExecutiveId: selectedExecutiveId || companyExecutives[0]?.id,
    remarks: '',
  });

  const [rows, setRows] = useState<BulkEntryRow[]>([createEmptyRow()]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeCompany =
    companies.find((c) => c.id === selectedCompanyId) ||
    customers.find((c) => c.id === selectedCompanyId) ||
    companies[0];

  const handleCompanyChange = (newCompId: string) => {
    setSelectedCompanyId(newCompId);
    const validExecs = purchaseExecutives.filter(
      (pe) =>
        (pe.companyId === newCompId ||
          pe.companyName.toLowerCase() ===
            companies.find((c) => c.id === newCompId)?.companyName.toLowerCase()) &&
        pe.status === 'ACTIVE'
    );
    const firstExec = validExecs[0]?.id || '';
    setSelectedExecutiveId(firstExec);

    // Update rows to the new company's first executive if needed
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        purchaseExecutiveId: firstExec,
      }))
    );
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length <= 1) {
      // Don't remove last row, just clear it
      setRows([createEmptyRow()]);
      return;
    }
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleClearForm = () => {
    if (confirm('Are you sure you want to clear all entered rows?')) {
      setRows([createEmptyRow()]);
      setReferenceNumber('');
      setRequirementRemarks('');
      setImportStatusMessage(null);
    }
  };

  const handleRowChange = (index: number, field: keyof BulkEntryRow, value: any) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Import Excel File to populate grid rows
  const handleImportExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setImportStatusMessage(null);

    try {
      const parsed = await parseRequirementExcelFile(file, categories, vendors, requirements);
      if (parsed.validRows && parsed.validRows.length > 0) {
        const importedRows: BulkEntryRow[] = parsed.validRows.map((r, i) => ({
          id: `ROW-IMP-${i + 1}-${Date.now()}`,
          itemName: r.itemName,
          specification: r.specification || '',
          category: r.recommendedCategory || categories[0]?.name || 'Bearings',
          brand: (r as any).brand || r.description || '',
          quantity: r.quantity || 1,
          uom: r.uom || 'NOS',
          purchaseExecutiveId: selectedExecutiveId || companyExecutives[0]?.id,
          remarks: r.remarks || '',
        }));

        setRows(importedRows);
        setImportStatusMessage(
          `Successfully loaded ${importedRows.length} item row(s) from Excel.`
        );
      } else {
        alert('No valid requirement rows found in uploaded Excel file.');
      }
    } catch (err: any) {
      alert(`Error reading Excel: ${err.message || 'Invalid format'}`);
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Save All
  const handleSaveAll = () => {
    if (!activeCompany) {
      alert('Please select a company.');
      return;
    }

    // Filter out rows with no itemName
    const validRows = rows.filter((r) => r.itemName.trim().length > 0);
    if (validRows.length === 0) {
      alert('Please enter at least one material requirement line item with an Item Name.');
      return;
    }

    const defaultExec = purchaseExecutives.find((pe) => pe.id === selectedExecutiveId);

    const todayDate = new Date().toISOString().split('T')[0];

    const savedRequirement = addRequirement({
      customerId: activeCompany.id,
      customerName: activeCompany.companyName,
      companyId: activeCompany.id,
      companyName: activeCompany.companyName,
      companyCode: (activeCompany as any).companyCode || activeCompany.id,
      purchaseExecutiveId: defaultExec?.id,
      purchaseExecutiveName: defaultExec?.name || activeCompany.contactPerson || 'Procurement Buyer',
      purchaseExecutiveDesignation: defaultExec?.designation || 'Purchase Executive',
      purchaseExecutiveMobile: defaultExec?.mobile || activeCompany.mobile || '',
      purchaseExecutiveEmail: defaultExec?.email || activeCompany.email || '',
      rfqNumber,
      requirementSource,
      referenceNumber: referenceNumber.trim() || undefined,
      remarks: requirementRemarks.trim() || undefined,
      contactPerson: defaultExec?.name || activeCompany.contactPerson || 'Procurement Buyer',
      customerEmail: defaultExec?.email || activeCompany.email || '',
      customerMobile: defaultExec?.mobile || activeCompany.mobile || '',
      requirementDate: todayDate,
      requiredDeliveryDate: todayDate,
      receivedRequirementDate: todayDate,
      priority: 'Medium',
      items: validRows.map((r, i) => {
        const rowExecId = differentExecPerRow ? r.purchaseExecutiveId : defaultExec?.id;
        const rowExec = purchaseExecutives.find((pe) => pe.id === rowExecId) || defaultExec;

        return {
          itemName: r.itemName.trim(),
          category: r.category || 'Bearings',
          recommendedCategory: r.category || 'Bearings',
          subCategory: '',
          brand: r.brand.trim() || 'Standard Industrial',
          partNumber: '',
          modelNumber: '',
          specification: r.specification.trim(),
          quantity: r.quantity > 0 ? r.quantity : 1,
          uom: r.uom || 'NOS',
          requiredDeliveryDate: todayDate,
          receivedRequirementDate: todayDate,
          priority: 'Medium',
          purchaseExecutiveId: rowExec?.id,
          purchaseExecutiveName: rowExec?.name,
          purchaseExecutiveDesignation: rowExec?.designation,
          remarks: r.remarks.trim(),
        };
      }),
    });

    alert(
      `Saved ${validRows.length} item(s) under ${savedRequirement.id} (${savedRequirement.rfqNumber || rfqNumber}) for ${activeCompany.companyName}!`
    );

    if (onSuccess) onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-base sm:text-lg text-white">
                Bulk Requirement Entry & Multi-Item RFQ
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
                Single RFQ Workflow
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Select company and purchase executive once, enter multiple material requirements in rows, and save all under one RFQ number
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Top Bar: Company & Executive Selection (Required Workflow 1 & 2) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* 1. Select Company Once */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  1. Company Name <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => handleCompanyChange(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName} ({c.companyCode || c.id})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-0.5 block truncate">
                  {activeCompany?.city}, {activeCompany?.state} • GST: {activeCompany?.gstin || 'N/A'}
                </span>
              </div>

              {/* 2. Select Purchase Executive Once */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  2. Purchase Executive <span className="text-red-500">*</span>
                </label>
                {companyExecutives.length > 0 ? (
                  <select
                    value={selectedExecutiveId}
                    onChange={(e) => setSelectedExecutiveId(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500"
                  >
                    {companyExecutives.map((pe) => (
                      <option key={pe.id} value={pe.id}>
                        {pe.name} ({pe.designation})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-2 bg-amber-50 text-amber-800 rounded-lg border border-amber-200 text-[11px]">
                    No executive mapped for this company.
                  </div>
                )}
                <span className="text-[10px] text-indigo-600 mt-0.5 block">
                  Buyer contact for entire RFQ
                </span>
              </div>

              {/* RFQ Number */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  RFQ Number (Auto-assigned)
                </label>
                <input
                  type="text"
                  value={rfqNumber}
                  onChange={(e) => setRfqNumber(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-slate-100 font-mono font-bold text-blue-800 focus:bg-white"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Shared by all line items</span>
              </div>

              {/* Reference / Source */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Client Reference No / Indent</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. INDENT-2026-9021"
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Optional reference tag</span>
              </div>
            </div>

            {/* Toggle: Different Purchase Executive per Requirement */}
            <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={differentExecPerRow}
                  onChange={(e) => setDifferentExecPerRow(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span>Different Purchase Executive per Requirement</span>
              </label>

              {differentExecPerRow && (
                <span className="text-[11px] text-indigo-600 font-semibold bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  Selectable per row (restricted to {activeCompany?.companyName} executives)
                </span>
              )}
            </div>
          </div>

          {/* Action Toolbar with Required Buttons: + Add Row, Remove Row, Import Excel, Save All, Clear Form */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Row</span>
              </button>

              <button
                type="button"
                onClick={() => handleRemoveRow(rows.length - 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Remove Row</span>
              </button>

              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Import Excel</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImportExcelFile}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => downloadRequirementExcelTemplate()}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 rounded-lg text-[11px] font-semibold"
                title="Download standard Excel format"
              >
                <Download className="w-3 h-3 text-slate-400" />
                <span>Excel Template</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearForm}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Form</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAll}
                className="flex items-center gap-1.5 px-5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-500/20 transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save All ({rows.filter((r) => r.itemName.trim()).length} Items)</span>
              </button>
            </div>
          </div>

          {importStatusMessage && (
            <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-medium border border-emerald-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                {importStatusMessage}
              </span>
              <button
                onClick={() => setImportStatusMessage(null)}
                className="text-emerald-600 hover:text-emerald-900 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* BULK ENTRY GRID TABLE (Columns required: Item Name, Item Description/Specification, Category, Brand/Make, Quantity, UOM, Remarks) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <div className="overflow-x-auto max-h-[460px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 text-[11px] font-bold uppercase sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-2 text-center w-10">#</th>
                    <th className="py-2.5 px-3 min-w-[200px]">
                      Item Name <span className="text-red-500">*</span>
                    </th>
                    <th className="py-2.5 px-3 min-w-[200px]">Item Description / Specification</th>
                    <th className="py-2.5 px-3 min-w-[150px]">Category</th>
                    <th className="py-2.5 px-3 min-w-[130px]">Brand / Make</th>
                    <th className="py-2.5 px-3 w-20 text-center">Qty</th>
                    <th className="py-2.5 px-3 w-24">UOM</th>
                    {differentExecPerRow && (
                      <th className="py-2.5 px-3 min-w-[170px] text-indigo-700 bg-indigo-50">
                        Purchase Executive
                      </th>
                    )}
                    <th className="py-2.5 px-3 min-w-[150px]">Remarks</th>
                    <th className="py-2.5 px-2 text-center w-10">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {rows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="py-2 px-2 text-center font-mono text-slate-400 font-bold">
                        {idx + 1}
                      </td>

                      {/* Item Name */}
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={row.itemName}
                          onChange={(e) => handleRowChange(idx, 'itemName', e.target.value)}
                          placeholder="e.g. 6206-2RS Ball Bearing"
                          className="w-full p-1.5 text-xs border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-semibold text-slate-900"
                          required
                        />
                      </td>

                      {/* Specification / Description */}
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={row.specification}
                          onChange={(e) => handleRowChange(idx, 'specification', e.target.value)}
                          placeholder="e.g. 30x62x16mm, C3 clearance"
                          className="w-full p-1.5 text-xs border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-700"
                        />
                      </td>

                      {/* Category */}
                      <td className="py-1.5 px-2">
                        <select
                          value={row.category}
                          onChange={(e) => handleRowChange(idx, 'category', e.target.value)}
                          className="w-full p-1.5 text-xs border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-800"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Brand / Make */}
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={row.brand}
                          onChange={(e) => handleRowChange(idx, 'brand', e.target.value)}
                          placeholder="e.g. SKF / Siemens"
                          className="w-full p-1.5 text-xs border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
                        />
                      </td>

                      {/* Quantity */}
                      <td className="py-1.5 px-2">
                        <input
                          type="number"
                          min="1"
                          value={row.quantity}
                          onChange={(e) =>
                            handleRowChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)
                          }
                          className="w-full p-1.5 text-xs border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono font-bold text-center"
                        />
                      </td>

                      {/* UOM */}
                      <td className="py-1.5 px-2">
                        <select
                          value={row.uom}
                          onChange={(e) => handleRowChange(idx, 'uom', e.target.value)}
                          className="w-full p-1.5 text-xs border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white font-medium"
                        >
                          <option value="NOS">NOS</option>
                          <option value="SET">SET</option>
                          <option value="MTR">MTR</option>
                          <option value="KG">KG</option>
                          <option value="LTR">LTR</option>
                          <option value="PKT">PKT</option>
                          <option value="BOX">BOX</option>
                          <option value="BARREL">BARREL</option>
                          <option value="ROLL">ROLL</option>
                        </select>
                      </td>

                      {/* Different Purchase Executive column (if enabled) */}
                      {differentExecPerRow && (
                        <td className="py-1.5 px-2 bg-indigo-50/50">
                          <select
                            value={row.purchaseExecutiveId || selectedExecutiveId}
                            onChange={(e) =>
                              handleRowChange(idx, 'purchaseExecutiveId', e.target.value)
                            }
                            className="w-full p-1.5 text-xs border border-indigo-200 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white font-bold text-indigo-900"
                          >
                            {companyExecutives.map((pe) => (
                              <option key={pe.id} value={pe.id}>
                                {pe.name} ({pe.designation})
                              </option>
                            ))}
                          </select>
                        </td>
                      )}

                      {/* Remarks */}
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={row.remarks}
                          onChange={(e) => handleRowChange(idx, 'remarks', e.target.value)}
                          placeholder="Line remarks"
                          className="w-full p-1.5 text-xs border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-600"
                        />
                      </td>

                      {/* Action */}
                      <td className="py-1.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title="Remove row"
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

          {/* Bottom Bar Details */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 pt-1">
            <div>
              <span>
                Total Rows: <strong>{rows.length}</strong> | Valid Items:{' '}
                <strong>{rows.filter((r) => r.itemName.trim()).length}</strong>
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2 sm:mt-0">
              <button
                type="button"
                onClick={handleAddRow}
                className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another Line</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Save All Rows Under RFQ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
