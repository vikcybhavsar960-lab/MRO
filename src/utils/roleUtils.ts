import { UserRole } from '../types';

const ROLE_ALIASES: Record<string, UserRole> = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'SUPER_ADMIN',
  ADMINISTRATOR: 'SUPER_ADMIN',
  PURCHASE_MANAGER: 'PURCHASE_MANAGER',
  PROCUREMENT_MANAGER: 'PURCHASE_MANAGER',
  MANAGER: 'PURCHASE_MANAGER',
  PROCUREMENT_EMPLOYEE: 'PROCUREMENT_EMPLOYEE',
  PROCUREMENT_SPECIALIST: 'PROCUREMENT_EMPLOYEE',
  PURCHASE_USER: 'PROCUREMENT_EMPLOYEE',
  PROCUREMENT: 'PROCUREMENT_EMPLOYEE',
  EMPLOYEE: 'PROCUREMENT_EMPLOYEE',
  BUYER: 'PROCUREMENT_EMPLOYEE',
  SALES_EXECUTIVE: 'SALES_EXECUTIVE',
  SALES: 'SALES_EXECUTIVE',
  APPROVAL_USER: 'APPROVAL_USER',
  APPROVAL: 'APPROVAL_USER',
  APPROVER: 'APPROVAL_USER',
  ACCOUNTS_USER: 'ACCOUNTS_USER',
  ACCOUNTS: 'ACCOUNTS_USER',
  ACCOUNTANT: 'ACCOUNTS_USER',
  FINANCE: 'ACCOUNTS_USER',
  STORE_USER: 'STORE_USER',
  STORE: 'STORE_USER',
  WAREHOUSE: 'STORE_USER',
  MANAGEMENT_VIEWER: 'MANAGEMENT_VIEWER',
  VIEWER: 'MANAGEMENT_VIEWER',
  CUSTOMER: 'CUSTOMER',
  CLIENT: 'CUSTOMER',
  VENDOR: 'VENDOR',
  SUPPLIER: 'VENDOR',
};

const ROLE_DISPLAY_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  PURCHASE_MANAGER: 'Purchase Manager',
  PROCUREMENT_EMPLOYEE: 'Procurement Specialist',
  SALES_EXECUTIVE: 'Sales Executive',
  APPROVAL_USER: 'Approval Authority',
  ACCOUNTS_USER: 'Accounts & Finance',
  STORE_USER: 'Store / Warehouse',
  MANAGEMENT_VIEWER: 'Management Viewer',
  CUSTOMER: 'Customer',
  VENDOR: 'Vendor',
};

export function normalizeUserRole(
  role?: string | null,
  username?: string | null,
  _email?: string | null
): UserRole {
  const uname = String(username || '').trim().toLowerCase();
  if (!role || !String(role).trim()) {
    if (uname === 'admin') return 'SUPER_ADMIN';
    return 'PROCUREMENT_EMPLOYEE';
  }

  const normalizedKey = String(role)
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');

  if (ROLE_ALIASES[normalizedKey]) {
    return ROLE_ALIASES[normalizedKey];
  }

  if (normalizedKey.includes('ADMIN')) return 'SUPER_ADMIN';
  if (normalizedKey.includes('PURCHASE') && normalizedKey.includes('MANAGER')) return 'PURCHASE_MANAGER';
  if (normalizedKey.includes('APPROV')) return 'APPROVAL_USER';
  if (normalizedKey.includes('ACCOUNT') || normalizedKey.includes('FINANC')) return 'ACCOUNTS_USER';
  if (normalizedKey.includes('SALES')) return 'SALES_EXECUTIVE';
  if (normalizedKey.includes('STORE') || normalizedKey.includes('WAREHOUSE')) return 'STORE_USER';
  if (normalizedKey.includes('VIEW')) return 'MANAGEMENT_VIEWER';
  if (normalizedKey.includes('CUSTOMER') || normalizedKey.includes('CLIENT')) return 'CUSTOMER';
  if (normalizedKey.includes('VENDOR') || normalizedKey.includes('SUPPLIER')) return 'VENDOR';
  if (uname === 'admin') return 'SUPER_ADMIN';

  return 'PROCUREMENT_EMPLOYEE';
}

export function isAdminRole(role?: string | null, username?: string | null): boolean {
  return normalizeUserRole(role, username) === 'SUPER_ADMIN';
}

export function canManageProcurement(role?: string | null, username?: string | null): boolean {
  const norm = normalizeUserRole(role, username);
  return (
    norm === 'SUPER_ADMIN' ||
    norm === 'PURCHASE_MANAGER' ||
    norm === 'PROCUREMENT_EMPLOYEE' ||
    norm === 'SALES_EXECUTIVE'
  );
}

export function canApproveWorkflow(role?: string | null, username?: string | null): boolean {
  const norm = normalizeUserRole(role, username);
  return norm === 'SUPER_ADMIN' || norm === 'PURCHASE_MANAGER' || norm === 'APPROVAL_USER';
}

export function canHandleAccounts(role?: string | null, username?: string | null): boolean {
  const norm = normalizeUserRole(role, username);
  return norm === 'SUPER_ADMIN' || norm === 'ACCOUNTS_USER';
}

export function getRoleDisplayLabel(role?: string | null, username?: string | null): string {
  const norm = normalizeUserRole(role, username);
  return ROLE_DISPLAY_LABELS[norm] || 'Procurement Team';
}
