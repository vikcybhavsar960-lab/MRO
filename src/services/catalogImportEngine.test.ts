import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBrandKey,
  generateDuplicateKey,
  calculateRates,
  matchBrandInMaster,
  validateAndMatchRow,
  processImportBatch,
  generateCatalogueTemplateWorkbook,
  generateErrorWorkbook,
  matchProductAiQuery,
  autoDetectColumnMapping,
} from './catalogImportEngine';
import { ProductItem, BrandMasterItem } from '../types';

test('Rate calculations: Discount Amount and Net Purchase Rate', () => {
  // MRP: 1000, Discount: 30% -> Discount Amount: 300, Net Purchase Rate: 700
  const r1 = calculateRates(1000, 30);
  assert.equal(r1.discountAmount, 300);
  assert.equal(r1.netPurchaseRate, 700);

  // MRP: 185, Discount: 38% -> Net Purchase Rate: 114.7
  const r2 = calculateRates(185, 38);
  assert.equal(r2.discountAmount, 70.3);
  assert.equal(r2.netPurchaseRate, 114.7);

  // Direct purchase rate when no MRP
  const r3 = calculateRates(undefined, undefined, 450);
  assert.equal(r3.netPurchaseRate, 450);
});

test('Duplicate key generation and brand normalization', () => {
  const k1 = generateDuplicateKey('Schneider Electric', 'A9F74210', 'SCH-101', 'iC60N');
  const k2 = generateDuplicateKey('Schneider', 'a9f-74210', 'sch101', 'ic60n');
  assert.equal(k1, k2, 'Keys must match despite casing and hyphen differences');

  const k3 = generateDuplicateKey('Siemens', '3RT2015-1BB41');
  assert.notEqual(k1, k3);
});

test('Brand matching with official names and aliases', () => {
  const brands: BrandMasterItem[] = [
    {
      id: 'BRD-001',
      name: 'Schneider Electric',
      code: 'SCH',
      aliases: ['Schneider', 'Telemecanique', 'Merlin Gerin'],
      isActive: true,
      createdAt: '2026-01-01',
    },
    {
      id: 'BRD-002',
      name: 'Siemens',
      code: 'SIEM',
      aliases: ['Siemens AG'],
      isActive: true,
      createdAt: '2026-01-01',
    },
  ];

  // Exact name
  const m1 = matchBrandInMaster('Schneider Electric', undefined, brands);
  assert.equal(m1.isExact, true);
  assert.equal(m1.matchedBrand?.id, 'BRD-001');

  // Alias
  const m2 = matchBrandInMaster('Merlin Gerin', undefined, brands);
  assert.equal(m2.isAlias, true);
  assert.equal(m2.matchedBrand?.id, 'BRD-001');

  // Non-existent brand
  const m3 = matchBrandInMaster('Unknown New Brand', undefined, brands);
  assert.equal(m3.matchedBrand, undefined);
});

