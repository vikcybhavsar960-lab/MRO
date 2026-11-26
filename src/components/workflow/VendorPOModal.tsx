import React, { useState } from 'react';
import { X, PackageCheck, Download, CheckCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { generateVendorPoPDF } from '../../services/pdfService';

interface VendorPOModalProps {
  requirementId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const VendorPOModal: React.FC<VendorPOModalProps> = ({
  requirementId,
  isOpen,
  onClose,
}) => {
  const { requirements, customerPOs, customerQuotations, vendors, createVendorPO } = useApp();

  const req = requirements.find((r) => r.id === requirementId) || requirements[0];
  const cpo = customerPOs.find((c) => c.requirementId === req?.id);
  const qtn = customerQuotations.find((q) => q.requirementId === req?.id);
  const vendor = vendors[0];

  const [deliveryDate, setDeliveryDate] = useState('2026-10-18');
  const [paymentTerms, setPaymentTerms] = useState('50% advance, balance against LR copy');
  const [deliveryAddress, setDeliveryAddress] = useState(
    cpo?.deliveryAddress || 'Tata Steel Works Central Stores Gate 3, Jamshedpur'
  );
  const [remarks, setRemarks] = useState('Deliver with OEM test cert and guarantee card.');

  if (!isOpen || !req) return null;

  const items = req.items.map((it) => {
    const qtnItem = qtn?.items.find((qi) => qi.requirementItemId === it.id);
    const unitRate = qtnItem ? qtnItem.purchasePrice : 470;
    const gstPercent = qtnItem ? qtnItem.gstPercent : 18;
    const freight = 500;
    const base = unitRate * it.quantity;
    const gst = (base * gstPercent) / 100;
    return {
      itemName: it.itemName,
      partNumber: it.partNumber,
      quantity: it.quantity,
      uom: it.uom,
      unitRate,
      gstPercent,
      freight,
      totalAmount: base + gst + freight,
    };
  });

  const subtotal = items.reduce((acc, i) => acc + i.unitRate * i.quantity, 0);
  const gstAmount = items.reduce((acc, i) => acc + (i.unitRate * i.quantity * i.gstPercent) / 100, 0);
  const freight = items.reduce((acc, i) => acc + i.freight, 0);
  const totalAmount = subtotal + gstAmount + freight;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    createVendorPO({
      customerPoId: cpo ? cpo.id : 'CPO-DIRECT',
      quotationId: qtn ? qtn.id : 'QTN-DIRECT',
      requirementId: req.id,
      vendorId: vendor.id,
      vendorName: vendor.companyName,
      items,
      subtotal,
      gstAmount,
      freight,
      totalAmount,
      deliveryAddress,
      deliveryDate,
      paymentTerms,
      remarks,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-white">Issue Official Vendor Purchase Order (VPO)</h3>
            <p className="text-xs text-slate-400">
              Stage 6 of 10: Generates binding PO with terms, schedules, and jsPDF document
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-indigo-50 p-3.5 rounded-xl border border-indigo-200 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-mono font-bold text-indigo-950">Ref: {req.id}</span>
              <span className="text-indigo-800 font-bold">Vendor: {vendor.companyName}</span>
            </div>
            {cpo && (
              <div className="mt-1 text-slate-600">
                Backed by Customer PO: <strong>{cpo.customerPoNumber}</strong> (₹{cpo.poAmount.toLocaleString('en-IN')})
              </div>
            )}
          </div>

          {/* Items review */}
          <div className="rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">Item Description</th>
                  <th className="py-2 px-3">Qty</th>
                  <th className="py-2 px-3">Agreed Rate</th>
                  <th className="py-2 px-3">GST %</th>
                  <th className="py-2 px-3 text-right">Line Total (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-3 font-semibold text-slate-900">{it.itemName} ({it.partNumber})</td>
                    <td className="py-2 px-3">{it.quantity} {it.uom}</td>
                    <td className="py-2 px-3 font-mono">₹{it.unitRate}</td>
                    <td className="py-2 px-3">{it.gstPercent}%</td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-900 text-right">
                      ₹{it.totalAmount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Expected Delivery Date</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Terms</label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Delivery Destination Address</label>
            <input
              type="text"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="w-full text-xs p-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
            <span className="font-bold text-slate-700">Total Landed Vendor PO Value:</span>
            <span className="text-lg font-black text-emerald-700 font-mono">
              ₹{totalAmount.toLocaleString('en-IN')}
            </span>
          </div>

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
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5"
            >
              <PackageCheck className="w-4 h-4" />
              <span>Issue Vendor PO & Notify</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
