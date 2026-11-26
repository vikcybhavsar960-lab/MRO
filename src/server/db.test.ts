import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { db } from './db';
import { matchCatalogueRateDeterministic } from '../services/rateMatchingEngine';

const PROD_DB_PATH = path.join(process.cwd(), 'data', 'erp_production.json');
let prodDbSnapshotRaw: string | null = null;
let prodDbSnapshotMem: any = null;

before(() => {
  prodDbSnapshotRaw = fs.existsSync(PROD_DB_PATH) ? fs.readFileSync(PROD_DB_PATH, 'utf-8') : null;
  prodDbSnapshotMem = JSON.parse(JSON.stringify((db as any).data));
});

after(() => {
  if (prodDbSnapshotMem) {
    (db as any).data = prodDbSnapshotMem;
  }
  if (prodDbSnapshotRaw !== null) {
    fs.writeFileSync(PROD_DB_PATH, prodDbSnapshotRaw, 'utf-8');
  }
});

test('Super Admin vendor deletion registers tombstone and permanently removes record', () => {
  // Setup test vendor
  const testVendorId = `VND-TEST-${Date.now()}`;
  db.setCollection('vendors', [
    ...db.getCollection('vendors'),
    {
      id: testVendorId,
      companyName: 'Test Resurrect Supplier',
      contactPerson: 'Unit Tester',
      email: 'test@resurrect.com',
      mobile: '+91 99999 88888',
      city: 'Mumbai',
      state: 'Maharashtra',
      gstNumber: '27AAAAA0000A1Z5',
      panNumber: 'AAAAA0000A',
      brandsDealtWith: ['TestBrand'],
      categoriesDealtWith: ['TestCat'],
    },
  ]);

  // Verify vendor is present
  const beforeVendors = db.getCollection('vendors');
  assert.ok(beforeVendors.some((v: any) => v.id === testVendorId), 'Vendor should be created');

  // Hard delete vendor via db method
  const delRes = db.deleteVendor(testVendorId, true, 'Super Admin', 'SUPER_ADMIN', '127.0.0.1');
  assert.equal(delRes.success, true);

  // Authoritative state must NOT contain deleted vendor
  const authState = db.getAuthoritativeState();
  assert.equal(
    authState.vendors.some((v: any) => v.id === testVendorId),
    false,
    'Vendor must be removed from authoritative state'
  );

  // Tombstones must contain deleted vendor ID
  assert.ok(
    authState.deletedVendorIds.includes(testVendorId),
    'Deleted vendor ID must be registered in tombstones'
  );

  // Attempt to sync a stale payload containing the deleted vendor
  const synced = db.syncState({
    vendors: [{ id: testVendorId, companyName: 'Stale Resurrection Attempt' }],
  });

  // Stale vendor must NOT be revived
  assert.equal(
    synced.vendors.some((v: any) => v.id === testVendorId),
    false,
    'Deleted vendor must NEVER be revived by client sync payload'
  );
});

test('Super Admin requirement purge permanently deletes requirement and registers tombstone', () => {
  const testReqId = `REQ-TEST-${Date.now()}`;
  const testRfqNumber = `RFQ-TEST-${Date.now()}`;

  db.saveRequirement({
    id: testReqId,
    rfqNumber: testRfqNumber,
    customerName: 'Test Corp',
    companyName: 'Test Corp',
    materialDescription: 'Industrial Valve Test',
    quantity: 5,
    unit: 'NOS',
    requiredByDate: '2026-12-31',
    priority: 'HIGH',
    status: 'DRAFT',
  });

  // Verify requirement exists
  const stateBefore = db.getAuthoritativeState();
  assert.ok(stateBefore.requirements.some((r: any) => r.id === testReqId));

  // Purge requirement
  const purgeRes = db.purgeRequirement(testReqId, 'Super Admin', 'SUPER_ADMIN', '127.0.0.1');
  assert.equal(purgeRes.success, true);

  // Authoritative state must NOT contain purged requirement
  const stateAfter = db.getAuthoritativeState();
  assert.equal(
    stateAfter.requirements.some((r: any) => r.id === testReqId || r.rfqNumber === testRfqNumber),
    false,
    'Requirement must be purged from authoritative state'
  );

  // deletedRequirementIds must contain tombstones
  assert.ok(
    stateAfter.deletedRequirementIds.includes(testReqId) ||
    stateAfter.deletedRequirementIds.includes(testRfqNumber),
    'Tombstone must be recorded'
  );
});

