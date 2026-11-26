import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
  FileText,
  DollarSign,
  UserCheck,
  Filter,
  Eye,
  Check,
  Building,
} from 'lucide-react';
import { useApp, isSuperAdminUser } from '../../context/AppContext';
import { fetchApi } from '../../utils/apiClient';
import { canApproveWorkflow } from '../../utils/roleUtils';

export interface ApprovalItem {
  id: string;
  type: 'REQUIREMENT' | 'CUSTOMER_QUOTATION' | 'VENDOR_PO' | 'PAYMENT';
  requestNumber: string;
  requestDate: string;
  requestor: string;
  department: string;
  counterParty: string; // Vendor or Customer
  amount: number;
  approvalLevel: 'L1 Executive' | 'L2 Manager' | 'L3 Finance Head' | 'L4 Board';
  pendingSince: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SENT_BACK';
  notes?: string;
  linkedId: string;
}

export const ApprovalDashboardView: React.FC = () => {
  const { currentUser, requirements, customerQuotations, vendorPOs, payments, setSelectedOrderId } = useApp();

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SENT_BACK'>('PENDING');
  const [remarksModalItem, setRemarksModalItem] = useState<{ item: ApprovalItem; action: 'APPROVE' | 'REJECT' | 'SEND_BACK' } | null>(null);
  const [actionNotes, setActionNotes] = useState('');

  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);

  const mapApprovalRecord = useCallback((rec: any): ApprovalItem => {
    const rawType = String(rec.requestType || rec.type || 'REQUIREMENT').toUpperCase();
    const mappedType: ApprovalItem['type'] =
      rawType === 'VENDOR_PO' || rawType === 'PAYMENT' || rawType === 'REQUIREMENT'
        ? (rawType as ApprovalItem['type'])
        : 'CUSTOMER_QUOTATION';

    const levelMap: Record<string, ApprovalItem['approvalLevel']> = {
      LEVEL_1: 'L1 Executive',
      LEVEL_2: 'L2 Manager',
      FINAL: 'L3 Finance Head',
    };

    const reqNum = rec.requestNumber || rec.id || '';
    const linkedMatch =
      requirements.find((r) => r.id === reqNum || r.rfqNumber === reqNum)?.id ||
      vendorPOs.find((v) => v.id === reqNum)?.requirementId ||
      customerQuotations.find((q) => q.id === reqNum)?.requirementId ||
      payments.find((p) => p.id === reqNum)?.requirementId ||
      rec.linkedId ||
      reqNum;

    return {
      id: rec.id,
      type: mappedType,
      requestNumber: reqNum,
      requestDate: rec.requestDate || String(rec.pendingSince || '').slice(0, 10) || '',
      requestor: rec.requestorName || rec.requestor || 'Team Member',
      department: rec.department || 'Procurement',
      counterParty: rec.vendorOrCustomer || rec.counterParty || 'Internal',
      amount: Number(rec.amount) || 0,
      approvalLevel: levelMap[rec.approvalLevel] || rec.approvalLevel || 'L2 Manager',
      pendingSince: rec.approverName
        ? `${rec.status} by ${rec.approverName}`
        : rec.pendingSince || 'Just now',
      status: rec.status || 'PENDING',
      notes: rec.comments || rec.details || rec.notes || '',
      linkedId: linkedMatch,
    };
  }, [requirements, vendorPOs, customerQuotations, payments]);

  const loadApprovals = useCallback(async () => {
    try {
      const res = await fetchApi('/api/approvals');
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      if (data && Array.isArray(data.approvals)) {
        setApprovals(data.approvals.map(mapApprovalRecord));
      }
    } catch {}
  }, [mapApprovalRecord]);

  useEffect(() => {
    void loadApprovals();
    const handleSync = () => {
      void loadApprovals();
    };
    window.addEventListener('mro_backend_synced', handleSync);
    return () => window.removeEventListener('mro_backend_synced', handleSync);
  }, [loadApprovals]);

  const isSuperAdmin = isSuperAdminUser(currentUser);
  const userAuthority = currentUser.approvalLimit ?? (isSuperAdmin ? 0 : 0);

  // Filter items
  const visibleApprovals = approvals.filter((item) => {
    if (activeFilter !== 'ALL' && item.status !== activeFilter) return false;
    // Check if user has approval authority or is admin/manager
    if (isSuperAdmin || canApproveWorkflow(currentUser.role, currentUser.username)) {
      return true;
    }
    // Check user limit
    if (userAuthority > 0 && item.amount <= userAuthority) return true;
    return false;
  });

  const handleAction = (item: ApprovalItem, action: 'APPROVE' | 'REJECT' | 'SEND_BACK') => {
    setRemarksModalItem({ item, action });
    setActionNotes('');
  };

  const confirmAction = async () => {
    if (!remarksModalItem) return;
    const { item, action } = remarksModalItem;

    let newStatus: ApprovalItem['status'] = 'APPROVED';
    if (action === 'REJECT') newStatus = 'REJECTED';
    if (action === 'SEND_BACK') newStatus = 'SENT_BACK';

    setApprovals((prev) =>
      prev.map((a) =>
        a.id === item.id
          ? {
              ...a,
              status: newStatus,
              notes: actionNotes || a.notes,
              pendingSince: `${newStatus} by ${currentUser.name} just now`,
            }
          : a
      )
    );
    setRemarksModalItem(null);

    try {
      const res = await fetchApi(`/api/approvals/${encodeURIComponent(item.id)}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          approverId: currentUser.id,
          approverName: currentUser.name,
          comments: actionNotes || item.notes || '',
        }),
      });
      if (res.ok) {
        void loadApprovals();
      }
    } catch {}
  };

  const stats = {
    pending: approvals.filter((a) => a.status === 'PENDING').length,
    approved: approvals.filter((a) => a.status === 'APPROVED').length,
    rejected: approvals.filter((a) => a.status === 'REJECTED').length,
    sentBack: approvals.filter((a) => a.status === 'SENT_BACK').length,
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Corporate Approval Dashboard & Sanctions
              </h1>
              <p className="text-xs text-slate-500">
                Authorized approvals for RFQs, Client Quotations, Vendor POs, and Financial Disbursements
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 font-semibold flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-purple-600" />
            <span>Authority: </span>
            <strong className="font-mono text-purple-950">
              {currentUser.approvalLimit === 0 ? 'Unlimited (MD/Admin)' : `₹${currentUser.approvalLimit?.toLocaleString('en-IN')}`}
            </strong>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div
          onClick={() => setActiveFilter('PENDING')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeFilter === 'PENDING'
              ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/30'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase">Pending Approvals</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{stats.pending}</div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">Requires your review</div>
        </div>

        <div
          onClick={() => setActiveFilter('APPROVED')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeFilter === 'APPROVED'
              ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-400/30'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase">Approved</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{stats.approved}</div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">Sanctioned & Active</div>
        </div>

        <div
          onClick={() => setActiveFilter('REJECTED')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeFilter === 'REJECTED'
              ? 'bg-red-50/70 border-red-300 ring-2 ring-red-400/30'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-red-700 uppercase">Rejected</span>
            <XCircle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{stats.rejected}</div>
          <div className="text-[11px] text-red-700 font-medium mt-1">Disapproved</div>
        </div>

        <div
          onClick={() => setActiveFilter('SENT_BACK')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeFilter === 'SENT_BACK'
              ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-400/30'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-700 uppercase">Revision Required</span>
            <RotateCcw className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{stats.sentBack}</div>
          <div className="text-[11px] text-blue-700 font-medium mt-1">Sent Back for correction</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-bold text-slate-800">Filter View:</span>
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'SENT_BACK'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  activeFilter === tab
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {tab.replace('_', ' ')}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-500 font-medium">
            Showing {visibleApprovals.length} approval requests
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Request Ref & Type</th>
                <th className="py-3 px-4">Requestor & Department</th>
                <th className="py-3 px-4">Counterparty (Vendor/Client)</th>
                <th className="py-3 px-4 text-right">Amount (INR)</th>
                <th className="py-3 px-4">Level & Pending Since</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {visibleApprovals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No approvals currently pending in this category.
                  </td>
                </tr>
              ) : (
                visibleApprovals.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-slate-900 text-xs">{item.requestNumber}</div>
                      <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {item.type.replace('_', ' ')}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">Date: {item.requestDate}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{item.requestor}</div>
                      <div className="text-[11px] text-slate-500">{item.department}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{item.counterParty}</div>
                      {item.notes && <div className="text-[10px] text-slate-500 italic truncate max-w-xs">{item.notes}</div>}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-right text-sm">
                      ₹{item.amount.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-purple-700 text-[11px]">{item.approvalLevel}</div>
                      <div className="text-[10px] text-slate-500">{item.pendingSince}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'REJECTED'
                            ? 'bg-red-100 text-red-800'
                            : item.status === 'SENT_BACK'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedOrderId(item.linkedId)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                          title="View Trace"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {item.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleAction(item, 'APPROVE')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-xs"
                            >
                              <Check className="w-3 h-3 stroke-[3]" />
                              <span>Approve</span>
                            </button>

                            <button
                              onClick={() => handleAction(item, 'SEND_BACK')}
                              className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-lg text-[11px] font-semibold"
                            >
                              Send Back
                            </button>

                            <button
                              onClick={() => handleAction(item, 'REJECT')}
                              className="px-2 py-1 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-lg text-[11px] font-semibold"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Remarks Confirmation Modal */}
      {remarksModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                Confirm Approval Action: {remarksModalItem.action}
              </h3>
              <button
                onClick={() => setRemarksModalItem(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <div>Request: <strong>{remarksModalItem.item.requestNumber}</strong></div>
              <div>Amount: <strong className="font-mono text-slate-900">₹{remarksModalItem.item.amount.toLocaleString('en-IN')}</strong></div>
              <div>Beneficiary / Client: <strong>{remarksModalItem.item.counterParty}</strong></div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Executive Remarks / Approval Notes
              </label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder={
                  remarksModalItem.action === 'APPROVE'
                    ? 'Sanctioned per corporate rate policy.'
                    : 'Please provide reason for rejection or requested correction...'
                }
                rows={3}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
              <button
                onClick={() => setRemarksModalItem(null)}
                className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                className={`px-4 py-2 text-white font-bold rounded-lg shadow-xs ${
                  remarksModalItem.action === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : remarksModalItem.action === 'REJECT'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Confirm {remarksModalItem.action}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
