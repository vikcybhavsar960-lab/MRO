import {
  GSTInvoice,
  VendorBill,
  DeliveryChallan,
  CreditNote,
  DebitNote,
  AccountingTransaction,
  ExpenseRecord,
  CompanySettings,
} from '../types';
import { fetchApi } from '../utils/apiClient';

export const COMPANY_SETTINGS_KEY = 'mro_company_settings';
export const INVOICES_KEY = 'mro_gst_invoices';
export const VENDOR_BILLS_KEY = 'mro_vendor_bills';
export const CHALLANS_KEY = 'mro_delivery_challans';
export const CREDIT_NOTES_KEY = 'mro_credit_notes';
export const DEBIT_NOTES_KEY = 'mro_debit_notes';
export const TRANSACTIONS_KEY = 'mro_accounting_transactions';
export const EXPENSES_KEY = 'mro_expenses_records';
export const BANK_ACCOUNTS_KEY = 'mro_bank_accounts';

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  companyName: 'MRO PROCUREMENT SOLUTION',
  tagline: 'Industrial MRO Spares, Bearings, Electrical, Belts & Mechanical Solutions',
  gstin: '24AAECM8891Q1Z4',
  pan: 'AAECM8891Q',
  address: 'Plot 42, GIDC Industrial Estate, Phase 2, Vatva',
  city: 'Ahmedabad',
  state: 'Gujarat',
  stateCode: '24',
  pincode: '382445',
  phone: '+91 98250 12345',
  email: 'accounts@mroprocurement.com',
  website: 'www.mroprocurement.com',
  invoicePrefix: 'INV-2026-',
  financialYear: '2026-2027',
  bankAccounts: [
    {
      id: 'BANK-01',
      accountName: 'HDFC Current A/c - MRO Procurement',
      bankName: 'HDFC Bank Ltd',
      accountNumber: '50200088991122',
      ifscCode: 'HDFC0001234',
      branch: 'Vatva Industrial Branch, Ahmedabad',
      accountType: 'CURRENT',
      openingBalance: 250000,
      currentBalance: 425600,
      upiId: 'mroprocurement@hdfcbank',
      isDefault: true,
    },
    {
      id: 'BANK-02',
      accountName: 'ICICI Bank Operating A/c',
      bankName: 'ICICI Bank',
      accountNumber: '003405012345',
      ifscCode: 'ICIC0000034',
      branch: 'C.G. Road Branch, Ahmedabad',
      accountType: 'CURRENT',
      openingBalance: 100000,
      currentBalance: 185000,
      upiId: 'mroprocurement@icici',
      isDefault: false,
    },
    {
      id: 'BANK-CASH',
      accountName: 'Cash in Hand (Office Petty Cash)',
      bankName: 'Cash Register',
      accountNumber: 'CASH-VAULT-01',
      ifscCode: 'NA',
      branch: 'Main Office',
      accountType: 'CASH_IN_HAND',
      openingBalance: 25000,
      currentBalance: 18450,
      isDefault: false,
    },
  ],
};

