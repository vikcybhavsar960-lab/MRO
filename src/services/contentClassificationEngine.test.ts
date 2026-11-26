import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  classifyTextBlock,
  isBannedGenericProductName,
  isPaginationOrNoise,
  isPlatformAttributionOrNoise,
  resolveProductIdentityFields,
  validateExtractedProduct,
  mergeMultilineProductBlocks,
  extractJsonLdAndCleanHtml,
  inspectSpreadsheetColumns,
} from './contentClassificationEngine';
import { extractIntelligenceFromHtml } from './vendorIntelligenceService';
import { parseCatalogLocally } from './aiCatalogService';
import { db } from '../server/db';

test('rejects pagination, IndiaMART attribution, section headers, addresses, and marketing taglines', () => {
  assert.equal(isPaginationOrNoise('-- 2 of 2 --'), true);
  assert.equal(isPaginationOrNoise('Page 1 of 4'), true);
  assert.equal(
    isPlatformAttributionOrNoise('Developed and Managed by IndiaMART InterMESH Limited'),
    true
  );

  const c1 = classifyTextBlock('-- 2 of 2 --');
  assert.equal(c1, 'UNKNOWN');

  const c2 = classifyTextBlock('Developed and Managed by IndiaMART InterMESH Limited');
  assert.equal(c2, 'PLATFORM_ATTRIBUTION');

  const c3 = classifyTextBlock('INSTRUMENT & SENSORS:');
  assert.equal(c3, 'CATEGORY');

  const c4 = classifyTextBlock('BEARINGS');
  assert.equal(c4, 'CATEGORY');

  const c5 = classifyTextBlock('AUTOMATION PRODUCTS');
  assert.equal(c5, 'CATEGORY');

  const c6 = classifyTextBlock('Plot 42, Sector 7, Bhosari MIDC Industrial Area, Pune - 411026, Maharashtra');
  assert.equal(c6, 'ADDRESS');
});

test('bans generic AI-invented product names when real designation or catalogue identity is missing', () => {
  const banned = [
    'Industrial Equipment',
    'Automation Product',
    'Electrical Item',
    'Sensor Device',
    'Bearing Product',
    'Mechanical Component',
    'Industrial Spare',
    'SKF Bearing',
    'Siemens',
  ];
  for (const name of banned) {
    assert.equal(isBannedGenericProductName(name), true, `Expected "${name}" to be flagged as banned generic name`);
  }

  const badValidation = validateExtractedProduct({
    productName: 'Industrial Equipment',
    brand: 'SKF',
    category: 'Bearings',
    inProductSection: false,
  });
  assert.equal(badValidation.isValid, false);
  assert.equal(badValidation.breakdown.status, 'REJECTED');
});

