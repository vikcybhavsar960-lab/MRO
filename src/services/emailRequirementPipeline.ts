import * as XLSX from 'xlsx';
import {
  BrandMasterItem,
  Customer,
  EmailPipelineDiagnostic,
  EmailRfqItem,
  ExtractedEmailItem,
  ProductItem,
  Vendor,
} from '../types';
import { matchCatalogueRateDeterministic, normalizeBrand, normalizePartCode } from './rateMatchingEngine';
import { recommendCategoryForRequirement } from './categoryMatchingService';
import { CatalogueProduct } from '../types/catalogImport';

export interface GmailAttachmentDescriptor {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface ExtractedGmailContent {
  messageId: string;
  subject: string;
  senderName: string;
  senderEmail: string;
  receivedDate: string;
  plainTextBody: string;
  htmlBody: string;
  combinedBodyText: string;
  attachments: GmailAttachmentDescriptor[];
}

export interface EmailCatalogueCandidate {
  productId: string;
  brand: string;
  productName: string;
  partCode: string;
  manufacturerCode?: string;
  modelNumber?: string;
  category: string;
  subCategory?: string;
  specification?: string;
  mrp?: number;
  discountPercent?: number;
  purchaseRate?: number;
  supplierName?: string;
  confidence: number;
  matchReason: string;
}

export interface ParsedEmailRequirementResult {
  companyName: string;
  contactPerson: string;
  mobile: string;
  matchedCustomer?: Customer;
  items: ExtractedEmailItem[];
  deliveryTerms?: string;
  paymentTerms?: string;
  remarks?: string;
  originalEmailText: string;
  diagnostic: EmailPipelineDiagnostic;
}

const KNOWN_BRAND_ALIASES: Array<{ canonical: string; aliases: string[] }> = [
  { canonical: 'Schneider Electric', aliases: ['schneider electric', 'schneider', 'acti9', 'tesys', 'easy9'] },
  { canonical: 'Siemens', aliases: ['siemens', 'siemens ag', 'sirius', 'sentron', 'simatic'] },
  { canonical: 'ABB', aliases: ['abb', 'abb ltd'] },
  { canonical: 'L&T', aliases: ['l&t', 'lnt', 'larsen & toubro', 'larsen and toubro', 'lauritz knudsen'] },
  { canonical: 'SKF', aliases: ['skf', 'skf india'] },
  { canonical: 'FAG', aliases: ['fag', 'schaeffler'] },
  { canonical: 'NSK', aliases: ['nsk'] },
  { canonical: 'NTN', aliases: ['ntn'] },
  { canonical: 'TIMKEN', aliases: ['timken'] },
  { canonical: 'Festo', aliases: ['festo'] },
  { canonical: 'SMC', aliases: ['smc'] },
  { canonical: 'Janatics', aliases: ['janatics'] },
  { canonical: 'Parker', aliases: ['parker', 'parker hannifin'] },
  { canonical: 'Bosch Rexroth', aliases: ['bosch rexroth', 'rexroth'] },
  { canonical: 'Gates', aliases: ['gates'] },
  { canonical: 'Fenner', aliases: ['fenner'] },
  { canonical: 'MOSIL', aliases: ['mosil'] },
  { canonical: 'Havells', aliases: ['havells'] },
  { canonical: 'Legrand', aliases: ['legrand'] },
  { canonical: 'Polycab', aliases: ['polycab'] },
  { canonical: 'Finolex', aliases: ['finolex'] },
  { canonical: 'Omron', aliases: ['omron'] },
  { canonical: 'Mitsubishi', aliases: ['mitsubishi', 'mitsubishi electric'] },
  { canonical: 'Danfoss', aliases: ['danfoss'] },
  { canonical: 'Audco', aliases: ['audco'] },
  { canonical: 'Kirloskar', aliases: ['kirloskar'] },
  { canonical: 'Crompton', aliases: ['crompton'] },
  { canonical: '3M', aliases: ['3m'] },
  { canonical: 'Karam', aliases: ['karam'] },
];

const NON_ITEM_LINE_PATTERNS: RegExp[] = [
  /^(dear|hi|hello|greetings|good\s+(morning|afternoon|evening)|sir|madam|team)\b/i,
  /^(please\s+(quote|find|provide|send|share|refer|note)|kindly\s+(quote|provide|send|share)|we\s+(require|need|request)|below\s+(are|is)|following\s+(are|is))/i,
  /^(thanks|thank\s+you|regards|best\s+regards|warm\s+regards|yours\s+sincerely|sincerely|cheers|sent\s+from)/i,
  /^(payment\s*terms?|delivery\s*(terms?|location|period|address)|required\s*delivery|freight|gst|tax|validity|subject|from|to|cc|date|tel|phone|mob|mobile|email|website|gstin|pan)\s*[:\-]/i,
  /^(note|disclaimer|confidential|this\s+email)/i,
  /^[-_=*]{3,}$/,
];

const PRODUCT_TYPE_PATTERNS: Array<{ name: string; category: string; subCategory: string; regex: RegExp }> = [
  { name: 'MCB', category: 'Electrical', subCategory: 'MCB', regex: /\b(mcb|miniature\s+circuit\s+breaker)\b/i },
  { name: 'MCCB', category: 'Electrical', subCategory: 'MCCB', regex: /\b(mccb|molded\s+case\s+circuit\s+breaker|moulded\s+case\s+circuit\s+breaker)\b/i },
  { name: 'RCCB / ELCB', category: 'Electrical', subCategory: 'RCCB', regex: /\b(rccb|elcb|rcbo|residual\s+current)\b/i },
  { name: 'Contactor', category: 'Electrical', subCategory: 'Contactors', regex: /\b(contactor|power\s+contactor|aux(?:iliary)?\s+contactor)\b/i },
  { name: 'Overload Relay', category: 'Electrical', subCategory: 'Relays', regex: /\b(overload\s+relay|thermal\s+relay|relay)\b/i },
  { name: 'HRC Fuse Link', category: 'Electrical', subCategory: 'Fuses', regex: /\b(hrc\s+fuse|fuse\s+link|fuse)\b/i },
  { name: 'Industrial Cable', category: 'Electrical Cables', subCategory: 'Power & Control Cables', regex: /\b(cable|armoured\s+cable|flexible\s+wire|wire)\b/i },
  { name: 'Ball Bearing', category: 'Bearings', subCategory: 'Deep Groove Ball Bearings', regex: /\b(deep\s+groove\s+ball\s+bearing|ball\s+bearing|roller\s+bearing|taper\s+bearing|bearing)\b/i },
  { name: 'Pneumatic Cylinder', category: 'Pneumatics', subCategory: 'Pneumatic Cylinders', regex: /\b(pneumatic\s+cylinder|air\s+cylinder|profile\s+cylinder|cylinder)\b/i },
  { name: 'Solenoid Valve', category: 'Pneumatics', subCategory: 'Solenoid Valves', regex: /\b(solenoid\s+valve|directional\s+valve|5\/2\s*way\s*valve)\b/i },
  { name: 'Ball Valve', category: 'Valves', subCategory: 'Ball Valves', regex: /\b(ball\s+valve|gate\s+valve|globe\s+valve|butterfly\s+valve|check\s+valve|nrv|valve)\b/i },
  { name: 'Timing / V-Belt', category: 'Belts & Power Transmission', subCategory: 'Industrial Belts', regex: /\b(timing\s+belt|v[\s-]?belt|cogged\s+belt|belt)\b/i },
  { name: 'Industrial Grease / Lubricant', category: 'Lubricants & Greases', subCategory: 'Industrial Greases', regex: /\b(grease|lubricant|hydraulic\s+oil|gear\s+oil|synthetic\s+oil)\b/i },
  { name: 'Electric Motor', category: 'Motors', subCategory: 'Induction Motors', regex: /\b(induction\s+motor|electric\s+motor|servo\s+motor|motor)\b/i },
  { name: 'Industrial Pump', category: 'Pumps', subCategory: 'Centrifugal Pumps', regex: /\b(centrifugal\s+pump|hydraulic\s+pump|submersible\s+pump|pump)\b/i },
  { name: 'Proximity / Industrial Sensor', category: 'Sensors', subCategory: 'Proximity Sensors', regex: /\b(proximity\s+sensor|photoelectric\s+sensor|pressure\s+transmitter|sensor)\b/i },
  { name: 'Fastener / Bolt / Nut', category: 'Fasteners', subCategory: 'Bolts & Nuts', regex: /\b(hex\s+bolt|allen\s+bolt|stud|washer|fastener|bolt|nut|screw)\b/i },
  { name: 'Safety Gear / PPE', category: 'Safety Products', subCategory: 'PPE', regex: /\b(safety\s+shoe|safety\s+helmet|safety\s+gloves|goggles|harness|ppe)\b/i },
];

export function decodeGmailBase64UrlUtf8(base64Url: string): string {
  if (!base64Url) return '';
  const normalized = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLen);

  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(padded, 'base64').toString('utf-8');
    }
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return '';
  }
}

