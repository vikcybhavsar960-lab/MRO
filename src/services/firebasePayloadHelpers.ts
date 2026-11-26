export const DEFAULT_WORKSPACE_ID = 'mro-default';
export const BOOTSTRAPPED_ADMIN_EMAILS = ['vikcybhavsar960@gmail.com', 'vickybhavsar960@gmail.com'];
export const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
export const MAX_ID_LENGTH = 128;
export const MAX_MEMBER_LIST = 20;
export const MAX_TOMBSTONE_LIST = 500;
export const MAX_COMPANY_NAME = 240;
export const MAX_TITLE_LENGTH = 300;
export const MAX_STATUS_LENGTH = 64;

export interface WorkspaceWriteContext {
  workspaceId: string;
  ownerUid: string;
  createdByUid: string;
  memberUids: string[];
  invitedEmails: string[];
}

export function normalizeEmail(email?: string | null): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function isBootstrappedAdminEmail(email?: string | null): boolean {
  const norm = normalizeEmail(email);
  return norm.length > 0 && BOOTSTRAPPED_ADMIN_EMAILS.includes(norm);
}

export function sanitizeDocId(rawId?: string | null, fallbackPrefix = 'DOC'): string {
  const raw = typeof rawId === 'string' ? rawId.trim() : '';
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, MAX_ID_LENGTH);
  if (cleaned.length > 0 && VALID_ID_REGEX.test(cleaned)) {
    return cleaned;
  }
  return `${fallbackPrefix}-${Date.now()}`;
}

export function emailToInviteId(email: string): string {
  const norm = normalizeEmail(email).replace(/[^a-z0-9]/g, '_');
  return `INV-${norm}`.slice(0, MAX_ID_LENGTH);
}

export function boundStringList(items: unknown, maxItems: number, lowercase = false): string[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    if (typeof item !== 'string') continue;
    const val = lowercase ? item.trim().toLowerCase() : item.trim();
    if (!val || seen.has(val)) continue;
    seen.add(val);
    result.push(val);
    if (result.length >= maxItems) break;
  }
  return result;
}

export function stripUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined) {
    return null as unknown as T;
  }
  if (typeof value === 'number') {
    return (Number.isFinite(value) ? value : 0) as unknown as T;
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString() as unknown as T;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined && typeof item !== 'function' && typeof item !== 'symbol')
      .map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined || typeof v === 'function' || typeof v === 'symbol') continue;
      out[k] = stripUndefinedDeep(v);
    }
    return out as T;
  }
  return String(value) as unknown as T;
}

export function truncateString(val: unknown, maxLen: number, fallback = ''): string {
  const str = typeof val === 'string' ? val.trim() : '';
  if (!str) return fallback;
  return str.slice(0, maxLen);
}

export function buildVendorDocPayload(
  vendor: Record<string, any>,
  ctx: WorkspaceWriteContext
) {
  const id = sanitizeDocId(vendor.id, 'VEND');
  const rawStatus = typeof vendor.status === 'string' ? vendor.status.toUpperCase() : 'ACTIVE';
  const status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED' =
    rawStatus === 'INACTIVE' || rawStatus === 'BLOCKED' ? rawStatus : 'ACTIVE';

  let sanitizedRecord: Record<string, any> = stripUndefinedDeep<Record<string, any>>({
    ...vendor,
    id,
    isDeleted: Boolean(vendor.isDeleted),
  });

  // Guard against Cloud Firestore's hard 1 MiB document size cap on massive multi-hundred-page catalogues
  try {
    const approxBytes = JSON.stringify(sanitizedRecord).length;
    if (approxBytes > 650_000) {
      const compactCatalogProducts = Array.isArray(sanitizedRecord.catalogProducts)
        ? sanitizedRecord.catalogProducts.slice(0, 250).map((cp: any) => ({
            id: cp.id,
            productName: cp.productName,
            brand: cp.brand,
            partNumber: cp.partNumber,
            modelNumber: cp.modelNumber,
            category: cp.category,
            mrp: cp.mrp,
            purchaseRate: cp.purchaseRate,
            sourceFile: cp.sourceFile || cp.catalogFileName,
            sourcePage: cp.sourcePage,
            catalogueStatus: cp.catalogueStatus,
          }))
        : undefined;
      const compactSupplied = Array.isArray(sanitizedRecord.productsSupplied)
        ? sanitizedRecord.productsSupplied.slice(0, 250)
        : undefined;
      sanitizedRecord = {
        ...sanitizedRecord,
        ...(compactCatalogProducts ? { catalogProducts: compactCatalogProducts, catalogProductsTotalCount: vendor.catalogProducts?.length } : {}),
        ...(compactSupplied ? { productsSupplied: compactSupplied } : {}),
      };
    }
  } catch {}

  return {
    id,
    workspaceId: sanitizeDocId(ctx.workspaceId, 'mro'),
    ownerUid: sanitizeDocId(ctx.ownerUid, 'owner'),
    createdByUid: sanitizeDocId(ctx.createdByUid, 'user'),
    memberUids: boundStringList(ctx.memberUids, MAX_MEMBER_LIST),
    invitedEmails: boundStringList(ctx.invitedEmails, MAX_MEMBER_LIST, true),
    companyName: truncateString(vendor.companyName, MAX_COMPANY_NAME, `Vendor ${id}`),
    status,
    isDeleted: Boolean(vendor.isDeleted),
    recordData: sanitizedRecord,
  };
}

