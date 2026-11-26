import fs from 'fs';
import crypto from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getVendorCatalogueConfig } from './catalogueConfig.js';
import { normalizePartCode } from '../services/rateMatchingEngine.js';

export const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://plvjsiehhpdoyvzgahpr.supabase.co'
)
  .trim()
  .replace(/\/$/, '');

const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const PUBLISHABLE_KEY = (
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
).trim();

export const ERP_STORAGE_BUCKETS = [
  'vendor-catalogues',
  'vendor-documents',
  'product-images',
  'product-datasheets',
  'rfq-documents',
  'quotation-documents',
  'purchase-orders',
  'invoices',
  'other-erp-documents',
] as const;

export type ErpStorageBucket = (typeof ERP_STORAGE_BUCKETS)[number];

let adminClient: SupabaseClient | null = null;
let authAnonClient: SupabaseClient | null = null;

export function isSupabaseServerConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseServerConfigured()) return null;
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          'x-application-name': 'mro-erp-server-admin',
        },
      },
    });
  }
  return adminClient;
}

export function getSupabaseAuthClient(): SupabaseClient | null {
  const key = PUBLISHABLE_KEY || SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  if (!authAnonClient) {
    authAnonClient = createClient(SUPABASE_URL, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return authAnonClient;
}

export function getSupabaseServerDiagnostics() {
  return {
    url: SUPABASE_URL,
    serverConfigured: isSupabaseServerConfigured(),
    clientPublishableConfigured: Boolean(PUBLISHABLE_KEY),
    missingServerVars: [
      ...(SUPABASE_URL ? [] : ['SUPABASE_URL']),
      ...(SERVICE_ROLE_KEY ? [] : ['SUPABASE_SERVICE_ROLE_KEY']),
    ],
    missingClientVars: [
      ...(PUBLISHABLE_KEY ? [] : ['VITE_SUPABASE_PUBLISHABLE_KEY']),
    ],
  };
}

export async function ensureSupabaseBuckets(): Promise<{ created: string[]; checked: number; error?: string }> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return { created: [], checked: 0, error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' };
  }
  const cfg = getVendorCatalogueConfig();
  const { data: existing, error: listErr } = await admin.storage.listBuckets();
  if (listErr) {
    return { created: [], checked: 0, error: listErr.message };
  }
  const existingIds = new Set((existing || []).map((b) => b.id));
  const created: string[] = [];

  for (const bucketId of ERP_STORAGE_BUCKETS) {
    const limit =
      bucketId === 'product-images'
        ? 52428800
        : bucketId === 'vendor-catalogues' || bucketId === 'vendor-documents' || bucketId === 'other-erp-documents'
          ? cfg.maxFileSizeBytes
          : 104857600;

    if (!existingIds.has(bucketId)) {
      const { error: createErr } = await admin.storage.createBucket(bucketId, {
        public: false,
        fileSizeLimit: limit,
      });
      if (!createErr) created.push(bucketId);
    }
  }
  return { created, checked: ERP_STORAGE_BUCKETS.length };
}

export async function uploadFileToSupabaseStorage(params: {
  bucket: ErpStorageBucket;
  storagePath: string;
  filePathOnDisk?: string;
  buffer?: Buffer;
  contentType: string;
}): Promise<{ bucket: ErpStorageBucket; path: string; fullPath: string }> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error('Supabase Storage requires SUPABASE_SERVICE_ROLE_KEY on the server.');
  }

  const body =
    params.buffer ??
    (params.filePathOnDisk ? fs.readFileSync(params.filePathOnDisk) : null);
  if (!body) {
    throw new Error('No file content provided for Supabase Storage upload.');
  }

  const cleanPath = params.storagePath.replace(/^\/+/, '');
  const { data, error } = await admin.storage.from(params.bucket).upload(cleanPath, body, {
    contentType: params.contentType || 'application/octet-stream',
    upsert: true,
  });
  if (error) {
    throw new Error(`Supabase Storage upload failed (${params.bucket}/${cleanPath}): ${error.message}`);
  }
  return {
    bucket: params.bucket,
    path: data?.path || cleanPath,
    fullPath: `${params.bucket}/${data?.path || cleanPath}`,
  };
}

export async function createSupabaseSignedUrl(
  bucket: ErpStorageBucket,
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const admin = getSupabaseAdmin();
  if (!admin || !storagePath) return null;
  const cleanPath = storagePath.replace(/^\/+/, '');
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(cleanPath, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

type VerifiedJwtResult = {
  authUser: any;
  profile: any | null;
  schemaMissing?: boolean;
};

const verifiedJwtCache = new Map<string, { expiresAt: number; result: VerifiedJwtResult }>();
const inFlightJwtVerifications = new Map<string, Promise<VerifiedJwtResult | null>>();

export function clearVerifiedJwtCache(): void {
  verifiedJwtCache.clear();
}

function getJwtExpMs(jwt: string): number | null {
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof decoded?.exp === 'number' ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

export async function verifySupabaseJwtAndLoadProfile(jwt: string): Promise<VerifiedJwtResult | null> {
  const admin = getSupabaseAdmin();
  if (!admin || !jwt) return null;

  const tokenHash = crypto.createHash('sha256').update(jwt).digest('hex');
  const now = Date.now();
  const cached = verifiedJwtCache.get(tokenHash);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }
  if (cached) {
    verifiedJwtCache.delete(tokenHash);
  }

  const existingInFlight = inFlightJwtVerifications.get(tokenHash);
  if (existingInFlight) {
    return existingInFlight;
  }

  const runVerification = (async (): Promise<VerifiedJwtResult | null> => {
    const { data: userRes, error: authErr } = await admin.auth.getUser(jwt);
    if (authErr || !userRes?.user) return null;

    const authUser = userRes.user;
    const email = (authUser.email || '').trim().toLowerCase();

    let profile: any = null;
    let schemaMissing = false;

    const byAuthId = await admin
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .maybeSingle();

    if (byAuthId.error && /does not exist|schema cache|42P01|PGRST205/i.test(byAuthId.error.message || '')) {
      schemaMissing = true;
    }

    if (byAuthId.data) {
      profile = byAuthId.data;
    } else if (email && !schemaMissing) {
      const byEmail = await admin
        .from('user_profiles')
        .select('*')
        .ilike('email', email)
        .maybeSingle();
      if (byEmail.error && /does not exist|schema cache|42P01|PGRST205/i.test(byEmail.error.message || '')) {
        schemaMissing = true;
      }
      if (byEmail.data) {
        profile = byEmail.data;
        await admin
          .from('user_profiles')
          .update({ auth_user_id: authUser.id, updated_at: new Date().toISOString() })
          .eq('id', profile.id);
      }
    }

    if (profile && profile.status === 'INACTIVE') {
      verifiedJwtCache.delete(tokenHash);
      return null;
    }

    const result: VerifiedJwtResult = {
      authUser,
      profile,
      schemaMissing,
    };

    const expMs = getJwtExpMs(jwt);
    const maxCacheUntil = Date.now() + 45_000;
    const expiresAt = expMs ? Math.min(maxCacheUntil, expMs - 1000) : maxCacheUntil;
    if (expiresAt > Date.now()) {
      if (verifiedJwtCache.size > 200) {
        verifiedJwtCache.clear();
      }
      verifiedJwtCache.set(tokenHash, { expiresAt, result });
    }

    return result;
  })();

  inFlightJwtVerifications.set(tokenHash, runVerification);
  try {
    return await runVerification;
  } finally {
    inFlightJwtVerifications.delete(tokenHash);
  }
}

export async function resolveUsernameToEmailInSupabase(identifier: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const clean = identifier.trim().toLowerCase();
  if (!clean) return null;

  const { data } = await admin
    .from('user_profiles')
    .select('email, username, status')
    .or(`username.ilike.${clean},email.ilike.${clean}`)
    .limit(1)
    .maybeSingle();

  return data?.email || null;
}

export async function signInOrMigrateUserToSupabaseAuth(params: {
  identifier: string;
  password: string;
  legacyUserRecord?: any;
  verifyLegacyPassword?: (pwd: string, hash: string, salt: string) => boolean;
}): Promise<{
  session: any;
  authUser: any;
  profile: any;
} | null> {
  const admin = getSupabaseAdmin();
  const authClient = getSupabaseAuthClient();
  if (!admin || !authClient) return null;

  const cleanIdentifier = params.identifier.trim();
  const resolvedEmail =
    (await resolveUsernameToEmailInSupabase(cleanIdentifier)) ||
    params.legacyUserRecord?.email ||
    (cleanIdentifier.includes('@') ? cleanIdentifier : null);

  if (!resolvedEmail) return null;

  // 1. Try direct Supabase Auth password login first
  const { data: directData, error: directErr } = await authClient.auth.signInWithPassword({
    email: resolvedEmail,
    password: params.password,
  });

  if (!directErr && directData?.session && directData?.user) {
    const profileRes = await admin
      .from('user_profiles')
      .select('*')
      .or(`auth_user_id.eq.${directData.user.id},email.ilike.${resolvedEmail}`)
      .limit(1)
      .maybeSingle();

    let profile = profileRes.data;
    if (profile && !profile.auth_user_id) {
      await admin
        .from('user_profiles')
        .update({ auth_user_id: directData.user.id, last_login: new Date().toISOString() })
        .eq('id', profile.id);
    }
    return {
      session: directData.session,
      authUser: directData.user,
      profile,
    };
  }

  // 2. Safe legacy password migration: if user exists in legacy PBKDF2 store and password matches,
  //    provision/link Supabase Auth user seamlessly without storing plaintext passwords.
  const legacy = params.legacyUserRecord;
  if (
    legacy &&
    params.verifyLegacyPassword &&
    legacy.passwordHash &&
    legacy.passwordSalt &&
    params.verifyLegacyPassword(params.password, legacy.passwordHash, legacy.passwordSalt)
  ) {
    // Check if auth.users entry already exists for this email
    const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 200 });
    const existingAuth = (usersList?.users || []).find(
      (u) => (u.email || '').toLowerCase() === resolvedEmail.toLowerCase()
    );

    let authUserId = existingAuth?.id;
    if (!existingAuth) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: resolvedEmail,
        password: params.password,
        email_confirm: true,
        user_metadata: {
          erp_user_id: legacy.id,
          username: legacy.username,
          name: legacy.name,
          role: legacy.role,
        },
      });
      if (createErr || !created?.user) {
        throw new Error(`Supabase user migration failed: ${createErr?.message || 'Unknown error'}`);
      }
      authUserId = created.user.id;
    } else {
      await admin.auth.admin.updateUserById(existingAuth.id, {
        password: params.password,
        email_confirm: true,
      });
    }

    // Ensure user_profiles row exists and is linked to auth_user_id
    await admin.from('user_profiles').upsert(
      {
        id: legacy.id,
        auth_user_id: authUserId,
        username: legacy.username,
        email: resolvedEmail,
        name: legacy.name,
        mobile: legacy.mobile || '',
        department: legacy.department || 'Procurement',
        role: legacy.role,
        status: legacy.status || 'ACTIVE',
        must_change_password: Boolean(legacy.mustChangePassword),
        approval_limit: Number(legacy.approvalAuthority?.maxApprovalLimit || 0),
        approval_authority: legacy.approvalAuthority || {},
        permissions: legacy.permissions || {},
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    // Sign in immediately to obtain a genuine Supabase JWT session
    const { data: migratedSignIn, error: signInErr } = await authClient.auth.signInWithPassword({
      email: resolvedEmail,
      password: params.password,
    });
    if (signInErr || !migratedSignIn?.session) {
      throw new Error(`Supabase session issue after migration: ${signInErr?.message || 'No session returned'}`);
    }

    const { data: profile } = await admin
      .from('user_profiles')
      .select('*')
      .eq('id', legacy.id)
      .maybeSingle();

    return {
      session: migratedSignIn.session,
      authUser: migratedSignIn.user,
      profile,
    };
  }

  return null;
}

