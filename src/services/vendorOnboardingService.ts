import {
  BrandAssociationDetail,
  BrandMasterItem,
  BrandRelationshipType,
  CategoryHierarchyDetection,
  DuplicateVendorCandidate,
  MaterialCategory,
  OnboardingCompletionSummary,
  OnboardingConflict,
  OnboardingConflictCandidate,
  OnboardingProductCandidate,
  OnboardingSourceTrace,
  OnboardingSourceType,
  ProductItem,
  Vendor,
  VendorCatalogProduct,
  VendorContact,
  VendorStructuredAddress,
  VendorOnboardingAnalysisResult,
} from '../types';
import {
  classifyBrandRelationship,
  mapProductFamilyAndType,
  matchExtractedProductWithProductMaster,
  preserveExactPartCode,
} from './vendorIntelligenceService';
import {
  isPlatformAttributionOrNoise,
  looksLikeAddressBlock,
  looksLikeMarketingTagline,
  resolveProductIdentityFields,
  validateExtractedProduct,
} from './contentClassificationEngine';

export const COMPANY_SOURCE_PRIORITY: Record<OnboardingSourceType, number> = {
  WEBSITE: 100,
  GST_DOC: 95,
  BROCHURE: 82,
  CATALOGUE: 80,
  COMPANY_PROFILE: 76,
  BUSINESS_CARD: 72,
  IMAGE: 65,
  EXCEL: 60,
  TEXT: 55,
  MANUAL: 50,
};

export const PRODUCT_SOURCE_PRIORITY: Record<OnboardingSourceType, number> = {
  CATALOGUE: 98,
  BROCHURE: 94,
  EXCEL: 90,
  WEBSITE: 82,
  COMPANY_PROFILE: 78,
  IMAGE: 70,
  BUSINESS_CARD: 60,
  TEXT: 55,
  GST_DOC: 40,
  MANUAL: 50,
};

const INDIAN_GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
};

const KNOWN_INDIAN_CITIES: Array<{ city: string; state: string }> = [
  { city: 'Pune', state: 'Maharashtra' },
  { city: 'Pimpri', state: 'Maharashtra' },
  { city: 'Chinchwad', state: 'Maharashtra' },
  { city: 'Bhosari', state: 'Maharashtra' },
  { city: 'Chakan', state: 'Maharashtra' },
  { city: 'Mumbai', state: 'Maharashtra' },
  { city: 'Navi Mumbai', state: 'Maharashtra' },
  { city: 'Thane', state: 'Maharashtra' },
  { city: 'Nashik', state: 'Maharashtra' },
  { city: 'Nagpur', state: 'Maharashtra' },
  { city: 'Aurangabad', state: 'Maharashtra' },
  { city: 'Kolhapur', state: 'Maharashtra' },
  { city: 'Ahmedabad', state: 'Gujarat' },
  { city: 'Vadodara', state: 'Gujarat' },
  { city: 'Baroda', state: 'Gujarat' },
  { city: 'Surat', state: 'Gujarat' },
  { city: 'Rajkot', state: 'Gujarat' },
  { city: 'Vapi', state: 'Gujarat' },
  { city: 'Ankleshwar', state: 'Gujarat' },
  { city: 'Gandhinagar', state: 'Gujarat' },
  { city: 'Bengaluru', state: 'Karnataka' },
  { city: 'Bangalore', state: 'Karnataka' },
  { city: 'Mysuru', state: 'Karnataka' },
  { city: 'Hubballi', state: 'Karnataka' },
  { city: 'Belagavi', state: 'Karnataka' },
  { city: 'Chennai', state: 'Tamil Nadu' },
  { city: 'Coimbatore', state: 'Tamil Nadu' },
  { city: 'Hosur', state: 'Tamil Nadu' },
  { city: 'Tiruchirappalli', state: 'Tamil Nadu' },
  { city: 'Madurai', state: 'Tamil Nadu' },
  { city: 'Hyderabad', state: 'Telangana' },
  { city: 'Secunderabad', state: 'Telangana' },
  { city: 'New Delhi', state: 'Delhi' },
  { city: 'Delhi', state: 'Delhi' },
  { city: 'Noida', state: 'Uttar Pradesh' },
  { city: 'Greater Noida', state: 'Uttar Pradesh' },
  { city: 'Ghaziabad', state: 'Uttar Pradesh' },
  { city: 'Lucknow', state: 'Uttar Pradesh' },
  { city: 'Kanpur', state: 'Uttar Pradesh' },
  { city: 'Gurgaon', state: 'Haryana' },
  { city: 'Gurugram', state: 'Haryana' },
  { city: 'Faridabad', state: 'Haryana' },
  { city: 'Manesar', state: 'Haryana' },
  { city: 'Kolkata', state: 'West Bengal' },
  { city: 'Howrah', state: 'West Bengal' },
  { city: 'Jaipur', state: 'Rajasthan' },
  { city: 'Bhiwadi', state: 'Rajasthan' },
  { city: 'Indore', state: 'Madhya Pradesh' },
  { city: 'Bhopal', state: 'Madhya Pradesh' },
  { city: 'Ludhiana', state: 'Punjab' },
  { city: 'Chandigarh', state: 'Chandigarh' },
  { city: 'Kochi', state: 'Kerala' },
  { city: 'Visakhapatnam', state: 'Andhra Pradesh' },
  { city: 'Vijayawada', state: 'Andhra Pradesh' },
  { city: 'Jamshedpur', state: 'Jharkhand' },
  { city: 'Raipur', state: 'Chhattisgarh' },
  { city: 'Bhubaneswar', state: 'Odisha' },
];

export function validateGstinFormat(gstin: string): boolean {
  const clean = (gstin || '').trim().toUpperCase();
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(clean);
}

export function validatePanFormat(pan: string): boolean {
  const clean = (pan || '').trim().toUpperCase();
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(clean);
}

export function extractGstinAndPanFromText(text: string): {
  gstin: string;
  pan: string;
  gstState?: string;
} {
  const upper = (text || '').toUpperCase();
  const gstMatches = upper.match(/\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/g) || [];
  const validGstin = gstMatches.find((g) => validateGstinFormat(g)) || '';

  const panMatches = upper.match(/\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g) || [];
  let validPan = panMatches.find((p) => validatePanFormat(p)) || '';
  if (!validPan && validGstin) {
    const inferredPan = validGstin.slice(2, 12);
    if (validatePanFormat(inferredPan)) {
      validPan = inferredPan;
    }
  }

  const gstState = validGstin ? INDIAN_GST_STATE_CODES[validGstin.slice(0, 2)] : undefined;
  return {
    gstin: validGstin,
    pan: validPan,
    gstState,
  };
}

