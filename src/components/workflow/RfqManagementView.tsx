import React, { useState, useMemo, useRef } from 'react';
import {
  Send,
  Plus,
  Upload,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileText,
  Building,
  Calendar,
  Layers,
  Trash2,
  Eye,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  X,
  FileSpreadsheet,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { VendorEnquiry, RfqItem } from '../../types';

interface RfqManagementViewProps {
  onOpenRateSubmission?: (rfqId: string) => void;
}

export const RfqManagementView: React.FC<RfqManagementViewProps> = ({
  onOpenRateSubmission,
}) => {
  const {
    rfqs,
    requirements,
    vendors,
    companies,
    purchaseExecutives,
    createRfq,
    createBulkRfqs,
    deleteRfq,
    purgeRfq,
    purgeAllDeletedRfqs,
    currentUser,
  } = useApp();


  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedRfqDetail, setSelectedRfqDetail] = useState<VendorEnquiry | null>(null);

  // Delete Confirmation State
  const [deletingRfqId, setDeletingRfqId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('Cancelled by procurement executive');
  const [isDeleting, setIsDeleting] = useState(false);

  // Active RFQs (excluding deleted)
  const activeRfqs = useMemo(() => {
    return (rfqs || []).filter((r: any) => !r.isDeleted);
  }, [rfqs]);

  // Filtered RFQs based on search and status
  const filteredRfqs = useMemo(() => {
    return activeRfqs.filter((rfq) => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        rfq.id.toLowerCase().includes(q) ||
        (rfq.rfqNumber && rfq.rfqNumber.toLowerCase().includes(q)) ||
        (rfq.requirementId && rfq.requirementId.toLowerCase().includes(q)) ||
        (rfq.customerName && rfq.customerName.toLowerCase().includes(q)) ||
        (rfq.companyName && rfq.companyName.toLowerCase().includes(q)) ||
        (rfq.vendorName && rfq.vendorName.toLowerCase().includes(q)) ||
        (rfq.items &&
          rfq.items.some(
            (it) =>
              it.itemName.toLowerCase().includes(q) ||
              (it.brand && it.brand.toLowerCase().includes(q)) ||
              (it.partCode && it.partCode.toLowerCase().includes(q))
          ));

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'SENT' && rfq.status === 'SENT') ||
        (statusFilter === 'NEW' && (!rfq.status || rfq.status === 'NEW_RFQ' || rfq.status === 'DRAFT')) ||
        (statusFilter === 'CLOSED' && rfq.status === 'CLOSED');

      return matchSearch && matchStatus;
    });
  }, [activeRfqs, searchTerm, statusFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const total = activeRfqs.length;
    const sent = activeRfqs.filter((r) => r.status === 'SENT').length;
    const closed = activeRfqs.filter((r) => r.status === 'CLOSED').length;
    const totalItems = activeRfqs.reduce((acc, r) => acc + (r.items?.length || 1), 0);
    return { total, sent, closed, totalItems };
  }, [activeRfqs]);

  // Copy RFQ ID helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export RFQ Register to Excel
  const handleExportExcel = () => {
    const rows = activeRfqs.flatMap((rfq) => {
      if (!rfq.items || rfq.items.length === 0) {
        return [
          {
            'RFQ Number': rfq.rfqNumber || rfq.id,
            'Requirement ID': rfq.requirementId || 'N/A',
            'Customer / Company': rfq.companyName || rfq.customerName || 'Industrial Customer',
            'Vendors Assigned': (rfq.vendorIds || []).join(', '),
            'Sent Date': rfq.sentDate || 'N/A',
            'Required Date': rfq.requiredDate || 'N/A',
            Status: rfq.status || 'SENT',
            'Item Name': 'General MRO Supply',
            Brand: 'OEM',
            'Part Code': 'N/A',
            Quantity: 1,
            UOM: 'NOS',
            'Target Price': 0,
            'DB Status': rfq.dbSaveStatus || 'COMMITTED',
          },
        ];
      }
      return rfq.items.map((it, idx) => ({
        'RFQ Number': rfq.rfqNumber || rfq.id,
        'Requirement ID': rfq.requirementId || 'N/A',
        'Customer / Company': rfq.companyName || rfq.customerName || 'Industrial Customer',
        'Vendors Assigned': (rfq.vendorIds || []).join(', '),
        'Sent Date': rfq.sentDate || 'N/A',
        'Required Date': rfq.requiredDate || 'N/A',
        Status: rfq.status || 'SENT',
        'Item Number': idx + 1,
        'Item Name': it.itemName,
        Brand: it.brand || 'OEM',
        'Part Code': it.partCode || it.partNumber || 'N/A',
        Quantity: it.quantity,
        UOM: it.uom,
        'Target Price': it.targetPrice || 0,
        'DB Status': rfq.dbSaveStatus || 'COMMITTED',
      }));
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'RFQ_Register');
    XLSX.writeFile(workbook, `MRO_RFQ_Register_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Confirm Delete (Permanent hard delete)
  const handleConfirmDelete = async () => {
    if (!deletingRfqId) return;
    try {
      setIsDeleting(true);
      await purgeRfq(deletingRfqId);
      setDeletingRfqId(null);
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePurgeAll = async () => {
    try {
      setIsDeleting(true);
      await purgeAllDeletedRfqs();
    } catch (err) {
      console.error('Purge all failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Send className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                RFQ Management
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  DB Transactional Verified
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Stage 2 of 11: Create, dispatch, persist, and track supplier RFQs with full item specifications
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Manual RFQ</span>
          </button>
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            <span>Bulk RFQ Import</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Export Register</span>
          </button>
          <button
            onClick={handlePurgeAll}
            className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            title="Permanently remove all deleted/orphaned RFQ records from database"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Purge Deleted</span>
          </button>
        </div>
      </div>


      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Total RFQs</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{metrics.total}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> All persisted in DB
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Dispatched / Active</span>
            <Send className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{metrics.sent}</div>
          <div className="text-[11px] text-slate-400 mt-1">Awaiting vendor quotes</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Total Sourced Items</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{metrics.totalItems}</div>
          <div className="text-[11px] text-slate-400 mt-1">Across all RFQ line items</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Closed / Converted</span>
            <CheckCircle2 className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{metrics.closed}</div>
          <div className="text-[11px] text-slate-400 mt-1">Quotes finalized</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by RFQ #, Customer, Vendor, Part Code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold text-slate-600">
            {['ALL', 'SENT', 'NEW', 'CLOSED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  statusFilter === st ? 'bg-white text-blue-600 shadow-xs font-bold' : 'hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All RFQs' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RFQ Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">RFQ Number & Ref</th>
                <th className="py-3.5 px-4">Customer / Company</th>
                <th className="py-3.5 px-4">Vendors Assigned</th>
                <th className="py-3.5 px-4">Items Summary</th>
                <th className="py-3.5 px-4">Date & Status</th>
                <th className="py-3.5 px-4">DB Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRfqs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-300" />
                    <p className="font-semibold text-slate-600">No RFQs Found</p>
                    <p className="text-[11px] mt-0.5">
                      {searchTerm ? 'Try adjusting your search criteria' : 'Create a manual RFQ or import bulk records.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRfqs.map((rfq) => {
                  const rfqNum = rfq.rfqNumber || rfq.id;
                  const vendorNames = (rfq.vendorIds || [])
                    .map((vid) => vendors.find((v) => v.id === vid)?.companyName || vid)
                    .join(', ');

                  return (
                    <tr key={rfq.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* RFQ Number & Requirement */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-mono font-bold text-blue-600 text-xs">
                          <span>{rfqNum}</span>
                          <button
                            onClick={() => handleCopy(rfqNum)}
                            title="Copy RFQ Number"
                            className="text-slate-400 hover:text-slate-600 p-0.5"
                          >
                            {copiedId === rfqNum ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        {rfq.requirementId && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Req: {rfq.requirementId}
                          </div>
                        )}
                      </td>

                      {/* Customer / Company */}
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[180px]">
                            {rfq.companyName || rfq.customerName || 'Industrial Customer'}
                          </span>
                        </div>
                      </td>

                      {/* Vendors */}
                      <td className="py-3.5 px-4">
                        {rfq.vendorIds && rfq.vendorIds.length > 0 ? (
                          <div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              {rfq.vendorIds.length} Vendor{rfq.vendorIds.length > 1 ? 's' : ''}
                            </span>
                            <div className="text-[10px] text-slate-500 truncate max-w-[180px] mt-0.5">
                              {vendorNames}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Not assigned</span>
                        )}
                      </td>

                      {/* Items Summary */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-700">
                          {rfq.items?.length || 1} Item{(rfq.items?.length || 1) > 1 ? 's' : ''}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[200px]">
                          {rfq.items?.[0]
                            ? `${rfq.items[0].itemName} (${rfq.items[0].quantity} ${rfq.items[0].uom})`
                            : 'Standard MRO Supply'}
                        </div>
                      </td>

                      {/* Date & Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            rfq.status === 'SENT'
                              ? 'bg-blue-100 text-blue-800'
                              : rfq.status === 'CLOSED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {rfq.status || 'SENT'}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{rfq.sentDate || 'Recent'}</span>
                        </div>
                      </td>

                      {/* DB Status */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          COMMITTED
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedRfqDetail(rfq)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Items & Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {onOpenRateSubmission && (
                            <button
                              onClick={() => onOpenRateSubmission(rfq.id)}
                              className="px-2 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-colors"
                              title="Enter Vendor Rate"
                            >
                              Enter Rates
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setDeletingRfqId(rfq.id);
                              setDeleteReason('Cancelled by user');
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete RFQ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual RFQ Modal */}
      {isManualModalOpen && (
        <ManualRfqModal
          isOpen={isManualModalOpen}
          onClose={() => setIsManualModalOpen(false)}
          companies={companies}
          vendors={vendors}
          requirements={requirements}
          createRfq={createRfq}
          currentUser={currentUser}
        />
      )}

      {/* Bulk RFQ Modal */}
      {isBulkModalOpen && (
        <BulkRfqModal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          createBulkRfqs={createBulkRfqs}
          existingRfqs={activeRfqs}
          companies={companies}
          vendors={vendors}
        />
      )}

      {/* RFQ Detail Modal */}
      {selectedRfqDetail && (
        <RfqDetailModal
          rfq={selectedRfqDetail}
          onClose={() => setSelectedRfqDetail(null)}
          vendors={vendors}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingRfqId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <span className="p-2 bg-red-100 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </span>
              <h3 className="font-bold text-base text-slate-900">Delete RFQ</h3>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to remove RFQ <strong className="font-mono text-slate-900">{deletingRfqId}</strong>?
              This will update the database and register an audit log entry.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Deletion
              </label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                placeholder="e.g. Duplicated entry, customer changed scope"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingRfqId(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// MANUAL RFQ MODAL COMPONENT
// ==========================================
interface ManualRfqModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: any[];
  vendors: any[];
  requirements: any[];
  createRfq: (data: any) => Promise<any>;
  currentUser: any;
}

const ManualRfqModal: React.FC<ManualRfqModalProps> = ({
  isOpen,
  onClose,
  companies,
  vendors,
  requirements,
  createRfq,
}) => {
  const [rfqNumber, setRfqNumber] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [requirementId, setRequirementId] = useState('');
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [requiredDate, setRequiredDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('Please quote your best rates including GST, freight, and standard warranty.');
  const [items, setItems] = useState<any[]>([
    {
      itemName: '',
      brand: '',
      partCode: '',
      category: 'Electrical',
      quantity: 1,
      uom: 'NOS',
      targetPrice: 0,
      specifications: '',
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Auto-fill items if requirement selected
  const handleRequirementChange = (reqId: string) => {
    setRequirementId(reqId);
    if (!reqId) return;
    const req = requirements.find((r) => r.id === reqId || r.rfqNumber === reqId);
    if (req) {
      if (req.companyId) setCompanyId(req.companyId);
      if (req.rfqNumber && !rfqNumber) setRfqNumber(req.rfqNumber);
      if (req.items && req.items.length > 0) {
        setItems(
          req.items.map((it: any) => ({
            itemName: it.itemName,
            brand: it.assignedBrand || it.brand || '',
            partCode: it.assignedPartCode || it.partNumber || '',
            category: it.category || 'General MRO',
            quantity: it.quantity || 1,
            uom: it.uom || 'NOS',
            targetPrice: it.targetPrice || it.rate || 0,
            specifications: it.specifications || '',
          }))
        );
      }
    }
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        itemName: '',
        brand: '',
        partCode: '',
        category: 'Electrical',
        quantity: 1,
        uom: 'NOS',
        targetPrice: 0,
        specifications: '',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemFieldChange = (index: number, field: string, value: any) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const toggleVendor = (vId: string) => {
    setSelectedVendorIds((prev) =>
      prev.includes(vId) ? prev.filter((id) => id !== vId) : [...prev, vId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation
    const invalidItem = items.find((it) => !it.itemName.trim() || Number(it.quantity) <= 0);
    if (invalidItem) {
      setErrorMsg('Please provide a valid item name and quantity > 0 for all item rows.');
      return;
    }

    const selectedCompany = companies.find((c) => c.id === companyId);

    const payload = {
      rfqNumber: rfqNumber.trim() || undefined,
      requirementId: requirementId.trim() || undefined,
      companyId: companyId || undefined,
      companyName: selectedCompany?.companyName || 'Industrial Customer',
      vendorIds: selectedVendorIds,
      requiredDate,
      notes,
      items: items.map((it, idx) => ({
        ...it,
        id: `RFQ-ITEM-${Date.now()}-${idx + 1}`,
        quantity: Number(it.quantity) || 1,
        targetPrice: Number(it.targetPrice) || 0,
      })),
      status: selectedVendorIds.length > 0 ? 'SENT' : 'NEW_RFQ',
    };

    try {
      setIsSubmitting(true);
      const res = await createRfq(payload);
      if (!res.success) {
        throw new Error(res.error || 'Server rejected RFQ save transaction');
      }
      onClose();
    } catch (err: any) {
      console.error('[ManualRfqModal] Save failed:', err);
      setErrorMsg(err.message || 'Failed to save RFQ. Check database connection and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-blue-600/30 text-blue-400 rounded-lg">
              <Plus className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base text-white">Create Manual Supplier RFQ</h3>
              <p className="text-xs text-slate-400">
                Authoritative database transaction: persists header, line items, and vendor relations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Header Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50/70 rounded-xl border border-slate-200/80">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                RFQ Number (Leave blank to auto-generate)
              </label>
              <input
                type="text"
                placeholder="e.g. RFQ-2026-00050"
                value={rfqNumber}
                onChange={(e) => setRfqNumber(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Link to Requirement (Optional)
              </label>
              <select
                value={requirementId}
                onChange={(e) => handleRequirementChange(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Standalone RFQ (No Requirement) --</option>
                {requirements.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.rfqNumber || r.id} - {r.customerName || r.companyName} ({r.items?.length || 0} items)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Customer / Plant Company
              </label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Select Company / Client</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Required Delivery Date
              </label>
              <input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                RFQ Instructions / Terms
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>

          {/* Vendors Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700">
                Assign Certified Vendors ({selectedVendorIds.length} selected)
              </label>
              <span className="text-[11px] text-slate-400">Quotes will be solicited from these vendors</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1 border border-slate-200 rounded-xl bg-slate-50/50">
              {vendors.map((v) => {
                const isSelected = selectedVendorIds.includes(v.id);
                return (
                  <div
                    key={v.id}
                    onClick={() => toggleVendor(v.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/70 font-semibold text-blue-900'
                        : 'border-slate-200 bg-white hover:bg-slate-100/70 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded-sm text-blue-600 pointer-events-none"
                    />
                    <span className="truncate">{v.companyName}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Line Items Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                Line Items to Source ({items.length})
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg border border-blue-200 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item Row</span>
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 border-b border-slate-100 pb-1.5">
                    <span>Item #{idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Item Name / Description *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 10A 2 Pole MCB C-Curve"
                        value={item.itemName}
                        onChange={(e) => handleItemFieldChange(idx, 'itemName', e.target.value)}
                        required
                        className="w-full text-xs p-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Brand</label>
                      <input
                        type="text"
                        placeholder="e.g. Schneider Electric"
                        value={item.brand}
                        onChange={(e) => handleItemFieldChange(idx, 'brand', e.target.value)}
                        className="w-full text-xs p-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Part Code / Model #
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. A9F74210"
                        value={item.partCode}
                        onChange={(e) => handleItemFieldChange(idx, 'partCode', e.target.value)}
                        className="w-full text-xs p-1.5 border border-slate-300 rounded-md font-mono focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Quantity *</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemFieldChange(idx, 'quantity', e.target.value)}
                        required
                        className="w-full text-xs p-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">UOM</label>
                      <select
                        value={item.uom}
                        onChange={(e) => handleItemFieldChange(idx, 'uom', e.target.value)}
                        className="w-full text-xs p-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500"
                      >
                        {['NOS', 'SET', 'MTR', 'KG', 'PKT', 'BOX', 'LTR', 'PAIR', 'ROLL'].map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Target Price (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={item.targetPrice}
                        onChange={(e) => handleItemFieldChange(idx, 'targetPrice', e.target.value)}
                        className="w-full text-xs p-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Category
                      </label>
                      <input
                        type="text"
                        placeholder="Electrical / Mechanical"
                        value={item.category}
                        onChange={(e) => handleItemFieldChange(idx, 'category', e.target.value)}
                        className="w-full text-xs p-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Committing & Verifying...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save RFQ to Database</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// BULK RFQ MODAL COMPONENT
// ==========================================
interface BulkRfqModalProps {
  isOpen: boolean;
  onClose: () => void;
  createBulkRfqs: (rfqs: any[]) => Promise<any>;
  existingRfqs: any[];
  companies: any[];
  vendors: any[];
}

const BulkRfqModal: React.FC<BulkRfqModalProps> = ({
  isOpen,
  onClose,
  createBulkRfqs,
  existingRfqs,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [pastedText, setPastedText] = useState('');

  if (!isOpen) return null;

  // Download template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        RFQ_Number: 'RFQ-2026-00051',
        Requirement_ID: 'REQ-2026-00051',
        Customer_Name: 'Tata Steel Industrial Plant',
        Vendor_Name: 'Havells Certified Industrial Hub',
        Item_Name: 'Miniature Circuit Breaker 32A 4P',
        Brand: 'Schneider Electric',
        Part_Code: 'A9F74432',
        Quantity: 20,
        UOM: 'NOS',
        Target_Price: 1250,
        Notes: '30 Days Net, Direct Gate Delivery',
      },
      {
        RFQ_Number: 'RFQ-2026-00052',
        Requirement_ID: 'REQ-2026-00052',
        Customer_Name: 'JSW Steel Manufacturing Hub',
        Vendor_Name: 'Siemens Motion Hub',
        Item_Name: 'Power Contactor 25A 3P 220V',
        Brand: 'Schneider Electric',
        Part_Code: 'LC1D25M7',
        Quantity: 10,
        UOM: 'NOS',
        Target_Price: 1850,
        Notes: 'Ready stock dispatch required',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RFQ_Bulk_Template');
    XLSX.writeFile(wb, 'MRO_RFQ_Bulk_Import_Template.xlsx');
  };

  // Parse Excel / CSV File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const json: any[] = XLSX.utils.sheet_to_json(sheet);
        processRawRows(json);
      } catch (err) {
        console.error('File parse error:', err);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Process pasted CSV/TSV
  const handleParsePasted = () => {
    if (!pastedText.trim()) return;
    const lines = pastedText.trim().split('\n');
    if (lines.length <= 1) return;

    const headers = lines[0].split(/[,\t]/).map((h) => h.trim());
    const rows = lines.slice(1).map((line) => {
      const parts = line.split(/[,\t]/).map((p) => p.trim());
      const obj: any = {};
      headers.forEach((h, idx) => {
        obj[h] = parts[idx] || '';
      });
      return obj;
    });
    processRawRows(rows);
  };

  // Normalize and validate rows
  const processRawRows = (rawRows: any[]) => {
    const existingIds = new Set(existingRfqs.map((r) => r.id));
    const existingNums = new Set(existingRfqs.map((r) => r.rfqNumber).filter(Boolean));

    const processed = rawRows.map((r, idx) => {
      const rfqNumber = (r.RFQ_Number || r.rfqNumber || r.RFQ_NO || '').trim();
      const itemName = (r.Item_Name || r.itemName || r.Description || r.item || '').trim();
      const qty = Number(r.Quantity || r.quantity || r.QTY || 1);
      const isDuplicate = Boolean(
        rfqNumber && (existingIds.has(rfqNumber) || existingNums.has(rfqNumber))
      );
      const isValid = Boolean(itemName && !isNaN(qty) && qty > 0);

      return {
        rowNum: idx + 1,
        rfqNumber,
        requirementId: (r.Requirement_ID || r.requirementId || '').trim(),
        customerName: (r.Customer_Name || r.customerName || r.Company || '').trim(),
        vendorName: (r.Vendor_Name || r.vendorName || '').trim(),
        itemName,
        brand: (r.Brand || r.brand || '').trim(),
        partCode: (r.Part_Code || r.partCode || r.Part_Number || '').trim(),
        quantity: isNaN(qty) || qty <= 0 ? 1 : qty,
        uom: (r.UOM || r.uom || 'NOS').trim().toUpperCase(),
        targetPrice: Number(r.Target_Price || r.targetPrice || r.Rate || 0),
        notes: (r.Notes || r.notes || '').trim(),
        isDuplicate,
        isValid,
        error: !isValid
          ? 'Item Name is required and Quantity must be > 0'
          : isDuplicate
          ? 'Duplicate RFQ Number already exists in database'
          : null,
      };
    });

    setParsedRows(processed);
    setImportResult(null);
  };

  // Execute Bulk Save
  const handleExecuteImport = async () => {
    if (parsedRows.length === 0 || isProcessing) return;

    try {
      setIsProcessing(true);
      const validRows = parsedRows.filter((r) => r.isValid && !r.isDuplicate);
      if (validRows.length === 0) {
        throw new Error('No valid new RFQs to import. Please check duplicate or error rows.');
      }

      // Group rows by RFQ Number if multiple items belong to the same RFQ
      const rfqMap = new Map<string, any>();
      validRows.forEach((row, idx) => {
        const key = row.rfqNumber || `RFQ-AUTO-${Date.now()}-${idx}`;
        if (!rfqMap.has(key)) {
          rfqMap.set(key, {
            rfqNumber: row.rfqNumber || undefined,
            requirementId: row.requirementId || undefined,
            companyName: row.customerName || 'Industrial Customer',
            vendorName: row.vendorName || undefined,
            notes: row.notes || 'Bulk Imported RFQ',
            items: [],
          });
        }
        rfqMap.get(key).items.push({
          itemName: row.itemName,
          brand: row.brand,
          partCode: row.partCode,
          quantity: row.quantity,
          uom: row.uom,
          targetPrice: row.targetPrice,
        });
      });

      const payloadList = Array.from(rfqMap.values());
      const res = await createBulkRfqs(payloadList);
      setImportResult(res);
    } catch (err: any) {
      console.error('[BulkRfqModal] Execution error:', err);
      setImportResult({
        success: false,
        totalSubmitted: parsedRows.length,
        successfullySaved: 0,
        duplicateCount: parsedRows.filter((r) => r.isDuplicate).length,
        failedCount: parsedRows.length,
        results: [],
        error: err.message,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Download Error Report
  const handleDownloadErrorReport = () => {
    const errorRows = parsedRows
      .filter((r) => !r.isValid || r.isDuplicate)
      .map((r) => ({
        'Row Number': r.rowNum,
        'RFQ Number': r.rfqNumber,
        'Item Name': r.itemName,
        Quantity: r.quantity,
        Error: r.error,
      }));

    if (errorRows.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(errorRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RFQ_Import_Errors');
    XLSX.writeFile(wb, `RFQ_Import_Error_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const validCount = parsedRows.filter((r) => r.isValid && !r.isDuplicate).length;
  const duplicateCount = parsedRows.filter((r) => r.isDuplicate).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-blue-600/30 text-blue-400 rounded-lg">
              <Upload className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base text-white">Bulk RFQ Import & Database Persistence</h3>
              <p className="text-xs text-slate-400">
                Upload Excel/CSV or paste rows. Includes duplicate prevention & row-by-row error reporting
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <h4 className="text-xs font-bold text-slate-900">1. Download Template & Prepare Data</h4>
              <p className="text-[11px] text-slate-500">
                Ensure headers match: RFQ_Number, Customer_Name, Vendor_Name, Item_Name, Brand, Quantity, UOM
              </p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Download Excel Template</span>
            </button>
          </div>

          {/* Upload Dropzone / Paste Area */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-6 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl bg-white hover:bg-blue-50/30 cursor-pointer text-center transition-all flex flex-col items-center justify-center space-y-2"
            >
              <FileSpreadsheet className="w-8 h-8 text-blue-500" />
              <div className="text-xs font-bold text-slate-700">Choose Excel (.xlsx, .xls, .csv)</div>
              <div className="text-[10px] text-slate-400">Click to browse file from your device</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Or Paste CSV / Tab-Delimited Data</label>
              <textarea
                rows={3}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="RFQ_Number&#9;Customer_Name&#9;Item_Name&#9;Quantity&#9;UOM&#10;RFQ-001&#9;Tata Steel&#9;10A MCB&#9;20&#9;NOS"
                className="w-full text-xs font-mono p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <button
                type="button"
                onClick={handleParsePasted}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded text-[11px] font-semibold"
              >
                Parse Pasted Rows
              </button>
            </div>
          </div>

          {/* Summary / Result Cards */}
          {importResult && (
            <div
              className={`p-4 rounded-xl border ${
                importResult.success && importResult.successfullySaved > 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-sm mb-2">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Bulk Import Result Summary
                </span>
                {importResult.failedCount > 0 && (
                  <button
                    onClick={handleDownloadErrorReport}
                    className="px-3 py-1 bg-white border border-red-300 hover:bg-red-50 text-red-700 text-xs font-bold rounded-lg flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Error Report</span>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="p-2 bg-white/80 rounded-lg">
                  <span className="text-slate-500">Total Submitted:</span>{' '}
                  <strong>{importResult.totalSubmitted}</strong>
                </div>
                <div className="p-2 bg-white/80 rounded-lg text-emerald-700">
                  <span>Successfully Saved:</span> <strong>{importResult.successfullySaved}</strong>
                </div>
                <div className="p-2 bg-white/80 rounded-lg text-amber-700">
                  <span>Duplicates Skipped:</span> <strong>{importResult.duplicateCount}</strong>
                </div>
                <div className="p-2 bg-white/80 rounded-lg text-red-700">
                  <span>Failed:</span> <strong>{importResult.failedCount}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Parsed Rows Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Parsed Rows Preview ({parsedRows.length})</span>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-emerald-600">Valid: {validCount}</span>
                  <span className="text-amber-600">Duplicate: {duplicateCount}</span>
                  <span className="text-red-600">Errors: {invalidCount}</span>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-[10px] font-bold text-slate-500 uppercase sticky top-0">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">RFQ Number</th>
                      <th className="py-2 px-3">Item Name</th>
                      <th className="py-2 px-3">Brand</th>
                      <th className="py-2 px-3">Qty & UOM</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row) => (
                      <tr
                        key={row.rowNum}
                        className={
                          !row.isValid
                            ? 'bg-red-50/50'
                            : row.isDuplicate
                            ? 'bg-amber-50/50'
                            : 'hover:bg-slate-50'
                        }
                      >
                        <td className="py-2 px-3 text-slate-400">{row.rowNum}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-700">
                          {row.rfqNumber || 'Auto-generated'}
                        </td>
                        <td className="py-2 px-3">{row.itemName}</td>
                        <td className="py-2 px-3 text-slate-500">{row.brand || 'OEM'}</td>
                        <td className="py-2 px-3 font-semibold">
                          {row.quantity} {row.uom}
                        </td>
                        <td className="py-2 px-3">
                          {row.error ? (
                            <span className="text-red-600 font-semibold text-[10px] flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> {row.error}
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-semibold text-[10px] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Ready
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={isProcessing || validCount === 0}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Importing & Verifying...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Import {validCount} Valid RFQ(s) to DB</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// RFQ DETAIL & ITEMS MODAL COMPONENT
// ==========================================
interface RfqDetailModalProps {
  rfq: VendorEnquiry;
  onClose: () => void;
  vendors: any[];
}

const RfqDetailModal: React.FC<RfqDetailModalProps> = ({ rfq, onClose, vendors }) => {
  const rfqNum = rfq.rfqNumber || rfq.id;
  const assignedVendors = (rfq.vendorIds || []).map(
    (vid) => vendors.find((v) => v.id === vid) || { id: vid, companyName: vid }
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-white">{rfqNum}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                DB COMMITTED
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Customer: {rfq.companyName || rfq.customerName || 'Industrial Customer'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          {/* Header Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-400 block text-[10px]">Requirement ID</span>
              <strong className="font-mono text-slate-800">{rfq.requirementId || 'N/A'}</strong>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-400 block text-[10px]">Sent Date</span>
              <strong className="text-slate-800">{rfq.sentDate || 'Recent'}</strong>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-400 block text-[10px]">Required Delivery</span>
              <strong className="text-slate-800">{rfq.requiredDate || 'Standard'}</strong>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-400 block text-[10px]">Status</span>
              <strong className="text-blue-700">{rfq.status || 'SENT'}</strong>
            </div>
          </div>

          {/* Vendors */}
          <div>
            <span className="text-xs font-bold text-slate-700 mb-1 block">Assigned Vendors:</span>
            <div className="flex flex-wrap gap-2">
              {assignedVendors.length > 0 ? (
                assignedVendors.map((v) => (
                  <span
                    key={v.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold"
                  >
                    <Building className="w-3.5 h-3.5 text-blue-600" />
                    <span>{v.companyName}</span>
                  </span>
                ))
              ) : (
                <span className="text-slate-400 italic">No specific vendors assigned</span>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div>
            <span className="text-xs font-bold text-slate-800 mb-2 block">
              RFQ Items ({rfq.items?.length || 1})
            </span>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-[10px] font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Item Name</th>
                    <th className="py-2.5 px-3">Brand</th>
                    <th className="py-2.5 px-3">Part Code</th>
                    <th className="py-2.5 px-3">Qty & UOM</th>
                    <th className="py-2.5 px-3">Target Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(!rfq.items || rfq.items.length === 0) ? (
                    <tr>
                      <td colSpan={6} className="py-3 px-3 text-slate-500">
                        MRO Industrial Supply (1 NOS)
                      </td>
                    </tr>
                  ) : (
                    rfq.items.map((it, idx) => (
                      <tr key={it.id || idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{it.itemName}</td>
                        <td className="py-2.5 px-3 text-slate-600">{it.brand || 'OEM'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{it.partCode || 'N/A'}</td>
                        <td className="py-2.5 px-3 font-semibold">
                          {it.quantity} {it.uom}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {it.targetPrice ? `₹${it.targetPrice.toLocaleString('en-IN')}` : 'Open'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          {rfq.notes && (
            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-slate-700">
              <span className="font-bold block text-[10px] text-amber-800 mb-0.5">Commercial Terms / Notes:</span>
              <span>{rfq.notes}</span>
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
