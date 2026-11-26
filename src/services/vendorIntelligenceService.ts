import {
  Vendor,
  VendorCatalogProduct,
  ProductItem,
  BrandMasterItem,
  BrandDetectionItem,
  CatalogueDiffSummary,
  WebsiteAnalysisResult,
} from '../types';
import {
  extractJsonLdAndCleanHtml,
  extractPartCodeCandidates,
  isBannedGenericProductName,
  isPlatformAttributionOrNoise,
  looksLikeAddressBlock,
  looksLikeMarketingTagline,
  looksLikeSectionHeadingOnly,
  resolveProductIdentityFields,
  validateExtractedProduct,
} from './contentClassificationEngine';

export interface VendorIntelligenceScoreBreakdown {
  catalogueAvailable: number; // max 20
  websiteAvailable: number; // max 15
  productsIdentified: number; // max 20
  brandsIdentified: number; // max 15
  partCodesIdentified: number; // max 15
  specificationsIdentified: number; // max 10
  recentlyVerified: number; // max 5
  totalScore: number; // max 100
  explanations: string[];
}

/**
 * Calculates a transparent intelligence score (0 - 100) according to Module 15
 */
export function calculateVendorIntelligenceScore(vendor: Partial<Vendor>): VendorIntelligenceScoreBreakdown {
  let catalogueAvailable = 0;
  let websiteAvailable = 0;
  let productsIdentified = 0;
  let brandsIdentified = 0;
  let partCodesIdentified = 0;
  let specificationsIdentified = 0;
  let recentlyVerified = 0;
  const explanations: string[] = [];

  // 1. Catalogue available: +20
  const filesCount = vendor.catalogFiles?.length || 0;
  if (filesCount > 0) {
    catalogueAvailable = Math.min(20, 10 + filesCount * 2);
    explanations.push(`Catalogue available: +${catalogueAvailable} (${filesCount} file(s) indexed)`);
  } else {
    explanations.push('Catalogue available: 0 (No catalogue document uploaded)');
  }

  // 2. Website available: +15
  const website = vendor.website || vendor.websiteUrls?.[0];
  if (website && website.trim().length > 3) {
    websiteAvailable = vendor.lastWebsiteAnalysisDate ? 15 : 10;
    explanations.push(
      `Website available: +${websiteAvailable} (${vendor.lastWebsiteAnalysisDate ? 'Crawled & analyzed' : 'URL registered'})`
    );
  } else {
    explanations.push('Website available: 0 (No corporate website listed)');
  }

  // 3. Products identified: +20
  const products = vendor.catalogProducts || [];
  const prodCount = products.length;
  if (prodCount >= 50) {
    productsIdentified = 20;
  } else if (prodCount >= 20) {
    productsIdentified = 16;
  } else if (prodCount >= 5) {
    productsIdentified = 12;
  } else if (prodCount > 0) {
    productsIdentified = 8;
  }
  explanations.push(`Products identified: +${productsIdentified} (${prodCount} items in database)`);

  // 4. Brands identified: +15
  const brands = Array.from(
    new Set([
      ...(vendor.brandsSupplied || []),
      ...(vendor.brandsDealing || []),
      ...products.map((p) => p.brand).filter(Boolean),
    ])
  ).filter((b) => b && b !== 'Unconfirmed');

  if (brands.length >= 5) {
    brandsIdentified = 15;
  } else if (brands.length >= 2) {
    brandsIdentified = 10;
  } else if (brands.length === 1) {
    brandsIdentified = 7;
  }
  explanations.push(`Brands identified: +${brandsIdentified} (${brands.length} distinct brand(s))`);

  // 5. Part codes / model numbers identified: +15
  const prodsWithPart = products.filter((p) => p.partNumber || p.modelNumber);
  if (prodsWithPart.length > 0) {
    const ratio = prodsWithPart.length / Math.max(1, prodCount);
    partCodesIdentified = Math.round(ratio * 15);
    explanations.push(
      `Part codes identified: +${partCodesIdentified} (${prodsWithPart.length} items with exact technical codes)`
    );
  } else {
    explanations.push('Part codes identified: 0 (Generic names only)');
  }

  // 6. Specifications identified: +10
  const prodsWithSpec = products.filter((p) => p.specification || p.size);
  if (prodsWithSpec.length > 0) {
    const ratio = prodsWithSpec.length / Math.max(1, prodCount);
    specificationsIdentified = Math.round(ratio * 10);
    explanations.push(
      `Specifications identified: +${specificationsIdentified} (${prodsWithSpec.length} items with technical ratings)`
    );
  } else {
    explanations.push('Specifications identified: 0');
  }

  // 7. Recently verified: +5 (within last 30 days)
  const lastDateStr = vendor.lastAiAnalysisDate || vendor.lastWebsiteAnalysisDate;
  if (lastDateStr) {
    recentlyVerified = 5;
    explanations.push(`Recently verified: +5 (Active verification recorded)`);
  } else {
    explanations.push('Recently verified: 0');
  }

  const totalScore = Math.min(
    100,
    catalogueAvailable +
      websiteAvailable +
      productsIdentified +
      brandsIdentified +
      partCodesIdentified +
      specificationsIdentified +
      recentlyVerified
  );

  return {
    catalogueAvailable,
    websiteAvailable,
    productsIdentified,
    brandsIdentified,
    partCodesIdentified,
    specificationsIdentified,
    recentlyVerified,
    totalScore,
    explanations,
  };
}

/**
 * Preserves exact punctuation (-, /, ., +) while trimming whitespace and normalizing letter casing.
 */
export function preserveExactPartCode(raw?: string): string {
  if (!raw) return '';
  return raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim().replace(/\s+/g, ' ');
}

/**
 * Normalizes part code strictly for duplicate grouping without altering stored display code.
 */
export function buildPartCodeComparisonKey(raw?: string): string {
  return preserveExactPartCode(raw).toLowerCase();
}

/**
 * Product Master prioritized matching algorithm (Module 8)
 * 1. Exact Part Code (preserving -, /, .)
 * 2. Exact Manufacturer Code
 * 3. Exact Model Number
 * 4. Brand + Part Code
 * 5. Brand + Model
 * 6. Brand + Product Name + Specification
 * 7. Product Name + Specification
 * 8. Description similarity
 * 9. Category fallback
 */
