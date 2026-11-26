import { MaterialCategory, Vendor, VendorRecommendation, CustomerRequirement } from '../types';
import { INITIAL_MATERIAL_CATEGORIES } from '../data/categoryMasterData';

export interface CategoryMatchResult {
  category: string;
  subCategory?: string;
  confidence: number; // 0 to 100
  matchedKeywords: string[];
  reasons: string[];
  alternativeCategories?: { category: string; confidence: number }[];
}

/**
 * Normalizes input text into clean lowercase token array and cleaned string
 */
function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\-\.\/ ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * Analyzes Item Name + Description + Specification to automatically recommend the best Material Category
 */
export function recommendCategoryForRequirement(
  item: {
    itemName: string;
    description?: string;
    specification?: string;
  },
  categories?: MaterialCategory[]
): CategoryMatchResult {
  const safeCategories = Array.isArray(categories) && categories.length > 0 ? categories : INITIAL_MATERIAL_CATEGORIES;
  const itemNameClean = (item.itemName || '').trim().toLowerCase();
  const descClean = (item.description || '').trim().toLowerCase();
  const specClean = (item.specification || '').trim().toLowerCase();

  const combinedText = `${itemNameClean} ${descClean} ${specClean}`.trim();
  const itemTokens = tokenize(itemNameClean);
  const allTokens = tokenize(combinedText);

  if (!itemNameClean && !combinedText) {
    return {
      category: '',
      subCategory: '',
      confidence: 0,
      matchedKeywords: [],
      reasons: ['No item details provided. Please enter item name or select a category.'],
      alternativeCategories: [],
    };
  }

  // Explicit High-Priority Industrial Domain Rules
  // 1. Molded Case Circuit Breaker (MCCB), MCB, Fuses, Switchgear -> Electrical
  if (
    /\b(mccb|mcb|circuit breaker|molded case circuit breaker|moulded case circuit breaker|fuse|fuses|5a fuse|10a fuse|16a fuse|32a fuse|63a fuse|100a fuse|hrc fuse|contactor|overload relay|smps|transformer|switchgear)\b/i.test(
      itemNameClean || combinedText
    )
  ) {
    const electricalCat = safeCategories.find(
      (c) => c.name.toLowerCase() === 'electrical' || c.code === 'ELE'
    ) || safeCategories.find((c) => c.name.toLowerCase().includes('electrical')) || safeCategories.find((c) => c.name.toLowerCase().includes('switchgear'));

    if (electricalCat) {
      const elecSubs = electricalCat.subCategories || [];
      let sub = elecSubs.find((s) => /mccb|circuit breaker/i.test(s));
      if (!sub && /\bfuse\b/i.test(itemNameClean)) {
        sub = elecSubs.find((s) => /fuse/i.test(s));
      }
      return {
        category: electricalCat.name,
        subCategory: sub || elecSubs[0] || 'Circuit Breakers',
        confidence: 96,
        matchedKeywords: ['MCCB / Circuit Breaker / Electrical Protection'],
        reasons: ['Identified electrical circuit protection / switchgear equipment'],
        alternativeCategories: safeCategories
          .filter((c) => c.name !== electricalCat.name && ['Switchgear', 'Fuses & Protection Devices', 'Automation / PLC / HMI'].includes(c.name))
          .map((c) => ({ category: c.name, confidence: 80 })),
      };
    }
  }

  // 2. Bearings: Deep Groove, Ball Bearing, Roller Bearing, Bearing Codes (e.g. 6205, 6206, 22212)
  if (
    /\b(bearing|bearings|ball bearing|roller bearing|deep groove|taper roller|spherical roller|pillow block|plummer block|needle bearing|thrust bearing|6204|6205|6206|6207|6208|6305|6306|6308|22212|22216|30206|32208|7206)\b/i.test(
      itemNameClean || combinedText
    )
  ) {
    const bearingCat = safeCategories.find(
      (c) => c.name.toLowerCase() === 'bearings' || c.code === 'BRG'
    ) || safeCategories.find((c) => c.name.toLowerCase().includes('bearing'));

    if (bearingCat) {
      let sub = 'Deep Groove Ball Bearings';
      if (/spherical/i.test(combinedText)) sub = 'Spherical Roller Bearings';
      else if (/taper/i.test(combinedText)) sub = 'Taper Roller Bearings';
      else if (/pillow|ucp|ucf/i.test(combinedText)) sub = 'Pillow Block Units (UCP/UCF)';
      else if (/needle/i.test(combinedText)) sub = 'Needle Roller Bearings';

      return {
        category: bearingCat.name,
        subCategory: sub,
        confidence: 98,
        matchedKeywords: ['Bearing Specification / Standard Series'],
        reasons: ['Identified industrial rolling element bearing'],
        alternativeCategories: [],
      };
    }
  }

  // 3. Lubricants & Greases: MOSIL, FG800, Grease, Synthetic Oil
  if (
    /\b(grease|lubricant|lubricants|mosil|fg800|kluber|mobil|synthetic oil|gear oil|hydraulic oil|anti seize|wd-40|bearing grease)\b/i.test(
      itemNameClean || combinedText
    )
  ) {
    const lubeCat = safeCategories.find(
      (c) => c.name.toLowerCase().includes('lubricant') || c.name.toLowerCase().includes('grease')
    );
    if (lubeCat) {
      const lubeSubs = lubeCat.subCategories || [];
      return {
        category: lubeCat.name,
        subCategory: lubeSubs[0] || 'Greases',
        confidence: 95,
        matchedKeywords: ['Industrial Lubricant / Grease Compound'],
        reasons: ['Identified lubricant, specialty grease or industrial oil'],
        alternativeCategories: [],
      };
    }
  }

  // 4. Pneumatics: Festo, SMC, Pneumatic Cylinder, FRL
  if (
    /\b(pneumatic|pneumatics|festo|smc|janatics|air cylinder|pneumatic cylinder|frl|pu tube|pu tubing|airtac)\b/i.test(
      itemNameClean || combinedText
    )
  ) {
    const pneuCat = safeCategories.find(
      (c) => c.name.toLowerCase().includes('pneumatic')
    );
    if (pneuCat) {
      const pneuSubs = pneuCat.subCategories || [];
      return {
        category: pneuCat.name,
        subCategory: pneuSubs[0] || 'Pneumatic Cylinders',
        confidence: 96,
        matchedKeywords: ['Pneumatic Actuator / Automation Component'],
        reasons: ['Identified compressed air pneumatic automation spare'],
        alternativeCategories: [],
      };
    }
  }

  // 5. Belts & Power Transmission: Timing belt, V-belt, Pulley, Sprocket
  if (
    /\b(timing belt|v-belt|v belt|industrial belt|conveyor belt|belt|pulleys|pulley|sprocket|sprockets|coupling|roller chain|gates|fenner|optibelt|htd)\b/i.test(
      itemNameClean || combinedText
    )
  ) {
    const beltCat = safeCategories.find(
      (c) => c.name.toLowerCase().includes('belt') || c.name.toLowerCase().includes('transmission')
    );
    if (beltCat) {
      const beltSubs = beltCat.subCategories || [];
      return {
        category: beltCat.name,
        subCategory: /timing/i.test(combinedText) ? 'Timing Belts' : beltSubs[0] || 'V-Belts',
        confidence: 95,
        matchedKeywords: ['Industrial Drive Belt / Power Transmission'],
        reasons: ['Identified power transmission belt / drive element'],
        alternativeCategories: [],
      };
    }
  }

  // 6. Valves
  if (/\b(valve|valves|ball valve|butterfly valve|globe valve|gate valve|check valve|knife gate)\b/i.test(itemNameClean || combinedText)) {
    const valveCat = safeCategories.find((c) => c.name.toLowerCase().includes('valve'));
    if (valveCat) {
      const valveSubs = valveCat.subCategories || [];
      return {
        category: valveCat.name,
        subCategory: valveSubs[0] || 'Ball Valves',
        confidence: 95,
        matchedKeywords: ['Industrial Process Valve'],
        reasons: ['Identified flow control valve equipment'],
        alternativeCategories: [],
      };
    }
  }

  // 7. Motors
  if (/\b(motor|motors|induction motor|flameproof motor|brake motor|geared motor)\b/i.test(itemNameClean || combinedText)) {
    const motorCat = safeCategories.find((c) => c.name.toLowerCase().includes('motor'));
    if (motorCat) {
      const motorSubs = motorCat.subCategories || [];
      return {
        category: motorCat.name,
        subCategory: motorSubs[0] || 'Three Phase Induction Motors',
        confidence: 95,
        matchedKeywords: ['Electric Motor / Geared Drive'],
        reasons: ['Identified industrial electric motor equipment'],
        alternativeCategories: [],
      };
    }
  }

  // 8. Pumps
  if (/\b(pump|pumps|centrifugal pump|submersible pump|dosing pump)\b/i.test(itemNameClean || combinedText)) {
    const pumpCat = safeCategories.find((c) => c.name.toLowerCase().includes('pump'));
    if (pumpCat) {
      const pumpSubs = pumpCat.subCategories || [];
      return {
        category: pumpCat.name,
        subCategory: pumpSubs[0] || 'Centrifugal Pumps',
        confidence: 95,
        matchedKeywords: ['Industrial Fluid Pump'],
        reasons: ['Identified fluid handling pump'],
        alternativeCategories: [],
      };
    }
  }

  // General Category Scoring across Master Database
  const scores: {
    category: MaterialCategory;
    score: number;
    matchedKeywords: string[];
    matchedSubCategory?: string;
    reasons: string[];
  }[] = [];

  const activeCategories = safeCategories.filter((c) => c.isActive && c.name.toLowerCase() !== 'other');

  for (const cat of activeCategories) {
    let score = 0;
    const matchedKeywords: string[] = [];
    let matchedSubCat: string | undefined = undefined;
    const reasons: string[] = [];

    const catNameLower = cat.name.toLowerCase();

    // 1. Direct Category Name match in itemName (High weight: 60)
    if (itemNameClean.includes(catNameLower)) {
      score += 60;
      matchedKeywords.push(cat.name);
      reasons.push(`Direct category match in item name: "${cat.name}"`);
    } else if (combinedText.includes(catNameLower)) {
      score += 25;
      matchedKeywords.push(cat.name);
    }

    // 2. Keyword & Alias matches
    for (const kw of (cat.keywords || [])) {
      const kwLower = (kw || '').toLowerCase().trim();
      if (!kwLower) continue;

      if (itemNameClean.includes(kwLower)) {
        // High priority for item name match
        score += 35;
        if (!matchedKeywords.includes(kw)) matchedKeywords.push(kw);
      } else if (combinedText.includes(kwLower)) {
        score += 15;
        if (!matchedKeywords.includes(kw)) matchedKeywords.push(kw);
      }
    }

    // 3. Sub-Category match
    for (const sub of (cat.subCategories || [])) {
      const subLower = (sub || '').toLowerCase();
      if (itemNameClean.includes(subLower)) {
        score += 45;
        matchedSubCat = sub;
        reasons.push(`Sub-category match in item name: "${sub}"`);
        break;
      } else if (combinedText.includes(subLower)) {
        score += 20;
        matchedSubCat = sub;
        break;
      }
    }

    if (score > 0) {
      scores.push({
        category: cat,
        score,
        matchedKeywords,
        matchedSubCategory: matchedSubCat,
        reasons,
      });
    }
  }

  // Sort descending by match score
  scores.sort((a, b) => b.score - a.score);

  // If score is too low (< 30) or no matches, return clean empty result for manual selection
  if (scores.length === 0 || scores[0].score < 30) {
    return {
      category: '',
      subCategory: '',
      confidence: 0,
      matchedKeywords: [],
      reasons: ['No confident category match found. Please select category manually.'],
      alternativeCategories: [],
    };
  }

  const topMatch = scores[0];
  const maxPossible = Math.max(topMatch.score, 60);
  const confidence = Math.min(Math.round((topMatch.score / maxPossible) * 98), 98);

  const alternativeCategories = scores
    .slice(1, 4)
    .filter((s) => s.score >= 20)
    .map((s) => ({
      category: s.category.name,
      confidence: Math.min(Math.round((s.score / maxPossible) * 90), 90),
    }));

  return {
    category: topMatch.category.name,
    subCategory: topMatch.matchedSubCategory || (topMatch.category.subCategories && topMatch.category.subCategories[0]) || '',
    confidence: Math.max(confidence, 45),
    matchedKeywords: topMatch.matchedKeywords,
    reasons: topMatch.reasons.length > 0 ? topMatch.reasons : [`Matched keywords: ${topMatch.matchedKeywords.slice(0, 3).join(', ')}`],
    alternativeCategories,
  };
}

