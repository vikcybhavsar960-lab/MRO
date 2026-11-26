import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  validateGstinFormat,
  validatePanFormat,
  extractGstinAndPanFromText,
  classifyVendorTypeFromText,
  extractContactsFromText,
  extractStructuredAddressFromText,
  parseTabularProductsFromCsv,
  detectSourceConflictsAndPickBest,
  detectDuplicateVendors,
  reconcileBrandsWithMaster,
  reconcileCategoriesHierarchy,
  reconcileProductsWithMaster,
  computeOnboardingCompletion,
  extractCompanyIdentityFromText,
} from './vendorOnboardingService';
import { db } from '../server/db';
import { BrandMasterItem, MaterialCategory, ProductItem, Vendor } from '../types';

test('GSTIN and PAN extraction validates Indian format and never fabricates missing values', () => {
  assert.equal(validateGstinFormat('27AABCA8942K1Z5'), true);
  assert.equal(validateGstinFormat('INVALID123'), false);
  assert.equal(validatePanFormat('AABCA8942K'), true);

  const found = extractGstinAndPanFromText(
    'Apex Precision Pvt Ltd, Plot 14 Bhosari MIDC Pune. GSTIN: 27AABCA8942K1Z5'
  );
  assert.equal(found.gstin, '27AABCA8942K1Z5');
  assert.equal(found.pan, 'AABCA8942K');
  assert.equal(found.gstState, 'Maharashtra');

  const missing = extractGstinAndPanFromText(
    'Apex Precision Pvt Ltd, Plot 14 Bhosari MIDC Pune. Call 9823044512'
  );
  assert.equal(missing.gstin, '');
  assert.equal(missing.pan, '');
});

test('Vendor type classification assigns Authorised Distributor only with explicit authorization evidence', () => {
  const generic = classifyVendorTypeFromText('Industrial supplier and distributor of bearings and belts.');
  assert.equal(generic.vendorType, 'Distributor');

  const auth = classifyVendorTypeFromText('We are an Authorised Distributor for SKF Industrial Bearings in Western India.');
  assert.equal(auth.vendorType, 'Authorised Distributor');
  assert.ok(auth.confidence >= 90);
});

test('Contact and structured address extraction handles multi-department contacts and Indian industrial zones', () => {
  const sampleText = `Apex Precision Motion Pvt Ltd
Plot 42, Sector 7, Bhosari MIDC Industrial Area, Pune - 411026, Maharashtra
Sales Desk: Rajesh Kulkarni | Mobile: +91 98230 44512 | Email: sales@apexprecision.in
Purchase Support: Anita Joshi | Phone: +91 98230 44599 | Email: rfq@apexprecision.in`;

  const contacts = extractContactsFromText(sampleText, 'Visiting Card');
  assert.ok(contacts.length >= 2);
  assert.ok(contacts.some((c) => c.email === 'sales@apexprecision.in' && c.department === 'Sales'));
  assert.ok(contacts.some((c) => c.email === 'rfq@apexprecision.in' && c.department === 'Purchase'));

  const addr = extractStructuredAddressFromText(sampleText, 'Visiting Card', '27AABCA8942K1Z5');
  assert.equal(addr.city, 'Pune');
  assert.equal(addr.state, 'Maharashtra');
  assert.equal(addr.pincode, '411026');
  assert.ok(addr.rawAddress.includes('Bhosari'));
});

test('CSV tabular parser preserves exact bearing part codes and separates MRP, Basic Rate, and Purchase Rate', () => {
  const csv = `Brand,Product Name,Part Code,Category,Sub Category,Specification,MRP,Basic Rate,Discount %,Purchase Rate,UOM
SKF,Deep Groove Ball Bearing,6006,Bearings,Ball Bearings,30x55x13 Open,480,450,35,312,NOS
SKF,Deep Groove Ball Bearing C3,6006/C3,Bearings,Ball Bearings,30x55x13 C3,510,480,35,331.5,NOS
SKF,Sealed Deep Groove Ball Bearing,6006-2RS1,Bearings,Ball Bearings,30x55x13 Sealed,590,550,32,401.2,NOS
SKF,Shielded Deep Groove Ball Bearing,6006-2Z,Bearings,Ball Bearings,30x55x13 Shielded,550,515,32,374,NOS`;

  const parsed = parseTabularProductsFromCsv(csv, 'skf_rates.csv', 'VEND-TEST');
  assert.equal(parsed.length, 4);
  assert.deepEqual(
    parsed.map((p) => p.partNumber),
    ['6006', '6006/C3', '6006-2RS1', '6006-2Z']
  );
  assert.equal(parsed[0].mrp, 480);
  assert.equal(parsed[0].basicRate, 450);
  assert.equal(parsed[0].discountPercent, 35);
  assert.equal(parsed[0].purchaseRate, 312);
});