export function normalizeCompanyName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/\b(private|pvt\.?|limited|ltd\.?|llp|inc\.?|corp\.?|corporation|co\.?|company|enterprises?|industries|systems|solutions|traders|trading|engineers?|engineering)\b/gi, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeDomain(urlOrEmail: string): string {
  const s = (urlOrEmail || '').trim().toLowerCase();
  if (!s) return '';
  if (s.includes('@')) {
    const dom = s.split('@')[1] || '';
    if (['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'rediffmail.com'].includes(dom)) {
      return '';
    }
    return dom.replace(/^www\./, '');
  }
  try {
    const parsed = new URL(s.startsWith('http') ? s : `https://${s}`);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  }
}

export function normalizePhoneLast10(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function classifyVendorTypeFromText(text: string): {
  vendorType: string;
  confidence: number;
  evidence?: string;
} {
  const src = text || '';
  const lower = src.toLowerCase();

  if (/\bauthori[sz]ed\s+(distributor|dealer|stockist|channel\s*partner)\b/i.test(src)) {
    const m = src.match(/([^\n.]{0,40}authori[sz]ed\s+(?:distributor|dealer|stockist|channel\s*partner)[^\n.]{0,50})/i);
    return {
      vendorType: lower.includes('dealer') ? 'Authorised Dealer' : 'Authorised Distributor',
      confidence: 92,
      evidence: m?.[1]?.trim(),
    };
  }
  if (/\bsystem\s+integrator\b/i.test(src)) {
    return { vendorType: 'System Integrator', confidence: 88, evidence: 'Explicit System Integrator reference' };
  }
  if (/\b(manufacturer|oem)\b/i.test(src) && /\bdistributor\b/i.test(src)) {
    return { vendorType: 'Manufacturer & Distributor', confidence: 88 };
  }
  if (/\b(original\s+equipment\s+manufacturer|oem)\b/i.test(src)) {
    return { vendorType: 'OEM', confidence: 86 };
  }
  if (/\b(manufacturer|manufacturing\s+unit|we\s+manufacture|factory)\b/i.test(src)) {
    return { vendorType: 'Manufacturer', confidence: 86 };
  }
  if (/\bdistributor\b/i.test(src)) {
    return { vendorType: 'Distributor', confidence: 82 };
  }
  if (/\bdealer\b/i.test(src)) {
    return { vendorType: 'Dealer', confidence: 80 };
  }
  if (/\bstockist\b/i.test(src)) {
    return { vendorType: 'Stockist', confidence: 80 };
  }
  if (/\bfabricator|fabrication\b/i.test(src)) {
    return { vendorType: 'Fabricator', confidence: 78 };
  }
  if (/\bservice\s+provider|calibration|amc|maintenance\s+services\b/i.test(src)) {
    return { vendorType: 'Service Provider', confidence: 78 };
  }
  if (/\bimporter\b/i.test(src)) {
    return { vendorType: 'Importer', confidence: 76 };
  }
  if (/\bexporter\b/i.test(src)) {
    return { vendorType: 'Exporter', confidence: 76 };
  }
  if (/\btrader|trading\b/i.test(src)) {
    return { vendorType: 'Trader', confidence: 75 };
  }
  return { vendorType: 'Distributor', confidence: 55 };
}

function detectDepartmentFromContext(ctx: string): VendorContact['department'] {
  const l = ctx.toLowerCase();
  if (/\b(purchase|procurement|sourcing|buyer)\b/.test(l)) return 'Purchase';
  if (/\b(sales|marketing|enquiry|inquiry|rfq|quote|business\s+dev)\b/.test(l)) return 'Sales';
  if (/\b(support|helpdesk|care)\b/.test(l)) return 'Support';
  if (/\b(service|technical|application|engineer)\b/.test(l)) return 'Service';
  if (/\b(accounts|billing|finance|gst|payment)\b/.test(l)) return 'Accounts';
  return 'General';
}

export function extractContactsFromText(text: string, sourceName: string): VendorContact[] {
  const src = text || '';
  const lines = src.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const emails = Array.from(
    new Set(
      (src.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])
        .map((e) => e.trim().toLowerCase())
        .filter((e) => !e.endsWith('.png') && !e.endsWith('.jpg') && !e.includes('example.com'))
    )
  );

  const phoneRegex = /(?:\+91[\s\-]?|0)?[6-9]\d{4}[\s\-]?\d{5}|\b0\d{2,4}[\s\-]?\d{6,8}\b/g;
  const rawPhones = (src.match(phoneRegex) || []).map((p) => p.replace(/\s+/g, ' ').trim());
  const seenPhoneDigits = new Set<string>();
  const uniquePhones: Array<{ formatted: string; isLandline: boolean; context: string }> = [];

  for (const ph of rawPhones) {
    const digits = ph.replace(/\D/g, '');
    const key = digits.length >= 10 ? digits.slice(-10) : digits;
    if (!key || key.length < 8 || seenPhoneDigits.has(key)) continue;
    seenPhoneDigits.add(key);
    const matchingLine = lines.find((l) => l.includes(ph)) || '';
    const isLandline = /^0\d{2,4}/.test(digits) && !/^[6-9]/.test(key);
    uniquePhones.push({ formatted: ph, isLandline, context: matchingLine });
  }

  const contactNames: Array<{ name: string; department: VendorContact['department']; designation?: string; line: string }> = [];
  for (const line of lines) {
    const labeled = line.match(
      /(?:Contact\s*Person|Key\s*Contact|Attn|Kind\s*Attn|Representative|Name|Sales\s*(?:Head|Desk|Manager|Lead)?|Purchase\s*(?:Head|Desk|Support|Manager)?|Accounts\s*(?:Head|Manager)?|Support\s*(?:Head|Desk)?)\s*[:\-]\s*([A-Z][a-zA-Z.]+(?:\s+[A-Z][a-zA-Z.]+){0,3})/i
    );
    if (labeled && labeled[1]) {
      contactNames.push({
        name: labeled[1].trim(),
        department: detectDepartmentFromContext(line),
        line,
      });
      continue;
    }

    const honorific = line.match(
      /\b(?:Mr\.?|Ms\.?|Mrs\.?|Er\.?)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})(?:\s*[-–,(]\s*([^)\n]{2,40}))?/
    );
    if (honorific && honorific[1]) {
      contactNames.push({
        name: honorific[1].trim(),
        department: detectDepartmentFromContext(line),
        designation: honorific[2]?.trim(),
        line,
      });
    }
  }

  const contacts: VendorContact[] = [];
  const totalSlots = Math.max(contactNames.length, emails.length, Math.min(uniquePhones.length, 3), 0);

  if (totalSlots === 0) return [];

  for (let i = 0; i < totalSlots; i++) {
    const nameEntry = contactNames[i];
    const emailEntry = emails[i];
    const mobileObj = uniquePhones.filter((p) => !p.isLandline)[i];
    const altMobileObj = i === 0 ? uniquePhones.filter((p) => !p.isLandline)[totalSlots] : undefined;
    const landlineObj = i === 0 ? uniquePhones.find((p) => p.isLandline) : undefined;

    if (!nameEntry && !emailEntry && !mobileObj) continue;

    const ctx = `${nameEntry?.line || ''} ${mobileObj?.context || ''} ${emailEntry || ''}`;
    const whatsappMatch = /whatsapp|wa\.me/i.test(ctx) ? mobileObj?.formatted : undefined;
    const dept =
      nameEntry?.department && nameEntry.department !== 'General'
        ? nameEntry.department
        : detectDepartmentFromContext(ctx);

    contacts.push({
      id: `CNT-${i + 1}`,
      name: nameEntry?.name || (dept !== 'General' ? `${dept} Desk` : ''),
      department: dept,
      designation: nameEntry?.designation,
      email: emailEntry || undefined,
      mobile: mobileObj?.formatted || undefined,
      alternateMobile: altMobileObj?.formatted || undefined,
      landline: landlineObj?.formatted || undefined,
      whatsapp: whatsappMatch,
      isPrimary: i === 0,
      source: sourceName,
      confidence: nameEntry && (emailEntry || mobileObj) ? 92 : 80,
    });
  }

  return contacts;
}

