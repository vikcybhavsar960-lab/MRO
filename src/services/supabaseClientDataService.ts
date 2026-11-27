import { supabase, getSupabaseConfigStatus, SUPABASE_PROJECT_URL } from '../lib/supabase';
import {
  BrandMasterItem,
  Company,
  Customer,
  CustomerRequirement,
  MaterialCategory,
  ProductItem,
  PurchaseExecutive,
  User,
  Vendor,
  VendorEnquiry,
  VendorPO,
} from '../types';
import { normalizeUserRole } from '../utils/roleUtils';

export interface SupabaseProductionVerificationStep {
  step: string;
  ok: boolean;
  detail: string;
}

export interface SupabaseProductionVerificationReport {
  connected: boolean;
  url: string;
  hasPublishableKey: boolean;
  sessionAuthenticated: boolean;
  sessionEmail?: string;
  profileLoaded: boolean;
  profileRole?: string;
  counts: {
    vendors: number;
    requirements: number;
    products: number;
    brands: number;
  };
  writeTestPassed?: boolean;
  writeTestDetail?: string;
  rlsError?: string;
  steps: SupabaseProductionVerificationStep[];
  missingVars: string[];
  checkedAt: string;
}

export interface SupabaseClientHydratedState {
  vendors?: Vendor[];
  archivedVendors?: Vendor[];
  products?: ProductItem[];
  brands?: BrandMasterItem[];
  categories?: MaterialCategory[];
  customers?: Customer[];
  companies?: Company[];
  purchaseExecutives?: PurchaseExecutive[];
  requirements?: CustomerRequirement[];
  rfqs?: VendorEnquiry[];
  vendorPOs?: VendorPO[];
}

export function mapSupabaseRowToPayload<T extends Record<string, any>>(row: any, fallback: Partial<T>): T {
  const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    ...payload,
    ...fallback,
    id: row?.id || (payload as any)?.id || (fallback as any)?.id,
  } as T;
}

export function mapSupabaseUserProfileToErpUser(profile: any): User {
  return {
    id: profile.id,
    name: profile.name || profile.username || profile.email,
    username: profile.username || profile.email?.split('@')[0] || 'user',
    email: profile.email || '',
    role: normalizeUserRole(profile.role, profile.username, profile.email),
    department: profile.department || 'Procurement',
    mobile: profile.mobile || '',
    status: profile.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    mustChangePassword: Boolean(profile.must_change_password),
    permissions:
      profile.permissions && Object.keys(profile.permissions).length > 0
        ? profile.permissions
        : undefined,
    approvalLimit: Number(profile.approval_limit || 0),
  };
}

/**
 * Loads the currently authenticated Supabase Auth user's profile, role, and permissions
 * directly from `public.user_profiles` under RLS.
 */
