import * as XLSX from 'xlsx';
import { ProductItem, BrandMasterItem, MaterialCategory } from '../types';
import {
  ImportPreviewRow,
  ImportSummaryStats,
  ImportRowAction,
  AiCatalogueMatchResult,
  ConfirmedAiMappingRecord,
  CatalogueProduct,
} from '../types/catalogImport';
import {
  matchCatalogueRateDeterministic,
  normalizePartCode,
  isExactPartCodeMatch,
  extractRequirementTokens,
} from './rateMatchingEngine';
import { fetchApi } from '../utils/apiClient';


/**
 * Normalizes text for robust comparison (lowercased, punctuation-stripped)
 */
export function normalizeText(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Normalizes brand string
 */
export function normalizeBrandKey(name: string | undefined | null, aliases: string[] = []): string {
  const base = normalizeText(name);
  if (!base) return '';
  // Check common brand acronym aliases
  if (base === 'schneiderelectric' || base === 'schneider') return 'schneider';
  if (base === 'siemensag' || base === 'siemens') return 'siemens';
  if (base === 'larsenandtoubro' || base === 'lnt' || base === 'lt') return 'lt';
  if (base === 'abbltd' || base === 'abb') return 'abb';
  return base;
}

/**
 * Generates the authoritative primary duplicate key:
 * Brand ID/Key + Part Code + Manufacturer Code + Model Number
 */
export function generateDuplicateKey(
  brandKey: string,
  partCode: string,
  manufacturerCode?: string,
  modelNumber?: string
): string {
  const b = normalizeBrandKey(brandKey);
  const p = normalizeText(partCode);
  const m = normalizeText(manufacturerCode);
  const mod = normalizeText(modelNumber);
  return `${b}::${p}::${m}::${mod}`;
}

/**
 * Calculates commercial rates according to MRO ERP business formulas:
 * Discount Amount = MRP * Discount % / 100
 * Net Purchase Rate = MRP - Discount Amount
 */
export function calculateRates(
  mrp?: number,
  discountPercent?: number,
  directPurchaseRate?: number
): { discountAmount: number; netPurchaseRate: number } {
  const safeMrp = mrp && !isNaN(mrp) && mrp > 0 ? Number(mrp) : 0;
  const safeDiscount =
    discountPercent && !isNaN(discountPercent) && discountPercent >= 0 && discountPercent <= 100
      ? Number(discountPercent)
      : 0;

  if (safeMrp > 0 && safeDiscount > 0) {
    const discountAmount = Math.round((safeMrp * safeDiscount) / 100 * 100) / 100;
    const netPurchaseRate = Math.round((safeMrp - discountAmount) * 100) / 100;
    return { discountAmount, netPurchaseRate };
  }

  if (safeMrp > 0 && (!directPurchaseRate || directPurchaseRate === 0)) {
    return { discountAmount: 0, netPurchaseRate: safeMrp };
  }

  const net =
    directPurchaseRate && !isNaN(directPurchaseRate) && directPurchaseRate > 0
      ? Number(directPurchaseRate)
      : safeMrp;

  return { discountAmount: 0, netPurchaseRate: net };
}

/**
 * Matches an imported brand name against Brand Master with alias support
 */
export function matchBrandInMaster(
  brandName: string,
  brandAlias: string | undefined,
  brands: BrandMasterItem[]
): {
  matchedBrand?: BrandMasterItem;
  isExact: boolean;
  isAlias: boolean;
} {
  if (!brandName || !brands || brands.length === 0) {
    return { isExact: false, isAlias: false };
  }

  const cleanInput = brandName.trim();
  const normInput = normalizeBrandKey(cleanInput);
  const normAlias = brandAlias ? normalizeBrandKey(brandAlias) : '';

  // 1. Exact match on official name
  const exact = brands.find((b) => b.name && b.name.trim().toLowerCase() === cleanInput.toLowerCase());
  if (exact) {
    return { matchedBrand: exact, isExact: true, isAlias: false };
  }

  // 2. Exact match on brand code
  const codeMatch = brands.find((b) => b.code && b.code.trim().toLowerCase() === cleanInput.toLowerCase());
  if (codeMatch) {
    return { matchedBrand: codeMatch, isExact: true, isAlias: false };
  }

  // 3. Normalized name match
  const normMatch = brands.find((b) => normalizeBrandKey(b.name) === normInput);
  if (normMatch) {
    return { matchedBrand: normMatch, isExact: true, isAlias: false };
  }

  // 4. Aliases match
  for (const b of brands) {
    if (Array.isArray(b.aliases)) {
      for (const al of b.aliases) {
        if (
          al.toLowerCase().trim() === cleanInput.toLowerCase() ||
          normalizeBrandKey(al) === normInput ||
          (normAlias && normalizeBrandKey(al) === normAlias)
        ) {
          return { matchedBrand: b, isExact: false, isAlias: true };
        }
      }
    }
  }

  return { isExact: false, isAlias: false };
}

/**
 * Standard default column mappings for flexible Excel import
 */
export const DEFAULT_COLUMN_SYNONYMS: Record<string, string[]> = {
  brand: ['brand', 'brand name', 'make', 'manufacturer', 'mfr', 'oem', 'brand_name'],
  brandAlias: ['brand alias', 'alias', 'brand_alias', 'brand alternate'],
  productName: ['product name', 'item name', 'material name', 'product', 'item', 'product_name', 'material'],
  partCode: ['designation', 'part code', 'part number', 'part no', 'part no.', 'cat no', 'catalogue no', 'catalogue code', 'part_number', 'part_code', 'item code'],
  packCode: ['pack code', 'pack', 'pkg code', 'package code', 'packing code'],
  caseQty: ['case qty', 'case quantity', 'case', 'box qty', 'pkg qty', 'packing qty', 'standard pack'],
  modelNumber: ['model', 'model number', 'model no', 'model no.', 'model_number', 'type'],
  manufacturerCode: ['manufacturer code', 'mfg code', 'mfg part no', 'oem code', 'mfg_code'],
  description: ['product description', 'description', 'desc', 'item description', 'details', 'item_description'],
  category: ['category', 'material category', 'primary category', 'cat'],
  subCategory: ['sub category', 'sub-category', 'sub category name', 'subcategory'],
  specifications: ['technical specifications', 'specifications', 'specs', 'technical specs', 'parameters', 'dimensions'],
  mrp: ['mrp', 'maximum retail price', 'list price', 'm.r.p.', 'mrp inr', 'mrp (inr)', 'unit mrp'],
  discountPercent: ['discount %', 'discount percentage', 'discount', 'disc %', 'discount_percent', 'disc', 'std discount'],
  purchaseRate: ['purchase rate', 'net rate', 'rate', 'price', 'purchase price', 'unit price', 'rate inr', 'net purchase rate'],
  effectiveDate: ['effective date', 'price list date', 'date', 'valid from', 'effective from', 'catalogue date'],
  catalogueVersion: ['catalogue version', 'version', 'edition', 'year', 'catalog year', 'catalogue year'],
  gst: ['gst %', 'gst', 'tax %', 'gst rate', 'tax rate'],
  uom: ['uom', 'unit', 'unit of measure', 'unit of measurement'],
  supplierName: ['supplier name', 'supplier', 'vendor', 'vendor name'],
  supplierPartCode: ['supplier part code', 'supplier part no', 'vendor code', 'vendor part number'],
  datasheetUrl: ['datasheet url', 'datasheet', 'catalog url', 'specs url'],
  imageUrl: ['image url', 'product image', 'image', 'photo url'],
  status: ['status', 'product status', 'active'],
};


/**
 * Auto-detects Excel column mapping based on synonyms
 */
export function autoDetectColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const cleanedHeaders = headers.map((h) => ({ original: h, clean: h.toLowerCase().trim() }));

  for (const [erpField, synonyms] of Object.entries(DEFAULT_COLUMN_SYNONYMS)) {
    for (const h of cleanedHeaders) {
      if (synonyms.includes(h.clean)) {
        mapping[erpField] = h.original;
        break;
      }
    }
  }

  return mapping;
}

