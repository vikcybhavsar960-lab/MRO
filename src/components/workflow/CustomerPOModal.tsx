import React, { useState } from 'react';
import { X, Upload, CheckCircle2, ShoppingCart } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface CustomerPOModalProps {
  requirementId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerPOModal: React.FC<CustomerPOModalProps> = ({
  requirementId,
  isOpen,
  onClose,
}) => {
  const { requirements, customerQuotations, recordCustomerPO } = useApp();

  const req = requirements.find((r) => r.id === requirementId) || requirements[0];
  const qtn = customerQuotations.find((q) => q.requirementId === req?.id);

  const [customerPoNumber, setCustomerPoNumber] = useState('PO/TATA/2026/9102');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [poAmount, setPoAmount] = useState<number>(qtn ? qtn.grandTotal : 85000);
  const [deliveryAddress, setDeliveryAddress] = useState(
    'Central Stores Gate 3, Tata Steel Works, Jamshedpur 831001'
  );
  const [paymentTerms, setPaymentTerms] = useState(
    qtn ? qtn.paymentTerms : '30 Days Net from Delivery'
  );
  const [remarks, setRemarks] = useState('Customer confirmed order via SAP purchase order export.');

  if (!isOpen || !req) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    recordCustomerPO({
      quotationId: qtn ? qtn.id : 'QTN-DRAFT',
      requirementId: req.id,
      customerPoNumber,
      poDate,
      customerId: req.customerId,
      customerName: req.customerName,
      poAmount,
      deliveryAddress,
      paymentTerms,
      remarks,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-white">Record Customer Purchase Order (CPO)</h3>
            <p className="text-xs text-slate-400">
              Stage 5 of 10: Attach client signed PO to authorize vendor procurement order
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-200 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-mono font-bold text-blue-950">{req.id}</span>
              <span className="text-blue-700 font-bold">{req.customerName}</span>
            </div>
            {qtn && (
              <div className="mt-1 text-slate-600">
                Matched Quotation: <strong>{qtn.id}</strong> (Value: ₹{qtn.grandTotal.toLocaleString('en-IN')})
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Customer PO Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customerPoNumber}
                onChange={(e) => setCustomerPoNumber(e.target.value)}
                placeholder="e.g. PO/TATA/2026/8891"
                className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono font-bold"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                PO Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={poDate}
                onChange={(e) => setPoDate(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                PO Amount (INR) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={poAmount}
                onChange={(e) => setPoAmount(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono font-bold text-blue-700"
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
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Delivery Destination Address
            </label>
            <textarea
              rows={2}
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="w-full text-xs p-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-300 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-slate-700">Customer PO PDF Document</span>
            </div>
            <span className="text-[11px] text-blue-600 font-mono">PO_Signed_Client_Copy.pdf</span>
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
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Record PO & Advance Stage</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
