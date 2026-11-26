import React, { useState } from 'react';
import { X, Receipt, Upload, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface ProformaInvoiceModalProps {
  vendorPoId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ProformaInvoiceModal: React.FC<ProformaInvoiceModalProps> = ({
  vendorPoId,
  isOpen,
  onClose,
}) => {
  const { vendorPOs, submitProformaInvoice } = useApp();

  const vpo = vendorPOs.find((v) => v.id === vendorPoId) || vendorPOs[0];

  const [piNumber, setPiNumber] = useState('APEX/PI/26-950');
  const [piDate, setPiDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number>(vpo ? vpo.subtotal : 69500);
  const [gstAmount, setGstAmount] = useState<number>(vpo ? vpo.gstAmount : 12510);
  const [freight, setFreight] = useState<number>(vpo ? vpo.freight : 1400);
  const [bankDetails, setBankDetails] = useState('HDFC Bank Fort, A/C: 921020045588912, IFSC: HDFC0000060');
  const [paymentDueDate, setPaymentDueDate] = useState('2026-10-20');
  const [remarks, setRemarks] = useState('Advance proforma invoice for dispatch release.');

  if (!isOpen || !vpo) return null;

  const totalAmount = amount + gstAmount + freight;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    submitProformaInvoice({
      vendorPoId: vpo.id,
      requirementId: vpo.requirementId,
      vendorId: vpo.vendorId,
      vendorName: vpo.vendorName,
      piNumber,
      piDate,
      amount,
      gstAmount,
      freight,
      totalAmount,
      bankDetails,
      paymentDueDate,
      remarks,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-white">Vendor Proforma Invoice Submission</h3>
            <p className="text-xs text-slate-400">Stage 7 of 10: Enter vendor tax invoice breakdown & bank coordinates</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="bg-purple-50 p-3 rounded-xl border border-purple-200">
            <span className="font-bold text-purple-950 font-mono">{vpo.id}</span>
            <span className="ml-2 text-purple-700 font-semibold">• Vendor: {vpo.vendorName}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">PI Number <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={piNumber}
                onChange={(e) => setPiNumber(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">PI Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={piDate}
                onChange={(e) => setPiDate(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Basic (INR)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">GST Tax (INR)</label>
              <input
                type="number"
                value={gstAmount}
                onChange={(e) => setGstAmount(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Freight (INR)</label>
              <input
                type="number"
                value={freight}
                onChange={(e) => setFreight(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Bank Payment Wire Coordinates</label>
            <input
              type="text"
              value={bankDetails}
              onChange={(e) => setBankDetails(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center">
            <span className="font-bold text-slate-700">Gross PI Amount:</span>
            <span className="text-lg font-black text-blue-700 font-mono">₹{totalAmount.toLocaleString('en-IN')}</span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md shadow-blue-500/20"
            >
              Submit Proforma Invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
