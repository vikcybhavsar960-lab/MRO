import React, { Suspense, lazy, useEffect, useState } from 'react';
import { ShoppingCart, PackageCheck, Receipt, CreditCard, Truck, CheckCircle2 } from 'lucide-react';
import { AppProvider, useApp } from '../context/AppContext';
import { Navbar } from './layout/Navbar';
import { Sidebar } from './layout/Sidebar';
import { MobileShell } from './layout/MobileShell';
import { AccessDeniedView } from './common/AccessDeniedView';
import { SessionExpiryModal } from './auth/SessionExpiryModal';
import { fetchApi, clearAuthSession, getCurrentSessionId } from '../utils/apiClient';
import { loadWithRetry } from '../utils/lazyImportWithRetry';
import { EmailRfqItem, User } from '../types';

function lazyNamed<T extends Record<string, any>, K extends keyof T>(
  loader: () => Promise<T>,
  exportName: K
): React.LazyExoticComponent<T[K]> {
  return lazy(async () => {
    const m = await loadWithRetry(loader);
    return { default: m[exportName] };
  });
}

// Lazy-loaded ERP route views (isolated from Login & initial bundle)
const DashboardView = lazyNamed(() => import('./dashboard/DashboardView'), 'DashboardView');
const RequirementListAndDetail = lazyNamed(() => import('./workflow/RequirementListAndDetail'), 'RequirementListAndDetail');
const RateComparisonView = lazyNamed(() => import('./workflow/RateComparisonView'), 'RateComparisonView');
const QuotationView = lazyNamed(() => import('./workflow/QuotationView'), 'QuotationView');
const DirectVendorRatesView = lazyNamed(() => import('./workflow/DirectVendorRatesView'), 'DirectVendorRatesView');
const CustomerMaster = lazyNamed(() => import('./masters/CustomerMaster'), 'CustomerMaster');
const CompanyMaster = lazyNamed(() => import('./masters/CompanyMaster'), 'CompanyMaster');
const PurchaseExecutiveMaster = lazyNamed(() => import('./masters/PurchaseExecutiveMaster'), 'PurchaseExecutiveMaster');
const VendorMaster = lazyNamed(() => import('./masters/VendorMaster'), 'VendorMaster');
const BrandMaster = lazyNamed(() => import('./masters/BrandMaster'), 'BrandMaster');
const BrandCatalogueBrowser = lazyNamed(() => import('./catalog/BrandCatalogueBrowser'), 'BrandCatalogueBrowser');
const CategoryMaster = lazyNamed(() => import('./masters/CategoryMaster'), 'CategoryMaster');
const ProductMaster = lazyNamed(() => import('./masters/ProductMaster'), 'ProductMaster');
const ReportsView = lazyNamed(() => import('./reports/ReportsView'), 'ReportsView');
const CompanyExecutiveReportsView = lazyNamed(() => import('./reports/CompanyExecutiveReportsView'), 'CompanyExecutiveReportsView');
const DocumentCenter = lazyNamed(() => import('./documents/DocumentCenter'), 'DocumentCenter');
const AuditLogView = lazyNamed(() => import('./audit/AuditLogView'), 'AuditLogView');
const BackupRecoveryView = lazyNamed(() => import('./settings/BackupRecoveryView'), 'BackupRecoveryView');
const ErpBrandingSettingsView = lazyNamed(() => import('./settings/ErpBrandingSettingsView'), 'ErpBrandingSettingsView');
const ThemeManagerView = lazyNamed(() => import('./settings/ThemeManagerView'), 'ThemeManagerView');
const UserManagementView = lazyNamed(() => import('./users/UserManagementView'), 'UserManagementView');
const SalesBillingView = lazyNamed(() => import('./sales/SalesBillingView'), 'SalesBillingView');
const PurchaseBillsView = lazyNamed(() => import('./purchase/PurchaseBillsView'), 'PurchaseBillsView');
const AccountingView = lazyNamed(() => import('./accounting/AccountingView'), 'AccountingView');
const EmailRfqInboxView = lazyNamed(() => import('./email/EmailRfqInboxView'), 'EmailRfqInboxView');
const InventoryManagementView = lazyNamed(() => import('./inventory/InventoryManagementView'), 'InventoryManagementView');