/**
 * Finds and ranks relevant vendors for a given requirement
 */
export function recommendVendorsForRequirement(
  params: {
    category: string;
    subCategory?: string;
    itemName?: string;
    description?: string;
    brand?: string;
    partNumber?: string;
    allowCategoryFallback?: boolean;
  },
  vendors: Vendor[],
  historicalRequirements: CustomerRequirement[] = []
): VendorRecommendation[] {
  const reqCategory = (params.category || '').trim().toLowerCase();
  const reqSubCat = (params.subCategory || '').trim().toLowerCase();
  const reqItemName = (params.itemName || '').trim().toLowerCase();
  const reqBrand = (params.brand || '').trim().toLowerCase();
  const reqPart = (params.partNumber || '').trim().toLowerCase();
  const reqDesc = (params.description || '').trim().toLowerCase();

  const results: VendorRecommendation[] = [];

  for (const v of vendors) {
    // 0. Filter out deleted, inactive or blocked vendors
    if (v.isDeleted || v.status === 'BLOCKED' || v.status === 'INACTIVE') {
      continue;
    }

    let matchScore = 0;
    const matchReasons: string[] = [];

    // 1. Exact Product Mapping Check (Highest Priority)
    const activeProducts = (v.productsSupplied || []).filter((p) => p.status === 'ACTIVE');
    const exactProdMatch = activeProducts.find((p) => {
      const pName = (p.productName || '').toLowerCase();
      const pPart = (p.partNumber || p.modelNumber || '').toLowerCase();
      const pBrand = (p.brand || '').toLowerCase();

      // Check part number match
      if (reqPart && pPart && (reqPart === pPart || pPart.includes(reqPart) || reqPart.includes(pPart))) return true;
      // Check item name match
      if (reqItemName && (pName === reqItemName || reqItemName.includes(pName) || pName.includes(reqItemName))) {
        if (!reqBrand || pBrand.includes(reqBrand)) return true;
      }
      return false;
    });

    if (exactProdMatch) {
      matchScore += 70;
      matchReasons.push(`Exact Product Match: "${exactProdMatch.productName}" (${exactProdMatch.brand} ${exactProdMatch.partNumber || ''})`);
    } else {
      // 1b. Catalog Products match fallback (active catalogue items)
      const catProds = (v.catalogProducts || []).filter(
        (p) => p.approvalStatus !== 'REJECTED' && p.catalogueStatus !== 'DISCONTINUED' && p.catalogueStatus !== 'ARCHIVED'
      );
      const exactCatalogMatch = catProds.find((p) => {
        const pPart = (p.partNumber || p.modelNumber || '').trim().toLowerCase();
        return reqPart && pPart && pPart === reqPart;
      });
      const similarCatalogMatch =
        exactCatalogMatch ||
        catProds.find((p) => {
          const pPart = (p.partNumber || p.modelNumber || '').toLowerCase();
          const pName = (p.productName || '').toLowerCase();
          if (reqPart && pPart && pPart.includes(reqPart)) return true;
          if (reqItemName && (pName === reqItemName || reqItemName.includes(pName) || pName.includes(reqItemName))) return true;
          return false;
        });

      if (exactCatalogMatch) {
        const rateText = exactCatalogMatch.purchaseRate || exactCatalogMatch.rate || exactCatalogMatch.mrp;
        matchScore += 65;
        matchReasons.push(
          `Exact Product Match (Catalogue): "${exactCatalogMatch.productName}" (${exactCatalogMatch.brand} ${exactCatalogMatch.partNumber || ''})${rateText ? ` • Rate ₹${rateText}` : ''}`
        );
      } else if (similarCatalogMatch) {
        const rateText = similarCatalogMatch.purchaseRate || similarCatalogMatch.rate || similarCatalogMatch.mrp;
        matchScore += 50;
        matchReasons.push(
          `Similar Product (Catalogue): "${similarCatalogMatch.productName}" (${similarCatalogMatch.brand})${rateText ? ` • Rate ₹${rateText}` : ''}`
        );
      }
    }

    // 2. Matching Brand Check (including brandsDealing, brandAssociations & manufacturerAssociations)
    const vendorBrands = [
      ...(v.brandsSupplied || []),
      ...(v.brandsDealing || []),
      ...(v.brandAssociations || []).map((ba) => ba.brandName),
      ...(v.manufacturerAssociations || []).map((ma) => ma.brand),
      ...activeProducts.map((p) => p.brand).filter(Boolean),
    ].map((b) => b.toLowerCase());

    const hasBrandMatch =
      (reqBrand && vendorBrands.some((b) => b.includes(reqBrand) || reqBrand.includes(b))) ||
      vendorBrands.some((b) => b && reqItemName.includes(b));

    if (hasBrandMatch) {
      const matchedBrandName =
        v.brandsSupplied?.find((b) => reqBrand && b.toLowerCase().includes(reqBrand)) ||
        v.brandsDealing?.find((b) => reqBrand && b.toLowerCase().includes(reqBrand)) ||
        v.brandAssociations?.find((ba) => reqBrand && ba.brandName.toLowerCase().includes(reqBrand))?.brandName ||
        reqBrand ||
        'Mapped Brand';
      const brandAssoc = (v.brandAssociations || []).find(
        (ba) => ba.brandName.toLowerCase() === matchedBrandName.toLowerCase()
      );
      const assoc = (v.manufacturerAssociations || []).find(
        (m) => m.brand.toLowerCase() === matchedBrandName.toLowerCase()
      );
      const relLabel = brandAssoc?.relationshipType || assoc?.relationship || 'Deals In';
      matchScore +=
        relLabel === 'Authorised Distributor' || relLabel === 'OEM' || relLabel === 'Manufacturer' ? 40 : 35;
      matchReasons.push(`Matching brand (${relLabel}): "${matchedBrandName}"`);
    }

    // 3. Matching Product Type / Family / Subcategory
    const prodTypeMatch = activeProducts.some((p) => {
      const pSub = (p.subCategory || p.productType || '').toLowerCase();
      return reqSubCat && (pSub === reqSubCat || pSub.includes(reqSubCat) || reqSubCat.includes(pSub));
    });
    const familyMatch = (v.productFamilies || []).some(
      (f) =>
        (reqCategory && f.toLowerCase().includes(reqCategory)) ||
        (reqSubCat && f.toLowerCase().includes(reqSubCat)) ||
        (reqItemName && reqItemName.includes(f.toLowerCase()))
    );
    if (prodTypeMatch) {
      matchScore += 30;
      matchReasons.push(`Matching product type: Active catalog line in "${params.subCategory}"`);
    } else if (familyMatch) {
      matchScore += 22;
      matchReasons.push(`Product Family match in Vendor Intelligence`);
    } else if (v.subCategories && reqSubCat && v.subCategories.some((s) => s.toLowerCase() === reqSubCat)) {
      matchScore += 20;
      matchReasons.push(`Matching product type: Subcategory specialist in "${params.subCategory}"`);
    }

    // 4. Matching Specification (Dimensions, ratings, voltage, material)
    if (reqDesc) {
      const specMatch =
        activeProducts.some((p) => {
          const pSpec = (p.specification || '').toLowerCase();
          return pSpec && reqDesc.includes(pSpec);
        }) ||
        (v.catalogProducts || []).some((p) => {
          const pSpec = (p.specification || '').toLowerCase();
          return pSpec && reqDesc.includes(pSpec);
        });
      if (specMatch) {
        matchScore += 20;
        matchReasons.push('Matching specification & ratings');
      }
    }

    // 5. Category-Only Match (Lower Priority)
    const vendorCats = (v.materialCategories && v.materialCategories.length > 0 ? v.materialCategories : v.productCategories || []).map((c) =>
      c.toLowerCase()
    );
    const hasCategoryMatch = vendorCats.some((c) => c === reqCategory || reqCategory.includes(c) || c.includes(reqCategory));
    if (hasCategoryMatch) {
      if (!exactProdMatch && !prodTypeMatch) {
        matchScore += 15;
        matchReasons.push(`Category Supplier: "${params.category}"`);
      }
    }

    // 6. Previous Supply History Boost
    let previousSupplyCount = 0;
    let lastSuppliedDate: string | undefined = undefined;
    let lastQuotedPrice: number | undefined = undefined;

    if (v.supplyHistory && v.supplyHistory.length > 0) {
      const matchedHistory = v.supplyHistory.filter(
        (sh) => sh.category.toLowerCase() === reqCategory || (reqItemName && sh.itemName.toLowerCase().includes(reqItemName))
      );
      if (matchedHistory.length > 0) {
        previousSupplyCount = matchedHistory.length;
        lastSuppliedDate = matchedHistory[0].transactionDate;
        lastQuotedPrice = matchedHistory[0].rateSupplied;
        matchScore += Math.min(previousSupplyCount * 8, 24);
        matchReasons.push(`Supplied ${previousSupplyCount} previous orders in this domain`);
      }
    }

    // 7. Vendor Intelligence & Rating Boost
    if (v.intelligenceScore && v.intelligenceScore >= 70 && matchScore > 0) {
      matchScore += 6;
      matchReasons.push(`Intelligence Score: ${v.intelligenceScore}/100`);
    }
    if (v.rating && v.rating >= 4.5) {
      matchScore += 8;
      matchReasons.push(`Top vendor rating (${v.rating}/5.0)`);
    }

    // If score passes minimum threshold or has any match
    if (matchScore >= 15) {
      const finalScore = Math.min(matchScore, 99);
      let matchLevel: 'High' | 'Medium' | 'Low' = 'Low';
      if (finalScore >= 70) matchLevel = 'High';
      else if (finalScore >= 45) matchLevel = 'Medium';

      results.push({
        vendorId: v.id,
        vendorName: v.companyName,
        contactPerson: v.contactPerson,
        mobile: v.mobile,
        email: v.email,
        city: v.city,
        state: v.state,
        rating: v.rating || 4.2,
        materialCategories: v.materialCategories || v.productCategories || [],
        matchLevel,
        matchScore: finalScore,
        matchReasons: matchReasons.length > 0 ? matchReasons : ['Registered Supplier'],
        previousSupplyCount,
        lastSuppliedDate,
        lastQuotedPrice,
        status: v.status || 'ACTIVE',
        remarks: v.remarks,
      });
    }
  }

  // Rank exact product matches and highest scores first
  return results.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Counts how many vendors are mapped to each category
 */
export function getVendorCountByCategory(categories: MaterialCategory[], vendors: Vendor[]): Record<string, number> {
  const counts: Record<string, number> = {};

  categories.forEach((cat) => {
    counts[cat.name] = 0;
  });

  vendors.forEach((v) => {
    const cats = v.materialCategories && v.materialCategories.length > 0 ? v.materialCategories : v.productCategories || [];
    cats.forEach((c) => {
      if (counts[c] !== undefined) {
        counts[c]++;
      } else {
        counts[c] = (counts[c] || 0) + 1;
      }
    });
  });

  return counts;
}