test('preserves exact bearing & OEM part codes and separates product identity fields cleanly', () => {
  const variants = ['6006', '6006/C3', '6006-2RS1', '6006-2Z', '6006/C4'];
  const resolvedVariants = variants.map((code) =>
    resolveProductIdentityFields(
      {
        brand: 'SKF',
        partNumber: code,
        rawProductName: 'Deep Groove Ball Bearing',
        description: 'Single row deep groove ball bearing',
        specification: '30 x 55 x 13 mm',
      },
      ['SKF']
    )
  );
  assert.deepEqual(
    resolvedVariants.map((r) => r.partNumber),
    variants
  );
  resolvedVariants.forEach((r) => {
    assert.equal(r.brand, 'SKF');
    assert.equal(r.productName, 'Deep Groove Ball Bearing');
    assert.equal(r.category, 'Bearings');
  });

  // Preserve commercial designation for specialty lubricant
  const lube = resolveProductIdentityFields(
    {
      rawProductName: 'KLÜBERSYNTH GH 6-320',
      productDesignation: 'KLÜBERSYNTH GH 6-320',
      brand: 'Kluber',
      description: 'High-temperature synthetic gear oil',
    },
    ['Kluber']
  );
  assert.equal(lube.productDesignation, 'KLÜBERSYNTH GH 6-320');
  assert.equal(lube.productName, 'KLÜBERSYNTH GH 6-320');
  assert.equal(lube.category, 'Lubricants & Chemicals');

  // OMRON E2E-X5ME1 & Siemens & Schneider examples
  const omron = resolveProductIdentityFields({ rawProductName: 'OMRON E2E-X5ME1' }, ['OMRON']);
  assert.equal(omron.brand, 'OMRON');
  assert.equal(omron.partNumber, 'E2E-X5ME1');
  assert.equal(omron.productDesignation, 'E2E-X5ME1');

  const schneider = resolveProductIdentityFields({ rawProductName: 'Schneider Electric Acti9 iC60N' }, ['Schneider Electric']);
  assert.equal(schneider.brand, 'Schneider Electric');
  assert.ok(schneider.partNumber.includes('iC60N') || schneider.productDesignation.includes('iC60N'));

  const siemensPlc = resolveProductIdentityFields({ rawProductName: 'Siemens SIMATIC S7-1200' }, ['Siemens']);
  assert.equal(siemensPlc.brand, 'Siemens');
  assert.ok(siemensPlc.productDesignation.includes('S7-1200') || siemensPlc.productName.includes('SIMATIC S7-1200'));

  const siemensMotor = resolveProductIdentityFields({ rawProductName: 'Siemens 1LE1001-1AB23' }, ['Siemens']);
  assert.equal(siemensMotor.brand, 'Siemens');
  assert.equal(siemensMotor.partNumber, '1LE1001-1AB23');
});

test('merges multi-line product blocks into a single structured MRO product record', () => {
  const lines = [
    'BEARINGS',
    '6206-2RS1',
    'Deep Groove Ball Bearing',
    'Single row',
    'Sealed',
    '30 × 62 × 16 mm',
    '-- 2 of 2 --',
    'Developed and Managed by IndiaMART InterMESH Limited',
  ];
  const blocks = mergeMultilineProductBlocks(lines);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].partCode, '6206-2RS1');
  assert.ok(blocks[0].lines.some((l) => l.includes('Deep Groove Ball Bearing')));
  assert.ok(blocks[0].lines.some((l) => l.includes('30 × 62 × 16 mm')));

  const localParsed = parseCatalogLocally('bearing_brochure.pdf', lines.join('\n'), 'VEND-TEST');
  assert.equal(localParsed.products.length, 1);
  assert.equal(localParsed.products[0].partNumber, '6206-2RS1');
  assert.ok(
    localParsed.suspiciousItems.some(
      (s) => s.rawText.includes('-- 2 of 2 --') || s.rawText.includes('IndiaMART')
    )
  );
});

test('validation scoring classifies >=90 High, 75-89 Medium, 50-74 Needs Review, <50 Reject', () => {
  const high = validateExtractedProduct({
    productName: 'Deep Groove Ball Bearing',
    brand: 'SKF',
    partNumber: '6206-2RS1',
    specification: '30x62x16mm Dual Seal',
    description: 'Single row deep groove ball bearing with contact seals',
    imageUrl: 'https://example.com/6206.jpg',
    detailUrl: 'https://example.com/p/6206',
    mrp: 680,
    inProductSection: true,
  });
  assert.equal(high.isValid, true);
  assert.equal(high.breakdown.status, 'VALID_HIGH');
  assert.ok(high.breakdown.totalScore >= 90);

  const review = validateExtractedProduct({
    productName: 'Quarter Turn Lock',
    brand: 'Unconfirmed',
    specification: 'Zinc Alloy IP65',
    description: 'Quarter turn cam lock for electrical control panels',
    inProductSection: true,
  });
  assert.equal(review.breakdown.status, 'NEEDS_REVIEW');
  assert.ok(review.breakdown.totalScore >= 50 && review.breakdown.totalScore < 75);

  const rejected = validateExtractedProduct({
    productName: 'AUTOMATION PRODUCTS',
    brand: 'Unconfirmed',
    inProductSection: false,
  });
  assert.equal(rejected.isValid, false);
  assert.equal(rejected.breakdown.status, 'REJECTED');
  assert.ok(rejected.breakdown.totalScore < 50);
});

