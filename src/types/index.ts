export type UserRole =
  | 'SUPER_ADMIN'
  | 'PROCUREMENT_EMPLOYEE'
  | 'PURCHASE_MANAGER'
  | 'APPROVAL_USER'
  | 'ACCOUNTS_USER'
  | 'STORE_USER'
  | 'MANAGEMENT_VIEWER'
  | 'SALES_EXECUTIVE'
  | 'VENDOR'
  | 'CUSTOMER';

export type DataMode = 'DEMO' | 'LOCAL_BUSINESS' | 'LIVE_ENTERPRISE';

export interface ModulePermissions {
  dashboard: boolean;
  requirements: boolean;
  rfqs: boolean;
  rateComparison: boolean;
  quotations: boolean;
  customerPos: boolean;
  vendorPos: boolean;
  pi: boolean;
  payments: boolean;
  dispatch: boolean;
  delivery: boolean;
  customers: boolean;
  vendors: boolean;
  categories: boolean;
  materials: boolean;
  products: boolean;
  reports: boolean;
  documents: boolean;
  approvals: boolean;
  userManagement: boolean;
  auditTrail: boolean;
}

export interface ActionPermissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canExport: boolean;
  canPrint: boolean;
  canDownload: boolean;
  canShare: boolean;
}

export interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  mobile: string;
  designation?: string;
  department?: string;
  role: UserRole;
  companyName?: string;
  associatedId?: string; // vendorId or customerId if role is VENDOR or CUSTOMER
  avatar?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  forcePasswordChange?: boolean;
  mustChangePassword?: boolean;
  passwordHash?: string;
  failedLoginAttempts?: number;
  createdAt?: string;
  lastLogin?: string;
  permissions?: {
    modules: ModulePermissions;
    actions: ActionPermissions;
  };
  approvalLimit?: number;
}

export type OrderWorkflowStage =
  | 'NEW_REQUIREMENT'
  | 'ENQUIRY_SENT'
  | 'RATE_RECEIVED'
  | 'QUOTATION_SENT'
  | 'PO_RECEIVED'
  | 'VENDOR_ORDER_PLACED'
  | 'PI_RECEIVED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_PARTIAL'
  | 'PAYMENT_DONE'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'ORDER_CLOSED'
  | 'CANCELLED';

export interface Customer {
  id: string; // e.g. CUST-001
  companyName: string;
  contactPerson: string;
  mobile: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  pan: string;
  paymentTerms: string;
  deliveryAddress: string;
  remarks?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  companyCode?: string;
  gstNumber?: string;
  documents?: { name: string; type: string; url: string; date: string }[];
  createdAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletedReason?: string;
}

export interface Company {
  id: string; // e.g. CMP-001 or CUST-001
  companyCode: string; // auto-generated e.g. CMP-001
  companyName: string; // required
  gstin: string; // GST Number
  gstNumber?: string; // alias
  address: string; // Company Address
  city: string;
  state: string;
  pincode: string;
  status: 'ACTIVE' | 'INACTIVE';
  remarks?: string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  pan?: string;
  paymentTerms?: string;
  deliveryAddress?: string;
  createdAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletedReason?: string;
}

export interface PurchaseExecutive {
  id: string; // e.g. PE-001
  companyId: string; // references Company.id
  companyName: string; // company name cache
  name: string; // Purchase Executive Name (required)
  designation: string; // e.g. Purchase Executive, Senior Purchase Executive, Procurement Manager
  mobile: string; // Mobile Number
  email?: string; // Email Address (optional)
  department: string; // Department
  status: 'ACTIVE' | 'INACTIVE';
  remarks?: string;
  createdAt: string;
  updatedAt?: string;
}


export interface VendorSupplyHistoryItem {
  id: string;
  requirementId: string;
  itemName: string;
  category: string;
  quantity: number;
  rateSupplied: number;
  transactionDate: string;
  poReference?: string;
  quotationReference?: string;
}

export interface Vendor {
  id: string; // e.g. VEND-001
  companyName: string;
  contactPerson: string;
  mobile: string;
  alternateMobile?: string;
  email: string;
  address: string;
  city: string;
  state: string;
  country?: string;
  pincode?: string;
  gstin: string;
  pan: string;
  bankDetails: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    ifscCode: string;
    branch: string;
  };
  paymentTerms: string;
  creditPeriod?: string;
  deliveryTerms: string;
  productCategories: string[]; // for backwards compatibility
  materialCategories?: string[]; // multi-select material categories
  subCategories?: string[];
  materialsDealtIn?: string; // materials dealt in description or tags
  notes?: string; // vendor notes
  vendorName?: string; // alias for companyName
  catalogFileName?: string;
  catalogFileSize?: string;
  catalogUploadDate?: string;
  catalogFileUrl?: string;
  keywords?: string[];
  brandsSupplied: string[];
  rating: number; // 1 to 5
  msmeStatus?: string; // Micro / Small / Medium / None
  status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  remarks?: string;
  createdAt: string;
  updatedAt?: string;
  vendorCode?: string; // e.g. VND-001 or SUP-01
  supplyHistory?: VendorSupplyHistoryItem[];
  lastContactedDate?: string;
  catalogFiles?: VendorCatalogFile[];
  catalogProducts?: VendorCatalogProduct[];
  productsSupplied?: VendorProductMapping[];
  parsedProducts?: ParsedVendorProduct[];
  aiMaterialCategories?: VendorMaterialCategory[];
  lastAiAnalysisDate?: string;
  website?: string;
  legalName?: string;
  vendorType?: string;
  vendorProfile?: {
    summary?: string;
    capabilities?: string[];
    certifications?: string[];
    authorizedDistributorOf?: string[];
    dealsInBrands?: string[];
    specializations?: string[];
  };
  brandsDealing?: string[];
  productFamilies?: string[];
  productTypesDealing?: string[];
  manufacturerAssociations?: Array<{
    brand: string;
    relationship: 'Authorised Distributor' | 'Distributor' | 'Deals In' | 'Supplies' | 'Listed In Catalogue' | 'Mentions';
    confidence?: number;
    evidence?: string;
    source?: string;
  }>;
  websiteUrls?: string[];
  lastWebsiteAnalysisDate?: string;
  intelligenceScore?: number;
  intelligenceScoreBreakdown?: {
    catalogueAvailable: number;
    websiteAvailable: number;
    productsIdentified: number;
    brandsIdentified: number;
    partCodesIdentified: number;
    specificationsIdentified: number;
    recentlyVerified: number;
    explanations?: string[];
  };
  intelligenceConfidence?: number | 'HIGH' | 'MEDIUM' | 'LOW';
  dataSources?: Array<
    | string
    | {
        type: 'CATALOGUE' | 'WEBSITE' | 'MANUAL';
        name: string;
        urlOrPath?: string;
        date: string;
        itemsExtracted: number;
      }
  >;
  analysisStatus?: 'NOT_ANALYZED' | 'ANALYZING' | 'ANALYZED' | 'NEEDS_REVIEW';
  catalogueBatches?: CatalogueBatchSummary[];
  websiteIntelligence?: WebsiteAnalysisResult;
  verifiedBy?: string;
  contacts?: VendorContact[];
  structuredAddress?: VendorStructuredAddress;
  landline?: string;
  whatsapp?: string;
  brandAssociations?: BrandAssociationDetail[];
  sourceTraceability?: OnboardingSourceTrace[];
  onboardingSourcesSummary?: Array<{
    sourceType: OnboardingSourceType;
    sourceName: string;
    analyzedAt: string;
    itemsExtracted?: number;
  }>;
  profileCompletionScore?: number;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletedReason?: string;
}

