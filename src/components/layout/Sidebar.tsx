import React from 'react';
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Scale,
  FileCheck2,
  ShoppingCart,
  PackageCheck,
  CreditCard,
  Truck,
  CheckCircle,
  Users,
  Building,
  Layers,
  BarChart3,
  FolderOpen,
  History,
  Sparkles,
  Database,
  Tag,
  Cloud,
  UserCog,
  Mail,
  FileSpreadsheet,
  Landmark,
  Package,
  BookmarkCheck,
  Building2,
  UserCheck,
  Palette,
  SunMoon,
} from 'lucide-react';
import { useApp, isSuperAdminUser } from '../../context/AppContext';
import { normalizeUserRole } from '../../utils/roleUtils';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    currentUser,
    availableUsers,
    requirements,
    vendorQuotes,
    payments,
    dispatches,
    dataMode,
    categories,
    brands,
    vendors,
    companies,
    purchaseExecutives,
  } = useApp();

  const isRoleAllowed = (tabId: string): boolean => {
    const role = normalizeUserRole(currentUser.role, currentUser.username, currentUser.email);
    if (role === 'SUPER_ADMIN' || isSuperAdminUser(currentUser)) return true;

    // Direct module permissions check if defined on user profile
    if (currentUser.permissions?.modules) {
      const map: Record<string, keyof typeof currentUser.permissions.modules> = {
        'dashboard': 'dashboard',
        'requirements': 'requirements',
        'vendor-rates': 'rateComparison',
        'rate-comparison': 'rateComparison',
        'quotations': 'quotations',
        'customer-pos': 'customerPos',
        'vendor-pos': 'vendorPos',
        'pi': 'pi',
        'payments': 'payments',
        'dispatch': 'dispatch',
        'delivery': 'delivery',
        'customers': 'customers',
        'companies': 'customers',
        'purchase-executives': 'customers',
        'vendors': 'vendors',
        'brands': 'categories',
        'categories': 'categories',
        'products': 'products',
        'reports': 'reports',
        'documents': 'documents',
        'users': 'userManagement',
        'audit-log': 'auditTrail',
      };
      const permKey = map[tabId];
      if (permKey && currentUser.permissions.modules[permKey] !== undefined) {
        return Boolean(currentUser.permissions.modules[permKey]);
      }
    }

    if (['users', 'email-rfq', 'sales-billing', 'purchase-bills', 'accounting', 'inventory', 'brands', 'companies', 'purchase-executives', 'branding-settings', 'theme-settings'].includes(tabId)) {
      return role !== 'VENDOR' && role !== 'CUSTOMER';
    }

    if (role === 'VENDOR') {
      return ['dashboard', 'vendor-rates', 'vendor-pos', 'pi', 'dispatch', 'documents'].includes(tabId);
    }

    if (role === 'CUSTOMER') {
      return ['dashboard', 'requirements', 'quotations', 'customer-pos', 'delivery', 'documents'].includes(tabId);
    }

    if (role === 'ACCOUNTS_USER') {
      return [
        'dashboard',
        'customer-pos',
        'vendor-pos',
        'pi',
        'payments',
        'reports',
        'documents',
        'audit-log',
        'backup-recovery',
      ].includes(tabId);
    }

    if (role === 'PURCHASE_MANAGER' || role === 'APPROVAL_USER') {
      return [
        'dashboard',
        'requirements',
        'vendor-rates',
        'rate-comparison',
        'quotations',
        'customer-pos',
        'vendor-pos',
        'pi',
        'payments',
        'dispatch',
        'delivery',
        'customers',
        'companies',
        'purchase-executives',
        'vendors',
        'categories',
        'products',
        'documents',
        'reports',
        'company-reports',
        'audit-log',
      ].includes(tabId);
    }

    if (role === 'STORE_USER') {
      return [
        'dashboard',
        'requirements',
        'vendor-pos',
        'dispatch',
        'delivery',
        'companies',
        'purchase-executives',
        'vendors',
        'categories',
        'products',
        'documents',
      ].includes(tabId);
    }

    if (role === 'PROCUREMENT_EMPLOYEE') {
      return [
        'dashboard',
        'requirements',
        'vendor-rates',
        'rate-comparison',
        'quotations',
        'customer-pos',
        'vendor-pos',
        'dispatch',
        'delivery',
        'customers',
        'companies',
        'purchase-executives',
        'vendors',
        'categories',
        'products',
        'documents',
        'reports',
        'company-reports',
        'backup-recovery',
      ].includes(tabId);
    }

    return true;
  };

  const navGroups = [
    {
      title: 'OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'email-rfq', label: 'Email RFQ Inbox', icon: Mail },
      ],
    },
    {
      title: 'BUSINESS & BILLING (VYAPAR)',
      items: [
        { id: 'sales-billing', label: 'Sales & GST Invoicing', icon: FileSpreadsheet },
        { id: 'purchase-bills', label: 'Purchase Bills & Debit Notes', icon: Receipt },
        { id: 'accounting', label: 'Cash, Bank & Ledgers', icon: Landmark },
        { id: 'inventory', label: 'Inventory & Warehouses', icon: Package },
      ],
    },
    {
      title: '10-STAGE DIRECT WORKFLOW',
      items: [
        { id: 'requirements', label: '1. Requirements (REQ)', icon: FileText, count: (requirements || []).filter((r: any) => !r?.isDeleted).length },
        { id: 'vendor-rates', label: '2. Direct Vendor Rates (VQ)', icon: Receipt, count: (vendorQuotes || []).length },
        { id: 'rate-comparison', label: '3. Rate Comparison', icon: Scale },
        { id: 'quotations', label: '4. Quotations (QTN)', icon: FileCheck2 },
        { id: 'customer-pos', label: '5. Customer PO (CPO)', icon: ShoppingCart },
        { id: 'vendor-pos', label: '6. Vendor PO (VPO)', icon: PackageCheck },
        { id: 'pi', label: '7. Proforma Invoice (PI)', icon: Receipt },
        { id: 'payments', label: '8. Payments (PAY)', icon: CreditCard },
        { id: 'dispatch', label: '9. Dispatch & LR (DSP)', icon: Truck },
        { id: 'delivery', label: '10. Delivery & Closed', icon: CheckCircle },
      ],
    },
    {
      title: 'MASTER DATA & ACCESS CONTROL',
      items: [
        { id: 'users', label: 'User Management (RBAC)', icon: UserCog, count: (availableUsers || []).length },
        { id: 'companies', label: 'Company Master', icon: Building2, count: (companies || []).filter((c: any) => !c?.isDeleted).length },
        { id: 'purchase-executives', label: 'Purchase Executives', icon: UserCheck, count: (purchaseExecutives || []).filter((e: any) => !e?.isDeleted).length },
        { id: 'customers', label: 'Customer Directory', icon: Users },
        { id: 'vendors', label: 'Vendors', icon: Building, count: (vendors || []).filter((v: any) => !v?.isDeleted).length },
        { id: 'brands', label: 'Brand Master (Registry)', icon: BookmarkCheck, count: (brands || []).length },
        { id: 'brand-catalogue', label: 'Brand Catalogue Browser', icon: Sparkles },
        { id: 'categories', label: 'Category Master', icon: Tag, count: categories.length },
        { id: 'products', label: 'Product Catalog', icon: Layers },
      ],
    },
    {
      title: 'FINANCIALS & AUDIT',
      items: [
        { id: 'reports', label: 'Financial Reports & Sheets', icon: BarChart3 },
        { id: 'company-reports', label: 'Company & Exec Reports', icon: FileSpreadsheet },
        { id: 'documents', label: 'Document Center', icon: FolderOpen },
        { id: 'audit-log', label: 'Audit Trail', icon: History },
        { id: 'backup-recovery', label: 'Backup & Clean Slate', icon: Cloud },
      ],
    },
    {
      title: 'BRANDING & SYSTEM STYLING',
      items: [
        { id: 'branding-settings', label: 'Company Logos & Branding', icon: Palette },
        { id: 'theme-settings', label: 'Theme Studio & Colors', icon: SunMoon },
      ],
    },
  ];

  return (
    <aside className="hidden md:flex w-64 bg-slate-900 text-slate-300 flex-col border-r border-slate-800 shrink-0 select-none">
      {/* Workflow pill */}
      <div className="p-3.5 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>Simplified Direct Pipeline</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">
          REQ → VQ (Direct Rate) → Rate Comp → QTN → CPO → VPO → PI → PAY → DSP → DEL
        </p>
      </div>

      {/* Nav List */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5 text-xs">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => isRoleAllowed(item.id));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title} className="space-y-1">
              <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white font-semibold shadow-sm shadow-blue-500/30'
                          : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {typeof item.count === 'number' && item.count > 0 && (
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            isActive ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer System Status */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 text-[11px] text-slate-400 space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-300 font-medium">PostgreSQL & Sheets</span>
          </span>
          <span className="text-slate-400 font-mono">Synced</span>
        </div>
        <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 text-[10px]">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Database className="w-3 h-3 text-blue-400" />
            <span>Mode:</span>
          </span>
          <span className="font-bold px-1.5 py-0.5 rounded text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-800">
            Live Enterprise DB
          </span>
        </div>
      </div>
    </aside>
  );
};
