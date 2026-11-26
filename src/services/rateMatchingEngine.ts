import {
  CatalogueProduct,
  RateVersionHistory,
  RateMatchResult,
} from '../types/catalogImport';

/**
 * Normalizes part codes / designations for exact, deterministic matching.
 * CRITICAL RULE: Preserves hyphens (-), slashes (/), dots (.), and alphanumeric characters.
 * Collapses internal whitespace, removes outer spaces.
 * Example: ' 6006 - 2RS1 ' -> '6006-2RS1', '6006 / C3' -> '6006/C3'
 */
export function normalizePartCode(code: string | undefined | null): string {
  if (!code) return '';
  return String(code)
    .trim()
    .toUpperCase()
    .replace(/\s*([-/.\\])\s*/g, '$1') // remove spaces around hyphens, slashes, dots
    .replace(/\s+/g, ' '); // collapse remaining internal whitespace
}

/**
 * Compares two part codes deterministically.
 * Matches if identical or if hyphen/slash normalized versions match.
 */
export function isExactPartCodeMatch(codeA: string, codeB: string): boolean {
  if (!codeA || !codeB) return false;
  const normA = normalizePartCode(codeA);
  const normB = normalizePartCode(codeB);
  if (normA === normB) return true;

  // Secondary check: stripping delimiters only if both are non-empty and length >= 4
  const strippedA = normA.replace(/[-/.\s_]/g, '');
  const strippedB = normB.replace(/[-/.\s_]/g, '');
  return strippedA.length >= 4 && strippedA === strippedB;
}

/**
 * Normalizes brand names for matching.
 */
export function normalizeBrand(brand: string | undefined | null): string {
  if (!brand) return '';
  const clean = String(brand).toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  if (clean === 'schneiderelectric' || clean === 'schneider') return 'schneider';
  if (clean === 'siemensag' || clean === 'siemens') return 'siemens';
  if (clean === 'lnt' || clean === 'lt' || clean === 'larsenandtoubro') return 'lt';
  if (clean === 'abbltd' || clean === 'abb') return 'abb';
  if (clean === 'skfbearings' || clean === 'skfindia' || clean === 'skf') return 'skf';
  return clean;
}

export interface CommercialRateCalculation {
  mrp: number;
  discountPercent: number;
  discountAmount: number;
  purchaseRate: number;
  discountSource: 'Supplier+Product' | 'Product' | 'Brand' | 'CatalogueDefault' | 'Negotiated';
  effectiveDate: string;
  catalogueVersion: string;
}

/**
 * Resolves the commercial purchase rate according to the standard ERP discount hierarchy:
 * 1. Supplier + Product Discount (most specific)
 * 2. Product-specific Discount
 * 3. Brand-level Discount
 * 4. Default Catalogue Discount (fallback 20%)
 * 
 * Formula:
 * Discount Amount = MRP * Discount% / 100
 * Purchase Rate = MRP - Discount Amount
 */
