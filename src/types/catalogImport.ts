import { ProductItem } from './index';

export interface CatalogueImportHistoryRecord {
  id: string; // e.g. IMP-2026-00001
  fileName: string;
  fileSize?: string;
  uploadedBy: string;
  uploadDate: string; // ISO string
  totalRows: number;
  successfulRows: number;
  updatedRows: number;
  newRows: number;
  skippedRows: number;
  errorRows: number;
  duplicateRows: number;
  importStatus: 'COMPLETED' | 'FAILED' | 'PARTIAL';
  errorReport: Array<{
    row: number;
    originalValue: string;
    error: string;
    correction: string;
  }>;
  importSummary: string;
  createdAt: string;
}

export interface ConfirmedAiMappingRecord {
  id: string;
  inputQuery: string;
  confirmedBrand: string;
  confirmedCategory: string;
  confirmedSubCategory?: string;
  confirmedProductId: string;
  confirmedProductName: string;
  confirmedPartNumber: string;
  confirmedRating?: string;
  confirmedPoles?: string;
  confirmedPrice?: number;
  confirmedSupplierName?: string;
  confirmedBy: string;
  confirmedAt: string;
}

export interface SavedColumnMappingTemplate {
  id: string;
  name: string;
  mapping: Record<string, string>; // ERP field key -> Excel column header
  createdAt: string;
}

export type ImportRowAction = 'CREATE' | 'UPDATE' | 'SKIP' | 'REVIEW';

export interface ImportPreviewRow {
  excelRow: number;
  brand: string;
  brandAlias?: string;
  productName: string;
  sourceProductName?: string;
  normalizedProductName?: string;
  productDesignation?: string;
  productFamily?: string;
  partCode: string;
  modelNumber?: string;
  manufacturerCode?: string;
  description: string;
  category: string;
  subCategory?: string;
  specifications?: string;
  catalogueRow?: number;
  originalSourceText?: string;
  mrp?: number;
  discountPercent?: number;
  purchaseRate?: number;
  netPurchaseRate?: number;
  gst?: number;
  uom?: string;
  supplierName?: string;
  supplierPartCode?: string;
  datasheetUrl?: string;
  imageUrl?: string;
  status?: string;

  // Matching & Duplicate Protection
  matchStatus: 'EXACT_MATCH' | 'POSSIBLE_MATCH' | 'NEW' | 'DUPLICATE_IN_FILE' | 'INVALID';
  matchType: 'Exact' | 'New' | 'Duplicate' | 'Brand New' | 'Partial';
  duplicateKey: string;
  existingProductId?: string;
  existingProduct?: ProductItem;
  existingRate?: number;
  existingMrp?: number;
  existingDiscount?: number;
  existingGst?: number;
  existingSupplier?: string;

  // Validation
  errors: string[];
  isValid: boolean;

  // Admin Decision
  action: ImportRowAction;
  brandStatus: 'EXISTING' | 'NEW_DETECTED' | 'MAPPED';
  mappedBrandId?: string;
  newBrandCreated?: boolean;
}

export interface ImportSummaryStats {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  existingProducts: number;
  newProducts: number;
  duplicateRows: number;
  possibleMatches: number;
  missingBrand: number;
  missingProduct: number;
  missingPartCode: number;
  invalidMrp: number;
  invalidRate: number;
  invalidGst: number;
  invalidCategory: number;
}