export async function fetchAuthenticatedSupabaseUserProfile(): Promise<{
  authenticated: boolean;
  user: User | null;
  accessToken?: string;
  authEmail?: string;
  error?: string;
}> {
  if (!supabase || !getSupabaseConfigStatus().configured) {
    return {
      authenticated: false,
      user: null,
      error: 'Supabase client is not configured in this build (missing VITE_SUPABASE_PUBLISHABLE_KEY).',
    };
  }

  try {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !sessionData?.session?.access_token) {
      return { authenticated: false, user: null, error: sessionErr?.message };
    }

    const session = sessionData.session;
    const authUser = session.user;
    const authEmail = (authUser?.email || '').trim().toLowerCase();

    // Query public.user_profiles using RLS (matches auth_user_id or email)
    const { data: profiles, error: profErr } = await supabase
      .from('user_profiles')
      .select('*')
      .or(`auth_user_id.eq.${authUser.id},email.ilike.${authEmail}`)
      .limit(1);

    if (profErr) {
      return {
        authenticated: false,
        user: null,
        authEmail,
        error: `Supabase RLS/profile error: ${profErr.message}`,
      };
    }

    const matchedProfile = Array.isArray(profiles) && profiles.length > 0 ? profiles[0] : null;
    if (matchedProfile) {
      return {
        authenticated: true,
        user: mapSupabaseUserProfileToErpUser(matchedProfile),
        accessToken: session.access_token,
        authEmail,
      };
    }

    // Check known admin alias spelling (vickybhavsar960@gmail.com <-> vikcybhavsar960@gmail.com)
    if (authEmail === 'vikcybhavsar960@gmail.com' || authEmail === 'vickybhavsar960@gmail.com') {
      const altEmail =
        authEmail === 'vikcybhavsar960@gmail.com'
          ? 'vickybhavsar960@gmail.com'
          : 'vikcybhavsar960@gmail.com';
      const { data: altProfiles } = await supabase
        .from('user_profiles')
        .select('*')
        .ilike('email', altEmail)
        .limit(1);
      if (Array.isArray(altProfiles) && altProfiles.length > 0) {
        return {
          authenticated: true,
          user: mapSupabaseUserProfileToErpUser(altProfiles[0]),
          accessToken: session.access_token,
          authEmail,
        };
      }
    }

    // Authenticated in Supabase Auth, synthesize minimal ERP profile from user metadata
    const meta = authUser.user_metadata || {};
    const fallbackRole = normalizeUserRole(meta.role, meta.username, authEmail);
    return {
      authenticated: true,
      user: {
        id: meta.erp_user_id || authUser.id,
        name: meta.name || authEmail.split('@')[0] || 'ERP User',
        username: meta.username || authEmail.split('@')[0] || 'user',
        email: authEmail,
        role: fallbackRole,
        department: meta.department || 'Procurement',
        mobile: meta.mobile || '',
        status: 'ACTIVE',
        mustChangePassword: false,
      },
      accessToken: session.access_token,
      authEmail,
    };
  } catch (err: any) {
    return {
      authenticated: false,
      user: null,
      error: err?.message || 'Unable to verify Supabase Auth session.',
    };
  }
}

/**
 * Runs a real, end-to-end production test directly from the browser against
 * https://plvjsiehhpdoyvzgahpr.supabase.co:
 * 1. Verifies build config (URL + publishable key)
 * 2. Verifies active Supabase Auth JWT session
 * 3. Reads user_profiles, vendors, requirements, products, brands under RLS
 * 4. Optionally executes a real INSERT -> SELECT -> DELETE round-trip write test
 *    to prove RLS allows both reads and writes for the authenticated user.
 */
