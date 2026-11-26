import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CheckCircle,
  Building,
  DollarSign,
  Upload,
  Sparkles,
  Layers,
  FileText,
  Clock,
  Calculator,
  Plus,
  Trash2,
  Calendar,
  ShieldAlert,
  Percent,
  Truck,
  Check,
  AlertCircle,
  Search,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Filter,
  ArrowRight,
  Tag,
  BookmarkCheck,
  CheckCircle2,
  Package,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CustomerRequirement, Vendor, VendorQuote, VendorQuoteItem, RequirementItem } from '../../types';

interface DirectVendorRateEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRequirementId?: string | null;
  defaultVendorId?: string | null;
  quoteToEdit?: VendorQuote | null;
  onSuccess?: (quoteId: string) => void;
}

interface RateEntryItem {
  requirementItemId: string;
  itemName: string;
  itemDescription: string;
  category: string;
  partNumber: string;
  brand: string;
  quantity: number;
  uom: string;
  mrp?: number;
  discountType?: 'PERCENTAGE' | 'FIXED' | 'DIRECT';
  discountPercentage?: number;
  fixedDiscountAmount?: number;
  resellerPrice: number; // Unit supplier rate / Net purchase rate
  gstPercent: number; // 0, 5, 12, 18, 28
  freight: number;
  otherCharges: number;
  discount: number;
  deliveryDays: number;
  availability: 'IN_STOCK' | '1-2 WEEKS' | '3-4 WEEKS' | 'MADE_TO_ORDER';
  warranty: string;
  rateValidity: string;
  remarks: string;
}

