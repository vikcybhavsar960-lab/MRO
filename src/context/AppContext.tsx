import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  UserRole,
  DataMode,
  Customer,
  Vendor,
  ProductItem,
  MaterialCategory,
  CustomerRequirement,
  VendorEnquiry,
  VendorQuote,
  CustomerQuotation,
  CustomerPO,
  VendorPO,
  ProformaInvoice,
  PaymentRecord,
  DispatchRecord,
  DeliveryRecord,
  NotificationItem,
  AuditLogItem,
  DocumentRecord,
  OrderWorkflowStage,
  RequirementItem,
  BackupRecord,
  BackupSettings,
  VendorCatalogFile,
  VendorCatalogProduct,
  VendorMaterialCategory,
  AIActivityLog,
  BrandMasterItem,
  Company,
  PurchaseExecutive,
  VendorProductMapping,
  ProductTypeMasterItem,
  ParsedVendorProduct,
  ErpBrandingConfig,
  ThemeConfig,
  BulkBrandDiscountRule,
  CatalogueImportHistoryRecord,
  ConfirmedAiMappingRecord,
  SavedColumnMappingTemplate,
  ImportPreviewRow,
  VendorOnboardingAnalysisResult,
  VendorOnboardingCommitPayload,
  VendorCatalogueConfig,
  VendorImportJob,
} from '../types';
import { getBrandEnrichment } from '../utils/brandAutoEnrichment';
import { analyzeVendorCatalog, detectDuplicateProduct } from '../services/aiCatalogService';
import { INITIAL_MATERIAL_CATEGORIES } from '../data/categoryMasterData';
import { INITIAL_BRANDS } from '../data/brandMasterData';
import { INITIAL_COMPANIES, INITIAL_PURCHASE_EXECUTIVES } from '../data/companyMasterData';
import {
  getSavedBackups,
  getBackupSettings,
  createBackupSnapshot,
  testBackupIntegrity,
  getActiveBackupFailure,
  clearBackupFailure,
} from '../services/backupRecoveryService';
import { recommendCategoryForRequirement, recommendVendorsForRequirement } from '../services/categoryMatchingService';
import {
  INITIAL_USERS,
  INITIAL_CUSTOMERS,
  INITIAL_VENDORS,
  INITIAL_PRODUCTS,
  INITIAL_REQUIREMENT_001,
  INITIAL_RFQ_001,
  INITIAL_VENDOR_QUOTES_001,
  INITIAL_CUSTOMER_QUOTATION_001,
  INITIAL_CUSTOMER_PO_001,
  INITIAL_VENDOR_PO_001,
  INITIAL_PROFORMA_INVOICE_001,
  INITIAL_PAYMENT_001,
  INITIAL_DISPATCH_001,
  INITIAL_DELIVERY_001,
  INITIAL_REQUIREMENT_002,
  INITIAL_RFQ_002,
  INITIAL_VENDOR_QUOTES_002,
  INITIAL_CUSTOMER_QUOTATION_002,
  INITIAL_CUSTOMER_PO_002,
  INITIAL_VENDOR_PO_002,
  INITIAL_PROFORMA_INVOICE_002,
  INITIAL_PAYMENT_002,
  INITIAL_DISPATCH_002,
  INITIAL_DELIVERY_002,
  INITIAL_REQUIREMENT_003,
  INITIAL_RFQ_003,
  INITIAL_VENDOR_QUOTES_003,
  INITIAL_REQUIREMENT_004,
  INITIAL_NOTIFICATIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_DOCUMENTS,
} from '../data/mockData';
import { fetchApi, PRODUCTION_BACKEND_URL, subscribeToSyncEvents } from '../utils/apiClient';
import { syncAccountingWithBackend } from '../services/accountingService';
import { normalizeUserRole } from '../utils/roleUtils';
import { generateCollisionSafeSeqId, generateCollisionSafeYearlyId } from '../utils/idGenerator';

import {
  CatalogueProduct,
  RateVersionHistory,
  CatalogueImportBatch,
  RateMatchResult,
} from '../types/catalogImport';
import {
  INITIAL_CATALOGUE_PRODUCTS,
  INITIAL_RATE_VERSION_HISTORY,
  INITIAL_IMPORT_BATCHES,
} from '../data/catalogueMasterSeed';
import { matchCatalogueRateDeterministic } from '../services/rateMatchingEngine';


import { getSupabaseConfigStatus, SUPABASE_PROJECT_URL } from '../lib/supabase';
import { subscribeToErpSupabaseRealtime } from '../services/supabaseRealtimeService';

export interface CloudSyncState {
  connected: boolean;
  schemaApplied?: boolean;
  serverConfigured?: boolean;
  status: 'CLOUD_CONNECTED' | 'CLOUD_CONNECTING' | 'LOCAL_ONLY' | 'NOT_INVITED' | 'ERROR';
  email: string | null;
  uid: string | null;
  isAdmin: boolean;
  error: string | null;
  projectId: string;
  databaseId: string;
  invitedEmails: string[];
  memberCount: number;
  lastCloudSyncAt: Date | null;
}

// Super Admin Identity Check (Recognizes Super Admin and Vicky Bhavsar Admin identity)
export const isSuperAdminUser = (user?: { role?: string; username?: string; email?: string; name?: string } | null): boolean => {
  if (!user) return false;
  const role = (user.role || '').toUpperCase();
  const username = ((user as any).username || '').toLowerCase();
  const email = (user.email || '').toLowerCase();
  const name = (user.name || '').toLowerCase();
  return (
    role === 'SUPER_ADMIN' ||
    role === 'ADMIN' ||
    username === 'admin' ||
    email === 'vickybhavsar960@gmail.com' ||
    email === 'vikcybhavsar960@gmail.com' ||
    name.includes('vicky') ||
    name.includes('admin')
  );
};

