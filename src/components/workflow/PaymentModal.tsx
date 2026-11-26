import React, { useState } from 'react';
import { X, CreditCard, Upload, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface PaymentModalProps {
  piId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  piId,
  isOpen,
  onClose,
}) => {
  const { proformaInvoices, recordPayment } = useApp();

  const pi = proformaInvoices.find((p) => p.id === piId) || proformaInvoices[0];

  const [amountPaid, setAmountPaid] = useState<number>(pi ? pi.totalAmount : 83410);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState<'NEFT' | 'RTGS' | 'IMPS' | 'UPI' | 'CHEQUE' | 'BANK_TRANSFER'>('NEFT');
  const [transactionReference, setTransactionReference] = useState(`NEFT-HDFC-${Math.floor(10000000000 + Math.random() * 90000000000)}`);
  const [remarks, setRemarks] = useState('100% full invoice clearance as per approved payment milestone.');

  if (!isOpen || !pi) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    recordPayment({
      piId: pi.id,
      vendorPoId: pi.vendorPoId,
      requirementId: pi.requirementId,
      vendorId: pi.vendorId,
      vendorName: pi.vendorName,
      totalPiAmount: pi.totalAmount,
      amountPaid,
      paymentDate,
      paymentMode,
      transactionReference,
      remarks,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-white">Accounts Payment Disbursal</h3>
            <p className="text-xs text-slate-400">Stage 8 of 10: Record banking wire remittance & transaction reference</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
            <div className="flex justify-between items-center">
              <span className="font-bold text-emerald-950 font-mono">{pi.id} ({pi.piNumber})</span>
              <span className="text-emerald-800 font-bold">₹{pi.totalAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className="text-slate-600 mt-1">Vendor: <strong>{pi.vendorName}</strong></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Amount Paid (INR) <span className="text-red-500">*</span></label>
              <input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Mode</label>
              <select
                value={paymentMode}
                onChange={(e: any) => setPaymentMode(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
              >
                <option value="NEFT">NEFT National Electronic Transfer</option>
                <option value="RTGS">RTGS Real Time Gross Settlement</option>
                <option value="IMPS">IMPS Immediate Payment</option>
                <option value="UPI">UPI Corporate Handle</option>
                <option value="CHEQUE">Bank Cheque / DD</option>
                <option value="BANK_TRANSFER">Direct Wire</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">UTR / Transaction Ref Number <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Payment Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Release Payment & Notify Vendor</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