export const INITIAL_INVOICES: GSTInvoice[] = [
  {
    id: 'INV-001',
    invoiceNumber: 'INV-2026-0001',
    invoiceDate: '2026-09-09',
    dueDate: '2026-10-09',
    quotationId: 'QTN-2026-00001',
    customerPoId: 'CPO-2026-00001',
    requirementId: 'REQ-2026-00001',
    customerId: 'CUST-001',
    customerName: 'Tata Steel Tubes Division',
    customerGstin: '20AAACT2727Q1ZG',
    billingAddress: 'Central Stores Gate 3, Tata Steel Works, Jamshedpur 831001',
    shippingAddress: 'Central Stores Gate 3, Tata Steel Works, Jamshedpur 831001',
    placeOfSupply: 'Jharkhand (20)',
    isInterState: true,
    items: [
      {
        id: 'INV-ITM-001',
        itemName: 'Tapered Roller Bearing 30205',
        hsnCode: '84822010',
        quantity: 50,
        uom: 'NOS',
        unitPrice: 568.76,
        discountPercent: 0,
        taxableAmount: 28438,
        gstRate: 18,
        igstAmount: 5118.84,
        cgstAmount: 0,
        sgstAmount: 0,
        totalAmount: 33556.84,
      },
      {
        id: 'INV-ITM-002',
        itemName: 'Spherical Roller Bearing 22216 EK',
        hsnCode: '84823000',
        quantity: 10,
        uom: 'NOS',
        unitPrice: 5382,
        discountPercent: 0,
        taxableAmount: 53820,
        gstRate: 18,
        igstAmount: 9687.6,
        cgstAmount: 0,
        sgstAmount: 0,
        totalAmount: 63507.6,
      },
    ],
    subtotal: 82258,
    cgstTotal: 0,
    sgstTotal: 0,
    igstTotal: 14806.44,
    totalTax: 14806.44,
    roundOff: 0,
    grandTotal: 97064.44,
    paidAmount: 97064.44,
    balanceDue: 0,
    status: 'PAID',
    paymentTerms: '30 Days Net',
    notes: 'e-Way Bill: EWB-2490-8812-9901',
    createdAt: '2026-09-09',
  },
  {
    id: 'INV-002',
    invoiceNumber: 'INV-2026-0002',
    invoiceDate: '2026-09-20',
    dueDate: '2026-11-04',
    quotationId: 'QTN-2026-00002',
    customerPoId: 'CPO-2026-00002',
    requirementId: 'REQ-2026-00002',
    customerId: 'CUST-002',
    customerName: 'Larsen & Toubro Heavy Engineering',
    customerGstin: '24AAACL0140P1ZL',
    billingAddress: 'Hazira Manufacturing Complex, Surat, Gujarat 394510',
    shippingAddress: 'Hazira Manufacturing Complex, Surat, Gujarat 394510',
    placeOfSupply: 'Gujarat (24)',
    isInterState: false,
    items: [
      {
        id: 'INV-ITM-003',
        itemName: 'Three Phase Induction Motor 15kW 4-Pole',
        hsnCode: '85015210',
        quantity: 2,
        uom: 'NOS',
        unitPrice: 73660,
        discountPercent: 0,
        taxableAmount: 147320,
        gstRate: 18,
        cgstAmount: 13258.8,
        sgstAmount: 13258.8,
        igstAmount: 0,
        totalAmount: 173837.6,
      },
    ],
    subtotal: 147320,
    cgstTotal: 13258.8,
    sgstTotal: 13258.8,
    igstTotal: 0,
    totalTax: 26517.6,
    roundOff: 0,
    grandTotal: 173837.6,
    paidAmount: 173837.6,
    balanceDue: 0,
    status: 'PAID',
    paymentTerms: '45 Days Net',
    notes: 'e-Way Bill: EWB-2490-9944-7712',
    createdAt: '2026-09-20',
  },
];

export const INITIAL_VENDOR_BILLS: VendorBill[] = [
  {
    id: 'BILL-001',
    billNumber: 'INV/APX/26-1189',
    billDate: '2026-09-07',
    dueDate: '2026-09-21',
    vendorId: 'VEND-001',
    vendorName: 'Apex Industrial Bearings & Spares Pvt Ltd',
    vendorGstin: '27AABCA4589H1ZN',
    vendorPoId: 'VPO-2026-00001',
    requirementId: 'REQ-2026-00001',
    items: [
      {
        id: 'VBI-001',
        itemName: 'Tapered Roller Bearing 30205',
        hsnCode: '84822010',
        quantity: 50,
        uom: 'NOS',
        unitRate: 460,
        taxableAmount: 23000,
        gstRate: 18,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 4140,
        totalAmount: 27140,
      },
      {
        id: 'VBI-002',
        itemName: 'Spherical Roller Bearing 22216 EK',
        hsnCode: '84823000',
        quantity: 10,
        uom: 'NOS',
        unitRate: 4650,
        taxableAmount: 46500,
        gstRate: 18,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 8370,
        totalAmount: 54870,
      },
    ],
    subtotal: 69500,
    totalTax: 12510,
    grandTotal: 83410,
    paidAmount: 83410,
    balanceDue: 0,
    status: 'PAID',
    paymentTerms: '14 Days Net',
    notes: 'Paid via NEFT-HDFC-99382104921, includes freight ₹1,400',
    createdAt: '2026-09-07',
  },
  {
    id: 'BILL-002',
    billNumber: 'INV/SPMC/26-891',
    billDate: '2026-09-15',
    dueDate: '2026-09-30',
    vendorId: 'VEND-002',
    vendorName: 'Siemens Precision Motion Controls',
    vendorGstin: '06AABCS9912K1Z5',
    vendorPoId: 'VPO-2026-00002',
    requirementId: 'REQ-2026-00002',
    items: [
      {
        id: 'VBI-003',
        itemName: 'Three Phase Induction Motor 15kW 4-Pole',
        hsnCode: '85015210',
        quantity: 2,
        uom: 'NOS',
        unitRate: 62000,
        taxableAmount: 124000,
        gstRate: 18,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 22320,
        totalAmount: 146320,
      },
    ],
    subtotal: 124000,
    totalTax: 22320,
    grandTotal: 149320,
    paidAmount: 149320,
    balanceDue: 0,
    status: 'PAID',
    paymentTerms: '15 Days Net',
    notes: 'Paid via RTGS-UTIB-44910284759, includes freight ₹3,000',
    createdAt: '2026-09-15',
  },
];