export function stripHtmlToCleanText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<\/(td|th)>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Recursively traverses a Gmail API `messages.get?format=full` payload to extract
 * headers, plain-text body, HTML body, and all nested attachment descriptors.
 */
export function extractGmailMessageContent(msgData: any): ExtractedGmailContent {
  const headers: Array<{ name: string; value: string }> = msgData?.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => String(h?.name || '').toLowerCase() === name.toLowerCase())?.value || '';

  const subject = getHeader('Subject') || 'Customer Material Requirement';
  const fromRaw = getHeader('From') || '';
  const dateHeader = getHeader('Date');

  let receivedDate = new Date().toISOString().split('T')[0];
  if (dateHeader) {
    const parsedDate = new Date(dateHeader);
    if (!isNaN(parsedDate.getTime())) {
      receivedDate = parsedDate.toISOString().split('T')[0];
    }
  }

  let senderEmail = fromRaw.trim();
  let senderName = fromRaw.trim();
  const fromMatch = fromRaw.match(/^(.*?)\s*<(.+?)>$/);
  if (fromMatch) {
    senderName = fromMatch[1].replace(/["']/g, '').trim() || fromMatch[2].trim();
    senderEmail = fromMatch[2].trim();
  }

  const plainParts: string[] = [];
  const htmlParts: string[] = [];
  const attachments: GmailAttachmentDescriptor[] = [];

  const walkPart = (part: any) => {
    if (!part) return;
    const mimeType = String(part.mimeType || '').toLowerCase();
    const filename = String(part.filename || '').trim();

    if (filename && part.body?.attachmentId) {
      attachments.push({
        attachmentId: String(part.body.attachmentId),
        filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: Number(part.body?.size || 0),
      });
    } else if (mimeType === 'text/plain' && part.body?.data) {
      const decoded = decodeGmailBase64UrlUtf8(part.body.data);
      if (decoded.trim()) plainParts.push(decoded.trim());
    } else if (mimeType === 'text/html' && part.body?.data) {
      const decoded = decodeGmailBase64UrlUtf8(part.body.data);
      if (decoded.trim()) htmlParts.push(decoded.trim());
    }

    if (Array.isArray(part.parts)) {
      for (const child of part.parts) {
        walkPart(child);
      }
    }
  };

  walkPart(msgData?.payload);

  const plainTextBody = plainParts.join('\n\n').trim();
  const htmlBody = htmlParts.join('\n\n').trim();
  const strippedHtml = htmlBody ? stripHtmlToCleanText(htmlBody) : '';

  const combinedBodyText =
    plainTextBody || strippedHtml || String(msgData?.snippet || '').trim();

  return {
    messageId: String(msgData?.id || ''),
    subject,
    senderName,
    senderEmail,
    receivedDate,
    plainTextBody,
    htmlBody,
    combinedBodyText,
    attachments,
  };
}

export function buildSafeEmailDiagnostic(params: {
  emailReceived: boolean;
  messageRetrieved: boolean;
  subject?: string;
  bodyText?: string;
  attachmentCount?: number;
  attachmentsExtractedCount?: number;
  parserStarted: boolean;
  extractedItemCount: number;
  parserEngine: string;
  notes?: string;
}): EmailPipelineDiagnostic {
  const hasSubject = Boolean(params.subject && params.subject.trim().length > 0);
  const hasBody = Boolean(params.bodyText && params.bodyText.trim().length > 0);
  const hasAttachment = Number(params.attachmentCount || 0) > 0;

  return {
    emailReceived: params.emailReceived ? 'YES' : 'NO',
    messageRetrieved: params.messageRetrieved ? 'YES' : 'NO',
    subjectRetrieved: hasSubject ? 'YES' : 'NO',
    bodyRetrieved: hasBody ? 'YES' : 'NO',
    attachmentRetrieved: hasAttachment ? 'YES' : 'NO',
    parserStarted: params.parserStarted ? 'YES' : 'NO',
    attachmentCount: Number(params.attachmentCount || 0),
    attachmentsExtractedCount: Number(params.attachmentsExtractedCount || 0),
    extractedItemCount: Number(params.extractedItemCount || 0),
    parserEngine: params.parserEngine,
    timestamp: new Date().toISOString(),
    notes: params.notes,
  };
}

export function formatDiagnosticLines(diag: EmailPipelineDiagnostic): string[] {
  return [
    `Email Received: ${diag.emailReceived}`,
    `Message Retrieved: ${diag.messageRetrieved}`,
    `Subject Retrieved: ${diag.subjectRetrieved}`,
    `Body Retrieved: ${diag.bodyRetrieved}`,
    `Attachment Retrieved: ${diag.attachmentRetrieved}`,
    `Parser Started: ${diag.parserStarted}`,
  ];
}

export function normalizeUom(raw?: string): string {
  const clean = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\.$/, '');
  if (!clean) return 'NOS';
  if (['NO', 'NOS', 'NO.', 'PC', 'PCS', 'PIECE', 'PIECES', 'EA', 'EACH', 'UNIT', 'UNITS', 'QTY'].includes(clean)) {
    return 'NOS';
  }
  if (['SET', 'SETS'].includes(clean)) return 'SET';
  if (['KG', 'KGS', 'KILOGRAM', 'KILOGRAMS'].includes(clean)) return 'KG';
  if (['MTR', 'MTRS', 'M', 'METER', 'METERS', 'METRE', 'METRES'].includes(clean)) return 'MTR';
  if (['LTR', 'LTRS', 'L', 'LITER', 'LITERS', 'LITRE', 'LITRES'].includes(clean)) return 'LTR';
  if (['PKT', 'PKTS', 'PACK', 'PACKS', 'PACKET', 'PACKETS'].includes(clean)) return 'PKT';
  if (['BOX', 'BOXES'].includes(clean)) return 'BOX';
  if (['ROLL', 'ROLLS'].includes(clean)) return 'ROLL';
  if (['PAIR', 'PAIRS'].includes(clean)) return 'PAIR';
  return 'NOS';
}

