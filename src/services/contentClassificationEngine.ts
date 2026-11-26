/**
 * Pure deterministic MRO Content Classification, Product Identity Resolution & Validation Engine.
 * Runs identically in browser services, Node.js server endpoints, and unit tests.
 */

export type ContentClassificationClass =
  | 'COMPANY'
  | 'LEGAL_ENTITY'
  | 'BRAND'
  | 'PRODUCT'
  | 'PRODUCT_FAMILY'
  | 'CATEGORY'
  | 'SUBCATEGORY'
  | 'PART_CODE'
  | 'MODEL'
  | 'SPECIFICATION'
  | 'APPLICATION'
  | 'CONTACT'
  | 'ADDRESS'
  | 'EMAIL'
  | 'PHONE'
  | 'GST'
  | 'PAN'
  | 'MSME'
  | 'WEBSITE'
  | 'MARKETING'
  | 'TAGLINE'
  | 'NAVIGATION'
  | 'FOOTER'
  | 'LEGAL'
  | 'PLATFORM_ATTRIBUTION'
  | 'UNKNOWN';

export type SuspiciousRejectionCategory =
  | 'Platform Attribution'
  | 'Vendor Address'
  | 'Marketing Tagline'
  | 'Category / Product Family'
  | 'Pagination / Noise'
  | 'Navigation / Footer'
  | 'Banned Generic Name'
  | 'Brand-Only Text'
  | 'Contact / Legal Metadata'
  | 'Low Confidence Record';

export interface ExtractionValidationBreakdown {
  productSectionScore: number; // +25
  partOrModelCodeScore: number; // +25
  technicalSpecsScore: number; // +20
  productImageScore: number; // +10
  descriptionScore: number; // +10
  priceOrRateScore: number; // +5
  detailPageScore: number; // +5
  totalScore: number; // 0..100
  status: 'VALID_HIGH' | 'VALID_MEDIUM' | 'NEEDS_REVIEW' | 'REJECTED';
  reasons: string[];
}

export interface SuspiciousExtractedItem {
  id: string;
  rawText: string;
  contentClass: ContentClassificationClass;
  rejectionCategory: SuspiciousRejectionCategory;
  reason: string;
  score: number;
  sourceUrl?: string;
  sourcePage?: number | string;
  catalogueRow?: number;
  suggestedBrand?: string;
  suggestedCategory?: string;
  suggestedPartCode?: string;
  suggestedProductName?: string;
  status?: 'REJECTED' | 'NEEDS_REVIEW' | 'ACCEPTED' | 'IGNORED';
}

export interface ProductIdentityInput {
  rawProductName?: string;
  sourceProductName?: string;
  productDesignation?: string;
  brand?: string;
  partNumber?: string;
  manufacturerCode?: string;
  modelNumber?: string;
  description?: string;
  specification?: string;
  productFamily?: string;
  category?: string;
  subCategory?: string;
  application?: string;
  originalSourceText?: string;
}

export interface ResolvedProductIdentity {
  brand: string;
  partNumber: string;
  manufacturerCode: string;
  modelNumber: string;
  productName: string;
  sourceProductName: string;
  normalizedProductName: string;
  productDesignation: string;
  description: string;
  specification: string;
  productFamily: string;
  category: string;
  subCategory: string;
  application: string;
}

export const BANNED_GENERIC_PRODUCT_NAMES: ReadonlySet<string> = new Set([
  'industrial equipment',
  'automation product',
  'automation products',
  'electrical item',
  'electrical items',
  'electrical product',
  'electrical products',
  'sensor device',
  'sensor product',
  'bearing product',
  'mechanical component',
  'mechanical components',
  'industrial spare',
  'industrial spares',
  'industrial product',
  'industrial products',
  'industrial item',
  'industrial items',
  'industrial supplies',
  'mro item',
  'mro product',
  'mro equipment',
  'general equipment',
  'spare part',
  'spare parts',
  'hardware item',
  'automation equipment',
  'electronic product',
  'pneumatic product',
  'hydraulic product',
  'unknown product',
  'unidentified product',
  'product',
  'item',
  'goods',
]);

const PLATFORM_ATTRIBUTION_PATTERNS: RegExp[] = [
  /developed\s*(?:and|&)?\s*managed\s*by\s+indiamart/i,
  /indiamart\s*intermesh\s*limited/i,
  /member\s*since\s*:\s*\d+/i,
  /trustseal\s*(?:verified|indiamart)/i,
  /tradeindia\.com/i,
  /exportersindia\.com/i,
  /justdial\.com/i,
  /powered\s*by\s+(?:shopify|wordpress|woocommerce|wix|squarespace|magento|webflow|godaddy|indiamart|tradeindia)/i,
  /website\s*(?:designed|developed|maintained)\s*by/i,
  /all\s*rights\s*reserved/i,
  /copyright\s*(?:©|\(c\)|20\d{2})/i,
  /terms\s*(?:of\s*use|&\s*conditions)/i,
  /privacy\s*policy/i,
  /cookie\s*policy/i,
  /indiamart\s*trustseal/i,
  /call\s*us\s*now/i,
  /send\s*(?:enquiry|inquiry|sms|email)/i,
  /request\s*(?:a\s*)?(?:call\s*back|quote)/i,
];

const PAGINATION_AND_NOISE_PATTERNS: RegExp[] = [
  /^[-–—\s]*\d+\s*(?:of|\/)\s*\d+[-–—\s]*$/i,
  /^(?:page|pg\.?|sheet)\s*\d+(?:\s*(?:of|\/)\s*\d+)?$/i,
  /^[-=*_.•|]{3,}$/,
  /^\d{1,3}$/,
  /^(?:continued\s*(?:on|from)\s*(?:next|prev(?:ious)?)\s*page|p\.t\.o\.?)$/i,
  /^(?:mrp\s*list|price\s*list|catalogue|catalog|index|table\s*of\s*contents|specifications?\s*table)$/i,
  /^(?:sr\.?\s*no\.?|s\.?\s*no\.?|sl\.?\s*no\.?|item\s*no\.?|part\s*code|description|uom|rate|mrp|qty|quantity)$/i,
  /^(?:note|disclaimer|terms|warranty|validity|gst\s*extra|packing|forwarding|freight)\s*:/i,
];

const NAVIGATION_EXACT_LABELS: ReadonlySet<string> = new Set([
  'home',
  'about us',
  'about company',
  'company profile',
  'our company',
  'products',
  'our products',
  'all products',
  'categories',
  'services',
  'solutions',
  'industries',
  'downloads',
  'catalogue',
  'catalog',
  'brochure',
  'clients',
  'testimonials',
  'gallery',
  'careers',
  'blog',
  'news',
  'contact',
  'contact us',
  'reach us',
  'enquiry',
  'inquiry',
  'get quote',
  'request quote',
  'sitemap',
  'faq',
  'quality policy',
  'infrastructure',
  'menu',
  'search',
  'login',
  'register',
  'view all',
  'read more',
  'know more',
  'learn more',
  'see more',
  'back to top',
]);

const SECTION_OR_CATEGORY_ONLY_LABELS: ReadonlySet<string> = new Set([
  'bearings',
  'automation',
  'automation products',
  'electrical',
  'electrical products',
  'electricals',
  'switchgear',
  'sensors',
  'instrument & sensors',
  'instruments & sensors',
  'instrumentation',
  'plc',
  'plcs',
  'hmi',
  'scada',
  'drives',
  'ac drives',
  'dc drives',
  'vfd',
  'vfds',
  'servo drives',
  'siemens modules',
  'automation modules',
  'motors',
  'pumps',
  'valves',
  'lubricants',
  'cables',
  'wires & cables',
  'fasteners',
  'panel accessories',
  'enclosure accessories',
  'pneumatics',
  'hydraulics',
  'industrial hardware',
  'safety equipment',
  'ppe',
  'tools',
  'measuring instruments',
  'industrial valves',
  'flow meters',
  'power supplies',
  'relays & contactors',
  'circuit breakers',
  'control panel accessories',
  'product range',
  'featured products',
  'our product range',
]);

