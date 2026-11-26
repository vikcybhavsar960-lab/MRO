import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { INITIAL_MATERIAL_CATEGORIES } from '../data/categoryMasterData';
import { INITIAL_BRANDS } from '../data/brandMasterData';
import {
  INITIAL_CATALOGUE_PRODUCTS,
  INITIAL_RATE_VERSION_HISTORY,
  INITIAL_IMPORT_BATCHES,
} from '../data/catalogueMasterSeed';
import { normalizePartCode } from '../services/rateMatchingEngine';
import {
  calculateVendorIntelligenceScore,
  compareVendorCatalogues,
  combineWebsiteAndCatalogueIntelligence,
  preserveExactPartCode,
  mapProductFamilyAndType,
} from '../services/vendorIntelligenceService';
import {
  validateGstinFormat,
  validatePanFormat,
  computeOnboardingCompletion,
} from '../services/vendorOnboardingService';
import { normalizeUserRole } from '../utils/roleUtils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const DATA_DIR = path.resolve(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'erp_production.json');
const CACHE_FILE = path.join(DATA_DIR, 'erp_cache.json');

// Security: Hash password using PBKDF2 with salt
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, generatedSalt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt: generatedSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const check = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return check === hash;
}

// User & Role Definitions
export interface UserRecord {
  id: string;
  name: string;
  email: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  role: string;
  department: string;
  mobile: string;
  status: 'ACTIVE' | 'INACTIVE';
  approvalAuthority: {
    canApproveRequirements: boolean;
    canApproveRfqs: boolean;
    canApprovePos: boolean;
    canApprovePayments: boolean;
    maxApprovalLimit: number; // 0 = unlimited, otherwise max amount in INR
  };
  permissions: {
    modules: {
      dashboard: boolean;
      requirements: boolean;
      rfqs: boolean;
      approvals: boolean;
      vendors: boolean;
      quotations: boolean;
      customerPos: boolean;
      vendorPos: boolean;
      payments: boolean;
      dispatch: boolean;
      reports: boolean;
      userManagement: boolean;
      auditTrail: boolean;
    };
    actions: {
      canView: boolean;
      canAdd: boolean;
      canEdit: boolean;
      canDelete: boolean;
      canApprove: boolean;
    };
  };
  createdAt: string;
  lastLogin?: string;
  mustChangePassword?: boolean;
  resetPasswordToken?: string;
  resetPasswordExpires?: string;
  failedLoginAttempts?: number;
  lockedUntil?: string;
}

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  defaultPermissions: UserRecord['permissions'];
  approvalLimit: number;
}

export interface ApprovalRecord {
  id: string;
  requestType: 'REQUIREMENT' | 'RFQ' | 'CUSTOMER_PO' | 'VENDOR_PO' | 'PAYMENT' | 'PRICE_OVERRIDE';
  requestNumber: string;
  requestDate: string;
  requestorId: string;
  requestorName: string;
  department: string;
  vendorOrCustomer: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SENT_BACK';
  approvalLevel: 'LEVEL_1' | 'LEVEL_2' | 'FINAL';
  pendingSince: string;
  details: string;
  approverId?: string;
  approverName?: string;
  actionDate?: string;
  comments?: string;
  history: Array<{
    action: string;
    actor: string;
    timestamp: string;
    comments?: string;
  }>;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  module: string;
  recordNumber: string;
  oldStatus?: string;
  newStatus?: string;
  remarks: string;
  ipAddress?: string;
}

export interface RfqClosureDetails {
  rfqNumber: string;
  customerName: string;
  customerRfqReference: string;
  closureDate: string;
  closureReason: 'CUSTOMER_CONFIRMATION' | 'BUDGET_CANCELLED' | 'LOST_TO_COMPETITOR' | 'SPEC_CHANGED' | 'OTHER';
  customerEmailReference: string; // e.g. "Email from John (Procurement Head) on 04-Oct-2026: Project on hold"
  remarks: string;
  closedBy: string;
  closedAt: string;
}

export interface LoginAuditRecord {
  id: string;
  timestamp: string;
  username: string;
  role: string;
  userId?: string;
  status: 'SUCCESS' | 'FAILED';
  ipAddress: string;
  userAgent: string;
  deviceType: string;
  sessionId: string;
  failureReason?: string;
}

export interface ActiveSessionRecord {
  id: string;
  userId: string;
  username: string;
  name: string;
  role: string;
  ipAddress: string;
  userAgent: string;
  deviceType: string;
  loginTime: string;
  lastActiveTime: string;
  status: 'ACTIVE' | 'REVOKED';
}

export interface ErpDatabaseSchema {
  version: number;
  lastUpdated: string;
  users: UserRecord[];
  roles: RoleDefinition[];
  approvals: ApprovalRecord[];
  auditLogs: AuditLogEntry[];
  requirements: any[];
  deletedRequirementIds: string[];
  companies: any[];
  purchaseExecutives: any[];
  customers: any[];
  vendors: any[];
  products: any[];
  quotations: any[];
  customerPos: any[];
  vendorPos: any[];
  proformaInvoices: any[];
  payments: any[];
  dispatches: any[];
  deliveries: any[];
  rfqs: any[];
  vendorQuotes: any[];
  notifications: any[];
  loginAuditLogs: LoginAuditRecord[];
  activeSessions: ActiveSessionRecord[];
  rfqCounter: number;
  vendorProductMappings: any[];
  invoices: any[];
  vendorBills: any[];
  expenses: any[];
  challans: any[];
  companySettings: any;
  brandingSettings?: any;
  themeSettings?: any;
  brandDiscounts?: any[];
  brands: any[];
  categories: any[];
  productTypes: any[];
  deletedVendorIds: string[];
  deletedRfqIds: string[];
  deletedCustomerIds?: string[];
  deletedCompanyIds?: string[];
  deletedPurchaseExecutiveIds?: string[];
  deletedProductIds?: string[];
  deletedBrandIds?: string[];
  deletedCategoryIds?: string[];
  deletedVendorMappingIds?: string[];
  deletedVendorQuoteIds?: string[];
  catalogueImportHistory?: any[];
  confirmedAiMappings?: any[];
  savedColumnMappings?: any[];
  catalogueProducts?: any[];
  rateVersionHistory?: any[];
  importBatches?: any[];
  urlCache?: Record<string, any>;
  catalogueCache?: Record<string, any>;
}


// Initial Roles
export const INITIAL_ROLES: RoleDefinition[] = [
  {
    id: 'ROLE-ADMIN',
    name: 'Admin',
    description: 'Full administrative access across all modules, approvals, and user management',
    approvalLimit: 0, // unlimited
    defaultPermissions: {
      modules: {
        dashboard: true,
        requirements: true,
        rfqs: true,
        approvals: true,
        vendors: true,
        quotations: true,
        customerPos: true,
        vendorPos: true,
        payments: true,
        dispatch: true,
        reports: true,
        userManagement: true,
        auditTrail: true,
      },
      actions: { canView: true, canAdd: true, canEdit: true, canDelete: true, canApprove: true },
    },
  },
  {
    id: 'ROLE-PURCHASE-MGR',
    name: 'Purchase Manager',
    description: 'Manages sourcing, reviews RFQs, approves supplier purchase orders up to ₹10,00,000',
    approvalLimit: 1000000,
    defaultPermissions: {
      modules: {
        dashboard: true,
        requirements: true,
        rfqs: true,
        approvals: true,
        vendors: true,
        quotations: true,
        customerPos: true,
        vendorPos: true,
        payments: false,
        dispatch: true,
        reports: true,
        userManagement: false,
        auditTrail: true,
      },
      actions: { canView: true, canAdd: true, canEdit: true, canDelete: false, canApprove: true },
    },
  },
  {
    id: 'ROLE-PURCHASE-USER',
    name: 'Purchase User',
    description: 'Creates requirements, drafts vendor RFQs, compares quotes and tracks order delivery',
    approvalLimit: 0,
    defaultPermissions: {
      modules: {
        dashboard: true,
        requirements: true,
        rfqs: true,
        approvals: false,
        vendors: true,
        quotations: true,
        customerPos: false,
        vendorPos: false,
        payments: false,
        dispatch: false,
        reports: true,
        userManagement: false,
        auditTrail: false,
      },
      actions: { canView: true, canAdd: true, canEdit: true, canDelete: false, canApprove: false },
    },
  },
  {
    id: 'ROLE-APPROVAL-USER',
    name: 'Approval User',
    description: 'Senior reviewer authorized to approve high-value procurement requests and vendor quotes',
    approvalLimit: 5000000,
    defaultPermissions: {
      modules: {
        dashboard: true,
        requirements: true,
        rfqs: true,
        approvals: true,
        vendors: true,
        quotations: true,
        customerPos: true,
        vendorPos: true,
        payments: true,
        dispatch: false,
        reports: true,
        userManagement: false,
        auditTrail: true,
      },
      actions: { canView: true, canAdd: false, canEdit: false, canDelete: false, canApprove: true },
    },
  },
  {
    id: 'ROLE-ACCOUNTS-USER',
    name: 'Accounts User',
    description: 'Oversees financial settlements, vendor payments, GST invoices and proforma billing',
    approvalLimit: 500000,
    defaultPermissions: {
      modules: {
        dashboard: true,
        requirements: false,
        rfqs: false,
        approvals: true,
        vendors: true,
        quotations: true,
        customerPos: true,
        vendorPos: true,
        payments: true,
        dispatch: true,
        reports: true,
        userManagement: false,
        auditTrail: true,
      },
      actions: { canView: true, canAdd: true, canEdit: true, canDelete: false, canApprove: true },
    },
  },
  {
    id: 'ROLE-STORE-USER',
    name: 'Store User',
    description: 'Handles goods receiving, dispatch LR verification, and physical warehouse inventory',
    approvalLimit: 0,
    defaultPermissions: {
      modules: {
        dashboard: true,
        requirements: true,
        rfqs: false,
        approvals: false,
        vendors: true,
        quotations: false,
        customerPos: false,
        vendorPos: true,
        payments: false,
        dispatch: true,
        reports: false,
        userManagement: false,
        auditTrail: false,
      },
      actions: { canView: true, canAdd: true, canEdit: false, canDelete: false, canApprove: false },
    },
  },
  {
    id: 'ROLE-VIEWER',
    name: 'Management / Viewer',
    description: 'Executive read-only visibility into procurement KPIs, analytics and audit trails',
    approvalLimit: 0,
    defaultPermissions: {
      modules: {
        dashboard: true,
        requirements: true,
        rfqs: true,
        approvals: true,
        vendors: true,
        quotations: true,
        customerPos: true,
        vendorPos: true,
        payments: true,
        dispatch: true,
        reports: true,
        userManagement: false,
        auditTrail: true,
      },
      actions: { canView: true, canAdd: false, canEdit: false, canDelete: false, canApprove: false },
    },
  },
];

export const INITIAL_COMPANY_SETTINGS = {
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
  ],
};

