import React, { useState } from 'react';
import { X, CheckCircle, Calculator, Percent } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface NewQuotationModalProps {
  requirementId?: string;
  quoteId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const NewQuotationModal: React.FC<NewQuotationModalProps> = ({
  requirementId,
  quoteId,
  isOpen,
  onClose,
}) => {
  const { requirements, vendorQuotes, vendors, createCustomerQuotation } = useApp();

  const req = requirements.find((r) => r.id === requirementId) || requirements[0];
  const winQuote = quoteId ? vendorQuotes.find((q) => q.id === quoteId) : vendorQuotes.find((q) => q.requirementId === req?.id);
  const winVendor = winQuote ? vendors.find((v) => v.id === winQuote.vendorId) : vendors[0];

  const [marginPercent, setMarginPercent] = useState<number>(18);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [deliveryPeriod, setDeliveryPeriod] = useState('5-7 Business Days');
  const [paymentTerms, setPaymentTerms] = useState('30 Days Net from Delivery');
  const [deliveryTerms, setDeliveryTerms] = useState('Door Delivery Insured');
  const [warranty, setWarranty] = useState('12 Months OEM Warranty');
  const [remarks, setRemarks] = useState('Offer valid for 20 days. Rates inclusive of transit insurance.');

  if (!isOpen || !req) return null;

  // Calculate items
  const items = req.items.map((it) => {
    const quoteItem = winQuote?.items.find((qi) => qi.requirementItemId === it.id);
    const purchasePrice = quoteItem ? quoteItem.resellerPrice : (it.targetPrice ? it.targetPrice * 0.9 : 1000);
    const freightCost = quoteItem ? quoteItem.freight / (it.quantity || 1) : 15;
    const otherCost = quoteItem ? quoteItem.otherCharges / (it.quantity || 1) : 0;
    const landedUnit = purchasePrice + freightCost + otherCost;

    const marginAmt = (landedUnit * marginPercent) / 100;
    const baseSelling = landedUnit + marginAmt;
    const discountAmt = (baseSelling * discountPercent) / 100;
    const netUnit = baseSelling - discountAmt;
    const gstPercent = quoteItem ? quoteItem.gstPercent : 18;
    const lineTaxable = netUnit * it.quantity;
    const lineTax = (lineTaxable * gstPercent) / 100;
    const lineFinal = lineTaxable + lineTax;

    return {
      requirementItemId: it.id,
      itemName: it.itemName,
      partNumber: it.partNumber,
      quantity: it.quantity,
      uom: it.uom,
      selectedVendorId: winVendor?.id || 'VEND-001',
      selectedVendorName: winVendor?.companyName || 'Apex Industrial',
      purchasePrice,
      freightCost,
      otherCost,
      marginPercent,
      marginAmount: marginAmt,
      sellingUnitPrice: netUnit,
      gstPercent,
      discountPercent,
      netUnitPrice: netUnit,
      totalTaxableAmount: lineTaxable,
      taxAmount: lineTax,
      finalLineTotal: lineFinal,
    };
  });

  const subtotal = items.reduce((acc, i) => acc + i.totalTaxableAmount, 0);
  const totalTax = items.reduce((acc, i) => acc + i.taxAmount, 0);
  const grandTotal = subtotal + totalTax;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const today = new Date();
    const validityDate = new Date(today.getTime() + 20 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    createCustomerQuotation({
      requirementId: req.id,
      customerId: req.customerId,
      customerName: req.customerName,
      validityDate,
      deliveryPeriod,
      paymentTerms,
      deliveryTerms,
      warranty,
      remarks,
      items,
      subtotal,
      totalTax,
      grandTotal,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-base text-white">Generate Official Customer Quotation</h3>
            <p className="text-xs text-slate-400">
              Stage 4 of 10: Configure profit margin %, discounts, and commercial delivery terms
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Target Customer Info */}
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-mono font-bold text-blue-900 text-sm">{req.id}</span>
                <span className="ml-2 font-bold text-slate-800">Customer: {req.customerName}</span>
              </div>
              <span className="text-blue-700 font-semibold">
                Winning Vendor: {winVendor?.companyName || 'Verified Supplier'}
              </span>
            </div>
          </div>

          {/* Margin & Pricing Controls */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-blue-600" />
                <span>Target Gross Profit Margin %</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={marginPercent}
                onChange={(e) => setMarginPercent(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg font-bold text-blue-700 font-mono"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Calculated on top of landed purchase price (basic rate + freight)
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Commercial Discount % (Optional)
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Applied directly to customer quotation subtotal
              </span>
            </div>
          </div>

          {/* Line Items Calculated Review */}
          <div>
            <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider mb-2">
              Quotation Lines Breakdown
            </h4>

            <div className="rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100/80 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Item Description</th>
                    <th className="py-2 px-3">Purchase Landed</th>
                    <th className="py-2 px-3">Margin (INR)</th>
                    <th className="py-2 px-3">Selling Unit</th>
                    <th className="py-2 px-3">GST %</th>
                    <th className="py-2 px-3 text-right">Line Total (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-900">{it.itemName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{it.partNumber} • Qty: {it.quantity} {it.uom}</div>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600">
                        ₹{(it.purchasePrice + it.freightCost).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-emerald-600">
                        +₹{it.marginAmount.toFixed(2)} ({marginPercent}%)
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">
                        ₹{it.sellingUnitPrice.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {it.gstPercent}%
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-blue-700 text-right">
                        ₹{it.finalLineTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Period</label>
              <input
                type="text"
                value={deliveryPeriod}
                onChange={(e) => setDeliveryPeriod(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Terms</label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Terms</label>
              <input
                type="text"
                value={deliveryTerms}
                onChange={(e) => setDeliveryTerms(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Warranty Term</label>
              <input
                type="text"
                value={warranty}
                onChange={(e) => setWarranty(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Summary Box */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
            <span className="font-bold text-slate-700">Total Customer Quotation Value (Inc. GST):</span>
            <span className="text-xl font-black text-blue-700 font-mono">
              ₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Actions */}
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
              <span>Generate QTN & Create PDF</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
