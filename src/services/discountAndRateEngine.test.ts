import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveApplicableDiscount,
  calculateCommercialRate,
  createRateHistoryEntry,
} from './discountAndRateEngine';
import { ProductItem, BulkBrandDiscountRule } from '../types';

test('Discount Hierarchy: Supplier + Product Discount overrides Product and Brand discounts', () => {
  const product: Partial<ProductItem> = {
    id: 'PRD-001',
    brand: 'Schneider Electric',
    mrp: 1000,
    discountPercentage: 25, // Product-level is 25%
    rateHistory: [
      {
        id: 'RH-1',
        vendorName: 'Apex Electrics',
        discountType: 'PERCENTAGE',
        discountValue: 27, // Supplier-level is 27%
        purchaseRate: 730,
        netPurchaseRate: 730,
        effectiveDate: '2026-01-01',
        source: 'DIRECT_VQ',
        recordedAt: '2026-01-01',
        recordedBy: 'Admin',
      },
    ],
  };

  const brandRules: BulkBrandDiscountRule[] = [
    {
      id: 'BR-1',
      brandName: 'Schneider Electric',
      defaultDiscountPercentage: 20, // Brand-level is 20%
      discountType: 'PERCENTAGE',
      effectiveDate: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  // When supplier is specified, supplier discount (27%) must win
  const resSupplier = resolveApplicableDiscount({
    product,
    supplierName: 'Apex Electrics',
    brandRules,
  });
  assert.equal(resSupplier.source, 'SUPPLIER_PRODUCT');
  assert.equal(resSupplier.appliedPercentage, 27);

  // When no supplier is specified, product discount (25%) must win
  const resProduct = resolveApplicableDiscount({
    product,
    brandRules,
  });
  assert.equal(resProduct.source, 'PRODUCT_LEVEL');
  assert.equal(resProduct.appliedPercentage, 25);
});

test('Discount Hierarchy: Product-Level Discount overrides Brand-Level Discount', () => {
  const product: Partial<ProductItem> = {
    id: 'PRD-002',
    brand: 'Schneider Electric',
    mrp: 500,
    discountPercentage: 25, // Product discount 25%
  };

  const brandRules: BulkBrandDiscountRule[] = [
    {
      id: 'BR-1',
      brandName: 'Schneider Electric',
      defaultDiscountPercentage: 20, // Brand discount 20%
      discountType: 'PERCENTAGE',
      effectiveDate: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  const res = resolveApplicableDiscount({ product, brandRules });
  assert.equal(res.source, 'PRODUCT_LEVEL');
  assert.equal(res.appliedPercentage, 25);
});

test('Discount Hierarchy: Brand-Level Discount applies when no product discount exists', () => {
  const product: Partial<ProductItem> = {
    id: 'PRD-003',
    brand: 'Schneider Electric',
    mrp: 500,
  };

  const brandRules: BulkBrandDiscountRule[] = [
    {
      id: 'BR-1',
      brandName: 'Schneider Electric',
      defaultDiscountPercentage: 20,
      discountType: 'PERCENTAGE',
      effectiveDate: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  const res = resolveApplicableDiscount({ product, brandRules });
  assert.equal(res.source, 'BRAND_LEVEL');
  assert.equal(res.appliedPercentage, 20);
});

test('Rate calculations: Percentage, Fixed Discount, Direct Negotiated Rate and GST split', () => {
  // Percentage: MRP 1000, 25% discount, 18% GST
  const calc1 = calculateCommercialRate({
    mrp: 1000,
    discount: {
      discountType: 'PERCENTAGE',
      discountValue: 25,
      source: 'PRODUCT_LEVEL',
      sourceLabel: 'Product 25%',
      appliedPercentage: 25,
    },
    gstRate: 18,
  });
  assert.equal(calc1.discountAmount, 250);
  assert.equal(calc1.netPurchaseRate, 750);
  assert.equal(calc1.gstAmount, 135);
  assert.equal(calc1.totalWithGst, 885);

  // Fixed Discount: MRP 1000, Fixed 150
  const calc2 = calculateCommercialRate({
    mrp: 1000,
    discount: {
      discountType: 'FIXED',
      discountValue: 150,
      fixedDiscountAmount: 150,
      source: 'PRODUCT_LEVEL',
      sourceLabel: 'Fixed ₹150',
      appliedPercentage: 15,
    },
    gstRate: 18,
  });
  assert.equal(calc2.discountAmount, 150);
  assert.equal(calc2.netPurchaseRate, 850);

  // Direct Negotiated Rate: MRP 1000, Direct 780
  const calc3 = calculateCommercialRate({
    mrp: 1000,
    directRate: 780,
    gstRate: 18,
  });
  assert.equal(calc3.netPurchaseRate, 780);
  assert.equal(calc3.discountAmount, 220);
});

test('Rate History entry contains required audit fields', () => {
  const entry = createRateHistoryEntry({
    vendorName: 'Apex Electrics',
    mrp: 1000,
    purchaseRate: 750,
    netPurchaseRate: 750,
    source: 'EXCEL_IMPORT',
    recordedBy: 'Vicky Bhavsar',
    remarks: 'Imported via Schneider 2026 Price List',
  });
  assert.ok(entry.id.startsWith('RH-'));
  assert.equal(entry.source, 'EXCEL_IMPORT');
  assert.equal(entry.recordedBy, 'Vicky Bhavsar');
  assert.equal(entry.netPurchaseRate, 750);
});