export type OnboardingSourceType =
  | 'WEBSITE'
  | 'GST_DOC'
  | 'BROCHURE'
  | 'CATALOGUE'
  | 'EXCEL'
  | 'COMPANY_PROFILE'
  | 'BUSINESS_CARD'
  | 'IMAGE'
  | 'TEXT'
  | 'MANUAL';

export type BrandRelationshipType =
  | 'Deals In'
  | 'Supplies'
  | 'Distributes'
  | 'Dealer'
  | 'Distributor'
  | 'Authorised Distributor'
  | 'OEM'
  | 'Manufacturer'
  | 'System Integrator'
  | 'Service Provider'
  | 'Listed In Catalogue'
  | 'Mentions';

export interface VendorContact {
  id: string;
  name: string;
  department?: 'Sales' | 'Purchase' | 'Support' | 'Service' | 'Accounts' | 'General';
  designation?: string;
  email?: string;
  mobile?: string;
  alternateMobile?: string;
  landline?: string;
  whatsapp?: string;
  isPrimary: boolean;
  source?: string;
  confidence?: number;
}

export interface VendorStructuredAddress {
  plotOrBuilding?: string;
  street?: string;
  industrialEstateOrArea?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  rawAddress: string;
  splitConfidence: number;
  source?: string;
}

export interface OnboardingSourceTrace {
  field: string;
  label?: string;
  value: string;
  sourceType: OnboardingSourceType;
  sourceName: string;
  confidence: number;
  evidence?: string;
}

export interface OnboardingConflictCandidate {
  value: string;
  sourceType: OnboardingSourceType;
  sourceName: string;
  priority: number;
  confidence: number;
}

export interface OnboardingConflict {
  field: string;
  label: string;
  recommendedValue: string;
  candidates: OnboardingConflictCandidate[];
  resolvedValue?: string;
}

export interface BrandAssociationDetail {
  brandId?: string;
  brandName: string;
  relationshipType: BrandRelationshipType;
  productCount: number;
  source: string;
  confidence: number;
  firstDetected: string;
  lastVerified: string;
  evidence?: string;
  isExistingMaster?: boolean;
  ambiguousMatches?: Array<{ id: string; name: string; score: number }>;
  resolutionAction?: 'USE_EXISTING' | 'CREATE_NEW' | 'REVIEW' | 'SKIP';
}

export interface CategoryHierarchyDetection {
  id: string;
  category: string;
  subCategory?: string;
  productFamily?: string;
  productType?: string;
  specificationPattern?: string;
  brands: string[];
  productCount: number;
  confidence: number;
  matchedCategoryId?: string;
  isExistingMaster: boolean;
  source: string;
  selected: boolean;
}

export interface DuplicateVendorCandidate {
  vendorId: string;
  vendorCode: string;
  companyName: string;
  legalName?: string;
  gstin?: string;
  pan?: string;
  city?: string;
  website?: string;
  similarityScore: number;
  matchedOn: string[];
}

export interface OnboardingProductCandidate extends Omit<VendorCatalogProduct, 'id'> {
  tempId: string;
  accepted: boolean;
  matchedProductName?: string;
  matchedPartNumber?: string;
  sourceFile?: string;
  sourcePages?: Array<number | string>;
}

export interface VendorCatalogueConfig {
  maxFileSizeMb: number;
  maxFileSizeBytes: number;
  uploadChunkSizeBytes: number;
  maxPagesPerPdfChunk: number;
  allowedExtensions: string[];
  allowedFormatsLabel: string;
}

export type VendorImportJobStatus =
  | 'UPLOADING'
  | 'PROCESSING'
  | 'VALIDATING'
  | 'READY_FOR_REVIEW'
  | 'COMMITTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface VendorImportJob {
  jobId: string;
  status: VendorImportJobStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  fileName: string;
  fileSizeBytes: number;
  filesSummary: Array<{ name: string; size: number; mimeType: string; sourceRole?: string }>;
  totalPages: number;
  pagesProcessed: number;
  ocrPagesProcessed: number;
  productsDetected: number;
  validCount: number;
  reviewRequiredCount: number;
  rejectedCount: number;
  currentStage: string;
  progressPercent: number;
  error?: string;
  warnings: string[];
  committedVendorId?: string;
}

export interface OnboardingCompletionSummary {
  overallPercent: number;
  requiredPercent: number;
  optionalPercent: number;
  missingRequiredFields: Array<{
    field: string;
    label: string;
    reason: 'MISSING' | 'LOW_CONFIDENCE' | 'CONFLICT';
    confidence?: number;
  }>;
  lowConfidenceFields: string[];
  counts: {
    contacts: number;
    brands: number;
    categories: number;
    productFamilies: number;
    products: number;
  };
}