/**
 * Validates a single import row and matches against existing catalogue
 */
export function validateAndMatchRow(
  rawRow: Record<string, any>,
  rowNum: number,
  fieldMapping: Record<string, string>,
  existingProducts: ProductItem[],
  existingBrands: BrandMasterItem[],
  categories: MaterialCategory[]
): ImportPreviewRow {
  const getVal = (field: string): string => {
    const header = fieldMapping[field];
    if (!header || rawRow[header] === undefined || rawRow[header] === null) return '';
    return String(rawRow[header]).trim();
  };

  const getNum = (field: string): number | undefined => {
    const raw = getVal(field);
    if (!raw) return undefined;
    // Strip currency symbols, commas, percent signs
    const cleaned = raw.replace(/[₹$,% ]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  };

  const brand = getVal('brand');
  const brandAlias = getVal('brandAlias');
  const productName = getVal('productName');
  const partCode = getVal('partCode');
  const modelNumber = getVal('modelNumber');
  const manufacturerCode = getVal('manufacturerCode');
  const description = getVal('description') || productName;
  const category = getVal('category');
  const subCategory = getVal('subCategory');
  const specifications = getVal('specifications');
  const mrp = getNum('mrp');
  const discountPercent = getNum('discountPercent');
  const purchaseRate = getNum('purchaseRate');
  const gst = getNum('gst');
  const uom = getVal('uom') || 'NOS';
  const supplierName = getVal('supplierName');
  const supplierPartCode = getVal('supplierPartCode');
  const datasheetUrl = getVal('datasheetUrl');
  const imageUrl = getVal('imageUrl');
  const status = getVal('status') || 'ACTIVE';

  const errors: string[] = [];

  // Required Field Checks
  if (!brand) errors.push('Brand Name is required');
  if (!productName) errors.push('Product Name is required');
  if (!partCode) errors.push('Part Code / Part Number is required');
  if (!description) errors.push('Product Description is required');
  if (!category) errors.push('Category is required');

  // Numerical Validation
  if (mrp !== undefined && mrp < 0) errors.push('MRP cannot be negative');
  if (discountPercent !== undefined && (discountPercent < 0 || discountPercent > 100)) {
    errors.push('Discount % must be between 0 and 100');
  }
  if (purchaseRate !== undefined && purchaseRate < 0) errors.push('Purchase Rate cannot be negative');
  if (gst !== undefined && (gst < 0 || gst > 40)) errors.push('GST % must be between 0% and 40%');

  // Calculate Net Rates
  const { netPurchaseRate } = calculateRates(mrp, discountPercent, purchaseRate);

  // Match Brand
  const brandMatch = matchBrandInMaster(brand, brandAlias, existingBrands);
  const brandStatus: ImportPreviewRow['brandStatus'] = brandMatch.matchedBrand
    ? 'EXISTING'
    : 'NEW_DETECTED';

  // Primary Duplicate Key: Brand ID/Key + Part Code + Manufacturer Code + Model Number
  const duplicateKey = generateDuplicateKey(
    brandMatch.matchedBrand?.name || brand,
    partCode,
    manufacturerCode,
    modelNumber
  );

  // Match Against Existing Products
  const normBrand = normalizeBrandKey(brand);
  const normPart = normalizeText(partCode);
  const normName = normalizeText(productName);

  let matchStatus: ImportPreviewRow['matchStatus'] = 'NEW';
  let matchType: ImportPreviewRow['matchType'] = 'New';
  let existingProduct: ProductItem | undefined;
  let action: ImportRowAction = 'CREATE';

  // Search by exact duplicate key first
  const exactMatch = existingProducts.find((p) => {
    if (p.isDeleted) return false;
    const pKey = generateDuplicateKey(p.brand, p.partNumber, p.manufacturerCode, p.modelNumber);
    if (pKey === duplicateKey) return true;

    // Direct Part Number + Brand match
    const pPart = normalizeText(p.partNumber);
    const pBrand = normalizeBrandKey(p.brand);
    if (pPart && normPart && pPart === normPart && pBrand === normBrand) return true;

    return false;
  });

  if (exactMatch) {
    matchStatus = 'EXACT_MATCH';
    matchType = 'Exact';
    existingProduct = exactMatch;
    action = 'UPDATE';
  } else {
    // Check possible matches by Product Name + Brand
    const nameMatch = existingProducts.find((p) => {
      if (p.isDeleted) return false;
      const pName = normalizeText(p.itemName);
      const pBrand = normalizeBrandKey(p.brand);
      return pName && normName && pName === normName && pBrand === normBrand;
    });

    if (nameMatch) {
      matchStatus = 'POSSIBLE_MATCH';
      matchType = 'Partial';
      existingProduct = nameMatch;
      action = 'REVIEW';
    } else if (brandStatus === 'NEW_DETECTED') {
      matchType = 'Brand New';
    }
  }

  if (errors.length > 0) {
    matchStatus = 'INVALID';
    action = 'SKIP';
  }

  return {
    excelRow: rowNum,
    brand: brandMatch.matchedBrand?.name || brand,
    brandAlias,
    productName,
    partCode,
    modelNumber,
    manufacturerCode,
    description,
    category,
    subCategory,
    specifications,
    mrp,
    discountPercent,
    purchaseRate: purchaseRate || netPurchaseRate,
    netPurchaseRate,
    gst: gst !== undefined ? gst : 18,
    uom,
    supplierName,
    supplierPartCode,
    datasheetUrl,
    imageUrl,
    status,
    matchStatus,
    matchType,
    duplicateKey,
    existingProductId: existingProduct?.id,
    existingProduct,
    existingRate: existingProduct?.netPurchaseRate || existingProduct?.purchasePrice || existingProduct?.approxRate,
    existingMrp: existingProduct?.mrp,
    existingDiscount: existingProduct?.discountPercentage,
    existingGst: existingProduct?.gstRate,
    existingSupplier: existingProduct?.lastVendorName,
    errors,
    isValid: errors.length === 0,
    action,
    brandStatus,
    mappedBrandId: brandMatch.matchedBrand?.id,
  };
}

/**
 * Processes full batch of raw Excel rows, validates, and detects within-file duplicates
 */
export function processImportBatch(
  rawRows: Record<string, any>[],
  fieldMapping: Record<string, string>,
  existingProducts: ProductItem[],
  existingBrands: BrandMasterItem[],
  categories: MaterialCategory[]
): {
  rows: ImportPreviewRow[];
  stats: ImportSummaryStats;
} {
  const rows: ImportPreviewRow[] = [];
  const seenDuplicateKeys = new Map<string, number>(); // key -> first rowNum

  const stats: ImportSummaryStats = {
    totalRows: rawRows.length,
    validRows: 0,
    invalidRows: 0,
    existingProducts: 0,
    newProducts: 0,
    duplicateRows: 0,
    possibleMatches: 0,
    missingBrand: 0,
    missingProduct: 0,
    missingPartCode: 0,
    invalidMrp: 0,
    invalidRate: 0,
    invalidGst: 0,
    invalidCategory: 0,
  };

  rawRows.forEach((raw, idx) => {
    const rowNum = idx + 2; // Row 1 is header
    const previewRow = validateAndMatchRow(
      raw,
      rowNum,
      fieldMapping,
      existingProducts,
      existingBrands,
      categories
    );

    // Specific error counter metrics
    previewRow.errors.forEach((err) => {
      if (err.includes('Brand Name is required')) stats.missingBrand++;
      if (err.includes('Product Name is required')) stats.missingProduct++;
      if (err.includes('Part Code / Part Number is required')) stats.missingPartCode++;
      if (err.includes('Category is required')) stats.invalidCategory++;
      if (err.includes('MRP')) stats.invalidMrp++;
      if (err.includes('Purchase Rate')) stats.invalidRate++;
      if (err.includes('GST')) stats.invalidGst++;
    });

    // Check for duplicate rows inside the uploaded Excel itself
    if (previewRow.isValid) {
      if (seenDuplicateKeys.has(previewRow.duplicateKey)) {
        const firstRow = seenDuplicateKeys.get(previewRow.duplicateKey)!;
        previewRow.matchStatus = 'DUPLICATE_IN_FILE';
        previewRow.matchType = 'Duplicate';
        previewRow.action = 'SKIP';
        previewRow.errors.push(`Duplicate row inside Excel (Identical to Row ${firstRow})`);
        previewRow.isValid = false;
        stats.duplicateRows++;
      } else {
        seenDuplicateKeys.set(previewRow.duplicateKey, rowNum);
      }
    }

    if (previewRow.isValid) {
      stats.validRows++;
      if (previewRow.matchStatus === 'EXACT_MATCH') {
        stats.existingProducts++;
      } else if (previewRow.matchStatus === 'POSSIBLE_MATCH') {
        stats.possibleMatches++;
      } else {
        stats.newProducts++;
      }
    } else {
      stats.invalidRows++;
    }

    rows.push(previewRow);
  });

  return { rows, stats };
}

/**
 * Generates an Excel workbook for download containing all errors
 */
export function generateErrorWorkbook(
  errors: Array<{ row: number; originalValue: string; error: string; correction: string }>
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const wsData = [
    ['Excel Row Number', 'Original Value', 'Error Description', 'Required Correction'],
    ...errors.map((e) => [e.row, e.originalValue, e.error, e.correction]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  // Column widths
  ws['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 45 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Import_Errors');
  return wb;
}

/**
 * Generates the official MRO Brand Catalogue Excel template
 */
export function generateCatalogueTemplateWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const headers = [
    'Brand Name',
    'Brand Alias',
    'Product Name',
    'Part Code / Part Number',
    'Model Number',
    'Manufacturer Code',
    'Product Description',
    'Category',
    'Sub Category',
    'Technical Specifications',
    'MRP',
    'Discount %',
    'Purchase Rate',
    'GST %',
    'UOM',
    'Supplier Name',
    'Supplier Part Code',
    'Datasheet URL',
    'Image URL',
    'Status',
  ];

  const sampleRows = [
    [
      'Schneider Electric',
      'Schneider',
      'Acti9 iC60N MCB 2P 10A C-Curve',
      'A9F74210',
      'iC60N',
      'A9F74210-SCH',
      'Miniature Circuit Breaker 2 Pole 10A 10kA C curve',
      'Electrical',
      'MCB',
      '2 Pole, 10 Amp, 240/415V AC, 10kA Breaking Capacity',
      '485',
      '38',
      '300.70',
      '18',
      'NOS',
      'Laxmi Electricals & Controls',
      'LEC-A9F74210',
      'https://www.se.com/in/en/product/A9F74210',
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400',
      'ACTIVE',
    ],
    [
      'Siemens',
      'Siemens AG',
      'SIRIUS Power Contactor 9A 3P 24VDC',
      '3RT2015-1BB41',
      '3RT2015',
      'SIEM-3RT2015',
      '3-pole contactor 4kW/400V 1NO 24V DC screw terminal',
      'Electrical',
      'Contactors',
      '3 Pole, 9A AC-3, 4kW, 24V DC Coil Voltage',
      '1850',
      '32',
      '1258.00',
      '18',
      'NOS',
      'Apex Industrial Automations',
      'AIA-3RT2015',
      'https://mall.industry.siemens.com/mall/en/in/Catalog/Product/3RT2015-1BB41',
      '',
      'ACTIVE',
    ],
    [
      'SKF',
      'SKF India',
      'Deep Groove Ball Bearing 6205-2RS',
      '6205-2RS1/C3',
      '6205-2RS',
      'SKF-62052RS',
      'Single row deep groove ball bearing with rubber seals on both sides',
      'Bearings',
      'Deep Groove Ball Bearings',
      'Bore: 25mm, Outer Diameter: 52mm, Width: 15mm, C3 Clearance',
      '410',
      '42',
      '237.80',
      '18',
      'NOS',
      'National Bearing Corporation',
      'NBC-6205-2RS',
      'https://www.skf.com/group/products/rolling-bearings/ball-bearings/deep-groove-ball-bearings/productid-6205-2RS1',
      '',
      'ACTIVE',
    ],
    [
      'Festo',
      'Festo Pneumatic',
      'Single Solenoid Directional Valve 5/2 Way',
      'VUVS-L20-M52-MD-G18-F7-1C1',
      'VUVS-L20',
      'FESTO-575263',
      'Pneumatic 5/2-way valve, monostable, internal pilot air',
      'Pneumatics',
      'Pneumatic Directional Solenoid Valves',
      'Port Size: G1/8, Flow Rate: 700 l/min, Operating Pressure: 2.5..10 bar',
      '3400',
      '28',
      '2448.00',
      '18',
      'NOS',
      'Fluicon Pneumatics Pvt Ltd',
      'FLU-VUVS-L20',
      '',
      '',
      'ACTIVE',
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  ws['!cols'] = [
    { wch: 20 }, // Brand Name
    { wch: 15 }, // Brand Alias
    { wch: 32 }, // Product Name
    { wch: 22 }, // Part Code
    { wch: 16 }, // Model Number
    { wch: 18 }, // Mfr Code
    { wch: 45 }, // Description
    { wch: 18 }, // Category
    { wch: 22 }, // Sub Category
    { wch: 45 }, // Technical Specs
    { wch: 12 }, // MRP
    { wch: 14 }, // Discount %
    { wch: 16 }, // Purchase Rate
    { wch: 10 }, // GST %
    { wch: 10 }, // UOM
    { wch: 26 }, // Supplier Name
    { wch: 20 }, // Supplier Part Code
    { wch: 30 }, // Datasheet URL
    { wch: 30 }, // Image URL
    { wch: 12 }, // Status
  ];

  // Instructions Sheet
  const instructions = [
    ['MRO PROCUREMENT SOLUTION — BRAND CATALOGUE IMPORT GUIDE'],
    [''],
    ['RULE 1: REQUIRED COLUMNS'],
    ['The following 5 columns are strictly required for every product row:'],
    ['  - Brand Name (e.g. Schneider Electric, Siemens, SKF, ABB, Festo)'],
    ['  - Product Name (e.g. Acti9 MCB 2P 10A C-Curve)'],
    ['  - Part Code / Part Number (e.g. A9F74210, 3RT2015-1BB41, 6205-2RS)'],
    ['  - Product Description (Summary of product specs and industrial usage)'],
    ['  - Category (e.g. Electrical, Bearings, Pneumatics, Valves, Fasteners)'],
    [''],
    ['RULE 2: DUPLICATE PROTECTION'],
    ['The system checks Brand ID + Part Code + Manufacturer Code + Model Number.'],
    ['If a product already exists, it is flagged as "Existing Product Found" and NOT duplicated.'],
    [''],
    ['RULE 3: COMMERCIAL RATE FORMULA'],
    ['Discount Amount = MRP × Discount % / 100'],
    ['Net Purchase Rate = MRP − Discount Amount'],
    ['If both MRP and Discount % are provided, Net Purchase Rate is calculated automatically.'],
    [''],
    ['RULE 4: BRAND AUTO-CREATION'],
    ['If a brand does not exist in Brand Master, the Import Wizard will detect it as "New Brand Detected"'],
    ['and allow you to either create it with 1 click or map it to an existing authorized brand.'],
    [''],
    ['RULE 5: IMMEDIATE AI PRODUCT IDENTIFICATION'],
    ['Once imported, all products become immediately searchable by the AI Requirement Matching Engine.'],
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(instructions);
  wsGuide['!cols'] = [{ wch: 80 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Catalogue_Import_Template');
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Instructions_and_Rules');

  return wb;
}

/**
 * Smart AI Requirement Matching Engine:
 * Searches imported brand catalogue first to extract Brand, Category, Product, Rating, Poles, Part Code, Current Rate, Supplier with 95%+ confidence.
 */
export function matchProductAiQuery(
  rawInput: string,
  products: ProductItem[],
  brands: BrandMasterItem[],
  confirmedMappings: ConfirmedAiMappingRecord[] = []
): AiCatalogueMatchResult {
  const clean = (rawInput || '').trim();
  if (!clean) {
    return {
      matched: false,
      confidence: 0,
      matchReason: 'Input is empty',
    };
  }

  const lower = clean.toLowerCase();
  const activeProducts = (products || []).filter((p) => !p.isDeleted);

  // 1. Check Historical Approved / Confirmed Mappings First (Future Learning)
  if (Array.isArray(confirmedMappings) && confirmedMappings.length > 0) {
    for (const mapping of confirmedMappings) {
      if (
        lower.includes(mapping.inputQuery.toLowerCase().trim()) ||
        mapping.inputQuery.toLowerCase().trim().includes(lower)
      ) {
        const matchingProd = activeProducts.find((p) => p.id === mapping.confirmedProductId);
        return {
          matched: true,
          brand: mapping.confirmedBrand,
          category: mapping.confirmedCategory,
          subCategory: mapping.confirmedSubCategory,
          productName: mapping.confirmedProductName,
          partCode: mapping.confirmedPartNumber,
          rating: mapping.confirmedRating,
          poles: mapping.confirmedPoles,
          currentRate: mapping.confirmedPrice || matchingProd?.netPurchaseRate || matchingProd?.approxRate,
          mrp: matchingProd?.mrp,
          discountPercentage: matchingProd?.discountPercentage,
          supplier: mapping.confirmedSupplierName || matchingProd?.lastVendorName,
          confidence: 99,
          matchReason: 'Matched from Approved Historical Requirement Learning rule',
          productId: mapping.confirmedProductId,
          isLearnedMapping: true,
        };
      }
    }
  }

  // 2. Identify Brand
  let detectedBrand: BrandMasterItem | undefined;
  let detectedBrandName = '';

  for (const b of brands) {
    if (!b || !b.name) continue;
    const bName = b.name.toLowerCase();
    const bCode = (b.code || '').toLowerCase();
    if (bName && lower.includes(bName)) {
      detectedBrand = b;
      detectedBrandName = b.name;
      break;
    }
    if (bCode && bCode.length > 2 && new RegExp(`\\b${bCode}\\b`, 'i').test(lower)) {
      detectedBrand = b;
      detectedBrandName = b.name;
      break;
    }
    if (Array.isArray(b.aliases)) {
      for (const al of b.aliases) {
        if (al && al.length > 2 && new RegExp(`\\b${al.toLowerCase()}\\b`, 'i').test(lower)) {
          detectedBrand = b;
          detectedBrandName = b.name;
          break;
        }
      }
    }
  }

  // Fallback brand recognition from products
  if (!detectedBrand) {
    const knownBrands = Array.from(new Set(activeProducts.map((p) => p.brand).filter(Boolean)));
    for (const kb of knownBrands) {
      if (kb && kb.length > 2 && new RegExp(`\\b${kb.toLowerCase()}\\b`, 'i').test(lower)) {
        detectedBrandName = kb;
        break;
      }
    }
  }

  // 3. Extract Rating & Poles
  let detectedRating: string | undefined;
  const ratingMatch = clean.match(/\b(\d+)\s*(a|amp|amps|kva|hp|kw|rpm)\b/i);
  if (ratingMatch) {
    detectedRating = `${ratingMatch[1]}${ratingMatch[2].toUpperCase()}`;
  }

  let detectedPoles: string | undefined;
  const poleMatch = clean.match(/\b([1-4])\s*(pole|p)\b/i) || clean.match(/\b(sp|dp|tp|fp)\b/i);
  if (poleMatch) {
    const pStr = poleMatch[0].toUpperCase();
    if (pStr.includes('2') || pStr === 'DP') detectedPoles = '2 Pole';
    else if (pStr.includes('3') || pStr === 'TP') detectedPoles = '3 Pole';
    else if (pStr.includes('4') || pStr === 'FP') detectedPoles = '4 Pole';
    else if (pStr.includes('1') || pStr === 'SP') detectedPoles = '1 Pole';
    else detectedPoles = pStr;
  }

  // 4. Deterministic 6-Level Search in Brand Catalogue Products
  let candidates = activeProducts;

  if (detectedBrandName) {
    const brandFiltered = candidates.filter(
      (p) => normalizeBrandKey(p.brand) === normalizeBrandKey(detectedBrandName)
    );
    if (brandFiltered.length > 0) candidates = brandFiltered;
  }

  // Convert active products to CatalogueProduct format for deterministic matcher
  const adaptedCatalogueProducts: CatalogueProduct[] = candidates.map((p) => ({
    id: p.id,
    brand: p.brand || detectedBrandName || 'GENERIC',
    partCode: p.partNumber || p.itemCode || '',
    manufacturerCode: p.manufacturerCode || '',
    modelNumber: p.modelNumber || '',
    productName: p.itemName || p.normalizedProductName || p.sourceProductName || '',
    sourceProductName: p.sourceProductName,
    normalizedProductName: p.normalizedProductName,
    productDesignation: p.productDesignation,
    productFamily: p.productFamily,
    description: p.description || '',
    specifications: p.specification || '',
    category: p.category || 'Industrial Supplies',
    subCategory: p.subCategory,
    uom: p.uom || 'NOS',
    mrp: p.mrp || 0,
    discountPercent: p.discountPercentage || 20,
    purchaseRate: p.netPurchaseRate || p.approxRate || 0,
    gstRate: p.gstRate || 18,
    catalogueVersion: (p as any).catalogueVersion || 'Current',
    effectiveDate: (p as any).effectiveDate || '2026-08-01',
    status: 'ACTIVE',
    supplierName: p.lastVendorName,
    createdAt: p.createdAt || new Date().toISOString(),
    updatedAt: p.updatedAt || new Date().toISOString(),
  } as CatalogueProduct));

  const detResult = matchCatalogueRateDeterministic(clean, adaptedCatalogueProducts, {
    brand: detectedBrandName,
  });

  if (detResult.matched && detResult.matchedProduct) {
    const matched = detResult.matchedProduct;
    const calcRate = detResult.calculatedRate;
    const currentRate = calcRate?.purchaseRate || matched.purchaseRate || matched.mrp;

    let effectiveConfidence = detResult.confidence;
    if (effectiveConfidence < 95) {
      const candidateText = `${matched.productName || ''} ${matched.subCategory || ''} ${matched.specifications || ''} ${matched.description || ''}`.toLowerCase();
      const brandMatches = Boolean(
        detectedBrandName && normalizeBrandKey(matched.brand) === normalizeBrandKey(detectedBrandName)
      );
      const ratingMatches = Boolean(
        detectedRating &&
          (candidateText.includes(detectedRating.toLowerCase()) ||
            new RegExp(`\\b${detectedRating.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/A$/i, '\\s*(?:a|amp|amps)')}\\b`, 'i').test(candidateText))
      );
      const poleNum = detectedPoles?.match(/^([1-4])/)?.[1];
      const polesMatches = Boolean(
        poleNum &&
          (candidateText.includes(`${poleNum}p`) ||
            candidateText.includes(`${poleNum} pole`))
      );
      const subCatMatches = Boolean(
        matched.subCategory && lower.includes(matched.subCategory.toLowerCase())
      );

      if (brandMatches && ratingMatches && polesMatches && subCatMatches) {
        effectiveConfidence = 96;
      } else if (brandMatches && ratingMatches && (polesMatches || subCatMatches)) {
        effectiveConfidence = 95;
      }
    }

    const altCandidates = (detResult.ambiguousCandidates || [])
      .filter((c) => c.partCode !== matched.partCode)
      .slice(0, 4)
      .map((c) => ({
        productId: c.id,
        brand: c.brand,
        productName: c.productName,
        partCode: c.partCode,
        category: c.category,
        rate: c.purchaseRate,
        confidence: 90,
      }));

    return {
      matched: true,
      brand: matched.brand || detectedBrandName,
      category: matched.category,
      subCategory: matched.subCategory,
      productName: matched.productName,
      rating: detectedRating,
      poles: detectedPoles,
      partCode: matched.partCode,
      currentRate,
      mrp: matched.mrp,
      discountPercentage: calcRate?.discountPercent || matched.discountPercent,
      supplier: matched.supplierName,
      confidence: effectiveConfidence,
      matchReason: detResult.matchReason,
      productId: matched.id,
      alternativeMatches: altCandidates,
    };
  }


  // Fallback category identification if no specific catalogue part matched
  let category = 'Electrical';
  let subCategory = 'MCB';

  if (/\b(mcb|circuit breaker)\b/i.test(lower)) {
    category = 'Electrical';
    subCategory = 'MCB';
  } else if (/\b(bearing|6205|ball bearing)\b/i.test(lower)) {
    category = 'Bearings';
    subCategory = 'Deep Groove Ball Bearings';
  } else if (/\b(contactor|relay)\b/i.test(lower)) {
    category = 'Electrical';
    subCategory = 'Contactors';
  } else if (/\b(valve|solenoid)\b/i.test(lower)) {
    category = 'Pneumatics';
    subCategory = 'Pneumatic Directional Solenoid Valves';
  }

  return {
    matched: false,
    brand: detectedBrandName || undefined,
    category,
    subCategory,
    rating: detectedRating,
    poles: detectedPoles,
    confidence: detectedBrandName ? 70 : 40,
    matchReason: detectedBrandName
      ? `Brand recognized as ${detectedBrandName}, but specific part number not found in Brand Catalogue`
      : 'Manual Review Required: Specific part number not found in Brand Catalogue',
  };
}

/**
 * Uploads and extracts structured product rows from PDF, JPG, PNG, WEBP files
 * via backend OCR & AI parsing endpoint
 */
export async function parseDocumentCatalogue(file: File): Promise<{
  headers: string[];
  rows: Record<string, any>[];
  sourceType: 'PDF' | 'IMAGE';
  parserMethod: string;
}> {
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(new Error('Failed to read file for parsing: ' + err));
    reader.readAsDataURL(file);
  });

  const response = await fetchApi('/api/catalog/parse-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
      base64Data,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to extract catalogue document (HTTP ${response.status})`);
  }

  const data = await response.json();
  return {
    headers: data.headers || [],
    rows: data.rows || [],
    sourceType: data.sourceType || 'PDF',
    parserMethod: data.parserMethod || 'DOCUMENT_PARSER',
  };
}