export function getConfidenceLevel(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 85) return 'High';
  if (score >= 60) return 'Medium';
  return 'Low';
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detectSupportedBrand(
  text: string,
  brands: BrandMasterItem[] = [],
  products: ProductItem[] = [],
  vendors: Vendor[] = []
): string {
  const lower = text.toLowerCase();

  // 1. Check ERP Brand Master first (authoritative)
  for (const b of brands) {
    if (!b?.name) continue;
    const candidates = [b.name, b.code, ...(Array.isArray(b.aliases) ? b.aliases : [])].filter(Boolean) as string[];
    for (const c of candidates) {
      if (c.length < 2) continue;
      if (new RegExp(`(^|[^a-z0-9])${escapeRegExp(c.toLowerCase())}([^a-z0-9]|$)`, 'i').test(lower)) {
        return b.name;
      }
    }
  }

  // 2. Check existing Product Master & Vendor Catalogue brands
  const catalogBrands = new Set<string>();
  for (const p of products) {
    if (!p?.isDeleted && p?.brand) catalogBrands.add(p.brand.trim());
  }
  for (const v of vendors) {
    if (!v?.isDeleted && Array.isArray(v.brandsSupplied)) {
      v.brandsSupplied.forEach((br) => br && catalogBrands.add(br.trim()));
    }
  }
  for (const br of catalogBrands) {
    if (br.length < 2) continue;
    if (new RegExp(`(^|[^a-z0-9])${escapeRegExp(br.toLowerCase())}([^a-z0-9]|$)`, 'i').test(lower)) {
      return br;
    }
  }

  // 3. Check known industrial OEM brand aliases (strictly matching text present in email)
  for (const entry of KNOWN_BRAND_ALIASES) {
    for (const alias of entry.aliases) {
      if (new RegExp(`(^|[^a-z0-9])${escapeRegExp(alias)}([^a-z0-9]|$)`, 'i').test(lower)) {
        return entry.canonical;
      }
    }
  }

  return '';
}

function extractExplicitPartCodeFromLine(line: string): string {
  // Never confuse electrical ratings (10A, 16A, 400V, 50kA, 2P, 4-Pole, 50mm, 1KG) with part codes!
  const explicitLabel = line.match(
    /\b(?:part\s*(?:no|number|code)|cat(?:alogue)?\s*(?:no|code)|model\s*(?:no|code)?|p\/n|sku)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-/.]{3,28})\b/i
  );
  if (explicitLabel) {
    return explicitLabel[1].trim();
  }

  // Look for unmistakable industrial part designations like 6206-2RS-C3, A9F74210, 3RT2015-1BB41, DNC-50-200-PPV-A, 3NA3801, HTD-1440-8M-50, FG800
  const tokens = line.match(/\b[A-Z0-9]+(?:[-/][A-Z0-9]+)*\b/gi) || [];
  for (const tok of tokens) {
    // Reject ratings / measurements / poles / years / quantities
    if (/^\d+(a|amp|amps|v|vac|vdc|ka|kw|hp|hz|mm|cm|m|mtr|kg|gm|g|ltr|ml|bar|psi|rpm|p|pole|poles|inch|in|way|nos|pcs|set|pkt|box)$/i.test(tok)) {
      continue;
    }
    if (/^(19|20)\d{2}$/.test(tok)) continue;
    if (/^\d{1,3}$/.test(tok)) continue;
    if (/^[1-4]-?pole$/i.test(tok)) continue;
    if (/^[a-z]+$/i.test(tok)) continue; // pure word, not part code
    if (/^(c|b|d)-?curve$/i.test(tok)) continue;

    // Must contain digits AND either letters or a hyphen/slash, and length >= 5
    const hasDigit = /\d/.test(tok);
    const hasLetter = /[a-z]/i.test(tok);
    const hasSep = /[-/]/.test(tok);

    if (hasDigit && ((hasLetter && tok.length >= 5) || (hasSep && tok.length >= 6))) {
      // Skip things like 240/415V or 5/2
      if (/^\d+\/\d+v?$/i.test(tok)) continue;
      return tok;
    }
  }

  return '';
}

function extractTechnicalSpecifications(line: string): {
  rating?: string;
  poles?: string;
  voltage?: string;
  curve?: string;
  breakingCapacity?: string;
  dimensions?: string;
  combined: string;
} {
  const parts: string[] = [];

  const ratingMatch = line.match(/\b(\d+(?:\.\d+)?)\s*(a|amp|amps|ma|kw|kva|hp|rpm|bar)\b/i);
  const rating = ratingMatch ? `${ratingMatch[1]}${ratingMatch[2].toUpperCase().replace(/^AMPS?$/, 'A')}` : undefined;
  if (rating) parts.push(rating);

  let poles: string | undefined;
  const poleMatch = line.match(/\b([1-4])\s*[-]?\s*(pole|poles|p)\b/i) || line.match(/\b(sp|dp|tp|fp|tpn|spn)\b/i);
  if (poleMatch) {
    const raw = poleMatch[0].toUpperCase();
    if (raw.includes('1') || raw === 'SP') poles = '1 Pole';
    else if (raw.includes('2') || raw === 'DP') poles = '2 Pole';
    else if (raw.includes('3') || raw === 'TP') poles = '3 Pole';
    else if (raw.includes('4') || raw === 'FP') poles = '4 Pole';
    else poles = raw;
    parts.push(poles);
  }

  const voltMatch = line.match(/\b(\d+(?:\/\d+)?)\s*(v|vac|vdc|kv)\b/i);
  const voltage = voltMatch ? `${voltMatch[1]}${voltMatch[2].toUpperCase()}` : undefined;
  if (voltage) parts.push(voltage);

  const kaMatch = line.match(/\b(\d+(?:\.\d+)?)\s*(ka)\b/i);
  const breakingCapacity = kaMatch ? `${kaMatch[1]}kA` : undefined;
  if (breakingCapacity) parts.push(breakingCapacity);

  const curveMatch = line.match(/\b([BCD])\s*[-]?\s*curve\b/i);
  const curve = curveMatch ? `${curveMatch[1].toUpperCase()}-Curve` : undefined;
  if (curve) parts.push(curve);

  const dimMatch = line.match(/\b(\d+(?:\.\d+)?\s*(?:mm|inch|in|kg|ltr|ml|sq\.?\s*mm|c3))\b/i);
  const dimensions = dimMatch ? dimMatch[1].trim() : undefined;
  if (dimensions && !parts.includes(dimensions)) parts.push(dimensions);

  return {
    rating,
    poles,
    voltage,
    curve,
    breakingCapacity,
    dimensions,
    combined: parts.join(', '),
  };
}

function detectProductIdentity(line: string): { productName: string; category: string; subCategory: string } | null {
  for (const pat of PRODUCT_TYPE_PATTERNS) {
    if (pat.regex.test(line)) {
      return {
        productName: pat.name,
        category: pat.category,
        subCategory: pat.subCategory,
      };
    }
  }
  return null;
}

