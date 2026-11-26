import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  ERP_STORAGE_BUCKETS,
  SUPABASE_URL,
  ensureSupabaseBuckets,
  getSupabaseServerDiagnostics,
  isSupabaseServerConfigured,
} from './supabaseAdmin.js';
import { buildSupabaseMigrationBatches, migrateProductionJsonToSupabase, safeIso } from './supabaseMigrator.js';
import { normalizePartCode } from '../services/rateMatchingEngine.js';

test('Supabase project URL & diagnostics report accurate configuration state without fabricating connectivity', () => {
  assert.equal(SUPABASE_URL, 'https://plvjsiehhpdoyvzgahpr.supabase.co');
  const diag = getSupabaseServerDiagnostics();
  assert.equal(diag.url, 'https://plvjsiehhpdoyvzgahpr.supabase.co');
  assert.equal(diag.serverConfigured, isSupabaseServerConfigured());
  if (!diag.serverConfigured) {
    assert.ok(diag.missingServerVars.includes('SUPABASE_SERVICE_ROLE_KEY'));
  }
});

test('All 9 production Supabase Storage buckets are registered', () => {
  const expected = [
    'vendor-catalogues',
    'vendor-documents',
    'product-images',
    'product-datasheets',
    'rfq-documents',
    'quotation-documents',
    'purchase-orders',
    'invoices',
    'other-erp-documents',
  ];
  for (const bucket of expected) {
    assert.ok(
      (ERP_STORAGE_BUCKETS as readonly string[]).includes(bucket),
      `Missing bucket ${bucket}`
    );
  }
  assert.equal(ERP_STORAGE_BUCKETS.length, 9);
});

test('Supabase bucket check and migrator refuse silent fallback when SUPABASE_SERVICE_ROLE_KEY is absent', async () => {
  if (isSupabaseServerConfigured()) {
    return; // Skip unconfigured assertion if environment actually supplies live keys
  }
  const bucketRes = await ensureSupabaseBuckets();
  assert.equal(bucketRes.checked, 0);
  assert.ok(bucketRes.error && /SUPABASE_SERVICE_ROLE_KEY/i.test(bucketRes.error));

  await assert.rejects(
    () => migrateProductionJsonToSupabase(),
    /SUPABASE_SERVICE_ROLE_KEY is missing/i
  );
});

test('Exact part-code preservation keeps 6006 variants distinct during catalogue matching & versioning', () => {
  const variants = ['6006', '6006/C3', '6006-2RS1', '6006-2Z'];
  const normalized = variants.map((v) => normalizePartCode(v));
  const uniqueNormalized = new Set(normalized);
  assert.equal(uniqueNormalized.size, variants.length, 'Bearing variants must never collapse into 6006');
});

