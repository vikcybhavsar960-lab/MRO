import React from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  ArrowRight,
  Download,
  Share2,
  Mail,
  ExternalLink,
  Building,
  User,
  Calendar,
  FileText,
  DollarSign,
  TrendingUp,
  Percent,
  Scale,
  Plus,
  ShoppingCart,
  PackageCheck,
  Receipt,
  CreditCard,
  Truck,
  FileCheck2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { generateQuotationPDF, generateVendorPoPDF, generateWhatsAppShareUrl } from '../../services/pdfService';

interface OrderTimelineModalProps {
  orderId: string;
  onClose: () => void;
  onAdvanceToNext?: (stage: string) => void;
  onOpenRateEntry?: (reqId: string) => void;
  onOpenRateComparison?: (reqId: string) => void;
  onOpenQuotation?: (reqId: string) => void;
  onOpenCustomerPo?: (reqId: string) => void;
  onOpenVendorPo?: (reqId: string) => void;
  onOpenVendorPi?: (vpoId: string) => void;
  onOpenPayment?: (piId: string) => void;
  onOpenDispatch?: (reqId: string) => void;
  onOpenDelivery?: (reqId: string) => void;
}

export const OrderTimelineModal: React.FC<OrderTimelineModalProps> = ({
  orderId,
  onClose,
  onAdvanceToNext,
  onOpenRateEntry,
  onOpenRateComparison,
  onOpenQuotation,
  onOpenCustomerPo,
  onOpenVendorPo,
  onOpenVendorPi,
  onOpenPayment,
  onOpenDispatch,
  onOpenDelivery,
}) => {
  const { getLinkedOrderData, currentUser, closeOrder, getRateCompletionStatus } = useApp();
  const linked = getLinkedOrderData(orderId);

  if (!linked || !linked.requirement) return null;

  const req = linked.requirement;
  const qtn = linked.quotation;
  const cpo = linked.customerPo;
  const vpo = linked.vendorPo;
  const pi = linked.proformaInvoice;
  const pay = linked.payment;
  const dsp = linked.dispatch;
  const del = linked.delivery;
  const quotes = linked.vendorQuotes;
  const fin = linked.financials;

  const rateStatus = getRateCompletionStatus ? getRateCompletionStatus(req.id) : null;
  const isRateCompleted = rateStatus ? rateStatus.status === 'COMPLETED' : quotes.length > 0;
  const isPartiallyCompleted = rateStatus ? rateStatus.status === 'PARTIALLY_COMPLETED' : false;

  const STAGES = [
    {
      id: 'STAGE-1',
      title: 'Customer Requirement',
      refCode: req.id,
      completed: true,
      date: req.createdAt ? new Date(req.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '01 Sep 2026, 10:35 AM',
      user: req.createdBy,
      summary: `${req.items.length} items logged for ${req.customerName}`,
      docType: 'REQUIREMENT',
    },
    {
      id: 'STAGE-2',
      title: 'Direct Vendor Rate Entry',
      refCode: isRateCompleted ? 'Completed' : isPartiallyCompleted ? 'Partially Completed' : 'Pending Rate Entry',
      completed: isRateCompleted,
      date: quotes.length > 0 ? quotes[0].submissionDate : 'Pending',
      user: quotes.length > 0 ? `${quotes.length} Supplier Quote(s)` : 'Procurement Team',
      summary: quotes.length > 0
        ? `${quotes.length} supplier rate(s) recorded against requirement (${rateStatus ? `${rateStatus.quotedItemsCount}/${rateStatus.totalItems} items quoted` : ''})`
        : 'Supplier rate entry pending. Direct rate entry enabled without requiring enquiry.',
      docType: 'RATE',
    },
    {
      id: 'STAGE-3',
      title: 'Rate Comparison & Sourcing',
      refCode: quotes.length > 0 ? `${quotes.length} Rates Evaluated` : 'Pending Comparison',
      completed: quotes.length > 0,
      date: quotes.length > 0 ? quotes[0].submissionDate : 'Pending',
      user: 'Procurement Sourcing',
      summary: quotes.length > 0 ? `Evaluated ${quotes.length} rate quotation(s) across suppliers` : 'Awaiting supplier rates for comparison',
      docType: 'RATE',
    },
    {
      id: 'STAGE-4',
      title: 'Customer Quotation (QTN)',
      refCode: qtn?.id || 'Pending QTN',
      completed: !!qtn,
      date: qtn?.date || 'Pending',
      user: 'Procurement Sales Eng.',
      summary: qtn ? `Quoted ₹${qtn.grandTotal.toLocaleString('en-IN')} (Margin included)` : 'Quotation not generated',
      docType: 'QUOTATION',
    },
    {
      id: 'STAGE-5',
      title: 'Customer PO Received (CPO)',
      refCode: cpo ? `${cpo.id} (${cpo.customerPoNumber})` : 'Pending PO',
      completed: !!cpo,
      date: cpo?.receivedDate || 'Pending',
      user: req.contactPerson,
      summary: cpo ? `Customer PO Value: ₹${cpo.poAmount.toLocaleString('en-IN')}` : 'Awaiting official Customer PO',
      docType: 'CPO',
    },
    {
      id: 'STAGE-6',
      title: 'Vendor Purchase Order (VPO)',
      refCode: vpo?.id || 'Pending VPO',
      completed: !!vpo,
      date: vpo?.poDate || 'Pending',
      user: 'Super Admin / Procurement',
      summary: vpo ? `Placed with ${vpo.vendorName} for ₹${vpo.totalAmount.toLocaleString('en-IN')}` : 'Vendor PO not placed',
      docType: 'VPO',
    },
    {
      id: 'STAGE-7',
      title: 'Proforma Invoice (PI)',
      refCode: pi ? `${pi.id} (${pi.piNumber})` : 'Pending PI',
      completed: !!pi,
      date: pi?.piDate || 'Pending',
      user: vpo?.vendorName || 'Vendor',
      summary: pi ? `PI Amount: ₹${pi.totalAmount.toLocaleString('en-IN')} Due: ${pi.paymentDueDate}` : 'Vendor PI awaited',
      docType: 'PI',
    },
    {
      id: 'STAGE-8',
      title: 'Payment Released (PAY)',
      refCode: pay?.id || 'Pending PAY',
      completed: !!pay && pay.status === 'PAYMENT_DONE',
      date: pay?.paymentDate || 'Pending',
      user: pay?.loggedBy || 'Accounts Dept',
      summary: pay ? `Disbursed ₹${pay.amountPaid.toLocaleString('en-IN')} via ${pay.paymentMode}` : 'Payment recording pending',
      docType: 'PAYMENT',
    },
    {
      id: 'STAGE-9',
      title: 'Vendor Dispatch (DSP)',
      refCode: dsp ? `${dsp.id} (LR: ${dsp.lrNumber})` : 'Pending DSP',
      completed: !!dsp,
      date: dsp?.dispatchDate || 'Pending',
      user: dsp?.vendorName || 'Vendor Warehouse',
      summary: dsp ? `Transporter: ${dsp.transporter} • Trk: ${dsp.trackingNumber}` : 'Material pending dispatch',
      docType: 'DSP',
    },
    {
      id: 'STAGE-10',
      title: 'Delivery & Inspection (DEL)',
      refCode: del ? del.id : 'Pending DEL',
      completed: req.status === 'DELIVERED' || req.status === 'ORDER_CLOSED',
      date: del?.deliveryDate || 'Pending',
      user: del?.receivedBy || 'Customer Stores',
      summary: del ? `Delivered & Acknowledged: ${del.customerAcknowledgement}` : 'Consignment in transit',
      docType: 'DELIVERY',
    },
    {
      id: 'STAGE-11',
      title: 'Order Closed',
      refCode: req.status === 'ORDER_CLOSED' ? 'Closed' : 'Active',
      completed: req.status === 'ORDER_CLOSED',
      date: req.status === 'ORDER_CLOSED' ? 'Closed' : 'Pending',
      user: 'Commercial Operations',
      summary: req.status === 'ORDER_CLOSED' ? 'Full lifecycle concluded successfully' : 'Pending final closure',
      docType: 'REQUIREMENT',
    },
  ];

  const handleDownloadQuotation = () => {
    if (qtn) {
      const doc = generateQuotationPDF(qtn, req);
      doc.save(`Quotation_${qtn.id}.pdf`);
    }
  };

  const handleDownloadVendorPo = () => {
    if (vpo) {
      const doc = generateVendorPoPDF(vpo);
      doc.save(`Vendor_PO_${vpo.id}.pdf`);
    }
  };

  const handleWhatsAppShare = () => {
    const url = generateWhatsAppShareUrl('QUOTATION', {
      recipientName: req.customerName,
      docNumber: qtn ? qtn.id : req.id,
      amount: fin.sellingVal,
      itemsSummary: req.items.map((i: any) => i.itemName).join(', '),
      phone: req.customerMobile,
    });
    window.open(url, '_blank');
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent(`MRO PROCUREMENT SOLUTION - Order Update: ${req.id} - ${req.customerName}`);
    const body = encodeURIComponent(
      `Hello ${req.contactPerson},\n\nHere is the current status for Order ${req.id}:\nStatus: ${req.status}\nItems: ${req.items.map((i: any) => i.itemName).join(', ')}\n\nTrack real-time at MRO PROCUREMENT SOLUTION.\n\nMRO PROCUREMENT SOLUTION Team`
    );
    window.location.href = `mailto:${req.customerEmail}?subject=${subject}&body=${body}`;
  };

  const canSeeMargins = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ACCOUNTS_USER' || currentUser.role === 'PROCUREMENT_EMPLOYEE';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-white">{req.id}</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                {req.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Customer: <strong className="text-white">{req.customerName}</strong> • Attn: {req.contactPerson} ({req.customerMobile})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleWhatsAppShare}
              className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Share Order via WhatsApp"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
            <button
              onClick={handleEmailShare}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Share via Email"
            >
              <Mail className="w-4 h-4" />
              <span className="hidden sm:inline">Email</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Financial Summary Strip (Authorized roles only) */}
        {canSeeMargins && fin.sellingVal > 0 && (
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-xs shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Customer Selling Value:</span>
              <span className="font-bold text-slate-900">₹{fin.sellingVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Vendor Landed Purchase:</span>
              <span className="font-bold text-slate-900">₹{fin.purchaseVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center gap-2 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              <span className="text-emerald-700 font-semibold">Gross Profit Margin:</span>
              <span className="font-extrabold text-emerald-700">₹{fin.grossMargin.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-200/60 px-1.5 py-0.2 rounded">
                {fin.marginPercent.toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        {/* Scrollable Timeline Area */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Order Linked IDs Breadcrumb */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex flex-wrap items-center gap-2 font-mono">
            <span className="font-bold text-blue-950">10-STAGE DIRECT CHAIN:</span>
            <span className="bg-white px-2 py-0.5 rounded border border-blue-300 font-bold">{req.id}</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
            <span className="bg-white px-2 py-0.5 rounded border border-blue-300">{quotes[0]?.id || 'VQ-...'}</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
            <span className="bg-white px-2 py-0.5 rounded border border-blue-300">{qtn?.id || 'QTN-...'}</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
            <span className="bg-white px-2 py-0.5 rounded border border-blue-300">{cpo?.id || 'CPO-...'}</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
            <span className="bg-white px-2 py-0.5 rounded border border-blue-300">{vpo?.id || 'VPO-...'}</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
            <span className="bg-white px-2 py-0.5 rounded border border-blue-300">{pi?.id || 'PI-...'}</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
            <span className="bg-white px-2 py-0.5 rounded border border-blue-300">{pay?.id || 'PAY-...'}</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
            <span className="bg-white px-2 py-0.5 rounded border border-blue-300">{dsp?.id || 'DSP-...'}</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
            <span className="bg-white px-2 py-0.5 rounded border border-blue-300">{del?.id || 'DEL-...'}</span>
          </div>

          {/* Timeline Items */}
          <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
            {STAGES.map((st, index) => {
              return (
                <div key={st.id} className="relative group">
                  {/* Bullet */}
                  <div
                    className={`absolute -left-6 sm:-left-8 top-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      st.completed
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                        : 'bg-white border-2 border-slate-300 text-slate-400'
                    }`}
                  >
                    {st.completed ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
                  </div>

                  {/* Stage Card */}
                  <div
                    className={`p-4 rounded-xl border transition-all ${
                      st.completed
                        ? 'bg-white border-slate-200 shadow-xs'
                        : 'bg-slate-50/60 border-dashed border-slate-200 opacity-75'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-900">{st.title}</h4>
                        <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {st.refCode}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {st.date}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mb-2 leading-relaxed">{st.summary}</p>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                      <span>
                        Responsible: <strong className="text-slate-700">{st.user}</strong>
                      </span>

                      {/* Download PDF button if available */}
                      {st.docType === 'QUOTATION' && qtn && (
                        <button
                          onClick={handleDownloadQuotation}
                          className="flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download Quotation PDF</span>
                        </button>
                      )}

                      {st.docType === 'VPO' && vpo && (
                        <button
                          onClick={handleDownloadVendorPo}
                          className="flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download Vendor PO PDF</span>
                        </button>
                      )}

                      {st.docType === 'DSP' && dsp && (
                        <span className="font-mono text-slate-600 font-semibold">
                          LR #: {dsp.lrNumber}
                        </span>
                      )}
                    </div>

                    {/* Interactive Action for STAGE-2: Direct Vendor Rate Entry */}
                    {st.id === 'STAGE-2' && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-600">
                          {quotes.length > 0
                            ? `${quotes.length} Rate Quote(s) on file`
                            : 'No supplier rate recorded yet'}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onOpenRateEntry?.(req.id)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>{quotes.length > 0 ? 'Add Another Vendor Rate' : 'Enter Vendor Rate'}</span>
                          </button>
                          {quotes.length > 0 && (
                            <button
                              onClick={() => onOpenRateComparison?.(req.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                            >
                              <Scale className="w-3.5 h-3.5" />
                              <span>Proceed to Rate Comparison</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Interactive Action for STAGE-3: Rate Comparison & Sourcing */}
                    {st.id === 'STAGE-3' && quotes.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-600">
                          {quotes.length} rate quotation(s) ready for commercial analysis
                        </span>
                        <button
                          onClick={() => onOpenRateComparison?.(req.id)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                        >
                          <Scale className="w-3.5 h-3.5" />
                          <span>Open Rate Comparison & Sourcing</span>
                        </button>
                      </div>
                    )}

                    {/* Interactive Action for STAGE-4: Customer Quotation */}
                    {st.id === 'STAGE-4' && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-600">
                          {qtn ? `Quotation ${qtn.id} prepared (₹${qtn.grandTotal.toLocaleString('en-IN')})` : 'Prepare customer commercial quotation'}
                        </span>
                        <button
                          onClick={() => {
                            onClose();
                            onOpenQuotation?.(req.id);
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                        >
                          <FileCheck2 className="w-3.5 h-3.5" />
                          <span>{qtn ? 'View / Edit Quotation' : 'Create Customer Quotation'}</span>
                        </button>
                      </div>
                    )}

                    {/* Interactive Action for STAGE-5: Customer PO */}
                    {st.id === 'STAGE-5' && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-600">
                          {cpo ? `Customer PO ${cpo.customerPoNumber} received` : 'Record customer Purchase Order'}
                        </span>
                        <button
                          onClick={() => {
                            onClose();
                            onOpenCustomerPo?.(req.id);
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>{cpo ? 'View Customer PO' : 'Record Customer PO'}</span>
                        </button>
                      </div>
                    )}

                    {/* Interactive Action for STAGE-6: Vendor PO */}
                    {st.id === 'STAGE-6' && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-600">
                          {vpo ? `Vendor PO ${vpo.id} issued` : 'Issue Purchase Order to chosen vendor'}
                        </span>
                        <button
                          onClick={() => {
                            onClose();
                            onOpenVendorPo?.(req.id);
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>{vpo ? 'View Vendor PO' : 'Create Vendor PO'}</span>
                        </button>
                      </div>
                    )}

                    {/* Interactive Action for STAGE-7: Vendor PI */}
                    {st.id === 'STAGE-7' && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-600">
                          {pi ? `Proforma Invoice ${pi.piNumber} recorded` : 'Log vendor Proforma Invoice'}
                        </span>
                        <button
                          onClick={() => {
                            onClose();
                            onOpenVendorPi?.(vpo?.id || req.id);
                          }}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>{pi ? 'View Vendor PI' : 'Record Vendor PI'}</span>
                        </button>
                      </div>
                    )}

                    {/* Interactive Action for STAGE-8: Payment Released */}
                    {st.id === 'STAGE-8' && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-600">
                          {pay ? `Payment ${pay.id} disbursed` : 'Direct payment settlement & recording'}
                        </span>
                        <button
                          onClick={() => {
                            onClose();
                            onOpenPayment?.(pi?.id || req.id);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>{pay ? 'View Payment Details' : 'Record Payment'}</span>
                        </button>
                      </div>
                    )}

                    {/* Interactive Action for STAGE-9: Vendor Dispatch */}
                    {st.id === 'STAGE-9' && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-600">
                          {dsp ? `Dispatch LR #${dsp.lrNumber} recorded` : 'Record material dispatch & tracking details'}
                        </span>
                        <button
                          onClick={() => {
                            onClose();
                            onOpenDispatch?.(req.id);
                          }}
                          className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>{dsp ? 'View Dispatch & Tracking' : 'Record Dispatch & LR'}</span>
                        </button>
                      </div>
                    )}

                    {/* Interactive Action for STAGE-10: Delivery & Inspection */}
                    {st.id === 'STAGE-10' && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-600">
                          {del ? `Delivery confirmed (${del.customerAcknowledgement})` : 'Record consignment delivery & customer POD'}
                        </span>
                        <button
                          onClick={() => {
                            onClose();
                            onOpenDelivery?.(req.id);
                          }}
                          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{del ? 'View Delivery Record' : 'Record Delivery & POD'}</span>
                        </button>
                      </div>
                    )}

                    {/* Interactive Action for STAGE-11: Order Closed */}
                    {st.id === 'STAGE-11' && req.status !== 'ORDER_CLOSED' && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-600">
                          Finalize and close completed order
                        </span>
                        <button
                          onClick={() => {
                            closeOrder(req.id, 'Order closed by operator after completing all procurement stages.');
                            onClose();
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Mark Order Closed</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Close Order Action Button if delivered but not closed */}
          {req.status === 'DELIVERED' && (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-emerald-900">Goods Verified & Delivered</h4>
                <p className="text-xs text-emerald-700">All stages complete. Finalize order closure and ledger posting.</p>
              </div>
              <button
                onClick={() => {
                  closeOrder(req.id, 'Closed by Super Admin after delivery verification.');
                  onClose();
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-500/20"
              >
                Mark Order Closed
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
