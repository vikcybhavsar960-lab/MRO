import React, { useState, useMemo } from 'react';
import { X, Copy, AlertTriangle, Check, ArrowRight, Layers, Search, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ProductItem } from '../../types';
import { generateDuplicateKey, normalizeText } from '../../services/catalogImportEngine';

interface DuplicateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DuplicateReviewModal: React.FC<DuplicateReviewModalProps> = ({ isOpen, onClose }) => {
  const { products, deleteProduct } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  const activeProducts = useMemo(() => {
    return products.filter((p) => !p.isDeleted);
  }, [products]);

  // Group products by duplicate key or similar part numbers to detect potential duplicates
  const duplicateGroups = useMemo(() => {
    const map = new Map<string, ProductItem[]>();

    activeProducts.forEach((p) => {
      const partKey = `${normalizeText(p.brand)}::${normalizeText(p.partNumber)}`;
      if (!p.partNumber) return;
      if (!map.has(partKey)) {
        map.set(partKey, []);
      }
      map.get(partKey)!.push(p);
    });

    const groups: Array<{ key: string; items: ProductItem[] }> = [];
    map.forEach((items, key) => {
      if (items.length > 1) {
        groups.push({ key, items });
      }
    });

    return groups;
  }, [activeProducts]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-indigo-950">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Catalogue Duplicate Detection & Cleanliness Review</h2>
              <p className="text-xs text-slate-400">
                Audit and resolve any overlapping OEM part numbers or duplicate brand catalogue entries.
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {duplicateGroups.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Check className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-800">Catalogue Integrity Verified</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No duplicate Part Codes detected in your active catalogue master. The database is clean and unique.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Found <strong>{duplicateGroups.length}</strong> Part Number conflict groups in the catalogue master. Review and archive redundant records to prevent quoting ambiguity.
                </span>
              </div>

              {duplicateGroups.map((grp, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-700 font-mono">
                      Conflicting Key: {grp.key}
                    </span>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold">
                      {grp.items.length} Duplicate Records
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {grp.items.map((prod) => (
                      <div key={prod.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-indigo-700 font-bold">{prod.id}</span>
                          <span className="text-slate-400 font-mono text-[10px]">{prod.createdAt?.split('T')[0] || '-'}</span>
                        </div>
                        <div className="font-bold text-slate-900">{prod.itemName}</div>
                        <div className="text-slate-600 text-[11px]">{prod.description || '-'}</div>
                        <div className="flex items-center gap-2 pt-1 font-mono text-[11px]">
                          <span>MRP: ₹{prod.mrp || 0}</span>
                          <span>•</span>
                          <span className="text-emerald-700 font-bold">Rate: ₹{prod.netPurchaseRate || prod.approxRate || 0}</span>
                        </div>
                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => deleteProduct(prod.id)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-semibold"
                          >
                            Archive This Duplicate
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
