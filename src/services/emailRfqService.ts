import {
  BrandMasterItem,
  Customer,
  EmailAccountConfig,
  EmailRfqItem,
  ExtractedEmailItem,
  ProductItem,
  Vendor,
} from '../types';
import {
  parseEmailRequirementWithCatalogue,
  ParsedEmailRequirementResult,
} from './emailRequirementPipeline';

const EMAIL_CONFIG_KEY = 'mro_email_account_config';
const EMAIL_ITEMS_KEY = 'mro_email_rfq_items';
const SYNC_LOGS_KEY = 'mro_email_sync_logs';

export interface EmailSyncLog {
  id: string;
  timestamp: string;
  provider: string;
  status: 'SUCCESS' | 'ERROR';
  messagesFound: number;
  newDraftsCreated: number;
  duplicatesSkipped: number;
  details: string;
}

export const getDefaultEmailConfig = (): EmailAccountConfig => ({
  provider: 'GMAIL',
  emailAddress: 'sales@mroprocurement.com',
  isConnected: false,
  connectedAt: undefined,
  lastSyncedAt: undefined,
  syncIntervalMinutes: 15,
  approvedSenders: ['tatamotors.com', 'adani.com', 'reliance.com', 'lnt.com', 'jsw.in', 'vedanta.co.in'],
  selectedLabels: ['INBOX', 'RFQ', 'Procurement'],
  autoCreateDraft: true,
  status: 'DISCONNECTED',
});

