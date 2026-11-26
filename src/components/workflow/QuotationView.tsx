import React, { useState } from 'react';
import {
  FileCheck2,
  Download,
  Share2,
  Mail,
  Plus,
  Printer,
  FileText,
  Calculator,
  Percent,
  CheckCircle,
  Eye,
  Calendar,
  Building,
  Lock,
  Unlock,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CustomerQuotation, CustomerQuotationItem } from '../../types';
import { generateQuotationPDF, generateWhatsAppShareUrl } from '../../services/pdfService';
import { EarningRulesAndLockModal } from './EarningRulesAndLockModal';

interface QuotationViewProps {
  onOpenNewQuotationModal: () => void;
  onSelectOrder: (orderId: string) => void;
}

export const QuotationView: React.FC<QuotationViewProps> = ({
  onOpenNewQuotationModal,
  onSelectOrder,
}) => {
  const { customerQuotations, requirements, currentUser } = useApp();
  const [selectedQuotationId, setSelectedQuotationId] = useState<string>(
    customerQuotations[0]?.id || ''
  );

  const activeQuotation = customerQuotations.find((q) => q.id === selectedQuotationId) || customerQuotations[0];
  const linkedReq = activeQuotation ? requirements.find((r) => r.id === activeQuotation.requirementId) : null;
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  // Commercial Earning calculations
  const totalSelling = activeQuotation?.subtotal || 0;
  const totalBuying = activeQuotation?.items?.reduce(
    (s, it) => s + (it.purchasePrice + (it.freightCost || 0) + (it.otherCost || 0)) * it.quantity,
    0
  ) || 0;
  const grossEarning = totalSelling - totalBuying;
  const marginPercent = totalSelling > 0 ? (grossEarning / totalSelling) * 100 : 0;
  const isLocked = !!activeQuotation?.commercialLock?.isLocked;

  const handleDownloadPDF = (quotation: CustomerQuotation) => {
    const doc = generateQuotationPDF(quotation, linkedReq || undefined);
    doc.save(`Quotation_${quotation.id}.pdf`);
  };

  const handleWhatsApp = (quotation: CustomerQuotation) => {
    const url = generateWhatsAppShareUrl('QUOTATION', {
      recipientName: quotation.customerName,
      docNumber: quotation.id,
      amount: quotation.grandTotal,
      itemsSummary: quotation.items.map((i) => `${i.itemName} (Qty: ${i.quantity})`).join(', '),
      phone: linkedReq?.customerMobile,
    });
    window.open(url, '_blank');
  };

  const handleEmail = (quotation: CustomerQuotation) => {
    const subject = encodeURIComponent(`Formal Quotation: ${quotation.id} from MRO PROCUREMENT SOLUTION`);
    const body = encodeURIComponent(
      `Dear ${quotation.customerName},\n\nPlease find our formal quotation ${quotation.id} for ₹${quotation.grandTotal.toLocaleString('en-IN')}.\n\nItems:\n${quotation.items.map((i) => `- ${i.itemName} (Qty: ${i.quantity} ${i.uom}) @ ₹${i.sellingUnitPrice}`).join('\n')}\n\nTerms: ${quotation.paymentTerms}\nDelivery: ${quotation.deliveryPeriod}\n\nBest regards,\nMRO PROCUREMENT SOLUTION Team`
    );
    window.location.href = `mailto:${linkedReq?.customerEmail || 'procurement@client.com'}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-blue-600" />
            <span>Customer Quotations (QTN)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Stage 4 of 10: Margin calculator, GST tax engine, jsPDF rendering, WhatsApp & Email sharing
          </p>
        </div>

        {(currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'PROCUREMENT_EMPLOYEE') && (
          <button
            onClick={onOpenNewQuotationModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Quotation</span>
          </button>
        )}
      </div>

      {customerQuotations.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500 text-xs">
          No customer quotations generated yet. Go to Rate Comparison to convert vendor quotes into official customer quotations.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Quotations List */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Issued Quotations ({customerQuotations.length})
            </span>
            {customerQuotations.map((qtn) => {
              const isSelected = qtn.id === activeQuotation?.id;
              return (
                <div
                  key={qtn.id}
                  onClick={() => setSelectedQuotationId(qtn.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-50/70 border-blue-600 shadow-xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-xs text-blue-700">{qtn.id}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {qtn.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-slate-900 leading-snug">{qtn.customerName}</h4>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200 text-[11px]">
                    <span className="text-slate-500">Total Quoted:</span>
                    <span className="font-black text-slate-900 font-mono">
                      ₹{qtn.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Active Quotation Preview & PDF Actions */}
          {activeQuotation && (
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
              {/* Preview Bar */}
              <div className="p-4 sm:p-5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-base text-white">{activeQuotation.id}</span>
                    <span className="text-[11px] font-semibold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-400/30">
                      Ref: {activeQuotation.requirementId}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Quoted To: <strong className="text-white">{activeQuotation.customerName}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadPDF(activeQuotation)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                    title="Download Official jsPDF Document"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                  <button
                    onClick={() => handleWhatsApp(activeQuotation)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                    title="Share via WhatsApp"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </button>
                  <button
                    onClick={() => handleEmail(activeQuotation)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all"
                    title="Email Quotation"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Email</span>
                  </button>
                </div>
              </div>

              {/* Quotation Details Body */}
              <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                {/* Commercial Earning & Rule Verification Banner */}
                <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                  isLocked
                    ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/20'
                    : 'bg-gradient-to-r from-blue-50/80 via-emerald-50/40 to-slate-50 border-blue-200'
                }`}>
                  <div className="flex items-start sm:items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${isLocked ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'}`}>
                      {isLocked ? <Lock className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          Commercial Margin & Earning Protection
                        </span>
                        {isLocked ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 shadow-xs">
                            <Lock className="w-3 h-3" />
                            <span>LOCKED & FROZEN</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <Unlock className="w-3 h-3" />
                            <span>OPEN (Editable)</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-1 font-mono">
                        <span>Customer Total: <strong className="text-slate-900 font-bold">₹{totalSelling.toLocaleString('en-IN')}</strong></span>
                        <span>Buying Cost: <strong className="text-slate-700">₹{totalBuying.toLocaleString('en-IN')}</strong></span>
                        <span className="text-emerald-700 font-bold">
                          Net Earning: ₹{grossEarning.toLocaleString('en-IN')} ({marginPercent.toFixed(1)}% Margin)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for Earning Rules & Open/Lock & Mail */}
                  <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                    <button
                      onClick={() => setIsRulesModalOpen(true)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all ${
                        isLocked
                          ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                      }`}
                      title="Inspect Margin rules, check what was verified right, and open or lock"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Check Rules & {isLocked ? 'Unlock / Open' : 'Lock Earning'}</span>
                    </button>

                    <button
                      onClick={() => setIsRulesModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-xs"
                      title="Send verification link via email to check order data"
                    >
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                      <span>Send Link via Mail</span>
                    </button>
                  </div>
                </div>

                {/* Meta details grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Quotation Date</span>
                    <span className="font-semibold text-slate-800">{activeQuotation.date}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Valid Until</span>
                    <span className="font-semibold text-slate-800">{activeQuotation.validityDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Delivery Period</span>
                    <span className="font-semibold text-slate-800">{activeQuotation.deliveryPeriod}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Payment Terms</span>
                    <span className="font-semibold text-slate-800">{activeQuotation.paymentTerms}</span>
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider mb-2">
                    Commercial Schedule of Supplies
                  </h4>

                  <div className="rounded-xl border border-slate-200 overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-100/80 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Item & Part #</th>
                          <th className="py-2.5 px-3">Qty</th>
                          <th className="py-2.5 px-3">Unit Selling (INR)</th>
                          <th className="py-2.5 px-3">GST %</th>
                          <th className="py-2.5 px-3 text-right">Total Line (INR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeQuotation.items.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{it.itemName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">Part #: {it.partNumber}</div>
                            </td>
                            <td className="py-2.5 px-3 font-semibold">
                              {it.quantity} {it.uom}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-medium">
                              ₹{it.sellingUnitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-600">
                              {it.gstPercent}%
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900 text-right">
                              ₹{it.finalLineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals & Tax Box */}
                <div className="flex justify-end">
                  <div className="w-full sm:w-72 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Taxable Subtotal:</span>
                      <span className="font-mono font-bold">
                        ₹{activeQuotation.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Total Estimated GST:</span>
                      <span className="font-mono font-bold">
                        ₹{activeQuotation.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-300 flex justify-between items-baseline">
                      <span className="font-bold text-slate-900">Grand Total:</span>
                      <span className="font-black text-blue-700 font-mono text-base">
                        ₹{activeQuotation.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Terms and conditions */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <div className="font-bold text-slate-800 text-xs mb-1">Commercial Terms & Warranty:</div>
                  <p>1. Delivery: {activeQuotation.deliveryPeriod}</p>
                  <p>2. Payment: {activeQuotation.paymentTerms}</p>
                  <p>3. Warranty: {activeQuotation.warranty}</p>
                  <p>4. Remarks: {activeQuotation.remarks || 'Standard warranty terms apply.'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Earning Rules & Lock / Mail Verification Modal */}
      {activeQuotation && (
        <EarningRulesAndLockModal
          isOpen={isRulesModalOpen}
          onClose={() => setIsRulesModalOpen(false)}
          requirementId={activeQuotation.requirementId}
          quotationId={activeQuotation.id}
        />
      )}
    </div>
  );
};