export function extractStructuredAddressFromText(
  text: string,
  sourceName: string,
  gstin?: string
): VendorStructuredAddress {
  const src = text || '';
  const lines = src.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const pinMatch = src.match(/\b([1-9][0-9]{5})\b/);
  const pincode = pinMatch ? pinMatch[1] : '';

  let city = '';
  let state = '';
  const lowerSrc = src.toLowerCase();
  for (const entry of KNOWN_INDIAN_CITIES) {
    if (new RegExp(`\\b${entry.city.toLowerCase()}\\b`).test(lowerSrc)) {
      city = entry.city === 'Bangalore' ? 'Bengaluru' : entry.city;
      state = entry.state;
      break;
    }
  }

  if (!state && gstin && validateGstinFormat(gstin)) {
    state = INDIAN_GST_STATE_CODES[gstin.slice(0, 2)] || '';
  }

  let rawAddress = '';
  const labeledAddr = src.match(
    /(?:Regd\.?\s*Office|Head\s*Office|Works|Factory|Company\s*Address|Address)\s*[:\-]\s*([^\n]{10,220})/i
  );
  if (labeledAddr && labeledAddr[1]) {
    rawAddress = labeledAddr[1].trim();
  } else {
    const industrialLine = lines.find((l) =>
      /\b(plot\s*no|gat\s*no|survey\s*no|midc|gidc|industrial\s*(?:estate|area|park)|phase\s*[-–]?\s*[ivx0-9]+|sector\s*[-–]?\s*[0-9]+|chambers|arcade|complex|road|marg|nagar)\b/i.test(
        l
      )
    );
    if (industrialLine) {
      rawAddress = industrialLine;
    } else if (pincode) {
      const pinLine = lines.find((l) => l.includes(pincode));
      if (pinLine) rawAddress = pinLine;
    }
  }

  let plotOrBuilding = '';
  let street = '';
  let industrialEstateOrArea = '';

  if (rawAddress) {
    const plotM = rawAddress.match(/\b((?:Plot|Unit|Shop|Shed|Office|Gat|Survey)\s*(?:No\.?)?\s*[A-Z0-9\-\/]+)/i);
    if (plotM) plotOrBuilding = plotM[1].trim();
    const indM = rawAddress.match(/\b([A-Za-z0-9\s]+?(?:MIDC|GIDC|Industrial\s+(?:Estate|Area|Park)|Phase\s*[IVX0-9]+|Sector\s*[0-9]+))/i);
    if (indM) industrialEstateOrArea = indM[1].trim();
    const rdM = rawAddress.match(/\b([A-Za-z0-9\s]+?(?:Road|Rd\.?|Marg|Street|Highway|Lane))/i);
    if (rdM) street = rdM[1].trim();
  }

  const splitConfidence =
    (rawAddress ? 45 : 0) + (city ? 25 : 0) + (state ? 15 : 0) + (pincode ? 15 : 0);

  return {
    plotOrBuilding: plotOrBuilding || undefined,
    street: street || undefined,
    industrialEstateOrArea: industrialEstateOrArea || undefined,
    city: city || undefined,
    state: state || undefined,
    country: /\b(india|midc|gidc|pin\s*\d{6}|[0-9]{2}[A-Z]{5})/i.test(src) || city || state ? 'India' : undefined,
    pincode: pincode || undefined,
    rawAddress: rawAddress || '',
    splitConfidence,
    source: sourceName,
  };
}