test('Multi-source conflict resolution prefers higher priority official sources and exposes conflicts', () => {
  const { resolvedFields, conflicts } = detectSourceConflictsAndPickBest([
    {
      sourceType: 'BUSINESS_CARD',
      sourceName: 'card.jpg',
      confidence: 80,
      companyName: 'Apex Precision Motion',
      city: 'Pimpri',
    },
    {
      sourceType: 'WEBSITE',
      sourceName: 'https://apexprecision.in',
      confidence: 95,
      companyName: 'Apex Precision Motion Pvt Ltd',
      city: 'Pune',
    },
  ]);

  assert.equal(resolvedFields.companyName.value, 'Apex Precision Motion Pvt Ltd');
  assert.equal(resolvedFields.city.value, 'Pune');
  assert.ok(conflicts.some((c) => c.field === 'city' && c.candidates.length === 2));
});

test('Duplicate vendor detection catches GSTIN and similar company name matches', () => {
  const existing: Vendor[] = [
    {
      id: 'VEND-001',
      vendorCode: 'VEND-001',
      companyName: 'SKF Authorized Industrial Bearings Pvt Ltd',
      contactPerson: 'Suresh',
      mobile: '+91 98220 11223',
      email: 'sales@skfauthorized.in',
      address: 'Pune',
      city: 'Pune',
      state: 'Maharashtra',
      gstin: '27AABCS1111A1Z5',
      pan: 'AABCS1111A',
      paymentTerms: '30 Days',
      deliveryTerms: 'Ex-Works',
      bankDetails: { accountName: 'SKF', accountNumber: '001', bankName: 'HDFC', ifscCode: 'HDFC0001', branch: 'Pune' },
      productCategories: ['Bearings'],
      brandsSupplied: ['SKF'],
      rating: 4.9,
      createdAt: '2026-01-01',
    },
  ];

  const dups = detectDuplicateVendors(
    {
      companyName: 'SKF Authorized Industrial Bearings Ltd',
      gstin: '27AABCS1111A1Z5',
      email: 'info@skfauthorized.in',
    },
    existing
  );
  assert.equal(dups.length, 1);
  assert.ok(dups[0].similarityScore >= 95);
  assert.ok(dups[0].matchedOn.includes('Exact GSTIN'));
});