test('Process import batch detects duplicates, validates required fields, and flags errors', () => {
  const existingProducts: ProductItem[] = [
    {
      id: 'PRD-EXISTING-01',
      itemName: 'Acti9 MCB 2P 10A C-Curve',
      brand: 'Schneider Electric',
      partNumber: 'A9F74210',
      modelNumber: 'iC60N',
      category: 'Electrical',
      specification: '2 Pole 10A',
      uom: 'NOS',
      description: 'Miniature Circuit Breaker',
      mrp: 450,
      netPurchaseRate: 280,
    },
  ];

  const brands: BrandMasterItem[] = [
    { id: 'BRD-01', name: 'Schneider Electric', isActive: true, createdAt: '2026-01-01' },
    { id: 'BRD-02', name: 'Siemens', isActive: true, createdAt: '2026-01-01' },
  ];

  const rawRows = [
    // Row 1: Existing exact product
    {
      'Brand': 'Schneider Electric',
      'Product Name': 'MCB 2P 10A',
      'Part Code': 'A9F74210',
      'Model Number': 'iC60N',
      'Product Description': 'Miniature Circuit Breaker 2P 10A',
      'Category': 'Electrical',
      'MRP': '485',
      'Discount %': '35',
    },
    // Row 2: New valid product
    {
      'Brand': 'Siemens',
      'Product Name': 'Contactor 9A',
      'Part Code': '3RT2015',
      'Product Description': 'Power Contactor 9A 24VDC',
      'Category': 'Electrical',
      'MRP': '1850',
      'Discount %': '30',
    },
    // Row 3: Missing required part code
    {
      'Brand': 'ABB',
      'Product Name': 'MCB Without Code',
      'Part Code': '',
      'Product Description': 'Invalid item',
      'Category': 'Electrical',
    },
    // Row 4: Duplicate row inside file (same as Row 2)
    {
      'Brand': 'Siemens',
      'Product Name': 'Contactor 9A',
      'Part Code': '3RT2015',
      'Product Description': 'Power Contactor 9A 24VDC',
      'Category': 'Electrical',
    },
  ];

  const mapping = autoDetectColumnMapping(Object.keys(rawRows[0]));
  const { rows, stats } = processImportBatch(rawRows, mapping, existingProducts, brands, []);

  assert.equal(stats.totalRows, 4);
  assert.equal(stats.existingProducts, 1, 'Row 1 should be flagged as existing');
  assert.equal(rows[0].matchStatus, 'EXACT_MATCH');
  assert.equal(rows[0].existingProductId, 'PRD-EXISTING-01');

  assert.equal(rows[1].matchStatus, 'NEW');
  assert.equal(rows[1].action, 'CREATE');

  assert.equal(rows[2].isValid, false, 'Row 3 must fail validation');
  assert.equal(stats.missingPartCode, 1);

  assert.equal(rows[3].matchStatus, 'DUPLICATE_IN_FILE');
  assert.equal(stats.duplicateRows, 1);
});

test('AI Requirement Matching: "Need Schneider 10A 2 Pole MCB - 20 Nos" correctly identifies brand, category, rating, poles, and part code', () => {
  const catalogueProducts: ProductItem[] = [
    {
      id: 'PRD-SCH-01',
      itemName: 'Acti9 iC60N MCB 2P 10A C-Curve',
      brand: 'Schneider Electric',
      partNumber: 'A9F74210',
      modelNumber: 'iC60N',
      category: 'Electrical',
      subCategory: 'MCB',
      specification: '2 Pole, 10 Amp, 240V AC',
      uom: 'NOS',
      description: 'Schneider Miniature Circuit Breaker 10A 2 Pole',
      mrp: 485,
      discountPercentage: 38,
      netPurchaseRate: 300.7,
      lastVendorName: 'Laxmi Electricals & Controls',
    },
    {
      id: 'PRD-BRG-01',
      itemName: 'Deep Groove Ball Bearing 6205',
      brand: 'SKF',
      partNumber: '6205-2RS',
      modelNumber: '6205',
      category: 'Bearings',
      specification: '25mm bore',
      uom: 'NOS',
      description: 'SKF Bearing',
    },
  ];

  const brands: BrandMasterItem[] = [
    { id: 'BRD-01', name: 'Schneider Electric', aliases: ['Schneider'], isActive: true, createdAt: '2026-01-01' },
    { id: 'BRD-02', name: 'SKF', isActive: true, createdAt: '2026-01-01' },
  ];

  const result = matchProductAiQuery(
    'Need Schneider 10A 2 Pole MCB - 20 Nos',
    catalogueProducts,
    brands
  );

  assert.equal(result.matched, true);
  assert.equal(result.brand, 'Schneider Electric');
  assert.equal(result.category, 'Electrical');
  assert.equal(result.subCategory, 'MCB');
  assert.equal(result.partCode, 'A9F74210');
  assert.equal(result.rating, '10A');
  assert.equal(result.poles, '2 Pole');
  assert.equal(result.currentRate, 300.7);
  assert.equal(result.supplier, 'Laxmi Electricals & Controls');
  assert.ok(result.confidence >= 95, `Confidence must be >= 95%, got ${result.confidence}%`);
});

test('Excel template and error workbook generation functions run without errors', () => {
  const templateWb = generateCatalogueTemplateWorkbook();
  assert.ok(templateWb.SheetNames.includes('Catalogue_Import_Template'));
  assert.ok(templateWb.SheetNames.includes('Instructions_and_Rules'));

  const errorWb = generateErrorWorkbook([
    { row: 27, originalValue: '', error: 'Part Code missing', correction: 'Enter valid Part Code' },
  ]);
  assert.ok(errorWb.SheetNames.includes('Import_Errors'));
});
