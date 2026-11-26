import { ProductItem, BrandMasterItem, BulkBrandDiscountRule, ProductRateHistoryEntry } from '../types';

export type DiscountSource =
  | 'SUPPLIER_PRODUCT'
  | 'PRODUCT_LEVEL'
  | 'BRAND_LEVEL'
  | 'DEFAULT'
  | 'MANUAL_NEGOTIATED';

export interface ResolvedDiscount {
  discountType: 'PERCENTAGE' | 'FIXED' | 'DIRECT' | 'DIRECT_NEGOTIATED';
  discountValue: number; // percentage (0-100) or fixed amount
  source: DiscountSource;
  sourceLabel: string;
  appliedPercentage: number;
  fixedDiscountAmount?: number;
}

export interface RateCalculationResult {
  mrp: number;
  discountType: 'PERCENTAGE' | 'FIXED' | 'DIRECT' | 'DIRECT_NEGOTIATED';
  discountValue: number;
  discountAmount: number;
  netPurchaseRate: number;
  gstRate: number;
  gstAmount: number;
  totalWithGst: number;
  discountSource: DiscountSource;
  discountSourceLabel: string;
}

/**
 * Resolves the applicable commercial discount according to strict 4-level MRO hierarchy:
 * 1. Supplier + Product Discount (Highest Priority)
 * 2. Product-Level Discount
 * 3. Brand-Level Discount
 * 4. Default Discount
 */
export function resolveApplicableDiscount(params: {
  product?: Partial<ProductItem>;
  brandName?: string;
  supplierId?: string;
  supplierName?: string;
  brandRules?: BulkBrandDiscountRule[];
  brands?: BrandMasterItem[];
  manualOverrideDiscount?: number;
}): ResolvedDiscount {
  const { product, brandName, supplierId, supplierName, brandRules = [], brands = [], manualOverrideDiscount } = params;

  // Manual Negotiated Discount override
  if (manualOverrideDiscount !== undefined && !isNaN(manualOverrideDiscount) && manualOverrideDiscount >= 0) {
    return {
      discountType: 'PERCENTAGE',
      discountValue: manualOverrideDiscount,
      source: 'MANUAL_NEGOTIATED',
      sourceLabel: `Manual Negotiated Discount (${manualOverrideDiscount}%)`,
      appliedPercentage: manualOverrideDiscount,
    };
  }

  const effectiveBrand = (brandName || product?.brand || '').trim();
  const effectiveSupplier = (supplierName || '').trim();

  // LEVEL 1: Supplier + Product specific discount
  if (effectiveSupplier && product?.rateHistory && Array.isArray(product.rateHistory)) {
    const supplierHistory = product.rateHistory.find(
      (rh) =>
        (supplierId && rh.vendorId === supplierId) ||
        (rh.vendorName && rh.vendorName.toLowerCase().trim() === effectiveSupplier.toLowerCase())
    );
    if (supplierHistory && supplierHistory.discountValue !== undefined && supplierHistory.discountValue > 0) {
      return {
        discountType: supplierHistory.discountType || 'PERCENTAGE',
        discountValue: supplierHistory.discountValue,
        source: 'SUPPLIER_PRODUCT',
        sourceLabel: `Supplier-Specific Discount (${supplierHistory.discountValue}% via ${supplierHistory.vendorName})`,
        appliedPercentage: supplierHistory.discountValue,
      };
    }
  }

  // Also check brandRules for Supplier + Brand or Supplier + Product rule
  if (effectiveSupplier && brandRules.length > 0) {
    const supplierBrandRule = brandRules.find(
      (r) =>
        r.brandName?.toLowerCase().trim() === effectiveBrand.toLowerCase() &&
        ((supplierId && r.supplierId === supplierId) ||
          (r.supplierName && r.supplierName.toLowerCase().trim() === effectiveSupplier.toLowerCase()))
    );
    if (supplierBrandRule && supplierBrandRule.defaultDiscountPercentage > 0) {
      return {
        discountType: supplierBrandRule.discountType || 'PERCENTAGE',
        discountValue: supplierBrandRule.defaultDiscountPercentage,
        source: 'SUPPLIER_PRODUCT',
        sourceLabel: `Supplier + Brand Contract Discount (${supplierBrandRule.defaultDiscountPercentage}% via ${supplierBrandRule.supplierName})`,
        appliedPercentage: supplierBrandRule.defaultDiscountPercentage,
      };
    }
  }

  // LEVEL 2: Product-Level Discount
  if (product) {
    if (product.discountType === 'FIXED' && product.fixedDiscountAmount && product.fixedDiscountAmount > 0) {
      const mrp = product.mrp || 0;
      const pct = mrp > 0 ? (product.fixedDiscountAmount / mrp) * 100 : 0;
      return {
        discountType: 'FIXED',
        discountValue: product.fixedDiscountAmount,
        fixedDiscountAmount: product.fixedDiscountAmount,
        source: 'PRODUCT_LEVEL',
        sourceLabel: `Product-Level Fixed Discount (₹${product.fixedDiscountAmount})`,
        appliedPercentage: Math.round(pct * 10) / 10,
      };
    }

    if (product.discountPercentage !== undefined && product.discountPercentage > 0) {
      return {
        discountType: 'PERCENTAGE',
        discountValue: product.discountPercentage,
        source: 'PRODUCT_LEVEL',
        sourceLabel: `Product-Level Discount (${product.discountPercentage}%)`,
        appliedPercentage: product.discountPercentage,
      };
    }
  }

  // LEVEL 3: Brand-Level Discount
  if (effectiveBrand) {
    // Check bulk brand rules
    const bRule = brandRules.find(
      (r) =>
        !r.supplierId &&
        !r.supplierName &&
        r.brandName?.toLowerCase().trim() === effectiveBrand.toLowerCase()
    );
    if (bRule && bRule.defaultDiscountPercentage > 0) {
      return {
        discountType: bRule.discountType || 'PERCENTAGE',
        discountValue: bRule.defaultDiscountPercentage,
        source: 'BRAND_LEVEL',
        sourceLabel: `Brand-Level Discount (${bRule.defaultDiscountPercentage}% for ${effectiveBrand})`,
        appliedPercentage: bRule.defaultDiscountPercentage,
      };
    }

    // Check Brand Master default discount
    const brandMaster = brands.find(
      (b) => b.name?.toLowerCase().trim() === effectiveBrand.toLowerCase()
    );
    if (brandMaster && brandMaster.defaultDiscountPercent && brandMaster.defaultDiscountPercent > 0) {
      return {
        discountType: 'PERCENTAGE',
        discountValue: brandMaster.defaultDiscountPercent,
        source: 'BRAND_LEVEL',
        sourceLabel: `Brand Master OEM Discount (${brandMaster.defaultDiscountPercent}% for ${brandMaster.name})`,
        appliedPercentage: brandMaster.defaultDiscountPercent,
      };
    }
  }

  // LEVEL 4: Default Discount
  return {
    discountType: 'PERCENTAGE',
    discountValue: 0,
    source: 'DEFAULT',
    sourceLabel: 'Default Standard Pricing (0% Discount)',
    appliedPercentage: 0,
  };
}

