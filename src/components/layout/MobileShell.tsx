import React, { useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  Truck,
  CheckCircle,
  Plus,
  Bell,
  Menu,
  X,
  Search,
  Building2,
  Building,
  Share2,
  Users,
  ShieldCheck,
  CreditCard,
  Wifi,
  Battery,
  Layers,
  ArrowRight,
  Database,
  Mail,
  FileSpreadsheet,
  Landmark,
  Package,
  Receipt,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DataModeModal } from '../common/DataModeModal';

interface MobileShellProps {
  children: React.ReactNode;
  onOpenSearch: () => void;
  onOpenNewReqModal: () => void;
  onOpenLoginModal: () => void;
  onSignOutToLogin?: () => void;
}

export const MobileShell: React.FC<MobileShellProps> = ({
  children,
  onOpenSearch,
  onOpenNewReqModal,
  onOpenLoginModal,
  onSignOutToLogin,
}) => {
  const { activeTab, setActiveTab, currentUser, notifications, setIsMobileView, branding, cloudSyncState } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isDataModeModalOpen, setIsDataModeModalOpen] = useState(false);

  const unreadCount = notifications.filter(
    (n) => !n.read && (n.targetRole.includes(currentUser.role) || currentUser.role === 'SUPER_ADMIN')
  ).length;

  const mobileNavTabs = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'requirements', label: 'Orders', icon: FileText },
    { id: 'dispatch', label: 'Dispatch', icon: Truck },
    { id: 'delivery', label: 'Tracking', icon: CheckCircle },
  ];

  return (
    <div className="min-h-screen bg-slate-900 flex justify-center p-0 sm:p-4 select-none">
      {/* Mobile Device Frame Container */}
      <div className="w-full sm:max-w-md bg-white sm:rounded-[36px] shadow-2xl overflow-hidden flex flex-col h-screen sm:h-[880px] border sm:border-8 sm:border-slate-800 relative">
        {/* Android Status Bar */}
        <div className="bg-slate-900 text-white px-5 py-1.5 flex items-center justify-between text-[11px] font-medium shrink-0">
          <span>09:41</span>
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3 h-3 text-slate-300" />
            <span className="text-[10px]">5G</span>
            <Battery className="w-3.5 h-3.5 text-slate-300" />
          </div>
        </div>

        {/* Mobile App Bar */}
        <header className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-300"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              {branding.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt="App Logo"
                  className="w-7 h-7 rounded-lg object-contain bg-white p-0.5"
                />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
                  MRO
                </div>
              )}
              <div>
                <h1 className="font-bold text-xs tracking-tight leading-none truncate max-w-[130px]">
                  {branding.erpName || 'MRO PROCUREMENT'}
                </h1>
                <span className="text-[10px] text-blue-300 font-medium">SOLUTION Mobile</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onOpenSearch}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 relative"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500"></span>
              )}
            </button>
            <button
              onClick={() => setIsMobileView(false)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-bold text-slate-200 border border-slate-700 ml-1"
              title="Return to Desktop View"
            >
              Desktop
            </button>
          </div>
        </header>

        {/* Current Role Banner */}
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-1.5 flex items-center justify-between text-xs shrink-0">
          <span className="text-[11px] font-medium text-slate-700 truncate max-w-[200px]">
            User: <strong>{currentUser.name}</strong>
          </span>
          <button
            onClick={onOpenLoginModal}
            className="text-[10px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200"
          >
            Switch Role
          </button>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 relative pb-16">
          {children}
        </main>

        {/* Floating Quick Action Button */}
        {(currentUser.role === 'SUPER_ADMIN' ||
          currentUser.role === 'PURCHASE_MANAGER' ||
          currentUser.role === 'PROCUREMENT_EMPLOYEE' ||
          currentUser.role === 'SALES_EXECUTIVE' ||
          currentUser.role === 'CUSTOMER') && (
          <button
            onClick={onOpenNewReqModal}
            className="absolute bottom-20 right-4 w-12 h-12 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-20"
            title="Create New Requirement"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}

        {/* Mobile Bottom Navigation Bar */}
        <nav className="h-14 bg-white border-t border-slate-200 flex items-center justify-around px-2 shrink-0 z-10 shadow-lg">
          {mobileNavTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                  isActive ? 'text-blue-600 font-bold' : 'text-slate-600 font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                <span className="text-[10px] mt-0.5">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Android Navigation Pill */}
        <div className="bg-white py-1 flex justify-center shrink-0">
          <div className="w-28 h-1 bg-slate-300 rounded-full"></div>
        </div>

        {/* Side Drawer */}
        {drawerOpen && (
          <div className="absolute inset-0 bg-slate-900/60 z-50 flex">
            <div className="w-4/5 max-w-xs bg-slate-900 text-slate-200 h-full p-4 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-200">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm">
                      MRO
                    </div>
                    <div>
                      <h2 className="font-bold text-white text-xs">MRO PROCUREMENT SOLUTION</h2>
                      <p className="text-[10px] text-slate-400">Mobile ERP Navigation</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-4 space-y-1 text-xs">
                  <button
                    onClick={() => {
                      setActiveTab('dashboard');
                      setDrawerOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2.5"
                  >
                    <LayoutDashboard className="w-4 h-4 text-blue-400" />
                    <span>Dashboard</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('email-rfq');
                      setDrawerOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2.5"
                  >
                    <Mail className="w-4 h-4 text-rose-400" />
                    <span>Email RFQ Inbox</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('sales-billing');
                      setDrawerOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2.5"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                    <span>Sales & Invoicing</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('purchase-bills');
                      setDrawerOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2.5"
                  >
                    <Receipt className="w-4 h-4 text-amber-400" />
                    <span>Purchase Bills</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('accounting');
                      setDrawerOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2.5"
                  >
                    <Landmark className="w-4 h-4 text-emerald-400" />
                    <span>Cash, Bank & Ledgers</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('inventory');
                      setDrawerOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2.5"
                  >
                    <Package className="w-4 h-4 text-indigo-400" />
                    <span>Inventory & Stock</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('requirements');
                      setDrawerOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2.5"
                  >
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span>Requirements (REQ)</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('rate-comparison');
                      setDrawerOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2.5"
                  >
                    <Layers className="w-4 h-4 text-purple-400" />
                    <span>Rate Comparison</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('quotations');
                      setDrawerOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2.5"
                  >
                    <CreditCard className="w-4 h-4 text-amber-400" />
                    <span>Quotations (QTN)</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('dispatch');
                      setDrawerOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2.5"
                  >
                    <Truck className="w-4 h-4 text-cyan-400" />
                    <span>Dispatch & LR</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('delivery');
                      setDrawerOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2.5"
                  >
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>Delivery Tracking</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('customers');
                      setDrawerOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2.5"
                  >
                    <Users className="w-4 h-4 text-blue-400" />
                    <span>Customers Master</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('vendors');
                      setDrawerOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2.5"
                  >
                    <Building className="w-4 h-4 text-amber-400" />
                    <span>Vendors Master</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('users');
                      setDrawerOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2.5"
                  >
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span>User Management (RBAC)</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('reports');
                      setDrawerOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2.5"
                  >
                    <Share2 className="w-4 h-4 text-teal-400" />
                    <span>Reports & Sheets</span>
                  </button>
                </div>
              </div>

              {/* Data Mode Switcher in Mobile Drawer */}
              <div className="pt-4 border-t border-slate-800 space-y-2">
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    setIsDataModeModalOpen(true);
                  }}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-between border ${
                    cloudSyncState.connected
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : 'bg-amber-950 text-amber-200 border-amber-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Database className={`w-4 h-4 ${cloudSyncState.connected ? 'text-emerald-400' : 'text-amber-400'}`} />
                    <span>{cloudSyncState.connected ? 'Cloud Firestore Live' : 'Connect Cloud DB (Google)'}</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    onOpenLoginModal();
                  }}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  Switch Testing Persona
                </button>

                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    localStorage.setItem('mro_is_logged_out', 'true');
                    if (onSignOutToLogin) {
                      onSignOutToLogin();
                    } else {
                      onOpenLoginModal();
                    }
                  }}
                  className="w-full py-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-200 rounded-lg text-xs font-bold transition-colors"
                >
                  Sign Out / Password Login
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Data Mode Modal for Mobile */}
        <DataModeModal
          isOpen={isDataModeModalOpen}
          onClose={() => setIsDataModeModalOpen(false)}
        />
      </div>
    </div>
  );
};
