import { User } from '../types';

export interface StaticSpaAccount {
  id: string;
  name: string;
  username: string;
  email: string;
  password: string;
  role: User['role'];
  department: string;
  mobile: string;
  approvalLimit: number;
  permissions: User['permissions'];
}

const STATIC_SPA_MODE_KEY = 'mro_static_spa_mode';
const STATIC_SPA_SESSION_PREFIX = 'static-spa-';

let cachedStaticSpaMode: boolean | null = null;

export const STATIC_SPA_ACCOUNTS: StaticSpaAccount[] = [
  {
    id: 'USR-001',
    name: 'Vicky Bhavsar (Super Admin)',
    username: 'admin',
    email: 'vickybhavsar960@gmail.com',
    password: 'Admin@123',
    role: 'SUPER_ADMIN',
    department: 'Executive Management',
    mobile: '+91 98200 11223',
    approvalLimit: 0,
    permissions: {
      modules: {
        dashboard: true,
        requirements: true,
        rfqs: true,
        rateComparison: true,
        quotations: true,
        customerPos: true,
        vendorPos: true,
        pi: true,
        payments: true,
        dispatch: true,
        delivery: true,
        customers: true,
        vendors: true,
        categories: true,
        materials: true,
        products: true,
        reports: true,
        documents: true,
        approvals: true,
        userManagement: true,
        auditTrail: true,
      },
      actions: {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canApprove: true,
        canExport: true,
        canPrint: true,
        canDownload: true,
        canShare: true,
      },
    },
  },
  {
    id: 'USR-002',
    name: 'Suresh Patil (Purchase Mgr)',
    username: 'suresh_purchase',
    email: 'suresh.patil@procuremro.com',
    password: 'Purchase@123',
    role: 'PURCHASE_MANAGER',
    department: 'Industrial Sourcing',
    mobile: '+91 98220 44556',
    approvalLimit: 500000,
    permissions: {
      modules: {
        dashboard: true,
        requirements: true,
        rfqs: true,
        rateComparison: true,
        quotations: true,
        customerPos: true,
        vendorPos: true,
        pi: true,
        payments: false,
        dispatch: true,
        delivery: true,
        customers: true,
        vendors: true,
        categories: true,
        materials: true,
        products: true,
        reports: true,
        documents: true,
        approvals: true,
        userManagement: false,
        auditTrail: false,
      },
      actions: {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canApprove: true,
        canExport: true,
        canPrint: true,
        canDownload: true,
        canShare: true,
      },
    },
  },
  {
    id: 'USR-003',
    name: 'Anjali Deshmukh (Approver)',
    username: 'anjali_approver',
    email: 'anjali.d@procuremro.com',
    password: 'Approver@123',
    role: 'APPROVAL_USER',
    department: 'Procurement Governance',
    mobile: '+91 98230 77889',
    approvalLimit: 2500000,
    permissions: {
      modules: {
        dashboard: true,
        requirements: true,
        rfqs: true,
        rateComparison: true,
        quotations: true,
        customerPos: true,
        vendorPos: true,
        pi: true,
        payments: true,
        dispatch: true,
        delivery: true,
        customers: true,
        vendors: true,
        categories: true,
        materials: true,
        products: true,
        reports: true,
        documents: true,
        approvals: true,
        userManagement: false,
        auditTrail: true,
      },
      actions: {
        canView: true,
        canCreate: false,
        canEdit: true,
        canDelete: false,
        canApprove: true,
        canExport: true,
        canPrint: true,
        canDownload: true,
        canShare: true,
      },
    },
  },
  {
    id: 'USR-004',
    name: 'Pooja Iyer (Accounts)',
    username: 'pooja_accounts',
    email: 'pooja.i@procuremro.com',
    password: 'Accounts@123',
    role: 'ACCOUNTS_USER',
    department: 'Finance & Billing',
    mobile: '+91 98240 66554',
    approvalLimit: 0,
    permissions: {
      modules: {
        dashboard: true,
        requirements: false,
        rfqs: false,
        rateComparison: false,
        quotations: true,
        customerPos: true,
        vendorPos: true,
        pi: true,
        payments: true,
        dispatch: true,
        delivery: true,
        customers: true,
        vendors: true,
        categories: false,
        materials: false,
        products: true,
        reports: true,
        documents: true,
        approvals: false,
        userManagement: false,
        auditTrail: false,
      },
      actions: {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canApprove: false,
        canExport: true,
        canPrint: true,
        canDownload: true,
        canShare: false,
      },
    },
  },
];

/**
 * Pure detector that distinguishes a static SPA host response (Cloudflare Workers
 * `not_found_handling: "single-page-application"`, Cloudflare Pages, `vite preview`,
 * or offline 503 wrapper from fetchApi) from a genuine Express JSON API response.
 *
 * IMPORTANT: Real Express API JSON errors (400, 401, 403, 409, 500 with JSON)
 * MUST return false so live backend validation and auth rules are never bypassed.
 */
export function isStaticSpaFallbackResponse(res: {
  status: number;
  headers?: { get(name: string): string | null } | null;
}): boolean {
  const contentType = (res.headers?.get('content-type') || '').toLowerCase();

  // Static SPA hosts return 200 text/html (index.html) for unknown /api/* routes
  if (contentType.includes('text/html')) {
    return true;
  }

  // Static hosts without an API backend return 404 / 405 / 501 for /api/* routes
  // (whereas Express /api/* always returns application/json)
  if ((res.status === 404 || res.status === 405 || res.status === 501) && !contentType.includes('application/json')) {
    return true;
  }

  // Also treat explicit non-Express static 405/501 as static fallback
  if (res.status === 405 || res.status === 501) {
    return true;
  }

  return false;
}

