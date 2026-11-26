import React, { useState } from 'react';
import {
  FileText,
  Clock,
  FileCheck2,
  ShoppingCart,
  PackageCheck,
  Receipt,
  CreditCard,
  Truck,
  CheckCircle,
  Archive,
  TrendingUp,
  DollarSign,
  Plus,
  ArrowUpRight,
  ExternalLink,
  ChevronRight,
  Building,
  Users,
  AlertTriangle,
  FileSpreadsheet,
  Database,
  Scale,
  Download,
  HelpCircle,
  Sparkles,
  Layers,
  Cloud,
  Upload,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DataModeModal } from '../common/DataModeModal';
import { exportCustomersToCSV, exportVendorsToCSV } from '../../services/dataExportService';
import { BulkRequirementImportModal } from '../workflow/BulkRequirementImportModal';

interface DashboardViewProps {
  onOpenNewReq: () => void;
  onOpenNewCustomer: () => void;
  onOpenNewVendor: () => void;
  onOpenNewEnquiry: () => void;
  onOpenNewQuotation: () => void;
  onOpenGoogleSheets: () => void;
  onSelectOrder: (orderId: string) => void;
}

const AnimatedNumber: React.FC<{ value: number }> = ({ value }) => {
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    let start = 0;
    const end = value;
    if (end === 0) {
      setDisplay(0);
      return;
    }
    const duration = 500;
    const stepTime = 25;
    const steps = duration / stepTime;
    const increment = (end - start) / steps;
    const timer = setInterval(() => {
      start += increment;
      if ((increment > 0 && start >= end) || (increment < 0 && start <= end)) {
        setDisplay(end);
        clearInterval(timer);
      } else {
        setDisplay(Math.round(start));
      }
    }, stepTime);
    return () => clearInterval(timer);
  }, [value]);

  return <>{display.toLocaleString('en-IN')}</>;
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenNewReq,
  onOpenNewCustomer,
  onOpenNewVendor,
  onOpenNewEnquiry,
  onOpenNewQuotation,
  onOpenGoogleSheets,
  onSelectOrder,
}) => {
  const {
    requirements,
    vendorQuotes,
    customerQuotations,
    customerPOs,
    vendorPOs,
    proformaInvoices,
    payments,
    dispatches,
    deliveries,
    currentUser,
    setActiveTab,
    dataMode,
    customers,
    vendors,
    categories,
    backups,
    backupFailureAlert,
    cloudSyncState,
    connectCloudDatabase,
  } = useApp();

  const [isDataModeModalOpen, setIsDataModeModalOpen] = useState(false);
  const [dataModeModalTab, setDataModeModalTab] = useState<'switcher' | 'how-it-works' | 'backup'>('switcher');
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  // Section 21 Dashboard Summary Cards & Pipeline Metrics
  const liveVendors = vendors.filter((v: any) => !v?.isDeleted);
  const liveRequirements = requirements.filter((r: any) => !r?.isDeleted);
  const totalVendors = liveVendors.length;
  const activeVendors = liveVendors.filter((v) => v.status !== 'BLOCKED' && v.status !== 'INACTIVE').length;
  const totalCategories = categories.length;
  const openRequirements = liveRequirements.filter((r) => r.status !== 'ORDER_CLOSED' && r.status !== 'CANCELLED').length;
  const reqsWithoutVendor = liveRequirements.filter((r) => !r.items.some((i) => i.selectedVendorId)).length;
  const reqsWithVendors = liveRequirements.length - reqsWithoutVendor;
  const latestBackup = backups[0];

  // Pipeline counters
  const newReqCount = liveRequirements.filter((r) => r.status === 'NEW_REQUIREMENT').length;
  const quotationsPending = liveRequirements.filter((r) => r.status === 'RATE_RECEIVED').length;
  const customerPoReceived = customerPOs.length;
  const vendorOrdersCount = vendorPOs.length;
  const piPendingCount = vendorPOs.filter((v) => !proformaInvoices.some((p) => p.vendorPoId === v.id)).length;
  const paymentPendingCount = proformaInvoices.filter((p) => !payments.some((pay) => pay.piId === p.id)).length;
  const dispatchPendingCount = payments.filter((p) => !dispatches.some((d) => d.requirementId === p.requirementId)).length;
  const inTransitCount = liveRequirements.filter((r) => r.status === 'IN_TRANSIT').length;
  const deliveredCount = liveRequirements.filter((r) => r.status === 'DELIVERED').length;
  const closedOrdersCount = liveRequirements.filter((r) => r.status === 'ORDER_CLOSED').length;

  // Total sales value, purchase value and gross margin
  const totalSalesValue = customerQuotations.reduce((acc, q) => acc + q.grandTotal, 0);
  const totalPurchaseValue = vendorPOs.reduce((acc, v) => acc + v.totalAmount, 0);
  const totalGrossMargin = totalSalesValue - totalPurchaseValue;
  const grossMarginPercent = totalSalesValue > 0 ? (totalGrossMargin / totalSalesValue) * 100 : 0;

  const isProcurementTeam =
    currentUser.role === 'SUPER_ADMIN' ||
    currentUser.role === 'PURCHASE_MANAGER' ||
    currentUser.role === 'PROCUREMENT_EMPLOYEE' ||
    currentUser.role === 'SALES_EXECUTIVE';

  const canSeeFinancials =
    isProcurementTeam || currentUser.role === 'ACCOUNTS_USER';

  const pipelineStages = [
    { label: 'New Requirements', count: newReqCount, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', tab: 'requirements' },
    { label: 'Vendor Rates Sourced', count: vendorQuotes.length, icon: Receipt, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', tab: 'vendor-rates' },
    { label: 'Rate Evaluation', count: quotationsPending, icon: Scale, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', tab: 'rate-comparison' },
    { label: 'Customer Quotations', count: customerQuotations.length, icon: FileCheck2, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', tab: 'quotations' },
    { label: 'Customer PO Received', count: customerPoReceived, icon: ShoppingCart, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', tab: 'customer-pos' },
    { label: 'Vendor Orders Placed', count: vendorOrdersCount, icon: PackageCheck, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', tab: 'vendor-pos' },
    { label: 'PI Pending', count: piPendingCount, icon: Receipt, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', tab: 'pi' },
    { label: 'Payment Pending', count: paymentPendingCount, icon: CreditCard, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', tab: 'payments' },
    { label: 'Dispatch & Transit', count: dispatchPendingCount + inTransitCount, icon: Truck, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', tab: 'dispatch' },
    { label: 'Delivered & Closed', count: deliveredCount + closedOrdersCount, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', tab: 'delivery' },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Welcome & Quick Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            MRO Operations Dashboard
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time pipeline monitoring from Customer Requirement & Direct Vendor Rates to Delivery
          </p>
        </div>

        {/* Quick-action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {(isProcurementTeam || currentUser.role === 'CUSTOMER') && (
            <button
              onClick={onOpenNewReq}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs shadow-blue-500/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Requirement</span>
            </button>
          )}

          {isProcurementTeam && (
            <>
              <button
                onClick={onOpenNewCustomer}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors"
              >
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span>Customer</span>
              </button>
              <button
                onClick={onOpenNewVendor}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors"
              >
                <Building className="w-3.5 h-3.5 text-slate-500" />
                <span>Vendor</span>
              </button>
              <button
                onClick={() => setActiveTab('vendor-rates')}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-colors"
              >
                <Receipt className="w-3.5 h-3.5 text-blue-600" />
                <span>Enter Vendor Rate</span>
              </button>
              <button
                onClick={onOpenNewQuotation}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors"
              >
                <FileCheck2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Quotation</span>
              </button>
            </>
          )}

          {/* Bulk Excel Import Button */}
          {isProcurementTeam && (
            <button
              onClick={() => setIsBulkImportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs shadow-emerald-500/20 transition-colors"
              title="Upload multi-row Excel (.xlsx) BOM with automatic category detection"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Bulk Excel Import</span>
            </button>
          )}

          <button
            onClick={onOpenGoogleSheets}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Google Sheets</span>
          </button>

          {currentUser.role === 'SUPER_ADMIN' && (
            <button
              onClick={() => setActiveTab('users')}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
            >
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>User Management</span>
            </button>
          )}
        </div>
      </div>

      {/* Section 21: Vendor & Category Management Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Vendors */}
        <button
          onClick={() => setActiveTab('vendors')}
          className="p-3 bg-white hover:bg-blue-50/40 rounded-xl border border-slate-200 text-left transition-all shadow-2xs group"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Vendors
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-slate-900 font-mono">
              <AnimatedNumber value={totalVendors} />
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
              <AnimatedNumber value={activeVendors} /> Active
            </span>
          </div>
          <span className="text-[10px] text-blue-600 font-medium group-hover:underline mt-1 block">
            View Suppliers →
          </span>
        </button>

        {/* Total Material Categories */}
        <button
          onClick={() => setActiveTab('categories')}
          className="p-3 bg-white hover:bg-purple-50/40 rounded-xl border border-slate-200 text-left transition-all shadow-2xs group"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Material Categories
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-purple-700 font-mono">
              <AnimatedNumber value={totalCategories} />
            </span>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded">
              30 Taxonomies
            </span>
          </div>
          <span className="text-[10px] text-purple-600 font-medium group-hover:underline mt-1 block">
            Category Master →
          </span>
        </button>

        {/* Open Requirements */}
        <button
          onClick={() => setActiveTab('requirements')}
          className="p-3 bg-white hover:bg-blue-50/40 rounded-xl border border-slate-200 text-left transition-all shadow-2xs group"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Open Requirements
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-blue-700 font-mono">
              <AnimatedNumber value={openRequirements} />
            </span>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded">
              Active Pipelines
            </span>
          </div>
          <span className="text-[10px] text-blue-600 font-medium group-hover:underline mt-1 block">
            BOM Items →
          </span>
        </button>

        {/* Requirements Without Vendor */}
        <button
          onClick={() => setActiveTab('requirements')}
          className={`p-3 rounded-xl border text-left transition-all shadow-2xs group ${
            reqsWithoutVendor > 0
              ? 'bg-rose-50/50 border-rose-200 hover:bg-rose-50'
              : 'bg-white border-slate-200'
          }`}
          title="Click to view requirements without matching or assigned supplier"
        >
          <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">
            Reqs Without Vendor
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-rose-700 font-mono">
              <AnimatedNumber value={reqsWithoutVendor} />
            </span>
            <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded">
              Needs Supplier
            </span>
          </div>
          <span className="text-[10px] text-rose-600 font-bold group-hover:underline mt-1 block">
            Match Suppliers →
          </span>
        </button>

        {/* Reqs with Recommended Vendors */}
        <button
          onClick={() => setActiveTab('requirements')}
          className="p-3 bg-white hover:bg-emerald-50/40 rounded-xl border border-slate-200 text-left transition-all shadow-2xs group"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Matched with Vendors
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-emerald-700 font-mono">
              <AnimatedNumber value={reqsWithVendors} />
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
              Verified
            </span>
          </div>
          <span className="text-[10px] text-emerald-600 font-medium group-hover:underline mt-1 block">
            Ready for Direct Rate →
          </span>
        </button>

        {/* Backup Status */}
        <button
          onClick={() => setActiveTab('backup-recovery')}
          className={`p-3 rounded-xl border text-left transition-all shadow-2xs group ${
            backupFailureAlert
              ? 'bg-rose-50 border-rose-300'
              : 'bg-white hover:bg-emerald-50/40 border-slate-200'
          }`}
          title="Automated Daily Cloud Backup Status"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Cloud Backup Health
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base font-extrabold text-slate-900 font-mono">
              {backupFailureAlert ? 'FAILED' : 'SYNCED'}
            </span>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                backupFailureAlert ? 'bg-rose-200 text-rose-800' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {backupFailureAlert ? 'Attention' : '24h Daily'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium group-hover:underline mt-1 block">
            Backup & Vault →
          </span>
        </button>
      </div>

      {/* Supabase PostgreSQL & Storage Status + Master Export Quick Hub */}
      <div
        className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          cloudSyncState.connected
            ? 'bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 text-white border-emerald-700/50 shadow-sm'
            : 'bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white border-amber-600/50 shadow-sm'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
              cloudSyncState.connected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
            }`}
          >
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-xs tracking-tight">
                Authoritative Database:{' '}
                {cloudSyncState.connected ? 'Supabase PostgreSQL & Storage' : 'Supabase Setup Status'}
              </span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  cloudSyncState.connected
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-amber-400 text-slate-950'
                }`}
              >
                {cloudSyncState.connected
                  ? 'Supabase PostgreSQL Live'
                  : cloudSyncState.serverConfigured && !cloudSyncState.schemaApplied
                    ? 'Run Schema SQL'
                    : 'Environment Keys Pending'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              {cloudSyncState.connected
                ? `Connected to ${cloudSyncState.projectId} with verified PostgreSQL readback, 9 Storage buckets (up to 250 MB), and Realtime sync.`
                : cloudSyncState.serverConfigured && !cloudSyncState.schemaApplied
                  ? 'Supabase keys are active! Open "Supabase Setup" in top bar -> click "Copy Schema SQL" -> paste & Run in Supabase SQL Editor.'
                  : 'Add VITE_SUPABASE_PUBLISHABLE_KEY & SUPABASE_SERVICE_ROLE_KEY in environment secrets and run migration SQL to activate remote PostgreSQL sync.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {!cloudSyncState.connected && (
            <button
              onClick={() => connectCloudDatabase()}
              data-testid="dashboard-connect-cloud-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-extrabold transition-all shadow-xs cursor-pointer"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Verify Supabase</span>
            </button>
          )}

          {/* Quick Export Customers */}
          <button
            onClick={() => exportCustomersToCSV(customers)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg text-xs font-semibold transition-all"
            title="Download all Customers as CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export Customers</span>
          </button>

          {/* Quick Export Vendors */}
          <button
            onClick={() => exportVendorsToCSV(vendors)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg text-xs font-semibold transition-all"
            title="Download all Vendors as CSV"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Export Vendors</span>
          </button>

          {/* Database & Migration Status */}
          <button
            onClick={() => {
              setDataModeModalTab('switcher');
              setIsDataModeModalOpen(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Inspect Supabase PostgreSQL, Storage Buckets, and Migration Status"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{cloudSyncState.connected ? 'DB & Migration' : 'Supabase Setup'}</span>
          </button>
        </div>
      </div>

      {/* Financial KPIs (Protected by RBAC) */}
      {canSeeFinancials && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Sales Quoted / Booked
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-slate-900 font-mono">
                ₹{totalSalesValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                Revenue
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Total value across issued quotations & CPOs</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Vendor Purchase Commitments
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-slate-900 font-mono">
                ₹{totalPurchaseValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                Landed Cost
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Vendor purchase orders placed</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Realized Gross Margin (INR)
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-emerald-600 font-mono">
                ₹{totalGrossMargin.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                Profit
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Selling value minus purchase cost</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Gross Profit Margin %
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-blue-700 font-mono">
                {grossMarginPercent.toFixed(1)}%
              </span>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded flex items-center">
                <TrendingUp className="w-3 h-3 mr-0.5" /> High
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Average weighted margin across active lines</p>
          </div>
        </div>
      )}

      {/* 11 Stage Breakdown Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm text-slate-900 tracking-tight">
            Pipeline Stage Counters (10 Operational Milestones)
          </h3>
          <span className="text-xs text-slate-400 font-medium">Click any milestone to open module</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {pipelineStages.map((stage) => {
            const Icon = stage.icon;
            return (
              <button
                key={stage.tab}
                onClick={() => setActiveTab(stage.tab)}
                className={`p-3.5 rounded-xl border ${stage.border} ${stage.bg} text-left transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs group`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`p-2 rounded-lg bg-white shadow-2xs ${stage.color}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="text-xl font-black text-slate-900 font-mono">
                    <AnimatedNumber value={stage.count} />
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800 leading-tight">
                  {stage.label}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 group-hover:text-blue-600 flex items-center gap-0.5">
                  <span>View stage</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Orders & Transactions Traceability Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900">Active Supply Chain Orders</h3>
            <p className="text-xs text-slate-500">
              Click any order to open complete 10-stage visual timeline & related documents
            </p>
          </div>
          <button
            onClick={() => setActiveTab('requirements')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <span>View All Orders</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Req Number</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Items Summary</th>
                <th className="py-3 px-4">Current Milestone</th>
                <th className="py-3 px-4">Required Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {requirements
                .filter((req) => !req.isDeleted)
                .map((req, rIdx) => (
                <tr
                  key={req.id ? `order-row-${req.id}` : `order-row-idx-${rIdx}`}
                  onClick={() => onSelectOrder(req.id)}
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                >
                  <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                    {req.id}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">{req.customerName}</div>
                    <div className="text-[11px] text-slate-400">{req.contactPerson}</div>
                  </td>
                  <td className="py-3.5 px-4 max-w-xs truncate">
                    {req.items?.map((i) => `${i.itemName} (${i.quantity} ${i.uom})`).join(', ') || 'No items'}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        req.status === 'ORDER_CLOSED'
                          ? 'bg-slate-100 text-slate-700 border border-slate-200'
                          : req.status === 'DELIVERED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : req.status === 'IN_TRANSIT' || req.status === 'DISPATCHED'
                          ? 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {req.status ? req.status.replace(/_/g, ' ') : 'OPEN'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-mono">
                    {req.requiredDeliveryDate || 'N/A'}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectOrder(req.id);
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white rounded-md text-[11px] font-bold transition-colors inline-flex items-center gap-1"
                    >
                      <span>Timeline</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data Mode & Architecture Explainer Modal */}
      <DataModeModal
        isOpen={isDataModeModalOpen}
        onClose={() => setIsDataModeModalOpen(false)}
        initialTab={dataModeModalTab}
      />

      {/* Bulk Excel Requirement Import Modal */}
      <BulkRequirementImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
      />
    </div>
  );
};