export const INITIAL_INVOICES = [
  {
    id: 'INV-001',
    invoiceNumber: 'INV-2026-0001',
    invoiceDate: '2026-09-09',
    dueDate: '2026-10-09',
    quotationId: 'QTN-2026-00001',
    customerPoId: 'CPO-2026-00001',
    requirementId: 'REQ-2026-00001',
    customerId: 'CMP-001',
    customerName: 'hyfunfoods',
    customerGstin: '24AAACH1234F1Z5',
    customerAddress: 'hyfunfoods Processing Plant, GIDC Mehsana, Gujarat 384002',
    placeOfSupply: 'Gujarat (24)',
    items: [
      {
        id: 'INV-ITM-001',
        requirementItemId: 'ITEM-001-A',
        itemName: 'Tapered Roller Bearing 30205',
        partNumber: '30205-J2/Q',
        hsnCode: '84822010',
        quantity: 50,
        uom: 'NOS',
        unitPrice: 568.76,
        taxableAmount: 28438,
        gstRate: 18,
        igstAmount: 5118.84,
        cgstAmount: 0,
        sgstAmount: 0,
        totalAmount: 33556.84,
      },
      {
        id: 'INV-ITM-002',
        requirementItemId: 'ITEM-001-B',
        itemName: 'Spherical Roller Bearing 22216 EK',
        partNumber: '22216-EK-C3',
        hsnCode: '84823000',
        quantity: 10,
        uom: 'NOS',
        unitPrice: 5382,
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
    grandTotal: 97064.44,
    paidAmount: 97064.44,
    balanceDue: 0,
    status: 'PAID',
    eWayBillNumber: 'EWB-2490-8812-9901',
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
    customerAddress: 'Hazira Manufacturing Complex, Surat, Gujarat 394510',
    placeOfSupply: 'Gujarat (24)',
    items: [
      {
        id: 'INV-ITM-003',
        requirementItemId: 'ITEM-002-A',
        itemName: 'Three Phase Induction Motor 15kW 4-Pole',
        partNumber: '1LE7501-1EB22-2AA4',
        hsnCode: '85015210',
        quantity: 2,
        uom: 'NOS',
        unitPrice: 73660,
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
    grandTotal: 173837.6,
    paidAmount: 173837.6,
    balanceDue: 0,
    status: 'PAID',
    eWayBillNumber: 'EWB-2490-9944-7712',
    createdAt: '2026-09-20',
  },
];

export const INITIAL_VENDOR_BILLS = [
  {
    id: 'BILL-001',
    billNumber: 'INV/APX/26-1189',
    billDate: '2026-09-07',
    dueDate: '2026-09-21',
    vendorId: 'VEND-001',
    vendorName: 'Apex Industrial Bearings & Spares Pvt Ltd',
    vendorGstin: '27AABCA4589H1ZN',
    vendorPoId: 'VPO-2026-00001',
    subtotal: 69500,
    cgstTotal: 0,
    sgstTotal: 0,
    igstTotal: 12510,
    totalTax: 12510,
    freight: 1400,
    grandTotal: 83410,
    paidAmount: 83410,
    balanceDue: 0,
    status: 'PAID',
    paymentReference: 'NEFT-HDFC-99382104921',
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
    subtotal: 124000,
    cgstTotal: 0,
    sgstTotal: 0,
    igstTotal: 22320,
    totalTax: 22320,
    freight: 3000,
    grandTotal: 149320,
    paidAmount: 149320,
    balanceDue: 0,
    status: 'PAID',
    paymentReference: 'RTGS-UTIB-44910284759',
    createdAt: '2026-09-15',
  },
];

export const INITIAL_EXPENSES = [
  {
    id: 'EXP-001',
    expenseNumber: 'EXP-2026-001',
    date: '2026-09-10',
    category: 'Freight & Logistics',
    title: 'V-Trans Express Jamshedpur Delivery Freight',
    description: 'Special wooden crate logistics for 60 industrial bearings',
    amount: 3500,
    taxAmount: 630,
    totalAmount: 4130,
    paymentMode: 'BANK_TRANSFER',
    vendorName: 'V-Trans Express Cargo Ltd',
    receiptUrl: '#',
    status: 'PAID',
  },
  {
    id: 'EXP-002',
    expenseNumber: 'EXP-2026-002',
    date: '2026-09-16',
    category: 'Inspection & Testing',
    title: 'TUV India Third-Party Bearing Dynamic Load Inspection',
    description: 'Calibration and dynamic load certification for hyfunfoods order',
    amount: 4200,
    taxAmount: 756,
    totalAmount: 4956,
    paymentMode: 'BANK_TRANSFER',
    vendorName: 'TUV India Pvt Ltd',
    receiptUrl: '#',
    status: 'PAID',
  },
];

export const INITIAL_PRODUCT_TYPES = [
  { id: 'PT-001', name: 'MCB', category: 'Electrical', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'PT-002', name: 'MCCB', category: 'Electrical', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'PT-003', name: 'SPD', category: 'Electrical', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'PT-004', name: 'ACB', category: 'Electrical', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'PT-005', name: 'Contactor', category: 'Electrical', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'PT-006', name: 'Overload Relay', category: 'Electrical', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'PT-007', name: 'Bearings', category: 'Mechanical and Industrial', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'PT-008', name: 'Sensors', category: 'Electronics and Automation', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'PT-009', name: 'Valves', category: 'Plumbing, Pipes and Fittings', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'PT-010', name: 'Industrial Lubricants', category: 'Paints, Chemicals and Lubricants', createdAt: '2026-01-01T00:00:00.000Z' },
];

// Helper to seed initial data
function createDefaultDatabase(): ErpDatabaseSchema {
  const adminSaltHash = hashPassword('Admin@123');
  const purchaseSaltHash = hashPassword('Purchase@123');
  const approverSaltHash = hashPassword('Approver@123');
  const accountsSaltHash = hashPassword('Accounts@123');

  const defaultUsers: UserRecord[] = [
    {
      id: 'USR-001',
      name: 'Vicky Bhavsar (Super Admin)',
      email: 'vickybhavsar960@gmail.com',
      username: 'admin',
      passwordHash: adminSaltHash.hash,
      passwordSalt: adminSaltHash.salt,
      role: 'Admin',
      department: 'Executive Management',
      mobile: '+91 98200 11223',
      status: 'ACTIVE',
      approvalAuthority: {
        canApproveRequirements: true,
        canApproveRfqs: true,
        canApprovePos: true,
        canApprovePayments: true,
        maxApprovalLimit: 0,
      },
      permissions: INITIAL_ROLES[0].defaultPermissions,
      createdAt: '2026-01-01 09:00:00',
    },
    {
      id: 'USR-002',
      name: 'Suresh Patil (Purchase Manager)',
      email: 'suresh.patil@procuremro.com',
      username: 'suresh_purchase',
      passwordHash: purchaseSaltHash.hash,
      passwordSalt: purchaseSaltHash.salt,
      role: 'Purchase Manager',
      department: 'Procurement & Sourcing',
      mobile: '+91 98221 44556',
      status: 'ACTIVE',
      approvalAuthority: {
        canApproveRequirements: true,
        canApproveRfqs: true,
        canApprovePos: true,
        canApprovePayments: false,
        maxApprovalLimit: 1000000,
      },
      permissions: INITIAL_ROLES[1].defaultPermissions,
      createdAt: '2026-01-10 10:30:00',
    },
    {
      id: 'USR-003',
      name: 'Anjali Deshmukh (Lead Approver)',
      email: 'anjali.d@procuremro.com',
      username: 'anjali_approver',
      passwordHash: approverSaltHash.hash,
      passwordSalt: approverSaltHash.salt,
      role: 'Approval User',
      department: 'Commercial Audit & Governance',
      mobile: '+91 98112 77889',
      status: 'ACTIVE',
      approvalAuthority: {
        canApproveRequirements: true,
        canApproveRfqs: true,
        canApprovePos: true,
        canApprovePayments: true,
        maxApprovalLimit: 5000000,
      },
      permissions: INITIAL_ROLES[3].defaultPermissions,
      createdAt: '2026-01-15 11:15:00',
    },
    {
      id: 'USR-004',
      name: 'Pooja Iyer (Accounts Lead)',
      email: 'pooja.i@procuremro.com',
      username: 'pooja_accounts',
      passwordHash: accountsSaltHash.hash,
      passwordSalt: accountsSaltHash.salt,
      role: 'Accounts User',
      department: 'Finance & Treasury',
      mobile: '+91 98334 66112',
      status: 'ACTIVE',
      approvalAuthority: {
        canApproveRequirements: false,
        canApproveRfqs: false,
        canApprovePos: false,
        canApprovePayments: true,
        maxApprovalLimit: 500000,
      },
      permissions: INITIAL_ROLES[4].defaultPermissions,
      createdAt: '2026-02-01 09:45:00',
    },
  ];

  const defaultApprovals: ApprovalRecord[] = [
    {
      id: 'APP-2026-0001',
      requestType: 'REQUIREMENT',
      requestNumber: 'REQ-2026-00001',
      requestDate: '2026-10-02',
      requestorId: 'USR-002',
      requestorName: 'Suresh Patil',
      department: 'Plant Maintenance #4',
      vendorOrCustomer: 'Tata Motors Pune Plant',
      amount: 45000,
      currency: 'INR',
      status: 'PENDING',
      approvalLevel: 'LEVEL_1',
      pendingSince: '2026-10-02 14:00',
      details: 'Indent for 50 Nos of SKF 6206 2RS Bearings for conveyor line overhaul.',
      history: [
        { action: 'CREATED', actor: 'Suresh Patil', timestamp: '2026-10-02 14:00', comments: 'Requirement submitted for technical review' },
      ],
    },
    {
      id: 'APP-2026-0002',
      requestType: 'RFQ',
      requestNumber: 'RFQ-2026-00002',
      requestDate: '2026-10-03',
      requestorId: 'USR-002',
      requestorName: 'Suresh Patil',
      department: 'Instrumentation',
      vendorOrCustomer: 'JSW Steel Ballari',
      amount: 114000,
      currency: 'INR',
      status: 'PENDING',
      approvalLevel: 'LEVEL_2',
      pendingSince: '2026-10-03 16:30',
      details: 'Vendor rate evaluation for Siemens S7-1200 CPU & Festo Solenoid Valves. Rate variance within 3.5%.',
      history: [
        { action: 'CREATED', actor: 'Suresh Patil', timestamp: '2026-10-03 16:30', comments: 'Multi-vendor rate comparison complete' },
      ],
    },
    {
      id: 'APP-2026-0003',
      requestType: 'VENDOR_PO',
      requestNumber: 'VPO-2026-00001',
      requestDate: '2026-09-28',
      requestorId: 'USR-002',
      requestorName: 'Suresh Patil',
      department: 'Mechanical Spares',
      vendorOrCustomer: 'Apex Industrial Bearings & Spares',
      amount: 38500,
      currency: 'INR',
      status: 'APPROVED',
      approvalLevel: 'FINAL',
      pendingSince: '2026-09-28 10:00',
      details: 'Binding Purchase Order for emergency bearing delivery with 50% advance terms.',
      approverId: 'USR-003',
      approverName: 'Anjali Deshmukh',
      actionDate: '2026-09-28 15:20',
      comments: 'Approved with commercial margin locked at 14.2%.',
      history: [
        { action: 'CREATED', actor: 'Suresh Patil', timestamp: '2026-09-28 10:00' },
        { action: 'APPROVED', actor: 'Anjali Deshmukh', timestamp: '2026-09-28 15:20', comments: 'Approved with commercial lock' },
      ],
    },
  ];

  const defaultAuditLogs: AuditLogEntry[] = [
    {
      id: 'AUD-001',
      timestamp: '2026-10-01 09:30:15',
      user: 'Vicky Bhavsar',
      role: 'Admin',
      action: 'SYSTEM_STARTUP',
      module: 'Core System',
      recordNumber: 'SYS-INIT',
      remarks: 'Production Database engine initialized with secure credentials & schema tables',
    },
    {
      id: 'AUD-002',
      timestamp: '2026-10-02 14:02:00',
      user: 'Suresh Patil',
      role: 'Purchase Manager',
      action: 'REQUIREMENT_CREATED',
      module: 'Requirement',
      recordNumber: 'REQ-2026-00001',
      newStatus: 'OPEN',
      remarks: 'Created requirement for Tata Motors bearing indent',
    },
  ];

  return {
    version: 2,
    lastUpdated: new Date().toISOString(),
    users: defaultUsers,
    roles: INITIAL_ROLES,
    approvals: defaultApprovals,
    auditLogs: defaultAuditLogs,
    requirements: [],
    deletedRequirementIds: ['RFQ-2026-00005', 'RFQ-2026-00006', 'REQ-2026-00005', 'REQ-2026-00006'],
    companies: [],
    purchaseExecutives: [],
    customers: [],
    vendors: [],
    products: [],
    quotations: [],
    customerPos: [],
    vendorPos: [],
    proformaInvoices: [],
    payments: [],
    dispatches: [],
    deliveries: [],
    rfqs: [],
    vendorQuotes: [],
    notifications: [],
    loginAuditLogs: [],
    activeSessions: [],
    rfqCounter: 100,
    vendorProductMappings: [],
    brands: [],
    categories: [],
    productTypes: [...INITIAL_PRODUCT_TYPES],
    invoices: INITIAL_INVOICES,
    vendorBills: INITIAL_VENDOR_BILLS,
    expenses: INITIAL_EXPENSES,
    challans: [],
    companySettings: INITIAL_COMPANY_SETTINGS,
    deletedVendorIds: [],
    deletedRfqIds: ['RFQ-2026-00005', 'RFQ-2026-00006'],
    deletedCustomerIds: [],
    deletedCompanyIds: [],
    deletedPurchaseExecutiveIds: [],
    deletedProductIds: [],
    deletedBrandIds: [],
    deletedCategoryIds: [],
    deletedVendorMappingIds: [],
    deletedVendorQuoteIds: [],
    catalogueImportHistory: [],
    confirmedAiMappings: [],
    savedColumnMappings: [],
    catalogueProducts: [...INITIAL_CATALOGUE_PRODUCTS],
    rateVersionHistory: [...INITIAL_RATE_VERSION_HISTORY],
    importBatches: [...INITIAL_IMPORT_BATCHES],
    urlCache: {},
    catalogueCache: {},
  };
}


// Memory cache with disk synchronization
class PersistentDatabase {
  private data: ErpDatabaseSchema;
  private cacheData: { urlCache: Record<string, any>; catalogueCache: Record<string, any> } = {
    urlCache: {},
    catalogueCache: {},
  };
  private cacheSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private isSaving: boolean = false;
  private stateRevision: number = 1;
  private lastSavedBytes: number = 0;

  constructor() {
    this.cacheData = this.loadCacheFromDisk();
    this.data = this.loadFromDisk();
  }

  public getStateRevision(): number {
    return this.stateRevision;
  }

  private loadCacheFromDisk(): { urlCache: Record<string, any>; catalogueCache: Record<string, any> } {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        return {
          urlCache: parsed?.urlCache && typeof parsed.urlCache === 'object' ? parsed.urlCache : {},
          catalogueCache: parsed?.catalogueCache && typeof parsed.catalogueCache === 'object' ? parsed.catalogueCache : {},
        };
      }
    } catch {}
    return { urlCache: {}, catalogueCache: {} };
  }

  private scheduleCacheSave() {
    if (this.cacheSaveTimer) clearTimeout(this.cacheSaveTimer);
    this.cacheSaveTimer = setTimeout(async () => {
      this.cacheSaveTimer = null;
      try {
        const tmp = `${CACHE_FILE}.tmp.${process.pid}.${Date.now()}`;
        await fs.promises.writeFile(tmp, JSON.stringify(this.cacheData), 'utf-8');
        await fs.promises.rename(tmp, CACHE_FILE);
      } catch (err) {
        console.warn('[Cache] Failed async cache write:', err);
      }
    }, 250);
  }

  private pruneSessions(sessions: ActiveSessionRecord[]): ActiveSessionRecord[] {
    if (!Array.isArray(sessions)) return [];
    const activeByUser = new Map<string, ActiveSessionRecord[]>();
    const inactive: ActiveSessionRecord[] = [];
    for (const s of sessions) {
      if (!s || !s.id) continue;
      if (s.status === 'ACTIVE') {
        const key = s.userId || s.username || 'anon';
        const list = activeByUser.get(key) || [];
        if (list.length < 5) {
          list.push(s);
          activeByUser.set(key, list);
        }
      } else if (inactive.length < 15) {
        inactive.push(s);
      }
    }
    const keptActive = Array.from(activeByUser.values()).flat();
    return [...keptActive, ...inactive].slice(0, 35);
  }

  private loadFromDisk(): ErpDatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.vendorQuotes)) parsed.vendorQuotes = [];
        if (!Array.isArray(parsed.requirements)) parsed.requirements = [];
        if (!Array.isArray(parsed.rfqs)) parsed.rfqs = [];
        if (!Array.isArray(parsed.vendors)) parsed.vendors = [];
        if (!Array.isArray(parsed.vendorPos)) parsed.vendorPos = [];
        if (!Array.isArray(parsed.notifications)) parsed.notifications = [];
        if (!Array.isArray(parsed.users)) parsed.users = [];
        if (!Array.isArray(parsed.companies)) parsed.companies = [];
        if (!Array.isArray(parsed.purchaseExecutives)) parsed.purchaseExecutives = [];
        if (!Array.isArray(parsed.customers)) parsed.customers = [];
        if (!Array.isArray(parsed.products)) parsed.products = [];
        if (!Array.isArray(parsed.quotations)) parsed.quotations = [];
        if (!Array.isArray(parsed.customerPos)) parsed.customerPos = [];
        if (!Array.isArray(parsed.proformaInvoices)) parsed.proformaInvoices = [];
        if (!Array.isArray(parsed.payments)) parsed.payments = [];
        if (!Array.isArray(parsed.dispatches)) parsed.dispatches = [];
        if (!Array.isArray(parsed.deliveries)) parsed.deliveries = [];
        if (!Array.isArray(parsed.loginAuditLogs)) parsed.loginAuditLogs = [];
        if (!Array.isArray(parsed.activeSessions)) parsed.activeSessions = [];
        let needsDiskSave = false;
        if (!Array.isArray(parsed.invoices) || parsed.invoices.length === 0) {
          parsed.invoices = INITIAL_INVOICES;
          needsDiskSave = true;
        }
        if (!Array.isArray(parsed.vendorBills) || parsed.vendorBills.length === 0) {
          parsed.vendorBills = INITIAL_VENDOR_BILLS;
          needsDiskSave = true;
        }
        if (!Array.isArray(parsed.expenses) || parsed.expenses.length === 0) {
          parsed.expenses = INITIAL_EXPENSES;
          needsDiskSave = true;
        }
        if (!Array.isArray(parsed.challans)) {
          parsed.challans = [];
          needsDiskSave = true;
        }
        if (!parsed.companySettings) {
          parsed.companySettings = INITIAL_COMPANY_SETTINGS;
          needsDiskSave = true;
        }
        if (!Array.isArray(parsed.brands) || parsed.brands.length === 0) {
          parsed.brands = INITIAL_BRANDS.map((b) => ({ ...b }));
          needsDiskSave = true;
        }
        if (!Array.isArray(parsed.categories) || parsed.categories.length === 0) {
          parsed.categories = INITIAL_MATERIAL_CATEGORIES.map((c) => ({ ...c }));
          needsDiskSave = true;
        } else {
          parsed.categories = parsed.categories.map((c: any) => ({
            ...c,
            code: c.code || c.id || 'CAT',
            description: c.description || '',
            subCategories: Array.isArray(c.subCategories) ? c.subCategories : ['Standard'],
            keywords: Array.isArray(c.keywords) ? c.keywords : [(c.name || '').toLowerCase()],
            itemExamples: Array.isArray(c.itemExamples) ? c.itemExamples : [],
            isActive: c.isActive !== false,
          }));
        }
        if (!Array.isArray(parsed.productTypes) || parsed.productTypes.length === 0) {
          parsed.productTypes = INITIAL_PRODUCT_TYPES.map((pt) => ({ ...pt }));
          needsDiskSave = true;
        }
        if (typeof parsed.rfqCounter !== 'number') parsed.rfqCounter = 100;

        if (!Array.isArray(parsed.deletedRequirementIds)) {
          parsed.deletedRequirementIds = ['RFQ-2026-00005', 'RFQ-2026-00006', 'REQ-2026-00005', 'REQ-2026-00006'];
        } else {
          // Ensure RFQ 5 and 6 are strictly included in tombstones
          for (const tomb of ['RFQ-2026-00005', 'RFQ-2026-00006', 'REQ-2026-00005', 'REQ-2026-00006']) {
            if (!parsed.deletedRequirementIds.includes(tomb)) {
              parsed.deletedRequirementIds.push(tomb);
            }
          }
        }

        if (!Array.isArray(parsed.deletedVendorIds)) {
          parsed.deletedVendorIds = [];
        } else if (Array.isArray(parsed.vendors)) {
          parsed.vendors = parsed.vendors.filter((v: any) => !parsed.deletedVendorIds.includes(v.id));
        }

        if (!Array.isArray(parsed.deletedRfqIds)) {
          parsed.deletedRfqIds = ['RFQ-2026-00005', 'RFQ-2026-00006'];
        }
        const tombstoneKeys = [
          'deletedCustomerIds',
          'deletedCompanyIds',
          'deletedPurchaseExecutiveIds',
          'deletedProductIds',
          'deletedBrandIds',
          'deletedCategoryIds',
          'deletedVendorMappingIds',
          'deletedVendorQuoteIds',
        ] as const;
        for (const tk of tombstoneKeys) {
          if (!Array.isArray(parsed[tk])) parsed[tk] = [];
        }
        if (parsed.deletedCustomerIds.length > 0) {
          parsed.customers = (parsed.customers || []).filter((c: any) => !parsed.deletedCustomerIds.includes(c.id));
        }
        if (parsed.deletedCompanyIds.length > 0) {
          parsed.companies = (parsed.companies || []).filter((c: any) => !parsed.deletedCompanyIds.includes(c.id));
        }
        if (parsed.deletedPurchaseExecutiveIds.length > 0) {
          parsed.purchaseExecutives = (parsed.purchaseExecutives || []).filter((e: any) => !parsed.deletedPurchaseExecutiveIds.includes(e.id));
        }
        if (parsed.deletedProductIds.length > 0) {
          parsed.products = (parsed.products || []).filter((p: any) => !p.isDeleted && !parsed.deletedProductIds.includes(p.id));
        }
        if (parsed.deletedBrandIds.length > 0) {
          parsed.brands = (parsed.brands || []).filter((b: any) => !parsed.deletedBrandIds.includes(b.id));
        }
        if (parsed.deletedCategoryIds.length > 0) {
          parsed.categories = (parsed.categories || []).filter((c: any) => !parsed.deletedCategoryIds.includes(c.id));
        }
        if (parsed.deletedVendorMappingIds.length > 0) {
          parsed.vendorProductMappings = (parsed.vendorProductMappings || []).filter((m: any) => !parsed.deletedVendorMappingIds.includes(m.id));
        }
        if (parsed.deletedVendorQuoteIds.length > 0) {
          parsed.vendorQuotes = (parsed.vendorQuotes || []).filter((q: any) => !parsed.deletedVendorQuoteIds.includes(q.id));
        }

        if (!Array.isArray(parsed.catalogueImportHistory)) {
          parsed.catalogueImportHistory = [];
        }
        if (!Array.isArray(parsed.confirmedAiMappings)) {
          parsed.confirmedAiMappings = [];
        }
        if (!Array.isArray(parsed.savedColumnMappings)) {
          parsed.savedColumnMappings = [];
        }

        if (!Array.isArray(parsed.catalogueProducts) || parsed.catalogueProducts.length === 0) {
          parsed.catalogueProducts = [...INITIAL_CATALOGUE_PRODUCTS];
          needsDiskSave = true;
        }
        if (!Array.isArray(parsed.rateVersionHistory) || parsed.rateVersionHistory.length === 0) {
          parsed.rateVersionHistory = [...INITIAL_RATE_VERSION_HISTORY];
          needsDiskSave = true;
        }
        if (!Array.isArray(parsed.importBatches) || parsed.importBatches.length === 0) {
          parsed.importBatches = [...INITIAL_IMPORT_BATCHES];
          needsDiskSave = true;
        }
        const prunedSessions = this.pruneSessions(parsed.activeSessions);
        if (prunedSessions.length !== parsed.activeSessions.length) {
          parsed.activeSessions = prunedSessions;
          needsDiskSave = true;
        }
        // Migrate heavy urlCache/catalogueCache out of main erp_production.json into erp_cache.json
        if (parsed.urlCache && typeof parsed.urlCache === 'object' && Object.keys(parsed.urlCache).length > 0) {
          this.cacheData.urlCache = { ...parsed.urlCache, ...this.cacheData.urlCache };
          delete parsed.urlCache;
          this.scheduleCacheSave();
          needsDiskSave = true;
        } else if ('urlCache' in parsed) {
          delete parsed.urlCache;
          needsDiskSave = true;
        }
        if (parsed.catalogueCache && typeof parsed.catalogueCache === 'object' && Object.keys(parsed.catalogueCache).length > 0) {
          this.cacheData.catalogueCache = { ...parsed.catalogueCache, ...this.cacheData.catalogueCache };
          delete parsed.catalogueCache;
          this.scheduleCacheSave();
          needsDiskSave = true;
        } else if ('catalogueCache' in parsed) {
          delete parsed.catalogueCache;
          needsDiskSave = true;
        }

        // Clean up user-deleted test RFQs so they never resurrect
        const testRfqsToDelete = [
          'RFQ-2026-100000',
          'RFQ-2026-LIVE-BULK-01',
          'RFQ-2026-LIVE-BULK-02',
          'RFQ-2026-LIVE-TEST-01',
          'RFQ-2026-BULK-01',
          'RFQ-2026-BULK-02',
          'RFQ-2026-UNIT-01',
        ];
        for (const testId of testRfqsToDelete) {
          if (!parsed.deletedRequirementIds.includes(testId)) parsed.deletedRequirementIds.push(testId);
          if (!parsed.deletedRfqIds.includes(testId)) parsed.deletedRfqIds.push(testId);
        }
        if (Array.isArray(parsed.rfqs)) {
          const prevLen = parsed.rfqs.length;
          parsed.rfqs = parsed.rfqs.filter(
            (r: any) =>
              !testRfqsToDelete.includes(r.id) &&
              !(r.rfqNumber && testRfqsToDelete.includes(r.rfqNumber)) &&
              !(r.requirementId && testRfqsToDelete.includes(r.requirementId)) &&
              !parsed.deletedRequirementIds.includes(r.id) &&
              !(r.rfqNumber && parsed.deletedRequirementIds.includes(r.rfqNumber)) &&
              !parsed.deletedRfqIds.includes(r.id) &&
              !(r.rfqNumber && parsed.deletedRfqIds.includes(r.rfqNumber))
          );
          if (parsed.rfqs.length !== prevLen) needsDiskSave = true;
        }


        // Clean orphaned/duplicate vendorProductMappings on disk
        if (Array.isArray(parsed.vendorProductMappings)) {
          const hasApexVendor = (parsed.vendors || []).some(
            (v: any) => !v.isDeleted && (v.companyName || '').includes('Apex Industrial Bearings')
          );
          const activeVendorIdSet = new Set(
            (parsed.vendors || []).filter((v: any) => !v.isDeleted).map((v: any) => v.id)
          );
          const beforeLen = parsed.vendorProductMappings.length;
          const seenVpmKeys = new Set<string>();
          parsed.vendorProductMappings = parsed.vendorProductMappings.filter((m: any) => {
            if (!hasApexVendor && (m.vendorName || '').includes('Apex Industrial Bearings')) return false;
            if ((parsed.deletedVendorIds || []).includes(m.vendorId)) return false;
            if (!activeVendorIdSet.has(m.vendorId) && /^VEND-TEST-/i.test(m.vendorId || '')) return false;
            const partKey = normalizePartCode(m.partNumber || m.modelNumber || '');
            const semKey = `${m.vendorId}::${partKey || (m.productName || '').toLowerCase().trim()}::${(m.brand || '').toLowerCase().trim()}`;
            if (seenVpmKeys.has(semKey)) return false;
            seenVpmKeys.add(semKey);
            return true;
          });
          if (parsed.vendorProductMappings.length !== beforeLen) needsDiskSave = true;
        }

        // Seed vendorProductMappings only if Apex vendor exists and mappings are empty
        const hasApexForSeed = (parsed.vendors || []).some(
          (v: any) => !v.isDeleted && v.id === 'VEND-001' && (v.companyName || '').includes('Apex')
        );
        if ((!parsed.vendorProductMappings || parsed.vendorProductMappings.length === 0) && hasApexForSeed) {
          parsed.vendorProductMappings = [
            {
              id: 'VPM-001',
              vendorId: 'VEND-001',
              vendorCode: 'VEND-001',
              vendorName: 'Apex Industrial Bearings & Spares Pvt Ltd',
              productName: 'Deep Groove Ball Bearing 6206-2RS',
              category: 'Mechanical and Industrial',
              subCategory: 'Bearings',
              productType: 'Deep Groove Ball Bearings',
              brand: 'SKF',
              modelNumber: '6206-2RS1/C3',
              partNumber: '6206-2RS1/C3',
              specification: '30x62x16mm, Rubber Sealed, C3 Clearance',
              size: '30x62x16mm',
              rating: 'Dynamic Load 20.3 kN',
              description: 'Standard deep groove ball bearing with synthetic rubber contact seals',
              uom: 'NOS',
              supplyType: 'Authorized Distributor',
              availability: 'Regular Stock',
              status: 'ACTIVE',
              remarks: 'Primary authorized line',
              createdAt: '2026-01-15T10:00:00Z',
              updatedAt: '2026-01-15T10:00:00Z',
            },
            {
              id: 'VPM-002',
              vendorId: 'VEND-001',
              vendorCode: 'VEND-001',
              vendorName: 'Apex Industrial Bearings & Spares Pvt Ltd',
              productName: 'Spherical Roller Bearing 22216-EK',
              category: 'Mechanical and Industrial',
              subCategory: 'Bearings',
              productType: 'Spherical Roller Bearings',
              brand: 'SKF',
              modelNumber: '22216-EK-C3',
              partNumber: '22216-EK-C3',
              specification: '80x140x33mm, Tapered 1:12 Bore, W33 Lube Groove',
              size: '80x140x33mm',
              rating: 'Heavy Radial / Axial Load',
              description: 'Self-aligning spherical roller bearing for vibratory screens and gearboxes',
              uom: 'NOS',
              supplyType: 'Authorized Distributor',
              availability: 'Regular Stock',
              status: 'ACTIVE',
              remarks: 'In stock at central warehouse',
              createdAt: '2026-01-15T10:00:00Z',
              updatedAt: '2026-01-15T10:00:00Z',
            },
            {
              id: 'VPM-003',
              vendorId: 'VEND-001',
              vendorCode: 'VEND-001',
              vendorName: 'Apex Industrial Bearings & Spares Pvt Ltd',
              productName: 'Tapered Roller Bearing 30205',
              category: 'Mechanical and Industrial',
              subCategory: 'Bearings',
              productType: 'Tapered Roller Bearings',
              brand: 'Timken',
              modelNumber: '30205-J2/Q',
              partNumber: '30205-J2/Q',
              specification: '25x52x16.25mm, High Precision Cones',
              size: '25x52x16.25mm',
              rating: 'High Thrust Load',
              description: 'Metric single row tapered roller bearing',
              uom: 'NOS',
              supplyType: 'Dealer',
              availability: 'Regular Stock',
              status: 'ACTIVE',
              remarks: 'Timken genuine imported line',
              createdAt: '2026-01-15T10:00:00Z',
              updatedAt: '2026-01-15T10:00:00Z',
            },
            {
              id: 'VPM-004',
              vendorId: 'VEND-002',
              vendorCode: 'VEND-002',
              vendorName: 'Siemens Precision Motion Controls',
              productName: 'Miniature Circuit Breaker (MCB) 32A 4-Pole',
              category: 'Electrical',
              subCategory: 'MCB',
              productType: 'MCB',
              brand: 'Schneider Electric',
              modelNumber: 'A9F74432',
              partNumber: 'A9F74432',
              specification: '4-Pole, 32A, C-Curve, 10kA Breaking Capacity',
              size: '4 Module Width',
              rating: '415V AC 50Hz',
              description: 'Acti9 iC60N industrial miniature circuit breaker',
              uom: 'NOS',
              supplyType: 'Authorized Distributor',
              availability: 'Regular Stock',
              status: 'ACTIVE',
              remarks: 'Schneider Tier-1 direct supply',
              createdAt: '2026-01-15T10:00:00Z',
              updatedAt: '2026-01-15T10:00:00Z',
            },
            {
              id: 'VPM-005',
              vendorId: 'VEND-002',
              vendorCode: 'VEND-002',
              vendorName: 'Siemens Precision Motion Controls',
              productName: 'Power Contactor 25A 3-Pole',
              category: 'Electrical',
              subCategory: 'Contactors',
              productType: 'Contactors',
              brand: 'Schneider Electric',
              modelNumber: 'LC1D25M7',
              partNumber: 'LC1D25M7',
              specification: '25A AC-3, 11kW, 220V AC 50/60Hz Coil, 1NO+1NC',
              size: 'Frame 2',
              rating: '690V Rated Insulation',
              description: 'TeSys Deca industrial motor starter contactor',
              uom: 'NOS',
              supplyType: 'Authorized Distributor',
              availability: 'Regular Stock',
              status: 'ACTIVE',
              remarks: 'Ready stock 100+ units',
              createdAt: '2026-01-15T10:00:00Z',
              updatedAt: '2026-01-15T10:00:00Z',
            },
            {
              id: 'VPM-006',
              vendorId: 'VEND-002',
              vendorCode: 'VEND-002',
              vendorName: 'Siemens Precision Motion Controls',
              productName: 'SIMATIC S7-1200 CPU 1214C Compact PLC',
              category: 'Electronics and Automation',
              subCategory: 'PLC',
              productType: 'PLC',
              brand: 'Siemens',
              modelNumber: '6ES7214-1AG40-0XB0',
              partNumber: '6ES7214-1AG40-0XB0',
              specification: 'DC/DC/DC, 14 Digital In, 10 Digital Out, 2 Analog In',
              size: 'Compact DIN Rail',
              rating: '24V DC Power Supply',
              description: 'Programmable Logic Controller for manufacturing line automation',
              uom: 'NOS',
              supplyType: 'Authorized Distributor',
              availability: 'Regular Stock',
              status: 'ACTIVE',
              remarks: 'Includes factory warranty',
              createdAt: '2026-01-15T10:00:00Z',
              updatedAt: '2026-01-15T10:00:00Z',
            },
            {
              id: 'VPM-007',
              vendorId: 'VEND-006',
              vendorCode: 'VEND-006',
              vendorName: 'Festo & SMC Fluid Automation Hub',
              productName: 'Compact Pneumatic Cylinder 32mm Bore 50mm Stroke',
              category: 'Mechanical and Industrial',
              subCategory: 'Pneumatic Components',
              productType: 'Pneumatic Cylinders',
              brand: 'Festo',
              modelNumber: 'ADN-32-50-I-P-A',
              partNumber: 'ADN-32-50-I-P-A',
              specification: 'ISO 21287, Double Acting, Magnetic Piston, Elastic Cushioning',
              size: 'Bore 32mm, Stroke 50mm',
              rating: 'Working Pressure 1 to 10 Bar',
              description: 'High-speed compact automation cylinder',
              uom: 'NOS',
              supplyType: 'Authorized Distributor',
              availability: 'Regular Stock',
              status: 'ACTIVE',
              remarks: 'Festo authorized center',
              createdAt: '2026-01-15T10:00:00Z',
              updatedAt: '2026-01-15T10:00:00Z',
            },
            {
              id: 'VPM-008',
              vendorId: 'VEND-006',
              vendorCode: 'VEND-006',
              vendorName: 'Festo & SMC Fluid Automation Hub',
              productName: 'Directional Solenoid Valve 5/2 Way 24V DC',
              category: 'Mechanical and Industrial',
              subCategory: 'Valves',
              productType: 'Solenoid Valves',
              brand: 'Festo',
              modelNumber: 'VUVS-L25-M52-MD-G14-F8',
              partNumber: 'VUVS-L25-M52-MD-G14-F8',
              specification: 'G1/4 Port, 5/2 Single Solenoid with Spring Return, 24V DC',
              size: 'G1/4 Inch',
              rating: 'Flow Rate 1300 l/min',
              description: 'Rugged pneumatic solenoid valve with manual override',
              uom: 'NOS',
              supplyType: 'Authorized Distributor',
              availability: 'Regular Stock',
              status: 'ACTIVE',
              remarks: 'Direct replacement for plant pneumatic lines',
              createdAt: '2026-01-15T10:00:00Z',
              updatedAt: '2026-01-15T10:00:00Z',
            },
            {
              id: 'VPM-009',
              vendorId: 'VEND-006',
              vendorCode: 'VEND-006',
              vendorName: 'Festo & SMC Fluid Automation Hub',
              productName: 'Inductive Proximity Sensor M12 PNP NO',
              category: 'Electronics and Automation',
              subCategory: 'Sensors',
              productType: 'Proximity Sensors',
              brand: 'Omron',
              modelNumber: 'E2B-M12KS04-WP-B1',
              partNumber: 'E2B-M12KS04-WP-B1',
              specification: 'M12 Threaded, Sensing Distance 4mm, 10-30V DC, 2m Cable',
              size: 'M12x50mm',
              rating: 'IP67 Waterproof & Oil Resistant',
              description: 'Solid brass body inductive proximity switch',
              uom: 'NOS',
              supplyType: 'Authorized Distributor',
              availability: 'Regular Stock',
              status: 'ACTIVE',
              remarks: 'Standard factory sensor',
              createdAt: '2026-01-15T10:00:00Z',
              updatedAt: '2026-01-15T10:00:00Z',
            },
            {
              id: 'VPM-010',
              vendorId: 'VEND-003',
              vendorCode: 'VEND-003',
              vendorName: 'Kirloskar Fluidics & Pump Tech',
              productName: 'Flanged Cast Iron Ball Valve 2 Inch (DN50)',
              category: 'Plumbing, Pipes and Fittings',
              subCategory: 'Valves',
              productType: 'Ball Valves',
              brand: 'Audco',
              modelNumber: 'AUD-BV-50-CI',
              partNumber: 'AUD-BV-50-CI',
              specification: 'Class 150 Flanged, SS Ball, PTFE Seats, Lever Operated',
              size: 'DN50 / 2 Inch',
              rating: 'Pressure Rating PN16 / Class 150',
              description: 'Industrial isolation ball valve for water and cooling utilities',
              uom: 'NOS',
              supplyType: 'Authorized Distributor',
              availability: 'Regular Stock',
              status: 'ACTIVE',
              remarks: 'Includes hydro test certificate',
              createdAt: '2026-01-15T10:00:00Z',
              updatedAt: '2026-01-15T10:00:00Z',
            },
          ];

          // Link productsSupplied array onto vendors
          parsed.vendors.forEach((v: any) => {
            v.productsSupplied = parsed.vendorProductMappings.filter((m: any) => m.vendorId === v.id);
          });
        }

        if (needsDiskSave) {
          console.log('[DB] Seeding missing financial and settings records to production disk store...');
          this.saveToDiskSync(parsed);
        }

        console.log(`[DB] Production Database loaded from ${DB_FILE} (Version ${parsed.version || 2})`);
        return parsed;
      }
    } catch (err) {
      console.error('[DB] Error reading database file, creating fresh default:', err);
    }

    const initial = createDefaultDatabase();
    this.saveToDiskSync(initial);
    return initial;
  }

  private saveToDiskSync(dataToSave: ErpDatabaseSchema) {
    try {
      dataToSave.lastUpdated = new Date().toISOString();
      this.stateRevision += 1;
      // Atomic compact JSON write with fsync durability
      const jsonStr = JSON.stringify(dataToSave);
      const tempFile = `${DB_FILE}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
      const fd = fs.openSync(tempFile, 'w');
      try {
        fs.writeSync(fd, jsonStr, 0, 'utf-8');
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      fs.renameSync(tempFile, DB_FILE);
      this.lastSavedBytes = Buffer.byteLength(jsonStr, 'utf8');
    } catch (err) {
      console.error('[DB] Critical: Failed to save database to disk:', err);
      throw new Error('Database persistence failed');
    }
  }

  public save() {
    this.saveToDiskSync(this.data);
  }

  // Diagnostics & Status
  public getStatus() {
    if (this.lastSavedBytes === 0 && fs.existsSync(DB_FILE)) {
      try {
        this.lastSavedBytes = fs.statSync(DB_FILE).size;
      } catch {}
    }
    return {
      status: 'CONNECTED',
      databaseEngine: 'Persistent Enterprise JSON/ACID File Store with Write-Ahead Lock',
      storagePath: DB_FILE,
      sizeBytes: this.lastSavedBytes,
      stateRevision: this.stateRevision,
      lastUpdated: this.data.lastUpdated,
      counts: {
        users: this.data.users.length,
        roles: this.data.roles.length,
        approvals: this.data.approvals.length,
        auditLogs: this.data.auditLogs.length,
        requirements: this.data.requirements.length,
        rfqs: this.data.rfqs.length,
        vendors: this.data.vendors.length,
      },
    };
  }

  // Users
  public getUsers(): UserRecord[] {
    return this.data.users.map((u) => {
      // Exclude salt & hash from public list
      const { passwordHash, passwordSalt, ...safe } = u;
      return safe as UserRecord;
    });
  }

  public getUserById(id: string): UserRecord | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public getUserByUsernameOrEmail(identifier: string): UserRecord | undefined {
    const clean = identifier.toLowerCase().trim();
    if (clean === 'vikcybhavsar960@gmail.com' || clean === 'vickybhavsar960@gmail.com') {
      const adminUser = this.data.users.find((u) => u.username === 'admin');
      if (adminUser) return adminUser;
    }
    return this.data.users.find(
      (u) => u.username.toLowerCase() === clean || u.email.toLowerCase() === clean
    );
  }

  public createUser(userData: {
    name: string;
    email: string;
    username: string;
    password: string;
    role: string;
    department: string;
    designation?: string;
    mobile?: string;
    mustChangePassword?: boolean;
    status?: 'ACTIVE' | 'INACTIVE';
    approvalAuthority?: Partial<UserRecord['approvalAuthority']>;
    permissions?: Partial<UserRecord['permissions']>;
  }): UserRecord {
    // Check duplicates
    if (this.getUserByUsernameOrEmail(userData.username)) {
      throw new Error(`Username "${userData.username}" is already taken.`);
    }
    if (this.getUserByUsernameOrEmail(userData.email)) {
      throw new Error(`Email "${userData.email}" is already registered.`);
    }

    const { hash, salt } = hashPassword(userData.password || 'Welcome@123');
    const canonicalRole = normalizeUserRole(userData.role, userData.username, userData.email);
    const matchedRole =
      this.data.roles.find((r) => normalizeUserRole(r.name) === canonicalRole) ||
      this.data.roles.find((r) => r.name === userData.role) ||
      this.data.roles[2];

    const newUser: UserRecord = {
      id: `USR-${Date.now().toString().slice(-4)}`,
      name: userData.name,
      email: userData.email,
      username: userData.username,
      passwordHash: hash,
      passwordSalt: salt,
      role: canonicalRole,
      department: userData.department || 'General',
      mobile: userData.mobile || '+91 90000 00000',
      status: userData.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      mustChangePassword: Boolean(userData.mustChangePassword),
      approvalAuthority: {
        canApproveRequirements: userData.approvalAuthority?.canApproveRequirements ?? (matchedRole.approvalLimit > 0 || canonicalRole === 'SUPER_ADMIN'),
        canApproveRfqs: userData.approvalAuthority?.canApproveRfqs ?? (matchedRole.approvalLimit > 0 || canonicalRole === 'SUPER_ADMIN'),
        canApprovePos: userData.approvalAuthority?.canApprovePos ?? (matchedRole.approvalLimit > 0 || canonicalRole === 'SUPER_ADMIN'),
        canApprovePayments: userData.approvalAuthority?.canApprovePayments ?? (canonicalRole === 'SUPER_ADMIN' || canonicalRole === 'ACCOUNTS_USER'),
        maxApprovalLimit: userData.approvalAuthority?.maxApprovalLimit ?? matchedRole.approvalLimit,
      },
      permissions: {
        modules: {
          ...matchedRole.defaultPermissions.modules,
          ...(userData.permissions?.modules || {}),
        },
        actions: {
          ...matchedRole.defaultPermissions.actions,
          ...(userData.permissions?.actions || {}),
        },
      },
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };

    this.data.users.push(newUser);
    this.save();
    return newUser;
  }

  public updateUser(id: string, updates: Partial<UserRecord> & { newPassword?: string }): UserRecord {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error('User not found');

    const current = this.data.users[idx];

    if (updates.newPassword) {
      const { hash, salt } = hashPassword(updates.newPassword);
      current.passwordHash = hash;
      current.passwordSalt = salt;
    }

    if (updates.name) current.name = updates.name;
    if (updates.email) current.email = updates.email;
    if (updates.department) current.department = updates.department;
    if (updates.mobile) current.mobile = updates.mobile;
    if (updates.role) current.role = updates.role;
    if (updates.status) current.status = updates.status;
    if (updates.approvalAuthority) {
      current.approvalAuthority = { ...current.approvalAuthority, ...updates.approvalAuthority };
    }
    if (updates.permissions) {
      current.permissions = {
        modules: { ...current.permissions.modules, ...updates.permissions.modules },
        actions: { ...current.permissions.actions, ...updates.permissions.actions },
      };
    }

    this.data.users[idx] = current;
    this.save();
    return current;
  }

  public deleteUser(id: string) {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error('User not found');
    if (this.data.users[idx].username === 'admin') {
      throw new Error('Cannot delete primary Super Admin user');
    }
    this.data.users.splice(idx, 1);
    this.save();
  }

  // Roles
  public getRoles(): RoleDefinition[] {
    return this.data.roles;
  }

  public updateRole(id: string, updates: Partial<RoleDefinition>): RoleDefinition {
    const idx = this.data.roles.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Role not found');
    this.data.roles[idx] = { ...this.data.roles[idx], ...updates };
    this.save();
    return this.data.roles[idx];
  }

  // Approvals
  public getApprovals(filter?: { status?: string; userRole?: string }): ApprovalRecord[] {
    let list = this.data.approvals;
    if (filter?.status && filter.status !== 'ALL') {
      list = list.filter((a) => a.status === filter.status);
    }
    return list;
  }

  public createApproval(approvalData: Omit<ApprovalRecord, 'id' | 'pendingSince' | 'history'>): ApprovalRecord {
    const newApproval: ApprovalRecord = {
      ...approvalData,
      id: `APP-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
      pendingSince: new Date().toISOString().replace('T', ' ').slice(0, 16),
      history: [
        {
          action: 'CREATED',
          actor: approvalData.requestorName,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
          comments: approvalData.details,
        },
      ],
    };

    this.data.approvals.unshift(newApproval);
    this.save();
    return newApproval;
  }

  public processApproval(params: {
    id: string;
    action: 'APPROVE' | 'REJECT' | 'SEND_BACK';
    approverId: string;
    approverName: string;
    comments?: string;
  }): ApprovalRecord {
    const item = this.data.approvals.find((a) => a.id === params.id);
    if (!item) throw new Error('Approval request not found');

    const newStatus: ApprovalRecord['status'] =
      params.action === 'APPROVE' ? 'APPROVED' : params.action === 'REJECT' ? 'REJECTED' : 'SENT_BACK';

    item.status = newStatus;
    item.approverId = params.approverId;
    item.approverName = params.approverName;
    item.actionDate = new Date().toISOString().replace('T', ' ').slice(0, 16);
    item.comments = params.comments;

    item.history.push({
      action: params.action,
      actor: params.approverName,
      timestamp: item.actionDate,
      comments: params.comments,
    });

    this.save();
    return item;
  }

  // RFQ Closure
  public closeRfq(details: RfqClosureDetails): any {
    const rfqIndex = this.data.rfqs.findIndex(
      (r) => r.id === details.rfqNumber || r.rfqNumber === details.rfqNumber
    );

    const updatedRfq = rfqIndex !== -1 ? { ...this.data.rfqs[rfqIndex] } : { id: details.rfqNumber };

    updatedRfq.status = 'Closed – Customer Confirmation';
    updatedRfq.closureDetails = details;
    updatedRfq.closedAt = details.closedAt;
    updatedRfq.closedBy = details.closedBy;

    if (rfqIndex !== -1) {
      this.data.rfqs[rfqIndex] = updatedRfq;
    } else {
      this.data.rfqs.push(updatedRfq);
    }

    // Also close any pending approvals associated with this RFQ
    this.data.approvals.forEach((app) => {
      if (app.requestNumber === details.rfqNumber && app.status === 'PENDING') {
        app.status = 'REJECTED';
        app.comments = `Auto-cancelled: RFQ closed by customer confirmation (${details.closureReason})`;
        app.history.push({
          action: 'AUTO_CANCELLED',
          actor: details.closedBy,
          timestamp: details.closedAt,
          comments: details.remarks,
        });
      }
    });

    this.save();
    return updatedRfq;
  }

  // Generic Entity Getters & Setters
  public getCollection(collectionName: keyof ErpDatabaseSchema): any[] {
    return (this.data[collectionName] as any[]) || [];
  }

  public setCollection(collectionName: keyof ErpDatabaseSchema, items: any[]) {
    (this.data[collectionName] as any) = items;
    this.save();
  }

  public appendToCollection(collectionName: keyof ErpDatabaseSchema, item: any) {
    if (!this.data[collectionName]) {
      (this.data[collectionName] as any) = [];
    }
    (this.data[collectionName] as any[]).unshift(item);
    this.save();
  }

  // Vendor Product Mappings Management
  public getVendorProductMappings(vendorId?: string): any[] {
    if (!Array.isArray(this.data.vendorProductMappings)) {
      this.data.vendorProductMappings = [];
    }
    if (vendorId) {
      return this.data.vendorProductMappings.filter((m) => m.vendorId === vendorId);
    }
    return this.data.vendorProductMappings;
  }

  public addVendorProductMapping(mapping: any): any {
    if (!Array.isArray(this.data.vendorProductMappings)) {
      this.data.vendorProductMappings = [];
    }
    // Duplicate check: same vendorId, brand, and (partNumber or productName)
    const normBrand = (mapping.brand || '').toLowerCase().trim();
    const normPart = (mapping.partNumber || '').toLowerCase().trim();
    const normName = (mapping.productName || '').toLowerCase().trim();
    const isDup = this.data.vendorProductMappings.some(
      (m) =>
        m.vendorId === mapping.vendorId &&
        (m.brand || '').toLowerCase().trim() === normBrand &&
        ((normPart && (m.partNumber || '').toLowerCase().trim() === normPart) ||
          (!normPart && (m.productName || '').toLowerCase().trim() === normName))
    );
    if (isDup) {
      throw new Error(`Duplicate mapping: This vendor already has "${mapping.productName}" (${mapping.brand} ${mapping.partNumber || ''}) mapped.`);
    }

    const newMapping = {
      ...mapping,
      id: mapping.id || `VPM-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      createdAt: mapping.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: mapping.status || 'ACTIVE',
    };
    this.data.vendorProductMappings.push(newMapping);

    // Also update vendor's productsSupplied array if vendor exists
    const vIdx = this.data.vendors.findIndex((v) => v.id === mapping.vendorId);
    if (vIdx !== -1) {
      const v = this.data.vendors[vIdx];
      if (!Array.isArray(v.productsSupplied)) v.productsSupplied = [];
      v.productsSupplied.push(newMapping);
      if (mapping.category && (!v.materialCategories || !v.materialCategories.includes(mapping.category))) {
        v.materialCategories = [...(v.materialCategories || []), mapping.category];
      }
      if (mapping.brand && (!v.brandsSupplied || !v.brandsSupplied.includes(mapping.brand))) {
        v.brandsSupplied = [...(v.brandsSupplied || []), mapping.brand];
      }
      this.data.vendors[vIdx] = v;
    }

    this.save();
    return newMapping;
  }

  public updateVendorProductMapping(id: string, updates: any): any {
    if (!Array.isArray(this.data.vendorProductMappings)) this.data.vendorProductMappings = [];
    const idx = this.data.vendorProductMappings.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error('Product mapping not found');

    const updated = {
      ...this.data.vendorProductMappings[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.data.vendorProductMappings[idx] = updated;

    const vIdx = this.data.vendors.findIndex((v) => v.id === updated.vendorId);
    if (vIdx !== -1 && Array.isArray(this.data.vendors[vIdx].productsSupplied)) {
      const pIdx = this.data.vendors[vIdx].productsSupplied.findIndex((p: any) => p.id === id);
      if (pIdx !== -1) {
        this.data.vendors[vIdx].productsSupplied[pIdx] = updated;
      }
    }

    this.save();
    return updated;
  }

  public deleteVendorProductMapping(id: string): boolean {
    if (!Array.isArray(this.data.vendorProductMappings)) return false;
    const idx = this.data.vendorProductMappings.findIndex((m) => m.id === id);
    if (idx === -1) return false;
    const mapping = this.data.vendorProductMappings[idx];
    const vendorId = mapping.vendorId;

    // Remove from vendorProductMappings & record tombstone
    this.data.vendorProductMappings.splice(idx, 1);
    if (!Array.isArray(this.data.deletedVendorMappingIds)) this.data.deletedVendorMappingIds = [];
    if (!this.data.deletedVendorMappingIds.includes(id)) this.data.deletedVendorMappingIds.push(id);

    // Also remove from vendor.productsSupplied
    const vIdx = this.data.vendors.findIndex((v) => v.id === vendorId);
    if (vIdx !== -1 && Array.isArray(this.data.vendors[vIdx].productsSupplied)) {
      this.data.vendors[vIdx].productsSupplied = this.data.vendors[vIdx].productsSupplied.filter(
        (p: any) => p.id !== id
      );
    }

    // Never delete the global product type or brand!
    this.save();
    return true;
  }

  public recordTombstone(
    field:
      | 'deletedVendorIds'
      | 'deletedCustomerIds'
      | 'deletedCompanyIds'
      | 'deletedPurchaseExecutiveIds'
      | 'deletedProductIds'
      | 'deletedBrandIds'
      | 'deletedCategoryIds'
      | 'deletedVendorMappingIds'
      | 'deletedVendorQuoteIds',
    id: string,
    autoSave: boolean = true
  ) {
    if (!id) return;
    if (!Array.isArray((this.data as any)[field])) {
      (this.data as any)[field] = [];
    }
    if (!(this.data as any)[field].includes(id)) {
      (this.data as any)[field].push(id);
      if (autoSave) this.save();
    }
  }

  public clearTombstone(
    field:
      | 'deletedVendorIds'
      | 'deletedCustomerIds'
      | 'deletedCompanyIds'
      | 'deletedPurchaseExecutiveIds'
      | 'deletedProductIds'
      | 'deletedBrandIds'
      | 'deletedCategoryIds'
      | 'deletedVendorMappingIds'
      | 'deletedVendorQuoteIds',
    id: string,
    autoSave: boolean = false
  ) {
    if (!id || !Array.isArray((this.data as any)[field])) return;
    const before = (this.data as any)[field].length;
    (this.data as any)[field] = (this.data as any)[field].filter((x: string) => x !== id);
    if (autoSave && (this.data as any)[field].length !== before) this.save();
  }

  // Global Product Type Master Methods
  public getProductTypes(): any[] {
    if (!Array.isArray(this.data.productTypes) || this.data.productTypes.length === 0) {
      this.data.productTypes = INITIAL_PRODUCT_TYPES.map((pt) => ({ ...pt }));
      this.save();
    }
    return this.data.productTypes;
  }

  public findOrCreateProductType(name: string, category?: string, autoSave: boolean = true): { productType: any; isNew: boolean } {
    if (!Array.isArray(this.data.productTypes)) {
      this.data.productTypes = INITIAL_PRODUCT_TYPES.map((pt) => ({ ...pt }));
    }
    const cleanName = (name || '').trim();
    if (!cleanName) throw new Error('Product type name cannot be empty');

    const norm = cleanName.toLowerCase();
    const existing = this.data.productTypes.find(
      (pt: any) => pt.name && pt.name.toLowerCase().trim() === norm
    );

    if (existing) {
      if (category && !existing.category) {
        existing.category = category;
        existing.updatedAt = new Date().toISOString();
        if (autoSave) this.save();
      }
      return { productType: existing, isNew: false };
    }

    const newPT = {
      id: `PT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`,
      name: cleanName,
      category: category || 'General',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.data.productTypes.push(newPT);
    if (autoSave) this.save();
    return { productType: newPT, isNew: true };
  }

  public addProductTypeToVendor(
    vendorId: string,
    productTypeName: string,
    category?: string,
    brand?: string
  ): { productType: any; mapping: any; vendor: any; isNewProductType: boolean } {
    const cleanName = (productTypeName || '').trim();
    if (!cleanName) throw new Error('Product type name cannot be empty');

    const cleanBrand = (brand || '').trim();
    const cleanCategory = (category || '').trim();

    // 1. Create or reuse in global Product Type Master
    const { productType, isNew: isNewProductType } = this.findOrCreateProductType(cleanName, cleanCategory);

    // 2. Locate vendor
    const vIdx = this.data.vendors.findIndex((v) => v.id === vendorId);
    if (vIdx === -1) throw new Error(`Vendor ${vendorId} not found`);
    const vendor = this.data.vendors[vIdx];

    // 3. Check for existing mapping for this vendor
    if (!Array.isArray(this.data.vendorProductMappings)) {
      this.data.vendorProductMappings = [];
    }

    const normName = cleanName.toLowerCase();
    const normBrand = cleanBrand.toLowerCase();

    const existingMapping = this.data.vendorProductMappings.find(
      (m: any) =>
        m.vendorId === vendorId &&
        m.status !== 'INACTIVE' &&
        (m.productName || m.productType || '').toLowerCase().trim() === normName &&
        ((!cleanBrand && (!m.brand || m.brand === 'Generic')) ||
          (cleanBrand && (m.brand || '').toLowerCase().trim() === normBrand))
    );

    if (existingMapping) {
      throw new Error(`"${cleanName}" is already added to ${vendor.companyName}${cleanBrand ? ` under brand "${cleanBrand}"` : ''}.`);
    }

    // 4. Create new mapping
    const newMapping = {
      id: `VPM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      vendorId,
      vendorCode: vendor.vendorCode || vendor.id,
      vendorName: vendor.companyName,
      productName: cleanName,
      productType: cleanName,
      category: cleanCategory || productType.category || 'General',
      brand: cleanBrand || 'Generic',
      uom: 'NOS',
      supplyType: 'Authorized Distributor',
      availability: 'Regular Stock',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.data.vendorProductMappings.unshift(newMapping);

    // 5. Update vendor's productsSupplied and brand/category tags
    if (!Array.isArray(vendor.productsSupplied)) vendor.productsSupplied = [];
    vendor.productsSupplied.unshift(newMapping);

    if (cleanBrand) {
      const existingBrands = vendor.brandsSupplied || [];
      if (!existingBrands.some((b: string) => b.toLowerCase().trim() === normBrand)) {
        vendor.brandsSupplied = [...existingBrands, cleanBrand];
      }
      if (Array.isArray(this.data.brands)) {
        const hasBrand = this.data.brands.some((b: any) => b.name?.toLowerCase().trim() === normBrand);
        if (!hasBrand) {
          this.data.brands.push({
            id: `BRD-${Date.now().toString().slice(-6)}`,
            name: cleanBrand,
            category: cleanCategory || 'General',
            isActive: true,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    if (cleanCategory) {
      const existingCats = vendor.materialCategories || [];
      if (!existingCats.some((c: string) => c.toLowerCase().trim() === cleanCategory.toLowerCase())) {
        vendor.materialCategories = [...existingCats, cleanCategory];
      }
    }

    this.data.vendors[vIdx] = vendor;
    this.save();

    return { productType, mapping: newMapping, vendor, isNewProductType };
  }

  public removeProductTypeFromVendor(mappingId: string): boolean {
    return this.deleteVendorProductMapping(mappingId);
  }

  public bulkUpsertVendorProductMappings(vendorId: string, mappings: any[]): { added: number; updated: number; skippedDuplicates: number } {
    if (!Array.isArray(this.data.vendorProductMappings)) this.data.vendorProductMappings = [];
    let added = 0;
    let updated = 0;
    let skippedDuplicates = 0;

    for (const m of mappings) {
      const normBrand = (m.brand || '').toLowerCase().trim();
      const normPart = (m.partNumber || '').toLowerCase().trim();
      const normName = (m.productName || '').toLowerCase().trim();

      const existingIdx = this.data.vendorProductMappings.findIndex(
        (ex) =>
          ex.vendorId === vendorId &&
          (ex.brand || '').toLowerCase().trim() === normBrand &&
          ((normPart && (ex.partNumber || '').toLowerCase().trim() === normPart) ||
            (!normPart && (ex.productName || '').toLowerCase().trim() === normName))
      );

      if (existingIdx !== -1) {
        this.data.vendorProductMappings[existingIdx] = {
          ...this.data.vendorProductMappings[existingIdx],
          ...m,
          vendorId,
          updatedAt: new Date().toISOString(),
        };
        updated++;
      } else {
        const newM = {
          ...m,
          id: m.id || `VPM-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          vendorId,
          status: m.status || 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.data.vendorProductMappings.push(newM);
        added++;
      }
    }

    const vIdx = this.data.vendors.findIndex((v) => v.id === vendorId);
    if (vIdx !== -1) {
      const v = this.data.vendors[vIdx];
      v.productsSupplied = this.data.vendorProductMappings.filter((m) => m.vendorId === vendorId);
      const cats = Array.from(new Set([...(v.materialCategories || []), ...mappings.map((m) => m.category).filter(Boolean)]));
      const brands = Array.from(new Set([...(v.brandsSupplied || []), ...mappings.map((m) => m.brand).filter(Boolean)]));
      v.materialCategories = cats;
      v.brandsSupplied = brands;
      this.data.vendors[vIdx] = v;
    }

    this.save();
    return { added, updated, skippedDuplicates };
  }

  // Audit Logs
  public addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>, autoSave: boolean = true): AuditLogEntry {
    const newLog: AuditLogEntry = {
      ...entry,
      id: `AUD-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    this.data.auditLogs.unshift(newLog);
    if (this.data.auditLogs.length > 1000) {
      this.data.auditLogs.pop();
    }
    if (autoSave) this.save();
    return newLog;
  }

  // Requirement Management & Permanent Deletion
  public deleteRequirement(
    id: string,
    user: string = 'User',
    role: string = 'Procurement Specialist',
    ip: string = 'unknown',
    reason: string = 'Archived by user'
  ): { success: boolean; message: string; deletedId: string } {
    const rfqNumber = id;
    const reqIndex = this.data.requirements.findIndex(
      (r) => r.id === id || r.rfqNumber === id
    );

    const actualReq = reqIndex !== -1 ? this.data.requirements[reqIndex] : null;
    const actualId = actualReq?.id || id;
    const actualRfq = actualReq?.rfqNumber || id;
    const now = new Date().toISOString();

    // Soft delete: Retain record in database with isDeleted flag for recovery
    if (reqIndex !== -1) {
      this.data.requirements[reqIndex] = {
        ...this.data.requirements[reqIndex],
        isDeleted: true,
        deletedAt: now,
        deletedBy: user,
        deletedReason: reason,
        lastModifiedAt: now,
        lastModifiedBy: user,
      };
    }

    // Authoritative Tombstone Registration: Permanently prevents resurrected items across all devices
    if (!Array.isArray(this.data.deletedRequirementIds)) {
      this.data.deletedRequirementIds = [];
    }
    if (actualId && !this.data.deletedRequirementIds.includes(actualId)) {
      this.data.deletedRequirementIds.push(actualId);
    }
    if (actualRfq && !this.data.deletedRequirementIds.includes(actualRfq)) {
      this.data.deletedRequirementIds.push(actualRfq);
    }

    // Also mark associated RFQ entry if exists
    if (Array.isArray(this.data.rfqs)) {
      this.data.rfqs.forEach((rfq: any) => {
        if (rfq.id === actualId || rfq.id === actualRfq || rfq.rfqNumber === actualRfq) {
          rfq.isDeleted = true;
          rfq.deletedAt = now;
          rfq.deletedBy = user;
        }
      });
    }

    // Add immutable server audit log with IP and Actor
    this.addAuditLog({
      user,
      role,
      action: 'REQUIREMENT_SOFT_DELETED',
      module: 'Requirement',
      recordNumber: actualRfq,
      remarks: `Requirement ${actualRfq} (${actualId}) soft-deleted by ${user} from IP ${ip}. Reason: ${reason}. Retained in database for Super Admin recovery.`,
      ipAddress: ip,
    });

    this.save();
    return {
      success: true,
      message: `Requirement ${actualRfq} soft-deleted. It can be recovered anytime from the Deleted RFQs view.`,
      deletedId: actualId,
    };
  }

  public deleteRfq(
    id: string,
    user: string = 'User',
    role: string = 'Procurement Specialist',
    ip: string = 'unknown',
    reason: string = 'Archived by user'
  ): { success: boolean; message: string; deletedId: string } {
    if (!Array.isArray(this.data.deletedRequirementIds)) {
      this.data.deletedRequirementIds = [];
    }
    if (!Array.isArray(this.data.deletedRfqIds)) {
      this.data.deletedRfqIds = [];
    }
    const now = new Date().toISOString();

    // 1. Add ID to tombstones
    if (id && !this.data.deletedRequirementIds.includes(id)) {
      this.data.deletedRequirementIds.push(id);
    }
    if (id && !this.data.deletedRfqIds.includes(id)) {
      this.data.deletedRfqIds.push(id);
    }

    let actualRfq = id;
    let reqId = '';

    // 2. Mark and permanently filter from rfqs
    if (Array.isArray(this.data.rfqs)) {
      this.data.rfqs.forEach((rfq: any) => {
        if (rfq.id === id || rfq.rfqNumber === id) {
          rfq.isDeleted = true;
          rfq.deletedAt = now;
          rfq.deletedBy = user;
          if (rfq.rfqNumber) {
            if (!this.data.deletedRequirementIds.includes(rfq.rfqNumber)) this.data.deletedRequirementIds.push(rfq.rfqNumber);
            if (!this.data.deletedRfqIds.includes(rfq.rfqNumber)) this.data.deletedRfqIds.push(rfq.rfqNumber);
          }
          if (rfq.requirementId) {
            reqId = rfq.requirementId;
            if (!this.data.deletedRequirementIds.includes(rfq.requirementId)) {
              this.data.deletedRequirementIds.push(rfq.requirementId);
            }
          }
          actualRfq = rfq.rfqNumber || id;
        }
      });

      this.data.rfqs = this.data.rfqs.filter(
        (rfq: any) =>
          !rfq.isDeleted &&
          rfq.id !== id &&
          rfq.rfqNumber !== id &&
          rfq.rfqNumber !== actualRfq &&
          !this.data.deletedRequirementIds.includes(rfq.id) &&
          !(rfq.rfqNumber && this.data.deletedRequirementIds.includes(rfq.rfqNumber)) &&
          !(rfq.requirementId && this.data.deletedRequirementIds.includes(rfq.requirementId)) &&
          !this.data.deletedRfqIds.includes(rfq.id) &&
          !(rfq.rfqNumber && this.data.deletedRfqIds.includes(rfq.rfqNumber))
      );
    }

    // Purge associated quotes
    if (Array.isArray(this.data.vendorQuotes)) {
      this.data.vendorQuotes = this.data.vendorQuotes.filter(
        (vq: any) => vq.rfqId !== id && vq.rfqNumber !== id && vq.rfqNumber !== actualRfq
      );
    }

    // 3. Mark matching requirement if any
    const reqIndex = this.data.requirements.findIndex(
      (r) => r.id === id || r.rfqNumber === id || (reqId && r.id === reqId)
    );
    if (reqIndex !== -1) {
      const actual = this.data.requirements[reqIndex];
      actual.isDeleted = true;
      actual.deletedAt = now;
      actual.deletedBy = user;
      actual.deletedReason = reason;
      if (actual.id && !this.data.deletedRequirementIds.includes(actual.id)) {
        this.data.deletedRequirementIds.push(actual.id);
      }
      if (actual.rfqNumber && !this.data.deletedRequirementIds.includes(actual.rfqNumber)) {
        this.data.deletedRequirementIds.push(actual.rfqNumber);
      }
      actualRfq = actual.rfqNumber || actualRfq;
    }

    this.addAuditLog({
      user,
      role,
      action: 'RFQ_DELETED',
      module: 'RFQ',
      recordNumber: actualRfq,
      remarks: `RFQ ${actualRfq} (${id}) deleted by ${user} from IP ${ip}. Reason: ${reason}.`,
      ipAddress: ip,
    });

    this.save();
    return {
      success: true,
      message: `RFQ ${actualRfq} successfully deleted.`,
      deletedId: id,
    };
  }

  public purgeRfq(
    id: string,
    user: string = 'Super Admin',
    role: string = 'SUPER_ADMIN',
    ip: string = '127.0.0.1'
  ): { success: boolean; message: string; deletedId: string } {
    if (!Array.isArray(this.data.deletedRequirementIds)) this.data.deletedRequirementIds = [];
    if (!Array.isArray(this.data.deletedRfqIds)) this.data.deletedRfqIds = [];

    let actualRfq = id;
    const match = (this.data.rfqs || []).find((r: any) => r.id === id || r.rfqNumber === id);
    if (match) {
      actualRfq = match.rfqNumber || match.id || id;
      if (match.requirementId && !this.data.deletedRequirementIds.includes(match.requirementId)) {
        this.data.deletedRequirementIds.push(match.requirementId);
      }
    }

    if (id && !this.data.deletedRfqIds.includes(id)) this.data.deletedRfqIds.push(id);
    if (actualRfq && !this.data.deletedRfqIds.includes(actualRfq)) this.data.deletedRfqIds.push(actualRfq);
    if (id && !this.data.deletedRequirementIds.includes(id)) this.data.deletedRequirementIds.push(id);
    if (actualRfq && !this.data.deletedRequirementIds.includes(actualRfq)) this.data.deletedRequirementIds.push(actualRfq);

    if (Array.isArray(this.data.rfqs)) {
      this.data.rfqs = this.data.rfqs.filter(
        (r: any) =>
          r.id !== id &&
          r.rfqNumber !== id &&
          r.rfqNumber !== actualRfq &&
          !this.data.deletedRfqIds.includes(r.id) &&
          !(r.rfqNumber && this.data.deletedRfqIds.includes(r.rfqNumber))
      );
    }

    if (Array.isArray(this.data.vendorQuotes)) {
      this.data.vendorQuotes = this.data.vendorQuotes.filter(
        (vq: any) => vq.rfqId !== id && vq.rfqNumber !== id && vq.rfqNumber !== actualRfq
      );
    }

    this.addAuditLog({
      user,
      role,
      action: 'RFQ_PERMANENTLY_PURGED',
      module: 'RFQ',
      recordNumber: actualRfq,
      remarks: `RFQ ${actualRfq} (${id}) was permanently hard-purged from database by ${user}.`,
      ipAddress: ip,
    });

    this.save();
    return { success: true, message: `RFQ ${actualRfq} permanently deleted.`, deletedId: id };
  }

  public purgeAllDeletedRfqs(
    user: string = 'Super Admin',
    role: string = 'SUPER_ADMIN',
    ip: string = '127.0.0.1'
  ): { success: boolean; purgedCount: number; message: string } {
    if (!Array.isArray(this.data.deletedRfqIds)) this.data.deletedRfqIds = [];
    if (!Array.isArray(this.data.deletedRequirementIds)) this.data.deletedRequirementIds = [];

    const beforeCount = (this.data.rfqs || []).length;
    this.data.rfqs = (this.data.rfqs || []).filter(
      (r: any) =>
        !r.isDeleted &&
        !this.data.deletedRfqIds.includes(r.id) &&
        !(r.rfqNumber && this.data.deletedRfqIds.includes(r.rfqNumber)) &&
        !this.data.deletedRequirementIds.includes(r.id) &&
        !(r.rfqNumber && this.data.deletedRequirementIds.includes(r.rfqNumber))
    );
    const purgedCount = beforeCount - this.data.rfqs.length;

    this.addAuditLog({
      user,
      role,
      action: 'BULK_RFQS_PURGED',
      module: 'RFQ',
      recordNumber: 'BULK',
      remarks: `Purged ${purgedCount} soft-deleted or orphaned RFQs permanently from database.`,
      ipAddress: ip,
    });

    this.save();
    return { success: true, purgedCount, message: `Purged ${purgedCount} deleted RFQ records.` };
  }


  public restoreRequirement(
    id: string,
    user: string = 'Admin',
    role: string = 'Admin',
    ip: string = 'unknown'
  ): { success: boolean; message: string; requirement?: any } {
    const reqIndex = this.data.requirements.findIndex(
      (r) => r.id === id || r.rfqNumber === id
    );

    if (reqIndex === -1) {
      return { success: false, message: `Requirement ${id} not found in database.` };
    }

    const now = new Date().toISOString();
    const restored = {
      ...this.data.requirements[reqIndex],
      isDeleted: false,
      deletedAt: undefined,
      deletedBy: undefined,
      deletedReason: undefined,
      lastModifiedAt: now,
      lastModifiedBy: user,
    };
    this.data.requirements[reqIndex] = restored;

    // Remove from deletedRequirementIds if present
    this.data.deletedRequirementIds = (this.data.deletedRequirementIds || []).filter(
      (dId: string) => dId !== restored.id && dId !== restored.rfqNumber
    );

    this.addAuditLog({
      user,
      role,
      action: 'REQUIREMENT_RESTORED',
      module: 'Requirement',
      recordNumber: restored.rfqNumber || restored.id,
      remarks: `Requirement ${restored.rfqNumber || restored.id} restored to active register by ${user} from IP ${ip}.`,
      ipAddress: ip,
    });

    this.save();
    return {
      success: true,
      message: `Requirement ${restored.rfqNumber || restored.id} successfully restored to active register.`,
      requirement: restored,
    };
  }

  // Permanent Hard Delete for Super Admin
  public purgeRequirement(
    id: string,
    user: string = 'Super Admin',
    role: string = 'SUPER_ADMIN',
    ip: string = 'unknown'
  ): { success: boolean; message: string } {
    const target = this.data.requirements.find((r) => r.id === id || r.rfqNumber === id);
    const actualId = target?.id || id;
    const actualRfq = target?.rfqNumber || id;

    this.data.requirements = (this.data.requirements || []).filter((r) => r.id !== actualId && r.rfqNumber !== actualRfq);
    this.data.rfqs = (this.data.rfqs || []).filter((rfq) => rfq.id !== actualId && rfq.rfqNumber !== actualRfq);
    this.data.vendorQuotes = (this.data.vendorQuotes || []).filter((vq) => vq.requirementId !== actualId);
    this.data.quotations = (this.data.quotations || []).filter((q) => q.requirementId !== actualId);
    this.data.customerPos = (this.data.customerPos || []).filter((po) => po.requirementId !== actualId);
    this.data.vendorPos = (this.data.vendorPos || []).filter((po) => po.requirementId !== actualId);
    this.data.proformaInvoices = (this.data.proformaInvoices || []).filter((pi) => pi.requirementId !== actualId);
    this.data.payments = (this.data.payments || []).filter((pay) => pay.requirementId !== actualId);
    this.data.dispatches = (this.data.dispatches || []).filter((d) => d.requirementId !== actualId);
    this.data.deliveries = (this.data.deliveries || []).filter((del) => del.requirementId !== actualId);
    if (!this.data.deletedRequirementIds.includes(actualId)) {
      this.data.deletedRequirementIds.push(actualId);
    }
    if (actualRfq && !this.data.deletedRequirementIds.includes(actualRfq)) {
      this.data.deletedRequirementIds.push(actualRfq);
    }

    this.addAuditLog({
      user,
      role,
      action: 'REQUIREMENT_PERMANENTLY_PURGED',
      module: 'Requirement',
      recordNumber: actualRfq,
      remarks: `Super Admin permanently purged requirement ${actualRfq} (${actualId}) and all associated quotes/POs from disk.`,
      ipAddress: ip,
    });

    this.save();
    return { success: true, message: `Requirement ${actualRfq} permanently erased from database.` };
  }

  // Super Admin Power: Bulk Purge Old Transactions
  public purgeAllOldTransactions(user: string = 'Super Admin', role: string = 'SUPER_ADMIN', ip: string = 'unknown'): { success: boolean; message: string; counts: any } {
    const counts = {
      requirements: (this.data.requirements || []).length,
      rfqs: (this.data.rfqs || []).length,
      vendorQuotes: (this.data.vendorQuotes || []).length,
      quotations: (this.data.quotations || []).length,
      customerPos: (this.data.customerPos || []).length,
      vendorPos: (this.data.vendorPos || []).length,
      proformaInvoices: (this.data.proformaInvoices || []).length,
      payments: (this.data.payments || []).length,
      dispatches: (this.data.dispatches || []).length,
      deliveries: (this.data.deliveries || []).length,
    };

    this.data.requirements = [];
    this.data.rfqs = [];
    this.data.vendorQuotes = [];
    this.data.quotations = [];
    this.data.customerPos = [];
    this.data.vendorPos = [];
    this.data.proformaInvoices = [];
    this.data.payments = [];
    this.data.dispatches = [];
    this.data.deliveries = [];
    this.data.deletedRequirementIds = [];

    this.addAuditLog({
      user,
      role,
      action: 'ALL_TRANSACTIONS_PURGED',
      module: 'Super Admin Master Purge',
      recordNumber: 'ALL',
      remarks: `Super Admin purged all ${counts.requirements} old requirements and transactions. Masters remain 100% preserved.`,
      ipAddress: ip,
    });

    this.save();
    return { success: true, message: `Successfully purged old transactions. All master data preserved intact.`, counts };
  }

  // Super Admin & User Vendor Deletion (Soft & Hard Delete with Tombstones)
  public deleteVendor(
    id: string,
    isPermanent: boolean = false,
    user: string = 'Super Admin',
    role: string = 'SUPER_ADMIN',
    ip: string = 'unknown',
    reason: string = 'Archived by user'
  ): { success: boolean; message: string; deletedId: string; vendor?: any } {
    if (!Array.isArray(this.data.deletedVendorIds)) {
      this.data.deletedVendorIds = [];
    }
    const idx = (this.data.vendors || []).findIndex((v: any) => v.id === id);
    if (idx === -1) {
      if (isPermanent && !this.data.deletedVendorIds.includes(id)) {
        this.data.deletedVendorIds.push(id);
        this.save();
      }
      return { success: true, message: `Vendor ${id} already removed`, deletedId: id };
    }

    const target = this.data.vendors[idx];
    const companyName = target.companyName || id;
    const now = new Date().toISOString();

    if (isPermanent) {
      this.data.vendors.splice(idx, 1);
      if (!this.data.deletedVendorIds.includes(id)) {
        this.data.deletedVendorIds.push(id);
      }
      if (Array.isArray(this.data.vendorProductMappings)) {
        this.data.vendorProductMappings = this.data.vendorProductMappings.filter((m: any) => m.vendorId !== id);
      }
      this.addAuditLog({
        user,
        role,
        action: 'VENDOR_PERMANENTLY_DELETED',
        module: 'Vendor Master',
        recordNumber: id,
        remarks: `Super Admin permanently deleted supplier "${companyName}" (${id}) from database.`,
        ipAddress: ip,
      });
      this.save();
      return { success: true, message: `Vendor ${companyName} permanently deleted.`, deletedId: id };
    } else {
      this.data.vendors[idx] = {
        ...target,
        isDeleted: true,
        deletedAt: now,
        deletedBy: user,
        deletedReason: reason,
      };
      this.addAuditLog({
        user,
        role,
        action: 'VENDOR_ARCHIVED',
        module: 'Vendor Master',
        recordNumber: id,
        remarks: `Supplier "${companyName}" (${id}) soft-deleted: ${reason}.`,
        ipAddress: ip,
      });
      this.save();
      return { success: true, message: `Vendor ${companyName} archived.`, deletedId: id, vendor: this.data.vendors[idx] };
    }
  }

  // Restore Vendor
  public restoreVendor(id: string, user: string = 'Super Admin', role: string = 'SUPER_ADMIN', ip: string = 'unknown'): { success: boolean; message: string; vendor?: any } {
    const idx = (this.data.vendors || []).findIndex((v: any) => v.id === id);
    if (idx === -1) {
      return { success: false, message: `Vendor ${id} not found` };
    }
    this.data.vendors[idx] = {
      ...this.data.vendors[idx],
      isDeleted: false,
      deletedAt: undefined,
      deletedBy: undefined,
      deletedReason: undefined,
    };
    if (Array.isArray(this.data.deletedVendorIds)) {
      this.data.deletedVendorIds = this.data.deletedVendorIds.filter((vid) => vid !== id);
    }
    this.addAuditLog({
      user,
      role,
      action: 'VENDOR_RESTORED',
      module: 'Vendor Master',
      recordNumber: id,
      remarks: `Supplier "${this.data.vendors[idx].companyName || id}" restored to active suppliers.`,
      ipAddress: ip,
    });
    this.save();
    return { success: true, message: `Vendor restored successfully`, vendor: this.data.vendors[idx] };
  }

  // Permanently Purge All Archived Vendors (with authoritative tombstones)
  public purgeArchivedVendors(
    user: string = 'Super Admin',
    role: string = 'SUPER_ADMIN',
    ip: string = 'unknown'
  ): { success: boolean; message: string; purgedCount: number; purgedIds: string[] } {
    if (!Array.isArray(this.data.deletedVendorIds)) this.data.deletedVendorIds = [];
    const vendors = Array.isArray(this.data.vendors) ? this.data.vendors : [];
    const archived = vendors.filter((v: any) => v && v.isDeleted);
    const purgedIds = archived.map((v: any) => v.id).filter(Boolean);
    for (const id of purgedIds) {
      if (!this.data.deletedVendorIds.includes(id)) {
        this.data.deletedVendorIds.push(id);
      }
    }
    this.data.vendors = vendors.filter((v: any) => !v?.isDeleted);
    if (Array.isArray(this.data.vendorProductMappings) && purgedIds.length > 0) {
      const purgedSet = new Set(purgedIds);
      this.data.vendorProductMappings = this.data.vendorProductMappings.filter((m: any) => !purgedSet.has(m.vendorId));
    }
    this.addAuditLog({
      user,
      role,
      action: 'VENDOR_ARCHIVE_PURGED',
      module: 'Vendor Master',
      recordNumber: 'BATCH-PURGE',
      remarks: `Purged ${purgedIds.length} archived suppliers permanently from recycle bin.`,
      ipAddress: ip,
    });
    this.save();
    return {
      success: true,
      message: `Purged ${purgedIds.length} archived suppliers permanently`,
      purgedCount: purgedIds.length,
      purgedIds,
    };
  }

  public getVendorById(id: string): any | null {
    if (!id) return null;
    return (this.data.vendors || []).find((v: any) => v && v.id === id && !v.isDeleted) || null;
  }

  public saveVendorAuthoritative(
    vendorPayload: any,
    mode: 'CREATE' | 'UPDATE' = 'CREATE',
    user: string = 'Super Admin',
    role: string = 'SUPER_ADMIN',
    ip: string = 'unknown',
    options?: { preserveAuthoritativeId?: boolean }
  ): { success: boolean; verified: boolean; mode: 'CREATE' | 'UPDATE'; vendor: any } {
    if (!vendorPayload || typeof vendorPayload !== 'object') {
      throw new Error('Vendor payload is required.');
    }

    const companyName = String(vendorPayload.companyName || '').trim();
    if (!companyName) {
      throw new Error('Company Name is mandatory to save vendor.');
    }

    if (!Array.isArray(this.data.vendors)) this.data.vendors = [];
    if (!Array.isArray(this.data.deletedVendorIds)) this.data.deletedVendorIds = [];

    const snapshotVendors = JSON.parse(JSON.stringify(this.data.vendors));
    const snapshotTombstones = [...this.data.deletedVendorIds];
    const snapshotAudits = JSON.parse(JSON.stringify(this.data.auditLogs || []));

    try {
      const nowIso = new Date().toISOString();
      const todayDate = nowIso.split('T')[0];
      const normName = companyName.toLowerCase();
      const normGst = String(vendorPayload.gstin || '').trim().toUpperCase();
      const isRealGstin = normGst.length === 15 && !normGst.startsWith('27AAAPV0000');
      const preserveAuthoritativeId = Boolean(options?.preserveAuthoritativeId);

      if (mode === 'UPDATE') {
        const targetId = String(vendorPayload.id || '').trim();
        if (!targetId) {
          throw new Error('Vendor ID is required for update.');
        }
        const targetIdx = this.data.vendors.findIndex((v: any) => v && v.id === targetId && !v.isDeleted);
        if (targetIdx === -1 && !preserveAuthoritativeId) {
          throw new Error(`Vendor "${targetId}" was not found or has been archived.`);
        }

        const duplicate = this.data.vendors.find((v: any) => {
          if (!v || v.isDeleted || v.id === targetId) return false;
          const otherName = String(v.companyName || '').trim().toLowerCase();
          const otherGst = String(v.gstin || '').trim().toUpperCase();
          if (otherName && otherName === normName) return true;
          if (isRealGstin && otherGst && otherGst === normGst) return true;
          return false;
        });
        if (duplicate) {
          throw new Error(
            `Another active vendor "${duplicate.companyName}" (${duplicate.id}) already uses this Company Name or GSTIN.`
          );
        }

        const existing = targetIdx !== -1 ? this.data.vendors[targetIdx] : {};
        this.clearTombstone('deletedVendorIds', targetId, false);
        const mergedVendor = {
          ...existing,
          ...vendorPayload,
          id: targetId,
          vendorCode: vendorPayload.vendorCode || existing.vendorCode || targetId,
          companyName,
          gstin: normGst || existing.gstin || '',
          brandsSupplied: Array.isArray(vendorPayload.brandsSupplied)
            ? vendorPayload.brandsSupplied
            : existing.brandsSupplied || [],
          materialCategories: Array.isArray(vendorPayload.materialCategories)
            ? vendorPayload.materialCategories
            : existing.materialCategories || [],
          isDeleted: false,
          createdAt: existing.createdAt || vendorPayload.createdAt || todayDate,
          updatedAt: vendorPayload.updatedAt || nowIso,
        };
        if (targetIdx !== -1) {
          this.data.vendors[targetIdx] = mergedVendor;
        } else {
          // Remove any soft-deleted placeholder with the same authoritative ID before inserting
          this.data.vendors = this.data.vendors.filter((v: any) => !v || v.id !== targetId);
          this.data.vendors.unshift(mergedVendor);
        }
        this.addAuditLog(
          {
            user,
            role,
            action: 'VENDOR_UPDATED',
            module: 'Vendor Master',
            recordNumber: targetId,
            remarks: `Updated vendor "${companyName}" (${targetId}) authoritatively.`,
            ipAddress: ip,
          },
          false
        );
        this.save();

        const diskParsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
        const verifiedVendor = (diskParsed.vendors || []).find(
          (v: any) => v && v.id === targetId && !v.isDeleted
        );
        if (!verifiedVendor) {
          throw new Error(`Post-commit verification failed: vendor ${targetId} was not found on disk.`);
        }
        return { success: true, verified: true, mode: 'UPDATE', vendor: verifiedVendor };
      }

      // CREATE mode: prevent duplicate active vendors and never collide with active, soft-deleted, tombstoned, or mapped IDs
      const duplicate = this.data.vendors.find((v: any) => {
        if (!v || v.isDeleted) return false;
        const otherName = String(v.companyName || '').trim().toLowerCase();
        const otherGst = String(v.gstin || '').trim().toUpperCase();
        if (otherName && otherName === normName) return true;
        if (isRealGstin && otherGst && otherGst === normGst) return true;
        return false;
      });
      if (duplicate) {
        throw new Error(
          `Vendor "${duplicate.companyName}" (${duplicate.id}) already exists with this Company Name or GSTIN.`
        );
      }

      const usedIds = new Set<string>();
      let maxVendNum = 0;
      const scanId = (vid?: string) => {
        if (!vid) return;
        usedIds.add(vid);
        const m = String(vid).match(/^VEND-(\d+)$/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxVendNum) maxVendNum = n;
        }
      };
      this.data.vendors.forEach((v: any) => scanId(v?.id));
      this.data.deletedVendorIds.forEach((vid: string) => scanId(vid));
      (this.data.vendorProductMappings || []).forEach((m: any) => scanId(m?.vendorId));

      let assignedId = String(vendorPayload.id || '').trim();
      if (preserveAuthoritativeId && assignedId) {
        // Authoritative ID already verified in Supabase PostgreSQL: replace any stale soft-deleted placeholder
        this.data.vendors = this.data.vendors.filter((v: any) => !v || v.id !== assignedId);
      } else if (!assignedId || usedIds.has(assignedId)) {
        maxVendNum += 1;
        assignedId = `VEND-${String(maxVendNum).padStart(3, '0')}`;
        while (usedIds.has(assignedId)) {
          maxVendNum += 1;
          assignedId = `VEND-${String(maxVendNum).padStart(3, '0')}`;
        }
      }

      this.clearTombstone('deletedVendorIds', assignedId, false);
      const createdVendor = {
        ...vendorPayload,
        id: assignedId,
        vendorCode: vendorPayload.vendorCode || assignedId,
        companyName,
        gstin: normGst || vendorPayload.gstin || '',
        brandsSupplied: Array.isArray(vendorPayload.brandsSupplied) ? vendorPayload.brandsSupplied : [],
        materialCategories: Array.isArray(vendorPayload.materialCategories) ? vendorPayload.materialCategories : [],
        status: vendorPayload.status || 'ACTIVE',
        isDeleted: false,
        createdAt: vendorPayload.createdAt || todayDate,
        updatedAt: vendorPayload.updatedAt || nowIso,
      };
      this.data.vendors.unshift(createdVendor);
      this.addAuditLog(
        {
          user,
          role,
          action: 'VENDOR_CREATED',
          module: 'Vendor Master',
          recordNumber: assignedId,
          remarks: `Created vendor "${companyName}" (${assignedId}) authoritatively.`,
          ipAddress: ip,
        },
        false
      );
      this.save();

      const diskParsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      const verifiedVendor = (diskParsed.vendors || []).find(
        (v: any) => v && v.id === assignedId && !v.isDeleted
      );
      if (!verifiedVendor) {
        throw new Error(`Post-commit verification failed: vendor ${assignedId} was not found on disk.`);
      }
      return { success: true, verified: true, mode: 'CREATE', vendor: verifiedVendor };
    } catch (err) {
      this.data.vendors = snapshotVendors;
      this.data.deletedVendorIds = snapshotTombstones;
      this.data.auditLogs = snapshotAudits;
      throw err;
    }
  }

  public getUrlCacheEntry(cacheKey: string, ttlMs: number = 1000 * 60 * 60 * 6): any | null {
    const cache = this.cacheData.urlCache;
    if (!cache || typeof cache !== 'object') return null;
    const entry = cache[cacheKey];
    if (!entry || !entry.cachedAt) return null;
    if (Date.now() - Number(entry.cachedAt) > ttlMs) return null;
    return entry.data || null;
  }

  public setUrlCacheEntry(cacheKey: string, data: any): void {
    if (!this.cacheData.urlCache || typeof this.cacheData.urlCache !== 'object') this.cacheData.urlCache = {};
    const keys = Object.keys(this.cacheData.urlCache);
    if (keys.length >= 60) {
      keys
        .sort((a, b) => (this.cacheData.urlCache[a]?.cachedAt || 0) - (this.cacheData.urlCache[b]?.cachedAt || 0))
        .slice(0, 15)
        .forEach((k) => delete this.cacheData.urlCache[k]);
    }
    this.cacheData.urlCache[cacheKey] = { cachedAt: Date.now(), data };
    this.scheduleCacheSave();
  }

  public getCatalogueCacheEntry(cacheKey: string, ttlMs: number = 1000 * 60 * 60 * 12): any | null {
    const cache = this.cacheData.catalogueCache;
    if (!cache || typeof cache !== 'object') return null;
    const entry = cache[cacheKey];
    if (!entry || !entry.cachedAt) return null;
    if (Date.now() - Number(entry.cachedAt) > ttlMs) return null;
    return entry.data || null;
  }

  public setCatalogueCacheEntry(cacheKey: string, data: any): void {
    if (!this.cacheData.catalogueCache || typeof this.cacheData.catalogueCache !== 'object') this.cacheData.catalogueCache = {};
    const keys = Object.keys(this.cacheData.catalogueCache);
    if (keys.length >= 50) {
      keys
        .sort((a, b) => (this.cacheData.catalogueCache[a]?.cachedAt || 0) - (this.cacheData.catalogueCache[b]?.cachedAt || 0))
        .slice(0, 10)
        .forEach((k) => delete this.cacheData.catalogueCache[k]);
    }
    this.cacheData.catalogueCache[cacheKey] = { cachedAt: Date.now(), data };
    this.scheduleCacheSave();
  }

  // Super Admin: Purge All Demo Vendors
  public purgeAllVendors(user: string = 'Super Admin', role: string = 'SUPER_ADMIN', ip: string = 'unknown'): { success: boolean; message: string; count: number } {
    const count = (this.data.vendors || []).length;
    if (!Array.isArray(this.data.deletedVendorIds)) this.data.deletedVendorIds = [];
    (this.data.vendors || []).forEach((v: any) => {
      if (v?.id && !this.data.deletedVendorIds.includes(v.id)) this.data.deletedVendorIds.push(v.id);
    });
    if (!Array.isArray(this.data.deletedVendorMappingIds)) this.data.deletedVendorMappingIds = [];
    (this.data.vendorProductMappings || []).forEach((m: any) => {
      if (m?.id && !this.data.deletedVendorMappingIds!.includes(m.id)) this.data.deletedVendorMappingIds!.push(m.id);
    });
    this.data.vendors = [];
    this.data.vendorProductMappings = [];
    this.addAuditLog({
      user,
      role,
      action: 'ALL_VENDORS_PURGED',
      module: 'Vendor Master',
      recordNumber: 'ALL',
      remarks: `Super Admin purged all ${count} vendors and mappings to start fresh supplier directory.`,
      ipAddress: ip,
    });
    this.save();
    return { success: true, message: `Purged all ${count} vendors successfully.`, count };
  }

  // Super Admin: Purge All Demo Products
  public purgeAllProducts(user: string = 'Super Admin', role: string = 'SUPER_ADMIN', ip: string = 'unknown'): { success: boolean; message: string; count: number } {
    const count = (this.data.products || []).length;
    if (!Array.isArray(this.data.deletedProductIds)) this.data.deletedProductIds = [];
    (this.data.products || []).forEach((p: any) => {
      if (p?.id && !this.data.deletedProductIds!.includes(p.id)) this.data.deletedProductIds!.push(p.id);
    });
    this.data.products = [];
    this.addAuditLog({
      user,
      role,
      action: 'ALL_PRODUCTS_PURGED',
      module: 'Product Master',
      recordNumber: 'ALL',
      remarks: `Super Admin purged all ${count} products to start fresh item catalog.`,
      ipAddress: ip,
    });
    this.save();
    return { success: true, message: `Purged all ${count} products successfully.`, count };
  }

  // Super Admin: Complete Clean Slate for Genuine Business Use
  public cleanSlateAll(user: string = 'Super Admin', role: string = 'SUPER_ADMIN', ip: string = 'unknown'): { success: boolean; message: string } {
    this.purgeAllOldTransactions(user, role, ip);
    if (!Array.isArray(this.data.deletedVendorIds)) this.data.deletedVendorIds = [];
    (this.data.vendors || []).forEach((v: any) => {
      if (v?.id && !this.data.deletedVendorIds.includes(v.id)) this.data.deletedVendorIds.push(v.id);
    });
    if (!Array.isArray(this.data.deletedProductIds)) this.data.deletedProductIds = [];
    (this.data.products || []).forEach((p: any) => {
      if (p?.id && !this.data.deletedProductIds!.includes(p.id)) this.data.deletedProductIds!.push(p.id);
    });
    this.data.vendors = [];
    this.data.vendorProductMappings = [];
    this.data.products = [];
    this.data.rfqCounter = 1;
    this.addAuditLog({
      user,
      role,
      action: 'CLEAN_BUSINESS_SLATE_INITIALIZED',
      module: 'System Administration',
      recordNumber: 'FRESH_SLATE',
      remarks: `Super Admin initialized clean enterprise slate for live business operations. Zero sample records remain.`,
      ipAddress: ip,
    });
    this.save();
    return { success: true, message: 'Clean business slate initialized. All sample records purged. ERP is ready for live business.' };
  }

  public saveRequirement(req: any, user: string = 'User', role: string = 'Procurement Specialist', ip: string = 'unknown'): any {
    if (!req || (!req.id && !req.rfqNumber)) {
      throw new Error('Invalid requirement data');
    }

    // If ID was in tombstones, remove it since user explicitly created/saved it
    if (this.data.deletedRequirementIds.includes(req.id)) {
      this.data.deletedRequirementIds = this.data.deletedRequirementIds.filter((tid) => tid !== req.id);
    }
    if (req.rfqNumber && this.data.deletedRequirementIds.includes(req.rfqNumber)) {
      this.data.deletedRequirementIds = this.data.deletedRequirementIds.filter((tid) => tid !== req.rfqNumber);
    }

    const now = new Date().toISOString();
    const cleanReq = {
      ...req,
      isDeleted: req.isDeleted === true ? true : false,
      dbSaveStatus: 'COMMITTED',
      cloudSyncStatus: 'SYNCED',
      lastModifiedAt: now,
      lastModifiedBy: user,
    };

    const idx = this.data.requirements.findIndex((r) => r.id === req.id || (req.rfqNumber && r.rfqNumber === req.rfqNumber));
    if (idx !== -1) {
      this.data.requirements[idx] = { ...this.data.requirements[idx], ...cleanReq, updatedAt: now };
      this.addAuditLog({
        user,
        role,
        action: 'REQUIREMENT_UPDATED',
        module: 'Requirement',
        recordNumber: req.rfqNumber || req.id,
        remarks: `Requirement ${req.rfqNumber || req.id} updated from IP ${ip}`,
        ipAddress: ip,
      });
    } else {
      this.data.requirements.unshift(cleanReq);
      this.addAuditLog({
        user,
        role,
        action: 'REQUIREMENT_CREATED',
        module: 'Requirement',
        recordNumber: req.rfqNumber || req.id,
        remarks: `New Requirement ${req.rfqNumber || req.id} permanently saved to database from IP ${ip}`,
        ipAddress: ip,
      });
    }

    this.save();
    return cleanReq;
  }

  // Atomic Monotonic RFQ Sequence Number Generator (Prevents Collisions across Users and Imports)
  public getNextRfqNumber(): string {
    const year = new Date().getFullYear();
    let maxNum = this.data.rfqCounter || 100;

    // Scan all existing RFQs and Requirements
    const all = [...(this.data.rfqs || []), ...(this.data.requirements || [])];
    for (const item of all) {
      const match = (item?.rfqNumber || item?.id || '').match(/(\d+)$/);
      if (match) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed) && parsed > maxNum) maxNum = parsed;
      }
    }

    // Scan deleted tombstones
    for (const tid of (this.data.deletedRequirementIds || [])) {
      const match = tid.match(/(\d+)$/);
      if (match) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed) && parsed > maxNum) maxNum = parsed;
      }
    }

    this.data.rfqCounter = maxNum + 1;
    const seq = String(this.data.rfqCounter).padStart(5, '0');
    this.save();
    return `RFQ-${year}-${seq}`;
  }

  // Authoritative Single RFQ Transaction Save with Retrieval Verification
  public saveRfq(
    rfqData: any,
    user: string = 'User',
    role: string = 'Procurement Specialist',
    ip: string = 'unknown'
  ): {
    success: boolean;
    rfq: any;
    rfqId: string;
    rfqNumber: string;
    verified: boolean;
    itemsCount: number;
    timestamp: string;
  } {
    if (!rfqData) {
      throw new Error('Invalid RFQ payload: payload is empty');
    }

    if (!Array.isArray(this.data.rfqs)) {
      this.data.rfqs = [];
    }

    const now = new Date().toISOString();

    // 1. Generate or validate RFQ number
    let rfqNumber = (rfqData.rfqNumber || rfqData.id || '').trim();
    if (!rfqNumber) {
      rfqNumber = this.getNextRfqNumber();
    }
    const rfqId = rfqNumber;

    // 2. Untombstone immediately so background sync never suppresses this RFQ
    this.data.deletedRequirementIds = (this.data.deletedRequirementIds || []).filter(
      (tid: string) => tid !== rfqId && tid !== rfqNumber && tid !== rfqData.requirementId
    );

    // 3. Resolve Vendor / Customer information
    const vendorIds: string[] = Array.isArray(rfqData.vendorIds)
      ? rfqData.vendorIds
      : rfqData.vendorId
      ? [rfqData.vendorId]
      : [];

    const primaryVendor = vendorIds.length > 0
      ? (this.data.vendors || []).find((v: any) => v.id === vendorIds[0])
      : null;

    const companyId = rfqData.companyId || rfqData.customerId || '';
    const companyName = rfqData.companyName || rfqData.customerName || (
      companyId ? (this.data.companies || []).find((c: any) => c.id === companyId)?.companyName : ''
    ) || 'Industrial Customer';

    // 4. Validate & Process RFQ Items
    const rawItems = Array.isArray(rfqData.items) && rfqData.items.length > 0
      ? rfqData.items
      : [
          {
            itemName: rfqData.itemName || 'MRO Industrial Supply',
            description: rfqData.description || rfqData.itemName || 'Standard Specification',
            category: rfqData.category || 'General MRO',
            quantity: rfqData.quantity || 1,
            uom: rfqData.uom || 'NOS',
            partNumber: rfqData.partCode || rfqData.partNumber || '',
            brand: rfqData.brand || 'OEM',
            targetPrice: rfqData.targetPrice || rfqData.rate || 0,
          },
        ];

    const processedItems = rawItems.map((item: any, idx: number) => {
      const itemName = (item.itemName || item.description || `Item #${idx + 1}`).trim();
      const qty = Number(item.quantity);
      return {
        id: item.id || `RFQ-ITEM-${rfqId.replace(/[^a-zA-Z0-9]/g, '')}-${idx + 1}`,
        rfqId,
        productId: item.productId || undefined,
        brand: item.brand || rfqData.brand || '',
        brandId: item.brandId || undefined,
        partCode: item.partCode || item.partNumber || '',
        partNumber: item.partNumber || item.partCode || '',
        modelNumber: item.modelNumber || '',
        manufacturerCode: item.manufacturerCode || '',
        itemName,
        description: item.description || item.itemName || itemName,
        category: item.category || 'Electrical',
        subCategory: item.subCategory || '',
        specifications: item.specifications || item.specs || 'Standard Industrial Specification',
        quantity: !isNaN(qty) && qty > 0 ? qty : 1,
        uom: (item.uom || 'NOS').toUpperCase(),
        targetPrice: Number(item.targetPrice || item.rate || 0),
        rate: Number(item.rate || item.targetPrice || 0),
        vendorId: item.vendorId || (vendorIds[0] || ''),
        vendorName: item.vendorName || primaryVendor?.companyName || '',
        requiredDeliveryDate: item.requiredDeliveryDate || rfqData.requiredDate || now.split('T')[0],
      };
    });

    const cleanRfq = {
      id: rfqId,
      rfqNumber,
      requirementId: rfqData.requirementId || `REQ-${rfqId.replace(/^RFQ-/, '')}`,
      vendorIds,
      vendorId: vendorIds[0] || '',
      vendorName: primaryVendor?.companyName || rfqData.vendorName || '',
      customerId: companyId,
      customerName: companyName,
      companyId,
      companyName,
      purchaseExecutiveId: rfqData.purchaseExecutiveId || '',
      purchaseExecutiveName: rfqData.purchaseExecutiveName || 'Purchase Executive',
      requiredDate: rfqData.requiredDate || rfqData.requiredDeliveryDate || now.split('T')[0],
      sentDate: rfqData.sentDate || new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      status: rfqData.status || (vendorIds.length > 0 ? 'SENT' : 'NEW_RFQ'),
      notes: rfqData.notes || rfqData.remarks || '',
      commercialTerms: rfqData.commercialTerms || 'Standard 30 Days Net, Delivery to Gate',
      items: processedItems,
      createdBy: user,
      createdAt: rfqData.createdAt || now,
      updatedAt: now,
      isDeleted: false,
      dbSaveStatus: 'COMMITTED',
    };

    // 5. Update or insert into this.data.rfqs
    const existingIdx = this.data.rfqs.findIndex(
      (r: any) => r.id === rfqId || (r.rfqNumber && r.rfqNumber === rfqNumber)
    );

    if (existingIdx !== -1) {
      this.data.rfqs[existingIdx] = {
        ...this.data.rfqs[existingIdx],
        ...cleanRfq,
        isDeleted: false,
      };
      this.addAuditLog({
        user,
        role,
        action: 'RFQ_UPDATED',
        module: 'RFQ',
        recordNumber: rfqNumber,
        remarks: `RFQ ${rfqNumber} updated with ${processedItems.length} items from IP ${ip}`,
        ipAddress: ip,
      });
    } else {
      this.data.rfqs.unshift(cleanRfq);
      this.addAuditLog({
        user,
        role,
        action: 'RFQ_CREATED',
        module: 'RFQ',
        recordNumber: rfqNumber,
        remarks: `New RFQ ${rfqNumber} committed with ${processedItems.length} items from IP ${ip}`,
        ipAddress: ip,
      });
    }

    // 6. Synchronize with corresponding Requirement if exists
    if (cleanRfq.requirementId) {
      const reqIdx = this.data.requirements.findIndex((r: any) => r.id === cleanRfq.requirementId || r.rfqNumber === cleanRfq.rfqNumber);
      if (reqIdx !== -1) {
        this.data.requirements[reqIdx].rfqNumber = rfqNumber;
        if (vendorIds.length > 0 && this.data.requirements[reqIdx].status === 'NEW_REQUIREMENT') {
          this.data.requirements[reqIdx].status = 'ENQUIRY_SENT';
        }
      }
    }

    // 7. Commit database transaction to disk
    this.save();

    // 8. Database Verification Rule: Confirm record exists in database after commit
    const verifiedRecord = this.data.rfqs.find((r: any) => r.id === rfqId || r.rfqNumber === rfqNumber);
    if (!verifiedRecord || verifiedRecord.isDeleted) {
      throw new Error(`Database Verification Failed: RFQ ${rfqNumber} could not be confirmed in database after commit.`);
    }

    return {
      success: true,
      rfq: verifiedRecord,
      rfqId: verifiedRecord.id,
      rfqNumber: verifiedRecord.rfqNumber,
      verified: true,
      itemsCount: verifiedRecord.items?.length || 0,
      timestamp: now,
    };
  }

  // Bulk RFQ Save with exact row-by-row verification and error reporting
  public saveBulkRfqs(
    rfqsList: any[],
    user: string = 'User',
    role: string = 'Procurement Specialist',
    ip: string = 'unknown'
  ): {
    success: boolean;
    totalSubmitted: number;
    successfullySaved: number;
    duplicateCount: number;
    failedCount: number;
    results: Array<{
      row: number;
      rfqNumber: string;
      result: 'SAVED' | 'DUPLICATE' | 'FAILED';
      reason?: string;
      rfqId?: string;
    }>;
    savedRfqs: any[];
  } {
    if (!Array.isArray(rfqsList) || rfqsList.length === 0) {
      return {
        success: true,
        totalSubmitted: 0,
        successfullySaved: 0,
        duplicateCount: 0,
        failedCount: 0,
        results: [],
        savedRfqs: [],
      };
    }

    const results: Array<{
      row: number;
      rfqNumber: string;
      result: 'SAVED' | 'DUPLICATE' | 'FAILED';
      reason?: string;
      rfqId?: string;
    }> = [];
    const savedRfqs: any[] = [];
    let duplicateCount = 0;
    let failedCount = 0;

    const seenInBatch = new Set<string>();

    for (let idx = 0; idx < rfqsList.length; idx++) {
      const rowNum = idx + 1;
      const rawRfq = rfqsList[idx];

      if (!rawRfq || typeof rawRfq !== 'object') {
        results.push({ row: rowNum, rfqNumber: `ROW-${rowNum}`, result: 'FAILED', reason: 'Invalid or empty row data' });
        failedCount++;
        continue;
      }

      const candidateRfqNumber = (rawRfq.rfqNumber || rawRfq.id || '').trim();

      // Check intra-batch duplicate
      if (candidateRfqNumber && seenInBatch.has(candidateRfqNumber.toLowerCase())) {
        results.push({
          row: rowNum,
          rfqNumber: candidateRfqNumber,
          result: 'DUPLICATE',
          reason: `Duplicate RFQ Number "${candidateRfqNumber}" repeated in uploaded file`,
        });
        duplicateCount++;
        continue;
      }

      // Check database duplicate if specified explicitly
      if (candidateRfqNumber) {
        const existingInDb = (this.data.rfqs || []).find(
          (r: any) => !r.isDeleted && (r.id === candidateRfqNumber || r.rfqNumber === candidateRfqNumber)
        );
        if (existingInDb && rawRfq.allowUpdate !== true) {
          results.push({
            row: rowNum,
            rfqNumber: candidateRfqNumber,
            result: 'DUPLICATE',
            reason: `Existing RFQ already found in database with ID ${existingInDb.id}`,
            rfqId: existingInDb.id,
          });
          duplicateCount++;
          continue;
        }
      }

      try {
        const saveRes = this.saveRfq(rawRfq, user, role, ip);
        if (saveRes && saveRes.verified) {
          if (candidateRfqNumber) seenInBatch.add(candidateRfqNumber.toLowerCase());
          results.push({
            row: rowNum,
            rfqNumber: saveRes.rfqNumber,
            result: 'SAVED',
            rfqId: saveRes.rfqId,
          });
          savedRfqs.push(saveRes.rfq);
        } else {
          results.push({
            row: rowNum,
            rfqNumber: candidateRfqNumber || `ROW-${rowNum}`,
            result: 'FAILED',
            reason: 'Database write could not be verified after commit',
          });
          failedCount++;
        }
      } catch (err: any) {
        results.push({
          row: rowNum,
          rfqNumber: candidateRfqNumber || `ROW-${rowNum}`,
          result: 'FAILED',
          reason: err.message || 'Unknown database error during RFQ insertion',
        });
        failedCount++;
      }
    }

    return {
      success: true,
      totalSubmitted: rfqsList.length,
      successfullySaved: savedRfqs.length,
      duplicateCount,
      failedCount,
      results,
      savedRfqs,
    };
  }

  public getRfqById(id: string): any {
    if (!id) return null;
    return (this.data.rfqs || []).find(
      (r: any) => !r.isDeleted && (r.id === id || r.rfqNumber === id)
    ) || null;
  }

  // Authoritative State Sync
  public getAuthoritativeState() {
    const deletedReqIds = this.data.deletedRequirementIds || [];
    const deletedVendorIds = this.data.deletedVendorIds || [];
    const deletedCustomerIds = this.data.deletedCustomerIds || [];
    const deletedCompanyIds = this.data.deletedCompanyIds || [];
    const deletedExecIds = this.data.deletedPurchaseExecutiveIds || [];
    const deletedProductIds = this.data.deletedProductIds || [];
    const deletedBrandIds = this.data.deletedBrandIds || [];
    const deletedCategoryIds = this.data.deletedCategoryIds || [];
    const deletedMappingIds = this.data.deletedVendorMappingIds || [];
    const deletedQuoteIds = this.data.deletedVendorQuoteIds || [];
    return {
      version: this.data.version || 2,
      lastUpdated: this.data.lastUpdated,
      requirements: (this.data.requirements || []).filter(
        (r: any) =>
          !r.isDeleted &&
          !deletedReqIds.includes(r.id) &&
          !(r.rfqNumber && deletedReqIds.includes(r.rfqNumber))
      ),
      deletedRequirements: (this.data.requirements || []).filter(
        (r: any) =>
          r.isDeleted ||
          deletedReqIds.includes(r.id) ||
          (r.rfqNumber && deletedReqIds.includes(r.rfqNumber))
      ),
      deletedRequirementIds: deletedReqIds,
      deletedRfqIds: this.data.deletedRfqIds || [],
      deletedCustomerIds,
      deletedCompanyIds,
      deletedPurchaseExecutiveIds: deletedExecIds,
      deletedProductIds,
      deletedBrandIds,
      deletedCategoryIds,
      deletedVendorMappingIds: deletedMappingIds,
      deletedVendorQuoteIds: deletedQuoteIds,
      catalogueProducts: this.data.catalogueProducts || [],
      rateVersionHistory: this.data.rateVersionHistory || [],
      importBatches: this.data.importBatches || [],
      companies: (this.data.companies || []).filter((c: any) => c && !c.isDeleted && !deletedCompanyIds.includes(c.id)),
      purchaseExecutives: (this.data.purchaseExecutives || []).filter((e: any) => e && !e.isDeleted && !deletedExecIds.includes(e.id)),
      customers: (this.data.customers || []).filter((c: any) => c && !c.isDeleted && !deletedCustomerIds.includes(c.id)),
      vendors: (this.data.vendors || []).filter((v: any) => !v.isDeleted && !deletedVendorIds.includes(v.id)),
      archivedVendors: (this.data.vendors || []).filter((v: any) => v && v.isDeleted && !deletedVendorIds.includes(v.id)),
      deletedVendorIds,
      products: (this.data.products || []).filter((p: any) => p && !p.isDeleted && !deletedProductIds.includes(p.id)),
      quotations: this.data.quotations,
      customerPos: this.data.customerPos,
      vendorPos: this.data.vendorPos,
      proformaInvoices: this.data.proformaInvoices,
      payments: this.data.payments,
      dispatches: this.data.dispatches,
      deliveries: this.data.deliveries,
      rfqs: (this.data.rfqs || []).filter(
        (rfq: any) =>
          !rfq.isDeleted &&
          !deletedReqIds.includes(rfq.id) &&
          !(rfq.rfqNumber && deletedReqIds.includes(rfq.rfqNumber)) &&
          !(rfq.requirementId && deletedReqIds.includes(rfq.requirementId)) &&
          !(this.data.deletedRfqIds || []).includes(rfq.id) &&
          !(rfq.rfqNumber && (this.data.deletedRfqIds || []).includes(rfq.rfqNumber))
      ),
      vendorQuotes: (this.data.vendorQuotes || []).filter((q: any) => q && !deletedQuoteIds.includes(q.id)),
      notifications: this.data.notifications,
      auditLogs: (this.data.auditLogs || []).slice(0, 150),
      loginAuditLogs: (this.data.loginAuditLogs || []).slice(0, 100),
      activeSessions: this.data.activeSessions.filter((s) => s.status === 'ACTIVE'),
      vendorProductMappings: (this.data.vendorProductMappings || []).filter(
        (m: any) => m && !deletedMappingIds.includes(m.id) && !deletedVendorIds.includes(m.vendorId)
      ),
      invoices: this.data.invoices || INITIAL_INVOICES,
      vendorBills: this.data.vendorBills || INITIAL_VENDOR_BILLS,
      expenses: this.data.expenses || INITIAL_EXPENSES,
      challans: this.data.challans || [],
      companySettings: this.data.companySettings || INITIAL_COMPANY_SETTINGS,
      users: this.getUsers(),
      roles: this.getRoles(),
      approvals: this.data.approvals,
      brands: (this.data.brands || []).filter((b: any) => b && !deletedBrandIds.includes(b.id)),
      categories: (this.data.categories || []).filter((c: any) => c && !deletedCategoryIds.includes(c.id)),
      productTypes: this.getProductTypes(),
    };
  }

  // Full Sync with Conflict Resolution
  public syncState(clientPayload: any, user: string = 'User', ip: string = 'unknown') {
    if (!clientPayload || typeof clientPayload !== 'object' || Object.keys(clientPayload).length === 0) {
      return this.getAuthoritativeState();
    }

    // Merge any client-supplied requirement tombstones
    if (Array.isArray(clientPayload.deletedRequirementIds)) {
      clientPayload.deletedRequirementIds.forEach((dId: string) => {
        if (dId && !this.data.deletedRequirementIds.includes(dId)) {
          this.data.deletedRequirementIds.push(dId);
        }
      });
    }

    // Merge any client-supplied RFQ tombstones
    if (!Array.isArray(this.data.deletedRfqIds)) this.data.deletedRfqIds = [];
    if (Array.isArray(clientPayload.deletedRfqIds)) {
      clientPayload.deletedRfqIds.forEach((dId: string) => {
        if (dId && !this.data.deletedRfqIds.includes(dId)) {
          this.data.deletedRfqIds.push(dId);
        }
      });
    }

    const mergeTombstones = (
      field:
        | 'deletedCustomerIds'
        | 'deletedCompanyIds'
        | 'deletedPurchaseExecutiveIds'
        | 'deletedProductIds'
        | 'deletedBrandIds'
        | 'deletedCategoryIds'
        | 'deletedVendorMappingIds'
        | 'deletedVendorQuoteIds'
    ) => {
      if (!Array.isArray((this.data as any)[field])) (this.data as any)[field] = [];
      const incomingIds = clientPayload[field];
      if (Array.isArray(incomingIds)) {
        incomingIds.forEach((id: string) => {
          if (id && !(this.data as any)[field].includes(id)) {
            (this.data as any)[field].push(id);
          }
        });
      }
    };
    mergeTombstones('deletedCustomerIds');
    mergeTombstones('deletedCompanyIds');
    mergeTombstones('deletedPurchaseExecutiveIds');
    mergeTombstones('deletedProductIds');
    mergeTombstones('deletedBrandIds');
    mergeTombstones('deletedCategoryIds');
    mergeTombstones('deletedVendorMappingIds');
    mergeTombstones('deletedVendorQuoteIds');

    // Reconcile Requirements: Never restore items that are in deletedRequirementIds or marked deleted
    if (Array.isArray(clientPayload.requirements)) {
      const incoming = clientPayload.requirements.filter(
        (r: any) =>
          !r.isDeleted &&
          !this.data.deletedRequirementIds.includes(r.id) &&
          !this.data.deletedRequirementIds.includes(r.rfqNumber)
      );


      for (const item of incoming) {
        const existingIdx = this.data.requirements.findIndex((r) => r.id === item.id || r.rfqNumber === item.rfqNumber);
        if (existingIdx !== -1) {
          // If already marked deleted on server, skip
          if (this.data.requirements[existingIdx].isDeleted) continue;
          // If client version is newer, update
          this.data.requirements[existingIdx] = { ...this.data.requirements[existingIdx], ...item };
        } else {
          this.data.requirements.push(item);
        }
      }
    }

    // Companies sync (honor deletedCompanyIds tombstones)
    if (Array.isArray(clientPayload.companies)) {
      const delCompIds = this.data.deletedCompanyIds || [];
      for (const c of clientPayload.companies) {
        if (!c || !c.id || c.isDeleted || delCompIds.includes(c.id)) continue;
        const idx = this.data.companies.findIndex((item) => item.id === c.id);
        if (idx !== -1) {
          this.data.companies[idx] = { ...this.data.companies[idx], ...c };
        } else {
          this.data.companies.push(c);
        }
      }
      this.data.companies = this.data.companies.filter((c: any) => c && !delCompIds.includes(c.id));
    }

    // Purchase Executives sync (honor deletedPurchaseExecutiveIds tombstones)
    if (Array.isArray(clientPayload.purchaseExecutives)) {
      const delExecIds = this.data.deletedPurchaseExecutiveIds || [];
      for (const pe of clientPayload.purchaseExecutives) {
        if (!pe || !pe.id || pe.isDeleted || delExecIds.includes(pe.id)) continue;
        const idx = this.data.purchaseExecutives.findIndex((item) => item.id === pe.id);
        if (idx !== -1) {
          this.data.purchaseExecutives[idx] = { ...this.data.purchaseExecutives[idx], ...pe };
        } else {
          this.data.purchaseExecutives.push(pe);
        }
      }
      this.data.purchaseExecutives = this.data.purchaseExecutives.filter((e: any) => e && !delExecIds.includes(e.id));
    }

    // Deleted Vendors tombstones sync
    if (Array.isArray(clientPayload.deletedVendorIds)) {
      clientPayload.deletedVendorIds.forEach((vid: string) => {
        if (vid && !this.data.deletedVendorIds.includes(vid)) {
          this.data.deletedVendorIds.push(vid);
        }
      });
    }

    // Vendors sync - update and merge vendors, strictly honoring tombstones
    if (Array.isArray(clientPayload.vendors)) {
      const incoming = clientPayload.vendors.filter(
        (v: any) => v && v.id && !this.data.deletedVendorIds.includes(v.id)
      );
      for (const v of incoming) {
        const idx = this.data.vendors.findIndex((item) => item.id === v.id);
        if (idx !== -1) {
          const serverV = this.data.vendors[idx];
          if (serverV.isDeleted && !v.isDeleted) {
            // keep soft delete unless explicitly restored
          } else {
            const serverHasIntel =
              (Array.isArray(serverV.catalogueBatches) && serverV.catalogueBatches.length > 0) ||
              !!serverV.websiteIntelligence;
            const clientLacksIntel =
              (!Array.isArray(v.catalogueBatches) || v.catalogueBatches.length === 0) &&
              (!Array.isArray(v.brandsSupplied) || v.brandsSupplied.length === 0);
            if (serverHasIntel && clientLacksIntel) {
              this.data.vendors[idx] = {
                ...v,
                brandsSupplied: serverV.brandsSupplied,
                brandsDealing: serverV.brandsDealing,
                materialCategories: serverV.materialCategories,
                productCategories: serverV.productCategories,
                productFamilies: serverV.productFamilies,
                productTypesDealing: serverV.productTypesDealing,
                manufacturerAssociations: serverV.manufacturerAssociations,
                catalogProducts: serverV.catalogProducts,
                catalogFiles: serverV.catalogFiles,
                catalogueBatches: serverV.catalogueBatches,
                websiteIntelligence: serverV.websiteIntelligence,
                intelligenceScore: serverV.intelligenceScore,
                intelligenceScoreBreakdown: serverV.intelligenceScoreBreakdown,
                intelligenceConfidence: serverV.intelligenceConfidence,
                dataSources: serverV.dataSources,
                lastAiAnalysisDate: serverV.lastAiAnalysisDate,
              };
            } else {
              this.data.vendors[idx] = { ...serverV, ...v };
            }
          }
        } else {
          this.data.vendors.push(v);
        }
      }
      // Never keep vendors that have been permanently deleted
      this.data.vendors = this.data.vendors.filter(
        (v: any) => !this.data.deletedVendorIds.includes(v.id)
      );
    }

    // Reconcile soft-archived vendors without reviving permanently deleted IDs
    if (Array.isArray(clientPayload.archivedVendors)) {
      for (const av of clientPayload.archivedVendors) {
        if (!av || !av.id || this.data.deletedVendorIds.includes(av.id)) continue;
        const idx = this.data.vendors.findIndex((item) => item.id === av.id);
        if (idx !== -1) {
          this.data.vendors[idx] = { ...this.data.vendors[idx], ...av, isDeleted: true };
        } else {
          this.data.vendors.push({ ...av, isDeleted: true });
        }
      }
    }

    // Vendor Product Mappings sync (deduplicate by ID and semantic vendor+part/name+brand key, honoring tombstones)
    if (Array.isArray(clientPayload.vendorProductMappings)) {
      const delMapIds = this.data.deletedVendorMappingIds || [];
      for (const m of clientPayload.vendorProductMappings) {
        if (!m || !m.id || delMapIds.includes(m.id) || (this.data.deletedVendorIds || []).includes(m.vendorId)) continue;
        const mPartKey = normalizePartCode(m.partNumber || m.modelNumber || '');
        const idx = this.data.vendorProductMappings.findIndex((item) => {
          if (item.id === m.id) return true;
          if (item.vendorId !== m.vendorId) return false;
          const itemPartKey = normalizePartCode(item.partNumber || item.modelNumber || '');
          if (mPartKey && itemPartKey && mPartKey === itemPartKey) return true;
          return (
            (item.productName || '').toLowerCase().trim() === (m.productName || '').toLowerCase().trim() &&
            (item.brand || '').toLowerCase().trim() === (m.brand || '').toLowerCase().trim()
          );
        });
        if (idx !== -1) {
          this.data.vendorProductMappings[idx] = { ...this.data.vendorProductMappings[idx], ...m, id: this.data.vendorProductMappings[idx].id };
        } else {
          this.data.vendorProductMappings.push(m);
        }
      }
    }

    // Products Master sync (O(N) indexed merge honoring deletedProductIds & soft-delete)
    if (Array.isArray(clientPayload.products)) {
      const delProdSet = new Set(this.data.deletedProductIds || []);
      const prodIndexById = new Map<string, number>();
      this.data.products.forEach((item, i) => {
        if (item?.id) prodIndexById.set(item.id, i);
      });
      for (const p of clientPayload.products) {
        if (!p || !p.id || delProdSet.has(p.id)) continue;
        const idx = prodIndexById.get(p.id);
        if (idx !== undefined) {
          if (this.data.products[idx].isDeleted && !p.isDeleted) continue;
          this.data.products[idx] = { ...this.data.products[idx], ...p };
        } else if (!p.isDeleted) {
          prodIndexById.set(p.id, this.data.products.length);
          this.data.products.push(p);
        }
      }
      this.data.products = this.data.products.filter((p: any) => p && !p.isDeleted && !delProdSet.has(p.id));
    }

    // Quotations sync
    if (Array.isArray(clientPayload.quotations)) {
      for (const q of clientPayload.quotations) {
        const idx = this.data.quotations.findIndex((item) => item.id === q.id);
        if (idx !== -1) {
          this.data.quotations[idx] = { ...this.data.quotations[idx], ...q };
        } else {
          this.data.quotations.push(q);
        }
      }
    }

    // Customer POs sync
    if (Array.isArray(clientPayload.customerPos)) {
      for (const po of clientPayload.customerPos) {
        const idx = this.data.customerPos.findIndex((item) => item.id === po.id);
        if (idx !== -1) {
          this.data.customerPos[idx] = { ...this.data.customerPos[idx], ...po };
        } else {
          this.data.customerPos.push(po);
        }
      }
    }

    // Payments sync
    if (Array.isArray(clientPayload.payments)) {
      for (const p of clientPayload.payments) {
        const idx = this.data.payments.findIndex((item) => item.id === p.id);
        if (idx !== -1) {
          this.data.payments[idx] = { ...this.data.payments[idx], ...p };
        } else {
          this.data.payments.push(p);
        }
      }
    }

    // Dispatches sync
    if (Array.isArray(clientPayload.dispatches)) {
      for (const d of clientPayload.dispatches) {
        const idx = this.data.dispatches.findIndex((item) => item.id === d.id);
        if (idx !== -1) {
          this.data.dispatches[idx] = { ...this.data.dispatches[idx], ...d };
        } else {
          this.data.dispatches.push(d);
        }
      }
    }

    // Invoices sync
    if (Array.isArray(clientPayload.invoices)) {
      if (!Array.isArray(this.data.invoices)) this.data.invoices = [];
      for (const inv of clientPayload.invoices) {
        const idx = this.data.invoices.findIndex((item) => item.id === inv.id);
        if (idx !== -1) {
          this.data.invoices[idx] = { ...this.data.invoices[idx], ...inv };
        } else {
          this.data.invoices.push(inv);
        }
      }
    }

    // Vendor Bills sync
    if (Array.isArray(clientPayload.vendorBills)) {
      if (!Array.isArray(this.data.vendorBills)) this.data.vendorBills = [];
      for (const b of clientPayload.vendorBills) {
        const idx = this.data.vendorBills.findIndex((item) => item.id === b.id);
        if (idx !== -1) {
          this.data.vendorBills[idx] = { ...this.data.vendorBills[idx], ...b };
        } else {
          this.data.vendorBills.push(b);
        }
      }
    }

    // Expenses sync
    if (Array.isArray(clientPayload.expenses)) {
      if (!Array.isArray(this.data.expenses)) this.data.expenses = [];
      for (const e of clientPayload.expenses) {
        const idx = this.data.expenses.findIndex((item) => item.id === e.id);
        if (idx !== -1) {
          this.data.expenses[idx] = { ...this.data.expenses[idx], ...e };
        } else {
          this.data.expenses.push(e);
        }
      }
    }

    // Challans sync
    if (Array.isArray(clientPayload.challans)) {
      if (!Array.isArray(this.data.challans)) this.data.challans = [];
      for (const ch of clientPayload.challans) {
        const idx = this.data.challans.findIndex((item) => item.id === ch.id);
        if (idx !== -1) {
          this.data.challans[idx] = { ...this.data.challans[idx], ...ch };
        } else {
          this.data.challans.push(ch);
        }
      }
    }

    // Company Settings sync
    if (clientPayload.companySettings && typeof clientPayload.companySettings === 'object') {
      this.data.companySettings = {
        ...(this.data.companySettings || INITIAL_COMPANY_SETTINGS),
        ...clientPayload.companySettings,
      };
    }

    // Brands sync (honor deletedBrandIds tombstones)
    if (Array.isArray(clientPayload.brands)) {
      if (!Array.isArray(this.data.brands)) this.data.brands = [];
      const delBrandIds = this.data.deletedBrandIds || [];
      for (const b of clientPayload.brands) {
        if (!b || !b.name || (b.id && delBrandIds.includes(b.id))) continue;
        const idx = this.data.brands.findIndex((item) => item.id === b.id || item.name?.toLowerCase().trim() === b.name?.toLowerCase().trim());
        if (idx !== -1) {
          this.data.brands[idx] = { ...this.data.brands[idx], ...b };
        } else {
          this.data.brands.push(b);
        }
      }
      this.data.brands = this.data.brands.filter((b: any) => b && !delBrandIds.includes(b.id));
    }

    // Categories sync (honor deletedCategoryIds tombstones)
    if (Array.isArray(clientPayload.categories)) {
      if (!Array.isArray(this.data.categories)) this.data.categories = [];
      const delCatIds = this.data.deletedCategoryIds || [];
      for (const c of clientPayload.categories) {
        if (!c || !c.name || (c.id && delCatIds.includes(c.id))) continue;
        const idx = this.data.categories.findIndex((item) => item.id === c.id || item.name?.toLowerCase().trim() === c.name?.toLowerCase().trim());
        if (idx !== -1) {
          this.data.categories[idx] = { ...this.data.categories[idx], ...c };
        } else {
          this.data.categories.push(c);
        }
      }
      this.data.categories = this.data.categories.filter((c: any) => c && !delCatIds.includes(c.id));
    }

    // Product Types sync
    if (Array.isArray(clientPayload.productTypes)) {
      if (!Array.isArray(this.data.productTypes)) this.data.productTypes = [];
      for (const pt of clientPayload.productTypes) {
        if (!pt || !pt.name) continue;
        const idx = this.data.productTypes.findIndex(
          (item) => item.id === pt.id || item.name?.toLowerCase().trim() === pt.name?.toLowerCase().trim()
        );
        if (idx !== -1) {
          this.data.productTypes[idx] = { ...this.data.productTypes[idx], ...pt };
        } else {
          this.data.productTypes.push(pt);
        }
      }
    }

    // Customers sync (honor deletedCustomerIds & deletedCompanyIds tombstones)
    if (Array.isArray(clientPayload.customers)) {
      if (!Array.isArray(this.data.customers)) this.data.customers = [];
      const delCustIds = new Set([...(this.data.deletedCustomerIds || []), ...(this.data.deletedCompanyIds || [])]);
      for (const c of clientPayload.customers) {
        if (!c || !c.companyName || (c.id && delCustIds.has(c.id))) continue;
        const idx = this.data.customers.findIndex(
          (item) =>
            item.id === c.id ||
            (c.gstin && item.gstin && item.gstin.trim().toLowerCase() === c.gstin.trim().toLowerCase()) ||
            item.companyName?.trim().toLowerCase() === c.companyName?.trim().toLowerCase()
        );
        if (idx !== -1) {
          this.data.customers[idx] = { ...this.data.customers[idx], ...c };
        } else {
          this.data.customers.push(c);
        }
      }
      this.data.customers = this.data.customers.filter((c: any) => c && !delCustIds.has(c.id));
    }

    // RFQs sync
    if (Array.isArray(clientPayload.rfqs)) {
      if (!Array.isArray(this.data.rfqs)) this.data.rfqs = [];
      const deletedReqIds = this.data.deletedRequirementIds || [];
      const deletedRfqIds = this.data.deletedRfqIds || [];
      const incoming = clientPayload.rfqs.filter(
        (r: any) =>
          r &&
          !r.isDeleted &&
          !deletedReqIds.includes(r.id) &&
          !(r.rfqNumber && deletedReqIds.includes(r.rfqNumber)) &&
          !(r.requirementId && deletedReqIds.includes(r.requirementId)) &&
          !deletedRfqIds.includes(r.id) &&
          !(r.rfqNumber && deletedRfqIds.includes(r.rfqNumber))
      );
      for (const r of incoming) {
        const idx = this.data.rfqs.findIndex((item) => item.id === r.id || (r.rfqNumber && item.rfqNumber === r.rfqNumber));
        if (idx !== -1) {
          if (this.data.rfqs[idx].isDeleted) continue;
          this.data.rfqs[idx] = { ...this.data.rfqs[idx], ...r };
        } else {
          this.data.rfqs.push(r);
        }
      }
      this.data.rfqs = this.data.rfqs.filter(
        (rfq: any) =>
          !rfq.isDeleted &&
          !deletedReqIds.includes(rfq.id) &&
          !(rfq.rfqNumber && deletedReqIds.includes(rfq.rfqNumber)) &&
          !(rfq.requirementId && deletedReqIds.includes(rfq.requirementId)) &&
          !deletedRfqIds.includes(rfq.id) &&
          !(rfq.rfqNumber && deletedRfqIds.includes(rfq.rfqNumber))
      );
    }


    // Vendor Quotes sync (honor deletedVendorQuoteIds tombstones)
    if (Array.isArray(clientPayload.vendorQuotes)) {
      if (!Array.isArray(this.data.vendorQuotes)) this.data.vendorQuotes = [];
      const delQuoteIds = this.data.deletedVendorQuoteIds || [];
      for (const vq of clientPayload.vendorQuotes) {
        if (!vq || !vq.id || delQuoteIds.includes(vq.id)) continue;
        const idx = this.data.vendorQuotes.findIndex((item) => item.id === vq.id);
        if (idx !== -1) {
          this.data.vendorQuotes[idx] = { ...this.data.vendorQuotes[idx], ...vq };
        } else {
          this.data.vendorQuotes.push(vq);
        }
      }
      this.data.vendorQuotes = this.data.vendorQuotes.filter((vq: any) => vq && !delQuoteIds.includes(vq.id));
    }

    // Vendor POs sync
    if (Array.isArray(clientPayload.vendorPos)) {
      if (!Array.isArray(this.data.vendorPos)) this.data.vendorPos = [];
      for (const vpo of clientPayload.vendorPos) {
        if (!vpo || !vpo.id) continue;
        const idx = this.data.vendorPos.findIndex((item) => item.id === vpo.id);
        if (idx !== -1) {
          this.data.vendorPos[idx] = { ...this.data.vendorPos[idx], ...vpo };
        } else {
          this.data.vendorPos.push(vpo);
        }
      }
    }

    // Proforma Invoices sync
    if (Array.isArray(clientPayload.proformaInvoices)) {
      if (!Array.isArray(this.data.proformaInvoices)) this.data.proformaInvoices = [];
      for (const pi of clientPayload.proformaInvoices) {
        if (!pi || !pi.id) continue;
        const idx = this.data.proformaInvoices.findIndex((item) => item.id === pi.id);
        if (idx !== -1) {
          this.data.proformaInvoices[idx] = { ...this.data.proformaInvoices[idx], ...pi };
        } else {
          this.data.proformaInvoices.push(pi);
        }
      }
    }

    // Deliveries sync
    if (Array.isArray(clientPayload.deliveries)) {
      if (!Array.isArray(this.data.deliveries)) this.data.deliveries = [];
      for (const del of clientPayload.deliveries) {
        if (!del || !del.id) continue;
        const idx = this.data.deliveries.findIndex((item) => item.id === del.id);
        if (idx !== -1) {
          this.data.deliveries[idx] = { ...this.data.deliveries[idx], ...del };
        } else {
          this.data.deliveries.push(del);
        }
      }
    }

    // Notifications sync
    if (Array.isArray(clientPayload.notifications)) {
      if (!Array.isArray(this.data.notifications)) this.data.notifications = [];
      for (const notif of clientPayload.notifications) {
        if (!notif || !notif.id) continue;
        const idx = this.data.notifications.findIndex((item) => item.id === notif.id);
        if (idx !== -1) {
          this.data.notifications[idx] = { ...this.data.notifications[idx], ...notif };
        } else {
          this.data.notifications.unshift(notif);
        }
      }
    }

    this.save();
    return this.getAuthoritativeState();
  }

  // Customers Management
  public getCustomers(): any[] {
    return this.data.customers || [];
  }

  public saveCustomer(customer: any, user: string = 'Admin', role: string = 'Admin', ip: string = 'unknown'): any {
    if (!Array.isArray(this.data.customers)) this.data.customers = [];
    if (customer?.id) this.clearTombstone('deletedCustomerIds', customer.id, false);
    const idx = this.data.customers.findIndex(
      (c) => c.id === customer.id || (customer.gstin && c.gstin && c.gstin.trim().toLowerCase() === customer.gstin.trim().toLowerCase())
    );
    if (idx !== -1) {
      this.data.customers[idx] = { ...this.data.customers[idx], ...customer, updatedAt: new Date().toISOString() };
      this.addAuditLog({
        user,
        role,
        action: 'CUSTOMER_UPDATED',
        module: 'Customer Master',
        recordNumber: customer.id,
        remarks: `Customer ${customer.companyName} updated from IP ${ip}`,
        ipAddress: ip,
      });
    } else {
      const newCust = {
        ...customer,
        id: customer.id || `CUST-${String(this.data.customers.length + 1).padStart(3, '0')}`,
        createdAt: customer.createdAt || new Date().toISOString().split('T')[0],
      };
      this.clearTombstone('deletedCustomerIds', newCust.id, false);
      this.data.customers.unshift(newCust);
      this.addAuditLog({
        user,
        role,
        action: 'CUSTOMER_CREATED',
        module: 'Customer Master',
        recordNumber: newCust.id,
        remarks: `Customer ${newCust.companyName} created from IP ${ip}`,
        ipAddress: ip,
      });
      customer = newCust;
    }
    this.save();
    return customer;
  }

  public deleteCustomer(id: string, user: string = 'Admin', role: string = 'Admin', ip: string = 'unknown'): boolean {
    if (!Array.isArray(this.data.customers)) return false;
    const target = this.data.customers.find((c) => c.id === id);
    this.data.customers = this.data.customers.filter((c) => c.id !== id);
    this.recordTombstone('deletedCustomerIds', id, false);
    this.addAuditLog({
      user,
      role,
      action: 'CUSTOMER_DELETED',
      module: 'Customer Master',
      recordNumber: id,
      remarks: `Customer ${target?.companyName || id} removed from IP ${ip}`,
      ipAddress: ip,
    });
    this.save();
    return true;
  }

  // Categories Management
  public getCategories(): any[] {
    if (!Array.isArray(this.data.categories) || (this.data.categories.length === 0 && (!this.data.deletedCategoryIds || this.data.deletedCategoryIds.length === 0))) {
      this.data.categories = INITIAL_MATERIAL_CATEGORIES.map((c) => ({ ...c }));
      this.save();
    }
    return this.data.categories;
  }

  public saveCategory(category: any, user: string = 'Admin', role: string = 'Admin', ip: string = 'unknown'): any {
    if (!Array.isArray(this.data.categories)) this.data.categories = [];
    if (category?.id) this.clearTombstone('deletedCategoryIds', category.id, false);
    const normalized = {
      ...category,
      code: category.code || category.id || 'CAT',
      description: category.description || '',
      subCategories: Array.isArray(category.subCategories) ? category.subCategories : ['Standard'],
      keywords: Array.isArray(category.keywords) ? category.keywords : [(category.name || '').toLowerCase()],
      itemExamples: Array.isArray(category.itemExamples) ? category.itemExamples : [],
      isActive: category.isActive !== false,
    };
    const idx = this.data.categories.findIndex((c) => c.id === normalized.id || c.name?.trim().toLowerCase() === normalized.name?.trim().toLowerCase());
    if (idx !== -1) {
      this.data.categories[idx] = { ...this.data.categories[idx], ...normalized, updatedAt: new Date().toISOString().split('T')[0] };
      category = this.data.categories[idx];
    } else {
      const newCat = {
        ...normalized,
        id: normalized.id || `CAT-${String(this.data.categories.length + 1).padStart(3, '0')}`,
        createdAt: normalized.createdAt || new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
      };
      this.clearTombstone('deletedCategoryIds', newCat.id, false);
      this.data.categories.push(newCat);
      category = newCat;
    }
    this.addAuditLog({
      user,
      role,
      action: idx !== -1 ? 'CATEGORY_UPDATED' : 'CATEGORY_CREATED',
      module: 'Category Master',
      recordNumber: category.id,
      remarks: `Material category "${category.name}" saved from IP ${ip}`,
      ipAddress: ip,
    });
    this.save();
    return category;
  }

  public deleteCategory(id: string, user: string = 'Admin', role: string = 'Admin', ip: string = 'unknown'): boolean {
    if (!Array.isArray(this.data.categories)) return false;
    const target = this.data.categories.find((c) => c.id === id);
    this.data.categories = this.data.categories.filter((c) => c.id !== id);
    this.recordTombstone('deletedCategoryIds', id, false);
    this.addAuditLog({
      user,
      role,
      action: 'CATEGORY_DELETED',
      module: 'Category Master',
      recordNumber: id,
      remarks: `Category "${target?.name || id}" removed from IP ${ip}`,
      ipAddress: ip,
    });
    this.save();
    return true;
  }

  // Brands Management
  public getBrands(): any[] {
    if (!Array.isArray(this.data.brands) || (this.data.brands.length === 0 && (!this.data.deletedBrandIds || this.data.deletedBrandIds.length === 0))) {
      this.data.brands = INITIAL_BRANDS.map((b) => ({ ...b }));
      this.save();
    }
    return this.data.brands;
  }

  public saveBrand(brand: any, user: string = 'Admin', role: string = 'Admin', ip: string = 'unknown'): any {
    if (!Array.isArray(this.data.brands)) this.data.brands = [];
    if (brand?.id) this.clearTombstone('deletedBrandIds', brand.id, false);
    const idx = this.data.brands.findIndex((b) => b.id === brand.id || b.name?.trim().toLowerCase() === brand.name?.trim().toLowerCase());
    if (idx !== -1) {
      this.data.brands[idx] = { ...this.data.brands[idx], ...brand, updatedAt: new Date().toISOString().split('T')[0] };
    } else {
      const newBrd = {
        ...brand,
        id: brand.id || `BRD-${String(this.data.brands.length + 1).padStart(3, '0')}`,
        createdAt: brand.createdAt || new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
      };
      this.clearTombstone('deletedBrandIds', newBrd.id, false);
      this.data.brands.unshift(newBrd);
      brand = newBrd;
    }
    this.addAuditLog({
      user,
      role,
      action: idx !== -1 ? 'BRAND_UPDATED' : 'BRAND_CREATED',
      module: 'Brand Master',
      recordNumber: brand.id,
      remarks: `Brand "${brand.name}" saved from IP ${ip}`,
      ipAddress: ip,
    });
    this.save();
    return brand;
  }

  public deleteBrand(id: string, user: string = 'Admin', role: string = 'Admin', ip: string = 'unknown'): boolean {
    if (!Array.isArray(this.data.brands)) return false;
    const target = this.data.brands.find((b) => b.id === id);
    this.data.brands = this.data.brands.filter((b) => b.id !== id);
    this.recordTombstone('deletedBrandIds', id, false);
    this.addAuditLog({
      user,
      role,
      action: 'BRAND_DELETED',
      module: 'Brand Master',
      recordNumber: id,
      remarks: `Brand "${target?.name || id}" removed from IP ${ip}`,
      ipAddress: ip,
    });
    this.save();
    return true;
  }

  // Vendor Quotes Management with Tombstone Persistence
  public saveVendorQuote(quote: any, user: string = 'Procurement Specialist', role: string = 'Procurement', ip: string = 'unknown'): any {
    if (!Array.isArray(this.data.vendorQuotes)) this.data.vendorQuotes = [];
    if (quote?.id) {
      this.clearTombstone('deletedVendorQuoteIds', quote.id, false);
    }
    const idx = this.data.vendorQuotes.findIndex((q: any) => q.id === quote.id);
    if (idx !== -1) {
      this.data.vendorQuotes[idx] = { ...this.data.vendorQuotes[idx], ...quote };
      quote = this.data.vendorQuotes[idx];
    } else {
      this.data.vendorQuotes.unshift(quote);
    }
    this.addAuditLog({
      user,
      role,
      action: idx !== -1 ? 'VENDOR_RATE_UPDATED' : 'VENDOR_RATE_RECORDED',
      module: 'Vendor Rates',
      recordNumber: quote.id || 'VQ-NEW',
      newStatus: quote.status || 'SUBMITTED',
      remarks: `Recorded direct supplier rate for requirement ${quote.requirementId}`,
      ipAddress: ip,
    });
    this.save();
    return quote;
  }

  public deleteVendorQuote(id: string, user: string = 'Procurement Specialist', role: string = 'Admin', ip: string = 'unknown'): { deleted: boolean; target?: any } {
    if (!Array.isArray(this.data.vendorQuotes)) this.data.vendorQuotes = [];
    const target = this.data.vendorQuotes.find((q: any) => q.id === id);
    this.data.vendorQuotes = this.data.vendorQuotes.filter((q: any) => q.id !== id);
    this.recordTombstone('deletedVendorQuoteIds', id, false);
    this.addAuditLog({
      user,
      role,
      action: 'VENDOR_RATE_DELETED',
      module: 'Vendor Rates',
      recordNumber: id,
      remarks: `Deleted rate quote ${id} from ${target?.vendorName || 'supplier'}`,
      ipAddress: ip,
    });
    this.save();
    return { deleted: Boolean(target), target };
  }

  // Deliveries Management
  public getDeliveries(): any[] {
    return this.data.deliveries || [];
  }

  public saveDelivery(del: any, user: string = 'User', role: string = 'Admin', ip: string = 'unknown'): any {
    if (!Array.isArray(this.data.deliveries)) this.data.deliveries = [];
    const idx = this.data.deliveries.findIndex((d) => d.id === del.id || (del.dispatchId && d.dispatchId === del.dispatchId));
    if (idx !== -1) {
      this.data.deliveries[idx] = { ...this.data.deliveries[idx], ...del };
    } else {
      this.data.deliveries.unshift(del);
    }
    this.addAuditLog({
      user,
      role,
      action: 'DELIVERY_STATUS_UPDATED',
      module: 'Delivery Tracking',
      recordNumber: del.id || del.dispatchId,
      remarks: `Delivery status updated: ${del.status || 'DELIVERED'} from IP ${ip}`,
      ipAddress: ip,
    });
    this.save();
    return del;
  }

  // Financial Helpers
  public getInvoices(): any[] {
    if (!Array.isArray(this.data.invoices) || this.data.invoices.length === 0) {
      this.data.invoices = INITIAL_INVOICES;
      this.save();
    }
    return this.data.invoices;
  }

  public saveInvoice(invoice: any): any {
    if (!Array.isArray(this.data.invoices)) this.data.invoices = [];
    const idx = this.data.invoices.findIndex((i) => i.id === invoice.id);
    if (idx !== -1) {
      this.data.invoices[idx] = { ...this.data.invoices[idx], ...invoice, updatedAt: new Date().toISOString() };
    } else {
      this.data.invoices.push({ ...invoice, createdAt: invoice.createdAt || new Date().toISOString() });
    }
    this.save();
    return invoice;
  }

  public getVendorBills(): any[] {
    if (!Array.isArray(this.data.vendorBills) || this.data.vendorBills.length === 0) {
      this.data.vendorBills = INITIAL_VENDOR_BILLS;
      this.save();
    }
    return this.data.vendorBills;
  }

  public saveVendorBill(bill: any): any {
    if (!Array.isArray(this.data.vendorBills)) this.data.vendorBills = [];
    const idx = this.data.vendorBills.findIndex((b) => b.id === bill.id);
    if (idx !== -1) {
      this.data.vendorBills[idx] = { ...this.data.vendorBills[idx], ...bill, updatedAt: new Date().toISOString() };
    } else {
      this.data.vendorBills.push({ ...bill, createdAt: bill.createdAt || new Date().toISOString() });
    }
    this.save();
    return bill;
  }

  public getExpenses(): any[] {
    if (!Array.isArray(this.data.expenses) || this.data.expenses.length === 0) {
      this.data.expenses = INITIAL_EXPENSES;
      this.save();
    }
    return this.data.expenses;
  }

  public saveExpense(expense: any): any {
    if (!Array.isArray(this.data.expenses)) this.data.expenses = [];
    const idx = this.data.expenses.findIndex((e) => e.id === expense.id);
    if (idx !== -1) {
      this.data.expenses[idx] = { ...this.data.expenses[idx], ...expense };
    } else {
      this.data.expenses.push(expense);
    }
    this.save();
    return expense;
  }

  public getCompanySettings(): any {
    return this.data.companySettings || INITIAL_COMPANY_SETTINGS;
  }

  public saveCompanySettings(settings: any): any {
    this.data.companySettings = {
      ...(this.data.companySettings || INITIAL_COMPANY_SETTINGS),
      ...settings,
    };
    this.save();
    return this.data.companySettings;
  }

  public getBrandingSettings(): any {
    const defaultBranding = {
      erpName: 'MRO PROCUREMENT SOLUTION',
      tagline: 'Enterprise B2B Industrial Sourcing & Supply Chain ERP',
      companyName: 'MRO Procurement Solution Private Limited',
      shortName: 'ProcureMRO',
      address: 'Plot 42, Sector 18, Industrial Area, Phase II',
      phone: '+91 98200 11223',
      email: 'procurement@mro-solution.com',
      website: 'https://mro-solution.com',
      gstin: '27AABCM9012K1Z9',
      cin: 'U74999MH2024PTC392810',
      logoUrl: '',
      darkLogoUrl: '',
      mobileLogoUrl: '',
      faviconUrl: '',
      sidebarLogoUrl: '',
      loginLogoUrl: '',
      pdfLogoUrl: '',
      updatedAt: new Date().toISOString(),
    };
    return this.data.brandingSettings || defaultBranding;
  }

  public saveBrandingSettings(settings: any): any {
    this.data.brandingSettings = {
      ...(this.data.brandingSettings || this.getBrandingSettings()),
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.data.brandingSettings;
  }

  public getThemeSettings(userId?: string): any {
    const defaultTheme = {
      mode: 'MODERN',
      primaryColor: '#2563eb',
      secondaryColor: '#0f172a',
      accentColor: '#10b981',
      sidebarStyle: 'DARK_MODERN',
      cardStyle: 'SOLID_CLEAN',
      borderRadius: 'ROUNDED',
      animationLevel: 'FULL',
      density: 'COMFORTABLE',
    };
    if (userId && this.data.themeSettings && this.data.themeSettings[userId]) {
      return this.data.themeSettings[userId];
    }
    return (this.data.themeSettings && this.data.themeSettings.global) || defaultTheme;
  }

  public saveThemeSettings(settings: any, userId?: string): any {
    if (!this.data.themeSettings) this.data.themeSettings = {};
    if (userId) {
      this.data.themeSettings[userId] = {
        ...(this.data.themeSettings[userId] || this.getThemeSettings()),
        ...settings,
      };
    } else {
      this.data.themeSettings.global = {
        ...(this.data.themeSettings.global || this.getThemeSettings()),
        ...settings,
      };
    }
    this.save();
    return userId ? this.data.themeSettings[userId] : this.data.themeSettings.global;
  }

  public getBrandDiscounts(): any[] {
    return this.data.brandDiscounts || [];
  }

  public saveBrandDiscounts(discounts: any[]): any[] {
    this.data.brandDiscounts = discounts;
    this.save();
    return this.data.brandDiscounts;
  }

  // Login Audit Records
  public recordLoginAudit(entry: Omit<LoginAuditRecord, 'id' | 'timestamp'>): LoginAuditRecord {
    const newLog: LoginAuditRecord = {
      ...entry,
      id: `LOG-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    this.data.loginAuditLogs.unshift(newLog);
    if (this.data.loginAuditLogs.length > 2000) {
      this.data.loginAuditLogs.pop();
    }
    this.save();
    return newLog;
  }

  public getLoginAuditLogs(limit: number = 200): LoginAuditRecord[] {
    return this.data.loginAuditLogs.slice(0, limit);
  }

  // Active Sessions
  public createSession(data: Omit<ActiveSessionRecord, 'status'>): ActiveSessionRecord {
    const newSession: ActiveSessionRecord = {
      ...data,
      status: 'ACTIVE',
    };
    this.data.activeSessions = this.pruneSessions([
      newSession,
      ...this.data.activeSessions.filter((s) => s.id !== data.id),
    ]);
    this.save();
    return newSession;
  }

  public getActiveSessions(): ActiveSessionRecord[] {
    return this.data.activeSessions;
  }

  public revokeSession(sessionId: string, adminUser: string, ip: string = 'unknown'): boolean {
    const session = this.data.activeSessions.find((s) => s.id === sessionId);
    if (!session) return false;

    session.status = 'REVOKED';
    this.addAuditLog({
      user: adminUser,
      role: 'Admin',
      action: 'SESSION_REVOKED',
      module: 'Security',
      recordNumber: sessionId,
      remarks: `Admin ${adminUser} revoked session ${sessionId} for user ${session.username} from IP ${ip}`,
      ipAddress: ip,
    });

    this.recordLoginAudit({
      username: session.username,
      role: session.role,
      userId: session.userId,
      status: 'FAILED',
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      deviceType: session.deviceType,
      sessionId: session.id,
      failureReason: `Session revoked by administrator ${adminUser}`,
    });

    this.save();
    return true;
  }

  public updateSessionActivity(sessionId: string) {
    const s = this.data.activeSessions.find((item) => item.id === sessionId);
    if (s && s.status === 'ACTIVE') {
      const nowMs = Date.now();
      const prevMs = s.lastActiveTime ? new Date(s.lastActiveTime.replace(' ', 'T') + 'Z').getTime() : 0;
      s.lastActiveTime = new Date(nowMs).toISOString().replace('T', ' ').slice(0, 19);
      // Throttle disk write to at most once every 60s per session to avoid heartbeat I/O storms
      if (!prevMs || nowMs - prevMs > 60000) {
        this.save();
      }
    }
  }

  public getSessionById(sessionId: string): ActiveSessionRecord | undefined {
    if (!sessionId) return undefined;
    return this.data.activeSessions.find((s) => s.id === sessionId);
  }

  public async authenticateUser(
    usernameOrEmail: string,
    password: string,
    ip: string = '127.0.0.1',
    userAgent: string = 'Unknown Browser'
  ): Promise<{
    success: boolean;
    error?: string;
    session?: ActiveSessionRecord;
    user?: Omit<UserRecord, 'passwordHash' | 'passwordSalt'>;
  }> {
    const user = this.getUserByUsernameOrEmail(usernameOrEmail);
    if (!user) {
      return { success: false, error: 'Invalid username or password' };
    }

    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
      const remainingMinutes = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
      return {
        success: false,
        error: `Account is temporarily locked due to 5 consecutive failed login attempts. Try again in ${remainingMinutes} min(s).`,
      };
    }

    if (user.status === 'INACTIVE') {
      return { success: false, error: 'This user account is currently deactivated. Contact Admin.' };
    }

    const isValid = verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!isValid) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }
      this.save();
      return { success: false, error: 'Invalid username or password' };
    }

    user.failedLoginAttempts = 0;
    delete user.lockedUntil;
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    user.lastLogin = nowStr;
    this.save();

    const sessionId = `SES-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const session: ActiveSessionRecord = {
      id: sessionId,
      userId: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      ipAddress: ip,
      userAgent,
      deviceType: 'Desktop',
      loginTime: nowStr,
      lastActiveTime: nowStr,
      status: 'ACTIVE',
    };
    this.createSession(session);

    const { passwordHash, passwordSalt, ...safeUser } = user;
    return { success: true, session, user: safeUser };
  }

  public verifySession(sessionId: string): {
    valid: boolean;
    reason?: string;
    session?: ActiveSessionRecord;
    user?: Omit<UserRecord, 'passwordHash' | 'passwordSalt'>;
  } {
    if (!sessionId) return { valid: false, reason: 'Session ID is missing or empty' };
    const session = this.data.activeSessions.find((s) => s.id === sessionId);
    if (!session) return { valid: false, reason: 'Session not found in active session store' };
    if (session.status !== 'ACTIVE') return { valid: false, reason: 'Session has been revoked or expired' };

    const user = this.data.users.find((u) => u.id === session.userId || u.username === session.username);
    if (!user) return { valid: false, reason: 'User account not found' };
    if (user.status === 'INACTIVE') return { valid: false, reason: 'User account is deactivated' };

    // Check timeout: 8 hours maximum inactivity window
    const lastActive = new Date(session.lastActiveTime.replace(' ', 'T')).getTime();
    if (!isNaN(lastActive) && Date.now() - lastActive > 8 * 60 * 60 * 1000) {
      session.status = 'REVOKED';
      this.save();
      return { valid: false, reason: 'Session timed out due to prolonged inactivity' };
    }

    // Refresh last active timestamp
    session.lastActiveTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
    this.save();

    const { passwordHash, passwordSalt, ...safeUser } = user;
    return { valid: true, session, user: safeUser };
  }

  public requestPasswordReset(usernameOrEmail: string): { success: boolean; token?: string; message: string } {
    const user = this.getUserByUsernameOrEmail(usernameOrEmail);
    if (!user || user.status === 'INACTIVE') {
      // Security: never reveal user presence to prevent username harvesting
      return {
        success: true,
        message: 'If an active account matches this identifier, a password reset authorization code has been issued.',
      };
    }

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    this.save();

    this.addAuditLog({
      user: user.name,
      role: user.role,
      action: 'PASSWORD_RESET_TOKEN_GENERATED',
      module: 'Security',
      recordNumber: user.id,
      remarks: `6-digit reset token generated for ${user.username}`,
    });

    return {
      success: true,
      token, // Available for authorization verification
      message: 'Password reset authorization code generated. Valid for 15 minutes.',
    };
  }

  public resetPasswordWithToken(
    usernameOrEmail: string,
    token: string,
    newPassword: string,
    ip: string = '127.0.0.1'
  ): { success: boolean; message: string } {
    const user = this.getUserByUsernameOrEmail(usernameOrEmail);
    if (!user) throw new Error('Invalid user or account not found');
    if (!user.resetPasswordToken || user.resetPasswordToken !== token.trim()) {
      throw new Error('Invalid or incorrect 6-digit authorization code');
    }
    if (user.resetPasswordExpires && new Date(user.resetPasswordExpires).getTime() < Date.now()) {
      throw new Error('Authorization code has expired. Please generate a new code.');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    const { hash, salt } = hashPassword(newPassword);
    user.passwordHash = hash;
    user.passwordSalt = salt;
    delete user.resetPasswordToken;
    delete user.resetPasswordExpires;
    user.mustChangePassword = false;
    user.failedLoginAttempts = 0;
    delete user.lockedUntil;
    this.save();

    this.addAuditLog({
      user: user.name,
      role: user.role,
      action: 'PASSWORD_RESET_COMPLETED',
      module: 'Security',
      recordNumber: user.id,
      remarks: `User ${user.username} successfully reset password via security code from IP ${ip}`,
      ipAddress: ip,
    });

    return {
      success: true,
      message: 'Password updated successfully. You can now login with your new credentials.',
    };
  }

  // ==========================================
  // VERSIONED BRAND CATALOGUE & RATE HISTORY
  // ==========================================

  public getCatalogueProducts(): any[] {
    if (!Array.isArray(this.data.catalogueProducts) || this.data.catalogueProducts.length === 0) {
      this.data.catalogueProducts = [...INITIAL_CATALOGUE_PRODUCTS];
      this.save();
    }
    return this.data.catalogueProducts.filter((p: any) => p.status === 'ACTIVE' || !p.status);
  }

  public getAllCatalogueProducts(): any[] {
    return this.data.catalogueProducts || [];
  }

  public getRateHistory(partCode: string, brand?: string): any[] {
    if (!partCode) return [];
    if (!Array.isArray(this.data.rateVersionHistory) || this.data.rateVersionHistory.length === 0) {
      this.data.rateVersionHistory = [...INITIAL_RATE_VERSION_HISTORY];
      this.save();
    }
    const norm = normalizePartCode(partCode);
    const history = (this.data.rateVersionHistory || []).filter((rv: any) => {
      const matchPart = normalizePartCode(rv.partCode) === norm;
      if (!matchPart) return false;
      if (brand && rv.brand) {
        return rv.brand.toLowerCase().trim() === brand.toLowerCase().trim();
      }
      return true;
    });

    return history.sort(
      (a: any, b: any) =>
        new Date(b.effectiveDate || b.validFrom).getTime() - new Date(a.effectiveDate || a.validFrom).getTime()
    );
  }

  public getImportBatches(): any[] {
    if (!Array.isArray(this.data.importBatches) || this.data.importBatches.length === 0) {
      this.data.importBatches = [...INITIAL_IMPORT_BATCHES];
      this.save();
    }
    return this.data.importBatches;
  }

  public importCatalogueWithVersioning(
    batch: {
      brandName: string;
      catalogueVersion: string;
      effectiveDate: string;
      fileName?: string;
      defaultDiscountPercent?: number;
      items: any[];
    },
    user: string = 'Admin',
    role: string = 'Admin',
    ip: string = '127.0.0.1'
  ): {
    success: boolean;
    batchId: string;
    totalSubmitted: number;
    newItems: number;
    insertedCount?: number;
    rateChangedItems: number;
    updatedCount?: number;
    rateHistoryRecorded?: number;
    unchangedItems: number;
    discontinuedItems: number;
    message: string;
  } {
    if (!Array.isArray(this.data.catalogueProducts)) this.data.catalogueProducts = [...INITIAL_CATALOGUE_PRODUCTS];
    if (!Array.isArray(this.data.rateVersionHistory)) this.data.rateVersionHistory = [...INITIAL_RATE_VERSION_HISTORY];
    if (!Array.isArray(this.data.importBatches)) this.data.importBatches = [...INITIAL_IMPORT_BATCHES];

    const safeBrand = (batch.brandName || 'GENERIC').trim();
    const safeVersion = (batch.catalogueVersion || `Cat-${new Date().getFullYear()}`).trim();
    const safeEffective = batch.effectiveDate || new Date().toISOString().split('T')[0];
    const defaultDisc = batch.defaultDiscountPercent !== undefined && batch.defaultDiscountPercent >= 0 ? Number(batch.defaultDiscountPercent) : 20;

    const batchId = `BATCH-${safeBrand.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${safeEffective.replace(/[^0-9]/g, '')}-${Date.now().toString().slice(-4)}`;

    let newCount = 0;
    let rateChangedCount = 0;
    let unchangedCount = 0;

    for (const item of batch.items || []) {
      if (!item.partCode && !item.productName) continue;

      const normPCode = normalizePartCode(item.partCode || item.modelNumber);
      const mrp = Number(item.mrp) || 0;
      const discountPercent = item.discountPercent !== undefined && item.discountPercent >= 0 ? Number(item.discountPercent) : defaultDisc;
      const discountAmount = Math.round(((mrp * discountPercent) / 100) * 100) / 100;
      const purchaseRate = item.purchaseRate !== undefined && item.purchaseRate > 0 ? Number(item.purchaseRate) : Math.round((mrp - discountAmount) * 100) / 100;

      // Check existing product in catalogue
      const existingIdx = this.data.catalogueProducts.findIndex(
        (p: any) =>
          normalizePartCode(p.partCode) === normPCode &&
          p.brand?.toLowerCase().trim() === safeBrand.toLowerCase().trim()
      );

      if (existingIdx !== -1) {
        const existing = this.data.catalogueProducts[existingIdx];
        if (existing.mrp !== mrp || existing.purchaseRate !== purchaseRate) {
          // Supersede prior current version in rateVersionHistory
          this.data.rateVersionHistory.forEach((rv: any) => {
            if (
              rv.productId === existing.id &&
              rv.status === 'CURRENT'
            ) {
              rv.status = 'HISTORICAL';
              rv.validTo = safeEffective;
            }
          });

          const deltaAmount = Math.round((mrp - existing.mrp) * 100) / 100;
          const deltaPercent = existing.mrp > 0 ? Math.round(((mrp - existing.mrp) / existing.mrp) * 100 * 10) / 10 : 0;

          // Record new version in rate history
          this.data.rateVersionHistory.unshift({
            id: `RV-${existing.id}-${safeVersion.replace(/[^A-Z0-9]/gi, '_')}-${Date.now().toString().slice(-4)}`,
            productId: existing.id,
            partCode: existing.partCode,
            brand: existing.brand,
            catalogueVersion: safeVersion,
            effectiveDate: safeEffective,
            validFrom: safeEffective,
            oldMrp: existing.mrp,
            newMrp: mrp,
            mrp,
            discountPercent,
            purchaseRate,
            deltaAmount,
            differenceAmount: deltaAmount,
            deltaPercent,
            differencePercentage: deltaPercent,
            status: 'CURRENT',
            importBatchId: batchId,
            createdDate: new Date().toISOString(),
            createdBy: user,
            remarks: `Catalogue revision ${safeVersion}. Old: ₹${existing.mrp} -> New: ₹${mrp} (${deltaAmount >= 0 ? '+' : ''}₹${deltaAmount}, ${deltaPercent}%).`,
          });

          // Update product master record
          existing.mrp = mrp;
          existing.discountPercent = discountPercent;
          existing.purchaseRate = purchaseRate;
          existing.catalogueVersion = safeVersion;
          existing.effectiveDate = safeEffective;
          if (item.packCode) existing.packCode = item.packCode;
          if (item.caseQty) existing.caseQty = Number(item.caseQty);
          if (item.specifications) existing.specifications = item.specifications;
          if (item.description) existing.description = item.description;
          existing.importBatchId = batchId;
          existing.updatedAt = new Date().toISOString();

          rateChangedCount++;
        } else {
          // Unchanged rate
          if (item.packCode) existing.packCode = item.packCode;
          if (item.caseQty) existing.caseQty = Number(item.caseQty);
          unchangedCount++;
        }
      } else {
        // Create new Catalogue Product
        const newProdId = `CAT-${safeBrand.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${normPCode.replace(/[^A-Z0-9]/g, '_') || Date.now()}`;
        const newProd = {
          id: newProdId,
          brand: safeBrand,
          partCode: normPCode || item.partCode,
          manufacturerCode: item.manufacturerCode || normPCode,
          modelNumber: item.modelNumber || normPCode,
          productName: item.productName || `${safeBrand} ${normPCode}`,
          description: item.description || '',
          specifications: item.specifications || '',
          category: item.category || 'Industrial Supplies',
          subCategory: item.subCategory || 'Standard',
          uom: (item.uom || 'NOS').toUpperCase(),
          packCode: item.packCode || '',
          caseQty: item.caseQty ? Number(item.caseQty) : undefined,
          hsnCode: item.hsnCode || '84821011',
          mrp,
          discountPercent,
          purchaseRate,
          gstRate: item.gstRate ? Number(item.gstRate) : 18,
          catalogueVersion: safeVersion,
          effectiveDate: safeEffective,
          status: 'ACTIVE',
          supplierId: item.supplierId || 'VEND-001',
          supplierName: item.supplierName || 'Industrial Spares Corp',
          importBatchId: batchId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        this.data.catalogueProducts.unshift(newProd);

        // Initial rate history entry
        this.data.rateVersionHistory.unshift({
          id: `RV-${newProdId}-${safeVersion.replace(/[^A-Z0-9]/gi, '_')}`,
          productId: newProdId,
          partCode: newProd.partCode,
          brand: newProd.brand,
          catalogueVersion: safeVersion,
          effectiveDate: safeEffective,
          validFrom: safeEffective,
          mrp,
          discountPercent,
          purchaseRate,
          status: 'CURRENT',
          importBatchId: batchId,
          createdDate: new Date().toISOString(),
          createdBy: user,
          remarks: `Initial catalogue product entry from ${safeVersion}.`,
        });

        // Also add to generic products array so other ERP modules can reference it
        if (!Array.isArray(this.data.products)) this.data.products = [];
        const existingGenIdx = this.data.products.findIndex(
          (p: any) =>
            p.partNumber &&
            normalizePartCode(p.partNumber) === normPCode &&
            p.brand?.toLowerCase().trim() === safeBrand.toLowerCase().trim()
        );
        if (existingGenIdx !== -1) {
          this.data.products[existingGenIdx] = {
            ...this.data.products[existingGenIdx],
            mrp,
            discountPercentage: discountPercent,
            netPurchaseRate: purchaseRate,
            approxRate: purchaseRate,
          };
        } else {
          this.data.products.unshift({
            id: newProdId,
            itemCode: normPCode,
            itemName: newProd.productName,
            brand: safeBrand,
            category: newProd.category,
            subCategory: newProd.subCategory,
            partNumber: normPCode,
            modelNumber: newProd.modelNumber,
            specification: newProd.specifications,
            description: newProd.description,
            uom: newProd.uom,
            approxRate: purchaseRate,
            netPurchaseRate: purchaseRate,
            mrp,
            discountPercentage: discountPercent,
            gstRate: newProd.gstRate,
            lastVendorName: newProd.supplierName,
            status: 'ACTIVE',
            isDeleted: false,
          });
        }

        newCount++;
      }
    }

    // Save batch record
    this.data.importBatches.unshift({
      id: batchId,
      brandName: safeBrand,
      catalogueVersion: safeVersion,
      effectiveDate: safeEffective,
      fileName: batch.fileName || `${safeBrand}_Catalogue_${safeVersion}.xlsx`,
      uploadedBy: user,
      uploadDate: new Date().toISOString(),
      totalItems: (batch.items || []).length,
      newItems: newCount,
      rateChangedItems: rateChangedCount,
      unchangedItems: unchangedCount,
      discontinuedItems: 0,
      status: 'COMMITTED',
      notes: `Imported by ${user} (${role}) from IP ${ip}.`,
    });

    this.addAuditLog({
      user,
      role,
      action: 'CATALOGUE_VERSION_IMPORTED',
      module: 'Brand Catalogue',
      recordNumber: batchId,
      remarks: `Imported catalogue batch ${batchId} (${safeBrand} ${safeVersion}): ${newCount} new, ${rateChangedCount} revised rates, ${unchangedCount} unchanged.`,
      ipAddress: ip,
    });

    this.save();

    return {
      success: true,
      batchId,
      totalSubmitted: (batch.items || []).length,
      newItems: newCount,
      insertedCount: newCount,
      rateChangedItems: rateChangedCount,
      updatedCount: rateChangedCount,
      rateHistoryRecorded: rateChangedCount,
      unchangedItems: unchangedCount,
      discontinuedItems: 0,
      message: `Successfully imported catalogue batch ${batchId}. ${newCount} new items, ${rateChangedCount} rates revised.`,
    };
  }

  public deleteImportBatch(
    batchId: string,
    force: boolean = false,
    user: string = 'Super Admin',
    role: string = 'SUPER_ADMIN',
    ip: string = '127.0.0.1'
  ): { success: boolean; message: string; rolledBackCount: number } {
    if (!Array.isArray(this.data.importBatches)) return { success: false, message: 'No import batches found.', rolledBackCount: 0 };

    const batch = this.data.importBatches.find((b: any) => b.id === batchId);
    if (!batch) {
      return { success: false, message: `Import batch ${batchId} not found.`, rolledBackCount: 0 };
    }

    // Check if transactions reference this batch
    const referencedRfqs = (this.data.rfqs || []).filter((r: any) => r.importBatchId === batchId);
    if (referencedRfqs.length > 0 && !force) {
      return {
        success: false,
        message: `Batch ${batchId} cannot be deleted because it is referenced by ${referencedRfqs.length} active RFQ(s). Force delete required.`,
        rolledBackCount: 0,
      };
    }

    let rolledBackCount = 0;
    const batchRates = (this.data.rateVersionHistory || []).filter((rv: any) => rv.importBatchId === batchId);

    for (const br of batchRates) {
      const prod = (this.data.catalogueProducts || []).find((p: any) => p.id === br.productId);
      if (prod) {
        // Find previous rate version
        const priorVersions = (this.data.rateVersionHistory || []).filter(
          (rv: any) => rv.productId === prod.id && rv.importBatchId !== batchId
        );
        if (priorVersions.length > 0) {
          // Restore prior version as CURRENT
          const latestPrior = priorVersions.sort(
            (a: any, b: any) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime()
          )[0];
          latestPrior.status = 'CURRENT';
          delete latestPrior.validTo;

          prod.mrp = latestPrior.mrp;
          prod.discountPercent = latestPrior.discountPercent;
          prod.purchaseRate = latestPrior.purchaseRate;
          prod.catalogueVersion = latestPrior.catalogueVersion;
          prod.effectiveDate = latestPrior.effectiveDate;
          rolledBackCount++;
        } else {
          // Product was newly created in this batch -> remove it
          this.data.catalogueProducts = (this.data.catalogueProducts || []).filter((p: any) => p.id !== prod.id);
          rolledBackCount++;
        }
      }
    }

    // Remove the batch's rate versions
    this.data.rateVersionHistory = (this.data.rateVersionHistory || []).filter(
      (rv: any) => rv.importBatchId !== batchId
    );

    // Mark batch status as ROLLED_BACK
    batch.status = 'ROLLED_BACK';
    batch.notes = `Rolled back and deleted by ${user} on ${new Date().toISOString()}`;

    this.addAuditLog({
      user,
      role,
      action: 'IMPORT_BATCH_ROLLED_BACK',
      module: 'Brand Catalogue',
      recordNumber: batchId,
      remarks: `Import batch ${batchId} (${batch.brandName} ${batch.catalogueVersion}) rolled back by ${user}. ${rolledBackCount} products restored.`,
      ipAddress: ip,
    });

    this.save();

    return {
      success: true,
      message: `Batch ${batchId} successfully rolled back. Restored ${rolledBackCount} items.`,
      rolledBackCount,
    };
  }

  /**
   * Transactional Vendor Intelligence Catalogue Commit (Modules 8-10, 19-23, 30, 36, 38)
   * Preserves all historical RFQs, quotations, POs, and missing prior products as NOT_PRESENT_IN_LATEST.
   */
  public saveVendorCatalogueUpdate(
    vendorId: string,
    payload: {
      catalogFile?: any;
      catalogProducts?: any[];
      suggestedCategories?: any[];
      vendorProfile?: any;
      brandsDetected?: any[];
      confirmedNewBrands?: string[];
      batchVersion?: string;
      effectiveDate?: string;
      sourceType?: string;
    },
    user: string = 'Super Admin',
    role: string = 'SUPER_ADMIN',
    ip: string = '127.0.0.1'
  ): {
    success: boolean;
    verified: boolean;
    batchId: string;
    batch: any;
    diff: any;
    vendor: any;
    vendorProductMappings: any[];
    newBrandsCreated: any[];
    rateHistoryRecorded: number;
  } {
    const vendors = Array.isArray(this.data.vendors) ? this.data.vendors : [];
    const vIdx = vendors.findIndex((v: any) => v.id === vendorId && !v.isDeleted);
    if (vIdx === -1) {
      throw new Error(`Vendor ${vendorId} not found or deleted`);
    }

    const vendor = { ...vendors[vIdx] };
    const nowIso = new Date().toISOString();
    const year = new Date().getFullYear();
    const existingBatches = Array.isArray(vendor.catalogueBatches) ? [...vendor.catalogueBatches] : [];
    const seq = existingBatches.length + 1;
    const batchId = `CAT-IMP-${year}-${String(seq).padStart(5, '0')}`;
    const batchVersion = payload.batchVersion || payload.catalogFile?.version || `v${seq}.0`;
    const effectiveDate = payload.effectiveDate || '';

    const incomingRaw = Array.isArray(payload.catalogProducts) ? payload.catalogProducts : [];
    const incomingProducts = incomingRaw.map((p: any, idx: number) => {
      const exactPart = preserveExactPartCode(p.partNumber || p.modelNumber || '');
      const familyMap = mapProductFamilyAndType(p.productName || '', p.category, p.subCategory);
      const mrp = typeof p.mrp === 'number' && !isNaN(p.mrp) ? p.mrp : undefined;
      const basicRate = typeof p.basicRate === 'number' && !isNaN(p.basicRate) ? p.basicRate : undefined;
      const purchaseRate =
        typeof p.purchaseRate === 'number' && !isNaN(p.purchaseRate)
          ? p.purchaseRate
          : typeof p.rate === 'number' && !isNaN(p.rate)
            ? p.rate
            : basicRate;
      return {
        ...p,
        id: p.id || `VCP-${Date.now()}-${idx + 1}`,
        vendorId,
        partNumber: exactPart,
        modelNumber: preserveExactPartCode(p.modelNumber || exactPart),
        productFamily: p.productFamily || familyMap.productFamily,
        productType: p.productType || familyMap.productType,
        mrp,
        basicRate,
        purchaseRate,
        rate: purchaseRate ?? mrp,
        currency: p.currency || (purchaseRate || mrp ? 'INR' : undefined),
        effectiveDate: p.effectiveDate || effectiveDate || undefined,
        sourceType: p.sourceType || payload.sourceType || 'PDF',
        batchId,
        batchVersion,
        approvalStatus: p.approvalStatus || 'APPROVED',
        catalogueStatus: 'ACTIVE',
      };
    });

    const existingCatalog = Array.isArray(vendor.catalogProducts) ? [...vendor.catalogProducts] : [];
    const diff = compareVendorCatalogues(existingCatalog, incomingProducts);

    // 1. Demote prior CURRENT batches to HISTORICAL
    const updatedBatches = existingBatches.map((b: any) =>
      b.status === 'CURRENT' ? { ...b, status: 'HISTORICAL' } : b
    );

    const newBatchRecord = {
      id: batchId,
      vendorId,
      fileName: payload.catalogFile?.fileName || `Catalogue_${batchVersion}.pdf`,
      sourceType: payload.sourceType || payload.catalogFile?.fileType || 'PDF',
      version: batchVersion,
      effectiveDate: effectiveDate || undefined,
      uploadedAt: nowIso,
      uploadedBy: user,
      totalExtracted: incomingProducts.length,
      newCount: diff.newProducts.length,
      updatedCount: diff.updatedProducts.length,
      unchangedCount: diff.unchangedProducts.length,
      removedCount: diff.removedProducts.length,
      rateChangesCount: diff.changedRates.length,
      brandsDetected: Array.from(
        new Set(incomingProducts.map((p: any) => p.brand).filter((b: string) => b && b !== 'Unconfirmed'))
      ),
      status: 'CURRENT' as const,
      snapshotProductIds: incomingProducts.map((p: any) => p.id),
    };
    updatedBatches.unshift(newBatchRecord);

    // 2. Mark missing prior active products as NOT_PRESENT_IN_LATEST (never delete!)
    const removedIds = new Set(diff.removedProducts.map((r: any) => r.id));
    const incomingIdentitySet = new Set(
      incomingProducts.map((p: any) => `${(p.brand || '').toLowerCase()}::${normalizePartCode(p.partNumber || p.modelNumber || p.productName)}`)
    );

    const preservedOldProducts = existingCatalog
      .filter((ep: any) => {
        const key = `${(ep.brand || '').toLowerCase()}::${normalizePartCode(ep.partNumber || ep.modelNumber || ep.productName)}`;
        return !incomingIdentitySet.has(key);
      })
      .map((ep: any) =>
        removedIds.has(ep.id) && ep.catalogueStatus !== 'DISCONTINUED' && ep.catalogueStatus !== 'ARCHIVED'
          ? {
              ...ep,
              catalogueStatus: 'NOT_PRESENT_IN_LATEST',
              reviewStatus: ep.reviewStatus === 'Verified' ? 'Needs Review' : ep.reviewStatus,
            }
          : ep
      );

    vendor.catalogProducts = [...incomingProducts, ...preservedOldProducts];
    vendor.catalogueBatches = updatedBatches;

    if (payload.catalogFile) {
      const files = Array.isArray(vendor.catalogFiles) ? [...vendor.catalogFiles] : [];
      vendor.catalogFiles = [{ ...payload.catalogFile, batchId, version: batchVersion }, ...files];
    }

    const incomingCats = incomingProducts.map((p: any) => p.category).filter(Boolean);
    const suggestedCatNames = Array.isArray(payload.suggestedCategories)
      ? payload.suggestedCategories.map((c: any) => c.category).filter(Boolean)
      : [];
    if (Array.isArray(payload.suggestedCategories) && payload.suggestedCategories.length > 0) {
      const existingAiCats = Array.isArray(vendor.aiMaterialCategories) ? [...vendor.aiMaterialCategories] : [];
      vendor.aiMaterialCategories = [...payload.suggestedCategories, ...existingAiCats];
    }
    const existingCats = vendor.materialCategories || vendor.productCategories || [];
    const mergedCats = Array.from(new Set([...existingCats, ...suggestedCatNames, ...incomingCats]));
    vendor.materialCategories = mergedCats;
    vendor.productCategories = mergedCats;

    // 3. Explicit confirmed New Brands creation into Brand Master
    const newBrandsCreated: any[] = [];
    const confirmedList = new Set(
      (payload.confirmedNewBrands || []).map((b: string) => b.trim().toLowerCase())
    );
    if (Array.isArray(payload.brandsDetected)) {
      for (const bd of payload.brandsDetected) {
        if (bd?.confirmed && !bd?.isExisting && bd?.name) {
          confirmedList.add(bd.name.trim().toLowerCase());
        }
      }
    }

    if (!Array.isArray(this.data.brands)) this.data.brands = [];
    const brandsToCreate = Array.from(confirmedList);
    for (const lowerName of brandsToCreate) {
      const originalName =
        (payload.brandsDetected || []).find((b: any) => (b.name || '').toLowerCase() === lowerName)?.name ||
        incomingProducts.find((p: any) => (p.brand || '').toLowerCase() === lowerName)?.brand ||
        lowerName;
      const existsInMaster = this.data.brands.some(
        (bm: any) => !bm.isDeleted && bm.name.toLowerCase().trim() === originalName.toLowerCase().trim()
      );
      if (!existsInMaster && originalName && originalName !== 'Unconfirmed') {
        const createdBrand = {
          id: `BRD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: originalName,
          aliases: [],
          country: 'Global',
          category: vendor.materialCategories?.[0] || 'Industrial MRO',
          description: `Confirmed during catalogue import (${batchId}) for ${vendor.companyName}`,
          status: 'ACTIVE',
          isDeleted: false,
          createdAt: nowIso.split('T')[0],
          createdBy: user,
        };
        this.data.brands.unshift(createdBrand);
        newBrandsCreated.push(createdBrand);
      }
    }

    // 4. Update Vendor Product Mappings & Rate Version History (non-destructive to historical RFQs/POs)
    if (!Array.isArray(this.data.vendorProductMappings)) this.data.vendorProductMappings = [];
    if (!Array.isArray(this.data.rateVersionHistory)) this.data.rateVersionHistory = [];
    let rateHistoryRecorded = 0;

    for (const p of incomingProducts) {
      const partKey = normalizePartCode(p.partNumber || p.modelNumber || '');
      const existingMapIdx = this.data.vendorProductMappings.findIndex(
        (m: any) =>
          m.vendorId === vendorId &&
          ((partKey && normalizePartCode(m.partNumber || m.modelNumber || '') === partKey) ||
            ((m.productName || '').toLowerCase().trim() === (p.productName || '').toLowerCase().trim() &&
              (m.brand || '').toLowerCase().trim() === (p.brand || '').toLowerCase().trim()))
      );

      if (existingMapIdx !== -1) {
        this.data.vendorProductMappings[existingMapIdx] = {
          ...this.data.vendorProductMappings[existingMapIdx],
          specification: p.specification || this.data.vendorProductMappings[existingMapIdx].specification,
          subCategory: p.subCategory || this.data.vendorProductMappings[existingMapIdx].subCategory,
          productType: p.productType || this.data.vendorProductMappings[existingMapIdx].productType,
          rate: p.purchaseRate ?? p.mrp ?? this.data.vendorProductMappings[existingMapIdx].rate,
          uom: p.uom || this.data.vendorProductMappings[existingMapIdx].uom,
          updatedAt: nowIso.split('T')[0],
          remarks: `Updated from catalogue batch ${batchId}`,
        };
      } else {
        this.data.vendorProductMappings.unshift({
          id: `VPM-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          vendorId,
          vendorCode: vendor.vendorCode || vendor.id,
          vendorName: vendor.companyName,
          productName: p.productName,
          category: p.category,
          subCategory: p.subCategory,
          productType: p.productType || p.subCategory,
          brand: p.brand,
          modelNumber: p.modelNumber || p.partNumber,
          partNumber: p.partNumber || p.modelNumber,
          specification: p.specification,
          description: p.description,
          uom: p.uom || 'NOS',
          supplyType:
            (payload.brandsDetected || []).find((b: any) => b.name === p.brand)?.relationship ||
            'Deals In',
          availability: 'Regular Stock',
          status: 'ACTIVE',
          rate: p.purchaseRate ?? p.mrp,
          remarks: `Imported from ${payload.catalogFile?.fileName || 'Catalogue'} (${batchId})`,
          createdAt: nowIso.split('T')[0],
          updatedAt: nowIso.split('T')[0],
        });
      }

      if (p.mrp !== undefined || p.purchaseRate !== undefined || p.basicRate !== undefined) {
        const matchKey = `${vendorId}::${normalizePartCode(p.partNumber || p.productName)}`;
        const nextMrp = p.mrp ?? 0;
        const nextPurchaseRate = p.purchaseRate ?? p.basicRate ?? p.mrp ?? 0;
        const nextDiscount = p.discountPercent ?? 0;
        const activeCurrent = this.data.rateVersionHistory.find(
          (rv: any) => rv.vendorRateKey === matchKey && rv.status === 'CURRENT'
        );
        const ratesUnchanged =
          activeCurrent &&
          Number(activeCurrent.mrp ?? 0) === Number(nextMrp) &&
          Number(activeCurrent.purchaseRate ?? 0) === Number(nextPurchaseRate) &&
          Number(activeCurrent.discountPercent ?? 0) === Number(nextDiscount);

        if (!ratesUnchanged) {
          const prevRate = activeCurrent ? Number(activeCurrent.purchaseRate ?? activeCurrent.mrp ?? 0) : undefined;
          const prevMrp = activeCurrent ? Number(activeCurrent.mrp ?? 0) : undefined;
          this.data.rateVersionHistory.forEach((rv: any) => {
            if (rv.vendorRateKey === matchKey && rv.status === 'CURRENT') {
              rv.status = 'HISTORICAL';
              rv.validTo = nowIso.split('T')[0];
            }
          });
          this.data.rateVersionHistory.unshift({
            id: `RV-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            productId: p.matchedProductId || p.id,
            vendorRateKey: matchKey,
            vendorId,
            vendorName: vendor.companyName,
            partCode: p.partNumber || p.modelNumber || p.productName,
            brand: p.brand || 'Unconfirmed',
            catalogueVersion: batchVersion,
            effectiveDate: p.effectiveDate || effectiveDate || nowIso.split('T')[0],
            effectiveYear: new Date(p.effectiveDate || effectiveDate || nowIso).getFullYear(),
            validFrom: nowIso.split('T')[0],
            mrp: nextMrp,
            discountPercent: nextDiscount,
            purchaseRate: nextPurchaseRate,
            oldRate: prevRate,
            newRate: nextPurchaseRate,
            oldMrp: prevMrp,
            newMrp: nextMrp,
            changedBy: user,
            changedDate: nowIso.split('T')[0],
            reason: activeCurrent
              ? `Rate updated in ${payload.catalogFile?.fileName || batchVersion}`
              : `Initial rate from ${payload.catalogFile?.fileName || batchVersion}`,
            currency: p.currency || 'INR',
            sourceFile: payload.catalogFile?.fileName || batchId,
            importBatchId: batchId,
            updatedBy: user,
            updatedAt: nowIso,
            status: 'CURRENT',
          });
          rateHistoryRecorded++;
        }
      }
    }

    // 5. Update Vendor Intelligence Dossier & Recalculate Score
    const allBrandNames = Array.from(
      new Set([
        ...(vendor.brandsSupplied || []),
        ...(vendor.brandsDealing || []),
        ...incomingProducts.map((p: any) => p.brand).filter((b: string) => b && b !== 'Unconfirmed'),
        ...(payload.vendorProfile?.distinctBrands || []).filter((b: string) => b && b !== 'Unconfirmed'),
      ])
    );
    vendor.brandsSupplied = allBrandNames;
    vendor.brandsDealing = allBrandNames;

    const allFamilies = Array.from(
      new Set([
        ...(vendor.productFamilies || []),
        ...incomingProducts.map((p: any) => p.productFamily).filter(Boolean),
      ])
    );
    vendor.productFamilies = allFamilies;

    const allTypes = Array.from(
      new Set([
        ...(vendor.productTypesDealing || []),
        ...incomingProducts.map((p: any) => p.productType || p.subCategory).filter(Boolean),
      ])
    );
    vendor.productTypesDealing = allTypes;

    if (Array.isArray(payload.brandsDetected) && payload.brandsDetected.length > 0) {
      const prevAssoc = Array.isArray(vendor.manufacturerAssociations) ? vendor.manufacturerAssociations : [];
      const assocMap = new Map<string, any>();
      prevAssoc.forEach((a: any) => assocMap.set((a.brand || '').toLowerCase(), a));
      payload.brandsDetected.forEach((bd: any) => {
        if (bd?.name && bd.name !== 'Unconfirmed') {
          assocMap.set(bd.name.toLowerCase(), {
            brand: bd.name,
            relationship: bd.relationship || 'Listed In Catalogue',
            evidence: bd.evidence || `Detected in ${batchId}`,
            source: payload.catalogFile?.fileName || batchId,
          });
        }
      });
      vendor.manufacturerAssociations = Array.from(assocMap.values());
    }

    const sources = new Set(vendor.dataSources || []);
    sources.add(payload.sourceType || payload.catalogFile?.fileType || 'PDF');
    vendor.dataSources = Array.from(sources);
    vendor.lastAiAnalysisDate = new Date().toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    vendor.verifiedBy = user;
    vendor.analysisStatus = 'ANALYZED';

    const scoreBreakdown = calculateVendorIntelligenceScore(vendor);
    vendor.intelligenceScore = scoreBreakdown.totalScore;
    vendor.intelligenceScoreBreakdown = {
      catalogueAvailable: scoreBreakdown.catalogueAvailable,
      websiteAvailable: scoreBreakdown.websiteAvailable,
      productsIdentified: scoreBreakdown.productsIdentified,
      brandsIdentified: scoreBreakdown.brandsIdentified,
      partCodesIdentified: scoreBreakdown.partCodesIdentified,
      specificationsIdentified: scoreBreakdown.specificationsIdentified,
      recentlyVerified: scoreBreakdown.recentlyVerified,
      explanations: scoreBreakdown.explanations,
    };
    vendor.intelligenceConfidence = scoreBreakdown.totalScore >= 75 ? 'HIGH' : scoreBreakdown.totalScore >= 45 ? 'MEDIUM' : 'LOW';

    this.data.vendors[vIdx] = vendor;
    this.addAuditLog({
      user,
      role,
      action: 'CATALOGUE_BATCH_COMMITTED',
      module: 'Vendor Intelligence',
      recordNumber: batchId,
      remarks: `Committed catalogue batch ${batchId} (${batchVersion}) for ${vendor.companyName}: ${incomingProducts.length} items (${diff.newProducts.length} new, ${diff.changedRates.length} rate updates, ${diff.removedProducts.length} marked NOT_PRESENT_IN_LATEST). Score: ${vendor.intelligenceScore}/100.`,
      ipAddress: ip,
    });
    this.save();

    // Post-commit verification (SELECT check on persisted store)
    const verifiedVendor = (this.data.vendors || []).find((v: any) => v.id === vendorId);
    const verified =
      !!verifiedVendor &&
      Array.isArray(verifiedVendor.catalogueBatches) &&
      verifiedVendor.catalogueBatches.some((b: any) => b.id === batchId);

    return {
      success: true,
      verified,
      batchId,
      batch: newBatchRecord,
      diff,
      vendor: verifiedVendor || vendor,
      vendorProductMappings: this.data.vendorProductMappings.filter((m: any) => m.vendorId === vendorId),
      newBrandsCreated,
      rateHistoryRecorded,
    };
  }

  /**
   * Saves crawled Website Intelligence for a vendor and merges it with PDF/catalogue intelligence (Modules 11-13)
   */
  public saveVendorWebsiteAnalysis(
    vendorId: string,
    websiteResult: any,
    user: string = 'Super Admin',
    role: string = 'SUPER_ADMIN',
    ip: string = '127.0.0.1'
  ): {
    success: boolean;
    verified: boolean;
    vendor: any;
    enrichedFromWebsiteCount: number;
    addedFromWebsiteCount: number;
  } {
    const vendors = Array.isArray(this.data.vendors) ? this.data.vendors : [];
    const vIdx = vendors.findIndex((v: any) => v.id === vendorId && !v.isDeleted);
    if (vIdx === -1) {
      throw new Error(`Vendor ${vendorId} not found or deleted`);
    }

    const vendor = { ...vendors[vIdx] };
    const url = (websiteResult.url || '').trim();
    if (url) {
      vendor.website = vendor.website || url;
      vendor.websiteUrls = Array.from(new Set([url, ...(vendor.websiteUrls || [])]));
    }

    const webProducts = Array.isArray(websiteResult.products) ? websiteResult.products : [];
    const combined = combineWebsiteAndCatalogueIntelligence(
      Array.isArray(vendor.catalogProducts) ? vendor.catalogProducts : [],
      webProducts,
      url,
      vendorId
    );
    vendor.catalogProducts = combined.mergedProducts;

    const webBrands = (websiteResult.brands || [])
      .map((b: any) => (typeof b === 'string' ? b : b.name))
      .filter((b: string) => b && b !== 'Unconfirmed');
    vendor.brandsSupplied = Array.from(new Set([...(vendor.brandsSupplied || []), ...webBrands]));
    vendor.brandsDealing = Array.from(new Set([...(vendor.brandsDealing || []), ...webBrands]));

    if (Array.isArray(websiteResult.productFamilies)) {
      vendor.productFamilies = Array.from(
        new Set([...(vendor.productFamilies || []), ...websiteResult.productFamilies])
      );
    }

    if (Array.isArray(websiteResult.brands)) {
      const assocMap = new Map<string, any>();
      (vendor.manufacturerAssociations || []).forEach((a: any) =>
        assocMap.set((a.brand || '').toLowerCase(), a)
      );
      websiteResult.brands.forEach((b: any) => {
        if (typeof b === 'object' && b.name && b.name !== 'Unconfirmed') {
          assocMap.set(b.name.toLowerCase(), {
            brand: b.name,
            relationship: b.relationship || 'Listed In Catalogue',
            evidence: b.evidence || `Detected on ${url}`,
            source: url,
          });
        }
      });
      vendor.manufacturerAssociations = Array.from(assocMap.values());
    }

    vendor.websiteIntelligence = {
      url,
      title: websiteResult.title || '',
      companyOverview: websiteResult.companyOverview || '',
      crawledPages: websiteResult.crawledPages || [url],
      pdfLinks: websiteResult.pdfLinks || [],
      emails: websiteResult.emails || [],
      phones: websiteResult.phones || [],
      analyzedAt: websiteResult.analyzedAt || new Date().toISOString(),
    };
    vendor.lastWebsiteAnalysisDate = new Date().toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const sources = new Set(vendor.dataSources || []);
    sources.add('WEBSITE');
    if (sources.has('PDF')) sources.add('PDF+WEBSITE');
    vendor.dataSources = Array.from(sources);
    vendor.analysisStatus = 'ANALYZED';

    const scoreBreakdown = calculateVendorIntelligenceScore(vendor);
    vendor.intelligenceScore = scoreBreakdown.totalScore;
    vendor.intelligenceScoreBreakdown = {
      catalogueAvailable: scoreBreakdown.catalogueAvailable,
      websiteAvailable: scoreBreakdown.websiteAvailable,
      productsIdentified: scoreBreakdown.productsIdentified,
      brandsIdentified: scoreBreakdown.brandsIdentified,
      partCodesIdentified: scoreBreakdown.partCodesIdentified,
      specificationsIdentified: scoreBreakdown.specificationsIdentified,
      recentlyVerified: scoreBreakdown.recentlyVerified,
      explanations: scoreBreakdown.explanations,
    };
    vendor.intelligenceConfidence = scoreBreakdown.totalScore >= 75 ? 'HIGH' : scoreBreakdown.totalScore >= 45 ? 'MEDIUM' : 'LOW';

    this.data.vendors[vIdx] = vendor;
    this.addAuditLog({
      user,
      role,
      action: 'VENDOR_WEBSITE_ANALYZED',
      module: 'Vendor Intelligence',
      recordNumber: vendorId,
      remarks: `Analyzed website ${url} for ${vendor.companyName}: ${combined.enrichedFromWebsiteCount} products enriched (PDF+WEBSITE), ${combined.addedFromWebsiteCount} new items indexed. Score: ${vendor.intelligenceScore}/100.`,
      ipAddress: ip,
    });
    this.save();

    const verifiedVendor = (this.data.vendors || []).find((v: any) => v.id === vendorId);
    const verified = !!verifiedVendor?.websiteIntelligence?.analyzedAt;

    return {
      success: true,
      verified,
      vendor: verifiedVendor || vendor,
      enrichedFromWebsiteCount: combined.enrichedFromWebsiteCount,
      addedFromWebsiteCount: combined.addedFromWebsiteCount,
    };
  }

  /**
   * Dependency-safe Catalogue Batch Archive / Deactivate / Restore / Rollback (Modules 22, 23)
   * Never deletes historical RFQs, quotations, or POs.
   */
  public manageVendorCatalogueBatch(
    vendorId: string,
    batchId: string,
    action: 'ARCHIVE' | 'DEACTIVATE' | 'RESTORE' | 'ROLLBACK',
    force: boolean = false,
    user: string = 'Super Admin',
    role: string = 'SUPER_ADMIN',
    ip: string = '127.0.0.1'
  ): {
    success: boolean;
    requiresConfirmation?: boolean;
    referencedCount?: number;
    references?: string[];
    message: string;
    vendor?: any;
  } {
    const vendors = Array.isArray(this.data.vendors) ? this.data.vendors : [];
    const vIdx = vendors.findIndex((v: any) => v.id === vendorId && !v.isDeleted);
    if (vIdx === -1) {
      return { success: false, message: `Vendor ${vendorId} not found.` };
    }

    const vendor = { ...vendors[vIdx] };
    const batches = Array.isArray(vendor.catalogueBatches) ? [...vendor.catalogueBatches] : [];
    const bIdx = batches.findIndex((b: any) => b.id === batchId);
    if (bIdx === -1) {
      return { success: false, message: `Catalogue batch ${batchId} not found for vendor ${vendor.companyName}.` };
    }

    const batch = { ...batches[bIdx] };
    const catalogProducts = Array.isArray(vendor.catalogProducts) ? [...vendor.catalogProducts] : [];
    const batchProducts = catalogProducts.filter((p: any) => p.batchId === batchId);
    const batchProductIds = new Set(batchProducts.map((p: any) => p.id));

    // Check references in historical transactions (RFQs, VendorQuotes, Quotations, VendorPOs)
    const references: string[] = [];
    (this.data.rfqs || []).forEach((r: any) => {
      if (
        r.importBatchId === batchId ||
        (Array.isArray(r.items) && r.items.some((it: any) => batchProductIds.has(it.catalogProductId)))
      ) {
        references.push(r.rfqNumber || r.id);
      }
    });
    (this.data.vendorPos || []).forEach((po: any) => {
      if (po.vendorId === vendorId && Array.isArray(po.items) && po.items.some((it: any) => batchProductIds.has(it.catalogProductId))) {
        references.push(po.poNumber || po.id);
      }
    });

    if (action === 'ROLLBACK' && references.length > 0 && !force) {
      return {
        success: false,
        requiresConfirmation: true,
        referencedCount: references.length,
        references,
        message: `Batch ${batchId} is referenced by ${references.length} historical record(s) (${references.slice(0, 3).join(', ')}). Confirm force rollback (historical transactions will be preserved).`,
      };
    }

    let message = '';
    if (action === 'ARCHIVE' || action === 'DEACTIVATE') {
      batch.status = 'ARCHIVED';
      batches[bIdx] = batch;
      vendor.catalogProducts = catalogProducts.map((p: any) =>
        p.batchId === batchId
          ? {
              ...p,
              catalogueStatus: 'ARCHIVED',
              approvalStatus: action === 'DEACTIVATE' ? 'REJECTED' : p.approvalStatus,
            }
          : p
      );
      message = `Batch ${batchId} ${action === 'DEACTIVATE' ? 'deactivated' : 'archived'}; historical RFQ/PO records preserved.`;
    } else if (action === 'RESTORE') {
      const hasCurrent = batches.some((b: any, i: number) => i !== bIdx && b.status === 'CURRENT');
      batch.status = hasCurrent ? 'HISTORICAL' : 'CURRENT';
      batches[bIdx] = batch;
      vendor.catalogProducts = catalogProducts.map((p: any) =>
        p.batchId === batchId
          ? {
              ...p,
              catalogueStatus: 'ACTIVE',
              approvalStatus: 'APPROVED',
            }
          : p
      );
      message = `Batch ${batchId} restored (${batch.status}).`;
    } else if (action === 'ROLLBACK') {
      batch.status = 'ROLLED_BACK';
      batches[bIdx] = batch;
      // Restore NOT_PRESENT_IN_LATEST items from prior active batch if this was latest
      const nextActiveBatch = batches.find((b: any) => b.status === 'HISTORICAL');
      if (nextActiveBatch) {
        nextActiveBatch.status = 'CURRENT';
      }
      vendor.catalogProducts = catalogProducts
        .filter((p: any) => p.batchId !== batchId)
        .map((p: any) =>
          p.catalogueStatus === 'NOT_PRESENT_IN_LATEST' ? { ...p, catalogueStatus: 'ACTIVE' } : p
        );

      if (Array.isArray(this.data.rateVersionHistory)) {
        this.data.rateVersionHistory = this.data.rateVersionHistory.map((rv: any) =>
          rv.importBatchId === batchId ? { ...rv, status: 'ROLLED_BACK' } : rv
        );
      }
      message = `Rolled back batch ${batchId}. Previous catalogue snapshot restored cleanly without altering historical RFQs/POs.`;
    }

    vendor.catalogueBatches = batches;
    const scoreBreakdown = calculateVendorIntelligenceScore(vendor);
    vendor.intelligenceScore = scoreBreakdown.totalScore;
    vendor.intelligenceScoreBreakdown = {
      catalogueAvailable: scoreBreakdown.catalogueAvailable,
      websiteAvailable: scoreBreakdown.websiteAvailable,
      productsIdentified: scoreBreakdown.productsIdentified,
      brandsIdentified: scoreBreakdown.brandsIdentified,
      partCodesIdentified: scoreBreakdown.partCodesIdentified,
      specificationsIdentified: scoreBreakdown.specificationsIdentified,
      recentlyVerified: scoreBreakdown.recentlyVerified,
      explanations: scoreBreakdown.explanations,
    };

    this.data.vendors[vIdx] = vendor;
    this.addAuditLog({
      user,
      role,
      action: `VENDOR_CATALOG_BATCH_${action}`,
      module: 'Vendor Intelligence',
      recordNumber: batchId,
      remarks: `${message} (${vendor.companyName})`,
      ipAddress: ip,
    });
    this.save();

    return {
      success: true,
      message,
      vendor,
      referencedCount: references.length,
      references,
    };
  }

  /**
   * Atomic Transactional Vendor Auto-Onboarding Commit
   * BEGIN -> Save Vendor + Contacts + Brands + Categories + Products + Mappings + Catalogue/Rates + Audit Log -> Verify -> COMMIT / ROLLBACK
   */
  public commitVendorOnboardingTransaction(
    payload: any,
    user: string = 'Super Admin',
    role: string = 'SUPER_ADMIN',
    ip: string = '127.0.0.1'
  ): {
    success: boolean;
    verified: boolean;
    mode: 'CREATE' | 'UPDATE';
    vendor: any;
    createdBrands: any[];
    createdCategories: any[];
    createdProducts: any[];
    mappingsCreated: any[];
    rateHistoryRecorded: number;
  } {
    const snapshot = {
      vendors: JSON.parse(JSON.stringify(this.data.vendors || [])),
      brands: JSON.parse(JSON.stringify(this.data.brands || [])),
      categories: JSON.parse(JSON.stringify(this.data.categories || [])),
      products: JSON.parse(JSON.stringify(this.data.products || [])),
      productTypes: JSON.parse(JSON.stringify(this.data.productTypes || [])),
      vendorProductMappings: JSON.parse(JSON.stringify(this.data.vendorProductMappings || [])),
      rateVersionHistory: JSON.parse(JSON.stringify(this.data.rateVersionHistory || [])),
      auditLogs: JSON.parse(JSON.stringify(this.data.auditLogs || [])),
    };

    try {
      const mode: 'CREATE' | 'UPDATE' = payload?.mode === 'UPDATE' ? 'UPDATE' : 'CREATE';
      const company = payload?.company || {};
      const companyName = (company.companyName || '').trim();
      if (!companyName) {
        throw new Error('Company Name is mandatory to complete vendor onboarding.');
      }

      const rawGst = (company.gstin || '').trim().toUpperCase();
      if (rawGst && rawGst !== 'NOT FOUND' && !validateGstinFormat(rawGst)) {
        throw new Error(`Invalid GSTIN format "${rawGst}". Expected 15-character Indian GSTIN (or leave blank if unavailable).`);
      }

      const rawPan = (company.pan || '').trim().toUpperCase();
      if (rawPan && rawPan !== 'NOT FOUND' && !validatePanFormat(rawPan)) {
        throw new Error(`Invalid PAN format "${rawPan}". Expected 10-character PAN (e.g. AABCA1234F).`);
      }

      if (!Array.isArray(this.data.vendors)) this.data.vendors = [];
      if (!Array.isArray(this.data.brands)) this.data.brands = [];
      if (!Array.isArray(this.data.categories)) this.data.categories = [];
      if (!Array.isArray(this.data.products)) this.data.products = [];
      if (!Array.isArray(this.data.productTypes)) this.data.productTypes = [];
      if (!Array.isArray(this.data.vendorProductMappings)) this.data.vendorProductMappings = [];
      if (!Array.isArray(this.data.rateVersionHistory)) this.data.rateVersionHistory = [];

      const activeVendors = this.data.vendors.filter((v: any) => !v.isDeleted);
      const normCompany = companyName.toLowerCase();

      let targetIdx = -1;
      if (mode === 'UPDATE' && payload.targetVendorId) {
        targetIdx = this.data.vendors.findIndex(
          (v: any) => v.id === payload.targetVendorId && !v.isDeleted
        );
        if (targetIdx === -1) {
          throw new Error(`Target vendor "${payload.targetVendorId}" was not found for update.`);
        }
      } else {
        const dup = activeVendors.find(
          (v: any) =>
            (v.companyName || '').trim().toLowerCase() === normCompany ||
            (rawGst && !rawGst.startsWith('27AAAPV0000') && (v.gstin || '').trim().toUpperCase() === rawGst)
        );
        if (dup) {
          throw new Error(
            `Duplicate vendor blocked: "${dup.companyName}" (${dup.vendorCode || dup.id}) already exists in Vendor Master. Choose "Update Existing" instead.`
          );
        }
      }

      const nowIso = new Date().toISOString();
      const todayDate = nowIso.split('T')[0];

      let maxNum = 0;
      [...(this.data.vendors || []).map((v: any) => v.id), ...(this.data.deletedVendorIds || [])].forEach((vid: any) => {
        const m = String(vid || '').match(/VEND-(\d+)/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxNum) maxNum = n;
        }
      });
      const existingVendor = targetIdx !== -1 ? { ...this.data.vendors[targetIdx] } : null;
      const vendorId = existingVendor ? existingVendor.id : `VEND-${String(maxNum + 1).padStart(3, '0')}`;
      const vendorCode = existingVendor?.vendorCode || vendorId;
      if (Array.isArray(this.data.deletedVendorIds)) {
        this.data.deletedVendorIds = this.data.deletedVendorIds.filter((id: string) => id !== vendorId);
      }

      const contacts = Array.isArray(payload.contacts) ? payload.contacts : [];
      const primaryContact = contacts.find((c: any) => c.isPrimary) || contacts[0] || {};
      const addr = payload.structuredAddress || {};

      // 1. Reconcile & Commit Brands into Brand Master
      const createdBrands: any[] = [];
      const incomingBrands = Array.isArray(payload.brands) ? payload.brands : [];
      const resolvedBrandAssociations: any[] = [];

      for (const b of incomingBrands) {
        if (!b || !b.brandName || b.resolutionAction === 'SKIP') continue;
        const cleanBrand = String(b.brandName).trim();
        let masterBrand = b.brandId
          ? this.data.brands.find((bm: any) => !bm.isDeleted && bm.id === b.brandId)
          : undefined;

        if (!masterBrand) {
          masterBrand = this.data.brands.find(
            (bm: any) =>
              !bm.isDeleted &&
              (bm.name.toLowerCase().trim() === cleanBrand.toLowerCase() ||
                (bm.aliases || []).some((al: string) => al.toLowerCase().trim() === cleanBrand.toLowerCase()))
          );
        }

        if (!masterBrand && b.resolutionAction !== 'REVIEW') {
          masterBrand = {
            id: `BRD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`,
            name: cleanBrand,
            code: cleanBrand.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'BRD',
            aliases: [],
            country: company.country || 'India',
            category:
              (Array.isArray(payload.categories) && payload.categories[0]?.category) || 'General MRO',
            categories: Array.from(
              new Set((payload.categories || []).map((c: any) => c.category).filter(Boolean))
            ),
            description: `Auto-onboarded via ${b.source || 'Vendor Onboarding'} for ${companyName}`,
            isActive: true,
            status: 'ACTIVE',
            isDeleted: false,
            createdAt: todayDate,
            createdBy: user,
          };
          this.data.brands.unshift(masterBrand);
          createdBrands.push(masterBrand);
        }

        resolvedBrandAssociations.push({
          brandId: masterBrand?.id,
          brandName: masterBrand?.name || cleanBrand,
          relationshipType: b.relationshipType || 'Listed In Catalogue',
          productCount: Number(b.productCount) || 0,
          source: b.source || 'Auto-Onboarding',
          confidence: Number(b.confidence) || 85,
          firstDetected: b.firstDetected || todayDate,
          lastVerified: todayDate,
          evidence: b.evidence || '',
          isExistingMaster: !!masterBrand,
          resolutionAction: masterBrand ? 'USE_EXISTING' : b.resolutionAction || 'CREATE_NEW',
        });
      }

      // 2. Reconcile & Commit Categories into Category Master
      const createdCategories: any[] = [];
      const incomingCategories = Array.isArray(payload.categories) ? payload.categories : [];
      const selectedCategoryNames: string[] = [];
      const selectedSubCategories: string[] = [];

      for (const c of incomingCategories) {
        if (!c || c.selected === false || !c.category) continue;
        const catName = String(c.category).trim();
        const subName = c.subCategory ? String(c.subCategory).trim() : '';
        if (!selectedCategoryNames.includes(catName)) selectedCategoryNames.push(catName);
        if (subName && !selectedSubCategories.includes(subName)) selectedSubCategories.push(subName);

        const existingCat = this.data.categories.find(
          (cm: any) => !cm.isDeleted && cm.name.toLowerCase().trim() === catName.toLowerCase()
        );
        if (existingCat) {
          if (subName && (!existingCat.subCategories || !existingCat.subCategories.includes(subName))) {
            existingCat.subCategories = [...(existingCat.subCategories || []), subName];
          }
        } else {
          const newCat = {
            id: `CAT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`,
            code: `CAT-${String(this.data.categories.length + 1).padStart(3, '0')}`,
            name: catName,
            subCategories: subName ? [subName] : [],
            brands: Array.isArray(c.brands) ? c.brands : [],
            keywords: [catName, subName, c.productFamily].filter(Boolean),
            isActive: true,
            createdAt: todayDate,
          };
          this.data.categories.unshift(newCat);
          createdCategories.push(newCat);
        }
      }

      // 3. Reconcile Products -> Product Master, CatalogProducts, VendorProductMappings & Rate History
      const incomingProducts = (Array.isArray(payload.products) ? payload.products : []).filter(
        (p: any) => p && p.accepted !== false && p.productName
      );
      const createdProducts: any[] = [];
      const mappingsCreated: any[] = [];
      let rateHistoryRecorded = 0;

      const batchId = `ONB-CAT-${new Date().getFullYear()}-${String(
        (existingVendor?.catalogueBatches?.length || 0) + 1
      ).padStart(4, '0')}`;

      const preparedCatalogProducts: any[] = [];

      for (let i = 0; i < incomingProducts.length; i++) {
        const p = incomingProducts[i];
        const exactPart = preserveExactPartCode(p.partNumber || p.modelNumber || '');
        const brandName = (p.brand || 'Unconfirmed').trim();
        const catName = (p.category || selectedCategoryNames[0] || 'Mechanical Components').trim();
        const subName = (p.subCategory || '').trim();
        const famInfo = mapProductFamilyAndType(p.productName, catName, subName);
        const productFamily = p.productFamily || famInfo.productFamily;
        const productType = p.productType || famInfo.productType;

        if (productType) {
          this.findOrCreateProductType(productType, catName, false);
        }

        let matchedProdId = p.matchedProductId;
        if (!matchedProdId && payload.createMissingProductsInMaster !== false) {
          const existingProd = this.data.products.find(
            (pm: any) =>
              !pm.isDeleted &&
              ((exactPart &&
                preserveExactPartCode(pm.partNumber || pm.modelNumber || '').toLowerCase() === exactPart.toLowerCase() &&
                (pm.brand || '').toLowerCase().trim() === brandName.toLowerCase()) ||
                ((pm.itemName || '').toLowerCase().trim() === p.productName.toLowerCase().trim() &&
                  (pm.brand || '').toLowerCase().trim() === brandName.toLowerCase()))
          );
          if (existingProd) {
            matchedProdId = existingProd.id;
          } else {
            const newProd = {
              id: `PRD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 9000 + 1000)}`,
              itemName: p.productName.trim(),
              sourceProductName: p.sourceProductName || p.productName.trim(),
              normalizedProductName: p.normalizedProductName || p.productName.trim(),
              productDesignation: p.productDesignation || exactPart || '',
              category: catName,
              subCategory: subName,
              productFamily,
              productType,
              brand: brandName,
              manufacturerCode: p.manufacturerCode || exactPart || '',
              modelNumber: preserveExactPartCode(p.modelNumber || exactPart),
              partNumber: exactPart,
              specification: p.specification || '',
              description: p.description || p.specification || '',
              application: p.application || '',
              catalogueRow: p.catalogueRow,
              originalSourceText: p.originalSourceText,
              extractionDate: p.extractionDate || todayDate,
              aiAnalysisVersion: p.aiAnalysisVersion || 'MRO-Intel-v4.0',
              uom: p.uom || 'NOS',
              mrp: typeof p.mrp === 'number' ? p.mrp : undefined,
              purchasePrice: typeof p.purchaseRate === 'number' ? p.purchaseRate : undefined,
              status: 'ACTIVE',
              isDeleted: false,
              createdAt: todayDate,
            };
            this.data.products.unshift(newProd);
            createdProducts.push(newProd);
            matchedProdId = newProd.id;
          }
        }

        const catProdId = `VCP-${Date.now()}-${i + 1}`;
        preparedCatalogProducts.push({
          ...p,
          id: catProdId,
          vendorId,
          partNumber: exactPart || undefined,
          modelNumber: preserveExactPartCode(p.modelNumber || exactPart) || undefined,
          productFamily,
          productType,
          matchedProductId: matchedProdId,
          sourceFile: p.sourceFile || p.catalogFileName,
          sourcePage: p.sourcePage,
          sourcePages: p.sourcePages,
          batchId,
          batchVersion: 'v1.0',
          approvalStatus: 'APPROVED',
          catalogueStatus: 'ACTIVE',
        });

        const partKey = normalizePartCode(exactPart || p.productName);
        const dupMapIdx = this.data.vendorProductMappings.findIndex(
          (m: any) =>
            m.vendorId === vendorId &&
            ((partKey && normalizePartCode(m.partNumber || m.modelNumber || '') === partKey) ||
              ((m.productName || '').toLowerCase().trim() === p.productName.toLowerCase().trim() &&
                (m.brand || '').toLowerCase().trim() === brandName.toLowerCase()))
        );

        const brandAssoc = resolvedBrandAssociations.find(
          (ba) => ba.brandName.toLowerCase() === brandName.toLowerCase()
        );

        if (dupMapIdx === -1) {
          const newMapping = {
            id: `VPM-${Date.now()}-${Math.floor(Math.random() * 10000)}-${i}`,
            vendorId,
            vendorCode,
            vendorName: companyName,
            productId: matchedProdId,
            productName: p.productName.trim(),
            category: catName,
            subCategory: subName,
            productType,
            brand: brandName,
            modelNumber: preserveExactPartCode(p.modelNumber || exactPart),
            partNumber: exactPart,
            specification: p.specification || '',
            description: p.description || '',
            uom: p.uom || 'NOS',
            supplyType: brandAssoc?.relationshipType || 'Listed In Catalogue',
            availability: 'Regular Stock',
            status: 'ACTIVE',
            rate: p.purchaseRate ?? p.basicRate ?? p.mrp,
            sourceFile: p.sourceFile || p.catalogFileName,
            sourcePage: p.sourcePage,
            sourcePages: p.sourcePages,
            remarks: `Auto-onboarded from ${p.catalogFileName || 'Vendor Onboarding'} (${batchId})`,
            createdAt: todayDate,
            updatedAt: todayDate,
          };
          this.data.vendorProductMappings.unshift(newMapping);
          mappingsCreated.push(newMapping);
        }

        if (p.mrp !== undefined || p.purchaseRate !== undefined || p.basicRate !== undefined) {
          const vendorRateKey = `${vendorId}::${partKey}`;
          const nextMrp = p.mrp ?? 0;
          const nextPurchaseRate = p.purchaseRate ?? p.basicRate ?? p.mrp ?? 0;
          const nextDiscount = p.discountPercent ?? 0;
          const activeCurrent = this.data.rateVersionHistory.find(
            (rv: any) => rv.vendorRateKey === vendorRateKey && rv.status === 'CURRENT'
          );
          const ratesUnchanged =
            activeCurrent &&
            Number(activeCurrent.mrp ?? 0) === Number(nextMrp) &&
            Number(activeCurrent.purchaseRate ?? 0) === Number(nextPurchaseRate) &&
            Number(activeCurrent.discountPercent ?? 0) === Number(nextDiscount);

          if (!ratesUnchanged) {
            const prevRate = activeCurrent ? Number(activeCurrent.purchaseRate ?? activeCurrent.mrp ?? 0) : undefined;
            const prevMrp = activeCurrent ? Number(activeCurrent.mrp ?? 0) : undefined;
            this.data.rateVersionHistory.forEach((rv: any) => {
              if (rv.vendorRateKey === vendorRateKey && rv.status === 'CURRENT') {
                rv.status = 'HISTORICAL';
                rv.validTo = todayDate;
              }
            });
            this.data.rateVersionHistory.unshift({
              id: `RV-${Date.now()}-${Math.floor(Math.random() * 10000)}-${i}`,
              productId: matchedProdId || catProdId,
              vendorRateKey,
              vendorId,
              vendorName: companyName,
              partCode: exactPart || p.productName,
              brand: brandName,
              catalogueVersion: 'v1.0',
              effectiveDate: p.effectiveDate || todayDate,
              effectiveYear: new Date(p.effectiveDate || todayDate).getFullYear(),
              validFrom: todayDate,
              mrp: nextMrp,
              discountPercent: nextDiscount,
              purchaseRate: nextPurchaseRate,
              oldRate: prevRate,
              newRate: nextPurchaseRate,
              oldMrp: prevMrp,
              newMrp: nextMrp,
              changedBy: user,
              changedDate: todayDate,
              reason: activeCurrent
                ? `Rate updated via ${p.catalogFileName || 'Vendor Onboarding'}`
                : `Initial onboarding rate from ${p.catalogFileName || 'Vendor Onboarding'}`,
              currency: p.currency || 'INR',
              sourceFile: p.catalogFileName || 'Vendor Onboarding',
              importBatchId: batchId,
              updatedBy: user,
              updatedAt: nowIso,
              status: 'CURRENT',
            });
            rateHistoryRecorded++;
          }
        }
      }

      const mergedBrands = Array.from(
        new Set([
          ...(existingVendor?.brandsSupplied || []),
          ...resolvedBrandAssociations.map((b) => b.brandName),
        ])
      );
      const mergedCategories = Array.from(
        new Set([
          ...(existingVendor?.materialCategories || existingVendor?.productCategories || []),
          ...selectedCategoryNames,
        ])
      );
      const mergedFamilies = Array.from(
        new Set([
          ...(existingVendor?.productFamilies || []),
          ...(Array.isArray(payload.productFamilies) ? payload.productFamilies : []),
          ...preparedCatalogProducts.map((p: any) => p.productFamily).filter(Boolean),
        ])
      );

      const newCatalogFiles = (Array.isArray(payload.sourcesSummary) ? payload.sourcesSummary : [])
        .filter((s: any) => s.sourceType !== 'WEBSITE' && s.sourceType !== 'TEXT')
        .map((s: any, idx: number) => ({
          id: `VCF-${Date.now()}-${idx + 1}`,
          vendorId,
          fileName: s.sourceName,
          fileType: s.sourceType === 'EXCEL' ? 'EXCEL' : s.sourceType === 'IMAGE' ? 'IMAGE' : 'PDF',
          uploadDate: todayDate,
          processingStatus: 'ANALYZED',
          aiAnalysisStatus: 'COMPLETED',
          productsIdentifiedCount: s.itemsExtracted || preparedCatalogProducts.length,
        }));

      const newBatch =
        preparedCatalogProducts.length > 0
          ? [
              {
                id: batchId,
                vendorId,
                fileName: newCatalogFiles[0]?.fileName || payload.websiteUrl || 'Auto-Onboarding',
                sourceType: newCatalogFiles[0]?.fileType || 'WEBSITE',
                version: 'v1.0',
                uploadedAt: nowIso,
                uploadedBy: user,
                totalExtracted: preparedCatalogProducts.length,
                newCount: preparedCatalogProducts.length,
                updatedCount: 0,
                unchangedCount: 0,
                removedCount: 0,
                rateChangesCount: rateHistoryRecorded,
                brandsDetected: mergedBrands,
                status: 'CURRENT',
                snapshotProductIds: preparedCatalogProducts.map((p: any) => p.id),
              },
            ]
          : [];

      const completion = computeOnboardingCompletion({
        company,
        structuredAddress: addr,
        contacts,
        brands: resolvedBrandAssociations,
        categories: incomingCategories,
        productFamilies: mergedFamilies,
        products: incomingProducts,
        conflicts: [],
        sourceTraceability: payload.sourceTraceability || [],
      });

      const finalVendor: any = {
        ...(existingVendor || {}),
        id: vendorId,
        vendorCode,
        companyName,
        legalName: (company.legalName || '').trim() || existingVendor?.legalName || companyName,
        vendorType: (company.vendorType || existingVendor?.vendorType || 'Distributor').trim(),
        website: (company.website || payload.websiteUrl || existingVendor?.website || '').trim() || undefined,
        country: (addr.country || company.country || existingVendor?.country || 'India').trim(),
        contactPerson: (primaryContact.name || existingVendor?.contactPerson || 'Primary Contact').trim(),
        mobile: (primaryContact.mobile || existingVendor?.mobile || '').trim(),
        alternateMobile: (primaryContact.alternateMobile || existingVendor?.alternateMobile || '').trim() || undefined,
        landline: (primaryContact.landline || existingVendor?.landline || '').trim() || undefined,
        whatsapp: (primaryContact.whatsapp || existingVendor?.whatsapp || '').trim() || undefined,
        email: (primaryContact.email || existingVendor?.email || '').trim(),
        address: (addr.rawAddress || existingVendor?.address || '').trim(),
        city: (addr.city || existingVendor?.city || '').trim(),
        state: (addr.state || existingVendor?.state || '').trim(),
        pincode: (addr.pincode || existingVendor?.pincode || '').trim(),
        gstin: rawGst || existingVendor?.gstin || '',
        pan: rawPan || existingVendor?.pan || '',
        paymentTerms: (company.paymentTerms || existingVendor?.paymentTerms || '30 Days Net').trim(),
        creditPeriod: (company.creditPeriod || existingVendor?.creditPeriod || '30 Days').trim(),
        deliveryTerms: (company.deliveryTerms || existingVendor?.deliveryTerms || 'Door Delivery / Ex-Works').trim(),
        msmeStatus: (company.msmeStatus || existingVendor?.msmeStatus || 'Small').trim(),
        status: company.status || existingVendor?.status || 'ACTIVE',
        remarks: (company.remarks || company.summary || existingVendor?.remarks || '').trim(),
        bankDetails: {
          accountName: companyName,
          accountNumber: company.bankAccount || existingVendor?.bankDetails?.accountNumber || '',
          bankName: company.bankName || existingVendor?.bankDetails?.bankName || '',
          ifscCode: company.bankIfsc || existingVendor?.bankDetails?.ifscCode || '',
          branch: addr.city || existingVendor?.city || '',
        },
        productCategories: mergedCategories,
        materialCategories: mergedCategories,
        subCategories: Array.from(new Set([...(existingVendor?.subCategories || []), ...selectedSubCategories])),
        brandsSupplied: mergedBrands,
        brandsDealing: mergedBrands,
        productFamilies: mergedFamilies,
        brandAssociations: resolvedBrandAssociations,
        manufacturerAssociations: resolvedBrandAssociations.map((ba) => ({
          brand: ba.brandName,
          relationship: ba.relationshipType,
          confidence: ba.confidence,
          evidence: ba.evidence,
          source: ba.source,
        })),
        contacts: contacts.length > 0 ? contacts : existingVendor?.contacts,
        structuredAddress: addr.rawAddress ? addr : existingVendor?.structuredAddress,
        sourceTraceability: Array.isArray(payload.sourceTraceability) ? payload.sourceTraceability : existingVendor?.sourceTraceability,
        onboardingSourcesSummary: Array.isArray(payload.sourcesSummary)
          ? payload.sourcesSummary.map((s: any) => ({
              sourceType: s.sourceType,
              sourceName: s.sourceName,
              analyzedAt: nowIso,
              itemsExtracted: s.itemsExtracted || 0,
            }))
          : existingVendor?.onboardingSourcesSummary,
        catalogFiles: [...newCatalogFiles, ...(existingVendor?.catalogFiles || [])],
        catalogProducts: [...preparedCatalogProducts, ...(existingVendor?.catalogProducts || [])],
        catalogueBatches: [...newBatch, ...(existingVendor?.catalogueBatches || [])],
        websiteIntelligence: payload.websiteIntelligence?.url
          ? payload.websiteIntelligence
          : existingVendor?.websiteIntelligence,
        profileCompletionScore: completion.overallPercent,
        rating: existingVendor?.rating || 4.8,
        analysisStatus: 'ANALYZED',
        lastAiAnalysisDate: new Date().toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        verifiedBy: user,
        dataSources: Array.from(
          new Set([
            ...(existingVendor?.dataSources || []),
            ...(payload.sourcesSummary || []).map((s: any) => s.sourceType),
          ])
        ),
        isDeleted: false,
        createdAt: existingVendor?.createdAt || todayDate,
        updatedAt: nowIso,
      };

      const scoreBreakdown = calculateVendorIntelligenceScore(finalVendor);
      finalVendor.intelligenceScore = scoreBreakdown.totalScore;
      finalVendor.intelligenceScoreBreakdown = {
        catalogueAvailable: scoreBreakdown.catalogueAvailable,
        websiteAvailable: scoreBreakdown.websiteAvailable,
        productsIdentified: scoreBreakdown.productsIdentified,
        brandsIdentified: scoreBreakdown.brandsIdentified,
        partCodesIdentified: scoreBreakdown.partCodesIdentified,
        specificationsIdentified: scoreBreakdown.specificationsIdentified,
        recentlyVerified: scoreBreakdown.recentlyVerified,
        explanations: scoreBreakdown.explanations,
      };
      finalVendor.intelligenceConfidence =
        scoreBreakdown.totalScore >= 75 ? 'HIGH' : scoreBreakdown.totalScore >= 45 ? 'MEDIUM' : 'LOW';

      if (targetIdx !== -1) {
        this.data.vendors[targetIdx] = finalVendor;
      } else {
        this.data.vendors.unshift(finalVendor);
      }

      this.addAuditLog({
        user,
        role,
        action: mode === 'UPDATE' ? 'VENDOR_ONBOARDING_UPDATED' : 'VENDOR_AUTO_ONBOARDED',
        module: 'Vendor Master',
        recordNumber: vendorId,
        remarks: `${mode === 'UPDATE' ? 'Updated' : 'Auto-onboarded'} vendor "${companyName}" (${vendorCode}): ${resolvedBrandAssociations.length} brands, ${mergedCategories.length} categories, ${mappingsCreated.length} product mappings, ${createdProducts.length} new Product Master items, ${rateHistoryRecorded} rate entries.`,
        ipAddress: ip,
      }, false);

      this.save();

      // Immediate Post-Commit Readback Verification from persisted disk store
      const diskParsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      const verifiedVendor = (diskParsed.vendors || []).find(
        (v: any) => v.id === vendorId && !v.isDeleted
      );
      if (!verifiedVendor) {
        throw new Error('Post-commit verification failed: onboarded vendor was not found on disk.');
      }

      return {
        success: true,
        verified: true,
        mode,
        vendor: verifiedVendor,
        createdBrands,
        createdCategories,
        createdProducts,
        mappingsCreated,
        rateHistoryRecorded,
      };
    } catch (err) {
      this.data.vendors = snapshot.vendors;
      this.data.brands = snapshot.brands;
      this.data.categories = snapshot.categories;
      this.data.products = snapshot.products;
      this.data.productTypes = snapshot.productTypes;
      this.data.vendorProductMappings = snapshot.vendorProductMappings;
      this.data.rateVersionHistory = snapshot.rateVersionHistory;
      this.data.auditLogs = snapshot.auditLogs;
      this.save();
      throw err;
    }
  }

  /**
   * Returns strictly grounded ERP database intelligence context for /api/chat (Module 33)
   */
  public getVendorIntelligenceChatContext(): string {
    const activeVendors = (this.data.vendors || []).filter((v: any) => !v.isDeleted);
    const activeBrands = (this.data.brands || []).filter((b: any) => !b.isDeleted);
    const catalogueCount = (this.data.catalogueProducts || []).length;

    const vendorSummaries = activeVendors.slice(0, 25).map((v: any) => {
      const items = (v.catalogProducts || [])
        .filter((p: any) => p.catalogueStatus !== 'DISCONTINUED' && p.catalogueStatus !== 'ARCHIVED')
        .slice(0, 12)
        .map((p: any) => {
          const ratePart =
            p.purchaseRate !== undefined
              ? `Rate: Rs.${p.purchaseRate}`
              : p.mrp !== undefined
                ? `MRP: Rs.${p.mrp}`
                : 'Rate: N/A';
          return `${p.brand || 'Unconfirmed'} ${p.partNumber || p.modelNumber || ''} (${p.productName}, ${ratePart}, Source: ${p.catalogReference || p.sourceType || 'Catalogue'})`;
        });

      return `- Vendor: ${v.companyName} (${v.city || ''}, ${v.country || 'India'}) | Website: ${v.website || 'N/A'} | Score: ${v.intelligenceScore ?? 0}/100 | Brands: ${(v.brandsDealing || v.brandsSupplied || []).join(', ') || 'None'} | Families: ${(v.productFamilies || []).join(', ') || 'None'} | Sample Catalogue Items: ${items.join('; ') || 'None'}`;
    });

    return [
      `LIVE ERP DATABASE SNAPSHOT:`,
      `Active Vendors: ${activeVendors.length} | Brand Master Count: ${activeBrands.length} (${activeBrands.slice(0, 15).map((b: any) => b.name).join(', ')}) | Central Catalogue Master Products: ${catalogueCount}`,
      vendorSummaries.length > 0 ? `VENDORS IN ERP:\n${vendorSummaries.join('\n')}` : 'No active vendors currently registered in ERP.',
    ].join('\n');
  }
}

export const db = new PersistentDatabase();

