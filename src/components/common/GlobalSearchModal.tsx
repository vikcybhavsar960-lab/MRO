import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  FileText,
  Building,
  CreditCard,
  Truck,
  ArrowRight,
  PackageCheck,
  Receipt,
  ShoppingCart,
  Layers,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOrder: (orderId: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectOrder,
}) => {
  const {
    requirements,
    customerQuotations,
    customerPOs,
    vendorPOs,
    proformaInvoices,
    dispatches,
    customers,
    vendors,
    products,
    categories,
    brands,
    rfqs,
    setActiveTab,
  } = useApp();

  const [query, setQuery] = useState('');

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();

    const results: Array<{
      type: string;
      title: string;
      subtitle: string;
      refId: string;
      tab: string;
      badge: string;
    }> = [];

    const has = (val: unknown) => String(val || '').toLowerCase().includes(q);
    const hasRaw = (val: unknown) => String(val || '').includes(q);

    // Search Requirements & Items
    (requirements || []).forEach((req) => {
      const matchReq =
        has(req.id) ||
        has(req.customerName) ||
        has(req.contactPerson) ||
        hasRaw(req.customerMobile);

      const matchedItem = (req.items || []).find(
        (it) => has(it.itemName) || has(it.partNumber) || has(it.brand)
      );

      if (matchReq || matchedItem) {
        results.push({
          type: 'REQUIREMENT',
          title: `${req.id} • ${req.customerName || 'Customer'}`,
          subtitle: matchedItem
            ? `Matched item: ${matchedItem.itemName || ''} (${matchedItem.partNumber || ''})`
            : `${(req.items || []).length} items • Status: ${req.status || 'OPEN'}`,
          refId: req.id,
          tab: 'requirements',
          badge: req.status || 'OPEN',
        });
      }
    });

    // Search Quotations
    (customerQuotations || []).forEach((qtn) => {
      if (
        has(qtn.id) ||
        has(qtn.customerName) ||
        (qtn.items || []).some((i) => has(i.itemName) || has(i.partNumber))
      ) {
        results.push({
          type: 'QUOTATION',
          title: `${qtn.id} • ${qtn.customerName || ''}`,
          subtitle: `Total: ₹${(qtn.grandTotal || 0).toLocaleString('en-IN')} (Ref: ${qtn.requirementId || ''})`,
          refId: qtn.requirementId || qtn.id,
          tab: 'quotations',
          badge: qtn.status || 'DRAFT',
        });
      }
    });

    // Search Customer POs
    (customerPOs || []).forEach((cpo) => {
      if (has(cpo.id) || has(cpo.customerPoNumber) || has(cpo.customerName)) {
        results.push({
          type: 'CUSTOMER PO',
          title: `${cpo.id} • ${cpo.customerPoNumber || ''}`,
          subtitle: `${cpo.customerName || ''} • Amount: ₹${(cpo.poAmount || 0).toLocaleString('en-IN')}`,
          refId: cpo.requirementId || cpo.id,
          tab: 'customer-pos',
          badge: 'PO RECEIVED',
        });
      }
    });

    // Search Vendor POs
    (vendorPOs || []).forEach((vpo) => {
      if (
        has(vpo.id) ||
        has(vpo.vendorName) ||
        (vpo.items || []).some((i) => has(i.itemName) || has(i.partNumber))
      ) {
        results.push({
          type: 'VENDOR PO',
          title: `${vpo.id} • ${vpo.vendorName || ''}`,
          subtitle: `Value: ₹${(vpo.totalAmount || 0).toLocaleString('en-IN')} (Ref: ${vpo.requirementId || ''})`,
          refId: vpo.requirementId || vpo.id,
          tab: 'vendor-pos',
          badge: 'ORDER PLACED',
        });
      }
    });

    // Search Proforma Invoices
    (proformaInvoices || []).forEach((pi) => {
      if (has(pi.id) || has(pi.piNumber) || has(pi.vendorName)) {
        results.push({
          type: 'PROFORMA INVOICE',
          title: `${pi.id} • ${pi.piNumber || ''}`,
          subtitle: `Vendor: ${pi.vendorName || ''} • ₹${(pi.totalAmount || 0).toLocaleString('en-IN')}`,
          refId: pi.requirementId || pi.id,
          tab: 'pi',
          badge: 'PI RECEIVED',
        });
      }
    });

    // Search Dispatches & Tracking / LR
    (dispatches || []).forEach((dsp) => {
      if (
        has(dsp.id) ||
        has(dsp.vendorInvoiceNumber) ||
        has(dsp.lrNumber) ||
        has(dsp.awbNumber) ||
        has(dsp.trackingNumber) ||
        has(dsp.transporter)
      ) {
        results.push({
          type: 'DISPATCH',
          title: `${dsp.id} • LR: ${dsp.lrNumber || ''}`,
          subtitle: `${dsp.transporter || ''} • Inv: ${dsp.vendorInvoiceNumber || ''} • Ref: ${dsp.requirementId || ''}`,
          refId: dsp.requirementId || dsp.id,
          tab: 'dispatch',
          badge: 'DISPATCHED',
        });
      }
    });

    // Search RFQs / Enquiries
    (rfqs || []).forEach((rfq) => {
      const matchRfq = has(rfq.id) || has(rfq.requirementId) || has(rfq.notes);

      if (matchRfq) {
        results.push({
          type: 'RFQ / ENQUIRY',
          title: `${rfq.id}`,
          subtitle: `Req Ref: ${rfq.requirementId || ''} • Sent to ${(rfq.vendorIds || []).length} vendor(s) • ${rfq.sentDate || ''}`,
          refId: rfq.requirementId || rfq.id,
          tab: 'requirements',
          badge: rfq.status || 'SENT',
        });
      }
    });

    // Search Products Master & Catalogue Items
    (products || []).forEach((prod) => {
      if (
        has(prod.itemName) ||
        has(prod.partNumber) ||
        has(prod.brand) ||
        has(prod.modelNumber) ||
        has(prod.manufacturerCode)
      ) {
        results.push({
          type: 'PRODUCT MASTER',
          title: `${prod.itemName || 'Product'} (${prod.brand || 'OEM'})`,
          subtitle: `Part #: ${prod.partNumber || prod.modelNumber || '—'} • Category: ${prod.category || 'General'} • Rate: ₹${prod.approxRate || 0}`,
          refId: prod.id,
          tab: 'brands',
          badge: prod.uom || 'NOS',
        });
      }
    });

    // Search Brands Master
    (brands || []).forEach((b) => {
      const matchBrand =
        has(b.name) ||
        has(b.code) ||
        (b.aliases || []).some((a) => has(a)) ||
        has(b.category) ||
        (b.categories || []).some((c: string) => has(c));

      if (matchBrand) {
        results.push({
          type: 'BRAND MASTER',
          title: `${b.name}${b.code ? ` (${b.code})` : ''}`,
          subtitle: `Origin: ${b.countryOfOrigin || 'Global'} • Type: ${b.brandType || 'GLOBAL_OEM'} • Category: ${b.category || (b.categories || []).join(', ') || 'Industrial MRO'}`,
          refId: b.id,
          tab: 'brands',
          badge: b.status || (b.isActive ? 'ACTIVE' : 'INACTIVE'),
        });
      }
    });

    // Search Customers
    (customers || []).forEach((c) => {
      if (has(c.companyName) || has(c.contactPerson) || hasRaw(c.mobile) || has(c.gstin)) {
        results.push({
          type: 'CUSTOMER',
          title: `${c.companyName || ''}`,
          subtitle: `Contact: ${c.contactPerson || ''} (${c.mobile || ''}) • GSTIN: ${c.gstin || '—'}`,
          refId: c.id,
          tab: 'customers',
          badge: c.city || 'India',
        });
      }
    });

    // Search Material Categories
    (categories || []).forEach((cat) => {
      const kws = cat.keywords || [];
      const subCats = cat.subCategories || [];
      const matchName = has(cat.name) || has(cat.code);
      const matchKeyword = kws.some((k) => has(k));
      const matchSub = subCats.some((sc) => has(sc));

      if (matchName || matchKeyword || matchSub) {
        results.push({
          type: 'MATERIAL CATEGORY',
          title: `${cat.name}${cat.code ? ` (${cat.code})` : ''}`,
          subtitle: matchKeyword
            ? `Matched keyword in ${kws.length} keywords • ${subCats.length} sub-types`
            : cat.description || 'Industrial material taxonomy',
          refId: cat.id,
          tab: 'categories',
          badge: 'TAXONOMY',
        });
      }
    });

    // Search Vendors & Vendor Intelligence
    (vendors || []).forEach((v) => {
      if (v.isDeleted) return;
      const vCats = v.materialCategories && v.materialCategories.length > 0 ? v.materialCategories : v.productCategories || [];
      const vBrands = Array.from(new Set([...(v.brandsSupplied || []), ...(v.brandsDealing || [])]));
      const vFamilies = v.productFamilies || [];
      const matchCategory = vCats.some((c) => has(c));
      const matchFamily = vFamilies.some((f) => has(f));
      const matchBrand = vBrands.some((b) => has(b));
      const matchSupplyHistory = (v.supplyHistory || []).some((sh) => has(sh.itemName));
      const matchedCatalogProd = (v.catalogProducts || []).find(
        (cp) =>
          has(cp.productName) ||
          has(cp.partNumber) ||
          has(cp.modelNumber) ||
          has(cp.brand) ||
          has(cp.specification) ||
          has(cp.productFamily)
      );

      if (
        has(v.companyName) ||
        has(v.legalName) ||
        has(v.website) ||
        has(v.contactPerson) ||
        hasRaw(v.mobile) ||
        matchBrand ||
        matchCategory ||
        matchFamily ||
        matchSupplyHistory ||
        !!matchedCatalogProd
      ) {
        const rateInfo = matchedCatalogProd
          ? matchedCatalogProd.purchaseRate || matchedCatalogProd.rate || matchedCatalogProd.mrp
          : undefined;
        results.push({
          type: matchedCatalogProd ? 'VENDOR CATALOG ITEM' : 'VENDOR',
          title: matchedCatalogProd
            ? `${v.companyName} → ${matchedCatalogProd.productName}${matchedCatalogProd.partNumber ? ` (${matchedCatalogProd.partNumber})` : ''}`
            : `${v.companyName}`,
          subtitle: matchedCatalogProd
            ? `Brand: ${matchedCatalogProd.brand} • ${matchedCatalogProd.category}${rateInfo ? ` • Rate ₹${rateInfo}` : ''} • Source: ${matchedCatalogProd.catalogReference || matchedCatalogProd.catalogFileName || 'Catalogue'}`
            : matchCategory
            ? `Supplies: ${vCats.join(', ')} • Brands: ${vBrands.slice(0, 4).join(', ')}`
            : matchFamily
            ? `Product Families: ${vFamilies.join(', ')}`
            : matchSupplyHistory
            ? `Supplied item matching "${q}" in past transactions`
            : `Contact: ${v.contactPerson} • Brands: ${vBrands.join(', ')}`,
          refId: v.id,
          tab: 'vendors',
          badge: v.intelligenceScore ? `IQ ${v.intelligenceScore}/100` : `★ ${v.rating}`,
        });
      }
    });

    return results;
  }, [query, requirements, customerQuotations, customerPOs, vendorPOs, proformaInvoices, dispatches, products, customers, vendors, categories, brands, rfqs]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global Enterprise Search"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
          <Search className="w-5 h-5 text-blue-600 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type Part # (e.g. 30205), Order (REQ-001), LR, Customer, Vendor, Invoice..."
            className="w-full text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden"
            autoFocus
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold px-2 py-1 text-slate-500 hover:bg-slate-100 rounded-md"
          >
            ESC
          </button>
        </div>

        {/* Quick query chips */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto text-[11px] text-slate-500">
          <span className="font-semibold text-slate-600 shrink-0">Try searching:</span>
          {['30205', 'Tata Steel', 'Apex', 'REQ-2026-00001', 'Siemens', 'VTR889124'].map((term) => (
            <button
              type="button"
              key={term}
              onClick={() => setQuery(term)}
              className="px-2 py-0.5 rounded-full bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 shrink-0 font-medium transition-colors"
            >
              {term}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 p-2">
          {query.trim() === '' ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Type any keyword to search across the entire supply chain enterprise database
            </div>
          ) : searchResults.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No matching records found for "{query}". Try checking the spelling or part number.
            </div>
          ) : (
            searchResults.map((item, idx) => (
              <button
                type="button"
                key={idx}
                onClick={() => {
                  setActiveTab(item.tab);
                  if (item.refId && item.refId.startsWith('REQ-')) {
                    onSelectOrder(item.refId);
                  }
                  onClose();
                }}
                className="w-full text-left p-3 rounded-xl hover:bg-blue-50/60 cursor-pointer flex items-center justify-between group transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-blue-600 group-hover:text-white text-slate-600 flex items-center justify-center shrink-0 transition-colors">
                    {item.type.includes('REQ') ? (
                      <FileText className="w-4 h-4" />
                    ) : item.type.includes('PO') ? (
                      <ShoppingCart className="w-4 h-4" />
                    ) : item.type.includes('DISPATCH') ? (
                      <Truck className="w-4 h-4" />
                    ) : item.type.includes('PRODUCT') ? (
                      <Layers className="w-4 h-4" />
                    ) : (
                      <Building className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">{item.title}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 uppercase">
                        {item.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {item.badge}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