function buildCataloguePool(products: ProductItem[], vendors: Vendor[]): CatalogueProduct[] {
  const pool: CatalogueProduct[] = [];
  const keyToIndex = new Map<string, number>();
  const partToIndex = new Map<string, number>();

  for (const p of products || []) {
    if (!p || p.isDeleted) continue;
    const normBrand = normalizeBrand(p.brand);
    const normPart = normalizePartCode(p.partNumber || p.itemCode || '');
    const key = `${normBrand}::${normPart || normalizePartCode(p.id)}::${(p.itemName || '').toLowerCase()}`;
    if (keyToIndex.has(key)) continue;

    const idx = pool.length;
    keyToIndex.set(key, idx);
    if (normPart) {
      partToIndex.set(`${normBrand}::${normPart}`, idx);
    }

    pool.push({
      id: p.id,
      brand: p.brand || '',
      partCode: p.partNumber || p.itemCode || '',
      manufacturerCode: p.manufacturerCode || '',
      modelNumber: p.modelNumber || '',
      productName: p.itemName || p.normalizedProductName || p.sourceProductName || '',
      description: p.description || '',
      specifications: p.specification || '',
      category: p.category || '',
      subCategory: p.subCategory,
      uom: p.uom || 'NOS',
      mrp: Number(p.mrp || 0),
      discountPercent: Number(p.discountPercentage || 0),
      purchaseRate: Number(p.netPurchaseRate || p.purchasePrice || p.approxRate || 0),
      gstRate: Number(p.gstRate || 18),
      catalogueVersion: (p as any).catalogueVersion || 'Current',
      effectiveDate: (p as any).effectiveDate || '',
      status: 'ACTIVE',
      supplierName: p.lastVendorName || '',
      createdAt: p.createdAt || '',
      updatedAt: p.updatedAt || '',
    });
  }

  for (const v of vendors || []) {
    if (!v || v.isDeleted || !Array.isArray(v.catalogProducts)) continue;
    for (const vp of v.catalogProducts) {
      if (!vp) continue;
      const normBrand = normalizeBrand(vp.brand);
      const normPart = normalizePartCode(vp.partNumber || '');
      const key = `${normBrand}::${normPart || normalizePartCode(vp.id)}::${(vp.productName || '').toLowerCase()}`;
      const existingIdx =
        keyToIndex.get(key) ?? (normPart ? partToIndex.get(`${normBrand}::${normPart}`) : undefined);

      if (existingIdx !== undefined) {
        // Enrich existing product master entry with vendor catalogue MRP, Discount, Purchase Rate & Supplier
        const existing = pool[existingIdx];
        if (!existing.mrp && vp.mrp) existing.mrp = Number(vp.mrp);
        if (!existing.discountPercent && vp.discountPercent) {
          existing.discountPercent = Number(vp.discountPercent);
        }
        const vendorPurchaseRate = Number(vp.purchaseRate || vp.rate || 0);
        if (vendorPurchaseRate > 0 && (!existing.purchaseRate || existing.mrp > 0)) {
          existing.purchaseRate = vendorPurchaseRate;
        }
        if (!existing.supplierName && v.companyName) {
          existing.supplierName = v.companyName;
        }
        continue;
      }

      const idx = pool.length;
      keyToIndex.set(key, idx);
      if (normPart) {
        partToIndex.set(`${normBrand}::${normPart}`, idx);
      }

      pool.push({
        id: vp.id,
        brand: vp.brand || '',
        partCode: vp.partNumber || '',
        manufacturerCode: vp.manufacturerCode || '',
        modelNumber: vp.modelNumber || '',
        productName: vp.productName || vp.normalizedProductName || '',
        description: vp.description || '',
        specifications: vp.specification || '',
        category: vp.category || '',
        subCategory: vp.subCategory,
        uom: vp.uom || 'NOS',
        mrp: Number(vp.mrp || 0),
        discountPercent: Number(vp.discountPercent || 0),
        purchaseRate: Number(vp.purchaseRate || vp.rate || 0),
        gstRate: Number((vp as any).gstRate || 18),
        catalogueVersion: 'Vendor Catalogue',
        effectiveDate: '',
        status: 'ACTIVE',
        supplierName: v.companyName || '',
        createdAt: '',
        updatedAt: '',
      });
    }
  }

  return pool;
}

/**
 * Matches a single parsed line item against the existing ERP Brand/Product Catalogue
 * strictly following the 6-level hierarchy:
 * Exact Part Code -> Manufacturer Part Code -> Brand + Model ->
 * Brand + Product + Specification -> Product + Specification -> Description similarity.
 * NEVER matches by category alone. Surfaces multiple candidates if ambiguous.
 */
