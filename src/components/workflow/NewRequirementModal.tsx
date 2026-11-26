import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  Building,
  Check,
  CheckCircle2,
  AlertCircle,
  Tag,
  DollarSign,
  Phone,
  Mail,
  FileText,
  Clock,
  Layers,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RequirementItem, Vendor } from '../../types';
import {
  recommendCategoryForRequirement,
  recommendVendorsForRequirement,
} from '../../services/categoryMatchingService';
import { matchProductAiQuery } from '../../services/catalogImportEngine';
import { AiCatalogueMatchResult } from '../../types/catalogImport';

interface FormRequirementItem extends Omit<RequirementItem, 'id'> {
  isCategoryManuallySelected?: boolean;
  assignedVendorId?: string;
  assignedVendorName?: string;
  vendorRate?: number;
  vendorGst?: number;
  vendorDeliveryDays?: string;
  originalRequirementText?: string;
  aiMatchResult?: AiCatalogueMatchResult;
  isAiMatchConfirmed?: boolean;
}

interface NewRequirementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewRequirementModal: React.FC<NewRequirementModalProps> = ({ isOpen, onClose }) => {
  const {
    customers,
    companies,
    purchaseExecutives,
    addCompany,
    addPurchaseExecutive,
    addRequirement,
    requirements,
    rfqs,
    products,
    categories,
    vendors,
    brands,
    confirmedAiMappings,
    saveConfirmedAiMapping,
  } = useApp();