export const INITIAL_EXPENSES: ExpenseRecord[] = [
  {
    id: 'EXP-001',
    expenseNumber: 'EXP-2026-001',
    date: '2026-09-10',
    category: 'TRANSPORT_FREIGHT',
    paidTo: 'V-Trans Express Cargo Ltd',
    amount: 3500,
    paymentMode: 'BANK_TRANSFER',
    referenceNumber: 'LR-JSR-99120',
    notes: 'Special wooden crate logistics for 60 industrial bearings',
    createdAt: '2026-09-10T10:00:00Z',
  },
  {
    id: 'EXP-002',
    expenseNumber: 'EXP-2026-002',
    date: '2026-09-16',
    category: 'OTHER',
    paidTo: 'TUV India Pvt Ltd',
    amount: 4200,
    paymentMode: 'BANK_TRANSFER',
    referenceNumber: 'TUV-INSP-2026-44',
    notes: 'Calibration and dynamic load certification for Tata Steel order',
    createdAt: '2026-09-16T11:00:00Z',
  },
];

// Active in-memory caches to guarantee immediate, synchronized multi-device rendering
let cachedCompanySettings: CompanySettings = DEFAULT_COMPANY_SETTINGS;
let cachedInvoices: GSTInvoice[] = INITIAL_INVOICES;
let cachedVendorBills: VendorBill[] = INITIAL_VENDOR_BILLS;
let cachedExpenses: ExpenseRecord[] = INITIAL_EXPENSES;

// Initialize caches from localStorage or fall back to authoritative defaults
if (typeof window !== 'undefined') {
  try {
    const rawSet = localStorage.getItem(COMPANY_SETTINGS_KEY);
    if (rawSet) cachedCompanySettings = JSON.parse(rawSet);
  } catch {}

  try {
    const rawInv = localStorage.getItem(INVOICES_KEY);
    if (rawInv) {
      const parsed = JSON.parse(rawInv);
      if (Array.isArray(parsed) && parsed.length > 0) cachedInvoices = parsed;
    }
  } catch {}

  try {
    const rawBills = localStorage.getItem(VENDOR_BILLS_KEY);
    if (rawBills) {
      const parsed = JSON.parse(rawBills);
      if (Array.isArray(parsed) && parsed.length > 0) cachedVendorBills = parsed;
    }
  } catch {}

  try {
    const rawExp = localStorage.getItem(EXPENSES_KEY);
    if (rawExp) {
      const parsed = JSON.parse(rawExp);
      if (Array.isArray(parsed) && parsed.length > 0) cachedExpenses = parsed;
    }
  } catch {}
}

/**
 * Synchronizes accounting records with authoritative backend state
 */