export function isStaticSpaSessionToken(token?: string | null): boolean {
  return Boolean(token && token.startsWith(STATIC_SPA_SESSION_PREFIX));
}

export function isStaticSpaMode(): boolean {
  if (cachedStaticSpaMode !== null) {
    return cachedStaticSpaMode;
  }
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    if (sessionStorage.getItem(STATIC_SPA_MODE_KEY) === 'true') {
      cachedStaticSpaMode = true;
      return true;
    }
    const token =
      sessionStorage.getItem('mro_current_session_id') ||
      localStorage.getItem('mro_current_session_id');
    if (isStaticSpaSessionToken(token)) {
      cachedStaticSpaMode = true;
      return true;
    }
  } catch {}
  return false;
}

export function markStaticSpaMode(active: boolean): void {
  cachedStaticSpaMode = active;
  if (typeof window === 'undefined') return;
  try {
    if (active) {
      sessionStorage.setItem(STATIC_SPA_MODE_KEY, 'true');
    } else {
      sessionStorage.removeItem(STATIC_SPA_MODE_KEY);
    }
  } catch {}
}

export function resetStaticSpaModeCacheForTest(): void {
  cachedStaticSpaMode = null;
}

function toErpUser(account: StaticSpaAccount): User {
  return {
    id: account.id,
    name: account.name,
    username: account.username,
    email: account.email,
    role: account.role,
    department: account.department,
    mobile: account.mobile,
    status: 'ACTIVE',
    mustChangePassword: false,
    permissions: account.permissions,
    approvalLimit: account.approvalLimit,
  };
}

export function authenticateStaticSpaUser(
  usernameOrEmail: string,
  password: string
): { success: boolean; user?: User; sessionId?: string; error?: string } {
  const cleanIdent = usernameOrEmail.trim().toLowerCase();
  const cleanPass = password.trim();
  if (!cleanIdent || !cleanPass) {
    return { success: false, error: 'Username and password are required.' };
  }

  const matched = STATIC_SPA_ACCOUNTS.find(
    (acc) =>
      acc.username.toLowerCase() === cleanIdent ||
      acc.email.toLowerCase() === cleanIdent
  );

  if (!matched || matched.password !== cleanPass) {
    return { success: false, error: 'Invalid username or password.' };
  }

  const user = toErpUser(matched);
  const sessionId = `${STATIC_SPA_SESSION_PREFIX}${matched.id}-${Date.now()}`;
  return { success: true, user, sessionId };
}

export function restoreStaticSpaSession(
  token: string | null,
  storedUserJson?: string | null
): { authenticated: boolean; user: User | null } {
  if (!isStaticSpaSessionToken(token)) {
    return { authenticated: false, user: null };
  }

  if (storedUserJson) {
    try {
      const parsed = JSON.parse(storedUserJson);
      if (parsed && parsed.id && parsed.username) {
        return { authenticated: true, user: parsed as User };
      }
    } catch {}
  }

  // Reconstruct from token prefix `static-spa-USR-001-...`
  const remainder = token!.slice(STATIC_SPA_SESSION_PREFIX.length);
  const matched = STATIC_SPA_ACCOUNTS.find((acc) => remainder.startsWith(`${acc.id}-`));
  if (matched) {
    return { authenticated: true, user: toErpUser(matched) };
  }

  return { authenticated: false, user: null };
}

export interface ErpJsonBackupBundle {
  version: string;
  exportedAt: string;
  app: string;
  collections: Record<string, any[]>;
}

const BACKUP_ALLOWED_COLLECTIONS = [
  'vendors',
  'archivedVendors',
  'products',
  'customers',
  'companies',
  'requirements',
  'rfqs',
  'quotations',
  'customerPos',
  'vendorPos',
  'payments',
  'dispatches',
  'deliveries',
  'brands',
  'categories',
  'vendorProductMappings',
  'inventoryItems',
  'stockAdjustments',
  'purchaseBills',
  'salesInvoices',
] as const;

export function buildJsonBackupBundle(state: Record<string, any>): ErpJsonBackupBundle {
  const collections: Record<string, any[]> = {};
  for (const key of BACKUP_ALLOWED_COLLECTIONS) {
    if (Array.isArray(state[key])) {
      collections[key] = state[key];
    }
  }
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    app: 'MRO PROCUREMENT SOLUTION',
    collections,
  };
}

export function parseJsonBackupBundle(rawJson: string): {
  valid: boolean;
  collections?: Record<string, any[]>;
  recordCount: number;
  error?: string;
} {
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, recordCount: 0, error: 'Backup file must contain a JSON object.' };
    }

    // Support both our bundle format ({ collections: {...} }) and BackupRecord format ({ payload: {...} })
    const sourceObj =
      parsed.collections && typeof parsed.collections === 'object'
        ? parsed.collections
        : parsed.payload && typeof parsed.payload === 'object'
          ? parsed.payload
          : parsed;

    const collections: Record<string, any[]> = {};
    let recordCount = 0;
    for (const key of BACKUP_ALLOWED_COLLECTIONS) {
      if (Array.isArray(sourceObj[key])) {
        collections[key] = sourceObj[key];
        recordCount += sourceObj[key].length;
      }
    }

    if (Object.keys(collections).length === 0) {
      return {
        valid: false,
        recordCount: 0,
        error: 'No valid ERP data collections (vendors, products, requirements, vendorPos, etc.) found in JSON file.',
      };
    }

    return { valid: true, collections, recordCount };
  } catch (err: any) {
    return {
      valid: false,
      recordCount: 0,
      error: `Invalid JSON format: ${err?.message || 'Unable to parse file'}`,
    };
  }
}
