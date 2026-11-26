import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { db } from './db';

const DB_FILE = path.join(process.cwd(), 'data', 'erp_production.json');

test('Deleted masters (customers, companies, brands, categories, products, vendors) never resurrect during db.syncState', () => {
  const backupExists = fs.existsSync(DB_FILE);
  const backupRaw = backupExists ? fs.readFileSync(DB_FILE, 'utf-8') : null;
  const originalDataClone = JSON.parse(JSON.stringify((db as any).data));

  try {
    const uid = Date.now();
    const custId = `CUST-TEST-${uid}`;
    const compId = `CMP-TEST-${uid}`;
    const brandId = `BRD-TEST-${uid}`;
    const catId = `CAT-TEST-${uid}`;
    const prodId = `PRD-TEST-${uid}`;
    const vendId = `VEND-TEST-${uid}`;

    // 1. Seed & delete Customer
    db.saveCustomer({ id: custId, companyName: 'Temp Cust Corp', status: 'ACTIVE' }, 'Tester', 'SUPER_ADMIN', '127.0.0.1');
    assert.ok(db.getAuthoritativeState().customers.some((c: any) => c.id === custId));
    db.deleteCustomer(custId, 'Tester', 'SUPER_ADMIN', '127.0.0.1');

    // 2. Seed & delete Brand
    db.saveBrand({ id: brandId, name: `TempBrand_${uid}`, code: 'TB', isActive: true }, 'Tester', 'SUPER_ADMIN', '127.0.0.1');
    assert.ok(db.getAuthoritativeState().brands.some((b: any) => b.id === brandId));
    db.deleteBrand(brandId, 'Tester', 'SUPER_ADMIN', '127.0.0.1');

    // 3. Seed & delete Category
    db.saveCategory({ id: catId, name: `TempCat_${uid}`, code: 'TC', isActive: true }, 'Tester', 'SUPER_ADMIN', '127.0.0.1');
    assert.ok(db.getAuthoritativeState().categories.some((c: any) => c.id === catId));
    db.deleteCategory(catId, 'Tester', 'SUPER_ADMIN', '127.0.0.1');

    // 4. Company & Product tombstones
    db.setCollection('companies', [...db.getCollection('companies'), { id: compId, companyName: 'Temp Comp', status: 'ACTIVE' }]);
    db.recordTombstone('deletedCompanyIds', compId, false);
    db.setCollection('companies', db.getCollection('companies').filter((c: any) => c.id !== compId));

    db.setCollection('products', [...db.getCollection('products'), { id: prodId, itemName: 'Temp Prod', isDeleted: false }]);
    db.recordTombstone('deletedProductIds', prodId, false);
    db.setCollection('products', db.getCollection('products').filter((p: any) => p.id !== prodId));

    // 5. Vendor delete
    db.setCollection('vendors', [...db.getCollection('vendors'), { id: vendId, companyName: 'Temp Vend', isDeleted: false }]);
    db.deleteVendor(vendId, true, 'Tester', 'SUPER_ADMIN', '127.0.0.1');

    // 6. Simulate a stale offline client pushing ALL deleted records back via /api/sync/full (db.syncState)
    const synced = db.syncState({
      customers: [{ id: custId, companyName: 'Stale Cust Corp', isDeleted: false }],
      companies: [{ id: compId, companyName: 'Stale Comp', status: 'ACTIVE' }],
      brands: [{ id: brandId, name: `TempBrand_${uid}`, code: 'TB', isActive: true }],
      categories: [{ id: catId, name: `TempCat_${uid}`, code: 'TC', isActive: true }],
      products: [{ id: prodId, itemName: 'Stale Prod', isDeleted: false }],
      vendors: [{ id: vendId, companyName: 'Stale Vend', isDeleted: false }],
    });

    assert.equal(synced.customers.some((c: any) => c.id === custId), false, 'Deleted customer must not resurrect');
    assert.equal(synced.companies.some((c: any) => c.id === compId), false, 'Deleted company must not resurrect');
    assert.equal(synced.brands.some((b: any) => b.id === brandId), false, 'Deleted brand must not resurrect');
    assert.equal(synced.categories.some((c: any) => c.id === catId), false, 'Deleted category must not resurrect');
    assert.equal(synced.products.some((p: any) => p.id === prodId), false, 'Deleted product must not resurrect');
    assert.equal(synced.vendors.some((v: any) => v.id === vendId), false, 'Deleted vendor must not resurrect');

    // 7. Partial sync (vendors-only update) must preserve existing unrelated collections & accept new vendor
    const newVendId = `VEND-NEW-${uid}`;
    const afterPartial = db.syncState({
      vendors: [{ id: newVendId, companyName: 'Newly Created Durable Supplier', isDeleted: false, createdAt: new Date().toISOString() }],
      deletedVendorIds: synced.deletedVendorIds,
    });
    assert.ok(afterPartial.vendors.some((v: any) => v.id === newVendId), 'New vendor must persist cleanly');

    // 8. Soft-archive vendor -> remains in archivedVendors (not active vendors, not deletedVendorIds), can be restored, then permanently deleted
    db.deleteVendor(newVendId, false, 'Tester', 'SUPER_ADMIN', '127.0.0.1', 'Temp archive check');
    const afterArchive = db.getAuthoritativeState();
    assert.equal(afterArchive.vendors.some((v: any) => v.id === newVendId), false, 'Archived vendor must leave active list');
    assert.equal(afterArchive.archivedVendors.some((v: any) => v.id === newVendId), true, 'Archived vendor must appear in archivedVendors');
    assert.equal(afterArchive.deletedVendorIds.includes(newVendId), false, 'Soft-archived vendor must not get a permanent tombstone');

    const restoreRes = db.restoreVendor(newVendId, 'Tester', 'SUPER_ADMIN', '127.0.0.1');
    assert.equal(restoreRes.success, true);
    assert.equal(db.getAuthoritativeState().vendors.some((v: any) => v.id === newVendId), true, 'Restored vendor must return to active vendors');
    assert.equal(db.getAuthoritativeState().archivedVendors.some((v: any) => v.id === newVendId), false, 'Restored vendor must leave archivedVendors');

    db.deleteVendor(newVendId, false, 'Tester', 'SUPER_ADMIN', '127.0.0.1', 'Re-archive before permanent purge');
    const purgeRes = db.purgeArchivedVendors('Tester', 'SUPER_ADMIN', '127.0.0.1');
    assert.equal(purgeRes.success, true);
    assert.ok(purgeRes.purgedIds.includes(newVendId));
    assert.equal(db.getAuthoritativeState().archivedVendors.some((v: any) => v.id === newVendId), false, 'Purged vendor must leave archivedVendors');
    assert.ok(db.getAuthoritativeState().deletedVendorIds.includes(newVendId), 'Purged vendor must be permanently tombstoned');
  } finally {
    // Restore original DB state and disk file cleanly so production data is untouched
    (db as any).data = originalDataClone;
    if (backupExists && backupRaw !== null) {
      fs.writeFileSync(DB_FILE, backupRaw, 'utf-8');
    }
  }
});