const KNOWN_OEM_BRANDS: ReadonlyArray<string> = [
  'SKF',
  'FAG',
  'INA',
  'TIMKEN',
  'NTN',
  'NSK',
  'NRB',
  'NBC',
  'KOYO',
  'SIEMENS',
  'SCHNEIDER ELECTRIC',
  'SCHNEIDER',
  'ABB',
  'OMRON',
  'FESTO',
  'SMC',
  'MITSUBISHI',
  'DELTA',
  'ALLEN BRADLEY',
  'ROCKWELL',
  'HONEYWELL',
  'PHOENIX CONTACT',
  'WEIDMULLER',
  'WAGO',
  'L&T',
  'LARSEN & TOUBRO',
  'HAVELLS',
  'LEGRAND',
  'CROMPTON',
  'KIRLOSKAR',
  'GRUNDFOS',
  'KSB',
  'DANFOSS',
  'EATON',
  'SEW',
  'BONFIGLIOLI',
  'NORD',
  'KLUBER',
  'KLÜBER',
  'LOCTITE',
  'HENKEL',
  '3M',
  'TAPARIA',
  'BOSCH',
  'MAKITA',
  'POLYCAB',
  'FINOLEX',
  'KEI',
  'LAPP',
  'BELDEN',
  'PILZ',
  'SICK',
  'IFM',
  'PEPPERL+FUCHS',
  'TURCK',
  'BALLUFF',
  'AUTONICS',
  'SELEC',
  'RITTAL',
  'HENSEL',
  'ELMEX',
  'CONNECTWELL',
  'TRINITY TOUCH',
  'JAI BALAJI',
  'SALZER',
  'KAYCEE',
  'TEKNIC',
  'HITECH',
  'MEAN WELL',
  'WIKA',
  'BAUMER',
  'BENTLEY NEVADA',
  'EMERSON',
  'ENDRESS+HAUSER',
  'YOKOGAWA',
  'FUJI ELECTRIC',
  'YASKAWA',
  'HIWIN',
  'THK',
  'REXROTH',
  'PARKER',
  'SWAGELOK',
  'SPIRAX SARCO',
  'AUDCO',
  'L&T VALVES',
  'FORBES MARSHALL',
  'UNIK',
  'FLUKE',
  'MEGGER',
  'KEYENCE',
  'LENZE',
  'BELIMO',
  'CARLO GAVAZZI',
  'PANASONIC',
  'GE-FANUC',
  'LAURITZ KNUDSEN',
];

export function isBannedGenericProductName(name?: string): boolean {
  const clean = String(name || '')
    .replace(/[:\-–—.,/]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!clean) return true;
  if (BANNED_GENERIC_PRODUCT_NAMES.has(clean)) return true;
  if (SECTION_OR_CATEGORY_ONLY_LABELS.has(clean)) return true;
  if (isKnownBrandNameOnly(clean)) return true;
  // Also reject "<Brand> Industrial Product" or "<Brand> Equipment" unless exact catalogue spec appended
  if (/^[a-z0-9&.\-\s]{2,25}\s+(?:industrial\s+(?:product|item|equipment|spare)|automation\s+(?:product|equipment)|electrical\s+(?:product|item)|bearing\s+product|sensor\s+device|mechanical\s+component)s?$/i.test(clean)) {
    return true;
  }
  // Reject "<KnownBrand> <Single Generic Category Noun>" e.g. "SKF Bearing", "Siemens PLC", "Allen Bradley Plc"
  const escapedBrands = [...KNOWN_OEM_BRANDS, 'MITSUBHISHI']
    .map((b) => b.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const brandGenericRx = new RegExp(
    `^(?:${escapedBrands})\\s+(?:bearing|sensor|motor|pump|valve|switchgear|cable|lubricant|product|item|equipment|component|spare|device|part|hardware|tool|automation|electrical|mechanical|plc|hmi|vfd|drive|contactor|breaker|relay|module|inverter|servo|enclosure|panel)s?$`,
    'i'
  );
  if (brandGenericRx.test(clean)) {
    return true;
  }
  return false;
}

export function isPaginationOrNoise(text?: string): boolean {
  const clean = String(text || '').trim();
  if (!clean || clean.length < 2) return true;
  if (PAGINATION_AND_NOISE_PATTERNS.some((rx) => rx.test(clean))) return true;
  // Pure punctuation or symbols
  if (!/[a-zA-Z0-9]/.test(clean)) return true;
  return false;
}

export function isPlatformAttributionOrNoise(text?: string): boolean {
  const clean = String(text || '').trim();
  if (!clean) return true;
  if (isPaginationOrNoise(clean)) return true;
  if (PLATFORM_ATTRIBUTION_PATTERNS.some((rx) => rx.test(clean))) return true;
  const lower = clean.toLowerCase().replace(/[:\-–—]+$/, '').trim();
  if (NAVIGATION_EXACT_LABELS.has(lower)) return true;
  return false;
}

export function looksLikeAddressBlock(text?: string): boolean {
  const clean = String(text || '').trim();
  if (!clean) return false;
  // Strong signals of postal address rather than an MRO product
  const hasPin = /\b[1-9][0-9]{5}\b/.test(clean);
  const addressTokens =
    /\b(plot\s*no|survey\s*no|g\.?i\.?d\.?c\.?|m\.?i\.?d\.?c\.?|industrial\s*(?:estate|area|park)|phase\s*[-–]?\s*[ivx\d]+|sector\s*[-–]?\s*\d+|taluka|dist\.?|district|near\s+[a-z]+|opp\.?\s+[a-z]+|b\/h|behind|road|marg|highway|ahmedabad|surat|vadodara|rajkot|pune|mumbai|thane|nashik|bengaluru|bangalore|chennai|hyderabad|delhi|noida|gurgaon|faridabad|coimbatore|kolkata|jaipur|indore|gujarat|maharashtra|karnataka|tamil\s*nadu|haryana|uttar\s*pradesh|rajasthan|india)\b/i;
  const hasPartCode = /\b[A-Z]{1,6}[-/]?\d{2,}[A-Z0-9\-/]*\b/.test(clean) && !/\b(?:phase|sector|plot|pin|std)\b/i.test(clean);
  if ((hasPin && addressTokens.test(clean)) || (/^(?:address|office|works|factory|regd\.?\s*office|branch)\s*:/i.test(clean))) {
    return true;
  }
  const matches = clean.match(new RegExp(addressTokens.source, 'gi')) || [];
  if (matches.length >= 2 && !hasPartCode) return true;
  return false;
}

export function looksLikeMarketingTagline(text?: string): boolean {
  const clean = String(text || '').trim();
  if (!clean) return false;
  if (
    /\b(leading\s+(?:manufacturer|supplier|exporter|dealer|distributor)|iso\s*9001\s*:?\s*\d*\s*certified|customer\s*satisfaction|your\s*trusted\s*partner|quality\s*is\s*our\s*motto|one[\s-]stop\s*solution|welcome\s*to\s+|we\s+are\s+(?:a|an|the)\s+(?:leading|premier|renowned|established|authorized)|established\s+in\s+\d{4}|years?\s+of\s+experience|wide\s+range\s+of\s+(?:quality|industrial)|best\s+quality\s+at\s+affordable|committed\s+to\s+delivering)\b/i.test(
      clean
    )
  ) {
    return true;
  }
  return false;
}

export function looksLikeSectionHeadingOnly(text?: string): boolean {
  const clean = String(text || '').trim();
  if (!clean) return false;
  const stripped = clean.replace(/[:\-–—.,/]+$/g, '').replace(/\s+/g, ' ').trim();
  const lower = stripped.toLowerCase();
  if (SECTION_OR_CATEGORY_ONLY_LABELS.has(lower)) return true;
  // Trailing colon with <= 5 words and no part code digits
  if (/:$/.test(clean) && stripped.split(' ').length <= 5 && !/\d{2,}/.test(stripped)) {
    return true;
  }
  // Short ALL-CAPS heading with no digits
  if (
    stripped === stripped.toUpperCase() &&
    /[A-Z]/.test(stripped) &&
    !/\d/.test(stripped) &&
    stripped.split(' ').length <= 4 &&
    stripped.length <= 36
  ) {
    return true;
  }
  return false;
}

export function isKnownBrandNameOnly(text?: string): boolean {
  const clean = String(text || '')
    .replace(/[:\-–—.,/]+$/g, '')
    .trim()
    .toUpperCase();
  if (!clean) return false;
  return KNOWN_OEM_BRANDS.includes(clean);
}

export function classifyTextBlock(
  text: string,
  context?: { inProductSection?: boolean; hasImage?: boolean; hasPrice?: boolean; isFooter?: boolean; isNav?: boolean }
): ContentClassificationClass {
  const clean = String(text || '').trim();
  if (!clean) return 'UNKNOWN';
  if (PLATFORM_ATTRIBUTION_PATTERNS.some((rx) => rx.test(clean))) {
    return clean.toLowerCase().includes('copyright') || clean.toLowerCase().includes('privacy')
      ? 'LEGAL'
      : 'PLATFORM_ATTRIBUTION';
  }
  if (context?.isFooter) return 'FOOTER';
  if (context?.isNav || NAVIGATION_EXACT_LABELS.has(clean.toLowerCase())) return 'NAVIGATION';
  if (isPaginationOrNoise(clean)) return 'UNKNOWN';
  if (/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/i.test(clean)) return 'GST';
  if (/^[A-Z]{5}\d{4}[A-Z]$/.test(clean.toUpperCase())) return 'PAN';
  if (/\b(?:udyam|msme)\b/i.test(clean)) return 'MSME';
  if (/^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(clean)) return 'EMAIL';
  if (/^(?:https?:\/\/|www\.)\S+$/i.test(clean)) return 'WEBSITE';
  if (/^(?:\+?\d[\d\s\-()]{7,15}\d)$/.test(clean)) return 'PHONE';
  if (looksLikeAddressBlock(clean)) return 'ADDRESS';
  if (looksLikeMarketingTagline(clean)) return 'TAGLINE';
  if (isKnownBrandNameOnly(clean)) return 'BRAND';
  if (looksLikeSectionHeadingOnly(clean)) {
    const lower = clean.replace(/[:\-–—]+$/, '').trim().toLowerCase();
    if (['plc', 'ac drives', 'dc drives', 'siemens modules', 'control panel accessories'].includes(lower)) {
      return 'PRODUCT_FAMILY';
    }
    return 'CATEGORY';
  }
  if (/\b(?:pvt\.?\s*ltd|private\s*limited|llp|limited|industries|enterprises|engineering|traders|switchgear|automation)\b/i.test(clean) && !/\d{3,}/.test(clean) && clean.split(/\s+/).length <= 8) {
    return 'COMPANY';
  }
  if (looksLikePartCodeToken(clean) && clean.split(/\s+/).length <= 2) return 'PART_CODE';
  if (/\b(?:application|used\s+in|ideal\s+for|suitable\s+for)\b/i.test(clean)) return 'APPLICATION';
  if (context?.inProductSection || extractPartCodeCandidates(clean).length > 0 || context?.hasPrice || context?.hasImage) {
    return 'PRODUCT';
  }
  return 'UNKNOWN';
}

/**
 * Checks if a token looks like a genuine industrial part/model/designation code.
 * Preserves exact punctuation (-, /, .) and suffixes (e.g., 6006, 6006/C3, 6006-2RS1, 6006-2Z, 6006/C4,
 * E2E-X5ME1, Acti9 iC60N, SIMATIC S7-1200, 1LE1001-1AB23, KLÜBERSYNTH GH 6-320).
 */
export function looksLikePartCodeToken(token?: string): boolean {
  const clean = String(token || '').trim();
  if (!clean || clean.length < 3 || clean.length > 48) return false;
  // Reject dates, ordinals (6th, 4th, 1st), pagination, phone numbers, pin codes, measurements-only
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(clean)) return false;
  if (/^\d+(?:st|nd|rd|th)$/i.test(clean)) return false;
  // Reject Indian GSTIN (15-char) and PAN (10-char) tax IDs
  if (/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(clean)) return false;
  if (/^[A-Z]{5}\d{4}[A-Z]$/i.test(clean)) return false;
  if (/^\d+(?:\.\d+)?\s*(?:mm|cm|m|kg|g|ml|l|ltr|v|vac|vdc|a|amp|hz|kw|hp|w|bar|psi|rpm|pcs|nos|rs|inr)$/i.test(clean)) {
    return false;
  }
  if (/^(?:20\d{2}|19\d{2})$/.test(clean)) return false;
  // Bearing designation: 3-6 digits with optional prefix/suffix (/C3, -2RS1, -2Z, /C4, ZZ, DDU)
  if (/^(?:[A-Z]{0,3}\d{3,6}(?:[-/\.][A-Z0-9]+)*)$/.test(clean) && !/^9\d{9}$/.test(clean)) {
    // Reject 6-digit Indian PIN codes (e.g. 380015, 411026) when bare digits
    if (/^\d{6}$/.test(clean)) return false;
    // Allow 4-5 digit bearings like 6006, 6205, 6308, 32210
    if (/^\d{4,5}$/.test(clean)) return true;
    if (/[A-Z\-\/\.]/i.test(clean)) return true;
  }
  // Alphanumeric MRO part/model codes with digits (e.g. 1SYK100001A1245, A9F74210, E2E-X5ME1, LC1D09B7, 1LE1001-1AB23, S7-1200, iC60N)
  if (/(?=.*\d)(?=.*[a-zA-Z])[A-Za-z0-9][A-Za-z0-9\-\/\.]{2,45}$/.test(clean)) {
    return true;
  }
  return false;
}