export async function runLiveSupabaseProductionTest(options?: {
  includeWriteRoundTrip?: boolean;
}): Promise<SupabaseProductionVerificationReport> {
  const cfg = getSupabaseConfigStatus();
  const steps: SupabaseProductionVerificationStep[] = [];
  const checkedAt = new Date().toISOString();

  steps.push({
    step: 'Supabase Build Configuration',
    ok: cfg.configured,
    detail: cfg.configured
      ? `Configured for ${cfg.url} with public publishable key.`
      : `Missing build-time environment variable(s): ${cfg.missingVars.join(', ')}. Set them under Cloudflare Workers → Settings → Build → Variables and secrets, then redeploy.`,
  });

  if (!supabase || !cfg.configured) {
    return {
      connected: false,
      url: cfg.url || SUPABASE_PROJECT_URL,
      hasPublishableKey: cfg.hasPublishableKey,
      sessionAuthenticated: false,
      profileLoaded: false,
      counts: { vendors: 0, requirements: 0, products: 0, brands: 0 },
      steps,
      missingVars: cfg.missingVars,
      checkedAt,
    };
  }

  const profileRes = await fetchAuthenticatedSupabaseUserProfile();
  steps.push({
    step: 'Supabase Auth Session',
    ok: profileRes.authenticated,
    detail: profileRes.authenticated
      ? `Authenticated as ${profileRes.authEmail || profileRes.user?.email} (${profileRes.user?.role}).`
      : profileRes.error || 'No active Supabase Auth session. Sign in with your Supabase Auth email & password.',
  });

  if (!profileRes.authenticated) {
    return {
      connected: false,
      url: cfg.url,
      hasPublishableKey: true,
      sessionAuthenticated: false,
      profileLoaded: false,
      counts: { vendors: 0, requirements: 0, products: 0, brands: 0 },
      rlsError: profileRes.error,
      steps,
      missingVars: [],
      checkedAt,
    };
  }

  // Real authenticated SELECT queries across core ERP tables
  const [vendorsQ, reqsQ, productsQ, brandsQ] = await Promise.all([
    supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
    supabase.from('requirements').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
    supabase.from('brands').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
  ]);

  const firstErr = vendorsQ.error || reqsQ.error || productsQ.error || brandsQ.error;
  const counts = {
    vendors: vendorsQ.count ?? 0,
    requirements: reqsQ.count ?? 0,
    products: productsQ.count ?? 0,
    brands: brandsQ.count ?? 0,
  };

  steps.push({
    step: 'Authenticated Database Reads (RLS)',
    ok: !firstErr,
    detail: firstErr
      ? `Blocked by Supabase/RLS: ${firstErr.message}`
      : `Read verified — Vendors: ${counts.vendors}, Products: ${counts.products}, Requirements: ${counts.requirements}, Brands: ${counts.brands}.`,
  });

  let writeTestPassed: boolean | undefined;
  let writeTestDetail: string | undefined;

  if (!firstErr && options?.includeWriteRoundTrip) {
    const probeId = `DIAG-PROBE-${Date.now()}`;
    const insertRes = await supabase
      .from('notifications')
      .insert({
        id: probeId,
        title: 'Production Connection Verification',
        message: `Verified live read/write from ${typeof window !== 'undefined' ? window.location.hostname : 'client'}`,
        notification_type: 'INFO',
        is_read: true,
        target_role: ['SUPER_ADMIN'],
      })
      .select('id')
      .single();

    if (insertRes.error) {
      writeTestPassed = false;
      writeTestDetail = `INSERT blocked by RLS: ${insertRes.error.message}`;
    } else {
      const readBack = await supabase
        .from('notifications')
        .select('id')
        .eq('id', probeId)
        .single();
      // Clean up diagnostic row immediately
      await supabase.from('notifications').delete().eq('id', probeId);
      writeTestPassed = !readBack.error && readBack.data?.id === probeId;
      writeTestDetail = writeTestPassed
        ? 'Verified real INSERT -> SELECT read-back -> DELETE cleanup under RLS.'
        : `Read-back verification failed: ${readBack.error?.message || 'Row not returned'}`;
    }

    steps.push({
      step: 'Live Write & Read-Back Test (RLS)',
      ok: Boolean(writeTestPassed),
      detail: writeTestDetail || '',
    });
  }

  return {
    connected: !firstErr && (options?.includeWriteRoundTrip ? Boolean(writeTestPassed) : true),
    url: cfg.url,
    hasPublishableKey: true,
    sessionAuthenticated: true,
    sessionEmail: profileRes.authEmail || profileRes.user?.email,
    profileLoaded: Boolean(profileRes.user),
    profileRole: profileRes.user?.role,
    counts,
    writeTestPassed,
    writeTestDetail,
    rlsError: firstErr?.message,
    steps,
    missingVars: [],
    checkedAt,
  };
}

/**
 * Hydrates live ERP state directly from Supabase PostgreSQL using the authenticated browser JWT.
 * Used when hosted on Cloudflare Workers (*.workers.dev) where there is no Express API server.
 */