export async function recordSupabaseAuditLog(entry: {
  id?: string;
  actorUser: string;
  actorRole: string;
  action: string;
  module: string;
  recordId?: string;
  oldData?: any;
  newData?: any;
  remarks?: string;
  ipAddress?: string;
}) {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  await admin.from('audit_logs').insert({
    id: entry.id || `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    actor_user: entry.actorUser || 'System',
    actor_role: entry.actorRole || 'SYSTEM',
    action: entry.action,
    module: entry.module,
    record_id: entry.recordId || '',
    old_data: entry.oldData ?? null,
    new_data: entry.newData ?? null,
    remarks: entry.remarks || '',
    ip_address: entry.ipAddress || '',
    payload: {
      user: entry.actorUser,
      role: entry.actorRole,
      action: entry.action,
      module: entry.module,
      recordNumber: entry.recordId || '',
      remarks: entry.remarks || '',
    },
  });
}

export async function saveVendorAuthoritativeSupabase(
  vendorPayload: any,
  mode: 'CREATE' | 'UPDATE',
  actorUser: string,
  actorRole: string,
  ip: string,
  options?: { extraUsedIds?: string[] }
): Promise<{ success: true; verified: true; mode: 'CREATE' | 'UPDATE'; vendor: any }> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error('Supabase server client is not configured (missing SUPABASE_SERVICE_ROLE_KEY).');
  }

  const companyName = String(vendorPayload?.companyName || vendorPayload?.vendorName || '').trim();
  if (!companyName) {
    throw new Error('Vendor Company Name is mandatory.');
  }

  // Check duplicates cleanly before insert
  if (mode === 'CREATE') {
    const { data: existingByName, error: dupErr } = await admin
      .from('vendors')
      .select('id, company_name')
      .eq('is_deleted', false)
      .ilike('company_name', companyName)
      .limit(1);
    if (dupErr) throw new Error(`Database validation failed: ${dupErr.message}`);
    if (existingByName && existingByName.length > 0) {
      throw new Error(`Vendor "${companyName}" already exists (${existingByName[0].id}).`);
    }

    const gstin = String(vendorPayload?.gstin || '').trim().toUpperCase();
    if (gstin.length === 15) {
      const { data: existingByGst, error: gstErr } = await admin
        .from('vendors')
        .select('id, company_name')
        .eq('is_deleted', false)
        .eq('gstin', gstin)
        .limit(1);
      if (gstErr) throw new Error(`Database GSTIN validation failed: ${gstErr.message}`);
      if (existingByGst && existingByGst.length > 0) {
        throw new Error(`GSTIN "${gstin}" is already registered to "${existingByGst[0].company_name}" (${existingByGst[0].id}).`);
      }
    }
  }

  // Resolve deterministic collision-free ID on CREATE without ever reusing active, archived, tombstoned, or mapped IDs
  let vendorId = String(vendorPayload?.id || '').trim();
  if (mode === 'CREATE' || !vendorId) {
    const [{ data: existingIds }, { data: tombstones }] = await Promise.all([
      admin.from('vendors').select('id'),
      admin.from('deleted_tombstones').select('entity_id').eq('entity_type', 'vendor'),
    ]);
    const usedIds = new Set<string>([
      ...(existingIds || []).map((r: any) => String(r.id)),
      ...(tombstones || []).map((t: any) => String(t.entity_id)),
      ...(options?.extraUsedIds || []).map((id) => String(id)).filter(Boolean),
    ]);

    if (!vendorId || usedIds.has(vendorId)) {
      let maxNum = 10;
      for (const id of usedIds) {
        const m = id.match(/^VEND-(\d+)$/i);
        if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
      }
      vendorId = `VEND-${String(maxNum + 1).padStart(3, '0')}`;
      while (usedIds.has(vendorId)) {
        maxNum++;
        vendorId = `VEND-${String(maxNum + 1).padStart(3, '0')}`;
      }
    }
  }

  let oldVendorData: any = null;
  if (mode === 'UPDATE') {
    const { data: existingRow, error: fetchErr } = await admin
      .from('vendors')
      .select('*')
      .eq('id', vendorId)
      .maybeSingle();
    if (fetchErr) throw new Error(`Database lookup failed: ${fetchErr.message}`);
    if (!existingRow || existingRow.is_deleted) {
      throw new Error(`Vendor ${vendorId} not found or is archived.`);
    }
    oldVendorData = existingRow.payload || existingRow;
  }

  const nowIso = new Date().toISOString();
  const mergedVendor = {
    ...(oldVendorData || {}),
    ...vendorPayload,
    id: vendorId,
    vendorCode: vendorPayload?.vendorCode || oldVendorData?.vendorCode || vendorId,
    companyName,
    vendorName: companyName,
    status: vendorPayload?.status || oldVendorData?.status || 'ACTIVE',
    createdAt: oldVendorData?.createdAt || vendorPayload?.createdAt || nowIso,
    updatedAt: nowIso,
    isDeleted: false,
  };

  const row = {
    id: vendorId,
    vendor_code: mergedVendor.vendorCode,
    company_name: companyName,
    legal_name: mergedVendor.legalName || companyName,
    vendor_type: mergedVendor.vendorType || '',
    contact_person: mergedVendor.contactPerson || '',
    mobile: mergedVendor.mobile || '',
    alternate_mobile: mergedVendor.alternateMobile || '',
    email: mergedVendor.email || '',
    website: mergedVendor.website || '',
    address: mergedVendor.address || '',
    city: mergedVendor.city || '',
    state: mergedVendor.state || '',
    country: mergedVendor.country || 'India',
    pincode: mergedVendor.pincode || '',
    gstin: String(mergedVendor.gstin || '').toUpperCase(),
    pan: String(mergedVendor.pan || '').toUpperCase(),
    msme_status: mergedVendor.msmeStatus || '',
    payment_terms: mergedVendor.paymentTerms || '30 Days Net',
    delivery_terms: mergedVendor.deliveryTerms || '',
    rating: Number(mergedVendor.rating || 4.0),
    intelligence_score: Number(mergedVendor.intelligenceScore || 0),
    status: mergedVendor.status,
    brands_supplied: Array.isArray(mergedVendor.brandsSupplied) ? mergedVendor.brandsSupplied : [],
    material_categories: Array.isArray(mergedVendor.materialCategories) ? mergedVendor.materialCategories : [],
    product_families: Array.isArray(mergedVendor.productFamilies) ? mergedVendor.productFamilies : [],
    payload: mergedVendor,
    is_deleted: false,
    created_by: mergedVendor.createdBy || actorUser,
    created_at: mergedVendor.createdAt,
    updated_at: nowIso,
  };

  const { error: upsertErr } = await admin.from('vendors').upsert(row, { onConflict: 'id' });
  if (upsertErr) {
    throw new Error(`Database operation failed while saving vendor: ${upsertErr.message}`);
  }

  // Ensure any stale tombstone on this authoritative vendor ID is removed
  await clearTombstoneSupabase('vendor', vendorId);

  // Sync relational child tables cleanly
  if (Array.isArray(mergedVendor.contacts) && mergedVendor.contacts.length > 0) {
    const contactRows = mergedVendor.contacts.map((c: any, idx: number) => ({
      id: c.id || `VCON-${vendorId}-${idx + 1}`,
      vendor_id: vendorId,
      name: c.name || mergedVendor.contactPerson || 'Primary Contact',
      department: c.department || 'Sales',
      designation: c.designation || '',
      email: c.email || '',
      mobile: c.mobile || '',
      alternate_mobile: c.alternateMobile || '',
      landline: c.landline || '',
      whatsapp: c.whatsapp || '',
      is_primary: Boolean(c.isPrimary ?? idx === 0),
      source: c.source || 'MANUAL',
      confidence: Number(c.confidence || 100),
    }));
    const { error: cErr } = await admin.from('vendor_contacts').upsert(contactRows, { onConflict: 'id' });
    if (cErr) throw new Error(`Failed saving vendor contacts: ${cErr.message}`);
  }

  const brandNames: string[] = Array.isArray(mergedVendor.brandsSupplied) ? mergedVendor.brandsSupplied : [];
  if (brandNames.length > 0) {
    const brandRows = brandNames
      .filter((b) => typeof b === 'string' && b.trim())
      .map((b, idx) => ({
        id: `VBRD-${vendorId}-${idx + 1}-${b.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}`,
        vendor_id: vendorId,
        brand_name: b.trim(),
        relationship_type: 'Deals In',
        source: mode === 'CREATE' ? 'ONBOARDING' : 'UPDATE',
      }));
    if (brandRows.length > 0) {
      await admin.from('vendor_brands').upsert(brandRows, { onConflict: 'vendor_id,brand_name' });
    }
  }

  // Mandatory SELECT Readback Verification
  const { data: verifiedRow, error: verifyErr } = await admin
    .from('vendors')
    .select('id, company_name, is_deleted, payload')
    .eq('id', vendorId)
    .maybeSingle();

  if (verifyErr || !verifiedRow || verifiedRow.is_deleted) {
    throw new Error(
      `Vendor could not be verified in database after commit: ${verifyErr?.message || 'Record missing on readback'}`
    );
  }

  await recordSupabaseAuditLog({
    actorUser,
    actorRole,
    action: mode === 'CREATE' ? 'VENDOR_CREATED' : 'VENDOR_UPDATED',
    module: 'VENDOR_MASTER',
    recordId: vendorId,
    oldData: oldVendorData,
    newData: verifiedRow.payload,
    remarks: `${mode === 'CREATE' ? 'Created' : 'Updated'} vendor "${companyName}" (${vendorId}) verified in Supabase PostgreSQL`,
    ipAddress: ip,
  });

  return {
    success: true,
    verified: true,
    mode,
    vendor: verifiedRow.payload || mergedVendor,
  };
}

export async function getVendorByIdFromSupabase(
  vendorId: string,
  includeDeleted = false
): Promise<any | null> {
  const admin = getSupabaseAdmin();
  if (!admin || !vendorId) return null;
  let query = admin
    .from('vendors')
    .select('id, is_deleted, payload')
    .eq('id', vendorId);
  if (!includeDeleted) {
    query = query.eq('is_deleted', false);
  }
  const { data, error } = await query.maybeSingle();
  if (error) {
    if (isSupabaseSchemaMissingError(error)) return null;
    throw new Error(`Supabase vendor lookup failed: ${error.message}`);
  }
  if (!data) return null;
  return data.payload ? { ...data.payload, isDeleted: Boolean(data.is_deleted) } : null;
}

export async function softDeleteVendorInSupabase(
  vendorId: string,
  reason = 'User Archived Vendor',
  actorUser = 'Super Admin',
  actorRole = 'SUPER_ADMIN',
  ip = '127.0.0.1'
): Promise<{ success: boolean; verified: boolean; vendor: any }> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error('Supabase server client is not configured (missing SUPABASE_SERVICE_ROLE_KEY).');
  }

  const { data: existingRow, error: fetchErr } = await admin
    .from('vendors')
    .select('*')
    .eq('id', vendorId)
    .maybeSingle();
  if (fetchErr) throw new Error(`Supabase vendor lookup failed: ${fetchErr.message}`);
  if (!existingRow) {
    throw new Error(`Vendor ${vendorId} not found in database.`);
  }

  const nowIso = new Date().toISOString();
  const basePayload = existingRow.payload || { id: vendorId, companyName: existingRow.company_name };
  const archivedPayload = {
    ...basePayload,
    id: vendorId,
    status: 'INACTIVE',
    isDeleted: true,
    deletedAt: nowIso,
    deletedBy: actorUser,
    deletedReason: reason,
    updatedAt: nowIso,
  };

  // Soft-delete marks is_deleted = true WITHOUT adding a permanent deleted_tombstones row
  // so archived vendors remain visible in the Archived tab and can be restored cleanly.
  const { error: updateErr } = await admin
    .from('vendors')
    .update({
      is_deleted: true,
      deleted_at: nowIso,
      deleted_by: actorUser,
      deleted_reason: reason,
      status: 'INACTIVE',
      payload: archivedPayload,
      updated_at: nowIso,
    })
    .eq('id', vendorId);

  if (updateErr) {
    throw new Error(`Database operation failed while archiving vendor: ${updateErr.message}`);
  }

  // Ensure no stale permanent tombstone hides the archived vendor
  await clearTombstoneSupabase('vendor', vendorId);

  const { data: verifyRow, error: verifyErr } = await admin
    .from('vendors')
    .select('id, is_deleted, payload')
    .eq('id', vendorId)
    .maybeSingle();
  if (verifyErr || !verifyRow || !verifyRow.is_deleted) {
    throw new Error(`Vendor archive could not be verified in database: ${verifyErr?.message || 'State mismatch'}`);
  }

  await recordSupabaseAuditLog({
    actorUser,
    actorRole,
    action: 'VENDOR_ARCHIVED',
    module: 'VENDOR_MASTER',
    recordId: vendorId,
    oldData: basePayload,
    newData: verifyRow.payload || archivedPayload,
    remarks: `Archived (soft-deleted) vendor "${basePayload.companyName || vendorId}": ${reason}`,
    ipAddress: ip,
  });

  return {
    success: true,
    verified: true,
    vendor: verifyRow.payload || archivedPayload,
  };
}

export async function restoreVendorInSupabase(
  vendorId: string,
  actorUser = 'Super Admin',
  actorRole = 'SUPER_ADMIN',
  ip = '127.0.0.1'
): Promise<{ success: boolean; verified: boolean; vendor: any }> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error('Supabase server client is not configured (missing SUPABASE_SERVICE_ROLE_KEY).');
  }

  const { data: existingRow, error: fetchErr } = await admin
    .from('vendors')
    .select('*')
    .eq('id', vendorId)
    .maybeSingle();
  if (fetchErr) throw new Error(`Supabase vendor lookup failed: ${fetchErr.message}`);
  if (!existingRow) {
    throw new Error(`Archived vendor ${vendorId} not found in database.`);
  }

  const nowIso = new Date().toISOString();
  const basePayload = existingRow.payload || { id: vendorId, companyName: existingRow.company_name };
  const restoredPayload: Record<string, any> = {
    ...basePayload,
    id: vendorId,
    status: 'ACTIVE',
    isDeleted: false,
    updatedAt: nowIso,
  };
  delete restoredPayload.deletedAt;
  delete restoredPayload.deletedBy;
  delete restoredPayload.deletedReason;

  const { error: updateErr } = await admin
    .from('vendors')
    .update({
      is_deleted: false,
      deleted_at: null,
      deleted_by: null,
      deleted_reason: null,
      status: 'ACTIVE',
      payload: restoredPayload,
      updated_at: nowIso,
    })
    .eq('id', vendorId);

  if (updateErr) {
    throw new Error(`Database operation failed while restoring vendor: ${updateErr.message}`);
  }

  await clearTombstoneSupabase('vendor', vendorId);

  const { data: verifyRow, error: verifyErr } = await admin
    .from('vendors')
    .select('id, is_deleted, payload')
    .eq('id', vendorId)
    .maybeSingle();
  if (verifyErr || !verifyRow || verifyRow.is_deleted) {
    throw new Error(`Restored vendor could not be verified in database: ${verifyErr?.message || 'State mismatch'}`);
  }

  await recordSupabaseAuditLog({
    actorUser,
    actorRole,
    action: 'VENDOR_RESTORED',
    module: 'VENDOR_MASTER',
    recordId: vendorId,
    oldData: basePayload,
    newData: verifyRow.payload || restoredPayload,
    remarks: `Restored vendor "${restoredPayload.companyName || vendorId}" to active Vendor Master`,
    ipAddress: ip,
  });

  return {
    success: true,
    verified: true,
    vendor: verifyRow.payload || restoredPayload,
  };
}

export async function saveRfqAuthoritativeSupabase(
  rfqPayload: any,
  actorUser: string,
  actorRole: string,
  ip: string
) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error('Supabase server client is not configured (missing SUPABASE_SERVICE_ROLE_KEY).');
  }

  const nowIso = new Date().toISOString();
  const year = new Date().getFullYear();
  let rfqNumber = String(rfqPayload?.rfqNumber || rfqPayload?.id || '').trim();
  if (!rfqNumber) {
    const { data: existingRfqs } = await admin.from('rfqs').select('rfq_number');
    let maxSeq = 100000;
    for (const r of existingRfqs || []) {
      const m = String(r.rfq_number || '').match(/(\d+)$/);
      if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
    }
    rfqNumber = `RFQ-${year}-${maxSeq + 1}`;
  }

  const vendorIds: string[] = Array.isArray(rfqPayload?.vendorIds)
    ? rfqPayload.vendorIds.filter(Boolean)
    : rfqPayload?.vendorId
      ? [rfqPayload.vendorId]
      : [];

  const rawItems = Array.isArray(rfqPayload?.items) && rfqPayload.items.length > 0
    ? rfqPayload.items
    : [
        {
          itemName: rfqPayload?.itemName || 'MRO Industrial Supply',
          partNumber: rfqPayload?.partCode || rfqPayload?.partNumber || '',
          brand: rfqPayload?.brand || '',
          category: rfqPayload?.category || 'General MRO',
          quantity: Number(rfqPayload?.quantity || 1),
          uom: rfqPayload?.uom || 'NOS',
          targetPrice: Number(rfqPayload?.targetPrice || rfqPayload?.rate || 0),
        },
      ];

  const processedItems = rawItems.map((item: any, idx: number) => ({
    id: item.id || `RFQ-ITEM-${rfqNumber.replace(/[^a-zA-Z0-9]/g, '')}-${idx + 1}`,
    rfqId: rfqNumber,
    productId: item.productId || '',
    brand: item.brand || '',
    partCode: item.partCode || item.partNumber || '',
    partNumber: item.partNumber || item.partCode || '',
    modelNumber: item.modelNumber || '',
    manufacturerCode: item.manufacturerCode || '',
    itemName: String(item.itemName || item.description || `Item #${idx + 1}`).trim(),
    description: item.description || item.itemName || '',
    category: item.category || 'Electrical',
    subCategory: item.subCategory || '',
    specifications: item.specifications || item.specs || '',
    quantity: Number(item.quantity || 1) > 0 ? Number(item.quantity || 1) : 1,
    uom: String(item.uom || 'NOS').toUpperCase(),
    targetPrice: Number(item.targetPrice || item.rate || 0),
    rate: Number(item.rate || item.targetPrice || 0),
    vendorId: item.vendorId || vendorIds[0] || '',
    vendorName: item.vendorName || rfqPayload?.vendorName || '',
    requiredDeliveryDate: item.requiredDeliveryDate || rfqPayload?.requiredDate || nowIso.split('T')[0],
  }));

  const fullRfq = {
    ...rfqPayload,
    id: rfqNumber,
    rfqNumber,
    requirementId: rfqPayload?.requirementId || null,
    vendorIds,
    vendorId: vendorIds[0] || '',
    vendorName: rfqPayload?.vendorName || '',
    customerId: rfqPayload?.customerId || rfqPayload?.companyId || '',
    customerName: rfqPayload?.customerName || rfqPayload?.companyName || 'Industrial Customer',
    companyId: rfqPayload?.companyId || rfqPayload?.customerId || '',
    companyName: rfqPayload?.companyName || rfqPayload?.customerName || 'Industrial Customer',
    requiredDate: rfqPayload?.requiredDate || nowIso.split('T')[0],
    sentDate: rfqPayload?.sentDate || nowIso,
    status: rfqPayload?.status || (vendorIds.length > 0 ? 'SENT' : 'NEW_RFQ'),
    items: processedItems,
    createdBy: rfqPayload?.createdBy || actorUser,
    createdAt: rfqPayload?.createdAt || nowIso,
    updatedAt: nowIso,
    isDeleted: false,
    dbSaveStatus: 'COMMITTED',
  };

  const { error: rfqErr } = await admin.from('rfqs').upsert(
    {
      id: rfqNumber,
      rfq_number: rfqNumber,
      requirement_id: fullRfq.requirementId || null,
      customer_id: fullRfq.customerId,
      customer_name: fullRfq.customerName,
      company_id: fullRfq.companyId,
      company_name: fullRfq.companyName,
      purchase_executive_id: fullRfq.purchaseExecutiveId || '',
      purchase_executive_name: fullRfq.purchaseExecutiveName || '',
      required_date: fullRfq.requiredDate,
      sent_date: fullRfq.sentDate,
      status: fullRfq.status,
      notes: fullRfq.notes || '',
      commercial_terms: fullRfq.commercialTerms || '',
      created_by: fullRfq.createdBy,
      payload: fullRfq,
      is_deleted: false,
      created_at: fullRfq.createdAt,
      updated_at: nowIso,
    },
    { onConflict: 'id' }
  );
  if (rfqErr) {
    throw new Error(`Supabase RFQ insert failed: ${rfqErr.message}`);
  }

  const itemRows = processedItems.map((it: any) => ({
    id: it.id,
    rfq_id: rfqNumber,
    product_id: it.productId || '',
    brand: it.brand || '',
    part_code: it.partCode || '',
    part_number: it.partNumber || '',
    model_number: it.modelNumber || '',
    manufacturer_code: it.manufacturerCode || '',
    item_name: it.itemName,
    description: it.description || '',
    category: it.category || '',
    sub_category: it.subCategory || '',
    specifications: it.specifications || '',
    quantity: it.quantity,
    uom: it.uom,
    target_price: it.targetPrice,
    rate: it.rate,
    vendor_id: it.vendorId || '',
    vendor_name: it.vendorName || '',
    required_delivery_date: it.requiredDeliveryDate || '',
  }));
  const { error: itemErr } = await admin.from('rfq_items').upsert(itemRows, { onConflict: 'id' });
  if (itemErr) throw new Error(`Supabase RFQ items insert failed: ${itemErr.message}`);

  if (vendorIds.length > 0) {
    const relRows = vendorIds.map((vid) => ({
      id: `RFQV-${rfqNumber}-${vid}`,
      rfq_id: rfqNumber,
      vendor_id: vid,
      vendor_name: rfqPayload?.vendorName || '',
      status: 'SENT',
      sent_at: nowIso,
    }));
    const { error: relErr } = await admin.from('rfq_vendors').upsert(relRows, { onConflict: 'rfq_id,vendor_id' });
    if (relErr) throw new Error(`Supabase RFQ vendor relationship insert failed: ${relErr.message}`);
  }

  // Mandatory SELECT Readback Verification
  const { data: verifiedRfq, error: verifyErr } = await admin
    .from('rfqs')
    .select('id, rfq_number, is_deleted, payload')
    .eq('id', rfqNumber)
    .maybeSingle();

  if (verifyErr || !verifiedRfq || verifiedRfq.is_deleted) {
    throw new Error(`RFQ ${rfqNumber} verification readback failed: ${verifyErr?.message || 'Not found'}`);
  }

  await recordSupabaseAuditLog({
    actorUser,
    actorRole,
    action: 'RFQ_CREATED',
    module: 'RFQ',
    recordId: rfqNumber,
    newData: verifiedRfq.payload,
    remarks: `RFQ ${rfqNumber} committed and verified in Supabase PostgreSQL with ${processedItems.length} item(s)`,
    ipAddress: ip,
  });

  return {
    success: true,
    verified: true,
    rfq: verifiedRfq.payload || fullRfq,
    rfqId: rfqNumber,
    rfqNumber,
    itemsCount: processedItems.length,
    timestamp: nowIso,
  };
}

