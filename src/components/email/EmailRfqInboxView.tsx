import React, { useState } from 'react';
import {
  Mail,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  Building,
  User,
  ArrowRight,
  ExternalLink,
  Plus,
  Settings,
  Paperclip,
  Check,
  Eye,
  Trash2,
  Calendar,
  Sparkles,
  Inbox,
  AlertCircle,
  Copy,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EmailRfqItem, ExtractedEmailItem } from '../../types';
import {
  loadEmailRfqs,
  saveEmailRfqs,
  loadEmailConfig,
  saveEmailConfig,
  appendSyncLog,
  parseEmailTextToRfq,
} from '../../services/emailRfqService';
import { EmailIntegrationSettingsModal } from './EmailIntegrationSettingsModal';
import { fetchAndSyncGmailMessages } from '../../services/googleAuthService';

interface EmailRfqInboxViewProps {
  onOpenRequirement: (reqId: string) => void;
}

export const EmailRfqInboxView: React.FC<EmailRfqInboxViewProps> = ({ onOpenRequirement }) => {
  const { customers, addRequirement, categories } = useApp();

  const [emailRfqs, setEmailRfqs] = useState<EmailRfqItem[]>(() => loadEmailRfqs());
  const [emailConfig, setEmailConfig] = useState(() => loadEmailConfig());
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Review Draft Modal State
  const [reviewEmail, setReviewEmail] = useState<EmailRfqItem | null>(null);
  const [reviewCustomerId, setReviewCustomerId] = useState<string>('');
  const [reviewReceivedDate, setReviewReceivedDate] = useState<string>('');
  const [reviewExpectedDeliveryDate, setReviewExpectedDeliveryDate] = useState<string>('');
  const [reviewItems, setReviewItems] = useState<ExtractedEmailItem[]>([]);
  const [reviewRemarks, setReviewRemarks] = useState<string>('');

  // Manual Paste Email Modal
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteSubject, setPasteSubject] = useState('');
  const [pasteSender, setPasteSender] = useState('');
  const [pasteBody, setPasteBody] = useState('');

  const filteredEmails = emailRfqs.filter((item) => {
    const q = filterText.toLowerCase().trim();
    const matchesQuery =
      !q ||
      item.subject.toLowerCase().includes(q) ||
      item.senderEmail.toLowerCase().includes(q) ||
      item.companyName.toLowerCase().includes(q) ||
      item.detectedItems.some((i) => i.itemName.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncFeedback('Connecting to mailbox and scanning for RFQ emails...');

    try {
      const res = await fetchAndSyncGmailMessages((msg) => setSyncFeedback(msg));
      setEmailRfqs(loadEmailRfqs());
      setEmailConfig(loadEmailConfig());
      setSyncFeedback(res.message);
      setTimeout(() => setSyncFeedback(null), 5000);
    } catch (err: any) {
      setSyncFeedback(err?.message || 'Synchronization failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenReview = (email: EmailRfqItem) => {
    setReviewEmail(email);
    setReviewCustomerId(email.matchedCustomerId || (customers.length > 0 ? customers[0].id : ''));
    setReviewReceivedDate(email.receivedDate || new Date().toISOString().split('T')[0]);
    setReviewExpectedDeliveryDate('');
    setReviewItems([...email.detectedItems]);
    setReviewRemarks(`Auto-extracted from email: "${email.subject}" (${email.messageId})`);
  };

  const handleItemChange = (index: number, field: keyof ExtractedEmailItem, val: any) => {
    setReviewItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    setReviewItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveAsRequirement = () => {
    if (!reviewEmail) return;

    const matchedCust = customers.find((c) => c.id === reviewCustomerId) || customers[0];
    if (!matchedCust) {
      alert('Please select or register a customer first.');
      return;
    }

    if (reviewItems.length === 0) {
      alert('At least one line item is required.');
      return;
    }

    // Call addRequirement in AppContext
    const newReq = addRequirement({
      customerId: matchedCust.id,
      customerName: matchedCust.companyName,
      contactPerson: matchedCust.contactPerson || reviewEmail.contactPerson,
      customerEmail: matchedCust.email || reviewEmail.senderEmail,
      customerMobile: matchedCust.mobile || reviewEmail.mobile || '',
      requirementDate: reviewReceivedDate,
      requiredDeliveryDate: reviewReceivedDate, // preserved for backward-compatibility
      receivedRequirementDate: reviewReceivedDate,
      expectedDeliveryDate: reviewExpectedDeliveryDate || undefined,
      priority: 'Medium',
      items: reviewItems.map((item) => ({
        itemName: item.itemName,
        category: item.category || 'General MRO',
        subCategory: item.subCategory,
        partNumber: item.partNumber || '',
        modelNumber: item.modelNumber || '',
        brand: item.brand || '',
        specification: item.specification || '',
        quantity: item.quantity,
        uom: item.uom,
        targetPrice: item.targetPrice,
        requiredDeliveryDate: reviewReceivedDate,
        receivedRequirementDate: reviewReceivedDate,
        expectedDeliveryDate: reviewExpectedDeliveryDate || undefined,
        priority: 'Medium',
      })),
      remarks: reviewRemarks,
    });

    // Update Email RFQ status
    const updated = emailRfqs.map((e) =>
      e.id === reviewEmail.id
        ? {
            ...e,
            status: 'SAVED_AS_RFQ' as const,
            createdRequirementId: newReq.id,
          }
        : e
    );

    setEmailRfqs(updated);
    saveEmailRfqs(updated);
    setReviewEmail(null);

    if (confirm(`Successfully created Customer Requirement ${newReq.id} from email!\n\nWould you like to open this requirement now to enter vendor rates?`)) {
      onOpenRequirement(newReq.id);
    }
  };

  const handleManualPasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteBody.trim()) return;

    const parsed = parseEmailTextToRfq(pasteBody, pasteSubject || 'Customer Inquiry', pasteSender || 'client@industry.com', customers);

    const newEmailItem: EmailRfqItem = {
      id: `EML-${Date.now().toString().slice(-4)}`,
      messageId: `manual-${Date.now()}@mroprocurement.com`,
      senderEmail: pasteSender || 'client@industry.com',
      senderName: parsed.contactPerson || 'Purchasing Executive',
      companyName: parsed.companyName || 'Industrial Client',
      contactPerson: parsed.contactPerson || 'Procurement Incharge',
      mobile: parsed.mobile || '',
      subject: pasteSubject || 'Direct Customer Inquiry via Webmail',
      receivedDate: new Date().toISOString().split('T')[0],
      bodySnippet: pasteBody.slice(0, 160) + '...',
      fullBodyText: pasteBody,
      detectedItems: parsed.items,
      matchedCustomerId: parsed.matchedCustomer?.id,
      status: parsed.items.length > 0 ? 'DRAFT_READY' : 'NEEDS_ATTENTION',
      attachments: [],
      deliveryTerms: parsed.deliveryTerms,
      paymentTerms: parsed.paymentTerms,
      remarks: 'Manually ingested email text for AI RFQ extraction',
    };

    const updated = [newEmailItem, ...emailRfqs];
    setEmailRfqs(updated);
    saveEmailRfqs(updated);

    setIsPasteModalOpen(false);
    setPasteSubject('');
    setPasteSender('');
    setPasteBody('');

    // Open review modal immediately for the new email
    handleOpenReview(newEmailItem);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Email RFQ Inbox</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  ✨ AI Document & Material Extraction
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically reads incoming customer material requirements from business email & prepares RFQ drafts
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsPasteModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
            title="Paste raw email text or inquiry message to parse into RFQ"
          >
            <Copy className="w-4 h-4 text-slate-600" />
            <span>Parse Email Text</span>
          </button>

          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-500/20"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Email Now'}</span>
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
          >
            <Settings className="w-4 h-4 text-slate-300" />
            <span>Email Settings</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <span className="text-slate-400">Connected Account: </span>
            <strong className="text-white font-mono">{emailConfig.emailAddress}</strong>
            <span className="text-slate-400 ml-2">({emailConfig.provider} OAuth)</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-slate-300">
          <div>
            <span className="text-slate-400">Last Sync: </span>
            <span>{emailConfig.lastSyncedAt || 'Active today'}</span>
          </div>
          <div>
            <span className="text-slate-400">Approved Senders: </span>
            <span className="font-semibold">{emailConfig.approvedSenders.length} domains</span>
          </div>
        </div>
      </div>

      {syncFeedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search email subject, customer, sender, material name..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-500 font-medium mr-1">Status:</span>
          {['ALL', 'DRAFT_READY', 'SAVED_AS_RFQ', 'NEEDS_ATTENTION'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL'
                ? 'All Emails'
                : st === 'DRAFT_READY'
                ? 'Draft Ready'
                : st === 'SAVED_AS_RFQ'
                ? 'Saved as RFQ'
                : 'Needs Attention'}
            </button>
          ))}
        </div>
      </div>

      {/* Email Inbox Cards List */}
      <div className="space-y-3">
        {filteredEmails.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500 text-xs">
            <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-700">No email inquiries match the selected criteria.</p>
            <p className="text-slate-400 mt-1">Click "Sync Email Now" or "Parse Email Text" to process incoming customer emails.</p>
          </div>
        ) : (
          filteredEmails.map((email) => {
            const isSaved = email.status === 'SAVED_AS_RFQ';

            return (
              <div
                key={email.id}
                className={`bg-white rounded-2xl border transition-all p-4.5 sm:p-5 flex flex-col gap-3 shadow-xs hover:border-slate-300 ${
                  isSaved ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-700">{email.id}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isSaved
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : email.status === 'DRAFT_READY'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {isSaved
                          ? `Saved as RFQ (${email.createdRequirementId})`
                          : email.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-slate-400 text-xs">•</span>
                      <span className="text-slate-500 text-xs flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Received: <strong>{email.receivedDate}</strong></span>
                      </span>
                    </div>

                    <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                      {email.subject}
                    </h3>

                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                      <span>
                        Sender: <strong className="text-slate-700">{email.senderName}</strong> &lt;{email.senderEmail}&gt;
                      </span>
                      <span>
                        Company: <strong className="text-slate-800">{email.companyName}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Top Right Action Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isSaved && email.createdRequirementId ? (
                      <button
                        onClick={() => onOpenRequirement(email.createdRequirementId!)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>View RFQ #{email.createdRequirementId}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenReview(email)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Review & Convert to RFQ</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Email Body Snippet */}
                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-sans italic">
                  "{email.bodySnippet}"
                </p>

                {/* Detected Material Items Badges */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-slate-700 mr-1">
                      Detected Materials ({email.detectedItems.length}):
                    </span>
                    {email.detectedItems.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-[11px] font-semibold"
                      >
                        <span>{item.itemName}</span>
                        <span className="text-blue-600 font-bold font-mono">({item.quantity} {item.uom})</span>
                        {item.category && (
                          <span className="text-[10px] bg-blue-200/60 text-blue-800 px-1.5 py-0.2 rounded font-bold">
                            {item.category}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>

                  {email.attachments.length > 0 && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                      <span>{email.attachments.length} attachment(s)</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* REVIEW & CONVERT RFQ MODAL */}
      {reviewEmail && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-white">Review & Convert Email to Customer Requirement</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
                    Draft Ready
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Extracted from: <strong className="text-white">{reviewEmail.senderEmail}</strong> • Subject: {reviewEmail.subject}
                </p>
              </div>
              <button
                onClick={() => setReviewEmail(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Customer & Received Date Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Customer Account <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={reviewCustomerId}
                    onChange={(e) => setReviewCustomerId(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName} ({c.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Received Requirement Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={reviewReceivedDate}
                    onChange={(e) => setReviewReceivedDate(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <span className="text-[10px] text-slate-500">Actual email timestamp date</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Expected Delivery Date <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    value={reviewExpectedDeliveryDate}
                    onChange={(e) => setReviewExpectedDeliveryDate(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                  />
                  <span className="text-[10px] text-slate-500">Target plant delivery if specified</span>
                </div>
              </div>

              {/* Line Items List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm text-slate-900">Extracted Line Items ({reviewItems.length})</h4>
                  <span className="text-[11px] text-slate-500">Edit or verify item specs, categories, quantities</span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Item Description</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Brand / Spec</th>
                        <th className="py-2.5 px-2 text-center">Qty</th>
                        <th className="py-2.5 px-2">UOM</th>
                        <th className="py-2.5 px-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reviewItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={item.itemName}
                              onChange={(e) => handleItemChange(idx, 'itemName', e.target.value)}
                              className="w-full p-1 border border-slate-300 rounded font-bold text-slate-900 text-xs"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={item.category || ''}
                              onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                              className="p-1 border border-slate-300 rounded text-xs bg-white font-medium"
                            >
                              <option value="">Select Category...</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.name}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={item.specification || item.brand || ''}
                              onChange={(e) => handleItemChange(idx, 'specification', e.target.value)}
                              placeholder="Brand / Spec"
                              className="w-full p-1 border border-slate-300 rounded text-xs"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                              className="w-16 p-1 border border-slate-300 rounded text-center font-bold text-xs"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <select
                              value={item.uom}
                              onChange={(e) => handleItemChange(idx, 'uom', e.target.value)}
                              className="p-1 border border-slate-300 rounded text-xs bg-white"
                            >
                              <option value="NOS">NOS</option>
                              <option value="SET">SET</option>
                              <option value="KG">KG</option>
                              <option value="MTR">MTR</option>
                              <option value="LTR">LTR</option>
                              <option value="PKT">PKT</option>
                            </select>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Remarks & Source Reference</label>
                <textarea
                  rows={2}
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">
                All extracted data preserved with complete audit reference to original email.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReviewEmail(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAsRequirement}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Create Official Customer Requirement</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL PASTE EMAIL MODAL */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-4.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Copy className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-base text-white">Parse Customer Email Text into RFQ</h3>
              </div>
              <button
                onClick={() => setIsPasteModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualPasteSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer / Sender Email</label>
                <input
                  type="email"
                  value={pasteSender}
                  onChange={(e) => setPasteSender(e.target.value)}
                  placeholder="e.g. purchase.lead@tatamotors.com"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Subject</label>
                <input
                  type="text"
                  value={pasteSubject}
                  onChange={(e) => setPasteSubject(e.target.value)}
                  placeholder="e.g. Urgent Requirement: Bearings & MCCB Breakers"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Message Body <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={6}
                  required
                  value={pasteBody}
                  onChange={(e) => setPasteBody(e.target.value)}
                  placeholder="Paste the customer's email content here with line items, quantities, and specifications..."
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono text-[11px]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPasteModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Extract & Review RFQ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <EmailIntegrationSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => {
            setIsSettingsOpen(false);
            setEmailConfig(loadEmailConfig());
          }}
        />
      )}
    </div>
  );
};