test('inspectSpreadsheetColumns auto-detects headers including Designation and Part Code', () => {
  const csv = `Make,Designation,Catalogue Description,Technical Spec,List Price,Disc%,Net Rate,Unit
SKF,6006-2RS1,Deep Groove Ball Bearing,30x55x13 mm,590,32,401.20,NOS`;
  const preview = inspectSpreadsheetColumns(csv);
  assert.equal(preview.headers.length, 8);
  assert.equal(preview.autoMapping.brand, 'Make');
  assert.equal(preview.autoMapping.partNumber, 'Designation');
  assert.equal(preview.autoMapping.mrp, 'List Price');
  assert.equal(preview.autoMapping.purchaseRate, 'Net Rate');
});

test('strips IndiaMART and pagination noise from real website HTML fixtures (/tmp/dhairya.html & /tmp/aec.html)', () => {
  const dhairyaPath = '/tmp/dhairya.html';
  if (fs.existsSync(dhairyaPath)) {
    const html = fs.readFileSync(dhairyaPath, 'utf-8');
    const intel = extractIntelligenceFromHtml(html, 'https://www.dhairyaengineering.co.in/');
    const cleaned = extractJsonLdAndCleanHtml(html);
    assert.ok(cleaned.cleanedText.length > 0);
    assert.ok((intel.h1Texts || []).some((h) => h.includes('Dhairya Engineering')));
    assert.ok(
      (intel.htmlProductCandidates || []).some((p) => (p.partNumber || '').includes('6ES7517-3AP00-0AB0')),
      'Expected real Siemens part code 6ES7517-3AP00-0AB0 from dhairya.html'
    );
    assert.equal(
      /indiamart\s*intermesh\s*limited|--\s*\d+\s*of\s*\d+\s*--/i.test(cleaned.cleanedText),
      false,
      'Cleaned text from dhairya.html must strip IndiaMART attribution and pagination noise'
    );
    const localParsed = parseCatalogLocally('dhairya.html', intel.textContent, 'VEND-TEST');
    assert.equal(
      localParsed.products.some((p) => /indiamart|intermesh|--\s*\d+\s*of\s*\d+\s*--/i.test(p.productName)),
      false,
      'Valid products from dhairya.html must never include IndiaMART or pagination text'
    );
  }
});

