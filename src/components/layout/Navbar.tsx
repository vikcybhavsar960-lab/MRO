import React, { useState } from 'react';
import {
  Bell,
  Search,
  Smartphone,
  Monitor,
  CheckCircle2,
  FileSpreadsheet,
  Building2,
  ShieldCheck,
  ChevronDown,
  UserCheck,
  ExternalLink,
  Database,
  HelpCircle,
  LogOut,
  RotateCcw,
  KeyRound,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { DataModeModal } from '../common/DataModeModal';
import { logoutComplete } from '../../services/supabaseAuthService';
import { isAdminRole, normalizeUserRole } from '../../utils/roleUtils';

interface NavbarProps {
  onOpenSearch: () => void;
  onOpenLoginModal: () => void;
  onOpenGoogleSheetsModal: () => void;
  onSignOutToLogin?: () => void;
  onOpenChangePassword?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSearch,
  onOpenLoginModal,
  onOpenGoogleSheetsModal,
  onSignOutToLogin,
  onOpenChangePassword,
}) => {
  const {
    currentUser,
    setCurrentUser,
    availableUsers,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    isMobileView,
    setIsMobileView,
    setActiveTab,
    dataMode,
    isSyncing,
    lastSyncTime,
    syncBackendNow,
    isOnline,
    cloudSyncState,
    branding,
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [isDataModeModalOpen, setIsDataModeModalOpen] = useState(false);
  const [dataModeModalTab, setDataModeModalTab] = useState<'switcher' | 'how-it-works' | 'backup'>('switcher');

  const unreadCount = notifications.filter(
    (n) => !n.read && (n.targetRole.includes(currentUser.role) || isAdminRole(currentUser.role, currentUser.username))
  ).length;

  const getRoleBadge = (role: UserRole | string) => {
    const normalized = normalizeUserRole(role, currentUser.username, currentUser.email);
    switch (normalized) {
      case 'SUPER_ADMIN':
        return { label: 'Super Admin', bg: 'bg-red-500/10 text-red-600 border-red-200' };
      case 'PURCHASE_MANAGER':
        return { label: 'Purchase Manager', bg: 'bg-indigo-500/10 text-indigo-700 border-indigo-200' };
      case 'PROCUREMENT_EMPLOYEE':
        return { label: 'Procurement & Sales', bg: 'bg-blue-500/10 text-blue-600 border-blue-200' };
      case 'SALES_EXECUTIVE':
        return { label: 'Sales Executive', bg: 'bg-cyan-500/10 text-cyan-700 border-cyan-200' };
      case 'APPROVAL_USER':
        return { label: 'Approval Authority', bg: 'bg-purple-500/10 text-purple-700 border-purple-200' };
      case 'ACCOUNTS_USER':
        return { label: 'Accounts & Finance', bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' };
      case 'STORE_USER':
        return { label: 'Store & Warehouse', bg: 'bg-teal-500/10 text-teal-700 border-teal-200' };
      case 'MANAGEMENT_VIEWER':
        return { label: 'Management Viewer', bg: 'bg-slate-500/10 text-slate-700 border-slate-200' };
      case 'VENDOR':
        return { label: 'Vendor Partner', bg: 'bg-purple-500/10 text-purple-600 border-purple-200' };
      case 'CUSTOMER':
        return { label: 'Customer Client', bg: 'bg-amber-500/10 text-amber-700 border-amber-200' };
      default:
        return { label: String(role), bg: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const currentBadge = getRoleBadge(currentUser.role);

  return (
    <>
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 h-16 flex items-center justify-between gap-2 px-2.5 sm:px-6 max-w-full overflow-x-clip">
      {/* Brand & Mobile toggle */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={branding.companyName || 'Company Logo'}
            className="h-9 sm:h-10 max-w-[96px] sm:max-w-[140px] object-contain rounded-lg p-0.5 border border-slate-200 bg-white shadow-xs shrink-0"
          />
        ) : (
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-extrabold text-slate-900 tracking-tight text-sm sm:text-lg truncate">
              {branding.erpName ? (
                branding.erpName
              ) : (
                <>
                  MRO <span className="text-blue-600">PROCUREMENT SOLUTION</span>
                </>
              )}
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 rounded border border-blue-200 shrink-0">
              Enterprise ERP
            </span>
          </div>
          <p className="text-[11px] text-slate-600 font-medium hidden md:block truncate">
            {branding.tagline || 'Industrial Procurement Management & B2B Supply Chain'}
          </p>
        </div>
      </div>

      {/* Center Search Bar Trigger */}
      <div className="hidden lg:flex items-center flex-1 max-w-md mx-6">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500 transition-colors shadow-xs group"
        >
          <span className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
            <span>Search Part #, REQ, QTN, PO, Vendor, Customer...</span>
          </span>
          <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded shadow-xs text-slate-400 font-mono">
            Ctrl + K
          </kbd>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1 sm:gap-3 shrink-0">
        {/* Mobile View Toggle */}
        <button
          onClick={() => setIsMobileView(!isMobileView)}
          title={isMobileView ? 'Switch to Desktop Web Admin' : 'Simulate Android Mobile App'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            isMobileView
              ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-xs'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          {isMobileView ? (
            <>
              <Smartphone className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">Android App</span>
            </>
          ) : (
            <>
              <Monitor className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Desktop Admin</span>
            </>
          )}
        </button>

        {/* Honest Supabase Cloud Database Status Pill */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setDataModeModalTab('switcher');
              setIsDataModeModalOpen(true);
            }}
            data-testid="navbar-cloud-status-btn"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all shadow-xs group cursor-pointer ${
              cloudSyncState.connected
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100 ring-1 ring-emerald-400/30'
                : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 ring-1 ring-amber-400/30'
            }`}
            title={
              cloudSyncState.connected
                ? `Connected to Supabase PostgreSQL (${cloudSyncState.projectId}). All changes persist across refreshes & multi-user sessions.`
                : 'Supabase keys pending configuration. Click to inspect Supabase PostgreSQL & Storage status.'
            }
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  cloudSyncState.connected ? (isOnline ? 'bg-emerald-400' : 'bg-red-400') : 'bg-amber-400'
                }`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  cloudSyncState.connected ? (isOnline ? 'bg-emerald-600' : 'bg-red-600') : 'bg-amber-500'
                }`}
              ></span>
            </span>
            <Database
              className={`w-3.5 h-3.5 ${cloudSyncState.connected ? 'text-emerald-700' : 'text-amber-700'}`}
            />
            <span className="hidden sm:inline">
              {cloudSyncState.connected ? 'Supabase PostgreSQL Live' : 'Supabase Setup Status'}
            </span>
            {cloudSyncState.connected && (
              <span className="text-[10px] font-medium text-emerald-700/80 hidden xl:inline">
                (Realtime)
              </span>
            )}
          </button>

          <button
            onClick={() => syncBackendNow()}
            disabled={isSyncing}
            className={`p-1.5 rounded-lg border text-xs text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border-slate-200 transition-all ${
              isSyncing ? 'animate-spin text-emerald-600 border-emerald-300 bg-emerald-50/50' : ''
            }`}
            title={`Last synchronized: ${lastSyncTime.toLocaleTimeString('en-IN')}. Click to refresh live database now.`}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Google Sheets Sync Button */}
        <button
          onClick={onOpenGoogleSheetsModal}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition-all shadow-xs"
          title="Google Sheets Live Integration"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>Google Sheets</span>
        </button>

        {/* Mobile Search Button */}
        <button
          onClick={onOpenSearch}
          className="lg:hidden p-2 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg"
          title="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                <span className="font-bold text-sm text-slate-900">Notifications ({unreadCount})</span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllNotificationsRead()}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-600">No notifications</div>
                ) : (
                  notifications.slice(0, 8).map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        markNotificationRead(notif.id);
                        if (notif.linkTab) setActiveTab(notif.linkTab);
                        setShowNotifications(false);
                      }}
                      className={`p-3 text-xs hover:bg-slate-50 cursor-pointer transition-colors ${
                        !notif.read ? 'bg-blue-50/40 font-medium' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-slate-800 text-xs">{notif.title}</span>
                        <span className="text-[10px] text-slate-600">{notif.timestamp}</span>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed">{notif.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Role Switcher Pill */}
        <div className="relative">
          <button
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all text-left"
          >
            <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs overflow-hidden">
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                currentUser.name.charAt(0)
              )}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-slate-800 leading-none truncate max-w-[120px]">
                {currentUser.name}
              </div>
              <div className={`mt-0.5 inline-block text-[10px] font-semibold px-1.5 py-0.2 rounded border ${currentBadge.bg}`}>
                {currentBadge.label}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
          </button>

          {showRoleMenu && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
              {/* Authenticated User Header Card */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
                    {currentUser.avatar ? (
                      <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      currentUser.name?.[0]?.toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 text-xs truncate">{currentUser.name}</div>
                    <div className="text-[11px] font-mono text-slate-500 truncate">{currentUser.email}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border ${currentBadge.bg}`}>
                        {currentBadge.label}
                      </span>
                      {currentUser.department && (
                        <span className="text-[10px] text-slate-400 truncate">• {currentUser.department}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu Actions */}
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setShowRoleMenu(false);
                    onOpenLoginModal();
                  }}
                  className="w-full text-left text-xs font-semibold text-slate-800 hover:text-blue-600 p-2 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Switch User / Account</span>
                  </span>
                  <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">Multi-User</span>
                </button>

                {isAdminRole(currentUser.role, currentUser.username) && (
                  <button
                    onClick={() => {
                      setShowRoleMenu(false);
                      setActiveTab('users');
                    }}
                    className="w-full text-left text-xs font-semibold text-slate-800 hover:text-indigo-600 p-2 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between"
                  >
                    <span>User Management (RBAC)</span>
                    <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">Admin</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowRoleMenu(false);
                    if (onOpenChangePassword) {
                      onOpenChangePassword();
                    }
                  }}
                  className="w-full text-left text-xs font-semibold text-slate-800 hover:text-indigo-600 p-2 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                    <span>Change Account Password</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Security</span>
                </button>

                <button
                  onClick={() => {
                    setShowRoleMenu(false);
                    setActiveTab('audit-log');
                  }}
                  className="w-full text-left text-xs font-semibold text-slate-800 hover:text-indigo-600 p-2 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between"
                >
                  <span>Security & IP Audit Logs</span>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Security</span>
                </button>

                <button
                  onClick={async () => {
                    setShowRoleMenu(false);
                    await logoutComplete(currentUser);
                    if (onSignOutToLogin) {
                      onSignOutToLogin();
                    } else {
                      onOpenLoginModal();
                    }
                  }}
                  className="w-full text-left text-xs font-bold text-rose-600 hover:text-rose-700 p-2 rounded-lg hover:bg-rose-50 transition-colors flex items-center justify-between border-t border-slate-100 pt-2.5 mt-1 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <LogOut className="w-3.5 h-3.5 text-rose-500" />
                    <span>Sign Out / Secure Logout</span>
                  </span>
                  <span className="text-[10px] text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">Lock</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
    {/* Dual Data Mode and Architecture Explainer Modal */}
    <DataModeModal
      isOpen={isDataModeModalOpen}
      onClose={() => setIsDataModeModalOpen(false)}
      initialTab={dataModeModalTab}
    />
    </>
  );
};