test('deleteRfq deletes RFQ and prevents resurrection on syncState', () => {
  const testRfqId = `RFQ-TEST-${Date.now()}`;
  const testReqId = `REQ-TEST-${Date.now()}`;

  // Seed RFQ
  db.setCollection('rfqs', [
    ...db.getCollection('rfqs'),
    {
      id: testRfqId,
      rfqNumber: testRfqId,
      requirementId: testReqId,
      customerName: 'Test Automation Ltd',
      vendorIds: ['VND-001'],
      status: 'OPEN',
      items: [{ partCode: 'A9F74210', description: 'MCB 10A 2P', quantity: 10, unit: 'NOS' }],
      createdAt: new Date().toISOString(),
    },
  ]);

  // Verify RFQ is present
  const beforeRfqs = db.getAuthoritativeState().rfqs;
  assert.ok(beforeRfqs.some((r: any) => r.id === testRfqId || r.rfqNumber === testRfqId));

  // Delete RFQ
  const delRes = db.deleteRfq(testRfqId, 'Super Admin', 'SUPER_ADMIN', '127.0.0.1');
  assert.equal(delRes.success, true);

  // Authoritative state must NOT have deleted RFQ
  const afterRfqs = db.getAuthoritativeState().rfqs;
  assert.equal(
    afterRfqs.some((r: any) => r.id === testRfqId || r.rfqNumber === testRfqId),
    false,
    'RFQ must be removed from authoritative state'
  );

  // Attempt stale sync with the deleted RFQ
  const synced = db.syncState({
    rfqs: [{ id: testRfqId, rfqNumber: testRfqId, requirementId: testReqId }],
  });
  assert.equal(
    synced.rfqs.some((r: any) => r.id === testRfqId || r.rfqNumber === testRfqId),
    false,
    'Tombstone must prevent RFQ resurrection during sync'
  );
});

test('Purge all transactions empties all 10 transaction tables completely', () => {
  const res = db.purgeAllOldTransactions('Super Admin', 'SUPER_ADMIN', '127.0.0.1');
  assert.equal(res.success, true);

  const auth = db.getAuthoritativeState();
  assert.equal(auth.requirements.length, 0, 'Requirements must be 0');
  assert.equal(auth.rfqs.length, 0, 'RFQs must be 0');
  assert.equal(auth.vendorQuotes.length, 0, 'Vendor quotes must be 0');
  assert.equal(auth.quotations.length, 0, 'Quotations must be 0');
  assert.equal(auth.customerPos.length, 0, 'Customer POs must be 0');
  assert.equal(auth.vendorPos.length, 0, 'Vendor POs must be 0');
  assert.equal(auth.proformaInvoices.length, 0, 'Proforma Invoices must be 0');
  assert.equal(auth.payments.length, 0, 'Payments must be 0');
  assert.equal(auth.dispatches.length, 0, 'Dispatches must be 0');
  assert.equal(auth.deliveries.length, 0, 'Deliveries must be 0');
});

test('Explicitly created requirement untombstones ID and persists in getAuthoritativeState', () => {
  const testId = 'REQ-2026-99999';
  const testRfq = 'RFQ-2026-99999';

  // Simulate ID in deleted tombstones
  (db as any).data.deletedRequirementIds = [testId, testRfq];
  assert.ok((db as any).data.deletedRequirementIds.includes(testId));

  // User explicitly creates the requirement
  const newReq = {
    id: testId,
    rfqNumber: testRfq,
    customerId: 'CMP-001',
    customerName: 'HyFun Foods',
    status: 'NEW_REQUIREMENT',
    isDeleted: false,
    items: [],
  };
  db.saveRequirement(newReq, 'Procurement Specialist', 'Procurement Specialist', '127.0.0.1');

  // Must be untombstoned immediately
  assert.equal((db as any).data.deletedRequirementIds.includes(testId), false);
  assert.equal((db as any).data.deletedRequirementIds.includes(testRfq), false);

  // Must appear in authoritative state
  const state = db.getAuthoritativeState();
  const found = state.requirements.find((r: any) => r.id === testId);
  assert.ok(found, 'Explicitly created requirement must persist and not be suppressed');
});