export function extractPartCodeCandidates(text?: string): string[] {
  const clean = String(text || '').trim();
  if (!clean) return [];
  const results: string[] = [];
  const seen = new Set<string>();

  // 1. Standard specific OEM part code tokens preserving /, -, . and suffixes (highest priority; allow up to 24 chars per segment for codes like 1SYK100001A1245)
  const tokenRx = /\b[A-Za-z0-9]{1,24}(?:[-/.][A-Za-z0-9]{1,24}){0,4}\b/g;
  for (const m of clean.matchAll(tokenRx)) {
    const tok = (m[0] || '').trim();
    const idx = m.index ?? 0;
    const prefixWindow = clean.slice(Math.max(0, idx - 18), idx);
    if (!looksLikePartCodeToken(tok)) continue;
    // Skip bare 4-5 digit numbers when preceded by currency/price/date context (e.g., "INR 1395", "Price INR 609", "Rs. 489")
    if (/^\d{4,5}$/.test(tok) && /\b(?:inr|rs\.?|price|mrp|rate|amt|amount|total|nov|dec|jan|feb|mar|apr|may|jun|jul|aug|sep|oct)\b|₹/i.test(prefixWindow)) {
      continue;
    }
    // Skip standard ratings/standards/voltages if not standalone model
    if (/^(?:ISO[-/]?\d+|IEC[-/]?\d+|IP\d{2}|24V(?:DC|AC)?|230V(?:AC)?|415V(?:AC)?|110V(?:AC)?|510-720V|380-480V?|47-63HZ|50HZ|60HZ|RS232|RS485|DH485)$/i.test(tok)) {
      continue;
    }
    if (!seen.has(tok.toUpperCase())) {
      seen.add(tok.toUpperCase());
      results.push(tok);
    }
  }

  // 2. Multi-token designations like "KLÜBERSYNTH GH 6-320", "SIMATIC S7-1200", "Acti9 iC60N"
  const specialDesignations = clean.match(
    /\b(?:KL[UÜ]BERSYNTH\s+[A-Z0-9\-]+(?:\s+[A-Z0-9\-]+)?|SIMATIC\s+S\d[-/]?[A-Z0-9\-]+|Acti\s?9\s+[A-Za-z0-9\-]+|SINAMICS\s+[A-Z0-9\-]+|SIRIUS\s+[A-Z0-9\-]+)\b/gi
  );
  if (specialDesignations) {
    specialDesignations.forEach((tok) => {
      const t = tok.trim();
      if (!seen.has(t.toUpperCase())) {
        seen.add(t.toUpperCase());
        // Prepend KLÜBERSYNTH / Acti9 when they are the primary commercial designation rather than a secondary series label
        if (/^(?:KL[UÜ]BERSYNTH|Acti\s?9)/i.test(t)) {
          results.unshift(t);
        } else {
          results.push(t);
        }
      }
    });
  }

  return results;
}