export function resolveEntityTitle(item: Record<string, any>): string {
  return truncateString(
    item.companyName ||
      item.name ||
      item.itemName ||
      item.customerName ||
      item.vendorName ||
      item.quotationNumber ||
      item.poNumber ||
      item.customerPoNumber ||
      item.rfqNumber ||
      item.piNumber ||
      item.id,
    MAX_TITLE_LENGTH,
    'ERP Record'
  );
}

export function resolveEntityStatus(item: Record<string, any>): string {
  return truncateString(
    item.status || (item.isActive === false ? 'INACTIVE' : 'ACTIVE'),
    MAX_STATUS_LENGTH,
    'ACTIVE'
  );
}

export function buildEntityDocPayload(
  item: Record<string, any>,
  ctx: WorkspaceWriteContext
) {
  const id = sanitizeDocId(item.id, 'REC');
  const sanitizedRecord: Record<string, any> = stripUndefinedDeep<Record<string, any>>({
    ...item,
    id,
    isDeleted: Boolean(item.isDeleted),
  });

  return {
    id,
    workspaceId: sanitizeDocId(ctx.workspaceId, 'mro'),
    ownerUid: sanitizeDocId(ctx.ownerUid, 'owner'),
    createdByUid: sanitizeDocId(ctx.createdByUid, 'user'),
    memberUids: boundStringList(ctx.memberUids, MAX_MEMBER_LIST),
    invitedEmails: boundStringList(ctx.invitedEmails, MAX_MEMBER_LIST, true),
    title: resolveEntityTitle(item),
    status: resolveEntityStatus(item),
    isDeleted: Boolean(item.isDeleted),
    recordData: sanitizedRecord,
  };
}

export function buildTombstoneDocPayload(
  tombstoneId: string,
  deletedIds: string[],
  ctx: WorkspaceWriteContext
) {
  return {
    id: sanitizeDocId(tombstoneId, 'tombstone'),
    workspaceId: sanitizeDocId(ctx.workspaceId, 'mro'),
    ownerUid: sanitizeDocId(ctx.ownerUid, 'owner'),
    createdByUid: sanitizeDocId(ctx.createdByUid, 'user'),
    memberUids: boundStringList(ctx.memberUids, MAX_MEMBER_LIST),
    invitedEmails: boundStringList(ctx.invitedEmails, MAX_MEMBER_LIST, true),
    deletedIds: boundStringList(deletedIds, MAX_TOMBSTONE_LIST),
  };
}

export function extractEntityRecord<T extends Record<string, any>>(docData: any): T | null {
  if (!docData || typeof docData !== 'object') return null;
  const record = docData.recordData && typeof docData.recordData === 'object' ? docData.recordData : docData;
  const id = typeof docData.id === 'string' && docData.id ? docData.id : record.id;
  if (!id) return null;
  return {
    ...record,
    id,
    isDeleted: typeof docData.isDeleted === 'boolean' ? docData.isDeleted : Boolean(record.isDeleted),
  } as T;
}

export function mergeCollectionWithTombstones<T extends { id: string; isDeleted?: boolean }>(
  cloudItems: T[],
  localItems: T[],
  deletedIds: string[],
  includeSoftDeleted = false
): T[] {
  const deletedSet = new Set(deletedIds);
  const map = new Map<string, T>();

  for (const item of cloudItems) {
    if (!item || !item.id || deletedSet.has(item.id)) continue;
    if (!includeSoftDeleted && item.isDeleted) continue;
    map.set(item.id, item);
  }

  for (const item of localItems) {
    if (!item || !item.id || deletedSet.has(item.id)) continue;
    if (!includeSoftDeleted && item.isDeleted) continue;
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }

  return Array.from(map.values());
}

export function computeMissingSeedItems<T extends { id: string }>(
  localItems: T[],
  existingCloudIds: Set<string>,
  deletedIds: string[]
): T[] {
  const deletedSet = new Set(deletedIds);
  return localItems.filter(
    (item) => Boolean(item?.id) && !deletedSet.has(item.id) && !existingCloudIds.has(item.id)
  );
}
