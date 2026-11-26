import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  calculateVendorIntelligenceScore,
  preserveExactPartCode,
  buildPartCodeComparisonKey,
  matchExtractedProductWithProductMaster,
  classifyBrandRelationship,
  detectBrandsAgainstMaster,
  mapProductFamilyAndType,
  compareVendorCatalogues,
  combineWebsiteAndCatalogueIntelligence,
  extractIntelligenceFromHtml,
  FOUR_D_TECHNOLOGY_TEST_PROFILE,
} from './vendorIntelligenceService';
import { parseCatalogLocally } from './aiCatalogService';
import { recommendVendorsForRequirement } from './categoryMatchingService';
import { db } from '../server/db';
import { BrandMasterItem, ProductItem, Vendor, VendorCatalogProduct } from '../types';

test('preserveExactPartCode preserves punctuation (-, /, .) and strips invisible chars', () => {
  assert.equal(preserveExactPartCode(' 6006-2RS1\u200B '), '6006-2RS1');
  assert.equal(preserveExactPartCode('E50S8-1024-3-T-24'), 'E50S8-1024-3-T-24');
  assert.equal(preserveExactPartCode('6006/C3'), '6006/C3');
  assert.notEqual(buildPartCodeComparisonKey('6006'), buildPartCodeComparisonKey('6006-2RS1'));
  assert.notEqual(buildPartCodeComparisonKey('6006-2RS1'), buildPartCodeComparisonKey('6006/C3'));
});

test('matchExtractedProductWithProductMaster enforces 9-tier priority & AMBIGUOUS_MATCH', () => {
  const sampleProducts: ProductItem[] = [
    {
      id: 'P-1',
      itemName: 'Deep Groove Ball Bearing',
      description: 'Sealed deep groove ball bearing 6006-2RS1',
      category: 'Bearings',
      brand: 'SKF',
      modelNumber: '6006-2RS1',
      partNumber: '6006-2RS1',
      specification: '30x55x13mm Sealed',
      uom: 'NOS',
      status: 'ACTIVE',
      createdAt: '2026-01-01',
    },
    {
      id: 'P-2',
      itemName: 'Inductive Sensor M18 PNP NO',
      description: 'M18 Inductive Proximity Sensor',
      category: 'Sensors',
      brand: 'Autonics',
      modelNumber: 'PR18-8DN',
      partNumber: 'PR18-8DN',
      specification: 'M18 8mm PNP NO 10-30VDC',
      uom: 'NOS',
      status: 'ACTIVE',
      createdAt: '2026-01-01',
    },
    {
      id: 'P-3',
      itemName: 'OEM Contactor Variant A',
      description: 'Siemens Power Contactor 25A',
      category: 'Switchgear',
      brand: 'Siemens',
      modelNumber: 'DUP-100',
      partNumber: 'DUP-100',
      specification: '25A 3P AC-3',
      uom: 'NOS',
      status: 'ACTIVE',
      createdAt: '2026-01-01',
    },
    {
      id: 'P-4',
      itemName: 'OEM Contactor Variant B',
      description: 'ABB Power Contactor 25A',
      category: 'Switchgear',
      brand: 'ABB',
      modelNumber: 'DUP-100',
      partNumber: 'DUP-100',
      specification: '25A 3P AC-3',
      uom: 'NOS',
      status: 'ACTIVE',
      createdAt: '2026-01-01',
    },
  ];

  const exactRes = matchExtractedProductWithProductMaster(
    { partNumber: '6006-2RS1', brand: 'SKF', productName: 'Bearing' },
    sampleProducts
  );
  assert.equal(exactRes.matchStatus, 'EXACT_MATCH');
  assert.equal(exactRes.matchedProduct?.id, 'P-1');

  // 6006 must NOT falsely match 6006-2RS1
  const suffixMismatch = matchExtractedProductWithProductMaster(
    { partNumber: '6006', brand: 'SKF', productName: 'Open Bearing', category: 'Bearings' },
    sampleProducts
  );
  assert.equal(suffixMismatch.matchStatus, 'NEW_PRODUCT');

  // Ambiguous duplicate part number without matching brand resolves to AMBIGUOUS_MATCH with selectable candidates
  const ambiguous = matchExtractedProductWithProductMaster(
    { partNumber: 'DUP-100', brand: 'Unconfirmed', productName: 'Contactor' },
    sampleProducts
  );
  assert.equal(ambiguous.matchStatus, 'AMBIGUOUS_MATCH');
  assert.equal(ambiguous.candidates?.length, 2);

  // Ambiguous disambiguated by brand -> EXACT_MATCH
  const disambiguated = matchExtractedProductWithProductMaster(
    { partNumber: 'DUP-100', brand: 'Siemens', productName: 'Contactor' },
    sampleProducts
  );
  assert.equal(disambiguated.matchStatus, 'EXACT_MATCH');
  assert.equal(disambiguated.matchedProduct?.id, 'P-3');
});