export function extractCompanyIdentityFromText(text: string, sourceName: string, websiteUrl?: string): {
  companyName: string;
  legalName: string;
  tradingNames: string[];
  website: string;
} {
  const src = text || '';
  const lines = src.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 2 && l.length < 130);

  let legalName = '';
  let companyName = '';
  const tradingNames: string[] = [];

  const labeledLegal = src.match(/(?:Legal\s*Name|Registered\s*(?:Entity|Name)|Trade\s*Name)\s*[:\-]\s*([^\n]{3,100})/i);
  if (labeledLegal) {
    legalName = labeledLegal[1].trim();
  }

  const labeledCompany = src.match(/(?:Company\s*Name|Vendor\s*Name|Supplier\s*Name|M\/s\.?)\s*[:\-]?\s*([^\n]{3,100})/i);
  if (labeledCompany) {
    companyName = labeledCompany[1].trim();
  }

  const BANNED_ROLE_TITLES = new Set([
    'trader',
    'wholesaler',
    'distributor',
    'authorised distributor',
    'authorized distributor',
    'dealer',
    'supplier',
    'manufacturer',
    'exporter',
    'importer',
    'stockist',
    'vendor',
    'home',
    'welcome',
    'products',
    'services',
    'contact us',
    'about us',
    'page',
    'untitled',
    'proprietorship',
    'nature of business',
    'legal status of firm',
  ]);

  const stripTitleSuffix = (l: string) => {
    const byMatch = l.match(/\bby\s+([A-Z][A-Za-z0-9&.,\s'-]{2,80}?)(?:,\s*[A-Z][A-Za-z\s]{1,35})?(?:\s*[-–|]|$)/);
    if (byMatch && byMatch[1] && !BANNED_ROLE_TITLES.has(byMatch[1].trim().toLowerCase())) {
      return byMatch[1].trim();
    }
    return l
      .split(/\s*[-–|]\s*/)[0]
      .replace(/\s+in\s+[A-Z][a-zA-Z0-9\s.'-]{1,35},\s*[A-Z][a-zA-Z0-9\s.'-]{1,35}$/, '')
      .trim();
  };

  const isInvalidCompanyCandidate = (core: string) => {
    const low = core.toLowerCase().trim();
    if (!low || low.length <= 2) return true;
    if (BANNED_ROLE_TITLES.has(low)) return true;
    if (/^(?:trader|wholesaler|distributor|dealer|nature of business|total number|gst registration|legal status|annual turnover|gst no)\b/i.test(low)) {
      return true;
    }
    return false;
  };

  const entityLine = lines.find((l) => {
    const core = stripTitleSuffix(l);
    return (
      !isInvalidCompanyCandidate(core) &&
      !isPlatformAttributionOrNoise(core) &&
      !looksLikeMarketingTagline(core) &&
      !looksLikeAddressBlock(core) &&
      /\b(pvt\.?\s*ltd\.?|private\s+limited|llp|limited|inc\.?|corp\.?|corporation|automation\s+systems|technologies|enterprises|industries|engineering|switchgear|controls)\b/i.test(
        core
      ) &&
      !/^(copyright|all\s+rights|we\s+are|welcome\s+to|our\s+)/i.test(core)
    );
  });

  if (!legalName && entityLine) {
    legalName = stripTitleSuffix(entityLine);
  }
  if (!companyName || isInvalidCompanyCandidate(companyName)) {
    const cleanCandidate = lines.find((l) => {
      const core = stripTitleSuffix(l);
      return (
        !isInvalidCompanyCandidate(core) &&
        !isPlatformAttributionOrNoise(core) &&
        !looksLikeMarketingTagline(core) &&
        !looksLikeAddressBlock(core)
      );
    });
    const firstPart = cleanCandidate ? stripTitleSuffix(cleanCandidate) : '';
    companyName = legalName || (firstPart.length > 2 && firstPart.length <= 90 ? firstPart : '');
  }

  companyName = companyName
    .replace(/\s*[-–|]\s*(Industrial|Catalog|Brochure|Home|About).*$/i, '')
    .replace(/\s+in\s+[A-Z][a-zA-Z0-9\s.'-]{1,35},\s*[A-Z][a-zA-Z0-9\s.'-]{1,35}$/, '')
    .trim();
  legalName = legalName
    .replace(/\s*[-–|]\s*(Industrial|Catalog|Brochure|Home|About).*$/i, '')
    .replace(/\s+in\s+[A-Z][a-zA-Z0-9\s.'-]{1,35},\s*[A-Z][a-zA-Z0-9\s.'-]{1,35}$/, '')
    .trim();

  const urlMatch = src.match(/https?:\/\/[^\s"'<>]+|www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i);
  const detectedWebsite =
    websiteUrl?.trim() ||
    (urlMatch ? (urlMatch[0].startsWith('http') ? urlMatch[0] : `https://${urlMatch[0]}`) : '');

  if (companyName && legalName && companyName.toLowerCase() !== legalName.toLowerCase()) {
    tradingNames.push(companyName);
  }

  return {
    companyName,
    legalName: legalName || companyName,
    tradingNames,
    website: detectedWebsite,
  };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseNumberOrUndef(val: string | undefined): number | undefined {
  if (!val) return undefined;
  const cleaned = val.replace(/[₹$,%\sRsINR]/gi, '').replace(/,/g, '');
  if (!cleaned) return undefined;
  const num = Number(cleaned);
  return !isNaN(num) && num > 0 ? num : undefined;
}

/**
 * Deterministic CSV / Spreadsheet table parser preserving exact Part Codes and separated MRP vs Basic vs Purchase Rate
 */
export function parseTabularProductsFromCsv(
  csvText: string,
  fileName: string,
  vendorId: string = 'NEW',
  columnMappingOverride?: Record<string, string>
): Array<Omit<VendorCatalogProduct, 'id'>> {
  const blocks = (csvText || '').split(/---\s*SHEET:\s*[^-]+---\s*/i);
  const results: Array<Omit<VendorCatalogProduct, 'id'>> = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    // Locate header line within first 5 lines
    let headerIdx = -1;
    let rawHeaders: string[] = [];
    let headers: string[] = [];
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const cols = splitCsvLine(lines[i]);
      const lowCols = cols.map((h) => h.toLowerCase());
      if (
        lowCols.some((c) => /product|item|description|part|model|sku|material|designation/.test(c)) &&
        cols.length >= 2
      ) {
        headerIdx = i;
        rawHeaders = cols;
        headers = lowCols;
        break;
      }
    }
    if (headerIdx === -1) continue;

    const findCol = (overrideKey: string, pattern: RegExp) => {
      const overrideHeader = columnMappingOverride?.[overrideKey];
      if (overrideHeader) {
        const exactIdx = rawHeaders.findIndex((h) => h.trim().toLowerCase() === overrideHeader.trim().toLowerCase());
        if (exactIdx !== -1) return exactIdx;
      }
      return headers.findIndex((h) => pattern.test(h));
    };

    const idxName = findCol('productName', /product\s*name|item\s*name|material\s*name|title|item$/i);
    const idxDesc = findCol('description', /desc/i);
    const idxBrand = findCol('brand', /brand|make|manufacturer(?!.*code)|oem/i);
    const idxPart = findCol('partNumber', /part\s*(?:code|no|number)|designation|sku|order\s*code|mfr\s*code/i);
    const idxModel = findCol('modelNumber', /model/i);
    const idxCat = findCol('category', /^category|material\s*category/i);
    const idxSub = findCol('subCategory', /sub\s*cat|type/i);
    const idxFamily = findCol('productFamily', /family|series/i);
    const idxSpec = findCol('specification', /spec|rating|size|dimension/i);
    const idxUom = findCol('uom', /uom|unit/i);
    const idxMrp = findCol('mrp', /mrp|list\s*price/i);
    const idxBasic = findCol('basicRate', /basic\s*rate|basic\s*price/i);
    const idxDisc = findCol('discountPercent', /disc/i);
    const idxPurchase = findCol('purchaseRate', /purchase\s*rate|net\s*rate|dealer\s*rate|landing|^rate$|^price$/i);

    for (let r = headerIdx + 1; r < lines.length; r++) {
      const cells = splitCsvLine(lines[r]);
      if (cells.length === 0 || cells.every((c) => !c)) continue;

      const rawNameCell = (idxName !== -1 ? cells[idxName] : '') || (idxDesc !== -1 ? cells[idxDesc] : '') || '';
      const rawDescCell = (idxDesc !== -1 ? cells[idxDesc] : '') || '';
      const partCodeRaw = idxPart !== -1 ? cells[idxPart] : idxModel !== -1 ? cells[idxModel] : '';
      const modelRaw = idxModel !== -1 ? cells[idxModel] : partCodeRaw;
      const rawBrand = idxBrand !== -1 ? cells[idxBrand] : '';
      const rawCategory = idxCat !== -1 ? cells[idxCat] : '';
      const rawSubCategory = idxSub !== -1 ? cells[idxSub] : '';
      const rawFamily = idxFamily !== -1 ? cells[idxFamily] : '';
      const rawSpec = idxSpec !== -1 ? cells[idxSpec] : '';
      const uom = (idxUom !== -1 ? cells[idxUom] : '') || 'NOS';

      const originalRowText = cells.filter(Boolean).join(' | ');
      const resolved = resolveProductIdentityFields({
        rawProductName: rawNameCell || rawDescCell || partCodeRaw || cells[0],
        sourceProductName: rawNameCell || partCodeRaw || rawDescCell,
        productDesignation: partCodeRaw || modelRaw,
        brand: rawBrand,
        partNumber: partCodeRaw ? preserveExactPartCode(partCodeRaw) : undefined,
        modelNumber: modelRaw ? preserveExactPartCode(modelRaw) : undefined,
        description: rawDescCell,
        specification: rawSpec,
        productFamily: rawFamily,
        category: rawCategory,
        subCategory: rawSubCategory,
        originalSourceText: originalRowText,
      });

      if (!resolved.productName || resolved.productName.length < 2) continue;

      const mrp = idxMrp !== -1 ? parseNumberOrUndef(cells[idxMrp]) : undefined;
      const basicRate = idxBasic !== -1 ? parseNumberOrUndef(cells[idxBasic]) : undefined;
      const discountPercent = idxDisc !== -1 ? parseNumberOrUndef(cells[idxDisc]) : undefined;
      const purchaseRate = idxPurchase !== -1 ? parseNumberOrUndef(cells[idxPurchase]) : undefined;

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
        mrp,
        basicRate,
        purchaseRate,
        originalSourceText: originalRowText,
        inProductSection: true,
      });

      if (!validation.isValid) continue;

      results.push({
        vendorId,
        catalogFileName: fileName,
        productName: resolved.productName,
        sourceProductName: resolved.sourceProductName,
        normalizedProductName: resolved.normalizedProductName,
        productDesignation: resolved.productDesignation,
        description: resolved.description,
        category: resolved.category,
        subCategory: resolved.subCategory || undefined,
        productFamily: resolved.productFamily,
        productType: resolved.productFamily,
        brand: resolved.brand,
        manufacturer: resolved.brand !== 'Unconfirmed' ? resolved.brand : '',
        manufacturerCode: resolved.manufacturerCode || undefined,
        partNumber: resolved.partNumber || undefined,
        modelNumber: resolved.modelNumber || undefined,
        specification: resolved.specification,
        uom,
        mrp,
        basicRate,
        discountPercent,
        purchaseRate,
        rate: purchaseRate ?? basicRate ?? mrp,
        currency: mrp || basicRate || purchaseRate ? 'INR' : undefined,
        sourceType: 'EXCEL',
        catalogueRow: r + 1,
        originalSourceText: originalRowText.slice(0, 240),
        extractionDate: new Date().toISOString().split('T')[0],
        aiAnalysisVersion: 'MRO-Intel-v4.0',
        catalogReference: `${fileName}, Row ${r + 1}`,
        evidence: originalRowText.slice(0, 140),
        keywords: [resolved.category, resolved.subCategory, resolved.brand, resolved.partNumber || '', resolved.productFamily].filter(Boolean),
        aiConfidence: Math.max(70, validation.breakdown.totalScore),
        confidenceLevel:
          validation.breakdown.status === 'VALID_HIGH'
            ? 'High'
            : validation.breakdown.status === 'VALID_MEDIUM'
              ? 'Medium'
              : 'Low',
        reviewStatus:
          validation.breakdown.status === 'NEEDS_REVIEW' || resolved.brand === 'Unconfirmed' ? 'Needs Review' : 'Verified',
        approvalStatus: 'APPROVED',
        contentClass: validation.contentClass,
        validationScore: validation.breakdown.totalScore,
        validationBreakdown: validation.breakdown,
      });
    }
  }

  return results;
}

export function inferOnboardingSourceType(fileName: string, explicitRole?: string): OnboardingSourceType {
  if (explicitRole) {
    const r = explicitRole.toUpperCase();
    if (r in COMPANY_SOURCE_PRIORITY) return r as OnboardingSourceType;
  }
  const lower = (fileName || '').toLowerCase();
  if (/gst|pan|certif|registration/.test(lower)) return 'GST_DOC';
  if (/card|visiting/.test(lower)) return 'BUSINESS_CARD';
  if (/brochure|flyer|leaflet/.test(lower)) return 'BROCHURE';
  if (/profile|about|company/.test(lower)) return 'COMPANY_PROFILE';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) return 'EXCEL';
  if (lower.endsWith('.pdf')) return 'CATALOGUE';
  if (/\.(jpg|jpeg|png|webp)$/.test(lower)) return 'IMAGE';
  return 'TEXT';
}