export function matchExtractedItemToCatalogue(
  item: {
    rawLine: string;
    brand: string;
    productName: string;
    partNumber: string;
    specification: string;
    rating?: string;
    poles?: string;
    category?: string;
  },
  cataloguePool: CatalogueProduct[]
): {
  matched: boolean;
  multipleMatchesFound: boolean;
  bestMatch?: CatalogueProduct;
  candidates: EmailCatalogueCandidate[];
  confidence: number;
  matchReason: string;
} {
  if (!cataloguePool || cataloguePool.length === 0) {
    return {
      matched: false,
      multipleMatchesFound: false,
      candidates: [],
      confidence: item.brand && item.productName ? 72 : 45,
      matchReason: 'No items in ERP Brand/Product Catalogue yet',
    };
  }

  const query = [item.brand, item.partNumber, item.productName, item.specification]
    .filter(Boolean)
    .join(' ')
    .trim() || item.rawLine;

  const normBrand = normalizeBrand(item.brand);

  // Strict brand scoping when a specific brand was stated in the email
  let scopedPool = cataloguePool;
  if (normBrand) {
    const exactBrandPool = cataloguePool.filter((p) => normalizeBrand(p.brand) === normBrand);
    if (exactBrandPool.length > 0) {
      scopedPool = exactBrandPool;
    } else {
      // Brand stated in email does NOT exist in catalogue — DO NOT falsely match a different brand's product!
      return {
        matched: false,
        multipleMatchesFound: false,
        candidates: [],
        confidence: item.productName ? 65 : 45,
        matchReason: `Brand "${item.brand}" not found in ERP Brand Catalogue`,
      };
    }
  }

  // First check Brand + Product + Specification multi-match scoring explicitly
  // so queries like "Schneider 10A 2 Pole MCB" reliably surface multiple matching curves/series if present
  const specTokens: string[] = [];
  if (item.rating) specTokens.push(item.rating.toLowerCase());
  if (item.poles) {
    const pNum = item.poles.match(/^([1-4])/)?.[1];
    if (pNum) specTokens.push(`${pNum}p`);
  }
  const prodLower = (item.productName || '').toLowerCase();

  if (!item.partNumber && prodLower && specTokens.length > 0) {
    const specMatches = scopedPool.filter((p) => {
      const hay = `${p.productName} ${p.subCategory || ''} ${p.specifications || ''} ${p.description || ''} ${p.modelNumber || ''}`.toLowerCase();
      const prodHit =
        hay.includes(prodLower) ||
        (prodLower === 'mcb' && /\b(mcb|miniature circuit breaker|ic60|acti9|easy9)\b/i.test(hay));
      if (!prodHit) return false;

      const ratingHit = item.rating
        ? new RegExp(`\\b${escapeRegExp(item.rating.replace(/A$/i, ''))}\\s*(?:a|amp|amps)\\b`, 'i').test(hay)
        : true;
      const poleNum = item.poles?.match(/^([1-4])/)?.[1];
      const poleHit = poleNum
        ? new RegExp(`\\b${poleNum}\\s*(?:p|pole|poles)\\b`, 'i').test(hay)
        : true;

      return ratingHit && poleHit;
    });

    if (specMatches.length > 1) {
      const candidates: EmailCatalogueCandidate[] = specMatches.slice(0, 6).map((c) => ({
        productId: c.id,
        brand: c.brand,
        productName: c.productName,
        partCode: c.partCode || 'Not specified',
        manufacturerCode: c.manufacturerCode,
        modelNumber: c.modelNumber,
        category: c.category,
        subCategory: c.subCategory,
        specification: c.specifications,
        mrp: c.mrp || undefined,
        discountPercent: c.discountPercent || undefined,
        purchaseRate: c.purchaseRate || undefined,
        supplierName: c.supplierName || undefined,
        confidence: normBrand ? 86 : 78,
        matchReason: normBrand
          ? 'Brand + Product + Specification match (multiple variants)'
          : 'Product + Specification match (multiple variants)',
      }));

      return {
        matched: true,
        multipleMatchesFound: true,
        bestMatch: undefined, // Do NOT silently select the wrong variant when multiple match!
        candidates,
        confidence: 78,
        matchReason: `Multiple catalogue matches found (${specMatches.length} products match ${[item.brand, item.productName, item.specification].filter(Boolean).join(' ')})`,
      };
    }

    if (specMatches.length === 1) {
      const single = specMatches[0];
      return {
        matched: true,
        multipleMatchesFound: false,
        bestMatch: single,
        candidates: [
          {
            productId: single.id,
            brand: single.brand,
            productName: single.productName,
            partCode: single.partCode || 'Not specified',
            manufacturerCode: single.manufacturerCode,
            modelNumber: single.modelNumber,
            category: single.category,
            subCategory: single.subCategory,
            specification: single.specifications,
            mrp: single.mrp || undefined,
            discountPercent: single.discountPercent || undefined,
            purchaseRate: single.purchaseRate || undefined,
            supplierName: single.supplierName || undefined,
            confidence: normBrand ? 92 : 82,
            matchReason: normBrand
              ? 'Brand + Product + Specification match'
              : 'Product + Specification match',
          },
        ],
        confidence: normBrand ? 92 : 82,
        matchReason: normBrand
          ? `Matched ${single.brand} ${single.partCode || single.productName} via Brand + Product + Specification`
          : `Matched ${single.productName} via Product + Specification`,
      };
    }
  }

  // Delegate to deterministic 6-level rate matching engine
  const det = matchCatalogueRateDeterministic(query, scopedPool, {
    brand: item.brand || undefined,
  });

  if (det.matched && det.matchedProduct) {
    // Reject weak description-only matches if brand was specified and doesn't match
    if (normBrand && normalizeBrand(det.matchedProduct.brand) !== normBrand) {
      return {
        matched: false,
        multipleMatchesFound: false,
        candidates: [],
        confidence: 55,
        matchReason: `No catalogue entry found for brand "${item.brand}"`,
      };
    }

    // Reject weak matches when rating or poles explicitly conflict
    if (item.rating || item.poles) {
      const hay = `${det.matchedProduct.productName} ${det.matchedProduct.specifications || ''} ${det.matchedProduct.description || ''}`.toLowerCase();
      if (item.rating) {
        const requestedAmps = item.rating.match(/^(\d+)A$/i)?.[1];
        const candidateAmps = hay.match(/\b(\d+)\s*(?:a|amp|amps)\b/i)?.[1];
        if (requestedAmps && candidateAmps && requestedAmps !== candidateAmps) {
          return {
            matched: false,
            multipleMatchesFound: false,
            candidates: [],
            confidence: 62,
            matchReason: `Catalogue product rating (${candidateAmps}A) differs from requested ${requestedAmps}A — not auto-matched`,
          };
        }
      }
      if (item.poles) {
        const reqPole = item.poles.match(/^([1-4])/)?.[1];
        const candPole = hay.match(/\b([1-4])\s*(?:p|pole|poles)\b/i)?.[1];
        if (reqPole && candPole && reqPole !== candPole) {
          return {
            matched: false,
            multipleMatchesFound: false,
            candidates: [],
            confidence: 62,
            matchReason: `Catalogue product poles (${candPole}P) differs from requested ${reqPole}P — not auto-matched`,
          };
        }
      }
    }

    const ambList = det.ambiguousCandidates || [];
    const isMulti = Boolean(det.isAmbiguous && ambList.length > 1);
    const allCands = (isMulti ? ambList : [det.matchedProduct, ...ambList.filter((c) => c.id !== det.matchedProduct!.id)])
      .slice(0, 6)
      .map((c) => ({
        productId: c.id,
        brand: c.brand,
        productName: c.productName,
        partCode: c.partCode || 'Not specified',
        manufacturerCode: c.manufacturerCode,
        modelNumber: c.modelNumber,
        category: c.category,
        subCategory: c.subCategory,
        specification: c.specifications,
        mrp: c.mrp || undefined,
        discountPercent: c.discountPercent || undefined,
        purchaseRate: c.purchaseRate || undefined,
        supplierName: c.supplierName || undefined,
        confidence: det.confidence,
        matchReason: det.matchReason,
      }));

    return {
      matched: true,
      multipleMatchesFound: isMulti,
      bestMatch: isMulti ? undefined : det.matchedProduct,
      candidates: allCands,
      confidence: isMulti ? Math.min(det.confidence, 82) : det.confidence,
      matchReason: isMulti
        ? `Multiple catalogue matches found (${ambList.length} candidates)`
        : det.matchReason,
    };
  }

  return {
    matched: false,
    multipleMatchesFound: false,
    candidates: [],
    confidence: item.brand && item.productName ? 70 : item.productName ? 58 : 40,
    matchReason: 'Not found in ERP Brand/Product Catalogue — manual verification recommended',
  };
}