export function calculateCommercialRate(
  product: CatalogueProduct,
  options?: {
    supplierId?: string;
    supplierDiscountPercent?: number;
    brandDiscountPercent?: number;
    defaultCatalogueDiscountPercent?: number;
    negotiatedRate?: number;
  }
): CommercialRateCalculation {
  const mrp = product.mrp || 0;
  let discountPercent = 20; // Default fallback
  let discountSource: CommercialRateCalculation['discountSource'] = 'CatalogueDefault';

  if (options?.negotiatedRate && options.negotiatedRate > 0) {
    const negRate = options.negotiatedRate;
    const discAmt = Math.max(0, mrp - negRate);
    const discPct = mrp > 0 ? Math.round(((discAmt / mrp) * 100) * 10) / 10 : 0;
    return {
      mrp,
      discountPercent: discPct,
      discountAmount: Math.round(discAmt * 100) / 100,
      purchaseRate: negRate,
      discountSource: 'Negotiated',
      effectiveDate: product.effectiveDate || new Date().toISOString().split('T')[0],
      catalogueVersion: product.catalogueVersion || 'Current',
    };
  }

  // 1. Supplier + Product Discount
  if (options?.supplierDiscountPercent !== undefined && options.supplierDiscountPercent >= 0) {
    discountPercent = options.supplierDiscountPercent;
    discountSource = 'Supplier+Product';
  }
  // 2. Product-specific Discount
  else if (product.discountPercent !== undefined && product.discountPercent > 0) {
    discountPercent = product.discountPercent;
    discountSource = 'Product';
  }
  // 3. Brand-level Discount
  else if (options?.brandDiscountPercent !== undefined && options.brandDiscountPercent > 0) {
    discountPercent = options.brandDiscountPercent;
    discountSource = 'Brand';
  }
  // 4. Default Catalogue Discount
  else if (options?.defaultCatalogueDiscountPercent !== undefined && options.defaultCatalogueDiscountPercent > 0) {
    discountPercent = options.defaultCatalogueDiscountPercent;
    discountSource = 'CatalogueDefault';
  }

  const discountAmount = Math.round(((mrp * discountPercent) / 100) * 100) / 100;
  const purchaseRate = Math.round((mrp - discountAmount) * 100) / 100;

  return {
    mrp,
    discountPercent,
    discountAmount,
    purchaseRate,
    discountSource,
    effectiveDate: product.effectiveDate || new Date().toISOString().split('T')[0],
    catalogueVersion: product.catalogueVersion || 'Current',
  };
}

/**
 * Extracts candidate tokens from requirement text.
 * E.g., from 'SKF 6006-2RS1 Bearing 10 Nos' -> detects:
 * - Brand: 'SKF'
 * - Part candidate: '6006-2RS1'
 * - Quantity: 10, UOM: 'NOS'
 */
export function extractRequirementTokens(rawQuery: string): {
  detectedBrand?: string;
  detectedPartCodes: string[];
  detectedQuantity?: number;
  detectedUom?: string;
  cleanText: string;
} {
  const query = (rawQuery || '').trim();
  const detectedPartCodes: string[] = [];

  // Match potential part codes: numbers with hyphens, slashes, or alphanumeric models
  // e.g., '6006-2RS1', '6006/C3', 'LC1D32M7', '3RT2026-1BB40'
  const partCodeRegex = /\b([0-9A-Z]{2,}[-/][0-9A-Z]{1,}(?:[-/][0-9A-Z]{1,})*|[0-9]{4,}(?:[-/][0-9A-Z]+)*)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = partCodeRegex.exec(query)) !== null) {
    detectedPartCodes.push(match[1]);
  }

  // Also check single alphanumeric tokens >= 4 chars that look like part numbers (e.g. '6006')
  const simpleTokenRegex = /\b([0-9]{4,}[A-Z]*|[A-Z]{2,}[0-9]{3,}[A-Z0-9]*)\b/gi;
  while ((match = simpleTokenRegex.exec(query)) !== null) {
    if (!detectedPartCodes.includes(match[1])) {
      detectedPartCodes.push(match[1]);
    }
  }

  // Brand detection
  const knownBrands = ['SKF', 'SCHNEIDER', 'SIEMENS', 'ABB', 'L&T', 'FESTO', 'JANATICS', 'HAVELLS', 'OMRON', 'MITSUBISHI'];
  let detectedBrand: string | undefined;
  for (const b of knownBrands) {
    const rx = new RegExp(`\\b${b.replace('&', '\\&')}\\b`, 'i');
    if (rx.test(query)) {
      detectedBrand = b;
      break;
    }
  }

  // Quantity and UOM
  let detectedQuantity: number | undefined;
  let detectedUom: string | undefined;
  const qtyMatch = query.match(/\b(\d+)\s*(nos|no|pcs|pieces|mtr|meter|kg|set|sets|rolls|box)\b/i);
  if (qtyMatch) {
    detectedQuantity = parseInt(qtyMatch[1], 10);
    const u = qtyMatch[2].toUpperCase();
    if (u.startsWith('NO') || u.startsWith('PC')) detectedUom = 'NOS';
    else if (u.startsWith('MT')) detectedUom = 'MTR';
    else if (u.startsWith('KG')) detectedUom = 'KG';
    else if (u.startsWith('SET')) detectedUom = 'SET';
    else detectedUom = u;
  }

  return {
    detectedBrand,
    detectedPartCodes,
    detectedQuantity,
    detectedUom,
    cleanText: query,
  };
}