test('Brand, Category hierarchy, and Product Master reconciliation detects fuzzy brands and missing fields', () => {
  const brandMaster: BrandMasterItem[] = [
    { id: 'BRD-SKF', name: 'SKF', code: 'SKF', category: 'Bearings', isActive: true, createdAt: '2026-01-01' },
    { id: 'BRD-SCH', name: 'Schneider Electric', code: 'SCH', category: 'Electrical & Switchgear', isActive: true, createdAt: '2026-01-01' },
  ];
  const categoryMaster: MaterialCategory[] = [
    { id: 'CAT-1', code: 'CAT-001', name: 'Bearings', description: 'Industrial Bearings', subCategories: ['Ball Bearings'], keywords: ['bearing'], itemExamples: ['Deep Groove Bearing'], isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  ];
  const productMaster: ProductItem[] = [
    { id: 'PRD-1', itemName: 'Deep Groove Ball Bearing', category: 'Bearings', brand: 'SKF', partNumber: '6006-2RS1', modelNumber: '6006-2RS1', specification: '30x55x13', description: 'Bearing', uom: 'NOS', status: 'ACTIVE' },
  ];

  const prods = reconcileProductsWithMaster(
    'NEW',
    [
      { productName: 'Deep Groove Ball Bearing', brand: 'SKF', partNumber: '6006-2RS1', category: 'Bearings', subCategory: 'Ball Bearings' },
      { productName: 'TeSys D Contactor', brand: 'Schneider', partNumber: 'LC1D09B7', category: 'Electrical & Switchgear' },
    ],
    productMaster,
    brandMaster,
    'test.csv'
  );
  assert.equal(prods[0].matchStatus, 'EXACT_MATCH');
  assert.equal(prods[1].matchStatus, 'NEW_PRODUCT');

  const brands = reconcileBrandsWithMaster(prods, 'Catalog listing SKF and Schneider products', brandMaster, 'test.csv');
  const sch = brands.find((b) => b.brandName.toLowerCase().includes('schneider'));
  assert.ok(sch);
  assert.ok((sch?.ambiguousMatches || []).some((m) => m.name === 'Schneider Electric') || sch?.isExistingMaster);

  const cats = reconcileCategoriesHierarchy(prods, categoryMaster, 'test.csv');
  assert.ok(cats.categories.some((c) => c.category === 'Bearings' && c.isExistingMaster));

  const completion = computeOnboardingCompletion({
    company: {
      companyName: 'Test Co',
      legalName: 'Test Co Pvt Ltd',
      tradingNames: [],
      vendorType: 'Distributor',
      website: '',
      gstin: '',
      pan: '',
      country: 'India',
      msmeStatus: 'Small',
      paymentTerms: '30 Days',
      creditPeriod: '30 Days',
      deliveryTerms: 'Ex-Works',
      summary: '',
    },
    structuredAddress: { rawAddress: 'Plot 1', city: '', state: '', pincode: '', splitConfidence: 40 },
    contacts: [{ id: '1', name: 'A', email: '', mobile: '9823044512', isPrimary: true, source: 'Test', confidence: 90 }],
    brands,
    categories: cats.categories,
    productFamilies: cats.productFamilies,
    products: prods,
    conflicts: [],
    sourceTraceability: [],
  });
  assert.ok(completion.missingRequiredFields.some((f) => f.field === 'email'));
  assert.ok(completion.missingRequiredFields.some((f) => f.field === 'city'));
});

test('db.commitVendorOnboardingTransaction performs atomic commit and clean rollback on validation failure', () => {
  const uniqueSuffix = Date.now();
  const initialBrandsLen = (db.getCollection('brands') || []).length;
  const initialProdsLen = (db.getCollection('products') || []).length;

  // 1. Verify rollback on invalid GSTIN (nothing partial created)
  assert.throws(() => {
    db.commitVendorOnboardingTransaction({
      mode: 'CREATE',
      company: {
        companyName: `Rollback Test Vendor ${uniqueSuffix}`,
        legalName: `Rollback Test Vendor ${uniqueSuffix}`,
        tradingNames: [],
        vendorType: 'Distributor',
        website: '',
        gstin: 'BAD_GSTIN_VALUE',
        pan: '',
        country: 'India',
        msmeStatus: 'Small',
        paymentTerms: '30 Days Net',
        creditPeriod: '30 Days',
        deliveryTerms: 'Ex-Works',
        summary: '',
      },
      structuredAddress: { rawAddress: 'Pune', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
      contacts: [{ id: 'c1', name: 'Test', email: 'a@b.com', mobile: '9999988888', isPrimary: true, source: 'Test', confidence: 90 }],
      brands: [{ brandName: `RollbackBrand_${uniqueSuffix}`, relationshipType: 'Listed In Catalogue', productCount: 1, source: 'Test', confidence: 90, firstDetected: '2026-01-01', lastVerified: '2026-01-01' }],
      categories: [{ id: 'c1', category: 'Bearings', brands: [], source: 'Test', confidence: 90, isExistingMaster: true, selected: true }],
      productFamilies: ['Ball Bearings'],
      products: [{ tempId: 'p1', accepted: true, vendorId: 'NEW', catalogFileName: 'test.csv', productName: `RollbackProd_${uniqueSuffix}`, category: 'Bearings', brand: `RollbackBrand_${uniqueSuffix}`, partNumber: 'RB-999', uom: 'NOS', reviewStatus: 'Verified' }],
      createMissingProductsInMaster: true,
    });
  }, /Invalid GSTIN format/);

  assert.equal((db.getCollection('brands') || []).length, initialBrandsLen, 'Brands must rollback cleanly');
  assert.equal((db.getCollection('products') || []).length, initialProdsLen, 'Products must rollback cleanly');

  const dbPath = path.resolve(process.cwd(), 'data/erp_production.json');
  const rawBackup = fs.existsSync(dbPath) ? fs.readFileSync(dbPath, 'utf-8') : null;
  const parsedBackup = rawBackup ? JSON.parse(rawBackup) : null;

  try {
    // 2. Verify full atomic commit
    const brandName = `AtomicBrand_${uniqueSuffix}`;
    const prodPart = `AB-${uniqueSuffix}`;
    const commitRes = db.commitVendorOnboardingTransaction(
      {
        mode: 'CREATE',
        company: {
          companyName: `Atomic Onboarded Corp ${uniqueSuffix}`,
          legalName: `Atomic Onboarded Corp Pvt Ltd ${uniqueSuffix}`,
          tradingNames: [],
          vendorType: 'Authorised Distributor',
          website: 'https://atomiconboard.in',
          gstin: '27AABCA8942K1Z5',
          pan: 'AABCA8942K',
          country: 'India',
          msmeStatus: 'Small',
          paymentTerms: '30 Days Net',
          creditPeriod: '30 Days',
          deliveryTerms: 'Ex-Works',
          summary: 'Test vendor',
        },
        structuredAddress: { rawAddress: 'Plot 9, Chakan MIDC, Pune', area: 'Chakan MIDC', city: 'Pune', state: 'Maharashtra', pincode: '410501' },
        contacts: [
          { id: 'c1', name: 'Rajesh', department: 'Sales', email: 'sales@atomiconboard.in', mobile: '9823011223', isPrimary: true, source: 'Card', confidence: 95 },
        ],
        brands: [
          { brandName, relationshipType: 'Authorised Distributor', productCount: 1, source: 'Brochure', confidence: 92, firstDetected: '2026-11-12', lastVerified: '2026-11-12', evidence: 'Authorised Distributor for ' + brandName },
        ],
        categories: [
          { id: 'cat-1', category: 'Bearings', subCategory: 'Ball Bearings', productFamily: 'Ball Bearings', brands: [brandName], source: 'Brochure', confidence: 90, isExistingMaster: true, selected: true },
        ],
        productFamilies: ['Ball Bearings'],
        products: [
          {
            tempId: 'p-1',
            accepted: true,
            vendorId: 'NEW',
            catalogFileName: 'atomic_price_list.csv',
            productName: `Precision Bearing ${uniqueSuffix}`,
            category: 'Bearings',
            subCategory: 'Ball Bearings',
            brand: brandName,
            partNumber: prodPart,
            modelNumber: prodPart,
            mrp: 1000,
            discountPercent: 25,
            purchaseRate: 750,
            uom: 'NOS',
            reviewStatus: 'Verified',
          },
        ],
        createMissingProductsInMaster: true,
      },
      'Tester',
      'SUPER_ADMIN',
      '127.0.0.1'
    );

    assert.equal(commitRes.success, true);
    assert.equal(commitRes.verified, true);
    assert.equal(commitRes.mode, 'CREATE');
    assert.ok(commitRes.vendor.id);
    assert.equal(commitRes.createdBrands.length, 1);
    assert.equal(commitRes.createdProducts.length, 1);
    assert.equal(commitRes.mappingsCreated.length, 1);
    assert.equal(commitRes.rateHistoryRecorded, 1);
    assert.ok(
      (db.getAuthoritativeState().vendors || []).some((v: any) => v.id === commitRes.vendor.id),
      'Committed vendor must be visible in authoritative state'
    );
  } finally {
    if (parsedBackup) {
      const dAny = (db as any).data;
      Object.keys(dAny).forEach((k) => {
        if (k in parsedBackup) {
          dAny[k] = parsedBackup[k];
        }
      });
      fs.writeFileSync(dbPath, rawBackup!, 'utf-8');
    }
  }
});

test('extractCompanyIdentityFromText strips trailing SEO location phrases from page titles', () => {
  const sampleHtmlText = `Ahmedabad Electric Corporation in Odhav, Ahmedabad | Switchgear & Electrical Spares\nWe supply Siemens and Schneider switchgear across Gujarat.`;
  const res = extractCompanyIdentityFromText(sampleHtmlText, 'https://www.aecswitchgear.co.in/', 'https://www.aecswitchgear.co.in/');
  assert.equal(res.companyName, 'Ahmedabad Electric Corporation');
  assert.equal(res.legalName, 'Ahmedabad Electric Corporation');
});