export const syncAccountingWithBackend = (serverState: any) => {
  if (!serverState) return;

  if (Array.isArray(serverState.invoices)) {
    cachedInvoices = serverState.invoices;
    try {
      localStorage.setItem(INVOICES_KEY, JSON.stringify(serverState.invoices));
    } catch {}
  }

  if (Array.isArray(serverState.vendorBills)) {
    cachedVendorBills = serverState.vendorBills;
    try {
      localStorage.setItem(VENDOR_BILLS_KEY, JSON.stringify(serverState.vendorBills));
    } catch {}
  }

  if (Array.isArray(serverState.expenses)) {
    cachedExpenses = serverState.expenses;
    try {
      localStorage.setItem(EXPENSES_KEY, JSON.stringify(serverState.expenses));
    } catch {}
  }

  if (serverState.companySettings) {
    cachedCompanySettings = { ...DEFAULT_COMPANY_SETTINGS, ...serverState.companySettings };
    try {
      localStorage.setItem(COMPANY_SETTINGS_KEY, JSON.stringify(cachedCompanySettings));
    } catch {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mro_accounting_updated'));
  }
};

export const loadCompanySettings = (): CompanySettings => {
  return cachedCompanySettings;
};

export const saveCompanySettings = (settings: CompanySettings) => {
  cachedCompanySettings = settings;
  try {
    localStorage.setItem(COMPANY_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}

  fetchApi('/api/company-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  }).catch((err) => console.warn('[Accounting] Failed to sync company settings to backend:', err));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mro_accounting_updated'));
  }
};

export const loadInvoices = (): GSTInvoice[] => {
  return cachedInvoices;
};

export const saveInvoices = (invoices: GSTInvoice[]) => {
  cachedInvoices = invoices;
  try {
    localStorage.setItem(INVOICES_KEY, JSON.stringify(invoices));
  } catch {}

  // Sync to central production API
  for (const inv of invoices) {
    fetchApi('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inv),
    }).catch((err) => console.warn('[Accounting] Failed to persist invoice to central API:', err));
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mro_accounting_updated'));
  }
};

export const loadVendorBills = (): VendorBill[] => {
  return cachedVendorBills;
};

export const saveVendorBills = (bills: VendorBill[]) => {
  cachedVendorBills = bills;
  try {
    localStorage.setItem(VENDOR_BILLS_KEY, JSON.stringify(bills));
  } catch {}

  // Sync to central production API
  for (const bill of bills) {
    fetchApi('/api/vendor-bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bill),
    }).catch((err) => console.warn('[Accounting] Failed to persist vendor bill to central API:', err));
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mro_accounting_updated'));
  }
};

export const loadChallans = (): DeliveryChallan[] => {
  try {
    const raw = localStorage.getItem(CHALLANS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
};

export const saveChallans = (challans: DeliveryChallan[]) => {
  localStorage.setItem(CHALLANS_KEY, JSON.stringify(challans));
};

export const loadCreditNotes = (): CreditNote[] => {
  try {
    const raw = localStorage.getItem(CREDIT_NOTES_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
};

export const saveCreditNotes = (cns: CreditNote[]) => {
  localStorage.setItem(CREDIT_NOTES_KEY, JSON.stringify(cns));
};

export const loadDebitNotes = (): DebitNote[] => {
  try {
    const raw = localStorage.getItem(DEBIT_NOTES_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
};

export const saveDebitNotes = (dns: DebitNote[]) => {
  localStorage.setItem(DEBIT_NOTES_KEY, JSON.stringify(dns));
};

export const loadTransactions = (): AccountingTransaction[] => {
  try {
    const raw = localStorage.getItem(TRANSACTIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
};

export const saveTransactions = (txns: AccountingTransaction[]) => {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(txns));
};

export const loadExpenses = (): ExpenseRecord[] => {
  return cachedExpenses;
};

export const saveExpenses = (expenses: ExpenseRecord[]) => {
  cachedExpenses = expenses;
  try {
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
  } catch {}

  // Sync to central production API
  for (const exp of expenses) {
    fetchApi('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exp),
    }).catch((err) => console.warn('[Accounting] Failed to persist expense to central API:', err));
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mro_accounting_updated'));
  }
};

/**
 * Calculates GST splits (Intra-state CGST + SGST vs Inter-state IGST)
 */
export function calculateGstSplits(
  taxableAmount: number,
  gstRate: number,
  isInterState: boolean
): {
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  totalAmount: number;
} {
  const totalTax = (taxableAmount * gstRate) / 100;
  if (isInterState) {
    return {
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: totalTax,
      totalTax,
      totalAmount: taxableAmount + totalTax,
    };
  } else {
    const halfTax = totalTax / 2;
    return {
      cgstAmount: halfTax,
      sgstAmount: halfTax,
      igstAmount: 0,
      totalTax,
      totalAmount: taxableAmount + totalTax,
    };
  }
}