test('saveRfq commits to database with full items and passes post-commit verification', () => {
  const rfqNumber = 'RFQ-2026-UNIT-01';

  const res = db.saveRfq(
    {
      rfqNumber,
      companyName: 'Adani Power Industrial',
      vendorIds: ['VEND-001'],
      items: [
        {
          itemName: 'Miniature Circuit Breaker 16A 2P',
          brand: 'Schneider Electric',
          partCode: 'A9F74216',
          quantity: 25,
          uom: 'NOS',
          targetPrice: 450,
        },
      ],
      notes: 'Urgent replacement stock',
    },
    'Procurement Lead',
    'Procurement Specialist',
    '127.0.0.1'
  );

  assert.equal(res.success, true);
  assert.equal(res.verified, true);
  assert.equal(res.rfqNumber, rfqNumber);
  assert.equal(res.itemsCount, 1);

  // Retrieve using getRfqById
  const retrieved = db.getRfqById(rfqNumber);
  assert.ok(retrieved, 'Retrieved RFQ must exist');
  assert.equal(retrieved.rfqNumber, rfqNumber);
  assert.equal(retrieved.items.length, 1);
  assert.equal(retrieved.items[0].partCode, 'A9F74216');
  assert.equal(retrieved.dbSaveStatus, 'COMMITTED');
});

test('saveBulkRfqs returns exact breakdown counts and row-level verification', () => {
  const rfq1 = 'RFQ-2026-BULK-01';
  const rfq2 = 'RFQ-2026-BULK-02';

  const bulkPayload = [
    {
      rfqNumber: rfq1,
      companyName: 'L&T Manufacturing Hub',
      items: [{ itemName: 'Pneumatic Valve 5/2 Way', quantity: 5, uom: 'NOS' }],
    },
    {
      rfqNumber: rfq2,
      companyName: 'JSW Steel Plant',
      items: [{ itemName: 'Power Contactor 32A', quantity: 10, uom: 'NOS' }],
    },
    {
      // Duplicate of rfq1
      rfqNumber: rfq1,
      companyName: 'L&T Manufacturing Hub Duplicate',
      items: [{ itemName: 'Pneumatic Valve', quantity: 5, uom: 'NOS' }],
    },
  ];

  const bulkRes = db.saveBulkRfqs(bulkPayload, 'Procurement Specialist', 'Procurement Specialist', '127.0.0.1');
  assert.equal(bulkRes.success, true);
  assert.equal(bulkRes.totalSubmitted, 3);
  assert.equal(bulkRes.successfullySaved, 2);
  assert.equal(bulkRes.duplicateCount, 1);
  assert.equal(bulkRes.failedCount, 0);

  // Both distinct RFQs must exist
  assert.ok(db.getRfqById(rfq1));
  assert.ok(db.getRfqById(rfq2));
});

test('Deterministic Rate Matching Engine: Level 1 Exact Match for SKF 6006-2RS1 Bearing 10 Nos', () => {
  const catalogueProducts = db.getCatalogueProducts();
  const query = 'SKF 6006-2RS1 Bearing 10 Nos';

  const res = matchCatalogueRateDeterministic(query, catalogueProducts);
  assert.equal(res.matched, true, 'Must find matched product');
  assert.equal(res.ruleLevel, 'LEVEL_1_EXACT_PART_CODE', 'Must match at Level 1');
  assert.equal(res.confidence, 100, 'Confidence must be 100%');
  assert.equal(res.detectedBrand, 'SKF', 'Brand must be SKF');
  assert.equal(res.extractedPartCode, '6006-2RS1', 'Part code must be 6006-2RS1');
  assert.equal(res.extractedQuantity, 10, 'Extracted quantity must be 10');
  assert.equal(res.extractedUom, 'NOS', 'Extracted UOM must be NOS');

  // Verify authentic SKF 2026 pricing
  assert.ok(res.matchedProduct, 'Product must be resolved');
  assert.equal(res.matchedProduct.mrp, 503, 'MRP must be ₹503');
  assert.equal(res.matchedProduct.packCode, '54', 'Pack Code must be 54');
  assert.equal(res.matchedProduct.caseQty, 22, 'Case Qty must be 22');

  // Verify commercial pricing calculation
  assert.ok(res.calculatedRate, 'Calculated rate must be returned');
  assert.equal(res.calculatedRate.mrp, 503);
  assert.equal(res.calculatedRate.discountPercent, 20);
  assert.equal(res.calculatedRate.purchaseRate, 402.40);
});

test('Ambiguous Part Code Detection: SKF 6006 bearing identifies multiple variants without guessing', () => {
  const catalogueProducts = db.getCatalogueProducts();
  const query = 'SKF 6006 bearing';

  const res = matchCatalogueRateDeterministic(query, catalogueProducts);
  assert.equal(res.isAmbiguous, true, 'Must be flagged as ambiguous');
  assert.ok(res.ambiguousCandidates && res.ambiguousCandidates.length >= 2, 'Must return ambiguous candidates');
  const partCodes = res.ambiguousCandidates.map((c) => c.partCode);
  assert.ok(partCodes.includes('6006') || partCodes.includes('6006-2RS1') || partCodes.includes('6006-2Z'));
});

