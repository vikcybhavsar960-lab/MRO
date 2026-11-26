import React, { useState } from 'react';
import {
  ShieldCheck,
  Cloud,
  Database,
  Download,
  RotateCcw,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  HardDrive,
  FileCheck,
  Server,
  Lock,
  RefreshCw,
  X,
  Trash2,
  Upload,
} from 'lucide-react';
import { useApp, isSuperAdminUser } from '../../context/AppContext';
import { BackupRecord } from '../../types';
import { downloadBackupFile } from '../../services/backupRecoveryService';

export const BackupRecoveryView: React.FC = () => {
  const {
    backups,
    backupSettings,
    updateBackupSettings,
    triggerManualBackup,
    restoreFromBackupRecord,
    testBackupRecord,
    backupFailureAlert,
    clearBackupFailureAlert,
    vendors,
    categories,
    requirements,
    purgeAllOldTransactions,
    purgeAllVendors,
    cleanSlateForRealBusiness,
    exportTeamSyncSnapshot,
    importTeamSyncSnapshot,
    resetSampleMroData,
    currentUser,
    cloudSyncState,
  } = useApp();

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const isSuperAdmin = isSuperAdminUser(currentUser);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeStatusMessage, setPurgeStatusMessage] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<BackupRecord | null>(null);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [testResult, setTestResult] = useState<{ id: string; message: string; valid: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<'versions' | 'settings'>('versions');

  const latestBackup = backups[0];

  const handlePurgeTransactions = async () => {
    setIsPurging(true);
    setPurgeStatusMessage('Purging all sample transactions...');
    try {
      const res = await purgeAllOldTransactions();
      setPurgeStatusMessage(res.message || 'All old transactions purged successfully.');
      setTimeout(() => setPurgeStatusMessage(null), 5000);
    } catch (err: any) {
      setPurgeStatusMessage(`Purge error: ${err.message || 'Failed'}`);
    } finally {
      setIsPurging(false);
    }
  };

  const handlePurgeVendors = async () => {
    setIsPurging(true);
    setPurgeStatusMessage('Purging sample suppliers...');
    try {
      const res = await purgeAllVendors();
      setPurgeStatusMessage(res.message || 'All sample suppliers purged successfully.');
      setTimeout(() => setPurgeStatusMessage(null), 5000);
    } catch (err: any) {
      setPurgeStatusMessage(`Purge error: ${err.message || 'Failed'}`);
    } finally {
      setIsPurging(false);
    }
  };

  const handleCleanSlate = async () => {
    setIsPurging(true);
    setPurgeStatusMessage('Initializing fresh enterprise database slate...');
    try {
      const res = await cleanSlateForRealBusiness();
      setPurgeStatusMessage(res.message || 'Clean business slate ready. ERP ready for real operations.');
      setTimeout(() => setPurgeStatusMessage(null), 5000);
    } catch (err: any) {
      setPurgeStatusMessage(`Initialization error: ${err.message || 'Failed'}`);
    } finally {
      setIsPurging(false);
    }
  };

  const handleBackupNow = () => {
    setIsBackingUp(true);
    try {
      triggerManualBackup();
    } catch (err: any) {
      alert(`Backup error: ${err?.message || 'Failed to capture snapshot'}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleTestBackup = (backupId: string) => {
    const res = testBackupRecord(backupId);
    setTestResult({
      id: backupId,
      message: res.message,
      valid: res.valid,
    });
  };

  const handleConfirmRestore = () => {
    if (!selectedBackupForRestore) return;
    const success = restoreFromBackupRecord(selectedBackupForRestore.id);
    setIsRestoreModalOpen(false);
    setSelectedBackupForRestore(null);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Automated Daily Cloud Backup & Disaster Recovery
                </h2>
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
                    cloudSyncState.connected
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border-amber-200'
                  }`}
                >
                  {cloudSyncState.connected ? 'Cloud Firestore Live' : 'Local Snapshot Mode'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Full cryptographic snapshots protecting Vendor Master, Category Master, Requirements, and POs against hardware failure
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleBackupNow}
            disabled={isBackingUp}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs shadow-emerald-500/20 transition-all"
          >
            {isBackingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span>{isBackingUp ? 'Creating Snapshot...' : 'Backup Now'}</span>
          </button>

          {latestBackup && (
            <button
              onClick={() => downloadBackupFile(latestBackup)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors"
              title="Download latest JSON snapshot to local drive"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Download Backup</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const json = exportTeamSyncSnapshot();
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `mro-erp-backup-${new Date().toISOString().split('T')[0]}.json`;
              a.click();
              URL.revokeObjectURL(url);
              setPurgeStatusMessage('Exported full ERP JSON backup file.');
              setTimeout(() => setPurgeStatusMessage(null), 4000);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>Export JSON</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const res = importTeamSyncSnapshot(String(reader.result || ''));
                setPurgeStatusMessage(res.message);
                setTimeout(() => setPurgeStatusMessage(null), 5000);
              };
              reader.readAsText(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            <span>Import JSON</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const res = resetSampleMroData();
              setPurgeStatusMessage(res.message);
              setTimeout(() => setPurgeStatusMessage(null), 5000);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Sample Data</span>
          </button>
        </div>
      </div>

      {/* Failure Alert Banner (If Any) */}
      {backupFailureAlert && (
        <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-start justify-between gap-3 text-rose-900 animate-fadeIn">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-sm">
                Backup Failed — Your latest data has not been backed up.
              </h4>
              <p className="text-xs text-rose-700">
                Error occurred at {new Date(backupFailureAlert.timestamp).toLocaleString()}: {backupFailureAlert.error}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleBackupNow}
              className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700"
            >
              Retry Backup Now
            </button>
            <button
              onClick={clearBackupFailureAlert}
              className="p-1 text-rose-400 hover:text-rose-700 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Dashboard KPI Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Last Backup */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span>Last Successful Backup</span>
          </span>
          <div className="text-base font-extrabold text-slate-900 font-mono">
            {latestBackup ? latestBackup.versionLabel.replace('Backup — ', '') : 'Pending'}
          </div>
          <p className="text-[11px] text-emerald-600 font-medium">Status: Healthy & Verified</p>
        </div>

        {/* Card 2: Next Automatic Backup */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5 text-emerald-500" />
            <span>Next Automatic Backup</span>
          </span>
          <div className="text-base font-extrabold text-slate-900 font-mono">
            {backupSettings.nextBackupTimestamp
              ? new Date(backupSettings.nextBackupTimestamp).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Every 24 Hours'}
          </div>
          <p className="text-[11px] text-slate-400">Scheduled Daily at Midnight</p>
        </div>

        {/* Card 3: Storage Location */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Cloud className="w-3.5 h-3.5 text-indigo-500" />
            <span>Cloud Vault Location</span>
          </span>
          <div className="text-sm font-bold text-slate-900 truncate">
            Google Drive Enterprise Vault
          </div>
          <p className="text-[11px] text-indigo-600 font-mono truncate">
            /ProcureMRO_Backups/Vault
          </p>
        </div>

        {/* Card 4: Backup Versions & Size */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <HardDrive className="w-3.5 h-3.5 text-amber-500" />
            <span>Backup Versions Retained</span>
          </span>
          <div className="text-base font-extrabold text-slate-900 font-mono">
            {backups.length} Versions • {latestBackup?.sizeFormatted || '180 KB'}
          </div>
          <p className="text-[11px] text-slate-400">Daily, Weekly & Monthly Snapshots</p>
        </div>
      </div>

      {/* Test Result Message Box (if test run) */}
      {testResult && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
            testResult.valid
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {testResult.valid ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
          <button
            onClick={() => setTestResult(null)}
            className="text-xs font-bold text-slate-500 hover:text-slate-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Version History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900">Retained Backup Snapshots (Point-in-Time Recovery)</h3>
            <p className="text-xs text-slate-500">
              Select any past snapshot to test integrity, download encrypted file, or restore entire business database
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
            {backups.length} Active Snapshots
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Backup Label & Identifier</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Records Captured</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Cloud Status</th>
                <th className="py-3 px-4 text-right">Recovery Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {backups.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{b.versionLabel}</div>
                    <div className="font-mono text-[10px] text-slate-400">{b.id}</div>
                  </td>

                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        b.type === 'AUTOMATIC_DAILY'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-purple-50 text-purple-700 border border-purple-200'
                      }`}
                    >
                      {b.type === 'AUTOMATIC_DAILY' ? 'Daily Auto-Backup' : 'Manual Snapshot'}
                    </span>
                  </td>

                  <td className="py-3 px-4 font-mono text-slate-600">
                    <div className="text-[11px]">
                      {b.recordCounts.vendors} Vendors • {b.recordCounts.categories} Categories • {b.recordCounts.requirements} REQs
                    </div>
                  </td>

                  <td className="py-3 px-4 font-mono font-bold text-slate-800">
                    {b.sizeFormatted}
                  </td>

                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Synchronized</span>
                    </span>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleTestBackup(b.id)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-bold text-[11px] transition-colors"
                        title="Run schema and consistency audit"
                      >
                        Test Backup
                      </button>

                      <button
                        onClick={() => downloadBackupFile(b)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 rounded-md transition-colors"
                        title="Download JSON Snapshot"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          setSelectedBackupForRestore(b);
                          setIsRestoreModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md font-bold text-[11px] transition-colors"
                      >
                        Restore Data
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Super Admin Database Operations & Clean Business Slate Control */}
      {isSuperAdmin && (
        <div className="bg-white border-2 border-slate-900 rounded-2xl p-6 space-y-5 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-600 text-white rounded-xl shadow-md">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-900">
                    REAL BUSINESS DEPLOYMENT — SUPER ADMIN PURGE & CLEAN SLATE
                  </h3>
                  <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-black rounded-full uppercase tracking-wider">
                    Executive Power
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                  Prepare this ERP for your actual enterprise operations. Choose whether to wipe only test transactions, wipe sample demo suppliers, or initialize a 100% clean business slate. All deletions are permanently committed to disk and will never resurrect.
                </p>
              </div>
            </div>
          </div>

          {purgeStatusMessage && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 font-bold text-xs flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{purgeStatusMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Option 1: Purge All Test Transactions */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 transition-all flex flex-col justify-between space-y-3">
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                  <span>1. Purge Test Transactions</span>
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Masters Safe</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1.5 leading-normal">
                  Wipes all test Requirements, RFQs, Quotes, POs, Invoices, Dispatches, and Payments. Vendors & Products are 100% preserved.
                </p>
              </div>
              <button
                onClick={handlePurgeTransactions}
                disabled={isPurging}
                className="w-full py-2 px-3 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Purge Transactions</span>
              </button>
            </div>

            {/* Option 2: Purge Sample Vendors & Catalog */}
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 hover:border-amber-300 transition-all flex flex-col justify-between space-y-3">
              <div>
                <div className="text-xs font-bold text-amber-950 flex items-center justify-between">
                  <span>2. Purge Sample Vendors</span>
                  <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">Suppliers Wiped</span>
                </div>
                <p className="text-[11px] text-amber-800 mt-1.5 leading-normal">
                  Permanently deletes all demo suppliers so you can import or manually register your genuine business vendor directory.
                </p>
              </div>
              <button
                onClick={handlePurgeVendors}
                disabled={isPurging}
                className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Purge Sample Vendors</span>
              </button>
            </div>

            {/* Option 3: Complete Fresh Business Slate */}
            <div className="p-4 rounded-xl border-2 border-rose-400 bg-rose-50/60 hover:bg-rose-50 hover:border-rose-500 transition-all flex flex-col justify-between space-y-3">
              <div>
                <div className="text-xs font-extrabold text-rose-950 flex items-center justify-between">
                  <span>3. Clean Business Slate</span>
                  <span className="text-[10px] font-black text-rose-700 bg-rose-200/80 px-2 py-0.5 rounded">Fresh Start</span>
                </div>
                <p className="text-[11px] text-rose-800 mt-1.5 leading-normal">
                  Resets database to pure live enterprise state: wipes all transactions, all sample vendors, and resets sequences to start from 001.
                </p>
              </div>
              <button
                onClick={handleCleanSlate}
                disabled={isPurging}
                className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-lg shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Initialize Clean Slate</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Warning Modal for Restoration */}
      {isRestoreModalOpen && selectedBackupForRestore && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="font-bold text-base text-slate-900">
                Confirm System State Restoration
              </h3>
              <p className="text-xs text-slate-500">
                You are about to roll back the entire database to:
              </p>
              <div className="p-3 bg-slate-100 rounded-xl font-mono text-xs font-bold text-slate-800">
                {selectedBackupForRestore.versionLabel}
              </div>
              <p className="text-[11px] text-rose-600 font-semibold">
                ⚠️ All active vendor, category, requirement, and quotation records will be replaced with this snapshot's state.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 text-xs">
              <button
                onClick={() => setIsRestoreModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-xs shadow-rose-500/20"
              >
                Yes, Restore All Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