export interface CatalogueProduct {
  id: string;
  brand: string;
  brandId?: string;
  partCode: string; // Designation e.g. '6006-2RS1'
  manufacturerCode?: string;
  modelNumber?: string;
  productName: string;
  description: string;
  specifications: string;
  category: string;
  subCategory?: string;
  uom: string;
  packCode?: string; // Pack code e.g. '54'
  caseQty?: number; // Case quantity e.g. 22
  hsnCode?: string;
  mrp: number; // Current MRP e.g. 503
  discountPercent: number; // e.g. 20%
  purchaseRate: number; // e.g. 402.40
  gstRate: number; // e.g. 18%
  catalogueVersion: string; // e.g. 'SKF 2026'
  effectiveDate: string; // e.g. '2026-08-01'
  status: 'ACTIVE' | 'HISTORICAL' | 'DISCONTINUED';
  supplierId?: string;
  supplierName?: string;
  importBatchId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RateVersionHistory {
  id: string; // e.g. 'RV-SKF-6006-2RS1-2026'
  productId: string;
  partCode: string;
  brand: string;
  catalogueVersion: string; // e.g. 'SKF 2026'
  effectiveDate: string; // e.g. '2026-08-01'
  validFrom: string; // ISO date
  validTo?: string; // ISO date when superseded
  mrp: number;
  discountPercent: number;
  purchaseRate: number;
  deltaAmount?: number; // e.g. +72.00
  deltaPercent?: number; // e.g. +14.3%
  status: 'CURRENT' | 'HISTORICAL';
  importBatchId?: string;
  createdDate: string;
  createdBy: string;
  remarks?: string;
  effectiveYear?: string;
  oldRate?: number;
  newRate?: number;
  oldMrp?: number;
  newMrp?: number;
  changedBy?: string;
  changedDate?: string;
  reason?: string;
}

export interface CatalogueImportBatch {
  id: string; // e.g. 'BATCH-SKF-2026-08-01-001'
  brandName: string;
  catalogueVersion: string; // e.g. 'SKF 2026'
  effectiveDate: string; // e.g. '2026-08-01'
  fileName: string;
  uploadedBy: string;
  uploadDate: string;
  totalItems: number;
  newItems: number;
  rateChangedItems: number;
  unchangedItems: number;
  discontinuedItems: number;
  status: 'COMMITTED' | 'ROLLED_BACK';
  notes?: string;
  insertedItems?: number;
  updatedItems?: number;
  importedBy?: string;
  importedAt?: string;
}

export interface RateMatchResult {
  matched: boolean;
  matchLevel: 1 | 2 | 3 | 4 | 5 | 6 | 0;
  matchLevelName:
    | 'Exact Part Code (Level 1)'
    | 'Manufacturer Code (Level 2)'
    | 'Brand + Model Number (Level 3)'
    | 'Brand + Product + Specs (Level 4)'
    | 'Product + Specs (Level 5)'
    | 'Description Similarity (Level 6)'
    | 'No Deterministic Match';
  ruleLevel?: string;
  confidence: number; // 0 to 100
  matchedProduct?: CatalogueProduct;
  product?: CatalogueProduct;
  isAmbiguous?: boolean;
  ambiguousCandidates?: CatalogueProduct[];
  calculatedRate?: {
    mrp: number;
    discountPercent: number;
    discountAmount: number;
    purchaseRate: number;
    discountSource: 'Supplier+Product' | 'Product' | 'Brand' | 'CatalogueDefault' | 'Negotiated';
    effectiveDate: string;
    catalogueVersion: string;
  };
  rateSnapshot?: any;
  detectedBrand?: string;
  extractedPartCode?: string;
  extractedQuantity?: number;
  extractedUom?: string;
  rawQuery?: string;
  rateHistory?: RateVersionHistory[];
  matchReason: string;
}

export interface PreImportChangeItem {
  excelRow: number;
  brand: string;
  partCode: string;
  productName: string;
  uom: string;
  packCode?: string;
  caseQty?: number;
  category: string;
  specifications: string;
  description: string;
  newMrp: number;
  newDiscountPercent: number;
  newPurchaseRate: number;
  existingProduct?: CatalogueProduct;
  oldMrp?: number;
  oldPurchaseRate?: number;
  deltaAmount?: number;
  deltaPercent?: number;
  changeType: 'NEW' | 'RATE_CHANGED' | 'UNCHANGED' | 'DISCONTINUED' | 'DUPLICATE' | 'INVALID';
  validationErrors: string[];
}

export interface PreImportChangeReport {
  batchId: string;
  brandName: string;
  catalogueVersion: string;
  effectiveDate: string;
  totalRows: number;
  newCount: number;
  rateChangedCount: number;
  unchangedCount: number;
  discontinuedCount: number;
  duplicateCount: number;
  invalidCount: number;
  items: PreImportChangeItem[];
}

export interface AiCatalogueMatchResult {
  matched: boolean;
  brand?: string;
  category?: string;
  subCategory?: string;
  productName?: string;
  rating?: string;
  poles?: string;
  partCode?: string;
  currentRate?: number;
  mrp?: number;
  discountPercentage?: number;
  supplier?: string;
  confidence: number; // 0 to 100
  matchReason: string;
  productId?: string;
  isLearnedMapping?: boolean;
  alternativeMatches?: Array<{
    productId: string;
    brand: string;
    productName: string;
    partCode: string;
    category: string;
    rate?: number;
    confidence: number;
  }>;
}