export async function saveBulkRfqsSupabase(
  rfqsList: any[],
  actorUser: string,
  actorRole: string,
  ip: string
) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Supabase server client is not configured.');

  const results: Array<{
    row: number;
    rfqNumber: string;
    result: 'SAVED' | 'DUPLICATE' | 'FAILED';
    reason?: string;
    rfqId?: string;
  }> = [];
  const savedRfqs: any[] = [];
  let duplicateCount = 0;
  let failedCount = 0;
  const seen = new Set<string>();

  for (let i = 0; i < rfqsList.length; i++) {
    const rowNum = i + 1;
    const raw = rfqsList[i];
    if (!raw || typeof raw !== 'object') {
      results.push({ row: rowNum, rfqNumber: `ROW-${rowNum}`, result: 'FAILED', reason: 'Empty or invalid row' });
      failedCount++;
      continue;
    }

    const candidateNum = String(raw.rfqNumber || raw.id || '').trim();
    if (candidateNum && seen.has(candidateNum.toLowerCase())) {
      results.push({ row: rowNum, rfqNumber: candidateNum, result: 'DUPLICATE', reason: `Duplicate RFQ "${candidateNum}" in batch` });
      duplicateCount++;
      continue;
    }

    if (candidateNum && raw.allowUpdate !== true) {
      const { data: existing } = await admin
        .from('rfqs')
        .select('id')
        .eq('is_deleted', false)
        .or(`id.eq.${candidateNum},rfq_number.eq.${candidateNum}`)
        .limit(1);
      if (existing && existing.length > 0) {
        results.push({ row: rowNum, rfqNumber: candidateNum, result: 'DUPLICATE', reason: `RFQ ${candidateNum} already exists in database`, rfqId: existing[0].id });
        duplicateCount++;
        continue;
      }
    }

    try {
      const res = await saveRfqAuthoritativeSupabase(raw, actorUser, actorRole, ip);
      if (candidateNum) seen.add(candidateNum.toLowerCase());
      results.push({ row: rowNum, rfqNumber: res.rfqNumber, result: 'SAVED', rfqId: res.rfqId });
      savedRfqs.push(res.rfq);
    } catch (err: any) {
      results.push({ row: rowNum, rfqNumber: candidateNum || `ROW-${rowNum}`, result: 'FAILED', reason: err?.message || 'Insert failed' });
      failedCount++;
    }
  }

  return {
    success: true,
    totalSubmitted: rfqsList.length,
    successfullySaved: savedRfqs.length,
    duplicateCount,
    failedCount,
    results,
    savedRfqs,
  };
}

