import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Database,
  HardDrive,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  HelpCircle,
  X,
  Server,
  Info,
  Laptop,
  Copy,
  Check,
  Share2,
  AlertTriangle,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fetchApi } from '../../utils/apiClient';
import { isAdminRole } from '../../utils/roleUtils';
import {
  runLiveSupabaseProductionTest,
  SupabaseProductionVerificationReport,
} from '../../services/supabaseClientDataService';

interface DataModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'switcher' | 'how-it-works' | 'backup';
}

export const DataModeModal: React.FC<DataModeModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'switcher',
}) => {
  const {
    currentUser,
    customers,
    vendors,
    products,
    productTypes,
    requirements,
    customerQuotations,
    customerPOs,
    vendorPOs,
    exportFullBackup,
    restoreFullBackup,
    exportTeamSyncSnapshot,
    importTeamSyncSnapshot,
    syncBackendNow,
    pushDeviceDataToCentralDb,
    isSyncing,
    lastSyncTime,
    isOnline,
    cloudSyncState,
    connectCloudDatabase,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'switcher' | 'how-it-works' | 'backup'>(initialTab);
  const [restoreText, setRestoreText] = useState('');
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [teamSyncCode, setTeamSyncCode] = useState<string>('');
  const [copiedSyncCode, setCopiedSyncCode] = useState<boolean>(false);
  const [pasteSyncInput, setPasteSyncInput] = useState<string>('');
  const [teamSyncStatus, setTeamSyncStatus] = useState<string | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<{ ok: boolean; msg: string; counts?: Record<string, number> } | null>(null);
  const [isMigrating, setIsMigrating] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [sqlPreviewText, setSqlPreviewText] = useState<string>('');
  const [liveTestReport, setLiveTestReport] = useState<SupabaseProductionVerificationReport | null>(null);
  const [isRunningLiveTest, setIsRunningLiveTest] = useState<boolean>(false);

  if (!isOpen) return null;

  const isAdmin = isAdminRole(currentUser.role, currentUser.username);

  const handleCheckSupabase = async () => {
    setIsMigrating(true);
    setMigrationStatus(null);
    try {
      const res = await connectCloudDatabase();
      setMigrationStatus({ ok: res.success, msg: res.message });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleRunProductionReadWriteTest = async () => {
    setIsRunningLiveTest(true);
    setLiveTestReport(null);
    try {
      const report = await runLiveSupabaseProductionTest({ includeWriteRoundTrip: true });
      setLiveTestReport(report);
      setMigrationStatus({
        ok: report.connected && report.writeTestPassed !== false,
        msg: report.connected
          ? `Live Supabase verified (${report.url}): Vendors=${report.counts.vendors}, Products=${report.counts.products}, Requirements=${report.counts.requirements}. ${report.writeTestDetail || ''}`
          : report.rlsError ||
            (!report.hasPublishableKey
              ? 'VITE_SUPABASE_PUBLISHABLE_KEY is missing from this build bundle. Add it in Cloudflare Workers Settings -> Build -> Variables and secrets, then redeploy.'
              : 'Live Supabase verification did not complete. Inspect step details below.'),
      });
    } finally {
      setIsRunningLiveTest(false);
    }
  };

  const handleRunSafeMigration = async () => {
    setIsMigrating(true);
    setMigrationStatus(null);
    try {
      const res = await fetchApi('/api/supabase/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeoutMs: 60000,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setMigrationStatus({
          ok: false,
          msg: data?.error || `Migration returned HTTP ${res.status}`,
        });
        return;
      }
      await syncBackendNow();
      setMigrationStatus({
        ok: true,
        msg: `Non-destructive migration complete! Backup saved at ${data.backupPath}. Buckets verified: ${data.bucketsChecked}.`,
        counts: data.countsAfter,
      });
    } catch (err: any) {
      setMigrationStatus({ ok: false, msg: err?.message || 'Migration failed' });
    } finally {
      setIsMigrating(false);
    }
  };

  const loadValidSchemaSql = async (): Promise<string> => {
    const isHtmlDoc = (txt: string) => /^\s*(<!doctype|<html)/i.test(txt);

    // 1. Try Express backend endpoint when running full-stack
    try {
      const res = await fetchApi('/api/supabase/schema-sql');
      if (res.ok) {
        const text = await res.text();
        if (text.trim() && !isHtmlDoc(text)) {
          return text;
        }
      }
    } catch {}

    // 2. Fallback to bundled static asset (Cloudflare Workers ./dist/001_erp_production_schema.sql)
    const staticRes = await fetch('/001_erp_production_schema.sql');
    if (!staticRes.ok) {
      throw new Error(`Unable to load migration SQL (HTTP ${staticRes.status}).`);
    }
    const staticText = await staticRes.text();
    if (!staticText.trim() || isHtmlDoc(staticText)) {
      throw new Error('SQL file could not be loaded (received HTML page instead of SQL).');
    }
    return staticText;
  };

  const handleCopySchemaSql = async () => {
    try {
      const sqlText = await loadValidSchemaSql();
      let copiedOk = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(sqlText);
          copiedOk = true;
        }
      } catch {
        copiedOk = false;
      }
      if (!copiedOk) {
        try {
          const ta = document.createElement('textarea');
          ta.value = sqlText;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          copiedOk = document.execCommand('copy');
          document.body.removeChild(ta);
        } catch {
          copiedOk = false;
        }
      }
      setSqlPreviewText(sqlText);
      if (copiedOk) {
        setCopiedSql(true);
        setMigrationStatus({
          ok: true,
          msg: 'Copied full PostgreSQL migration SQL to clipboard! Clear the Supabase SQL Editor, press Ctrl+V to paste, and click Run.',
        });
        setTimeout(() => setCopiedSql(false), 4000);
      } else {
        setMigrationStatus({
          ok: true,
          msg: 'Migration SQL loaded below (or click "Download .sql"). Select all inside the SQL box (Ctrl+A, Ctrl+C) and paste into Supabase SQL Editor.',
        });
      }
    } catch (err: any) {
      setMigrationStatus({ ok: false, msg: err?.message || 'Failed to load SQL script.' });
    }
  };

  const handleDownloadSchemaSql = async () => {
    try {
      const sqlText = await loadValidSchemaSql();
      const blob = new Blob([sqlText], { type: 'application/sql;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '001_erp_production_schema.sql';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMigrationStatus({
        ok: true,
        msg: 'Downloaded 001_erp_production_schema.sql! Open or drag this file into the Supabase SQL Editor and click Run.',
      });
    } catch (err: any) {
      setMigrationStatus({ ok: false, msg: err?.message || 'Failed to download SQL file.' });
    }
  };

  const handleManualSync = async () => {
    await syncBackendNow();
  };

  const handlePushToCloud = async () => {
    setIsPushing(true);
    setPushStatus(null);
    try {
      const res = await pushDeviceDataToCentralDb();
      setPushStatus(res.message);
      setTimeout(() => setPushStatus(null), 4000);
    } catch (err: any) {
      setPushStatus(err?.message || 'Upload error');
    } finally {
      setIsPushing(false);
    }
  };

  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = restoreFullBackup(content);
      if (success) {
        setRestoreStatus('Backup successfully restored into current workspace!');
        setTimeout(() => setRestoreStatus(null), 3000);
      } else {
        setRestoreStatus('Error: Invalid backup file format.');
      }
    };
    reader.readAsText(file);
  };

  const handleTextRestore = () => {
    if (!restoreText.trim()) return;
    const success = restoreFullBackup(restoreText);
    if (success) {
      setRestoreStatus('Backup successfully restored into current workspace!');
      setRestoreText('');
      setTimeout(() => setRestoreStatus(null), 3000);
    } else {
      setRestoreStatus('Error: Failed to parse JSON text.');
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 bg-slate-900/75 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                cloudSyncState.connected
                  ? 'bg-emerald-600/30 border-emerald-400/40 text-emerald-400'
                  : 'bg-amber-600/30 border-amber-400/40 text-amber-300'
              }`}
            >
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base tracking-tight">Supabase PostgreSQL &amp; Storage Engine</h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                    cloudSyncState.connected
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      cloudSyncState.connected ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                  <span>
                    {cloudSyncState.connected
                      ? 'Supabase PostgreSQL Live'
                      : cloudSyncState.serverConfigured && !cloudSyncState.schemaApplied
                        ? 'Run Schema SQL in Supabase'
                        : 'Setup Pending Environment Keys'}
                  </span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {cloudSyncState.connected
                  ? `Authoritative PostgreSQL + 9 Storage Buckets + Realtime Sync (${cloudSyncState.projectId})`
                  : cloudSyncState.serverConfigured && !cloudSyncState.schemaApplied
                    ? 'Supabase keys are active! Click "Copy Schema SQL", paste into Supabase SQL Editor, and click Run.'
                    : 'Configure SUPABASE_SERVICE_ROLE_KEY & VITE_SUPABASE_PUBLISHABLE_KEY in environment secrets to enable live Supabase persistence'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close Database Status Modal"
            data-testid="close-cloud-modal-btn"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 flex items-center gap-2 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('switcher')}
            className={`py-3 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'switcher'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Supabase Status &amp; Migration</span>
          </button>

          <button
            onClick={() => setActiveTab('how-it-works')}
            className={`py-3 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'how-it-works'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-amber-500" />
            <span>Architecture &amp; Storage</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`py-3 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'backup'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Backup &amp; Export</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs text-slate-700 flex-1">
          {activeTab === 'switcher' && (
            <div className="space-y-6">
              {/* Supabase Connection & Migration Card */}
              <div
                className={`p-5 rounded-2xl border-2 shadow-xs relative ${
                  cloudSyncState.connected
                    ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-50/70 to-teal-50/40'
                    : 'border-amber-400 bg-gradient-to-br from-amber-50/90 to-orange-50/50'
                }`}
              >
                <div className="flex flex-col gap-3.5">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold shadow-md shrink-0 ${
                        cloudSyncState.connected
                          ? 'bg-emerald-600 shadow-emerald-600/20'
                          : 'bg-amber-600 shadow-amber-600/20'
                      }`}
                    >
                      {cloudSyncState.connected ? <Server className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-extrabold text-sm text-slate-900">
                          {cloudSyncState.connected
                            ? 'Authoritative Supabase PostgreSQL Connected'
                            : cloudSyncState.serverConfigured && !cloudSyncState.schemaApplied
                              ? 'Supabase Keys Active — Run SQL Schema Next'
                              : 'Supabase Connection Awaiting Server Secrets'}
                        </h4>
                        <span
                          className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                            cloudSyncState.connected
                              ? 'text-emerald-800 bg-emerald-100 border-emerald-300'
                              : 'text-amber-900 bg-amber-100 border-amber-300'
                          }`}
                        >
                          <CheckCircle2
                            className={`w-3.5 h-3.5 ${
                              cloudSyncState.connected ? 'text-emerald-600' : 'text-amber-600'
                            }`}
                          />
                          <span>{cloudSyncState.projectId}</span>
                        </span>
                      </div>
                      <p className="text-slate-600 text-xs mt-1">
                        {cloudSyncState.connected
                          ? 'All vendors, RFQs, rates, documents (up to 250 MB), and audit logs persist in Supabase PostgreSQL with Realtime multi-user sync.'
                          : cloudSyncState.serverConfigured && !cloudSyncState.schemaApplied
                            ? 'Click "Copy Schema SQL" (or "Download .sql") below, clear any file path text in Supabase SQL Editor, paste the SQL script contents, and click Run. Then click "Verify Connection".'
                            : '1) Click "Copy Schema SQL" (or "Download .sql") and paste the SQL script contents—never the file path—into Supabase SQL Editor and click Run. 2) Set SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_PUBLISHABLE_KEY in environment secrets.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isAdmin && (
                      <>
                        <button
                          onClick={handleCopySchemaSql}
                          data-testid="copy-supabase-sql-btn"
                          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5 text-xs shadow-sm transition-all cursor-pointer"
                          title="Copy full SQL schema script to paste into Supabase SQL Editor"
                        >
                          {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedSql ? 'Copied SQL!' : 'Copy Schema SQL'}</span>
                        </button>
                        <button
                          onClick={handleDownloadSchemaSql}
                          data-testid="download-supabase-sql-btn"
                          className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl font-bold flex items-center gap-1.5 text-xs shadow-xs transition-all cursor-pointer"
                          title="Download 001_erp_production_schema.sql file"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-600" />
                          <span>Download .sql</span>
                        </button>
                      </>
                    )}
                    <button
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'Syncing...' : 'Refresh State'}</span>
                    </button>
                    {isAdmin && (
                      <button
                        onClick={cloudSyncState.connected ? handleRunSafeMigration : handleCheckSupabase}
                        disabled={isMigrating}
                        data-testid="run-supabase-migration-btn"
                        className="px-3 py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-bold flex items-center gap-1.5 text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5 text-indigo-300" />
                        <span>
                          {isMigrating
                            ? 'Working...'
                            : cloudSyncState.connected
                              ? 'Run Non-Destructive Sync'
                              : 'Verify Connection'}
                        </span>
                      </button>
                    )}
                    <button
                      onClick={handleRunProductionReadWriteTest}
                      disabled={isRunningLiveTest}
                      data-testid="run-supabase-live-test-btn"
                      className="px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold flex items-center gap-1.5 text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-200" />
                      <span>{isRunningLiveTest ? 'Testing Supabase...' : 'Run Live Read/Write Test'}</span>
                    </button>
                  </div>
                </div>

                {(cloudSyncState.error || migrationStatus) && (
                  <div
                    className={`mt-3 p-2.5 rounded-xl text-xs font-semibold border ${
                      migrationStatus?.ok
                        ? 'bg-emerald-100/80 text-emerald-900 border-emerald-300'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    {migrationStatus?.msg || cloudSyncState.error}
                  </div>
                )}

                {liveTestReport && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-950 text-slate-100 border border-slate-700 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-teal-300">
                        Production Supabase Verification ({liveTestReport.url})
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                          liveTestReport.connected
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {liveTestReport.connected ? 'VERIFIED LIVE' : 'ACTION REQUIRED'}
                      </span>
                    </div>
                    <div className="space-y-1 font-mono text-[10px]">
                      {liveTestReport.steps.map((s, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className={s.ok ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                            {s.ok ? '[PASS]' : '[FAIL]'}
                          </span>
                          <span className="text-slate-300">
                            <strong className="text-white">{s.step}:</strong> {s.detail}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {sqlPreviewText && (
                  <div className="mt-3 rounded-xl border border-slate-300 bg-slate-900 text-slate-100 p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-indigo-300">
                        PostgreSQL Migration Script (001_erp_production_schema.sql) — Paste into Supabase SQL Editor &amp; Run
                      </span>
                      <button
                        onClick={() => setSqlPreviewText('')}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold cursor-pointer"
                      >
                        Hide SQL
                      </button>
                    </div>
                    <textarea
                      readOnly
                      spellCheck={false}
                      wrap="off"
                      value={sqlPreviewText}
                      onFocus={(e) => e.currentTarget.select()}
                      rows={7}
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 font-mono text-[10px] text-emerald-300 focus:outline-none focus:ring-1 focus:ring-indigo-400 overflow-x-auto"
                    />
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                  <div className="flex justify-between sm:flex-col gap-0.5 bg-white/80 p-2.5 rounded-xl border border-slate-200/80">
                    <span className="text-slate-500">Database Engine:</span>
                    <strong
                      className={`font-bold flex items-center gap-1 ${
                        cloudSyncState.connected ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full animate-pulse ${
                          cloudSyncState.connected ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                      <span>
                        {cloudSyncState.connected
                          ? isOnline
                            ? 'Supabase PostgreSQL Live'
                            : 'Offline Queued (Will Sync)'
                          : 'Staging Runtime Store'}
                      </span>
                    </strong>
                  </div>
                  <div className="flex justify-between sm:flex-col gap-0.5 bg-white/80 p-2.5 rounded-xl border border-slate-200/80">
                    <span className="text-slate-500">Last Sync:</span>
                    <strong className="text-slate-800 font-mono font-bold">
                      {(cloudSyncState.lastCloudSyncAt || lastSyncTime).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </strong>
                  </div>
                  <div className="flex justify-between sm:flex-col gap-0.5 bg-white/80 p-2.5 rounded-xl border border-slate-200/80">
                    <span className="text-slate-500">Storage Limit:</span>
                    <strong className="text-slate-800 font-mono">
                      9 Buckets • 250 MB Max
                    </strong>
                  </div>
                </div>
              </div>

              {/* Live Synced Records */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <HardDrive className="w-4 h-4 text-emerald-600" />
                    <span>Live Database Record Counts</span>
                  </span>
                  <span
                    className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
                      cloudSyncState.connected
                        ? 'text-emerald-700 bg-emerald-100/70 border-emerald-200'
                        : 'text-amber-800 bg-amber-100/70 border-amber-200'
                    }`}
                  >
                    {cloudSyncState.connected ? 'PostgreSQL Verified' : 'Local Runtime DB'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Customers</span>
                    <span className="text-base font-extrabold text-slate-900 font-mono">{customers.length}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Vendors</span>
                    <span className="text-base font-extrabold text-slate-900 font-mono">{vendors.length}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Product Types</span>
                    <span className="text-base font-extrabold text-indigo-600 font-mono">{productTypes.length}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Catalog Products</span>
                    <span className="text-base font-extrabold text-slate-900 font-mono">{products.length}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Requirements</span>
                    <span className="text-base font-extrabold text-blue-600 font-mono">{requirements.length}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Quotations</span>
                    <span className="text-base font-extrabold text-purple-600 font-mono">{customerQuotations.length}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Customer POs</span>
                    <span className="text-base font-extrabold text-emerald-600 font-mono">{customerPOs.length}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Vendor POs</span>
                    <span className="text-base font-extrabold text-amber-600 font-mono">{vendorPOs.length}</span>
                  </div>
                </div>
              </div>

              {/* Push Local Unsynced Records */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h5 className="font-bold text-xs text-slate-800">
                      Flush Offline Queue &amp; Sync Master Records
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Flushes any queued mutations from brief network interruptions cleanly into the central backend database.
                    </p>
                  </div>
                  <button
                    onClick={handlePushToCloud}
                    disabled={isPushing}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all text-xs shrink-0 disabled:opacity-50 cursor-pointer"
                  >
                    <Upload className={`w-3.5 h-3.5 ${isPushing ? 'animate-bounce' : ''}`} />
                    <span>{isPushing ? 'Syncing...' : 'Sync Queue Now'}</span>
                  </button>
                </div>
                {pushStatus && (
                  <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                    ✓ {pushStatus}
                  </p>
                )}
              </div>

              {/* 1-Click Team Member Mirror */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50/60 rounded-2xl p-5 border border-blue-200 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                      <Share2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-bold text-xs text-slate-900">
                        Portable Team Snapshot Export
                      </h5>
                      <p className="text-[11px] text-slate-600">
                        Copy an emergency point-in-time JSON snapshot for offline sharing
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      try {
                        const raw = exportTeamSyncSnapshot();
                        const token = btoa(unescape(encodeURIComponent(raw)));
                        setTeamSyncCode(token);
                        navigator.clipboard?.writeText(token);
                        setCopiedSyncCode(true);
                        setTimeout(() => setCopiedSyncCode(false), 3000);
                        setTeamSyncStatus('✓ Snapshot code copied to clipboard.');
                        setTimeout(() => setTeamSyncStatus(null), 5000);
                      } catch (err: any) {
                        setTeamSyncStatus(`Could not copy: ${err.message}`);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
                  >
                    {copiedSyncCode ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSyncCode ? 'Copied!' : 'Copy Snapshot Code'}</span>
                  </button>
                </div>

                {teamSyncStatus && (
                  <div className="p-2.5 rounded-xl text-xs font-bold bg-white text-blue-800 border border-blue-300 shadow-2xs">
                    {teamSyncStatus}
                  </div>
                )}

                <div className="pt-2 border-t border-blue-200/80">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={pasteSyncInput}
                      onChange={(e) => setPasteSyncInput(e.target.value)}
                      placeholder="Paste snapshot code to import..."
                      className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => {
                        if (!pasteSyncInput.trim()) return;
                        try {
                          let decoded = pasteSyncInput.trim();
                          if (!decoded.startsWith('{')) {
                            decoded = decodeURIComponent(escape(atob(decoded)));
                          }
                          const res = importTeamSyncSnapshot(decoded);
                          setTeamSyncStatus(res.message);
                          setPasteSyncInput('');
                          setTimeout(() => setTeamSyncStatus(null), 5000);
                        } catch (e: any) {
                          setTeamSyncStatus(`Import failed: ${e.message}`);
                        }
                      }}
                      disabled={!pasteSyncInput.trim()}
                      className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs disabled:opacity-40 transition-all shadow-xs cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'how-it-works' && (
            <div className="space-y-4 leading-relaxed">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex gap-3 text-amber-900">
                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs">Why Local / Container Storage Was Replaced</h4>
                  <p className="text-[11px] mt-1 text-amber-800">
                    Saving solely inside browser <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">localStorage</code> or temporary container files risked losing yesterday&apos;s newly added vendors or RFQs after restarts or across devices.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex gap-3 text-emerald-900">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs">Authoritative Supabase PostgreSQL + Storage Architecture</h4>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-[11px] text-emerald-800/90">
                    <li><strong>PostgreSQL Relational Database:</strong> Normalized ERP tables (Vendors, Contacts, Brands, Product Mappings, RFQs, Rate History, POs, Bills, Audit Logs, Deletion Tombstones) with Row-Level Security and readback verification on write.</li>
                    <li><strong>9 Dedicated Storage Buckets (Up to 250 MB):</strong> Vendor Catalogues, Vendor Documents, Product Images, Datasheets, RFQ Docs, Quotations, Purchase Orders, and Invoices upload via chunked streaming.</li>
                    <li><strong>Supabase Auth + Realtime:</strong> Role-based authenticated access with automatic multi-user live sync across all active sessions.</li>
                  </ul>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Laptop className="w-4 h-4 text-blue-600" />
                    <span>Laptop A (Procurement)</span>
                  </span>
                  <p className="text-[11px] text-slate-600">
                    Adds vendor or bulk RFQ → Committed to PostgreSQL + verified by SELECT readback.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Laptop className="w-4 h-4 text-emerald-600" />
                    <span>Laptop B (Management / Accounts)</span>
                  </span>
                  <p className="text-[11px] text-slate-600">
                    Receives Supabase Realtime update automatically without losing local drafts or history.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="space-y-4">
              <p className="text-slate-600 text-xs">
                Download a complete offline JSON backup of the company database or restore from a previously downloaded backup.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
                  <div>
                    <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Download className="w-4 h-4 text-blue-600" />
                      <span>Export Full Company Database</span>
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Downloads an exact JSON snapshot of customers, suppliers, catalog, RFQs, quotations, and POs.
                    </p>
                  </div>
                  <button
                    onClick={exportFullBackup}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs shadow-xs transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download JSON Backup</span>
                  </button>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
                  <div>
                    <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-emerald-600" />
                      <span>Restore from Backup File</span>
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Upload a previously exported JSON backup file to restore records into the database.
                    </p>
                  </div>
                  <label className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs shadow-xs cursor-pointer transition-all">
                    <Upload className="w-4 h-4" />
                    <span>Choose JSON Backup File</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileRestore}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {restoreStatus && (
                <div className={`p-3 rounded-xl text-xs font-bold ${
                  restoreStatus.startsWith('Error')
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  {restoreStatus}
                </div>
              )}

              <div className="pt-2">
                <label className="block text-slate-700 font-bold text-xs mb-1">
                  Or Paste Raw JSON Backup Text:
                </label>
                <textarea
                  value={restoreText}
                  onChange={(e) => setRestoreText(e.target.value)}
                  placeholder="Paste JSON database snapshot here..."
                  rows={3}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                />
                <button
                  onClick={handleTextRestore}
                  disabled={!restoreText.trim()}
                  className="mt-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold disabled:opacity-40 transition-all cursor-pointer"
                >
                  Apply Pasted Backup
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>MRO Procurement Solution • Supabase PostgreSQL Architecture</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