// Lazy-loaded Modals (includes xlsx/jspdf/heavy workflows only when opened)
const GlobalSearchModal = lazyNamed(() => import('./common/GlobalSearchModal'), 'GlobalSearchModal');
const LoginModal = lazyNamed(() => import('./auth/LoginModal'), 'LoginModal');
const GoogleSheetsModal = lazyNamed(() => import('./reports/GoogleSheetsModal'), 'GoogleSheetsModal');
const OrderTimelineModal = lazyNamed(() => import('./workflow/OrderTimelineModal'), 'OrderTimelineModal');
const NewRequirementModal = lazyNamed(() => import('./workflow/NewRequirementModal'), 'NewRequirementModal');
const VendorRateSubmissionModal = lazyNamed(() => import('./workflow/VendorRateSubmissionModal'), 'VendorRateSubmissionModal');
const DirectVendorRateEntryModal = lazyNamed(() => import('./workflow/DirectVendorRateEntryModal'), 'DirectVendorRateEntryModal');
const NewQuotationModal = lazyNamed(() => import('./workflow/NewQuotationModal'), 'NewQuotationModal');
const CustomerPOModal = lazyNamed(() => import('./workflow/CustomerPOModal'), 'CustomerPOModal');
const VendorPOModal = lazyNamed(() => import('./workflow/VendorPOModal'), 'VendorPOModal');
const ProformaInvoiceModal = lazyNamed(() => import('./workflow/ProformaInvoiceModal'), 'ProformaInvoiceModal');
const PaymentModal = lazyNamed(() => import('./workflow/PaymentModal'), 'PaymentModal');
const DispatchModal = lazyNamed(() => import('./workflow/DispatchModal'), 'DispatchModal');
const DeliveryModal = lazyNamed(() => import('./workflow/DeliveryModal'), 'DeliveryModal');
const EarningRulesAndLockModal = lazyNamed(() => import('./workflow/EarningRulesAndLockModal'), 'EarningRulesAndLockModal');
const ChangePasswordModal = lazyNamed(() => import('./auth/ChangePasswordModal'), 'ChangePasswordModal');

const ModuleLoadingFallback: React.FC = () => (
  <div className="p-8 flex items-center justify-center min-h-[320px]">
    <div className="flex flex-col items-center gap-3 text-slate-500">
      <div className="w-7 h-7 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      <span className="text-xs font-semibold tracking-wide">Loading ERP module...</span>
    </div>
  </div>
);

interface ErpAuthenticatedShellProps {
  authenticatedUser: User;
  initialTab?: string;
  initialMustChangePassword?: boolean;
  onSignedOut: (sessionExpired?: boolean) => void;
}