export interface VendorOnboardingAnalysisResult {
  analysisId: string;
  importJobId?: string;
  analyzedAt: string;
  sourcesAnalyzed: Array<{
    sourceType: OnboardingSourceType;
    sourceName: string;
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
    itemsExtracted: number;
    note?: string;
  }>;
  company: {
    companyName: string;
    legalName: string;
    tradingNames: string[];
    vendorType: string;
    website: string;
    gstin: string;
    pan: string;
    country: string;
    msmeStatus: string;
    paymentTerms: string;
    creditPeriod: string;
    deliveryTerms: string;
    summary: string;
  };
  structuredAddress: VendorStructuredAddress;
  contacts: VendorContact[];
  brands: BrandAssociationDetail[];
  categories: CategoryHierarchyDetection[];
  productFamilies: string[];
  products: OnboardingProductCandidate[];
  conflicts: OnboardingConflict[];
  duplicates: DuplicateVendorCandidate[];
  sourceTraceability: OnboardingSourceTrace[];
  completion: OnboardingCompletionSummary;
  warnings: string[];
  extractionMethods: string[];
  websiteIntelligence?: any;
  suspiciousItems?: Array<{
    id: string;
    rawText: string;
    contentClass: string;
    rejectionCategory: string;
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
  }>;
  extractionSummary?: {
    totalDetected: number;
    validCount: number;
    reviewCount: number;
    rejectedCount: number;
  };
  spreadsheetPreview?: {
    headers: string[];
    autoMapping: Record<string, string>;
    sampleRows: string[][];
  };
  cacheHit?: boolean;
}

export interface VendorOnboardingCommitPayload {
  mode: 'CREATE' | 'UPDATE';
  targetVendorId?: string;
  importJobId?: string;
  company: VendorOnboardingAnalysisResult['company'] & {
    status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
    remarks?: string;
    bankName?: string;
    bankAccount?: string;
    bankIfsc?: string;
  };
  structuredAddress: VendorStructuredAddress;
  contacts: VendorContact[];
  brands: BrandAssociationDetail[];
  categories: CategoryHierarchyDetection[];
  productFamilies: string[];
  products: OnboardingProductCandidate[];
  sourceTraceability: OnboardingSourceTrace[];
  sourcesSummary: VendorOnboardingAnalysisResult['sourcesAnalyzed'];
  websiteUrl?: string;
  websiteIntelligence?: Partial<WebsiteAnalysisResult>;
  createMissingProductsInMaster?: boolean;
  userName?: string;
  userRole?: string;
}

export interface CatalogueBatchSummary {
  id?: string;
  batchId?: string;
  vendorId?: string;
  fileName: string;
  sourceType?: string;
  version: string;
  uploadDate?: string;
  uploadedAt?: string;
  uploadedBy: string;
  effectiveDate?: string;
  status: 'CURRENT' | 'HISTORICAL' | 'ARCHIVED' | 'ROLLED_BACK';
  totalExtracted?: number;
  productsCount?: number;
  ratesCount?: number;
  newCount?: number;
  updatedCount?: number;
  unchangedCount?: number;
  rateChangedCount?: number;
  rateChangesCount?: number;
  removedCount?: number;
  brandsDetected?: string[];
  snapshotProductIds?: string[];
  notes?: string;
}

export interface BrandDetectionItem {
  name: string;
  productsCount: number;
  confidence: number;
  isExisting: boolean;
  matchedBrandId?: string;
  relationship: 'Authorised Distributor' | 'Distributor' | 'Deals In' | 'Supplies' | 'Listed In Catalogue' | 'Mentions';
  evidence?: string;
  confirmed?: boolean;
}

export interface WebsiteAnalysisResult {
  success?: boolean;
  url: string;
  finalUrl?: string;
  analyzedAt: string;
  pagesCrawled?: string[];
  crawledPages?: string[];
  title?: string;
  companyTitle?: string;
  companyOverview?: string;
  contactEmails?: string[];
  contactPhones?: string[];
  emails?: string[];
  phones?: string[];
  pdfLinks: Array<{ title: string; url: string }>;
  brandsDetected?: BrandDetectionItem[];
  categoriesDetected?: string[];
  productFamilies?: string[];
  extractedProducts?: Omit<VendorCatalogProduct, 'id'>[];
  suspiciousItems?: VendorOnboardingAnalysisResult['suspiciousItems'];
  extractionSummary?: VendorOnboardingAnalysisResult['extractionSummary'];
  cacheHit?: boolean;
  error?: string;
  warnings?: string[];
}

export interface CatalogueDiffSummary {
  totalExisting: number;
  totalIncoming: number;
  newProducts: Array<Omit<VendorCatalogProduct, 'id'>>;
  updatedProducts: Array<{
    existing: VendorCatalogProduct;
    incoming: Omit<VendorCatalogProduct, 'id'>;
    changes: string[];
  }>;
  changedRates: Array<{
    partNumber: string;
    productName: string;
    brand: string;
    oldMrp?: number;
    newMrp?: number;
    oldRate?: number;
    newRate?: number;
    deltaAmount: number;
    deltaPercent: number;
  }>;
  removedProducts: VendorCatalogProduct[];
  unchangedProducts: Array<Omit<VendorCatalogProduct, 'id'>>;
  newBrands: string[];
  newCategories: string[];
}

export interface ParsedVendorProduct {
  productName: string;
  category?: string;
  subCategory?: string;
  brand?: string;
  partNumber?: string;
  modelNumber?: string;
  specification?: string;
  uom?: string;
  approxRate?: number;
  hsnCode?: string;
  gstRate?: number;
  stockQty?: number;
  description?: string;
}

export interface VendorCatalogFile {
  id: string;
  vendorId: string;
  fileName: string;
  fileType: 'PDF' | 'EXCEL' | 'CSV' | 'WORD' | 'IMAGE' | 'SCANNED' | 'QUOTATION' | 'OTHER';
  fileSize?: string;
  fileUrl?: string;
  uploadDate: string;
  processingStatus: 'UPLOADED' | 'PROCESSING' | 'ANALYZED' | 'ERROR';
  aiAnalysisStatus: 'PENDING' | 'COMPLETED' | 'FAILED';
  productsIdentifiedCount: number;
  extractedTextSnippet?: string;
}

