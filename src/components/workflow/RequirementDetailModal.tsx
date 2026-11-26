import React from 'react';
import {
  X,
  Building,
  Users,
  Calendar,
  Hash,
  FileText,
  Mail,
  Phone,
  Clock,
  CheckCircle,
  Tag,
  DollarSign,
  Download,
  Share2,
  Lock,
  ArrowRight,
  ShieldCheck,
  Building2,
  MapPin,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CustomerRequirement } from '../../types';
import { generateWhatsAppShareUrl } from '../../services/pdfService';

interface RequirementDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirement: CustomerRequirement | null;
  onEdit?: (req: CustomerRequirement) => void;
  onSelectOrder?: (orderId: string) => void;
}

export const RequirementDetailModal: React.FC<RequirementDetailModalProps> = ({
  isOpen,
  onClose,
  requirement,
  onEdit,
  onSelectOrder,
}) => {
  const { auditLogs } = useApp();

  if (!isOpen || !requirement) return null;

  const relevantAudits = auditLogs.filter(
    (log) => log.entityId === requirement.id || log.details.includes(requirement.id)
  );

  const handleShareWhatsApp = () => {
    const url = generateWhatsAppShareUrl('REQUIREMENT', {
      recipientName: requirement.companyName || requirement.customerName,
      docNumber: requirement.rfqNumber || requirement.id,
      itemsSummary: requirement.items.map((i) => `${i.itemName} (Qty: ${i.quantity})`).join(', '),
      phone: requirement.purchaseExecutiveMobile || requirement.customerMobile,
    });
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base sm:text-lg text-white">
                Requirement & RFQ Details
              </h3>
              <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {requirement.rfqNumber || requirement.id}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  requirement.status === 'NEW_REQUIREMENT'
                    ? 'bg-blue-100 text-blue-800'
                    : requirement.status === 'ORDER_CLOSED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {requirement.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Requirement ID: {requirement.id} • Registered on {requirement.requirementDate || requirement.createdAt}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Company & Purchase Executive Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Buyer Company Info */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Buyer Customer Company</span>
                </span>
                <span className="font-mono text-[11px] font-bold text-slate-500">
                  {requirement.companyCode || requirement.companyId || requirement.customerId}
                </span>
              </div>
              <h4 className="font-bold text-sm text-slate-900">
                {requirement.companyName || requirement.customerName}
              </h4>
              <div className="text-xs text-slate-600 space-y-1">
                {requirement.referenceNumber && (
                  <p>
                    <span className="text-slate-400">Reference No:</span>{' '}
                    <strong className="font-mono text-slate-700">{requirement.referenceNumber}</strong>
                  </p>
                )}
                <p>
                  <span className="text-slate-400">Source:</span>{' '}
                  <span className="font-semibold text-slate-800">{requirement.requirementSource || 'Email'}</span>
                </p>
                {requirement.remarks && (
                  <p>
                    <span className="text-slate-400">Remarks:</span>{' '}
                    <span className="text-slate-700 italic">{requirement.remarks}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Purchase Executive Info */}
            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-indigo-200/60">
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Assigned Purchase Executive</span>
                </span>
                {requirement.purchaseExecutiveId && (
                  <span className="font-mono text-[11px] font-bold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">
                    {requirement.purchaseExecutiveId}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-indigo-950">
                    {requirement.purchaseExecutiveName || requirement.contactPerson || 'Procurement Buyer'}
                  </h4>
                  <p className="text-xs text-indigo-700 font-medium">
                    {requirement.purchaseExecutiveDesignation || 'Purchase Executive'}
                  </p>
                </div>
              </div>
              <div className="text-xs text-slate-600 space-y-1 pt-1">
                {(requirement.purchaseExecutiveMobile || requirement.customerMobile) && (
                  <p className="flex items-center gap-1.5 font-mono">
                    <Phone className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{requirement.purchaseExecutiveMobile || requirement.customerMobile}</span>
                  </p>
                )}
                {(requirement.purchaseExecutiveEmail || requirement.customerEmail) && (
                  <p className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{requirement.purchaseExecutiveEmail || requirement.customerEmail}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Line Items List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Material Items ({requirement.items.length})
              </h4>
              <span className="text-xs text-slate-500 font-medium">
                Delivery Required:{' '}
                <strong>{requirement.receivedRequirementDate || requirement.requirementDate}</strong>
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3">Part # / Model</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Qty</th>
                    <th className="py-2.5 px-3">Target Price</th>
                    <th className="py-2.5 px-3">Assigned Supplier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requirement.items.map((it, idx) => (
                    <tr key={it.id || idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{it.itemName}</div>
                        {it.specification && (
                          <div className="text-[10px] text-slate-500 font-normal">{it.specification}</div>
                        )}
                        {it.purchaseExecutiveName &&
                          it.purchaseExecutiveName !== requirement.purchaseExecutiveName && (
                            <div className="text-[10px] text-indigo-600 font-medium">
                              Exec: {it.purchaseExecutiveName}
                            </div>
                          )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {it.partNumber || it.modelNumber || '-'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {it.category || 'General'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {it.quantity} {it.uom}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        {it.targetPrice ? `₹${it.targetPrice.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="py-2.5 px-3">
                        {it.selectedVendorName ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-semibold text-[10px]">
                            {it.selectedVendorName}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit History Timeline for this requirement */}
          {relevantAudits.length > 0 && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Audit History & Change Log ({relevantAudits.length})
              </h5>
              <div className="space-y-2">
                {relevantAudits.map((log) => (
                  <div key={log.id} className="text-xs bg-white p-2.5 rounded-lg border border-slate-200 flex items-start gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{log.action}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{log.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">{log.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share WhatsApp</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEdit(requirement);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Edit Requirement
                </button>
              )}
              {onSelectOrder && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectOrder(requirement.id);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-md"
                >
                  <span>Order Timeline</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