export const loadEmailConfig = (): EmailAccountConfig => {
  try {
    const raw = localStorage.getItem(EMAIL_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse email config from localStorage', e);
  }
  return getDefaultEmailConfig();
};

export const saveEmailConfig = (config: EmailAccountConfig) => {
  localStorage.setItem(EMAIL_CONFIG_KEY, JSON.stringify(config));
};

export const loadSyncLogs = (): EmailSyncLog[] => {
  try {
    const raw = localStorage.getItem(SYNC_LOGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse sync logs', e);
  }
  return [];
};

export const appendSyncLog = (log: Omit<EmailSyncLog, 'id' | 'timestamp'>) => {
  const current = loadSyncLogs();
  const entry: EmailSyncLog = {
    ...log,
    id: `LOG-${Date.now()}`,
    timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
  };
  localStorage.setItem(SYNC_LOGS_KEY, JSON.stringify([entry, ...current.slice(0, 49)]));
  return entry;
};

// INITIAL SEED EMAIL RFQs for real demo/operations testing (untampered real RFQ formats)
export const INITIAL_EMAIL_RFQS: EmailRfqItem[] = [
  {
    id: 'EML-2026-001',
    messageId: 'msg-tata-rfq-20260910-093412@tatamotors.com',
    senderEmail: 'procurement.plant1@tatamotors.com',
    senderName: 'Rajesh K. Verma',
    companyName: 'Tata Motors Limited',
    contactPerson: 'Rajesh Verma (DGM Purchase)',
    mobile: '+91 98201 44321',
    subject: 'Urgent RFQ: MCCB Circuit Breakers, Industrial Bearings & V-Belts for Sanand Plant',
    receivedDate: '2026-10-12',
    bodySnippet: 'Dear MRO Procurement Solution team, please provide your best commercial quote with delivery timelines for the following maintenance spares...',
    fullBodyText: `Dear MRO Procurement Solution Team,

Please provide your best competitive quotation along with delivery period and datasheets for the following plant requirement at Tata Motors Sanand:

1. Molded Case Circuit Breaker (MCCB) - 400A 4-Pole 50kA (Schneider Electric or Siemens) - Qty: 4 NOS
2. Deep Groove Ball Bearing - 6206-2RS-C3 (SKF or FAG) - Qty: 50 NOS
3. High Performance Industrial Timing Belt - HTD 1440-8M-50 (Gates / Fenner) - Qty: 12 NOS
4. MOSIL FG800 High Temperature Food Grade Grease (1 KG Tin) - Qty: 8 NOS

Required Delivery: Immediate / Within 7 days
Payment Terms: 30 Days Net from Delivery
Delivery Location: Tata Motors Sanand Plant Stores, Gate 2

Regards,
Rajesh K. Verma
DGM Procurement & Capital Spares
Tata Motors Ltd, Sanand`,
    detectedItems: [
      {
        id: 'ITEM-E1-01',
        itemName: 'Molded Case Circuit Breaker (MCCB)',
        category: 'Electrical',
        specification: '400A 4-Pole 50kA Breaker',
        brand: 'Schneider Electric / Siemens',
        partNumber: 'LV432676 / 3VM1',
        quantity: 4,
        uom: 'NOS',
        confidence: 96,
      },
      {
        id: 'ITEM-E1-02',
        itemName: '6206-2RS-C3 Deep Groove Ball Bearing',
        category: 'Bearings',
        specification: 'Deep Groove Radial Ball Bearing with Rubber Seals, C3 Clearance',
        brand: 'SKF / FAG',
        partNumber: '6206-2RS-C3',
        quantity: 50,
        uom: 'NOS',
        confidence: 99,
      },
      {
        id: 'ITEM-E1-03',
        itemName: 'Industrial Timing Belt HTD 1440-8M-50',
        category: 'Industrial Belts',
        specification: 'HTD Pitch 8M, Length 1440mm, Width 50mm',
        brand: 'Gates / Fenner',
        partNumber: 'HTD-1440-8M-50',
        quantity: 12,
        uom: 'NOS',
        confidence: 94,
      },
      {
        id: 'ITEM-E1-04',
        itemName: 'MOSIL FG800 Synthetic High Temp Grease',
        category: 'Lubricants',
        specification: 'High Temperature Food Grade Industrial Grease (1 KG Tin)',
        brand: 'MOSIL',
        partNumber: 'MOSIL-FG800',
        quantity: 8,
        uom: 'NOS',
        confidence: 97,
      },
    ],
    matchedCustomerId: 'CUST-001',
    status: 'DRAFT_READY',
    attachments: [
      { name: 'RFQ_Indent_TATA_7781.pdf', size: '420 KB', type: 'PDF' },
      { name: 'Tech_Specifications_Sanand.xlsx', size: '185 KB', type: 'EXCEL' },
    ],
    deliveryTerms: 'Door Delivery Sanand Plant',
    paymentTerms: '30 Days Net',
    targetLocation: 'Sanand, Gujarat',
    remarks: 'Critical breakdown spares - required within 7 days',
  },
  {
    id: 'EML-2026-002',
    messageId: 'msg-adani-power-20261013-142010@adani.com',
    senderEmail: 'purchase.mundra@adani.com',
    senderName: 'Suresh Patel',
    companyName: 'Adani Power Mundra',
    contactPerson: 'Suresh Patel (Stores Head)',
    mobile: '+91 97129 88123',
    subject: 'Inquiry for Festo Pneumatics & Siemens 5A Fuses for Boilers',
    receivedDate: '2026-10-13',
    bodySnippet: 'Please find attached urgent requisition for pneumatic solenoid valves and protection fuses for thermal unit 3...',
    fullBodyText: `Dear Sir,

Please quote for the following pneumatic and electrical control spares for Adani Power Mundra:

1. Festo Pneumatic Cylinder DNC-50-200-PPV-A - Qty: 6 NOS
2. Siemens 5A Fast Acting HRC Fuse Link (Size 000, 500V) - Qty: 100 NOS
3. Ball Valve 2 Inch Class 150 Flanged Stainless Steel CF8M - Qty: 8 NOS

Please send quotation by today evening with delivery lead time.

Thanks,
Suresh Patel
Adani Power Mundra`,
    detectedItems: [
      {
        id: 'ITEM-E2-01',
        itemName: 'Festo Pneumatic Cylinder DNC-50-200-PPV-A',
        category: 'Pneumatics',
        specification: 'Double acting profile cylinder 50mm bore, 200mm stroke',
        brand: 'Festo',
        partNumber: 'DNC-50-200-PPV-A',
        quantity: 6,
        uom: 'NOS',
        confidence: 98,
      },
      {
        id: 'ITEM-E2-02',
        itemName: 'Siemens 5A Fuse Link',
        category: 'Electrical',
        specification: 'Fast acting HRC fuse link 500V Size 000',
        brand: 'Siemens',
        partNumber: '3NA3801',
        quantity: 100,
        uom: 'NOS',
        confidence: 96,
      },
      {
        id: 'ITEM-E2-03',
        itemName: 'Ball Valve 2 Inch Class 150 CF8M Flanged',
        category: 'Valves',
        specification: '2 Inch Class 150 SS316 Ball Valve Flanged End',
        brand: 'L&T / Audco',
        partNumber: 'BV-SS316-2-150',
        quantity: 8,
        uom: 'NOS',
        confidence: 92,
      },
    ],
    matchedCustomerId: 'CUST-002',
    status: 'DRAFT_READY',
    attachments: [
      { name: 'Adani_Enquiry_APML_491.pdf', size: '610 KB', type: 'PDF' },
    ],
    deliveryTerms: 'F.O.R Mundra Site',
    paymentTerms: '45 Days Net',
    targetLocation: 'Mundra, Kutch',
    remarks: 'Thermal unit 3 shutdown maintenance schedule',
  },
];

export const loadEmailRfqs = (): EmailRfqItem[] => {
  try {
    const raw = localStorage.getItem(EMAIL_ITEMS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse email RFQ items', e);
  }
  return INITIAL_EMAIL_RFQS;
};

export const saveEmailRfqs = (items: EmailRfqItem[]) => {
  localStorage.setItem(EMAIL_ITEMS_KEY, JSON.stringify(items));
};

/**
 * Intelligent parser that extracts customer/vendor info, line items, brands,
 * specifications, quantities, UOMs, and strict 6-level catalogue matches from email text
 * without inventing part numbers or product names.
 */
export function parseEmailTextToRfq(
  rawText: string,
  subject: string,
  senderEmail: string,
  customers: Customer[],
  options?: {
    senderName?: string;
    products?: ProductItem[];
    brands?: BrandMasterItem[];
    vendors?: Vendor[];
    attachmentItems?: ExtractedEmailItem[];
    attachmentCount?: number;
    aiItems?: Array<Partial<ExtractedEmailItem>>;
    parserEngine?: string;
  }
): ParsedEmailRequirementResult {
  return parseEmailRequirementWithCatalogue({
    rawText,
    subject,
    senderEmail,
    senderName: options?.senderName,
    customers,
    products: options?.products || [],
    brands: options?.brands || [],
    vendors: options?.vendors || [],
    attachmentItems: options?.attachmentItems || [],
    attachmentCount: options?.attachmentCount ?? 0,
    aiItems: options?.aiItems,
    parserEngine: options?.parserEngine,
  });
}