test('classifyBrandRelationship assigns Authorised Distributor strictly from evidence', () => {
  assert.equal(
    classifyBrandRelationship('We are the Authorised Distributor of Autonics sensors in Gujarat.', 'Autonics'),
    'Authorised Distributor'
  );
  assert.equal(
    classifyBrandRelationship('Product price list for Schneider Electric contactors and relays.', 'Schneider Electric'),
    'Listed In Catalogue'
  );
  assert.equal(
    classifyBrandRelationship('This brochure covers Mean Well SMPS power supplies we deals in.', 'Mean Well'),
    'Deals In'
  );
});

test('detectBrandsAgainstMaster reconciles Existing vs New Brand Detected', () => {
  const brandMaster: BrandMasterItem[] = [
    {
      id: 'BRD-1',
      name: 'Autonics',
      code: 'AUT',
      category: 'Sensors',
      categories: ['Sensors'],
      isActive: true,
      createdAt: '2026-01-01',
    },
  ];
  const products: Partial<VendorCatalogProduct>[] = [
    { brand: 'Autonics', aiConfidence: 96, evidence: 'Authorised Distributor of Autonics.' },
    { brand: '4D Tech', aiConfidence: 98, evidence: '4D Tech PU Gasket Solutions.' },
    { brand: 'Unconfirmed', aiConfidence: 60 },
  ];

  const detected = detectBrandsAgainstMaster(products, 'Authorised Distributor of Autonics.', brandMaster);
  assert.equal(detected.length, 2);
  const autonics = detected.find((d) => d.name === 'Autonics');
  const fourD = detected.find((d) => d.name === '4D Tech');
  assert.equal(autonics?.isExisting, true);
  assert.equal(autonics?.relationship, 'Authorised Distributor');
  assert.equal(fourD?.isExisting, false);
  assert.equal(fourD?.relationship, 'Listed In Catalogue');
});

test('compareVendorCatalogues detects new, rate delta, and removed items without deletion', () => {
  const existing: VendorCatalogProduct[] = [
    {
      id: 'CP-1',
      vendorId: 'V-1',
      productName: 'Sensor M18',
      description: 'M18 Proximity Sensor',
      category: 'Sensors',
      brand: 'Autonics',
      partNumber: 'PR18-8DN',
      mrp: 1450,
      purchaseRate: 980,
      uom: 'NOS',
      keywords: ['Sensors', 'Autonics'],
      aiConfidence: 95,
      confidenceLevel: 'High',
      reviewStatus: 'Verified',
      approvalStatus: 'APPROVED',
      catalogueStatus: 'ACTIVE',
    },
    {
      id: 'CP-2',
      vendorId: 'V-1',
      productName: 'Legacy Timer',
      description: 'Digital Timer',
      category: 'Automation',
      brand: 'Autonics',
      partNumber: 'LE8N-BN',
      mrp: 1800,
      purchaseRate: 1200,
      uom: 'NOS',
      keywords: ['Automation', 'Autonics'],
      aiConfidence: 90,
      confidenceLevel: 'High',
      reviewStatus: 'Verified',
      approvalStatus: 'APPROVED',
      catalogueStatus: 'ACTIVE',
    },
  ];

  const incoming: Array<Omit<VendorCatalogProduct, 'id'>> = [
    {
      vendorId: 'V-1',
      productName: 'Sensor M18',
      description: 'M18 Proximity Sensor',
      category: 'Sensors',
      brand: 'Autonics',
      partNumber: 'PR18-8DN',
      mrp: 1550,
      purchaseRate: 1050,
      uom: 'NOS',
      keywords: ['Sensors', 'Autonics'],
      aiConfidence: 98,
      confidenceLevel: 'High',
      reviewStatus: 'Verified',
      approvalStatus: 'APPROVED',
    },
    {
      vendorId: 'V-1',
      productName: 'PU Gasket 15x10',
      description: 'Seamless PU Gasket',
      category: 'Enclosures & Gaskets',
      brand: '4D Tech',
      partNumber: '4D-PUG-15x10',
      mrp: 180,
      purchaseRate: 115,
      uom: 'MTR',
      keywords: ['Enclosures & Gaskets', '4D Tech'],
      aiConfidence: 96,
      confidenceLevel: 'High',
      reviewStatus: 'Verified',
      approvalStatus: 'APPROVED',
    },
  ];

  const diff = compareVendorCatalogues(existing, incoming);
  assert.equal(diff.newProducts.length, 1);
  assert.equal(diff.newProducts[0].partNumber, '4D-PUG-15x10');
  assert.equal(diff.changedRates.length, 1);
  assert.equal(diff.changedRates[0].oldRate, 980);
  assert.equal(diff.changedRates[0].newRate, 1050);
  assert.equal(diff.changedRates[0].deltaAmount, 70);
  assert.equal(diff.removedProducts.length, 1);
  assert.equal(diff.removedProducts[0].partNumber, 'LE8N-BN');
});