/**
 * Deterministic 6-Level Rate Matching Engine
 *
 * Strict Hierarchy:
 * Level 1: Exact Part Code (Designation) Match (100% confidence)
 * Level 2: Manufacturer Code Match (95% confidence)
 * Level 3: Brand + Model Number Match (90% confidence)
 * Level 4: Brand + Product Name + Technical Specifications Match (85% confidence)
 * Level 5: Product Name + Technical Specifications Match (80% confidence)
 * Level 6: Description Similarity (AI / fuzzy text fallback, 60-75% confidence)
 *
 * STRICT RULE: Never match ONLY by Category!
 * AMBIGUITY RULE: When multiple designations match (e.g. '6006' -> '6006', '6006-2RS1', '6006/C3', '6006-2Z'),
 * return isAmbiguous: true with ambiguousCandidates for 1-click user selection!
 */
export function matchCatalogueRateDeterministic(
  query: string,
  catalogueProducts: CatalogueProduct[],
  options?: {
    brand?: string;
    transactionDate?: string;
    supplierId?: string;
    brandDiscountPercent?: number;
    supplierDiscountPercent?: number;
  }
): RateMatchResult {
  if (!query || !catalogueProducts || catalogueProducts.length === 0) {
    return {
      matched: false,
      matchLevel: 0,
      matchLevelName: 'No Deterministic Match',
      confidence: 0,
      matchReason: 'Empty query or empty catalogue database.',
    };
  }

  const { detectedBrand, detectedPartCodes, detectedQuantity, detectedUom } = extractRequirementTokens(query);
  const targetBrand = options?.brand || detectedBrand;
  const normTargetBrand = normalizeBrand(targetBrand);

  // Scope to brand if recognized, or keep all active items
  let pool = catalogueProducts.filter((p) => p.status === 'ACTIVE' || !p.status);
  if (normTargetBrand) {
    const brandPool = pool.filter((p) => normalizeBrand(p.brand) === normTargetBrand);
    if (brandPool.length > 0) {
      pool = brandPool;
    }
  }

  const normQuery = query.toLowerCase().trim();

  // -------------------------------------------------------------
  // LEVEL 1: Exact Part Code Match (Highest Priority, 100% Confidence)
  // -------------------------------------------------------------
  // 1a. Try against extracted part code tokens
  for (const token of detectedPartCodes) {
    const exactMatches = pool.filter((p) => isExactPartCodeMatch(p.partCode, token));

    // Check if this token is a base code with multiple sibling variants in the catalogue
    // e.g. '6006' has '6006-2RS1', '6006-2Z', '6006/C3'
    const normTok = normalizePartCode(token);
    const relatedVariants = pool.filter((p) => {
      const normP = normalizePartCode(p.partCode);
      return normP === normTok || normP.startsWith(`${normTok}-`) || normP.startsWith(`${normTok}/`) || normP.startsWith(`${normTok} `);
    });

    if (relatedVariants.length > 1 && normTok.length <= 5 && !token.includes('-') && !token.includes('/')) {
      // Ambiguous base designation query (e.g. 'SKF 6006 bearing')
      const best = exactMatches[0] || relatedVariants[0];
      const rate = calculateCommercialRate(best, options);
      return {
        matched: true,
        matchLevel: 1,
        matchLevelName: 'Exact Part Code (Level 1)',
        ruleLevel: 'LEVEL_1_EXACT_PART_CODE',
        confidence: 90,
        matchedProduct: best,
        product: best,
        isAmbiguous: true,
        ambiguousCandidates: relatedVariants,
        calculatedRate: rate,
        detectedBrand,
        extractedPartCode: token,
        extractedQuantity: detectedQuantity,
        extractedUom: detectedUom,
        rawQuery: query,
        matchReason: `Base designation '${token}' has ${relatedVariants.length} variants available. Please select exact variant.`,
      };
    }

    if (exactMatches.length === 1) {
      const match = exactMatches[0];
      const rate = calculateCommercialRate(match, options);
      return {
        matched: true,
        matchLevel: 1,
        matchLevelName: 'Exact Part Code (Level 1)',
        ruleLevel: 'LEVEL_1_EXACT_PART_CODE',
        confidence: 100,
        matchedProduct: match,
        product: match,
        calculatedRate: rate,
        rateSnapshot: createRateSnapshot(match, rate, { transactionType: 'RFQ', referenceNumber: 'DIRECT-MATCH' }),
        detectedBrand,
        extractedPartCode: match.partCode,
        extractedQuantity: detectedQuantity,
        extractedUom: detectedUom,
        rawQuery: query,
        matchReason: `Exact Part Code match on '${match.partCode}' (100% confidence).`,
      };
    }

    // Ambiguity on exact part code (e.g., duplicate variants)
    if (exactMatches.length > 1) {
      const match = exactMatches[0];
      const rate = calculateCommercialRate(match, options);
      return {
        matched: true,
        matchLevel: 1,
        matchLevelName: 'Exact Part Code (Level 1)',
        ruleLevel: 'LEVEL_1_EXACT_PART_CODE',
        confidence: 98,
        matchedProduct: match,
        product: match,
        isAmbiguous: true,
        ambiguousCandidates: exactMatches,
        calculatedRate: rate,
        detectedBrand,
        extractedPartCode: token,
        extractedQuantity: detectedQuantity,
        extractedUom: detectedUom,
        rawQuery: query,
        matchReason: `Exact match found with ${exactMatches.length} catalogue variants.`,
      };
    }
  }

  // 1b. Check if any catalogue product's partCode is explicitly and wholly in query
  const exactCodeInQuery = pool.filter((p) => {
    if (!p.partCode) return false;
    const normPCode = normalizePartCode(p.partCode).toLowerCase();
    const escaped = normPCode.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\s|,|;)${escaped}(?:$|\\s|,|;)`, 'i');
    return regex.test(normQuery);
  });

  if (exactCodeInQuery.length === 1) {
    const match = exactCodeInQuery[0];
    const rate = calculateCommercialRate(match, options);
    return {
      matched: true,
      matchLevel: 1,
      matchLevelName: 'Exact Part Code (Level 1)',
      ruleLevel: 'LEVEL_1_EXACT_PART_CODE',
      confidence: 100,
      matchedProduct: match,
      product: match,
      calculatedRate: rate,
      rateSnapshot: createRateSnapshot(match, rate, { transactionType: 'RFQ', referenceNumber: 'DIRECT-MATCH' }),
      detectedBrand,
      extractedPartCode: match.partCode,
      extractedQuantity: detectedQuantity,
      extractedUom: detectedUom,
      rawQuery: query,
      matchReason: `Exact Part Code '${match.partCode}' found in requirement text.`,
    };
  }

  // AMBIGUITY CHECK: If user entered e.g. '6006' or 'SKF 6006 bearing', detect multiple related designations
  if (detectedPartCodes.length > 0) {
    for (const token of detectedPartCodes) {
      const cleanToken = normalizePartCode(token);
      if (cleanToken.length >= 3) {
        const related = pool.filter((p) => {
          const pCode = normalizePartCode(p.partCode);
          return pCode.startsWith(cleanToken) || pCode.includes(cleanToken);
        });
        if (related.length > 1) {
          const exactBase = related.find((p) => isExactPartCodeMatch(p.partCode, cleanToken));
          return {
            matched: true,
            matchLevel: 1,
            matchLevelName: 'Exact Part Code (Level 1)',
            ruleLevel: 'LEVEL_1_EXACT_PART_CODE',
            confidence: 90,
            matchedProduct: exactBase || related[0],
            product: exactBase || related[0],
            isAmbiguous: true,
            ambiguousCandidates: related,
            calculatedRate: calculateCommercialRate(exactBase || related[0], options),
            detectedBrand,
            extractedPartCode: token,
            extractedQuantity: detectedQuantity,
            extractedUom: detectedUom,
            rawQuery: query,
            matchReason: `Base designation '${cleanToken}' has ${related.length} distinct variants (e.g. ${related.map((r) => r.partCode).slice(0, 4).join(', ')}).`,
          };
        }
      }
    }
  }

  // -------------------------------------------------------------
  // LEVEL 2: Manufacturer Code Match (95% Confidence)
  // -------------------------------------------------------------
  for (const p of pool) {
    if (p.manufacturerCode && p.manufacturerCode.length >= 3) {
      const normMfg = p.manufacturerCode.toLowerCase().trim();
      if (normQuery.includes(normMfg)) {
        return {
          matched: true,
          matchLevel: 2,
          matchLevelName: 'Manufacturer Code (Level 2)',
          confidence: 95,
          matchedProduct: p,
          calculatedRate: calculateCommercialRate(p, options),
          matchReason: `Manufacturer Code match on '${p.manufacturerCode}' (95% confidence).`,
        };
      }
    }
  }

  // -------------------------------------------------------------
  // LEVEL 3: Brand + Model Number Match (90% Confidence)
  // -------------------------------------------------------------
  for (const p of pool) {
    if (p.modelNumber && p.modelNumber.length >= 3) {
      const normModel = p.modelNumber.toLowerCase().trim();
      if (normQuery.includes(normModel) && (!normTargetBrand || normalizeBrand(p.brand) === normTargetBrand)) {
        return {
          matched: true,
          matchLevel: 3,
          matchLevelName: 'Brand + Model Number (Level 3)',
          confidence: 90,
          matchedProduct: p,
          calculatedRate: calculateCommercialRate(p, options),
          matchReason: `Brand + Model Number match on '${p.brand} ${p.modelNumber}' (90% confidence).`,
        };
      }
    }
  }

  // -------------------------------------------------------------
  // LEVEL 4: Brand + Product Name + Technical Specifications Match (85% Confidence)
  // -------------------------------------------------------------
  for (const p of pool) {
    const pName = (p.productName || '').toLowerCase().trim();
    const pSpecs = (p.specifications || '').toLowerCase().trim();
    if (pName && pSpecs) {
      const nameWords = pName.split(/\s+/).filter((w) => w.length >= 3);
      const nameMatches = nameWords.filter((w) => normQuery.includes(w)).length;
      const specWords = pSpecs.split(/[,\s]+/).filter((w) => w.length >= 3);
      const specMatches = specWords.filter((w) => normQuery.includes(w)).length;

      if (nameMatches >= Math.min(2, nameWords.length) && specMatches >= 1) {
        return {
          matched: true,
          matchLevel: 4,
          matchLevelName: 'Brand + Product + Specs (Level 4)',
          confidence: 85,
          matchedProduct: p,
          calculatedRate: calculateCommercialRate(p, options),
          matchReason: `Brand + Product Name + Specifications matched for '${p.productName}'.`,
        };
      }
    }
  }

  // -------------------------------------------------------------
  // LEVEL 5: Product Name + Technical Specifications Match (80% Confidence)
  // -------------------------------------------------------------
  for (const p of pool) {
    const pName = (p.productName || '').toLowerCase().trim();
    const pSpecs = (p.specifications || '').toLowerCase().trim();
    if (pName && pSpecs) {
      const nameWords = pName.split(/\s+/).filter((w) => w.length >= 4);
      const nameMatches = nameWords.filter((w) => normQuery.includes(w)).length;
      const specWords = pSpecs.split(/[,\s]+/).filter((w) => w.length >= 4);
      const specMatches = specWords.filter((w) => normQuery.includes(w)).length;

      if (nameMatches >= 2 && specMatches >= 1) {
        return {
          matched: true,
          matchLevel: 5,
          matchLevelName: 'Product + Specs (Level 5)',
          confidence: 80,
          matchedProduct: p,
          calculatedRate: calculateCommercialRate(p, options),
          matchReason: `Product Name and Technical Specifications matched.`,
        };
      }
    }
  }

  // -------------------------------------------------------------
  // LEVEL 6: Description Similarity (AI / Fuzzy Fallback, 60-75% Confidence)
  // STRICT CONSTRAINT: NEVER MATCH ONLY BY CATEGORY!
  // -------------------------------------------------------------
  const queryWords = normQuery.split(/[\s,]+/).filter((w) => w.length >= 4);
  let bestScore = 0;
  let bestCandidate: CatalogueProduct | undefined;

  for (const p of pool) {
    let score = 0;
    const desc = `${p.productName} ${(p as any).sourceProductName || ''} ${(p as any).normalizedProductName || ''} ${(p as any).productDesignation || ''} ${(p as any).productFamily || ''} ${p.category || ''} ${p.description} ${p.specifications}`.toLowerCase();
    for (const qw of queryWords) {
      if (desc.includes(qw)) score += 10;
    }
    // Brand boost
    if (normTargetBrand && normalizeBrand(p.brand) === normTargetBrand) {
      score += 15;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = p;
    }
  }

  // Require at least 2 distinct keyword matches + brand match
  if (bestCandidate && bestScore >= 35) {
    const confidence = Math.min(75, Math.max(60, Math.round(50 + bestScore / 2)));
    return {
      matched: true,
      matchLevel: 6,
      matchLevelName: 'Description Similarity (Level 6)',
      confidence,
      matchedProduct: bestCandidate,
      calculatedRate: calculateCommercialRate(bestCandidate, options),
      matchReason: `Description and specifications similarity match on '${bestCandidate.productName}'.`,
    };
  }

  // No Deterministic Match Found
  return {
    matched: false,
    matchLevel: 0,
    matchLevelName: 'No Deterministic Match',
    confidence: 0,
    matchReason: 'No exact part code, manufacturer code, model, or specification match found. Manual rate entry required.',
  };
}

/**
 * Creates an immutable Rate Snapshot for an RFQ, Quotation, or PO.
 * CRITICAL RULE: Once stored on a transaction, this rate snapshot NEVER changes
 * when a new catalogue version is uploaded in the future.
 */
export function createRateSnapshot(
  product: CatalogueProduct,
  calculatedRate: CommercialRateCalculation,
  context: {
    transactionType: 'RFQ' | 'QUOTATION' | 'PO';
    referenceNumber: string;
    transactionDate?: string;
  }
) {
  return {
    productId: product.id,
    partCode: product.partCode,
    brand: product.brand,
    productName: product.productName,
    catalogueVersion: product.catalogueVersion,
    effectiveDate: product.effectiveDate,
    mrp: calculatedRate.mrp,
    discountPercent: calculatedRate.discountPercent,
    discountAmount: calculatedRate.discountAmount,
    purchaseRate: calculatedRate.purchaseRate,
    discountSource: calculatedRate.discountSource,
    transactionType: context.transactionType,
    referenceNumber: context.referenceNumber,
    snapshotDate: context.transactionDate || new Date().toISOString(),
    isImmutable: true,
  };
}
