import React, { useState, useMemo } from 'react';
import {
  X,
  Percent,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  TrendingDown,
  Building,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BulkBrandDiscountRule } from '../../types';
import * as XLSX from 'xlsx';

interface BulkBrandDiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBrand?: string;
}

export const BulkBrandDiscountModal: React.FC<BulkBrandDiscountModalProps> = ({
  isOpen,
  onClose,
  initialBrand,
}) => {
  const {
    brands,
    products,
    updateProduct,
    vendors,
    brandDiscounts,
    saveBulkBrandDiscounts,
  } = useApp();

  const [selectedBrand, setSelectedBrand] = useState<string>(
    initialBrand || (brands.length > 0 ? brands[0].name : '')
  );
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED' | 'DIRECT_NEGOTIATED'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState<number>(25);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [effectiveDate, setEffectiveDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('Standard OEM Price List Discount 2026');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Products under selected brand
  const brandProducts = useMemo(() => {
    if (!selectedBrand) return [];
    return products.filter(
      (p) =>
        !p.isDeleted &&
        p.brand &&
        p.brand.toLowerCase().trim() === selectedBrand.toLowerCase().trim()
    );
  }, [products, selectedBrand]);

  // Default select all products when brand changes
  React.useEffect(() => {
    setSelectedProductIds(new Set(brandProducts.map((p) => p.id)));
  }, [brandProducts]);

  // Pre-fill existing rule if available
  React.useEffect(() => {
    if (!selectedBrand) return;
    const existingRule = brandDiscounts.find(
      (d) => d.brandName.toLowerCase().trim() === selectedBrand.toLowerCase().trim()
    );
    if (existingRule) {
      setDiscountType(existingRule.discountType);
      setDiscountValue(existingRule.defaultDiscountPercentage);
      if (existingRule.supplierId) setSelectedSupplierId(existingRule.supplierId);
      if (existingRule.effectiveDate) setEffectiveDate(existingRule.effectiveDate);
      if (existingRule.expiryDate) setExpiryDate(existingRule.expiryDate);
      if (existingRule.remarks) setRemarks(existingRule.remarks);
    }
  }, [selectedBrand, brandDiscounts]);

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    if (selectedProductIds.size === brandProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(brandProducts.map((p) => p.id)));
    }
  };

  const toggleSelectProduct = (id: string) => {
    const next = new Set(selectedProductIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedProductIds(next);
  };

  // Preview calculations for a product
  const calculatePreview = (prod: (typeof brandProducts)[0]) => {
    const mrp = prod.mrp && prod.mrp > 0 ? prod.mrp : prod.approxRate || 1000;
    let discountAmount = 0;
    let netRate = mrp;

    if (discountType === 'PERCENTAGE') {
      discountAmount = (mrp * discountValue) / 100;
      netRate = Math.max(0, mrp - discountAmount);
    } else if (discountType === 'FIXED') {
      discountAmount = discountValue;
      netRate = Math.max(0, mrp - discountAmount);
    } else {
      // DIRECT_NEGOTIATED
      netRate = discountValue;
      discountAmount = Math.max(0, mrp - netRate);
    }

    const gstPercent = prod.gstRate || 18;
    const gstAmount = (netRate * gstPercent) / 100;
    const finalLanded = netRate + gstAmount;

    return {
      mrp,
      discountAmount,
      netRate,
      gstPercent,
      gstAmount,
      finalLanded,
    };
  };

  const handleApplyAndSave = async () => {
    if (!selectedBrand) {
      setFeedback({ type: 'error', message: 'Please select a brand.' });
      return;
    }
    if (discountValue < 0) {
      setFeedback({ type: 'error', message: 'Discount value cannot be negative.' });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const selectedSupplier = vendors.find((v) => v.id === selectedSupplierId);

      const ruleId = `BDR-${selectedBrand.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
      const newRule: BulkBrandDiscountRule = {
        id: ruleId,
        brandName: selectedBrand,
        defaultDiscountPercentage: discountValue,
        discountType,
        effectiveDate,
        expiryDate: expiryDate || undefined,
        supplierId: selectedSupplierId || undefined,
        supplierName: selectedSupplier?.companyName || undefined,
        remarks,
        updatedAt: new Date().toISOString(),
      };

      // Filter out existing rule for this brand and append new rule
      const updatedRules = [
        ...brandDiscounts.filter(
          (r) => r.brandName.toLowerCase().trim() !== selectedBrand.toLowerCase().trim()
        ),
        newRule,
      ];

      await saveBulkBrandDiscounts(updatedRules);

      // Update selected products with new MRP discounts & Net Purchase Rate
      let updatedCount = 0;
      for (const prod of brandProducts) {
        if (selectedProductIds.has(prod.id)) {
          const calc = calculatePreview(prod);
          updateProduct({
            ...prod,
            mrp: calc.mrp,
            discountType: discountType === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED',
            discountPercentage: discountType === 'PERCENTAGE' ? discountValue : undefined,
            fixedDiscountAmount: discountType === 'FIXED' ? discountValue : undefined,
            netPurchaseRate: Math.round(calc.netRate * 100) / 100,
            effectiveDate,
            expiryDate: expiryDate || undefined,
            approxRate: Math.round(calc.netRate * 100) / 100,
          });
          updatedCount++;
        }
      }

      setFeedback({
        type: 'success',
        message: `Successfully applied ${discountValue}${discountType === 'PERCENTAGE' ? '%' : ' INR'} discount to ${updatedCount} products of brand "${selectedBrand}".`,
      });

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to apply bulk discount.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportExcel = () => {
    const rows = brandProducts.map((p) => {
      const calc = calculatePreview(p);
      return {
        'Product ID': p.id,
        'Brand': p.brand,
        'Part Number': p.partNumber,
        'Item Name': p.itemName,
        'Category': p.category,
        'MRP (INR)': calc.mrp,
        'Discount Type': discountType,
        'Discount % / Amt': discountValue,
        'Discount Amount (INR)': Math.round(calc.discountAmount * 100) / 100,
        'Basic Net Purchase Rate (INR)': Math.round(calc.netRate * 100) / 100,
        'GST (%)': calc.gstPercent,
        'GST Amount (INR)': Math.round(calc.gstAmount * 100) / 100,
        'Final Landed Cost (INR)': Math.round(calc.finalLanded * 100) / 100,
        'Selected for Update': selectedProductIds.has(p.id) ? 'YES' : 'NO',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Brand Discounts');
    XLSX.writeFile(workbook, `Brand_Discount_${selectedBrand}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Percent className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                <span>Bulk Brand Discount & MRP Engine</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-400 text-slate-900">
                  OEM Precision
                </span>
              </h2>
              <p className="text-xs text-blue-100 mt-0.5">
                Set brand-wide MRP discounts, calculate net purchase rate & update product catalog
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {feedback && (
            <div
              className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Form Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            {/* Brand Selection */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Select Brand *
              </label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500"
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name} {b.brandType === 'GLOBAL_OEM' ? '★ (Global OEM)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                {brandProducts.length} product(s) linked to this brand
              </p>
            </div>

            {/* Discount Type */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Discount Mechanism *
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-200/60 p-1 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setDiscountType('PERCENTAGE')}
                  className={`py-1.5 rounded-md text-center transition-all ${
                    discountType === 'PERCENTAGE'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  % of MRP
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('FIXED')}
                  className={`py-1.5 rounded-md text-center transition-all ${
                    discountType === 'FIXED'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Fixed ₹
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('DIRECT_NEGOTIATED')}
                  className={`py-1.5 rounded-md text-center transition-all ${
                    discountType === 'DIRECT_NEGOTIATED'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Direct ₹
                </button>
              </div>
            </div>

            {/* Discount Value */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                {discountType === 'PERCENTAGE'
                  ? 'Discount Percentage (%) *'
                  : discountType === 'FIXED'
                  ? 'Flat Deduction Amount (₹) *'
                  : 'Direct Negotiated Net Rate (₹) *'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max={discountType === 'PERCENTAGE' ? 99 : 10000000}
                  step={discountType === 'PERCENTAGE' ? '0.1' : '1'}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 pl-8"
                />
                <span className="absolute left-2.5 top-2.5 text-xs text-slate-400 font-bold">
                  {discountType === 'PERCENTAGE' ? '%' : '₹'}
                </span>
              </div>
            </div>

            {/* Applicable Vendor */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Applicable Supplier / Vendor
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Authorized Vendors / General OEM Rate</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.companyName} ({v.city || 'Vendor'})
                  </option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Effective & Expiry Date
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
                <input
                  type="date"
                  placeholder="Expiry (Opt)"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            {/* Remarks / Price list ref */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Price List / Reference Notes
              </label>
              <input
                type="text"
                placeholder="e.g. FY 2026-27 Master Price List #1"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Product Live Preview Table */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Affected Products ({brandProducts.length})</span>
                  <span className="text-slate-400 font-normal">
                    — {selectedProductIds.size} of {brandProducts.length} selected for update
                  </span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold border border-slate-200"
                >
                  {selectedProductIds.size === brandProducts.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md text-[11px] font-semibold border border-emerald-200 flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export Preview</span>
                </button>
              </div>
            </div>

            {brandProducts.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <p className="text-xs text-slate-500 font-medium">
                  No products currently registered under brand "{selectedBrand}".
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  You can register this brand discount rule now, and it will automatically apply to newly added products of this brand.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.size === brandProducts.length && brandProducts.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded text-blue-600"
                        />
                      </th>
                      <th className="py-2.5 px-3">Part # / Product</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">MRP (₹)</th>
                      <th className="py-2.5 px-3 text-right">Discount</th>
                      <th className="py-2.5 px-3 text-right text-blue-700 font-bold">Basic Net Rate</th>
                      <th className="py-2.5 px-3 text-right">GST</th>
                      <th className="py-2.5 px-3 text-right font-bold">Landed (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {brandProducts.map((p) => {
                      const calc = calculatePreview(p);
                      const isSelected = selectedProductIds.has(p.id);

                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-slate-50 transition-colors ${
                            !isSelected ? 'opacity-50 bg-slate-50/50' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectProduct(p.id)}
                              className="rounded text-blue-600"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-mono font-bold text-slate-900">{p.partNumber || p.id}</div>
                            <div className="text-[11px] text-slate-500 truncate max-w-xs">{p.itemName}</div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{p.category}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold">
                            ₹{calc.mrp.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 text-right text-emerald-600 font-semibold">
                            -₹{calc.discountAmount.toFixed(2)}
                            <span className="text-[10px] text-slate-400 block font-normal">
                              ({discountType === 'PERCENTAGE' ? `${discountValue}%` : 'flat'})
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700 bg-blue-50/50">
                            ₹{calc.netRate.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[11px] text-slate-500 font-mono">
                            {calc.gstPercent}% (₹{calc.gstAmount.toFixed(2)})
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            ₹{calc.finalLanded.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Updates database atomically; changes reflect immediately on RFQ and PO pipelines.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleApplyAndSave}
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? 'Applying...' : 'Apply & Save Brand Discounts'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