test('Catalogue Import Versioning & Rollback: records year-over-year rate changes and rolls back cleanly', () => {
  const testBrand = `TestBrand-${Date.now()}`;
  const testPart = `PART-${Date.now()}`;

  // 1. Initial version
  const batch1Res = db.importCatalogueWithVersioning(
    {
      brandName: testBrand,
      catalogueVersion: '2025.1',
      effectiveDate: '2025-01-01',
      defaultDiscountPercent: 20,
      items: [
        {
          partCode: testPart,
          productName: 'Heavy Duty Contactor 25A',
          brand: testBrand,
          mrp: 1000,
          discountPercentage: 20,
          category: 'Switchgear',
          uom: 'NOS',
        },
      ],
    },
    'Super Admin',
    'SUPER_ADMIN'
  );
  assert.equal(batch1Res.success, true);
  assert.equal(batch1Res.insertedCount, 1);

  // 2. Next year version with price revision (+₹200)
  const batch2Res = db.importCatalogueWithVersioning(
    {
      brandName: testBrand,
      catalogueVersion: '2026.1',
      effectiveDate: '2026-08-01',
      defaultDiscountPercent: 20,
      items: [
        {
          partCode: testPart,
          productName: 'Heavy Duty Contactor 25A',
          brand: testBrand,
          mrp: 1200,
          discountPercentage: 20,
          category: 'Switchgear',
          uom: 'NOS',
        },
      ],
    },
    'Super Admin',
    'SUPER_ADMIN'
  );
  assert.equal(batch2Res.success, true);
  assert.equal(batch2Res.updatedCount, 1);
  assert.equal(batch2Res.rateHistoryRecorded, 1);

  // 3. Verify rate history trail
  const history = db.getRateHistory(testPart, testBrand);
  assert.ok(history.length >= 1, 'History must have recorded rate revision');
  const rev = history.find((h: any) => h.catalogueVersion === '2026.1');
  assert.ok(rev, '2026.1 revision must exist');
  assert.equal(rev.oldMrp, 1000);
  assert.equal(rev.newMrp, 1200);
  assert.equal(rev.differenceAmount, 200);
  assert.equal(rev.differencePercentage, 20);

  // 4. Test atomic rollback
  const rollbackRes = db.deleteImportBatch(batch2Res.batchId, true);
  assert.equal(rollbackRes.success, true);
});

test('createUser canonicalizes role strings and applies role template permissions when custom permissions are omitted', () => {
  const dbFile = path.join(process.cwd(), 'data', 'erp_production.json');
  const backupExists = fs.existsSync(dbFile);
  const backupRaw = backupExists ? fs.readFileSync(dbFile, 'utf-8') : null;
  const originalDataClone = JSON.parse(JSON.stringify((db as any).data));

  try {
    const uid = Date.now();
    const created = db.createUser({
      name: 'Rohan Kulkarni',
      email: `rohan.${uid}@procuremro.com`,
      username: `rohan_${uid}`,
      password: 'Password@123',
      role: 'Purchase User',
      department: 'Procurement',
    });

    assert.equal(created.role, 'PROCUREMENT_EMPLOYEE', 'Purchase User role alias must canonicalize');
    assert.equal(created.permissions.modules.requirements, true, 'Purchase User template grants requirements access');
    assert.equal(created.permissions.modules.rfqs, true, 'Purchase User template grants rfqs access');
    assert.equal(created.permissions.modules.approvals, false, 'Purchase User template restricts approvals');
    assert.equal(created.permissions.modules.userManagement, false, 'Purchase User template restricts userManagement');
    assert.equal(created.permissions.actions.canAdd, true);
    assert.equal(created.permissions.actions.canApprove, false);

    // Explicit super admin check with custom module override
    const adminCreated = db.createUser({
      name: 'Neha Sharma',
      email: `neha.${uid}@procuremro.com`,
      username: `neha_${uid}`,
      password: 'Password@123',
      role: 'Super Admin',
      department: 'Management',
      permissions: {
        modules: {
          ...((db as any).data.roles[0].defaultPermissions.modules),
          auditTrail: false,
        },
      },
    });
    assert.equal(adminCreated.role, 'SUPER_ADMIN');
    assert.equal(adminCreated.approvalAuthority.canApprovePayments, true);
    assert.equal(adminCreated.permissions.modules.auditTrail, false);
  } finally {
    (db as any).data = originalDataClone;
    if (backupExists && backupRaw !== null) {
      fs.writeFileSync(dbFile, backupRaw, 'utf-8');
    }
  }
});
