import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  TrendingUp,
  TrendingDown,
  Calendar,
  Layers,
  ShieldCheck,
  Tag,
  Building2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { RateVersionHistory } from '../../types/catalogImport';
import { useApp } from '../../context/AppContext';

interface RateHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  partCode: string;
  brand?: string;
  productName?: string;
  currentMrp?: number;
  currentPurchaseRate?: number;
}

export const RateHistoryModal: React.FC<RateHistoryModalProps> = ({
  isOpen,
  onClose,
  partCode,
  brand,
  productName,
  currentMrp,
  currentPurchaseRate,
}) => {
  const { fetchRateHistory } = useApp();
  const [history, setHistory] = useState<RateVersionHistory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && partCode) {
      setLoading(true);
      fetchRateHistory(partCode, brand)
        .then((data) => setHistory(data))
        .catch(() => setHistory([]))
        .finally(() => setLoading(false));
    }
  }, [isOpen, partCode, brand]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-indigo-600/30 border border-indigo-500/40 rounded-xl text-indigo-400">
              <History className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                Rate Version History
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 border border-slate-700">
                  {partCode}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Chronological year-over-year commercial rate tracking and audit trail
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Summary Header */}
        <div className="bg-slate-50 px-6 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <span className="text-slate-500">Brand: </span>
            <span className="font-bold text-slate-900 mr-4">{brand || 'OEM'}</span>
            <span className="text-slate-500">Product: </span>
            <span className="font-medium text-slate-800">{productName || partCode}</span>
          </div>
          <div className="flex items-center gap-3">
            {currentMrp ? (
              <span className="text-slate-600 font-medium">
                Current MRP: <strong className="text-slate-900 font-bold">₹{currentMrp.toLocaleString('en-IN')}</strong>
              </span>
            ) : null}
            {currentPurchaseRate ? (
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-bold">
                Net Rate: ₹{currentPurchaseRate.toLocaleString('en-IN')}
              </span>
            ) : null}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs">Loading rate history...</div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No historical rate versions found for {partCode}. Current rate is the initial baseline.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                All Catalogue Revisions ({history.length} versions)
              </div>

              <div className="space-y-3">
                {history.map((rev, idx) => {
                  const isCurrent = rev.status === 'CURRENT';
                  const isUp = (rev.deltaAmount || 0) > 0;
                  const isDown = (rev.deltaAmount || 0) < 0;

                  return (
                    <div
                      key={rev.id || idx}
                      className={`p-4 rounded-xl border transition-all ${
                        isCurrent
                          ? 'bg-indigo-50/50 border-indigo-200 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 font-mono">
                            {rev.catalogueVersion}
                          </span>
                          <span
                            className={`text-2xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              isCurrent
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {isCurrent ? 'Current Live Rate' : 'Historical Archive'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            Effective: <strong>{rev.effectiveDate || '2026-08-01'}</strong>
                            {rev.validTo ? ` to ${rev.validTo}` : ' to Present'}
                          </span>
                        </div>
                      </div>

                      {/* Pricing Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2 px-3 bg-white/80 rounded-lg border border-slate-100 text-xs">
                        <div>
                          <div className="text-2xs text-slate-500">MRP</div>
                          <div className="font-bold text-slate-900">₹{(rev.mrp || 0).toLocaleString('en-IN')}</div>
                        </div>
                        <div>
                          <div className="text-2xs text-slate-500">Standard Discount</div>
                          <div className="font-semibold text-slate-700">{rev.discountPercent || 20}%</div>
                        </div>
                        <div>
                          <div className="text-2xs text-slate-500">Net Purchase Rate</div>
                          <div className="font-bold text-emerald-600">
                            ₹{(rev.purchaseRate || 0).toLocaleString('en-IN')}
                          </div>
                        </div>
                        <div>
                          <div className="text-2xs text-slate-500">Revision Delta</div>
                          {rev.deltaAmount ? (
                            <div
                              className={`flex items-center gap-1 font-bold ${
                                isUp ? 'text-rose-600' : isDown ? 'text-emerald-600' : 'text-slate-600'
                              }`}
                            >
                              {isUp ? (
                                <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
                              ) : isDown ? (
                                <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
                              ) : null}
                              <span>
                                {isUp ? '+' : ''}₹{rev.deltaAmount} ({rev.deltaPercent}%)
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-medium">Baseline</span>
                          )}
                        </div>
                      </div>

                      {rev.remarks && (
                        <div className="text-2xs text-slate-500 mt-2 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{rev.remarks}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Price Snapshot Immutability Guarantee */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-2xs leading-relaxed">
                  <span className="font-bold text-blue-950">Strict Transaction Snapshot Guarantee: </span>
                  Existing RFQs, Quotations, and Purchase Orders generated under previous catalogue versions retain
                  their immutable price snapshots. Updating or uploading a new catalogue will never change the prices of
                  past transactions.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