interface AppContextType {
  currentUser: User;
  setCurrentUser: (user: User) => void;
  availableUsers: User[];
  isMobileView: boolean;
  setIsMobileView: (val: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedOrderId: string | null;
  setSelectedOrderId: (id: string | null) => void;

  // Data Collections
  customers: Customer[];
  companies: Company[];
  purchaseExecutives: PurchaseExecutive[];
  vendors: Vendor[];
  archivedVendors: Vendor[];
  products: ProductItem[];
  requirements: CustomerRequirement[];
  rfqs: VendorEnquiry[];
  vendorQuotes: VendorQuote[];
  customerQuotations: CustomerQuotation[];
  customerPOs: CustomerPO[];
  vendorPOs: VendorPO[];
  proformaInvoices: ProformaInvoice[];
  payments: PaymentRecord[];
  dispatches: DispatchRecord[];
  deliveries: DeliveryRecord[];
  notifications: NotificationItem[];
  auditLogs: AuditLogItem[];
  documents: DocumentRecord[];

  // Action methods
  addCustomer: (cust: Omit<Customer, 'id' | 'createdAt'>) => Customer;
  addCompany: (comp: Omit<Company, 'id' | 'createdAt' | 'companyCode'>) => Company;
  updateCompany: (comp: Company) => void;
  deleteCompany: (id: string) => { success: boolean; message: string };
  addPurchaseExecutive: (exec: Omit<PurchaseExecutive, 'id' | 'createdAt'>) => PurchaseExecutive;
  updatePurchaseExecutive: (exec: PurchaseExecutive) => void;
  deletePurchaseExecutive: (id: string) => { success: boolean; message: string };
  getExecutivesByCompany: (companyId: string) => PurchaseExecutive[];
  addVendor: (vend: Omit<Vendor, 'id' | 'createdAt'>) => Promise<Vendor>;
  addProduct: (prd: Omit<ProductItem, 'id'>) => ProductItem;
  addProductsBulk: (prds: Array<Omit<ProductItem, 'id'>>) => ProductItem[];
  addRequirement: (req: {
    customerId: string;
    customerName: string;
    contactPerson: string;
    customerEmail: string;
    customerMobile: string;
    requirementDate: string;
    requiredDeliveryDate: string;
    receivedRequirementDate?: string;
    expectedDeliveryDate?: string;
    priority?: 'High' | 'Medium' | 'Low';
    items: Omit<RequirementItem, 'id'>[];
    remarks?: string;
    companyId?: string;
    companyName?: string;
    companyCode?: string;
    purchaseExecutiveId?: string;
    purchaseExecutiveName?: string;
    purchaseExecutiveDesignation?: string;
    purchaseExecutiveMobile?: string;
    purchaseExecutiveEmail?: string;
    rfqNumber?: string;
    requirementSource?: 'Email' | 'WhatsApp' | 'Phone' | 'Manual' | 'Other' | string;
    referenceNumber?: string;
  }) => CustomerRequirement;
  updateRequirement: (req: CustomerRequirement) => void;
  deleteRequirement: (id: string, reason?: string) => { success: boolean; message: string };
  deleteRfq: (id: string, reason?: string) => Promise<{ success: boolean; message: string }>;
  purgeRfq: (id: string) => Promise<{ success: boolean; message: string }>;
  purgeAllDeletedRfqs: () => Promise<{ success: boolean; purgedCount: number; message: string }>;
  restoreRequirement: (id: string) => { success: boolean; message: string };
  purgeRequirement: (id: string) => { success: boolean; message: string };
  purgeAllOldTransactions: () => Promise<{ success: boolean; message: string }>;
  purgeAllVendors: () => Promise<{ success: boolean; message: string }>;
  cleanSlateForRealBusiness: () => Promise<{ success: boolean; message: string }>;
  catalogueProducts: CatalogueProduct[];
  rateVersionHistory: RateVersionHistory[];
  importBatches: CatalogueImportBatch[];
  fetchCatalogueRateMatch: (query: string, options?: any) => Promise<RateMatchResult>;
  fetchRateHistory: (partCode: string, brand?: string) => Promise<RateVersionHistory[]>;
  importVersionedCatalogue: (batch: any) => Promise<any>;
  rollbackImportBatch: (batchId: string, force?: boolean) => Promise<{ success: boolean; message: string; rolledBackCount?: number }>;

  sendVendorEnquiry: (requirementId: string, vendorIds: string[], notes?: string) => VendorEnquiry;
  createRfq: (rfqData: Partial<VendorEnquiry>) => Promise<{ success: boolean; rfq?: VendorEnquiry; error?: string }>;
  createBulkRfqs: (rfqsList: any[]) => Promise<{
    success: boolean;
    totalSubmitted: number;
    successfullySaved: number;
    duplicateCount: number;
    failedCount: number;
    results: any[];
    error?: string;
  }>;
  submitVendorQuote: (quote: {
    id?: string;
    enquiryId?: string;
    requirementId: string;
    customerName?: string;
    vendorId: string;
    vendorName: string;
    items: any[];
    validUntil?: string;
    paymentTerms?: string;
    remarks?: string;
    attachmentName?: string;
  }) => VendorQuote;
  updateVendorQuote: (quote: VendorQuote) => VendorQuote;
  deleteVendorQuote: (id: string) => { success: boolean; message?: string };
  getRateCompletionStatus: (requirementId: string) => {
    status: 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'PENDING';
    totalItems: number;
    quotedItemsCount: number;
    missingItems: RequirementItem[];
    quotesCount: number;
    quotes: VendorQuote[];
  };
  createCustomerQuotation: (quoteData: any) => CustomerQuotation;
  recordCustomerPO: (poData: {
    quotationId: string;
    requirementId: string;
    customerPoNumber: string;
    poDate: string;
    customerId: string;
    customerName: string;
    poAmount: number;
    deliveryAddress: string;
    paymentTerms: string;
    remarks?: string;
  }) => CustomerPO;
  createVendorPO: (vpoData: {
    customerPoId: string;
    quotationId: string;
    requirementId: string;
    vendorId: string;
    vendorName: string;
    items: any[];
    subtotal: number;
    gstAmount: number;
    freight: number;
    totalAmount: number;
    deliveryAddress: string;
    deliveryDate: string;
    paymentTerms: string;
    remarks?: string;
  }) => VendorPO;
  submitProformaInvoice: (piData: {
    vendorPoId: string;
    requirementId: string;
    vendorId: string;
    vendorName: string;
    piNumber: string;
    piDate: string;
    amount: number;
    gstAmount: number;
    freight: number;
    totalAmount: number;
    bankDetails: string;
    paymentDueDate: string;
    remarks?: string;
  }) => ProformaInvoice;
  recordPayment: (payData: {
    piId: string;
    vendorPoId: string;
    requirementId: string;
    vendorId: string;
    vendorName: string;
    totalPiAmount: number;
    amountPaid: number;
    paymentDate: string;
    paymentMode: any;
    transactionReference: string;
    remarks?: string;
  }) => PaymentRecord;
  recordDispatch: (dspData: {
    vendorPoId: string;
    requirementId: string;
    vendorId: string;
    vendorName: string;
    dispatchDate: string;
    vendorInvoiceNumber: string;
    transporter: string;
    courierName?: string;
    lrNumber: string;
    awbNumber: string;
    trackingNumber: string;
    quantityDispatched: string;
    expectedDeliveryDate: string;
    remarks?: string;
  }) => DispatchRecord;
  updateDeliveryTracking: (delData: {
    dispatchId: string;
    requirementId: string;
    deliveryDate: string;
    receivedBy: string;
    customerAcknowledgement: string;
    status: any;
    remarks?: string;
  }) => DeliveryRecord;
  closeOrder: (requirementId: string, remarks?: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  pushNotification: (
    title: string,
    message: string,
    type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ACTION_REQUIRED',
    targetRole?: UserRole[],
    linkTab?: string,
    linkId?: string
  ) => void;
  addDocument: (doc: Omit<DocumentRecord, 'id' | 'uploadedAt'>) => void;
  getLinkedOrderData: (requirementId: string) => any;

  // Dual Data Mode (Local Business vs Demo Sandbox)
  dataMode: DataMode;
  setDataMode: (mode: DataMode) => void;
  copyDemoToLocalBusiness: () => void;
  resetCurrentModeData: () => void;
  exportFullBackup: () => void;
  restoreFullBackup: (jsonContent: string) => boolean;

  // Master Data CRUD & Import
  updateCustomer: (customer: Customer) => void;
  deleteCustomer: (id: string) => void;
  importCustomersList: (newCusts: (Omit<Customer, 'id' | 'createdAt'> | Customer)[]) => any;
  updateVendor: (vendor: Vendor) => Promise<Vendor>;
  deleteVendor: (id: string, reason?: string) => Promise<boolean>;
  restoreVendor: (id: string) => Promise<boolean>;
  permanentlyDeleteVendor: (id: string) => Promise<boolean>;
  purgeArchivedVendors: () => Promise<{ success: boolean; count: number }>;
  importVendorsList: (newVends: (Omit<Vendor, 'id' | 'createdAt'> | Vendor)[]) => any;
  updateProduct: (product: ProductItem) => void;
  deleteProduct: (id: string, reason?: string) => void;
  restoreProduct: (id: string) => Promise<boolean>;
  importProductsList: (newProds: (Omit<ProductItem, 'id'> | ProductItem)[]) => any;

  // Commercial Rules & Earning Open/Lock
  lockQuotationCommercials: (quotationId: string, remarks?: string) => void;
  unlockQuotationCommercials: (quotationId: string, reason: string) => void;

  // Category Master & Vendor Matching
  categories: MaterialCategory[];
  addCategory: (cat: Omit<MaterialCategory, 'id' | 'createdAt' | 'updatedAt'>) => MaterialCategory;
  updateCategory: (cat: MaterialCategory) => void;
  deleteCategory: (id: string) => { success: boolean; message: string };
  toggleCategoryStatus: (id: string) => void;
  addKeywordToCategory: (categoryId: string, keyword: string) => void;
  bulkImportRequirements: (newRequirements: Omit<CustomerRequirement, 'id' | 'createdAt'>[]) => number;
  assignVendorToRequirementItem: (requirementId: string, itemId: string, vendorId: string, vendorName: string) => void;

  // Brand Master (Multiple Brands per Vendor & Brand Registry)
  brands: BrandMasterItem[];
  addBrand: (brand: Omit<BrandMasterItem, 'id' | 'createdAt'>) => BrandMasterItem;
  updateBrand: (brand: BrandMasterItem) => void;
  deleteBrand: (id: string) => { success: boolean; message: string };
  archiveBrand: (id: string) => { success: boolean; message: string };
  registerVendorBrands: (brandNames: string[]) => void;

  // AI Vendor Catalog Analyzer & Learning
  aiActivityLogs: AIActivityLog[];
  analyzeVendorCatalogFiles: (vendorId: string, files: Array<{ name: string; type: string; size?: number; textContent?: string }>) => Promise<number>;
  approveVendorMaterialCategory: (vendorId: string, categoryId: string) => void;
  rejectVendorMaterialCategory: (vendorId: string, categoryId: string) => void;
  editVendorMaterialCategory: (vendorId: string, categoryId: string, updated: Partial<VendorMaterialCategory>) => void;
  approveAllVendorMaterialCategories: (vendorId: string) => void;
  approveVendorCatalogProduct: (vendorId: string, productId: string) => void;
  rejectVendorCatalogProduct: (vendorId: string, productId: string) => void;
  learnCategoryFromVendorQuotation: (vendorId: string, categoryName: string, subCategoryName?: string, sourceDoc?: string) => void;
  deleteVendorCatalogFile: (vendorId: string, fileId: string) => void;
  saveCatalogAnalysisToVendor: (
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
    }
  ) => Promise<{ success: boolean; verified?: boolean; batchId?: string; diff?: any }>;
  analyzeVendorWebsite: (
    vendorId: string,
    url: string
  ) => Promise<{ success: boolean; error?: string; result?: any }>;
  manageVendorCatalogueBatch: (
    vendorId: string,
    batchId: string,
    action: 'ARCHIVE' | 'DEACTIVATE' | 'RESTORE' | 'ROLLBACK',
    force?: boolean
  ) => Promise<{
    success: boolean;
    requiresConfirmation?: boolean;
    referencedCount?: number;
    references?: string[];
    message: string;
  }>;
  analyzeVendorOnboarding: (input: {
    vendorNameHint?: string;
    websiteUrl?: string;
    pastedText?: string;
    files?: Array<{ name: string; mimeType?: string; size?: number; sourceRole?: string; textContent?: string; base64Data?: string }>;
    columnMappingOverride?: Record<string, string>;
    forceRefresh?: boolean;
  }) => Promise<{ success: boolean; analysis?: VendorOnboardingAnalysisResult; error?: string }>;
  getVendorCatalogueConfig: () => Promise<VendorCatalogueConfig>;
  uploadCatalogueFileInChunks: (
    file: File,
    opts?: {
      sourceRole?: string;
      chunkSizeBytes?: number;
      onProgress?: (pct: number, uploadedBytes: number, totalBytes: number) => void;
    }
  ) => Promise<{ uploadId: string; fileName: string; fileSizeBytes: number; detectedFormat?: string }>;
  startVendorOnboardingJob: (input: {
    vendorNameHint?: string;
    websiteUrl?: string;
    pastedText?: string;
    files?: Array<{ uploadId?: string; name: string; mimeType?: string; size?: number; sourceRole?: string; textContent?: string; base64Data?: string }>;
    columnMappingOverride?: Record<string, string>;
    forceRefresh?: boolean;
  }) => Promise<{ success: boolean; job?: VendorImportJob; error?: string }>;
  pollVendorOnboardingJob: (jobId: string) => Promise<VendorImportJob | null>;
  fetchVendorOnboardingJobResult: (jobId: string) => Promise<{
    success: boolean;
    pending?: boolean;
    job?: VendorImportJob;
    analysis?: VendorOnboardingAnalysisResult;
    error?: string;
  }>;
  cancelVendorOnboardingJob: (jobId: string) => Promise<boolean>;
  listVendorOnboardingJobs: () => Promise<VendorImportJob[]>;
  commitVendorOnboarding: (
    payload: VendorOnboardingCommitPayload
  ) => Promise<{
    success: boolean;
    verified?: boolean;
    mode?: 'CREATE' | 'UPDATE';
    vendor?: Vendor;
    createdBrandsCount?: number;
    createdCategoriesCount?: number;
    createdProductsCount?: number;
    mappingsCreatedCount?: number;
    rateHistoryRecorded?: number;
    error?: string;
  }>;

  // Products & Materials Supplied Master Registry
  vendorProductMappings: VendorProductMapping[];
  addVendorProductMapping: (mapping: Omit<VendorProductMapping, 'id' | 'createdAt'>) => Promise<VendorProductMapping>;
  updateVendorProductMapping: (mapping: VendorProductMapping) => Promise<void>;
  deleteVendorProductMapping: (id: string) => Promise<void>;
  bulkAddVendorProductMappings: (
    vendorId: string,
    mappings: Partial<VendorProductMapping>[],
    vendorOverride?: Vendor
  ) => Promise<{ added: number; updated: number; skipped: number }>;

  // Global Product Type Master & One-Click Vendor Linking
  productTypes: ProductTypeMasterItem[];
  addProductTypeToMaster: (name: string, category?: string) => Promise<ProductTypeMasterItem>;
  addProductTypeToVendor: (
    vendorId: string,
    productTypeName: string,
    category?: string,
    brand?: string
  ) => Promise<{ productType: ProductTypeMasterItem; mapping: VendorProductMapping }>;
  removeProductTypeFromVendor: (mappingId: string) => Promise<void>;

  // Automated Cloud Backup & Recovery
  backups: BackupRecord[];
  backupSettings: BackupSettings;
  updateBackupSettings: (settings: Partial<BackupSettings>) => void;
  triggerManualBackup: () => BackupRecord;
  restoreFromBackupRecord: (backupId: string) => boolean;
  testBackupRecord: (backupId: string) => { valid: boolean; message: string; details: any };
  backupFailureAlert: { timestamp: string; error: string } | null;
  clearBackupFailureAlert: () => void;

  // User Management & Access Control (Admin Module)
  addUser: (userData: Omit<User, 'id' | 'createdAt'>) => User;
  updateUser: (user: User) => void;
  deleteUser: (id: string) => { success: boolean; message: string };
  toggleUserStatus: (id: string) => void;
  resetUserPassword: (id: string, tempPass?: string) => { success: boolean; message: string; tempPass: string };
  changeUserPassword: (userId: string, currentPass: string, newPass: string) => { success: boolean; message: string };
  updateUserPermissions: (userId: string, permissions: NonNullable<User['permissions']>, approvalLimit?: number) => void;
  refreshUsersFromBackend: () => Promise<{ success: boolean; error?: string }>;
  syncBackendNow: () => Promise<void>;
  pushDeviceDataToCentralDb: () => Promise<{ success: boolean; message: string }>;
  exportTeamSyncSnapshot: () => string;
  importTeamSyncSnapshot: (raw: string) => { success: boolean; count: number; message: string };
  isSyncing: boolean;
  lastSyncTime: Date;
  isOnline: boolean;
  cloudSyncState: CloudSyncState;
  connectCloudDatabase: () => Promise<{ success: boolean; message: string }>;
  disconnectCloudDatabase: () => Promise<void>;
  inviteCloudTeammate: (email: string, displayName?: string, erpRole?: string) => Promise<{ success: boolean; message: string }>;
  removeCloudTeammate: (email: string) => Promise<{ success: boolean; message: string }>;
  branding: ErpBrandingConfig;
  updateBranding: (newBranding: Partial<ErpBrandingConfig>) => Promise<void>;
  theme: ThemeConfig;
  updateTheme: (newTheme: Partial<ThemeConfig>) => Promise<void>;
  brandDiscounts: BulkBrandDiscountRule[];
  saveBulkBrandDiscounts: (rules: BulkBrandDiscountRule[]) => Promise<void>;

  // Brand Catalogue Import, AI Identification & Learning
  catalogueImportHistory: CatalogueImportHistoryRecord[];
  confirmedAiMappings: ConfirmedAiMappingRecord[];
  mappingTemplates: SavedColumnMappingTemplate[];
  importCatalogueBatch: (
    items: ImportPreviewRow[],
    newBrands?: Array<{ name: string; code?: string; category?: string }>,
    historyRecord?: Partial<CatalogueImportHistoryRecord>
  ) => Promise<{ success: boolean; added: number; updated: number; skipped: number; error?: string }>;
  saveConfirmedAiMapping: (
    mapping: Omit<ConfirmedAiMappingRecord, 'id' | 'confirmedAt'>
  ) => Promise<ConfirmedAiMappingRecord>;
  saveColumnMappingTemplate: (
    name: string,
    mapping: Record<string, string>
  ) => Promise<SavedColumnMappingTemplate>;
  fetchCatalogueImportHistory: () => Promise<CatalogueImportHistoryRecord[]>;
}

// Default starter items for Local Business Mode (Clean starter slate)
const INITIAL_LOCAL_CUSTOMERS: Customer[] = [
  {
    id: 'CUST-001',
    companyName: 'Apex Industrial Technologies Pvt Ltd',
    contactPerson: 'Suresh Patil (Procurement Head)',
    mobile: '+91 98201 44552',
    email: 'procurement@apexind.com',
    address: 'Plot 42, Hinjewadi Phase 2, Pune',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411057',
    gstin: '27AABCA1234F1ZX',
    pan: 'AABCA1234F',
    paymentTerms: '30 Days Net',
    deliveryAddress: 'Central Receiving Dock, Unit 2, Hinjewadi',
    remarks: 'Private Local Business Account',
    createdAt: '2026-09-20',
  },
];

const INITIAL_LOCAL_VENDORS: Vendor[] = [
  {
    id: 'VEND-001',
    companyName: 'Precision Engineering & Bearings Co.',
    contactPerson: 'Ramesh Mehta',
    mobile: '+91 98920 11223',
    email: 'sales@precisionbearing.in',
    address: '14, Industrial Area, Sector 5, Bhosari',
    city: 'Pune',
    state: 'Maharashtra',
    gstin: '27AAACP9988D1Z8',
    pan: 'AAACP9988D',
    bankDetails: {
      accountName: 'Precision Engineering & Bearings Co.',
      accountNumber: '50200088991122',
      bankName: 'ICICI Bank',
      ifscCode: 'ICIC0000104',
      branch: 'Bhosari Pune',
    },
    paymentTerms: '50% Advance, Balance on LR',
    deliveryTerms: 'Door Delivery',
    productCategories: ['Bearings', 'Power Transmission', 'Shafts'],
    brandsSupplied: ['SKF', 'Timken', 'FAG'],
    rating: 4.9,
    remarks: 'Preferred Local Channel Partner',
    createdAt: '2026-09-20',
  },
];

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode; initialTab?: string }> = ({
  children,
  initialTab = 'dashboard',
}) => {
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('procure_user');
    return saved ? JSON.parse(saved) : INITIAL_USERS[0]; // Default to Super Admin
  });

  const [isMobileView, setIsMobileView] = useState<boolean>(() => {
    return window.innerWidth < 768;
  });

  const [activeTab, setActiveTab] = useState<string>(initialTab || 'dashboard');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Active Data Mode: Unified Live Enterprise Cloud Database across all company laptops & users
  const [dataMode, setDataModeState] = useState<DataMode>(() => {
    return 'LIVE_ENTERPRISE' as DataMode;
  });

  const getStoragePrefix = (_mode?: DataMode) => 'erp_live_';

  const readTombstoneList = (key: string): string[] => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  };

  const writeTombstoneList = (key: string, ids: string[]): string[] => {
    const unique = Array.from(new Set(ids.filter((x) => typeof x === 'string' && x.trim().length > 0)));
    try {
      localStorage.setItem(key, JSON.stringify(unique));
    } catch {}
    return unique;
  };

  const addTombstoneIds = (key: string, ids: string[]): string[] => {
    return writeTombstoneList(key, [...readTombstoneList(key), ...ids]);
  };

  const removeTombstoneIds = (key: string, ids: string[]): string[] => {
    const toRemove = new Set(ids);
    return writeTombstoneList(
      key,
      readTombstoneList(key).filter((id) => !toRemove.has(id))
    );
  };

  const nextSequenceId = (prefix: string, items: Array<{ id?: string }>, tombstoneKey: string): string => {
    return generateCollisionSafeSeqId(prefix, items, readTombstoneList(tombstoneKey));
  };

  const pendingLocalWritesRef = React.useRef<Map<string, number>>(new Map());
  const pendingLocalDeletesRef = React.useRef<Map<string, number>>(new Map());
  const LOCAL_GRACE_WINDOW_MS = 45000;

  const markLocalWrite = (collection: string, id?: string) => {
    if (!id) return;
    const key = `${collection}:${id}`;
    pendingLocalWritesRef.current.set(key, Date.now());
    pendingLocalDeletesRef.current.delete(key);
  };

  const markLocalDelete = (collection: string, id?: string) => {
    if (!id) return;
    const key = `${collection}:${id}`;
    pendingLocalDeletesRef.current.set(key, Date.now());
    pendingLocalWritesRef.current.delete(key);
  };

  const isPendingLocalDelete = (collection: string, id?: string): boolean => {
    if (!id) return false;
    const key = `${collection}:${id}`;
    const ts = pendingLocalDeletesRef.current.get(key);
    if (!ts) return false;
    if (Date.now() - ts < LOCAL_GRACE_WINDOW_MS) return true;
    pendingLocalDeletesRef.current.delete(key);
    return false;
  };

  const isRecentLocalRecord = (collection: string, id?: string, createdAt?: string): boolean => {
    const now = Date.now();
    if (id) {
      const ts = pendingLocalWritesRef.current.get(`${collection}:${id}`);
      if (ts) {
        if (now - ts < LOCAL_GRACE_WINDOW_MS) return true;
        pendingLocalWritesRef.current.delete(`${collection}:${id}`);
      }
    }
    if (createdAt && createdAt.includes('T')) {
      const parsed = new Date(createdAt).getTime();
      if (!isNaN(parsed) && now - parsed < LOCAL_GRACE_WINDOW_MS) return true;
    }
    return false;
  };

  // Helper to load collection with auto-migration from previous local business or demo stores
  const loadCollection = <T,>(keySuffix: string, _mode: DataMode, fallback: T): T => {
    // 1. Authoritative central live cache
    const live = localStorage.getItem(`erp_live_${keySuffix}`);
    if (live !== null) {
      try {
        const parsed = JSON.parse(live);
        // Valid if it's an array (even empty array [] when records were deleted/purged)
        if (Array.isArray(parsed)) return parsed as unknown as T;
        if (parsed !== null && parsed !== undefined) return parsed;
      } catch {}
    }
    // 2. Migration from user's previous laptop local business store
    const biz = localStorage.getItem(`mro_biz_${keySuffix}`);
    if (biz !== null) {
      try {
        const parsed = JSON.parse(biz);
        if (Array.isArray(parsed)) {
          localStorage.setItem(`erp_live_${keySuffix}`, biz);
          return parsed as unknown as T;
        }
      } catch {}
    }
    // 3. Fallback to previous demo store if present
    const demo = localStorage.getItem(`mro_demo_${keySuffix}`) || localStorage.getItem(`mro_${keySuffix}`);
    if (demo !== null) {
      try {
        const parsed = JSON.parse(demo);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localStorage.setItem(`erp_live_${keySuffix}`, demo);
          return parsed as unknown as T;
        }
      } catch {}
    }
    return fallback;
  };

  // States - Defaulting to authoritative production records across all team laptops
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const initMode = (localStorage.getItem('mro_active_data_mode') === 'LOCAL_BUSINESS' ? 'LOCAL_BUSINESS' : 'DEMO') as DataMode;
    const loaded = loadCollection('customers', initMode, INITIAL_CUSTOMERS);
    const localDeleted = readTombstoneList('erp_deleted_customers');
    const list = Array.isArray(loaded) ? loaded : INITIAL_CUSTOMERS;
    return list.filter((c: any) => c && c.id && !c.isDeleted && !localDeleted.includes(c.id));
  });

  const [companies, setCompanies] = useState<Company[]>(() => {
    const initMode = (localStorage.getItem('mro_active_data_mode') === 'LOCAL_BUSINESS' ? 'LOCAL_BUSINESS' : 'DEMO') as DataMode;
    const hasLiveStore = localStorage.getItem('erp_live_companies') !== null;
    const loaded = loadCollection('companies', initMode, INITIAL_COMPANIES);
    const localDeleted = new Set([...readTombstoneList('erp_deleted_companies'), ...readTombstoneList('erp_deleted_customers')]);
    const list = Array.isArray(loaded) ? loaded : INITIAL_COMPANIES;
    const filtered = list.filter((c: any) => c && c.id && !c.isDeleted && !localDeleted.has(c.id));
    if (!hasLiveStore && filtered.length === 0) {
      return INITIAL_COMPANIES.filter((c) => !localDeleted.has(c.id));
    }
    return filtered;
  });

  const [purchaseExecutives, setPurchaseExecutives] = useState<PurchaseExecutive[]>(() => {
    const initMode = (localStorage.getItem('mro_active_data_mode') === 'LOCAL_BUSINESS' ? 'LOCAL_BUSINESS' : 'DEMO') as DataMode;
    const hasLiveStore = localStorage.getItem('erp_live_purchase_executives') !== null;
    const loaded = loadCollection('purchase_executives', initMode, INITIAL_PURCHASE_EXECUTIVES);
    const localDeleted = new Set(readTombstoneList('erp_deleted_purchase_executives'));
    const list = Array.isArray(loaded) ? loaded : INITIAL_PURCHASE_EXECUTIVES;
    const filtered = list.filter((e: any) => e && e.id && !e.isDeleted && !localDeleted.has(e.id));
    if (!hasLiveStore && filtered.length === 0) {
      return INITIAL_PURCHASE_EXECUTIVES.filter((e) => !localDeleted.has(e.id));
    }
    return filtered;
  });

  const [vendors, setVendors] = useState<Vendor[]>(() => {
    // Authoritative production cache only — never inject demo INITIAL_VENDORS on startup/refresh
    try {
      const raw = localStorage.getItem('erp_live_vendors');
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const localDeleted = readTombstoneList('erp_deleted_vendors');
          return parsed.filter((v: any) => v && v.id && !v.isDeleted && !localDeleted.includes(v.id));
        }
      }
    } catch {}
    return [];
  });

  const [archivedVendors, setArchivedVendors] = useState<Vendor[]>(() => {
    try {
      const raw = localStorage.getItem('erp_live_archived_vendors');
      const list = raw ? JSON.parse(raw) : [];
      const localDeleted = readTombstoneList('erp_deleted_vendors');
      return Array.isArray(list) ? list.filter((v: any) => v && v.id && !localDeleted.includes(v.id)) : [];
    } catch {
      return [];
    }
  });

  const [products, setProducts] = useState<ProductItem[]>(() => {
    const initMode = (localStorage.getItem('mro_active_data_mode') === 'LOCAL_BUSINESS' ? 'LOCAL_BUSINESS' : 'DEMO') as DataMode;
    const loaded = loadCollection('products', initMode, INITIAL_PRODUCTS);
    const localDeleted = readTombstoneList('erp_deleted_products');
    const list = Array.isArray(loaded) ? loaded : INITIAL_PRODUCTS;
    return list.filter((p: any) => p && p.id && !p.isDeleted && !localDeleted.includes(p.id));
  });

  const [requirements, setRequirements] = useState<CustomerRequirement[]>(() => {
    const initMode = (localStorage.getItem('mro_active_data_mode') === 'LOCAL_BUSINESS' ? 'LOCAL_BUSINESS' : 'DEMO') as DataMode;
    const defaultList = [
      INITIAL_REQUIREMENT_001,
      INITIAL_REQUIREMENT_002,
      INITIAL_REQUIREMENT_003,
      INITIAL_REQUIREMENT_004,
    ];
    const loaded = loadCollection('requirements', initMode, defaultList);
    // Load local deleted tombstones if any
    let localDeleted: string[] = [];
    try {
      const stored = localStorage.getItem('erp_deleted_requirements');
      if (stored) localDeleted = JSON.parse(stored);
    } catch {}

    const rawList = Array.isArray(loaded) ? loaded : defaultList;
    const listToFilter = rawList.filter(
      (r: any) =>
        r &&
        r.id &&
        !r.isDeleted &&
        !localDeleted.includes(r.id) &&
        !(r.rfqNumber && localDeleted.includes(r.rfqNumber))
    );
    const filtered = listToFilter.map((r) => {
      // Guarantee hyfunfoods for REQ-001 and REQ-002 if present
      if (r.id === 'REQ-2026-00001' && (r.customerName?.includes('Tata') || r.companyName?.includes('Tata') || !r.companyName)) {
        return { ...INITIAL_REQUIREMENT_001, ...r, customerName: 'hyfunfoods', companyName: 'hyfunfoods' };
      }
      if (r.id === 'REQ-2026-00002' && (r.customerName?.includes('Larsen') || r.companyName?.includes('Larsen') || !r.companyName)) {
        return { ...INITIAL_REQUIREMENT_002, ...r, customerName: 'hyfunfoods', companyName: 'hyfunfoods' };
      }
      return r;
    });
    return filtered;
  });

  const [rfqs, setRfqs] = useState<VendorEnquiry[]>(() => {
    const initMode = (localStorage.getItem('mro_active_data_mode') === 'LOCAL_BUSINESS' ? 'LOCAL_BUSINESS' : 'DEMO') as DataMode;
    const loaded = loadCollection('rfqs', initMode, [INITIAL_RFQ_001, INITIAL_RFQ_002, INITIAL_RFQ_003]);
    let localDeleted: string[] = [];
    try {
      const stored = localStorage.getItem('erp_deleted_requirements');
      if (stored) localDeleted = JSON.parse(stored);
    } catch {}
    const list = Array.isArray(loaded) ? loaded : [INITIAL_RFQ_001, INITIAL_RFQ_002, INITIAL_RFQ_003];
    return list.filter(
      (r: any) =>
        r &&
        r.id &&
        !r.isDeleted &&
        !localDeleted.includes(r.id) &&
        !(r.rfqNumber && localDeleted.includes(r.rfqNumber)) &&
        !(r.requirementId && localDeleted.includes(r.requirementId))
    );
  });

  const [vendorQuotes, setVendorQuotes] = useState<VendorQuote[]>(() => {
    const initMode = (localStorage.getItem('mro_active_data_mode') === 'LOCAL_BUSINESS' ? 'LOCAL_BUSINESS' : 'DEMO') as DataMode;
    const defaultQuotes = [...INITIAL_VENDOR_QUOTES_001, ...INITIAL_VENDOR_QUOTES_002, ...INITIAL_VENDOR_QUOTES_003];
    const loaded = loadCollection('vendor_quotes', initMode, defaultQuotes);
    const localDeleted = readTombstoneList('erp_deleted_vendor_quotes');
    const list = Array.isArray(loaded) ? loaded : defaultQuotes;
    return list.filter((q: any) => q && q.id && !localDeleted.includes(q.id));
  });

  const [customerQuotations, setCustomerQuotations] = useState<CustomerQuotation[]>(() => {
    const initMode = (localStorage.getItem('mro_active_data_mode') === 'LOCAL_BUSINESS' ? 'LOCAL_BUSINESS' : 'DEMO') as DataMode;
    const defaultQuotes = [INITIAL_CUSTOMER_QUOTATION_001, INITIAL_CUSTOMER_QUOTATION_002];
    const loaded = loadCollection('quotations', initMode, defaultQuotes);
    return Array.isArray(loaded) ? loaded : defaultQuotes;
  });

  const [customerPOs, setCustomerPOs] = useState<CustomerPO[]>(() => {
    const initMode = (localStorage.getItem('mro_active_data_mode') === 'LOCAL_BUSINESS' ? 'LOCAL_BUSINESS' : 'DEMO') as DataMode;
    const defaultPOs = [INITIAL_CUSTOMER_PO_001, INITIAL_CUSTOMER_PO_002];
    const loaded = loadCollection('customer_pos', initMode, defaultPOs);
    return Array.isArray(loaded) ? loaded : defaultPOs;
  });

  const [vendorPOs, setVendorPOs] = useState<VendorPO[]>(() => {
    const initMode = (localStorage.getItem('mro_active_data_mode') === 'LOCAL_BUSINESS' ? 'LOCAL_BUSINESS' : 'DEMO') as DataMode;
    const defaultVPOs = [INITIAL_VENDOR_PO_001, INITIAL_VENDOR_PO_002];
    const loaded = loadCollection('vendor_pos', initMode, defaultVPOs);
    return Array.isArray(loaded) ? loaded : defaultVPOs;
  });

  const [proformaInvoices, setProformaInvoices] = useState<ProformaInvoice[]>(() => {
    const initMode = (localStorage.getItem('mro_active_data_mode') === 'LOCAL_BUSINESS' ? 'LOCAL_BUSINESS' : 'DEMO') as DataMode;
    const defaultPIs = [INITIAL_PROFORMA_INVOICE_001, INITIAL_PROFORMA_INVOICE_002];
    const loaded = loadCollection('proforma_invoices', initMode, defaultPIs);
    return Array.isArray(loaded) ? loaded : defaultPIs;
  });

  const [payments, setPayments] = useState<PaymentRecord[]>(() => {
    const initMode = (localStorage.getItem('mro_active_data_mode') === 'LOCAL_BUSINESS' ? 'LOCAL_BUSINESS' : 'DEMO') as DataMode;
    const defaultPayments = [INITIAL_PAYMENT_001, INITIAL_PAYMENT_002];
    const loaded = loadCollection('payments', initMode, defaultPayments);
    return Array.isArray(loaded) ? loaded : defaultPayments;
  });

  const [dispatches, setDispatches] = useState<DispatchRecord[]>(() => {
    const initMode = (localStorage.getItem('mro_active_data_mode') === 'LOCAL_BUSINESS' ? 'LOCAL_BUSINESS' : 'DEMO') as DataMode;
    const defaultDispatches = [INITIAL_DISPATCH_001, INITIAL_DISPATCH_002];
    const loaded = loadCollection('dispatches', initMode, defaultDispatches);
    return Array.isArray(loaded) ? loaded : defaultDispatches;
  });

  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>(() => {
    const initMode = (localStorage.getItem('mro_active_data_mode') === 'LOCAL_BUSINESS' ? 'LOCAL_BUSINESS' : 'DEMO') as DataMode;
    const defaultDeliveries = [INITIAL_DELIVERY_001, INITIAL_DELIVERY_002];
    const loaded = loadCollection('deliveries', initMode, defaultDeliveries);
    return Array.isArray(loaded) ? loaded : defaultDeliveries;
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const s = localStorage.getItem('mro_notifications');
    return s ? JSON.parse(s) : INITIAL_NOTIFICATIONS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(() => {
    const s = localStorage.getItem('mro_audit_logs');
    return s ? JSON.parse(s) : INITIAL_AUDIT_LOGS;
  });

  const [documents, setDocuments] = useState<DocumentRecord[]>(() => {
    const s = localStorage.getItem('mro_documents');
    return s ? JSON.parse(s) : INITIAL_DOCUMENTS;
  });

  const [categories, setCategories] = useState<MaterialCategory[]>(() => {
    const initMode = (localStorage.getItem('mro_active_data_mode') === 'LOCAL_BUSINESS' ? 'LOCAL_BUSINESS' : 'DEMO') as DataMode;
    const raw = loadCollection('categories', initMode, INITIAL_MATERIAL_CATEGORIES);
    const localDeleted = readTombstoneList('erp_deleted_categories');
    return (Array.isArray(raw) ? raw : INITIAL_MATERIAL_CATEGORIES)
      .filter((c: any) => c && c.id && !c.isDeleted && !localDeleted.includes(c.id))
      .map((c: any) => ({
        ...c,
        code: c.code || c.id || 'CAT',
        description: c.description || '',
        subCategories: Array.isArray(c.subCategories) ? c.subCategories : ['Standard'],
        keywords: Array.isArray(c.keywords) ? c.keywords : [(c.name || '').toLowerCase()],
        itemExamples: Array.isArray(c.itemExamples) ? c.itemExamples : [],
        isActive: c.isActive !== false,
      }));
  });

  const [brands, setBrands] = useState<BrandMasterItem[]>(() => {
    const initMode = (localStorage.getItem('mro_active_data_mode') === 'LOCAL_BUSINESS' ? 'LOCAL_BUSINESS' : 'DEMO') as DataMode;
    const loaded = loadCollection('brands', initMode, INITIAL_BRANDS);
    const localDeleted = readTombstoneList('erp_deleted_brands');
    const list = Array.isArray(loaded) ? loaded : INITIAL_BRANDS;
    return list.filter((b: any) => b && b.id && !b.isDeleted && !localDeleted.includes(b.id));
  });
  const brandsRef = React.useRef<BrandMasterItem[]>(brands);
  brandsRef.current = brands;

  const [vendorProductMappings, setVendorProductMappings] = useState<VendorProductMapping[]>(() => {
    const initMode = (localStorage.getItem('mro_active_data_mode') === 'LOCAL_BUSINESS' ? 'LOCAL_BUSINESS' : 'DEMO') as DataMode;
    const loaded = loadCollection('vendor_products', initMode, []);
    const localDeleted = readTombstoneList('erp_deleted_vendor_mappings');
    const list = Array.isArray(loaded) ? loaded : [];
    return list.filter((m: any) => m && m.id && !m.isDeleted && !localDeleted.includes(m.id));
  });

  const [productTypes, setProductTypes] = useState<ProductTypeMasterItem[]>(() => {
    const initMode = (localStorage.getItem('mro_active_data_mode') === 'LOCAL_BUSINESS' ? 'LOCAL_BUSINESS' : 'DEMO') as DataMode;
    const defaults: ProductTypeMasterItem[] = [
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
    return loadCollection('product_types', initMode, defaults);
  });

  const [catalogueProducts, setCatalogueProducts] = useState<CatalogueProduct[]>(() => {
    try {
      const stored = localStorage.getItem('erp_live_catalogue_products');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_CATALOGUE_PRODUCTS;
  });

  const [rateVersionHistory, setRateVersionHistory] = useState<RateVersionHistory[]>(() => {
    try {
      const stored = localStorage.getItem('erp_live_rate_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_RATE_VERSION_HISTORY;
  });

  const [importBatches, setImportBatches] = useState<CatalogueImportBatch[]>(() => {
    try {
      const stored = localStorage.getItem('erp_live_import_batches');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_IMPORT_BATCHES;
  });

  // Fetch versioned catalogue on mount (only when authenticated)
  useEffect(() => {
    const isLoggedOut = typeof window !== 'undefined' && localStorage.getItem('mro_is_logged_out') === 'true';
    const hasSession =
      typeof window !== 'undefined' &&
      Boolean(sessionStorage.getItem('mro_current_session_id') || localStorage.getItem('mro_current_session_id'));
    if (isLoggedOut || !hasSession) return;

    fetchApi('/api/catalog/products')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.products) && data.products.length > 0) {
          setCatalogueProducts(data.products);
          localStorage.setItem('erp_live_catalogue_products', JSON.stringify(data.products));
        }
      })
      .catch(() => {});

    fetchApi('/api/catalog/batches')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.batches) && data.batches.length > 0) {
          setImportBatches(data.batches);
          localStorage.setItem('erp_live_import_batches', JSON.stringify(data.batches));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const curPrefix = getStoragePrefix(dataMode);
    localStorage.setItem(`${curPrefix}vendor_products`, JSON.stringify(vendorProductMappings));
  }, [vendorProductMappings, dataMode]);


  useEffect(() => {
    const curPrefix = getStoragePrefix(dataMode);
    localStorage.setItem(`${curPrefix}product_types`, JSON.stringify(productTypes));
  }, [productTypes, dataMode]);

  const DEFAULT_BRANDING: ErpBrandingConfig = {
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

  const DEFAULT_THEME: ThemeConfig = {
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

  const [branding, setBranding] = useState<ErpBrandingConfig>(() => {
    try {
      const stored = localStorage.getItem('erp_branding_config');
      if (stored) return { ...DEFAULT_BRANDING, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_BRANDING;
  });

  const [theme, setTheme] = useState<ThemeConfig>(() => {
    try {
      const stored = localStorage.getItem('erp_theme_config');
      if (stored) return { ...DEFAULT_THEME, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_THEME;
  });

  const [brandDiscounts, setBrandDiscounts] = useState<BulkBrandDiscountRule[]>([]);
  const [catalogueImportHistory, setCatalogueImportHistory] = useState<CatalogueImportHistoryRecord[]>([]);
  const [confirmedAiMappings, setConfirmedAiMappings] = useState<ConfirmedAiMappingRecord[]>([]);
  const [mappingTemplates, setMappingTemplates] = useState<SavedColumnMappingTemplate[]>([]);

  // Load branding, theme & catalog metadata from authoritative backend
  useEffect(() => {
    const isLoggedOut = typeof window !== 'undefined' && localStorage.getItem('mro_is_logged_out') === 'true';
    if (isLoggedOut) return;

    fetchApi('/api/branding', { timeoutMs: 5000 })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.erpName) {
          setBranding((prev) => ({ ...prev, ...data }));
          try {
            localStorage.setItem('erp_branding_config', JSON.stringify(data));
          } catch {}
        }
      })
      .catch(() => {});

    fetchApi('/api/theme', { timeoutMs: 5000 })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.primaryColor) {
          setTheme((prev) => ({ ...prev, ...data }));
          try {
            localStorage.setItem('erp_theme_config', JSON.stringify(data));
          } catch {}
        }
      })
      .catch(() => {});

    fetchApi('/api/brand-discounts')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.discounts)) {
          setBrandDiscounts(data.discounts);
        }
      })
      .catch(() => {});

    fetchApi('/api/catalog/import-history')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.history)) {
          setCatalogueImportHistory(data.history);
        }
      })
      .catch(() => {});

    fetchApi('/api/ai/confirmed-mappings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.mappings)) {
          setConfirmedAiMappings(data.mappings);
        }
      })
      .catch(() => {});

    fetchApi('/api/catalog/mapping-templates')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.templates)) {
          setMappingTemplates(data.templates);
        }
      })
      .catch(() => {});
  }, []);

  // Real-Time SSE Listener for Multi-Device synchronization (debounced to prevent burst sync storms)
  const sseSyncDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const unsub = subscribeToSyncEvents((event) => {
      if (event.type === 'BRANDING_UPDATED' && event.data) {
        setBranding((prev) => ({ ...prev, ...event.data }));
      } else if (event.type === 'BRAND_DISCOUNTS_UPDATED' && event.data) {
        setBrandDiscounts(event.data);
      } else if (
        event.type === 'DATABASE_MUTATION' ||
        event.type === 'RFQS_UPDATED' ||
        event.type === 'CATALOGUE_UPDATED'
      ) {
        if (sseSyncDebounceRef.current) clearTimeout(sseSyncDebounceRef.current);
        sseSyncDebounceRef.current = setTimeout(() => {
          syncBackendStateRef.current?.({ force: true, notify: false });
        }, 350);
      }
    });
    return () => {
      if (sseSyncDebounceRef.current) clearTimeout(sseSyncDebounceRef.current);
      unsub();
    };
  }, []);

  // Dynamically apply Theme CSS variables and HTML meta tags
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.style.setProperty('--color-primary', theme.primaryColor);
      root.style.setProperty('--color-secondary', theme.secondaryColor);
      root.style.setProperty('--color-accent', theme.accentColor);

      if (theme.mode === 'DARK') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [theme]);

  useEffect(() => {
    if (typeof document !== 'undefined' && branding.erpName) {
      document.title = `${branding.erpName} — ${branding.tagline}`;
    }
  }, [branding]);

  const updateBranding = async (newBranding: Partial<ErpBrandingConfig>) => {
    const merged = { ...branding, ...newBranding, updatedAt: new Date().toISOString() };
    setBranding(merged);
    try {
      localStorage.setItem('erp_branding_config', JSON.stringify(merged));
    } catch {}

    fetchApi('/api/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    }).catch((e) => console.warn('[Branding] Remote sync warning:', e));
    pushMutationToCloud({ settingsMap: { branding: { ...merged, id: 'branding', title: merged.erpName || 'Branding' } } });
  };

  const updateTheme = async (newTheme: Partial<ThemeConfig>) => {
    const merged = { ...theme, ...newTheme };
    setTheme(merged);
    try {
      localStorage.setItem('erp_theme_config', JSON.stringify(merged));
    } catch {}

    fetchApi('/api/theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: merged, userId: currentUser.id }),
    }).catch((e) => console.warn('[Theme] Remote sync warning:', e));
    pushMutationToCloud({ settingsMap: { theme: { ...merged, id: 'theme', title: 'Theme Config' } } });
  };

  const saveBulkBrandDiscounts = async (rules: BulkBrandDiscountRule[]) => {
    setBrandDiscounts(rules);
    fetchApi('/api/brand-discounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discounts: rules }),
    }).catch((e) => console.warn('[BrandDiscounts] Remote sync warning:', e));
  };

  const importCatalogueBatch = async (
    items: ImportPreviewRow[],
    newBrands?: Array<{ name: string; code?: string; category?: string }>,
    historyRecord?: Partial<CatalogueImportHistoryRecord>
  ) => {
    try {
      const res = await fetchApi('/api/catalog/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          newBrands,
          importHistoryRecord: historyRecord,
          user: currentUser.name,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Immediately refresh products and brands from server without requiring page refresh
        const prodRes = await fetchApi('/api/products');
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          if (Array.isArray(prodData.products)) {
            setProducts(prodData.products);
          }
        }
        const brandRes = await fetchApi('/api/brands');
        if (brandRes.ok) {
          const brandData = await brandRes.json();
          if (Array.isArray(brandData.brands)) {
            setBrands(brandData.brands);
          }
        }
        // Refresh import history
        const histRes = await fetchApi('/api/catalog/import-history');
        if (histRes.ok) {
          const histData = await histRes.json();
          if (Array.isArray(histData.history)) {
            setCatalogueImportHistory(histData.history);
          }
        }
      }
      return data;
    } catch (err: any) {
      console.error('Failed to import catalogue batch:', err);
      return { success: false, added: 0, updated: 0, skipped: 0, error: err.message };
    }
  };

  const saveConfirmedAiMapping = async (
    mapping: Omit<ConfirmedAiMappingRecord, 'id' | 'confirmedAt'>
  ) => {
    try {
      const res = await fetchApi('/api/ai/confirmed-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapping),
      });
      const data = await res.json();
      if (data.success && data.mapping) {
        setConfirmedAiMappings((prev) => [data.mapping, ...prev]);
        return data.mapping;
      }
    } catch (err) {
      console.error('Failed to save confirmed AI mapping:', err);
    }
    const fallback: ConfirmedAiMappingRecord = {
      ...mapping,
      id: `MAP-${Date.now()}`,
      confirmedAt: new Date().toISOString(),
    };
    setConfirmedAiMappings((prev) => [fallback, ...prev]);
    return fallback;
  };

  const saveColumnMappingTemplate = async (name: string, mapping: Record<string, string>) => {
    try {
      const res = await fetchApi('/api/catalog/mapping-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mapping }),
      });
      const data = await res.json();
      if (data.success && data.template) {
        setMappingTemplates((prev) => [...prev, data.template]);
        return data.template;
      }
    } catch (err) {
      console.error('Failed to save mapping template:', err);
    }
    const fallback: SavedColumnMappingTemplate = {
      id: `TPL-${Date.now()}`,
      name,
      mapping,
      createdAt: new Date().toISOString(),
    };
    setMappingTemplates((prev) => [...prev, fallback]);
    return fallback;
  };

  const fetchCatalogueImportHistory = async () => {
    try {
      const res = await fetchApi('/api/catalog/import-history');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.history)) {
          setCatalogueImportHistory(data.history);
          return data.history;
        }
      }
    } catch (err) {
      console.error('Failed to fetch import history:', err);
    }
    return catalogueImportHistory;
  };

  const [aiActivityLogs, setAiActivityLogs] = useState<AIActivityLog[]>(() => {
    const s = localStorage.getItem('mro_ai_activity_logs');
    if (s) {
      try {
        return JSON.parse(s);
      } catch {
        // fallback
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('mro_ai_activity_logs', JSON.stringify(aiActivityLogs));
  }, [aiActivityLogs]);

  const [backups, setBackups] = useState<BackupRecord[]>(() => getSavedBackups());
  const [backupSettings, setBackupSettings] = useState<BackupSettings>(() => getBackupSettings());
  const [backupFailureAlert, setBackupFailureAlert] = useState<{ timestamp: string; error: string } | null>(() => getActiveBackupFailure());

  const [availableUsers, setAvailableUsers] = useState<User[]>(() => {
    const s = localStorage.getItem('mro_users');
    if (s) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // fallback
      }
    }
    return INITIAL_USERS;
  });

  useEffect(() => {
    localStorage.setItem('mro_users', JSON.stringify(availableUsers));
  }, [availableUsers]);

  // Central Real-Time Cloud Synchronization Engine State
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [cloudSyncState, setCloudSyncState] = useState<CloudSyncState>({
    connected: false,
    schemaApplied: false,
    serverConfigured: false,
    status: 'LOCAL_ONLY',
    email: null,
    uid: null,
    isAdmin: false,
    error: null,
    projectId: 'plvjsiehhpdoyvzgahpr',
    databaseId: 'postgresql',
    invitedEmails: [],
    memberCount: 0,
    lastCloudSyncAt: null,
  });

  const broadcastRef = React.useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        broadcastRef.current = new BroadcastChannel('mro_enterprise_cloud_sync');
      } catch {}
    }
    return () => {
      try {
        broadcastRef.current?.close();
      } catch {}
    };
  }, []);

  const PENDING_SYNC_QUEUE_KEY = 'erp_pending_sync_queue';

  const readPendingSyncQueue = (): Array<{ id: string; queuedAt: string; state: any; user: string }> => {
    try {
      const raw = localStorage.getItem(PENDING_SYNC_QUEUE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writePendingSyncQueue = (queue: Array<{ id: string; queuedAt: string; state: any; user: string }>) => {
    try {
      localStorage.setItem(PENDING_SYNC_QUEUE_KEY, JSON.stringify(queue.slice(-25)));
    } catch {}
  };

  const enqueuePendingSyncMutation = (state: any, user: string) => {
    const queue = readPendingSyncQueue();
    queue.push({
      id: `QSYNC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      queuedAt: new Date().toISOString(),
      state,
      user,
    });
    writePendingSyncQueue(queue);
  };

  const hasPendingLocalWriteForVendor = (vendorId: string): boolean => {
    const queue = readPendingSyncQueue();
    return queue.some(
      (q) =>
        Array.isArray(q.state?.vendors) &&
        q.state.vendors.some((v: any) => v?.id === vendorId && !v?.isDeleted)
    );
  };

  const isFlushingSyncQueueRef = React.useRef<boolean>(false);

  const flushPendingSyncQueue = async (): Promise<boolean> => {
    if (isFlushingSyncQueueRef.current) return false;
    const queue = readPendingSyncQueue();
    if (queue.length === 0) return true;
    isFlushingSyncQueueRef.current = true;
    try {
      const remaining: typeof queue = [];
      let failed = false;
      for (let i = 0; i < queue.length; i++) {
        const entry = queue[i];
        if (failed) {
          remaining.push(entry);
          continue;
        }
        try {
          const res = await fetchApi('/api/sync/full', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: entry.state, user: entry.user }),
          });
          if (!res.ok) {
            failed = true;
            remaining.push(entry);
          }
        } catch {
          failed = true;
          remaining.push(entry);
        }
      }
      writePendingSyncQueue(remaining);
      return remaining.length === 0;
    } finally {
      isFlushingSyncQueueRef.current = false;
    }
  };

  const pushMutationToCloud = (overrideState?: any) => {
    try {
      const { __fullSnapshot, ...overrideFields } = overrideState || {};
      const hasOverrideKeys = Object.keys(overrideFields).length > 0;

      const allDeletedReqIds = Array.from(
        new Set([...readTombstoneList('erp_deleted_requirements'), ...(overrideFields.deletedRequirementIds || [])])
      );
      const allDeletedRfqIds = Array.from(
        new Set([...readTombstoneList('erp_deleted_rfqs'), ...(overrideFields.deletedRfqIds || []), ...allDeletedReqIds])
      );
      const allDeletedVendIds = Array.from(
        new Set([...readTombstoneList('erp_deleted_vendors'), ...(overrideFields.deletedVendorIds || [])])
      );
      const allDeletedCustIds = Array.from(
        new Set([...readTombstoneList('erp_deleted_customers'), ...(overrideFields.deletedCustomerIds || [])])
      );
      const allDeletedCompIds = Array.from(
        new Set([...readTombstoneList('erp_deleted_companies'), ...(overrideFields.deletedCompanyIds || [])])
      );
      const allDeletedExecIds = Array.from(
        new Set([...readTombstoneList('erp_deleted_purchase_executives'), ...(overrideFields.deletedPurchaseExecutiveIds || [])])
      );
      const allDeletedProdIds = Array.from(
        new Set([...readTombstoneList('erp_deleted_products'), ...(overrideFields.deletedProductIds || [])])
      );
      const allDeletedBrandIds = Array.from(
        new Set([...readTombstoneList('erp_deleted_brands'), ...(overrideFields.deletedBrandIds || [])])
      );
      const allDeletedCatIds = Array.from(
        new Set([...readTombstoneList('erp_deleted_categories'), ...(overrideFields.deletedCategoryIds || [])])
      );
      const allDeletedMapIds = Array.from(
        new Set([...readTombstoneList('erp_deleted_vendor_mappings'), ...(overrideFields.deletedVendorMappingIds || [])])
      );
      const allDeletedQuoteIds = Array.from(
        new Set([...readTombstoneList('erp_deleted_vendor_quotes'), ...(overrideFields.deletedVendorQuoteIds || [])])
      );

      const tombstonePayload = {
        deletedRequirementIds: allDeletedReqIds,
        deletedRfqIds: allDeletedRfqIds,
        deletedVendorIds: allDeletedVendIds,
        deletedCustomerIds: allDeletedCustIds,
        deletedCompanyIds: allDeletedCompIds,
        deletedPurchaseExecutiveIds: allDeletedExecIds,
        deletedProductIds: allDeletedProdIds,
        deletedBrandIds: allDeletedBrandIds,
        deletedCategoryIds: allDeletedCatIds,
        deletedVendorMappingIds: allDeletedMapIds,
        deletedVendorQuoteIds: allDeletedQuoteIds,
      };

      let payload: any;
      if (hasOverrideKeys && !__fullSnapshot) {
        // Send ONLY the explicitly mutated collection(s) + tombstones so stale closures never overwrite other collections
        payload = {
          ...overrideFields,
          ...tombstonePayload,
        };
        if (Array.isArray(payload.rfqs)) {
          payload.rfqs = payload.rfqs.filter(
            (r: any) =>
              r &&
              !r.isDeleted &&
              !allDeletedRfqIds.includes(r.id) &&
              !(r.rfqNumber && allDeletedRfqIds.includes(r.rfqNumber)) &&
              !(r.requirementId && allDeletedReqIds.includes(r.requirementId))
          );
        }
        if (Array.isArray(payload.requirements)) {
          payload.requirements = payload.requirements.filter(
            (r: any) =>
              r &&
              !r.isDeleted &&
              !allDeletedReqIds.includes(r.id) &&
              !(r.rfqNumber && allDeletedReqIds.includes(r.rfqNumber))
          );
        }
      } else {
        const rawRfqs = overrideFields.rfqs !== undefined ? overrideFields.rfqs : rfqs;
        const cleanRfqs = (rawRfqs || []).filter(
          (r: any) =>
            r &&
            !r.isDeleted &&
            !allDeletedRfqIds.includes(r.id) &&
            !(r.rfqNumber && allDeletedRfqIds.includes(r.rfqNumber)) &&
            !(r.requirementId && allDeletedReqIds.includes(r.requirementId))
        );
        const rawReqs = overrideFields.requirements !== undefined ? overrideFields.requirements : requirements;
        const cleanReqs = (rawReqs || []).filter(
          (r: any) =>
            r &&
            !r.isDeleted &&
            !allDeletedReqIds.includes(r.id) &&
            !(r.rfqNumber && allDeletedReqIds.includes(r.rfqNumber))
        );

        payload = {
          companies,
          purchaseExecutives,
          customers,
          vendors,
          products,
          quotations: customerQuotations,
          customerPos: customerPOs,
          vendorPos: vendorPOs,
          proformaInvoices,
          payments,
          dispatches,
          deliveries,
          vendorQuotes,
          vendorProductMappings,
          brands,
          categories,
          productTypes,
          ...overrideFields,
          rfqs: cleanRfqs,
          requirements: cleanReqs,
          ...tombstonePayload,
        };
      }

      fetchApi('/api/sync/full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: payload, user: currentUser.name, lite: true }),
      })
        .then(async (res) => {
          if (!res.ok) {
            enqueuePendingSyncMutation(payload, currentUser.name);
            console.warn(`[Sync] Server returned HTTP ${res.status}; mutation queued locally for automatic retry.`);
          } else {
            try {
              const ack = await res.json();
              if (typeof ack?.revision === 'number') {
                lastServerRevisionRef.current = ack.revision;
              }
            } catch {}
            setLastSyncTime(new Date());
          }
        })
        .catch(() => {
          enqueuePendingSyncMutation(payload, currentUser.name);
          console.warn('[Sync] Offline / network interruption; mutation queued locally for automatic retry.');
        });

      if (broadcastRef.current) {
        broadcastRef.current.postMessage({ type: 'MUTATION', timestamp: Date.now() });
      }
    } catch {}
  };

  const currentUserRef = React.useRef(currentUser);
  currentUserRef.current = currentUser;
  const supabaseProbeInFlightRef = React.useRef<Promise<{ connected: boolean; data: any }> | null>(null);

  // Authoritative Supabase PostgreSQL Status Probe & Realtime Subscription
  const probeSupabaseBackendStatus = React.useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && supabaseProbeInFlightRef.current) {
      return supabaseProbeInFlightRef.current;
    }
    const runProbe = (async () => {
      try {
        const res = await fetchApi(forceRefresh ? '/api/supabase/status?refresh=1' : '/api/supabase/status', {
          timeoutMs: 25000,
        });
        const data = await res.json().catch(() => ({}));
        const connected = Boolean(res.ok && data?.connected);
        const schemaApplied = Boolean(data?.schemaApplied);
        const serverConfigured = Boolean(data?.serverConfigured);
        const clientCfg = getSupabaseConfigStatus();
        const activeUser = currentUserRef.current;
        setCloudSyncState((prev) => ({
          ...prev,
          connected,
          schemaApplied,
          serverConfigured,
          status: connected ? 'CLOUD_CONNECTED' : 'LOCAL_ONLY',
          email: activeUser?.email || prev.email,
          uid: activeUser?.id || prev.uid,
          isAdmin: isSuperAdminUser(activeUser),
          projectId: data?.projectRef || 'plvjsiehhpdoyvzgahpr',
          databaseId: 'postgresql',
          error: connected
            ? null
            : data?.error ||
              (!clientCfg.configured
                ? 'VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY pending configuration.'
                : null),
          lastCloudSyncAt: connected ? new Date() : prev.lastCloudSyncAt,
        }));
        return { connected, data };
      } catch (err: any) {
        setCloudSyncState((prev) => ({
          ...prev,
          connected: false,
          status: 'ERROR',
          error: err?.message || 'Unable to verify Supabase backend status.',
        }));
        return { connected: false, data: null };
      } finally {
        supabaseProbeInFlightRef.current = null;
      }
    })();

    supabaseProbeInFlightRef.current = runProbe;
    return runProbe;
  }, [currentUser?.id]);

  useEffect(() => {
    let active = true;
    void probeSupabaseBackendStatus(false);

    const clientStatus = getSupabaseConfigStatus();
    if (!clientStatus.configured) {
      return () => {
        active = false;
      };
    }

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubRealtime = subscribeToErpSupabaseRealtime(() => {
      if (!active) return;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        if (!active) return;
        setCloudSyncState((prev) => ({ ...prev, lastCloudSyncAt: new Date() }));
        void syncBackendStateRef.current?.({ force: true, notify: false });
      }, 450);
    });

    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      unsubRealtime();
    };
  }, [probeSupabaseBackendStatus]);

  const connectCloudDatabase = async (): Promise<{ success: boolean; message: string }> => {
    setCloudSyncState((prev) => ({ ...prev, status: 'CLOUD_CONNECTING', error: null }));
    const { connected, data } = await probeSupabaseBackendStatus(true);
    if (connected) {
      if (syncBackendStateRef.current) {
        await syncBackendStateRef.current({ force: true, notify: false });
      }
      return {
        success: true,
        message: `Connected to Supabase PostgreSQL (${SUPABASE_PROJECT_URL}) & 9 Storage buckets.`,
      };
    }
    const missing = [
      ...(data?.missingServerVars || data?.missingEnv || []),
      ...getSupabaseConfigStatus().missingVars,
    ];
    return {
      success: false,
      message:
        data?.error ||
        (missing.length > 0
          ? `Supabase environment keys pending: ${Array.from(new Set(missing)).join(', ')}.`
          : 'SQL schema (001_erp_production_schema.sql) needs to be run in Supabase SQL Editor.'),
    };
  };

  const disconnectCloudDatabase = async (): Promise<void> => {
    // Supabase runs as the authoritative backend; clearing client sync indicator only
    setCloudSyncState((prev) => ({
      ...prev,
      connected: false,
      status: 'LOCAL_ONLY',
      error: null,
    }));
  };

  const inviteCloudTeammate = async (): Promise<{ success: boolean; message: string }> => ({
    success: false,
    message: 'User access is managed via ERP User Management & Supabase Auth.',
  });

  const removeCloudTeammate = async (): Promise<{ success: boolean; message: string }> => ({
    success: false,
    message: 'User access is managed via ERP User Management & Supabase Auth.',
  });

  const lastServerRevisionRef = React.useRef<number | null>(null);
  const isSyncInFlightRef = React.useRef<boolean>(false);
  const syncBackendStateRef = React.useRef<((opts?: { force?: boolean; notify?: boolean }) => Promise<void>) | null>(null);

  // Multi-Device Central Database Synchronization Engine
  // Guarantees that all laptops, desktops, and mobile devices across the company see identical data in real-time
  useEffect(() => {
    let isMounted = true;

    const syncBackendState = async (opts?: { force?: boolean; notify?: boolean }) => {
      const isLoggedOut = typeof window !== 'undefined' && localStorage.getItem('mro_is_logged_out') === 'true';
      if (isLoggedOut) {
        setIsSyncing(false);
        return;
      }
      if (isSyncInFlightRef.current && !opts?.force) {
        return;
      }
      isSyncInFlightRef.current = true;

      try {
        if (opts?.notify) setIsSyncing(true);
        // Drain any offline/queued mutations BEFORE pulling central DB state so new records never vanish
        const flushedAll = await flushPendingSyncQueue();
        if (!flushedAll) {
          console.warn('[Sync] Pending offline queue still awaiting server reachability; skipping destructive pull.');
        }

        const revQuery = opts?.force
          ? '?force=1'
          : lastServerRevisionRef.current !== null && flushedAll
            ? `?rev=${encodeURIComponent(String(lastServerRevisionRef.current))}`
            : '';
        const res = await fetchApi(`/api/sync/state${revQuery}`, { timeoutMs: 25000 });
        if (!res.ok) {
          setIsSyncing(false);
          return;
        }
        const data = await res.json();
        if (!data || !isMounted) {
          if (isMounted) setIsSyncing(false);
          return;
        }
        if (data.unchanged === true) {
          if (typeof data.revision === 'number') {
            lastServerRevisionRef.current = data.revision;
          }
          setLastSyncTime(new Date());
          setIsSyncing(false);
          return;
        }
        if (!data.state) {
          setIsSyncing(false);
          return;
        }
        if (typeof data.revision === 'number') {
          lastServerRevisionRef.current = data.revision;
        }

        const serverState = data.state;

        const mergeTombstones = (storageKey: string, serverIds?: unknown): string[] => {
          const sList = Array.isArray(serverIds) ? serverIds.filter((x) => typeof x === 'string') : [];
          return addTombstoneIds(storageKey, sList);
        };

        const mergedTombstones = mergeTombstones('erp_deleted_requirements', serverState.deletedRequirementIds);
        const mergedRfqTombstones = Array.from(
          new Set([...mergeTombstones('erp_deleted_rfqs', serverState.deletedRfqIds), ...mergedTombstones])
        );
        const mergedVendorTombstones = mergeTombstones('erp_deleted_vendors', serverState.deletedVendorIds);
        const mergedCustomerTombstones = mergeTombstones('erp_deleted_customers', serverState.deletedCustomerIds);
        const mergedCompanyTombstones = Array.from(
          new Set([...mergeTombstones('erp_deleted_companies', serverState.deletedCompanyIds), ...mergedCustomerTombstones])
        );
        const mergedExecTombstones = mergeTombstones(
          'erp_deleted_purchase_executives',
          serverState.deletedPurchaseExecutiveIds
        );
        const mergedProductTombstones = mergeTombstones('erp_deleted_products', serverState.deletedProductIds);
        const mergedBrandTombstones = mergeTombstones('erp_deleted_brands', serverState.deletedBrandIds);
        const mergedCategoryTombstones = mergeTombstones('erp_deleted_categories', serverState.deletedCategoryIds);
        const mergedMappingTombstones = mergeTombstones('erp_deleted_vendor_mappings', serverState.deletedVendorMappingIds);
        const mergedQuoteTombstones = mergeTombstones('erp_deleted_vendor_quotes', serverState.deletedVendorQuoteIds);

        if (!isMounted) return;

        // Authoritative Requirements Sync (Never revives deleted or purged requirements)
        if (Array.isArray(serverState.requirements)) {
          setRequirements((prevReqs) => {
            const reqMap = new Map<string, CustomerRequirement>();

            serverState.requirements.forEach((sr: CustomerRequirement) => {
              if (
                sr &&
                sr.id &&
                !sr.isDeleted &&
                !mergedTombstones.includes(sr.id) &&
                !(sr.rfqNumber && mergedTombstones.includes(sr.rfqNumber)) &&
                !isPendingLocalDelete('requirement', sr.id)
              ) {
                reqMap.set(sr.id, sr);
              }
            });

            prevReqs.forEach((lr) => {
              if (
                lr &&
                lr.id &&
                !lr.isDeleted &&
                !mergedTombstones.includes(lr.id) &&
                !(lr.rfqNumber && mergedTombstones.includes(lr.rfqNumber)) &&
                !isPendingLocalDelete('requirement', lr.id)
              ) {
                if (!reqMap.has(lr.id) && isRecentLocalRecord('requirement', lr.id, lr.createdAt)) {
                  reqMap.set(lr.id, lr);
                }
              }
            });

            const uniqueMerged = Array.from(reqMap.values());
            try {
              localStorage.setItem('erp_live_requirements', JSON.stringify(uniqueMerged));
            } catch {}
            return uniqueMerged;
          });
        }

        // Authoritative RFQs Sync
        if (Array.isArray(serverState.rfqs)) {
          const validRfqs = serverState.rfqs.filter(
            (rfq: any) =>
              rfq &&
              !rfq.isDeleted &&
              !mergedRfqTombstones.includes(rfq.id) &&
              !(rfq.rfqNumber && mergedRfqTombstones.includes(rfq.rfqNumber)) &&
              !(rfq.requirementId && mergedTombstones.includes(rfq.requirementId))
          );
          setRfqs(validRfqs);
          try {
            localStorage.setItem('erp_live_rfqs', JSON.stringify(validRfqs));
          } catch {}
        }

        // Authoritative Companies Sync
        if (Array.isArray(serverState.companies)) {
          setCompanies((prevCompanies) => {
            const map = new Map<string, Company>();
            serverState.companies.forEach((c: Company) => {
              if (c && c.id && !c.isDeleted && !mergedCompanyTombstones.includes(c.id) && !isPendingLocalDelete('company', c.id)) {
                map.set(c.id, c);
              }
            });
            prevCompanies.forEach((c) => {
              if (c && c.id && !c.isDeleted && !mergedCompanyTombstones.includes(c.id) && !isPendingLocalDelete('company', c.id)) {
                if (!map.has(c.id) && isRecentLocalRecord('company', c.id, c.createdAt)) {
                  map.set(c.id, c);
                }
              }
            });
            const merged = Array.from(map.values());
            try {
              localStorage.setItem('erp_live_companies', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }

        // Authoritative Purchase Executives Sync
        if (Array.isArray(serverState.purchaseExecutives)) {
          setPurchaseExecutives((prevExecs) => {
            const map = new Map<string, PurchaseExecutive>();
            serverState.purchaseExecutives.forEach((pe: PurchaseExecutive) => {
              if (pe && pe.id && !(pe as any).isDeleted && !mergedExecTombstones.includes(pe.id) && !isPendingLocalDelete('purchaseExecutive', pe.id)) {
                map.set(pe.id, pe);
              }
            });
            prevExecs.forEach((pe) => {
              if (pe && pe.id && !(pe as any).isDeleted && !mergedExecTombstones.includes(pe.id) && !isPendingLocalDelete('purchaseExecutive', pe.id)) {
                if (!map.has(pe.id) && isRecentLocalRecord('purchaseExecutive', pe.id, pe.createdAt)) {
                  map.set(pe.id, pe);
                }
              }
            });
            const merged = Array.from(map.values());
            try {
              localStorage.setItem('erp_live_purchase_executives', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }

        // Authoritative Vendor Quotes Sync (Honors deletion tombstones & local pending writes)
        if (Array.isArray(serverState.vendorQuotes)) {
          setVendorQuotes((prevQuotes) => {
            const qMap = new Map<string, VendorQuote>();
            serverState.vendorQuotes.forEach((vq: VendorQuote) => {
              if (vq && vq.id && !mergedQuoteTombstones.includes(vq.id) && !isPendingLocalDelete('vendorQuote', vq.id)) {
                qMap.set(vq.id, vq);
              }
            });
            prevQuotes.forEach((lq) => {
              if (lq && lq.id && !mergedQuoteTombstones.includes(lq.id) && !isPendingLocalDelete('vendorQuote', lq.id)) {
                if (!qMap.has(lq.id) && isRecentLocalRecord('vendorQuote', lq.id)) {
                  qMap.set(lq.id, lq);
                }
              }
            });
            const merged = Array.from(qMap.values());
            try {
              localStorage.setItem('erp_live_vendor_quotes', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }

        // Authoritative Quotations Sync
        if (Array.isArray(serverState.quotations)) {
          setCustomerQuotations(serverState.quotations);
          try {
            localStorage.setItem('erp_live_quotations', JSON.stringify(serverState.quotations));
          } catch {}
        }

        // Authoritative Customer POs Sync
        if (Array.isArray(serverState.customerPos)) {
          setCustomerPOs(serverState.customerPos);
          try {
            localStorage.setItem('erp_live_customer_pos', JSON.stringify(serverState.customerPos));
          } catch {}
        }

        // Authoritative Vendor POs Sync
        if (Array.isArray(serverState.vendorPos)) {
          setVendorPOs(serverState.vendorPos);
          try {
            localStorage.setItem('erp_live_vendor_pos', JSON.stringify(serverState.vendorPos));
          } catch {}
        }

        // Authoritative Payments Sync
        if (Array.isArray(serverState.payments)) {
          setPayments(serverState.payments);
          try {
            localStorage.setItem('erp_live_payments', JSON.stringify(serverState.payments));
          } catch {}
        }

        // Authoritative Dispatches Sync
        if (Array.isArray(serverState.dispatches)) {
          setDispatches(serverState.dispatches);
          try {
            localStorage.setItem('erp_live_dispatches', JSON.stringify(serverState.dispatches));
          } catch {}
        }

        // Authoritative Vendors Sync (Strictly honors deletions, tombstones, pending queue, and recent local additions)
        if (Array.isArray(serverState.vendors)) {
          const archivedIdSet = new Set(
            Array.isArray(serverState.archivedVendors)
              ? serverState.archivedVendors.map((av: Vendor) => av?.id).filter(Boolean)
              : []
          );
          setVendors((prevVendors) => {
            const vendorMap = new Map<string, Vendor>();
            serverState.vendors.forEach((v: Vendor) => {
              if (v && v.id && !v.isDeleted && !mergedVendorTombstones.includes(v.id) && !isPendingLocalDelete('vendor', v.id)) {
                vendorMap.set(v.id, v);
              }
            });
            prevVendors.forEach((v) => {
              if (
                v &&
                v.id &&
                !v.isDeleted &&
                !archivedIdSet.has(v.id) &&
                !mergedVendorTombstones.includes(v.id) &&
                !isPendingLocalDelete('vendor', v.id)
              ) {
                const existingServer = vendorMap.get(v.id);
                const isLocallyProtected = isRecentLocalRecord('vendor', v.id, v.createdAt) || hasPendingLocalWriteForVendor(v.id);
                if (!existingServer && isLocallyProtected) {
                  vendorMap.set(v.id, v);
                } else if (existingServer && isLocallyProtected) {
                  const localUpdatedMs = v.updatedAt ? new Date(v.updatedAt).getTime() : 0;
                  const serverUpdatedMs = existingServer.updatedAt ? new Date(existingServer.updatedAt).getTime() : 0;
                  if (localUpdatedMs > serverUpdatedMs) {
                    vendorMap.set(v.id, v);
                  }
                }
              }
            });
            const merged = Array.from(vendorMap.values());
            try {
              localStorage.setItem('erp_live_vendors', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }

        if (Array.isArray(serverState.archivedVendors)) {
          const cleanArchived = serverState.archivedVendors.filter(
            (v: Vendor) => v && v.id && !mergedVendorTombstones.includes(v.id) && !isPendingLocalDelete('vendor', v.id)
          );
          setArchivedVendors(cleanArchived);
          try {
            localStorage.setItem('erp_live_archived_vendors', JSON.stringify(cleanArchived));
          } catch {}
        }

        // Authoritative Products Sync
        if (Array.isArray(serverState.products)) {
          setProducts((prevProducts) => {
            const prodMap = new Map<string, ProductItem>();
            serverState.products.forEach((p: ProductItem) => {
              if (p && p.id && !p.isDeleted && !mergedProductTombstones.includes(p.id) && !isPendingLocalDelete('product', p.id)) {
                prodMap.set(p.id, p);
              }
            });
            prevProducts.forEach((p) => {
              if (p && p.id && !p.isDeleted && !mergedProductTombstones.includes(p.id) && !isPendingLocalDelete('product', p.id)) {
                if (!prodMap.has(p.id) && isRecentLocalRecord('product', p.id, (p as any).createdAt)) {
                  prodMap.set(p.id, p);
                }
              }
            });
            const merged = Array.from(prodMap.values());
            try {
              localStorage.setItem('erp_live_products', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }

        // Authoritative Customers Sync
        if (Array.isArray(serverState.customers)) {
          setCustomers((prevCustomers) => {
            const custMap = new Map<string, Customer>();
            serverState.customers.forEach((c: Customer) => {
              if (c && c.id && !c.isDeleted && !mergedCustomerTombstones.includes(c.id) && !isPendingLocalDelete('customer', c.id)) {
                custMap.set(c.id, c);
              }
            });
            prevCustomers.forEach((c) => {
              if (c && c.id && !c.isDeleted && !mergedCustomerTombstones.includes(c.id) && !isPendingLocalDelete('customer', c.id)) {
                if (!custMap.has(c.id) && isRecentLocalRecord('customer', c.id, c.createdAt)) {
                  custMap.set(c.id, c);
                }
              }
            });
            const merged = Array.from(custMap.values());
            try {
              localStorage.setItem('erp_live_customers', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }

        // Authoritative Deliveries Sync
        if (Array.isArray(serverState.deliveries)) {
          setDeliveries(serverState.deliveries);
        }

        // Authoritative Proforma Invoices Sync
        if (Array.isArray(serverState.proformaInvoices)) {
          setProformaInvoices(serverState.proformaInvoices);
        }

        // Authoritative Vendor Product Mappings Sync
        if (Array.isArray(serverState.vendorProductMappings)) {
          setVendorProductMappings((prevMappings) => {
            const map = new Map<string, VendorProductMapping>();
            serverState.vendorProductMappings.forEach((m: VendorProductMapping) => {
              if (m && m.id && !(m as any).isDeleted && !mergedMappingTombstones.includes(m.id) && !isPendingLocalDelete('mapping', m.id)) {
                map.set(m.id, m);
              }
            });
            prevMappings.forEach((m) => {
              if (m && m.id && !(m as any).isDeleted && !mergedMappingTombstones.includes(m.id) && !isPendingLocalDelete('mapping', m.id)) {
                if (!map.has(m.id) && isRecentLocalRecord('mapping', m.id, m.createdAt)) {
                  map.set(m.id, m);
                }
              }
            });
            const merged = Array.from(map.values());
            try {
              localStorage.setItem('erp_live_vendor_products', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }

        // Authoritative Brands Sync
        if (Array.isArray(serverState.brands)) {
          setBrands((prevBrands) => {
            const map = new Map<string, BrandMasterItem>();
            serverState.brands.forEach((b: BrandMasterItem) => {
              if (b && b.id && !(b as any).isDeleted && !mergedBrandTombstones.includes(b.id) && !isPendingLocalDelete('brand', b.id)) {
                map.set(b.id, b);
              }
            });
            prevBrands.forEach((b) => {
              if (b && b.id && !(b as any).isDeleted && !mergedBrandTombstones.includes(b.id) && !isPendingLocalDelete('brand', b.id)) {
                if (!map.has(b.id) && isRecentLocalRecord('brand', b.id, b.createdAt)) {
                  map.set(b.id, b);
                }
              }
            });
            const merged = Array.from(map.values());
            try {
              localStorage.setItem('erp_live_brands', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }

        // Authoritative Categories Sync
        if (Array.isArray(serverState.categories)) {
          setCategories((prevCategories) => {
            const map = new Map<string, MaterialCategory>();
            serverState.categories.forEach((c: any) => {
              if (c && c.id && !c.isDeleted && !mergedCategoryTombstones.includes(c.id) && !isPendingLocalDelete('category', c.id)) {
                map.set(c.id, {
                  ...c,
                  code: c.code || c.id || 'CAT',
                  description: c.description || '',
                  subCategories: Array.isArray(c.subCategories) ? c.subCategories : ['Standard'],
                  keywords: Array.isArray(c.keywords) ? c.keywords : [(c.name || '').toLowerCase()],
                  itemExamples: Array.isArray(c.itemExamples) ? c.itemExamples : [],
                  isActive: c.isActive !== false,
                });
              }
            });
            prevCategories.forEach((c) => {
              if (c && c.id && !(c as any).isDeleted && !mergedCategoryTombstones.includes(c.id) && !isPendingLocalDelete('category', c.id)) {
                if (!map.has(c.id) && isRecentLocalRecord('category', c.id, c.createdAt)) {
                  map.set(c.id, c);
                }
              }
            });
            const merged = Array.from(map.values());
            try {
              localStorage.setItem('erp_live_categories', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }

        // Authoritative Global Product Types Sync
        if (Array.isArray(serverState.productTypes)) {
          setProductTypes(serverState.productTypes);
        }

        // Authoritative Users Sync (Normalizes roles and propagates user changes across devices)
        if (Array.isArray(serverState.users) && serverState.users.length > 0) {
          const normalizedUsers: User[] = serverState.users.map((u: any) => ({
            ...u,
            role: normalizeUserRole(u.role, u.username, u.email),
            approvalLimit: u.approvalLimit ?? u.approvalAuthority?.maxApprovalLimit ?? 0,
          }));
          setAvailableUsers(normalizedUsers);
          try {
            localStorage.setItem('mro_users', JSON.stringify(normalizedUsers));
          } catch {}
          setCurrentUser((prev) => {
            const matched = normalizedUsers.find((u) => u.id === prev.id || (u.username && prev.username && u.username === prev.username));
            if (!matched) return prev;
            const updatedCurrent: User = {
              ...prev,
              ...matched,
              role: normalizeUserRole(matched.role, matched.username, matched.email),
            };
            try {
              localStorage.setItem('procure_user', JSON.stringify(updatedCurrent));
            } catch {}
            return updatedCurrent;
          });
        }

        // Authoritative Notifications Sync
        if (Array.isArray(serverState.notifications)) {
          setNotifications((prev) => {
            const map = new Map<string, NotificationItem>();
            serverState.notifications.forEach((n: NotificationItem) => {
              if (n && n.id) map.set(n.id, n);
            });
            prev.forEach((ln) => {
              if (ln && ln.id && !map.has(ln.id) && isRecentLocalRecord('notification', ln.id)) {
                map.set(ln.id, ln);
              }
            });
            return Array.from(map.values()).slice(0, 100);
          });
        }

        // Authoritative Audit Logs Sync
        if (Array.isArray(serverState.auditLogs)) {
          setAuditLogs(serverState.auditLogs);
        }

        // Authoritative Catalogue Products, Rate History & Import Batches Sync
        if (Array.isArray(serverState.catalogueProducts)) {
          setCatalogueProducts(serverState.catalogueProducts);
          try {
            localStorage.setItem('erp_live_catalogue_products', JSON.stringify(serverState.catalogueProducts));
          } catch {}
        }
        if (Array.isArray(serverState.rateVersionHistory)) {
          setRateVersionHistory(serverState.rateVersionHistory);
          try {
            localStorage.setItem('erp_live_rate_history', JSON.stringify(serverState.rateVersionHistory));
          } catch {}
        }
        if (Array.isArray(serverState.importBatches)) {
          setImportBatches(serverState.importBatches);
          try {
            localStorage.setItem('erp_live_import_batches', JSON.stringify(serverState.importBatches));
          } catch {}
        }

        // Authoritative Accounting & Revenue Sync (GST Invoices, Vendor Bills, Expenses, Company Settings)
        syncAccountingWithBackend(serverState);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('mro_backend_synced', { detail: { revision: data.revision } }));
        }

        setLastSyncTime(new Date());
        setIsSyncing(false);
        if (opts?.notify) {
          const reqCount = Array.isArray(serverState.requirements)
            ? serverState.requirements.filter((r: any) => !r?.isDeleted).length
            : 0;
          pushNotification(
            'Cloud Sync Updated',
            `Live cloud database synchronized successfully (${reqCount} active requirements loaded).`,
            'SUCCESS',
            ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']
          );
        }
      } catch (err) {
        setIsSyncing(false);
        console.warn('[Sync] Background sync warning:', err);
      } finally {
        isSyncInFlightRef.current = false;
      }
    };

    syncBackendStateRef.current = syncBackendState;

    // Initial immediate sync on mount (force ensures StrictMode remount always hydrates)
    syncBackendState({ force: true });

    // Multi-laptop heartbeat sync every 6 seconds (O(1) revision check; zero-payload if unchanged)
    const interval = setInterval(() => {
      syncBackendState();
    }, 6000);

    // Sync immediately when window/tab regains focus
    const handleFocus = () => {
      syncBackendState();
    };
    window.addEventListener('focus', handleFocus);

    // Sync when tab visibility changes (e.g. user unlocks laptop or switches tab)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncBackendState();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Network connectivity change
    const handleOnline = () => {
      setIsOnline(true);
      syncBackendState();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Instant Cross-Tab sync listener: when any tab mutates data, all tabs sync immediately
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key?.startsWith('erp_') ||
        e.key?.startsWith('mro_') ||
        e.key === 'erp_live_requirements' ||
        e.key === 'erp_deleted_requirements'
      ) {
        syncBackendState();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Listen to cross-tab broadcast notifications
    if (broadcastRef.current) {
      broadcastRef.current.onmessage = (event) => {
        if (event.data?.type === 'MUTATION') {
          syncBackendState();
        }
      };
    }

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Sync state to current mode's localStorage
  const activePrefix = getStoragePrefix(dataMode);

  useEffect(() => {
    localStorage.setItem('mro_active_data_mode', dataMode);
  }, [dataMode]);

  useEffect(() => {
    localStorage.setItem('procure_user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(`${activePrefix}customers`, JSON.stringify(customers));
  }, [customers, activePrefix]);

  useEffect(() => {
    localStorage.setItem(`${activePrefix}companies`, JSON.stringify(companies));
  }, [companies, activePrefix]);

  useEffect(() => {
    localStorage.setItem(`${activePrefix}purchase_executives`, JSON.stringify(purchaseExecutives));
  }, [purchaseExecutives, activePrefix]);

  useEffect(() => {
    localStorage.setItem(`${activePrefix}vendors`, JSON.stringify(vendors));
  }, [vendors, activePrefix]);

  useEffect(() => {
    localStorage.setItem(`${activePrefix}products`, JSON.stringify(products));
  }, [products, activePrefix]);

  useEffect(() => {
    localStorage.setItem(`${activePrefix}categories`, JSON.stringify(categories));
  }, [categories, activePrefix]);

  useEffect(() => {
    localStorage.setItem(`${activePrefix}brands`, JSON.stringify(brands));
  }, [brands, activePrefix]);

  // Daily automatic backup check (runs on mount)
  useEffect(() => {
    if (backupSettings.autoBackupEnabled) {
      const last = backupSettings.lastBackupTimestamp ? new Date(backupSettings.lastBackupTimestamp).getTime() : 0;
      const now = Date.now();
      const intervalMs = (backupSettings.frequencyHours || 24) * 3600 * 1000;

      if (now - last > intervalMs) {
        try {
          const newBkp = createBackupSnapshot({
            vendors,
            categories,
            requirements,
            quotations: customerQuotations,
            customerPOs,
            vendorPOs,
            auditLogs,
            documents,
          }, 'AUTOMATIC_DAILY');
          setBackups(getSavedBackups());
          setBackupSettings(getBackupSettings());
          setBackupFailureAlert(null);
        } catch (err: any) {
          setBackupFailureAlert({
            timestamp: new Date().toISOString(),
            error: err?.message || 'Automatic cloud backup synchronization error',
          });
        }
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(`${activePrefix}requirements`, JSON.stringify(requirements));
  }, [requirements, activePrefix]);

  useEffect(() => {
    localStorage.setItem(`${activePrefix}quotations`, JSON.stringify(customerQuotations));
  }, [customerQuotations, activePrefix]);

  useEffect(() => {
    localStorage.setItem(`${activePrefix}customer_pos`, JSON.stringify(customerPOs));
  }, [customerPOs, activePrefix]);

  useEffect(() => {
    localStorage.setItem(`${activePrefix}vendor_pos`, JSON.stringify(vendorPOs));
  }, [vendorPOs, activePrefix]);

  useEffect(() => {
    localStorage.setItem(`${activePrefix}proforma_invoices`, JSON.stringify(proformaInvoices));
  }, [proformaInvoices, activePrefix]);

  useEffect(() => {
    localStorage.setItem(`${activePrefix}payments`, JSON.stringify(payments));
  }, [payments, activePrefix]);

  useEffect(() => {
    localStorage.setItem(`${activePrefix}dispatches`, JSON.stringify(dispatches));
  }, [dispatches, activePrefix]);

  useEffect(() => {
    localStorage.setItem(`${activePrefix}deliveries`, JSON.stringify(deliveries));
  }, [deliveries, activePrefix]);

  useEffect(() => {
    localStorage.setItem(`${activePrefix}rfqs`, JSON.stringify(rfqs));
  }, [rfqs, activePrefix]);

  useEffect(() => {
    localStorage.setItem(`${activePrefix}vendor_quotes`, JSON.stringify(vendorQuotes));
  }, [vendorQuotes, activePrefix]);

  useEffect(() => {
    localStorage.setItem('mro_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('mro_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  // Helper log and notify
  const pushAudit = (action: string, entityType: string, entityId: string, details: string, oldValue?: string, newValue?: string) => {
    const newLog: AuditLogItem = {
      id: `AUD-${Date.now().toString().slice(-5)}`,
      timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      user: currentUser.name,
      role: currentUser.role,
      action,
      entityType,
      entityId,
      oldValue,
      newValue,
      details,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const pushNotification = (
    title: string,
    message: string,
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ACTION_REQUIRED' = 'INFO',
    targetRole: UserRole[] = ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE'],
    linkTab?: string,
    linkId?: string
  ) => {
    const notif: NotificationItem = {
      id: `NOTIF-${Date.now().toString().slice(-5)}`,
      title,
      message,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      type,
      read: false,
      targetRole,
      linkTab,
      linkId,
    };
    setNotifications((prev) => [notif, ...prev]);
  };

  const updateRequirementStage = (requirementId: string, stage: OrderWorkflowStage) => {
    const targetReq = requirements.find((r) => r.id === requirementId);
    const updatedAt = new Date().toISOString();
    const nextReqs = requirements.map((r) =>
      r.id === requirementId ? { ...r, status: stage, lastModifiedAt: updatedAt } : r
    );
    setRequirements(nextReqs);
    try {
      localStorage.setItem('erp_live_requirements', JSON.stringify(nextReqs));
    } catch {}
    if (targetReq) {
      markLocalWrite('requirement', requirementId);
      fetchApi(`/api/requirements/${encodeURIComponent(requirementId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...targetReq, status: stage, lastModifiedAt: updatedAt, updatedBy: currentUser.name }),
      }).catch(() => {});
      pushMutationToCloud({ requirements: nextReqs });
    }
  };

  // Add Customer
  const addCustomer = (custData: Omit<Customer, 'id' | 'createdAt'>): Customer => {
    const newId = nextSequenceId('CUST', customers, 'erp_deleted_customers');
    const newCust: Customer = {
      ...custData,
      id: newId,
      createdAt: new Date().toISOString().split('T')[0],
    };
    markLocalWrite('customer', newId);
    const updatedDeleted = removeTombstoneIds('erp_deleted_customers', [newId]);
    const nextCusts = [newCust, ...customers];
    setCustomers(nextCusts);
    try {
      localStorage.setItem('erp_live_customers', JSON.stringify(nextCusts));
    } catch {}
    fetchApi('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCust),
    }).catch((e) => console.warn('[API] Customer sync notice:', e));
    pushMutationToCloud({ customers: nextCusts, deletedCustomerIds: updatedDeleted });
    pushAudit('CUSTOMER_CREATED', 'Customer', newId, `Customer ${newCust.companyName} registered by ${currentUser.name}`);
    return newCust;
  };

  // Brand Master Operations
  const registerVendorBrands = (brandNames: string[]) => {
    if (!brandNames || brandNames.length === 0) return;
    const prev = brandsRef.current || [];
    const existingNames = new Set(prev.map((b) => b.name.toLowerCase().trim()));
    const toAdd: BrandMasterItem[] = [];
    brandNames.forEach((name, idx) => {
      const clean = name.trim();
      if (clean && !existingNames.has(clean.toLowerCase())) {
        existingNames.add(clean.toLowerCase());
        const enrichment = getBrandEnrichment(clean, prev);
        toAdd.push({
          id: `BRD-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 900 + 100)}-${idx}`,
          name: enrichment.canonicalName || clean,
          code: enrichment.code || clean.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'BRD',
          category: enrichment.category || 'General MRO',
          categories: enrichment.subCategories && enrichment.subCategories.length > 0 ? enrichment.subCategories : ['General MRO'],
          description: enrichment.description || `Registered for supplied vendor catalog (${clean})`,
          countryOfOrigin: enrichment.country || 'India',
          isActive: true,
          createdAt: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString().split('T')[0],
        });
      }
    });
    if (toAdd.length === 0) return;
    toAdd.forEach((b) => markLocalWrite('brand', b.id));
    const updatedDeletedBrands = removeTombstoneIds('erp_deleted_brands', toAdd.map((b) => b.id));
    const nextBrands = [...prev, ...toAdd];
    brandsRef.current = nextBrands;
    setBrands(nextBrands);

    try {
      localStorage.setItem('erp_live_brands', JSON.stringify(nextBrands));
      localStorage.setItem(`${activePrefix}brands`, JSON.stringify(nextBrands));
    } catch {}

    fetchApi('/api/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toAdd),
    }).catch((e) => console.warn('[API] Brand registration warning:', e));

    setTimeout(() => {
      pushMutationToCloud({ brands: nextBrands, deletedBrandIds: updatedDeletedBrands });
    }, 50);

    pushAudit('BRAND_CREATED', 'BrandMaster', `${toAdd.length} items`, `Auto-registered ${toAdd.map((b) => b.name).join(', ')} from vendor profile`);
  };

  const addBrand = (brandData: Omit<BrandMasterItem, 'id' | 'createdAt'>): BrandMasterItem => {
    const newId = nextSequenceId('BRD', brands, 'erp_deleted_brands');
    const requestedGlobalId = String(brandData.globalBrandId || '').trim();
    const globalCollision = requestedGlobalId
      ? brands.some((b) => (b.globalBrandId || b.id).toLowerCase() === requestedGlobalId.toLowerCase())
      : false;
    const resolvedGlobalId = requestedGlobalId && !globalCollision
      ? requestedGlobalId
      : generateCollisionSafeSeqId('GBRD', brands.map((b) => ({ id: b.globalBrandId || b.id })), [], undefined, 3);
    const newBrand: BrandMasterItem = {
      ...brandData,
      id: newId,
      globalBrandId: resolvedGlobalId,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };
    markLocalWrite('brand', newId);
    const updatedDeleted = removeTombstoneIds('erp_deleted_brands', [newId]);
    const nextBrands = [newBrand, ...brands];
    setBrands(nextBrands);
    try {
      localStorage.setItem('erp_live_brands', JSON.stringify(nextBrands));
      localStorage.setItem(`${activePrefix}brands`, JSON.stringify(nextBrands));
    } catch {}
    fetchApi('/api/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBrand),
    }).catch((e) => console.warn('[API] Add brand sync warning:', e));
    pushMutationToCloud({ brands: nextBrands, deletedBrandIds: updatedDeleted });
    pushAudit('BRAND_CREATED', 'BrandMaster', newId, `Added brand ${newBrand.name} (${newBrand.category || 'MRO'})`);
    return newBrand;
  };

  const updateBrand = (updated: BrandMasterItem) => {
    markLocalWrite('brand', updated.id);
    const nextBrands = brands.map((b) => (b.id === updated.id ? { ...updated, updatedAt: new Date().toISOString().split('T')[0] } : b));
    setBrands(nextBrands);
    try {
      localStorage.setItem('erp_live_brands', JSON.stringify(nextBrands));
      localStorage.setItem(`${activePrefix}brands`, JSON.stringify(nextBrands));
    } catch {}
    fetchApi('/api/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch((e) => console.warn('[API] Update brand sync warning:', e));
    pushMutationToCloud({ brands: nextBrands });
    pushAudit('BRAND_UPDATED', 'BrandMaster', updated.id, `Updated brand ${updated.name}`);
  };

  const archiveBrand = (id: string): { success: boolean; message: string } => {
    const brand = brands.find((b) => b.id === id);
    if (!brand) return { success: false, message: 'Brand not found.' };

    const updated = {
      ...brand,
      status: 'ARCHIVED' as const,
      isActive: false,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    updateBrand(updated);
    pushAudit('BRAND_ARCHIVED', 'BrandMaster', id, `Archived brand ${brand.name}`);
    return { success: true, message: `Brand "${brand.name}" has been safely archived.` };
  };

  const deleteBrand = (id: string): { success: boolean; message: string } => {
    const brand = brands.find((b) => b.id === id);
    if (!brand) return { success: false, message: 'Brand not found.' };

    const normName = brand.name.toLowerCase().trim();

    const isAdmin = isSuperAdminUser(currentUser);

    if (!isAdmin) {
      // 1. Check vendor dependency
      const supplyingVendors = vendors.filter((v) =>
        (v.brandsSupplied || []).some((b) => b.toLowerCase().trim() === normName)
      );
      if (supplyingVendors.length > 0) {
        return {
          success: false,
          message: `Cannot delete "${brand.name}": it is actively mapped to ${supplyingVendors.length} vendor(s) (${supplyingVendors.map((v) => v.companyName).slice(0, 2).join(', ')}). Please archive the brand instead or contact Super Admin.`,
        };
      }

      // 2. Check product catalog dependency
      const referencingProducts = products.filter(
        (p) => !p.isDeleted && p.brand && p.brand.toLowerCase().trim() === normName
      );
      if (referencingProducts.length > 0) {
        return {
          success: false,
          message: `Cannot delete "${brand.name}": it is used by ${referencingProducts.length} product(s) in the Catalog (${referencingProducts.map((p) => p.itemName).slice(0, 2).join(', ')}). Please archive the brand instead or contact Super Admin.`,
        };
      }
    }

    markLocalDelete('brand', id);
    const updatedDeleted = addTombstoneIds('erp_deleted_brands', [id]);
    const nextBrands = brands.filter((b) => b.id !== id);
    setBrands(nextBrands);
    try {
      localStorage.setItem('erp_live_brands', JSON.stringify(nextBrands));
      localStorage.setItem(`${activePrefix}brands`, JSON.stringify(nextBrands));
    } catch {}
    fetchApi(`/api/brands/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    pushMutationToCloud({ brands: nextBrands, deletedBrandIds: updatedDeleted });
    pushAudit('BRAND_DELETED', 'BrandMaster', id, `Deleted brand ${brand.name}`);
    return { success: true, message: `Brand "${brand.name}" removed successfully.` };
  };

  // Add Vendor (Authoritative Server Commit + Post-Commit Verification + Cloud Sync)
  const addVendor = async (vendData: Omit<Vendor, 'id' | 'createdAt'>): Promise<Vendor> => {
    const cleanName = vendData.companyName?.trim().toLowerCase();
    const cleanGst = vendData.gstin?.trim().toLowerCase();
    const existing = vendors.find(
      (v) =>
        !v.isDeleted &&
        ((cleanName && v.companyName?.trim().toLowerCase() === cleanName) ||
          (cleanGst && cleanGst.length === 15 && v.gstin && v.gstin.trim().toLowerCase() === cleanGst))
    );
    if (existing) {
      throw new Error(`Vendor "${existing.companyName}" (${existing.id}) already exists with this name or GSTIN.`);
    }

    const res = await fetchApi('/api/vendors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-erp-user': currentUser.name,
        'x-erp-role': currentUser.role,
      },
      body: JSON.stringify({
        ...vendData,
        mode: 'CREATE',
        userName: currentUser.name,
        userRole: currentUser.role,
      }),
      timeoutMs: 25000,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || !data.verified || !data.vendor) {
      throw new Error(data.error || `Failed to save vendor to database (HTTP ${res.status}).`);
    }

    const savedVendor: Vendor = data.vendor;
    if (typeof data.revision === 'number') {
      lastServerRevisionRef.current = data.revision;
    }
    markLocalWrite('vendor', savedVendor.id);
    removeTombstoneIds('erp_deleted_vendors', [savedVendor.id]);
    if (savedVendor.brandsSupplied && savedVendor.brandsSupplied.length > 0) {
      registerVendorBrands(savedVendor.brandsSupplied);
    }

    setVendors((prev) => {
      const nextVends = [savedVendor, ...prev.filter((v) => v.id !== savedVendor.id)];
      try {
        localStorage.setItem('erp_live_vendors', JSON.stringify(nextVends));
        localStorage.setItem(`${activePrefix}vendors`, JSON.stringify(nextVends));
      } catch {}
      return nextVends;
    });

    if (broadcastRef.current) {
      broadcastRef.current.postMessage({ type: 'MUTATION', timestamp: Date.now() });
    }
    setLastSyncTime(new Date());
    pushAudit('VENDOR_CREATED', 'Vendor', savedVendor.id, `Vendor ${savedVendor.companyName} persisted & verified by ${currentUser.name}`);
    pushNotification('Vendor Registered & Verified', `${savedVendor.companyName} (${savedVendor.id}) saved permanently to database.`, 'SUCCESS', ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']);
    return savedVendor;
  };

  // Add Product
  const addProduct = (prdData: Omit<ProductItem, 'id'>): ProductItem => {
    const newId = nextSequenceId('PRD', products, 'erp_deleted_products');
    const newProduct: ProductItem = {
      ...prdData,
      id: newId,
      isDeleted: false,
      createdAt: (prdData as any).createdAt || new Date().toISOString(),
    } as ProductItem;
    markLocalWrite('product', newId);
    const updatedDeletedProds = removeTombstoneIds('erp_deleted_products', [newId]);
    const nextProds = [newProduct, ...products];
    setProducts(nextProds);
    try {
      localStorage.setItem('erp_live_products', JSON.stringify(nextProds));
      localStorage.setItem(`${activePrefix}products`, JSON.stringify(nextProds));
    } catch {}
    fetchApi('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProduct),
    }).catch((e) => console.warn('[API] Add product sync warning:', e));
    pushMutationToCloud({ products: nextProds, deletedProductIds: updatedDeletedProds });
    pushAudit('PRODUCT_CREATED', 'ProductItem', newId, `New item ${newProduct.itemName} added to Master catalogue.`);
    return newProduct;
  };

  // Add Products in a Single Atomic Batch (prevents API request storms during bulk vendor onboarding)
  const addProductsBulk = (prdsData: Array<Omit<ProductItem, 'id'>>): ProductItem[] => {
    if (!prdsData || prdsData.length === 0) return [];
    const baseTime = Date.now();
    const accumulated: ProductItem[] = [...products];
    const newProducts: ProductItem[] = prdsData.map((prdData, idx) => {
      const seqId = nextSequenceId('PRD', accumulated, 'erp_deleted_products');
      const uniqueId = accumulated.some((p) => p.id === seqId) ? `PRD-${baseTime.toString().slice(-6)}-${idx + 1}` : seqId;
      const newProduct: ProductItem = {
        ...prdData,
        id: uniqueId,
        isDeleted: false,
        createdAt: (prdData as any).createdAt || new Date().toISOString(),
      } as ProductItem;
      accumulated.unshift(newProduct);
      markLocalWrite('product', uniqueId);
      return newProduct;
    });

    const updatedDeletedProds = removeTombstoneIds(
      'erp_deleted_products',
      newProducts.map((p) => p.id)
    );
    const nextProds = accumulated;
    setProducts(nextProds);
    try {
      localStorage.setItem('erp_live_products', JSON.stringify(nextProds));
      localStorage.setItem(`${activePrefix}products`, JSON.stringify(nextProds));
    } catch {}
    fetchApi('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProducts),
    }).catch((e) => console.warn('[API] Bulk add products sync warning:', e));
    pushMutationToCloud({ products: nextProds, deletedProductIds: updatedDeletedProds });
    pushAudit('PRODUCT_CREATED', 'ProductItem', `${newProducts.length} items`, `Batch-added ${newProducts.length} products to Master catalogue.`);
    return newProducts;
  };

  // Master Data Operations: Update & Delete
  const updateCustomer = (updated: Customer) => {
    markLocalWrite('customer', updated.id);
    const nextCusts = customers.map((c) => (c.id === updated.id ? updated : c));
    setCustomers(nextCusts);
    try {
      localStorage.setItem('erp_live_customers', JSON.stringify(nextCusts));
    } catch {}
    fetchApi(`/api/customers/${encodeURIComponent(updated.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {});
    pushMutationToCloud({ customers: nextCusts });
    pushAudit('CUSTOMER_UPDATED', 'Customer', updated.id, `Updated profile for ${updated.companyName}`);
    pushNotification('Customer Updated', `${updated.companyName} details updated successfully.`, 'INFO', ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']);
  };

  const deleteCustomer = (id: string) => {
    const target = customers.find((c) => c.id === id);
    markLocalDelete('customer', id);
    markLocalDelete('company', id);
    const updatedDeletedCusts = addTombstoneIds('erp_deleted_customers', [id]);
    const updatedDeletedComps = addTombstoneIds('erp_deleted_companies', [id]);
    const nextCusts = customers.filter((c) => c.id !== id);
    const nextComps = companies.filter((c) => c.id !== id);
    setCustomers(nextCusts);
    setCompanies(nextComps);
    try {
      localStorage.setItem('erp_live_customers', JSON.stringify(nextCusts));
      localStorage.setItem('erp_live_companies', JSON.stringify(nextComps));
    } catch {}
    fetchApi(`/api/customers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).catch(() => {});
    pushMutationToCloud({
      customers: nextCusts,
      companies: nextComps,
      deletedCustomerIds: updatedDeletedCusts,
      deletedCompanyIds: updatedDeletedComps,
    });
    pushAudit('CUSTOMER_DELETED', 'Customer', id, `Removed customer ${target?.companyName || id}`);
    pushNotification('Customer Removed', `${target?.companyName || id} removed from registry.`, 'WARNING', ['SUPER_ADMIN']);
  };

  const importCustomersList = (newCusts: (Omit<Customer, 'id' | 'createdAt'> | Customer)[]): number => {
    let importedCount = 0;
    const itemsToAdd: Customer[] = [];

    newCusts.forEach((c) => {
      const existing = customers.find(
        (ex) =>
          ex.companyName.toLowerCase().trim() === c.companyName.toLowerCase().trim() ||
          (c.gstin && c.gstin.trim() !== '' && ex.gstin.toLowerCase().trim() === c.gstin.toLowerCase().trim())
      );
      if (!existing) {
        const id = (c as Customer).id || nextSequenceId('CUST', [...customers, ...itemsToAdd], 'erp_deleted_customers');
        itemsToAdd.push({
          ...c,
          id,
          createdAt: (c as Customer).createdAt || new Date().toISOString().split('T')[0],
        });
        importedCount++;
      }
    });

    if (itemsToAdd.length > 0) {
      itemsToAdd.forEach((c) => markLocalWrite('customer', c.id));
      const updatedDeleted = removeTombstoneIds('erp_deleted_customers', itemsToAdd.map((c) => c.id));
      const nextCusts = [...itemsToAdd, ...customers];
      setCustomers(nextCusts);
      try {
        localStorage.setItem('erp_live_customers', JSON.stringify(nextCusts));
      } catch {}
      fetchApi('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemsToAdd),
      }).catch(() => {});
      pushMutationToCloud({ customers: nextCusts, deletedCustomerIds: updatedDeleted });
      pushAudit('CUSTOMERS_IMPORTED', 'Customer', `${importedCount} records`, `Bulk imported ${importedCount} customers`);
      pushNotification('Customers Imported', `Imported ${importedCount} customers into your registry.`, 'SUCCESS', ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']);
    }
    return importedCount;
  };

  const updateVendor = async (updated: Vendor): Promise<Vendor> => {
    const res = await fetchApi(`/api/vendors/${encodeURIComponent(updated.id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-erp-user': currentUser.name,
        'x-erp-role': currentUser.role,
      },
      body: JSON.stringify({
        ...updated,
        userName: currentUser.name,
        userRole: currentUser.role,
      }),
      timeoutMs: 25000,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || !data.verified || !data.vendor) {
      throw new Error(data.error || `Failed to update vendor in database (HTTP ${res.status}).`);
    }

    const savedVendor: Vendor = data.vendor;
    if (typeof data.revision === 'number') {
      lastServerRevisionRef.current = data.revision;
    }
    markLocalWrite('vendor', savedVendor.id);
    removeTombstoneIds('erp_deleted_vendors', [savedVendor.id]);
    if (savedVendor.brandsSupplied && savedVendor.brandsSupplied.length > 0) {
      registerVendorBrands(savedVendor.brandsSupplied);
    }
    setVendors((prev) => {
      const nextVends = prev.some((v) => v.id === savedVendor.id)
        ? prev.map((v) => (v.id === savedVendor.id ? savedVendor : v))
        : [savedVendor, ...prev];
      try {
        localStorage.setItem('erp_live_vendors', JSON.stringify(nextVends));
        localStorage.setItem(`${activePrefix}vendors`, JSON.stringify(nextVends));
      } catch {}
      return nextVends;
    });

    if (broadcastRef.current) {
      broadcastRef.current.postMessage({ type: 'MUTATION', timestamp: Date.now() });
    }
    setLastSyncTime(new Date());
    pushAudit('VENDOR_UPDATED', 'Vendor', savedVendor.id, `Updated credentials for ${savedVendor.companyName}`);
    pushNotification('Vendor Updated & Verified', `${savedVendor.companyName} profile saved to database.`, 'INFO', ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']);
    return savedVendor;
  };

  // Soft Delete Vendor (Authoritative Server Archive; does NOT register permanent tombstone)
  const deleteVendor = async (id: string, reason?: string): Promise<boolean> => {
    const target = vendors.find((v) => v.id === id) || archivedVendors.find((v) => v.id === id);
    const delReason = reason || 'User Archived Vendor';
    try {
      const res = await fetchApi(`/api/vendors/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: delReason, user: currentUser.name }),
        timeoutMs: 25000,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        pushNotification(
          'Archive Failed',
          data?.error || `Database rejected vendor archive (HTTP ${res.status}).`,
          'WARNING',
          ['SUPER_ADMIN']
        );
        return false;
      }

      if (typeof data.revision === 'number') {
        lastServerRevisionRef.current = data.revision;
      }
      removeTombstoneIds('erp_deleted_vendors', [id]);
      const archivedItem: Vendor | null =
        data.vendor ||
        (target
          ? {
              ...target,
              isDeleted: true,
              status: 'INACTIVE',
              deletedAt: new Date().toISOString(),
              deletedBy: currentUser.name,
              deletedReason: delReason,
            }
          : null);

      setVendors((prev) => {
        const nextActive = prev.filter((v) => v.id !== id);
        try {
          localStorage.setItem('erp_live_vendors', JSON.stringify(nextActive));
          localStorage.setItem(`${activePrefix}vendors`, JSON.stringify(nextActive));
        } catch {}
        return nextActive;
      });
      setArchivedVendors((prev) => {
        const nextArchived = archivedItem
          ? [...prev.filter((v) => v.id !== id), archivedItem]
          : prev;
        try {
          localStorage.setItem('erp_live_archived_vendors', JSON.stringify(nextArchived));
        } catch {}
        return nextArchived;
      });
      if (broadcastRef.current) {
        broadcastRef.current.postMessage({ type: 'MUTATION', timestamp: Date.now() });
      }
      setLastSyncTime(new Date());
      pushAudit('VENDOR_ARCHIVED', 'Vendor', id, `Soft-deleted vendor ${target?.companyName || id}: ${delReason}`);
      pushNotification('Vendor Archived', `${target?.companyName || id} moved to archived registry safely.`, 'WARNING', ['SUPER_ADMIN']);
      return true;
    } catch (e: any) {
      console.warn('[API] Soft delete vendor error:', e);
      pushNotification('Archive Failed', e?.message || 'Could not reach server to archive vendor.', 'WARNING', ['SUPER_ADMIN']);
      return false;
    }
  };

  // Restore Soft-Deleted Vendor (Authoritative Server Restore + Verification)
  const restoreVendor = async (id: string): Promise<boolean> => {
    const target = archivedVendors.find((v) => v.id === id) || vendors.find((v) => v.id === id);
    try {
      const res = await fetchApi(`/api/vendors/${encodeURIComponent(id)}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUser.name }),
        timeoutMs: 25000,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        pushNotification(
          'Restore Failed',
          data?.error || `Could not restore vendor on server (HTTP ${res.status}).`,
          'WARNING',
          ['SUPER_ADMIN']
        );
        return false;
      }

      if (typeof data.revision === 'number') {
        lastServerRevisionRef.current = data.revision;
      }
      markLocalWrite('vendor', id);
      removeTombstoneIds('erp_deleted_vendors', [id]);
      const restoredItem: Vendor | null =
        data.vendor ||
        (target
          ? {
              ...target,
              status: 'ACTIVE',
              isDeleted: false,
              deletedAt: undefined,
              deletedBy: undefined,
              deletedReason: undefined,
            }
          : null);

      setArchivedVendors((prev) => {
        const nextArchived = prev.filter((v) => v.id !== id);
        try {
          localStorage.setItem('erp_live_archived_vendors', JSON.stringify(nextArchived));
        } catch {}
        return nextArchived;
      });
      setVendors((prev) => {
        const nextActive = restoredItem
          ? [restoredItem, ...prev.filter((v) => v.id !== id)]
          : prev;
        try {
          localStorage.setItem('erp_live_vendors', JSON.stringify(nextActive));
          localStorage.setItem(`${activePrefix}vendors`, JSON.stringify(nextActive));
        } catch {}
        return nextActive;
      });
      if (broadcastRef.current) {
        broadcastRef.current.postMessage({ type: 'MUTATION', timestamp: Date.now() });
      }
      setLastSyncTime(new Date());
      pushAudit('VENDOR_RESTORED', 'Vendor', id, `Restored vendor ${target?.companyName || id} to active directory`);
      pushNotification('Vendor Restored', `${target?.companyName || id} restored successfully to active suppliers.`, 'SUCCESS', ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']);
      return true;
    } catch (e: any) {
      console.warn('[API] Restore vendor error:', e);
      pushNotification('Restore Failed', e?.message || 'Could not reach server to restore vendor.', 'WARNING', ['SUPER_ADMIN']);
      return false;
    }
  };

  // Permanently Hard Delete Vendor (Super Admin Only — Authoritative Server Delete)
  const permanentlyDeleteVendor = async (id: string): Promise<boolean> => {
    const target = archivedVendors.find((v) => v.id === id) || vendors.find((v) => v.id === id);
    try {
      const res = await fetchApi(`/api/vendors/${encodeURIComponent(id)}?permanent=true`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permanent: true, user: currentUser.name }),
        timeoutMs: 25000,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        pushNotification(
          'Permanent Delete Failed',
          data?.error || `Database rejected permanent vendor removal (HTTP ${res.status}).`,
          'WARNING',
          ['SUPER_ADMIN']
        );
        return false;
      }

      if (typeof data.revision === 'number') {
        lastServerRevisionRef.current = data.revision;
      }
      markLocalDelete('vendor', id);
      addTombstoneIds('erp_deleted_vendors', [id]);
      setVendors((prev) => {
        const next = prev.filter((v) => v.id !== id);
        try {
          localStorage.setItem('erp_live_vendors', JSON.stringify(next));
          localStorage.setItem(`${activePrefix}vendors`, JSON.stringify(next));
        } catch {}
        return next;
      });
      setArchivedVendors((prev) => {
        const next = prev.filter((v) => v.id !== id);
        try {
          localStorage.setItem('erp_live_archived_vendors', JSON.stringify(next));
        } catch {}
        return next;
      });
      setVendorProductMappings((prev) => {
        const next = prev.filter((m) => m.vendorId !== id);
        try {
          localStorage.setItem(`${activePrefix}vendor_products`, JSON.stringify(next));
        } catch {}
        return next;
      });
      setAiActivityLogs((prev) => prev.filter((l) => l.vendorId !== id));
      if (broadcastRef.current) {
        broadcastRef.current.postMessage({ type: 'MUTATION', timestamp: Date.now() });
      }
      setLastSyncTime(new Date());
      pushAudit('VENDOR_PERMANENTLY_DELETED', 'Vendor', id, `Hard-deleted supplier ${target?.companyName || id} permanently`);
      pushNotification('Supplier Permanently Deleted', `Removed ${target?.companyName || id} permanently from ERP database.`, 'INFO', ['SUPER_ADMIN']);
      return true;
    } catch (e: any) {
      console.warn('[API] Permanent delete error:', e);
      pushNotification('Permanent Delete Failed', e?.message || 'Could not reach server to delete vendor.', 'WARNING', ['SUPER_ADMIN']);
      return false;
    }
  };

  // Purge / Empty Recycle Bin (Archived Vendors)
  const purgeArchivedVendors = async (): Promise<{ success: boolean; count: number }> => {
    const archived = [
      ...archivedVendors,
      ...vendors.filter((v) => !!v.isDeleted && !archivedVendors.some((a) => a.id === v.id)),
    ];
    if (archived.length === 0) return { success: true, count: 0 };
    const purgedIds = archived.map((v) => v.id).filter(Boolean);
    purgedIds.forEach((id) => markLocalDelete('vendor', id));
    const updatedTombstones = addTombstoneIds('erp_deleted_vendors', purgedIds);
    const nextVends = vendors.filter((v) => !v.isDeleted);
    const purgedSet = new Set(purgedIds);
    const nextMappings = vendorProductMappings.filter((m) => !purgedSet.has(m.vendorId));
    setVendors(nextVends);
    setArchivedVendors([]);
    setVendorProductMappings(nextMappings);
    try {
      localStorage.setItem('erp_live_vendors', JSON.stringify(nextVends));
      localStorage.setItem('erp_live_archived_vendors', JSON.stringify([]));
      localStorage.setItem(`${activePrefix}vendors`, JSON.stringify(nextVends));
      localStorage.setItem(`${activePrefix}vendor_products`, JSON.stringify(nextMappings));
    } catch {}
    try {
      const res = await fetchApi(`/api/vendors/purge/archived`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUser.name, role: currentUser.role }),
      });
      if (!res.ok) {
        enqueuePendingSyncMutation({ vendors: nextVends, archivedVendors: [], vendorProductMappings: nextMappings, deletedVendorIds: updatedTombstones }, currentUser.name);
      }
      pushMutationToCloud({ vendors: nextVends, archivedVendors: [], vendorProductMappings: nextMappings, deletedVendorIds: updatedTombstones });
      pushAudit('VENDOR_ARCHIVE_PURGED', 'Vendor', 'BATCH', `Purged ${archived.length} archived suppliers from database`);
      pushNotification('Recycle Bin Emptied', `Permanently deleted ${archived.length} archived suppliers.`, 'INFO', ['SUPER_ADMIN']);
      return { success: true, count: archived.length };
    } catch (e) {
      console.warn('[API] Purge archive error:', e);
      return { success: false, count: 0 };
    }
  };

  const importVendorsList = (newVends: (Omit<Vendor, 'id' | 'createdAt'> | Vendor)[]): any => {
    let importedVendorCount = 0;
    let importedProductCount = 0;
    let skippedCount = 0;
    const errorDetails: string[] = [];

    const itemsToAdd: Vendor[] = [];
    const mappingsToAdd: VendorProductMapping[] = [];
    const productsToAdd: ProductItem[] = [];
    const brandsToRegister: string[] = [];

    // Scan highest existing vendor number (active, archived & tombstones) for collision-safe sequential ID generation
    let maxVendNum = 0;
    const scanImportVendId = (vid?: string) => {
      const match = vid?.match(/VEND-(\d+)/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxVendNum) maxVendNum = n;
      }
    };
    vendors.forEach((ex) => scanImportVendId(ex.id));
    archivedVendors.forEach((ex) => scanImportVendId(ex.id));
    readTombstoneList('erp_deleted_vendors').forEach((vid) => scanImportVendId(vid));

    newVends.forEach((v, vIdx) => {
      const rawName = (v.companyName || v.vendorName || '').trim();
      if (!rawName) {
        skippedCount++;
        errorDetails.push(`Row ${vIdx + 1}: Skipped due to missing Company Name.`);
        return;
      }

      // 1. Collect brands to register
      if (v.brandsSupplied && v.brandsSupplied.length > 0) {
        brandsToRegister.push(...v.brandsSupplied);
      }

      // 2. Identify vendor ID - check both existing vendors and itemsToAdd
      const normName = rawName.toLowerCase();
      const rawGstin = (v.gstin || '').trim().toUpperCase();
      const isRealGstin = rawGstin.length === 15 && !rawGstin.startsWith('27AAAPV0000');

      const existing = vendors.find(
        (ex) =>
          (normName && ex.companyName?.toLowerCase().trim() === normName) ||
          (isRealGstin && ex.gstin && ex.gstin.trim().toUpperCase() === rawGstin)
      ) || itemsToAdd.find(
        (ex) =>
          (normName && ex.companyName?.toLowerCase().trim() === normName) ||
          (isRealGstin && ex.gstin && ex.gstin.trim().toUpperCase() === rawGstin)
      );

      let vendorId: string;
      let targetVendorObj: Vendor;

      if (!existing) {
        maxVendNum++;
        vendorId = (v as Vendor).id || `VEND-${String(maxVendNum).padStart(3, '0')}`;
        targetVendorObj = {
          ...v,
          id: vendorId,
          companyName: rawName,
          gstin: isRealGstin ? rawGstin : '',
          isDeleted: false,
          createdAt: (v as Vendor).createdAt || new Date().toISOString().split('T')[0],
        };
        itemsToAdd.push(targetVendorObj);
        importedVendorCount++;
      } else {
        vendorId = existing.id;
        targetVendorObj = existing;
        skippedCount++;
        errorDetails.push(`Row ${vIdx + 1}: Skipped duplicate supplier "${rawName}" (already exists in ERP as ${existing.id}).`);
      }

      // 3. Process products from vendor row
      const prodsList: ParsedVendorProduct[] = (v as any).parsedProducts || [];
      if (prodsList.length > 0) {
        prodsList.forEach((prod, pIdx) => {
          const cleanName = (prod.productName || '').trim();
          if (!cleanName) return;

          const effectiveBrand = prod.brand || targetVendorObj.brandsSupplied?.[0] || 'Standard OEM';
          const brandEnrichment = getBrandEnrichment(effectiveBrand);
          const effectiveCat = prod.category || brandEnrichment.category || 'General MRO';
          const effectiveHsn = prod.hsnCode || brandEnrichment.defaultHsn || '84821010';
          const effectiveGst = prod.gstRate ?? brandEnrichment.defaultGst ?? 18;
          const effectiveUom = prod.uom || brandEnrichment.defaultUom || 'NOS';
          const partNo = prod.partNumber || `PN-${brandEnrichment.code}-${Date.now().toString().slice(-4)}${vIdx}-${pIdx}`;

          brandsToRegister.push(brandEnrichment.canonicalName);

          // A. Create Vendor Product Mapping (if not already mapped)
          const isMapped = vendorProductMappings.some(
            (m) =>
              m.vendorId === vendorId &&
              m.productName.toLowerCase().trim() === cleanName.toLowerCase() &&
              (!prod.brand || m.brand.toLowerCase().trim() === effectiveBrand.toLowerCase())
          ) || mappingsToAdd.some(
            (m) =>
              m.vendorId === vendorId &&
              m.productName.toLowerCase().trim() === cleanName.toLowerCase()
          );

          if (!isMapped) {
            mappingsToAdd.push({
              id: `VPM-${Date.now()}-${mappingsToAdd.length + 1}`,
              vendorId,
              vendorCode: targetVendorObj.vendorCode || vendorId,
              vendorName: targetVendorObj.companyName,
              productName: cleanName,
              category: effectiveCat,
              subCategory: prod.subCategory || '',
              productType: cleanName,
              brand: brandEnrichment.canonicalName,
              modelNumber: prod.modelNumber || partNo,
              partNumber: partNo,
              specification: prod.specification || `${brandEnrichment.canonicalName} certified engineering specification`,
              uom: effectiveUom,
              supplyType: 'Authorized Distributor',
              availability: 'Regular Stock',
              status: 'ACTIVE',
              remarks: 'Imported via Vendor Excel/CSV with Product Module',
              createdAt: new Date().toISOString().split('T')[0],
              updatedAt: new Date().toISOString().split('T')[0],
            });
            importedProductCount++;
          }

          // B. Create Central Catalog ProductItem (if not already exists)
          const isCatalogProd = products.some(
            (cp) =>
              (cp.partNumber && cp.partNumber.toLowerCase().trim() === partNo.toLowerCase().trim()) ||
              cp.itemName.toLowerCase().trim() === cleanName.toLowerCase().trim()
          ) || productsToAdd.some(
            (cp) => cp.itemName.toLowerCase().trim() === cleanName.toLowerCase().trim()
          );

          if (!isCatalogProd) {
            productsToAdd.push({
              id: `PRD-${String(products.length + productsToAdd.length + 1).padStart(3, '0')}`,
              itemName: cleanName,
              category: effectiveCat,
              subCategory: prod.subCategory || '',
              brand: brandEnrichment.canonicalName,
              partNumber: partNo,
              modelNumber: prod.modelNumber || partNo,
              specification: prod.specification || `${brandEnrichment.canonicalName} industrial standard specification`,
              uom: effectiveUom,
              description: `${brandEnrichment.canonicalName} genuine industrial item supplied by ${targetVendorObj.companyName}`,
              approxRate: prod.approxRate,
              hsnCode: effectiveHsn,
              gstRate: effectiveGst,
              stockQty: prod.stockQty ?? 50,
              lastVendorName: targetVendorObj.companyName,
              status: 'ACTIVE',
              isDeleted: false,
            });
          }
        });
      }
    });

    if (brandsToRegister.length > 0) {
      registerVendorBrands(brandsToRegister);
    }

    const nextVendors = [...itemsToAdd, ...vendors];
    const nextMappings = [...mappingsToAdd, ...vendorProductMappings];
    const nextProducts = [...productsToAdd, ...products];

    if (itemsToAdd.length > 0) {
      setVendors(nextVendors);
      try {
        localStorage.setItem('erp_live_vendors', JSON.stringify(nextVendors));
      } catch {}
      fetchApi('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemsToAdd),
      }).catch((e) => console.warn('[API] Bulk vendors sync warning:', e));
    }

    if (mappingsToAdd.length > 0) {
      setVendorProductMappings(nextMappings);
      try {
        localStorage.setItem('erp_live_vendorProductMappings', JSON.stringify(nextMappings));
      } catch {}
      fetchApi('/api/vendor-products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: mappingsToAdd, userName: currentUser.name }),
      }).catch((e) => console.warn('[API] Bulk mappings sync warning:', e));
    }

    if (productsToAdd.length > 0) {
      setProducts(nextProducts);
      try {
        localStorage.setItem('erp_live_products', JSON.stringify(nextProducts));
      } catch {}
      fetchApi('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productsToAdd),
      }).catch((e) => console.warn('[API] Bulk products sync warning:', e));
    }

    // Immediately push full mutation to cloud with updated arrays so sync never uses stale data
    pushMutationToCloud({
      vendors: nextVendors,
      products: nextProducts,
      vendorProductMappings: nextMappings,
    });

    const notifMsg = importedProductCount > 0
      ? `Imported ${importedVendorCount} vendors and auto-linked ${importedProductCount} products to vendor catalogs & central product master as per brand.`
      : `Imported ${importedVendorCount} vendors into supplier registry.`;

    pushAudit('VENDORS_IMPORTED', 'Vendor', `${importedVendorCount} vendors, ${importedProductCount} products`, notifMsg);
    pushNotification('Vendors & Products Imported', notifMsg, 'SUCCESS', ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']);

    const resultObj = {
      totalUploaded: newVends.length,
      successfullyImported: importedVendorCount,
      skipped: skippedCount,
      failed: errorDetails.length,
      errorDetails,
      importedProductsCount: importedProductCount,
      valueOf(): number {
        return importedVendorCount > 0 ? importedVendorCount : importedProductCount;
      },
    };

    return resultObj;
  };

  const updateProduct = (updated: ProductItem) => {
    markLocalWrite('product', updated.id);
    const nextProds = products.map((p) => (p.id === updated.id ? updated : p));
    setProducts(nextProds);
    try {
      localStorage.setItem('erp_live_products', JSON.stringify(nextProds));
    } catch {}
    fetchApi(`/api/products/${encodeURIComponent(updated.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch((e) => console.warn('[API] Update product sync warning:', e));
    pushMutationToCloud({ products: nextProds });
    pushAudit('PRODUCT_UPDATED', 'ProductItem', updated.id, `Updated item ${updated.itemName}`);
  };

  // Soft Delete Product (Permanent Database Protection)
  const deleteProduct = (id: string, reason?: string) => {
    const target = products.find((p) => p.id === id);
    const delReason = reason || 'User Archived Product';
    const now = new Date().toISOString();
    markLocalDelete('product', id);
    const updatedDeletedProds = addTombstoneIds('erp_deleted_products', [id]);
    const nextProds = products.map((p) =>
      p.id === id
        ? {
            ...p,
            isDeleted: true,
            deletedAt: now,
            deletedBy: currentUser.name,
            deletedReason: delReason,
          }
        : p
    );
    setProducts(nextProds);
    try {
      localStorage.setItem('erp_live_products', JSON.stringify(nextProds));
    } catch {}
    fetchApi(`/api/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: delReason, user: currentUser.name }),
    }).catch((e) => console.warn('[API] Delete product sync warning:', e));
    pushMutationToCloud({ products: nextProds, deletedProductIds: updatedDeletedProds });
    pushAudit('PRODUCT_ARCHIVED', 'ProductItem', id, `Soft-deleted product ${target?.itemName || id}: ${delReason}`);
  };

  // Restore Soft-Deleted Product
  const restoreProduct = async (id: string): Promise<boolean> => {
    const target = products.find((p) => p.id === id);
    markLocalWrite('product', id);
    const updatedDeletedProds = removeTombstoneIds('erp_deleted_products', [id]);
    const nextProds = products.map((p) =>
      p.id === id
        ? {
            ...p,
            isDeleted: false,
            deletedAt: undefined,
            deletedBy: undefined,
            deletedReason: undefined,
          }
        : p
    );
    setProducts(nextProds);
    try {
      localStorage.setItem('erp_live_products', JSON.stringify(nextProds));
    } catch {}
    try {
      await fetchApi(`/api/products/${encodeURIComponent(id)}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUser.name }),
      });
      pushMutationToCloud({ products: nextProds, deletedProductIds: updatedDeletedProds });
      pushAudit('PRODUCT_RESTORED', 'ProductItem', id, `Restored product ${target?.itemName || id} to active catalog`);
      return true;
    } catch {
      return false;
    }
  };

  const importProductsList = (newProds: (Omit<ProductItem, 'id'> | ProductItem)[]): any => {
    let importedCount = 0;
    let skippedCount = 0;
    const errorDetails: string[] = [];
    const itemsToAdd: ProductItem[] = [];

    // Scan highest existing product number
    let maxProdNum = 0;
    products.forEach((cp) => {
      const match = cp.id?.match(/PRD-(\d+)/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxProdNum) maxProdNum = n;
      }
    });

    newProds.forEach((p, pIdx) => {
      const rawName = (p.itemName || (p as any).name || (p as any).productName || (p as any).title || '').trim();
      if (!rawName) {
        skippedCount++;
        errorDetails.push(`Row ${pIdx + 1}: Skipped due to missing Product Name.`);
        return;
      }

      const rawPart = (p.partNumber || (p as any).sku || (p as any).code || '').trim();
      const normPart = rawPart.toLowerCase();
      const isAutoGeneratedPart = normPart.startsWith('pn-');
      const normName = rawName.toLowerCase();
      const normBrand = (p.brand || (p as any).make || '').toLowerCase().trim();

      const existing = products.find(
        (ex) =>
          (!isAutoGeneratedPart && normPart && (ex.partNumber || '').toLowerCase().trim() === normPart && (ex.brand || '').toLowerCase().trim() === normBrand) ||
          (ex.itemName && ex.itemName.toLowerCase().trim() === normName && (ex.brand || '').toLowerCase().trim() === normBrand)
      ) || itemsToAdd.find(
        (ex) =>
          (!isAutoGeneratedPart && normPart && (ex.partNumber || '').toLowerCase().trim() === normPart && (ex.brand || '').toLowerCase().trim() === normBrand) ||
          (ex.itemName && ex.itemName.toLowerCase().trim() === normName && (ex.brand || '').toLowerCase().trim() === normBrand)
      );

      if (!existing) {
        maxProdNum++;
        const id = (p as ProductItem).id || `PRD-${String(maxProdNum).padStart(3, '0')}`;
        const isCadBrand = normBrand.includes('parss cad') || normBrand.includes('part cad') || normBrand.includes('.cad') || normBrand.includes('.dwg') || normBrand.includes('drawing');
        const effectiveBrand = isCadBrand ? 'Standard OEM' : (p.brand || (p as any).make || 'Standard OEM');
        if (isCadBrand) {
          errorDetails.push(`Row ${pIdx + 1} ("${rawName}"): Brand "${p.brand || ''}" detected as CAD/drawing file name ('parss cad'). Standardized to 'Standard OEM'.`);
        }

        itemsToAdd.push({
          ...p,
          id,
          itemName: rawName,
          category: p.category || (p as any).materialCategory || 'General MRO',
          subCategory: p.subCategory || '',
          brand: effectiveBrand,
          partNumber: rawPart || `PN-${String(maxProdNum).padStart(4, '0')}-${Math.floor(Math.random() * 900 + 100)}`,
          modelNumber: p.modelNumber || (p as any).partNumber || 'STD',
          specification: p.specification || (p as any).specs || rawName,
          uom: p.uom || (p as any).unit || 'NOS',
          description: p.description || rawName,
          approxRate: p.approxRate,
          hsnCode: p.hsnCode || '8482',
          gstRate: p.gstRate ?? 18,
          stockQty: p.stockQty ?? 50,
          status: 'ACTIVE',
          isDeleted: false,
        });
        importedCount++;
      } else {
        skippedCount++;
        errorDetails.push(`Row ${pIdx + 1}: Skipped duplicate item "${rawName}" (${normBrand || 'Standard OEM'}) - already present in Product Master.`);
      }
    });

    if (itemsToAdd.length > 0) {
      const nextProds = [...itemsToAdd, ...products];
      setProducts(nextProds);
      try {
        localStorage.setItem('erp_live_products', JSON.stringify(nextProds));
      } catch {}
      fetchApi('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemsToAdd),
      }).catch((e) => console.warn('[API] Bulk products sync warning:', e));
      pushMutationToCloud({ products: nextProds });
      pushAudit('PRODUCTS_IMPORTED', 'ProductItem', `${importedCount} products`, `Bulk imported ${importedCount} items into catalog.`);
    }

    const resultObj = {
      totalUploaded: newProds.length,
      successfullyImported: importedCount,
      skipped: skippedCount,
      failed: errorDetails.length,
      errorDetails,
      valueOf(): number {
        return importedCount;
      },
    };

    return resultObj;
  };

  const lockQuotationCommercials = (quotationId: string, remarks?: string) => {
    const qtn = customerQuotations.find((q) => q.id === quotationId);
    if (!qtn) return;

    const totalSelling = qtn.subtotal || qtn.items.reduce((s, it) => s + it.totalTaxableAmount, 0);
    const totalBuying = qtn.items.reduce(
      (s, it) => s + (it.purchasePrice + (it.freightCost || 0) + (it.otherCost || 0)) * it.quantity,
      0
    );
    const earning = totalSelling - totalBuying;
    const margin = totalSelling > 0 ? (earning / totalSelling) * 100 : 0;

    const lockData = {
      isLocked: true,
      lockedBy: currentUser.name,
      lockedAt: new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      lockedRemarks: remarks || 'Commercial margin verified and locked against tampering.',
      lockedEarnings: earning,
      lockedMarginPercent: margin,
      unlockHistory: qtn.commercialLock?.unlockHistory || [],
    };

    const nextQtns = customerQuotations.map((q) => (q.id === quotationId ? { ...q, commercialLock: lockData } : q));
    setCustomerQuotations(nextQtns);

    const nextReqs = requirements.map((r) => (r.id === qtn.requirementId ? { ...r, commercialLock: lockData } : r));
    setRequirements(nextReqs);

    try {
      localStorage.setItem('erp_live_quotations', JSON.stringify(nextQtns));
      localStorage.setItem('erp_live_requirements', JSON.stringify(nextReqs));
    } catch {}

    const lockedQtn = nextQtns.find((q) => q.id === quotationId);
    if (lockedQtn) {
      fetchApi('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lockedQtn),
      }).catch(() => {});
    }
    const lockedReq = nextReqs.find((r) => r.id === qtn.requirementId);
    if (lockedReq) {
      fetchApi(`/api/requirements/${encodeURIComponent(lockedReq.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lockedReq),
      }).catch(() => {});
    }
    pushMutationToCloud({ quotations: nextQtns, requirements: nextReqs });

    pushAudit(
      'COMMERCIALS_LOCKED',
      'Quotation',
      quotationId,
      `Frozen gross earning ₹${earning.toLocaleString('en-IN')} (${margin.toFixed(1)}%) by ${currentUser.name}`
    );

    pushNotification(
      'Commercials Locked',
      `Quotation ${quotationId} earning ₹${earning.toLocaleString('en-IN')} locked and protected.`,
      'SUCCESS',
      ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE', 'ACCOUNTS_USER']
    );
  };

  const unlockQuotationCommercials = (quotationId: string, reason: string) => {
    const qtn = customerQuotations.find((q) => q.id === quotationId);
    if (!qtn) return;

    const priorHistory = qtn.commercialLock?.unlockHistory || [];
    const updatedHistory = [
      {
        unlockedBy: currentUser.name,
        unlockedAt: new Date().toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        reason,
      },
      ...priorHistory,
    ];

    const unlockData = {
      isLocked: false,
      unlockHistory: updatedHistory,
    };

    const nextQtns = customerQuotations.map((q) => (q.id === quotationId ? { ...q, commercialLock: unlockData } : q));
    setCustomerQuotations(nextQtns);

    const nextReqs = requirements.map((r) => (r.id === qtn.requirementId ? { ...r, commercialLock: unlockData } : r));
    setRequirements(nextReqs);

    try {
      localStorage.setItem('erp_live_quotations', JSON.stringify(nextQtns));
      localStorage.setItem('erp_live_requirements', JSON.stringify(nextReqs));
    } catch {}

    const unlockedQtn = nextQtns.find((q) => q.id === quotationId);
    if (unlockedQtn) {
      fetchApi('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unlockedQtn),
      }).catch(() => {});
    }
    const unlockedReq = nextReqs.find((r) => r.id === qtn.requirementId);
    if (unlockedReq) {
      fetchApi(`/api/requirements/${encodeURIComponent(unlockedReq.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unlockedReq),
      }).catch(() => {});
    }
    pushMutationToCloud({ quotations: nextQtns, requirements: nextReqs });

    pushAudit(
      'COMMERCIALS_UNLOCKED',
      'Quotation',
      quotationId,
      `Commercials unlocked by ${currentUser.name} - Reason: ${reason}`
    );

    pushNotification(
      'Commercials Unlocked',
      `Quotation ${quotationId} opened for amendment. Reason: ${reason}`,
      'WARNING',
      ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']
    );
  };

  // Category Master Operations
  const addCategory = (catData: Omit<MaterialCategory, 'id' | 'createdAt' | 'updatedAt'>): MaterialCategory => {
    const newId = nextSequenceId('CAT', categories, 'erp_deleted_categories');
    const now = new Date().toISOString().split('T')[0];
    const newCat: MaterialCategory = {
      ...catData,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };
    markLocalWrite('category', newId);
    const updatedDeleted = removeTombstoneIds('erp_deleted_categories', [newId]);
    const nextCats = [newCat, ...categories];
    setCategories(nextCats);
    try {
      localStorage.setItem('erp_live_categories', JSON.stringify(nextCats));
    } catch {}
    fetchApi('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCat),
    }).catch(() => {});
    pushMutationToCloud({ categories: nextCats, deletedCategoryIds: updatedDeleted });
    pushAudit('CATEGORY_CREATED', 'MaterialCategory', newId, `Added category "${newCat.name}" with ${newCat.keywords.length} keywords`);
    pushNotification('Category Created', `Material category "${newCat.name}" created successfully.`, 'SUCCESS', ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']);
    return newCat;
  };

  const updateCategory = (updated: MaterialCategory) => {
    const now = new Date().toISOString().split('T')[0];
    markLocalWrite('category', updated.id);
    const updatedCat = { ...updated, updatedAt: now };
    const nextCats = categories.map((c) => (c.id === updated.id ? updatedCat : c));
    setCategories(nextCats);
    try {
      localStorage.setItem('erp_live_categories', JSON.stringify(nextCats));
    } catch {}
    fetchApi(`/api/categories/${encodeURIComponent(updated.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedCat),
    }).catch(() => {});
    pushMutationToCloud({ categories: nextCats });
    pushAudit('CATEGORY_UPDATED', 'MaterialCategory', updated.id, `Updated category "${updated.name}"`);
    pushNotification('Category Updated', `Category "${updated.name}" updated.`, 'INFO', ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']);
  };

  const deleteCategory = (id: string): { success: boolean; message: string } => {
    const target = categories.find((c) => c.id === id);
    if (!target) return { success: false, message: 'Category not found' };

    const isAdmin = isSuperAdminUser(currentUser);

    if (!isAdmin) {
      // Check if any vendor is mapped to this category
      const vendorsUsing = vendors.filter((v) => {
        const cats = v.materialCategories && v.materialCategories.length > 0 ? v.materialCategories : v.productCategories || [];
        return cats.some((c) => c.toLowerCase() === target.name.toLowerCase());
      });

      if (vendorsUsing.length > 0) {
        return {
          success: false,
          message: `Cannot delete category "${target.name}": It is currently assigned to ${vendorsUsing.length} vendor(s) (e.g. ${vendorsUsing[0].companyName}). Please unmap vendors first or contact Super Admin.`,
        };
      }

      // Check if any requirement uses this category
      const reqsUsing = requirements.filter((r) =>
        r.items.some((i) => (i.category || '').toLowerCase() === target.name.toLowerCase() || (i.recommendedCategory || '').toLowerCase() === target.name.toLowerCase())
      );

      if (reqsUsing.length > 0) {
        return {
          success: false,
          message: `Cannot delete category "${target.name}": ${reqsUsing.length} existing requirement(s) are linked to it. Recommend disabling the category instead or contact Super Admin.`,
        };
      }
    }

    markLocalDelete('category', id);
    const updatedDeleted = addTombstoneIds('erp_deleted_categories', [id]);
    const nextCats = categories.filter((c) => c.id !== id);
    setCategories(nextCats);
    try {
      localStorage.setItem('erp_live_categories', JSON.stringify(nextCats));
    } catch {}
    fetchApi(`/api/categories/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    pushMutationToCloud({ categories: nextCats, deletedCategoryIds: updatedDeleted });
    pushAudit('CATEGORY_DELETED', 'MaterialCategory', id, `Deleted category "${target.name}"`);
    pushNotification('Category Deleted', `Category "${target.name}" removed from catalog.`, 'WARNING', ['SUPER_ADMIN']);
    return { success: true, message: `Category "${target.name}" deleted successfully.` };
  };

  const toggleCategoryStatus = (id: string) => {
    const target = categories.find((c) => c.id === id);
    if (!target) return;
    const newStatus = !target.isActive;
    const updated = { ...target, isActive: newStatus, updatedAt: new Date().toISOString().split('T')[0] };
    markLocalWrite('category', id);
    const nextCats = categories.map((c) => (c.id === id ? updated : c));
    setCategories(nextCats);
    try {
      localStorage.setItem('erp_live_categories', JSON.stringify(nextCats));
    } catch {}
    fetchApi(`/api/categories/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {});
    pushMutationToCloud({ categories: nextCats });
    pushAudit('CATEGORY_STATUS_TOGGLED', 'MaterialCategory', id, `Category "${target.name}" ${newStatus ? 'Activated' : 'Disabled'}`);
  };

  const addKeywordToCategory = (categoryId: string, keyword: string) => {
    const cleanKw = keyword.trim().toLowerCase();
    if (!cleanKw) return;

    setCategories((prev) =>
      prev.map((c) => {
        if (c.id === categoryId) {
          if (c.keywords.some((k) => k.toLowerCase() === cleanKw)) return c;
          const updatedKeywords = [...c.keywords, cleanKw];
          pushAudit('CATEGORY_KEYWORD_LEARNED', 'MaterialCategory', categoryId, `Added learned keyword "${cleanKw}" to category "${c.name}"`);
          return { ...c, keywords: updatedKeywords, updatedAt: new Date().toISOString().split('T')[0] };
        }
        return c;
      })
    );
    pushNotification('Keyword Added', `Added "${keyword}" to category keywords for smarter auto-recommendations.`, 'SUCCESS', ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']);
  };

  const bulkImportRequirements = (newReqs: Omit<CustomerRequirement, 'id' | 'createdAt'>[]): number => {
    let importedCount = 0;
    const itemsToAdd: CustomerRequirement[] = [];

    newReqs.forEach((r, idx) => {
      const newId = `REQ-2026-${String(requirements.length + itemsToAdd.length + 1).padStart(5, '0')}`;
      const now = new Date().toISOString().split('T')[0];

      // Auto-classify items if not set
      const enrichedItems = r.items.map((item, itemIdx) => {
        const catRec = recommendCategoryForRequirement(item, categories);
        const vendorRecs = recommendVendorsForRequirement(
          {
            category: item.category || catRec.category,
            subCategory: item.subCategory || catRec.subCategory,
            itemName: item.itemName,
            description: item.description,
          },
          vendors
        );

        return {
          ...item,
          id: `ITEM-${String(itemIdx + 1).padStart(3, '0')}`,
          category: item.category || catRec.category,
          recommendedCategory: catRec.category,
          subCategory: item.subCategory || catRec.subCategory,
          recommendedVendors: vendorRecs,
          confidenceScore: catRec.confidence,
        };
      });

      itemsToAdd.push({
        ...r,
        id: newId,
        createdAt: now,
        items: enrichedItems,
        isBulkImported: true,
      });
      importedCount++;
    });

    if (itemsToAdd.length > 0) {
      setRequirements((prev) => [...itemsToAdd, ...prev]);
      pushAudit('BULK_REQUIREMENTS_IMPORTED', 'CustomerRequirement', `${importedCount} records`, `Imported ${importedCount} bulk requirements via Excel`);
      pushNotification('Requirements Imported', `Successfully imported ${importedCount} requirements with auto-category classification.`, 'SUCCESS', ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']);
    }
    return importedCount;
  };

  const assignVendorToRequirementItem = (requirementId: string, itemId: string, vendorId: string, vendorName: string) => {
    setRequirements((prev) =>
      prev.map((req) => {
        if (req.id !== requirementId) return req;
        const updatedItems = req.items.map((it) => {
          if (it.id === itemId) {
            return {
              ...it,
              selectedVendorId: vendorId,
              selectedVendorName: vendorName,
            };
          }
          return it;
        });
        return {
          ...req,
          items: updatedItems,
        };
      })
    );

    pushAudit('VENDOR_ASSIGNED_TO_ITEM', 'CustomerRequirement', requirementId, `Assigned supplier ${vendorName} (${vendorId}) to item ${itemId}`);
    pushNotification('Supplier Assigned', `${vendorName} assigned to requirement ${requirementId}.`, 'SUCCESS', ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']);
  };

  // AI Vendor Catalog Analyzer & Learning Methods
  const analyzeVendorCatalogFiles = async (
    vendorId: string,
    files: Array<{ name: string; type: string; size?: number; textContent?: string }>
  ): Promise<number> => {
    const targetVendor = vendors.find((v) => v.id === vendorId);
    if (!targetVendor) throw new Error('Vendor not found');

    let totalNewProducts = 0;
    const newCatalogFiles: VendorCatalogFile[] = [];
    const newCatalogProducts: VendorCatalogProduct[] = [];
    const newSuggestedCategories: VendorMaterialCategory[] = [];

    const existingProducts = targetVendor.catalogProducts || [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const analysisResult = await analyzeVendorCatalog({
        vendorId,
        vendorName: targetVendor.companyName,
        file,
      });

      const fileId = `CATFILE-${Date.now()}-${i + 1}`;
      const catalogFileEntry: VendorCatalogFile = {
        id: fileId,
        vendorId,
        fileName: file.name,
        fileType: analysisResult.fileType,
        fileSize: file.size ? `${(file.size / 1024).toFixed(1)} KB` : '1.8 MB',
        uploadDate: new Date().toISOString().split('T')[0],
        processingStatus: 'ANALYZED',
        aiAnalysisStatus: 'COMPLETED',
        productsIdentifiedCount: analysisResult.products.length,
      };
      newCatalogFiles.push(catalogFileEntry);

      // Process products and check for duplicates
      analysisResult.products.forEach((p, pIdx) => {
        const prodId = `CPRD-${Date.now()}-${i}-${pIdx + 1}`;
        const dupCheck = detectDuplicateProduct(p, [...existingProducts, ...newCatalogProducts]);

        const prodEntry: VendorCatalogProduct = {
          ...p,
          id: prodId,
          catalogFileId: fileId,
          isDuplicate: dupCheck.isDuplicate,
          duplicateOfId: dupCheck.duplicateOf?.id,
        };
        newCatalogProducts.push(prodEntry);
        totalNewProducts++;
      });

      // Suggested categories
      analysisResult.suggestedCategories.forEach((sc, scIdx) => {
        const catId = `AICAT-${Date.now()}-${i}-${scIdx + 1}`;
        newSuggestedCategories.push({
          ...sc,
          id: catId,
        });
      });
    }

    const updatedVendors = vendors.map((v) => {
      if (v.id !== vendorId) return v;
      return {
        ...v,
        lastAiAnalysisDate: new Date().toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        catalogFiles: [...(v.catalogFiles || []), ...newCatalogFiles],
        catalogProducts: [...(v.catalogProducts || []), ...newCatalogProducts],
        aiMaterialCategories: [...(v.aiMaterialCategories || []), ...newSuggestedCategories],
      };
    });

    setVendors(updatedVendors);

    // AI Activity Log entry
    const newLog: AIActivityLog = {
      id: `AILOG-${Date.now()}`,
      timestamp: new Date().toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      vendorId,
      vendorName: targetVendor.companyName,
      fileName: files.map((f) => f.name).join(', '),
      action: 'CATALOG_ANALYZED',
      productsCount: totalNewProducts,
      categoriesSuggested: newSuggestedCategories.map((c) => c.category),
      userAction: `Analyzed ${files.length} catalog files via Gemini AI`,
      confidence: Math.round(
        newSuggestedCategories.reduce((acc, c) => acc + c.confidence, 0) / (newSuggestedCategories.length || 1)
      ),
      details: `Identified ${totalNewProducts} products and ${newSuggestedCategories.length} categories. Awaiting user approval.`,
    };

    setAiActivityLogs((prev) => [newLog, ...prev]);

    pushAudit(
      'CATALOG_ANALYZED',
      'Vendor',
      vendorId,
      `AI analyzed ${files.length} catalog file(s) for ${targetVendor.companyName}: identified ${totalNewProducts} items across ${newSuggestedCategories.length} categories`
    );

    pushNotification(
      'Catalog Analysis Complete',
      `Identified ${totalNewProducts} products for ${targetVendor.companyName}. Review suggested categories.`,
      'ACTION_REQUIRED',
      ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']
    );

    return totalNewProducts;
  };

  const approveVendorMaterialCategory = (vendorId: string, categoryId: string) => {
    let approvedCategoryName = '';
    let approvedSubCategory = '';
    let approvedBrands: string[] = [];

    setVendors((prev) =>
      prev.map((v) => {
        if (v.id !== vendorId) return v;

        const targetCat = v.aiMaterialCategories?.find((c) => c.id === categoryId);
        if (!targetCat) return v;

        approvedCategoryName = targetCat.category;
        approvedSubCategory = targetCat.subCategory || '';
        approvedBrands = targetCat.brands || [];

        const updatedAiCategories = (v.aiMaterialCategories || []).map((c) => {
          if (c.id === categoryId) {
            return {
              ...c,
              status: 'APPROVED' as const,
              approvedBy: currentUser.name,
              approvedAt: new Date().toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
            };
          }
          return c;
        });

        // Add to approved materialCategories
        const existingCats = v.materialCategories || v.productCategories || [];
        const nextCats = existingCats.includes(approvedCategoryName)
          ? existingCats
          : [...existingCats, approvedCategoryName];

        // Add to subCategories
        const existingSubCats = v.subCategories || [];
        const nextSubCats =
          approvedSubCategory && !existingSubCats.includes(approvedSubCategory)
            ? [...existingSubCats, approvedSubCategory]
            : existingSubCats;

        // Add to brandsSupplied
        const existingBrands = v.brandsSupplied || [];
        const nextBrands = Array.from(new Set([...existingBrands, ...approvedBrands]));

        // Mark associated products as approved
        const updatedProducts = (v.catalogProducts || []).map((p) => {
          if (p.category === approvedCategoryName) {
            return { ...p, approvalStatus: 'APPROVED' as const };
          }
          return p;
        });

        return {
          ...v,
          materialCategories: nextCats,
          productCategories: nextCats,
          subCategories: nextSubCats,
          brandsSupplied: nextBrands,
          aiMaterialCategories: updatedAiCategories,
          catalogProducts: updatedProducts,
        };
      })
    );

    const targetVendor = vendors.find((v) => v.id === vendorId);
    const newLog: AIActivityLog = {
      id: `AILOG-${Date.now()}`,
      timestamp: new Date().toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      vendorId,
      vendorName: targetVendor?.companyName || vendorId,
      action: 'CATEGORY_APPROVED',
      productsCount: 1,
      categoriesSuggested: [approvedCategoryName],
      userAction: `Approved by ${currentUser.name}`,
      confidence: 100,
      details: `User approved category "${approvedCategoryName}" and added to vendor material profile.`,
    };
    setAiActivityLogs((prev) => [newLog, ...prev]);

    pushAudit('CATEGORY_APPROVED', 'Vendor', vendorId, `Approved material category ${approvedCategoryName} for ${targetVendor?.companyName || vendorId}`);
    pushNotification('Material Profile Updated', `Added approved category "${approvedCategoryName}" to ${targetVendor?.companyName}.`, 'SUCCESS', ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']);
  };

  const rejectVendorMaterialCategory = (vendorId: string, categoryId: string) => {
    let rejectedCatName = '';
    setVendors((prev) =>
      prev.map((v) => {
        if (v.id !== vendorId) return v;
        const targetCat = v.aiMaterialCategories?.find((c) => c.id === categoryId);
        rejectedCatName = targetCat?.category || '';
        return {
          ...v,
          aiMaterialCategories: (v.aiMaterialCategories || []).map((c) =>
            c.id === categoryId ? { ...c, status: 'REJECTED' as const } : c
          ),
        };
      })
    );

    const targetVendor = vendors.find((v) => v.id === vendorId);
    const newLog: AIActivityLog = {
      id: `AILOG-${Date.now()}`,
      timestamp: new Date().toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      vendorId,
      vendorName: targetVendor?.companyName || vendorId,
      action: 'CATEGORY_REJECTED',
      productsCount: 0,
      categoriesSuggested: [rejectedCatName],
      userAction: `Rejected by ${currentUser.name}`,
      confidence: 0,
      details: `User rejected AI suggested category "${rejectedCatName}". Vendor profile unchanged.`,
    };
    setAiActivityLogs((prev) => [newLog, ...prev]);

    pushAudit('CATEGORY_REJECTED', 'Vendor', vendorId, `Rejected suggested category ${rejectedCatName} for ${targetVendor?.companyName}`);
  };

  const editVendorMaterialCategory = (vendorId: string, categoryId: string, updated: Partial<VendorMaterialCategory>) => {
    setVendors((prev) =>
      prev.map((v) => {
        if (v.id !== vendorId) return v;
        return {
          ...v,
          aiMaterialCategories: (v.aiMaterialCategories || []).map((c) =>
            c.id === categoryId ? { ...c, ...updated } : c
          ),
        };
      })
    );

    pushAudit('CATEGORY_EDITED', 'Vendor', vendorId, `Modified suggested category details in vendor ${vendorId}`);
  };

  const approveAllVendorMaterialCategories = (vendorId: string) => {
    const targetVendor = vendors.find((v) => v.id === vendorId);
    if (!targetVendor) return;

    const pending = (targetVendor.aiMaterialCategories || []).filter((c) => c.status === 'PENDING_APPROVAL');
    if (pending.length === 0) return;

    pending.forEach((c) => {
      approveVendorMaterialCategory(vendorId, c.id);
    });
  };

  const persistUpdatedVendorState = (vendorId: string, nextVendors: Vendor[]) => {
    markLocalWrite('vendor', vendorId);
    try {
      localStorage.setItem('erp_live_vendors', JSON.stringify(nextVendors));
    } catch {}
    const updatedVendor = nextVendors.find((v) => v.id === vendorId);
    if (updatedVendor) {
      fetchApi(`/api/vendors/${encodeURIComponent(vendorId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedVendor),
      }).catch(() => {});
    }
    pushMutationToCloud({ vendors: nextVendors });
  };

  const approveVendorCatalogProduct = (vendorId: string, productId: string) => {
    const nextVendors = vendors.map((v) => {
      if (v.id !== vendorId) return v;
      return {
        ...v,
        catalogProducts: (v.catalogProducts || []).map((p) =>
          p.id === productId ? { ...p, approvalStatus: 'APPROVED' as const } : p
        ),
      };
    });
    setVendors(nextVendors);
    persistUpdatedVendorState(vendorId, nextVendors);
  };

  const rejectVendorCatalogProduct = (vendorId: string, productId: string) => {
    const nextVendors = vendors.map((v) => {
      if (v.id !== vendorId) return v;
      return {
        ...v,
        catalogProducts: (v.catalogProducts || []).map((p) =>
          p.id === productId ? { ...p, approvalStatus: 'REJECTED' as const } : p
        ),
      };
    });
    setVendors(nextVendors);
    persistUpdatedVendorState(vendorId, nextVendors);
  };

  const learnCategoryFromVendorQuotation = (
    vendorId: string,
    categoryName: string,
    subCategoryName?: string,
    sourceDoc: string = 'Vendor RFQ Quotation'
  ) => {
    const targetVendor = vendors.find((v) => v.id === vendorId);
    if (!targetVendor) return;

    const existingCats = targetVendor.materialCategories || targetVendor.productCategories || [];
    if (existingCats.includes(categoryName)) return;

    const catId = `AICAT-LEARN-${Date.now()}`;
    const newCat: VendorMaterialCategory = {
      id: catId,
      vendorId,
      category: categoryName,
      subCategory: subCategoryName,
      brands: targetVendor.brandsSupplied || [],
      productsFoundCount: 1,
      confidence: 96,
      sourceDocument: sourceDoc,
      status: 'APPROVED',
      approvedBy: currentUser.name,
      approvedAt: new Date().toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const nextVendors = vendors.map((v) => {
      if (v.id !== vendorId) return v;
      const nextCats = [...(v.materialCategories || v.productCategories || []), categoryName];
      const nextSubCats = subCategoryName && !(v.subCategories || []).includes(subCategoryName)
        ? [...(v.subCategories || []), subCategoryName]
        : v.subCategories || [];
      return {
        ...v,
        materialCategories: nextCats,
        productCategories: nextCats,
        subCategories: nextSubCats,
        aiMaterialCategories: [...(v.aiMaterialCategories || []), newCat],
      };
    });
    setVendors(nextVendors);
    persistUpdatedVendorState(vendorId, nextVendors);

    const newLog: AIActivityLog = {
      id: `AILOG-${Date.now()}`,
      timestamp: new Date().toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      vendorId,
      vendorName: targetVendor.companyName,
      action: 'RFQ_LEARNING_ACCEPTED',
      productsCount: 1,
      categoriesSuggested: [categoryName],
      userAction: `Learned and approved from quotation by ${currentUser.name}`,
      confidence: 96,
      details: `AI detected new dealing category "${categoryName}" from quotation and updated vendor profile.`,
    };
    setAiActivityLogs((prev) => [newLog, ...prev]);

    pushAudit('VENDOR_LEARNING_APPROVED', 'Vendor', vendorId, `Learned new category "${categoryName}" from quotation for ${targetVendor.companyName}`);
    pushNotification('Supplier Profile Expanded', `Added "${categoryName}" to ${targetVendor.companyName} based on quotation response.`, 'SUCCESS', ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']);
  };

  const deleteVendorCatalogFile = (vendorId: string, fileId: string) => {
    const nextVendors = vendors.map((v) => {
      if (v.id !== vendorId) return v;
      const targetFile = v.catalogFiles?.find((f) => f.id === fileId);
      return {
        ...v,
        catalogFiles: (v.catalogFiles || []).filter((f) => f.id !== fileId),
        catalogProducts: (v.catalogProducts || []).filter((p) => p.catalogFileId !== fileId || p.approvalStatus === 'APPROVED'),
        aiMaterialCategories: (v.aiMaterialCategories || []).filter((c) => c.sourceDocument !== targetFile?.fileName || c.status === 'APPROVED'),
      };
    });
    setVendors(nextVendors);
    persistUpdatedVendorState(vendorId, nextVendors);
    pushAudit('CATALOG_FILE_DELETED', 'Vendor', vendorId, `Deleted catalog file ${fileId} from vendor ${vendorId}`);
  };

  const saveCatalogAnalysisToVendor = async (
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
    }
  ): Promise<{ success: boolean; verified?: boolean; batchId?: string; diff?: any }> => {
    try {
      const targetVendor = vendors.find((v) => v.id === vendorId);
      if (!targetVendor) return { success: false };

      const approvedProds = (payload.catalogProducts || []).filter((p: any) => !p.ignored);

      // Persist transactionally to central production backend (creates versioned batch, diff, rate history, confirmed new brands & verifies)
      const res = await fetchApi(`/api/vendors/${encodeURIComponent(vendorId)}/catalog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          catalogProducts: approvedProds,
          userName: currentUser.name,
          userRole: currentUser.role,
        }),
        timeoutMs: 60000,
      });

      if (!res.ok) {
        return { success: false };
      }

      const data = await res.json();
      const updatedVendors = data.vendor
        ? vendors.map((v) => (v.id === vendorId ? data.vendor : v))
        : vendors;
      if (data.vendor) {
        markLocalWrite('vendor', vendorId);
        setVendors(updatedVendors);
        try {
          localStorage.setItem('erp_live_vendors', JSON.stringify(updatedVendors));
          localStorage.setItem(`${activePrefix}vendors`, JSON.stringify(updatedVendors));
        } catch {}
      }

      let nextBrands = brands;
      if (Array.isArray(data.newBrandsCreated) && data.newBrandsCreated.length > 0) {
        const existingNames = new Set(brands.map((b) => b.name.toLowerCase()));
        const additions = data.newBrandsCreated.filter(
          (b: any) => !existingNames.has((b.name || '').toLowerCase())
        );
        if (additions.length > 0) {
          nextBrands = [...additions, ...brands];
          setBrands(nextBrands);
        }
      }

      const serverVendorMappings: VendorProductMapping[] = Array.isArray(data.vendorProductMappings)
        ? data.vendorProductMappings
        : approvedProds.map((p: any, idx: number) => {
            const rel =
              (payload.brandsDetected || []).find((b: any) => b.name === p.brand)?.relationship || 'Listed In Catalogue';
            return {
              id: `VPM-${Date.now()}-${idx + 1}`,
              vendorId,
              vendorCode: targetVendor.vendorCode || targetVendor.id,
              vendorName: targetVendor.companyName,
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
              supplyType: rel,
              availability: 'Regular Stock',
              status: 'ACTIVE',
              remarks: `Imported from ${payload.catalogFile?.fileName || 'Catalogue'} (${data.batchId || ''})`,
              createdAt: new Date().toISOString().split('T')[0],
            };
          });

      const filteredPrevMappings = vendorProductMappings.filter((m) => {
        if (m.vendorId !== vendorId) return true;
        if (Array.isArray(data.vendorProductMappings)) return false;
        return !serverVendorMappings.some(
          (nm) =>
            nm.vendorId === m.vendorId &&
            nm.productName.toLowerCase() === m.productName.toLowerCase() &&
            nm.brand.toLowerCase() === m.brand.toLowerCase()
        );
      });
      const nextMappings = [...serverVendorMappings, ...filteredPrevMappings];
      setVendorProductMappings(nextMappings);

      // Batch-create new items into Product Master without firing per-item stale syncs
      let maxProdNum = products.reduce((max, pr) => {
        const m = pr.id?.match(/PRD-(\d+)/i);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0);
      const newProductItems: ProductItem[] = [];
      const seenProductKeys = new Set(
        products.map((prod) => `${(prod.itemName || '').toLowerCase().trim()}::${(prod.partNumber || '').toLowerCase().trim()}`)
      );

      approvedProds.forEach((p: any) => {
        if (p.duplicateResolution === 'USE_EXISTING' || p.matchStatus === 'EXACT_MATCH') return;
        const nameNorm = (p.productName || '').toLowerCase().trim();
        const partNorm = (p.partNumber || '').toLowerCase().trim();
        const exists =
          products.some(
            (prod) =>
              (prod.itemName || '').toLowerCase().trim() === nameNorm ||
              (partNorm && (prod.partNumber || '').toLowerCase().trim() === partNorm)
          ) || seenProductKeys.has(`${nameNorm}::${partNorm}`);

        if (!exists && nameNorm) {
          seenProductKeys.add(`${nameNorm}::${partNorm}`);
          maxProdNum += 1;
          newProductItems.push({
            id: `PRD-${String(maxProdNum).padStart(3, '0')}`,
            itemName: p.productName,
            category: p.category,
            subCategory: p.subCategory,
            brand: p.brand,
            partNumber: p.partNumber || p.modelNumber || '',
            modelNumber: p.modelNumber || '',
            specification: p.specification || '',
            uom: p.uom || 'NOS',
            hsnCode: '8482',
            approxRate: p.purchaseRate ?? p.mrp ?? 0,
            gstRate: 18,
            status: 'ACTIVE',
            description: p.description || p.specification || '',
          });
        }
      });

      const nextProducts = newProductItems.length > 0 ? [...newProductItems, ...products] : products;
      if (newProductItems.length > 0) {
        setProducts(nextProducts);
        try {
          localStorage.setItem('erp_live_products', JSON.stringify(nextProducts));
          localStorage.setItem(`${activePrefix}products`, JSON.stringify(nextProducts));
        } catch {}
      }

      // Sync fresh updated arrays atomically (never overwrite data.vendor with stale closure)
      pushMutationToCloud({
        vendors: updatedVendors,
        brands: nextBrands,
        vendorProductMappings: nextMappings,
        products: nextProducts,
      });

      const logTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
      setAiActivityLogs((prev) => [
        {
          id: `AILOG-${Date.now()}`,
          timestamp: logTimestamp,
          vendorId,
          vendorName: targetVendor.companyName,
          fileName: payload.catalogFile?.fileName || 'Catalogue Upload',
          action: 'CATALOG_ANALYZED',
          productsCount: approvedProds.length,
          categoriesSuggested: (payload.suggestedCategories || []).map((c: any) => c.category).filter(Boolean),
          userAction: `Committed Batch ${data.batchId || ''} by ${currentUser.name}`,
          confidence: 95,
          details: `Verified & saved ${approvedProds.length} products (+${data.diff?.newProducts?.length ?? approvedProds.length} new, ${data.diff?.changedRates?.length ?? 0} rate changes). Score: ${data.vendor?.intelligenceScore ?? 0}/100.`,
        },
        ...prev,
      ]);

      pushAudit(
        'CATALOG_SAVED_TO_VENDOR',
        'Vendor',
        vendorId,
        `Saved catalogue batch ${data.batchId || ''} (${payload.catalogFile?.fileName || ''}) with ${approvedProds.length} products for ${targetVendor.companyName}`
      );
      pushNotification(
        'Catalogue Batch Committed & Verified',
        `Saved batch ${data.batchId || ''} (${approvedProds.length} items) for ${targetVendor.companyName}.`,
        'SUCCESS',
        ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']
      );

      return {
        success: !!data.success,
        verified: data.verified,
        batchId: data.batchId,
        diff: data.diff,
      };
    } catch (err) {
      console.error('Error saving catalog to vendor:', err);
      return { success: false };
    }
  };

  const analyzeVendorWebsite = async (
    vendorId: string,
    url: string
  ): Promise<{ success: boolean; error?: string; result?: any }> => {
    try {
      const res = await fetchApi(`/api/vendors/${encodeURIComponent(vendorId)}/analyze-website`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, userName: currentUser.name, userRole: currentUser.role }),
        timeoutMs: 60000,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || `Website analysis failed (HTTP ${res.status})` };
      }
      if (data.vendor) {
        markLocalWrite('vendor', vendorId);
        setVendors((prev) => {
          const next = prev.map((v) => (v.id === vendorId ? data.vendor : v));
          try {
            localStorage.setItem('erp_live_vendors', JSON.stringify(next));
            localStorage.setItem(`${activePrefix}vendors`, JSON.stringify(next));
          } catch {}
          return next;
        });
      }
      pushAudit(
        'VENDOR_WEBSITE_ANALYZED',
        'Vendor',
        vendorId,
        `Analyzed supplier website ${url} (Enriched: ${data.enrichedFromWebsiteCount || 0}, Added: ${data.addedFromWebsiteCount || 0})`
      );
      pushNotification(
        'Website Intelligence Synced',
        `Extracted ${data.products?.length || 0} products & ${(data.brands || []).length} brands from ${url}.`,
        'SUCCESS',
        ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']
      );
      return { success: true, result: data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error while analyzing website' };
    }
  };

  const manageVendorCatalogueBatch = async (
    vendorId: string,
    batchId: string,
    action: 'ARCHIVE' | 'DEACTIVATE' | 'RESTORE' | 'ROLLBACK',
    force: boolean = false
  ) => {
    try {
      const res = await fetchApi(
        `/api/vendors/${encodeURIComponent(vendorId)}/catalog/batches/${encodeURIComponent(batchId)}/action`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            force,
            userName: currentUser.name,
            userRole: currentUser.role,
          }),
          timeoutMs: 45000,
        }
      );
      const data = await res.json().catch(() => ({}));
      if (data.vendor) {
        markLocalWrite('vendor', vendorId);
        setVendors((prev) => {
          const next = prev.map((v) => (v.id === vendorId ? data.vendor : v));
          try {
            localStorage.setItem('erp_live_vendors', JSON.stringify(next));
            localStorage.setItem(`${activePrefix}vendors`, JSON.stringify(next));
          } catch {}
          return next;
        });
      }
      if (data.success) {
        pushAudit('CATALOG_BATCH_MANAGED', 'Vendor', batchId, data.message || `Executed ${action} on ${batchId}`);
        pushNotification('Catalogue Batch Updated', data.message || `${action} completed`, 'INFO', ['SUPER_ADMIN']);
      }
      return {
        success: !!data.success,
        requiresConfirmation: !!data.requiresConfirmation,
        referencedCount: data.referencedCount,
        references: data.references,
        message: data.message || data.error || 'Batch update completed',
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to update catalogue batch' };
    }
  };

  const analyzeVendorOnboarding = async (input: {
    vendorNameHint?: string;
    websiteUrl?: string;
    pastedText?: string;
    files?: Array<{ name: string; mimeType?: string; size?: number; sourceRole?: string; textContent?: string; base64Data?: string }>;
    columnMappingOverride?: Record<string, string>;
    forceRefresh?: boolean;
  }): Promise<{ success: boolean; analysis?: VendorOnboardingAnalysisResult; error?: string }> => {
    try {
      const res = await fetchApi('/api/vendors/onboarding/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        timeoutMs: 120000,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return {
          success: false,
          error:
            res.status === 408
              ? 'Website/document scan took too long to respond. Try pasting key details or retry once.'
              : data.error || `Onboarding analysis failed (HTTP ${res.status})`,
        };
      }
      return { success: true, analysis: data as VendorOnboardingAnalysisResult };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Network error while analysing vendor sources',
      };
    }
  };

  const getVendorCatalogueConfig = async (): Promise<VendorCatalogueConfig> => {
    try {
      const res = await fetchApi('/api/config', { timeoutMs: 10000 });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.vendorCatalogueConfig) {
        return data.vendorCatalogueConfig as VendorCatalogueConfig;
      }
    } catch {}
    return {
      maxFileSizeMb: 250,
      maxFileSizeBytes: 250 * 1024 * 1024,
      uploadChunkSizeBytes: 4 * 1024 * 1024,
      maxPagesPerPdfChunk: 20,
      allowedExtensions: ['.pdf', '.xls', '.xlsx', '.csv', '.jpg', '.jpeg', '.png', '.webp'],
      allowedFormatsLabel: 'PDF | XLS | XLSX | CSV | JPG | PNG | WEBP',
    };
  };

  const uploadCatalogueFileInChunks = async (
    file: File,
    opts?: {
      sourceRole?: string;
      chunkSizeBytes?: number;
      onProgress?: (pct: number, uploadedBytes: number, totalBytes: number) => void;
    }
  ): Promise<{ uploadId: string; fileName: string; fileSizeBytes: number; detectedFormat?: string }> => {
    const cfg = await getVendorCatalogueConfig();
    const chunkSize = opts?.chunkSizeBytes || cfg.uploadChunkSizeBytes || 4 * 1024 * 1024;
    const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));

    const initRes = await fetchApi('/api/vendors/onboarding/upload/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type || '',
        fileSizeBytes: file.size,
        totalChunks,
        sourceRole: opts?.sourceRole,
      }),
      timeoutMs: 20000,
    });
    const initData = await initRes.json().catch(() => ({}));
    if (!initRes.ok || !initData.success || !initData.uploadId) {
      throw new Error(initData.error || `Upload initialization failed (HTTP ${initRes.status})`);
    }

    const uploadId: string = initData.uploadId;
    const serverChunkSize: number = initData.chunkSizeBytes || chunkSize;
    const finalTotalChunks = Math.max(1, Math.ceil(file.size / serverChunkSize));

    let uploadedBytes = 0;
    for (let idx = 0; idx < finalTotalChunks; idx++) {
      const start = idx * serverChunkSize;
      const end = Math.min(file.size, start + serverChunkSize);
      const slice = file.slice(start, end);
      const chunkRes = await fetchApi('/api/vendors/onboarding/upload/chunk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'x-upload-id': uploadId,
          'x-chunk-index': String(idx),
          'x-total-chunks': String(finalTotalChunks),
        },
        body: slice,
        timeoutMs: 60000,
      });
      const chunkData = await chunkRes.json().catch(() => ({}));
      if (!chunkRes.ok || !chunkData.success) {
        throw new Error(chunkData.error || `Failed uploading chunk ${idx + 1}/${finalTotalChunks}`);
      }
      uploadedBytes = end;
      opts?.onProgress?.(Math.min(99, Math.round((uploadedBytes / Math.max(1, file.size)) * 100)), uploadedBytes, file.size);
    }

    const compRes = await fetchApi('/api/vendors/onboarding/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId }),
      timeoutMs: 20000,
    });
    const compData = await compRes.json().catch(() => ({}));
    if (!compRes.ok || !compData.success) {
      throw new Error(compData.error || `Upload validation failed (HTTP ${compRes.status})`);
    }
    opts?.onProgress?.(100, file.size, file.size);
    return {
      uploadId,
      fileName: compData.fileName || file.name,
      fileSizeBytes: compData.fileSizeBytes || file.size,
      detectedFormat: compData.detectedFormat,
    };
  };

  const startVendorOnboardingJob = async (input: {
    vendorNameHint?: string;
    websiteUrl?: string;
    pastedText?: string;
    files?: Array<{ uploadId?: string; name: string; mimeType?: string; size?: number; sourceRole?: string; textContent?: string; base64Data?: string }>;
    columnMappingOverride?: Record<string, string>;
    forceRefresh?: boolean;
  }): Promise<{ success: boolean; job?: VendorImportJob; error?: string }> => {
    try {
      const res = await fetchApi('/api/vendors/onboarding/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, userName: currentUser.name }),
        timeoutMs: 30000,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.job) {
        return { success: false, error: data.error || `Failed to start import job (HTTP ${res.status})` };
      }
      return { success: true, job: data.job as VendorImportJob };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error starting import job' };
    }
  };

  const pollVendorOnboardingJob = async (jobId: string): Promise<VendorImportJob | null> => {
    try {
      const res = await fetchApi(`/api/vendors/onboarding/jobs/${encodeURIComponent(jobId)}`, {
        timeoutMs: 15000,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.job) return null;
      return data.job as VendorImportJob;
    } catch {
      return null;
    }
  };

  const fetchVendorOnboardingJobResult = async (
    jobId: string
  ): Promise<{
    success: boolean;
    pending?: boolean;
    job?: VendorImportJob;
    analysis?: VendorOnboardingAnalysisResult;
    error?: string;
  }> => {
    try {
      const res = await fetchApi(`/api/vendors/onboarding/jobs/${encodeURIComponent(jobId)}/result`, {
        timeoutMs: 30000,
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 202 || data.pending) {
        return { success: false, pending: true, job: data.job };
      }
      if (!res.ok || !data.success || !data.analysis) {
        return { success: false, job: data.job, error: data.error || `Failed to load import result (HTTP ${res.status})` };
      }
      return { success: true, job: data.job, analysis: data.analysis as VendorOnboardingAnalysisResult };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error fetching import job result' };
    }
  };

  const cancelVendorOnboardingJob = async (jobId: string): Promise<boolean> => {
    try {
      const res = await fetchApi(`/api/vendors/onboarding/jobs/${encodeURIComponent(jobId)}/cancel`, {
        method: 'POST',
        timeoutMs: 10000,
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const listVendorOnboardingJobs = async (): Promise<VendorImportJob[]> => {
    try {
      const res = await fetchApi('/api/vendors/onboarding/jobs', { timeoutMs: 10000 });
      const data = await res.json().catch(() => ({}));
      return Array.isArray(data?.jobs) ? (data.jobs as VendorImportJob[]) : [];
    } catch {
      return [];
    }
  };

  const commitVendorOnboarding = async (
    payload: VendorOnboardingCommitPayload
  ): Promise<{
    success: boolean;
    verified?: boolean;
    mode?: 'CREATE' | 'UPDATE';
    vendor?: Vendor;
    createdBrandsCount?: number;
    createdCategoriesCount?: number;
    createdProductsCount?: number;
    mappingsCreatedCount?: number;
    rateHistoryRecorded?: number;
    error?: string;
  }> => {
    try {
      const res = await fetchApi('/api/vendors/onboarding/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          userName: currentUser.name,
          userRole: currentUser.role,
        }),
        timeoutMs: 45000,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.verified || !data.vendor) {
        return {
          success: false,
          error: data.error || `Failed to save vendor (HTTP ${res.status})`,
        };
      }

      const savedVendor: Vendor = data.vendor;
      if (typeof data.revision === 'number') {
        lastServerRevisionRef.current = data.revision;
      }
      markLocalWrite('vendor', savedVendor.id);
      removeTombstoneIds('erp_deleted_vendors', [savedVendor.id]);

      const nextVendorsList = vendors.some((v) => v.id === savedVendor.id)
        ? vendors.map((v) => (v.id === savedVendor.id ? savedVendor : v))
        : [savedVendor, ...vendors];

      setVendors((prev) => {
        const existsIdx = prev.findIndex((v) => v.id === savedVendor.id);
        const next =
          existsIdx !== -1
            ? prev.map((v) => (v.id === savedVendor.id ? savedVendor : v))
            : [savedVendor, ...prev];
        try {
          localStorage.setItem('erp_live_vendors', JSON.stringify(next));
          localStorage.setItem(`${activePrefix}vendors`, JSON.stringify(next));
        } catch {}
        return next;
      });

      let nextBrandsList = brands;
      if (Array.isArray(data.createdBrands) && data.createdBrands.length > 0) {
        data.createdBrands.forEach((b: any) => markLocalWrite('brand', b.id));
        removeTombstoneIds('erp_deleted_brands', data.createdBrands.map((b: any) => b.id));
        const existingBrandIds = new Set(brands.map((b) => b.id));
        nextBrandsList = [...data.createdBrands.filter((b: any) => !existingBrandIds.has(b.id)), ...brands];
        setBrands((prev) => {
          const existingIds = new Set(prev.map((b) => b.id));
          const additions = data.createdBrands.filter((b: any) => !existingIds.has(b.id));
          const next = [...additions, ...prev];
          try {
            localStorage.setItem('erp_live_brands', JSON.stringify(next));
            localStorage.setItem(`${activePrefix}brands`, JSON.stringify(next));
          } catch {}
          return next;
        });
      }

      let nextCategoriesList = categories;
      if (Array.isArray(data.createdCategories) && data.createdCategories.length > 0) {
        data.createdCategories.forEach((c: any) => markLocalWrite('category', c.id));
        removeTombstoneIds('erp_deleted_categories', data.createdCategories.map((c: any) => c.id));
        const existingCatNames = new Set(categories.map((c) => c.name.toLowerCase().trim()));
        nextCategoriesList = [
          ...data.createdCategories.filter((c: any) => !existingCatNames.has((c.name || '').toLowerCase().trim())),
          ...categories,
        ];
        setCategories((prev) => {
          const existingNames = new Set(prev.map((c) => c.name.toLowerCase().trim()));
          const additions = data.createdCategories.filter(
            (c: any) => !existingNames.has((c.name || '').toLowerCase().trim())
          );
          const next = [...additions, ...prev];
          try {
            localStorage.setItem('erp_live_categories', JSON.stringify(next));
            localStorage.setItem(`${activePrefix}categories`, JSON.stringify(next));
          } catch {}
          return next;
        });
      }

      let nextProductsList = products;
      if (Array.isArray(data.createdProducts) && data.createdProducts.length > 0) {
        data.createdProducts.forEach((p: any) => markLocalWrite('product', p.id));
        removeTombstoneIds('erp_deleted_products', data.createdProducts.map((p: any) => p.id));
        const existingProdIds = new Set(products.map((p) => p.id));
        nextProductsList = [...data.createdProducts.filter((p: any) => !existingProdIds.has(p.id)), ...products];
        setProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const additions = data.createdProducts.filter((p: any) => !existingIds.has(p.id));
          const next = [...additions, ...prev];
          try {
            localStorage.setItem('erp_live_products', JSON.stringify(next));
            localStorage.setItem(`${activePrefix}products`, JSON.stringify(next));
          } catch {}
          return next;
        });
      }

      let nextMappingsList = vendorProductMappings;
      if (Array.isArray(data.mappingsCreated) && data.mappingsCreated.length > 0) {
        data.mappingsCreated.forEach((m: any) => markLocalWrite('mapping', m.id));
        removeTombstoneIds('erp_deleted_vendor_mappings', data.mappingsCreated.map((m: any) => m.id));
        const existingMapIds = new Set(vendorProductMappings.map((m) => m.id));
        nextMappingsList = [
          ...data.mappingsCreated.filter((m: any) => !existingMapIds.has(m.id)),
          ...vendorProductMappings,
        ];
        setVendorProductMappings((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const additions = data.mappingsCreated.filter((m: any) => !existingIds.has(m.id));
          const next = [...additions, ...prev];
          try {
            localStorage.setItem('erp_live_vendor_mappings', JSON.stringify(next));
            localStorage.setItem('erp_live_vendor_products', JSON.stringify(next));
          } catch {}
          return next;
        });
      }

      const logTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
      setAiActivityLogs((prev) => [
        {
          id: `AILOG-${Date.now()}`,
          timestamp: logTimestamp,
          vendorId: savedVendor.id,
          vendorName: savedVendor.companyName,
          fileName: payload.sourcesSummary?.map((s) => s.sourceName).join(', ') || 'Vendor Onboarding',
          action: 'CATALOG_ANALYZED',
          productsCount: data.mappingsCreated?.length || 0,
          categoriesSuggested: savedVendor.materialCategories || [],
          userAction: `${data.mode === 'UPDATE' ? 'Updated' : 'Auto-onboarded'} by ${currentUser.name}`,
          confidence: savedVendor.intelligenceScore || 85,
          details: `${data.createdBrands?.length || 0} brands created, ${data.createdCategories?.length || 0} categories created, ${data.createdProducts?.length || 0} Product Master items created, ${data.mappingsCreated?.length || 0} mappings saved.`,
        },
        ...prev,
      ]);

      // Refresh authoritative state across clients

      if (broadcastRef.current) {
        broadcastRef.current.postMessage({ type: 'MUTATION', timestamp: Date.now() });
      }
      void syncBackendStateRef.current?.({ force: true, notify: false });

      pushAudit(
        data.mode === 'UPDATE' ? 'VENDOR_ONBOARDING_UPDATED' : 'VENDOR_AUTO_ONBOARDED',
        'Vendor',
        savedVendor.id,
        `${data.mode === 'UPDATE' ? 'Updated' : 'Auto-onboarded'} "${savedVendor.companyName}" with ${data.mappingsCreated?.length || 0} products & ${(savedVendor.brandsSupplied || []).length} brands.`
      );
      pushNotification(
        data.mode === 'UPDATE' ? 'Vendor Intelligence Updated' : 'Certified Supplier Auto-Onboarded',
        `${savedVendor.companyName} saved with ${data.mappingsCreated?.length || 0} products and ${(savedVendor.brandsSupplied || []).length} brands.`,
        'SUCCESS',
        ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']
      );

      return {
        success: true,
        verified: !!data.verified,
        mode: data.mode,
        vendor: savedVendor,
        createdBrandsCount: data.createdBrands?.length || 0,
        createdCategoriesCount: data.createdCategories?.length || 0,
        createdProductsCount: data.createdProducts?.length || 0,
        mappingsCreatedCount: data.mappingsCreated?.length || 0,
        rateHistoryRecorded: data.rateHistoryRecorded || 0,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Unexpected error during transactional vendor commit',
      };
    }
  };

  const addVendorProductMapping = async (
    mapping: Omit<VendorProductMapping, 'id' | 'createdAt'>
  ): Promise<VendorProductMapping> => {
    const targetVendor = vendors.find((v) => v.id === mapping.vendorId);
    const newMapping: VendorProductMapping = {
      ...mapping,
      id: `VPM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      vendorCode: targetVendor?.vendorCode || mapping.vendorCode || mapping.vendorId,
      vendorName: targetVendor?.companyName || mapping.vendorName,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    markLocalWrite('mapping', newMapping.id);
    removeTombstoneIds('erp_deleted_vendor_mappings', [newMapping.id]);
    setVendorProductMappings((prev) => {
      const next = [newMapping, ...prev];
      try {
        localStorage.setItem('erp_live_vendor_products', JSON.stringify(next));
      } catch {}
      return next;
    });

    if (newMapping.brand) {
      registerVendorBrands([newMapping.brand]);
    }

    try {
      await fetchApi('/api/vendor-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newMapping, userName: currentUser.name }),
      });
    } catch (e) {
      console.warn('Backend save mapping warning:', e);
    }

    pushAudit(
      'VENDOR_PRODUCT_MAPPED',
      'VendorProductMapping',
      newMapping.id,
      `Mapped product "${newMapping.productName}" (${newMapping.brand}) to vendor ${newMapping.vendorName}`
    );

    return newMapping;
  };

  const updateVendorProductMapping = async (mapping: VendorProductMapping): Promise<void> => {
    const updated = {
      ...mapping,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    markLocalWrite('mapping', updated.id);
    setVendorProductMappings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));

    if (updated.brand) {
      registerVendorBrands([updated.brand]);
    }

    try {
      await fetchApi(`/api/vendor-products/${encodeURIComponent(updated.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updated, userName: currentUser.name }),
      });
    } catch (e) {
      console.warn('Backend update mapping warning:', e);
    }

    pushAudit(
      'VENDOR_PRODUCT_UPDATED',
      'VendorProductMapping',
      updated.id,
      `Updated product mapping "${updated.productName}" for ${updated.vendorName}`
    );
  };

  const deleteVendorProductMapping = async (id: string): Promise<void> => {
    markLocalDelete('mapping', id);
    const updatedDeleted = addTombstoneIds('erp_deleted_vendor_mappings', [id]);
    const nextMappings = vendorProductMappings.map((m) => (m.id === id ? { ...m, status: 'INACTIVE' as const } : m));
    setVendorProductMappings(nextMappings);
    try {
      localStorage.setItem('erp_live_vendor_products', JSON.stringify(nextMappings));
    } catch {}

    try {
      await fetchApi(`/api/vendor-products/${encodeURIComponent(id)}?user=${encodeURIComponent(currentUser.name)}`, {
        method: 'DELETE',
      });
    } catch (e) {
      console.warn('Backend delete mapping warning:', e);
    }
    pushMutationToCloud({ vendorProductMappings: nextMappings, deletedVendorMappingIds: updatedDeleted });

    pushAudit('VENDOR_PRODUCT_DEACTIVATED', 'VendorProductMapping', id, `Deactivated vendor product mapping ${id}`);
  };

  const bulkAddVendorProductMappings = async (
    vendorId: string,
    mappings: Partial<VendorProductMapping>[],
    vendorOverride?: Vendor
  ): Promise<{ added: number; updated: number; skipped: number }> => {
    const targetVendor = vendorOverride || vendors.find((v) => v.id === vendorId);
    let added = 0;
    let updated = 0;

    const newMappingsList: VendorProductMapping[] = [];

    mappings.forEach((m, idx) => {
      if (!m.productName) return;
      const existing = vendorProductMappings.find(
        (ex) =>
          ex.vendorId === vendorId &&
          ex.productName.toLowerCase().trim() === m.productName?.toLowerCase().trim() &&
          (!m.brand || ex.brand.toLowerCase().trim() === m.brand?.toLowerCase().trim())
      );

      if (existing) {
        updated++;
      } else {
        added++;
        newMappingsList.push({
          id: `VPM-${Date.now()}-${idx + 1}`,
          vendorId,
          vendorCode: targetVendor?.vendorCode || vendorId,
          vendorName: targetVendor?.companyName || 'Supplier',
          productName: m.productName,
          category: m.category || 'General Industrial Spares',
          subCategory: m.subCategory || '',
          productType: m.productType || m.subCategory || '',
          brand: m.brand || 'Generic',
          modelNumber: m.modelNumber || m.partNumber || '',
          partNumber: m.partNumber || m.modelNumber || '',
          specification: m.specification || '',
          rating: m.rating || '',
          size: m.size || '',
          description: m.description || '',
          uom: m.uom || 'NOS',
          supplyType: m.supplyType || 'Authorized Distributor',
          availability: m.availability || 'Regular Stock',
          status: m.status || 'ACTIVE',
          remarks: m.remarks || 'Bulk Excel Import',
          createdAt: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString().split('T')[0],
        });
      }
    });

    if (newMappingsList.length > 0) {
      newMappingsList.forEach((m) => markLocalWrite('mapping', m.id));
      removeTombstoneIds('erp_deleted_vendor_mappings', newMappingsList.map((m) => m.id));
      setVendorProductMappings((prev) => {
        const next = [...newMappingsList, ...prev];
        try {
          localStorage.setItem('erp_live_vendor_products', JSON.stringify(next));
        } catch {}
        return next;
      });

      const brandsToRegister = Array.from(new Set(newMappingsList.map((m) => m.brand).filter(Boolean)));
      if (brandsToRegister.length > 0) {
        registerVendorBrands(brandsToRegister);
      }
    }

    try {
      await fetchApi('/api/vendor-products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId, mappings, userName: currentUser.name }),
      });
    } catch (e) {
      console.warn('Backend bulk mapping warning:', e);
    }

    pushNotification(
      'Products Imported to Vendor',
      `Imported ${added} new and updated ${updated} products for ${targetVendor?.companyName || vendorId}`,
      'SUCCESS',
      ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']
    );

    return { added, updated, skipped: 0 };
  };

  // Global Product Type Master & One-Click Vendor Linking Methods
  const addProductTypeToMaster = async (name: string, category?: string): Promise<ProductTypeMasterItem> => {
    const cleanName = (name || '').trim();
    if (!cleanName) throw new Error('Product type name cannot be empty');

    const norm = cleanName.toLowerCase();
    const existing = productTypes.find((pt) => pt.name.toLowerCase().trim() === norm);
    if (existing) return existing;

    const newPT: ProductTypeMasterItem = {
      id: `PT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`,
      name: cleanName,
      category: category || 'General',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const nextProductTypes = [...productTypes, newPT];
    setProductTypes(nextProductTypes);
    pushMutationToCloud({ productTypes: nextProductTypes });

    try {
      const res = await fetchApi('/api/product-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, category, userName: currentUser.name }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.productType) {
          const updatedPTs = nextProductTypes.map((pt) => (pt.id === newPT.id ? d.productType : pt));
          setProductTypes(updatedPTs);
          pushMutationToCloud({ productTypes: updatedPTs });
          return d.productType;
        }
      }
    } catch (e) {
      console.warn('Backend product type sync notice:', e);
    }

    return newPT;
  };

  const addProductTypeToVendor = async (
    vendorId: string,
    productTypeName: string,
    category?: string,
    brand?: string
  ): Promise<{ productType: ProductTypeMasterItem; mapping: VendorProductMapping }> => {
    const cleanName = (productTypeName || '').trim();
    if (!cleanName) throw new Error('Please enter a product type.');

    const cleanBrand = (brand || '').trim();
    const cleanCategory = (category || '').trim();
    const targetVendor = vendors.find((v) => v.id === vendorId);
    if (!targetVendor) throw new Error(`Vendor ${vendorId} not found.`);

    const normName = cleanName.toLowerCase();
    const normBrand = cleanBrand.toLowerCase();

    // Prevent duplicate associations
    const isAlreadyAdded = vendorProductMappings.some(
      (m) =>
        m.vendorId === vendorId &&
        m.status !== 'INACTIVE' &&
        (m.productName || m.productType || '').trim().toLowerCase() === normName &&
        ((!cleanBrand && (!m.brand || m.brand === 'Generic')) ||
          (cleanBrand && (m.brand || '').trim().toLowerCase() === normBrand))
    );

    if (isAlreadyAdded) {
      throw new Error(`"${cleanName}" is already added to ${targetVendor.companyName}${cleanBrand ? ` under brand "${cleanBrand}"` : ''}.`);
    }

    // 1. Ensure product type exists in local Product Type Master immediately
    let matchedPT = productTypes.find((pt) => pt.name.toLowerCase().trim() === normName);
    if (!matchedPT) {
      matchedPT = {
        id: `PT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`,
        name: cleanName,
        category: cleanCategory || 'General',
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      setProductTypes((prev) => [...prev, matchedPT!]);
    }

    // 2. Create local mapping immediately for snappy UI
    const tempMappingId = `VPM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newMapping: VendorProductMapping = {
      id: tempMappingId,
      vendorId,
      vendorCode: targetVendor.vendorCode || vendorId,
      vendorName: targetVendor.companyName,
      productName: cleanName,
      productType: cleanName,
      category: cleanCategory || matchedPT.category || 'General',
      brand: cleanBrand || 'Generic',
      uom: 'NOS',
      supplyType: 'Authorized Distributor',
      availability: 'Regular Stock',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setVendorProductMappings((prev) => [newMapping, ...prev]);

    // Update vendor in memory
    setVendors((prev) =>
      prev.map((v) => {
        if (v.id !== vendorId) return v;
        const nextProducts = [newMapping, ...(v.productsSupplied || [])];
        const nextBrands = cleanBrand && !(v.brandsSupplied || []).some((b) => b.toLowerCase().trim() === normBrand)
          ? [...(v.brandsSupplied || []), cleanBrand]
          : v.brandsSupplied || [];
        const nextCats = cleanCategory && !(v.materialCategories || []).some((c) => c.toLowerCase().trim() === cleanCategory.toLowerCase())
          ? [...(v.materialCategories || []), cleanCategory]
          : v.materialCategories || [];
        return {
          ...v,
          productsSupplied: nextProducts,
          brandsSupplied: nextBrands,
          materialCategories: nextCats,
        };
      })
    );

    if (cleanBrand) {
      registerVendorBrands([cleanBrand]);
    }

    // 3. Persist to real backend database via One-Click API
    try {
      const res = await fetchApi('/api/vendor-product-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId,
          productTypeName: cleanName,
          category: cleanCategory || undefined,
          brand: cleanBrand || undefined,
          userName: currentUser.name,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to save product type to database.');
      }

      const data = await res.json();
      if (data.mapping) {
        setVendorProductMappings((prev) =>
          prev.map((m) => (m.id === tempMappingId ? data.mapping : m))
        );
      }
      if (data.productType) {
        setProductTypes((prev) => {
          const idx = prev.findIndex((pt) => pt.name.toLowerCase().trim() === normName);
          if (idx !== -1) {
            const copy = [...prev];
            copy[idx] = data.productType;
            return copy;
          }
          return [...prev, data.productType];
        });
      }

      pushAudit(
        'VENDOR_PRODUCT_MAPPED',
        'VendorMaster',
        data.mapping?.id || tempMappingId,
        `Mapped product type "${cleanName}" (${cleanBrand || 'No Brand'}) to vendor ${targetVendor.companyName}`
      );

      return {
        productType: data.productType || matchedPT,
        mapping: data.mapping || newMapping,
      };
    } catch (err: any) {
      console.error('Error in addProductTypeToVendor:', err);
      // Rollback on failure
      setVendorProductMappings((prev) => prev.filter((m) => m.id !== tempMappingId));
      throw err;
    }
  };

  const removeProductTypeFromVendor = async (mappingId: string): Promise<void> => {
    const targetMapping = vendorProductMappings.find((m) => m.id === mappingId);
    if (!targetMapping) return;

    // Remove from local vendor mappings
    setVendorProductMappings((prev) => prev.filter((m) => m.id !== mappingId));

    // Remove from vendor's productsSupplied
    setVendors((prev) =>
      prev.map((v) => {
        if (v.id === targetMapping.vendorId && Array.isArray(v.productsSupplied)) {
          return {
            ...v,
            productsSupplied: v.productsSupplied.filter((p) => p.id !== mappingId),
          };
        }
        return v;
      })
    );

    // Call backend DELETE endpoint
    try {
      await fetchApi(
        `/api/vendor-products/${encodeURIComponent(mappingId)}?user=${encodeURIComponent(currentUser.name)}`,
        { method: 'DELETE' }
      );
    } catch (e) {
      console.warn('Backend delete mapping warning:', e);
    }

    pushAudit(
      'VENDOR_PRODUCT_UNMAPPED',
      'VendorMaster',
      mappingId,
      `Removed product type "${targetMapping.productName}" from vendor ${targetMapping.vendorName} (global master preserved)`
    );
  };

  // Automated Cloud Backup & Recovery Methods
  const triggerManualBackup = (): BackupRecord => {
    try {
      const bkp = createBackupSnapshot({
        vendors,
        categories,
        requirements,
        quotations: customerQuotations,
        customerPOs,
        vendorPOs,
        auditLogs,
        documents,
      }, 'MANUAL');
      setBackups(getSavedBackups());
      setBackupSettings(getBackupSettings());
      setBackupFailureAlert(null);
      pushAudit('BACKUP_CREATED', 'BackupRecord', bkp.id, `Manual cloud backup snapshot created (${bkp.sizeFormatted})`);
      pushNotification('Cloud Backup Successful', `Application snapshot ${bkp.id} backed up securely (${bkp.sizeFormatted}).`, 'SUCCESS', ['SUPER_ADMIN']);
      return bkp;
    } catch (err: any) {
      setBackupFailureAlert({
        timestamp: new Date().toISOString(),
        error: err?.message || 'Manual backup generation failed',
      });
      pushNotification('Backup Failed', 'Your latest data could not be backed up. Please check storage capacity.', 'WARNING', ['SUPER_ADMIN']);
      throw err;
    }
  };

  const updateBackupSettingsState = (newSettings: Partial<BackupSettings>) => {
    const updated = { ...backupSettings, ...newSettings };
    setBackupSettings(updated);
    localStorage.setItem('mro_backup_settings_v1', JSON.stringify(updated));
    pushAudit('BACKUP_SETTINGS_UPDATED', 'Settings', 'BackupConfig', 'Updated automated backup schedule configuration');
  };

  const restoreFromBackupRecord = (backupId: string): boolean => {
    const target = backups.find((b) => b.id === backupId);
    if (!target || !target.dataSnapshot) return false;

    try {
      const parsed = JSON.parse(target.dataSnapshot);
      if (parsed.vendors) setVendors(parsed.vendors);
      if (parsed.categories) setCategories(parsed.categories);
      if (parsed.requirements) setRequirements(parsed.requirements);
      if (parsed.quotations) setCustomerQuotations(parsed.quotations);
      if (parsed.customerPOs) setCustomerPOs(parsed.customerPOs);
      if (parsed.vendorPOs) setVendorPOs(parsed.vendorPOs);
      if (parsed.auditLogs) setAuditLogs(parsed.auditLogs);
      if (parsed.documents) setDocuments(parsed.documents);

      pushAudit('DATA_RESTORED', 'BackupRecord', backupId, `Restored full system state from backup snapshot ${target.versionLabel}`);
      pushNotification('System Restored', `All application data restored successfully from ${target.versionLabel}.`, 'SUCCESS', ['SUPER_ADMIN']);
      return true;
    } catch (err: any) {
      console.error('Failed to restore from backup', err);
      pushNotification('Restore Failed', `Could not parse backup snapshot: ${err.message}`, 'WARNING', ['SUPER_ADMIN']);
      return false;
    }
  };

  const testBackupRecord = (backupId: string) => {
    const target = backups.find((b) => b.id === backupId);
    if (!target) return { valid: false, message: 'Backup record not found', details: {} };
    return testBackupIntegrity(target);
  };

  const clearBackupFailureAlert = () => {
    clearBackupFailure();
    setBackupFailureAlert(null);
  };

  // Dual-mode Engine Actions
  const setDataMode = (newMode: DataMode) => {
    if (newMode === dataMode) return;

    // 1. Flush and save current memory state to current mode
    const curPrefix = getStoragePrefix(dataMode);
    localStorage.setItem(`${curPrefix}customers`, JSON.stringify(customers));
    localStorage.setItem(`${curPrefix}vendors`, JSON.stringify(vendors));
    localStorage.setItem(`${curPrefix}products`, JSON.stringify(products));
    localStorage.setItem(`${curPrefix}requirements`, JSON.stringify(requirements));
    localStorage.setItem(`${curPrefix}quotations`, JSON.stringify(customerQuotations));
    localStorage.setItem(`${curPrefix}customer_pos`, JSON.stringify(customerPOs));
    localStorage.setItem(`${curPrefix}vendor_pos`, JSON.stringify(vendorPOs));
    localStorage.setItem(`${curPrefix}proforma_invoices`, JSON.stringify(proformaInvoices));
    localStorage.setItem(`${curPrefix}payments`, JSON.stringify(payments));
    localStorage.setItem(`${curPrefix}dispatches`, JSON.stringify(dispatches));
    localStorage.setItem(`${curPrefix}deliveries`, JSON.stringify(deliveries));
    localStorage.setItem(`${curPrefix}rfqs`, JSON.stringify(rfqs));
    localStorage.setItem(`${curPrefix}vendor_quotes`, JSON.stringify(vendorQuotes));

    // 2. Hydrate target mode
    const targetCust = loadCollection('customers', newMode, newMode === 'LOCAL_BUSINESS' ? INITIAL_LOCAL_CUSTOMERS : INITIAL_CUSTOMERS);
    const targetVend = loadCollection('vendors', newMode, newMode === 'LOCAL_BUSINESS' ? INITIAL_LOCAL_VENDORS : INITIAL_VENDORS);
    const targetProd = loadCollection('products', newMode, INITIAL_PRODUCTS);
    const targetReqs = loadCollection(
      'requirements',
      newMode,
      newMode === 'LOCAL_BUSINESS' ? [] : [INITIAL_REQUIREMENT_001, INITIAL_REQUIREMENT_002, INITIAL_REQUIREMENT_003, INITIAL_REQUIREMENT_004]
    );
    const targetRfqs = loadCollection('rfqs', newMode, newMode === 'LOCAL_BUSINESS' ? [] : [INITIAL_RFQ_001, INITIAL_RFQ_002, INITIAL_RFQ_003]);
    const targetVq = loadCollection(
      'vendor_quotes',
      newMode,
      newMode === 'LOCAL_BUSINESS' ? [] : [...INITIAL_VENDOR_QUOTES_001, ...INITIAL_VENDOR_QUOTES_002, ...INITIAL_VENDOR_QUOTES_003]
    );
    const targetQtns = loadCollection('quotations', newMode, newMode === 'LOCAL_BUSINESS' ? [] : [INITIAL_CUSTOMER_QUOTATION_001, INITIAL_CUSTOMER_QUOTATION_002]);
    const targetCpo = loadCollection('customer_pos', newMode, newMode === 'LOCAL_BUSINESS' ? [] : [INITIAL_CUSTOMER_PO_001, INITIAL_CUSTOMER_PO_002]);
    const targetVpo = loadCollection('vendor_pos', newMode, newMode === 'LOCAL_BUSINESS' ? [] : [INITIAL_VENDOR_PO_001, INITIAL_VENDOR_PO_002]);
    const targetPi = loadCollection('proforma_invoices', newMode, newMode === 'LOCAL_BUSINESS' ? [] : [INITIAL_PROFORMA_INVOICE_001, INITIAL_PROFORMA_INVOICE_002]);
    const targetPay = loadCollection('payments', newMode, newMode === 'LOCAL_BUSINESS' ? [] : [INITIAL_PAYMENT_001, INITIAL_PAYMENT_002]);
    const targetDsp = loadCollection('dispatches', newMode, newMode === 'LOCAL_BUSINESS' ? [] : [INITIAL_DISPATCH_001, INITIAL_DISPATCH_002]);
    const targetDel = loadCollection('deliveries', newMode, newMode === 'LOCAL_BUSINESS' ? [] : [INITIAL_DELIVERY_001, INITIAL_DELIVERY_002]);

    setCustomers(targetCust);
    setVendors(targetVend);
    setProducts(targetProd);
    setRequirements(targetReqs);
    setRfqs(targetRfqs);
    setVendorQuotes(targetVq);
    setCustomerQuotations(targetQtns);
    setCustomerPOs(targetCpo);
    setVendorPOs(targetVpo);
    setProformaInvoices(targetPi);
    setPayments(targetPay);
    setDispatches(targetDsp);
    setDeliveries(targetDel);

    setDataModeState(newMode);
    localStorage.setItem('mro_active_data_mode', newMode);

    pushNotification(
      'Data Mode Switched',
      newMode === 'LOCAL_BUSINESS'
        ? 'Switched to My Local Business Mode. All entries are saved locally on your device.'
        : 'Switched to Demo Sandbox Mode with mock industrial pipeline.',
      'INFO',
      ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE', 'ACCOUNTS_USER']
    );
    pushAudit('DATA_MODE_CHANGED', 'System', newMode, `Switched storage engine to ${newMode}`);
  };

  const copyDemoToLocalBusiness = () => {
    setCustomers(INITIAL_CUSTOMERS);
    setVendors(INITIAL_VENDORS);
    setProducts(INITIAL_PRODUCTS);
    setRequirements([INITIAL_REQUIREMENT_001, INITIAL_REQUIREMENT_002, INITIAL_REQUIREMENT_003, INITIAL_REQUIREMENT_004]);
    setRfqs([INITIAL_RFQ_001, INITIAL_RFQ_002, INITIAL_RFQ_003]);
    setVendorQuotes([...INITIAL_VENDOR_QUOTES_001, ...INITIAL_VENDOR_QUOTES_002, ...INITIAL_VENDOR_QUOTES_003]);
    setCustomerQuotations([INITIAL_CUSTOMER_QUOTATION_001, INITIAL_CUSTOMER_QUOTATION_002]);
    setCustomerPOs([INITIAL_CUSTOMER_PO_001, INITIAL_CUSTOMER_PO_002]);
    setVendorPOs([INITIAL_VENDOR_PO_001, INITIAL_VENDOR_PO_002]);
    setProformaInvoices([INITIAL_PROFORMA_INVOICE_001, INITIAL_PROFORMA_INVOICE_002]);
    setPayments([INITIAL_PAYMENT_001, INITIAL_PAYMENT_002]);
    setDispatches([INITIAL_DISPATCH_001, INITIAL_DISPATCH_002]);
    setDeliveries([INITIAL_DELIVERY_001, INITIAL_DELIVERY_002]);

    pushNotification('Demo Seeded to Local', 'Demo customer and vendor catalog copied into your private local workspace.', 'SUCCESS', ['SUPER_ADMIN']);
    pushAudit('DATA_CLONED', 'System', 'LOCAL_BUSINESS', 'Copied demo catalog into local business workspace');
  };

  const resetCurrentModeData = () => {
    if (dataMode === 'LOCAL_BUSINESS') {
      setCustomers(INITIAL_LOCAL_CUSTOMERS);
      setVendors(INITIAL_LOCAL_VENDORS);
      setProducts(INITIAL_PRODUCTS);
      setRequirements([]);
      setRfqs([]);
      setVendorQuotes([]);
      setCustomerQuotations([]);
      setCustomerPOs([]);
      setVendorPOs([]);
      setProformaInvoices([]);
      setPayments([]);
      setDispatches([]);
      setDeliveries([]);
    } else {
      setCustomers(INITIAL_CUSTOMERS);
      setVendors(INITIAL_VENDORS);
      setProducts(INITIAL_PRODUCTS);
      setRequirements([INITIAL_REQUIREMENT_001, INITIAL_REQUIREMENT_002, INITIAL_REQUIREMENT_003, INITIAL_REQUIREMENT_004]);
      setRfqs([INITIAL_RFQ_001, INITIAL_RFQ_002, INITIAL_RFQ_003]);
      setVendorQuotes([...INITIAL_VENDOR_QUOTES_001, ...INITIAL_VENDOR_QUOTES_002, ...INITIAL_VENDOR_QUOTES_003]);
      setCustomerQuotations([INITIAL_CUSTOMER_QUOTATION_001, INITIAL_CUSTOMER_QUOTATION_002]);
      setCustomerPOs([INITIAL_CUSTOMER_PO_001, INITIAL_CUSTOMER_PO_002]);
      setVendorPOs([INITIAL_VENDOR_PO_001, INITIAL_VENDOR_PO_002]);
      setProformaInvoices([INITIAL_PROFORMA_INVOICE_001, INITIAL_PROFORMA_INVOICE_002]);
      setPayments([INITIAL_PAYMENT_001, INITIAL_PAYMENT_002]);
      setDispatches([INITIAL_DISPATCH_001, INITIAL_DISPATCH_002]);
      setDeliveries([INITIAL_DELIVERY_001, INITIAL_DELIVERY_002]);
    }
    pushNotification('Workspace Reset', `Active records in ${dataMode === 'LOCAL_BUSINESS' ? 'Local Business' : 'Demo Sandbox'} reset to defaults.`, 'WARNING', ['SUPER_ADMIN']);
    pushAudit('DATA_RESET', 'System', dataMode, `Reset active dataset in ${dataMode}`);
  };

  const exportFullBackup = () => {
    const backup = {
      app: 'ProcureMRO Supply Chain ERP',
      version: '2.6',
      exportedAt: new Date().toISOString(),
      mode: dataMode,
      data: {
        customers,
        vendors,
        products,
        requirements,
        rfqs,
        vendorQuotes,
        customerQuotations,
        customerPOs,
        vendorPOs,
        proformaInvoices,
        payments,
        dispatches,
        deliveries,
      },
    };
    import('../services/dataExportService').then(({ exportDataToJSON }) => {
      exportDataToJSON(backup, `ProcureMRO_Database_Backup_${dataMode}_${new Date().toISOString().split('T')[0]}.json`);
    });
    pushAudit('BACKUP_EXPORTED', 'System', dataMode, `Full JSON database backup downloaded for ${dataMode}`);
  };

  const restoreFullBackup = (jsonContent: string): boolean => {
    try {
      const parsed = JSON.parse(jsonContent);
      const d = parsed.data || parsed;
      if (d.customers && Array.isArray(d.customers)) setCustomers(d.customers);
      if (d.vendors && Array.isArray(d.vendors)) setVendors(d.vendors);
      if (d.products && Array.isArray(d.products)) setProducts(d.products);
      if (d.requirements && Array.isArray(d.requirements)) setRequirements(d.requirements);
      if (d.rfqs && Array.isArray(d.rfqs)) setRfqs(d.rfqs);
      if (d.vendorQuotes && Array.isArray(d.vendorQuotes)) setVendorQuotes(d.vendorQuotes);
      if (d.customerQuotations && Array.isArray(d.customerQuotations)) setCustomerQuotations(d.customerQuotations);
      if (d.customerPOs && Array.isArray(d.customerPOs)) setCustomerPOs(d.customerPOs);
      if (d.vendorPOs && Array.isArray(d.vendorPOs)) setVendorPOs(d.vendorPOs);
      if (d.proformaInvoices && Array.isArray(d.proformaInvoices)) setProformaInvoices(d.proformaInvoices);
      if (d.payments && Array.isArray(d.payments)) setPayments(d.payments);
      if (d.dispatches && Array.isArray(d.dispatches)) setDispatches(d.dispatches);
      if (d.deliveries && Array.isArray(d.deliveries)) setDeliveries(d.deliveries);

      pushNotification('Backup Restored', 'Full dataset successfully restored into current workspace.', 'SUCCESS', ['SUPER_ADMIN']);
      pushAudit('BACKUP_RESTORED', 'System', dataMode, 'Restored database from JSON backup file');
      return true;
    } catch (err) {
      console.error('Failed to parse backup JSON:', err);
      return false;
    }
  };

  // Company Master Operations
  const addCompany = (compData: Omit<Company, 'id' | 'createdAt' | 'companyCode'>): Company => {
    const newId = nextSequenceId('CMP', companies, 'erp_deleted_companies');
    const newComp: Company = {
      ...compData,
      id: newId,
      companyCode: newId,
      status: compData.status || 'ACTIVE',
      createdAt: new Date().toISOString().split('T')[0],
    };
    markLocalWrite('company', newId);
    markLocalWrite('customer', newId);
    const updatedDeletedComps = removeTombstoneIds('erp_deleted_companies', [newId]);
    const updatedDeletedCusts = removeTombstoneIds('erp_deleted_customers', [newId]);
    const nextComps = [newComp, ...companies];
    setCompanies(nextComps);

    // Mirror to customers list for unified backwards compatibility
    const mirrorCust: Customer = {
      id: newId,
      companyName: newComp.companyName,
      contactPerson: newComp.contactPerson || 'Purchase Incharge',
      mobile: newComp.mobile || '',
      email: newComp.email || '',
      address: newComp.address || '',
      city: newComp.city || '',
      state: newComp.state || '',
      pincode: newComp.pincode || '',
      gstin: newComp.gstin || '',
      pan: newComp.pan || '',
      paymentTerms: newComp.paymentTerms || '30 Days Net',
      deliveryAddress: newComp.deliveryAddress || newComp.address || '',
      remarks: newComp.remarks,
      status: newComp.status,
      companyCode: newId,
      createdAt: newComp.createdAt,
    };
    const nextCusts = customers.some((c) => c.id === newId) ? customers : [mirrorCust, ...customers];
    setCustomers(nextCusts);
    try {
      localStorage.setItem('erp_live_companies', JSON.stringify(nextComps));
      localStorage.setItem('erp_live_customers', JSON.stringify(nextCusts));
    } catch {}

    fetchApi('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newComp),
    }).catch(() => {});
    pushMutationToCloud({
      companies: nextComps,
      customers: nextCusts,
      deletedCompanyIds: updatedDeletedComps,
      deletedCustomerIds: updatedDeletedCusts,
    });

    pushAudit('COMPANY_CREATED', 'Company', newId, `Company ${newComp.companyName} registered with code ${newId}`);
    return newComp;
  };

  const updateCompany = (updated: Company) => {
    markLocalWrite('company', updated.id);
    markLocalWrite('customer', updated.id);
    const nextComps = companies.map((c) => (c.id === updated.id ? updated : c));
    const nextCusts = customers.map((c) =>
      c.id === updated.id
        ? {
            ...c,
            companyName: updated.companyName,
            address: updated.address,
            city: updated.city,
            state: updated.state,
            pincode: updated.pincode,
            gstin: updated.gstin,
            remarks: updated.remarks,
            status: updated.status,
          }
        : c
    );
    const nextExecs = purchaseExecutives.map((pe) =>
      pe.companyId === updated.id ? { ...pe, companyName: updated.companyName } : pe
    );
    setCompanies(nextComps);
    setCustomers(nextCusts);
    setPurchaseExecutives(nextExecs);
    try {
      localStorage.setItem('erp_live_companies', JSON.stringify(nextComps));
      localStorage.setItem('erp_live_customers', JSON.stringify(nextCusts));
      localStorage.setItem('erp_live_purchase_executives', JSON.stringify(nextExecs));
    } catch {}

    fetchApi('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {});
    pushMutationToCloud({
      companies: nextComps,
      customers: nextCusts,
      purchaseExecutives: nextExecs,
    });

    pushAudit('COMPANY_UPDATED', 'Company', updated.id, `Updated company ${updated.companyName}`);
  };

  const deleteCompany = (id: string): { success: boolean; message: string } => {
    const comp = companies.find((c) => c.id === id);
    if (!comp) return { success: false, message: 'Company not found' };

    const isAdmin = isSuperAdminUser(currentUser);
    const linkedReqs = requirements.filter((r) => r.companyId === id || r.customerId === id);
    if (linkedReqs.length > 0 && !isAdmin) {
      updateCompany({ ...comp, status: 'INACTIVE' });
      return {
        success: true,
        message: `Company "${comp.companyName}" has ${linkedReqs.length} linked requirement(s). Status set to INACTIVE for audit integrity.`,
      };
    }

    markLocalDelete('company', id);
    markLocalDelete('customer', id);
    const updatedDeletedComps = addTombstoneIds('erp_deleted_companies', [id]);
    const updatedDeletedCusts = addTombstoneIds('erp_deleted_customers', [id]);
    const nextComps = companies.filter((c) => c.id !== id);
    const nextCusts = customers.filter((c) => c.id !== id);
    setCompanies(nextComps);
    setCustomers(nextCusts);
    try {
      localStorage.setItem('erp_live_companies', JSON.stringify(nextComps));
      localStorage.setItem('erp_live_customers', JSON.stringify(nextCusts));
    } catch {}

    fetchApi(`/api/companies/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    pushMutationToCloud({
      companies: nextComps,
      customers: nextCusts,
      deletedCompanyIds: updatedDeletedComps,
      deletedCustomerIds: updatedDeletedCusts,
    });

    pushAudit('COMPANY_DELETED', 'Company', id, `Removed company ${comp.companyName}`);
    return { success: true, message: `Company "${comp.companyName}" removed successfully.` };
  };

  // Purchase Executive Master Operations
  const addPurchaseExecutive = (execData: Omit<PurchaseExecutive, 'id' | 'createdAt'>): PurchaseExecutive => {
    const newId = nextSequenceId('PE', purchaseExecutives, 'erp_deleted_purchase_executives');
    const targetComp = companies.find((c) => c.id === execData.companyId);
    const newExec: PurchaseExecutive = {
      ...execData,
      id: newId,
      companyName: targetComp?.companyName || execData.companyName,
      status: execData.status || 'ACTIVE',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };
    markLocalWrite('purchaseExecutive', newId);
    const updatedDeleted = removeTombstoneIds('erp_deleted_purchase_executives', [newId]);
    const nextExecs = [newExec, ...purchaseExecutives];
    setPurchaseExecutives(nextExecs);
    try {
      localStorage.setItem('erp_live_purchase_executives', JSON.stringify(nextExecs));
    } catch {}

    fetchApi('/api/purchase-executives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newExec),
    }).catch(() => {});
    pushMutationToCloud({
      purchaseExecutives: nextExecs,
      deletedPurchaseExecutiveIds: updatedDeleted,
    });

    pushAudit(
      'PURCHASE_EXECUTIVE_CREATED',
      'PurchaseExecutive',
      newId,
      `Added ${newExec.name} (${newExec.designation}) for ${newExec.companyName}`
    );
    return newExec;
  };

  const updatePurchaseExecutive = (updated: PurchaseExecutive) => {
    markLocalWrite('purchaseExecutive', updated.id);
    const updatedExec = { ...updated, updatedAt: new Date().toISOString().split('T')[0] };
    const nextExecs = purchaseExecutives.map((e) => (e.id === updated.id ? updatedExec : e));
    setPurchaseExecutives(nextExecs);
    try {
      localStorage.setItem('erp_live_purchase_executives', JSON.stringify(nextExecs));
    } catch {}

    fetchApi('/api/purchase-executives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedExec),
    }).catch(() => {});
    pushMutationToCloud({ purchaseExecutives: nextExecs });

    pushAudit('PURCHASE_EXECUTIVE_UPDATED', 'PurchaseExecutive', updated.id, `Updated ${updated.name} for ${updated.companyName}`);
  };

  const deletePurchaseExecutive = (id: string): { success: boolean; message: string } => {
    const exec = purchaseExecutives.find((e) => e.id === id);
    if (!exec) return { success: false, message: 'Executive not found' };

    const isAdmin = isSuperAdminUser(currentUser);
    const linkedReqs = requirements.filter((r) => r.purchaseExecutiveId === id);
    if (linkedReqs.length > 0 && !isAdmin) {
      updatePurchaseExecutive({ ...exec, status: 'INACTIVE' });
      return {
        success: true,
        message: `Executive "${exec.name}" has ${linkedReqs.length} linked requirement(s). Status set to INACTIVE to preserve audit trail.`,
      };
    }

    markLocalDelete('purchaseExecutive', id);
    const updatedDeleted = addTombstoneIds('erp_deleted_purchase_executives', [id]);
    const nextExecs = purchaseExecutives.filter((e) => e.id !== id);
    setPurchaseExecutives(nextExecs);
    try {
      localStorage.setItem('erp_live_purchase_executives', JSON.stringify(nextExecs));
    } catch {}

    fetchApi(`/api/purchase-executives/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    pushMutationToCloud({ purchaseExecutives: nextExecs, deletedPurchaseExecutiveIds: updatedDeleted });
    pushAudit('PURCHASE_EXECUTIVE_DELETED', 'PurchaseExecutive', id, `Removed executive ${exec.name}`);
    return { success: true, message: `Executive "${exec.name}" removed.` };
  };

  const getExecutivesByCompany = (companyId: string): PurchaseExecutive[] => {
    return purchaseExecutives.filter((e) => e.companyId === companyId);
  };

  // Add Requirement with Atomic Sequence ID & Permanent Cloud Persistence
  const addRequirement = (reqData: {
    customerId: string;
    customerName: string;
    contactPerson: string;
    customerEmail: string;
    customerMobile: string;
    requirementDate: string;
    requiredDeliveryDate: string;
    receivedRequirementDate?: string;
    expectedDeliveryDate?: string;
    priority?: 'High' | 'Medium' | 'Low';
    items: Omit<RequirementItem, 'id'>[];
    remarks?: string;
    companyId?: string;
    companyName?: string;
    companyCode?: string;
    purchaseExecutiveId?: string;
    purchaseExecutiveName?: string;
    purchaseExecutiveDesignation?: string;
    purchaseExecutiveMobile?: string;
    purchaseExecutiveEmail?: string;
    rfqNumber?: string;
    requirementSource?: 'Email' | 'WhatsApp' | 'Phone' | 'Manual' | 'Other' | string;
    referenceNumber?: string;
  }): CustomerRequirement => {
    const year = new Date().getFullYear();

    // Scan all existing requirement IDs, RFQ numbers, and tombstones to find the true maximum sequence
    let maxSeq = 0;
    const allSeen: any[] = [...requirements, ...rfqs];
    try {
      const lsReq = localStorage.getItem('erp_live_requirements');
      if (lsReq) {
        const parsed = JSON.parse(lsReq);
        if (Array.isArray(parsed)) allSeen.push(...parsed);
      }
      const lsRfq = localStorage.getItem('erp_live_rfqs');
      if (lsRfq) {
        const parsed = JSON.parse(lsRfq);
        if (Array.isArray(parsed)) allSeen.push(...parsed);
      }
      const lsDel = localStorage.getItem('erp_deleted_requirements');
      if (lsDel) {
        const parsed = JSON.parse(lsDel);
        if (Array.isArray(parsed)) {
          parsed.forEach((tid: string) => allSeen.push({ id: tid, rfqNumber: tid }));
        }
      }
    } catch {}

    const reqId = generateCollisionSafeYearlyId('REQ', year, allSeen, readTombstoneList('erp_deleted_requirements'));
    const generatedRfqNumber =
      reqData.rfqNumber && reqData.rfqNumber.trim() !== ''
        ? reqData.rfqNumber.trim()
        : reqId.replace(/^REQ-/i, 'RFQ-');

    // Untombstone reqId and generatedRfqNumber from local storage immediately so background sync never suppresses it
    let updatedTombstones: string[] = [];
    try {
      const stored = localStorage.getItem('erp_deleted_requirements');
      if (stored) {
        const list: string[] = JSON.parse(stored);
        updatedTombstones = list.filter((tid) => tid !== reqId && tid !== generatedRfqNumber);
        localStorage.setItem('erp_deleted_requirements', JSON.stringify(updatedTombstones));
      }
    } catch {}

    const targetCompanyId = reqData.companyId || reqData.customerId;
    const targetCompanyName = reqData.companyName || reqData.customerName;

    // Resolve executive info
    let execName = reqData.purchaseExecutiveName;
    let execDesig = reqData.purchaseExecutiveDesignation;
    let execMobile = reqData.purchaseExecutiveMobile;
    let execEmail = reqData.purchaseExecutiveEmail;

    if (reqData.purchaseExecutiveId) {
      const matched = purchaseExecutives.find((pe) => pe.id === reqData.purchaseExecutiveId);
      if (matched) {
        execName = matched.name;
        execDesig = matched.designation;
        execMobile = matched.mobile;
        execEmail = matched.email;
      }
    }

    const itemsWithIds: RequirementItem[] = reqData.items.map((item, idx) => ({
      ...item,
      id: `ITEM-${reqId.replace(/^REQ-/i, '')}-${String.fromCharCode(65 + idx)}`,
      purchaseExecutiveId: item.purchaseExecutiveId || reqData.purchaseExecutiveId,
      purchaseExecutiveName: item.purchaseExecutiveName || execName,
      purchaseExecutiveDesignation: item.purchaseExecutiveDesignation || execDesig,
    }));

    const nowIso = new Date().toISOString();
    const newReq: CustomerRequirement = {
      id: reqId,
      customerId: targetCompanyId,
      customerName: targetCompanyName,
      companyId: targetCompanyId,
      companyName: targetCompanyName,
      companyCode: reqData.companyCode || targetCompanyId,
      purchaseExecutiveId: reqData.purchaseExecutiveId,
      purchaseExecutiveName: execName || reqData.contactPerson,
      purchaseExecutiveDesignation: execDesig || 'Purchase Executive',
      purchaseExecutiveMobile: execMobile || reqData.customerMobile,
      purchaseExecutiveEmail: execEmail || reqData.customerEmail,
      rfqNumber: generatedRfqNumber,
      requirementSource: reqData.requirementSource || 'Email',
      referenceNumber: reqData.referenceNumber,
      contactPerson: execName || reqData.contactPerson,
      customerEmail: execEmail || reqData.customerEmail,
      customerMobile: execMobile || reqData.customerMobile,
      requirementDate: reqData.requirementDate || reqData.receivedRequirementDate || nowIso.split('T')[0],
      requiredDeliveryDate: reqData.requiredDeliveryDate || reqData.receivedRequirementDate || nowIso.split('T')[0],
      receivedRequirementDate: reqData.receivedRequirementDate || reqData.requirementDate || nowIso.split('T')[0],
      expectedDeliveryDate: reqData.expectedDeliveryDate,
      priority: reqData.priority || 'Medium',
      items: itemsWithIds,
      attachments: [
        {
          name: `Indent_Doc_${reqId}.pdf`,
          type: 'PDF',
          size: '1.2 MB',
          url: '#',
          uploadedAt: 'Just now',
        },
      ],
      status: 'NEW_REQUIREMENT',
      createdBy: currentUser.name,
      createdAt: nowIso,
      lastModifiedAt: nowIso,
      lastModifiedBy: currentUser.name,
      isDeleted: false,
      dbSaveStatus: 'COMMITTED',
      cloudSyncStatus: 'SYNCED',
      remarks: reqData.remarks,
    };

    const nextReqs = [newReq, ...requirements.filter((r) => r.id !== reqId && r.rfqNumber !== generatedRfqNumber)];
    setRequirements(nextReqs);

    try {
      localStorage.setItem('erp_live_requirements', JSON.stringify(nextReqs));
      localStorage.setItem(`${activePrefix}requirements`, JSON.stringify(nextReqs));
    } catch {}

    // Persist new requirement to authoritative backend database immediately
    fetchApi('/api/requirements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newReq, createdBy: currentUser.name, userRole: currentUser.role }),
    }).catch((err) => console.warn('[API] Add requirement sync warning:', err));

    pushMutationToCloud({
      requirements: nextReqs,
      deletedRequirementIds: updatedTombstones,
    });

    pushAudit(
      'REQUIREMENT_CREATED',
      'CustomerRequirement',
      reqId,
      `New requirement ${reqId} (${generatedRfqNumber}) permanently saved for ${targetCompanyName} by ${execName || reqData.contactPerson} (${itemsWithIds.length} items)`
    );
    pushNotification(
      'New Requirement Logged',
      `${targetCompanyName} (${execName || reqData.contactPerson}) submitted ${reqId}. Saved to database successfully.`,
      'SUCCESS',
      ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE'],
      'requirements',
      reqId
    );

    return newReq;
  };

  const updateRequirement = (updated: CustomerRequirement) => {
    const nowIso = new Date().toISOString();
    const cleanUpdated: CustomerRequirement = {
      ...updated,
      lastModifiedAt: nowIso,
      lastModifiedBy: currentUser.name,
      dbSaveStatus: 'COMMITTED',
      cloudSyncStatus: 'SYNCED',
    };

    const nextReqs = requirements.map((r) => (r.id === updated.id ? cleanUpdated : r));
    setRequirements(nextReqs);

    try {
      localStorage.setItem('erp_live_requirements', JSON.stringify(nextReqs));
      localStorage.setItem(`${activePrefix}requirements`, JSON.stringify(nextReqs));
    } catch {}

    // Persist update to authoritative backend database
    fetchApi(`/api/requirements/${encodeURIComponent(updated.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cleanUpdated, updatedBy: currentUser.name, userRole: currentUser.role }),
    }).catch((err) => console.warn('[API] Update requirement sync warning:', err));

    pushMutationToCloud({ requirements: nextReqs });
    pushAudit('REQUIREMENT_UPDATED', 'CustomerRequirement', updated.id, `Requirement ${updated.id} details updated.`);
  };

  // Soft Delete Requirement - Super Admin has complete power without blocking
  const deleteRequirement = (id: string, reason: string = 'Archived by user'): { success: boolean; message: string } => {
    const target = requirements.find((r) => r.id === id || r.rfqNumber === id);
    if (!target) return { success: false, message: 'Requirement not found' };

    const actualId = target.id;
    const actualRfq = target.rfqNumber || target.id;

    const isAdmin = isSuperAdminUser(currentUser);

    const hasPO =
      customerPOs.some((c) => c.requirementId === actualId) ||
      vendorPOs.some((v) => v.requirementId === actualId);

    // Regular users are prevented if POs exist, but Super Admin has absolute power to delete
    if (hasPO && !isAdmin) {
      return {
        success: false,
        message: `Cannot delete requirement ${actualRfq} as purchase orders have already been issued. Set status to CANCELLED instead or contact Super Admin.`,
      };
    }

    const nowIso = new Date().toISOString();
    const softDeletedReq: CustomerRequirement = {
      ...target,
      isDeleted: true,
      deletedAt: nowIso,
      deletedBy: currentUser.name,
      deletedReason: reason,
      lastModifiedAt: nowIso,
      lastModifiedBy: currentUser.name,
    };

    const nextReqs = requirements.map((r) => (r.id === actualId ? softDeletedReq : r));
    setRequirements(nextReqs);

    const nextRfqs = rfqs.filter(
      (r) => r.id !== actualId && (r as any).rfqNumber !== actualRfq && r.requirementId !== actualId
    );
    setRfqs(nextRfqs);

    let updatedTombstones: string[] = [actualId, actualRfq];
    try {
      localStorage.setItem('erp_live_requirements', JSON.stringify(nextReqs));
      localStorage.setItem(`${activePrefix}requirements`, JSON.stringify(nextReqs));
      localStorage.setItem('erp_live_rfqs', JSON.stringify(nextRfqs));
      // Save tombstone locally immediately
      const localStored = localStorage.getItem('erp_deleted_requirements');
      const localList: string[] = localStored ? JSON.parse(localStored) : [];
      updatedTombstones = Array.from(new Set([...localList, actualId, actualRfq]));
      localStorage.setItem('erp_deleted_requirements', JSON.stringify(updatedTombstones));
    } catch {}

    // Call server soft-delete endpoint with audit reason
    fetchApi(
      `/api/requirements/${encodeURIComponent(actualId)}?user=${encodeURIComponent(currentUser.name)}&role=${encodeURIComponent(currentUser.role)}&reason=${encodeURIComponent(reason)}`,
      { method: 'DELETE' }
    ).catch((err) => {
      console.error('[API] Server delete requirement failed:', err);
    });

    pushMutationToCloud({ requirements: nextReqs, rfqs: nextRfqs, deletedRequirementIds: updatedTombstones });

    pushAudit(
      'REQUIREMENT_SOFT_DELETED',
      'CustomerRequirement',
      actualRfq,
      `Requirement ${actualRfq} (${actualId}) soft-deleted by ${currentUser.name}. Reason: ${reason}.`
    );
    return {
      success: true,
      message: `Requirement ${actualRfq} deleted successfully.`,
    };
  };

  // Super Admin Permanent Purge of a Requirement
  const purgeRequirement = (id: string): { success: boolean; message: string } => {
    const target = requirements.find((r) => r.id === id || r.rfqNumber === id);
    const actualId = target?.id || id;
    const actualRfq = target?.rfqNumber || id;

    const nextReqs = requirements.filter((r) => r.id !== actualId && r.rfqNumber !== actualRfq);
    setRequirements(nextReqs);
    const nextRfqs = rfqs.filter(
      (r) => r.id !== actualId && (r as any).rfqNumber !== actualRfq && r.requirementId !== actualId
    );
    setRfqs(nextRfqs);

    setCustomerPOs((prev) => prev.filter((p) => p.requirementId !== actualId));
    setVendorPOs((prev) => prev.filter((p) => p.requirementId !== actualId));
    setVendorQuotes((prev) => prev.filter((q) => q.requirementId !== actualId));
    setCustomerQuotations((prev) => prev.filter((q) => q.requirementId !== actualId));
    setProformaInvoices((prev) => prev.filter((pi) => pi.requirementId !== actualId));
    setPayments((prev) => prev.filter((p) => p.requirementId !== actualId));
    setDispatches((prev) => prev.filter((d) => d.requirementId !== actualId));
    setDeliveries((prev) => prev.filter((d) => d.requirementId !== actualId));

    let updatedTombstones: string[] = [actualId, actualRfq];
    try {
      localStorage.setItem('erp_live_requirements', JSON.stringify(nextReqs));
      localStorage.setItem(`${activePrefix}requirements`, JSON.stringify(nextReqs));
      localStorage.setItem('erp_live_rfqs', JSON.stringify(nextRfqs));
      const localStored = localStorage.getItem('erp_deleted_requirements');
      const localList: string[] = localStored ? JSON.parse(localStored) : [];
      updatedTombstones = Array.from(new Set([...localList, actualId, actualRfq]));
      localStorage.setItem('erp_deleted_requirements', JSON.stringify(updatedTombstones));
    } catch {}

    fetchApi(
      `/api/requirements/${encodeURIComponent(actualId)}/purge?user=${encodeURIComponent(currentUser.name)}&role=${encodeURIComponent(currentUser.role)}`,
      { method: 'DELETE' }
    ).catch(() => {});

    pushMutationToCloud({ requirements: nextReqs, rfqs: nextRfqs, deletedRequirementIds: updatedTombstones });
    pushAudit('REQUIREMENT_PERMANENTLY_PURGED', 'CustomerRequirement', actualRfq, `Super Admin purged requirement ${actualRfq} permanently.`);
    return { success: true, message: `Requirement ${actualRfq} permanently deleted.` };
  };

  // Delete RFQ (Immediate soft-delete & tombstone registration across cloud & client)
  const deleteRfq = async (id: string, reason: string = 'Archived by user'): Promise<{ success: boolean; message: string }> => {
    const targetRfq = rfqs.find((r) => r.id === id || (r as any).rfqNumber === id);
    const actualRfq = (targetRfq as any)?.rfqNumber || targetRfq?.id || id;
    const reqId = targetRfq?.requirementId;

    const nextRfqs = rfqs.filter(
      (r) => r.id !== id && (r as any).rfqNumber !== id && (r as any).rfqNumber !== actualRfq
    );
    setRfqs(nextRfqs);

    let nextReqs = requirements;
    if (reqId || targetRfq) {
      nextReqs = requirements.filter(
        (r) => r.id !== id && r.rfqNumber !== id && r.rfqNumber !== actualRfq && (reqId ? r.id !== reqId : true)
      );
      setRequirements(nextReqs);
    }

    const tombstonesToAdd = [id, actualRfq, reqId].filter(Boolean) as string[];
    let updatedTombstones = tombstonesToAdd;
    try {
      localStorage.setItem('erp_live_rfqs', JSON.stringify(nextRfqs));
      localStorage.setItem('erp_live_requirements', JSON.stringify(nextReqs));
      const localStored = localStorage.getItem('erp_deleted_requirements');
      const localList: string[] = localStored ? JSON.parse(localStored) : [];
      updatedTombstones = Array.from(new Set([...localList, ...tombstonesToAdd]));
      localStorage.setItem('erp_deleted_requirements', JSON.stringify(updatedTombstones));

      const localRfqStored = localStorage.getItem('erp_deleted_rfqs');
      const localRfqList: string[] = localRfqStored ? JSON.parse(localRfqStored) : [];
      const updatedRfqTombstones = Array.from(new Set([...localRfqList, ...tombstonesToAdd]));
      localStorage.setItem('erp_deleted_rfqs', JSON.stringify(updatedRfqTombstones));
    } catch {}

    try {
      await fetchApi(
        `/api/rfqs/${encodeURIComponent(id)}?user=${encodeURIComponent(currentUser.name)}&role=${encodeURIComponent(currentUser.role)}&reason=${encodeURIComponent(reason)}`,
        { method: 'DELETE' }
      );
    } catch (e) {
      console.warn('Backend RFQ delete notice:', e);
    }

    pushMutationToCloud({
      rfqs: nextRfqs,
      requirements: nextReqs,
      deletedRequirementIds: updatedTombstones,
    });

    pushAudit('RFQ_DELETED', 'RFQ', actualRfq, `RFQ ${actualRfq} (${id}) deleted by ${currentUser.name}. Reason: ${reason}`);
    pushNotification('RFQ Deleted', `RFQ ${actualRfq} was removed.`, 'WARNING', ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']);

    return { success: true, message: `RFQ ${actualRfq} removed successfully.` };
  };

  // Hard purge RFQ permanently from database
  const purgeRfq = async (id: string): Promise<{ success: boolean; message: string }> => {
    const targetRfq = rfqs.find((r) => r.id === id || (r as any).rfqNumber === id);
    const actualRfq = (targetRfq as any)?.rfqNumber || targetRfq?.id || id;
    const reqId = targetRfq?.requirementId;

    const nextRfqs = rfqs.filter((r) => r.id !== id && (r as any).rfqNumber !== id && (r as any).rfqNumber !== actualRfq);
    setRfqs(nextRfqs);

    const tombstonesToAdd = [id, actualRfq, reqId].filter(Boolean) as string[];
    let updatedRfqTombstones = tombstonesToAdd;
    try {
      localStorage.setItem('erp_live_rfqs', JSON.stringify(nextRfqs));
      const localStored = localStorage.getItem('erp_deleted_rfqs');
      const localList: string[] = localStored ? JSON.parse(localStored) : [];
      updatedRfqTombstones = Array.from(new Set([...localList, ...tombstonesToAdd]));
      localStorage.setItem('erp_deleted_rfqs', JSON.stringify(updatedRfqTombstones));
      const localReqStored = localStorage.getItem('erp_deleted_requirements');
      const localReqList: string[] = localReqStored ? JSON.parse(localReqStored) : [];
      localStorage.setItem('erp_deleted_requirements', JSON.stringify(Array.from(new Set([...localReqList, ...tombstonesToAdd]))));
    } catch {}

    try {
      await fetchApi(
        `/api/rfqs/${encodeURIComponent(id)}/purge?user=${encodeURIComponent(currentUser.name)}&role=${encodeURIComponent(currentUser.role)}`,
        { method: 'DELETE' }
      );
    } catch {}

    pushMutationToCloud({
      rfqs: nextRfqs,
      deletedRfqIds: updatedRfqTombstones,
    });

    pushAudit('RFQ_PURGED', 'RFQ', actualRfq, `RFQ ${actualRfq} was permanently hard purged by ${currentUser.name}`);
    return { success: true, message: `RFQ ${actualRfq} permanently deleted.` };
  };

  // Purge all soft-deleted / test RFQs in batch
  const purgeAllDeletedRfqs = async (): Promise<{ success: boolean; purgedCount: number; message: string }> => {
    try {
      const res = await fetchApi('/api/rfqs/purge-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUser.name, role: currentUser.role }),
      });
      const data = await res.json();
      if (data && data.success) {
        const stateRes = await fetchApi('/api/sync/state');
        const stateData = await stateRes.json().catch(() => ({}));
        const nextRfqs = stateData?.state?.rfqs;
        if (Array.isArray(nextRfqs)) {
          setRfqs(nextRfqs);
          localStorage.setItem('erp_live_rfqs', JSON.stringify(nextRfqs));
        }
      }
      return data;
    } catch (err: any) {
      return { success: false, purgedCount: 0, message: err.message || 'Bulk purge failed.' };
    }
  };

  // Match rate deterministically using 6-level hierarchy
  const fetchCatalogueRateMatch = async (query: string, options?: any): Promise<RateMatchResult> => {
    try {
      const res = await fetchApi('/api/catalog/match-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, ...options }),
      });
      const data = await res.json();
      if (data && data.result) return data.result;
    } catch (err) {
      console.warn('Backend rate match failed, falling back to local deterministic engine:', err);
    }
    return matchCatalogueRateDeterministic(query, catalogueProducts, options);
  };

  // Fetch chronological rate version history for a part code
  const fetchRateHistory = async (partCode: string, brand?: string): Promise<RateVersionHistory[]> => {
    try {
      const url = `/api/catalog/rate-history/${encodeURIComponent(partCode)}${brand ? `?brand=${encodeURIComponent(brand)}` : ''}`;
      const res = await fetchApi(url);
      const data = await res.json();
      if (data && Array.isArray(data.history)) return data.history;
    } catch {}
    return rateVersionHistory.filter((rv) => rv.partCode.toLowerCase() === partCode.toLowerCase());
  };

  // Import catalogue with year-over-year rate versioning
  const importVersionedCatalogue = async (batch: any) => {
    try {
      const res = await fetchApi('/api/catalog/import-versioned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch, user: currentUser.name, role: currentUser.role }),
      });
      const data = await res.json();
      if (data && data.success) {
        const prodRes = await fetchApi('/api/catalog/products');
        const prodData = await prodRes.json();
        if (prodData && Array.isArray(prodData.products)) {
          setCatalogueProducts(prodData.products);
          localStorage.setItem('erp_live_catalogue_products', JSON.stringify(prodData.products));
        }
        const batchRes = await fetchApi('/api/catalog/batches');
        const batchData = await batchRes.json();
        if (batchData && Array.isArray(batchData.batches)) {
          setImportBatches(batchData.batches);
          localStorage.setItem('erp_live_import_batches', JSON.stringify(batchData.batches));
        }
        pushNotification('Catalogue Version Imported', `Successfully imported ${batch.brandName} (${batch.catalogueVersion}).`, 'SUCCESS', ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']);
      }
      return data;
    } catch (err: any) {
      return { success: false, message: err.message || 'Catalogue import failed.' };
    }
  };

  // Delete / Rollback an entire import batch
  const rollbackImportBatch = async (batchId: string, force: boolean = false) => {
    try {
      const res = await fetchApi(
        `/api/catalog/batches/${encodeURIComponent(batchId)}?force=${force}&user=${encodeURIComponent(currentUser.name)}&role=${encodeURIComponent(currentUser.role)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data && data.success) {
        const prodRes = await fetchApi('/api/catalog/products');
        const prodData = await prodRes.json();
        if (prodData && Array.isArray(prodData.products)) {
          setCatalogueProducts(prodData.products);
          localStorage.setItem('erp_live_catalogue_products', JSON.stringify(prodData.products));
        }
        const batchRes = await fetchApi('/api/catalog/batches');
        const batchData = await batchRes.json();
        if (batchData && Array.isArray(batchData.batches)) {
          setImportBatches(batchData.batches);
          localStorage.setItem('erp_live_import_batches', JSON.stringify(batchData.batches));
        }
        pushNotification('Batch Rolled Back', `Catalogue import batch ${batchId} was successfully rolled back.`, 'INFO', ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']);
      }
      return data;
    } catch (err: any) {
      return { success: false, message: err.message || 'Rollback failed.' };
    }
  };


  // Super Admin Power: Bulk Purge Old Transactions
  const purgeAllOldTransactions = async (): Promise<{ success: boolean; message: string }> => {
    setRequirements([]);
    setRfqs([]);
    setVendorQuotes([]);
    setCustomerQuotations([]);
    setCustomerPOs([]);
    setVendorPOs([]);
    setProformaInvoices([]);
    setPayments([]);
    setDispatches([]);
    setDeliveries([]);

    try {
      localStorage.setItem('erp_live_requirements', JSON.stringify([]));
      localStorage.setItem('erp_live_rfqs', JSON.stringify([]));
      localStorage.setItem('erp_live_vendor_quotes', JSON.stringify([]));
      localStorage.setItem('erp_live_quotations', JSON.stringify([]));
      localStorage.setItem('erp_live_customer_pos', JSON.stringify([]));
      localStorage.setItem('erp_live_vendor_pos', JSON.stringify([]));
      localStorage.setItem('erp_live_proforma_invoices', JSON.stringify([]));
      localStorage.setItem('erp_live_payments', JSON.stringify([]));
      localStorage.setItem('erp_live_dispatches', JSON.stringify([]));
      localStorage.setItem('erp_live_deliveries', JSON.stringify([]));
      localStorage.setItem(`${activePrefix}requirements`, JSON.stringify([]));
      localStorage.removeItem('erp_deleted_requirements');
      localStorage.setItem('erp_initialized', 'true');
    } catch {}

    try {
      const res = await fetchApi('/api/superadmin/purge/all-old-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUser.name, role: currentUser.role }),
      });
      const data = await res.json();
      pushAudit('ALL_TRANSACTIONS_PURGED', 'SuperAdmin', 'ALL', `Purged old test transactions.`);
      return { success: true, message: data.message || 'All old test transactions purged successfully.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Purge failed' };
    }
  };

  // Super Admin: Purge All Demo Vendors
  const purgeAllVendors = async (): Promise<{ success: boolean; message: string }> => {
    const purgedIds = vendors.map((v) => v.id).filter(Boolean);
    const purgedMapIds = vendorProductMappings.map((m) => m.id).filter(Boolean);
    purgedIds.forEach((id) => markLocalDelete('vendor', id));
    purgedMapIds.forEach((id) => markLocalDelete('mapping', id));
    addTombstoneIds('erp_deleted_vendors', purgedIds);
    addTombstoneIds('erp_deleted_vendor_mappings', purgedMapIds);
    setVendors([]);
    setVendorProductMappings([]);
    try {
      localStorage.setItem('erp_live_vendors', JSON.stringify([]));
      localStorage.setItem('erp_live_vendor_products', JSON.stringify([]));
      localStorage.setItem('erp_initialized', 'true');
    } catch {}
    try {
      const res = await fetchApi('/api/superadmin/purge/all-vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUser.name, role: currentUser.role }),
      });
      const data = await res.json();
      pushAudit('ALL_VENDORS_PURGED', 'SuperAdmin', 'ALL', 'Purged all demo suppliers.');
      return { success: true, message: data.message || 'All demo vendors purged successfully.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Purge failed' };
    }
  };

  // Super Admin: Clean Slate for Real Business Operations
  const cleanSlateForRealBusiness = async (): Promise<{ success: boolean; message: string }> => {
    await purgeAllOldTransactions();
    await purgeAllVendors();
    const purgedProdIds = products.map((p) => p.id).filter(Boolean);
    purgedProdIds.forEach((id) => markLocalDelete('product', id));
    addTombstoneIds('erp_deleted_products', purgedProdIds);
    setProducts([]);
    try {
      localStorage.setItem('erp_live_products', JSON.stringify([]));
      localStorage.setItem('erp_initialized', 'true');
    } catch {}
    try {
      const res = await fetchApi('/api/superadmin/purge/clean-slate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUser.name, role: currentUser.role }),
      });
      const data = await res.json();
      pushAudit('CLEAN_SLATE_INITIALIZED', 'SuperAdmin', 'ALL', 'Clean enterprise business slate initialized.');
      return { success: true, message: data.message || 'Clean business slate initialized successfully.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Initialization failed' };
    }
  };

  // Restore Soft-Deleted Requirement back to Active Register
  const restoreRequirement = (id: string): { success: boolean; message: string } => {
    const target = requirements.find((r) => r.id === id || r.rfqNumber === id);
    if (!target) return { success: false, message: 'Requirement not found' };

    const actualId = target.id;
    const actualRfq = target.rfqNumber || target.id;
    const nowIso = new Date().toISOString();

    const restoredReq: CustomerRequirement = {
      ...target,
      isDeleted: false,
      deletedAt: undefined,
      deletedBy: undefined,
      deletedReason: undefined,
      lastModifiedAt: nowIso,
      lastModifiedBy: currentUser.name,
      dbSaveStatus: 'COMMITTED',
      cloudSyncStatus: 'SYNCED',
    };

    const nextReqs = requirements.map((r) => (r.id === actualId ? restoredReq : r));
    setRequirements(nextReqs);

    try {
      localStorage.setItem('erp_live_requirements', JSON.stringify(nextReqs));
      localStorage.setItem(`${activePrefix}requirements`, JSON.stringify(nextReqs));
    } catch {}

    // Call server restore endpoint
    fetchApi(
      `/api/requirements/${encodeURIComponent(actualId)}/restore?user=${encodeURIComponent(currentUser.name)}&role=${encodeURIComponent(currentUser.role)}`,
      { method: 'POST' }
    ).catch((err) => {
      console.error('[API] Server restore requirement failed:', err);
    });

    pushMutationToCloud({ requirements: nextReqs });

    pushAudit(
      'REQUIREMENT_RESTORED',
      'CustomerRequirement',
      actualRfq,
      `Requirement ${actualRfq} restored to active register by ${currentUser.name}.`
    );
    return {
      success: true,
      message: `Requirement ${actualRfq} successfully restored to active register.`,
    };
  };

  // Send RFQ to Vendors (with Duplicate RFQ Prevention & 1:1 RFQ Number Sync)
  const sendVendorEnquiry = (requirementId: string, vendorIds: string[], notes?: string): VendorEnquiry => {
    const year = new Date().getFullYear();
    const req = requirements.find((r) => r.id === requirementId || r.rfqNumber === requirementId);
    const existingRfq = rfqs.find(
      (r) => r.requirementId === requirementId || (req && r.requirementId === req.id) || (req?.rfqNumber && r.id === req.rfqNumber)
    );

    const items = req?.items?.map((it, idx) => ({
      id: it.id || `RFQ-ITEM-${idx + 1}`,
      itemName: it.itemName,
      description: it.description || it.itemName,
      category: it.category || 'General MRO',
      subCategory: it.subCategory || '',
      brand: (it as any).assignedBrand || it.brand || '',
      partCode: (it as any).assignedPartCode || it.partNumber || '',
      partNumber: it.partNumber || (it as any).assignedPartCode || '',
      quantity: it.quantity || 1,
      uom: it.uom || 'NOS',
      targetPrice: it.targetPrice || (it as any).rate || 0,
      specifications: it.specification || 'Standard Industrial Specification',
    })) || [];

    if (existingRfq) {
      // Merge vendor list without duplicate IDs
      const mergedVendorIds = Array.from(new Set([...existingRfq.vendorIds, ...vendorIds]));
      const updatedRfq: VendorEnquiry = {
        ...existingRfq,
        vendorIds: mergedVendorIds,
        notes: notes || existingRfq.notes,
        sentDate: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        status: 'SENT',
        items: items.length > 0 ? items : existingRfq.items,
        customerId: req?.customerId || existingRfq.customerId,
        customerName: req?.customerName || existingRfq.customerName,
        companyId: req?.companyId || existingRfq.companyId,
        companyName: req?.companyName || existingRfq.companyName,
      };

      setRfqs((prev) => prev.map((r) => (r.id === existingRfq.id ? updatedRfq : r)));
      updateRequirementStage(req?.id || requirementId, 'ENQUIRY_SENT');

      pushAudit('RFQ_SENT', 'VendorEnquiry', existingRfq.id, `Enquiry updated for ${vendorIds.length} vendor(s) for requirement ${requirementId}`);
      fetchApi('/api/rfqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updatedRfq, user: currentUser.name, role: currentUser.role }),
      }).catch((err) => console.warn('[API] RFQ sync warning:', err));

      return updatedRfq;
    }

    // Determine unique RFQ Number matching requirement or next sequence
    let rfqId = req?.rfqNumber;
    if (!rfqId) {
      const count = rfqs.length + 1;
      rfqId = `RFQ-${year}-${String(count).padStart(5, '0')}`;
    }

    const newRfq: VendorEnquiry = {
      id: rfqId,
      rfqNumber: rfqId,
      requirementId: req?.id || requirementId,
      vendorIds,
      customerId: req?.customerId || req?.companyId || '',
      customerName: req?.customerName || req?.companyName || 'Industrial Customer',
      companyId: req?.companyId || req?.customerId || '',
      companyName: req?.companyName || req?.customerName || 'Industrial Customer',
      purchaseExecutiveId: req?.purchaseExecutiveId || '',
      purchaseExecutiveName: req?.purchaseExecutiveName || '',
      requiredDate: req?.requiredDeliveryDate || new Date().toISOString().split('T')[0],
      sentDate: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      status: 'SENT',
      notes,
      items,
      createdBy: currentUser.name,
      dbSaveStatus: 'COMMITTED',
    };

    setRfqs((prev) => [newRfq, ...prev]);
    updateRequirementStage(req?.id || requirementId, 'ENQUIRY_SENT');

    pushAudit('RFQ_SENT', 'VendorEnquiry', rfqId, `Enquiry sent to ${vendorIds.length} vendor(s) for requirement ${requirementId}`);
    pushNotification(
      'New RFQ Enquiry Received',
      `You have received enquiry ${rfqId} for requirement ${req?.id || requirementId}. Please submit your competitive rates.`,
      'ACTION_REQUIRED',
      ['VENDOR'],
      'rfq-management',
      rfqId
    );

    fetchApi('/api/rfqs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newRfq, user: currentUser.name, role: currentUser.role }),
    }).catch((err) => console.warn('[API] RFQ sync warning:', err));

    return newRfq;
  };

  // Transactional Manual RFQ Creation with server-verified commit
  const createRfq = async (
    rfqData: Partial<VendorEnquiry>
  ): Promise<{ success: boolean; rfq?: VendorEnquiry; error?: string }> => {
    try {
      const payload = {
        ...rfqData,
        createdBy: currentUser.name,
        userRole: currentUser.role,
        user: currentUser.name,
        role: currentUser.role,
      };

      const res = await fetchApi('/api/rfqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}: Failed to persist RFQ in database`);
      }

      const data = await res.json();
      if (!data.success || !data.rfq) {
        throw new Error(data.error || 'Server did not confirm RFQ database persistence');
      }

      const savedRfq: VendorEnquiry = data.rfq;

      // Untombstone locally so background sync doesn't remove it
      try {
        const stored = localStorage.getItem('erp_deleted_requirements');
        if (stored) {
          const list: string[] = JSON.parse(stored);
          const updated = list.filter(
            (tid) => tid !== savedRfq.id && tid !== (savedRfq as any).rfqNumber && tid !== savedRfq.requirementId
          );
          localStorage.setItem('erp_deleted_requirements', JSON.stringify(updated));
        }
      } catch {}

      // Update state immediately
      setRfqs((prev) => [
        savedRfq,
        ...prev.filter((r) => r.id !== savedRfq.id && (r as any).rfqNumber !== (savedRfq as any).rfqNumber),
      ]);

      // If tied to a requirement, update requirement stage
      if (savedRfq.requirementId) {
        updateRequirementStage(savedRfq.requirementId, 'ENQUIRY_SENT');
      }

      pushAudit(
        'RFQ_COMMITTED',
        'RFQ',
        savedRfq.id,
        `RFQ ${savedRfq.id} (${(savedRfq as any).rfqNumber || savedRfq.id}) permanently saved with ${savedRfq.items?.length || 0} items to database by ${currentUser.name}.`
      );

      pushNotification(
        'RFQ Added Successfully',
        `RFQ ${(savedRfq as any).rfqNumber || savedRfq.id} verified and committed to database (${savedRfq.items?.length || 0} items).`,
        'SUCCESS',
        ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE'],
        'rfq-management',
        savedRfq.id
      );

      return { success: true, rfq: savedRfq };
    } catch (err: any) {
      console.error('[createRfq Error]:', err);
      pushNotification(
        'RFQ Save Failed',
        err.message || 'Database transaction failed to persist RFQ.',
        'WARNING',
        ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']
      );
      return { success: false, error: err.message };
    }
  };

  // Transactional Bulk RFQ Creation with row-by-row verification
  const createBulkRfqs = async (
    rfqsList: any[]
  ): Promise<{
    success: boolean;
    totalSubmitted: number;
    successfullySaved: number;
    duplicateCount: number;
    failedCount: number;
    results: any[];
    error?: string;
  }> => {
    try {
      const payload = {
        rfqs: rfqsList,
        user: currentUser.name,
        role: currentUser.role,
        createdBy: currentUser.name,
      };

      const res = await fetchApi('/api/rfqs/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}: Failed to persist bulk RFQs`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Server did not confirm bulk RFQ database persistence');
      }

      // Add all successfully saved RFQs to state
      const savedItems: VendorEnquiry[] = (data.results || [])
        .filter((r: any) => r.status === 'SAVED' && r.rfq)
        .map((r: any) => r.rfq);

      if (savedItems.length > 0) {
        const savedIds = new Set(savedItems.map((s) => s.id));
        setRfqs((prev) => [...savedItems, ...prev.filter((p) => !savedIds.has(p.id))]);

        // Untombstone all saved IDs
        try {
          const stored = localStorage.getItem('erp_deleted_requirements');
          if (stored) {
            const list: string[] = JSON.parse(stored);
            const toRemove = new Set(
              savedItems.flatMap((s: any) => [s.id, s.rfqNumber, s.requirementId].filter(Boolean))
            );
            const updated = list.filter((tid) => !toRemove.has(tid));
            localStorage.setItem('erp_deleted_requirements', JSON.stringify(updated));
          }
        } catch {}
      }

      pushAudit(
        'BULK_RFQS_COMMITTED',
        'RFQ',
        'BULK',
        `Bulk RFQ execution: ${data.successfullySaved} saved, ${data.duplicateCount} duplicates, ${data.failedCount} failed by ${currentUser.name}.`
      );

      if (data.successfullySaved > 0) {
        pushNotification(
          'Bulk RFQ Import Completed',
          `${data.successfullySaved} RFQ(s) saved to database. ${data.duplicateCount} duplicates skipped, ${data.failedCount} failed.`,
          data.failedCount > 0 ? 'WARNING' : 'SUCCESS',
          ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE'],
          'rfq-management'
        );
      } else {
        pushNotification(
          'Bulk RFQ Import Failed',
          `0 RFQs saved. ${data.duplicateCount} duplicates, ${data.failedCount} errors.`,
          'WARNING',
          ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE'],
          'rfq-management'
        );
      }

      return data;
    } catch (err: any) {
      console.error('[createBulkRfqs Error]:', err);
      pushNotification(
        'Bulk RFQ Import Failed',
        err.message || 'Bulk RFQ transaction failed.',
        'WARNING',
        ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']
      );
      return {
        success: false,
        totalSubmitted: rfqsList.length,
        successfullySaved: 0,
        duplicateCount: 0,
        failedCount: rfqsList.length,
        results: [],
        error: err.message,
      };
    }
  };

  // Helper to determine exact rate completion status for a requirement
  const getRateCompletionStatus = (requirementId: string) => {
    const req = requirements.find((r) => r.id === requirementId);
    const rfq = rfqs.find((r) => r.requirementId === requirementId);
    const matchingQuotes = vendorQuotes.filter(
      (v) =>
        v.requirementId === requirementId ||
        v.enquiryId === requirementId ||
        (rfq && (v.requirementId === rfq.id || v.enquiryId === rfq.id))
    );

    if (!req) {
      return {
        status: (matchingQuotes.length > 0 ? 'COMPLETED' : 'PENDING') as 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'PENDING',
        totalItems: 0,
        quotedItemsCount: 0,
        missingItems: [] as RequirementItem[],
        quotesCount: matchingQuotes.length,
        quotes: matchingQuotes,
      };
    }

    const totalItems = req.items.length;
    // Collect all requirement item IDs that have at least one rate entry in any quote
    const quotedItemIds = new Set<string>();
    matchingQuotes.forEach((q) => {
      q.items.forEach((qi) => {
        if (qi.requirementItemId) {
          quotedItemIds.add(qi.requirementItemId);
        }
        if (qi.itemName) {
          const matchedItem = req.items.find(
            (it) => it.itemName.trim().toLowerCase() === qi.itemName.trim().toLowerCase()
          );
          if (matchedItem) {
            quotedItemIds.add(matchedItem.id);
          }
        }
      });
    });

    const missingItems = req.items.filter((it) => !quotedItemIds.has(it.id));
    const quotedItemsCount = totalItems - missingItems.length;

    let status: 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'PENDING' = 'PENDING';
    if (matchingQuotes.length === 0) {
      status = 'PENDING';
    } else if (missingItems.length === 0) {
      status = 'COMPLETED';
    } else {
      status = 'PARTIALLY_COMPLETED';
    }

    return {
      status,
      totalItems,
      quotedItemsCount,
      missingItems,
      quotesCount: matchingQuotes.length,
      quotes: matchingQuotes,
    };
  };

  // Vendor Rate Submission (Direct Rate Entry & Sourced Quotes)
  const submitVendorQuote = (quoteData: {
    id?: string;
    enquiryId?: string;
    requirementId: string;
    customerName?: string;
    vendorId: string;
    vendorName: string;
    items: any[];
    validUntil?: string;
    paymentTerms?: string;
    remarks?: string;
    attachmentName?: string;
  }): VendorQuote => {
    const year = new Date().getFullYear();
    const vqId =
      quoteData.id ||
      generateCollisionSafeYearlyId('VQ', year, vendorQuotes, readTombstoneList('erp_deleted_vendor_quotes'));

    const targetReq = requirements.find((r) => r.id === quoteData.requirementId);

    const newQuote: VendorQuote = {
      id: vqId,
      enquiryId: quoteData.enquiryId || 'DIRECT_ENTRY',
      requirementId: quoteData.requirementId,
      customerName: quoteData.customerName || targetReq?.customerName || '',
      vendorId: quoteData.vendorId,
      vendorName: quoteData.vendorName,
      submissionDate: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      status: 'SUBMITTED',
      validUntil: quoteData.validUntil || '15 Days',
      paymentTerms: quoteData.paymentTerms || '',
      remarks: quoteData.remarks,
      attachmentName: quoteData.attachmentName,
      items: quoteData.items,
    };

    markLocalWrite('vendorQuote', vqId);
    const updatedDeletedQuotes = removeTombstoneIds('erp_deleted_vendor_quotes', [vqId]);
    const nextQuotes = [newQuote, ...vendorQuotes.filter((q) => q.id !== vqId)];
    setVendorQuotes(nextQuotes);
    try {
      localStorage.setItem('erp_live_vendor_quotes', JSON.stringify(nextQuotes));
    } catch {}

    // Update requirement stage if currently in early stage
    if (targetReq && (targetReq.status === 'NEW_REQUIREMENT' || targetReq.status === 'ENQUIRY_SENT' || targetReq.status === 'RATE_RECEIVED')) {
      updateRequirementStage(quoteData.requirementId, 'RATE_RECEIVED');
    }

    // Persist to backend API (graceful background sync)
    fetchApi('/api/vendor-quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newQuote),
    }).catch((err) => {
      console.warn('Backend /api/vendor-quotes sync notice:', err.message);
    });
    pushMutationToCloud({ vendorQuotes: nextQuotes, deletedVendorQuoteIds: updatedDeletedQuotes });

    pushAudit('RATE_SUBMITTED', 'VendorQuote', vqId, `Vendor rate recorded for ${quoteData.vendorName} against requirement ${quoteData.requirementId}`);
    pushNotification(
      'Vendor Rate Recorded',
      `Rate entry ${vqId} from ${quoteData.vendorName} saved. Ready for Rate Comparison & Client Quotation.`,
      'SUCCESS',
      ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE', 'PURCHASE_MANAGER'],
      'rate-comparison',
      quoteData.requirementId
    );

    return newQuote;
  };

  // Edit / Update Vendor Rate Quote
  const updateVendorQuote = (quote: VendorQuote): VendorQuote => {
    markLocalWrite('vendorQuote', quote.id);
    const updatedDeletedQuotes = removeTombstoneIds('erp_deleted_vendor_quotes', [quote.id]);
    const nextQuotes = vendorQuotes.map((q) => (q.id === quote.id ? quote : q));
    setVendorQuotes(nextQuotes);
    try {
      localStorage.setItem('erp_live_vendor_quotes', JSON.stringify(nextQuotes));
    } catch {}

    // Persist to backend API
    fetchApi(`/api/vendor-quotes/${encodeURIComponent(quote.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quote),
    }).catch((err) => {
      console.warn('Backend /api/vendor-quotes sync notice:', err.message);
    });
    pushMutationToCloud({ vendorQuotes: nextQuotes, deletedVendorQuoteIds: updatedDeletedQuotes });

    pushAudit('VENDOR_RATE_UPDATED', 'VendorQuote', quote.id, `Updated vendor rate quote details for ${quote.vendorName}`);
    return quote;
  };

  // Delete Vendor Rate Quote
  const deleteVendorQuote = (id: string): { success: boolean; message?: string } => {
    const target = vendorQuotes.find((q) => q.id === id);
    if (!target) return { success: false, message: 'Vendor quote not found' };

    markLocalDelete('vendorQuote', id);
    const updatedDeletedQuotes = addTombstoneIds('erp_deleted_vendor_quotes', [id]);
    const nextQuotes = vendorQuotes.filter((q) => q.id !== id);
    setVendorQuotes(nextQuotes);
    try {
      localStorage.setItem('erp_live_vendor_quotes', JSON.stringify(nextQuotes));
    } catch {}

    // Persist to backend API
    fetchApi(`/api/vendor-quotes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).catch((err) => {
      console.warn('Backend /api/vendor-quotes sync notice:', err.message);
    });
    pushMutationToCloud({ vendorQuotes: nextQuotes, deletedVendorQuoteIds: updatedDeletedQuotes });

    // Re-check requirement rates
    const remainingQuotes = nextQuotes.filter((q) => q.requirementId === target.requirementId);
    if (remainingQuotes.length === 0) {
      const req = requirements.find((r) => r.id === target.requirementId);
      if (req && req.status === 'RATE_RECEIVED') {
        updateRequirementStage(target.requirementId, 'NEW_REQUIREMENT');
      }
    }

    pushAudit('VENDOR_RATE_DELETED', 'VendorQuote', id, `Deleted rate quote from ${target.vendorName}`);
    return { success: true };
  };

  // Create Customer Quotation
  const createCustomerQuotation = (quoteData: any): CustomerQuotation => {
    const year = new Date().getFullYear();
    const qtnId = generateCollisionSafeYearlyId('QTN', year, customerQuotations);

    const newQtn: CustomerQuotation = {
      ...quoteData,
      id: qtnId,
      date: new Date().toISOString().split('T')[0],
      status: 'SENT',
      pdfGenerated: true,
    };

    const nextQuotations = [newQtn, ...customerQuotations];
    setCustomerQuotations(nextQuotations);
    try {
      localStorage.setItem('erp_live_quotations', JSON.stringify(nextQuotations));
    } catch {}
    updateRequirementStage(quoteData.requirementId, 'QUOTATION_SENT');

    // Add doc record
    const docRecord: DocumentRecord = {
      id: `DOC-${Date.now().toString().slice(-5)}`,
      name: `Quotation_${qtnId}.pdf`,
      type: 'PDF',
      category: 'QUOTATION',
      associatedTransactionId: quoteData.requirementId,
      customerOrVendorName: quoteData.customerName,
      uploadedAt: new Date().toLocaleString(),
      size: '640 KB',
      url: '#',
    };
    setDocuments((prev) => [docRecord, ...prev]);

    pushAudit('QUOTATION_ISSUED', 'CustomerQuotation', qtnId, `Quotation ${qtnId} issued to ${quoteData.customerName} totaling ₹${newQtn.grandTotal.toLocaleString('en-IN')}`);
    pushNotification(
      'Formal Quotation Generated',
      `Quotation ${qtnId} sent to customer ${quoteData.customerName}. Download PDF or share via WhatsApp.`,
      'SUCCESS',
      ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE', 'CUSTOMER'],
      'quotations',
      qtnId
    );

    fetchApi('/api/quotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newQtn),
    }).catch((err) => console.warn('[API] Quotation sync warning:', err));
    pushMutationToCloud({ quotations: nextQuotations });

    return newQtn;
  };

  // Customer PO Received
  const recordCustomerPO = (poData: {
    quotationId: string;
    requirementId: string;
    customerPoNumber: string;
    poDate: string;
    customerId: string;
    customerName: string;
    poAmount: number;
    deliveryAddress: string;
    paymentTerms: string;
    remarks?: string;
  }): CustomerPO => {
    const year = new Date().getFullYear();
    const cpoId = generateCollisionSafeYearlyId('CPO', year, customerPOs);

    const newCpo: CustomerPO = {
      ...poData,
      id: cpoId,
      receivedDate: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
    };

    const nextCpos = [newCpo, ...customerPOs];
    setCustomerPOs(nextCpos);
    try {
      localStorage.setItem('erp_live_customer_pos', JSON.stringify(nextCpos));
    } catch {}
    updateRequirementStage(poData.requirementId, 'PO_RECEIVED');

    // Add doc
    const docRecord: DocumentRecord = {
      id: `DOC-${Date.now().toString().slice(-5)}`,
      name: `Customer_PO_${poData.customerPoNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      type: 'PDF',
      category: 'PO',
      associatedTransactionId: poData.requirementId,
      customerOrVendorName: poData.customerName,
      uploadedAt: new Date().toLocaleString(),
      size: '1.4 MB',
      url: '#',
    };
    setDocuments((prev) => [docRecord, ...prev]);

    pushAudit('CUSTOMER_PO_RECORDED', 'CustomerPO', cpoId, `Customer PO ${poData.customerPoNumber} received for ₹${poData.poAmount.toLocaleString('en-IN')}`);
    pushNotification(
      'Customer PO Received!',
      `${poData.customerName} issued PO ${poData.customerPoNumber}. Ready to place Vendor Purchase Order.`,
      'ACTION_REQUIRED',
      ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE'],
      'customer-pos',
      cpoId
    );

    fetchApi('/api/customer-pos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCpo),
    }).catch((err) => console.warn('[API] Customer PO sync warning:', err));
    pushMutationToCloud({ customerPos: nextCpos });

    return newCpo;
  };

  // Vendor PO Creation
  const createVendorPO = (vpoData: {
    customerPoId: string;
    quotationId: string;
    requirementId: string;
    vendorId: string;
    vendorName: string;
    items: any[];
    subtotal: number;
    gstAmount: number;
    freight: number;
    totalAmount: number;
    deliveryAddress: string;
    deliveryDate: string;
    paymentTerms: string;
    remarks?: string;
  }): VendorPO => {
    const year = new Date().getFullYear();
    const vpoId = generateCollisionSafeYearlyId('VPO', year, vendorPOs);

    const newVpo: VendorPO = {
      ...vpoData,
      id: vpoId,
      poDate: new Date().toISOString().split('T')[0],
      pdfGenerated: true,
    };

    const nextVpos = [newVpo, ...vendorPOs];
    setVendorPOs(nextVpos);
    try {
      localStorage.setItem('erp_live_vendor_pos', JSON.stringify(nextVpos));
    } catch {}
    updateRequirementStage(vpoData.requirementId, 'VENDOR_ORDER_PLACED');

    const docRecord: DocumentRecord = {
      id: `DOC-${Date.now().toString().slice(-5)}`,
      name: `Vendor_PO_${vpoId}.pdf`,
      type: 'PDF',
      category: 'PO',
      associatedTransactionId: vpoData.requirementId,
      customerOrVendorName: vpoData.vendorName,
      uploadedAt: new Date().toLocaleString(),
      size: '880 KB',
      url: '#',
    };
    setDocuments((prev) => [docRecord, ...prev]);

    pushAudit('VENDOR_PO_ISSUED', 'VendorPO', vpoId, `Vendor PO ${vpoId} placed with ${vpoData.vendorName} for ₹${vpoData.totalAmount.toLocaleString('en-IN')}`);
    pushNotification(
      'New Purchase Order Placed',
      `Vendor PO ${vpoId} has been issued to you. Please provide Proforma Invoice (PI).`,
      'ACTION_REQUIRED',
      ['VENDOR'],
      'vendor-pos',
      vpoId
    );

    fetchApi('/api/vendor-pos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newVpo),
    }).catch((err) => console.warn('[API] Vendor PO sync warning:', err));
    pushMutationToCloud({ vendorPos: nextVpos });

    return newVpo;
  };

  // Proforma Invoice Received
  const submitProformaInvoice = (piData: {
    vendorPoId: string;
    requirementId: string;
    vendorId: string;
    vendorName: string;
    piNumber: string;
    piDate: string;
    amount: number;
    gstAmount: number;
    freight: number;
    totalAmount: number;
    bankDetails: string;
    paymentDueDate: string;
    remarks?: string;
  }): ProformaInvoice => {
    const year = new Date().getFullYear();
    const piId = generateCollisionSafeYearlyId('PI', year, proformaInvoices);

    const newPi: ProformaInvoice = {
      ...piData,
      id: piId,
    };

    const nextPis = [newPi, ...proformaInvoices];
    setProformaInvoices(nextPis);
    try {
      localStorage.setItem('erp_live_proforma_invoices', JSON.stringify(nextPis));
    } catch {}
    updateRequirementStage(piData.requirementId, 'PI_RECEIVED');

    const docRecord: DocumentRecord = {
      id: `DOC-${Date.now().toString().slice(-5)}`,
      name: `Proforma_Invoice_${piData.piNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      type: 'PDF',
      category: 'PI',
      associatedTransactionId: piData.requirementId,
      customerOrVendorName: piData.vendorName,
      uploadedAt: new Date().toLocaleString(),
      size: '720 KB',
      url: '#',
    };
    setDocuments((prev) => [docRecord, ...prev]);

    pushAudit('PI_RECEIVED', 'ProformaInvoice', piId, `PI ${piData.piNumber} uploaded by ${piData.vendorName} for ₹${piData.totalAmount.toLocaleString('en-IN')}`);
    pushNotification(
      'Vendor PI Received',
      `Proforma Invoice ${piData.piNumber} received from ${piData.vendorName}. Payment pending.`,
      'ACTION_REQUIRED',
      ['SUPER_ADMIN', 'ACCOUNTS_USER'],
      'pi',
      piId
    );

    fetchApi('/api/proforma-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPi),
    }).catch((err) => console.warn('[API] Proforma invoice sync warning:', err));
    pushMutationToCloud({ proformaInvoices: nextPis });

    return newPi;
  };

  // Record Payment
  const recordPayment = (payData: {
    piId: string;
    vendorPoId: string;
    requirementId: string;
    vendorId: string;
    vendorName: string;
    totalPiAmount: number;
    amountPaid: number;
    paymentDate: string;
    paymentMode: any;
    transactionReference: string;
    remarks?: string;
  }): PaymentRecord => {
    const year = new Date().getFullYear();
    const payId = generateCollisionSafeYearlyId('PAY', year, payments);

    const newPay: PaymentRecord = {
      ...payData,
      id: payId,
      status: 'PAYMENT_DONE',
      loggedBy: currentUser.name,
    };

    const nextPayments = [newPay, ...payments];
    setPayments(nextPayments);
    try {
      localStorage.setItem('erp_live_payments', JSON.stringify(nextPayments));
    } catch {}
    updateRequirementStage(payData.requirementId, 'PAYMENT_DONE');

    const docRecord: DocumentRecord = {
      id: `DOC-${Date.now().toString().slice(-5)}`,
      name: `Payment_Advice_${payId}.pdf`,
      type: 'PDF',
      category: 'PAYMENT',
      associatedTransactionId: payData.requirementId,
      customerOrVendorName: payData.vendorName,
      uploadedAt: new Date().toLocaleString(),
      size: '512 KB',
      url: '#',
    };
    setDocuments((prev) => [docRecord, ...prev]);

    pushAudit('PAYMENT_DISBURSED', 'PaymentRecord', payId, `Payment of ₹${payData.amountPaid.toLocaleString('en-IN')} released via ${payData.paymentMode} ref: ${payData.transactionReference}`);
    pushNotification(
      'Payment Released to Vendor',
      `Payment of ₹${payData.amountPaid.toLocaleString('en-IN')} released for ${payData.requirementId}. Vendor may proceed with dispatch.`,
      'SUCCESS',
      ['VENDOR', 'SUPER_ADMIN'],
      'payments',
      payId
    );

    fetchApi('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPay),
    }).catch((err) => console.warn('[API] Payment sync warning:', err));
    pushMutationToCloud({ payments: nextPayments });

    return newPay;
  };

  // Record Dispatch
  const recordDispatch = (dspData: {
    vendorPoId: string;
    requirementId: string;
    vendorId: string;
    vendorName: string;
    dispatchDate: string;
    vendorInvoiceNumber: string;
    transporter: string;
    courierName?: string;
    lrNumber: string;
    awbNumber: string;
    trackingNumber: string;
    quantityDispatched: string;
    expectedDeliveryDate: string;
    remarks?: string;
  }): DispatchRecord => {
    const year = new Date().getFullYear();
    const dspId = generateCollisionSafeYearlyId('DSP', year, dispatches);

    const newDsp: DispatchRecord = {
      ...dspData,
      id: dspId,
    };

    const nextDispatches = [newDsp, ...dispatches];
    setDispatches(nextDispatches);
    try {
      localStorage.setItem('erp_live_dispatches', JSON.stringify(nextDispatches));
    } catch {}
    updateRequirementStage(dspData.requirementId, 'DISPATCHED');

    const docRecord: DocumentRecord = {
      id: `DOC-${Date.now().toString().slice(-5)}`,
      name: `Lorry_Receipt_LR_${dspData.lrNumber}.pdf`,
      type: 'PDF',
      category: 'DISPATCH',
      associatedTransactionId: dspData.requirementId,
      customerOrVendorName: dspData.vendorName,
      uploadedAt: new Date().toLocaleString(),
      size: '1.1 MB',
      url: '#',
    };
    setDocuments((prev) => [docRecord, ...prev]);

    pushAudit('CONSIGNMENT_DISPATCHED', 'DispatchRecord', dspId, `Order dispatched by ${dspData.vendorName} via ${dspData.transporter} LR: ${dspData.lrNumber}`);
    pushNotification(
      'Consignment Dispatched!',
      `Order ${dspData.requirementId} dispatched via ${dspData.transporter}. Tracking #: ${dspData.trackingNumber || dspData.lrNumber}`,
      'INFO',
      ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE', 'CUSTOMER'],
      'dispatch',
      dspId
    );

    fetchApi('/api/dispatches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDsp),
    }).catch((err) => console.warn('[API] Dispatch sync warning:', err));
    pushMutationToCloud({ dispatches: nextDispatches });

    return newDsp;
  };

  // Delivery & Tracking Update
  const updateDeliveryTracking = (delData: {
    dispatchId: string;
    requirementId: string;
    deliveryDate: string;
    receivedBy: string;
    customerAcknowledgement: string;
    status: any;
    remarks?: string;
  }): DeliveryRecord => {
    const year = new Date().getFullYear();
    const delId = generateCollisionSafeYearlyId('DEL', year, deliveries);

    const newDel: DeliveryRecord = {
      ...delData,
      id: delId,
    };

    const existingIdx = deliveries.findIndex((d) => d.requirementId === delData.requirementId);
    const nextDeliveries =
      existingIdx >= 0
        ? deliveries.map((d, idx) => (idx === existingIdx ? newDel : d))
        : [newDel, ...deliveries];
    setDeliveries(nextDeliveries);
    try {
      localStorage.setItem('erp_live_deliveries', JSON.stringify(nextDeliveries));
    } catch {}

    updateRequirementStage(delData.requirementId, delData.status);

    pushAudit('DELIVERY_STATUS_UPDATED', 'DeliveryRecord', delId, `Delivery status for ${delData.requirementId} set to ${delData.status} by ${currentUser.name}`);
    pushNotification(
      `Shipment Update: ${delData.status}`,
      `Order ${delData.requirementId} status updated to ${delData.status}.`,
      delData.status === 'DELIVERED' ? 'SUCCESS' : 'INFO',
      ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE', 'CUSTOMER'],
      'delivery',
      delId
    );

    fetchApi('/api/deliveries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDel),
    }).catch(() => {});
    pushMutationToCloud({ deliveries: nextDeliveries });

    return newDel;
  };

  // Close Order
  const closeOrder = (requirementId: string, remarks?: string) => {
    updateRequirementStage(requirementId, 'ORDER_CLOSED');
    pushAudit('ORDER_CLOSED', 'CustomerRequirement', requirementId, `Order ${requirementId} fully completed, accounts reconciled, and closed. ${remarks || ''}`);
    pushNotification(
      'Order Successfully Closed',
      `Order ${requirementId} has been successfully closed with complete audit trail.`,
      'SUCCESS',
      ['SUPER_ADMIN', 'ACCOUNTS_USER'],
      'orders',
      requirementId
    );
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const addDocument = (docData: Omit<DocumentRecord, 'id' | 'uploadedAt'>) => {
    const newDoc: DocumentRecord = {
      ...docData,
      id: `DOC-${Date.now().toString().slice(-5)}`,
      uploadedAt: new Date().toLocaleString(),
    };
    setDocuments((prev) => [newDoc, ...prev]);
  };

  // Helper to get linked chain of documents and stages for any requirement
  const getLinkedOrderData = (requirementId: string) => {
    const req = requirements.find((r) => r.id === requirementId);
    const rfq = rfqs.find((r) => r.requirementId === requirementId);
    const quotes = vendorQuotes.filter(
      (v) =>
        v.requirementId === requirementId ||
        v.enquiryId === requirementId ||
        (rfq && (v.requirementId === rfq.id || v.enquiryId === rfq.id))
    );
    const quotation = customerQuotations.find((q) => q.requirementId === requirementId);
    const cpo = customerPOs.find((c) => c.requirementId === requirementId);
    const vpo = vendorPOs.find((v) => v.requirementId === requirementId);
    const pi = proformaInvoices.find((p) => p.requirementId === requirementId);
    const pay = payments.find((p) => p.requirementId === requirementId);
    const dsp = dispatches.find((d) => d.requirementId === requirementId);
    const del = deliveries.find((d) => d.requirementId === requirementId);
    const docs = documents.filter((d) => d.associatedTransactionId === requirementId);

    const sellingVal = quotation?.grandTotal || (cpo ? cpo.poAmount : 0);
    const purchaseVal = vpo?.totalAmount || (pi ? pi.totalAmount : 0);
    const margin = sellingVal > 0 && purchaseVal > 0 ? sellingVal - purchaseVal : 0;
    const marginPct = sellingVal > 0 ? (margin / sellingVal) * 100 : 0;

    return {
      requirement: req,
      rfq,
      vendorQuotes: quotes,
      quotation,
      customerPo: cpo,
      vendorPo: vpo,
      proformaInvoice: pi,
      payment: pay,
      dispatch: dsp,
      delivery: del,
      documents: docs,
      financials: {
        sellingVal,
        purchaseVal,
        grossMargin: margin,
        marginPercent: marginPct,
      },
    };
  };

  // User Management & RBAC Module (Admin Master) — Persisted to Backend /api/users
  const addUser = (userData: Omit<User, 'id' | 'createdAt'>): User => {
    const newId = generateCollisionSafeSeqId('USR', availableUsers);
    const canonicalRole = normalizeUserRole(userData.role, userData.username, userData.email);
    const defaultPerms = userData.permissions || {
      modules: {
        dashboard: true,
        requirements: true,
        rfqs: true,
        rateComparison: true,
        quotations: true,
        customerPos: false,
        vendorPos: true,
        pi: true,
        payments: false,
        dispatch: true,
        delivery: true,
        customers: true,
        vendors: true,
        categories: true,
        materials: true,
        products: true,
        reports: true,
        documents: true,
        approvals: false,
        userManagement: false,
        auditTrail: false,
      },
      actions: {
        canView: true,
        canCreate: true,
        canEdit: false,
        canDelete: false,
        canApprove: false,
        canExport: true,
        canPrint: true,
        canDownload: true,
        canShare: false,
      },
    };
    const newUser: User = {
      ...userData,
      id: newId,
      role: canonicalRole,
      status: userData.status || 'ACTIVE',
      createdAt: new Date().toISOString().split('T')[0],
      lastLogin: 'Never',
      permissions: defaultPerms,
    };
    setAvailableUsers((prev) => [newUser, ...prev]);

    fetchApi('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newUser.name,
        email: newUser.email,
        username: newUser.username || newUser.email.split('@')[0],
        password: (userData as any).passwordHash || 'Welcome@123',
        role: canonicalRole,
        designation: newUser.designation || '',
        department: newUser.department || 'General',
        mobile: newUser.mobile,
        status: newUser.status,
        mustChangePassword: Boolean(newUser.forcePasswordChange),
        permissions: defaultPerms,
        approvalAuthority: {
          maxApprovalLimit: newUser.approvalLimit ?? 0,
        },
        createdBy: currentUser.name,
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        return data;
      })
      .then((data) => {
        if (data?.user?.id) {
          setAvailableUsers((prev) =>
            prev.map((u) =>
              u.id === newId
                ? {
                    ...u,
                    ...data.user,
                    role: normalizeUserRole(data.user.role, data.user.username, data.user.email),
                    approvalLimit: data.user.approvalLimit ?? data.user.approvalAuthority?.maxApprovalLimit ?? u.approvalLimit,
                  }
                : u
            )
          );
        }
      })
      .catch((err) => {
        console.warn('[UserMgmt] Failed to persist new user to backend:', err?.message || err);
        pushNotification(
          'User Sync Warning',
          `Could not verify backend save for ${newUser.name}: ${err?.message || 'Network error'}`,
          'WARNING',
          ['SUPER_ADMIN']
        );
      });

    pushAudit('USER_CREATED', 'USER', newId, `Administrator created user ${newUser.name} (${canonicalRole})`);
    pushNotification(
      'New User Provisioned',
      `Account created for ${newUser.name} [${canonicalRole}].`,
      'SUCCESS',
      ['SUPER_ADMIN']
    );
    return newUser;
  };

  const updateUser = (updated: User) => {
    const normalizedUpdated: User = {
      ...updated,
      role: normalizeUserRole(updated.role, updated.username, updated.email),
    };
    setAvailableUsers((prev) => prev.map((u) => (u.id === normalizedUpdated.id ? normalizedUpdated : u)));
    if (currentUser.id === normalizedUpdated.id) {
      setCurrentUser(normalizedUpdated);
      localStorage.setItem('procure_user', JSON.stringify(normalizedUpdated));
    }
    fetchApi(`/api/users/${encodeURIComponent(normalizedUpdated.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...normalizedUpdated,
        approvalAuthority: { maxApprovalLimit: normalizedUpdated.approvalLimit ?? 0 },
        updatedBy: currentUser.name,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
      })
      .catch((err) => {
        console.warn('[UserMgmt] Failed to update user on backend:', err?.message || err);
      });
    pushAudit('USER_UPDATED', 'USER', normalizedUpdated.id, `Profile/permissions updated for ${normalizedUpdated.name}`);
    pushNotification('User Updated', `Account details for ${normalizedUpdated.name} were updated.`, 'INFO', ['SUPER_ADMIN']);
  };

  const deleteUser = (id: string): { success: boolean; message: string } => {
    if (id === currentUser.id) {
      return { success: false, message: 'Cannot delete the currently logged-in user account.' };
    }
    const target = availableUsers.find((u) => u.id === id);
    if (!target) return { success: false, message: 'User not found.' };
    setAvailableUsers((prev) => prev.filter((u) => u.id !== id));
    fetchApi(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
      })
      .catch((err) => {
        console.warn('[UserMgmt] Failed to delete user on backend:', err?.message || err);
      });
    pushAudit('USER_DELETED', 'USER', id, `Removed user account ${target.name} (${target.email})`);
    pushNotification('User Removed', `User ${target.name} was removed from the system.`, 'WARNING', ['SUPER_ADMIN']);
    return { success: true, message: `User ${target.name} removed successfully.` };
  };

  const toggleUserStatus = (id: string) => {
    const target = availableUsers.find((u) => u.id === id);
    if (!target) return;
    const nextStatus = target.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setAvailableUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: nextStatus } : u))
    );
    fetchApi(`/api/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus, updatedBy: currentUser.name }),
    }).catch((err) => {
      console.warn('[UserMgmt] Failed to toggle user status on backend:', err?.message || err);
    });
    pushAudit('USER_STATUS_CHANGED', 'USER', id, `Changed status of ${target.name} to ${nextStatus}`);
  };

  const resetUserPassword = (id: string, tempPass = 'Mro@Temp2026') => {
    const target = availableUsers.find((u) => u.id === id);
    if (!target) return { success: false, message: 'User not found.', tempPass: '' };

    setAvailableUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
              ...u,
              forcePasswordChange: true,
              passwordHash: tempPass,
              failedLoginAttempts: 0,
            }
          : u
      )
    );
    fetchApi(`/api/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: tempPass, mustChangePassword: true, updatedBy: currentUser.name }),
    }).catch((err) => {
      console.warn('[UserMgmt] Failed to persist password reset on backend:', err?.message || err);
    });
    pushAudit('PASSWORD_RESET', 'USER', id, `Temporary password reset generated for ${target.name}`);
    pushNotification('Password Reset', `Password reset for ${target.name}. Temp password: ${tempPass}`, 'INFO', ['SUPER_ADMIN']);
    return { success: true, message: `Password reset successfully. Temporary password: ${tempPass}`, tempPass };
  };

  const changeUserPassword = (userId: string, currentPass: string, newPass: string) => {
    const user = availableUsers.find((u) => u.id === userId);
    if (!user) return { success: false, message: 'User not found.' };
    if (!newPass || newPass.length < 6) return { success: false, message: 'New password must be at least 6 characters.' };

    setAvailableUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              forcePasswordChange: false,
              passwordHash: newPass,
              failedLoginAttempts: 0,
            }
          : u
      )
    );
    fetchApi('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, currentPassword: currentPass, newPassword: newPass }),
    }).catch((err) => {
      console.warn('[UserMgmt] Failed to sync password change to backend:', err?.message || err);
    });
    pushAudit('PASSWORD_CHANGED', 'USER', userId, `User ${user.name} changed account password`);
    return { success: true, message: 'Password updated successfully!' };
  };

  const updateUserPermissions = (userId: string, permissions: NonNullable<User['permissions']>, approvalLimit?: number) => {
    setAvailableUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const updated = {
            ...u,
            permissions,
            approvalLimit: approvalLimit !== undefined ? approvalLimit : u.approvalLimit,
          };
          if (currentUser.id === userId) {
            setCurrentUser(updated);
            localStorage.setItem('procure_user', JSON.stringify(updated));
          }
          return updated;
        }
        return u;
      })
    );
    fetchApi(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        permissions,
        ...(approvalLimit !== undefined ? { approvalAuthority: { maxApprovalLimit: approvalLimit } } : {}),
        updatedBy: currentUser.name,
      }),
    }).catch((err) => {
      console.warn('[UserMgmt] Failed to update user permissions on backend:', err?.message || err);
    });
    pushAudit('PERMISSIONS_UPDATED', 'USER', userId, `Updated access permissions matrix`);
  };

  const refreshUsersFromBackend = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetchApi('/api/users');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data?.error || `Server returned HTTP ${res.status}` };
      }
      if (Array.isArray(data?.users) && data.users.length > 0) {
        const normalizedUsers: User[] = data.users.map((u: any) => ({
          ...u,
          role: normalizeUserRole(u.role, u.username, u.email),
          approvalLimit: u.approvalLimit ?? u.approvalAuthority?.maxApprovalLimit ?? 0,
        }));
        setAvailableUsers(normalizedUsers);
        try {
          localStorage.setItem('mro_users', JSON.stringify(normalizedUsers));
        } catch {}
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unable to fetch users from server.' };
    }
  };

  const syncBackendNow = async () => {
    try {
      setIsSyncing(true);
      if (syncBackendStateRef.current) {
        await syncBackendStateRef.current({ force: true, notify: true });
      }
      await probeSupabaseBackendStatus();
    } catch (err) {
      console.warn('syncBackendNow notice:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const exportTeamSyncSnapshot = (): string => {
    const snapshot = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: currentUser.name,
      requirements,
      companies,
      purchaseExecutives,
      customers,
      vendors,
      products,
      vendorQuotes,
      customerQuotations,
      customerPOs,
      vendorPOs,
      vendorProductMappings,
      productTypes,
    };
    return JSON.stringify(snapshot, null, 2);
  };

  const importTeamSyncSnapshot = (raw: string): { success: boolean; count: number; message: string } => {
    try {
      let data: any;
      const clean = raw.trim();
      if (clean.startsWith('{')) {
        data = JSON.parse(clean);
      } else {
        const decoded = atob(clean);
        data = JSON.parse(decoded);
      }

      let reqCount = 0;
      if (Array.isArray(data.requirements) && data.requirements.length > 0) {
        setRequirements(data.requirements);
        try {
          localStorage.setItem('erp_live_requirements', JSON.stringify(data.requirements));
        } catch {}
        reqCount = data.requirements.length;
      }
      if (Array.isArray(data.companies) && data.companies.length > 0) {
        setCompanies(data.companies);
        try {
          localStorage.setItem('erp_live_companies', JSON.stringify(data.companies));
        } catch {}
      }
      if (Array.isArray(data.purchaseExecutives) && data.purchaseExecutives.length > 0) {
        setPurchaseExecutives(data.purchaseExecutives);
        try {
          localStorage.setItem('erp_live_purchase_executives', JSON.stringify(data.purchaseExecutives));
        } catch {}
      }
      if (Array.isArray(data.customers) && data.customers.length > 0) {
        setCustomers(data.customers);
        try {
          localStorage.setItem('erp_live_customers', JSON.stringify(data.customers));
        } catch {}
      }
      if (Array.isArray(data.vendors) && data.vendors.length > 0) {
        setVendors(data.vendors);
        try {
          localStorage.setItem('erp_live_vendors', JSON.stringify(data.vendors));
        } catch {}
      }
      if (Array.isArray(data.products) && data.products.length > 0) {
        setProducts(data.products);
        try {
          localStorage.setItem('erp_live_products', JSON.stringify(data.products));
        } catch {}
      }
      if (Array.isArray(data.vendorQuotes) && data.vendorQuotes.length > 0) {
        setVendorQuotes(data.vendorQuotes);
      }
      if (Array.isArray(data.quotations) && data.quotations.length > 0) {
        setCustomerQuotations(data.quotations);
      }
      if (Array.isArray(data.customerPos) && data.customerPos.length > 0) {
        setCustomerPOs(data.customerPos);
      }
      if (Array.isArray(data.vendorPos) && data.vendorPos.length > 0) {
        setVendorPOs(data.vendorPos);
      }
      if (Array.isArray(data.vendorProductMappings) && data.vendorProductMappings.length > 0) {
        setVendorProductMappings(data.vendorProductMappings);
      }
      if (Array.isArray(data.productTypes) && data.productTypes.length > 0) {
        setProductTypes(data.productTypes);
      }

      pushMutationToCloud({ ...data, __fullSnapshot: true });
      setLastSyncTime(new Date());

      pushNotification(
        'Team Sync Complete',
        `Synchronized ${reqCount} requirements & company masters from team snapshot.`,
        'SUCCESS',
        ['SUPER_ADMIN', 'PROCUREMENT_EMPLOYEE']
      );

      return {
        success: true,
        count: reqCount,
        message: `Successfully synchronized ${reqCount} requirements & company master data!`,
      };
    } catch (err: any) {
      return {
        success: false,
        count: 0,
        message: `Import failed: ${err.message || 'Invalid sync data format'}`,
      };
    }
  };

  const pushDeviceDataToCentralDb = async () => {
    try {
      const payload = {
        requirements,
        companies,
        purchaseExecutives,
        vendors,
        products,
        quotations: customerQuotations,
        customerPos: customerPOs,
        vendorPos: vendorPOs,
        payments,
        dispatches,
        vendorProductMappings,
        productTypes,
      };
      const res = await fetchApi('/api/sync/full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: payload, user: currentUser.name }),
      });

      if (res.ok) {
        await probeSupabaseBackendStatus();
        return {
          success: true,
          message: cloudSyncState.connected
            ? 'All business records synchronized with Supabase PostgreSQL.'
            : 'Workspace state synchronized with server backend.',
        };
      }
      return { success: false, message: 'Failed to upload to central database.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Sync error' };
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        availableUsers,
        isMobileView,
        setIsMobileView,
        activeTab,
        setActiveTab,
        selectedOrderId,
        setSelectedOrderId,
        customers,
        companies,
        purchaseExecutives,
        vendors,
        archivedVendors,
        products,
        requirements,
        rfqs,
        vendorQuotes,
        customerQuotations,
        customerPOs,
        vendorPOs,
        proformaInvoices,
        payments,
        dispatches,
        deliveries,
        notifications,
        auditLogs,
        documents,
        addCustomer,
        addCompany,
        updateCompany,
        deleteCompany,
        addPurchaseExecutive,
        updatePurchaseExecutive,
        deletePurchaseExecutive,
        getExecutivesByCompany,
        updateRequirement,
        deleteRequirement,
        deleteRfq,
        purgeRfq,
        purgeAllDeletedRfqs,
        catalogueProducts,
        rateVersionHistory,
        importBatches,
        fetchCatalogueRateMatch,
        fetchRateHistory,
        importVersionedCatalogue,
        rollbackImportBatch,
        restoreRequirement,
        purgeRequirement,
        purgeAllOldTransactions,

        purgeAllVendors,
        cleanSlateForRealBusiness,
        addVendor,
        addProduct,
        addProductsBulk,
        addRequirement,
        sendVendorEnquiry,
        createRfq,
        createBulkRfqs,
        submitVendorQuote,
        updateVendorQuote,
        deleteVendorQuote,
        getRateCompletionStatus,
        createCustomerQuotation,
        recordCustomerPO,
        createVendorPO,
        submitProformaInvoice,
        recordPayment,
        recordDispatch,
        updateDeliveryTracking,
        closeOrder,
        markNotificationRead,
        markAllNotificationsRead,
        pushNotification,
        addDocument,
        getLinkedOrderData,
        dataMode,
        setDataMode,
        copyDemoToLocalBusiness,
        resetCurrentModeData,
        exportFullBackup,
        restoreFullBackup,
        updateCustomer,
        deleteCustomer,
        importCustomersList,
        updateVendor,
        deleteVendor,
        restoreVendor,
        permanentlyDeleteVendor,
        purgeArchivedVendors,
        importVendorsList,
        updateProduct,
        deleteProduct,
        restoreProduct,
        importProductsList,
        lockQuotationCommercials,
        unlockQuotationCommercials,
        categories,
        addCategory,
        updateCategory,
        deleteCategory,
        toggleCategoryStatus,
        addKeywordToCategory,
        bulkImportRequirements,
        assignVendorToRequirementItem,
        brands,
        addBrand,
        updateBrand,
        deleteBrand,
        archiveBrand,
        registerVendorBrands,
        aiActivityLogs,
        analyzeVendorCatalogFiles,
        approveVendorMaterialCategory,
        rejectVendorMaterialCategory,
        editVendorMaterialCategory,
        approveAllVendorMaterialCategories,
        approveVendorCatalogProduct,
        rejectVendorCatalogProduct,
        learnCategoryFromVendorQuotation,
        deleteVendorCatalogFile,
        saveCatalogAnalysisToVendor,
        analyzeVendorWebsite,
        manageVendorCatalogueBatch,
        analyzeVendorOnboarding,
        getVendorCatalogueConfig,
        uploadCatalogueFileInChunks,
        startVendorOnboardingJob,
        pollVendorOnboardingJob,
        fetchVendorOnboardingJobResult,
        cancelVendorOnboardingJob,
        listVendorOnboardingJobs,
        commitVendorOnboarding,
        vendorProductMappings,
        addVendorProductMapping,
        updateVendorProductMapping,
        deleteVendorProductMapping,
        bulkAddVendorProductMappings,
        productTypes,
        addProductTypeToMaster,
        addProductTypeToVendor,
        removeProductTypeFromVendor,
        backups,
        backupSettings,
        updateBackupSettings: updateBackupSettingsState,
        triggerManualBackup,
        restoreFromBackupRecord,
        testBackupRecord,
        backupFailureAlert,
        clearBackupFailureAlert,
        addUser,
        updateUser,
        deleteUser,
        toggleUserStatus,
        resetUserPassword,
        changeUserPassword,
        updateUserPermissions,
        refreshUsersFromBackend,
        syncBackendNow,
        pushDeviceDataToCentralDb,
        exportTeamSyncSnapshot,
        importTeamSyncSnapshot,
        isSyncing,
        lastSyncTime,
        isOnline,
        cloudSyncState,
        connectCloudDatabase,
        disconnectCloudDatabase,
        inviteCloudTeammate,
        removeCloudTeammate,
        branding,
        updateBranding,
        theme,
        updateTheme,
        brandDiscounts,
        saveBulkBrandDiscounts,
        catalogueImportHistory,
        confirmedAiMappings,
        mappingTemplates,
        importCatalogueBatch,
        saveConfirmedAiMapping,
        saveColumnMappingTemplate,
        fetchCatalogueImportHistory,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