  // Helper to get today's local date formatted as YYYY-MM-DD
  const getTodayLocalDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Top Section State (Company & Purchase Executive Management)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    companies[0]?.id || customers[0]?.id || 'CMP-001'
  );

  // Filter purchase executives by selected company
  const companyExecutives = purchaseExecutives.filter(
    (pe) =>
      pe.companyId === selectedCompanyId ||
      pe.companyName.toLowerCase() ===
        companies.find((c) => c.id === selectedCompanyId)?.companyName.toLowerCase()
  );

  const [selectedExecutiveId, setSelectedExecutiveId] = useState<string>(
    companyExecutives[0]?.id || ''
  );
  const [requirementDate, setRequirementDate] = useState(getTodayLocalDate());
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
  const [requirementSource, setRequirementSource] = useState<
    'Email' | 'WhatsApp' | 'Phone' | 'Manual' | 'Other'
  >('Email');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');

  // Quick Add Company Modal
  const [isQuickCompanyOpen, setIsQuickCompanyOpen] = useState(false);
  const [quickCompName, setQuickCompName] = useState('');
  const [quickCompGst, setQuickCompGst] = useState('');
  const [quickCompCity, setQuickCompCity] = useState('');
  const [quickCompState, setQuickCompState] = useState('');

  // Quick Add Executive Modal
  const [isQuickExecOpen, setIsQuickExecOpen] = useState(false);
  const [quickExecName, setQuickExecName] = useState('');
  const [quickExecDesig, setQuickExecDesig] = useState('Purchase Executive');
  const [quickExecMobile, setQuickExecMobile] = useState('');
  const [quickExecEmail, setQuickExecEmail] = useState('');
  const [quickExecDept, setQuickExecDept] = useState('General Purchase');

  // Sync executive dropdown when company changes
  const handleCompanyChange = (newCompId: string) => {
    setSelectedCompanyId(newCompId);
    const validExecs = purchaseExecutives.filter(
      (pe) =>
        pe.companyId === newCompId ||
        pe.companyName.toLowerCase() ===
          companies.find((c) => c.id === newCompId)?.companyName.toLowerCase()
    );
    setSelectedExecutiveId(validExecs[0]?.id || '');
  };

  // Start with a clean, independent line item (NO hardcoded bearing item!)
  const [items, setItems] = useState<FormRequirementItem[]>([
    {
      itemName: '',
      category: '',
      recommendedCategory: '',
      subCategory: '',
      brand: '',
      partNumber: '',
      modelNumber: '',
      specification: '',
      quantity: 1,
      uom: 'NOS',
      targetPrice: 0,
      requiredDeliveryDate: getTodayLocalDate(),
      priority: 'Medium',
      remarks: '',
      isCategoryManuallySelected: false,
    },
  ]);

  if (!isOpen) return null;

  const currentCustomer =
    companies.find((c) => c.id === selectedCompanyId) ||
    customers.find((c) => c.id === selectedCompanyId) ||
    companies[0] ||
    customers[0];

  const handleAddItem = () => {
    // Independent item state - never inherit values from previous item
    setItems((prev) => [
      ...prev,
      {
        itemName: '',
        category: '',
        recommendedCategory: '',
        subCategory: '',
        brand: '',
        partNumber: '',
        modelNumber: '',
        specification: '',
        quantity: 1,
        uom: 'NOS',
        targetPrice: 0,
        requiredDeliveryDate: requirementDate,
        priority: 'Medium',
        remarks: '',
        isCategoryManuallySelected: false,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof FormRequirementItem, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      const currentItem = { ...copy[index], [field]: value };

      if (field === 'itemName') {
        currentItem.originalRequirementText = value;

        // Smart Layered AI Product Identification from Brand Catalogue
        const aiMatch = matchProductAiQuery(value, products, brands, confirmedAiMappings);
        currentItem.aiMatchResult = aiMatch;

        if (aiMatch.matched && aiMatch.confidence >= 80) {
          if (aiMatch.brand) currentItem.brand = aiMatch.brand;
          if (aiMatch.category && !currentItem.isCategoryManuallySelected) {
            currentItem.category = aiMatch.category;
            currentItem.recommendedCategory = aiMatch.category;
            if (aiMatch.subCategory) currentItem.subCategory = aiMatch.subCategory;
          }
          if (aiMatch.partCode) currentItem.partNumber = aiMatch.partCode;
          const specs = [aiMatch.rating, aiMatch.poles].filter(Boolean).join(', ');
          if (specs) currentItem.specification = specs;
          if (aiMatch.currentRate) currentItem.targetPrice = aiMatch.currentRate;

          // Quantity detection from query: e.g. "20 Nos" or "50 Pcs"
          const qtyMatch = value.match(/\b(\d+)\s*(nos|no|pcs|pieces|mtr|kg|set)\b/i);
          if (qtyMatch) {
            const parsedQty = parseInt(qtyMatch[1], 10);
            if (!isNaN(parsedQty) && parsedQty > 0) {
              currentItem.quantity = parsedQty;
              const u = qtyMatch[2].toUpperCase();
              if (u.startsWith('NO')) currentItem.uom = 'NOS';
              else if (u.startsWith('PC')) currentItem.uom = 'NOS';
              else if (u.startsWith('MT')) currentItem.uom = 'MTR';
              else if (u.startsWith('KG')) currentItem.uom = 'KG';
              else if (u.startsWith('SET')) currentItem.uom = 'SET';
            }
          }

          // Preferred supplier detection
          if (aiMatch.supplier) {
            const matchingV = vendors.find(
              (v) => v.companyName?.toLowerCase().trim() === aiMatch.supplier?.toLowerCase().trim()
            );
            if (matchingV) {
              currentItem.assignedVendorId = matchingV.id;
              currentItem.assignedVendorName = matchingV.companyName;
              currentItem.vendorRate = aiMatch.currentRate;
            }
          }
        } else {
          // Fallback category recommendation strictly on new item input
          const rec = recommendCategoryForRequirement(
            {
              itemName: value,
              description: currentItem.brand,
              specification: currentItem.specification,
            },
            categories
          );

          currentItem.recommendedCategory = rec.category || '';

          if (!currentItem.isCategoryManuallySelected) {
            if (rec.category) {
              currentItem.category = rec.category;
              const targetCatObj = categories.find((c) => c.name.toLowerCase() === rec.category.toLowerCase());
              const validSubs = targetCatObj?.subCategories || [];
              if (!validSubs.includes(currentItem.subCategory || '')) {
                currentItem.subCategory = rec.subCategory || '';
              }
            } else {
              currentItem.category = '';
              currentItem.subCategory = '';
            }
          }
        }
      }
 else if (field === 'category') {
        // User manually selected category: lock it and reset invalid subcategory
        currentItem.isCategoryManuallySelected = true;
        currentItem.category = value;

        // Clear incompatible sub-category
        const targetCatObj = categories.find((c) => c.name.toLowerCase() === String(value).toLowerCase());
        const validSubs = targetCatObj?.subCategories || [];
        if (!validSubs.includes(currentItem.subCategory || '')) {
          currentItem.subCategory = '';
        }

        // Clear incompatible vendor selection if category changed
        currentItem.assignedVendorId = undefined;
        currentItem.assignedVendorName = undefined;
        currentItem.vendorRate = undefined;
      } else if (field === 'brand' || field === 'specification') {
        // If user already manually selected a category, PRESERVE it!
        if (!currentItem.isCategoryManuallySelected && currentItem.itemName) {
          const rec = recommendCategoryForRequirement(
            {
              itemName: currentItem.itemName,
              description: field === 'brand' ? value : currentItem.brand,
              specification: field === 'specification' ? value : currentItem.specification,
            },
            categories
          );
          if (rec.category) {
            currentItem.recommendedCategory = rec.category;
            currentItem.category = rec.category;
          }
        }
      }

      copy[index] = currentItem;
      return copy;
    });
  };

  const handleApplyRecommendedCategory = (index: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[index] };
      if (target.recommendedCategory) {
        target.category = target.recommendedCategory;
        target.isCategoryManuallySelected = false;

        const recCat = target.recommendedCategory;
        const targetCatObj = categories.find(
          (c) => c.name.toLowerCase() === recCat.toLowerCase()
        );
        target.subCategory = targetCatObj?.subCategories[0] || '';
      }
      copy[index] = target;
      return copy;
    });
  };

  const handleSelectProduct = (index: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        itemName: prod.itemName,
        category: prod.category,
        recommendedCategory: prod.category,
        subCategory: prod.subCategory || '',
        brand: prod.brand,
        partNumber: prod.partNumber,
        modelNumber: prod.modelNumber || '',
        specification: prod.specification,
        uom: prod.uom,
        targetPrice: prod.approxRate || 0,
        isCategoryManuallySelected: true, // locked to product definition
      };
      return copy;
    });
  };

  const handleConfirmAiMapping = async (index: number) => {
    const item = items[index];
    if (!item.aiMatchResult || !item.itemName) return;
    const match = item.aiMatchResult;
    try {
      await saveConfirmedAiMapping({
        inputQuery: item.originalRequirementText || item.itemName,
        confirmedBrand: item.brand || match.brand || '',
        confirmedCategory: item.category || match.category || '',
        confirmedSubCategory: item.subCategory || match.subCategory || '',
        confirmedProductId: match.productId || '',
        confirmedProductName: match.productName || item.itemName,
        confirmedPartNumber: item.partNumber || match.partCode || '',
        confirmedRating: match.rating || '',
        confirmedPoles: match.poles || '',
        confirmedPrice: item.targetPrice || match.currentRate || 0,
        confirmedSupplierName: item.assignedVendorName || match.supplier || '',
        confirmedBy: 'Procurement Specialist',
      });
      setItems((prev) => {
        const copy = [...prev];
        copy[index] = { ...copy[index], isAiMatchConfirmed: true };
        return copy;
      });
    } catch (err) {
      console.error('Error saving confirmed AI mapping:', err);
    }
  };

  const handleSelectAlternativeMatch = (index: number, alt: any) => {
    const prod = products.find((p) => p.id === alt.productId);
    if (!prod) return;
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        itemName: prod.itemName,
        brand: prod.brand,
        partNumber: prod.partNumber,
        modelNumber: prod.modelNumber || '',
        category: prod.category,
        recommendedCategory: prod.category,
        subCategory: prod.subCategory || '',
        specification: prod.specification,
        targetPrice: prod.approxRate || 0,
        isCategoryManuallySelected: true,
        aiMatchResult: {
          matched: true,
          brand: prod.brand,
          productName: prod.itemName,
          partCode: prod.partNumber,
          category: prod.category,
          subCategory: prod.subCategory || '',
          currentRate: prod.approxRate || 0,
          confidence: 100,
          matchReason: `Selected candidate: ${prod.itemName} (${prod.partNumber})`,
          productId: prod.id,
        },
      };
      return copy;
    });
  };

  const activeCompany =
    companies.find((c) => c.id === selectedCompanyId) ||
    customers.find((c) => c.id === selectedCompanyId) ||
    companies[0] ||
    customers[0];

  const activeExecutive = purchaseExecutives.find((pe) => pe.id === selectedExecutiveId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany) {
      alert('Please select or register a company first.');
      return;
    }

    // Validate that every item has a valid category selected
    for (let i = 0; i < items.length; i++) {
      if (!items[i].category) {
        alert(`Please select a Material Category for Item #${i + 1} (${items[i].itemName || 'Unnamed Item'}).`);
        return;
      }
    }

    addRequirement({
      customerId: activeCompany.id,
      customerName: activeCompany.companyName,
      companyId: activeCompany.id,
      companyName: activeCompany.companyName,
      companyCode: (activeCompany as any).companyCode || activeCompany.id,
      purchaseExecutiveId: activeExecutive?.id || undefined,
      purchaseExecutiveName: activeExecutive?.name || activeCompany.contactPerson || 'Procurement Buyer',
      purchaseExecutiveDesignation: activeExecutive?.designation || 'Purchase Executive',
      purchaseExecutiveMobile: activeExecutive?.mobile || activeCompany.mobile || '',
      purchaseExecutiveEmail: activeExecutive?.email || activeCompany.email || '',
      rfqNumber,
      requirementSource,
      referenceNumber: referenceNumber.trim() || undefined,
      contactPerson: activeExecutive?.name || activeCompany.contactPerson || 'Procurement Buyer',
      customerEmail: activeExecutive?.email || activeCompany.email || '',
      customerMobile: activeExecutive?.mobile || activeCompany.mobile || '',
      requirementDate,
      requiredDeliveryDate: requirementDate, // Keep for backward-compatibility
      receivedRequirementDate: requirementDate,
      expectedDeliveryDate: expectedDeliveryDate || undefined,
      priority,
      items: items.map((it) => ({
        ...it,
        requiredDeliveryDate: requirementDate,
        receivedRequirementDate: requirementDate,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        priority: it.priority || priority,
        purchaseExecutiveId: activeExecutive?.id,
        purchaseExecutiveName: activeExecutive?.name,
        purchaseExecutiveDesignation: activeExecutive?.designation,
      })),
      remarks,
    });

    onClose();
  };

  const handleQuickAddCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCompName.trim()) return;
    const newComp = addCompany({
      companyName: quickCompName.trim(),
      gstin: quickCompGst.trim().toUpperCase(),
      gstNumber: quickCompGst.trim().toUpperCase(),
      city: quickCompCity.trim(),
      state: quickCompState.trim(),
      address: '',
      pincode: '',
      status: 'ACTIVE',
      remarks: 'Added from Requirement Entry',
    });
    setSelectedCompanyId(newComp.id);
    setQuickCompName('');
    setQuickCompGst('');
    setQuickCompCity('');
    setQuickCompState('');
    setIsQuickCompanyOpen(false);
  };

  const handleQuickAddExec = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickExecName.trim() || !activeCompany) return;
    const newExec = addPurchaseExecutive({
      companyId: activeCompany.id,
      companyName: activeCompany.companyName,
      name: quickExecName.trim(),
      designation: quickExecDesig,
      mobile: quickExecMobile.trim(),
      email: quickExecEmail.trim() || undefined,
      department: quickExecDept.trim(),
      status: 'ACTIVE',
    });
    setSelectedExecutiveId(newExec.id);
    setQuickExecName('');
    setQuickExecMobile('');
    setQuickExecEmail('');
    setIsQuickExecOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-white">Create New Customer Requirement / RFQ</h3>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
                Auto-assigned RFQ
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Select company, filter purchase executive, and record material requirements with category matching
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
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Top Primary Section: 1. Company, 2. Executive, 3. Date, 4. RFQ No, 5. Source, 6. Ref No, 7. Remarks */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-4 h-4 text-blue-600" />
                <span>Buyer Company & RFQ Identification</span>
              </span>
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded border border-blue-200">
                {rfqNumber}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 1. Company Name */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    1. Company Name <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQuickCompanyOpen(true)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    + Add New
                  </button>
                </div>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => handleCompanyChange(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 font-bold"
                  required
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName} ({c.companyCode || c.id})
                    </option>
                  ))}
                </select>
                {activeCompany && (
                  <span className="text-[10px] text-slate-500 mt-0.5 block truncate">
                    {activeCompany.city}, {activeCompany.state} • GST:{' '}
                    {activeCompany.gstin || (activeCompany as any).gstNumber || 'N/A'}
                  </span>
                )}
              </div>

              {/* 2. Purchase Executive */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    2. Purchase Executive <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQuickExecOpen(true)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    + Add New
                  </button>
                </div>
                {companyExecutives.length > 0 ? (
                  <select
                    value={selectedExecutiveId}
                    onChange={(e) => setSelectedExecutiveId(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900"
                    required
                  >
                    {companyExecutives.map((pe) => (
                      <option key={pe.id} value={pe.id}>
                        {pe.name} – {pe.designation} ({pe.mobile})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center justify-between text-xs text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    <span>No executives mapped.</span>
                    <button
                      type="button"
                      onClick={() => setIsQuickExecOpen(true)}
                      className="px-2 py-0.5 bg-amber-600 text-white rounded font-bold text-[10px]"
                    >
                      + Add Now
                    </button>
                  </div>
                )}
                {activeExecutive && (
                  <span className="text-[10px] text-indigo-600 mt-0.5 block">
                    {activeExecutive.department} • {activeExecutive.mobile}
                  </span>
                )}
              </div>

              {/* 3. Requirement Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  3. Requirement Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={requirementDate}
                  onChange={(e) => setRequirementDate(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                  required
                />
              </div>

              {/* 4. RFQ Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  4. RFQ Number <span className="text-slate-400 font-normal">(Auto-generated)</span>
                </label>
                <input
                  type="text"
                  value={rfqNumber}
                  onChange={(e) => setRfqNumber(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-slate-100 font-mono font-bold text-blue-800 focus:bg-white"
                  required
                />
              </div>

              {/* 5. Requirement Source */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  5. Requirement Source <span className="text-red-500">*</span>
                </label>
                <select
                  value={requirementSource}
                  onChange={(e) => setRequirementSource(e.target.value as any)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 font-bold"
                >
                  <option value="Email">Email</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Phone">Phone</option>
                  <option value="Manual">Manual</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* 6. Reference Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  6. Reference Number <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. PO-IND-9021 / RFQ-CLIENT-77"
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              {/* Expected Delivery Date & Priority */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Expected Delivery Date <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Urgency / Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-bold"
                >
                  <option value="High">High Priority (Breakdown)</option>
                  <option value="Medium">Medium (Standard Maintenance)</option>
                  <option value="Low">Low / Stock Replenish</option>
                </select>
              </div>

              {/* 7. Remarks */}
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  7. Remarks <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Technical clarifications, delivery instructions, site remarks..."
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Line Items List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-bold text-sm text-slate-900">Requirement Line Items ({items.length})</h4>
                <p className="text-[11px] text-slate-500">
                  Type item name (e.g. Molded Case Circuit Breaker (MCCB), 6206-2RS Bearing, Siemens 5A Fuse, MOSIL FG800 Grease)
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, idx) => {
                // Relevant sub-categories strictly for the selected category
                const activeCategoryObj = categories.find(
                  (c) => c.name.toLowerCase() === (item.category || '').toLowerCase()
                );
                const subCategoryOptions = activeCategoryObj?.subCategories || [];

                // Filter matching vendors strictly for the selected category
                const matchingVendors = vendors.filter((v) => {
                  if (!item.category) return false;
                  const vCats = (
                    v.materialCategories && v.materialCategories.length > 0
                      ? v.materialCategories
                      : v.productCategories || []
                  ).map((c) => c.toLowerCase());

                  // 1. Check vendor's registered material categories
                  const matchesCat = vCats.some(
                    (c) =>
                      c === item.category.toLowerCase() ||
                      c.includes(item.category.toLowerCase()) ||
                      item.category.toLowerCase().includes(c)
                  );

                  // 2. Check vendor's catalog items across all product identity fields
                  const q = (item.itemName || '').trim().toLowerCase();
                  const hasCatalogMatch = (v.catalogProducts || []).some((p) => {
                    const pCatMatches = p.category?.toLowerCase() === item.category.toLowerCase();
                    if (!q) return pCatMatches;
                    const pTextMatches = [
                      p.productName,
                      p.sourceProductName,
                      p.normalizedProductName,
                      p.productDesignation,
                      p.partNumber,
                      p.manufacturerCode,
                      p.modelNumber,
                      p.brand,
                      p.productFamily,
                      p.specification,
                      p.description,
                    ]
                      .filter(Boolean)
                      .some((f) => String(f).toLowerCase().includes(q));
                    return pCatMatches || pTextMatches;
                  });

                  return matchesCat || hasCatalogMatch;
                });

                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          Item #{idx + 1}
                        </span>

                        {/* Recommendation badge & actions */}
                        {item.recommendedCategory && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-blue-600" />
                              <span>AI Recommended: {item.recommendedCategory}</span>
                            </span>

                            {item.category !== item.recommendedCategory && (
                              <button
                                type="button"
                                onClick={() => handleApplyRecommendedCategory(idx)}
                                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold transition-colors"
                                title="Click to apply the AI-recommended category"
                              >
                                Use Recommended
                              </button>
                            )}
                          </div>
                        )}

                        {item.isCategoryManuallySelected && (
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                            Manual Category Lock
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {products.length > 0 && (
                          <select
                            onChange={(e) => handleSelectProduct(idx, e.target.value)}
                            className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1"
                            defaultValue=""
                          >
                            <option value="" disabled>
                              Autofill from Product Catalog...
                            </option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.itemName} ({p.partNumber || p.brand})
                              </option>
                            ))}
                          </select>
                        )}

                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Remove line item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Item Name & Material Category */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Item Name / Model / Description <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={item.itemName}
                          onChange={(e) => handleItemChange(idx, 'itemName', e.target.value)}
                          placeholder="e.g. Molded Case Circuit Breaker (MCCB), 6206-2RS Bearing, Siemens 5A Fuse..."
                          className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Material Category <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={item.category || ''}
                          onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                          className={`w-full text-xs p-2.5 border rounded-lg font-bold ${
                            item.category
                              ? 'border-blue-300 bg-blue-50/40 text-slate-900'
                              : 'border-amber-300 bg-amber-50 text-amber-900 ring-1 ring-amber-400/30'
                          }`}
                          required
                        >
                          <option value="">-- Select Category --</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* AI Product Identification & Catalogue Match Side-by-Side Display */}
                    {item.aiMatchResult && item.aiMatchResult.matched && (
                      <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-slate-50 border border-blue-200 rounded-xl p-3.5 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-bold text-slate-900">
                              AI Brand Catalogue Identification & Auto-Fill
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.aiMatchResult.confidence >= 95
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-blue-100 text-blue-800 border border-blue-300'
                              }`}
                            >
                              {item.aiMatchResult.confidence}% Confidence
                            </span>
                            {item.aiMatchResult.isLearnedMapping && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                                Learned Mapping
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {item.isAiMatchConfirmed ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-600 text-white">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>AI Mapping Confirmed & Trained</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleConfirmAiMapping(idx)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                                title="Confirm this mapping to train AI for future matching"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Confirm & Train AI</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Side-by-Side Comparison */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-white rounded-lg p-3 border border-slate-200 shadow-2xs">
                          {/* Left: Original Requirement Text */}
                          <div className="space-y-1.5 border-b md:border-b-0 md:border-r border-slate-200 pb-2 md:pb-0 md:pr-3">
                            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                              <FileText className="w-3.5 h-3.5 text-slate-400" />
                              <span>Original Requirement Text</span>
                            </div>
                            <p className="font-medium text-slate-800 bg-slate-50 p-2 rounded border border-slate-200 font-mono text-xs">
                              "{item.originalRequirementText || item.itemName}"
                            </p>
                            <p className="text-[10px] text-slate-500">
                              Match Reason: <span className="font-semibold text-slate-700">{item.aiMatchResult.matchReason}</span>
                            </p>
                          </div>

                          {/* Right: Identified Catalogue Product */}
                          <div className="space-y-1.5 md:pl-2">
                            <div className="flex items-center justify-between text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                              <span className="flex items-center gap-1">
                                <Tag className="w-3.5 h-3.5 text-blue-600" />
                                <span>Identified Catalogue Product</span>
                              </span>
                              {item.aiMatchResult.partCode && (
                                <span className="font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                  {item.aiMatchResult.partCode}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-slate-700">
                              <div>
                                <span className="text-[10px] text-slate-500 block">Brand:</span>
                                <span className="font-bold text-slate-900">{item.aiMatchResult.brand || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 block">Category:</span>
                                <span className="font-medium">
                                  {item.aiMatchResult.category} {item.aiMatchResult.subCategory ? `› ${item.aiMatchResult.subCategory}` : ''}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 block">Rating / Spec:</span>
                                <span className="font-medium">
                                  {[item.aiMatchResult.rating, item.aiMatchResult.poles].filter(Boolean).join(', ') || 'Standard'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 block">Catalogue Rate:</span>
                                <span className="font-bold text-emerald-700 font-mono">
                                  {item.aiMatchResult.currentRate ? `₹${item.aiMatchResult.currentRate.toLocaleString('en-IN')}` : 'Request Quote'}
                                </span>
                              </div>
                            </div>
                            {item.aiMatchResult.supplier && (
                              <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-100 flex items-center gap-1.5">
                                <span className="text-slate-500">Preferred Supplier:</span>
                                <span className="font-semibold text-slate-800">{item.aiMatchResult.supplier}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Alternative Matches / Ambiguity Resolution */}
                        {item.aiMatchResult.alternativeMatches && item.aiMatchResult.alternativeMatches.length > 0 && (
                          <div className="pt-1 border-t border-blue-200/60">
                            <span className="text-[11px] font-bold text-slate-600 block mb-1.5">
                              Alternative Catalogue Matches (Click to Select):
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {item.aiMatchResult.alternativeMatches.map((alt, aIdx) => (
                                <button
                                  key={aIdx}
                                  type="button"
                                  onClick={() => handleSelectAlternativeMatch(idx, alt)}
                                  className="px-2.5 py-1 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-900 rounded-lg border border-slate-300 hover:border-blue-400 text-xs text-left transition-colors flex items-center gap-2 group shadow-2xs cursor-pointer"
                                >
                                  <span className="font-bold text-slate-900 group-hover:text-blue-600">{alt.brand}</span>
                                  <span className="font-mono text-slate-600">{alt.partCode}</span>
                                  <span className="text-slate-500 text-[11px] truncate max-w-[150px]">{alt.productName}</span>
                                  {alt.rate && (
                                    <span className="font-mono font-bold text-emerald-700 text-[11px]">₹{alt.rate}</span>
                                  )}
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded group-hover:bg-blue-100 group-hover:text-blue-700">
                                    {alt.confidence}%
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sub-Category, Make/Brand, Part Number */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Sub-Category {item.category ? `(${item.category})` : ''}
                        </label>
                        <select
                          value={item.subCategory || ''}
                          onChange={(e) => handleItemChange(idx, 'subCategory', e.target.value)}
                          disabled={!item.category}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          {!item.category ? (
                            <option value="">Select Category First...</option>
                          ) : (
                            <>
                              <option value="">Select sub-category...</option>
                              {subCategoryOptions.map((sub, sIdx) => (
                                <option key={sIdx} value={sub}>
                                  {sub}
                                </option>
                              ))}
                            </>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Make / Brand</label>
                        <input
                          type="text"
                          value={item.brand}
                          onChange={(e) => handleItemChange(idx, 'brand', e.target.value)}
                          placeholder="Schneider, Siemens, SKF, Festo..."
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Part / Model No.</label>
                        <input
                          type="text"
                          value={item.partNumber}
                          onChange={(e) => handleItemChange(idx, 'partNumber', e.target.value)}
                          placeholder="e.g. NSX100F, 6206-2RS, 3NA3805..."
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono"
                        />
                      </div>
                    </div>

                    {/* Quantity, Target Price, Specifications */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Quantity & UOM <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-20 text-xs p-2 border border-slate-300 rounded-lg font-bold"
                            required
                          />
                          <select
                            value={item.uom}
                            onChange={(e) => handleItemChange(idx, 'uom', e.target.value)}
                            className="flex-1 text-xs p-2 border border-slate-300 rounded-lg bg-white"
                          >
                            <option value="NOS">NOS</option>
                            <option value="SET">SET</option>
                            <option value="MTR">MTR</option>
                            <option value="KG">KG</option>
                            <option value="LTR">LTR</option>
                            <option value="PKT">PKT</option>
                            <option value="BOX">BOX</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Target Price (INR)</label>
                        <input
                          type="number"
                          value={item.targetPrice || ''}
                          onChange={(e) => handleItemChange(idx, 'targetPrice', parseFloat(e.target.value) || 0)}
                          placeholder="Optional budget target"
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Specifications</label>
                        <input
                          type="text"
                          value={item.specification}
                          onChange={(e) => handleItemChange(idx, 'specification', e.target.value)}
                          placeholder="e.g. 400A 3P 50kA, 24VDC, C3 clearance..."
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>

                    {/* Matched Suppliers & Direct Vendor Rate Selection */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-emerald-600" />
                          <span className="font-bold text-slate-800">
                            Matching Suppliers for{' '}
                            <span className="text-blue-700">{item.category || 'Selected Category'}</span>:
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                              matchingVendors.length > 0
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {matchingVendors.length} Verified Vendors
                          </span>
                        </div>

                        {item.assignedVendorName && (
                          <div className="flex items-center gap-1.5 bg-blue-50 text-blue-900 border border-blue-200 px-2.5 py-1 rounded-lg text-xs font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>Selected Supplier: {item.assignedVendorName}</span>
                          </div>
                        )}
                      </div>

                      {matchingVendors.length === 0 ? (
                        <div className="text-[11px] text-slate-500 py-1 flex items-center justify-between flex-wrap gap-2">
                          <span>
                            {item.category
                              ? `No registered suppliers currently mapped to "${item.category}". You can select any registered vendor manually:`
                              : 'Select a category to view relevant certified suppliers.'}
                          </span>
                          {vendors.length > 0 && (
                            <select
                              value={item.assignedVendorId || ''}
                              onChange={(e) => {
                                const v = vendors.find((vend) => vend.id === e.target.value);
                                if (v) {
                                  handleItemChange(idx, 'assignedVendorId', v.id);
                                  handleItemChange(idx, 'assignedVendorName', v.companyName);
                                }
                              }}
                              className="text-xs p-1.5 border border-slate-300 rounded-lg bg-white"
                            >
                              <option value="">Manual Select Registered Vendor...</option>
                              {vendors.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.companyName} ({v.city})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                          {matchingVendors.slice(0, 3).map((v) => {
                            const isSelected = item.assignedVendorId === v.id;
                            const qItem = (item.itemName || '').trim().toLowerCase();
                            const matchedCatalogItem = (v.catalogProducts || []).find((p) =>
                              qItem
                                ? [
                                    p.productName,
                                    p.sourceProductName,
                                    p.productDesignation,
                                    p.partNumber,
                                    p.modelNumber,
                                    p.specification,
                                  ]
                                    .filter(Boolean)
                                    .some((f) => String(f).toLowerCase().includes(qItem))
                                : false
                            );

                            return (
                              <div
                                key={v.id}
                                className={`p-2.5 rounded-lg border transition-all ${
                                  isSelected
                                    ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-400/40'
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <div className="font-bold text-slate-900 truncate" title={v.companyName}>
                                    {v.companyName}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleItemChange(idx, 'assignedVendorId', v.id);
                                      handleItemChange(idx, 'assignedVendorName', v.companyName);
                                    }}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                                      isSelected
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {isSelected ? 'Selected' : 'Select'}
                                  </button>
                                </div>

                                <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                                  {v.contactPerson} • {v.mobile || v.email}
                                </div>

                                {matchedCatalogItem && (
                                  <div className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-1 truncate">
                                    Catalog match: {matchedCatalogItem.productName}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Direct Vendor Rate Input (if vendor selected) */}
                      {item.assignedVendorId && (
                        <div className="p-2.5 bg-blue-50/50 rounded-lg border border-blue-200 flex flex-wrap items-center gap-3 text-xs">
                          <span className="font-bold text-blue-950 flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                            <span>Direct Vendor Quoted Rate:</span>
                          </span>

                          <div className="flex items-center gap-1">
                            <span className="text-slate-500">₹</span>
                            <input
                              type="number"
                              min="0"
                              value={item.vendorRate || ''}
                              onChange={(e) => handleItemChange(idx, 'vendorRate', parseFloat(e.target.value) || 0)}
                              placeholder="Quoted rate"
                              className="w-28 p-1.5 border border-blue-300 rounded-lg bg-white font-mono font-bold"
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-600">GST:</span>
                            <select
                              value={item.vendorGst || 18}
                              onChange={(e) => handleItemChange(idx, 'vendorGst', parseInt(e.target.value) || 18)}
                              className="p-1 border border-blue-300 rounded-lg bg-white text-xs"
                            >
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <input
                              type="text"
                              value={item.vendorDeliveryDays || ''}
                              onChange={(e) => handleItemChange(idx, 'vendorDeliveryDays', e.target.value)}
                              placeholder="e.g. 3-5 Days"
                              className="w-24 p-1.5 border border-blue-300 rounded-lg bg-white text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">General Requirement Remarks</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Urgent maintenance spare, Gate 3 delivery, include test certificate..."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <span className="text-xs text-slate-500 font-medium">
              Total <strong>{items.length}</strong> requirement line items
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs shadow-blue-500/20 transition-all"
              >
                Save Customer Requirement
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* QUICK ADD COMPANY SUB-MODAL */}
      {isQuickCompanyOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h4 className="font-bold text-sm text-slate-900">+ Quick Add Company</h4>
              <button
                type="button"
                onClick={() => setIsQuickCompanyOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleQuickAddCompany} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  value={quickCompName}
                  onChange={(e) => setQuickCompName(e.target.value)}
                  placeholder="e.g. ABC Industries"
                  className="w-full p-2 border border-slate-300 rounded-lg font-bold"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">GST Number</label>
                <input
                  type="text"
                  value={quickCompGst}
                  onChange={(e) => setQuickCompGst(e.target.value.toUpperCase())}
                  placeholder="e.g. 24AABCA1234D1Z5"
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={quickCompCity}
                    onChange={(e) => setQuickCompCity(e.target.value)}
                    placeholder="City"
                    className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={quickCompState}
                    onChange={(e) => setQuickCompState(e.target.value)}
                    placeholder="State"
                    className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickCompanyOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg font-bold shadow-xs"
                >
                  Save & Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ADD PURCHASE EXECUTIVE SUB-MODAL */}
      {isQuickExecOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-sm text-slate-900">+ Add Purchase Executive</h4>
                <p className="text-[10px] text-slate-400">For {activeCompany?.companyName}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickExecOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleQuickAddExec} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Executive Name *</label>
                <input
                  type="text"
                  value={quickExecName}
                  onChange={(e) => setQuickExecName(e.target.value)}
                  placeholder="e.g. Rahul Patel"
                  className="w-full p-2 border border-slate-300 rounded-lg font-bold"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Designation</label>
                  <select
                    value={quickExecDesig}
                    onChange={(e) => setQuickExecDesig(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                  >
                    <option value="Purchase Executive">Purchase Executive</option>
                    <option value="Senior Purchase Executive">Senior Purchase Executive</option>
                    <option value="Procurement Manager">Procurement Manager</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={quickExecDept}
                    onChange={(e) => setQuickExecDept(e.target.value)}
                    placeholder="e.g. Mechanical"
                    className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mobile *</label>
                  <input
                    type="tel"
                    value={quickExecMobile}
                    onChange={(e) => setQuickExecMobile(e.target.value)}
                    placeholder="+91 98250 12345"
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email (Opt)</label>
                  <input
                    type="email"
                    value={quickExecEmail}
                    onChange={(e) => setQuickExecEmail(e.target.value)}
                    placeholder="officer@corp.com"
                    className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickExecOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-bold shadow-xs"
                >
                  Save & Map
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