export interface SourceFieldSnapshot {
  sourceType: OnboardingSourceType;
  sourceName: string;
  confidence: number;
  companyName?: string;
  legalName?: string;
  vendorType?: string;
  gstin?: string;
  pan?: string;
  email?: string;
  mobile?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  website?: string;
}

export function detectSourceConflictsAndPickBest(snapshots: SourceFieldSnapshot[]): {
  resolvedFields: Record<string, { value: string; trace?: OnboardingSourceTrace }>;
  conflicts: OnboardingConflict[];
} {
  const fieldDefs: Array<{ key: keyof SourceFieldSnapshot; label: string }> = [
    { key: 'companyName', label: 'Company Name' },
    { key: 'legalName', label: 'Legal / Registered Name' },
    { key: 'vendorType', label: 'Vendor Type' },
    { key: 'gstin', label: 'GSTIN' },
    { key: 'pan', label: 'PAN Number' },
    { key: 'email', label: 'Primary Email' },
    { key: 'mobile', label: 'Primary Mobile' },
    { key: 'address', label: 'Company Address' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'pincode', label: 'PIN Code' },
    { key: 'website', label: 'Website URL' },
  ];

  const resolvedFields: Record<string, { value: string; trace?: OnboardingSourceTrace }> = {};
  const conflicts: OnboardingConflict[] = [];

  for (const def of fieldDefs) {
    const candidates: OnboardingConflictCandidate[] = [];
    for (const snap of snapshots) {
      const rawVal = snap[def.key];
      const val = typeof rawVal === 'string' ? rawVal.trim() : '';
      if (!val) continue;
      candidates.push({
        value: val,
        sourceType: snap.sourceType,
        sourceName: snap.sourceName,
        priority: COMPANY_SOURCE_PRIORITY[snap.sourceType] || 50,
        confidence: snap.confidence || 80,
      });
    }

    if (candidates.length === 0) {
      resolvedFields[def.key as string] = { value: '' };
      continue;
    }

    candidates.sort((a, b) => b.priority - a.priority || b.confidence - a.confidence);
    const best = candidates[0];

    const distinctMap = new Map<string, OnboardingConflictCandidate>();
    for (const c of candidates) {
      const normKey =
        def.key === 'mobile'
          ? normalizePhoneLast10(c.value)
          : def.key === 'website'
            ? normalizeDomain(c.value)
            : c.value.toLowerCase().replace(/\s+/g, ' ').trim();
      if (normKey && !distinctMap.has(normKey)) {
        distinctMap.set(normKey, c);
      }
    }

    const distinctCandidates = Array.from(distinctMap.values());
    if (distinctCandidates.length > 1 && def.key !== 'website') {
      conflicts.push({
        field: def.key as string,
        label: def.label,
        recommendedValue: best.value,
        candidates: distinctCandidates,
        resolvedValue: best.value,
      });
    }

    resolvedFields[def.key as string] = {
      value: best.value,
      trace: {
        field: def.key as string,
        label: def.label,
        value: best.value,
        sourceType: best.sourceType,
        sourceName: best.sourceName,
        confidence: best.confidence,
      },
    };
  }

  return { resolvedFields, conflicts };
}