function parseSingleRequirementLine(
  rawLine: string,
  index: number,
  context: {
    subject: string;
    brands: BrandMasterItem[];
    products: ProductItem[];
    vendors: Vendor[];
    cataloguePool: CatalogueProduct[];
    sourceOrigin: 'EMAIL_BODY' | 'ATTACHMENT';
  }
): ExtractedEmailItem | null {
  const trimmed = rawLine.trim();
  if (!trimmed || trimmed.length < 4) return null;

  // Reject greetings, sign-offs, and commercial metadata lines
  for (const rx of NON_ITEM_LINE_PATTERNS) {
    if (rx.test(trimmed)) return null;
  }

  // Strip optional leading numbering or bullet: "1. ", "2) ", "- ", "• ", "* "
  const hasListPrefix = /^(?:\d+[\.\)]\s+|[-*•]\s+)/.test(trimmed);
  let body = trimmed.replace(/^(?:\d+[\.\)]\s+|[-*•]\s+)/, '').trim();

  // Extract Quantity & UOM (supports: "- 20 Nos", "- Qty: 4 NOS", "x 10 pcs", "Qty 50", "| 20 | Nos")
  let quantity: number | null = null;
  let uom = 'NOS';

  // Pattern A: trailing separator + optional Qty + number + UOM (e.g. "Schneider 10A 2 Pole MCB - 20 Nos")
  const trailingQtyMatch = body.match(
    /(?:[-–—:|,]\s*(?:qty|quantity)?\s*[:\-]?\s*|\b(?:qty|quantity)\s*[:\-]?\s*)(\d+(?:\.\d+)?)\s*(nos?\.?|pcs?\.?|pieces?|sets?|kgs?|mtrs?|meters?|metres?|ltrs?|liters?|pkts?|packs?|box(?:es)?|rolls?|pairs?|units?|ea|each)?\s*$/i
  );
  if (trailingQtyMatch) {
    const parsed = parseFloat(trailingQtyMatch[1]);
    if (!isNaN(parsed) && parsed > 0) {
      quantity = parsed;
      if (trailingQtyMatch[2]) uom = normalizeUom(trailingQtyMatch[2]);
      body = body.slice(0, trailingQtyMatch.index).trim();
    }
  }

  // Pattern B: standalone trailing "<number> <UOM>" (e.g. "Schneider 10A 2P MCB 20 Nos")
  if (quantity === null) {
    const bareQtyMatch = body.match(
      /\b(\d+(?:\.\d+)?)\s*(nos?\.?|pcs?\.?|pieces?|sets?|kgs?|mtrs?|meters?|metres?|ltrs?|liters?|pkts?|packs?|box(?:es)?|rolls?|pairs?|units?)\s*$/i
    );
    if (bareQtyMatch) {
      const parsed = parseFloat(bareQtyMatch[1]);
      if (!isNaN(parsed) && parsed > 0) {
        quantity = parsed;
        uom = normalizeUom(bareQtyMatch[2]);
        body = body.slice(0, bareQtyMatch.index).trim();
      }
    }
  }

  // Pattern C: inline "Qty: 10 Nos" anywhere inside line
  if (quantity === null) {
    const inlineQtyMatch = body.match(
      /\b(?:qty|quantity)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(nos?\.?|pcs?\.?|pieces?|sets?|kgs?|mtrs?|ltrs?|pkts?|box(?:es)?|rolls?|pairs?)?/i
    );
    if (inlineQtyMatch) {
      const parsed = parseFloat(inlineQtyMatch[1]);
      if (!isNaN(parsed) && parsed > 0) {
        quantity = parsed;
        if (inlineQtyMatch[2]) uom = normalizeUom(inlineQtyMatch[2]);
        body = body.replace(inlineQtyMatch[0], ' ').replace(/\s{2,}/g, ' ').trim();
      }
    }
  }

  // Detect brand, product identity, explicit part code, and technical specifications
  const detectedBrand = detectSupportedBrand(body, context.brands, context.products, context.vendors);
  const subjectBrand = !detectedBrand
    ? detectSupportedBrand(context.subject, context.brands, context.products, context.vendors)
    : '';
  const detectedProduct = detectProductIdentity(body);
  const explicitPartCode = extractExplicitPartCodeFromLine(body);
  const specs = extractTechnicalSpecifications(body);

  // If the line does NOT have a list prefix, require real procurement signals
  // (at least two of: quantity, brand, product keyword, part code, electrical/mechanical spec)
  const signalCount =
    (quantity !== null ? 1 : 0) +
    (detectedBrand ? 1 : 0) +
    (detectedProduct ? 1 : 0) +
    (explicitPartCode ? 1 : 0) +
    (specs.combined ? 1 : 0);

  if (!hasListPrefix && signalCount < 2) {
    return null;
  }
  if (hasListPrefix && signalCount === 0 && body.split(/\s+/).length < 2) {
    return null;
  }

  // Check explicit unknown brand token on the line BEFORE falling back to subject brand
  // e.g. "ABC 10A MCB" inside an email whose subject mentions Schneider -> Brand: "ABC" (never mis-attributed!)
  let explicitLineLeadBrand = '';
  if (!detectedBrand && detectedProduct) {
    const leadWordMatch = body.match(/^([A-Z][A-Za-z0-9&]{1,18})\s+(?:\d+(?:A|V|KW|HP|MM)|[1-4]\s*(?:P|POLE)|MCB|MCCB|RCCB|BEARING|VALVE|CONTACTOR|RELAY|FUSE|MOTOR|PUMP|CYLINDER|BELT|GREASE)/i);
    if (leadWordMatch) {
      const candidateLead = leadWordMatch[1].trim();
      if (!/^(new|urgent|need|required|supply|quote|item|material|industrial|standard|heavy|duty|high|low|single|double|three|four|pole|deep|groove|ball|roller|miniature|molded|moulded|fast|acting)$/i.test(candidateLead)) {
        explicitLineLeadBrand = candidateLead;
      }
    }
  }
  const finalBrand = detectedBrand || explicitLineLeadBrand || subjectBrand;

  const productLabel = detectedProduct?.productName || body.replace(/\s*[-–—:]\s*$/, '').trim();
  const catRec = recommendCategoryForRequirement({
    itemName: body,
    description: finalBrand,
    specification: specs.combined,
  });
  const baseCategory = detectedProduct?.category || catRec.category || '';
  const baseSubCategory = detectedProduct?.subCategory || catRec.subCategory || '';

  // Match against existing ERP Brand/Product Catalogue (strict 6-level priority, no fake fabrication)
  const catMatch = matchExtractedItemToCatalogue(
    {
      rawLine: trimmed,
      brand: finalBrand,
      productName: productLabel,
      partNumber: explicitPartCode,
      specification: specs.combined,
      rating: specs.rating,
      poles: specs.poles,
      category: baseCategory,
    },
    context.cataloguePool
  );

  // Use catalogue-verified fields ONLY when a single unambiguous product matched
  const verified = catMatch.matched && !catMatch.multipleMatchesFound ? catMatch.bestMatch : undefined;

  // NEVER manufacture a fake part code! Only use explicit email part code OR verified catalogue match.
  const finalPartNumber = verified?.partCode || explicitPartCode || '';
  const finalModelNumber = verified?.modelNumber || '';
  const finalBrandResolved = verified?.brand || finalBrand || '';
  const finalItemName = verified?.productName || productLabel;
  const finalCategory = verified?.category || baseCategory;
  const finalSubCategory = verified?.subCategory || baseSubCategory;
  const finalSpec = specs.combined || verified?.specifications || body;

  // Compute realistic confidence score & low-confidence fields requiring user confirmation
  let confidenceScore = catMatch.confidence;
  if (!verified) {
    let score = 45;
    if (detectedProduct) score += 20;
    if (finalBrandResolved) score += 12;
    if (specs.combined) score += 10;
    if (quantity !== null) score += 8;
    if (explicitPartCode) score += 5;
    if (catMatch.multipleMatchesFound) score = Math.min(score, 78);
    confidenceScore = Math.min(score, 84);
  }

  const lowConfidenceFields: string[] = [];
  if (!finalBrandResolved) lowConfidenceFields.push('Brand');
  if (!finalPartNumber) lowConfidenceFields.push('Part Code');
  if (!finalCategory) lowConfidenceFields.push('Category');
  if (quantity === null) lowConfidenceFields.push('Quantity');
  if (catMatch.multipleMatchesFound) lowConfidenceFields.push('Catalogue Match (Multiple Candidates)');
  if (!verified) lowConfidenceFields.push('Catalogue Pricing');

  return {
    id: `ITEM-AUTO-${index + 1}`,
    itemName: finalItemName,
    productTitle: detectedProduct?.productName || finalItemName,
    description: body,
    originalLineText: trimmed,
    category: finalCategory,
    subCategory: finalSubCategory,
    partNumber: finalPartNumber,
    modelNumber: finalModelNumber,
    brand: finalBrandResolved,
    specification: finalSpec,
    quantity: quantity ?? 1,
    uom,
    targetPrice: verified?.purchaseRate || undefined,
    confidence: confidenceScore,
    confidenceLevel: getConfidenceLevel(confidenceScore),
    lowConfidenceFields,
    catalogueMatched: Boolean(verified),
    catalogueProductId: verified?.id,
    catalogueMrp: verified?.mrp && verified.mrp > 0 ? verified.mrp : undefined,
    catalogueDiscount:
      verified?.discountPercent !== undefined && verified.discountPercent > 0
        ? verified.discountPercent
        : undefined,
    cataloguePurchaseRate:
      verified?.purchaseRate && verified.purchaseRate > 0 ? verified.purchaseRate : undefined,
    catalogueSupplier: verified?.supplierName || undefined,
    catalogueMatchReason: catMatch.matchReason,
    multipleMatchesFound: catMatch.multipleMatchesFound,
    catalogueCandidates: catMatch.candidates,
    sourceOrigin: context.sourceOrigin,
  };
}

/**
 * Parses CSV or Excel attachment rows into structured ExtractedEmailItem records
 * with automatic column detection (Product/Description, Brand, Part Code, Spec, Qty, UOM).
 */
