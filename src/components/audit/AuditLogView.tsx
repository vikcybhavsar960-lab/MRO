import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Search,
  ShieldCheck,
  Clock,
  User,
  ArrowRight,
  Shield,
  Smartphone,
  Laptop,
  Monitor,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  RefreshCw,
  LogOut,
  Globe,
  Lock,
  Filter,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fetchApi } from '../../utils/apiClient';
import * as XLSX from 'xlsx';

interface LoginAuditEntry {
  id: string;
  timestamp: string;
  username: string;
  role: string;
  userId?: string;
  status: 'SUCCESS' | 'FAILED';
  ipAddress: string;
  userAgent: string;
  deviceType: string;
  sessionId: string;
  failureReason?: string;
}

interface ActiveSessionEntry {
  id: string;
  userId: string;
  username: string;
  name: string;
  role: string;
  ipAddress: string;
  userAgent: string;
  deviceType: string;
  loginTime: string;
  lastActiveTime: string;
  status: 'ACTIVE' | 'REVOKED';
}

export const AuditLogView: React.FC = () => {
  const { auditLogs, currentUser } = useApp();
  const [activeTab, setActiveTab] = useState<'BUSINESS_TRAIL' | 'IP_SECURITY_LOGS' | 'ACTIVE_SESSIONS'>('BUSINESS_TRAIL');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'FAILED'>('ALL');
  const [dateFilter, setDateFilter] = useState('');

  // Login logs from authoritative backend
  const [loginLogs, setLoginLogs] = useState<LoginAuditEntry[]>([]);
  const [sessions, setSessions] = useState<ActiveSessionEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchSecurityData = async () => {
    setIsLoadingLogs(true);
    try {
      const [logsRes, sessRes] = await Promise.all([
        fetchApi('/api/auth/login-logs?limit=500'),
        fetchApi('/api/auth/sessions'),
      ]);
      if (logsRes.ok) {
        const data = await logsRes.json();
        if (Array.isArray(data.logs)) setLoginLogs(data.logs);
      }
      if (sessRes.ok) {
        const data = await sessRes.json();
        if (Array.isArray(data.sessions)) setSessions(data.sessions);
      }
    } catch (err) {
      console.warn('[Audit] Security logs fetch warning:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
    const interval = setInterval(fetchSecurityData, 8000);
    return () => clearInterval(interval);
  }, []);

  // Filtered Business Audit Logs
  const filteredBusinessLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        log.user.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.entityId.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q);
      const matchDate = !dateFilter || log.timestamp.includes(dateFilter);
      return matchSearch && matchDate;
    });
  }, [auditLogs, search, dateFilter]);

  // Filtered IP & Security Logs
  const filteredLoginLogs = useMemo(() => {
    return loginLogs.filter((log) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        log.username.toLowerCase().includes(q) ||
        log.role.toLowerCase().includes(q) ||
        log.ipAddress.toLowerCase().includes(q) ||
        log.sessionId.toLowerCase().includes(q) ||
        (log.failureReason || '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'ALL' || log.status === statusFilter;
      const matchDate = !dateFilter || log.timestamp.includes(dateFilter);
      return matchSearch && matchStatus && matchDate;
    });
  }, [loginLogs, search, statusFilter, dateFilter]);

  // Revoke a session
  const handleRevokeSession = async (sessionId: string, username: string) => {
    if (!window.confirm(`Revoke active session for "${username}"? They will be logged out immediately.`)) {
      return;
    }
    try {
      const res = await fetchApi('/api/auth/sessions/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, adminUser: currentUser.name }),
      });
      if (res.ok) {
        setActionMessage(`Session ${sessionId} successfully revoked.`);
        setTimeout(() => setActionMessage(null), 4000);
        fetchSecurityData();
      }
    } catch (err) {
      alert('Failed to revoke session: ' + err);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (activeTab === 'BUSINESS_TRAIL') {
      const data = filteredBusinessLogs.map((l, idx) => ({
        'Sr. No.': idx + 1,
        'Timestamp': l.timestamp,
        'Action': l.action,
        'Entity ID': l.entityId,
        'Entity Type': l.entityType,
        'Actor Name': l.user,
        'Actor Role': l.role,
        'Details': l.details,
        'Old Value': l.oldValue || '',
        'New Value': l.newValue || '',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Business Audit Trail');
      XLSX.writeFile(wb, `Business_Audit_Trail_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else {
      const data = filteredLoginLogs.map((l, idx) => ({
        'Sr. No.': idx + 1,
        'Timestamp': l.timestamp,
        'Username': l.username,
        'Role': l.role,
        'Status': l.status,
        'IP Address': l.ipAddress,
        'Device Type': l.deviceType,
        'Browser User-Agent': l.userAgent,
        'Session ID': l.sessionId,
        'Remarks / Reason': l.failureReason || 'Authorized Access',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'IP & Security Logs');
      XLSX.writeFile(wb, `IP_Security_Audit_Logs_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
  };

  // Device icon helper
  const getDeviceIcon = (deviceType: string) => {
    const d = (deviceType || '').toLowerCase();
    if (d.includes('mobile')) return <Smartphone className="w-4 h-4 text-emerald-600" />;
    if (d.includes('tablet')) return <Laptop className="w-4 h-4 text-amber-600" />;
    return <Monitor className="w-4 h-4 text-blue-600" />;
  };

  const isAdmin = (currentUser.role as string) === 'SUPER_ADMIN' || (currentUser.role as string) === 'Admin' || (currentUser.role as string) === 'PROCUREMENT_MANAGER';

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <span>Admin Security Dashboard & Audit History</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Centralized compliance, trusted IP tracking, device access management, and immutable RFQ lifecycle history
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchSecurityData}
            disabled={isLoadingLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Business Audit Events
          </span>
          <div className="text-xl font-bold font-mono text-slate-800 mt-0.5">
            {auditLogs.length} events
          </div>
          <span className="text-[10px] text-slate-400">Recorded across all devices</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Security & Login Logs
          </span>
          <div className="text-xl font-bold font-mono text-blue-700 mt-0.5">
            {loginLogs.length} logs
          </div>
          <span className="text-[10px] text-blue-600">IP & session track</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Active Multi-Device Sessions
          </span>
          <div className="text-xl font-bold font-mono text-emerald-600 mt-0.5">
            {sessions.filter((s) => s.status === 'ACTIVE').length} active
          </div>
          <span className="text-[10px] text-emerald-600">Laptop / Mobile / PC</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Failed Access Attempts
          </span>
          <div className="text-xl font-bold font-mono text-rose-600 mt-0.5">
            {loginLogs.filter((l) => l.status === 'FAILED').length} rejected
          </div>
          <span className="text-[10px] text-rose-500">Security triggers</span>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200 gap-3 text-xs font-bold overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('BUSINESS_TRAIL')}
          className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 shrink-0 transition-colors ${
            activeTab === 'BUSINESS_TRAIL'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Business & RFQ Audit Trail ({filteredBusinessLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('IP_SECURITY_LOGS')}
          className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 shrink-0 transition-colors ${
            activeTab === 'IP_SECURITY_LOGS'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>IP Address & Device Access Logs ({filteredLoginLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ACTIVE_SESSIONS')}
          className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 shrink-0 transition-colors ${
            activeTab === 'ACTIVE_SESSIONS'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Active Sessions & Device Revocation ({sessions.length})</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeTab === 'BUSINESS_TRAIL'
                ? 'Search by actor, action, RFQ ID, remarks...'
                : 'Search by IP address, username, device, session...'
            }
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
        </div>

        {activeTab === 'IP_SECURITY_LOGS' && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUCCESS">Success Only</option>
            <option value="FAILED">Failed / Rejected Only</option>
          </select>
        )}

        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-medium"
          title="Filter by date"
        />

        {(search || dateFilter || statusFilter !== 'ALL') && (
          <button
            onClick={() => {
              setSearch('');
              setDateFilter('');
              setStatusFilter('ALL');
            }}
            className="text-xs font-semibold text-rose-600 hover:underline"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* TAB 1: Business Audit Trail */}
      {activeTab === 'BUSINESS_TRAIL' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100">
          {filteredBusinessLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No business audit entries matching current filters.
            </div>
          ) : (
            filteredBusinessLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors text-xs space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold font-mono px-2 py-0.5 rounded text-[11px] ${
                        log.action.includes('DELETED')
                          ? 'bg-rose-100 text-rose-800'
                          : log.action.includes('CREATED')
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-900'
                      }`}
                    >
                      {log.action}
                    </span>
                    <span className="font-mono font-bold text-blue-700">{log.entityId}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">({log.entityType})</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {log.timestamp}
                  </span>
                </div>

                <p className="text-slate-700 text-xs font-medium leading-relaxed">{log.details}</p>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>
                    Actor: <strong className="text-slate-800">{log.user}</strong> ({log.role.replace(/_/g, ' ')})
                  </span>

                  {log.oldValue && log.newValue && (
                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                      <span className="bg-red-50 text-red-700 px-1.5 py-0.2 rounded border border-red-200 line-through">
                        {log.oldValue}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200 font-bold">
                        {log.newValue}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: IP Address & Device Access Logs */}
      {activeTab === 'IP_SECURITY_LOGS' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User & Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Client IP Address</th>
                  <th className="py-3 px-4">Device & Browser</th>
                  <th className="py-3 px-4">Session ID</th>
                  <th className="py-3 px-4">Details / Failure Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredLoginLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                      No security audit records found for current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLoginLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {log.timestamp}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{log.username}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">{log.role}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.status === 'SUCCESS'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {log.status === 'SUCCESS' ? (
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <XCircle className="w-3 h-3 text-rose-600" />
                          )}
                          <span>{log.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800">
                          <Globe className="w-3.5 h-3.5 text-blue-500" />
                          <span>{log.ipAddress}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                          {getDeviceIcon(log.deviceType)}
                          <span>{log.deviceType || 'Desktop'}</span>
                        </div>
                        <div
                          className="text-[10px] text-slate-400 max-w-[200px] truncate"
                          title={log.userAgent}
                        >
                          {log.userAgent}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                        {log.sessionId}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {log.failureReason ? (
                          <span className="text-rose-600 font-semibold">{log.failureReason}</span>
                        ) : (
                          <span className="text-slate-400">Authorized login authenticated</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Active Sessions & Multi-Device Revocation */}
      {activeTab === 'ACTIVE_SESSIONS' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Multi-Device Access Management:</span> The ERP allows simultaneous logins from your laptop, mobile phone, and other PCs. Administrators can view all active devices and revoke unauthorized or lost sessions with one click.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                className={`bg-white rounded-2xl border p-4 shadow-2xs space-y-3 ${
                  sess.status === 'ACTIVE' ? 'border-slate-200' : 'border-rose-200 bg-rose-50/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getDeviceIcon(sess.deviceType)}
                    <span className="font-bold text-slate-900 text-xs">{sess.deviceType}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      sess.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {sess.status}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="font-bold text-slate-900">{sess.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">@{sess.username} ({sess.role})</div>
                  <div className="text-[11px] text-slate-600 flex items-center gap-1 font-mono pt-1">
                    <Globe className="w-3 h-3 text-slate-400" />
                    <span>IP: {sess.ipAddress}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Logged in: {sess.loginTime}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate" title={sess.id}>
                    Session: {sess.id}
                  </div>
                </div>

                {isAdmin && sess.status === 'ACTIVE' && (
                  <button
                    onClick={() => handleRevokeSession(sess.id, sess.username)}
                    className="w-full mt-2 py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Revoke Device Session</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