function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(a.split(' ').filter((w) => w.length > 1));
  const tb = new Set(b.split(' ').filter((w) => w.length > 1));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  ta.forEach((w) => {
    if (tb.has(w)) inter++;
  });
  return inter / Math.max(ta.size, tb.size);
}

export function detectDuplicateVendors(
  candidate: {
    companyName?: string;
    legalName?: string;
    gstin?: string;
    pan?: string;
    website?: string;
    email?: string;
    mobile?: string;
    address?: string;
  },
  existingVendors: Vendor[]
): DuplicateVendorCandidate[] {
  const activeVendors = (existingVendors || []).filter((v) => !v.isDeleted);
  const candGst = (candidate.gstin || '').trim().toUpperCase();
  const candPan = (candidate.pan || '').trim().toUpperCase();
  const candName = normalizeCompanyName(candidate.companyName || '');
  const candLegal = normalizeCompanyName(candidate.legalName || '');
  const candDomain = normalizeDomain(candidate.website || candidate.email || '');
  const candEmail = (candidate.email || '').trim().toLowerCase();
  const candPhone = normalizePhoneLast10(candidate.mobile || '');

  const matches: DuplicateVendorCandidate[] = [];

  for (const v of activeVendors) {
    let score = 0;
    const matchedOn: string[] = [];

    const vGst = (v.gstin || '').trim().toUpperCase();
    const vPan = (v.pan || '').trim().toUpperCase();
    const vName = normalizeCompanyName(v.companyName || '');
    const vLegal = normalizeCompanyName(v.legalName || '');
    const vDomain = normalizeDomain(v.website || v.email || '');
    const vEmail = (v.email || '').trim().toLowerCase();
    const vPhone = normalizePhoneLast10(v.mobile || '');

    if (candGst && vGst && candGst === vGst && !candGst.startsWith('27AAAPV0000')) {
      score = Math.max(score, 99);
      matchedOn.push('Exact GSTIN');
    }
    if (candPan && vPan && candPan === vPan) {
      score = Math.max(score, 95);
      matchedOn.push('Exact PAN');
    }
    if (candDomain && vDomain && candDomain === vDomain) {
      score = Math.max(score, 88);
      matchedOn.push('Official Domain');
    }
    if (candEmail && vEmail && candEmail === vEmail) {
      score = Math.max(score, 90);
      matchedOn.push('Email Address');
    }
    if (candPhone && vPhone && candPhone.length >= 10 && candPhone === vPhone) {
      score = Math.max(score, 88);
      matchedOn.push('Mobile Number');
    }

    const nameSim = Math.max(
      candName && vName ? tokenSimilarity(candName, vName) : 0,
      candLegal && vLegal ? tokenSimilarity(candLegal, vLegal) : 0,
      candName && vLegal ? tokenSimilarity(candName, vLegal) : 0
    );
    if (candName && vName && candName === vName) {
      score = Math.max(score, 96);
      matchedOn.push('Company Name');
    } else if (nameSim >= 0.7) {
      const pct = Math.round(nameSim * 90);
      score = Math.max(score, pct);
      matchedOn.push('Similar Company Name');
    }

    if (score >= 68 && matchedOn.length > 0) {
      matches.push({
        vendorId: v.id,
        vendorCode: v.vendorCode || v.id,
        companyName: v.companyName,
        legalName: v.legalName,
        gstin: v.gstin,
        pan: v.pan,
        city: v.city,
        website: v.website,
        similarityScore: Math.min(99, score),
        matchedOn,
      });
    }
  }

  return matches.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 5);
}

export function reconcileBrandsWithMaster(
  extractedProducts: Array<Partial<VendorCatalogProduct>>,
  combinedText: string,
  existingBrands: BrandMasterItem[],
  sourceName: string,
  explicitBrands: string[] = []
): BrandAssociationDetail[] {
  const today = new Date().toISOString().split('T')[0];
  const counts = new Map<string, { name: string; count: number; evidences: string[]; confSum: number }>();

  for (const b of explicitBrands) {
    const clean = (b || '').trim();
    if (!clean || clean === 'Unconfirmed') continue;
    const key = clean.toLowerCase();
    if (!counts.has(key)) counts.set(key, { name: clean, count: 0, evidences: [], confSum: 0 });
  }

  for (const p of extractedProducts) {
    const b = (p.brand || '').trim();
    if (!b || b === 'Unconfirmed') continue;
    const key = b.toLowerCase();
    const cur = counts.get(key) || { name: b, count: 0, evidences: [], confSum: 0 };
    cur.count += 1;
    cur.confSum += p.aiConfidence || 88;
    if (p.evidence) cur.evidences.push(p.evidence);
    counts.set(key, cur);
  }

  const lowerText = (combinedText || '').toLowerCase();
  for (const bm of existingBrands) {
    if (bm.isDeleted) continue;
    const names = [bm.name, ...(bm.aliases || [])].filter(Boolean);
    for (const candidateName of names) {
      if (candidateName.length < 2) continue;
      const escaped = candidateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(lowerText)) {
        const key = bm.name.toLowerCase();
        if (!counts.has(key)) {
          counts.set(key, { name: bm.name, count: 0, evidences: [`Mentioned in ${sourceName}`], confSum: 82 });
        }
        break;
      }
    }
  }

  const associations: BrandAssociationDetail[] = [];

  counts.forEach((info) => {
    const norm = info.name.toLowerCase().trim();
    const exactMaster = existingBrands.find(
      (bm) =>
        !bm.isDeleted &&
        (bm.name.toLowerCase().trim() === norm ||
          (bm.aliases || []).some((al) => al.toLowerCase().trim() === norm))
    );

    const ambiguousMatches = exactMaster
      ? []
      : existingBrands
          .filter((bm) => !bm.isDeleted)
          .map((bm) => {
            const bmNorm = bm.name.toLowerCase().trim();
            let score = 0;
            if (bmNorm.startsWith(`${norm} `) || norm.startsWith(`${bmNorm} `)) {
              score = 82;
            } else if (bmNorm.includes(norm) || norm.includes(bmNorm)) {
              score = Math.round((Math.min(bmNorm.length, norm.length) / Math.max(bmNorm.length, norm.length)) * 95);
            } else {
              score = Math.round(tokenSimilarity(bmNorm, norm) * 90);
            }
            return { id: bm.id, name: bm.name, score };
          })
          .filter((m) => m.score >= 55)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

    const evidenceText = `${info.evidences.join(' ')} ${combinedText.slice(0, 8000)}`.trim();
    const rel = classifyBrandRelationship(evidenceText, info.name) as BrandRelationshipType;

    const avgConf = info.count > 0 ? Math.round(info.confSum / info.count) : 84;

    associations.push({
      brandId: exactMaster?.id,
      brandName: exactMaster ? exactMaster.name : info.name,
      relationshipType: rel,
      productCount: info.count,
      source: sourceName,
      confidence: Math.min(99, avgConf),
      firstDetected: today,
      lastVerified: today,
      evidence: info.evidences[0] || `Detected across ${sourceName}`,
      isExistingMaster: !!exactMaster,
      ambiguousMatches: ambiguousMatches.length > 0 ? ambiguousMatches : undefined,
      resolutionAction: exactMaster ? 'USE_EXISTING' : ambiguousMatches.length > 0 ? 'REVIEW' : 'CREATE_NEW',
    });
  });

  return associations.sort((a, b) => b.productCount - a.productCount || b.confidence - a.confidence);
}

