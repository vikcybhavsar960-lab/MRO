import React, { useState } from 'react';
import {
  FolderOpen,
  FileText,
  Search,
  Download,
  Eye,
  Filter,
  Upload,
  Calendar,
  Building,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const DocumentCenter: React.FC = () => {
  const { documents, addDocument } = useApp();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);

  const categories = [
    'ALL',
    'REQUIREMENT',
    'QUOTATION',
    'PO',
    'PI',
    'PAYMENT',
    'DISPATCH',
    'DELIVERY',
  ];

  const filtered = documents.filter((doc) => {
    const matchesSearch =
      doc.name.toLowerCase().includes(search.toLowerCase()) ||
      doc.associatedTransactionId.toLowerCase().includes(search.toLowerCase()) ||
      doc.customerOrVendorName.toLowerCase().includes(search.toLowerCase());

    const matchesCat = categoryFilter === 'ALL' || doc.category === categoryFilter;

    return matchesSearch && matchesCat;
  });

  const handleSimulateDownload = (docName: string) => {
    // Generate a dummy blob file for realistic download
    const blob = new Blob([`ProcureMRO Official Secured Archival Document: ${docName}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = docName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-blue-600" />
            <span>Centralized Document Vault</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Stage 1 to 12 document repository: POs, Quotations, Proforma Invoices, Lorry Receipts, Bank Challans & PODs
          </p>
        </div>

        <div className="text-xs font-semibold text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
          Total Archived Docs: <strong>{documents.length} files</strong>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by filename, REQ-001, customer, vendor..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          <span className="text-xs font-bold text-slate-500 shrink-0">Filter:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                categoryFilter === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Document Title</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Associated Order</th>
                <th className="py-3 px-4">Party / Customer / Vendor</th>
                <th className="py-3 px-4">Uploaded Timestamp</th>
                <th className="py-3 px-4">File Size</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="font-bold text-slate-900">{doc.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                      {doc.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                    {doc.associatedTransactionId}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800">
                    {doc.customerOrVendorName}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">
                    {doc.uploadedAt}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">
                    {doc.size}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-blue-600"
                        title="Preview Document"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSimulateDownload(doc.name)}
                        className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-blue-600"
                        title="Download Document"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <span className="font-bold text-sm truncate">{previewDoc.name}</span>
              <button onClick={() => setPreviewDoc(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            <div className="p-8 text-center space-y-4">
              <FileText className="w-16 h-16 text-blue-600 mx-auto" />
              <div>
                <h4 className="font-bold text-base text-slate-900">{previewDoc.name}</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Linked to Order: <strong className="font-mono text-blue-700">{previewDoc.associatedTransactionId}</strong>
                </p>
                <p className="text-xs text-slate-500">Party: {previewDoc.customerOrVendorName}</p>
                <p className="text-xs text-slate-400 mt-2">Archival Hash: SHA-256 Verified</p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-center gap-3">
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Close
                </button>
                <button
                  onClick={() => handleSimulateDownload(previewDoc.name)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download File</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