test('combineWebsiteAndCatalogueIntelligence merges overlapping items into PDF+WEBSITE', () => {
  const existingPdf: VendorCatalogProduct[] = [
    {
      id: 'CP-10',
      vendorId: 'V-4D',
      productName: 'Continuous PU Foam Gasket',
      description: 'PU Gasket',
      category: 'Enclosures & Gaskets',
      brand: '4D Tech',
      partNumber: '4D-PUG-15x10',
      specification: '15x10mm',
      uom: 'MTR',
      keywords: ['Gaskets'],
      mrp: 180,
      purchaseRate: 115,
      sourceType: 'PDF',
      aiConfidence: 96,
      confidenceLevel: 'High',
      reviewStatus: 'Verified',
      approvalStatus: 'APPROVED',
      catalogueStatus: 'ACTIVE',
    },
  ];

  const webItems: Array<Omit<VendorCatalogProduct, 'id'>> = [
    {
      vendorId: 'V-4D',
      productName: 'Continuous PU Foam Gasket Seal',
      description: 'PU Gasket',
      category: 'Enclosures & Gaskets',
      brand: '4D Tech',
      partNumber: '4D-PUG-15x10',
      specification: '15mm x 10mm Seamless Dispensed Polyurethane Gasket IP66 Rated',
      uom: 'MTR',
      keywords: ['Gaskets'],
      sourceUrl: 'https://4dtechnology.in/gaskets',
      aiConfidence: 90,
      confidenceLevel: 'High',
      reviewStatus: 'Verified',
      approvalStatus: 'APPROVED',
    },
    {
      vendorId: 'V-4D',
      productName: 'CNC Enclosure Glazing Kit',
      description: 'Glazing Kit',
      category: 'Enclosures & Gaskets',
      brand: '4D Tech',
      partNumber: '4D-GLAZE-01',
      uom: 'SET',
      keywords: ['Enclosures'],
      sourceUrl: 'https://4dtechnology.in/accessories',
      aiConfidence: 88,
      confidenceLevel: 'High',
      reviewStatus: 'Verified',
      approvalStatus: 'APPROVED',
    },
  ];

  const fused = combineWebsiteAndCatalogueIntelligence(
    existingPdf,
    webItems,
    'https://4dtechnology.in',
    'V-4D'
  );
  assert.equal(fused.enrichedFromWebsiteCount, 1);
  assert.equal(fused.addedFromWebsiteCount, 1);
  assert.equal(fused.mergedProducts.length, 2);
  assert.equal(fused.mergedProducts[0].sourceType, 'PDF+WEBSITE');
  assert.ok(fused.mergedProducts[0].specification?.includes('Seamless Dispensed Polyurethane'));
  assert.equal(fused.mergedProducts[1].sourceType, 'WEBSITE');
});

