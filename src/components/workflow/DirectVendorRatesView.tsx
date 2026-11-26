import React, { useState } from 'react';
import {
  Receipt,
  Plus,
  Scale,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building,
  Edit2,
  Trash2,
  FileText,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Tag,
  DollarSign,
  Truck,
  Eye,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DirectVendorRateEntryModal } from './DirectVendorRateEntryModal';
import { VendorQuote } from '../../types';

interface DirectVendorRatesViewProps {
  onOpenRateComparison: (requirementId?: string) => void;
  onSelectOrder?: (orderId: string) => void;
}

export const DirectVendorRatesView: React.FC<DirectVendorRatesViewProps> = ({
  onOpenRateComparison,
  onSelectOrder,
}) => {
  const {
    requirements,
    vendorQuotes,
    currentUser,
    deleteVendorQuote,
    getRateCompletionStatus,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'PENDING'>('ALL');
  const [selectedReqForModal, setSelectedReqForModal] = useState<string | null>(null);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [quoteToEdit, setQuoteToEdit] = useState<VendorQuote | null>(null);
  const [expandedReqs, setExpandedReqs] = useState<Record<string, boolean>>({});

  const canManageRates =
    currentUser.role === 'SUPER_ADMIN' ||
    currentUser.role === 'PROCUREMENT_EMPLOYEE' ||
    currentUser.role === 'PURCHASE_MANAGER' ||
    currentUser.role === 'VENDOR';

  const toggleExpand = (reqId: string) => {
    setExpandedReqs((prev) => ({ ...prev, [reqId]: !prev[reqId] }));
  };

  const handleOpenNewRate = (reqId?: string) => {
    setQuoteToEdit(null);
    setSelectedReqForModal(reqId || null);
    setIsRateModalOpen(true);
  };

  const handleEditRate = (quote: VendorQuote) => {
    setQuoteToEdit(quote);
    setSelectedReqForModal(quote.requirementId);
    setIsRateModalOpen(true);
  };

  const handleDeleteRate = (quote: VendorQuote) => {
    if (
      confirm(
        `Are you sure you want to delete rate quotation ${quote.id} from supplier ${quote.vendorName}? This action will be logged in the audit trail.`
      )
    ) {
      const res = deleteVendorQuote(quote.id);
      if (!res.success) {
        alert(res.message || 'Failed to delete quote');
      }
    }
  };

  // Active requirements list with rate status
  const openRequirements = requirements.filter(
    (r) => r.status !== 'ORDER_CLOSED' && r.status !== 'CANCELLED'
  );

  const reqStatusList = openRequirements.map((req) => {
    const rateStatus = getRateCompletionStatus(req.id);
    return {
      req,
      ...rateStatus,
    };
  });

  const filteredRequirements = reqStatusList.filter((item) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      !s ||
      item.req.id.toLowerCase().includes(s) ||
      item.req.customerName.toLowerCase().includes(s) ||
      item.quotes.some((q) => q.vendorName.toLowerCase().includes(s)) ||
      item.req.items.some(
        (it) =>
          it.itemName.toLowerCase().includes(s) ||
          (it.partNumber && it.partNumber.toLowerCase().includes(s))
      );

    const matchesStatus =
      statusFilter === 'ALL' || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate summary metrics
  const totalOpenReqs = openRequirements.length;
  const completedRateReqs = reqStatusList.filter((r) => r.status === 'COMPLETED').length;
  const partialRateReqs = reqStatusList.filter((r) => r.status === 'PARTIALLY_COMPLETED').length;
  const pendingRateReqs = reqStatusList.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Direct Vendor Rate Entry (Stage 2)</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  Direct Pipeline
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Log and manage supplier rates directly against customer RFQs without waiting for enquiry responses
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canManageRates && (
            <button
              onClick={() => handleOpenNewRate()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Enter Vendor Rate</span>
            </button>
          )}

          <button
            onClick={() => onOpenRateComparison()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5"
          >
            <Scale className="w-4 h-4" />
            <span>Open Rate Comparison</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Active RFQs</span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
            {totalOpenReqs}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Customer requirements</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Rate Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
            {completedRateReqs}
          </div>
          <div className="text-[11px] text-emerald-600 mt-0.5">Ready for comparison</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Partially Sourced</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-1 font-mono">
            {partialRateReqs}
          </div>
          <div className="text-[11px] text-amber-600 mt-0.5">Some items pending rate</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Pending Rate Entry</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700 mt-1 font-mono">
            {pendingRateReqs}
          </div>
          <div className="text-[11px] text-rose-600 mt-0.5">Requires supplier quotation</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Requirement ID (e.g. REQ-2026-00006), customer name, item, or vendor..."
            className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">Stage Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs p-2 border border-slate-200 rounded-lg bg-white font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed (All items quoted)</option>
            <option value="PARTIALLY_COMPLETED">Partially Completed</option>
            <option value="PENDING">Pending Rate Entry</option>
          </select>

          {(searchTerm || statusFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
              }}
              className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 rounded-lg"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Requirement Direct Sourcing Cards & Rates Table */}
      <div className="space-y-4">
        {filteredRequirements.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500 text-xs">
            <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-700">No customer requirements match your filter</p>
            <p className="text-slate-400 mt-1">Try clearing filters or search terms</p>
          </div>
        ) : (
          filteredRequirements.map((item) => {
            const isExpanded = expandedReqs[item.req.id] ?? true; // default expanded to see rates
            const hasRates = item.quotes.length > 0;
            const isCompleted = item.status === 'COMPLETED';

            return (
              <div
                key={item.req.id}
                className={`bg-white rounded-2xl border transition-all shadow-xs overflow-hidden ${
                  isCompleted
                    ? 'border-emerald-200 hover:border-emerald-300'
                    : hasRates
                    ? 'border-amber-200 hover:border-amber-300'
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                {/* Requirement Banner Header */}
                <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {item.req.id}
                      </span>
                      <h3 className="font-bold text-sm text-slate-900">
                        {item.req.customerName}
                      </h3>

                      {/* Status Badge */}
                      {isCompleted ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Direct Rate Entry: Completed</span>
                        </span>
                      ) : hasRates ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Partially Completed ({item.quotedItemsCount}/{item.totalItems} items)</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-300 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-slate-500" />
                          <span>Pending Rate Entry</span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                      <span>Received: <strong>{item.req.receivedRequirementDate || item.req.requirementDate}</strong></span>
                      {item.req.expectedDeliveryDate ? (
                        <span>Expected Delivery: <strong className="text-blue-700">{item.req.expectedDeliveryDate}</strong></span>
                      ) : null}
                      <span>Total Items: <strong>{item.totalItems}</strong></span>
                      <span>Rates Recorded: <strong className="text-slate-900">{item.quotesCount} quote(s)</strong></span>
                    </div>

                    {/* Missing Items Warning if Partial */}
                    {item.status === 'PARTIALLY_COMPLETED' && item.missingItems.length > 0 && (
                      <div className="text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 mt-1 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>
                          Still requires rate for:{' '}
                          <strong>
                            {item.missingItems.map((m) => m.itemName).join(', ')}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Header Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {canManageRates && (
                      <button
                        onClick={() => handleOpenNewRate(item.req.id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Enter Vendor Rate</span>
                      </button>
                    )}

                    {hasRates && (
                      <button
                        onClick={() => onOpenRateComparison(item.req.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                      >
                        <Scale className="w-3.5 h-3.5" />
                        <span>Compare in Matrix</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {onSelectOrder && (
                      <button
                        onClick={() => onSelectOrder(item.req.id)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                        title="View complete 11-stage timeline"
                      >
                        Timeline
                      </button>
                    )}

                    <button
                      onClick={() => toggleExpand(item.req.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Content: Saved Rates and Items List */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 space-y-4">
                    {/* Items in Requirement Overview */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-slate-400" />
                        <span>Required Items Sourcing Status</span>
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                            <tr>
                              <th className="py-2 px-3">Item Name</th>
                              <th className="py-2 px-3">Part No / Model</th>
                              <th className="py-2 px-3">Category</th>
                              <th className="py-2 px-3">Quantity</th>
                              <th className="py-2 px-3">Target Price</th>
                              <th className="py-2 px-3">Sourced Suppliers</th>
                              <th className="py-2 px-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {item.req.items.map((it) => {
                              const matchingItemQuotes = item.quotes.filter((q) =>
                                q.items.some(
                                  (qi) =>
                                    qi.requirementItemId === it.id ||
                                    (qi.itemName &&
                                      qi.itemName.toLowerCase() === it.itemName.toLowerCase())
                                )
                              );

                              return (
                                <tr key={it.id} className="hover:bg-slate-50/50">
                                  <td className="py-2 px-3 font-bold text-slate-900">
                                    {it.itemName}
                                  </td>
                                  <td className="py-2 px-3 font-mono text-slate-600">
                                    {it.partNumber || it.modelNumber || '-'}
                                  </td>
                                  <td className="py-2 px-3 text-slate-600">
                                    {it.category || 'General'}
                                  </td>
                                  <td className="py-2 px-3 font-semibold text-slate-800">
                                    {it.quantity} {it.uom}
                                  </td>
                                  <td className="py-2 px-3 text-slate-600">
                                    {it.targetPrice ? `₹${it.targetPrice.toLocaleString('en-IN')}` : '-'}
                                  </td>
                                  <td className="py-2 px-3">
                                    {matchingItemQuotes.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {matchingItemQuotes.map((mq) => (
                                          <span
                                            key={mq.id}
                                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"
                                          >
                                            {mq.vendorName.slice(0, 15)}...
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                        Rate Missing
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    <button
                                      onClick={() => handleOpenNewRate(item.req.id)}
                                      className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold transition-colors"
                                    >
                                      + Add Rate
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Saved Rates Cards / Details Table */}
                    <div className="pt-2">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                          <span>Saved Vendor Rate Submissions ({item.quotes.length})</span>
                        </div>
                        {hasRates && (
                          <button
                            onClick={() => onOpenRateComparison(item.req.id)}
                            className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center gap-1"
                          >
                            <span>Open Side-by-Side Comparison</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </h4>

                      {item.quotes.length === 0 ? (
                        <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
                          <p>No supplier rate entries logged yet for {item.req.id}.</p>
                          <button
                            onClick={() => handleOpenNewRate(item.req.id)}
                            className="mt-2 text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Click here to enter first vendor quotation</span>
                          </button>
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                              <tr>
                                <th className="py-2.5 px-3">Quote ID & Supplier</th>
                                <th className="py-2.5 px-3">Quoted Item Lines</th>
                                <th className="py-2.5 px-3">Unit Rate (₹)</th>
                                <th className="py-2.5 px-3">GST & Freight</th>
                                <th className="py-2.5 px-3">Total Landed Cost</th>
                                <th className="py-2.5 px-3">Delivery Lead Time</th>
                                <th className="py-2.5 px-3">Attachment</th>
                                <th className="py-2.5 px-3 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                              {item.quotes.map((quote) => {
                                const totalLandedSum = quote.items.reduce(
                                  (acc, qi) => acc + (qi.totalLandedCost || 0),
                                  0
                                );

                                return (
                                  <tr key={quote.id} className="hover:bg-slate-50/60">
                                    <td className="py-2.5 px-3">
                                      <div className="font-mono font-bold text-[11px] text-blue-700">
                                        {quote.id}
                                      </div>
                                      <div className="font-bold text-slate-900 flex items-center gap-1">
                                        <Building className="w-3 h-3 text-slate-400" />
                                        <span>{quote.vendorName}</span>
                                      </div>
                                      <span className="text-[10px] text-slate-400">
                                        {quote.submissionDate}
                                      </span>
                                    </td>

                                    <td className="py-2.5 px-3">
                                      <div className="space-y-1">
                                        {quote.items.map((qi, qidx) => (
                                          <div key={qidx} className="text-[11px] text-slate-800">
                                            <strong>{qi.quantity} {qi.uom}</strong> × {qi.itemName}
                                            {qi.partNumber && (
                                              <span className="font-mono text-[10px] text-slate-500 ml-1">
                                                ({qi.partNumber})
                                              </span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </td>

                                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                      {quote.items.map((qi, qidx) => (
                                        <div key={qidx}>
                                          ₹{Number(qi.resellerPrice || qi.unitRate || 0).toLocaleString('en-IN')}
                                        </div>
                                      ))}
                                    </td>

                                    <td className="py-2.5 px-3 text-[11px] text-slate-600">
                                      {quote.items.map((qi, qidx) => (
                                        <div key={qidx}>
                                          GST {qi.gstPercent}% | Freight ₹{qi.freight || 0}
                                        </div>
                                      ))}
                                    </td>

                                    <td className="py-2.5 px-3">
                                      <span className="font-mono font-bold text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 block w-max">
                                        ₹{totalLandedSum.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        Validity: {quote.validUntil}
                                      </span>
                                    </td>

                                    <td className="py-2.5 px-3 text-[11px] text-slate-700">
                                      {quote.items.map((qi, qidx) => (
                                        <div key={qidx}>
                                          {qi.deliveryDays} Days ({qi.availability})
                                        </div>
                                      ))}
                                    </td>

                                    <td className="py-2.5 px-3">
                                      {quote.attachmentName ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                          <FileText className="w-3 h-3 text-slate-400" />
                                          <span className="max-w-[100px] truncate" title={quote.attachmentName}>
                                            {quote.attachmentName}
                                          </span>
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic">None</span>
                                      )}
                                    </td>

                                    <td className="py-2.5 px-3 text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        {canManageRates && (
                                          <button
                                            onClick={() => handleEditRate(quote)}
                                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                            title="Edit rate quote"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}

                                        {canManageRates && (
                                          <button
                                            onClick={() => handleDeleteRate(quote)}
                                            className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Delete rate quote"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
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
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Direct Vendor Rate Entry Modal */}
      <DirectVendorRateEntryModal
        isOpen={isRateModalOpen}
        onClose={() => {
          setIsRateModalOpen(false);
          setQuoteToEdit(null);
          setSelectedReqForModal(null);
        }}
        defaultRequirementId={selectedReqForModal}
        quoteToEdit={quoteToEdit}
      />
    </div>
  );
};