/**
 * Preserves rate history:
 * - Same rate -> keep current version
 * - Changed rate -> mark previous current rate historical (is_current=false, effective_to=today) & insert new current rate
 */
export async function recordVersionedRateHistorySupabase(params: {
  partCode: string;
  productName: string;
  brand: string;
  vendorId?: string;
  vendorName?: string;
  productId?: string;
  catalogueItemId?: string;
  mrp: number;
  discountPercent: number;
  purchaseRate: number;
  effectiveFrom: string;
  importBatchId?: string;
  catalogueVersion?: string;
  source?: string;
}): Promise<{ changed: boolean; versionAction: 'UNCHANGED' | 'NEW_VERSION' }> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Supabase server client is not configured.');

  const normPart = normalizePartCode(params.partCode);
  const { data: currentRows } = await admin
    .from('rate_history')
    .select('*')
    .eq('part_code', normPart)
    .eq('is_current', true)
    .order('created_at', { ascending: false })
    .limit(1);

  const current = currentRows?.[0];
  if (
    current &&
    Number(current.mrp || 0) === Number(params.mrp || 0) &&
    Number(current.discount_percent || 0) === Number(params.discountPercent || 0) &&
    Number(current.purchase_rate || 0) === Number(params.purchaseRate || 0)
  ) {
    return { changed: false, versionAction: 'UNCHANGED' };
  }

  const today = params.effectiveFrom || new Date().toISOString().split('T')[0];
  if (current) {
    await admin
      .from('rate_history')
      .update({ is_current: false, effective_to: today })
      .eq('id', current.id);
  }

  const newId = `RH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await admin.from('rate_history').insert({
    id: newId,
    catalogue_item_id: params.catalogueItemId || null,
    product_id: params.productId || null,
    vendor_id: params.vendorId || null,
    vendor_name: params.vendorName || '',
    brand: params.brand || '',
    part_code: normPart || params.partCode,
    product_name: params.productName || '',
    mrp: Number(params.mrp || 0),
    discount_percent: Number(params.discountPercent || 0),
    purchase_rate: Number(params.purchaseRate || 0),
    effective_from: today,
    effective_to: '',
    year: new Date(today).getFullYear() || new Date().getFullYear(),
    import_batch_id: params.importBatchId || '',
    catalogue_version: params.catalogueVersion || '',
    source: params.source || 'CATALOGUE',
    is_current: true,
    payload: {
      id: newId,
      partCode: params.partCode,
      productName: params.productName,
      brand: params.brand,
      vendorId: params.vendorId,
      vendorName: params.vendorName,
      mrp: Number(params.mrp || 0),
      discountPercent: Number(params.discountPercent || 0),
      purchaseRate: Number(params.purchaseRate || 0),
      effectiveDate: today,
      catalogueVersion: params.catalogueVersion || '',
      importBatchId: params.importBatchId || '',
      source: params.source || 'CATALOGUE',
      isCurrent: true,
    },
  });

  if (error) throw new Error(`Failed saving rate history version: ${error.message}`);
  return { changed: true, versionAction: 'NEW_VERSION' };
}

export function isSupabaseSchemaMissingError(err: any): boolean {
  const msg = typeof err === 'string' ? err : String(err?.message || err || '');
  return /Could not find the table|does not exist|schema cache|42P01|PGRST205/i.test(msg);
}

export async function syncUserProfileAndAuthSupabase(params: {
  user: any;
  plainPassword?: string;
  mode: 'CREATE' | 'UPDATE';
}): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin || !params.user?.id) return;

  const u = params.user;
  const email = String(u.email || '').trim();
  let authUserId: string | undefined = u.authUserId || undefined;

  if (email) {
    try {
      const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 200 });
      const existingAuth = (usersList?.users || []).find(
        (au) => (au.email || '').toLowerCase() === email.toLowerCase()
      );
      if (!existingAuth && (params.plainPassword || params.mode === 'CREATE')) {
        const { data: created } = await admin.auth.admin.createUser({
          email,
          password: params.plainPassword || 'Welcome@123',
          email_confirm: true,
          user_metadata: {
            erp_user_id: u.id,
            username: u.username,
            name: u.name,
            role: u.role,
          },
        });
        authUserId = created?.user?.id || authUserId;
      } else if (existingAuth) {
        authUserId = existingAuth.id;
        const updatePayload: any = {
          email_confirm: true,
          user_metadata: {
            ...(existingAuth.user_metadata || {}),
            erp_user_id: u.id,
            username: u.username,
            name: u.name,
            role: u.role,
          },
        };
        if (params.plainPassword) {
          updatePayload.password = params.plainPassword;
        }
        await admin.auth.admin.updateUserById(existingAuth.id, updatePayload);
      }
    } catch (authErr: any) {
      console.warn('[Supabase] Auth admin user sync warning:', authErr?.message || authErr);
    }
  }

  const row: Record<string, any> = {
    id: u.id,
    username: u.username,
    email: email || `${u.username}@mroerp.local`,
    name: u.name || u.username,
    mobile: u.mobile || '',
    designation: u.designation || '',
    department: u.department || 'Procurement',
    role: u.role || 'PROCUREMENT_EMPLOYEE',
    status: u.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    must_change_password: Boolean(u.mustChangePassword ?? u.forcePasswordChange),
    approval_limit: Number(u.approvalAuthority?.maxApprovalLimit ?? u.approvalLimit ?? 0),
    approval_authority: u.approvalAuthority || { maxApprovalLimit: Number(u.approvalLimit ?? 0) },
    permissions: u.permissions || {},
    updated_at: new Date().toISOString(),
  };
  if (authUserId) row.auth_user_id = authUserId;

  const { error } = await admin.from('user_profiles').upsert(row, { onConflict: 'id' });
  if (error && !isSupabaseSchemaMissingError(error)) {
    throw new Error(`Supabase user profile sync failed: ${error.message}`);
  }
  clearVerifiedJwtCache();
}

export async function deleteUserProfileSupabase(userId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin || !userId) return;
  const { data: existing } = await admin
    .from('user_profiles')
    .select('auth_user_id')
    .eq('id', userId)
    .maybeSingle();

  const { error } = await admin.from('user_profiles').delete().eq('id', userId);
  if (error && !isSupabaseSchemaMissingError(error)) {
    throw new Error(`Supabase user profile delete failed: ${error.message}`);
  }

  if (existing?.auth_user_id) {
    try {
      await admin.auth.admin.deleteUser(existing.auth_user_id);
    } catch {}
  }
  clearVerifiedJwtCache();
}

export async function saveRoleSupabase(role: any): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin || !role?.id) return;
  const { error } = await admin.from('roles').upsert(
    {
      id: role.id,
      name: role.name,
      description: role.description || '',
      approval_limit: Number(role.approvalLimit || 0),
      default_permissions: role.defaultPermissions || {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error && !isSupabaseSchemaMissingError(error)) {
    throw new Error(`Supabase role save failed: ${error.message}`);
  }
}

export async function upsertTombstoneSupabase(
  entityType: string,
  entityId: string,
  deletedBy = 'Authorized User',
  reason = 'Deleted'
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin || !entityType || !entityId) return;
  const { error } = await admin.from('deleted_tombstones').upsert(
    {
      id: `${entityType}:${entityId}`,
      entity_type: entityType,
      entity_id: entityId,
      deleted_by: deletedBy,
      reason,
      deleted_at: new Date().toISOString(),
    },
    { onConflict: 'entity_type,entity_id' }
  );
  if (error && !isSupabaseSchemaMissingError(error)) {
    throw new Error(`Supabase tombstone upsert failed: ${error.message}`);
  }
}

export async function clearTombstoneSupabase(entityType: string, entityId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin || !entityType || !entityId) return;
  const { error } = await admin
    .from('deleted_tombstones')
    .delete()
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);
  if (error && !isSupabaseSchemaMissingError(error)) {
    throw new Error(`Supabase tombstone clear failed: ${error.message}`);
  }
}

export async function saveEntityPayloadSupabase(
  table: string,
  row: Record<string, any>,
  onConflict = 'id'
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const { error } = await admin.from(table).upsert(row, { onConflict });
  if (error && !isSupabaseSchemaMissingError(error)) {
    throw new Error(`Supabase save failed on "${table}": ${error.message}`);
  }
}

export async function deleteEntitySupabase(
  table: string,
  id: string,
  tombstoneType?: string,
  actorUser = 'Authorized User',
  softDelete = false,
  reason = 'Deleted by user'
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin || !id) return;
  if (softDelete) {
    const { error } = await admin
      .from(table)
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error && !isSupabaseSchemaMissingError(error)) {
      throw new Error(`Supabase soft-delete failed on "${table}": ${error.message}`);
    }
  } else {
    const { error } = await admin.from(table).delete().eq('id', id);
    if (error && !isSupabaseSchemaMissingError(error)) {
      throw new Error(`Supabase delete failed on "${table}": ${error.message}`);
    }
  }
  if (tombstoneType) {
    await upsertTombstoneSupabase(tombstoneType, id, actorUser, reason);
  }
}

export async function saveSettingsKeySupabase(
  settingKey: string,
  settingValue: any,
  updatedBy = 'Admin'
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const { error } = await admin.from('erp_settings').upsert(
    {
      setting_key: settingKey,
      setting_value: settingValue ?? {},
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' }
  );
  if (error && !isSupabaseSchemaMissingError(error)) {
    throw new Error(`Supabase settings save failed (${settingKey}): ${error.message}`);
  }
}

export async function saveVendorOnboardingSupabase(
  commitResult: any,
  actorUser: string,
  actorRole: string,
  ip: string,
  options?: { extraUsedIds?: string[] }
): Promise<{ vendor: any; verified: boolean; mode: 'CREATE' | 'UPDATE' } | null> {
  const admin = getSupabaseAdmin();
  if (!admin || !commitResult?.vendor?.id) return null;

  const sbVendorRes = await saveVendorAuthoritativeSupabase(
    commitResult.vendor,
    commitResult.mode === 'UPDATE' ? 'UPDATE' : 'CREATE',
    actorUser,
    actorRole,
    ip,
    options
  );

  const authoritativeVendor = sbVendorRes.vendor;
  const vendorId = authoritativeVendor.id;
  const vendorCode = authoritativeVendor.vendorCode || vendorId;
  const companyName = authoritativeVendor.companyName || commitResult.vendor.companyName || '';
  const nowIso = new Date().toISOString();

  if (Array.isArray(commitResult.newBrands) && commitResult.newBrands.length > 0) {
    const brandRows = commitResult.newBrands.map((b: any) => ({
      id: b.id,
      name: b.name || b.id,
      code: b.code || '',
      manufacturer: b.manufacturer || '',
      category: b.category || '',
      website: b.website || '',
      is_active: b.isActive !== false,
      status: b.status || 'ACTIVE',
      payload: b,
      is_deleted: false,
      updated_at: nowIso,
    }));
    const { error: bErr } = await admin.from('brands').upsert(brandRows, { onConflict: 'id' });
    if (bErr && !isSupabaseSchemaMissingError(bErr)) {
      throw new Error(`Supabase onboarding brands save failed: ${bErr.message}`);
    }
  }

  if (Array.isArray(commitResult.newProductTypes) && commitResult.newProductTypes.length > 0) {
    const ptRows = commitResult.newProductTypes.map((pt: any) => ({
      id: pt.id,
      name: pt.name || pt.id,
      category: pt.category || '',
      sub_category: pt.subCategory || '',
      description: pt.description || '',
      is_active: pt.isActive !== false,
      payload: pt,
      updated_at: nowIso,
    }));
    const { error: ptErr } = await admin.from('product_types').upsert(ptRows, { onConflict: 'id' });
    if (ptErr && !isSupabaseSchemaMissingError(ptErr)) {
      throw new Error(`Supabase onboarding product_types save failed: ${ptErr.message}`);
    }
  }

  if (Array.isArray(commitResult.mappings) && commitResult.mappings.length > 0) {
    const mappingRows = commitResult.mappings.map((m: any) => {
      const patched = { ...m, vendorId, vendorCode, vendorName: m.vendorName || companyName };
      return {
        id: m.id,
        vendor_id: vendorId,
        vendor_code: vendorCode,
        vendor_name: patched.vendorName,
        product_id: null,
        product_name: m.productName || 'Mapped Product',
        category: m.category || '',
        sub_category: m.subCategory || '',
        product_type: m.productType || '',
        brand: m.brand || '',
        model_number: m.modelNumber || '',
        part_number: m.partNumber || '',
        specification: m.specification || '',
        uom: m.uom || 'NOS',
        supply_type: m.supplyType || 'Dealer',
        availability: m.availability || 'Regular Stock',
        status: m.status || 'ACTIVE',
        remarks: m.remarks || '',
        payload: patched,
        is_deleted: false,
        updated_at: nowIso,
      };
    });
    const { error: mErr } = await admin.from('vendor_product_mapping').upsert(mappingRows, { onConflict: 'id' });
    if (mErr && !isSupabaseSchemaMissingError(mErr)) {
      throw new Error(`Supabase onboarding mappings save failed: ${mErr.message}`);
    }
  }

  if (commitResult.batch?.id) {
    const b = { ...commitResult.batch, vendorId, vendorName: commitResult.batch.vendorName || companyName };
    const { error: batchErr } = await admin.from('catalogue_import_batches').upsert(
      {
        id: b.id,
        vendor_id: vendorId,
        vendor_name: b.vendorName,
        file_name: b.fileName || 'Onboarding Catalogue',
        source_type: b.sourceType || 'PDF',
        version: b.version || '1.0',
        status: b.status || 'COMPLETED',
        total_records: Number(b.totalRows || b.productsCount || 0),
        new_count: Number(b.newProductsCount || b.newCount || 0),
        updated_count: Number(b.updatedProductsCount || b.updatedCount || 0),
        uploaded_by: b.uploadedBy || actorUser,
        effective_date: b.effectiveDate || '',
        payload: b,
        updated_at: nowIso,
      },
      { onConflict: 'id' }
    );
    if (batchErr && !isSupabaseSchemaMissingError(batchErr)) {
      throw new Error(`Supabase onboarding batch save failed: ${batchErr.message}`);
    }
  }

  if (Array.isArray(commitResult.catalogueItems) && commitResult.catalogueItems.length > 0) {
    const catRows = commitResult.catalogueItems.map((ci: any) => {
      const patched = { ...ci, vendorId };
      return {
        id: ci.id,
        batch_id: commitResult.batch?.id || null,
        vendor_id: vendorId,
        part_code: ci.partCode || ci.partNumber || ci.id,
        normalized_part_code: String(ci.partCode || ci.partNumber || '').trim().toUpperCase(),
        manufacturer_code: ci.manufacturerCode || '',
        model_number: ci.modelNumber || '',
        product_name: ci.productName || 'Catalogue Item',
        brand: ci.brand || '',
        category: ci.category || '',
        sub_category: ci.subCategory || '',
        specification: ci.specification || '',
        uom: ci.uom || 'NOS',
        mrp: Number(ci.mrp || 0),
        discount_percent: Number(ci.discountPercent || 0),
        purchase_rate: Number(ci.purchaseRate || 0),
        catalogue_version: ci.catalogueVersion || '',
        effective_date: ci.effectiveDate || '',
        source_file: ci.sourceFile || '',
        source_page: String(ci.sourcePage || ''),
        status: ci.status || 'ACTIVE',
        payload: patched,
        updated_at: nowIso,
      };
    });
    const { error: ciErr } = await admin.from('catalogue_items').upsert(catRows, { onConflict: 'id' });
    if (ciErr && !isSupabaseSchemaMissingError(ciErr)) {
      throw new Error(`Supabase onboarding catalogue_items save failed: ${ciErr.message}`);
    }
  }

  if (Array.isArray(commitResult.rateVersions) && commitResult.rateVersions.length > 0) {
    const rhRows = commitResult.rateVersions.map((rh: any) => {
      const patched = { ...rh, vendorId, vendorName: rh.vendorName || companyName };
      return {
        id: rh.id,
        vendor_id: vendorId,
        vendor_name: patched.vendorName,
        brand: rh.brand || '',
        part_code: rh.partCode || '',
        product_name: rh.productName || '',
        mrp: Number(rh.mrp || 0),
        discount_percent: Number(rh.discountPercent || 0),
        purchase_rate: Number(rh.purchaseRate || 0),
        effective_from: rh.effectiveDate || '',
        effective_to: rh.effectiveTo || '',
        import_batch_id: rh.importBatchId || commitResult.batch?.id || '',
        catalogue_version: rh.catalogueVersion || '',
        source: rh.source || 'VENDOR_ONBOARDING',
        is_current: rh.isCurrent !== false,
        payload: patched,
      };
    });
    const { error: rhErr } = await admin.from('rate_history').upsert(rhRows, { onConflict: 'id' });
    if (rhErr && !isSupabaseSchemaMissingError(rhErr)) {
      throw new Error(`Supabase onboarding rate_history save failed: ${rhErr.message}`);
    }
  }

  return {
    vendor: authoritativeVendor,
    verified: true,
    mode: sbVendorRes.mode,
  };
}

let cachedSupabaseState: { loadedAt: number; state: Record<string, any> } | null = null;
let inFlightSupabaseStateLoad: Promise<Record<string, any> | null> | null = null;

export function invalidateSupabaseStateCache(): void {
  cachedSupabaseState = null;
}

export async function loadAuthoritativeStateFromSupabase(options?: { maxAgeMs?: number }): Promise<Record<string, any> | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const maxAgeMs = options?.maxAgeMs ?? 0;
  if (maxAgeMs > 0 && cachedSupabaseState && Date.now() - cachedSupabaseState.loadedAt < maxAgeMs) {
    return cachedSupabaseState.state;
  }
  if (inFlightSupabaseStateLoad) {
    return inFlightSupabaseStateLoad;
  }

  const runLoad = (async (): Promise<Record<string, any> | null> => {
    const schemaProbe = await admin.from('vendors').select('id').limit(1);
    if (schemaProbe.error) {
      throw new Error(`Supabase read failed: ${schemaProbe.error.message}`);
    }

  const [
    usersRes,
    rolesRes,
    vendorsRes,
    customersRes,
    companiesRes,
    execsRes,
    brandsRes,
    categoriesRes,
    productTypesRes,
    productsRes,
    mappingsRes,
    catalogueItemsRes,
    rateHistoryRes,
    importBatchesRes,
    requirementsRes,
    rfqsRes,
    quotesRes,
    quotationsRes,
    customerPosRes,
    vendorPosRes,
    piRes,
    paymentsRes,
    dispatchesRes,
    deliveriesRes,
    billsRes,
    salesBillsRes,
    expensesRes,
    challansRes,
    approvalsRes,
    notificationsRes,
    auditRes,
    docsRes,
    settingsRes,
    tombstonesRes,
  ] = await Promise.all([
    admin.from('user_profiles').select('id, username, email, name, mobile, designation, department, role, status, must_change_password, approval_limit, approval_authority, permissions, last_login, created_at'),
    admin.from('roles').select('id, name, description, approval_limit, default_permissions'),
    admin.from('vendors').select('id, is_deleted, payload'),
    admin.from('customers').select('id, is_deleted, payload'),
    admin.from('companies').select('id, is_deleted, payload'),
    admin.from('purchase_executives').select('id, is_deleted, payload'),
    admin.from('brands').select('id, is_deleted, payload'),
    admin.from('categories').select('id, is_deleted, payload'),
    admin.from('product_types').select('id, payload'),
    admin.from('products').select('id, is_deleted, payload'),
    admin.from('vendor_product_mapping').select('id, is_deleted, payload'),
    admin.from('catalogue_items').select('id, payload'),
    admin.from('rate_history').select('id, payload').order('created_at', { ascending: false }).limit(2000),
    admin.from('catalogue_import_batches').select('id, payload').order('created_at', { ascending: false }).limit(500),
    admin.from('requirements').select('id, is_deleted, payload'),
    admin.from('rfqs').select('id, is_deleted, payload'),
    admin.from('quotes').select('id, is_deleted, payload'),
    admin.from('customer_quotations').select('id, payload'),
    admin.from('customer_pos').select('id, payload'),
    admin.from('vendor_pos').select('id, payload'),
    admin.from('proforma_invoices').select('id, payload'),
    admin.from('payments').select('id, payload'),
    admin.from('dispatches').select('id, payload'),
    admin.from('deliveries').select('id, payload'),
    admin.from('purchase_bills').select('id, payload'),
    admin.from('sales_bills').select('id, payload'),
    admin.from('expenses').select('id, payload'),
    admin.from('challans').select('id, payload'),
    admin.from('approvals').select('id, payload'),
    admin.from('notifications').select('id, payload').order('created_at', { ascending: false }).limit(200),
    admin.from('audit_logs').select('id, payload').order('timestamp', { ascending: false }).limit(500),
    admin.from('documents').select('id, payload').order('uploaded_at', { ascending: false }).limit(500),
    admin.from('erp_settings').select('setting_key, setting_value'),
    admin.from('deleted_tombstones').select('entity_type, entity_id'),
  ]);

  if (vendorsRes.error) {
    throw new Error(`Supabase read failed: ${vendorsRes.error.message}`);
  }

  const unwrap = (res: any) =>
    Array.isArray(res?.data) ? res.data.map((r: any) => r.payload).filter(Boolean) : [];

  const settingsMap: Record<string, any> = {};
  for (const s of settingsRes.data || []) {
    settingsMap[s.setting_key] = s.setting_value;
  }

  const tombstonesByType = new Map<string, string[]>();
  for (const t of tombstonesRes.data || []) {
    const arr = tombstonesByType.get(t.entity_type) || [];
    arr.push(t.entity_id);
    tombstonesByType.set(t.entity_type, arr);
  }

  const mappedUsers = Array.isArray(usersRes?.data)
    ? usersRes.data.map((u: any) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        name: u.name,
        mobile: u.mobile || '',
        designation: u.designation || '',
        department: u.department || 'Procurement',
        role: u.role || 'PROCUREMENT_EMPLOYEE',
        status: u.status || 'ACTIVE',
        mustChangePassword: Boolean(u.must_change_password),
        approvalLimit: Number(u.approval_limit ?? u.approval_authority?.maxApprovalLimit ?? 0),
        approvalAuthority: u.approval_authority || { maxApprovalLimit: Number(u.approval_limit ?? 0) },
        permissions: u.permissions || {},
        lastLogin: u.last_login || 'Never',
        createdAt: u.created_at ? String(u.created_at).slice(0, 10) : '',
      }))
    : [];

  const mappedRoles = Array.isArray(rolesRes?.data)
    ? rolesRes.data.map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description || '',
        approvalLimit: Number(r.approval_limit || 0),
        defaultPermissions: r.default_permissions || {},
      }))
    : [];

  return {
    users: mappedUsers,
    roles: mappedRoles,
    vendors: unwrap(vendorsRes).filter((v: any) => !v.isDeleted),
    archivedVendors: unwrap(vendorsRes).filter((v: any) => v.isDeleted),
    customers: unwrap(customersRes).filter((c: any) => !c.isDeleted),
    companies: unwrap(companiesRes).filter((c: any) => !c.isDeleted),
    purchaseExecutives: unwrap(execsRes).filter((e: any) => !e.isDeleted),
    brands: unwrap(brandsRes).filter((b: any) => !b.isDeleted),
    categories: unwrap(categoriesRes).filter((c: any) => !c.isDeleted),
    productTypes: unwrap(productTypesRes),
    products: unwrap(productsRes).filter((p: any) => !p.isDeleted),
    vendorProductMappings: unwrap(mappingsRes).filter((m: any) => !m.isDeleted),
    catalogueProducts: unwrap(catalogueItemsRes),
    rateVersionHistory: unwrap(rateHistoryRes),
    importBatches: unwrap(importBatchesRes),
    requirements: unwrap(requirementsRes).filter((r: any) => !r.isDeleted),
    rfqs: unwrap(rfqsRes).filter((r: any) => !r.isDeleted),
    vendorQuotes: unwrap(quotesRes).filter((q: any) => !q.isDeleted),
    quotations: unwrap(quotationsRes),
    customerPos: unwrap(customerPosRes),
    vendorPos: unwrap(vendorPosRes),
    proformaInvoices: unwrap(piRes),
    payments: unwrap(paymentsRes),
    dispatches: unwrap(dispatchesRes),
    deliveries: unwrap(deliveriesRes),
    vendorBills: unwrap(billsRes),
    invoices: unwrap(salesBillsRes),
    expenses: unwrap(expensesRes),
    challans: unwrap(challansRes),
    approvals: unwrap(approvalsRes),
    notifications: unwrap(notificationsRes),
    auditLogs: unwrap(auditRes),
    documents: unwrap(docsRes),
    companySettings: settingsMap.companySettings || {},
    brandingSettings: settingsMap.brandingSettings || {},
    themeSettings: settingsMap.themeSettings || {},
    brandDiscounts: settingsMap.brandDiscounts || [],
    deletedVendorIds: tombstonesByType.get('vendor') || [],
    deletedRequirementIds: tombstonesByType.get('requirement') || [],
    deletedRfqIds: tombstonesByType.get('rfq') || [],
    deletedProductIds: tombstonesByType.get('product') || [],
    deletedVendorMappingIds: tombstonesByType.get('vendorMapping') || [],
    deletedVendorQuoteIds: tombstonesByType.get('vendorQuote') || [],
    deletedCompanyIds: tombstonesByType.get('company') || [],
    deletedCustomerIds: tombstonesByType.get('customer') || [],
    deletedBrandIds: tombstonesByType.get('brand') || [],
    deletedCategoryIds: tombstonesByType.get('category') || [],
    deletedPurchaseExecutiveIds: tombstonesByType.get('purchaseExecutive') || [],
  };
  })();

  inFlightSupabaseStateLoad = runLoad;
  try {
    const state = await runLoad;
    if (state) {
      cachedSupabaseState = { loadedAt: Date.now(), state };
    }
    return state;
  } finally {
    inFlightSupabaseStateLoad = null;
  }
}