export function detectBrandFromText(text?: string, knownBrands: string[] = []): string | undefined {
  const clean = String(text || '').trim();
  if (!clean) return undefined;
  const combined = Array.from(new Set([...knownBrands, ...KNOWN_OEM_BRANDS].filter(Boolean)));
  // Sort longest first so "Schneider Electric" beats "Schneider"
  combined.sort((a, b) => b.length - a.length);
  for (const brand of combined) {
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(`(?:^|[^a-zA-Z0-9])${escaped}(?:$|[^a-zA-Z0-9])`, 'i');
    if (rx.test(clean)) return brand;
  }
  return undefined;
}

/**
 * Strips leading brand or part code prefix from a descriptive title to isolate the official product name / family
 * without inventing generic AI names.
 */
function stripBrandAndPartPrefix(rawName: string, brand: string, partCode: string): string {
  let out = rawName.trim();
  if (brand && brand !== 'Unconfirmed') {
    const escapedBrand = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`^${escapedBrand}\\b\\s*[-–—:]*\\s*`, 'i'), '').trim();
  }
  if (partCode) {
    const escapedPart = partCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`^${escapedPart}\\b\\s*[-–—:]*\\s*`, 'i'), '').trim();
    out = out.replace(new RegExp(`\\s*[-–—:(]*\\s*${escapedPart}[)]?$`, 'i'), '').trim();
  }
  return out;
}

export function inferMroProductFamilyAndCategory(
  text: string,
  explicitCategory?: string,
  explicitSubCategory?: string,
  explicitFamily?: string
): { category: string; subCategory: string; productFamily: string } {
  const blob = `${text} ${explicitFamily || ''} ${explicitCategory || ''} ${explicitSubCategory || ''}`.toLowerCase();

  if (/\b(deep groove ball bearing|ball bearing|roller bearing|tapered roller|spherical roller|thrust bearing|needle bearing|pillow block|bearing|600\d|620\d|630\d|2rs1|2rs)\b/i.test(blob)) {
    const family = /\bdeep groove\b/i.test(blob)
      ? 'Deep Groove Ball Bearing'
      : /\btapered\b/i.test(blob)
        ? 'Tapered Roller Bearing'
        : /\bspherical\b/i.test(blob)
          ? 'Spherical Roller Bearing'
          : /\bpillow block\b/i.test(blob)
            ? 'Pillow Block Bearing Unit'
            : 'Industrial Rolling Bearing';
    return {
      category: explicitCategory && !/general|other/i.test(explicitCategory) ? explicitCategory : 'Bearings',
      subCategory: explicitSubCategory || (family.includes('Ball') ? 'Ball Bearings' : 'Roller Bearings'),
      productFamily: explicitFamily || family,
    };
  }
  if (/\b(proximity sensor|inductive sensor|photoelectric|capacitive sensor|ultrasonic sensor|limit switch|e2e-|e3z|pressure transmitter|thermocouple|rtd|pt100|encoder|sensor)\b/i.test(blob)) {
    const family = /\binductive|e2e\b/i.test(blob)
      ? 'Inductive Proximity Sensor'
      : /\bphotoelectric\b/i.test(blob)
        ? 'Photoelectric Sensor'
        : /\bpressure\b/i.test(blob)
          ? 'Pressure Sensor / Transmitter'
          : 'Industrial Sensor';
    return {
      category: explicitCategory && !/general|other/i.test(explicitCategory) ? explicitCategory : 'Sensors / Automation',
      subCategory: explicitSubCategory || 'Proximity & Process Sensors',
      productFamily: explicitFamily || family,
    };
  }
  if (/\b(plc|simatic|s7-1200|s7-1500|s7-300|hmi|vfd|ac drive|inverter|servo|sinamics|delta dvp|fx3u|modicon|automation module|io module)\b/i.test(blob)) {
    const family = /\b(plc|simatic|s7-|modicon|dvp)\b/i.test(blob)
      ? 'Programmable Logic Controller (PLC)'
      : /\b(vfd|ac drive|sinamics|inverter)\b/i.test(blob)
        ? 'AC Variable Frequency Drive (VFD)'
        : /\bhmi\b/i.test(blob)
          ? 'Human Machine Interface (HMI)'
          : 'Industrial Automation Controller';
    return {
      category: explicitCategory && !/general|other/i.test(explicitCategory) ? explicitCategory : 'Automation',
      subCategory: explicitSubCategory || family,
      productFamily: explicitFamily || family,
    };
  }
  if (/\b(mcb|mccb|acb|rccb|elcb|contactor|overload relay|acti9|ic60n|sirius|3rt|lc1d|switchgear|push button|panel lock|quarter turn|hinge|knob type|cam lock|enclosure|din rail|terminal block|smps|power supply)\b/i.test(blob)) {
    const family = /\bmcb|ic60n|acti9\b/i.test(blob)
      ? 'Miniature Circuit Breaker (MCB)'
      : /\bmccb\b/i.test(blob)
        ? 'Moulded Case Circuit Breaker (MCCB)'
        : /\bcontactor|lc1d|3rt\b/i.test(blob)
          ? 'Power Contactor'
          : /\block|hinge|handle|bracket\b/i.test(blob)
            ? 'Panel & Enclosure Hardware'
            : 'Switchgear & Control Panel Component';
    return {
      category: explicitCategory && !/general|other/i.test(explicitCategory)
        ? explicitCategory
        : family.includes('Hardware')
          ? 'Panel Accessories'
          : 'Electrical & Switchgear',
      subCategory: explicitSubCategory || family,
      productFamily: explicitFamily || family,
    };
  }
  if (/\b(motor|1le1|induction motor|gearbox|geared motor)\b/i.test(blob)) {
    return {
      category: explicitCategory && !/general|other/i.test(explicitCategory) ? explicitCategory : 'Motors & Drives',
      subCategory: explicitSubCategory || 'AC Induction Motors',
      productFamily: explicitFamily || 'Three-Phase Induction Motor',
    };
  }
  if (/\b(solenoid valve|ball valve|gate valve|butterfly valve|check valve|globe valve|control valve|pneumatic cylinder|festo|smc|frl|vuvs)\b/i.test(blob)) {
    return {
      category: explicitCategory && !/general|other/i.test(explicitCategory) ? explicitCategory : 'Valves & Pneumatics',
      subCategory: explicitSubCategory || (/pneumatic|festo|smc|vuvs/i.test(blob) ? 'Pneumatic Valves & Actuators' : 'Industrial Process Valves'),
      productFamily: explicitFamily || (/pneumatic|festo|smc/i.test(blob) ? 'Pneumatic Control Valve' : 'Industrial Valve'),
    };
  }
  if (/\b(pump|centrifugal|submersible|dosing pump|diaphragm pump|grundfos|ksb|kirloskar)\b/i.test(blob)) {
    return {
      category: explicitCategory && !/general|other/i.test(explicitCategory) ? explicitCategory : 'Pumps & Fluid Handling',
      subCategory: explicitSubCategory || 'Industrial Centrifugal & Process Pumps',
      productFamily: explicitFamily || 'Industrial Pump',
    };
  }
  if (/\b(lubricant|grease|synthetic oil|gear oil|kl[uü]ber|loctite|adhesive|sealant)\b/i.test(blob)) {
    return {
      category: explicitCategory && !/general|other/i.test(explicitCategory) ? explicitCategory : 'Lubricants & Chemicals',
      subCategory: explicitSubCategory || 'Synthetic Industrial Lubricants',
      productFamily: explicitFamily || 'Synthetic Lubricant',
    };
  }
  if (/\b(cable|wire|armoured|xlpe|control cable|polycab|lapp|finolex|sq\.?\s*mm|core)\b/i.test(blob)) {
    return {
      category: explicitCategory && !/general|other/i.test(explicitCategory) ? explicitCategory : 'Cables & Wires',
      subCategory: explicitSubCategory || 'Industrial Control & Power Cables',
      productFamily: explicitFamily || 'Industrial Electrical Cable',
    };
  }
  if (/\b(bolt|nut|washer|screw|stud|fastener|din\s*\d+|ss304|ss316|allen bolt)\b/i.test(blob)) {
    return {
      category: explicitCategory && !/general|other/i.test(explicitCategory) ? explicitCategory : 'Fasteners & Hardware',
      subCategory: explicitSubCategory || 'Industrial Bolts, Nuts & Fasteners',
      productFamily: explicitFamily || 'Industrial Fastener',
    };
  }

  return {
    category: explicitCategory && !isBannedGenericProductName(explicitCategory) ? explicitCategory : 'MRO Components',
    subCategory: explicitSubCategory || 'General MRO Spares',
    productFamily: explicitFamily || 'Standard Industrial Component',
  };
}

