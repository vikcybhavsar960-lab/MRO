import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  Mail,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  X,
  FileCheck2,
  DollarSign,
  TrendingUp,
  Scale,
  Send,
  Building,
  History,
  FileText,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  evaluateEarningAndCommercialRules,
  generateVerificationMailto,
  CommercialAuditSummary,
} from '../../services/rulesAndLockService';

interface EarningRulesAndLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirementId: string;
  quotationId?: string;
}

export const EarningRulesAndLockModal: React.FC<EarningRulesAndLockModalProps> = ({
  isOpen,
  onClose,
  requirementId,
  quotationId,
}) => {
  const {
    customerQuotations,
    requirements,
    vendorQuotes,
    currentUser,
    lockQuotationCommercials,
    unlockQuotationCommercials,
    pushNotification,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'rules' | 'lock' | 'mail'>('rules');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [lockRemarks, setLockRemarks] = useState('');
  const [unlockReason, setUnlockReason] = useState('');
  const [isCopiedLink, setIsCopiedLink] = useState(false);
  const [isCopiedReport, setIsCopiedReport] = useState(false);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);

  if (!isOpen) return null;

  const targetQuotation = customerQuotations.find(
    (q) => (quotationId && q.id === quotationId) || q.requirementId === requirementId
  );
  const targetRequirement = requirements.find((r) => r.id === requirementId);

  const summary: CommercialAuditSummary = evaluateEarningAndCommercialRules(
    targetQuotation,
    targetRequirement,
    vendorQuotes
  );

  const defaultEmail = targetRequirement?.customerEmail || 'accounts-audit@client.com';
  const effectiveEmail = recipientEmail || defaultEmail;

  const mailDetails = generateVerificationMailto(summary, effectiveEmail, customNote);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(mailDetails.shareUrl);
    setIsCopiedLink(true);
    setTimeout(() => setIsCopiedLink(false), 2500);
    pushNotification('Verification Link Copied', 'Order verification link copied to clipboard.', 'SUCCESS');
  };

  const handleCopyReport = () => {
    navigator.clipboard.writeText(mailDetails.body);
    setIsCopiedReport(true);
    setTimeout(() => setIsCopiedReport(false), 2500);
    pushNotification('Audit Report Copied', 'Email text copied to clipboard.', 'SUCCESS');
  };

  const handleOpenMailClient = () => {
    window.location.href = mailDetails.mailtoUrl;
  };

  const handleLockCommercials = () => {
    if (!targetQuotation) {
      alert('A formal quotation must be generated before locking commercial earnings.');
      return;
    }
    lockQuotationCommercials(targetQuotation.id, lockRemarks || 'Commercial margin verified and locked.');
    setLockRemarks('');
  };

  const handleUnlockCommercials = () => {
    if (!targetQuotation) return;
    if (!unlockReason.trim()) {
      alert('Please state a reason for unlocking (e.g., Client price renegotiation).');
      return;
    }
    unlockQuotationCommercials(targetQuotation.id, unlockReason);
    setUnlockReason('');
    setShowUnlockConfirm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${summary.isLocked ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
              {summary.isLocked ? <Lock className="w-5 h-5" /> : <Scale className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Earning & Commercial Rules Auditor
                </h3>
                {summary.isLocked ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 shadow-xs">
                    <Lock className="w-3 h-3" />
                    <span>LOCKED & FROZEN</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <Unlock className="w-3 h-3" />
                    <span>OPEN FOR EDITS</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Order #{summary.requirementId} &bull; {summary.customerName} &bull; Quotation: {summary.quotationId || 'Pending'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Commercial Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 bg-slate-50 border-b border-slate-200 text-xs">
          <div className="p-3.5">
            <span className="text-[11px] font-semibold text-slate-500 block uppercase">Customer Selling Total</span>
            <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
              ₹{summary.totalSellingPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-3.5">
            <span className="text-[11px] font-semibold text-slate-500 block uppercase">Vendor Purchase Cost</span>
            <div className="text-base font-bold font-mono text-slate-700 mt-0.5">
              ₹{summary.totalBuyingCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-3.5 bg-emerald-50/50">
            <span className="text-[11px] font-semibold text-emerald-800 block uppercase flex items-center justify-between">
              <span>Gross Earning</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            </span>
            <div className={`text-base font-extrabold font-mono mt-0.5 ${summary.grossEarning >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              ₹{summary.grossEarning.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-3.5 bg-blue-50/50">
            <span className="text-[11px] font-semibold text-blue-800 block uppercase">Earning Margin</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-base font-extrabold font-mono ${summary.marginPercent >= 12 ? 'text-blue-700' : summary.marginPercent > 0 ? 'text-amber-700' : 'text-rose-600'}`}>
                {summary.marginPercent.toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-500">(Target: &ge; 12%)</span>
            </div>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="px-5 border-b border-slate-200 bg-white flex items-center gap-6 text-xs font-bold">
          <button
            onClick={() => setActiveTab('rules')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'rules'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Rules Check ({summary.totalPassed} Checked / {summary.totalFailed + summary.totalWarnings} Flagged)</span>
          </button>

          <button
            onClick={() => setActiveTab('lock')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'lock'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {summary.isLocked ? <Lock className="w-4 h-4 text-amber-600" /> : <Unlock className="w-4 h-4" />}
            <span>Open & Lock Controls</span>
          </button>

          <button
            onClick={() => setActiveTab('mail')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'mail'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Send Link via Mail to Check</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* TAB 1: RULES AUDIT ("What was check & what was not check right") */}
          {activeTab === 'rules' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-xs">
                  <span className="font-bold text-slate-800 block">Commercial Compliance Engine:</span>
                  <span className="text-slate-500">
                    Validates earning viability, tax parity, payment cycle spreads, and prevents margin leakage.
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{summary.totalPassed} Checked Right</span>
                  </span>

                  {summary.totalFailed + summary.totalWarnings > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-bold text-xs flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{summary.totalFailed + summary.totalWarnings} Not Checked Right</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Rules List */}
              <div className="space-y-3">
                {summary.rules.map((rule) => {
                  return (
                    <div
                      key={rule.ruleId}
                      className={`p-3.5 rounded-xl border transition-all ${
                        rule.passed
                          ? 'bg-white border-slate-200 hover:border-emerald-300'
                          : rule.severity === 'CRITICAL'
                          ? 'bg-rose-50/60 border-rose-300 ring-1 ring-rose-400/20'
                          : 'bg-amber-50/60 border-amber-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {rule.passed ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            ) : rule.severity === 'CRITICAL' ? (
                              <XCircle className="w-5 h-5 text-rose-600" />
                            ) : (
                              <AlertTriangle className="w-5 h-5 text-amber-600" />
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900">{rule.title}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  rule.passed
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : rule.severity === 'CRITICAL'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                                }`}
                              >
                                {rule.passed ? 'CHECKED RIGHT' : 'NOT CHECKED RIGHT'}
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{rule.message}</p>

                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 font-mono">
                              <span>Expected: <strong className="text-slate-700">{rule.expectedValue}</strong></span>
                              <span>Actual: <strong className="text-slate-800">{rule.actualValue}</strong></span>
                              {rule.earningImpactAmount !== undefined && (
                                <span className={rule.earningImpactAmount >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                                  Earning Impact: <strong>₹{rule.earningImpactAmount.toLocaleString('en-IN')}</strong>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: OPEN AND LOCK CONTROLS */}
          {activeTab === 'lock' && (
            <div className="space-y-5">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${summary.isLocked ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                    {summary.isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Commercial & Earning Lock Protection
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      When locked, quotation selling prices, vendor purchase rates, and net earnings are frozen to prevent unauthorized alterations or margin tampering.
                    </p>
                  </div>
                </div>

                {summary.isLocked ? (
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-2 text-xs text-amber-900">
                    <div className="font-bold flex items-center gap-1.5 text-amber-800">
                      <Lock className="w-4 h-4" />
                      <span>Order Commercials are Currently LOCKED & FROZEN</span>
                    </div>
                    <p>
                      <strong>Locked By:</strong> {summary.lockInfo?.lockedBy || currentUser.name}
                    </p>
                    <p>
                      <strong>Locked On:</strong> {summary.lockInfo?.lockedAt || 'Today'}
                    </p>
                    <p>
                      <strong>Frozen Net Earning:</strong> ₹{summary.grossEarning.toLocaleString('en-IN')} ({summary.marginPercent.toFixed(1)}% Margin)
                    </p>
                    {summary.lockInfo?.lockedRemarks && (
                      <p>
                        <strong>Remarks:</strong> {summary.lockInfo.lockedRemarks}
                      </p>
                    )}

                    <div className="pt-3 border-t border-amber-200">
                      {!showUnlockConfirm ? (
                        <button
                          onClick={() => setShowUnlockConfirm(true)}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                        >
                          <Unlock className="w-4 h-4" />
                          <span>Request / Authorize Unlock for Amendment</span>
                        </button>
                      ) : (
                        <div className="space-y-2 bg-white p-3.5 rounded-xl border border-amber-300">
                          <label className="text-xs font-bold text-slate-800 block">
                            Mandatory Reason for Unlocking Commercials:
                          </label>
                          <input
                            type="text"
                            value={unlockReason}
                            onChange={(e) => setUnlockReason(e.target.value)}
                            placeholder="e.g., Customer requested volume discount revision / Vendor rate revision"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleUnlockCommercials}
                              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs"
                            >
                              Confirm Unlock & Open
                            </button>
                            <button
                              onClick={() => setShowUnlockConfirm(false)}
                              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-xs text-slate-800 block">Current Status: OPEN (Editable)</span>
                        <span className="text-[11px] text-slate-500">
                          Rates, margins, and discounts can currently be amended.
                        </span>
                      </div>
                    </div>

                    {summary.totalFailed > 0 && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Warning:</strong> {summary.totalFailed} critical commercial rules were NOT checked right (e.g. under-cost selling or negative margin).
                          Locking requires supervisor confirmation.
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 block">
                        Commercial Verification Remarks (Optional):
                      </label>
                      <input
                        type="text"
                        value={lockRemarks}
                        onChange={(e) => setLockRemarks(e.target.value)}
                        placeholder="e.g., Rates audited against OEM price list. Approved for PO generation."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                      />
                    </div>

                    <button
                      onClick={handleLockCommercials}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Lock Commercials & Freeze Earnings (₹{summary.grossEarning.toLocaleString('en-IN')})</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Unlock History if any */}
              {summary.lockInfo?.unlockHistory && summary.lockInfo.unlockHistory.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-slate-400" />
                    <span>Audit Trail: Prior Commercial Amendments & Unlocks</span>
                  </h4>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden text-xs">
                    {summary.lockInfo.unlockHistory.map((h, i) => (
                      <div key={i} className="p-3 flex items-start justify-between">
                        <div>
                          <span className="font-semibold text-slate-800">{h.reason}</span>
                          <div className="text-[10px] text-slate-400 mt-0.5">Unlocked by {h.unlockedBy}</div>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{h.unlockedAt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SEND LINK VIA MAIL TO CHECK */}
          {activeTab === 'mail' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <span>Dispatch Commercial Verification Link via Email</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Send structured audit data with direct portal URL to finance reviewers, customer approvers, or audit officers to check earnings and compliance.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Recipient Email Address:</label>
                    <input
                      type="email"
                      value={effectiveEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="e.g., auditor@client.com"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Auditor Custom Note / Instructions:</label>
                    <input
                      type="text"
                      value={customNote}
                      onChange={(e) => setCustomNote(e.target.value)}
                      placeholder="e.g., Please review margin on ABB motor before approving customer PO."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                </div>

                {/* Direct Verification Link Display */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Direct Order Verification URL</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={mailDetails.shareUrl}
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-600 select-all"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all shrink-0"
                    >
                      {isCopiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopiedLink ? 'Copied Link!' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>

                {/* Email Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    onClick={handleOpenMailClient}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Open in Email Client (Mailto)</span>
                  </button>

                  <button
                    onClick={handleCopyReport}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all"
                  >
                    {isCopiedReport ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopiedReport ? 'Email Report Copied' : 'Copy Formatted Report'}</span>
                  </button>
                </div>
              </div>

              {/* Email Content Preview */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 block">Email Message Preview:</span>
                <pre className="p-4 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed border border-slate-800">
                  {mailDetails.body}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <div className="text-slate-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>MRO Commercial Integrity & Margin Rule Engine</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-all"
          >
            Close Auditor
          </button>
        </div>
      </div>
    </div>
  );
};