test('db rate history deduplication skips identical rates and records old->new transitions cleanly; purgeArchivedVendors sets tombstones', () => {
  const dbPath = path.resolve(process.cwd(), 'data/erp_production.json');
  const rawBackup = fs.existsSync(dbPath) ? fs.readFileSync(dbPath, 'utf-8') : null;
  const parsedBackup = rawBackup ? JSON.parse(rawBackup) : null;
  const testVendorId = `VND-DEDUP-TEST-${Date.now()}`;

  try {
    db.setCollection('vendors', [
      ...db.getCollection('vendors'),
      {
        id: testVendorId,
        companyName: 'Rate Dedup Test Supplier',
        contactPerson: 'Tester',
        mobile: '+91 98000 00009',
        email: 'dedup@test.local',
        address: 'GIDC',
        city: 'Ahmedabad',
        state: 'Gujarat',
        paymentTerms: '30 Days',
        deliveryTerms: 'Door',
        productCategories: [],
        brandsSupplied: [],
        status: 'ACTIVE',
      },
    ]);

    const itemBase = {
      productName: 'Deep Groove Ball Bearing',
      sourceProductName: 'Deep Groove Ball Bearing',
      productDesignation: '6006-2RS1',
      category: 'Bearings',
      brand: 'SKF',
      partNumber: '6006-2RS1',
      mrp: 590,
      basicRate: 590,
      discountPercent: 32,
      purchaseRate: 401.2,
      uom: 'NOS',
      aiConfidence: 95,
      confidenceLevel: 'High',
      reviewStatus: 'Verified',
      approvalStatus: 'APPROVED',
    };

    // 1st save creates 1 CURRENT rate record
    const r1 = db.saveVendorCatalogueUpdate(
      testVendorId,
      {
        effectiveDate: '2026-01-01',
        catalogFile: { id: 'CF-D1', fileName: 'c1.csv', fileType: 'EXCEL', uploadDate: '2026-01-01', processingStatus: 'ANALYZED', aiAnalysisStatus: 'COMPLETED', productsIdentifiedCount: 1 },
        catalogProducts: [itemBase],
      },
      'Tester',
      'SUPER_ADMIN'
    );
    assert.equal(r1.rateHistoryRecorded, 1);

    // 2nd save with IDENTICAL rate -> rateHistoryRecorded === 0 (deduplicated!)
    const r2 = db.saveVendorCatalogueUpdate(
      testVendorId,
      {
        effectiveDate: '2026-02-01',
        catalogFile: { id: 'CF-D2', fileName: 'c2.csv', fileType: 'EXCEL', uploadDate: '2026-02-01', processingStatus: 'ANALYZED', aiAnalysisStatus: 'COMPLETED', productsIdentifiedCount: 1 },
        catalogProducts: [itemBase],
      },
      'Tester',
      'SUPER_ADMIN'
    );
    assert.equal(r2.rateHistoryRecorded, 0, 'Duplicate identical rate must not create duplicate CURRENT rate history entry');

    // 3rd save with CHANGED rate -> transitions previous to HISTORICAL and records oldRate/newRate
    const r3 = db.saveVendorCatalogueUpdate(
      testVendorId,
      {
        effectiveDate: '2026-03-01',
        catalogFile: { id: 'CF-D3', fileName: 'c3.csv', fileType: 'EXCEL', uploadDate: '2026-03-01', processingStatus: 'ANALYZED', aiAnalysisStatus: 'COMPLETED', productsIdentifiedCount: 1 },
        catalogProducts: [{ ...itemBase, mrp: 620, purchaseRate: 421.6 }],
      },
      'Tester',
      'SUPER_ADMIN'
    );
    assert.equal(r3.rateHistoryRecorded, 1);
    const rateRows = (db.getCollection('rateVersionHistory') || []).filter(
      (rv: any) => rv.vendorId === testVendorId
    );
    assert.equal(rateRows.filter((rh: any) => rh.status === 'CURRENT').length, 1);
    assert.equal(rateRows.filter((rh: any) => rh.status === 'HISTORICAL').length, 1);
    const currentRow = rateRows.find((rh: any) => rh.status === 'CURRENT');
    assert.equal(currentRow.oldRate, 401.2);
    assert.equal(currentRow.newRate, 421.6);

    // Soft-delete then purgeArchivedVendors -> sets tombstone and removes vendor permanently
    db.deleteVendor(testVendorId, false, 'Tester', 'SUPER_ADMIN', '127.0.0.1');
    const purgeRes = db.purgeArchivedVendors('Tester', 'SUPER_ADMIN', '127.0.0.1');
    assert.ok(purgeRes.purgedIds.includes(testVendorId));
    assert.equal(db.getCollection('vendors').some((v: any) => v.id === testVendorId), false);
    assert.ok(((db as any).data.deletedVendorIds || []).includes(testVendorId));
  } finally {
    if (parsedBackup) {
      for (const [key, val] of Object.entries(parsedBackup)) {
        if (Array.isArray(val)) {
          db.setCollection(key as any, val);
        }
      }
      fs.writeFileSync(dbPath, rawBackup!, 'utf-8');
    }
  }
});