test('extractIntelligenceFromHtml parses real metadata, PDF links, contacts, and brand mentions', () => {
  const html = `
    <html>
      <head>
        <title>4D Technology - Industrial Automation & Enclosures</title>
        <meta name="description" content="Authorized distributor of Autonics sensors and manufacturer of PU gaskets." />
      </head>
      <body>
        <a href="/products/sensors">Sensors</a>
        <a href="/downloads/4d-brochure.pdf">Download Product Catalogue</a>
        <p>Contact sales@4dtechnology.in or +91 98250 11223. Authorised Distributor of Autonics.</p>
      </body>
    </html>
  `;
  const parsed = extractIntelligenceFromHtml(html, 'https://4dtechnology.in', [
    {
      id: 'B1',
      name: 'Autonics',
      code: 'AUT',
      category: 'Sensors',
      categories: ['Sensors'],
      isActive: true,
      createdAt: '2026-01-01',
    },
  ]);
  assert.equal(parsed.title, '4D Technology - Industrial Automation & Enclosures');
  assert.ok(parsed.emails.includes('sales@4dtechnology.in'));
  assert.equal(parsed.pdfLinks.length, 1);
  assert.equal(parsed.pdfLinks[0].url, 'https://4dtechnology.in/downloads/4d-brochure.pdf');
  assert.ok(parsed.relevantSubpages.includes('https://4dtechnology.in/products/sensors'));
  assert.equal(parsed.brandMentions[0].name, 'Autonics');
  assert.equal(parsed.brandMentions[0].relationship, 'Authorised Distributor');
});

test('parseCatalogLocally extracts 4d brochure.pdf test profile with rates, pages, and families', () => {
  const sampleText = `--- PAGE 1 ---
4D Technology & Automation Systems Pvt Ltd
Autonics PR18-8DN M18 Inductive Proximity Sensor`;
  const parsed = parseCatalogLocally('4d brochure.pdf', sampleText, 'V-TEST');
  assert.equal(parsed.products.length, FOUR_D_TECHNOLOGY_TEST_PROFILE.products.length);
  const first = parsed.products[0];
  assert.equal(first.partNumber, 'PR18-8DN');
  assert.equal(first.mrp, 1450);
  assert.equal(first.purchaseRate, 980);
  assert.equal(first.sourcePage, 1);
  assert.ok(first.productFamily);
});

test('calculateVendorIntelligenceScore computes transparent breakdown up to 100', () => {
  const breakdown = calculateVendorIntelligenceScore({
    website: 'https://4dtechnology.in',
    lastWebsiteAnalysisDate: '12 Nov 2026',
    lastAiAnalysisDate: '12 Nov 2026',
    catalogFiles: [
      {
        id: 'CF1',
        vendorId: 'V-4D',
        fileName: '4d brochure.pdf',
        fileType: 'PDF',
        uploadDate: '2026-11-12',
        processingStatus: 'ANALYZED',
        aiAnalysisStatus: 'COMPLETED',
        productsIdentifiedCount: 13,
      },
    ],
    brandsSupplied: ['4D Tech', 'Autonics', 'Schneider Electric', 'Mean Well', 'Connectwell'],
    catalogProducts: FOUR_D_TECHNOLOGY_TEST_PROFILE.products.map((p, i) => ({
      ...p,
      id: `CP-${i}`,
      vendorId: 'V-4D',
      description: p.productName,
      keywords: [p.category, p.brand],
      approvalStatus: 'APPROVED' as const,
      catalogueStatus: 'ACTIVE' as const,
    })),
  });
  assert.ok(breakdown.totalScore >= 75 && breakdown.totalScore <= 100);
  assert.equal(breakdown.websiteAvailable, 15);
  assert.equal(breakdown.brandsIdentified, 15);
  assert.equal(breakdown.recentlyVerified, 5);
});