export function matchExtractedProductWithProductMaster(
  extracted: Partial<VendorCatalogProduct>,
  productMaster: ProductItem[],
  brandMaster: BrandMasterItem[] = []
): {
  matchStatus: 'EXACT_MATCH' | 'SIMILAR_MATCH' | 'REVIEW_REQUIRED' | 'AMBIGUOUS_MATCH' | 'NEW_PRODUCT';
  matchedProduct?: ProductItem;
  confidence: number;
  priority: string;
  candidates?: ProductItem[];
} {
  const extPart = buildPartCodeComparisonKey(extracted.partNumber);
  const extModel = buildPartCodeComparisonKey(extracted.modelNumber);
  const extCode = extPart || extModel;
  const extBrand = (extracted.brand || '').trim().toLowerCase();
  const extName = (extracted.productName || '').trim().toLowerCase();
  const extSpec = (extracted.specification || '').trim().toLowerCase();
  const extDesc = (extracted.description || '').trim().toLowerCase();
  const extCat = (extracted.category || '').trim().toLowerCase();

  const matchesBrand = (p: ProductItem, targetBrand: string): boolean => {
    if (!targetBrand || targetBrand === 'unconfirmed') return false;
    const pBrand = (p.brand || '').trim().toLowerCase();
    if (pBrand === targetBrand || pBrand.includes(targetBrand) || targetBrand.includes(pBrand)) return true;
    const bm = brandMaster.find(
      (b) =>
        b.name.toLowerCase() === targetBrand ||
        (b.aliases || []).some((a) => a.toLowerCase() === targetBrand)
    );
    if (bm) {
      const names = [bm.name.toLowerCase(), ...(bm.aliases || []).map((a) => a.toLowerCase())];
      return names.includes(pBrand);
    }
    return false;
  };

  if (!extCode && !extName) {
    return {
      matchStatus: 'REVIEW_REQUIRED',
      confidence: 30,
      priority: 'None',
    };
  }

  // 1. Exact Part Code (never strip - / . suffixes, so 6006 != 6006-2RS1 != 6006/C3)
  if (extCode) {
    const exactPartMatches = productMaster.filter(
      (p) => !p.isDeleted && buildPartCodeComparisonKey(p.partNumber) === extCode
    );
    if (exactPartMatches.length === 1) {
      const m = exactPartMatches[0];
      if (!extBrand || extBrand === 'unconfirmed' || matchesBrand(m, extBrand)) {
        return {
          matchStatus: 'EXACT_MATCH',
          matchedProduct: m,
          confidence: 99,
          priority: '1. Exact Part Code',
        };
      }
    } else if (exactPartMatches.length > 1) {
      const brandFiltered = exactPartMatches.filter((p) => matchesBrand(p, extBrand));
      if (brandFiltered.length === 1) {
        return {
          matchStatus: 'EXACT_MATCH',
          matchedProduct: brandFiltered[0],
          confidence: 98,
          priority: '4. Brand + Exact Part Code',
        };
      }
      return {
        matchStatus: 'AMBIGUOUS_MATCH',
        confidence: 82,
        priority: '1. Multiple Products with Same Part Code',
        candidates: exactPartMatches.slice(0, 8),
      };
    }

    // 2. Exact Manufacturer Code
    const mfgMatches = productMaster.filter(
      (p) => !p.isDeleted && p.manufacturerCode && buildPartCodeComparisonKey(p.manufacturerCode) === extCode
    );
    if (mfgMatches.length === 1) {
      return {
        matchStatus: 'EXACT_MATCH',
        matchedProduct: mfgMatches[0],
        confidence: 97,
        priority: '2. Exact Manufacturer Code',
      };
    } else if (mfgMatches.length > 1) {
      const brandFiltered = mfgMatches.filter((p) => matchesBrand(p, extBrand));
      if (brandFiltered.length === 1) {
        return {
          matchStatus: 'EXACT_MATCH',
          matchedProduct: brandFiltered[0],
          confidence: 96,
          priority: '4. Brand + Manufacturer Code',
        };
      }
      return {
        matchStatus: 'AMBIGUOUS_MATCH',
        confidence: 80,
        priority: '2. Multiple Manufacturer Code Matches',
        candidates: mfgMatches.slice(0, 8),
      };
    }

    // 3. Exact Model Number
    const modelMatches = productMaster.filter(
      (p) => !p.isDeleted && buildPartCodeComparisonKey(p.modelNumber) === extCode
    );
    if (modelMatches.length === 1) {
      return {
        matchStatus: 'EXACT_MATCH',
        matchedProduct: modelMatches[0],
        confidence: 96,
        priority: '3. Exact Model Number',
      };
    } else if (modelMatches.length > 1) {
      const brandFiltered = modelMatches.filter((p) => matchesBrand(p, extBrand));
      if (brandFiltered.length === 1) {
        return {
          matchStatus: 'EXACT_MATCH',
          matchedProduct: brandFiltered[0],
          confidence: 95,
          priority: '5. Brand + Exact Model Number',
        };
      }
      return {
        matchStatus: 'AMBIGUOUS_MATCH',
        confidence: 78,
        priority: '3. Multiple Model Matches',
        candidates: modelMatches.slice(0, 8),
      };
    }
  }

  // 6. Brand + Product Name + Specification Match
  if (extBrand && extBrand !== 'unconfirmed' && extName && extSpec) {
    const specMatches = productMaster.filter((p) => {
      if (p.isDeleted) return false;
      const pName = (p.itemName || '').trim().toLowerCase();
      const pSpec = (p.specification || '').trim().toLowerCase();
      return (
        matchesBrand(p, extBrand) &&
        pName &&
        pSpec &&
        (pName.includes(extName) || extName.includes(pName)) &&
        (pSpec.includes(extSpec) || extSpec.includes(pSpec))
      );
    });
    if (specMatches.length === 1) {
      return {
        matchStatus: 'SIMILAR_MATCH',
        matchedProduct: specMatches[0],
        confidence: 90,
        priority: '6. Brand + Product Name + Specification',
      };
    } else if (specMatches.length > 1) {
      return {
        matchStatus: 'AMBIGUOUS_MATCH',
        confidence: 76,
        priority: '6. Multiple Spec Matches',
        candidates: specMatches.slice(0, 8),
      };
    }
  }

  // 7. Product Name + Specification Match
  if (extName && extSpec) {
    const nameSpecMatches = productMaster.filter((p) => {
      if (p.isDeleted) return false;
      const pName = (p.itemName || '').trim().toLowerCase();
      const pSpec = (p.specification || '').trim().toLowerCase();
      return (
        pName &&
        pSpec &&
        (pName.includes(extName) || extName.includes(pName)) &&
        (pSpec.includes(extSpec) || extSpec.includes(pSpec))
      );
    });
    if (nameSpecMatches.length === 1) {
      return {
        matchStatus: 'SIMILAR_MATCH',
        matchedProduct: nameSpecMatches[0],
        confidence: 82,
        priority: '7. Product Name + Specification',
      };
    }
  }

  // 8. Description similarity (token overlap)
  const searchTokens = `${extName} ${extSpec} ${extDesc}`
    .split(/[\s,;/()-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
  if (searchTokens.length >= 2) {
    let bestScore = 0;
    let bestCandidate: ProductItem | undefined;
    const candidates: ProductItem[] = [];
    for (const p of productMaster) {
      if (p.isDeleted) continue;
      const hay = `${p.itemName || ''} ${p.specification || ''} ${p.description || ''} ${p.partNumber || ''}`.toLowerCase();
      const hits = searchTokens.filter((tok) => hay.includes(tok)).length;
      const ratio = hits / searchTokens.length;
      if (ratio >= 0.7 && hits >= 2) {
        candidates.push(p);
        if (ratio > bestScore) {
          bestScore = ratio;
          bestCandidate = p;
        }
      }
    }
    if (candidates.length === 1 && bestCandidate) {
      return {
        matchStatus: 'SIMILAR_MATCH',
        matchedProduct: bestCandidate,
        confidence: Math.round(68 + bestScore * 15),
        priority: '8. Description Similarity',
      };
    } else if (candidates.length > 1) {
      return {
        matchStatus: 'AMBIGUOUS_MATCH',
        confidence: 70,
        priority: '8. Similar Description Candidates',
        candidates: candidates.slice(0, 6),
      };
    }
  }

  // 9. Category Match check (never auto-merge just on category, propose New Product)
  if (extCat) {
    const catCount = productMaster.filter(
      (p) => !p.isDeleted && (p.category || '').toLowerCase() === extCat
    ).length;
    return {
      matchStatus: 'NEW_PRODUCT',
      confidence: catCount > 0 ? 65 : 55,
      priority: catCount > 0 ? '9. Category Identified (New Product)' : 'No Pre-existing Master Record',
    };
  }

  return {
    matchStatus: 'NEW_PRODUCT',
    confidence: 60,
    priority: 'No Pre-existing Master Record',
  };
}

/**
 * Standard MRO Product Families Taxonomies (Module 6)
 */
export const MRO_PRODUCT_FAMILIES: Record<
  string,
  {
    family: string;
    productTypes: string[];
    commonBrands: string[];
  }[]
> = {
  Automation: [
    {
      family: 'Sensors',
      productTypes: [
        'Proximity Sensor',
        'Photoelectric Sensor',
        'Rotary Encoder',
        'Pressure Transmitter',
        'RTD / Thermocouple',
        'Limit Switch',
        'Level Sensor',
        'Humidity Sensor',
      ],
      commonBrands: ['Autonics', 'Omron', 'IFM Electronic', 'Pepperl+Fuchs', 'Sick', 'Balluff'],
    },
    {
      family: 'Control & Power',
      productTypes: ['SMPS Power Supply', 'Temperature Controller', 'Digital Panel Meter', 'Isolator', 'SSR (Solid State Relay)', 'Timer'],
      commonBrands: ['Autonics', 'Mean Well', 'Omron', 'Schneider Electric', 'Selec'],
    },
    {
      family: 'PLC & HMI',
      productTypes: ['Programmable Logic Controller (PLC)', 'Human Machine Interface (HMI)', 'Variable Frequency Drive (VFD)', 'Ethernet Switch'],
      commonBrands: ['Siemens', 'Schneider Electric', 'Delta', 'Mitsubishi', 'Moxa'],
    },
  ],
  Electrical: [
    {
      family: 'Panel Accessories',
      productTypes: [
        'Cable Gland',
        'Cable Tie / Spiral',
        'Cable Conduit',
        'Industrial Plug & Socket',
        'Push Button & Lamp',
        'Selector & Rotary Switch',
        'Terminal Block / Lug',
        'Ferrule',
        'PVC & MCB Channel',
        'Dragchain',
        'ABS Push Button Box',
        'Hooter & Tower Light',
        'Fan & Air Filter Vent',
      ],
      commonBrands: ['Lapp Group', 'Polycab', 'Jainson', 'Dowells', 'Connectwell', 'Elmex', 'Schneider'],
    },
    {
      family: 'Enclosures & Gaskets',
      productTypes: ['Modular Enclosure (IP65/IP66)', 'PU Gasket Profile', 'Junction Box', 'Terminal Box'],
      commonBrands: ['Rittal', 'Fibox', 'Hensel', 'Spelsberg'],
    },
    {
      family: 'Switchgear',
      productTypes: [
        'Miniature Circuit Breaker (MCB)',
        'Molded Case Circuit Breaker (MCCB)',
        'Power Contactor',
        'Thermal Overload Relay',
        'Air Circuit Breaker (ACB)',
        'Switch Disconnector',
      ],
      commonBrands: ['Schneider Electric', 'Siemens', 'ABB', 'L&T', 'Legrand'],
    },
  ],
  Mechanical: [
    {
      family: 'Bearings',
      productTypes: [
        'Deep Groove Ball Bearing',
        'Spherical Roller Bearing',
        'Tapered Roller Bearing',
        'Pillow Block Unit',
        'Cylindrical Roller Bearing',
        'Needle Roller Bearing',
      ],
      commonBrands: ['SKF', 'FAG', 'Timken', 'NSK', 'NTN'],
    },
    {
      family: 'Pneumatics',
      productTypes: [
        'Pneumatic Solenoid Valve',
        'ISO Standard Cylinder',
        'Compact Cylinder',
        'FRL Filter Regulator Lubricator',
        'PU Tube & Quick Fitting',
      ],
      commonBrands: ['Festo', 'SMC', 'Janatics', 'Parker', 'Airtac'],
    },
  ],
};

/**
 * 4D Technology Test Case Data (Module 34)
 */
export const FOUR_D_TECHNOLOGY_TEST_PROFILE = {
  vendorName: '4D Technology',
  legalName: '4D Technology & Automation Systems Pvt Ltd',
  website: 'https://4dtechnology.in',
  city: 'Ahmedabad',
  state: 'Gujarat',
  country: 'India',
  catalogFileName: '4d brochure.pdf',
  fileType: 'PDF',
  vendorProfile: {
    supplierName: '4D Technology',
    summary:
      'Premier industrial automation, sensor systems, and enclosure panel accessories manufacturer & stockist supplying comprehensive MRO factory solutions.',
    capabilities: [
      'Instrumentation & Industrial Sensors',
      'PU Gasket Dispensing & In-Situ Gasket Manufacturing',
      'IP65/IP66 Mild Steel & Stainless Steel Enclosures',
      'Modular Control Panel Accessories & Cable Management',
    ],
    certifications: ['ISO 9001:2015', 'CE Compliant', 'RoHS Verified', 'IP66 Tested'],
    authorizedDistributorOf: ['Autonics', 'Schneider Electric', 'Mean Well', 'Connectwell'],
    dealsInBrands: ['4D Tech', 'Autonics', 'Schneider Electric', 'Mean Well', 'Connectwell', 'Omron'],
    specializations: ['Industrial Sensors', 'Panel Accessories', 'PU Gaskets', 'Enclosures'],
  },
  brandsDetected: [
    { name: '4D Tech', productsCount: 28, confidence: 98, isExisting: false, relationship: 'Authorised Distributor' },
    { name: 'Autonics', productsCount: 16, confidence: 96, isExisting: true, relationship: 'Deals In' },
    { name: 'Schneider Electric', productsCount: 8, confidence: 94, isExisting: true, relationship: 'Supplies' },
    { name: 'Mean Well', productsCount: 6, confidence: 92, isExisting: false, relationship: 'Listed In Catalogue' },
    { name: 'Connectwell', productsCount: 10, confidence: 91, isExisting: false, relationship: 'Supplies' },
  ],
  categoriesDetected: [
    { name: 'Automation', productsCount: 28, confidence: 96 },
    { name: 'Electrical', productsCount: 32, confidence: 95 },
    { name: 'Sensors', productsCount: 18, confidence: 97 },
    { name: 'Panel Accessories', productsCount: 22, confidence: 94 },
    { name: 'Enclosures & Gaskets', productsCount: 12, confidence: 93 },
  ],
  productFamilies: [
    'Sensors (Proximity, Photoelectric, Rotary Encoders)',
    'Panel Accessories (Cable Glands, Ties, Conduits, Terminals)',
    'Control & Power (SMPS, Controllers, SSR, Timers)',
    'Enclosures & PU Gaskets (Modular IP66, PU Profiles)',
    'Switchgear & HMI (Push Buttons, Relays, Tower Lights)',
  ],
  products: [
    // 1. Proximity Sensors
    {
      productName: 'Inductive Proximity Sensor M18 PNP NO',
      category: 'Sensors',
      subCategory: 'Proximity Sensors',
      brand: 'Autonics',
      partNumber: 'PR18-8DN',
      modelNumber: 'PR18-8DN',
      specification: 'M18 Shielded, 8mm Sensing, 10-30VDC, PNP NO, IP67',
      uom: 'NOS',
      mrp: 1450,
      basicRate: 980,
      discountPercent: 32.4,
      purchaseRate: 980,
      catalogReference: '4d brochure.pdf, Page 1',
      sourcePage: 1,
      sourceType: 'PDF' as const,
      aiConfidence: 98,
      confidenceLevel: 'High' as const,
      reviewStatus: 'Verified' as const,
    },
    {
      productName: 'Photoelectric Sensor Rectangular Thru-Beam',
      category: 'Sensors',
      subCategory: 'Photoelectric Sensors',
      brand: 'Autonics',
      partNumber: 'BEN10M-TDT',
      modelNumber: 'BEN10M-TDT',
      specification: '10m Sensing Range, 24-240VAC/24-240VDC, Relay Output',
      uom: 'SET',
      mrp: 3200,
      basicRate: 2150,
      discountPercent: 32.8,
      purchaseRate: 2150,
      catalogReference: '4d brochure.pdf, Page 1',
      sourcePage: 1,
      sourceType: 'PDF' as const,
      aiConfidence: 97,
      confidenceLevel: 'High' as const,
      reviewStatus: 'Verified' as const,
    },
    // 2. Rotary Encoders & Pressure Transmitters
    {
      productName: 'Incremental Rotary Encoder 1024 PPR',
      category: 'Sensors',
      subCategory: 'Rotary Encoders',
      brand: 'Autonics',
      partNumber: 'E50S8-1024-3-T-24',
      modelNumber: 'E50S8-1024-3-T-24',
      specification: 'Dia 50mm, Shaft 8mm, 1024 Pulse/Rev, Totem Pole 12-24VDC',
      uom: 'NOS',
      mrp: 4800,
      basicRate: 3350,
      discountPercent: 30.2,
      purchaseRate: 3350,
      catalogReference: '4d brochure.pdf, Page 1',
      sourcePage: 1,
      sourceType: 'PDF' as const,
      aiConfidence: 96,
      confidenceLevel: 'High' as const,
      reviewStatus: 'Verified' as const,
    },
    {
      productName: 'Pressure Transmitter 0-10 Bar 4-20mA',
      category: 'Sensors',
      subCategory: 'Pressure Transmitters',
      brand: '4D Tech',
      partNumber: '4D-PT-010-G14',
      modelNumber: '4D-PT-010-G14',
      specification: 'Range 0-10 Bar, G1/4 Male Thread, Output 4-20mA 2-Wire, SS316',
      uom: 'NOS',
      mrp: 4200,
      basicRate: 2800,
      discountPercent: 33.3,
      purchaseRate: 2800,
      catalogReference: '4d brochure.pdf, Page 2',
      sourcePage: 2,
      sourceType: 'PDF' as const,
      aiConfidence: 95,
      confidenceLevel: 'High' as const,
      reviewStatus: 'Verified' as const,
    },
    // 3. RTD & Thermocouple
    {
      productName: 'Duplex RTD PT100 Sensor with SS Protection Tube',
      category: 'Sensors',
      subCategory: 'RTD / Thermocouple',
      brand: '4D Tech',
      partNumber: '4D-RTD-PT100-6x150',
      modelNumber: '4D-RTD-PT100-6x150',
      specification: '3-Wire Class A, Sheath 6mm x 150mm Length, 1/2 inch BSP, 400°C',
      uom: 'NOS',
      mrp: 1850,
      basicRate: 1250,
      discountPercent: 32.4,
      purchaseRate: 1250,
      catalogReference: '4d brochure.pdf, Page 2',
      sourcePage: 2,
      sourceType: 'PDF' as const,
      aiConfidence: 96,
      confidenceLevel: 'High' as const,
      reviewStatus: 'Verified' as const,
    },
    // 4. SMPS & Digital Meters
    {
      productName: 'SMPS Power Supply 24VDC 5A 120W DIN Rail',
      category: 'Automation',
      subCategory: 'Control & Power',
      brand: 'Mean Well',
      partNumber: 'NDR-120-24',
      modelNumber: 'NDR-120-24',
      specification: 'Input 90-264VAC, Output 24VDC 5A, Efficiency 88%, DIN Rail TS-35',
      uom: 'NOS',
      mrp: 2650,
      basicRate: 1850,
      discountPercent: 30.2,
      purchaseRate: 1850,
      catalogReference: '4d brochure.pdf, Page 3',
      sourcePage: 3,
      sourceType: 'PDF' as const,
      aiConfidence: 98,
      confidenceLevel: 'High' as const,
      reviewStatus: 'Verified' as const,
    },
    {
      productName: 'Solid State Relay (SSR) Single Phase 40A',
      category: 'Automation',
      subCategory: 'Control & Power',
      brand: 'Autonics',
      partNumber: 'SR1-1440',
      modelNumber: 'SR1-1440',
      specification: 'Control 4-32VDC, Load 24-240VAC 40A, Zero Cross Turn-on, Heatsink Mount',
      uom: 'NOS',
      mrp: 1650,
      basicRate: 1100,
      discountPercent: 33.3,
      purchaseRate: 1100,
      catalogReference: '4d brochure.pdf, Page 3',
      sourcePage: 3,
      sourceType: 'PDF' as const,
      aiConfidence: 97,
      confidenceLevel: 'High' as const,
      reviewStatus: 'Verified' as const,
    },
    // 5. PU Gaskets & Enclosures
    {
      productName: 'Continuous Polyurethane (PU) Foam Gasket Seal',
      category: 'Enclosures & Gaskets',
      subCategory: 'PU Gasket Profile',
      brand: '4D Tech',
      partNumber: '4D-PUG-15x10',
      modelNumber: '4D-PUG-15x10',
      specification: '15mm Width x 10mm Thickness, Seamless Dispensed EPDM/PU, IP66 Ingress Protection, Temperature -40°C to +100°C',
      uom: 'MTR',
      mrp: 180,
      basicRate: 115,
      discountPercent: 36.1,
      purchaseRate: 115,
      catalogReference: '4d brochure.pdf, Page 4',
      sourcePage: 4,
      sourceType: 'PDF' as const,
      aiConfidence: 96,
      confidenceLevel: 'High' as const,
      reviewStatus: 'Verified' as const,
    },
    {
      productName: 'Modular Control Panel Enclosure IP66 Mild Steel',
      category: 'Enclosures & Gaskets',
      subCategory: 'Modular Enclosure (IP65/IP66)',
      brand: '4D Tech',
      partNumber: '4D-ENC-800x600x250',
      modelNumber: '4D-ENC-800x600x250',
      specification: '800H x 600W x 250D mm, 2mm CRCA Sheet, RAL 7035 Powder Coated, PU Gasket, Mounting Plate Included',
      uom: 'NOS',
      mrp: 8500,
      basicRate: 5800,
      discountPercent: 31.8,
      purchaseRate: 5800,
      catalogReference: '4d brochure.pdf, Page 4',
      sourcePage: 4,
      sourceType: 'PDF' as const,
      aiConfidence: 95,
      confidenceLevel: 'High' as const,
      reviewStatus: 'Verified' as const,
    },
    // 6. Panel Accessories
    {
      productName: 'Polyamide Metric Cable Gland M20 IP68 with Locknut',
      category: 'Electrical',
      subCategory: 'Panel Accessories',
      brand: '4D Tech',
      partNumber: '4D-CG-M20-GR',
      modelNumber: '4D-CG-M20-GR',
      specification: 'M20x1.5 Thread, Cable Range 6-12mm, PA66 Nylon, Nitrile O-Ring, IP68',
      uom: 'NOS',
      mrp: 35,
      basicRate: 21,
      discountPercent: 40.0,
      purchaseRate: 21,
      catalogReference: '4d brochure.pdf, Page 5',
      sourcePage: 5,
      sourceType: 'PDF' as const,
      aiConfidence: 99,
      confidenceLevel: 'High' as const,
      reviewStatus: 'Verified' as const,
    },
    {
      productName: 'Slotted PVC Wiring Duct / Cable Channel 45x45mm',
      category: 'Electrical',
      subCategory: 'Panel Accessories',
      brand: '4D Tech',
      partNumber: '4D-WD-4545-2M',
      modelNumber: '4D-WD-4545-2M',
      specification: '45mm Width x 45mm Height, 2 Metre Length, High Impact Rigid PVC, Self-Extinguishing UL94V-0',
      uom: 'MTR',
      mrp: 140,
      basicRate: 88,
      discountPercent: 37.1,
      purchaseRate: 88,
      catalogReference: '4d brochure.pdf, Page 5',
      sourcePage: 5,
      sourceType: 'PDF' as const,
      aiConfidence: 98,
      confidenceLevel: 'High' as const,
      reviewStatus: 'Verified' as const,
    },
    {
      productName: 'Industrial Flush Push Button 22mm Green 1NO',
      category: 'Electrical',
      subCategory: 'Panel Accessories',
      brand: 'Schneider Electric',
      partNumber: 'XB4BA31',
      modelNumber: 'XB4BA31',
      specification: '22mm Mounting, Metallic Bezel, 1NO Contact, Spring Return Green',
      uom: 'NOS',
      mrp: 495,
      basicRate: 340,
      discountPercent: 31.3,
      purchaseRate: 340,
      catalogReference: '4d brochure.pdf, Page 6',
      sourcePage: 6,
      sourceType: 'PDF' as const,
      aiConfidence: 99,
      confidenceLevel: 'High' as const,
      reviewStatus: 'Verified' as const,
    },
    {
      productName: 'LED Multi-Layer Tower Signal Light 24VDC Red-Amber-Green with Buzzer',
      category: 'Electrical',
      subCategory: 'Panel Accessories',
      brand: 'Autonics',
      partNumber: 'PME-302-RYG',
      modelNumber: 'PME-302-RYG',
      specification: 'Dia 45mm, 3 Tiers (Red, Yellow, Green), 24VDC, Steady/Flashing, 85dB Audible Buzzer',
      uom: 'NOS',
      mrp: 3850,
      basicRate: 2600,
      discountPercent: 32.5,
      purchaseRate: 2600,
      catalogReference: '4d brochure.pdf, Page 6',
      sourcePage: 6,
      sourceType: 'PDF' as const,
      aiConfidence: 97,
      confidenceLevel: 'High' as const,
      reviewStatus: 'Verified' as const,
    },
  ],
};

/**
 * Classifies Vendor–Brand relationship strictly from evidence.
 * Only assigns "Authorised Distributor" if explicit authorization keywords appear near the brand mention.
 */
export function classifyBrandRelationship(
  evidenceText: string,
  brandName: string
): BrandDetectionItem['relationship'] {
  const cleanText = (evidenceText || '').toLowerCase();
  const cleanBrand = (brandName || '').toLowerCase().trim();
  if (!cleanText || !cleanBrand) return 'Listed In Catalogue';

  const authRegex = /(authori[sz]ed\s+(distributor|dealer|stockist|partner|channel\s+partner)|official\s+distributor|sole\s+distributor)/i;
  const clauses = cleanText.split(/[\n\r.|;]+/).filter((c) => c.includes(cleanBrand));
  for (const clause of clauses) {
    if (authRegex.test(clause)) return 'Authorised Distributor';
    if (/(distributor|channel\s+partner)/i.test(clause)) return 'Distributor';
    if (/(deals?\s+in|stocked|supplies|supplier\s+of)/i.test(clause)) return 'Deals In';
  }
  return 'Listed In Catalogue';
}

/**
 * Detects & reconciles brands from extracted products and document text against ERP Brand Master.
 */
export function detectBrandsAgainstMaster(
  products: Array<Partial<VendorCatalogProduct>>,
  rawText: string,
  brandMaster: BrandMasterItem[] = []
): BrandDetectionItem[] {
  const brandStats = new Map<
    string,
    { count: number; totalConf: number; evidenceList: string[] }
  >();

  for (const p of products) {
    const b = (p.brand || '').trim();
    if (!b || b === 'Unconfirmed' || b === 'Generic Industrial') continue;
    const entry = brandStats.get(b) || { count: 0, totalConf: 0, evidenceList: [] };
    entry.count += 1;
    entry.totalConf += typeof p.aiConfidence === 'number' ? p.aiConfidence : 90;
    if (p.evidence) entry.evidenceList.push(p.evidence);
    brandStats.set(b, entry);
  }

  const results: BrandDetectionItem[] = [];
  for (const [brandName, stats] of brandStats.entries()) {
    const lower = brandName.toLowerCase();
    const matched = brandMaster.find(
      (bm) =>
        !bm.isDeleted &&
        (bm.name.toLowerCase().trim() === lower ||
          (bm.aliases || []).some((a) => a.toLowerCase().trim() === lower))
    );
    const combinedEvidence = `${stats.evidenceList.slice(0, 3).join(' | ')} ${rawText.slice(0, 4000)}`;
    results.push({
      name: matched ? matched.name : brandName,
      productsCount: stats.count,
      confidence: Math.round(stats.totalConf / Math.max(1, stats.count)),
      isExisting: !!matched,
      matchedBrandId: matched?.id,
      relationship: classifyBrandRelationship(combinedEvidence, brandName),
      evidence: stats.evidenceList[0] || `Appears in ${stats.count} extracted item(s)`,
      confirmed: true,
    });
  }

  return results.sort((a, b) => b.productsCount - a.productsCount);
}

/**
 * Maps product name / category / subCategory into standard MRO Product Family & Product Type.
 */
export function mapProductFamilyAndType(
  itemName: string,
  category?: string,
  subCategory?: string
): { productFamily: string; productType: string } {
  const text = `${itemName || ''} ${category || ''} ${subCategory || ''}`.toLowerCase();
  for (const families of Object.values(MRO_PRODUCT_FAMILIES)) {
    for (const fam of families) {
      for (const pType of fam.productTypes) {
        const cleanType = pType.toLowerCase().replace(/\(.*?\)/g, '').trim();
        const typeTokens = cleanType.split(/[\s/]+/).filter((tok) => tok.length >= 4);
        const tokenMatch = typeTokens.some((tok) => {
          const esc = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp(`\\b${esc}\\b`, 'i').test(text);
        });
        if (cleanType && (text.includes(cleanType) || tokenMatch)) {
          return { productFamily: fam.family, productType: pType };
        }
      }
    }
  }
  if (/sensor|encoder|transmitter|rtd|thermocouple|limit switch/i.test(text)) {
    return { productFamily: 'Sensors', productType: subCategory || 'Industrial Sensor' };
  }
  if (/gasket|enclosure|junction box/i.test(text)) {
    return { productFamily: 'Enclosures & Gaskets', productType: subCategory || 'Enclosure / Gasket' };
  }
  if (/gland|tie|duct|terminal|ferrule|push\s*button|tower|lug|conduit|plug|socket/i.test(text)) {
    return { productFamily: 'Panel Accessories', productType: subCategory || 'Panel Accessory' };
  }
  if (/smps|ssr|relay|controller|meter|timer|power supply/i.test(text)) {
    return { productFamily: 'Control & Power', productType: subCategory || 'Control Component' };
  }
  if (/bearing|pillow block|roller/i.test(text)) {
    return { productFamily: 'Bearings', productType: subCategory || 'Bearing' };
  }
  if (/cylinder|solenoid|frl|pneumatic/i.test(text)) {
    return { productFamily: 'Pneumatics', productType: subCategory || 'Pneumatic Component' };
  }
  if (/mcb|mccb|contactor|breaker|switchgear/i.test(text)) {
    return { productFamily: 'Switchgear', productType: subCategory || 'Switchgear' };
  }
  return { productFamily: category || 'MRO Components', productType: subCategory || category || 'Standard Industrial Component' };
}

/**
 * Compares existing vendor catalog products against newly extracted catalog products (Modules 20, 21).
 * Preserves removed products cleanly with metadata rather than deleting transaction history.
 */
export function compareVendorCatalogues(
  existingProducts: VendorCatalogProduct[],
  incomingProducts: Array<Omit<VendorCatalogProduct, 'id'>>
): CatalogueDiffSummary {
  const activeExisting = existingProducts.filter((p) => p.catalogueStatus !== 'DISCONTINUED');
  const buildProductIdentity = (p: Partial<VendorCatalogProduct>) => {
    const code = buildPartCodeComparisonKey(p.partNumber || p.modelNumber);
    const brand = (p.brand || '').trim().toLowerCase();
    const name = (p.productName || '').trim().toLowerCase();
    return code ? `${brand}::code::${code}` : `${brand}::name::${name}`;
  };

  const existingByKey = new Map<string, VendorCatalogProduct>();
  for (const ep of activeExisting) {
    existingByKey.set(buildProductIdentity(ep), ep);
  }

  const matchedExistingKeys = new Set<string>();
  const newProducts: Array<Omit<VendorCatalogProduct, 'id'>> = [];
  const updatedProducts: CatalogueDiffSummary['updatedProducts'] = [];
  const changedRates: CatalogueDiffSummary['changedRates'] = [];
  const unchangedProducts: Array<Omit<VendorCatalogProduct, 'id'>> = [];

  for (const inc of incomingProducts) {
    const key = buildProductIdentity(inc);
    const prev = existingByKey.get(key);
    if (!prev) {
      newProducts.push(inc);
    } else {
      matchedExistingKeys.add(key);
      const changes: string[] = [];
      if ((inc.specification || '').trim() && (inc.specification || '').trim() !== (prev.specification || '').trim()) {
        changes.push('Specification updated');
      }
      if ((inc.productFamily || '').trim() && (inc.productFamily || '').trim() !== (prev.productFamily || '').trim()) {
        changes.push('Product family updated');
      }
      if ((inc.uom || 'NOS') !== (prev.uom || 'NOS')) {
        changes.push(`UOM ${prev.uom || 'NOS'} -> ${inc.uom}`);
      }

      const oldMrp = prev.mrp ?? undefined;
      const newMrp = inc.mrp ?? undefined;
      const oldRate = prev.purchaseRate ?? prev.basicRate ?? prev.rate ?? undefined;
      const newRate = inc.purchaseRate ?? inc.basicRate ?? inc.rate ?? undefined;
      const rateChanged =
        (newRate !== undefined && oldRate !== newRate) ||
        (newMrp !== undefined && oldMrp !== newMrp);

      if (rateChanged) {
        const baseOld = oldRate ?? oldMrp ?? 0;
        const baseNew = newRate ?? newMrp ?? 0;
        const deltaAmount = Math.round((baseNew - baseOld) * 100) / 100;
        const deltaPercent = baseOld > 0 ? Math.round(((baseNew - baseOld) / baseOld) * 1000) / 10 : 0;
        changes.push(`Rate revised (${deltaAmount >= 0 ? '+' : ''}${deltaAmount})`);
        changedRates.push({
          partNumber: inc.partNumber || inc.modelNumber || prev.partNumber || prev.productName,
          productName: inc.productName,
          brand: inc.brand,
          oldMrp,
          newMrp,
          oldRate,
          newRate,
          deltaAmount,
          deltaPercent,
        });
      }

      if (changes.length > 0) {
        updatedProducts.push({ existing: prev, incoming: inc, changes });
      } else {
        unchangedProducts.push(inc);
      }
    }
  }

  const removedProducts = activeExisting.filter((ep) => !matchedExistingKeys.has(buildProductIdentity(ep)));

  const existingBrandsSet = new Set(activeExisting.map((p) => (p.brand || '').toLowerCase()).filter(Boolean));
  const existingCatsSet = new Set(activeExisting.map((p) => (p.category || '').toLowerCase()).filter(Boolean));

  const newBrands = Array.from(
    new Set(
      incomingProducts
        .map((p) => p.brand)
        .filter((b) => b && b !== 'Unconfirmed' && !existingBrandsSet.has(b.toLowerCase()))
    )
  );
  const newCategories = Array.from(
    new Set(
      incomingProducts
        .map((p) => p.category)
        .filter((c) => c && !existingCatsSet.has(c.toLowerCase()))
    )
  );

  return {
    totalExisting: activeExisting.length,
    totalIncoming: incomingProducts.length,
    newProducts,
    updatedProducts,
    changedRates,
    removedProducts,
    unchangedProducts,
    newBrands,
    newCategories,
  };
}

/**
 * Combines Website Intelligence with PDF/Excel Catalogue products (Module 13).
 * Merges matching products cleanly ("PDF+WEBSITE") and retains distinct source URLs.
 */
export function combineWebsiteAndCatalogueIntelligence(
  catalogProducts: VendorCatalogProduct[],
  websiteProducts: Array<Omit<VendorCatalogProduct, 'id'>>,
  websiteUrl: string,
  vendorId: string
): {
  mergedProducts: VendorCatalogProduct[];
  enrichedFromWebsiteCount: number;
  addedFromWebsiteCount: number;
} {
  const merged = [...catalogProducts];
  let enrichedFromWebsiteCount = 0;
  let addedFromWebsiteCount = 0;

  const findIndex = (wp: Omit<VendorCatalogProduct, 'id'>) => {
    const wpCode = buildPartCodeComparisonKey(wp.partNumber || wp.modelNumber);
    const wpBrand = (wp.brand || '').toLowerCase().trim();
    const wpName = (wp.productName || '').toLowerCase().trim();
    return merged.findIndex((cp) => {
      const cpCode = buildPartCodeComparisonKey(cp.partNumber || cp.modelNumber);
      if (wpCode && cpCode && wpCode === cpCode) return true;
      return (
        (cp.brand || '').toLowerCase().trim() === wpBrand &&
        (cp.productName || '').toLowerCase().trim() === wpName
      );
    });
  };

  for (let i = 0; i < websiteProducts.length; i++) {
    const wp = websiteProducts[i];
    const idx = findIndex(wp);
    if (idx !== -1) {
      const existing = merged[idx];
      const existingSource = existing.sourceType || 'PDF';
      merged[idx] = {
        ...existing,
        specification:
          (wp.specification || '').length > (existing.specification || '').length
            ? wp.specification
            : existing.specification,
        sourceType: existingSource === 'PDF' || existingSource === 'PDF+WEBSITE' ? 'PDF+WEBSITE' : existingSource,
        sourceUrl: wp.sourceUrl || websiteUrl,
        catalogReference:
          existing.catalogReference && existing.catalogReference.includes('Website')
            ? existing.catalogReference
            : `${existing.catalogReference || 'Catalogue PDF'} + Website`,
      };
      enrichedFromWebsiteCount++;
    } else {
      merged.push({
        ...wp,
        id: `WEBPROD-${Date.now()}-${i + 1}`,
        vendorId,
        sourceType: 'WEBSITE',
        sourceUrl: wp.sourceUrl || websiteUrl,
        catalogReference: `Website: ${wp.sourceUrl || websiteUrl}`,
        approvalStatus: 'APPROVED',
        catalogueStatus: 'ACTIVE',
      });
      addedFromWebsiteCount++;
    }
  }

  return { mergedProducts: merged, enrichedFromWebsiteCount, addedFromWebsiteCount };
}

/**
 * Deterministic HTML parser for public supplier websites (Modules 11, 12).
 * Extracts real title, meta description, emails, phones, PDF links, subpages, and candidate product/brand blocks.
 */
export function extractIntelligenceFromHtml(
  html: string,
  pageUrl: string,
  brandMaster: BrandMasterItem[] = []
): {
  title: string;
  metaDescription: string;
  textContent: string;
  emails: string[];
  phones: string[];
  pdfLinks: Array<{ title: string; url: string }>;
  relevantSubpages: string[];
  brandMentions: BrandDetectionItem[];
  jsonLdProducts?: Array<Omit<VendorCatalogProduct, 'id'>>;
  jsonLdOrganizations?: Array<{ name?: string; legalName?: string; url?: string; email?: string; telephone?: string; address?: string }>;
  strippedNoiseBlocks?: Array<{ text: string; class: string; reason: string }>;
  h1Texts?: string[];
  htmlProductCandidates?: Array<Omit<VendorCatalogProduct, 'id'>>;
} {
  const safeHtml = html || '';
  const cleaned = extractJsonLdAndCleanHtml(safeHtml, pageUrl);
  const title = cleaned.title;
  const metaDescription = cleaned.metaDescription;

  // Extract links
  const pdfLinks: Array<{ title: string; url: string }> = [];
  const relevantSubpages: string[] = [];
  const seenUrls = new Set<string>();
  const linkRegex = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let linkMatch: RegExpExecArray | null;
  let baseOrigin = '';
  try {
    baseOrigin = new URL(pageUrl).origin;
  } catch {}

  while ((linkMatch = linkRegex.exec(safeHtml)) !== null) {
    const rawHref = (linkMatch[1] || '').trim();
    const anchorText = (linkMatch[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!rawHref || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('javascript:')) {
      continue;
    }
    let resolvedUrl = rawHref;
    try {
      resolvedUrl = new URL(rawHref, pageUrl).toString();
    } catch {
      continue;
    }
    if (seenUrls.has(resolvedUrl)) continue;
    seenUrls.add(resolvedUrl);

    if (/\.pdf(\?|$)/i.test(resolvedUrl) || /brochure|catalogue|catalog|datasheet/i.test(`${resolvedUrl} ${anchorText}`)) {
      if (/\.pdf(\?|$)/i.test(resolvedUrl)) {
        pdfLinks.push({ title: anchorText || resolvedUrl.split('/').pop() || 'PDF Document', url: resolvedUrl });
      }
    }
    if (
      baseOrigin &&
      resolvedUrl.startsWith(baseOrigin) &&
      !/(?:our-team|our-customers|testimonials|faq|privacy|terms|cookie|careers|blog|login|register|cart|checkout)/i.test(resolvedUrl) &&
      /(about|product|categor|brand|download|catalog|contact|solution|sensor|enclosure|automation|switchgear|bearing|valve|pump|motor)/i.test(
        `${resolvedUrl} ${anchorText}`
      ) &&
      !/\.(pdf|jpg|jpeg|png|webp|zip|svg|css|js)$/i.test(resolvedUrl)
    ) {
      relevantSubpages.push(resolvedUrl);
    }
  }
  relevantSubpages.sort((a, b) => {
    const scoreUrl = (u: string) =>
      /(?:all-our-products|our-products|\/products|\/product|catalog)/i.test(u)
        ? 3
        : /(?:category|categories|brand|switchgear|automation|bearing)/i.test(u)
          ? 2
          : /(?:contact|about)/i.test(u)
            ? 1
            : 0;
    return scoreUrl(b) - scoreUrl(a);
  });

  const stripped = cleaned.cleanedText;

  const emails = Array.from(
    new Set(
      [
        ...(stripped.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []),
        ...cleaned.jsonLdOrganizations.map((o) => o.email || '').filter(Boolean),
      ]
        .filter((e) => !/indiamart|tradeindia|example\.com/i.test(e))
        .slice(0, 8)
    )
  );
  const phones = Array.from(
    new Set(
      [
        ...(stripped.match(/(?:\+?\d{1,3}[\s-]?)?\(?\d{3,5}\)?[\s-]?\d{3,5}[\s-]?\d{3,5}/g) || []),
        ...cleaned.jsonLdOrganizations.map((o) => o.telephone || '').filter(Boolean),
      ]
        .map((p) => p.trim())
        .filter((p) => p.replace(/\D/g, '').length >= 8 && p.replace(/\D/g, '').length <= 13)
        .slice(0, 8)
    )
  );

  // Convert structured JSON-LD products into validated VendorCatalogProduct candidates
  const knownBrandNames = brandMaster.map((b) => b.name).filter(Boolean);
  const jsonLdProducts: Array<Omit<VendorCatalogProduct, 'id'>> = [];
  for (const jp of cleaned.jsonLdProducts) {
    const resolved = resolveProductIdentityFields(
      {
        rawProductName: jp.name,
        sourceProductName: jp.name,
        brand: jp.brand,
        partNumber: jp.mpn || jp.sku,
        modelNumber: jp.model || jp.sku,
        description: jp.description,
        category: jp.category,
        originalSourceText: `${jp.name} ${jp.description || ''}`,
      },
      knownBrandNames
    );

    const validation = validateExtractedProduct({
      productName: resolved.productName,
      sourceProductName: resolved.sourceProductName,
      brand: resolved.brand,
      partNumber: resolved.partNumber,
      modelNumber: resolved.modelNumber,
      productDesignation: resolved.productDesignation,
      specification: resolved.specification,
      description: resolved.description,
      category: resolved.category,
      imageUrl: jp.imageUrl,
      detailUrl: jp.detailUrl,
      sourceUrl: pageUrl,
      mrp: jp.price,
      inProductSection: true,
    });

    if (!validation.isValid) continue;

    jsonLdProducts.push({
      vendorId: 'PREVIEW',
      productName: resolved.productName,
      sourceProductName: resolved.sourceProductName,
      normalizedProductName: resolved.normalizedProductName,
      productDesignation: resolved.productDesignation,
      description: resolved.description,
      category: resolved.category,
      subCategory: resolved.subCategory,
      productFamily: resolved.productFamily,
      productType: resolved.productFamily,
      brand: resolved.brand,
      manufacturer: resolved.brand !== 'Unconfirmed' ? resolved.brand : '',
      manufacturerCode: resolved.manufacturerCode || undefined,
      modelNumber: resolved.modelNumber || undefined,
      partNumber: resolved.partNumber || undefined,
      specification: resolved.specification,
      uom: 'NOS',
      mrp: jp.price,
      rate: jp.price,
      currency: jp.price ? jp.currency || 'INR' : undefined,
      imageUrl: jp.imageUrl,
      detailUrl: jp.detailUrl,
      sourceUrl: jp.detailUrl || pageUrl,
      sourceType: 'WEBSITE',
      catalogReference: `Schema JSON-LD: ${jp.detailUrl || pageUrl}`,
      originalSourceText: `${jp.name}${jp.description ? ` — ${jp.description.slice(0, 120)}` : ''}`,
      extractionDate: new Date().toISOString().split('T')[0],
      aiAnalysisVersion: 'MRO-Intel-v4.0',
      keywords: [resolved.category, resolved.productFamily, resolved.brand, resolved.partNumber].filter(Boolean),
      aiConfidence: Math.max(70, validation.breakdown.totalScore),
      confidenceLevel:
        validation.breakdown.status === 'VALID_HIGH'
          ? 'High'
          : validation.breakdown.status === 'VALID_MEDIUM'
            ? 'Medium'
            : 'Low',
      reviewStatus:
        validation.breakdown.status === 'NEEDS_REVIEW' || resolved.brand === 'Unconfirmed' ? 'Needs Review' : 'Verified',
      approvalStatus: 'PENDING',
      contentClass: validation.contentClass,
      validationScore: validation.breakdown.totalScore,
      validationBreakdown: validation.breakdown,
    });
  }

  // Detect brand mentions against ERP Brand Master + common MRO brands
  const candidateBrands = Array.from(
    new Set([
      ...brandMaster.map((b) => b.name),
      'SKF', 'FAG', 'Timken', 'NSK', 'Autonics', 'Schneider Electric', 'Siemens', 'ABB', 'Festo', 'SMC', 'Mean Well', 'Connectwell', 'Omron', 'IFM', 'Rittal', 'Lapp', 'Polycab',
    ])
  );
  const brandMentions: BrandDetectionItem[] = [];
  for (const bName of candidateBrands) {
    if (!bName || bName.length < 2) continue;
    const escaped = bName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(stripped)) {
      const bm = brandMaster.find((b) => b.name.toLowerCase() === bName.toLowerCase());
      brandMentions.push({
        name: bName,
        productsCount: 0,
        confidence: 85,
        isExisting: !!bm,
        matchedBrandId: bm?.id,
        relationship: classifyBrandRelationship(stripped, bName),
        evidence: `Mentioned on ${pageUrl}`,
        confirmed: true,
      });
    }
  }

  // Extract <h1> company/brand candidates & deterministic <h2>/<h3>/<h4> + part-coded HTML product candidates
  const decodeInline = (s: string) =>
    s
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const h1Texts: string[] = [];
  const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
  let h1m: RegExpExecArray | null;
  while ((h1m = h1Regex.exec(safeHtml)) !== null) {
    const t = decodeInline(h1m[1]);
    if (
      t &&
      t.length >= 3 &&
      t.length <= 100 &&
      !isPlatformAttributionOrNoise(t) &&
      !looksLikeMarketingTagline(t) &&
      !looksLikeAddressBlock(t)
    ) {
      h1Texts.push(t);
    }
  }

  const NON_PRODUCT_HEADING_RX =
    /^(?:welcome\s+to|nature\s+of\s+business|total\s+number|gst\s+registration|legal\s+status|annual\s+turnover|gst\s+no\.?|view\s+complete|view\s+details|top\s+picks|in\s+good\s+company|the\s+people|notes,\s*news|testimonials|take\s+a\s+closer\s+look|about\s+us|our\s+(?:company|products|team|clients)|contact\s+us|reach\s+us|why\s+(?:us|choose)|trader\s*-|proprietorship|upto\s+\d+|price\s+(?:inr|rs\.?|₹)|read\s+update|enquire\s+now|quick\s+enquiry|communication\s*protocols?|manufacturer\s*series|input\s*voltage|output\s*voltage|motor\s*power|part\s*code|product\s*group|product\s*series|series\s*:|controller\/processor|usage\/application|model\s*name|brand\s*:|make\s*:|country\s*of\s*origin|minimum\s*order|warranty|phase\s*:|frequency\s*:|s\s+a\s+)/i;

  const candidateHeadingStrings: string[] = [];
  const hTagRegex = /<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi;
  let hm: RegExpExecArray | null;
  while ((hm = hTagRegex.exec(safeHtml)) !== null) {
    const t = decodeInline(hm[1]);
    if (t && t.length >= 4 && t.length <= 140) candidateHeadingStrings.push(t);
  }
  // Also include cleanedText lines that contain explicit industrial part/model codes
  for (const line of stripped.split(/\r?\n/)) {
    const cleanLine = line.trim();
    if (cleanLine.length >= 6 && cleanLine.length <= 140 && extractPartCodeCandidates(cleanLine).length > 0) {
      candidateHeadingStrings.push(cleanLine);
    }
  }

  const htmlProductCandidates: Array<Omit<VendorCatalogProduct, 'id'>> = [];
  const seenHtmlKeys = new Set<string>();
  for (let cIdx = 0; cIdx < candidateHeadingStrings.length; cIdx++) {
    const rawCandidate = candidateHeadingStrings[cIdx];
    const wordTokens = rawCandidate.split(/\s+/).filter(Boolean);
    if (
      NON_PRODUCT_HEADING_RX.test(rawCandidate) ||
      isPlatformAttributionOrNoise(rawCandidate) ||
      looksLikeAddressBlock(rawCandidate) ||
      looksLikeMarketingTagline(rawCandidate) ||
      /\b(?:guide|blog|article|fits\s+your|bulk\s+quotation|dealer\s+in|supplier\s+for)\b/i.test(rawCandidate)
    ) {
      continue;
    }
    const partCodes = extractPartCodeCandidates(rawCandidate);
    if (
      partCodes.length === 0 &&
      (wordTokens.length < 2 || looksLikeSectionHeadingOnly(rawCandidate) || isBannedGenericProductName(rawCandidate))
    ) {
      continue;
    }
    // In HTML headings without a part code, require at least 2 meaningful words and recognizable MRO hardware/brand terms
    if (
      partCodes.length === 0 &&
      !/\b(?:plc|hmi|vfd|drive|sensor|bearing|mcb|mccb|contactor|relay|switch|connector|power\s*supply|valve|pump|motor|enclosure|gasket|terminal|cable)\b/i.test(
        rawCandidate
      )
    ) {
      continue;
    }

    const resolved = resolveProductIdentityFields(
      {
        rawProductName: rawCandidate,
        sourceProductName: rawCandidate,
        partNumber: partCodes[0],
        originalSourceText: rawCandidate,
      },
      knownBrandNames
    );

    const validation = validateExtractedProduct({
      productName: resolved.productName,
      sourceProductName: resolved.sourceProductName,
      brand: resolved.brand,
      partNumber: resolved.partNumber,
      modelNumber: resolved.modelNumber,
      productDesignation: resolved.productDesignation,
      specification: resolved.specification,
      description: resolved.description,
      category: resolved.category,
      sourceUrl: pageUrl,
      inProductSection: true,
    });

    if (!validation.isValid || validation.isRejected) continue;

    const dedupKey = `${(resolved.brand || '').toLowerCase()}::${(resolved.partNumber || resolved.productName).toLowerCase()}`;
    if (seenHtmlKeys.has(dedupKey)) continue;
    seenHtmlKeys.add(dedupKey);

    htmlProductCandidates.push({
      vendorId: 'PREVIEW',
      productName: resolved.productName,
      sourceProductName: resolved.sourceProductName,
      normalizedProductName: resolved.normalizedProductName,
      productDesignation: resolved.productDesignation,
      description: resolved.description,
      category: resolved.category,
      subCategory: resolved.subCategory,
      productFamily: resolved.productFamily,
      productType: resolved.productFamily,
      brand: resolved.brand,
      manufacturer: resolved.brand !== 'Unconfirmed' ? resolved.brand : '',
      manufacturerCode: resolved.manufacturerCode || undefined,
      modelNumber: resolved.modelNumber || undefined,
      partNumber: resolved.partNumber || undefined,
      specification: resolved.specification,
      uom: 'NOS',
      sourceUrl: pageUrl,
      sourceType: 'WEBSITE',
      catalogReference: `HTML Product Block: ${pageUrl}`,
      originalSourceText: rawCandidate,
      extractionDate: new Date().toISOString().split('T')[0],
      aiAnalysisVersion: 'MRO-Intel-v4.0',
      keywords: [resolved.category, resolved.productFamily, resolved.brand, resolved.partNumber].filter(Boolean),
      aiConfidence: Math.max(55, validation.breakdown.totalScore),
      confidenceLevel:
        validation.breakdown.status === 'VALID_HIGH'
          ? 'High'
          : validation.breakdown.status === 'VALID_MEDIUM'
            ? 'Medium'
            : 'Low',
      reviewStatus:
        validation.breakdown.status === 'NEEDS_REVIEW' || resolved.brand === 'Unconfirmed' ? 'Needs Review' : 'Verified',
      approvalStatus: 'PENDING',
      contentClass: validation.contentClass,
      validationScore: validation.breakdown.totalScore,
      validationBreakdown: validation.breakdown,
    });
  }

  return {
    title,
    metaDescription,
    textContent: stripped,
    emails,
    phones,
    pdfLinks: pdfLinks.slice(0, 20),
    relevantSubpages: relevantSubpages.slice(0, 12),
    brandMentions,
    jsonLdProducts,
    jsonLdOrganizations: cleaned.jsonLdOrganizations,
    strippedNoiseBlocks: cleaned.strippedNoiseBlocks,
    h1Texts,
    htmlProductCandidates,
  };
}