/**
 * Calculates net purchase rate, discount amounts, and GST
 */
export function calculateCommercialRate(params: {
  mrp?: number;
  discount?: ResolvedDiscount;
  directRate?: number;
  gstRate?: number;
}): RateCalculationResult {
  const safeMrp = params.mrp && !isNaN(params.mrp) && params.mrp > 0 ? Number(params.mrp) : 0;
  const directRate = params.directRate && !isNaN(params.directRate) && params.directRate > 0 ? Number(params.directRate) : 0;
  const gstRate = params.gstRate !== undefined && !isNaN(params.gstRate) && params.gstRate >= 0 ? Number(params.gstRate) : 18;
  const disc = params.discount || {
    discountType: 'PERCENTAGE',
    discountValue: 0,
    source: 'DEFAULT',
    sourceLabel: 'Default (0%)',
    appliedPercentage: 0,
  };

  let discountAmount = 0;
  let netPurchaseRate = 0;

  if (directRate > 0 && safeMrp === 0) {
    netPurchaseRate = directRate;
    discountAmount = 0;
  } else if (safeMrp > 0) {
    if (disc.discountType === 'FIXED' && disc.fixedDiscountAmount && disc.fixedDiscountAmount > 0) {
      discountAmount = Math.min(disc.fixedDiscountAmount, safeMrp);
      netPurchaseRate = Math.max(0, safeMrp - discountAmount);
    } else if (disc.appliedPercentage > 0) {
      discountAmount = Math.round(((safeMrp * disc.appliedPercentage) / 100) * 100) / 100;
      netPurchaseRate = Math.round((safeMrp - discountAmount) * 100) / 100;
    } else if (directRate > 0) {
      netPurchaseRate = directRate;
      discountAmount = Math.max(0, safeMrp - directRate);
    } else {
      netPurchaseRate = safeMrp;
      discountAmount = 0;
    }
  } else {
    netPurchaseRate = directRate;
    discountAmount = 0;
  }

  const gstAmount = Math.round(((netPurchaseRate * gstRate) / 100) * 100) / 100;
  const totalWithGst = Math.round((netPurchaseRate + gstAmount) * 100) / 100;

  return {
    mrp: safeMrp,
    discountType: disc.discountType,
    discountValue: disc.discountValue,
    discountAmount,
    netPurchaseRate,
    gstRate,
    gstAmount,
    totalWithGst,
    discountSource: disc.source,
    discountSourceLabel: disc.sourceLabel,
  };
}

/**
 * Creates an immutable rate history entry for audit compliance
 */
export function createRateHistoryEntry(params: {
  vendorId?: string;
  vendorName?: string;
  mrp?: number;
  discountType?: 'PERCENTAGE' | 'FIXED' | 'DIRECT';
  discountValue?: number;
  purchaseRate: number;
  netPurchaseRate: number;
  source: 'PO' | 'DIRECT_VQ' | 'MANUAL_ENTRY' | 'EXCEL_IMPORT';
  remarks?: string;
  recordedBy: string;
}): ProductRateHistoryEntry {
  const now = new Date().toISOString();
  return {
    id: `RH-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    vendorId: params.vendorId,
    vendorName: params.vendorName,
    mrp: params.mrp,
    discountType: params.discountType || 'PERCENTAGE',
    discountValue: params.discountValue,
    purchaseRate: params.purchaseRate,
    netPurchaseRate: params.netPurchaseRate,
    effectiveDate: now.split('T')[0],
    source: params.source,
    remarks: params.remarks,
    recordedAt: now,
    recordedBy: params.recordedBy,
  };
}
