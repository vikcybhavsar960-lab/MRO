import React, { useState } from 'react';
import {
  Scale,
  CheckCircle,
  FileCheck2,
  Building,
  Check,
  ArrowRight,
  TrendingDown,
  ShieldCheck,
  Clock,
  Layers,
  Sparkles,
  Tag,
  Plus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DirectVendorRateEntryModal } from './DirectVendorRateEntryModal';

interface RateComparisonViewProps {
  onProceedToQuotation: (requirementId: string, selectedQuoteId: string) => void;
  onSelectOrder: (orderId: string) => void;
}

export const RateComparisonView: React.FC<RateComparisonViewProps> = ({
  onProceedToQuotation,
  onSelectOrder,
}) => {
  const { requirements, vendorQuotes, rfqs, vendors, learnCategoryFromVendorQuotation } = useApp();
  const [ignoredSuggestions, setIgnoredSuggestions] = useState<Record<string, boolean>>({});
  const [isDirectRateOpen, setIsDirectRateOpen] = useState(false);

  // Active open requirements
  const selectableReqs = requirements.filter(
    (r) => r.status !== 'ORDER_CLOSED' && r.status !== 'CANCELLED'
  );

  const [selectedReqId, setSelectedReqId] = useState<string>(
    selectableReqs[0]?.id || requirements[0]?.id || ''
  );

  const currentReq = requirements.find((r) => r.id === selectedReqId) || selectableReqs[0];
  const quotesForReq = vendorQuotes.filter((q) => q.requirementId === selectedReqId);

  // Selected winning vendor state for each requirement
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>(
    quotesForReq[0]?.id || ''
  );

  // Auto-sync selectedQuoteId when requirement changes
  React.useEffect(() => {
    if (quotesForReq.length > 0 && !quotesForReq.some((q) => q.id === selectedQuoteId)) {
      setSelectedQuoteId(quotesForReq[0].id);
    }
  }, [selectedReqId, quotesForReq.length]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-600" />
            <span>Commercial Rate Comparison Matrix</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Stage 3 of 10: Multi-vendor side-by-side comparative analysis of basic rate, GST, freight, lead time, and landed cost
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {currentReq && (
            <button
              onClick={() => setIsDirectRateOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Supplier Rate</span>
            </button>
          )}

          {selectedQuoteId && currentReq && (
            <button
              onClick={() => onProceedToQuotation(currentReq.id, selectedQuoteId)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition-all"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Generate Customer Quotation from Selection</span>
            </button>
          )}
        </div>
      </div>

      {/* Requirement Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-bold text-slate-500 shrink-0">Select RFQ / Req:</span>
        {selectableReqs.map((req) => {
          const reqQuotesCount = vendorQuotes.filter((q) => q.requirementId === req.id).length;
          return (
            <button
              key={req.id}
              onClick={() => {
                setSelectedReqId(req.id);
                const quotes = vendorQuotes.filter((q) => q.requirementId === req.id);
                if (quotes.length > 0) setSelectedQuoteId(quotes[0].id);
                else setSelectedQuoteId('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                selectedReqId === req.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{req.id}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-sans font-semibold ${
                  selectedReqId === req.id
                    ? 'bg-blue-700 text-blue-100'
                    : reqQuotesCount > 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {reqQuotesCount} rates
              </span>
            </button>
          );
        })}
      </div>

      {!currentReq || quotesForReq.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500 text-xs space-y-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800">
              No Supplier Rates Recorded Yet for {selectedReqId || 'This Requirement'}
            </h3>
            <p className="text-slate-500 text-xs mt-1 max-w-md mx-auto">
              Enter supplier quotes directly to view line-item breakdowns, compare tax & freight landed costs, and pick the preferred vendor.
            </p>
          </div>
          <button
            onClick={() => setIsDirectRateOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Enter Vendor Rate Directly</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Comparison Cards Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {quotesForReq.map((quote) => {
              const isSelected = selectedQuoteId === quote.id;
              const totalLandedSum = quote.items.reduce((acc, it) => acc + it.totalLandedCost, 0);

              return (
                <div
                  key={quote.id}
                  onClick={() => setSelectedQuoteId(quote.id)}
                  className={`bg-white rounded-2xl border-2 p-5 transition-all cursor-pointer relative shadow-xs flex flex-col justify-between ${
                    isSelected
                      ? 'border-blue-600 ring-4 ring-blue-500/10'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Top Badge */}
                  {isSelected && (
                    <div className="absolute -top-3 right-4 bg-blue-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-sm">
                      <Check className="w-3 h-3" />
                      <span>Selected Winning Vendor</span>
                    </div>
                  )}

                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="text-[11px] font-mono font-bold text-slate-400">{quote.id}</span>
                        <h3 className="font-bold text-sm text-slate-900 leading-snug">
                          {quote.vendorName}
                        </h3>
                      </div>
                      <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0">
                        {isSelected ? (
                          <div className="w-3.5 h-3.5 rounded-full bg-blue-600"></div>
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full bg-transparent"></div>
                        )}
                      </div>
                    </div>

                    {/* Meta strip */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mb-4">
                      <div>
                        Submitted: <strong className="text-slate-800">{quote.submissionDate}</strong>
                      </div>
                      <div>
                        Validity: <strong className="text-slate-800">{quote.validUntil}</strong>
                      </div>
                    </div>

                    {/* Breakdown table for each item */}
                    <div className="space-y-3">
                      {quote.items.map((item, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-slate-50/70 border border-slate-200 text-xs space-y-1.5">
                          <div className="flex justify-between font-bold text-slate-800">
                            <span>{item.itemName}</span>
                            <span className="font-mono">{item.quantity} {item.uom}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-x-2 text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                            <div>Basic Rate: <strong className="text-slate-900 font-mono">₹{item.resellerPrice}</strong></div>
                            <div>GST: <strong className="text-slate-900">{item.gstPercent}%</strong></div>
                            <div>Freight: <strong className="text-slate-900 font-mono">₹{item.freight}</strong></div>
                            <div>Lead Time: <strong className="text-slate-900">{item.deliveryDays} Days</strong></div>
                            <div className="col-span-2">Warranty: <strong className="text-slate-900">{item.warranty}</strong></div>
                          </div>

                          <div className="flex justify-between items-baseline pt-1 border-t border-slate-200 text-[11px]">
                            <span className="font-semibold text-slate-600">Landed Cost:</span>
                            <span className="font-extrabold text-blue-700 font-mono">
                              ₹{item.totalLandedCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* AI Profile Learning from Quotation (Requirement 7) */}
                    {(() => {
                      const quoteVendor = vendors.find((v) => v.id === quote.vendorId);
                      if (!quoteVendor) return null;

                      const vendorKnownCats = [
                        ...(quoteVendor.materialCategories || []),
                        ...(quoteVendor.productCategories || []),
                        ...(quoteVendor.aiMaterialCategories?.filter((c) => c.status === 'APPROVED').map((c) => c.category) || []),
                      ].map((c) => c.toLowerCase());

                      // Check if any quoted item is in a category not recorded in vendor profile
                      const unrecordedItems = quote.items
                        .map((qItem) => {
                          const reqItem = currentReq.items.find(
                            (rIt) => rIt.id === qItem.requirementItemId || rIt.itemName.toLowerCase() === qItem.itemName.toLowerCase()
                          );
                          const category = reqItem?.category || reqItem?.recommendedCategory || 'Industrial Spares';
                          const subCategory = reqItem?.subCategory;
                          return {
                            itemName: qItem.itemName,
                            category,
                            subCategory,
                          };
                        })
                        .filter(
                          (it) =>
                            !vendorKnownCats.includes(it.category.toLowerCase()) &&
                            !ignoredSuggestions[`${quote.id}_${it.category}`]
                        );

                      if (unrecordedItems.length === 0) return null;

                      const primaryItem = unrecordedItems[0];
                      const suggestionKey = `${quote.id}_${primaryItem.category}`;

                      return (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mt-3 p-3 bg-gradient-to-br from-indigo-50 via-blue-50 to-slate-50 border border-blue-200 rounded-xl space-y-2 shadow-2xs"
                        >
                          <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs">
                            <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
                            <span>AI Learning from Quotation</span>
                          </div>
                          <p className="text-[11px] text-slate-700 leading-relaxed">
                            This vendor appears to deal in <strong>{primaryItem.category}</strong> (quoted: "<em>{primaryItem.itemName}</em>"). Add this category to vendor profile?
                          </p>
                          <div className="flex items-center gap-2 pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                learnCategoryFromVendorQuotation(
                                  quote.vendorId,
                                  primaryItem.category,
                                  primaryItem.subCategory,
                                  `Quotation ${quote.id} (${primaryItem.itemName})`
                                );
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Category</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIgnoredSuggestions((prev) => ({ ...prev, [suggestionKey]: true }));
                              }}
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
                            >
                              Ignore
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Total Card Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Total Landed Purchase Value
                      </span>
                      <div className="text-lg font-black text-slate-900 font-mono">
                        ₹{totalLandedSum.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedQuoteId(quote.id);
                        onProceedToQuotation(currentReq.id, quote.id);
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <span>Pick Vendor</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Decision Rule Notice */}
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-3 text-xs text-amber-900">
            <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
            <p>
              <strong>Procurement Governance Rule:</strong> System does not auto-select vendors. An authorized Admin or Procurement Engineer must explicitly review delivery terms, warranty, and landed cost before generating the customer quotation.
            </p>
          </div>
        </div>
      )}

      {/* Direct Vendor Rate Entry Modal */}
      {isDirectRateOpen && currentReq && (
        <DirectVendorRateEntryModal
          isOpen={isDirectRateOpen}
          defaultRequirementId={currentReq.id}
          onClose={() => setIsDirectRateOpen(false)}
          onSuccess={(quoteId) => {
            setIsDirectRateOpen(false);
            setSelectedQuoteId(quoteId);
          }}
        />
      )}
    </div>
  );
};
