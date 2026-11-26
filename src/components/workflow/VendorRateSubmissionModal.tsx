import React, { useState } from 'react';
import { X, CheckCircle, Upload, DollarSign, Calculator, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface VendorRateSubmissionModalProps {
  enquiryId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const VendorRateSubmissionModal: React.FC<VendorRateSubmissionModalProps> = ({
  enquiryId,
  isOpen,
  onClose,
}) => {
  const { rfqs, requirements, vendors, currentUser, submitVendorQuote, learnCategoryFromVendorQuotation } = useApp();
  const [ignoredLearnings, setIgnoredLearnings] = useState<Record<string, boolean>>({});

  const rfq = rfqs.find((r) => r.id === enquiryId) || rfqs[0];
  const req = rfq ? requirements.find((r) => r.id === rfq.requirementId) : null;
  const vendor = vendors.find((v) => v.id === currentUser.associatedId) || vendors[0];

  const [quoteItems, setQuoteItems] = useState(
    req
      ? req.items.map((i) => ({
          requirementItemId: i.id,
          itemName: i.itemName,
          partNumber: i.partNumber,
          quantity: i.quantity,
          uom: i.uom,
          resellerPrice: i.targetPrice ? Math.round(i.targetPrice * 0.92) : 1000,
          gstPercent: 18,
          freight: 150,
          otherCharges: 0,
          deliveryDays: 5,
          availability: 'IN_STOCK' as const,
          warranty: '12 Months OEM Warranty',
          rateValidity: '15 Days',
          remarks: 'Ready stock in Mumbai central warehouse.',
        }))
      : []
  );

  const [validUntil, setValidUntil] = useState('15 Days');

  if (!isOpen || !rfq || !req) return null;

  const handlePriceChange = (index: number, field: string, val: any) => {
    setQuoteItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const itemsWithLanded = quoteItems.map((item) => {
      const baseTotal = item.resellerPrice * item.quantity;
      const gstAmount = (baseTotal * item.gstPercent) / 100;
      const landed = baseTotal + gstAmount + item.freight + item.otherCharges;
      return {
        ...item,
        totalLandedCost: landed,
      };
    });

    submitVendorQuote({
      enquiryId: rfq.id,
      requirementId: req.id,
      vendorId: vendor.id,
      vendorName: vendor.companyName,
      items: itemsWithLanded,
      validUntil,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-base text-white">Vendor Commercial Rate Submission</h3>
            <p className="text-xs text-slate-400">
              Stage 3 of 12: Enter reseller price, taxes, freight, warranty, and availability schedule
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Header Info */}
          <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <div>
                <span className="font-bold text-purple-950 font-mono text-sm">{rfq.id}</span>
                <span className="text-purple-700 ml-2">Ref Req: <strong>{req.id}</strong></span>
              </div>
              <span className="text-purple-900 font-bold">
                Submitting as: {vendor.companyName}
              </span>
            </div>
            <div className="text-slate-600 mt-1">
              Client Required Date: <strong>{req.requiredDeliveryDate}</strong>
            </div>
          </div>

          {/* AI Learning from RFQ Quoted Products (Requirement 7) */}
          {(() => {
            const vendorKnownCats = [
              ...(vendor.materialCategories || []),
              ...(vendor.productCategories || []),
              ...(vendor.aiMaterialCategories?.filter((c) => c.status === 'APPROVED').map((c) => c.category) || []),
            ].map((c) => c.toLowerCase());

            const unrecorded = (req.items || []).filter((reqIt) => {
              const cat = (reqIt.category || reqIt.recommendedCategory || '').toLowerCase();
              return cat && !vendorKnownCats.includes(cat) && !ignoredLearnings[cat];
            });

            if (unrecorded.length === 0) return null;

            return (
              <div className="space-y-2">
                {unrecorded.map((it) => {
                  const catName = it.category || it.recommendedCategory || 'New Category';
                  return (
                    <div
                      key={it.id}
                      className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shadow-2xs"
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-600 shrink-0 animate-pulse" />
                        <span className="text-slate-800">
                          This vendor appears to deal in <strong>{catName}</strong> (quoted: "<em>{it.itemName}</em>"). Add this category to vendor profile?
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => {
                            learnCategoryFromVendorQuotation(vendor.id, catName, it.subCategory, `Quotation ${rfq.id}`);
                          }}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                        >
                          Add Category
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIgnoredLearnings((prev) => ({ ...prev, [catName.toLowerCase()]: true }));
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-medium"
                        >
                          Ignore
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Rate Matrix */}
          <div className="space-y-4">
            <h4 className="font-bold text-sm text-slate-900">Commercial Quotation Schedule</h4>
            {quoteItems.map((item, idx) => {
              const baseTotal = item.resellerPrice * item.quantity;
              const gstAmount = (baseTotal * item.gstPercent) / 100;
              const lineLanded = baseTotal + gstAmount + item.freight + item.otherCharges;

              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-slate-900">{item.itemName}</span>
                      <span className="text-[11px] font-mono text-slate-500 ml-2">({item.partNumber})</span>
                    </div>
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      Qty: {item.quantity} {item.uom}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Reseller Unit Rate (INR) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.resellerPrice}
                        onChange={(e) => handlePriceChange(idx, 'resellerPrice', parseFloat(e.target.value) || 0)}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg font-bold text-slate-900 font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">GST %</label>
                      <select
                        value={item.gstPercent}
                        onChange={(e) => handlePriceChange(idx, 'gstPercent', parseFloat(e.target.value) || 0)}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="18">18% Standard GST</option>
                        <option value="28">28% High Rate</option>
                        <option value="12">12% Reduced</option>
                        <option value="5">5% Concessional</option>
                        <option value="0">0% Exempted</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Freight (INR)</label>
                      <input
                        type="number"
                        value={item.freight}
                        onChange={(e) => handlePriceChange(idx, 'freight', parseFloat(e.target.value) || 0)}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Other Charges (INR)</label>
                      <input
                        type="number"
                        value={item.otherCharges}
                        onChange={(e) => handlePriceChange(idx, 'otherCharges', parseFloat(e.target.value) || 0)}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Lead Time (Days)</label>
                      <input
                        type="number"
                        value={item.deliveryDays}
                        onChange={(e) => handlePriceChange(idx, 'deliveryDays', parseInt(e.target.value) || 1)}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Stock Availability</label>
                      <select
                        value={item.availability}
                        onChange={(e) => handlePriceChange(idx, 'availability', e.target.value)}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="IN_STOCK">IN STOCK</option>
                        <option value="1-2 WEEKS">1-2 WEEKS</option>
                        <option value="3-4 WEEKS">3-4 WEEKS</option>
                        <option value="MADE_TO_ORDER">MADE TO ORDER</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Warranty Term</label>
                      <input
                        type="text"
                        value={item.warranty}
                        onChange={(e) => handlePriceChange(idx, 'warranty', e.target.value)}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex flex-col justify-center">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase">Total Landed Cost</span>
                      <span className="text-sm font-extrabold text-blue-700 font-mono">
                        ₹{lineLanded.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Attach Vendor Quotation Document */}
          <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-300 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-slate-700">Vendor Official Quotation Letter / Catalog</span>
            </div>
            <span className="text-[11px] text-blue-600 font-mono">Signed_Quote_Vendor.pdf (Auto-attached)</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Submit Commercial Rate</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