export function reconcileCategoriesHierarchy(
  products: OnboardingProductCandidate[],
  existingCategories: MaterialCategory[],
  sourceName: string
): { categories: CategoryHierarchyDetection[]; productFamilies: string[] } {
  const map = new Map<string, CategoryHierarchyDetection>();
  const familySet = new Set<string>();

  for (const p of products) {
    if (!p.accepted) continue;
    const catName = (p.category || 'Mechanical Components').trim();
    const subCat = (p.subCategory || '').trim();
    const fam = p.productFamily || mapProductFamilyAndType(p.productName, catName, subCat).productFamily;
    const pType = p.productType || mapProductFamilyAndType(p.productName, catName, subCat).productType;
    if (fam) familySet.add(fam);

    const key = `${catName.toLowerCase()}::${subCat.toLowerCase()}::${fam.toLowerCase()}`;
    const matchedCat =
      existingCategories.find(
        (c) => c.isActive !== false && c.name.toLowerCase().trim() === catName.toLowerCase()
      ) ||
      existingCategories.find((c) => {
        if (c.isActive === false) return false;
        const cLow = c.name.toLowerCase().trim();
        if (cLow.length < 4) return false;
        const esc = cLow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${esc}\\b`, 'i').test(catName);
      });

    const cur = map.get(key) || {
      id: `CAT-DET-${map.size + 1}`,
      category: matchedCat ? matchedCat.name : catName,
      subCategory: subCat || undefined,
      productFamily: fam,
      productType: pType,
      specificationPattern: p.specification ? p.specification.slice(0, 60) : undefined,
      brands: [],
      productCount: 0,
      confidence: p.aiConfidence || 88,
      matchedCategoryId: matchedCat?.id,
      isExistingMaster: !!matchedCat,
      source: sourceName,
      selected: true,
    };

    cur.productCount += 1;
    if (p.brand && p.brand !== 'Unconfirmed' && !cur.brands.includes(p.brand)) {
      cur.brands.push(p.brand);
    }
    map.set(key, cur);
  }

  return {
    categories: Array.from(map.values()).sort((a, b) => b.productCount - a.productCount),
    productFamilies: Array.from(familySet),
  };
}

export function reconcileProductsWithMaster(
  vendorIdHint: string,
  rawProducts: Array<Partial<VendorCatalogProduct>>,
  existingProducts: ProductItem[],
  existingBrands: BrandMasterItem[],
  defaultSourceLabel: string
): OnboardingProductCandidate[] {
  const seenKey = new Set<string>();
  const output: OnboardingProductCandidate[] = [];
  const knownBrandNames = existingBrands.map((b) => b.name).filter(Boolean);

  for (let idx = 0; idx < rawProducts.length; idx++) {
    const p = rawProducts[idx];
    const resolved = resolveProductIdentityFields(
      {
        rawProductName: p.productName,
        sourceProductName: p.sourceProductName || p.productName,
        productDesignation: p.productDesignation || p.partNumber || p.modelNumber,
        brand: p.brand,
        partNumber: p.partNumber,
        manufacturerCode: p.manufacturerCode,
        modelNumber: p.modelNumber,
        description: p.description,
        specification: p.specification,
        productFamily: p.productFamily,
        category: p.category,
        subCategory: p.subCategory,
        application: p.application,
        originalSourceText: p.originalSourceText || p.evidence,
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
      imageUrl: p.imageUrl,
      detailUrl: p.detailUrl,
      sourceUrl: p.sourceUrl,
      mrp: typeof p.mrp === 'number' ? p.mrp : undefined,
      basicRate: typeof p.basicRate === 'number' ? p.basicRate : undefined,
      purchaseRate: typeof p.purchaseRate === 'number' ? p.purchaseRate : undefined,
      originalSourceText: p.originalSourceText || p.evidence || p.productName,
      inProductSection: true,
    });

    if (!validation.isValid) continue;

    const exactPart = resolved.partNumber ? preserveExactPartCode(resolved.partNumber) : undefined;
    const exactModel = resolved.modelNumber ? preserveExactPartCode(resolved.modelNumber) : exactPart;
    const brand = resolved.brand || 'Unconfirmed';
    const dedupeKey = `${brand.toLowerCase()}::${(exactPart || resolved.productName).toLowerCase()}`;
    if (seenKey.has(dedupeKey)) continue;
    seenKey.add(dedupeKey);

    const pmMatch = matchExtractedProductWithProductMaster(
      {
        partNumber: exactPart,
        modelNumber: exactModel,
        brand,
        productName: resolved.productName,
        specification: resolved.specification,
        category: resolved.category,
      },
      existingProducts,
      existingBrands
    );

    const mrp = typeof p.mrp === 'number' && !isNaN(p.mrp) && p.mrp > 0 ? p.mrp : undefined;
    const basicRate = typeof p.basicRate === 'number' && !isNaN(p.basicRate) && p.basicRate > 0 ? p.basicRate : undefined;
    const purchaseRate =
      typeof p.purchaseRate === 'number' && !isNaN(p.purchaseRate) && p.purchaseRate > 0
        ? p.purchaseRate
        : typeof p.rate === 'number' && !isNaN(p.rate) && p.rate > 0
          ? p.rate
          : undefined;
    const discountPercent =
      typeof p.discountPercent === 'number' && !isNaN(p.discountPercent) ? p.discountPercent : undefined;

    output.push({
      tempId: `ONB-PRD-${idx + 1}`,
      accepted: true,
      vendorId: vendorIdHint,
      catalogFileName: p.catalogFileName || defaultSourceLabel,
      productName: resolved.productName,
      sourceProductName: resolved.sourceProductName,
      normalizedProductName: resolved.normalizedProductName,
      productDesignation: resolved.productDesignation,
      description: resolved.description,
      category: resolved.category,
      subCategory: resolved.subCategory || undefined,
      productFamily: resolved.productFamily,
      productType: p.productType || resolved.productFamily,
      application: resolved.application || undefined,
      brand,
      manufacturer: p.manufacturer || (brand !== 'Unconfirmed' ? brand : ''),
      manufacturerCode: resolved.manufacturerCode || undefined,
      modelNumber: exactModel,
      partNumber: exactPart,
      specification: resolved.specification,
      uom: p.uom || 'NOS',
      mrp,
      basicRate,
      discountPercent,
      purchaseRate,
      rate: purchaseRate ?? basicRate ?? mrp,
      currency: mrp || basicRate || purchaseRate ? p.currency || 'INR' : undefined,
      sourcePage: p.sourcePage,
      catalogueRow: p.catalogueRow || idx + 1,
      originalSourceText: p.originalSourceText || p.evidence || resolved.sourceProductName,
      extractionDate: p.extractionDate || new Date().toISOString().split('T')[0],
      aiAnalysisVersion: p.aiAnalysisVersion || 'MRO-Intel-v4.0',
      imageUrl: p.imageUrl,
      detailUrl: p.detailUrl,
      sourceType: p.sourceType || 'TEXT',
      sourceUrl: p.sourceUrl,
      catalogReference: p.catalogReference || defaultSourceLabel,
      evidence: p.evidence || `Extracted from ${defaultSourceLabel}`,
      keywords: Array.isArray(p.keywords)
        ? p.keywords
        : [resolved.category, resolved.productFamily, brand, exactPart || ''].filter(Boolean),
      aiConfidence: typeof p.aiConfidence === 'number' ? p.aiConfidence : Math.max(70, validation.breakdown.totalScore),
      confidenceLevel:
        p.confidenceLevel ||
        (validation.breakdown.status === 'VALID_HIGH'
          ? 'High'
          : validation.breakdown.status === 'VALID_MEDIUM'
            ? 'Medium'
            : 'Low'),
      reviewStatus:
        pmMatch.matchStatus === 'AMBIGUOUS_MATCH' ||
        validation.breakdown.status === 'NEEDS_REVIEW' ||
        brand === 'Unconfirmed'
          ? 'Needs Review'
          : 'Verified',
      approvalStatus: 'APPROVED',
      matchedProductId: pmMatch.matchedProduct?.id,
      matchedProductName: pmMatch.matchedProduct?.itemName,
      matchedPartNumber: pmMatch.matchedProduct?.partNumber,
      matchPriority: pmMatch.priority,
      matchStatus: pmMatch.matchStatus,
      contentClass: validation.contentClass,
      validationScore: validation.breakdown.totalScore,
      validationBreakdown: validation.breakdown,
    });
  }

  return output;
}

export function computeOnboardingCompletion(params: {
  company: VendorOnboardingAnalysisResult['company'];
  structuredAddress: VendorStructuredAddress;
  contacts: VendorContact[];
  brands: BrandAssociationDetail[];
  categories: CategoryHierarchyDetection[];
  productFamilies: string[];
  products: OnboardingProductCandidate[];
  conflicts: OnboardingConflict[];
  sourceTraceability: OnboardingSourceTrace[];
}): OnboardingCompletionSummary {
  const primaryContact = params.contacts.find((c) => c.isPrimary) || params.contacts[0];

  const requiredChecks: Array<{ field: string; label: string; value: string }> = [
    { field: 'companyName', label: 'Company Name', value: params.company.companyName },
    { field: 'contactPerson', label: 'Primary Contact Person', value: primaryContact?.name || '' },
    { field: 'mobile', label: 'Primary Mobile / Phone', value: primaryContact?.mobile || '' },
    { field: 'email', label: 'Email Address', value: primaryContact?.email || '' },
    { field: 'address', label: 'Company Address', value: params.structuredAddress.rawAddress || '' },
    { field: 'city', label: 'City', value: params.structuredAddress.city || '' },
    { field: 'gstin', label: 'GSTIN', value: params.company.gstin || '' },
    { field: 'pan', label: 'PAN Number', value: params.company.pan || '' },
  ];

  const missingRequiredFields: OnboardingCompletionSummary['missingRequiredFields'] = [];
  const lowConfidenceFields: string[] = [];

  for (const chk of requiredChecks) {
    const val = (chk.value || '').trim();
    const conflict = (params.conflicts || []).find((c) => c.field === chk.field && !c.resolvedValue);
    const trace = (params.sourceTraceability || []).find((t) => t.field === chk.field);

    if (!val) {
      missingRequiredFields.push({
        field: chk.field,
        label: chk.label,
        reason: 'MISSING',
      });
    } else if (conflict) {
      missingRequiredFields.push({
        field: chk.field,
        label: chk.label,
        reason: 'CONFLICT',
      });
    } else if (trace && trace.confidence < 65) {
      lowConfidenceFields.push(chk.field);
      missingRequiredFields.push({
        field: chk.field,
        label: chk.label,
        reason: 'LOW_CONFIDENCE',
        confidence: trace.confidence,
      });
    }
  }

  const requiredFilled = requiredChecks.length - missingRequiredFields.filter((m) => m.reason === 'MISSING').length;
  const requiredPercent = Math.round((requiredFilled / requiredChecks.length) * 100);

  const optionalChecks = [
    params.company.legalName,
    params.company.website,
    params.company.vendorType,
    params.structuredAddress.state,
    params.structuredAddress.pincode,
    params.brands.length > 0 ? 'yes' : '',
    params.categories.length > 0 ? 'yes' : '',
    params.products.some((p) => p.accepted) ? 'yes' : '',
  ];
  const optionalFilled = optionalChecks.filter((v) => Boolean(v && String(v).trim())).length;
  const optionalPercent = Math.round((optionalFilled / optionalChecks.length) * 100);

  const overallPercent = Math.round(requiredPercent * 0.65 + optionalPercent * 0.35);

  return {
    overallPercent,
    requiredPercent,
    optionalPercent,
    missingRequiredFields,
    lowConfidenceFields,
    counts: {
      contacts: params.contacts.length,
      brands: params.brands.filter((b) => b.resolutionAction !== 'SKIP').length,
      categories: params.categories.filter((c) => c.selected).length,
      productFamilies: params.productFamilies.length,
      products: params.products.filter((p) => p.accepted).length,
    },
  };
}