/**
 * Separates and normalizes product identity fields using strict MRO priority:
 * Exact Part Code / Model Number -> Exact Product Designation -> Official Product Name -> Catalogue Description -> Technical Specification
 * Never invents generic names and never collapses brand/category/spec into productName.
 */
export function resolveProductIdentityFields(
  input: ProductIdentityInput,
  knownBrands: string[] = []
): ResolvedProductIdentity {
  const combinedSource = [
    input.originalSourceText,
    input.rawProductName,
    input.sourceProductName,
    input.productDesignation,
    input.description,
    input.specification,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  // 1. Brand isolation (never allow brand as productName)
  let brand = String(input.brand || '').trim();
  if (!brand || /^unconfirmed$/i.test(brand) || /^generic$/i.test(brand)) {
    brand = detectBrandFromText(combinedSource, knownBrands) || 'Unconfirmed';
  }

  // 2. Exact Part Code / Model Number / Product Designation preservation
  let partNumber = String(input.partNumber || '').trim();
  let manufacturerCode = String(input.manufacturerCode || '').trim();
  let modelNumber = String(input.modelNumber || '').trim();
  let productDesignation = String(input.productDesignation || '').trim();

  if (!partNumber) {
    const candidates = extractPartCodeCandidates(
      `${input.productDesignation || ''} ${input.rawProductName || ''} ${input.sourceProductName || ''} ${input.description || ''}`
    );
    if (candidates.length > 0) {
      partNumber = candidates[0];
    }
  }
  if (!modelNumber && partNumber) {
    modelNumber = partNumber;
  }
  if (!manufacturerCode && partNumber) {
    manufacturerCode = partNumber;
  }
  if (!productDesignation && partNumber) {
    productDesignation = partNumber;
  }

  // 3. Extract specs if embedded inside a long description or product line
  let specification = String(input.specification || '').trim();
  let description = String(input.description || '').trim();
  const rawNameClean = String(input.sourceProductName || input.rawProductName || '').replace(/\s+/g, ' ').trim();

  // Extract dimensions like "30 x 62 x 16 mm" or "Bore: 30mm, OD: 55mm, Width: 13mm"
  const specMatches: string[] = [];
  const dimMatch = combinedSource.match(/\b\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?(?:\s*[x×]\s*\d+(?:\.\d+)?)?\s*(?:mm|cm|m|inch)?\b/i);
  if (dimMatch) specMatches.push(dimMatch[0].trim());
  const electricalMatch = combinedSource.match(/\b\d+(?:\.\d+)?\s*(?:A|Amp|kW|HP|V|VAC|VDC|kA|bar|psi|rpm|mm2|sq\.?mm)\b/gi);
  if (electricalMatch) {
    specMatches.push(...Array.from(new Set(electricalMatch.map((s) => s.trim()))));
  }
  if (!specification && specMatches.length > 0) {
    specification = specMatches.join(', ');
  }

  // 4. Category, SubCategory, Product Family
  const inferred = inferMroProductFamilyAndCategory(
    combinedSource,
    input.category,
    input.subCategory,
    input.productFamily
  );

  // 5. Determine official sourceProductName & normalizedProductName without inventing generic names
  let sourceProductName = rawNameClean;
  if (isBannedGenericProductName(sourceProductName)) {
    sourceProductName = '';
  }

  // Remove brand-only or category-only collisions
  if (
    sourceProductName &&
    (sourceProductName.toLowerCase() === brand.toLowerCase() ||
      sourceProductName.toLowerCase() === inferred.category.toLowerCase() ||
      looksLikeSectionHeadingOnly(sourceProductName))
  ) {
    sourceProductName = '';
  }

  // If raw name was a huge multi-clause description with embedded specs + part code, strip redundant prefix/specs cleanly
  let normalizedProductName = sourceProductName;
  if (normalizedProductName) {
    normalizedProductName = stripBrandAndPartPrefix(normalizedProductName, brand, partNumber);
    // Strip trailing inline spec block like "Bore 30 mm OD 62 mm Width 16 mm" if > 55 chars
    if (normalizedProductName.length > 55) {
      normalizedProductName = normalizedProductName
        .replace(/\b(?:bore|od|outer diameter|id|inner diameter|width|height|length|voltage|current|rating|seal|clearance)\b.*$/i, '')
        .replace(/\b\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?.*$/i, '')
        .trim();
    }
  }

  // Strictly enforce fallback priority:
  // Exact Part Code/Model -> Exact Product Designation -> Official Product Name -> Catalogue Description -> Technical Specification
  if (!normalizedProductName || isBannedGenericProductName(normalizedProductName)) {
    if (productDesignation && !isBannedGenericProductName(productDesignation)) {
      normalizedProductName = productDesignation;
    } else if (partNumber) {
      normalizedProductName = partNumber;
    } else if (description && !isBannedGenericProductName(description) && !looksLikeSectionHeadingOnly(description)) {
      const firstClause = description.split(/[;\n]|(?:\s+(?:bore|od|width|size|spec)\s*:)/i)[0].trim();
      normalizedProductName = firstClause.slice(0, 72);
    } else if (specification) {
      normalizedProductName = `${inferred.productFamily} (${specification.slice(0, 40)})`;
    }
  }

  if (!sourceProductName) {
    sourceProductName = productDesignation || partNumber || normalizedProductName;
  }

  // Never allow productName == brand or category
  let productName = normalizedProductName || sourceProductName || productDesignation || partNumber;
  if (
    !productName ||
    isBannedGenericProductName(productName) ||
    productName.toLowerCase() === brand.toLowerCase() ||
    productName.toLowerCase() === inferred.category.toLowerCase()
  ) {
    productName = productDesignation || partNumber || (sourceProductName && sourceProductName !== brand ? sourceProductName : '') || inferred.productFamily;
  }

  // If source catalog used an explicit commercial designation like "KLÜBERSYNTH GH 6-320" or "OMRON E2E-X5ME1", preserve it!
  if (/^KL[UÜ]BERSYNTH/i.test(rawNameClean) || (partNumber && rawNameClean.toUpperCase() === partNumber.toUpperCase())) {
    productName = productDesignation || partNumber || rawNameClean;
    sourceProductName = rawNameClean;
  }

  if (!description && rawNameClean && rawNameClean !== productName) {
    description = rawNameClean;
  }

  return {
    brand,
    partNumber,
    manufacturerCode,
    modelNumber,
    productName: productName.trim(),
    sourceProductName: sourceProductName.trim(),
    normalizedProductName: (normalizedProductName || productName).trim(),
    productDesignation: (productDesignation || partNumber).trim(),
    description: (description || sourceProductName || productName).trim(),
    specification: specification.trim(),
    productFamily: inferred.productFamily,
    category: inferred.category,
    subCategory: inferred.subCategory,
    application: String(input.application || '').trim(),
  };
}

/**
 * Computes transparent 0-100 extraction validation score and returns Valid / Needs Review / Reject status.
 * Scoring rules:
 * +25 appears in product section / valid table row
 * +25 has part number / model number / designation
 * +20 has technical specifications
 * +10 has product image
 * +10 has structured description
 * +5 has price / rate / MRP
 * +5 has product detail page / URL
 */
export function validateExtractedProduct(
  candidate: {
    productName?: string;
    sourceProductName?: string;
    brand?: string;
    partNumber?: string;
    modelNumber?: string;
    productDesignation?: string;
    specification?: string;
    description?: string;
    category?: string;
    imageUrl?: string;
    sourceUrl?: string;
    detailUrl?: string;
    mrp?: number;
    basicRate?: number;
    purchaseRate?: number;
    rate?: number;
    originalSourceText?: string;
    inProductSection?: boolean;
  },
  options?: { strictWebsiteMode?: boolean }
): {
  isValid: boolean;
  isSuspicious: boolean;
  isRejected: boolean;
  contentClass: ContentClassificationClass;
  rejectionCategory?: SuspiciousRejectionCategory;
  breakdown: ExtractionValidationBreakdown;
} {
  const name = String(candidate.sourceProductName || candidate.productName || '').trim();
  const rawBlob = String(candidate.originalSourceText || name).trim();

  // Hard rejections first — never allow junk, platform attribution, pagination, addresses, taglines, tax IDs, or section headers
  if (
    !name ||
    isPaginationOrNoise(name) ||
    /^price\s+(?:inr|rs\.?|₹)/i.test(name) ||
    /^read\s+update\b/i.test(name) ||
    /^(?:view\s+details|enquire\s+now|quick\s+enquiry|add\s+to\s+cart)$/i.test(name)
  ) {
    return {
      isValid: false,
      isSuspicious: true,
      isRejected: true,
      contentClass: 'UNKNOWN',
      rejectionCategory: 'Pagination / Noise',
      breakdown: {
        productSectionScore: 0,
        partOrModelCodeScore: 0,
        technicalSpecsScore: 0,
        productImageScore: 0,
        descriptionScore: 0,
        priceOrRateScore: 0,
        detailPageScore: 0,
        totalScore: 0,
        status: 'REJECTED',
        reasons: ['Rejected pagination marker or empty/noisy text block'],
      },
    };
  }

  if (/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/i.test(name) || /^[A-Z]{5}\d{4}[A-Z]$/i.test(name)) {
    return {
      isValid: false,
      isSuspicious: true,
      isRejected: true,
      contentClass: /^[A-Z]{5}\d{4}[A-Z]$/i.test(name) ? 'PAN' : 'GST',
      rejectionCategory: 'Contact / Legal Metadata',
      breakdown: {
        productSectionScore: 0,
        partOrModelCodeScore: 0,
        technicalSpecsScore: 0,
        productImageScore: 0,
        descriptionScore: 0,
        priceOrRateScore: 0,
        detailPageScore: 0,
        totalScore: 0,
        status: 'REJECTED',
        reasons: ['Rejected GSTIN / PAN tax registration identifier'],
      },
    };
  }

  if (isPlatformAttributionOrNoise(name) || isPlatformAttributionOrNoise(rawBlob)) {
    return {
      isValid: false,
      isSuspicious: true,
      isRejected: true,
      contentClass: 'PLATFORM_ATTRIBUTION',
      rejectionCategory: 'Platform Attribution',
      breakdown: {
        productSectionScore: 0,
        partOrModelCodeScore: 0,
        technicalSpecsScore: 0,
        productImageScore: 0,
        descriptionScore: 0,
        priceOrRateScore: 0,
        detailPageScore: 0,
        totalScore: 0,
        status: 'REJECTED',
        reasons: ['Rejected marketplace/website builder footer or platform attribution text'],
      },
    };
  }

  if (looksLikeAddressBlock(name)) {
    return {
      isValid: false,
      isSuspicious: true,
      isRejected: true,
      contentClass: 'ADDRESS',
      rejectionCategory: 'Vendor Address',
      breakdown: {
        productSectionScore: 0,
        partOrModelCodeScore: 0,
        technicalSpecsScore: 0,
        productImageScore: 0,
        descriptionScore: 0,
        priceOrRateScore: 0,
        detailPageScore: 0,
        totalScore: 0,
        status: 'REJECTED',
        reasons: ['Rejected vendor address / location line mistakenly parsed as product'],
      },
    };
  }

  if (looksLikeMarketingTagline(name)) {
    return {
      isValid: false,
      isSuspicious: true,
      isRejected: true,
      contentClass: 'TAGLINE',
      rejectionCategory: 'Marketing Tagline',
      breakdown: {
        productSectionScore: 0,
        partOrModelCodeScore: 0,
        technicalSpecsScore: 0,
        productImageScore: 0,
        descriptionScore: 0,
        priceOrRateScore: 0,
        detailPageScore: 0,
        totalScore: 0,
        status: 'REJECTED',
        reasons: ['Rejected company marketing slogan / tagline'],
      },
    };
  }

  const hasPartCode = !!(
    (candidate.partNumber && looksLikePartCodeToken(candidate.partNumber)) ||
    (candidate.modelNumber && looksLikePartCodeToken(candidate.modelNumber)) ||
    (candidate.productDesignation && looksLikePartCodeToken(candidate.productDesignation)) ||
    extractPartCodeCandidates(name).length > 0
  );

  if (looksLikeSectionHeadingOnly(name) && !hasPartCode) {
    return {
      isValid: false,
      isSuspicious: true,
      isRejected: true,
      contentClass: 'CATEGORY',
      rejectionCategory: 'Category / Product Family',
      breakdown: {
        productSectionScore: 10,
        partOrModelCodeScore: 0,
        technicalSpecsScore: 0,
        productImageScore: 0,
        descriptionScore: 0,
        priceOrRateScore: 0,
        detailPageScore: 0,
        totalScore: 10,
        status: 'REJECTED',
        reasons: ['Rejected bare section heading / category name without specific product model or part code'],
      },
    };
  }

  if (isKnownBrandNameOnly(name) && !hasPartCode) {
    return {
      isValid: false,
      isSuspicious: true,
      isRejected: true,
      contentClass: 'BRAND',
      rejectionCategory: 'Brand-Only Text',
      breakdown: {
        productSectionScore: 10,
        partOrModelCodeScore: 0,
        technicalSpecsScore: 0,
        productImageScore: 0,
        descriptionScore: 0,
        priceOrRateScore: 0,
        detailPageScore: 0,
        totalScore: 10,
        status: 'REJECTED',
        reasons: ['Rejected brand name appearing alone without product designation'],
      },
    };
  }

  if (isBannedGenericProductName(name) && !hasPartCode) {
    return {
      isValid: false,
      isSuspicious: true,
      isRejected: true,
      contentClass: 'UNKNOWN',
      rejectionCategory: 'Banned Generic Name',
      breakdown: {
        productSectionScore: 0,
        partOrModelCodeScore: 0,
        technicalSpecsScore: 0,
        productImageScore: 0,
        descriptionScore: 0,
        priceOrRateScore: 0,
        detailPageScore: 0,
        totalScore: 15,
        status: 'REJECTED',
        reasons: ['Rejected generic AI placeholder product name'],
      },
    };
  }

  // Calculate additive confidence breakdown (max 100)
  const reasons: string[] = [];
  const productSectionScore = candidate.inProductSection !== false ? 25 : 15;
  if (productSectionScore > 0) reasons.push(`+${productSectionScore} structured product row/section`);

  const partOrModelCodeScore = hasPartCode ? 25 : 0;
  if (partOrModelCodeScore > 0) reasons.push('+25 verified part/model designation');

  const specStr = String(candidate.specification || '').trim();
  const hasSpecs =
    specStr.length >= 4 &&
    !/^(?:standard industrial|as per catalogue|na|n\/a|-)$/i.test(specStr);
  const technicalSpecsScore = hasSpecs ? 20 : 0;
  if (technicalSpecsScore > 0) reasons.push('+20 technical specifications present');

  const hasImage = !!(candidate.imageUrl && /^https?:\/\//i.test(candidate.imageUrl));
  const productImageScore = hasImage ? 10 : 0;
  if (productImageScore > 0) reasons.push('+10 product image');

  const descStr = String(candidate.description || '').trim();
  const hasDesc =
    descStr.length >= 10 &&
    descStr.toLowerCase() !== name.toLowerCase() &&
    !isBannedGenericProductName(descStr);
  const descriptionScore = hasDesc ? 10 : 0;
  if (descriptionScore > 0) reasons.push('+10 catalogue description');

  const hasPrice =
    (typeof candidate.mrp === 'number' && candidate.mrp > 0) ||
    (typeof candidate.basicRate === 'number' && candidate.basicRate > 0) ||
    (typeof candidate.purchaseRate === 'number' && candidate.purchaseRate > 0) ||
    (typeof candidate.rate === 'number' && candidate.rate > 0);
  const priceOrRateScore = hasPrice ? 5 : 0;
  if (priceOrRateScore > 0) reasons.push('+5 commercial rate/MRP');

  const hasDetailPage = !!(
    (candidate.detailUrl && /^https?:\/\//i.test(candidate.detailUrl)) ||
    (candidate.sourceUrl && /^https?:\/\/.+\/.+/i.test(candidate.sourceUrl))
  );
  const detailPageScore = hasDetailPage ? 5 : 0;
  if (detailPageScore > 0) reasons.push('+5 product detail URL');

  const totalScore =
    productSectionScore +
    partOrModelCodeScore +
    technicalSpecsScore +
    productImageScore +
    descriptionScore +
    priceOrRateScore +
    detailPageScore;

  let status: ExtractionValidationBreakdown['status'] = 'REJECTED';
  if (totalScore >= 90) status = 'VALID_HIGH';
  else if (totalScore >= 75) status = 'VALID_MEDIUM';
  else if (totalScore >= 50) status = 'NEEDS_REVIEW';
  else status = 'REJECTED';

  // Special allowance: genuine named catalogue items with specific multi-word hardware descriptors
  // (e.g. "Quarter Turn Lock", "Deep Groove Ball Bearing") found inside a product section get Needs Review instead of silent drop when score < 50
  const wordCount = name.split(/\s+/).filter(Boolean).length;
  if (
    status === 'REJECTED' &&
    !options?.strictWebsiteMode &&
    candidate.inProductSection !== false &&
    wordCount >= 2 &&
    name.length >= 6 &&
    name.length <= 90 &&
    !looksLikeSectionHeadingOnly(name)
  ) {
    status = 'NEEDS_REVIEW';
    reasons.push('Flagged for review (no explicit part code or rate detected)');
  }

  return {
    isValid: status === 'VALID_HIGH' || status === 'VALID_MEDIUM' || status === 'NEEDS_REVIEW',
    isSuspicious: status === 'NEEDS_REVIEW' || status === 'REJECTED',
    isRejected: status === 'REJECTED',
    contentClass: 'PRODUCT',
    rejectionCategory: status === 'REJECTED' ? 'Low Confidence Record' : undefined,
    breakdown: {
      productSectionScore,
      partOrModelCodeScore,
      technicalSpecsScore,
      productImageScore,
      descriptionScore,
      priceOrRateScore,
      detailPageScore,
      totalScore,
      status,
      reasons,
    },
  };
}

/**
 * Extracts JSON-LD schema.org objects BEFORE removing <script>, <style>, <nav>, <footer>,
 * cookie banners, and IndiaMART/TradeIndia attribution blocks from HTML.
 */
export interface HtmlCleanExtractionResult {
  title: string;
  metaDescription: string;
  jsonLdOrganizations: Array<{
    name?: string;
    legalName?: string;
    url?: string;
    email?: string;
    telephone?: string;
    address?: string;
  }>;
  jsonLdProducts: Array<{
    name: string;
    brand?: string;
    sku?: string;
    mpn?: string;
    model?: string;
    description?: string;
    category?: string;
    imageUrl?: string;
    detailUrl?: string;
    price?: number;
    currency?: string;
  }>;
  cleanedText: string;
  strippedNoiseBlocks: Array<{ text: string; class: ContentClassificationClass; reason: string }>;
  imageUrls: string[];
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractJsonLdAndCleanHtml(html: string, baseUrl: string = ''): HtmlCleanExtractionResult {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1]) : '';

  const metaDescMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i) ||
    html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["'][^>]*>/i);
  const metaDescription = metaDescMatch ? decodeHtmlEntities(metaDescMatch[1]) : '';

  const jsonLdOrganizations: HtmlCleanExtractionResult['jsonLdOrganizations'] = [];
  const jsonLdProducts: HtmlCleanExtractionResult['jsonLdProducts'] = [];

  // 1. Parse JSON-LD BEFORE stripping <script> tags
  const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let ldMatch: RegExpExecArray | null;
  const visitJsonLd = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visitJsonLd);
      return;
    }
    if (Array.isArray(node['@graph'])) {
      visitJsonLd(node['@graph']);
    }
    const rawType = node['@type'];
    const types = (Array.isArray(rawType) ? rawType : [rawType])
      .filter(Boolean)
      .map((t) => String(t).toLowerCase());

    if (types.some((t) => t.includes('organization') || t.includes('localbusiness') || t.includes('corporation'))) {
      const addrObj = node.address;
      const formattedAddr =
        typeof addrObj === 'string'
          ? addrObj
          : addrObj && typeof addrObj === 'object'
            ? [addrObj.streetAddress, addrObj.addressLocality, addrObj.addressRegion, addrObj.postalCode, addrObj.addressCountry]
                .filter(Boolean)
                .join(', ')
            : undefined;
      jsonLdOrganizations.push({
        name: node.name ? String(node.name).trim() : undefined,
        legalName: node.legalName ? String(node.legalName).trim() : undefined,
        url: node.url ? String(node.url).trim() : undefined,
        email: node.email ? String(node.email).trim() : undefined,
        telephone: node.telephone ? String(node.telephone).trim() : undefined,
        address: formattedAddr,
      });
    }

    if (types.some((t) => t === 'product' || t.endsWith('/product'))) {
      const name = String(node.name || '').trim();
      if (name && !isPlatformAttributionOrNoise(name) && !isBannedGenericProductName(name)) {
        const brandVal =
          typeof node.brand === 'string'
            ? node.brand
            : node.brand?.name
              ? String(node.brand.name)
              : undefined;
        const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
        const rawPrice = offers?.price ?? offers?.lowPrice;
        const parsedPrice = rawPrice !== undefined ? parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) : undefined;
        const imgVal = Array.isArray(node.image) ? node.image[0] : typeof node.image === 'string' ? node.image : node.image?.url;

        jsonLdProducts.push({
          name: decodeHtmlEntities(name),
          brand: brandVal ? decodeHtmlEntities(String(brandVal)) : undefined,
          sku: node.sku ? String(node.sku).trim() : undefined,
          mpn: node.mpn ? String(node.mpn).trim() : undefined,
          model: node.model ? String(node.model).trim() : undefined,
          description: node.description ? decodeHtmlEntities(String(node.description)) : undefined,
          category: node.category ? decodeHtmlEntities(String(node.category)) : undefined,
          imageUrl: imgVal ? String(imgVal) : undefined,
          detailUrl: node.url ? String(node.url) : baseUrl || undefined,
          price: parsedPrice && !isNaN(parsedPrice) && parsedPrice > 0 ? parsedPrice : undefined,
          currency: offers?.priceCurrency ? String(offers.priceCurrency) : 'INR',
        });
      }
    }

    if (types.some((t) => t.includes('itemlist')) && Array.isArray(node.itemListElement)) {
      node.itemListElement.forEach((el: any) => {
        if (el?.item) visitJsonLd(el.item);
        else visitJsonLd(el);
      });
    }
  };

  while ((ldMatch = jsonLdRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(ldMatch[1]);
      visitJsonLd(parsed);
    } catch {
      // Ignore malformed JSON-LD blocks
    }
  }

  // Extract product image URLs (excluding platform logos)
  const imageUrls: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const src = imgMatch[1];
    if (!/indiamart|imimg\.com\/static|trustseal|favicon|logo|whatsapp|facebook|twitter|linkedin|instagram/i.test(src)) {
      imageUrls.push(src);
    }
  }

  // 2. Capture & strip footer/nav noise for traceability report before cleaning body text
  const strippedNoiseBlocks: HtmlCleanExtractionResult['strippedNoiseBlocks'] = [];
  const footerMatches = html.match(/<footer[\s\S]*?<\/footer>/gi) || [];
  footerMatches.forEach((f) => {
    const plain = decodeHtmlEntities(f.replace(/<[^>]+>/g, ' '));
    if (plain && /indiamart|developed\s+and\s+managed|copyright|all\s+rights\s+reserved/i.test(plain)) {
      strippedNoiseBlocks.push({
        text: plain.slice(0, 180),
        class: /indiamart|managed\s+by/i.test(plain) ? 'PLATFORM_ATTRIBUTION' : 'FOOTER',
        reason: 'Stripped page footer / marketplace attribution block',
      });
    }
  });

  // 3. Remove scripts, styles, svg, noscript, nav, footer, cookie/credit overlays
  let cleanedHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '\n')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '\n')
    .replace(/<div[^>]*(?:id|class)=["'][^"']*(?:footer|cookie|consent|navbar|breadcrumb|copyright|indiamart|trustseal|chat-widget|popup)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '\n');

  // Preserve line boundaries on structural block elements & table rows
  cleanedHtml = cleanedHtml
    .replace(/<\/(?:tr|li|p|div|h1|h2|h3|h4|h5|h6|section|article|br)>/gi, '\n')
    .replace(/<\/(?:td|th)>/gi, ' | ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  const lines = cleanedHtml
    .split(/\r?\n/)
    .map((line) => decodeHtmlEntities(line))
    .filter((line) => {
      if (!line || line.length < 2) return false;
      if (isPlatformAttributionOrNoise(line)) {
        if (/indiamart|developed\s+and\s+managed|powered\s+by/i.test(line)) {
          strippedNoiseBlocks.push({
            text: line.slice(0, 160),
            class: 'PLATFORM_ATTRIBUTION',
            reason: 'Filtered platform attribution line',
          });
        }
        return false;
      }
      return true;
    });

  return {
    title,
    metaDescription,
    jsonLdOrganizations,
    jsonLdProducts,
    cleanedText: lines.join('\n'),
    strippedNoiseBlocks: strippedNoiseBlocks.slice(0, 30),
    imageUrls: Array.from(new Set(imageUrls)).slice(0, 40),
  };
}

/**
 * Merges multi-line PDF/text product descriptions belonging to the same product row into ONE block.
 * Example:
 *   6206-2RS1
 *   Deep Groove Ball Bearing
 *   Single row
 *   Sealed
 *   30 × 62 × 16 mm
 * collapses into ONE consolidated product line rather than 5 fake products.
 */
export function mergeMultilineProductBlocks(rawLines: string[]): Array<{
  rowNumber: number;
  originalSourceText: string;
  partCode?: string;
  sectionCategory?: string;
  lines: string[];
}> {
  const blocks: Array<{
    rowNumber: number;
    originalSourceText: string;
    partCode?: string;
    sectionCategory?: string;
    lines: string[];
  }> = [];

  let activeSectionCategory: string | undefined;
  let currentBlock: {
    rowNumber: number;
    lines: string[];
    partCode?: string;
    sectionCategory?: string;
  } | null = null;

  const isContinuationLine = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    // Measurement / specification continuation line (e.g., "30 x 62 x 16 mm", "Bore 30 mm", "Single row", "Sealed")
    if (/^(?:bore|od|outer diameter|id|inner diameter|width|size|spec|specifications?|voltage|current|rating|seal|clearance|material|temperature|pressure|single row|double row|sealed|shielded|open|contact seals?)\b/i.test(trimmed)) {
      return true;
    }
    if (/^\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?(?:\s*[x×]\s*\d+(?:\.\d+)?)?\s*(?:mm|cm|m|inch)?$/i.test(trimmed)) {
      return true;
    }
    if (/^(?:mrp|rate|price|rs\.?|inr|₹)\s*[:.]?\s*[\d,.]+$/i.test(trimmed)) {
      return true;
    }
    // Single or short lowercase/adjective line with no part code and no tab/pipe delimiters
    if (!/[|\t,]/.test(trimmed) && extractPartCodeCandidates(trimmed).length === 0 && trimmed.split(/\s+/).length <= 5) {
      if (/^(?:deep groove ball bearing|ball bearing|single row|sealed|with contact seals|stainless steel|high speed|heavy duty)/i.test(trimmed)) {
        return true;
      }
    }
    return false;
  };

  rawLines.forEach((rawLine, idx) => {
    const clean = rawLine.replace(/\s+/g, ' ').trim();
    if (!clean) {
      if (currentBlock) {
        blocks.push({
          rowNumber: currentBlock.rowNumber,
          originalSourceText: currentBlock.lines.join(' | '),
          partCode: currentBlock.partCode,
          sectionCategory: currentBlock.sectionCategory,
          lines: currentBlock.lines,
        });
        currentBlock = null;
      }
      return;
    }

    if (isPlatformAttributionOrNoise(clean)) return;

    const lineParts = extractPartCodeCandidates(clean);
    if (looksLikeSectionHeadingOnly(clean) && lineParts.length === 0) {
      activeSectionCategory = clean.replace(/[:\-–—]+$/, '').trim();
      if (currentBlock) {
        blocks.push({
          rowNumber: currentBlock.rowNumber,
          originalSourceText: currentBlock.lines.join(' | '),
          partCode: currentBlock.partCode,
          sectionCategory: currentBlock.sectionCategory,
          lines: currentBlock.lines,
        });
        currentBlock = null;
      }
      return;
    }

    // Tabular delimited rows (CSV/TSV/pipe) are always independent rows
    if (/[|\t]/.test(clean) && clean.split(/[|\t]/).length >= 3) {
      if (currentBlock) {
        blocks.push({
          rowNumber: currentBlock.rowNumber,
          originalSourceText: currentBlock.lines.join(' | '),
          partCode: currentBlock.partCode,
          sectionCategory: currentBlock.sectionCategory,
          lines: currentBlock.lines,
        });
        currentBlock = null;
      }
      blocks.push({
        rowNumber: idx + 1,
        originalSourceText: clean,
        partCode: lineParts[0],
        sectionCategory: activeSectionCategory,
        lines: [clean],
      });
      return;
    }

    if (currentBlock && isContinuationLine(clean) && lineParts.length === 0) {
      currentBlock.lines.push(clean);
      return;
    }

    // Start new product block
    if (currentBlock) {
      blocks.push({
        rowNumber: currentBlock.rowNumber,
        originalSourceText: currentBlock.lines.join(' | '),
        partCode: currentBlock.partCode,
        sectionCategory: currentBlock.sectionCategory,
        lines: currentBlock.lines,
      });
    }
    currentBlock = {
      rowNumber: idx + 1,
      lines: [clean],
      partCode: lineParts[0],
      sectionCategory: activeSectionCategory,
    };
  });

  if (currentBlock) {
    const finalized: {
      rowNumber: number;
      lines: string[];
      partCode?: string;
      sectionCategory?: string;
    } = currentBlock;
    blocks.push({
      rowNumber: finalized.rowNumber,
      originalSourceText: finalized.lines.join(' | '),
      partCode: finalized.partCode,
      sectionCategory: finalized.sectionCategory,
      lines: finalized.lines,
    });
  }

  return blocks;
}

export interface SpreadsheetColumnInspection {
  headers: string[];
  autoMapping: Record<string, string>;
  sampleRows: string[][];
}

export function inspectSpreadsheetColumns(csvText: string): SpreadsheetColumnInspection {
  const lines = String(csvText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return { headers: [], autoMapping: {}, sampleRows: [] };
  }
  const splitRow = (row: string) =>
    row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c) => c.replace(/^"|"$/g, '').trim());

  const headers = splitRow(lines[0]);
  const sampleRows = lines.slice(1, 4).map(splitRow);
  const autoMapping: Record<string, string> = {};

  headers.forEach((h) => {
    const low = h.toLowerCase();
    if (/brand|make|oem|manufacturer(?!.*code)/i.test(low) && !autoMapping.brand) autoMapping.brand = h;
    else if (/part\s*(?:code|no|number)|designation|catalogue\s*no|sku|item\s*code|order\s*code/i.test(low) && !autoMapping.partNumber) autoMapping.partNumber = h;
    else if (/model/i.test(low) && !autoMapping.modelNumber) autoMapping.modelNumber = h;
    else if (/product\s*name|item\s*name|material\s*name|title|product$/i.test(low) && !autoMapping.productName) autoMapping.productName = h;
    else if (/desc/i.test(low) && !autoMapping.description) autoMapping.description = h;
    else if (/sub[\s_-]*cat/i.test(low) && !autoMapping.subCategory) autoMapping.subCategory = h;
    else if (/cat|group/i.test(low) && !autoMapping.category) autoMapping.category = h;
    else if (/family|series/i.test(low) && !autoMapping.productFamily) autoMapping.productFamily = h;
    else if (/spec|size|dimension|rating|technical/i.test(low) && !autoMapping.specification) autoMapping.specification = h;
    else if (/mrp|list\s*price/i.test(low) && !autoMapping.mrp) autoMapping.mrp = h;
    else if (/disc/i.test(low) && !autoMapping.discountPercent) autoMapping.discountPercent = h;
    else if (/purchase\s*rate|net\s*rate|dealer\s*price|basic\s*rate|rate|price/i.test(low) && !autoMapping.purchaseRate) autoMapping.purchaseRate = h;
    else if (/uom|unit/i.test(low) && !autoMapping.uom) autoMapping.uom = h;
  });

  return { headers, autoMapping, sampleRows };
}