test('Production Supabase SQL migration defines core ERP tables, immutable audit_logs, and 250 MB storage buckets', () => {
  const sqlPath = path.resolve(process.cwd(), 'supabase/migrations/001_erp_production_schema.sql');
  assert.ok(fs.existsSync(sqlPath), '001_erp_production_schema.sql must exist');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  const requiredTables = [
    'roles',
    'user_profiles',
    'companies',
    'vendors',
    'products',
    'brands',
    'categories',
    'vendor_product_mapping',
    'requirements',
    'rfqs',
    'quotes',
    'customer_quotations',
    'customer_pos',
    'vendor_pos',
    'proforma_invoices',
    'payments',
    'dispatches',
    'deliveries',
    'documents',
    'audit_logs',
    'rate_history',
  ];

  for (const tbl of requiredTables) {
    assert.ok(
      new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+public\\.${tbl}\\b`, 'i').test(sql),
      `SQL schema must define public.${tbl}`
    );
  }

  for (const bucket of ERP_STORAGE_BUCKETS) {
    assert.ok(sql.includes(`'${bucket}'`), `SQL schema must seed storage bucket ${bucket}`);
  }

  // 250 MB in bytes = 262144000
  assert.ok(sql.includes('262144000'), 'SQL storage bucket config must allow 250 MB (262144000 bytes)');
});

test('safeIso normalizes valid dates and falls back cleanly on invalid strings', () => {
  const fallback = '2026-01-01T00:00:00.000Z';
  assert.equal(safeIso('', fallback), fallback);
  assert.equal(safeIso('not-a-date', fallback), fallback);
  assert.equal(safeIso('2026-05-10 14:30:00', fallback).startsWith('2026-05-10T'), true);
  assert.equal(safeIso('2026-08-15T09:00:00.000Z', fallback), '2026-08-15T09:00:00.000Z');
});

test('buildSupabaseMigrationBatches maps transactional tables, FK guards, and all 11 tombstone types', () => {
  const nowIso = '2026-11-18T00:00:00.000Z';
  const batches = buildSupabaseMigrationBatches(
    {
      customers: [{ id: 'CUST-1', companyName: 'Acme Industries', createdAt: 'invalid-date' }],
      vendors: [{ id: 'VND-1', companyName: 'Salvi Corp', gstin: '27aaaaa0000a1z5', pan: 'aaaaa0000a' }],
      requirements: [{ id: 'REQ-1', rfqNumber: 'RFQ-101', customerId: 'CUST-1', customerName: 'Acme Industries' }],
      rfqs: [{ id: 'RFQ-1', rfqNumber: 'RFQ-101', requirementId: 'REQ-1' }],
      quotations: [{ id: 'QT-1', requirementId: 'REQ-1', customerId: 'CUST-1', grandTotal: 15000 }],
      customerPos: [{ id: 'CPO-1', quotationId: 'QT-1', requirementId: 'REQ-1', customerId: 'CUST-1', poAmount: 15000 }],
      vendorPos: [{ id: 'VPO-1', customerPoId: 'CPO-1', vendorId: 'VND-1', requirementId: 'REQ-1', totalAmount: 12000 }],
      invoices: [{ id: 'INV-1', invoiceNumber: 'INV/26/001', customerId: 'MISSING-CUST', grandTotal: 15000 }],
      vendorBills: [{ id: 'VB-1', billNumber: 'BILL-001', vendorId: 'VND-1', grandTotal: 12000 }],
      expenses: [{ id: 'EXP-1', expenseNumber: 'EXP-01', category: 'FREIGHT', amount: 850 }],
      deletedVendorIds: ['V-DEL-1'],
      deletedRequirementIds: ['R-DEL-1'],
      deletedRfqIds: ['Q-DEL-1'],
      deletedProductIds: ['P-DEL-1'],
      deletedVendorMappingIds: ['VM-DEL-1'],
      deletedVendorQuoteIds: ['VQ-DEL-1'],
      deletedCompanyIds: ['CMP-DEL-1'],
      deletedCustomerIds: ['CUST-DEL-1'],
      deletedBrandIds: ['BRD-DEL-1'],
      deletedCategoryIds: ['CAT-DEL-1'],
      deletedPurchaseExecutiveIds: ['PE-DEL-1'],
    },
    nowIso
  );

  assert.equal(batches.customers[0].created_at, nowIso);
  assert.equal(batches.vendors[0].gstin, '27AAAAA0000A1Z5');
  assert.equal(batches.rfqs[0].requirement_id, 'REQ-1');
  assert.equal(batches.customer_quotations[0].grand_total, 15000);
  assert.equal(batches.customer_pos[0].quotation_id, 'QT-1');
  assert.equal(batches.vendor_pos[0].vendor_id, 'VND-1');
  // Non-existent FK customerId is nulled cleanly instead of throwing FK violation
  assert.equal(batches.sales_bills[0].customer_id, null);
  assert.equal(batches.purchase_bills[0].vendor_id, 'VND-1');
  assert.equal(batches.expenses[0].amount, 850);

  const tombTypes = new Set(batches.deleted_tombstones.map((t: any) => t.entity_type));
  assert.equal(batches.deleted_tombstones.length, 11);
  for (const expectedType of [
    'vendor',
    'requirement',
    'rfq',
    'product',
    'vendorMapping',
    'vendorQuote',
    'company',
    'customer',
    'brand',
    'category',
    'purchaseExecutive',
  ]) {
    assert.ok(tombTypes.has(expectedType), `Missing tombstone type ${expectedType}`);
  }
});

test('Supabase cache helpers and unconfigured state load resolve cleanly without errors', async () => {
  const adminMod = await import('./supabaseAdmin.js');
  adminMod.clearVerifiedJwtCache();
  adminMod.invalidateSupabaseStateCache();
  if (!adminMod.isSupabaseServerConfigured()) {
    const res = await adminMod.loadAuthoritativeStateFromSupabase({ maxAgeMs: 5000 });
    assert.equal(res, null);
  }
});

test('deduplicateRowsByConflict collapses duplicate single and composite keys keeping latest row', async () => {
  const { deduplicateRowsByConflict } = await import('./supabaseMigrator.js');
  const single = deduplicateRowsByConflict(
    [
      { id: 'PRD-1', name: 'Old' },
      { id: 'PRD-2', name: 'Keep' },
      { id: 'PRD-1', name: 'Latest' },
      { id: '', name: 'Blank' },
    ],
    'id'
  );
  assert.deepEqual(single, [
    { id: 'PRD-1', name: 'Latest' },
    { id: 'PRD-2', name: 'Keep' },
  ]);

  const composite = deduplicateRowsByConflict(
    [
      { vendor_id: 'VEND-1', brand_name: 'SKF', source: 'OLD' },
      { vendor_id: 'VEND-1', brand_name: 'SKF', source: 'NEW' },
    ],
    'vendor_id,brand_name'
  );
  assert.deepEqual(composite, [{ vendor_id: 'VEND-1', brand_name: 'SKF', source: 'NEW' }]);
});



