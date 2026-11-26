import React, { useState } from 'react';
import {
  X,
  Building,
  Star,
  Phone,
  Mail,
  MapPin,
  Clock,
  History,
  Plus,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  FileCheck2,
  Tag,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CustomerRequirement, RequirementItem, Vendor, VendorRecommendation } from '../../types';
import { recommendVendorsForRequirement } from '../../services/categoryMatchingService';

interface RelevantVendorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirement?: CustomerRequirement | null;
  item?: RequirementItem | null;
  onCreateQuotation?: (reqId: string, vendorId: string) => void;
}

export const RelevantVendorsModal: React.FC<RelevantVendorsModalProps> = ({
  isOpen,
  onClose,
  requirement,
  item,
  onCreateQuotation,
}) => {
  const { vendors, requirements, setActiveTab, pushNotification, categories, assignVendorToRequirementItem } = useApp();

  const [selectedVendorForRemark, setSelectedVendorForRemark] = useState<string | null>(null);
  const [remarkText, setRemarkText] = useState('');
  const [vendorRemarks, setVendorRemarks] = useState<Record<string, string>>({});
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(item?.selectedVendorId || null);

  if (!isOpen) return null;

  const targetItem: RequirementItem | undefined = item || requirement?.items[0];
  const reqCategory = targetItem?.category || targetItem?.recommendedCategory || 'Bearings';
  const subCategory = targetItem?.subCategory;
  const itemName = targetItem?.itemName || '';

  // Get ranked recommendations
  const recommendations: VendorRecommendation[] = recommendVendorsForRequirement(
    {
      category: reqCategory,
      subCategory,
      itemName,
      description: targetItem?.description || targetItem?.specification,
    },
    vendors,
    requirements
  );

  const handleSelectVendor = (v: VendorRecommendation) => {
    setSelectedVendorId(v.vendorId);
    if (requirement && targetItem) {
      assignVendorToRequirementItem(requirement.id, targetItem.id, v.vendorId, v.vendorName);
    } else {
      pushNotification(
        'Vendor Selected',
        `${v.vendorName} selected as designated supplier.`,
        'SUCCESS',
        ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']
      );
    }
  };

  const handleSaveRemark = (vendorId: string) => {
    if (!remarkText.trim()) return;
    setVendorRemarks((prev) => ({
      ...prev,
      [vendorId]: remarkText.trim(),
    }));
    setSelectedVendorForRemark(null);
    setRemarkText('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-5 sm:p-6 space-y-5 shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <Building className="w-5 h-5" />
              </span>
              <h3 className="font-bold text-lg text-slate-900 tracking-tight">
                Relevant Vendor Recommendations & Matching Engine
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Automated ranking based on registered material categories, brand certifications, and previous supply history
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Requirement Summary Card */}
        {targetItem && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-blue-700">{requirement?.id || 'REQ-ACTIVE'}</span>
                <span className="font-bold text-slate-900 text-sm">{targetItem.itemName}</span>
                {requirement?.priority && (
                  <span
                    className={`px-2 py-0.2 rounded text-[10px] font-bold uppercase ${
                      requirement.priority === 'High'
                        ? 'bg-rose-100 text-rose-700'
                        : requirement.priority === 'Low'
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {requirement.priority} Priority
                  </span>
                )}
              </div>
              <div className="text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Quantity: <strong className="text-slate-800">{targetItem.quantity} {targetItem.uom}</strong></span>
                <span>Customer: <strong className="text-slate-800">{requirement?.customerName || 'Tata Steel'}</strong></span>
                <span>Delivery By: <strong className="text-slate-800 font-mono">{targetItem.requiredDeliveryDate || requirement?.requiredDeliveryDate}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-medium block">Recommended Category</span>
                <span className="px-2.5 py-1 bg-blue-600 text-white font-bold rounded-lg text-xs inline-block">
                  {reqCategory}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Vendors List Body */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {recommendations.length === 0 ? (
            /* Empty State: No Matching Vendor Found */
            <div className="p-8 text-center space-y-4 bg-amber-50/50 rounded-2xl border border-amber-200">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-slate-900">
                  No matching vendor found for category "{reqCategory}".
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  None of your registered suppliers currently have "{reqCategory}" tagged in their Vendor Master profile.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => {
                    onClose();
                    setActiveTab('vendors');
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Vendor in {reqCategory}</span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    setActiveTab('vendors');
                  }}
                  className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors"
                >
                  Map Existing Vendor to {reqCategory}
                </button>
              </div>
            </div>
          ) : (
            recommendations.map((v, index) => {
              const isSelected = selectedVendorId === v.vendorId;
              const hasRemark = vendorRemarks[v.vendorId];

              return (
                <div
                  key={v.vendorId}
                  className={`p-4 rounded-2xl border transition-all text-xs space-y-3 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/30 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {/* Top Bar: Name, Match Badge, Score */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold font-mono text-xs">
                        #{index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900">{v.vendorName}</h4>
                          <span className="font-mono text-[10px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded">
                            {v.vendorId}
                          </span>
                          {isSelected && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              <span>Selected Supplier</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>{v.contactPerson}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {v.city}, {v.state}
                          </span>
                          <span>•</span>
                          <span className="font-bold text-amber-600 flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            {v.rating} / 5.0
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                          v.matchLevel === 'High'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : v.matchLevel === 'Medium'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>{v.matchLevel} Match ({v.matchScore}%)</span>
                      </span>
                    </div>
                  </div>

                  {/* Match Reasons Pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {v.matchReasons.map((reason, rIdx) => (
                      <span
                        key={rIdx}
                        className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200 flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        <span>{reason}</span>
                      </span>
                    ))}
                  </div>

                  {/* Material Categories Pills */}
                  <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                    <span className="text-slate-400 font-medium">Categories:</span>
                    {v.materialCategories.map((c, cIdx) => (
                      <span
                        key={cIdx}
                        className={`px-1.5 py-0.2 rounded text-[10px] ${
                          c.toLowerCase() === reqCategory.toLowerCase()
                            ? 'bg-blue-100 text-blue-800 font-bold border border-blue-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {c}
                      </span>
                    ))}
                  </div>

                  {/* Previous Supply History Highlight */}
                  {v.previousSupplyCount > 0 && (
                    <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-emerald-700" />
                        <span>
                          Past Supplier: Successfully fulfilled <strong>{v.previousSupplyCount} past order(s)</strong> in this category.
                        </span>
                      </div>
                      {v.lastQuotedPrice && (
                        <span className="font-mono font-bold text-emerald-800">
                          Last Rate: ₹{v.lastQuotedPrice.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Saved User Remark */}
                  {hasRemark && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-start gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Buyer Note:</strong> {hasRemark}
                      </div>
                    </div>
                  )}

                  {/* Bottom Contact & Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3 text-slate-600 text-[11px]">
                      <a
                        href={`tel:${v.mobile}`}
                        className="flex items-center gap-1 text-slate-700 hover:text-blue-600 font-medium"
                      >
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{v.mobile}</span>
                      </a>
                      <a
                        href={`mailto:${v.email}?subject=RFQ Enquiry: ${targetItem?.itemName || 'Industrial Spares'}`}
                        className="flex items-center gap-1 text-slate-700 hover:text-blue-600 font-medium"
                      >
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{v.email}</span>
                      </a>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => {
                          if (onCreateQuotation && requirement) {
                            onCreateQuotation(requirement.id, v.vendorId);
                            onClose();
                          } else {
                            setActiveTab('quotations');
                            onClose();
                          }
                        }}
                        className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                        title="Create quotation referencing this vendor"
                      >
                        <FileCheck2 className="w-3.5 h-3.5" />
                        <span>Quotation</span>
                      </button>

                      <button
                        onClick={() => handleSelectVendor(v)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-900 hover:bg-black text-white'
                        }`}
                      >
                        {isSelected ? 'Assigned' : 'Select Vendor'}
                      </button>

                      <button
                        onClick={() => {
                          setSelectedVendorForRemark(v.vendorId);
                          setRemarkText(vendorRemarks[v.vendorId] || '');
                        }}
                        className="px-2 py-1 text-slate-500 hover:text-slate-900 rounded-lg text-xs font-medium"
                        title="Add procurement remark"
                      >
                        + Remark
                      </button>
                    </div>
                  </div>

                  {/* Inline Remark Box */}
                  {selectedVendorForRemark === v.vendorId && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 mt-2">
                      <label className="font-bold text-[11px] text-slate-700">Add Internal Procurement Note</label>
                      <input
                        type="text"
                        value={remarkText}
                        onChange={(e) => setRemarkText(e.target.value)}
                        placeholder="e.g. Quoted ₹380 on phone, ready stock in Pune godown..."
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900"
                        autoFocus
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedVendorForRemark(null)}
                          className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded-md text-[11px] font-bold"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveRemark(v.vendorId)}
                          className="px-3 py-1 bg-blue-600 text-white rounded-md text-[11px] font-bold"
                        >
                          Save Note
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            Found <strong>{recommendations.length} matching vendor(s)</strong> for this item
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