export async function fetchLiveStateFromSupabaseClient(): Promise<{
  ok: boolean;
  state?: SupabaseClientHydratedState;
  error?: string;
}> {
  if (!supabase || !getSupabaseConfigStatus().configured) {
    return { ok: false, error: 'Supabase client not configured.' };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session?.access_token) {
    return { ok: false, error: 'No active Supabase Auth session.' };
  }

  try {
    const [
      vendorsRes,
      productsRes,
      brandsRes,
      categoriesRes,
      customersRes,
      companiesRes,
      execsRes,
      reqsRes,
      reqItemsRes,
      rfqsRes,
      vendorPosRes,
    ] = await Promise.all([
      supabase.from('vendors').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('is_deleted', false).limit(5000),
      supabase.from('brands').select('*').eq('is_deleted', false),
      supabase.from('categories').select('*').eq('is_deleted', false),
      supabase.from('customers').select('*').eq('is_deleted', false),
      supabase.from('companies').select('*').eq('is_deleted', false),
      supabase.from('purchase_executives').select('*').eq('is_deleted', false),
      supabase.from('requirements').select('*').eq('is_deleted', false).order('created_at', { ascending: false }),
      supabase.from('requirement_items').select('*'),
      supabase.from('rfqs').select('*').eq('is_deleted', false).order('created_at', { ascending: false }),
      supabase.from('vendor_pos').select('*').order('created_at', { ascending: false }),
    ]);

    if (vendorsRes.error) {
      return { ok: false, error: `Supabase read failed: ${vendorsRes.error.message}` };
    }

    const allVendors: Vendor[] = (vendorsRes.data || []).map((row: any) =>
      mapSupabaseRowToPayload<Vendor>(row, {
        id: row.id,
        vendorCode: row.vendor_code || row.payload?.vendorCode || row.id,
        companyName: row.company_name || row.payload?.companyName || '',
        contactPerson: row.contact_person || row.payload?.contactPerson || '',
        mobile: row.mobile || row.payload?.mobile || '',
        email: row.email || row.payload?.email || '',
        address: row.address || row.payload?.address || '',
        city: row.city || row.payload?.city || '',
        state: row.state || row.payload?.state || '',
        gstin: row.gstin || row.payload?.gstin || '',
        paymentTerms: row.payment_terms || row.payload?.paymentTerms || '30 Days Net',
        rating: Number(row.rating ?? row.payload?.rating ?? 4),
        status: row.status || 'ACTIVE',
        brandsSupplied: Array.isArray(row.brands_supplied) ? row.brands_supplied : row.payload?.brandsSupplied || [],
        materialCategories: Array.isArray(row.material_categories)
          ? row.material_categories
          : row.payload?.materialCategories || [],
        isDeleted: Boolean(row.is_deleted),
      })
    );

    const activeVendors = allVendors.filter((v) => !v.isDeleted);
    const archivedVendors = allVendors.filter((v) => v.isDeleted);

    const products: ProductItem[] = (productsRes.data || []).map((row: any) =>
      mapSupabaseRowToPayload<ProductItem>(row, {
        id: row.id,
        itemCode: row.item_code || row.payload?.itemCode || row.id,
        itemName: row.item_name || row.payload?.itemName || '',
        category: row.category || row.payload?.category || '',
        subCategory: row.sub_category || row.payload?.subCategory || '',
        brand: row.brand || row.payload?.brand || '',
        manufacturer: row.manufacturer || row.payload?.manufacturer || '',
        manufacturerCode: row.manufacturer_code || row.payload?.manufacturerCode || '',
        partNumber: row.part_number || row.payload?.partNumber || '',
        modelNumber: row.model_number || row.payload?.modelNumber || '',
        specification: row.specification || row.payload?.specification || '',
        uom: row.uom || row.payload?.uom || 'NOS',
        hsnCode: row.hsn_code || row.payload?.hsnCode || '',
        gstRate: Number(row.gst_rate ?? row.payload?.gstRate ?? 18),
        mrp: Number(row.mrp ?? row.payload?.mrp ?? 0),
        discountPercentage: Number(row.discount_percentage ?? row.payload?.discountPercentage ?? 0),
        netPurchaseRate: Number(row.net_purchase_rate ?? row.payload?.netPurchaseRate ?? 0),
        approxRate: Number(row.net_purchase_rate ?? row.payload?.approxRate ?? 0),
        stockQty: Number(row.stock_qty ?? row.payload?.stockQty ?? 0),
        status: row.status || 'ACTIVE',
        isDeleted: Boolean(row.is_deleted),
      })
    );

    const brands: BrandMasterItem[] = (brandsRes.data || []).map((row: any) =>
      mapSupabaseRowToPayload<BrandMasterItem>(row, {
        id: row.id,
        name: row.name || row.payload?.name || '',
        code: row.code || row.payload?.code || '',
        manufacturer: row.manufacturer || row.payload?.manufacturer || '',
        category: row.category || row.payload?.category || '',
        website: row.website || row.payload?.website || '',
        isActive: row.is_active !== false,
      })
    );

    const categories: MaterialCategory[] = (categoriesRes.data || []).map((row: any) =>
      mapSupabaseRowToPayload<MaterialCategory>(row, {
        id: row.id,
        name: row.name || row.payload?.name || '',
        code: row.code || row.payload?.code || '',
        description: row.description || row.payload?.description || '',
        subCategories: Array.isArray(row.sub_categories) ? row.sub_categories : row.payload?.subCategories || [],
        keywords: Array.isArray(row.keywords) ? row.keywords : row.payload?.keywords || [],
      })
    );

    const customers: Customer[] = (customersRes.data || []).map((row: any) =>
      mapSupabaseRowToPayload<Customer>(row, {
        id: row.id,
        companyName: row.company_name || row.payload?.companyName || '',
        contactPerson: row.contact_person || row.payload?.contactPerson || '',
        mobile: row.mobile || row.payload?.mobile || '',
        email: row.email || row.payload?.email || '',
        city: row.city || row.payload?.city || '',
        state: row.state || row.payload?.state || '',
        gstin: row.gstin || row.payload?.gstin || '',
      })
    );

    const companies: Company[] = (companiesRes.data || []).map((row: any) =>
      mapSupabaseRowToPayload<Company>(row, {
        id: row.id,
        companyCode: row.company_code || row.payload?.companyCode || row.id,
        companyName: row.company_name || row.payload?.companyName || '',
        gstin: row.gstin || row.payload?.gstin || '',
        city: row.city || row.payload?.city || '',
        state: row.state || row.payload?.state || '',
        status: row.status || 'ACTIVE',
      })
    );

    const purchaseExecutives: PurchaseExecutive[] = (execsRes.data || []).map((row: any) =>
      mapSupabaseRowToPayload<PurchaseExecutive>(row, {
        id: row.id,
        companyId: row.company_id || row.payload?.companyId || '',
        companyName: row.company_name || row.payload?.companyName || '',
        name: row.name || row.payload?.name || '',
        designation: row.designation || row.payload?.designation || '',
        mobile: row.mobile || row.payload?.mobile || '',
        email: row.email || row.payload?.email || '',
        department: row.department || row.payload?.department || '',
        status: row.status || 'ACTIVE',
      })
    );

    const itemsByReqId = new Map<string, any[]>();
    for (const itemRow of reqItemsRes.data || []) {
      const rid = itemRow.requirement_id;
      if (!itemsByReqId.has(rid)) itemsByReqId.set(rid, []);
      itemsByReqId.get(rid)!.push(
        mapSupabaseRowToPayload(itemRow, {
          id: itemRow.id,
          itemCode: itemRow.item_code || '',
          itemName: itemRow.item_name || '',
          brand: itemRow.brand || '',
          partNumber: itemRow.part_number || '',
          modelNumber: itemRow.model_number || '',
          category: itemRow.category || '',
          subCategory: itemRow.sub_category || '',
          specification: itemRow.specification || '',
          quantity: Number(itemRow.quantity || 1),
          uom: itemRow.uom || 'NOS',
          targetPrice: Number(itemRow.target_price || 0),
          selectedVendorId: itemRow.selected_vendor_id || undefined,
          selectedVendorName: itemRow.selected_vendor_name || undefined,
        })
      );
    }

    const requirements: CustomerRequirement[] = (reqsRes.data || []).map((row: any) =>
      mapSupabaseRowToPayload<CustomerRequirement>(row, {
        id: row.id,
        rfqNumber: row.rfq_number || row.payload?.rfqNumber || '',
        customerId: row.customer_id || row.payload?.customerId || '',
        customerName: row.customer_name || row.payload?.customerName || '',
        companyId: row.company_id || row.payload?.companyId || '',
        companyName: row.company_name || row.payload?.companyName || '',
        requirementDate: row.requirement_date || row.payload?.requirementDate || '',
        requiredDeliveryDate: row.required_delivery_date || row.payload?.requiredDeliveryDate || '',
        priority: row.priority || 'Medium',
        status: row.status || 'NEW_REQUIREMENT',
        items:
          itemsByReqId.get(row.id) && itemsByReqId.get(row.id)!.length > 0
            ? itemsByReqId.get(row.id)!
            : row.payload?.items || [],
        isDeleted: Boolean(row.is_deleted),
      })
    );

    const rfqs: VendorEnquiry[] = (rfqsRes.data || []).map((row: any) =>
      mapSupabaseRowToPayload<VendorEnquiry>(row, {
        id: row.id,
        requirementId: row.requirement_id || row.payload?.requirementId || '',
        status: row.status || 'SENT',
      })
    );

    const vendorPOs: VendorPO[] = (vendorPosRes.data || []).map((row: any) =>
      mapSupabaseRowToPayload<VendorPO>(row, {
        id: row.id,
        vendorId: row.vendor_id || row.payload?.vendorId || '',
        vendorName: row.vendor_name || row.payload?.vendorName || '',
        poDate: row.po_date || row.payload?.poDate || '',
        totalAmount: Number(row.total_amount ?? row.payload?.totalAmount ?? 0),
      })
    );

    return {
      ok: true,
      state: {
        vendors: activeVendors,
        archivedVendors,
        products,
        brands,
        categories,
        customers,
        companies,
        purchaseExecutives,
        requirements,
        rfqs,
        vendorPOs,
      },
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to read live Supabase data.' };
  }
}

/**
 * Persists a CustomerRequirement + its RequirementItems directly to Supabase PostgreSQL
 * from the browser client when operating on Cloudflare Workers (*.workers.dev).
 */
export async function upsertRequirementToSupabaseClient(
  req: CustomerRequirement
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase || !getSupabaseConfigStatus().configured) {
    return { ok: false, error: 'Supabase client not configured.' };
  }
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session?.access_token) {
    return { ok: false, error: 'Supabase Auth session required to save requirement.' };
  }

  const reqRow = {
    id: req.id,
    rfq_number: req.rfqNumber || '',
    customer_id: req.customerId || null,
    customer_name: req.customerName || '',
    company_id: req.companyId || null,
    company_name: req.companyName || req.customerName || '',
    purchase_executive_id: req.purchaseExecutiveId || '',
    purchase_executive_name: req.purchaseExecutiveName || req.contactPerson || '',
    requirement_date: req.requirementDate || '',
    required_delivery_date: req.requiredDeliveryDate || '',
    priority: req.priority || 'Medium',
    status: req.status || 'NEW_REQUIREMENT',
    created_by: req.createdBy || '',
    payload: req,
    is_deleted: Boolean(req.isDeleted),
    updated_at: new Date().toISOString(),
  };

  const { error: reqErr } = await supabase.from('requirements').upsert(reqRow, { onConflict: 'id' });
  if (reqErr) {
    return { ok: false, error: reqErr.message };
  }

  if (Array.isArray(req.items) && req.items.length > 0) {
    const itemRows = req.items.map((it, idx) => ({
      id: it.id || `${req.id}-ITEM-${idx + 1}`,
      requirement_id: req.id,
      item_code: it.itemCode || '',
      item_name: it.itemName || 'Material Item',
      brand: it.brand || '',
      part_number: it.partNumber || '',
      model_number: it.modelNumber || '',
      category: it.category || '',
      sub_category: it.subCategory || '',
      specification: it.specification || '',
      quantity: Number(it.quantity || 1),
      uom: it.uom || 'NOS',
      target_price: Number(it.targetPrice || 0),
      selected_vendor_id: it.selectedVendorId || '',
      selected_vendor_name: it.selectedVendorName || '',
      payload: it,
    }));
    const { error: itemErr } = await supabase
      .from('requirement_items')
      .upsert(itemRows, { onConflict: 'id' });
    if (itemErr) {
      return { ok: false, error: itemErr.message };
    }
  }

  return { ok: true };
}