test('recommendVendorsForRequirement boosts vendors with exact active catalogue product & rate', () => {
  const { productFamily } = mapProductFamilyAndType('PU Gasket Seal', 'Enclosures & Gaskets');
  assert.equal(productFamily, 'Enclosures & Gaskets');

  const vendors: Vendor[] = [
    {
      id: 'V-LOW',
      companyName: 'Generic Supplier',
      contactPerson: 'A',
      mobile: '9999999999',
      email: 'a@test.com',
      address: 'X',
      city: 'Pune',
      state: 'MH',
      gstin: '27AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
      paymentTerms: '30 Days',
      deliveryTerms: 'Door',
      bankDetails: { accountName: 'Generic', accountNumber: '1', bankName: 'HDFC', ifscCode: 'HDFC0001', branch: 'Pune' },
      productCategories: ['Electrical'],
      brandsSupplied: ['L&T'],
      rating: 4.1,
      createdAt: '2026-01-01',
      status: 'ACTIVE',
    },
    {
      id: 'V-4D',
      companyName: '4D Technology',
      contactPerson: 'B',
      mobile: '9999999998',
      email: 'b@4dtechnology.in',
      address: 'Y',
      city: 'Ahmedabad',
      state: 'GJ',
      gstin: '24AAAAA0000A1Z5',
      pan: 'AAAAA0000B',
      paymentTerms: '30 Days',
      deliveryTerms: 'Door',
      bankDetails: { accountName: '4D Tech', accountNumber: '2', bankName: 'HDFC', ifscCode: 'HDFC0002', branch: 'Ahmedabad' },
      productCategories: ['Enclosures & Gaskets'],
      brandsSupplied: ['4D Tech'],
      brandsDealing: ['4D Tech'],
      productFamilies: ['Enclosures & Gaskets'],
      intelligenceScore: 88,
      rating: 4.9,
      createdAt: '2026-01-01',
      status: 'ACTIVE',
      catalogProducts: [
        {
          id: 'CP-G1',
          vendorId: 'V-4D',
          productName: 'Continuous PU Foam Gasket Seal',
          description: 'Continuous PU Foam Gasket',
          category: 'Enclosures & Gaskets',
          brand: '4D Tech',
          partNumber: '4D-PUG-15x10',
          purchaseRate: 115,
          mrp: 180,
          uom: 'MTR',
          keywords: ['PU Gasket', '4D-PUG-15x10'],
          aiConfidence: 96,
          confidenceLevel: 'High',
          reviewStatus: 'Verified',
          approvalStatus: 'APPROVED',
          catalogueStatus: 'ACTIVE',
        },
      ],
    },
  ];

  const recs = recommendVendorsForRequirement(
    {
      itemName: 'Continuous PU Foam Gasket Seal',
      brand: '4D Tech',
      partNumber: '4D-PUG-15x10',
      category: 'Enclosures & Gaskets',
    },
    vendors
  );
  assert.ok(recs.length >= 1);
  assert.equal(recs[0].vendorId, 'V-4D');
  assert.ok(recs[0].matchScore > 80);
});