export interface VendorCatalogProduct {
  id: string;
  vendorId: string;
  catalogFileId?: string;
  catalogFileName?: string;
  productName: string;
  description: string;
  categoryId?: string;
  category: string;
  subCategoryId?: string;
  subCategory?: string;
  brand: string;
  manufacturer?: string;
  modelNumber?: string;
  partNumber?: string;
  specification?: string;
  size?: string;
  uom: string;
  keywords: string[];
  aiConfidence: number; // 0 - 100
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  isDuplicate?: boolean;
  duplicateOfId?: string;
  normalizedKey?: string;
  catalogReference?: string;
  evidence?: string;
  confidenceLevel?: 'High' | 'Medium' | 'Low';
  reviewStatus?: 'Verified' | 'Needs Review' | 'Unidentified';
  mrp?: number;
  rate?: number;
  basicRate?: number;
  listPrice?: number;
  discountPercent?: number;
  purchaseRate?: number;
  rateType?: string;
  currency?: string;
  effectiveDate?: string;
  sourcePage?: number | string;
  productFamily?: string;
  productType?: string;
  sourceType?: 'PDF' | 'IMAGE' | 'EXCEL' | 'WEBSITE' | 'MANUAL' | 'PDF+WEBSITE' | 'TEXT';
  sourceUrl?: string;
  matchedProductId?: string;
  matchPriority?: string;
  matchStatus?: 'EXACT_MATCH' | 'SIMILAR_MATCH' | 'REVIEW_REQUIRED' | 'AMBIGUOUS_MATCH' | 'NEW_PRODUCT';
  catalogueStatus?: 'ACTIVE' | 'NOT_PRESENT_IN_LATEST' | 'ARCHIVED' | 'DISCONTINUED';
  batchId?: string;
  batchVersion?: string;
  brandRelationship?: string;
  sourceProductName?: string;
  normalizedProductName?: string;
  productDesignation?: string;
  manufacturerCode?: string;
  application?: string;
  imageUrl?: string;
  detailUrl?: string;
  catalogueRow?: number;
  originalSourceText?: string;
  extractionDate?: string;
  aiAnalysisVersion?: string;
  contentClass?: string;
  validationScore?: number;
  validationBreakdown?: {
    productSectionScore: number;
    partOrModelCodeScore: number;
    technicalSpecsScore: number;
    productImageScore: number;
    descriptionScore: number;
    priceOrRateScore: number;
    detailPageScore: number;
    totalScore: number;
    status: 'VALID_HIGH' | 'VALID_MEDIUM' | 'NEEDS_REVIEW' | 'REJECTED';
    reasons: string[];
  };
}

export interface VendorMaterialCategory {
  id: string;
  vendorId: string;
  category: string;
  subCategory?: string;
  brands: string[];
  productsFoundCount: number;
  confidence: number; // 0 - 100
  sourceDocument: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: string;
  isNewSuggestedCategory?: boolean;
}

export interface AIActivityLog {
  id: string;
  timestamp: string;
  vendorId: string;
  vendorName: string;
  fileName?: string;
  action: 'CATALOG_ANALYZED' | 'CATEGORY_APPROVED' | 'CATEGORY_REJECTED' | 'CATEGORY_EDITED' | 'RFQ_LEARNING_SUGGESTED' | 'RFQ_LEARNING_ACCEPTED';
  productsCount: number;
  categoriesSuggested: string[];
  userAction: string;
  confidence: number;
  details: string;
}