/**
 * Persists a Vendor directly to Supabase PostgreSQL under RLS in static SPA mode.
 */
export async function upsertVendorToSupabaseClient(
  vendor: Vendor
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase || !getSupabaseConfigStatus().configured) {
    return { ok: false, error: 'Supabase client not configured.' };
  }
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session?.access_token) {
    return { ok: false, error: 'Supabase Auth session required.' };
  }

  const { error } = await supabase.from('vendors').upsert(
    {
      id: vendor.id,
      vendor_code: vendor.vendorCode || vendor.id,
      company_name: vendor.companyName,
      contact_person: vendor.contactPerson || '',
      mobile: vendor.mobile || '',
      email: vendor.email || '',
      address: vendor.address || '',
      city: vendor.city || '',
      state: vendor.state || '',
      gstin: vendor.gstin || '',
      payment_terms: vendor.paymentTerms || '30 Days Net',
      rating: Number(vendor.rating || 4),
      status: vendor.status || 'ACTIVE',
      brands_supplied: vendor.brandsSupplied || [],
      material_categories: vendor.materialCategories || [],
      payload: vendor,
      is_deleted: Boolean(vendor.isDeleted),
      deleted_at: vendor.deletedAt || null,
      deleted_by: vendor.deletedBy || null,
      deleted_reason: vendor.deletedReason || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  return error ? { ok: false, error: error.message } : { ok: true };
}