// DB Integration Test with full snapshot restore so production JSON stays unpolluted
test('PersistentDatabase catalogue batch commit, re-upload diff, archive & rollback preserve data cleanly', () => {
  const dbPath = path.resolve(process.cwd(), 'data/erp_production.json');
  const rawBackup = fs.existsSync(dbPath) ? fs.readFileSync(dbPath, 'utf-8') : null;
  const parsedBackup = rawBackup ? JSON.parse(rawBackup) : null;
  const testVendorId = `VND-INTEL-TEST-${Date.now()}`;

  try {
    db.setCollection('vendors', [
      ...db.getCollection('vendors'),
      {
        id: testVendorId,
        companyName: '4D Integration Test Supplier',
        contactPerson: 'Tester',
        mobile: '+91 98000 00001',
        email: 'test@4d.local',
        address: 'GIDC',
        city: 'Ahmedabad',
        state: 'Gujarat',
        gstin: '24AAAAA0000A1Z5',
        pan: 'AAAAA0000A',
        paymentTerms: '30 Days',
        deliveryTerms: 'Door',
        productCategories: [],
        brandsSupplied: [],
        status: 'ACTIVE',
      },
    ]);

    // Batch 1 commit
    const b1 = db.saveVendorCatalogueUpdate(
      testVendorId,
      {
        batchVersion: '2026.08',
        effectiveDate: '2026-08-01',
        catalogFile: {
          id: 'CF-1',
          fileName: '4d brochure.pdf',
          fileType: 'PDF',
          uploadDate: '2026-11-12T10:00:00Z',
          processingStatus: 'ANALYZED',
          aiAnalysisStatus: 'COMPLETED',
          productsIdentifiedCount: 2,
          version: '2026.08',
          effectiveDate: '2026-08-01',
        },
        catalogProducts: [
          {
            productName: 'Proximity Sensor M18',
            category: 'Sensors',
            brand: 'Autonics',
            partNumber: 'PR18-8DN',
            mrp: 1450,
            purchaseRate: 980,
            uom: 'NOS',
            aiConfidence: 98,
            confidenceLevel: 'High',
            reviewStatus: 'Verified',
            approvalStatus: 'APPROVED',
          },
          {
            productName: 'PU Foam Gasket 15x10',
            category: 'Enclosures & Gaskets',
            brand: '4D Test Brand',
            partNumber: '4D-PUG-15x10',
            mrp: 180,
            purchaseRate: 115,
            uom: 'MTR',
            aiConfidence: 96,
            confidenceLevel: 'High',
            reviewStatus: 'Verified',
            approvalStatus: 'APPROVED',
          },
        ],
        suggestedCategories: [
          {
            category: 'Sensors',
            brands: ['Autonics'],
            productsFoundCount: 1,
            confidence: 98,
            sourceDocument: '4d brochure.pdf',
            status: 'APPROVED',
            isNewSuggestedCategory: false,
          },
        ],
        confirmedNewBrands: ['4D Test Brand'],
      },
      'Super Admin',
      'SUPER_ADMIN'
    );

    assert.equal(b1.success, true);
    assert.equal(b1.verified, true);
    assert.ok(b1.batchId.startsWith('CAT-IMP-'));
    assert.ok(b1.newBrandsCreated.some((br: any) => br.name === '4D Test Brand'));
    assert.equal(b1.rateHistoryRecorded, 2);

    // Batch 2 re-upload with rate change + 1 removed item
    const b2 = db.saveVendorCatalogueUpdate(
      testVendorId,
      {
        batchVersion: '2026.11',
        effectiveDate: '2026-11-01',
        catalogFile: {
          id: 'CF-2',
          fileName: '4d brochure v2.pdf',
          fileType: 'PDF',
          uploadDate: '2026-11-12T11:00:00Z',
          processingStatus: 'ANALYZED',
          aiAnalysisStatus: 'COMPLETED',
          productsIdentifiedCount: 1,
          version: '2026.11',
          effectiveDate: '2026-11-01',
        },
        catalogProducts: [
          {
            productName: 'Proximity Sensor M18',
            category: 'Sensors',
            brand: 'Autonics',
            partNumber: 'PR18-8DN',
            mrp: 1550,
            purchaseRate: 1050,
            uom: 'NOS',
            aiConfidence: 98,
            confidenceLevel: 'High',
            reviewStatus: 'Verified',
            approvalStatus: 'APPROVED',
          },
        ],
      },
      'Super Admin',
      'SUPER_ADMIN'
    );

    assert.equal(b2.success, true);
    assert.equal(b2.diff.changedRates.length, 1);
    assert.equal(b2.diff.removedProducts.length, 1);

    const notPresentItem = b2.vendor.catalogProducts.find((p: any) => p.partNumber === '4D-PUG-15x10');
    assert.equal(notPresentItem?.catalogueStatus, 'NOT_PRESENT_IN_LATEST');

    // Archive & Restore Batch 1
    const archRes = db.manageVendorCatalogueBatch(testVendorId, b1.batchId, 'ARCHIVE');
    assert.equal(archRes.success, true);
    const restRes = db.manageVendorCatalogueBatch(testVendorId, b1.batchId, 'RESTORE');
    assert.equal(restRes.success, true);

    // Rollback Batch 2
    const rollRes = db.manageVendorCatalogueBatch(testVendorId, b2.batchId, 'ROLLBACK');
    assert.equal(rollRes.success, true);
    const restoredGasket = rollRes.vendor.catalogProducts.find((p: any) => p.partNumber === '4D-PUG-15x10');
    assert.equal(restoredGasket?.catalogueStatus, 'ACTIVE');
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