export const DirectVendorRateEntryModal: React.FC<DirectVendorRateEntryModalProps> = ({
  isOpen,
  onClose,
  defaultRequirementId,
  defaultVendorId,
  quoteToEdit,
  onSuccess,
}) => {
  const {
    requirements,
    vendors,
    categories,
    vendorQuotes,
    currentUser,
    submitVendorQuote,
    updateVendorQuote,
    learnCategoryFromVendorQuotation,
  } = useApp();

  // Active open requirements
  const selectableRequirements = requirements.filter(
    (r) => !r.isDeleted && r.status !== 'ORDER_CLOSED' && r.status !== 'CANCELLED'
  );

  const [selectedReqId, setSelectedReqId] = useState<string>(
    quoteToEdit?.requirementId ||
      defaultRequirementId ||
      (selectableRequirements[0]?.id || '')
  );

  const [selectedVendorId, setSelectedVendorId] = useState<string>(
    quoteToEdit?.vendorId || defaultVendorId || (vendors[0]?.id || '')
  );

  const [validUntil, setValidUntil] = useState(quoteToEdit?.validUntil || '30 Days');
  const [paymentTerms, setPaymentTerms] = useState(
    quoteToEdit?.paymentTerms || '30 Days Net from Delivery'
  );
  const [generalRemarks, setGeneralRemarks] = useState(
    quoteToEdit?.remarks || 'Direct supplier rate sourced from certified distributor.'
  );
  const [attachmentName, setAttachmentName] = useState(
    quoteToEdit?.attachmentName || 'Official_Supplier_Quotation.pdf'
  );
  const [rateItems, setRateItems] = useState<RateEntryItem[]>([]);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Product Selection Panel / Modal State
  const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productCatFilter, setProductCatFilter] = useState('ALL');
  const [productBrandFilter, setProductBrandFilter] = useState('ALL');
  const [productStatusFilter, setProductStatusFilter] = useState<
    'ALL' | 'PENDING' | 'QUOTED_THIS_VENDOR' | 'UNQUOTED_THIS_VENDOR'
  >('ALL');

  // Find active requirement and vendor objects
  const activeReq =
    requirements.find((r) => r.id === selectedReqId) || selectableRequirements[0];
  const activeVendor =
    vendors.find((v) => v.id === selectedVendorId) || vendors[0];

  const rfqItems = activeReq?.items || [];
  const quotesForThisReq = vendorQuotes.filter((q) => q.requirementId === activeReq?.id);
  const vendorExistingQuote = quotesForThisReq.find((q) => q.vendorId === activeVendor?.id);

  // Initialize form when opened or quoteToEdit changes
  useEffect(() => {
    if (!isOpen) return;

    if (quoteToEdit) {
      setSelectedReqId(quoteToEdit.requirementId);
      setSelectedVendorId(quoteToEdit.vendorId);
      setValidUntil(quoteToEdit.validUntil || '30 Days');
      setPaymentTerms(quoteToEdit.paymentTerms || '30 Days Net from Delivery');
      setGeneralRemarks(quoteToEdit.remarks || '');
      setAttachmentName(quoteToEdit.attachmentName || 'Official_Supplier_Quotation.pdf');

      const items: RateEntryItem[] = (quoteToEdit.items || []).map((it) => ({
        requirementItemId: it.requirementItemId || `ITEM-${Date.now()}`,
        itemName: it.itemName,
        itemDescription: it.itemDescription || '',
        category: it.category || 'Industrial Spares',
        partNumber: it.partNumber || '',
        brand: it.brand || '',
        quantity: it.quantity || 1,
        uom: it.uom || 'NOS',
        resellerPrice: it.resellerPrice || 0,
        gstPercent: it.gstPercent ?? 18,
        freight: it.freight || 0,
        otherCharges: it.otherCharges || 0,
        discount: it.discount || 0,
        deliveryDays: it.deliveryDays || 5,
        availability: it.availability || 'IN_STOCK',
        warranty: it.warranty || '12 Months OEM Warranty',
        rateValidity: it.rateValidity || '30 Days',
        remarks: it.remarks || '',
      }));
      setRateItems(items);
      setIsProductSelectorOpen(false);
      return;
    }

    if (defaultRequirementId) {
      setSelectedReqId(defaultRequirementId);
    }
    if (defaultVendorId) {
      setSelectedVendorId(defaultVendorId);
    }

    const currentReqId = defaultRequirementId || selectedReqId;
    const currentVendorId = defaultVendorId || selectedVendorId;

    const existingQuote = vendorQuotes.find(
      (q) => q.requirementId === currentReqId && q.vendorId === currentVendorId
    );

    if (existingQuote && existingQuote.items && existingQuote.items.length > 0) {
      const items: RateEntryItem[] = existingQuote.items.map((it) => ({
        requirementItemId: it.requirementItemId || `ITEM-${Date.now()}`,
        itemName: it.itemName,
        itemDescription: it.itemDescription || '',
        category: it.category || 'Industrial Spares',
        partNumber: it.partNumber || '',
        brand: it.brand || '',
        quantity: it.quantity || 1,
        uom: it.uom || 'NOS',
        resellerPrice: it.resellerPrice || 0,
        gstPercent: it.gstPercent ?? 18,
        freight: it.freight || 0,
        otherCharges: it.otherCharges || 0,
        discount: it.discount || 0,
        deliveryDays: it.deliveryDays || 5,
        availability: it.availability || 'IN_STOCK',
        warranty: it.warranty || '12 Months OEM Warranty',
        rateValidity: it.rateValidity || '30 Days',
        remarks: it.remarks || '',
      }));
      setRateItems(items);
      setIsProductSelectorOpen(false);
    } else {
      // Do NOT load all 52 products automatically! Start with empty rate list and open product selector.
      setRateItems([]);
      setIsProductSelectorOpen(true);
    }
  }, [isOpen, quoteToEdit, defaultRequirementId, defaultVendorId]);

  // Handle requirement dropdown change
  const handleRequirementChange = (newReqId: string) => {
    setSelectedReqId(newReqId);
    const existingQuote = vendorQuotes.find(
      (q) => q.requirementId === newReqId && q.vendorId === selectedVendorId
    );
    if (existingQuote && existingQuote.items && existingQuote.items.length > 0) {
      setRateItems(
        existingQuote.items.map((it) => ({
          requirementItemId: it.requirementItemId || `ITEM-${Date.now()}`,
          itemName: it.itemName,
          itemDescription: it.itemDescription || '',
          category: it.category || 'Industrial Spares',
          partNumber: it.partNumber || '',
          brand: it.brand || '',
          quantity: it.quantity || 1,
          uom: it.uom || 'NOS',
          resellerPrice: it.resellerPrice || 0,
          gstPercent: it.gstPercent ?? 18,
          freight: it.freight || 0,
          otherCharges: it.otherCharges || 0,
          discount: it.discount || 0,
          deliveryDays: it.deliveryDays || 5,
          availability: it.availability || 'IN_STOCK',
          warranty: it.warranty || '12 Months OEM Warranty',
          rateValidity: it.rateValidity || '30 Days',
          remarks: it.remarks || '',
        }))
      );
      setIsProductSelectorOpen(false);
    } else {
      setRateItems([]);
      setIsProductSelectorOpen(true);
    }
    setSelectedProductIds([]);
  };

  // Handle vendor dropdown change
  const handleVendorChange = (newVendorId: string) => {
    setSelectedVendorId(newVendorId);
    const existingQuote = vendorQuotes.find(
      (q) => q.requirementId === selectedReqId && q.vendorId === newVendorId
    );
    if (existingQuote && existingQuote.items && existingQuote.items.length > 0) {
      setRateItems(
        existingQuote.items.map((it) => ({
          requirementItemId: it.requirementItemId || `ITEM-${Date.now()}`,
          itemName: it.itemName,
          itemDescription: it.itemDescription || '',
          category: it.category || 'Industrial Spares',
          partNumber: it.partNumber || '',
          brand: it.brand || '',
          quantity: it.quantity || 1,
          uom: it.uom || 'NOS',
          resellerPrice: it.resellerPrice || 0,
          gstPercent: it.gstPercent ?? 18,
          freight: it.freight || 0,
          otherCharges: it.otherCharges || 0,
          discount: it.discount || 0,
          deliveryDays: it.deliveryDays || 5,
          availability: it.availability || 'IN_STOCK',
          warranty: it.warranty || '12 Months OEM Warranty',
          rateValidity: it.rateValidity || '30 Days',
          remarks: it.remarks || '',
        }))
      );
      setIsProductSelectorOpen(false);
    } else {
      // Don't wipe items if user already started picking items for this RFQ unless empty
      if (rateItems.length === 0) {
        setIsProductSelectorOpen(true);
      }
    }
    setSelectedProductIds([]);
  };

  // Unique categories and brands in this RFQ
  const rfqCategories = useMemo(() => {
    return Array.from(new Set(rfqItems.map((it) => it.category).filter(Boolean))).sort();
  }, [rfqItems]);

  const rfqBrands = useMemo(() => {
    return Array.from(new Set(rfqItems.map((it) => it.brand).filter(Boolean))).sort();
  }, [rfqItems]);

  // Filtered RFQ Products for the Product Selection Section
  const filteredRfqProducts = useMemo(() => {
    return rfqItems.filter((it) => {
      const q = productSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        it.itemName.toLowerCase().includes(q) ||
        (it.partNumber && it.partNumber.toLowerCase().includes(q)) ||
        (it.brand && it.brand.toLowerCase().includes(q)) ||
        (it.category && it.category.toLowerCase().includes(q)) ||
        (it.specification && it.specification.toLowerCase().includes(q)) ||
        (it.description && it.description.toLowerCase().includes(q));

      const matchesCat =
        productCatFilter === 'ALL' ||
        (it.category || '').toLowerCase() === productCatFilter.toLowerCase();
      const matchesBrand =
        productBrandFilter === 'ALL' ||
        (it.brand || '').toLowerCase() === productBrandFilter.toLowerCase();

      // Check quote status
      const isQuotedByThisVendor =
        vendorExistingQuote?.items.some(
          (qi) =>
            qi.requirementItemId === it.id ||
            qi.itemName.trim().toLowerCase() === it.itemName.trim().toLowerCase()
        ) || rateItems.some((ri) => ri.requirementItemId === it.id);

      const isQuotedByAny =
        quotesForThisReq.some((quote) =>
          quote.items.some(
            (qi) =>
              qi.requirementItemId === it.id ||
              qi.itemName.trim().toLowerCase() === it.itemName.trim().toLowerCase()
          )
        ) || rateItems.some((ri) => ri.requirementItemId === it.id);

      let matchesStatus = true;
      if (productStatusFilter === 'PENDING') {
        matchesStatus = !isQuotedByAny;
      } else if (productStatusFilter === 'QUOTED_THIS_VENDOR') {
        matchesStatus = isQuotedByThisVendor;
      } else if (productStatusFilter === 'UNQUOTED_THIS_VENDOR') {
        matchesStatus = !isQuotedByThisVendor;
      }

      return matchesSearch && matchesCat && matchesBrand && matchesStatus;
    });
  }, [
    rfqItems,
    productSearch,
    productCatFilter,
    productBrandFilter,
    productStatusFilter,
    vendorExistingQuote,
    quotesForThisReq,
    rateItems,
  ]);

  // Overall RFQ Sourcing Metrics
  const totalRfqCount = rfqItems.length;
  const itemsInFormCount = rateItems.length;
  const unquotedPendingCount = rfqItems.filter((it) => {
    const isQuoted =
      quotesForThisReq.some((quote) =>
        quote.items.some(
          (qi) =>
            qi.requirementItemId === it.id ||
            qi.itemName.trim().toLowerCase() === it.itemName.trim().toLowerCase()
        )
      ) || rateItems.some((ri) => ri.requirementItemId === it.id);
    return !isQuoted;
  }).length;

  if (!isOpen) return null;

  // Toggle single product checkbox in selector
  const toggleSelectProduct = (itemId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  // Select all filtered products
  const handleSelectAllFiltered = () => {
    const ids = filteredRfqProducts.map((it) => it.id);
    setSelectedProductIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  // Deselect all
  const handleDeselectAll = () => {
    setSelectedProductIds([]);
  };

  // Commit selected products into rateItems schedule
  const handleAddSelectedProducts = () => {
    if (selectedProductIds.length === 0) return;

    const newItemsToAdd: RateEntryItem[] = [];
    selectedProductIds.forEach((id) => {
      // Avoid duplicate lines in rate sheet
      const alreadyIn = rateItems.some((ri) => ri.requirementItemId === id);
      if (alreadyIn) return;

      const rfqItem = rfqItems.find((it) => it.id === id);
      if (!rfqItem) return;

      // Check if vendor already has a prior unit rate recorded for this item
      const priorItem = vendorExistingQuote?.items.find(
        (qi) =>
          qi.requirementItemId === id ||
          qi.itemName.trim().toLowerCase() === rfqItem.itemName.trim().toLowerCase()
      );

      newItemsToAdd.push({
        requirementItemId: rfqItem.id,
        itemName: rfqItem.itemName,
        itemDescription: rfqItem.specification || rfqItem.description || '',
        category: rfqItem.category || rfqItem.recommendedCategory || 'Industrial Spares',
        partNumber: rfqItem.partNumber || rfqItem.modelNumber || '',
        brand: rfqItem.brand || '',
        quantity: rfqItem.quantity || 1,
        uom: rfqItem.uom || 'NOS',
        resellerPrice:
          priorItem?.resellerPrice ||
          (rfqItem.targetPrice ? Math.round(rfqItem.targetPrice * 0.9) : 0),
        gstPercent: priorItem?.gstPercent ?? 18,
        freight: priorItem?.freight ?? 0,
        otherCharges: priorItem?.otherCharges ?? 0,
        discount: priorItem?.discount ?? 0,
        deliveryDays: priorItem?.deliveryDays ?? 5,
        availability: priorItem?.availability || 'IN_STOCK',
        warranty: priorItem?.warranty || '12 Months OEM Warranty',
        rateValidity: priorItem?.rateValidity || validUntil,
        remarks: priorItem?.remarks || '',
      });
    });

    setRateItems((prev) => [...prev, ...newItemsToAdd]);
    setSelectedProductIds([]);
    setIsProductSelectorOpen(false);
  };

  // Quick action: Load all items if vendor quoted entire RFQ
  const handleLoadAllProducts = () => {
    const allItems: RateEntryItem[] = rfqItems.map((rfqItem) => {
      const priorItem = vendorExistingQuote?.items.find(
        (qi) =>
          qi.requirementItemId === rfqItem.id ||
          qi.itemName.trim().toLowerCase() === rfqItem.itemName.trim().toLowerCase()
      );
      return {
        requirementItemId: rfqItem.id,
        itemName: rfqItem.itemName,
        itemDescription: rfqItem.specification || rfqItem.description || '',
        category: rfqItem.category || rfqItem.recommendedCategory || 'Industrial Spares',
        partNumber: rfqItem.partNumber || rfqItem.modelNumber || '',
        brand: rfqItem.brand || '',
        quantity: rfqItem.quantity || 1,
        uom: rfqItem.uom || 'NOS',
        resellerPrice:
          priorItem?.resellerPrice ||
          (rfqItem.targetPrice ? Math.round(rfqItem.targetPrice * 0.9) : 0),
        gstPercent: priorItem?.gstPercent ?? 18,
        freight: priorItem?.freight ?? 0,
        otherCharges: priorItem?.otherCharges ?? 0,
        discount: priorItem?.discount ?? 0,
        deliveryDays: priorItem?.deliveryDays ?? 5,
        availability: priorItem?.availability || 'IN_STOCK',
        warranty: priorItem?.warranty || '12 Months OEM Warranty',
        rateValidity: priorItem?.rateValidity || validUntil,
        remarks: priorItem?.remarks || '',
      };
    });
    setRateItems(allItems);
    setIsProductSelectorOpen(false);
  };

  // Rate item input change handler
  const handleItemChange = (index: number, field: keyof RateEntryItem, value: any) => {
    setRateItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Manual line addition for accessories or unlisted spares
  const handleAddManualItem = () => {
    setRateItems((prev) => [
      ...prev,
      {
        requirementItemId: `CUSTOM-${Date.now()}`,
        itemName: 'Additional Accessory / Spare',
        itemDescription: 'OEM grade specification',
        category: categories[0]?.name || 'Industrial Spares',
        partNumber: '',
        brand: '',
        quantity: 1,
        uom: 'NOS',
        resellerPrice: 0,
        gstPercent: 18,
        freight: 0,
        otherCharges: 0,
        discount: 0,
        deliveryDays: 5,
        availability: 'IN_STOCK',
        warranty: '12 Months OEM',
        rateValidity: '30 Days',
        remarks: '',
      },
    ]);
  };

  // Remove item from rate sheet (only removes from this quote, NEVER deletes from customer RFQ)
  const handleRemoveItem = (index: number) => {
    setRateItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Clear all items currently in form
  const handleClearRateSheet = () => {
    if (confirm('Clear all items from current rate entry form? (Original RFQ items remain completely safe in database)')) {
      setRateItems([]);
      setIsProductSelectorOpen(true);
    }
  };

  // Calculate landed costs with full MRP & Discount Architecture
  const calculateLineTotals = (item: RateEntryItem) => {
    let unitRate = Number(item.resellerPrice) || 0;
    let discountAmt = Number(item.discount) || 0;

    // If MRP is present, apply calculation rules
    if (item.mrp && item.mrp > 0) {
      if (item.discountType === 'PERCENTAGE' && item.discountPercentage) {
        const discPerUnit = (item.mrp * item.discountPercentage) / 100;
        unitRate = Math.max(0, item.mrp - discPerUnit);
        discountAmt = discPerUnit * (Number(item.quantity) || 1);
      } else if (item.discountType === 'FIXED' && item.fixedDiscountAmount) {
        unitRate = Math.max(0, item.mrp - item.fixedDiscountAmount);
        discountAmt = item.fixedDiscountAmount * (Number(item.quantity) || 1);
      } else if (item.discountType === 'DIRECT') {
        unitRate = Number(item.resellerPrice) || item.mrp;
        discountAmt = 0;
      }
    }

    const baseTotal = unitRate * (Number(item.quantity) || 1);
    const taxableAmount = Math.max(0, baseTotal);
    const gstAmount = (taxableAmount * (Number(item.gstPercent) || 0)) / 100;
    const freightAmount = Number(item.freight) || 0;
    const otherAmount = Number(item.otherCharges) || 0;
    const totalLanded = taxableAmount + gstAmount + freightAmount + otherAmount;
    return { baseTotal, discountAmt, taxableAmount, gstAmount, totalLanded, netUnitRate: unitRate };
  };

  const grandTotalLanded = rateItems.reduce(
    (acc, it) => acc + calculateLineTotals(it).totalLanded,
    0
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setAttachmentName(file.name);
    }
  };

  // Submit and Save
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeVendor) {
      alert('Please select a valid supplier/vendor.');
      return;
    }

    if (!activeReq) {
      alert('Please select a valid customer requirement / RFQ.');
      return;
    }

    if (rateItems.length === 0) {
      alert('Please select at least one product for which vendor rates have been provided.');
      setIsProductSelectorOpen(true);
      return;
    }

    const processedItems: VendorQuoteItem[] = rateItems.map((item) => {
      const totals = calculateLineTotals(item);
      return {
        requirementItemId: item.requirementItemId,
        itemName: item.itemName,
        partNumber: item.partNumber,
        brand: item.brand,
        itemDescription: item.itemDescription,
        category: item.category,
        quantity: item.quantity,
        uom: item.uom,
        resellerPrice: Number(item.resellerPrice) || 0,
        unitRate: Number(item.resellerPrice) || 0,
        gstPercent: Number(item.gstPercent) || 0,
        freight: Number(item.freight) || 0,
        otherCharges: Number(item.otherCharges) || 0,
        discount: Number(item.discount) || 0,
        totalLandedCost: totals.totalLanded,
        deliveryDays: Number(item.deliveryDays) || 1,
        availability: item.availability,
        warranty: item.warranty,
        rateValidity: item.rateValidity || validUntil,
        remarks: item.remarks,
      };
    });

    // Check if this vendor already has an existing quote for this requirement
    const existingQuote =
      quoteToEdit ||
      vendorQuotes.find(
        (q) => q.requirementId === activeReq.id && q.vendorId === activeVendor.id
      );

    let savedQuote: VendorQuote;

    if (existingQuote) {
      // Merge with previously quoted items for this vendor so no prior rates are lost
      const processedItemIds = new Set(processedItems.map((p) => p.requirementItemId).filter(Boolean));
      const processedItemNames = new Set(processedItems.map((p) => p.itemName.trim().toLowerCase()));

      const retainedPriorItems = (existingQuote.items || []).filter(
        (prior) =>
          !processedItemIds.has(prior.requirementItemId) &&
          !processedItemNames.has(prior.itemName.trim().toLowerCase())
      );

      const mergedItems = [...retainedPriorItems, ...processedItems];

      savedQuote = updateVendorQuote({
        ...existingQuote,
        vendorId: activeVendor.id,
        vendorName: activeVendor.companyName,
        requirementId: activeReq.id,
        customerName: activeReq.customerName,
        validUntil,
        paymentTerms,
        remarks: generalRemarks,
        attachmentName,
        items: mergedItems,
      });
    } else {
      savedQuote = submitVendorQuote({
        requirementId: activeReq.id,
        customerName: activeReq.customerName,
        vendorId: activeVendor.id,
        vendorName: activeVendor.companyName,
        validUntil,
        paymentTerms,
        remarks: generalRemarks,
        attachmentName,
        items: processedItems,
      });
    }

    // Auto-learn vendor categories if not previously listed
    processedItems.forEach((it) => {
      if (it.category) {
        learnCategoryFromVendorQuotation(
          activeVendor.id,
          it.category,
          undefined,
          `Direct Rate ${activeReq.id}`
        );
      }
    });

    setSaveSuccessMsg(`Vendor rates for ${activeVendor.companyName} saved successfully (${processedItems.length} items quoted, ${activeReq.items.length - processedItems.length} items remain unquoted in RFQ).`);
    onSuccess?.(savedQuote.id);

    setTimeout(() => {
      setSaveSuccessMsg(null);
      onClose();
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-white">
                  {quoteToEdit ? `Edit Vendor Rate (${quoteToEdit.id})` : 'Product-Wise Direct Vendor Rate Entry'}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Stage 2: Direct Sourcing
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Independent Vendor Rates
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Select only the products for which the vendor provided rates. Unquoted products remain safely preserved as Pending in the customer RFQ.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert */}
        {saveSuccessMsg && (
          <div className="bg-emerald-600 text-white px-5 py-2.5 text-xs font-bold flex items-center gap-2 shrink-0">
            <CheckCircle className="w-4 h-4" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Target Customer Requirement and Vendor Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Target Customer Requirement / RFQ <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedReqId}
                onChange={(e) => handleRequirementChange(e.target.value)}
                disabled={!!quoteToEdit}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
              >
                {selectableRequirements.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} {r.rfqNumber ? `(${r.rfqNumber})` : ''} - {r.customerName} ({r.items.length} items)
                  </option>
                ))}
              </select>
              {activeReq && (
                <div className="mt-1.5 text-[11px] text-slate-500 flex items-center justify-between flex-wrap gap-1">
                  <span>
                    Customer: <strong className="text-slate-900">{activeReq.customerName}</strong>
                  </span>
                  <span>
                    Received: <strong className="text-slate-900">{activeReq.receivedRequirementDate || activeReq.requirementDate}</strong>
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Supplier / Vendor Partner <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedVendorId}
                onChange={(e) => handleVendorChange(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
              >
                {vendors.filter((v) => !v.isDeleted).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.id} - {v.companyName} ({v.city})
                  </option>
                ))}
              </select>
              {activeVendor && (
                <div className="mt-1.5 text-[11px] text-slate-500 flex items-center justify-between flex-wrap gap-1">
                  <span>
                    Contact:{' '}
                    <strong className="text-slate-900">
                      {activeVendor.contactPerson} ({activeVendor.mobile})
                    </strong>
                  </span>
                  <span>
                    Terms:{' '}
                    <strong className="text-slate-900">{activeVendor.paymentTerms}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Sourcing Summary Ribbon & Product Selection Trigger */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-blue-600" />
                <span>RFQ Total: <strong>{totalRfqCount} Products</strong></span>
              </span>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="text-emerald-700 font-semibold bg-emerald-100/80 px-2 py-0.5 rounded">
                Rate Sheet: <strong>{itemsInFormCount} Quoted</strong>
              </span>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="text-amber-700 font-semibold bg-amber-100/80 px-2 py-0.5 rounded">
                Unquoted in RFQ: <strong>{unquotedPendingCount} Pending</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsProductSelectorOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
                  isProductSelectorOpen
                    ? 'bg-blue-600 text-white shadow-blue-500/20'
                    : 'bg-white text-blue-700 border border-blue-300 hover:bg-blue-50'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  {isProductSelectorOpen
                    ? 'Hide Product Selector'
                    : '+ Choose Products for Vendor Rates'}
                </span>
                {isProductSelectorOpen ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
              </button>

              {itemsInFormCount < totalRfqCount && (
                <button
                  type="button"
                  onClick={handleLoadAllProducts}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-semibold transition-colors"
                  title="Load all RFQ products into rate sheet if vendor provided a full quotation"
                >
                  Select All {totalRfqCount}
                </button>
              )}

              {itemsInFormCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearRateSheet}
                  className="px-2 py-1.5 text-slate-500 hover:text-rose-600 text-[11px] font-medium transition-colors"
                  title="Clear rate sheet"
                >
                  Clear Sheet
                </button>
              )}
            </div>
          </div>

          {/* DEDICATED PRODUCT SELECTION PANEL (Requirement 2 & 5) */}
          {isProductSelectorOpen && (
            <div className="p-4 bg-slate-900 text-white rounded-xl border border-blue-500/40 shadow-xl space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div>
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-blue-400" />
                    <span>Select Products Quoted by {activeVendor?.companyName || 'Vendor'}</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Search and check only the products for which rates have been provided. Unchecked products remain in the RFQ as Pending.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsProductSelectorOpen(false)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search & Quick Filters Toolbar */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                {/* Search Bar */}
                <div className="sm:col-span-5 relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search by product name, brand, part #, or spec..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => setProductSearch('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Category Filter */}
                <div className="sm:col-span-3">
                  <select
                    value={productCatFilter}
                    onChange={(e) => setProductCatFilter(e.target.value)}
                    className="w-full py-1.5 px-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="ALL">All Categories ({rfqCategories.length})</option>
                    {rfqCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Brand Filter */}
                <div className="sm:col-span-2">
                  <select
                    value={productBrandFilter}
                    onChange={(e) => setProductBrandFilter(e.target.value)}
                    className="w-full py-1.5 px-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="ALL">All Brands ({rfqBrands.length})</option>
                    {rfqBrands.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selection helper buttons */}
                <div className="sm:col-span-2 flex items-center gap-1 justify-end">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-bold border border-slate-700"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded text-[10px] font-bold border border-slate-700"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Status Filter Tabs (Requirement 5) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setProductStatusFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all shrink-0 ${
                    productStatusFilter === 'ALL'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  All RFQ Products ({totalRfqCount})
                </button>
                <button
                  type="button"
                  onClick={() => setProductStatusFilter('PENDING')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all shrink-0 ${
                    productStatusFilter === 'PENDING'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Pending Rate Items ({unquotedPendingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setProductStatusFilter('UNQUOTED_THIS_VENDOR')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all shrink-0 ${
                    productStatusFilter === 'UNQUOTED_THIS_VENDOR'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Unquoted by this Vendor
                </button>
                <button
                  type="button"
                  onClick={() => setProductStatusFilter('QUOTED_THIS_VENDOR')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all shrink-0 ${
                    productStatusFilter === 'QUOTED_THIS_VENDOR'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Already in Rate Sheet ({itemsInFormCount})
                </button>
              </div>

              {/* Products Checklist Table */}
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/70 divide-y divide-slate-800/80 text-xs">
                {filteredRfqProducts.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    No RFQ products matched your search or status filter.
                  </div>
                ) : (
                  filteredRfqProducts.map((it, idx) => {
                    const isChecked = selectedProductIds.includes(it.id);
                    const isAlreadyAdded = rateItems.some((ri) => ri.requirementItemId === it.id);

                    // Other quotes for this item
                    const quotesForItem = quotesForThisReq.flatMap((q) =>
                      (q.items || [])
                        .filter(
                          (qi) =>
                            qi.requirementItemId === it.id ||
                            qi.itemName.trim().toLowerCase() === it.itemName.trim().toLowerCase()
                        )
                        .map((qi) => ({
                          vendorName: q.vendorName,
                          unitRate: qi.resellerPrice,
                          vendorId: q.vendorId,
                        }))
                    );

                    return (
                      <div
                        key={it.id}
                        onClick={() => toggleSelectProduct(it.id)}
                        className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/60 transition-colors ${
                          isChecked ? 'bg-blue-950/50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectProduct(it.id);
                            }}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-blue-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500" />
                            )}
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-[10px] text-slate-400">
                                {it.id}
                              </span>
                              <span className="font-bold text-white text-xs truncate">
                                {it.itemName}
                              </span>
                              {it.brand && (
                                <span className="px-1.5 py-0.2 bg-blue-900/60 text-blue-300 rounded text-[9px] font-bold border border-blue-700/50">
                                  {it.brand}
                                </span>
                              )}
                              {it.partNumber && (
                                <span className="font-mono text-[10px] text-slate-400">
                                  PN: {it.partNumber}
                                </span>
                              )}
                              {it.category && (
                                <span className="text-[10px] text-slate-400">
                                  • {it.category}
                                </span>
                              )}
                            </div>

                            {it.specification && (
                              <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                {it.specification}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right side status & commercial indicators */}
                        <div className="flex items-center gap-3 shrink-0 text-right">
                          <div className="text-right">
                            <span className="font-bold text-white text-xs block">
                              {it.quantity} {it.uom}
                            </span>
                            {it.targetPrice ? (
                              <span className="text-[10px] text-slate-400 block font-mono">
                                Target: ₹{it.targetPrice}
                              </span>
                            ) : null}
                          </div>

                          <div>
                            {isAlreadyAdded ? (
                              <span className="px-2 py-0.5 bg-emerald-950/80 text-emerald-300 border border-emerald-600/60 rounded text-[10px] font-bold flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                <span>In Rate Sheet</span>
                              </span>
                            ) : quotesForItem.length > 0 ? (
                              <span className="px-2 py-0.5 bg-blue-950/80 text-blue-300 border border-blue-600/60 rounded text-[10px] font-medium block">
                                Quoted ({quotesForItem.length} vendor{quotesForItem.length > 1 ? 's' : ''})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-950/80 text-amber-300 border border-amber-600/60 rounded text-[10px] font-medium block">
                                Pending Rates
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Selector Commit Toolbar */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <span className="text-xs text-slate-300">
                  <strong>{selectedProductIds.length}</strong> product{selectedProductIds.length !== 1 ? 's' : ''} selected
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsProductSelectorOpen(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddSelectedProducts}
                    disabled={selectedProductIds.length === 0}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-md transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Selected Products ({selectedProductIds.length})</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ITEM SOURCING & COMMERCIAL RATE SCHEDULE */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <span>Vendor Rate Schedule ({rateItems.length} Products Quoted)</span>
                  {activeVendor && (
                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {activeVendor.companyName}
                    </span>
                  )}
                </h4>
                <p className="text-[11px] text-slate-500">
                  Enter supplier unit rates, taxes, freight, and lead times. Only these {rateItems.length} items will have rates logged.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsProductSelectorOpen(true)}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add More Products from RFQ</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddManualItem}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                  title="Add custom unlisted accessory or service line item"
                >
                  <Plus className="w-3 h-3 text-slate-500" />
                  <span>Custom Item</span>
                </button>
              </div>
            </div>

            {/* Empty state prompt if 0 items selected */}
            {rateItems.length === 0 ? (
              <div className="p-8 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800">
                    No products added to this rate sheet yet
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-0.5">
                    Click below to open the RFQ product list, select only the products for which {activeVendor?.companyName || 'the supplier'} has provided rates, and add them.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsProductSelectorOpen(true)}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 inline-flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Choose Products for Which Rates Are Available</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {rateItems.map((item, idx) => {
                  const totals = calculateLineTotals(item);
                  return (
                    <div
                      key={item.requirementItemId || idx}
                      className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3 relative hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-900">
                            {item.itemName} {item.partNumber && `(${item.partNumber})`}
                          </span>
                          {item.brand && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                              Brand: {item.brand}
                            </span>
                          )}
                          {item.category && (
                            <span className="text-[10px] text-slate-500">
                              • {item.category}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Final Landed Cost: ₹{totals.totalLanded.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                            title="Remove this line from rate sheet"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Row 1: Item Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Item Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={item.itemName}
                            onChange={(e) => handleItemChange(idx, 'itemName', e.target.value)}
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Part / Model Number
                          </label>
                          <input
                            type="text"
                            value={item.partNumber}
                            onChange={(e) => handleItemChange(idx, 'partNumber', e.target.value)}
                            placeholder="e.g. 6205-2RS1"
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Vendor Brand / Make
                          </label>
                          <input
                            type="text"
                            value={item.brand}
                            onChange={(e) => handleItemChange(idx, 'brand', e.target.value)}
                            placeholder="e.g. SKF / Siemens / Festo"
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Material Category
                          </label>
                          <input
                            type="text"
                            value={item.category}
                            onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                            placeholder="e.g. Bearings"
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Item Description / Spec
                          </label>
                          <input
                            type="text"
                            value={item.itemDescription}
                            onChange={(e) => handleItemChange(idx, 'itemDescription', e.target.value)}
                            placeholder="Specification notes"
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* Row 2: Quantity, UOM, Vendor Unit Rate, GST %, Freight, Discount, Other Charges */}
                      <div className="grid grid-cols-2 sm:grid-cols-7 gap-3 text-xs pt-1">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Quantity
                          </label>
                          <input
                            type="number"
                            min="1"
                            required
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)
                            }
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            UOM
                          </label>
                          <select
                            value={item.uom}
                            onChange={(e) => handleItemChange(idx, 'uom', e.target.value)}
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                          >
                            <option value="NOS">NOS</option>
                            <option value="SET">SET</option>
                            <option value="MTR">MTR</option>
                            <option value="KG">KG</option>
                            <option value="LTR">LTR</option>
                            <option value="PKT">PKT</option>
                            <option value="BOX">BOX</option>
                            <option value="ROLL">ROLL</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-800 mb-1">
                            Vendor Unit Rate (₹) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={item.resellerPrice}
                            onChange={(e) =>
                              handleItemChange(idx, 'resellerPrice', parseFloat(e.target.value) || 0)
                            }
                            className="w-full text-xs p-2 border border-blue-400 bg-blue-50/40 rounded-lg font-mono font-bold text-blue-900 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            GST %
                          </label>
                          <select
                            value={item.gstPercent}
                            onChange={(e) =>
                              handleItemChange(idx, 'gstPercent', parseInt(e.target.value) || 0)
                            }
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-medium"
                          >
                            <option value="18">18% (Standard)</option>
                            <option value="12">12%</option>
                            <option value="28">28%</option>
                            <option value="5">5%</option>
                            <option value="0">0% (Exempt)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Freight (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.freight}
                            onChange={(e) =>
                              handleItemChange(idx, 'freight', parseFloat(e.target.value) || 0)
                            }
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Discount (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.discount}
                            onChange={(e) =>
                              handleItemChange(idx, 'discount', parseFloat(e.target.value) || 0)
                            }
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Other / P&F (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.otherCharges}
                            onChange={(e) =>
                              handleItemChange(idx, 'otherCharges', parseFloat(e.target.value) || 0)
                            }
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono"
                          />
                        </div>
                      </div>

                      {/* Row 3: Lead Time, Availability, Warranty, Line Remarks */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs pt-1 border-t border-slate-100">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Delivery Time (Days)
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.deliveryDays}
                            onChange={(e) =>
                              handleItemChange(idx, 'deliveryDays', parseInt(e.target.value) || 1)
                            }
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Stock Availability
                          </label>
                          <select
                            value={item.availability}
                            onChange={(e) => handleItemChange(idx, 'availability', e.target.value as any)}
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                          >
                            <option value="IN_STOCK">IN STOCK (Immediate Dispatch)</option>
                            <option value="1-2 WEEKS">1 - 2 WEEKS</option>
                            <option value="3-4 WEEKS">3 - 4 WEEKS</option>
                            <option value="MADE_TO_ORDER">MADE TO ORDER</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Warranty Period
                          </label>
                          <input
                            type="text"
                            value={item.warranty}
                            onChange={(e) => handleItemChange(idx, 'warranty', e.target.value)}
                            placeholder="e.g. 12 Months OEM"
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Line Remarks / Specifications
                          </label>
                          <input
                            type="text"
                            value={item.remarks}
                            onChange={(e) => handleItemChange(idx, 'remarks', e.target.value)}
                            placeholder="Make/Brand specifics or technical notes"
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sourcing Validity, Terms & Quotation Attachment */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Rate Validity <span className="text-red-500">*</span>
              </label>
              <select
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-semibold"
              >
                <option value="15 Days">15 Days from Entry</option>
                <option value="30 Days">30 Days (Standard Monthly)</option>
                <option value="45 Days">45 Days</option>
                <option value="60 Days">60 Days (Quarterly Contract)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Payment Terms <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="e.g. 30 Days Net from Delivery"
                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Upload Quotation / PI / Datasheet
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={attachmentName}
                  onChange={(e) => setAttachmentName(e.target.value)}
                  placeholder="e.g. Signed_Quotation.pdf"
                  className="flex-1 text-xs p-2 border border-slate-300 rounded-lg bg-white font-mono"
                />
                <label className="px-2.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer text-slate-600 flex items-center justify-center shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Remarks / Commercial Terms
              </label>
              <input
                type="text"
                value={generalRemarks}
                onChange={(e) => setGeneralRemarks(e.target.value)}
                placeholder="Discounts, packaging, inspection notes"
                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>

          {/* Grand Total Summary Banner */}
          <div className="p-4 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-blue-300 font-bold block">
                Total Landed Quotation Amount (With Taxes & Freight)
              </span>
              <span className="text-2xl font-black font-mono text-white">
                ₹{grandTotalLanded.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-blue-300 ml-3">
                ({rateItems.length} product{rateItems.length !== 1 ? 's' : ''} in rate sheet)
              </span>
            </div>
            <div className="text-xs text-blue-200 sm:max-w-xs text-right">
              Rate record will be saved against this RFQ & vendor. All other RFQ products remain preserved as Pending.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={rateItems.length === 0}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              <span>
                {quoteToEdit
                  ? `Update Vendor Rate (${rateItems.length} Items)`
                  : `Save Vendor Rate (${rateItems.length} Items) & Advance Stage`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