export function parseTabularRowsToEmailItems(
  rows: Record<string, any>[],
  context: {
    subject: string;
    brands: BrandMasterItem[];
    products: ProductItem[];
    vendors: Vendor[];
  }
): ExtractedEmailItem[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const cataloguePool = buildCataloguePool(context.products, context.vendors);

  const pickField = (row: Record<string, any>, patterns: RegExp[]): string => {
    for (const [key, val] of Object.entries(row)) {
      if (val === null || val === undefined) continue;
      const cleanKey = key.trim().toLowerCase();
      if (patterns.some((p) => p.test(cleanKey))) {
        const str = String(val).trim();
        if (str) return str;
      }
    }
    return '';
  };

  const extracted: ExtractedEmailItem[] = [];
  rows.forEach((row, idx) => {
    const prod = pickField(row, [/^(product|item|material|description|item\s*name|product\s*name|material\s*description)/i]);
    const brand = pickField(row, [/^(brand|make|manufacturer|oem)/i]);
    const partCode = pickField(row, [/^(part\s*(code|no|number)|cat\s*no|sku|designation|model)/i]);
    const spec = pickField(row, [/^(spec|specification|technical|rating|size|details)/i]);
    const qtyRaw = pickField(row, [/^(qty|quantity|req\s*qty|order\s*qty)/i]);
    const uomRaw = pickField(row, [/^(uom|unit|units)/i]);

    if (!prod && !partCode) return;

    const qtyNum = parseFloat(qtyRaw.replace(/[^0-9.]/g, ''));
    const quantity = !isNaN(qtyNum) && qtyNum > 0 ? qtyNum : 1;
    const uom = normalizeUom(uomRaw || 'NOS');
    const rawLine = [brand, prod, partCode, spec, `${quantity} ${uom}`].filter(Boolean).join(' | ');

    const resolvedBrand =
      detectSupportedBrand(brand || rawLine, context.brands, context.products, context.vendors) ||
      brand;
    const detectedProduct = detectProductIdentity(`${prod} ${spec}`);
    const techSpecs = extractTechnicalSpecifications(`${prod} ${spec}`);
    const finalSpec = spec || techSpecs.combined;

    const catMatch = matchExtractedItemToCatalogue(
      {
        rawLine,
        brand: resolvedBrand,
        productName: detectedProduct?.productName || prod || partCode,
        partNumber: partCode,
        specification: finalSpec,
        rating: techSpecs.rating,
        poles: techSpecs.poles,
      },
      cataloguePool
    );

    const verified = catMatch.matched && !catMatch.multipleMatchesFound ? catMatch.bestMatch : undefined;
    const catRec = recommendCategoryForRequirement({
      itemName: prod || partCode,
      description: resolvedBrand,
      specification: finalSpec,
    });

    const finalPart = verified?.partCode || partCode || '';
    const finalCategory = verified?.category || detectedProduct?.category || catRec.category || '';
    const confidence = verified ? Math.max(catMatch.confidence, 90) : catMatch.multipleMatchesFound ? 78 : 74;

    extracted.push({
      id: `ITEM-ATT-${idx + 1}`,
      itemName: verified?.productName || prod || partCode,
      productTitle: detectedProduct?.productName || prod || partCode,
      description: prod || rawLine,
      originalLineText: rawLine,
      category: finalCategory,
      subCategory: verified?.subCategory || detectedProduct?.subCategory || catRec.subCategory || '',
      partNumber: finalPart,
      modelNumber: verified?.modelNumber || '',
      brand: verified?.brand || resolvedBrand || '',
      specification: finalSpec,
      quantity,
      uom,
      targetPrice: verified?.purchaseRate || undefined,
      confidence,
      confidenceLevel: getConfidenceLevel(confidence),
      lowConfidenceFields: [
        ...(verified?.brand || resolvedBrand ? [] : ['Brand']),
        ...(finalPart ? [] : ['Part Code']),
        ...(finalCategory ? [] : ['Category']),
        ...(catMatch.multipleMatchesFound ? ['Catalogue Match (Multiple Candidates)'] : []),
        ...(verified ? [] : ['Catalogue Pricing']),
      ],
      catalogueMatched: Boolean(verified),
      catalogueProductId: verified?.id,
      catalogueMrp: verified?.mrp && verified.mrp > 0 ? verified.mrp : undefined,
      catalogueDiscount:
        verified?.discountPercent !== undefined && verified.discountPercent > 0
          ? verified.discountPercent
          : undefined,
      cataloguePurchaseRate:
        verified?.purchaseRate && verified.purchaseRate > 0 ? verified.purchaseRate : undefined,
      catalogueSupplier: verified?.supplierName || undefined,
      catalogueMatchReason: catMatch.matchReason,
      multipleMatchesFound: catMatch.multipleMatchesFound,
      catalogueCandidates: catMatch.candidates,
      sourceOrigin: 'ATTACHMENT',
    });
  });

  return extracted;
}

/**
 * Extracts tabular items directly from an Excel (.xlsx/.xls) or CSV ArrayBuffer/Uint8Array.
 */
export function parseSpreadsheetBufferToEmailItems(
  data: ArrayBuffer | Uint8Array,
  context: {
    subject: string;
    brands: BrandMasterItem[];
    products: ProductItem[];
    vendors: Vendor[];
  }
): ExtractedEmailItem[] {
  try {
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
    return parseTabularRowsToEmailItems(rows, context);
  } catch (err) {
    console.warn('[EmailAttachmentParser] Failed to read spreadsheet buffer:', err);
    return [];
  }
}

/**
 * Merges items extracted from AI/backend, deterministic email body parser, and attachments,
 * then verifies/enriches every item against the existing ERP Brand/Product Catalogue without inventing data.
 */
