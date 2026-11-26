import React, { useState } from 'react';
import { X, Send, CheckSquare, Square, Building, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface VendorEnquiryModalProps {
  requirementId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const VendorEnquiryModal: React.FC<VendorEnquiryModalProps> = ({
  requirementId,
  isOpen,
  onClose,
}) => {
  const { requirements, vendors, sendVendorEnquiry } = useApp();

  const req = requirements.find((r) => r.id === requirementId) || requirements[0];
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>(() => {
    // If requirement items have assigned vendor from AI matching, pre-select them!
    const autoVendors = req?.items
      ?.map((it: any) => it.assignedVendorId)
      ?.filter((id: any): id is string => Boolean(id)) || [];
    if (autoVendors.length > 0) {
      return Array.from(new Set(autoVendors));
    }
    return vendors.slice(0, 2).map((v) => v.id);
  });
  const [notes, setNotes] = useState('Please quote your most competitive reseller price, GST, freight, and delivery schedule.');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !req) return null;

  const toggleVendor = (id: string) => {
    setSelectedVendorIds((prev) =>
      prev.includes(id) ? prev.filter((vId) => vId !== id) : [...prev, id]
    );
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedVendorIds.length === 0 || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await sendVendorEnquiry(req.id, selectedVendorIds, notes);
      onClose();
    } catch (err: any) {
      console.error('[VendorEnquiryModal] Error sending RFQ:', err);
      setErrorMessage(err.message || 'Failed to send and persist RFQ. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-white">Create Vendor Enquiry (RFQ)</h3>
            <p className="text-xs text-slate-400">
              Stage 2 of 12: Blast enquiry to certified vendors to collect competitive rates
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSend} className="p-6 space-y-4">
          {/* Requirement Info */}
          <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-200 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-blue-950 font-mono text-sm">{req.id}</span>
              <span className="text-slate-500 font-medium">Customer: <strong>{req.customerName}</strong></span>
            </div>
            <div className="text-slate-600 mt-1">
              Required Delivery Date: <strong>{req.requiredDeliveryDate}</strong>
            </div>
            <div className="mt-2 text-slate-700">
              <span className="font-semibold">Items ({req.items.length}): </span>
              {req.items.map((i) => `${i.itemName} (${i.quantity} ${i.uom})`).join(', ')}
            </div>
          </div>

          {/* Vendors Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Select One or Multiple Vendors to Request Quotes ({selectedVendorIds.length} selected)
            </label>
            <div className="space-y-2 max-h-56 overflow-y-auto p-1">
              {vendors.map((vendor) => {
                const isChecked = selectedVendorIds.includes(vendor.id);
                return (
                  <div
                    key={vendor.id}
                    onClick={() => toggleVendor(vendor.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      isChecked
                        ? 'border-blue-500 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                      <div>
                        <div className="font-bold text-xs text-slate-900">{vendor.companyName}</div>
                        <div className="text-[11px] text-slate-500">
                          Contact: {vendor.contactPerson} • {vendor.city} • Brands: {vendor.brandsSupplied.join(', ')}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      ★ {vendor.rating}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Enquiry Instructions */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Enquiry Instructions / RFQ Terms
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
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
              disabled={selectedVendorIds.length === 0 || isSubmitting}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Committing to Database...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send RFQ & Notify Vendors</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