const ErpShellContent: React.FC<ErpAuthenticatedShellProps> = ({
  authenticatedUser,
  initialMustChangePassword = false,
  onSignedOut,
}) => {
  const {
    activeTab,
    setActiveTab,
    selectedOrderId,
    setSelectedOrderId,
    isMobileView,
    customerPOs,
    vendorPOs,
    proformaInvoices,
    payments,
    dispatches,
    deliveries,
    currentUser,
    setCurrentUser,
  } = useApp();

  // Password Change & Security Modal State
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(initialMustChangePassword);
  const [isForcedFirstLogin, setIsForcedFirstLogin] = useState(initialMustChangePassword);

  // Auto Session Inactivity State
  const [isSessionExpiryWarningOpen, setIsSessionExpiryWarningOpen] = useState(false);
  const [inactivitySecondsLeft, setInactivitySecondsLeft] = useState(120);

  // Modals state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isGoogleSheetsOpen, setIsGoogleSheetsOpen] = useState(false);
  const [isNewReqOpen, setIsNewReqOpen] = useState(false);
  const [pendingEmailDraft, setPendingEmailDraft] = useState<EmailRfqItem | null>(null);
  const [rateSubmissionEnquiryId, setRateSubmissionEnquiryId] = useState<string | null>(null);
  const [rateSubmissionReqId, setRateSubmissionReqId] = useState<string | null>(null);
  const [quotationParams, setQuotationParams] = useState<{ reqId?: string; quoteId?: string } | null>(null);
  const [cpoReqId, setCpoReqId] = useState<string | null>(null);
  const [vpoReqId, setVpoReqId] = useState<string | null>(null);
  const [piVpoId, setPiVpoId] = useState<string | null>(null);
  const [payPiId, setPayPiId] = useState<string | null>(null);
  const [dspReqId, setDspReqId] = useState<string | null>(null);
  const [delReqId, setDelReqId] = useState<string | null>(null);
  const [verifyOrderAuditId, setVerifyOrderAuditId] = useState<string | null>(null);

  // Sync authoritative authenticatedUser from login/verify-session into AppContext
  useEffect(() => {
    if (authenticatedUser && authenticatedUser.id) {
      setCurrentUser(authenticatedUser);
    }
  }, [authenticatedUser, setCurrentUser]);

  // Sync URL cleanly to active ERP route without reloading
  useEffect(() => {
    if (typeof window !== 'undefined' && activeTab) {
      const targetPath = `/${activeTab}`;
      if (window.location.pathname !== targetPath) {
        window.history.replaceState(null, '', `${targetPath}${window.location.search}`);
      }
    }
  }, [activeTab]);

  // Check URL parameters for direct email verification links
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const verifyId = params.get('verifyOrder') || params.get('orderId');
      if (verifyId) {
        setVerifyOrderAuditId(verifyId);
      }
    }
  }, []);

  // Global Ctrl+K / Cmd+K Command Center Shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto Session Inactivity Detection (15 min idle window)
  useEffect(() => {
    let warningTimer: any = null;
    let countdownInterval: any = null;
    const INACTIVITY_LIMIT_MS = 13 * 60 * 1000;

    const handleAutoLogout = async () => {
      setIsSessionExpiryWarningOpen(false);
      try {
        const { logoutComplete } = await import('../services/supabaseAuthService');
        await logoutComplete(currentUser);
      } catch {
        clearAuthSession();
      }
      onSignedOut(true);
    };

    const resetInactivityTimer = () => {
      if (isSessionExpiryWarningOpen) return;
      clearTimeout(warningTimer);
      clearInterval(countdownInterval);

      warningTimer = setTimeout(() => {
        setIsSessionExpiryWarningOpen(true);
        setInactivitySecondsLeft(120);

        countdownInterval = setInterval(() => {
          setInactivitySecondsLeft((prev) => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              handleAutoLogout();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }, INACTIVITY_LIMIT_MS);
    };

    const userActivityEvents = ['mousemove', 'keydown', 'pointerdown', 'scroll', 'touchstart'];
    userActivityEvents.forEach((evt) => window.addEventListener(evt, resetInactivityTimer));
    resetInactivityTimer();

    return () => {
      clearTimeout(warningTimer);
      clearInterval(countdownInterval);
      userActivityEvents.forEach((evt) => window.removeEventListener(evt, resetInactivityTimer));
    };
  }, [isSessionExpiryWarningOpen, currentUser, onSignedOut]);

  const handleContinueSession = async () => {
    setIsSessionExpiryWarningOpen(false);
    try {
      const sessionId = getCurrentSessionId();
      await fetchApi('/api/auth/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
        timeoutMs: 4000,
      });
    } catch {}
  };

  const handleManualSignOut = async () => {
    setIsSessionExpiryWarningOpen(false);
    try {
      const { logoutComplete } = await import('../services/supabaseAuthService');
      await logoutComplete(currentUser);
    } catch {
      clearAuthSession();
    }
    onSignedOut(false);
  };

  // Role-Based Module Permission Check
  const checkTabPermission = (tab: string): boolean => {
    const roleUpper = (currentUser.role || '').toUpperCase();
    if (roleUpper === 'SUPER_ADMIN' || roleUpper === 'ADMIN' || (currentUser as any).username === 'admin') {
      return true;
    }

    const perms = currentUser.permissions?.modules;
    if (!perms) return true;

    switch (tab) {
      case 'dashboard':
        return perms.dashboard !== false;
      case 'requirements':
        return perms.requirements !== false;
      case 'rfq':
      case 'rfq-management':
      case 'rfqs':
      case 'vendor-rates':
      case 'rate-comparison':
        return perms.rateComparison !== false;
      case 'quotations':
        return perms.quotations !== false;
      case 'customer-pos':
        return perms.customerPos !== false;
      case 'vendor-pos':
      case 'purchase-orders':
        return perms.vendorPos !== false;
      case 'proforma-invoices':
      case 'pi':
        return perms.pi !== false;
      case 'payments':
        return perms.payments !== false;
      case 'dispatches':
      case 'dispatch':
        return perms.dispatch !== false;
      case 'deliveries':
      case 'delivery':
        return perms.delivery !== false;
      case 'customers':
        return perms.customers !== false;
      case 'vendors':
        return perms.vendors !== false;
      case 'brands':
      case 'brand-catalogue':
      case 'categories':
      case 'products':
        return perms.products !== false;
      case 'reports':
      case 'company-reports':
        return perms.reports !== false;
      case 'documents':
        return perms.documents !== false;
      case 'approvals':
        return perms.dashboard !== false;
      case 'users':
        return perms.userManagement !== false && (roleUpper === 'SUPER_ADMIN' || roleUpper === 'ADMIN');
      case 'audit-log':
        return perms.auditTrail !== false;
      case 'backup-recovery':
      case 'branding-settings':
      case 'theme-settings':
        return roleUpper === 'SUPER_ADMIN' || roleUpper === 'ADMIN';
      default:
        return true;
    }
  };

  const renderTabContent = () => {
    if (!checkTabPermission(activeTab)) {
      return (
        <AccessDeniedView
          moduleName={activeTab.toUpperCase().replace('-', ' ')}
          onReturnToDashboard={() => setActiveTab('dashboard')}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            onOpenNewReq={() => setIsNewReqOpen(true)}
            onOpenNewCustomer={() => setActiveTab('customers')}
            onOpenNewVendor={() => setActiveTab('vendors')}
            onOpenNewEnquiry={() => setActiveTab('requirements')}
            onOpenNewQuotation={() => setQuotationParams({})}
            onOpenGoogleSheets={() => setIsGoogleSheetsOpen(true)}
            onSelectOrder={(id) => setSelectedOrderId(id)}
          />
        );

      case 'requirements':
        return (
          <RequirementListAndDetail
            onOpenNewModal={() => setIsNewReqOpen(true)}
            onOpenRateModal={(reqId) => setRateSubmissionReqId(reqId)}
            onSelectOrder={(id) => setSelectedOrderId(id)}
          />
        );

      case 'rfq':
      case 'rfq-management':
      case 'rfqs':
      case 'vendor-rates':
        return (
          <DirectVendorRatesView
            onOpenRateComparison={(_reqId) => setActiveTab('rate-comparison')}
            onSelectOrder={(id) => setSelectedOrderId(id)}
          />
        );

      case 'rate-comparison':
        return (
          <RateComparisonView
            onProceedToQuotation={(reqId, quoteId) => setQuotationParams({ reqId, quoteId })}
            onSelectOrder={(id) => setSelectedOrderId(id)}
          />
        );

      case 'quotations':
        return (
          <QuotationView
            onOpenNewQuotationModal={() => setQuotationParams({})}
            onSelectOrder={(id) => setSelectedOrderId(id)}
          />
        );

      case 'customer-pos':
        return (
          <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                  <span>Customer Purchase Orders (CPO)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stage 5 of 10: Inward buyer purchase orders, delivery destination, and payment commitments
                </p>
              </div>

              {(currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'PURCHASE_MANAGER' || currentUser.role === 'PROCUREMENT_EMPLOYEE' || currentUser.role === 'SALES_EXECUTIVE') && (
                <button
                  onClick={() => setCpoReqId('REQ-2026-00003')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20"
                >
                  Record New Customer PO
                </button>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">PO Number</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Requirement Ref</th>
                    <th className="py-3 px-4">PO Date</th>
                    <th className="py-3 px-4">Payment Terms</th>
                    <th className="py-3 px-4 text-right">PO Amount (INR)</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {customerPOs.map((cpo) => (
                    <tr key={cpo.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                        {cpo.id} ({cpo.customerPoNumber})
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{cpo.customerName}</td>
                      <td className="py-3.5 px-4 font-mono">{cpo.requirementId}</td>
                      <td className="py-3.5 px-4">{cpo.poDate}</td>
                      <td className="py-3.5 px-4">{cpo.paymentTerms}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-right">
                        ₹{cpo.poAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedOrderId(cpo.requirementId)}
                          className="px-3 py-1 bg-slate-900 hover:bg-black text-white rounded-md text-[11px] font-bold"
                        >
                          Trace
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'vendor-pos':
      case 'purchase-orders':
        return (
          <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-blue-600" />
                  <span>Vendor Purchase Orders (VPO)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stage 6 of 10: Binding procurement orders placed with authorized distributors
                </p>
              </div>

              {(currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'PURCHASE_MANAGER' || currentUser.role === 'PROCUREMENT_EMPLOYEE' || currentUser.role === 'SALES_EXECUTIVE') && (
                <button
                  onClick={() => setVpoReqId('REQ-2026-00003')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20"
                >
                  Issue New Vendor PO
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vendorPOs.map((vpo) => (
                <div key={vpo.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono font-bold text-xs text-indigo-700">{vpo.id}</span>
                      <h4 className="font-bold text-sm text-slate-900">{vpo.vendorName}</h4>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-500">{vpo.poDate}</span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <div>Delivery To: <strong>{vpo.deliveryAddress}</strong></div>
                    <div>Payment: <strong>{vpo.paymentTerms}</strong></div>
                    <div>Linked Requirement: <strong className="font-mono text-blue-700">{vpo.requirementId}</strong></div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Amount</span>
                      <span className="font-black text-slate-900 font-mono text-sm">
                        ₹{vpo.totalAmount.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPiVpoId(vpo.id)}
                        className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-md font-bold"
                      >
                        Upload PI
                      </button>
                      <button
                        onClick={() => setSelectedOrderId(vpo.requirementId)}
                        className="px-3 py-1 bg-slate-900 text-white rounded-md font-bold"
                      >
                        Timeline
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'pi':
        return (
          <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-blue-600" />
                  <span>Vendor Proforma Invoices (PI)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stage 7 of 10: Tax breakdown, wire coordinates, and payment due schedules
                </p>
              </div>

              {(currentUser.role === 'VENDOR' || currentUser.role === 'SUPER_ADMIN') && (
                <button
                  onClick={() => setPiVpoId(vendorPOs[0]?.id || 'VPO-2026-00001')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20"
                >
                  Upload New Proforma Invoice
                </button>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">PI Identifier</th>
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-4">Date & Due Date</th>
                    <th className="py-3 px-4">Taxable Amount</th>
                    <th className="py-3 px-4">GST Tax</th>
                    <th className="py-3 px-4 text-right">Total PI Value (INR)</th>
                    <th className="py-3 px-4 text-right">Accounts Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {proformaInvoices.map((pi) => (
                    <tr key={pi.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                        {pi.id} ({pi.piNumber})
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{pi.vendorName}</td>
                      <td className="py-3.5 px-4">{pi.piDate} • Due: {pi.paymentDueDate}</td>
                      <td className="py-3.5 px-4 font-mono">₹{pi.amount.toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4 font-mono">₹{pi.gstAmount.toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-right">
                        ₹{pi.totalAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setPayPiId(pi.id)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold"
                        >
                          Disburse
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'payments':
        return (
          <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  <span>Accounts Payment Management (PAY)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stage 8 of 10: Wire remittances, bank UTR references, and vendor dispatch release
                </p>
              </div>

              {(currentUser.role === 'ACCOUNTS_USER' || currentUser.role === 'SUPER_ADMIN') && (
                <button
                  onClick={() => setPayPiId(proformaInvoices[0]?.id || 'PI-2026-00001')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20"
                >
                  Record Disbursal
                </button>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Payment Ref</th>
                    <th className="py-3 px-4">Vendor Beneficiary</th>
                    <th className="py-3 px-4">Payment Date</th>
                    <th className="py-3 px-4">Mode & UTR Reference</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Amount Disbursed (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">{p.id}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{p.vendorName}</td>
                      <td className="py-3.5 px-4">{p.paymentDate}</td>
                      <td className="py-3.5 px-4 font-mono">
                        <span className="font-bold text-slate-900">{p.paymentMode}</span> • {p.transactionReference}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-right">
                        ₹{p.amountPaid.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'dispatch':
        return (
          <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-600" />
                  <span>Logistics & Dispatch Management (DSP)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stage 9 of 10: Transporter bilty, LR / AWB numbers, and transit tracking
                </p>
              </div>

              {(currentUser.role === 'VENDOR' || currentUser.role === 'SUPER_ADMIN') && (
                <button
                  onClick={() => setDspReqId('REQ-2026-00003')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20"
                >
                  Create Consignment Dispatch
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dispatches.map((d) => (
                <div key={d.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono font-bold text-xs text-cyan-700">{d.id}</span>
                      <h4 className="font-bold text-sm text-slate-900">{d.transporter}</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                      LR: {d.lrNumber}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <div>Vendor Invoice: <strong>{d.vendorInvoiceNumber}</strong></div>
                    <div>Quantity & Crates: <strong>{d.quantityDispatched}</strong></div>
                    <div>ETA Delivery: <strong>{d.expectedDeliveryDate}</strong></div>
                    <div>Linked Requirement: <strong className="font-mono text-blue-700">{d.requirementId}</strong></div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                    <button
                      onClick={() => setDelReqId(d.requirementId)}
                      className="px-3 py-1 bg-emerald-600 text-white rounded-md font-bold"
                    >
                      Update Tracking
                    </button>
                    <button
                      onClick={() => setSelectedOrderId(d.requirementId)}
                      className="px-3 py-1 bg-slate-900 text-white rounded-md font-bold"
                    >
                      View Timeline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'delivery':
        return (
          <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  <span>Shipment Delivery & Order Closure</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stage 10 of 10: Customer receipt verification, POD inspection, and final closure
                </p>
              </div>

              <button
                onClick={() => setDelReqId('REQ-2026-00002')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20"
              >
                Confirm Site Delivery
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Delivery Ref</th>
                    <th className="py-3 px-4">Order Ref</th>
                    <th className="py-3 px-4">Delivery Date</th>
                    <th className="py-3 px-4">Receiver Incharge</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {deliveries.map((del) => (
                    <tr key={del.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">{del.id}</td>
                      <td className="py-3.5 px-4 font-mono font-bold">{del.requirementId}</td>
                      <td className="py-3.5 px-4">{del.deliveryDate}</td>
                      <td className="py-3.5 px-4">{del.receivedBy || 'Pending receipt'}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                          {del.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedOrderId(del.requirementId)}
                          className="px-3 py-1 bg-slate-900 text-white rounded-md text-[11px] font-bold"
                        >
                          Trace
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'companies':
        return <CompanyMaster />;
      case 'purchase-executives':
        return <PurchaseExecutiveMaster />;
      case 'customers':
        return <CustomerMaster />;
      case 'vendors':
        return <VendorMaster />;
      case 'brands':
        return <BrandMaster onNavigateToVendors={() => setActiveTab('vendors')} />;
      case 'brand-catalogue':
        return (
          <BrandCatalogueBrowser
            onNavigateToProducts={() => setActiveTab('products')}
            onSelectProductForDirectRate={() => setActiveTab('vendor-rates')}
            onSelectProductForRfq={() => setActiveTab('requirements')}
          />
        );
      case 'categories':
        return <CategoryMaster />;
      case 'products':
        return <ProductMaster />;
      case 'reports':
        return <ReportsView />;
      case 'company-reports':
        return <CompanyExecutiveReportsView />;
      case 'documents':
        return <DocumentCenter />;
      case 'audit-log':
        return <AuditLogView />;
      case 'backup-recovery':
        return <BackupRecoveryView />;
      case 'sales-billing':
        return <SalesBillingView />;
      case 'purchase-bills':
        return <PurchaseBillsView />;
      case 'accounting':
        return <AccountingView />;
      case 'email-rfq':
        return (
          <EmailRfqInboxView
            onOpenRequirement={(reqId) => {
              setSelectedOrderId(reqId);
              setActiveTab('requirements');
            }}
            onOpenInRequirementForm={(email) => {
              setPendingEmailDraft(email);
              setIsNewReqOpen(true);
            }}
          />
        );
      case 'inventory':
        return <InventoryManagementView />;
      case 'users':
        return <UserManagementView />;
      case 'approvals':
        return (
          <DashboardView
            onOpenNewReq={() => setIsNewReqOpen(true)}
            onOpenNewCustomer={() => setActiveTab('customers')}
            onOpenNewVendor={() => setActiveTab('vendors')}
            onOpenNewEnquiry={() => setActiveTab('requirements')}
            onOpenNewQuotation={() => setQuotationParams({})}
            onOpenGoogleSheets={() => setIsGoogleSheetsOpen(true)}
            onSelectOrder={(id) => setSelectedOrderId(id)}
          />
        );
      case 'branding-settings':
        return <ErpBrandingSettingsView />;
      case 'theme-settings':
        return <ThemeManagerView />;
      default:
        return (
          <DashboardView
            onOpenNewReq={() => setIsNewReqOpen(true)}
            onOpenNewCustomer={() => setActiveTab('customers')}
            onOpenNewVendor={() => setActiveTab('vendors')}
            onOpenNewEnquiry={() => setActiveTab('requirements')}
            onOpenNewQuotation={() => setQuotationParams({})}
            onOpenGoogleSheets={() => setIsGoogleSheetsOpen(true)}
            onSelectOrder={(id) => setSelectedOrderId(id)}
          />
        );
    }
  };

  return (
    <>
      {isMobileView ? (
        <MobileShell
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenNewReqModal={() => setIsNewReqOpen(true)}
          onOpenLoginModal={() => setIsLoginOpen(true)}
          onSignOutToLogin={handleManualSignOut}
        >
          <Suspense fallback={<ModuleLoadingFallback />}>{renderTabContent()}</Suspense>
        </MobileShell>
      ) : (
        <div className="min-h-screen bg-slate-50 flex flex-col antialiased overflow-x-hidden">
          <Navbar
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenLoginModal={() => setIsLoginOpen(true)}
            onOpenGoogleSheetsModal={() => setIsGoogleSheetsOpen(true)}
            onSignOutToLogin={handleManualSignOut}
            onOpenChangePassword={() => {
              setIsForcedFirstLogin(false);
              setIsChangePasswordOpen(true);
            }}
          />

          <div className="flex-1 flex overflow-x-hidden min-w-0">
            <Sidebar />
            <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
              <Suspense fallback={<ModuleLoadingFallback />}>{renderTabContent()}</Suspense>
            </main>
          </div>
        </div>
      )}

      {/* Lazy-Loaded Modals */}
      <Suspense fallback={null}>
        {isSearchOpen && (
          <GlobalSearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            onSelectOrder={(id) => setSelectedOrderId(id)}
          />
        )}

        {isLoginOpen && <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />}

        {isGoogleSheetsOpen && (
          <GoogleSheetsModal isOpen={isGoogleSheetsOpen} onClose={() => setIsGoogleSheetsOpen(false)} />
        )}

        {selectedOrderId && (
          <OrderTimelineModal
            orderId={selectedOrderId}
            onClose={() => setSelectedOrderId(null)}
            onOpenRateEntry={(reqId) => setRateSubmissionReqId(reqId)}
            onOpenRateComparison={() => {
              setActiveTab('rate-comparison');
              setSelectedOrderId(null);
            }}
            onOpenQuotation={(reqId) => setQuotationParams({ reqId })}
            onOpenCustomerPo={(reqId) => setCpoReqId(reqId)}
            onOpenVendorPo={(reqId) => setVpoReqId(reqId)}
            onOpenVendorPi={(vpoId) => setPiVpoId(vpoId)}
            onOpenPayment={(piId) => setPayPiId(piId)}
            onOpenDispatch={(reqId) => setDspReqId(reqId)}
            onOpenDelivery={(reqId) => setDelReqId(reqId)}
          />
        )}

        {rateSubmissionReqId && (
          <DirectVendorRateEntryModal
            isOpen={true}
            defaultRequirementId={rateSubmissionReqId}
            onClose={() => setRateSubmissionReqId(null)}
            onSuccess={() => setRateSubmissionReqId(null)}
          />
        )}

        {isNewReqOpen && (
          <NewRequirementModal
            isOpen={isNewReqOpen}
            initialEmailDraft={pendingEmailDraft}
            onEmailDraftConverted={(_emailId, reqId) => {
              setPendingEmailDraft(null);
              setIsNewReqOpen(false);
              setSelectedOrderId(reqId);
              setActiveTab('requirements');
            }}
            onClose={() => {
              setPendingEmailDraft(null);
              setIsNewReqOpen(false);
            }}
          />
        )}

        {rateSubmissionEnquiryId && (
          <VendorRateSubmissionModal
            enquiryId={rateSubmissionEnquiryId}
            isOpen={true}
            onClose={() => setRateSubmissionEnquiryId(null)}
          />
        )}

        {quotationParams && (
          <NewQuotationModal
            requirementId={quotationParams.reqId}
            quoteId={quotationParams.quoteId}
            isOpen={true}
            onClose={() => setQuotationParams(null)}
          />
        )}

        {cpoReqId && <CustomerPOModal requirementId={cpoReqId} isOpen={true} onClose={() => setCpoReqId(null)} />}

        {vpoReqId && <VendorPOModal requirementId={vpoReqId} isOpen={true} onClose={() => setVpoReqId(null)} />}

        {piVpoId && <ProformaInvoiceModal vendorPoId={piVpoId} isOpen={true} onClose={() => setPiVpoId(null)} />}

        {payPiId && <PaymentModal piId={payPiId} isOpen={true} onClose={() => setPayPiId(null)} />}

        {dspReqId && <DispatchModal requirementId={dspReqId} isOpen={true} onClose={() => setDspReqId(null)} />}

        {delReqId && <DeliveryModal requirementId={delReqId} isOpen={true} onClose={() => setDelReqId(null)} />}

        {verifyOrderAuditId && (
          <EarningRulesAndLockModal
            isOpen={!!verifyOrderAuditId}
            onClose={() => setVerifyOrderAuditId(null)}
            requirementId={verifyOrderAuditId}
          />
        )}

        {isChangePasswordOpen && (
          <ChangePasswordModal
            isOpen={isChangePasswordOpen}
            onClose={() => {
              if (!isForcedFirstLogin) {
                setIsChangePasswordOpen(false);
              }
            }}
            userId={currentUser.id}
            userName={currentUser.name}
            isForcedFirstLogin={isForcedFirstLogin}
            onPasswordChangedSuccessfully={() => {
              setIsForcedFirstLogin(false);
              setIsChangePasswordOpen(false);
            }}
          />
        )}

        {isSessionExpiryWarningOpen && (
          <SessionExpiryModal
            isOpen={isSessionExpiryWarningOpen}
            secondsRemaining={inactivitySecondsLeft}
            onContinueSession={handleContinueSession}
            onLogoutNow={handleManualSignOut}
          />
        )}
      </Suspense>
    </>
  );
};

export const ErpAuthenticatedShell: React.FC<ErpAuthenticatedShellProps> = (props) => {
  return (
    <AppProvider initialTab={props.initialTab}>
      <ErpShellContent {...props} />
    </AppProvider>
  );
};