export function enrichAndCombineEmailItems(params: {
  emailBody: string;
  subject: string;
  aiItems?: Array<Partial<ExtractedEmailItem>>;
  attachmentItems?: ExtractedEmailItem[];
  brands: BrandMasterItem[];
  products: ProductItem[];
  vendors: Vendor[];
}): ExtractedEmailItem[] {
  const cataloguePool = buildCataloguePool(params.products, params.vendors);

  // Always run deterministic line parser on email body so nothing is dropped
  const bodyLines = (params.emailBody || '').split(/\r?\n/);
  const deterministicItems: ExtractedEmailItem[] = [];
  bodyLines.forEach((line, idx) => {
    const parsed = parseSingleRequirementLine(line, idx, {
      subject: params.subject,
      brands: params.brands,
      products: params.products,
      vendors: params.vendors,
      cataloguePool,
      sourceOrigin: 'EMAIL_BODY',
    });
    if (parsed) deterministicItems.push(parsed);
  });

  const enrichedAiItems: ExtractedEmailItem[] = (params.aiItems || [])
    .filter((it) => it && (it.itemName || it.partNumber))
    .map((it, idx) => {
      const rawName = String(it.itemName || '').trim();
      const rawBrand = String(it.brand || '').trim();
      const rawPart = String(it.partNumber || '').trim();
      const rawSpec = String(it.specification || '').trim();
      const qty = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
      const uom = normalizeUom(it.uom || 'NOS');

      const resolvedBrand =
        detectSupportedBrand(`${rawBrand} ${rawName}`, params.brands, params.products, params.vendors) ||
        rawBrand;
      const detectedProduct = detectProductIdentity(`${rawName} ${rawSpec}`);
      const techSpecs = extractTechnicalSpecifications(`${rawName} ${rawSpec}`);

      // Guardrail: reject AI-fabricated part codes not found in email body AND not in catalogue
      const bodyLower = (params.emailBody || '').toLowerCase();
      const partPresentInEmail = rawPart && bodyLower.includes(rawPart.toLowerCase());
      const partExistsInCatalogue =
        rawPart &&
        cataloguePool.some(
          (p) =>
            normalizePartCode(p.partCode) === normalizePartCode(rawPart) ||
            normalizePartCode(p.manufacturerCode) === normalizePartCode(rawPart)
        );
      const safePart = partPresentInEmail || partExistsInCatalogue ? rawPart : '';

      const catMatch = matchExtractedItemToCatalogue(
        {
          rawLine: `${rawBrand} ${rawName} ${rawSpec}`.trim(),
          brand: resolvedBrand,
          productName: detectedProduct?.productName || rawName,
          partNumber: safePart,
          specification: rawSpec || techSpecs.combined,
          rating: techSpecs.rating,
          poles: techSpecs.poles,
        },
        cataloguePool
      );

      const verified = catMatch.matched && !catMatch.multipleMatchesFound ? catMatch.bestMatch : undefined;
      const catRec = recommendCategoryForRequirement({
        itemName: rawName,
        description: resolvedBrand,
        specification: rawSpec,
      });

      const finalPart = verified?.partCode || safePart || '';
      const finalCategory = verified?.category || it.category || detectedProduct?.category || catRec.category || '';
      const confidence = verified ? Math.max(catMatch.confidence, 88) : Math.min(Number(it.confidence || 75), 82);

      return {
        id: `ITEM-AI-${idx + 1}`,
        itemName: verified?.productName || rawName,
        productTitle: detectedProduct?.productName || rawName,
        description: rawName,
        originalLineText: (it as any).originalLineText || `${rawBrand} ${rawName} ${rawSpec}`.trim(),
        category: finalCategory,
        subCategory: verified?.subCategory || it.subCategory || detectedProduct?.subCategory || catRec.subCategory || '',
        partNumber: finalPart,
        modelNumber: verified?.modelNumber || it.modelNumber || '',
        brand: verified?.brand || resolvedBrand || '',
        specification: rawSpec || techSpecs.combined || verified?.specifications || '',
        quantity: qty,
        uom,
        targetPrice: verified?.purchaseRate || (Number(it.targetPrice) > 0 ? Number(it.targetPrice) : undefined),
        confidence,
        confidenceLevel: getConfidenceLevel(confidence),
        lowConfidenceFields: [
          ...(verified?.brand || resolvedBrand ? [] : ['Brand']),
          ...(finalPart ? [] : ['Part Code']),
          ...(finalCategory ? [] : ['Category']),
          ...(catMatch.multipleMatchesFound ? ['Catalogue Match (Multiple Candidates)'] : []),
          ...(verified ? [] : ['Catalogue Pricing']),
        ],
        catalogueMatched: Boolean(verified),
        catalogueProductId: verified?.id,
        catalogueMrp: verified?.mrp && verified.mrp > 0 ? verified.mrp : undefined,
        catalogueDiscount:
          verified?.discountPercent !== undefined && verified.discountPercent > 0
            ? verified.discountPercent
            : undefined,
        cataloguePurchaseRate:
          verified?.purchaseRate && verified.purchaseRate > 0 ? verified.purchaseRate : undefined,
        catalogueSupplier: verified?.supplierName || undefined,
        catalogueMatchReason: catMatch.matchReason,
        multipleMatchesFound: catMatch.multipleMatchesFound,
        catalogueCandidates: catMatch.candidates,
        sourceOrigin: (it as any).sourceOrigin || 'EMAIL_BODY',
      };
    });

  // Prefer AI items if present, otherwise deterministic items, then merge attachment items without duplicates
  const primary = enrichedAiItems.length > 0 ? enrichedAiItems : deterministicItems;
  const combined: ExtractedEmailItem[] = [...primary];

  const isDuplicate = (a: ExtractedEmailItem, b: ExtractedEmailItem) => {
    if (a.partNumber && b.partNumber && normalizePartCode(a.partNumber) === normalizePartCode(b.partNumber)) {
      return true;
    }
    return (
      a.itemName.toLowerCase().trim() === b.itemName.toLowerCase().trim() &&
      (a.specification || '').toLowerCase().trim() === (b.specification || '').toLowerCase().trim() &&
      a.quantity === b.quantity
    );
  };

  for (const attItem of params.attachmentItems || []) {
    if (!combined.some((existing) => isDuplicate(existing, attItem))) {
      combined.push(attItem);
    }
  }

  return combined.map((item, idx) => ({ ...item, id: `EXT-${idx + 1}` }));
}

/**
 * Full end-to-end deterministic + catalogue-verified Email Requirement Parser.
 * Preserves original email text verbatim, never invents part codes, and outputs a safe diagnostic log.
 */
export function parseEmailRequirementWithCatalogue(params: {
  rawText: string;
  subject: string;
  senderEmail: string;
  senderName?: string;
  customers?: Customer[];
  products?: ProductItem[];
  brands?: BrandMasterItem[];
  vendors?: Vendor[];
  attachmentItems?: ExtractedEmailItem[];
  attachmentCount?: number;
  aiItems?: Array<Partial<ExtractedEmailItem>>;
  parserEngine?: string;
}): ParsedEmailRequirementResult {
  const customers = params.customers || [];
  const products = params.products || [];
  const brands = params.brands || [];
  const vendors = params.vendors || [];

  const cleanSender = (params.senderEmail || '').trim();
  const domain = cleanSender.split('@')[1]?.toLowerCase() || '';
  const domainBase = domain.split('.')[0] || '';
  const isGenericMailDomain = ['gmail', 'yahoo', 'outlook', 'hotmail', 'live', 'rediffmail', 'icloud'].includes(
    domainBase
  );

  const matchedCustomer = customers.find(
    (c) =>
      (cleanSender && c.email?.toLowerCase().trim() === cleanSender.toLowerCase()) ||
      (!isGenericMailDomain && domainBase.length >= 3 && c.companyName.toLowerCase().includes(domainBase))
  );

  let companyName = matchedCustomer?.companyName || '';
  let contactPerson = matchedCustomer?.contactPerson || params.senderName || '';
  let mobile = matchedCustomer?.mobile || '';

  if (!companyName) {
    const subjectMatch = params.subject.match(/(?:from|for|at)\s+([A-Za-z0-9\s&.-]+?)(?:\s+plant|\s+stores|\s+-|$)/i);
    if (subjectMatch && !detectSupportedBrand(subjectMatch[1], brands, products, vendors)) {
      companyName = subjectMatch[1].trim();
    } else if (domain && !isGenericMailDomain) {
      companyName = domainBase.toUpperCase();
    } else {
      companyName = params.senderName || (cleanSender ? cleanSender.split('@')[0] : 'Email Inquiry');
    }
  }

  if (!mobile) {
    const phoneMatch = (params.rawText || '').match(/(?:\+91[\s-]?)?[6-9]\d{9}\b/);
    if (phoneMatch) mobile = phoneMatch[0];
  }

  const items = enrichAndCombineEmailItems({
    emailBody: params.rawText,
    subject: params.subject,
    aiItems: params.aiItems,
    attachmentItems: params.attachmentItems,
    brands,
    products,
    vendors,
  });

  const payMatch = (params.rawText || '').match(/payment\s*terms?\s*[:\-]\s*([^\n\r.]+)/i);
  const paymentTerms = payMatch ? payMatch[1].trim() : undefined;

  const delMatch = (params.rawText || '').match(
    /(?:delivery\s*terms?|required\s*delivery|delivery\s*location)\s*[:\-]\s*([^\n\r.]+)/i
  );
  const deliveryTerms = delMatch ? delMatch[1].trim() : undefined;

  const diagnostic = buildSafeEmailDiagnostic({
    emailReceived: true,
    messageRetrieved: true,
    subject: params.subject,
    bodyText: params.rawText,
    attachmentCount: params.attachmentCount ?? (params.attachmentItems?.length ? 1 : 0),
    attachmentsExtractedCount: params.attachmentItems?.length || 0,
    parserStarted: true,
    extractedItemCount: items.length,
    parserEngine: params.parserEngine || 'DETERMINISTIC_CATALOGUE_MATCHER',
    notes:
      items.length > 0
        ? `Extracted ${items.length} item(s) and verified against ${products.length} catalogue product(s).`
        : 'Parser ran but no structured line items matched. Review Original Email and add line items manually.',
  });

  return {
    companyName,
    contactPerson,
    mobile,
    matchedCustomer,
    items,
    paymentTerms,
    deliveryTerms,
    originalEmailText: params.rawText,
    diagnostic,
  };
}