export interface ProductTypeItem {
  id: string; // e.g. "PT-001"
  name: string; // e.g. "MCB", "MCCB", "Contactor"
  subCategory?: string; // e.g. "Switchgear" or "Pipe Fittings"
  category?: string; // e.g. "Electrical"
  description?: string;
  isActive?: boolean;
  itemExamples?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type ProductTypeMasterItem = ProductTypeItem;

export type VendorSupplyType =
  | 'Manufacturer'
  | 'Authorized Distributor'
  | 'Dealer'
  | 'Trader'
  | 'Service Provider'
  | 'Other';

export type VendorProductAvailability = 'Regular Stock' | 'Order Based' | 'Special Order';
export type VendorProductStatus = 'ACTIVE' | 'INACTIVE';

export interface VendorProductMapping {
  id: string; // e.g. "VPM-001"
  vendorId: string;
  vendorCode?: string;
  vendorName?: string;
  productName: string;
  category: string;
  subCategory?: string;
  productType?: string;
  brand: string;
  modelNumber?: string;
  partNumber?: string;
  specification?: string;
  rating?: string;
  size?: string;
  description?: string;
  uom: string; // NOS, MTR, SET, KG, LTR, PKT, BOX, etc.
  supplyType: VendorSupplyType;
  availability: VendorProductAvailability;
  status: VendorProductStatus;
  remarks?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MaterialCategory {
  id: string; // e.g. CAT-001
  name: string; // e.g. "Electrical"
  code: string; // e.g. "ELE"
  description: string;
  subCategories: string[];
  productTypes?: ProductTypeItem[];
  keywords: string[];
  itemExamples: string[];
  isActive: boolean;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrandMasterItem {
  id: string; // e.g. "BRD-001" or "GBRD-001"
  globalBrandId?: string;
  name: string; // Official Brand Name e.g. "SKF"
  code?: string; // e.g. "SKF"
  aliases?: string[]; // Alternative Names & Aliases
  manufacturer?: string; // Manufacturer company name
  category?: string; // Primary category e.g. "Bearings"
  categories?: string[];
  description?: string;
  countryOfOrigin?: string;
  website?: string;
  logoUrl?: string;
  isActive: boolean;
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  brandType?: 'GLOBAL_OEM' | 'LOCAL_BRAND';
  defaultDiscountPercent?: number; // Bulk brand default discount
  effectiveDate?: string;
  expiryDate?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface VendorRecommendation {
  vendorId: string;
  vendorName: string;
  contactPerson: string;
  mobile: string;
  email: string;
  city: string;
  state: string;
  rating: number;
  materialCategories: string[];
  matchLevel: 'High' | 'Medium' | 'Low';
  matchScore: number;
  matchReasons: string[];
  previousSupplyCount: number;
  lastSuppliedDate?: string;
  lastQuotationDate?: string;
  lastQuotedPrice?: number;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  remarks?: string;
}

export interface ProductRateHistoryEntry {
  id: string;
  vendorId?: string;
  vendorName?: string;
  mrp?: number;
  discountType?: 'PERCENTAGE' | 'FIXED' | 'DIRECT';
  discountValue?: number;
  purchaseRate: number;
  netPurchaseRate: number;
  effectiveDate: string;
  expiryDate?: string;
  source: 'PO' | 'DIRECT_VQ' | 'MANUAL_ENTRY' | 'EXCEL_IMPORT';
  attachmentUrl?: string;
  attachmentName?: string;
  remarks?: string;
  recordedAt: string;
  recordedBy: string;
}

export interface ProductItem {
  id: string; // Material ID (e.g. MAT-001 or PRD-001)
  itemCode?: string; // Item Code (e.g. ITM-6206-2RS)
  itemName: string;
  sourceProductName?: string;
  normalizedProductName?: string;
  productDesignation?: string;
  productFamily?: string;
  application?: string;
  category: string;
  subCategory?: string;
  brand: string;
  manufacturer?: string;
  manufacturerCode?: string;
  partNumber: string;
  modelNumber: string;
  specification: string;
  uom: string; // NOS, SET, MTR, KG, LTR, PKT, BOX
  description: string;
  catalogueRow?: number;
  originalSourceText?: string;
  extractionDate?: string;
  aiAnalysisVersion?: string;
  alternateNames?: string[]; // e.g. ["6206 bearing", "6206-2RS", "SKF 6206"]
  searchKeywords?: string[]; // e.g. ["ball bearing", "deep groove", "rubber seal"]
  technicalParameters?: Record<string, string>; // e.g. { "Bore": "30mm", "OD": "62mm", "Clearance": "C3" }
  status?: 'ACTIVE' | 'INACTIVE';
  mrp?: number; // Maximum Retail Price
  discountType?: 'PERCENTAGE' | 'FIXED' | 'DIRECT';
  discountPercentage?: number; // e.g. 25 (%)
  fixedDiscountAmount?: number; // e.g. 50 (INR)
  netPurchaseRate?: number; // MRP - discount or direct rate
  packCode?: string; // e.g. '54'
  caseQty?: number; // e.g. 22
  catalogueVersion?: string; // e.g. 'SKF 2026'
  effectiveDate?: string;
  expiryDate?: string;
  updatedAt?: string;
  imageUrl?: string;
  datasheetUrl?: string;
  rateHistory?: ProductRateHistoryEntry[];
  approxRate?: number;
  lastPurchaseRate?: number;
  lastPurchaseDate?: string;
  lastVendorName?: string;
  lowestRate?: number;
  highestRate?: number;
  averageRate?: number;
  hsnCode?: string;
  gstRate?: number;
  stockQty?: number;
  purchasePrice?: number;
  salesPrice?: number;
  costPrice?: number;
  targetMarginPercent?: number;
  createdAt?: string;
  warehouse?: string; // e.g. 'Central Stores Vatva' | 'Sanand Transit Yard' | 'Jamshedpur Hub'
  minStockLevel?: number;
  isStockManaged?: boolean; // false for non-stock direct-procurement items
  batchNumber?: string;
  serialNumber?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletedReason?: string;
}

export interface RequirementItem {
  id: string;
  itemCode?: string;
  itemName: string;
  category: string;
  recommendedCategory?: string;
  subCategory?: string;
  brand: string;
  partNumber?: string;
  modelNumber?: string;
  specification?: string;
  quantity: number;
  uom: string;
  targetPrice?: number;
  deliveryDays?: number;
  requiredDeliveryDate?: string; // Retained for backwards-compatibility
  receivedRequirementDate?: string; // Date received from customer
  expectedDeliveryDate?: string; // Optional delivery date timeline
  priority?: 'High' | 'Medium' | 'Low';
  description?: string;
  recommendedVendors?: VendorRecommendation[];
  selectedVendorId?: string;
  selectedVendorName?: string;
  matchedKeywords?: string[];
  remarks?: string;
  purchaseExecutiveId?: string;
  purchaseExecutiveName?: string;
  purchaseExecutiveDesignation?: string;
}

export interface RequirementAttachment {
  name: string;
  type: string;
  size: string;
  url: string;
  uploadedAt: string;
}

export interface CustomerRequirement {
  id: string; // REQ-2026-00001
  customerId: string;
  customerName: string;
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
  contactPerson: string;
  customerEmail: string;
  customerMobile: string;
  requirementDate: string;
  requiredDeliveryDate: string; // Retained for backwards-compatibility
  receivedRequirementDate?: string; // Date requirement received from customer
  expectedDeliveryDate?: string; // Optional expected delivery date
  priority?: 'High' | 'Medium' | 'Low';
  items: RequirementItem[];
  attachments: RequirementAttachment[];
  status: OrderWorkflowStage;
  createdBy: string;
  createdAt: string;
  lastModifiedAt?: string;
  lastModifiedBy?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletedReason?: string;
  dbSaveStatus?: 'COMMITTED' | 'PENDING' | 'FAILED';
  cloudSyncStatus?: 'SYNCED' | 'LOCAL_PENDING';
  remarks?: string;
  commercialLock?: CommercialLockInfo;
  isBulkImported?: boolean;
}

export interface BackupRecord {
  id: string;
  timestamp: string;
  type: 'AUTOMATIC_DAILY' | 'MANUAL';
  status: 'SUCCESS' | 'FAILED';
  location: string;
  sizeBytes: number;
  sizeFormatted: string;
  versionLabel: string;
  errorMessage?: string;
  dataSnapshot?: string; // serialized JSON
  recordCounts: {
    vendors: number;
    categories: number;
    requirements: number;
    quotations: number;
    pos: number;
  };
}

export interface BackupSettings {
  autoBackupEnabled: boolean;
  frequencyHours: number;
  lastBackupTimestamp?: string;
  nextBackupTimestamp?: string;
  cloudProvider: 'GOOGLE_DRIVE_ENTERPRISE' | 'AWS_S3_VAULT' | 'AZURE_BLOB' | 'LOCAL_SECURE_STORAGE';
  retentionDailyCount: number;
  retentionWeeklyCount: number;
}

export interface RfqItem {
  id: string;
  rfqId?: string;
  productId?: string;
  brand?: string;
  brandId?: string;
  partCode?: string;
  partNumber?: string;
  modelNumber?: string;
  manufacturerCode?: string;
  itemName: string;
  description?: string;
  category: string;
  subCategory?: string;
  specifications?: string;
  quantity: number;
  uom: string;
  targetPrice?: number;
  rate?: number;
  vendorId?: string;
  vendorName?: string;
  requiredDeliveryDate?: string;
}

export interface VendorEnquiry {
  id: string; // RFQ-2026-00001
  rfqNumber?: string; // RFQ-2026-00001
  requirementId: string;
  vendorIds: string[];
  vendorId?: string;
  vendorName?: string;
  customerId?: string;
  customerName?: string;
  companyId?: string;
  companyName?: string;
  purchaseExecutiveId?: string;
  purchaseExecutiveName?: string;
  requiredDate?: string;
  sentDate: string;
  status: 'DRAFT' | 'NEW_RFQ' | 'SENT' | 'RATES_PARTIALLY_RECEIVED' | 'RATES_RECEIVED' | 'UNDER_EVALUATION' | 'CLOSED' | string;
  notes?: string;
  commercialTerms?: string;
  items?: RfqItem[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
  dbSaveStatus?: 'COMMITTED' | 'PENDING' | 'FAILED';
  closureDetails?: any;
  closedAt?: string;
  closedBy?: string;
}

export interface VendorQuoteItem {
  requirementItemId: string;
  itemName: string;
  partNumber: string;
  brand?: string;
  itemDescription?: string;
  category?: string;
  quantity: number;
  uom: string;
  mrp?: number; // Maximum Retail Price
  discountType?: 'PERCENTAGE' | 'FIXED' | 'DIRECT';
  discountPercentage?: number;
  fixedDiscountAmount?: number;
  netPurchaseRate?: number; // MRP - discount or negotiated rate
  effectiveDate?: string;
  expiryDate?: string;
  resellerPrice: number; // basic unit price / supplier rate
  unitRate?: number; // alias for resellerPrice
  gstPercent: number; // e.g. 18
  freight: number;
  otherCharges: number;
  discount?: number;
  totalLandedCost: number;
  deliveryDays: number;
  availability: 'IN_STOCK' | '1-2 WEEKS' | '3-4 WEEKS' | 'MADE_TO_ORDER';
  warranty: string;
  rateValidity: string;
  remarks?: string;
}

export interface VendorQuote {
  id: string; // VQ-2026-00001
  enquiryId?: string; // optional for direct vendor rate entry
  requirementId: string;
  customerName?: string;
  vendorId: string;
  vendorName: string;
  submissionDate: string;
  items: VendorQuoteItem[];
  quotationDocUrl?: string;
  attachmentName?: string;
  status: 'SUBMITTED' | 'SELECTED' | 'REJECTED';
  validUntil: string;
  paymentTerms?: string;
  remarks?: string;
}

export interface CustomerQuotationItem {
  requirementItemId: string;
  itemName: string;
  partNumber: string;
  quantity: number;
  uom: string;
  selectedVendorId: string;
  selectedVendorName: string;
  purchasePrice: number;
  freightCost: number;
  otherCost: number;
  marginPercent: number;
  marginAmount: number;
  sellingUnitPrice: number;
  gstPercent: number;
  discountPercent: number;
  netUnitPrice: number;
  totalTaxableAmount: number;
  taxAmount: number;
  finalLineTotal: number;
}

export interface CustomerQuotation {
  id: string; // QTN-2026-00001
  requirementId: string;
  customerId: string;
  customerName: string;
  date: string;
  validityDate: string;
  deliveryPeriod: string;
  paymentTerms: string;
  deliveryTerms: string;
  warranty: string;
  remarks?: string;
  items: CustomerQuotationItem[];
  subtotal: number;
  totalTax: number;
  grandTotal: number;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';
  pdfGenerated: boolean;
  commercialLock?: CommercialLockInfo;
  rulesCheckSummary?: {
    totalPassed: number;
    totalFailed: number;
    totalWarnings: number;
    checkedAt: string;
    checkedBy: string;
  };
}

export interface CommercialLockInfo {
  isLocked: boolean;
  lockedBy?: string;
  lockedAt?: string;
  lockedRemarks?: string;
  lockedEarnings?: number;
  lockedMarginPercent?: number;
  unlockHistory?: {
    unlockedBy: string;
    unlockedAt: string;
    reason: string;
  }[];
}

export interface EarningRuleCheckResult {
  ruleId: string;
  title: string;
  category: 'MARGIN' | 'PRICING' | 'TAX' | 'TERMS' | 'DELIVERY';
  passed: boolean;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  expectedValue: string;
  actualValue: string;
  earningImpactAmount?: number;
  userOverridden?: boolean;
  userOverrideNote?: string;
}

export interface CustomerPO {
  id: string; // CPO-2026-00001
  quotationId: string;
  requirementId: string;
  customerPoNumber: string; // e.g. PO/TATA/9981
  poDate: string;
  customerId: string;
  customerName: string;
  poAmount: number;
  deliveryAddress: string;
  paymentTerms: string;
  poDocUrl?: string;
  remarks?: string;
  receivedDate: string;
}

export interface VendorPOItem {
  itemName: string;
  partNumber: string;
  quantity: number;
  uom: string;
  unitRate: number;
  gstPercent: number;
  freight: number;
  totalAmount: number;
}

export interface VendorPO {
  id: string; // VPO-2026-00001
  customerPoId: string;
  quotationId: string;
  requirementId: string;
  vendorId: string;
  vendorName: string;
  poDate: string;
  items: VendorPOItem[];
  subtotal: number;
  gstAmount: number;
  freight: number;
  totalAmount: number;
  deliveryAddress: string;
  deliveryDate: string;
  paymentTerms: string;
  remarks?: string;
  pdfGenerated: boolean;
  status?: 'DRAFT' | 'ISSUED' | 'CONFIRMED' | 'DELIVERED' | 'BILLED' | 'CANCELLED';
}

export interface ProformaInvoice {
  id: string; // PI-2026-00001
  vendorPoId: string;
  requirementId: string;
  vendorId: string;
  vendorName: string;
  piNumber: string; // vendor's PI no
  piDate: string;
  amount: number;
  gstAmount: number;
  freight: number;
  totalAmount: number;
  bankDetails: string;
  paymentDueDate: string;
  piDocUrl?: string;
  remarks?: string;
}

export interface PaymentRecord {
  id: string; // PAY-2026-00001
  piId: string;
  vendorPoId: string;
  requirementId: string;
  vendorId: string;
  vendorName: string;
  totalPiAmount: number;
  amountPaid: number;
  paymentDate: string;
  paymentMode: 'NEFT' | 'RTGS' | 'IMPS' | 'UPI' | 'CHEQUE' | 'BANK_TRANSFER';
  transactionReference: string;
  paymentProofUrl?: string;
  status: 'PAYMENT_PENDING' | 'PAYMENT_PARTIAL' | 'PAYMENT_DONE';
  remarks?: string;
  loggedBy: string;
}

export interface DispatchRecord {
  id: string; // DSP-2026-00001
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
  trackingUrl?: string;
  quantityDispatched: string;
  expectedDeliveryDate: string;
  invoiceDocUrl?: string;
  lrDocUrl?: string;
  packingListDocUrl?: string;
  remarks?: string;
}

export interface DeliveryRecord {
  id: string; // DEL-2026-00001
  dispatchId: string;
  requirementId: string;
  deliveryDate: string;
  receivedBy: string;
  receiverContact?: string;
  customerAcknowledgement: string;
  podDocUrl?: string;
  status: 'DISPATCHED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'PARTIALLY_DELIVERED' | 'CANCELLED';
  remarks?: string;
}

export interface OrderMasterRecord {
  requirementId: string;
  requirementNumber: string;
  customer: {
    id: string;
    name: string;
    contact: string;
  };
  currentStage: OrderWorkflowStage;
  itemsSummary: string;
  rfqId?: string;
  selectedVendorId?: string;
  selectedVendorName?: string;
  quotationId?: string;
  customerPoId?: string;
  vendorPoId?: string;
  piId?: string;
  paymentId?: string;
  dispatchId?: string;
  deliveryId?: string;
  sellingValue: number;
  purchaseValue: number;
  grossMargin: number;
  marginPercent: number;
  lastUpdated: string;
}

export interface TimelineEvent {
  id: string;
  stage: OrderWorkflowStage;
  label: string;
  referenceId: string;
  date: string;
  actorName: string;
  actorRole: string;
  remarks: string;
  completed: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ACTION_REQUIRED';
  read: boolean;
  linkTab?: string;
  linkId?: string;
  targetRole: UserRole[];
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  user: string;
  role: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: string;
  newValue?: string;
  details: string;
  recordNumber?: string;
  remarks?: string;
  module?: string;
}

export interface DocumentRecord {
  id: string;
  name: string;
  type: 'PDF' | 'IMAGE' | 'EXCEL' | 'DOC';
  category: 'REQUIREMENT' | 'QUOTATION' | 'PO' | 'PI' | 'PAYMENT' | 'DISPATCH' | 'DELIVERY' | 'CUSTOMER_DOC' | 'VENDOR_DOC';
  associatedTransactionId: string;
  customerOrVendorName: string;
  uploadedAt: string;
  size: string;
  url: string;
}

export interface DashboardVisibilityConfig {
  showFinancialKpis: boolean;
  showFinancialRevenue: boolean;
  showFinancialCost: boolean;
  showFinancialProfit: boolean;
  showFinancialMarginPct: boolean;
  showPipelineMilestones: boolean;
  showQuickActions: boolean;
  showDataStorageHub: boolean;
  showActiveOrdersTable: boolean;
  showCommercialLockBadge: boolean;
}

export interface OperationalRightsConfig {
  canViewBuyingPrice: boolean;
  canViewGrossMargin: boolean;
  canLockUnlockCommercials: boolean;
  canExportData: boolean;
  canImportData: boolean;
  canManageMasters: boolean;
  canDisbursePayments: boolean;
  canConfirmDispatch: boolean;
  canViewAuditLogs: boolean;
  canViewReports: boolean;
  canSyncGoogleSheets: boolean;
}

export interface RoleAccessConfig {
  role: UserRole;
  roleTitle: string;
  description: string;
  dashboard: DashboardVisibilityConfig;
  rights: OperationalRightsConfig;
  allowedSidebarTabs: string[];
}

// ==========================================
// EMAIL RFQ INTEGRATION (MODULE 4)
// ==========================================
export interface EmailAccountConfig {
  provider: 'GMAIL' | 'OUTLOOK' | 'IMAP' | 'CUSTOM';
  emailAddress: string;
  isConnected: boolean;
  connectedAt?: string;
  lastSyncedAt?: string;
  syncIntervalMinutes: number;
  approvedSenders: string[]; // domains or emails
  selectedLabels: string[];
  autoCreateDraft: boolean;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'SYNCING';
  lastError?: string;
}

export interface ExtractedEmailItem {
  id: string;
  itemName: string;
  category?: string;
  subCategory?: string;
  partNumber?: string;
  modelNumber?: string;
  brand?: string;
  specification?: string;
  quantity: number;
  uom: string;
  targetPrice?: number;
  expectedDeliveryDate?: string;
  confidence: number;
}

export interface EmailRfqItem {
  id: string; // EML-001
  messageId: string; // stable RFC message ID
  senderEmail: string;
  senderName: string;
  companyName: string;
  contactPerson: string;
  mobile?: string;
  subject: string;
  receivedDate: string; // Actual date received from email
  bodySnippet: string;
  fullBodyText: string;
  detectedItems: ExtractedEmailItem[];
  matchedCustomerId?: string;
  createdRequirementId?: string; // e.g. REQ-2026-00007
  status: 'NEW_EMAIL' | 'PROCESSING' | 'DRAFT_READY' | 'SAVED_AS_RFQ' | 'NEEDS_ATTENTION' | 'DUPLICATE' | 'IGNORED';
  attachments: { name: string; size: string; type: string; url?: string }[];
  deliveryTerms?: string;
  paymentTerms?: string;
  targetLocation?: string;
  remarks?: string;
}

// ==========================================
// SALES & GST INVOICING (VYAPAR-STYLE)
// ==========================================
export interface GSTInvoiceItem {
  id: string;
  itemName: string;
  hsnCode: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  discountPercent: number;
  taxableAmount: number;
  gstRate: number; // 5, 12, 18, 28
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

export interface GSTInvoice {
  id: string; // INV-2026-00001
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  customerId: string;
  customerName: string;
  customerGstin?: string;
  billingAddress: string;
  shippingAddress: string;
  placeOfSupply: string;
  isInterState: boolean;
  quotationId?: string;
  customerPoId?: string;
  requirementId?: string;
  items: GSTInvoiceItem[];
  subtotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  balanceDue: number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
  paymentTerms?: string;
  notes?: string;
  createdAt: string;
}

export interface DeliveryChallan {
  id: string; // CHL-2026-00001
  challanNumber: string;
  challanDate: string;
  customerId: string;
  customerName: string;
  deliveryAddress: string;
  transporterName: string;
  vehicleNumber?: string;
  lrNumber?: string;
  invoiceId?: string;
  requirementId?: string;
  items: { itemName: string; hsnCode: string; quantity: number; uom: string; description?: string }[];
  dispatchThrough: string;
  status: 'DELIVERED' | 'IN_TRANSIT' | 'CANCELLED';
  remarks?: string;
}

export interface CreditNote {
  id: string; // CN-2026-00001
  creditNoteNumber: string;
  date: string;
  originalInvoiceId: string;
  originalInvoiceNumber: string;
  customerId: string;
  customerName: string;
  reason: 'GOODS_RETURN' | 'PRICE_DIFFERENCE' | 'DEFECTIVE_MATERIAL' | 'DISCOUNT_POST_SALE';
  amount: number;
  taxAmount: number;
  totalAmount: number;
  status: 'ACTIVE' | 'ADJUSTED' | 'REFUNDED';
  remarks?: string;
}

// ==========================================
// PURCHASE BILLS & VENDOR MANAGEMENT
// ==========================================
export interface VendorBillItem {
  id: string;
  itemName: string;
  hsnCode: string;
  quantity: number;
  uom: string;
  unitRate: number;
  taxableAmount: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

export interface VendorBill {
  id: string; // BILL-2026-00001
  billNumber: string; // Supplier's original invoice number
  billDate: string;
  dueDate: string;
  vendorId: string;
  vendorName: string;
  vendorGstin?: string;
  vendorPoId?: string;
  requirementId?: string;
  items: VendorBillItem[];
  subtotal: number;
  totalTax: number;
  grandTotal: number;
  paidAmount: number;
  balanceDue: number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  paymentTerms?: string;
  notes?: string;
  createdAt: string;
}

export interface DebitNote {
  id: string; // DN-2026-00001
  debitNoteNumber: string;
  date: string;
  originalBillId: string;
  originalBillNumber: string;
  vendorId: string;
  vendorName: string;
  reason: 'GOODS_RETURN' | 'RATE_DIFFERENCE' | 'SHORTAGE' | 'DAMAGE';
  amount: number;
  taxAmount: number;
  totalAmount: number;
  status: 'ACTIVE' | 'ADJUSTED' | 'REFUNDED';
  remarks?: string;
}

// ==========================================
// ACCOUNTING, PAYMENTS & EXPENSES
// ==========================================
export type AccountingPaymentType = 'PAYMENT_IN' | 'PAYMENT_OUT';

export interface AccountingTransaction {
  id: string; // TXN-00001
  voucherNumber: string;
  type: AccountingPaymentType;
  partyType: 'CUSTOMER' | 'VENDOR' | 'EXPENSE_PARTY' | 'INTERNAL_TRANSFER';
  partyId: string;
  partyName: string;
  date: string;
  amount: number;
  paymentMode: 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CHEQUE' | 'NEFT_RTGS';
  bankAccountId?: string;
  bankAccountName?: string;
  referenceNumber?: string;
  linkedDocType?: 'INVOICE' | 'VENDOR_BILL' | 'ADVANCE' | 'EXPENSE';
  linkedDocId?: string;
  remarks?: string;
  status: 'CLEARED' | 'PENDING' | 'BOUNCED';
  reconciled: boolean;
  createdAt: string;
}

export interface ExpenseRecord {
  id: string; // EXP-00001
  expenseNumber: string;
  category: 'TRANSPORT_FREIGHT' | 'RENT' | 'SALARIES' | 'BANK_CHARGES' | 'OFFICE_SUPPLIES' | 'TRAVEL' | 'PACKAGING' | 'OTHER';
  paidTo: string;
  date: string;
  amount: number;
  taxDeducted?: number; // TDS
  paymentMode: 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CHEQUE';
  bankAccountId?: string;
  referenceNumber?: string;
  billDocUrl?: string;
  notes?: string;
  requirementId?: string;
  createdAt: string;
}

export interface BankAccount {
  id: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  accountType: 'CURRENT' | 'SAVINGS' | 'CASH_IN_HAND';
  openingBalance: number;
  currentBalance: number;
  upiId?: string;
  isDefault: boolean;
}

// ==========================================
// INVENTORY & STOCK MANAGEMENT
// ==========================================
export interface StockMovement {
  id: string; // STK-MOV-0001
  date: string;
  productId: string;
  productName: string;
  type: 'PURCHASE_RECEIPT' | 'SALES_ISSUE' | 'MANUAL_ADJUSTMENT' | 'DAMAGE' | 'RETURN';
  quantity: number;
  balanceAfter: number;
  unitCost: number;
  totalValue: number;
  referenceType?: 'VENDOR_PO' | 'SALES_ORDER' | 'INVOICE' | 'ADJUSTMENT';
  referenceId?: string;
  notes?: string;
}

// ==========================================
// COMPANY PROFILE & GSTIN SETTINGS
// ==========================================
export interface CompanySettings {
  companyName: string;
  tagline: string;
  gstin: string;
  pan: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  stateCode: string;
  phone: string;
  email: string;
  website?: string;
  bankAccounts: BankAccount[];
  invoicePrefix: string;
  financialYear: string;
}

// ==========================================
// CUSTOM ERP BRANDING & LOGO SETTINGS
// ==========================================
export interface ErpBrandingConfig {
  erpName: string;
  tagline: string;
  companyName: string;
  shortName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  gstin: string;
  cin?: string;
  logoUrl?: string; // Light logo / default
  darkLogoUrl?: string;
  mobileLogoUrl?: string;
  faviconUrl?: string;
  sidebarLogoUrl?: string;
  loginLogoUrl?: string;
  pdfLogoUrl?: string;
  updatedAt?: string;
}

// ==========================================
// CUSTOM THEME MANAGER CONFIG
// ==========================================
export type ThemeMode = 'MODERN' | 'INDUSTRIAL' | 'PROFESSIONAL' | 'DARK' | 'LIGHT' | 'EXECUTIVE';

export interface ThemeConfig {
  mode: ThemeMode;
  primaryColor: string; // Hex color e.g. '#2563eb'
  secondaryColor: string;
  accentColor: string;
  sidebarStyle: 'DARK_MODERN' | 'CLEAN_LIGHT' | 'INDUSTRIAL_NAVY';
  cardStyle: 'GLASS' | 'SOLID_CLEAN' | 'BORDERED';
  borderRadius: 'ROUNDED' | 'SMOOTH' | 'SHARP';
  animationLevel: 'FULL' | 'REDUCED' | 'MINIMAL';
  density: 'COMFORTABLE' | 'COMPACT';
}

// ==========================================
// BULK BRAND DISCOUNT & MRP ENGINE
// ==========================================
export interface BulkBrandDiscountRule {
  id: string;
  brandName: string;
  category?: string;
  defaultDiscountPercentage: number;
  discountType: 'PERCENTAGE' | 'FIXED' | 'DIRECT_NEGOTIATED';
  effectiveDate: string;
  expiryDate?: string;
  supplierId?: string;
  supplierName?: string;
  remarks?: string;
  updatedAt: string;
}

export * from './catalogImport';
