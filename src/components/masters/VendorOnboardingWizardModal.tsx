import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Globe,
  Upload,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Building,
  Phone,
  Mail,
  MapPin,
  Tag,
  Layers,
  Package,
  Plus,
  Trash2,
  X,
  RefreshCw,
  ShieldCheck,
  ArrowLeft,
  Check,
  UserPlus,
  SlidersHorizontal,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  VendorOnboardingAnalysisResult,
  VendorOnboardingCommitPayload,
  VendorContact,
  VendorStructuredAddress,
  BrandAssociationDetail,
  CategoryHierarchyDetection,
  OnboardingProductCandidate,
  OnboardingConflict,
  BrandRelationshipType,
  VendorCatalogueConfig,
  VendorImportJob,
} from '../../types';
import {
  validateGstinFormat,
  validatePanFormat,
  computeOnboardingCompletion,
} from '../../services/vendorOnboardingService';

export interface StagedOnboardingFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  sourceRole?: string;
  rawFile?: File;
  textContent?: string;
  base64Data?: string;
  uploadProgress?: number;
}

const ACTIVE_IMPORT_JOB_STORAGE_KEY = 'mro_active_vendor_import_job';

function formatFileSizeHuman(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.max(0.1, bytes / 1024).toFixed(1)} KB`;
}

interface VendorOnboardingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessVendorSaved: (vendorId: string) => void;
  onOpenExistingVendor: (vendorId: string) => void;
  onSwitchToManual: (prefill?: {
    companyName?: string;
    legalName?: string;
    vendorType?: any;
    website?: string;
    country?: string;
    contactPerson?: string;
    email?: string;
    mobile?: string;
    alternateMobile?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    gstin?: string;
    pan?: string;
    brands?: string[];
    categories?: string[];
    products?: OnboardingProductCandidate[];
  }) => void;
}

const RELATIONSHIP_OPTIONS: BrandRelationshipType[] = [
  'OEM',
  'Manufacturer',
  'Authorised Distributor',
  'Distributor',
  'Dealer',
  'Listed In Catalogue',
  'System Integrator',
  'Service Provider',
  'Supplies',
  'Deals In',
];

const SAMPLE_CARD_TEXT = `Apex Precision Motion & Automation Pvt Ltd
Plot 42, Sector 7, Bhosari MIDC Industrial Area, Pune - 411026, Maharashtra, India
GSTIN: 27AABCA8942K1Z5
Website: https://apexprecisionmro.in
Sales Head: Rajesh Deshmukh | Mobile: +91 98230 44512 | Email: sales@apexprecisionmro.in
Purchase Support: Anita Joshi | Phone: +91 98230 44599 | Email: rfq@apexprecisionmro.in
Landline: 020-27124488
Authorised Distributor for SKF Industrial Bearings & Schneider Electric Switchgear.`;

const SAMPLE_CATALOGUE_CSV = `Brand,Product Name,Part Code,Category,Sub Category,Specification,MRP,Discount %,Purchase Rate,UOM
SKF,Deep Groove Ball Bearing,6006,Bearings,Ball Bearings,30x55x13 mm Open,480,35,312,NOS
SKF,Deep Groove Ball Bearing Clearance C3,6006/C3,Bearings,Ball Bearings,30x55x13 mm C3 Radial Clearance,510,35,331.50,NOS
SKF,Sealed Deep Groove Ball Bearing,6006-2RS1,Bearings,Ball Bearings,30x55x13 mm Dual Rubber Seal,590,32,401.20,NOS
SKF,Shielded Deep Groove Ball Bearing,6006-2Z,Bearings,Ball Bearings,30x55x13 mm Metal Shielded,550,32,374.00,NOS
Schneider Electric,TeSys D Contactor 24V AC,LC1D09B7,Electrical & Switchgear,Contactors,9A 3-Pole AC3 24VAC Coil,1950,28,1404,NOS`;

export const VendorOnboardingWizardModal: React.FC<VendorOnboardingWizardModalProps> = ({
  isOpen,
  onClose,
  onSuccessVendorSaved,
  onOpenExistingVendor,
  onSwitchToManual,
}) => {
  const {
    getVendorCatalogueConfig,
    uploadCatalogueFileInChunks,
    startVendorOnboardingJob,
    pollVendorOnboardingJob,
    fetchVendorOnboardingJobResult,
    cancelVendorOnboardingJob,
    listVendorOnboardingJobs,
    commitVendorOnboarding,
  } = useApp();

  const [step, setStep] = useState<'INPUT' | 'ANALYSING' | 'PREVIEW'>('INPUT');
  const [catalogueConfig, setCatalogueConfig] = useState<VendorCatalogueConfig>({
    maxFileSizeMb: 250,
    maxFileSizeBytes: 250 * 1024 * 1024,
    uploadChunkSizeBytes: 4 * 1024 * 1024,
    maxPagesPerPdfChunk: 20,
    allowedExtensions: ['.pdf', '.xls', '.xlsx', '.csv', '.jpg', '.jpeg', '.png', '.webp'],
    allowedFormatsLabel: 'PDF | XLS | XLSX | CSV | JPG | PNG | WEBP',
  });
  const [activeImportJob, setActiveImportJob] = useState<VendorImportJob | null>(null);
  const [uploadTransferStatus, setUploadTransferStatus] = useState<{
    fileName: string;
    fileSizeBytes: number;
    percent: number;
    fileIndex: number;
    totalFiles: number;
  } | null>(null);

  // Step 1 Inputs
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [vendorNameHint, setVendorNameHint] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [stagedFiles, setStagedFiles] = useState<StagedOnboardingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3 Editable Intelligence Preview State
  const [analysisResult, setAnalysisResult] = useState<VendorOnboardingAnalysisResult | null>(null);
  const [previewTab, setPreviewTab] = useState<'company' | 'brands' | 'products' | 'suspicious' | 'commercial'>('company');
  const [commitMode, setCommitMode] = useState<'CREATE' | 'UPDATE'>('CREATE');
  const [targetVendorId, setTargetVendorId] = useState<string | undefined>(undefined);
  const [suspiciousList, setSuspiciousList] = useState<NonNullable<VendorOnboardingAnalysisResult['suspiciousItems']>>([]);
  const [editingSuspiciousId, setEditingSuspiciousId] = useState<string | null>(null);
  const [suspiciousDraft, setSuspiciousDraft] = useState<{
    productName: string;
    brand: string;
    partNumber: string;
    category: string;
    specification: string;
  }>({ productName: '', brand: '', partNumber: '', category: '', specification: '' });
  const [columnMappingOverride, setColumnMappingOverride] = useState<Record<string, string>>({});
  const [showColumnMapper, setShowColumnMapper] = useState(false);

  // Editable Entity Fields
  const [company, setCompany] = useState<VendorOnboardingCommitPayload['company']>({
    companyName: '',
    legalName: '',
    tradingNames: [],
    vendorType: 'Distributor',
    website: '',
    gstin: '',
    pan: '',
    country: 'India',
    msmeStatus: 'Small',
    paymentTerms: '30 Days Net',
    creditPeriod: '30 Days',
    deliveryTerms: 'Door Delivery / Ex-Works',
    summary: '',
    remarks: '',
    bankName: '',
    bankAccount: '',
    bankIfsc: '',
  });
  const [structuredAddress, setStructuredAddress] = useState<VendorStructuredAddress>({
    rawAddress: '',
    plotOrBuilding: '',
    street: '',
    industrialEstateOrArea: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    splitConfidence: 70,
  });
  const [contacts, setContacts] = useState<VendorContact[]>([]);
  const [brandsList, setBrandsList] = useState<BrandAssociationDetail[]>([]);
  const [categoriesList, setCategoriesList] = useState<CategoryHierarchyDetection[]>([]);
  const [productFamilies, setProductFamilies] = useState<string[]>([]);
  const [productsList, setProductsList] = useState<OnboardingProductCandidate[]>([]);
  const [conflicts, setConflicts] = useState<OnboardingConflict[]>([]);
  const [resolvedConflicts, setResolvedConflicts] = useState<Record<string, string>>({});
  const [createMissingInMaster, setCreateMissingInMaster] = useState(true);
  const [newBrandInput, setNewBrandInput] = useState('');
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [skipGstinExplicit, setSkipGstinExplicit] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const applyAnalysisToPreviewState = (a: VendorOnboardingAnalysisResult) => {
    setAnalysisResult(a);
    setCompany({
      ...a.company,
      gstin: a.company.gstin || '',
      pan: a.company.pan || '',
      msmeStatus: a.company.msmeStatus || 'Small',
      paymentTerms: a.company.paymentTerms || '30 Days Net',
      creditPeriod: a.company.creditPeriod || '30 Days',
      deliveryTerms: a.company.deliveryTerms || 'Door Delivery / Ex-Works',
      summary: a.company.summary || '',
      remarks: a.company.summary || '',
    });
    setStructuredAddress(a.structuredAddress || { rawAddress: '', city: '', state: '', pincode: '', country: 'India', splitConfidence: 40 });
    setContacts(
      a.contacts && a.contacts.length > 0
        ? a.contacts
        : [
            {
              id: 'CNT-1',
              name: '',
              department: 'Sales',
              email: '',
              mobile: '',
              isPrimary: true,
              source: 'Manual',
              confidence: 50,
            },
          ]
    );
    setBrandsList(a.brands || []);
    setCategoriesList(a.categories || []);
    setProductFamilies(a.productFamilies || []);
    setProductsList(a.products || []);
    setSuspiciousList(a.suspiciousItems || []);
    setEditingSuspiciousId(null);
    if (a.spreadsheetPreview?.autoMapping) {
      setColumnMappingOverride((prev) => (Object.keys(prev).length > 0 ? prev : a.spreadsheetPreview!.autoMapping));
    }
    setConflicts(a.conflicts || []);
    setResolvedConflicts({});
    setSkipGstinExplicit(false);

    if (a.duplicates && a.duplicates.length > 0 && a.duplicates[0].similarityScore >= 85) {
      setCommitMode('CREATE');
      setTargetVendorId(a.duplicates[0].vendorId);
    } else {
      setCommitMode('CREATE');
      setTargetVendorId(undefined);
    }

    setStep('PREVIEW');
  };

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    void (async () => {
      const cfg = await getVendorCatalogueConfig();
      if (active) setCatalogueConfig(cfg);

      // Resume active or completed-uncommitted Import Job if user left the screen and returned
      const savedJobId = typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_IMPORT_JOB_STORAGE_KEY) : null;
      let resumeJob: VendorImportJob | null = savedJobId ? await pollVendorOnboardingJob(savedJobId) : null;
      if (!resumeJob) {
        const jobs = await listVendorOnboardingJobs();
        resumeJob = jobs.find((j) => ['UPLOADING', 'PROCESSING', 'VALIDATING', 'READY_FOR_REVIEW'].includes(j.status)) || null;
      }
      if (!active || !resumeJob) return;
      if (resumeJob.status === 'READY_FOR_REVIEW') {
        setActiveImportJob(resumeJob);
        const resData = await fetchVendorOnboardingJobResult(resumeJob.jobId);
        if (active && resData.success && resData.analysis) {
          applyAnalysisToPreviewState(resData.analysis);
        }
      } else if (['UPLOADING', 'PROCESSING', 'VALIDATING', 'COMMITTING'].includes(resumeJob.status)) {
        setActiveImportJob(resumeJob);
        setStep('ANALYSING');
      } else if (savedJobId) {
        try { localStorage.removeItem(ACTIVE_IMPORT_JOB_STORAGE_KEY); } catch {}
      }
    })();
    return () => {
      active = false;
    };
  }, [isOpen]);

  // Live background Import Job polling while on ANALYSING screen
  useEffect(() => {
    if (!isOpen || step !== 'ANALYSING' || !activeImportJob?.jobId) return;
    let cancelled = false;
    const jobId = activeImportJob.jobId;

    const tick = async () => {
      const job = await pollVendorOnboardingJob(jobId);
      if (cancelled || !job) return;
      setActiveImportJob(job);

      if (job.status === 'READY_FOR_REVIEW') {
        const resData = await fetchVendorOnboardingJobResult(job.jobId);
        if (cancelled) return;
        if (resData.success && resData.analysis) {
          applyAnalysisToPreviewState(resData.analysis);
        } else if (!resData.pending) {
          setAnalyzeError(resData.error || 'Failed to load completed catalogue extraction.');
          setStep('INPUT');
        }
      } else if (job.status === 'FAILED') {
        try { localStorage.removeItem(ACTIVE_IMPORT_JOB_STORAGE_KEY); } catch {}
        setAnalyzeError(job.error || 'Vendor catalogue processing failed.');
        setActiveImportJob(null);
        setStep('INPUT');
      } else if (job.status === 'CANCELLED') {
        try { localStorage.removeItem(ACTIVE_IMPORT_JOB_STORAGE_KEY); } catch {}
        setAnalyzeError('Catalogue import was cancelled.');
        setActiveImportJob(null);
        setStep('INPUT');
      }
    };

    const timer = setInterval(() => void tick(), 750);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isOpen, step, activeImportJob?.jobId]);

  if (!isOpen) return null;

  const handleFilesAdded = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    // Snapshot FileList synchronously before awaiting config, because clearing input.value mutates the live FileList in Chromium
    const incomingFiles = Array.from(fileList);
    setAnalyzeError(null);
    const cfg = await getVendorCatalogueConfig().catch(() => catalogueConfig);
    setCatalogueConfig(cfg);

    const allowed = cfg.allowedExtensions || ['.pdf', '.xls', '.xlsx', '.csv', '.jpg', '.jpeg', '.png', '.webp'];
    const loaded: StagedOnboardingFile[] = [];

    for (let i = 0; i < incomingFiles.length; i++) {
      const f = incomingFiles[i];
      const lower = f.name.toLowerCase();
      if (!allowed.some((ext) => lower.endsWith(ext))) {
        setAnalyzeError(`Unsupported file type: "${f.name}". Allowed: ${cfg.allowedFormatsLabel}.`);
        continue;
      }
      if (f.size <= 0) {
        setAnalyzeError(`File "${f.name}" is empty (0 bytes).`);
        continue;
      }
      if (f.size > cfg.maxFileSizeBytes) {
        setAnalyzeError(`File exceeds configured maximum size of ${cfg.maxFileSizeMb} MB`);
        continue;
      }
      loaded.push({
        id: `FILE-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        name: f.name,
        mimeType: f.type || 'application/octet-stream',
        size: f.size,
        rawFile: f,
        uploadProgress: 0,
      });
    }
    if (loaded.length > 0) {
      setStagedFiles((prev) => [...prev, ...loaded]);
    }
  };

  const handleLoadSamplePackage = () => {
    setAnalyzeError(null);
    setVendorNameHint('Apex Precision Motion & Automation Pvt Ltd');
    setWebsiteUrl('');
    setPastedText(SAMPLE_CARD_TEXT);
    setStagedFiles([
      {
        id: `SAMPLE-CSV-${Date.now()}`,
        name: 'Apex_SKF_Schneider_PriceList_2026.csv',
        mimeType: 'text/csv',
        size: SAMPLE_CATALOGUE_CSV.length,
        sourceRole: 'Catalogue / Price List',
        textContent: SAMPLE_CATALOGUE_CSV,
      },
    ]);
  };

  const handleRunAnalysis = async (customMapping?: Record<string, string>, forceRefresh?: boolean) => {
    const cleanUrl = websiteUrl.trim();
    const cleanText = pastedText.trim();
    if (!cleanUrl && !cleanText && stagedFiles.length === 0) {
      setAnalyzeError('Please enter a Vendor Website URL, upload a Catalogue/Brochure/Excel/Image, or paste vendor details.');
      return;
    }
    setAnalyzeError(null);
    setSaveError(null);
    setActiveImportJob(null);
    setUploadTransferStatus(null);
    setStep('ANALYSING');

    try {
      const preparedFiles: Array<{
        uploadId?: string;
        name: string;
        mimeType?: string;
        size?: number;
        sourceRole?: string;
        textContent?: string;
        base64Data?: string;
      }> = [];

      const binaryCount = stagedFiles.filter((f) => Boolean(f.rawFile)).length;
      let binaryCursor = 0;

      for (const sf of stagedFiles) {
        if (sf.rawFile) {
          binaryCursor += 1;
          setUploadTransferStatus({
            fileName: sf.name,
            fileSizeBytes: sf.size,
            percent: 0,
            fileIndex: binaryCursor,
            totalFiles: binaryCount,
          });
          const uploaded = await uploadCatalogueFileInChunks(sf.rawFile, {
            sourceRole: sf.sourceRole,
            chunkSizeBytes: catalogueConfig.uploadChunkSizeBytes,
            onProgress: (pct) => {
              setUploadTransferStatus({
                fileName: sf.name,
                fileSizeBytes: sf.size,
                percent: pct,
                fileIndex: binaryCursor,
                totalFiles: binaryCount,
              });
            },
          });
          preparedFiles.push({
            uploadId: uploaded.uploadId,
            name: uploaded.fileName,
            mimeType: sf.mimeType,
            size: uploaded.fileSizeBytes,
            sourceRole: sf.sourceRole,
          });
        } else {
          preparedFiles.push({
            name: sf.name,
            mimeType: sf.mimeType,
            size: sf.size,
            sourceRole: sf.sourceRole,
            textContent: sf.textContent,
            base64Data: sf.base64Data,
          });
        }
      }

      setUploadTransferStatus(null);

      const startRes = await startVendorOnboardingJob({
        vendorNameHint: vendorNameHint.trim() || undefined,
        websiteUrl: cleanUrl || undefined,
        pastedText: cleanText || undefined,
        files: preparedFiles,
        columnMappingOverride: customMapping || (Object.keys(columnMappingOverride).length > 0 ? columnMappingOverride : undefined),
        forceRefresh,
      });

      if (!startRes.success || !startRes.job) {
        setAnalyzeError(startRes.error || 'Failed to launch vendor import job.');
        setStep('INPUT');
        return;
      }

      try { localStorage.setItem(ACTIVE_IMPORT_JOB_STORAGE_KEY, startRes.job.jobId); } catch {}
      setActiveImportJob(startRes.job);
    } catch (err: any) {
      setUploadTransferStatus(null);
      setAnalyzeError(err?.message || 'Catalogue upload or validation failed.');
      setStep('INPUT');
    }
  };

  const handleResolveConflict = (field: string, chosenValue: string) => {
    setResolvedConflicts((prev) => ({ ...prev, [field]: chosenValue }));
    if (field === 'companyName') setCompany((c) => ({ ...c, companyName: chosenValue }));
    else if (field === 'legalName') setCompany((c) => ({ ...c, legalName: chosenValue }));
    else if (field === 'gstin') setCompany((c) => ({ ...c, gstin: chosenValue }));
    else if (field === 'pan') setCompany((c) => ({ ...c, pan: chosenValue }));
    else if (field === 'vendorType') setCompany((c) => ({ ...c, vendorType: chosenValue as any }));
    else if (field === 'address') setStructuredAddress((a) => ({ ...a, rawAddress: chosenValue }));
    else if (field === 'city') setStructuredAddress((a) => ({ ...a, city: chosenValue }));
    else if (field === 'state') setStructuredAddress((a) => ({ ...a, state: chosenValue }));
    else if (field === 'pincode') setStructuredAddress((a) => ({ ...a, pincode: chosenValue }));
    else if (field === 'email' && contacts[0]) {
      setContacts((prev) => prev.map((ct, idx) => (idx === 0 ? { ...ct, email: chosenValue } : ct)));
    } else if (field === 'mobile' && contacts[0]) {
      setContacts((prev) => prev.map((ct, idx) => (idx === 0 ? { ...ct, mobile: chosenValue } : ct)));
    }
  };

  const liveCompletion = computeOnboardingCompletion({
    company,
    structuredAddress,
    contacts,
    brands: brandsList,
    categories: categoriesList,
    productFamilies,
    products: productsList,
    conflicts,
    sourceTraceability: analysisResult?.sourceTraceability || [],
  });

  const handleAddContact = () => {
    setContacts((prev) => [
      ...prev,
      {
        id: `CNT-${Date.now()}`,
        name: '',
        department: 'Sales',
        email: '',
        mobile: '',
        isPrimary: prev.length === 0,
        source: 'Manual Entry',
        confidence: 100,
      },
    ]);
  };

  const handleAddCustomBrand = () => {
    const clean = newBrandInput.trim();
    if (!clean) return;
    if (brandsList.some((b) => b.brandName.toLowerCase() === clean.toLowerCase())) {
      setNewBrandInput('');
      return;
    }
    setBrandsList((prev) => [
      ...prev,
      {
        brandName: clean,
        relationshipType: 'Listed In Catalogue',
        productCount: 0,
        source: 'User Confirmation',
        confidence: 100,
        firstDetected: new Date().toISOString().split('T')[0],
        lastVerified: new Date().toISOString().split('T')[0],
        evidence: 'Added during onboarding review',
        isExistingMaster: false,
        resolutionAction: 'CREATE_NEW',
      },
    ]);
    setNewBrandInput('');
  };

  const handleAddCustomCategory = () => {
    const clean = newCategoryInput.trim();
    if (!clean) return;
    if (categoriesList.some((c) => c.category.toLowerCase() === clean.toLowerCase())) {
      setNewCategoryInput('');
      return;
    }
    setCategoriesList((prev) => [
      ...prev,
      {
        id: `CAT-${Date.now()}`,
        category: clean,
        brands: [],
        productCount: 0,
        source: 'User Confirmation',
        confidence: 100,
        isExistingMaster: false,
        selected: true,
      },
    ]);
    setNewCategoryInput('');
  };

  const handleSaveVendorCommit = async () => {
    setSaveError(null);
    const cleanName = (company.companyName || '').trim();
    if (!cleanName) {
      setSaveError('Company Name is mandatory before saving.');
      return;
    }
    const cleanGst = (company.gstin || '').trim().toUpperCase();
    if (cleanGst && cleanGst !== 'NOT FOUND' && !validateGstinFormat(cleanGst)) {
      setSaveError(`Invalid GSTIN format "${cleanGst}". Must be valid 15-character Indian GSTIN, or leave blank if not available.`);
      return;
    }
    const cleanPan = (company.pan || '').trim().toUpperCase();
    if (cleanPan && cleanPan !== 'NOT FOUND' && !validatePanFormat(cleanPan)) {
      setSaveError(`Invalid PAN format "${cleanPan}". Must be 10 characters (e.g. AABCA1234F), or leave blank.`);
      return;
    }

    setIsSaving(true);
    const payload: VendorOnboardingCommitPayload = {
      mode: commitMode,
      targetVendorId: commitMode === 'UPDATE' ? targetVendorId : undefined,
      importJobId: analysisResult?.importJobId || activeImportJob?.jobId,
      company: {
        ...company,
        companyName: cleanName,
        gstin: cleanGst === 'NOT FOUND' ? '' : cleanGst,
        pan: cleanPan === 'NOT FOUND' ? '' : cleanPan,
      },
      structuredAddress,
      contacts: contacts.filter((c) => c.name || c.email || c.mobile || c.landline || c.whatsapp),
      brands: brandsList.filter((b) => b.resolutionAction !== 'SKIP'),
      categories: categoriesList.filter((c) => c.selected !== false),
      productFamilies,
      products: productsList.filter((p) => p.accepted !== false),
      createMissingProductsInMaster: createMissingInMaster,
      sourceTraceability: analysisResult?.sourceTraceability || [],
      sourcesSummary: (analysisResult?.sourcesAnalyzed || []).map((s) => ({
        sourceType: s.sourceType,
        sourceName: s.sourceName,
        status: s.status,
        itemsExtracted: s.itemsExtracted,
      })),
      websiteIntelligence: analysisResult?.websiteIntelligence,
      websiteUrl: company.website || websiteUrl.trim() || undefined,
    };

    const res = await commitVendorOnboarding(payload);
    setIsSaving(false);

    if (!res.success || !res.vendor) {
      setSaveError(res.error || 'Could not save vendor due to a validation or database error.');
      return;
    }

    try { localStorage.removeItem(ACTIVE_IMPORT_JOB_STORAGE_KEY); } catch {}
    onSuccessVendorSaved(res.vendor.id);
  };

  const handleTransferToManual = () => {
    const primary = contacts.find((c) => c.isPrimary) || contacts[0];
    onSwitchToManual({
      companyName: company.companyName || vendorNameHint,
      legalName: company.legalName,
      vendorType: company.vendorType,
      website: company.website || websiteUrl,
      country: company.country || 'India',
      contactPerson: primary?.name || '',
      email: primary?.email || '',
      mobile: primary?.mobile || '',
      alternateMobile: primary?.alternateMobile || '',
      address: structuredAddress.rawAddress || '',
      city: structuredAddress.city || '',
      state: structuredAddress.state || '',
      pincode: structuredAddress.pincode || '',
      gstin: company.gstin || '',
      pan: company.pan || '',
      brands: brandsList.map((b) => b.brandName).filter(Boolean),
      categories: Array.from(new Set(categoriesList.filter((c) => c.selected !== false).map((c) => c.category))),
      products: productsList.filter((p) => p.accepted !== false),
    });
  };

  const getTraceBadge = (field: string) => {
    const t = analysisResult?.sourceTraceability?.find((item) => item.field === field);
    if (!t) return null;
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-semibold border border-slate-200"
        title={`Extracted from ${t.sourceName}`}
      >
        <span>{t.sourceType}</span>
        <span className="text-emerald-700 font-mono">{t.confidence}%</span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-150">
        {/* TOP WIZARD HEADER */}
        <div className="bg-slate-900 text-white px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-blue-500/20 text-blue-300 rounded-xl border border-blue-400/30 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base tracking-tight">
                Smart Vendor Onboarding & Intelligence Engine
              </h3>
              <p className="text-[11px] text-slate-300">
                Auto-extract company identity, GSTIN, contacts, brands, categories & products from any vendor document or website
              </p>
            </div>
          </div>

          {/* Option A vs Option B Switcher */}
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0">
            <div className="flex flex-wrap items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-[11px] sm:text-xs max-w-full">
              <button
                type="button"
                className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold flex items-center gap-1.5 shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Option A: Automatic</span>
              </button>
              <button
                type="button"
                onClick={handleTransferToManual}
                className="px-2.5 sm:px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/70 font-semibold transition-colors"
              >
                Option B: Manual Entry
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Vendor Onboarding Wizard"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* BODY CONTENT */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 text-xs space-y-5 bg-slate-50/40">
          {/* STEP 1: SMART MULTI-SOURCE INPUT AREA */}
          {step === 'INPUT' && (
            <div className="space-y-5">
              {analyzeError && (
                <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold block">Analysis Notice</span>
                    <span className="text-[11px]">{analyzeError}</span>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      Option A — Drop Any Available Vendor Sources
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Provide any combination of Website URL, Catalogue PDF, Excel/CSV price list, Brochure, GST doc, or Visiting Card image/text. Missing details will be asked only once after scan.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLoadSamplePackage}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold shrink-0 transition-colors"
                  >
                    Load Sample Brochure & Price List
                  </button>
                </div>

                {/* Website + Optional Vendor Hint */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-blue-600" />
                      <span>Vendor Website URL (Optional)</span>
                    </label>
                    <input
                      type="url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://examplevendor.com"
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-slate-500" />
                      <span>Company Name Hint (Optional — auto-detected if blank)</span>
                    </label>
                    <input
                      type="text"
                      value={vendorNameHint}
                      onChange={(e) => setVendorNameHint(e.target.value)}
                      placeholder="e.g. Apex Precision Motion"
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                </div>

                {/* Drag & Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFilesAdded(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/70'
                      : 'border-slate-300 bg-slate-50/60 hover:border-blue-400 hover:bg-blue-50/30'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => {
                      handleFilesAdded(e.target.files);
                      if (e.target) e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <Upload className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                  <p className="font-bold text-slate-800 text-sm">
                    Drag &amp; Drop Catalogue / Brochure / Price List / GST / Visiting Card
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Supports <strong className="text-slate-700">{catalogueConfig.allowedFormatsLabel}</strong> (up to{' '}
                    <strong className="text-blue-700">{catalogueConfig.maxFileSizeMb} MB</strong> per file • chunked streaming upload)
                  </p>
                </div>

                {/* Staged Files List */}
                {stagedFiles.length > 0 && (
                  <div className="space-y-2">
                    <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider block">
                      Uploaded Sources ({stagedFiles.length})
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {stagedFiles.map((file) => {
                        const isImg = file.mimeType.startsWith('image/');
                        const isSheet = file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.xls') || file.name.toLowerCase().endsWith('.xlsx');
                        return (
                          <div
                            key={file.id}
                            className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isImg ? (
                                <ImageIcon className="w-4 h-4 text-purple-600 shrink-0" />
                              ) : isSheet ? (
                                <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 truncate">{file.name}</div>
                                <div className="text-[10px] text-slate-400">
                                  {formatFileSizeHuman(file.size)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <select
                                value={file.sourceRole || ''}
                                onChange={(e) =>
                                  setStagedFiles((prev) =>
                                    prev.map((sf) => (sf.id === file.id ? { ...sf, sourceRole: e.target.value } : sf))
                                  )
                                }
                                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-700"
                              >
                                <option value="">Auto Detect Type</option>
                                <option value="Catalogue">Catalogue / Price List</option>
                                <option value="Brochure">Company Brochure</option>
                                <option value="GST Document">GST / Tax Document</option>
                                <option value="Business Card">Visiting Card</option>
                                <option value="Company Profile">Company Profile</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => setStagedFiles((prev) => prev.filter((sf) => sf.id !== file.id))}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pasted Visiting Card / Company Profile Text */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Paste Visiting Card / Email Signature / Company Profile / Line Card Text (Optional)
                  </label>
                  <textarea
                    rows={4}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste email footer, WhatsApp contact message, visiting card text, or company profile here..."
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTransferToManual}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs transition-colors"
                >
                  Use Manual Form Instead (Option B)
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunAnalysis()}
                    disabled={!websiteUrl.trim() && !pastedText.trim() && stagedFiles.length === 0}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>ANALYSE VENDOR</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: ASYNCHRONOUS LARGE CATALOGUE UPLOAD & IMPORT JOB PROGRESS */}
          {step === 'ANALYSING' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 max-w-2xl mx-auto my-4 shadow-xs space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 text-base">
                      {uploadTransferStatus ? 'Uploading Vendor Catalogue in Chunks...' : 'Importing Vendor Catalogue...'}
                    </h4>
                    <p className="text-[11px] text-slate-500 truncate">
                      {uploadTransferStatus
                        ? `Streaming file ${uploadTransferStatus.fileIndex} of ${uploadTransferStatus.totalFiles}: ${uploadTransferStatus.fileName}`
                        : activeImportJob?.currentStage || 'Processing catalogue pages, tables & OCR...'}
                    </p>
                  </div>
                </div>
                {activeImportJob && (
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg font-mono font-bold text-xs shrink-0">
                    {activeImportJob.progressPercent}%
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="h-3 bg-blue-600 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      uploadTransferStatus
                        ? uploadTransferStatus.percent
                        : activeImportJob?.progressPercent ?? 8
                    }%`,
                  }}
                />
              </div>

              {/* Structured Import Job Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">File</span>
                  <span className="font-bold text-slate-900 truncate block" title={uploadTransferStatus?.fileName || activeImportJob?.fileName || ''}>
                    {uploadTransferStatus?.fileName || activeImportJob?.fileName || vendorNameHint || websiteUrl || 'Vendor Sources'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">File Size</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatFileSizeHuman(uploadTransferStatus?.fileSizeBytes ?? activeImportJob?.fileSizeBytes ?? 0)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Pages / Sheets</span>
                  <span className="font-mono font-bold text-slate-900">
                    {activeImportJob && activeImportJob.totalPages > 0
                      ? `${activeImportJob.pagesProcessed} / ${activeImportJob.totalPages}`
                      : uploadTransferStatus
                        ? 'Uploading...'
                        : 'Scanning...'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Products Detected</span>
                  <span className="font-mono font-bold text-blue-700">
                    {(activeImportJob?.productsDetected ?? 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Valid / Review / Rejected</span>
                  <span className="font-mono font-bold text-slate-800">
                    <span className="text-emerald-700">{(activeImportJob?.validCount ?? 0).toLocaleString()}</span>
                    {' / '}
                    <span className="text-amber-700">{(activeImportJob?.reviewRequiredCount ?? 0).toLocaleString()}</span>
                    {' / '}
                    <span className="text-rose-700">{(activeImportJob?.rejectedCount ?? 0).toLocaleString()}</span>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Current Stage</span>
                  <span className="font-semibold text-indigo-800 truncate block" title={activeImportJob?.currentStage || ''}>
                    {uploadTransferStatus
                      ? `Uploading chunks (${uploadTransferStatus.percent}%)`
                      : activeImportJob?.currentStage || 'Starting Import Job...'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-slate-500">
                  Import runs asynchronously on server. You can close this window and resume anytime from Vendor Master.
                </span>
                <div className="flex items-center gap-2">
                  {activeImportJob && (
                    <button
                      type="button"
                      onClick={async () => {
                        await cancelVendorOnboardingJob(activeImportJob.jobId);
                        try { localStorage.removeItem(ACTIVE_IMPORT_JOB_STORAGE_KEY); } catch {}
                        setActiveImportJob(null);
                        setStep('INPUT');
                      }}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-[11px]"
                    >
                      Cancel Import
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-[11px]"
                  >
                    Continue in Background
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: VENDOR INTELLIGENCE PREVIEW & MINIMAL CONFIRMATION */}
          {step === 'PREVIEW' && analysisResult && (
            <div className="space-y-4">
              {/* Completion Score + Metrics Banner */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 shadow-md space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-200 border border-blue-400/30 rounded text-[10px] font-bold uppercase">
                        Vendor Intelligence Preview
                      </span>
                      <span className="font-mono text-xs text-emerald-300 font-bold">
                        Completion: {liveCompletion.overallPercent}% ({liveCompletion.requiredPercent}% Required)
                      </span>
                    </div>
                    <h4 className="font-bold text-base mt-1">
                      {company.companyName || 'Unnamed Supplier — Please confirm Company Name below'}
                    </h4>
                    <p className="text-[11px] text-slate-300">
                      Sources scanned: {analysisResult.sourcesAnalyzed.map((s) => `${s.sourceType} (${s.status})`).join(' • ')}
                    </p>
                  </div>

                  <div className="grid grid-cols-5 gap-2 text-center">
                    <div className="px-2.5 py-1.5 bg-white/10 rounded-xl">
                      <div className="text-base font-bold font-mono">{contacts.length}</div>
                      <div className="text-[9px] text-slate-300 uppercase">Contacts</div>
                    </div>
                    <div className="px-2.5 py-1.5 bg-white/10 rounded-xl">
                      <div className="text-base font-bold font-mono text-purple-300">{brandsList.length}</div>
                      <div className="text-[9px] text-slate-300 uppercase">Brands</div>
                    </div>
                    <div className="px-2.5 py-1.5 bg-white/10 rounded-xl">
                      <div className="text-base font-bold font-mono text-indigo-300">{categoriesList.filter((c) => c.selected !== false).length}</div>
                      <div className="text-[9px] text-slate-300 uppercase">Categories</div>
                    </div>
                    <div className="px-2.5 py-1.5 bg-white/10 rounded-xl">
                      <div className="text-base font-bold font-mono text-amber-300">{productFamilies.length}</div>
                      <div className="text-[9px] text-slate-300 uppercase">Families</div>
                    </div>
                    <div className="px-2.5 py-1.5 bg-white/10 rounded-xl">
                      <div className="text-base font-bold font-mono text-emerald-300">{productsList.filter((p) => p.accepted !== false).length}</div>
                      <div className="text-[9px] text-slate-300 uppercase">Products</div>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-white/15 rounded-full overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      liveCompletion.requiredPercent === 100 ? 'bg-emerald-400' : 'bg-blue-400'
                    }`}
                    style={{ width: `${liveCompletion.overallPercent}%` }}
                  />
                </div>

                {/* Extraction Classification Summary Strip */}
                {analysisResult.extractionSummary && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 bg-white/10 rounded-md font-mono">
                        Detected: {analysisResult.extractionSummary.totalDetected}
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 rounded-md font-mono font-bold">
                        Valid: {productsList.filter((p) => p.accepted !== false && p.reviewStatus !== 'Needs Review').length}
                      </span>
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-200 border border-amber-400/30 rounded-md font-mono font-bold">
                        Needs Review: {productsList.filter((p) => p.reviewStatus === 'Needs Review').length}
                      </span>
                      <span className="px-2 py-0.5 bg-rose-500/20 text-rose-200 border border-rose-400/30 rounded-md font-mono font-bold">
                        Rejected / Filtered: {suspiciousList.filter((s) => s.status !== 'ACCEPTED' && s.status !== 'IGNORED').length}
                      </span>
                      {analysisResult.cacheHit && (
                        <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 rounded-md font-mono">
                          Cached
                        </span>
                      )}
                    </div>
                    {suspiciousList.some((s) => s.status !== 'ACCEPTED' && s.status !== 'IGNORED') && (
                      <button
                        type="button"
                        onClick={() => setPreviewTab('suspicious')}
                        className="px-2.5 py-1 bg-rose-500/30 hover:bg-rose-500/50 text-white rounded-lg font-bold transition-colors"
                      >
                        Inspect Suspicious &amp; Rejected Items →
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Save Validation Error Banner */}
              {saveError && (
                <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold block">Save Blocked — Validation / Database Protection</span>
                    <span className="text-[11px]">{saveError}</span>
                  </div>
                  <button type="button" onClick={() => setSaveError(null)} className="text-rose-400 hover:text-rose-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Duplicate Existing Vendor Detection Alert */}
              {analysisResult.duplicates && analysisResult.duplicates.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h5 className="font-bold text-amber-950 text-xs sm:text-sm">
                        Possible Duplicate Vendor Found in ERP Master ({analysisResult.duplicates.length})
                      </h5>
                      <p className="text-[11px] text-amber-800">
                        Choose whether to open the existing vendor, merge/update it transactionally, or force creation as a separate vendor.
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-white border border-amber-300 text-amber-900 font-bold text-[10px]">
                      Mode: {commitMode === 'UPDATE' ? `Update ${targetVendorId}` : 'Create New'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {analysisResult.duplicates.map((dup) => (
                      <div
                        key={dup.vendorId}
                        className="p-3 bg-white border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-blue-700">{dup.vendorCode}</span>
                            <span className="font-bold text-slate-900">{dup.companyName}</span>
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold text-[10px]">
                              {dup.similarityScore}% Match
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Matched on: {dup.matchedOn.join(' • ')} {dup.gstin ? `• GSTIN: ${dup.gstin}` : ''}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onOpenExistingVendor(dup.vendorId)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-[11px]"
                          >
                            Open Existing
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCommitMode('UPDATE');
                              setTargetVendorId(dup.vendorId);
                            }}
                            className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] ${
                              commitMode === 'UPDATE' && targetVendorId === dup.vendorId
                                ? 'bg-blue-600 text-white'
                                : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200'
                            }`}
                          >
                            Update Existing
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCommitMode('CREATE');
                              setTargetVendorId(undefined);
                            }}
                            className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] ${
                              commitMode === 'CREATE'
                                ? 'bg-slate-900 text-white'
                                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            Create New
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Information Conflicts Alert */}
              {conflicts.length > 0 && (
                <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-2.5">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-indigo-700" />
                    <h5 className="font-bold text-indigo-950 text-xs">
                      Information Conflicts Detected Across Sources ({conflicts.length}) — Confirm Preferred Value
                    </h5>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {conflicts.map((conf) => (
                      <div key={conf.field} className="p-3 bg-white border border-indigo-200 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{conf.label}</span>
                          {resolvedConflicts[conf.field] && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              Resolved
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          {conf.candidates.map((cand, idx) => {
                            const activeVal = resolvedConflicts[conf.field] || conf.recommendedValue;
                            const isPicked = activeVal === cand.value;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleResolveConflict(conf.field, cand.value)}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center justify-between gap-2 transition-colors ${
                                  isPicked
                                    ? 'bg-blue-50 border-blue-400 text-blue-950 font-bold'
                                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                <span className="truncate">{cand.value}</span>
                                <span className="text-[9px] text-slate-500 shrink-0 font-mono">
                                  {cand.sourceType} ({cand.confidence}%)
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ONLY ASK USER FOR MISSING / UNCERTAIN REQUIRED FIELDS */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
                {liveCompletion.missingRequiredFields.length === 0 && (company.gstin || skipGstinExplicit) ? (
                  <div className="flex items-center gap-2 text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold">
                      All mandatory vendor profile fields were automatically extracted and verified! Review tabs below or click Save Vendor.
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <h5 className="font-bold text-slate-900 text-xs sm:text-sm">
                          Complete Only Missing / Unverified Mandatory Details
                        </h5>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Already extracted fields are pre-filled automatically.
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {!company.companyName.trim() && (
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Company / OEM Partner Name *</label>
                          <input
                            type="text"
                            value={company.companyName}
                            onChange={(e) => setCompany((c) => ({ ...c, companyName: e.target.value }))}
                            placeholder="Enter Company Name"
                            className="w-full p-2 border border-amber-300 bg-amber-50/40 rounded-xl font-bold"
                          />
                        </div>
                      )}
                      {!(contacts[0]?.mobile || '').trim() && (
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Primary Phone / Mobile *</label>
                          <input
                            type="text"
                            value={contacts[0]?.mobile || ''}
                            onChange={(e) =>
                              setContacts((prev) =>
                                prev.map((c, idx) => (idx === 0 ? { ...c, mobile: e.target.value } : c))
                              )
                            }
                            placeholder="+91 98XXXXXXXX"
                            className="w-full p-2 border border-amber-300 bg-amber-50/40 rounded-xl font-mono"
                          />
                        </div>
                      )}
                      {!(contacts[0]?.email || '').trim() && (
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Primary Email Address *</label>
                          <input
                            type="email"
                            value={contacts[0]?.email || ''}
                            onChange={(e) =>
                              setContacts((prev) =>
                                prev.map((c, idx) => (idx === 0 ? { ...c, email: e.target.value } : c))
                              )
                            }
                            placeholder="sales@vendor.com"
                            className="w-full p-2 border border-amber-300 bg-amber-50/40 rounded-xl"
                          />
                        </div>
                      )}
                      {!(structuredAddress.city || '').trim() && (
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">City *</label>
                          <input
                            type="text"
                            value={structuredAddress.city || ''}
                            onChange={(e) => setStructuredAddress((a) => ({ ...a, city: e.target.value }))}
                            placeholder="e.g. Pune"
                            className="w-full p-2 border border-amber-300 bg-amber-50/40 rounded-xl"
                          />
                        </div>
                      )}
                      {!company.gstin?.trim() && !skipGstinExplicit && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="font-bold text-slate-700">GSTIN (Not found in documents)</label>
                            <button
                              type="button"
                              onClick={() => setSkipGstinExplicit(true)}
                              className="text-[10px] font-bold text-blue-600 hover:underline"
                            >
                              Not Available
                            </button>
                          </div>
                          <input
                            type="text"
                            value={company.gstin || ''}
                            onChange={(e) => setCompany((c) => ({ ...c, gstin: e.target.value.toUpperCase() }))}
                            placeholder="Optional 15-char GSTIN"
                            className="w-full p-2 border border-slate-300 rounded-xl font-mono uppercase"
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* PREVIEW NAVIGATION TABS */}
              <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setPreviewTab('company')}
                  className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                    previewTab === 'company' ? 'bg-slate-900 text-white shadow-2xs' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>Company, Tax, Address &amp; Contacts ({contacts.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('brands')}
                  className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                    previewTab === 'brands' ? 'bg-slate-900 text-white shadow-2xs' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Brands ({brandsList.length}) &amp; Categories ({categoriesList.filter((c) => c.selected !== false).length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('products')}
                  className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                    previewTab === 'products' ? 'bg-slate-900 text-white shadow-2xs' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Products &amp; Part Codes ({productsList.filter((p) => p.accepted !== false).length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('suspicious')}
                  className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                    previewTab === 'suspicious'
                      ? 'bg-rose-700 text-white shadow-2xs'
                      : 'bg-white text-rose-800 hover:bg-rose-50 border border-rose-200'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>
                    Suspicious &amp; Rejected ({suspiciousList.filter((s) => s.status !== 'ACCEPTED' && s.status !== 'IGNORED').length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('commercial')}
                  className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                    previewTab === 'commercial' ? 'bg-slate-900 text-white shadow-2xs' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Commercial, Bank &amp; Master Rules</span>
                </button>
              </div>

              {/* TAB 1: COMPANY, TAX, STRUCTURED ADDRESS & CONTACTS */}
              {previewTab === 'company' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                    <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Company Identity &amp; Tax</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-bold text-slate-700">Company / OEM Partner Name *</label>
                          {getTraceBadge('companyName')}
                        </div>
                        <input
                          type="text"
                          value={company.companyName}
                          onChange={(e) => setCompany((c) => ({ ...c, companyName: e.target.value }))}
                          className="w-full p-2 border border-slate-300 rounded-xl font-bold"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-bold text-slate-700">Vendor Type</label>
                          {getTraceBadge('vendorType')}
                        </div>
                        <select
                          value={company.vendorType}
                          onChange={(e) => setCompany((c) => ({ ...c, vendorType: e.target.value as any }))}
                          className="w-full p-2 border border-slate-300 rounded-xl bg-white font-semibold"
                        >
                          <option value="Authorised Distributor">Authorised Distributor</option>
                          <option value="Distributor">Distributor</option>
                          <option value="Authorised Dealer">Authorised Dealer</option>
                          <option value="Manufacturer">Manufacturer (OEM)</option>
                          <option value="OEM">OEM</option>
                          <option value="Manufacturer & Distributor">Manufacturer &amp; Distributor</option>
                          <option value="Dealer">Dealer</option>
                          <option value="Stockist">Stockist / Trader</option>
                          <option value="System Integrator">System Integrator</option>
                          <option value="Service Provider">Service Provider</option>
                          <option value="Fabricator">Fabricator</option>
                          <option value="Importer">Importer</option>
                          <option value="Exporter">Exporter</option>
                          <option value="Trader">Trader</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-bold text-slate-700">Legal / Registered Entity Name</label>
                          {getTraceBadge('legalName')}
                        </div>
                        <input
                          type="text"
                          value={company.legalName}
                          onChange={(e) => setCompany((c) => ({ ...c, legalName: e.target.value }))}
                          className="w-full p-2 border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-bold text-slate-700">Official Website</label>
                          {company.website?.trim() ? (
                            getTraceBadge('website')
                          ) : (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold border border-slate-200">
                              Not Found
                            </span>
                          )}
                        </div>
                        <input
                          type="url"
                          value={company.website}
                          onChange={(e) => setCompany((c) => ({ ...c, website: e.target.value }))}
                          placeholder="Not Found — https://"
                          className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-bold text-slate-700">GSTIN (Never fabricated)</label>
                          {company.gstin?.trim() ? (
                            getTraceBadge('gstin')
                          ) : (
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[9px] font-bold border border-amber-200">
                              Not Found
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          value={company.gstin || ''}
                          onChange={(e) => setCompany((c) => ({ ...c, gstin: e.target.value.toUpperCase() }))}
                          placeholder="Not Found"
                          className="w-full p-2 border border-slate-300 rounded-xl font-mono uppercase"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-bold text-slate-700">PAN</label>
                          {company.pan?.trim() ? (
                            getTraceBadge('pan')
                          ) : (
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[9px] font-bold border border-amber-200">
                              Not Found
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          value={company.pan || ''}
                          onChange={(e) => setCompany((c) => ({ ...c, pan: e.target.value.toUpperCase() }))}
                          placeholder="Not Found"
                          className="w-full p-2 border border-slate-300 rounded-xl font-mono uppercase"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Country</label>
                        <input
                          type="text"
                          value={company.country || 'India'}
                          onChange={(e) => setCompany((c) => ({ ...c, country: e.target.value }))}
                          className="w-full p-2 border border-slate-300 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Structured Address */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Structured Address</span>
                      </h5>
                      <span className="text-[10px] font-mono text-slate-500">
                        Split Confidence: {structuredAddress.splitConfidence || 50}%
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-3">
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-bold text-slate-700">Full / Raw Address</label>
                          {!structuredAddress.rawAddress?.trim() && (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold border border-slate-200">
                              Not Found
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          value={structuredAddress.rawAddress}
                          onChange={(e) => setStructuredAddress((a) => ({ ...a, rawAddress: e.target.value }))}
                          placeholder="Not Found"
                          className="w-full p-2 border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">Plot / Building</label>
                        <input
                          type="text"
                          value={structuredAddress.plotOrBuilding || ''}
                          onChange={(e) => setStructuredAddress((a) => ({ ...a, plotOrBuilding: e.target.value }))}
                          className="w-full p-2 border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">Street / Road</label>
                        <input
                          type="text"
                          value={structuredAddress.street || ''}
                          onChange={(e) => setStructuredAddress((a) => ({ ...a, street: e.target.value }))}
                          className="w-full p-2 border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">Area / MIDC / GIDC</label>
                        <input
                          type="text"
                          value={structuredAddress.industrialEstateOrArea || ''}
                          onChange={(e) => setStructuredAddress((a) => ({ ...a, industrialEstateOrArea: e.target.value }))}
                          className="w-full p-2 border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">City *</label>
                        <input
                          type="text"
                          value={structuredAddress.city || ''}
                          onChange={(e) => setStructuredAddress((a) => ({ ...a, city: e.target.value }))}
                          className="w-full p-2 border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">State</label>
                        <input
                          type="text"
                          value={structuredAddress.state || ''}
                          onChange={(e) => setStructuredAddress((a) => ({ ...a, state: e.target.value }))}
                          className="w-full p-2 border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">PIN Code</label>
                        <input
                          type="text"
                          value={structuredAddress.pincode || ''}
                          onChange={(e) => setStructuredAddress((a) => ({ ...a, pincode: e.target.value }))}
                          className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Multiple Contacts Editor */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-blue-600" />
                        <span>Multi-Department Contacts ({contacts.length})</span>
                      </h5>
                      <button
                        type="button"
                        onClick={handleAddContact}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-bold text-[11px] flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Contact</span>
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      {contacts.map((ct, idx) => (
                        <div key={ct.id || idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setContacts((prev) =>
                                    prev.map((item, i) => ({ ...item, isPrimary: i === idx }))
                                  )
                                }
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  ct.isPrimary
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                                }`}
                              >
                                {ct.isPrimary ? 'Primary Contact' : 'Set Primary'}
                              </button>
                              <span className="text-[10px] text-slate-500">Source: {ct.source} ({ct.confidence}%)</span>
                            </div>
                            {contacts.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setContacts((prev) => prev.filter((_, i) => i !== idx))}
                                className="text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                            <input
                              type="text"
                              value={ct.name}
                              onChange={(e) =>
                                setContacts((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item))
                                )
                              }
                              placeholder="Contact Person Name"
                              className="p-2 bg-white border border-slate-300 rounded-lg sm:col-span-2 font-semibold"
                            />
                            <select
                              value={ct.department || 'General'}
                              onChange={(e) =>
                                setContacts((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, department: e.target.value as any } : item))
                                )
                              }
                              className="p-2 bg-white border border-slate-300 rounded-lg"
                            >
                              <option value="Sales">Sales</option>
                              <option value="Purchase">Purchase</option>
                              <option value="Support">Support</option>
                              <option value="Service">Service</option>
                              <option value="Accounts">Accounts</option>
                              <option value="General">General</option>
                            </select>
                            <input
                              type="email"
                              value={ct.email || ''}
                              onChange={(e) =>
                                setContacts((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, email: e.target.value } : item))
                                )
                              }
                              placeholder="Email"
                              className="p-2 bg-white border border-slate-300 rounded-lg"
                            />
                            <input
                              type="text"
                              value={ct.mobile || ''}
                              onChange={(e) =>
                                setContacts((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, mobile: e.target.value } : item))
                                )
                              }
                              placeholder="Mobile"
                              className="p-2 bg-white border border-slate-300 rounded-lg font-mono"
                            />
                            <input
                              type="text"
                              value={ct.whatsapp || ct.landline || ''}
                              onChange={(e) =>
                                setContacts((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, landline: e.target.value } : item))
                                )
                              }
                              placeholder="Landline / WhatsApp"
                              className="p-2 bg-white border border-slate-300 rounded-lg font-mono"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: BRANDS RECONCILIATION & CATEGORY HIERARCHY */}
              {previewTab === 'brands' && (
                <div className="space-y-4">
                  {/* Brands Table */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                          Detected Brands &amp; Brand Master Reconciliation ({brandsList.length})
                        </h5>
                        <p className="text-[11px] text-slate-500">
                          "Authorised Distributor" is assigned strictly with explicit document evidence. Resolve fuzzy Brand Master matches below.
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newBrandInput}
                          onChange={(e) => setNewBrandInput(e.target.value)}
                          placeholder="Add brand..."
                          className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomBrand}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs"
                        >
                          + Add
                        </button>
                      </div>
                    </div>

                    {brandsList.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                        No OEM brands identified yet. Add a brand manually above if known.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                            <tr>
                              <th className="py-2 px-3">Brand</th>
                              <th className="py-2 px-3">Master Match / Ambiguity</th>
                              <th className="py-2 px-3">Relationship Type</th>
                              <th className="py-2 px-3 text-center">Products</th>
                              <th className="py-2 px-3">Source &amp; Conf</th>
                              <th className="py-2 px-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {brandsList.map((b, idx) => (
                              <tr key={`${b.brandName}-${idx}`} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 font-bold text-slate-900">{b.brandName}</td>
                                <td className="py-2.5 px-3">
                                  {b.isExistingMaster ? (
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                                      Matched Master ({b.brandId})
                                    </span>
                                  ) : b.ambiguousMatches && b.ambiguousMatches.length > 0 ? (
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-bold text-amber-800 block">
                                        Possible Match: {b.ambiguousMatches[0].name} ({b.ambiguousMatches[0].score}%)
                                      </span>
                                      <div className="flex flex-wrap gap-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setBrandsList((prev) =>
                                              prev.map((item, i) =>
                                                i === idx
                                                  ? {
                                                      ...item,
                                                      brandId: b.ambiguousMatches![0].id,
                                                      brandName: b.ambiguousMatches![0].name,
                                                      isExistingMaster: true,
                                                      resolutionAction: 'USE_EXISTING',
                                                    }
                                                  : item
                                              )
                                            )
                                          }
                                          className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold"
                                        >
                                          Use Existing
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setBrandsList((prev) =>
                                              prev.map((item, i) =>
                                                i === idx ? { ...item, resolutionAction: 'CREATE_NEW', ambiguousMatches: [] } : item
                                              )
                                            )
                                          }
                                          className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded text-[10px] font-bold"
                                        >
                                          Create New
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-bold">
                                      New Brand (Will Auto-Create)
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  <select
                                    value={b.relationshipType}
                                    onChange={(e) =>
                                      setBrandsList((prev) =>
                                        prev.map((item, i) =>
                                          i === idx ? { ...item, relationshipType: e.target.value as BrandRelationshipType } : item
                                        )
                                      )
                                    }
                                    className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-[11px] font-semibold"
                                  >
                                    {RELATIONSHIP_OPTIONS.map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold">{b.productCount}</td>
                                <td className="py-2.5 px-3 text-[11px] text-slate-600" title={b.evidence}>
                                  {b.source} ({b.confidence}%)
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setBrandsList((prev) => prev.filter((_, i) => i !== idx))}
                                    className="p-1 text-slate-400 hover:text-rose-600"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Multi-level Categories & Product Families */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Multi-Level Categories &amp; Product Families</span>
                        </h5>
                        <p className="text-[11px] text-slate-500">
                          Families: {productFamilies.length > 0 ? productFamilies.join(' • ') : 'None detected yet'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newCategoryInput}
                          onChange={(e) => setNewCategoryInput(e.target.value)}
                          placeholder="Add category..."
                          className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomCategory}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs"
                        >
                          + Add
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {categoriesList.map((cat, idx) => (
                        <label
                          key={cat.id}
                          className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-colors ${
                            cat.selected !== false
                              ? 'bg-indigo-50/50 border-indigo-300'
                              : 'bg-slate-50 border-slate-200 opacity-60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={cat.selected !== false}
                            onChange={(e) =>
                              setCategoriesList((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, selected: e.target.checked } : item))
                              )
                            }
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-900 truncate">{cat.category}</div>
                            <div className="text-[10px] text-slate-600">
                              {[cat.subCategory, cat.productFamily, cat.productType].filter(Boolean).join(' → ') || 'General'}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {cat.isExistingMaster ? 'Matched Master Category' : 'New Master Category'} • {cat.confidence}%
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PRODUCTS, PART CODES & RATES */}
              {previewTab === 'products' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                        Extracted Products &amp; Product Master Reconciliation ({productsList.filter((p) => p.accepted !== false).length} selected)
                      </h5>
                      <p className="text-[11px] text-slate-500">
                        Exact Part Numbers (e.g., 6006, 6006/C3, 6006-2RS1, 6006-2Z) and separate Source / Normalized / Designation identities are preserved strictly.
                      </p>
                    </div>
                    {analysisResult.spreadsheetPreview && analysisResult.spreadsheetPreview.headers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowColumnMapper((v) => !v)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-[11px] flex items-center gap-1.5 shrink-0"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>{showColumnMapper ? 'Hide Column Mapping' : 'Customize Spreadsheet Columns'}</span>
                      </button>
                    )}
                  </div>

                  {/* Custom CSV/Excel Column Mapping Override Panel */}
                  {showColumnMapper && analysisResult.spreadsheetPreview && analysisResult.spreadsheetPreview.headers.length > 0 && (
                    <div className="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-indigo-950 text-xs block">
                            CSV / Excel Column Mapping Override
                          </span>
                          <span className="text-[11px] text-indigo-700">
                            Adjust source columns and re-run extraction to guarantee exact row-by-row mapping.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRunAnalysis(columnMappingOverride, true)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[11px]"
                        >
                          Re-Analyze With Custom Mapping
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { key: 'brand', label: 'Brand / Make' },
                          { key: 'partNumber', label: 'Exact Part Code' },
                          { key: 'productDesignation', label: 'Designation' },
                          { key: 'productName', label: 'Product Name' },
                          { key: 'description', label: 'Description' },
                          { key: 'specification', label: 'Specification' },
                          { key: 'category', label: 'Category' },
                          { key: 'mrp', label: 'MRP' },
                          { key: 'discountPercent', label: 'Discount %' },
                          { key: 'purchaseRate', label: 'Purchase Rate' },
                          { key: 'uom', label: 'UOM' },
                        ].map((field) => (
                          <div key={field.key}>
                            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">{field.label}</label>
                            <select
                              value={columnMappingOverride[field.key] || ''}
                              onChange={(e) =>
                                setColumnMappingOverride((prev) => ({
                                  ...prev,
                                  [field.key]: e.target.value,
                                }))
                              }
                              className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-[11px]"
                            >
                              <option value="">-- Auto / None --</option>
                              {analysisResult.spreadsheetPreview!.headers.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {productsList.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                      No product table items were found in the uploaded sources. Vendor details, brands, and categories can still be saved!
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[420px]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase sticky top-0 z-10">
                          <tr>
                            <th className="py-2 px-2">Use</th>
                            <th className="py-2 px-2">Product Name &amp; Source Identity</th>
                            <th className="py-2 px-2">Brand</th>
                            <th className="py-2 px-2">Exact Part Code &amp; Designation</th>
                            <th className="py-2 px-2">Category &amp; Spec</th>
                            <th className="py-2 px-2 text-right">MRP / Disc / Net</th>
                            <th className="py-2 px-2">Score &amp; Source</th>
                            <th className="py-2 px-2">Master Match</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {productsList.map((p, idx) => (
                            <tr key={p.tempId} className={p.accepted === false ? 'opacity-45 bg-slate-50' : 'hover:bg-slate-50'}>
                              <td className="py-2 px-2">
                                <input
                                  type="checkbox"
                                  checked={p.accepted !== false}
                                  onChange={(e) =>
                                    setProductsList((prev) =>
                                      prev.map((item, i) => (i === idx ? { ...item, accepted: e.target.checked } : item))
                                    )
                                  }
                                />
                              </td>
                              <td className="py-2 px-2 min-w-[200px]">
                                <input
                                  type="text"
                                  value={p.productName}
                                  onChange={(e) =>
                                    setProductsList((prev) =>
                                      prev.map((item, i) => (i === idx ? { ...item, productName: e.target.value } : item))
                                    )
                                  }
                                  className="w-full px-2 py-1 border border-slate-200 rounded font-semibold"
                                />
                                {(p.sourceProductName && p.sourceProductName !== p.productName) && (
                                  <div className="text-[10px] text-slate-500 mt-0.5 truncate" title={p.sourceProductName}>
                                    Source: <span className="font-mono">{p.sourceProductName}</span>
                                  </div>
                                )}
                                {p.productFamily && (
                                  <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                                    Family: {p.productFamily}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="text"
                                  value={p.brand}
                                  onChange={(e) =>
                                    setProductsList((prev) =>
                                      prev.map((item, i) => (i === idx ? { ...item, brand: e.target.value } : item))
                                    )
                                  }
                                  className="w-28 px-2 py-1 border border-slate-200 rounded"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="text"
                                  value={p.partNumber || ''}
                                  placeholder="Part Code"
                                  onChange={(e) =>
                                    setProductsList((prev) =>
                                      prev.map((item, i) =>
                                        i === idx ? { ...item, partNumber: e.target.value, modelNumber: e.target.value } : item
                                      )
                                    )
                                  }
                                  className="w-28 px-2 py-1 border border-slate-200 rounded font-mono font-bold text-blue-800"
                                />
                                {p.productDesignation && p.productDesignation !== p.partNumber && (
                                  <div className="text-[10px] text-indigo-700 font-mono mt-0.5 truncate max-w-[130px]">
                                    Desig: {p.productDesignation}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-2 text-[11px] text-slate-600 max-w-[170px]">
                                <div className="font-semibold text-slate-800">{p.category}</div>
                                {p.subCategory && <div className="text-[10px] text-slate-500">{p.subCategory}</div>}
                                {p.specification && (
                                  <div className="text-[10px] text-slate-500 truncate" title={p.specification}>
                                    {p.specification}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right font-mono whitespace-nowrap">
                                <div className="text-[11px] text-slate-600">
                                  MRP: {typeof p.mrp === 'number' ? `₹${p.mrp.toLocaleString('en-IN')}` : '—'}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {typeof p.basicRate === 'number' ? `Basic ₹${p.basicRate}` : ''}
                                  {typeof p.discountPercent === 'number' ? ` (-${p.discountPercent}%)` : ''}
                                </div>
                                <div className="font-bold text-emerald-700">
                                  {typeof p.purchaseRate === 'number' ? `₹${p.purchaseRate.toLocaleString('en-IN')}` : '—'}
                                </div>
                              </td>
                              <td className="py-2 px-2">
                                <div
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    (p.validationScore || p.aiConfidence || 75) >= 90
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : (p.validationScore || p.aiConfidence || 75) >= 75
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-amber-100 text-amber-800'
                                  }`}
                                  title={p.validationBreakdown?.reasons?.join(' • ') || p.evidence}
                                >
                                  <span>{p.validationScore ?? p.aiConfidence ?? 80}/100</span>
                                </div>
                                <div className="text-[9px] text-slate-500 font-mono mt-0.5 truncate max-w-[130px]" title={`${p.sourceFile || p.catalogFileName || ''} ${p.sourceUrl || p.catalogReference || ''}`}>
                                  {p.sourceFile ? `${p.sourceFile.slice(0, 14)}${p.sourceFile.length > 14 ? '…' : ''} • ` : ''}
                                  {p.catalogueRow ? `Row ${p.catalogueRow}` : p.sourcePages?.length ? `Pg ${p.sourcePages.join(',')}` : p.sourcePage ? `Pg ${p.sourcePage}` : p.sourceType || 'WEB'}
                                </div>
                              </td>
                              <td className="py-2 px-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                    p.matchStatus === 'EXACT_MATCH'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : p.matchStatus === 'AMBIGUOUS_MATCH'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {p.matchStatus === 'EXACT_MATCH'
                                    ? 'Exact Match'
                                    : p.matchStatus === 'AMBIGUOUS_MATCH'
                                      ? 'Review Match'
                                      : 'New Product'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3B: SUSPICIOUS & REJECTED ITEMS REPORT */}
              {previewTab === 'suspicious' && (
                <div className="bg-white rounded-2xl border border-rose-200 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h5 className="font-bold text-rose-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>Suspicious &amp; Rejected Items Report ({suspiciousList.length})</span>
                      </h5>
                      <p className="text-[11px] text-slate-600">
                        Pagination, platform footers (e.g. IndiaMART), addresses, taglines, category headings, and low-confidence blocks are automatically isolated here. Promote valid items or ignore noise.
                      </p>
                    </div>
                  </div>

                  {suspiciousList.length === 0 ? (
                    <div className="p-8 text-center text-emerald-700 bg-emerald-50/50 rounded-xl border border-emerald-200 font-semibold">
                      Zero suspicious or rejected noise lines detected in these sources.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                      {suspiciousList.map((s) => {
                        const isEditing = editingSuspiciousId === s.id;
                        return (
                          <div
                            key={s.id}
                            className={`p-3 rounded-xl border text-xs transition-all ${
                              s.status === 'ACCEPTED'
                                ? 'bg-emerald-50/60 border-emerald-200'
                                : s.status === 'IGNORED'
                                  ? 'bg-slate-50 border-slate-200 opacity-55'
                                  : 'bg-rose-50/30 border-rose-200'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">
                                    {s.rejectionCategory}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                                    Class: {s.contentClass}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-[10px] font-bold">
                                    Score: {s.score}/100
                                  </span>
                                  {s.status && (
                                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-bold text-[10px]">
                                      {s.status}
                                    </span>
                                  )}
                                </div>
                                <div className="font-mono text-[11px] text-slate-900 bg-white/80 p-2 rounded border border-slate-200 break-words">
                                  {s.rawText}
                                </div>
                                <div className="text-[11px] text-slate-600">
                                  Reason: <span className="font-medium text-slate-800">{s.reason}</span>
                                  {s.catalogueRow ? ` • Row ${s.catalogueRow}` : ''}
                                  {s.sourcePage ? ` • Page ${s.sourcePage}` : ''}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                {s.status !== 'ACCEPTED' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const promoted: OnboardingProductCandidate = {
                                          tempId: `PROM-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                                          vendorId: 'NEW',
                                          accepted: true,
                                          productName: s.suggestedProductName || s.rawText.slice(0, 80),
                                          sourceProductName: s.suggestedProductName || s.rawText.slice(0, 80),
                                          normalizedProductName: s.suggestedProductName || s.rawText.slice(0, 80),
                                          productDesignation: s.suggestedPartCode || s.suggestedProductName || s.rawText.slice(0, 60),
                                          description: s.rawText,
                                          brand: s.suggestedBrand || 'Unconfirmed',
                                          partNumber: s.suggestedPartCode || '',
                                          modelNumber: s.suggestedPartCode || '',
                                          category: s.suggestedCategory || 'Industrial Supplies',
                                          uom: 'NOS',
                                          keywords: [s.suggestedCategory || 'Industrial Supplies', s.suggestedBrand || '', s.suggestedPartCode || ''].filter(Boolean),
                                          sourcePage: s.sourcePage,
                                          sourceUrl: s.sourceUrl,
                                          catalogueRow: s.catalogueRow,
                                          originalSourceText: s.rawText,
                                          evidence: s.rawText,
                                          reviewStatus: 'Verified',
                                          approvalStatus: 'APPROVED',
                                          matchStatus: 'NEW_PRODUCT',
                                          aiConfidence: Math.max(70, s.score),
                                          confidenceLevel: 'Medium',
                                          validationScore: s.score,
                                        };
                                        setProductsList((prev) => [promoted, ...prev]);
                                        setSuspiciousList((prev) =>
                                          prev.map((item) => (item.id === s.id ? { ...item, status: 'ACCEPTED' } : item))
                                        );
                                      }}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px]"
                                    >
                                      Accept as Product
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingSuspiciousId(isEditing ? null : s.id);
                                        setSuspiciousDraft({
                                          productName: s.suggestedProductName || s.rawText.slice(0, 80),
                                          brand: s.suggestedBrand || '',
                                          partNumber: s.suggestedPartCode || '',
                                          category: s.suggestedCategory || 'Industrial Supplies',
                                          specification: '',
                                        });
                                      }}
                                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-bold text-[10px]"
                                    >
                                      Edit &amp; Promote
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSuspiciousList((prev) =>
                                      prev.map((item) => (item.id === s.id ? { ...item, status: 'REJECTED' } : item))
                                    )
                                  }
                                  className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg font-bold text-[10px]"
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSuspiciousList((prev) =>
                                      prev.map((item) => (item.id === s.id ? { ...item, status: 'IGNORED' } : item))
                                    )
                                  }
                                  className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold text-[10px]"
                                >
                                  Ignore
                                </button>
                              </div>
                            </div>

                            {isEditing && (
                              <div className="mt-2.5 p-2.5 bg-white border border-blue-200 rounded-xl grid grid-cols-1 sm:grid-cols-5 gap-2">
                                <input
                                  type="text"
                                  value={suspiciousDraft.productName}
                                  onChange={(e) => setSuspiciousDraft((d) => ({ ...d, productName: e.target.value }))}
                                  placeholder="Product Name"
                                  className="p-1.5 border border-slate-300 rounded-lg sm:col-span-2 font-semibold"
                                />
                                <input
                                  type="text"
                                  value={suspiciousDraft.brand}
                                  onChange={(e) => setSuspiciousDraft((d) => ({ ...d, brand: e.target.value }))}
                                  placeholder="Brand"
                                  className="p-1.5 border border-slate-300 rounded-lg"
                                />
                                <input
                                  type="text"
                                  value={suspiciousDraft.partNumber}
                                  onChange={(e) => setSuspiciousDraft((d) => ({ ...d, partNumber: e.target.value }))}
                                  placeholder="Part Code"
                                  className="p-1.5 border border-slate-300 rounded-lg font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const promoted: OnboardingProductCandidate = {
                                      tempId: `PROM-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                                      vendorId: 'NEW',
                                      accepted: true,
                                      productName: suspiciousDraft.productName.trim() || s.rawText.slice(0, 80),
                                      sourceProductName: suspiciousDraft.productName.trim() || s.rawText.slice(0, 80),
                                      normalizedProductName: suspiciousDraft.productName.trim() || s.rawText.slice(0, 80),
                                      productDesignation: suspiciousDraft.partNumber.trim() || suspiciousDraft.productName.trim(),
                                      description: s.rawText,
                                      brand: suspiciousDraft.brand.trim() || 'Unconfirmed',
                                      partNumber: suspiciousDraft.partNumber.trim(),
                                      modelNumber: suspiciousDraft.partNumber.trim(),
                                      category: suspiciousDraft.category.trim() || 'Industrial Supplies',
                                      specification: suspiciousDraft.specification.trim(),
                                      uom: 'NOS',
                                      keywords: [suspiciousDraft.category.trim() || 'Industrial Supplies', suspiciousDraft.brand.trim(), suspiciousDraft.partNumber.trim()].filter(Boolean),
                                      sourcePage: s.sourcePage,
                                      sourceUrl: s.sourceUrl,
                                      catalogueRow: s.catalogueRow,
                                      originalSourceText: s.rawText,
                                      evidence: s.rawText,
                                      reviewStatus: 'Verified',
                                      approvalStatus: 'APPROVED',
                                      matchStatus: 'NEW_PRODUCT',
                                      aiConfidence: 95,
                                      confidenceLevel: 'High',
                                      validationScore: 95,
                                    };
                                    setProductsList((prev) => [promoted, ...prev]);
                                    setSuspiciousList((prev) =>
                                      prev.map((item) => (item.id === s.id ? { ...item, status: 'ACCEPTED' } : item))
                                    );
                                    setEditingSuspiciousId(null);
                                  }}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px]"
                                >
                                  Save &amp; Promote
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: COMMERCIAL TERMS, BANKING & MASTER SYNC OPTIONS */}
              {previewTab === 'commercial' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
                  <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Commercial, Banking &amp; Transaction Options</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">MSME Classification</label>
                      <select
                        value={company.msmeStatus || 'Small'}
                        onChange={(e) => setCompany((c) => ({ ...c, msmeStatus: e.target.value }))}
                        className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                      >
                        <option value="Micro">Micro Enterprise</option>
                        <option value="Small">Small Enterprise</option>
                        <option value="Medium">Medium Enterprise</option>
                        <option value="Large">Large / Non-MSME</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Payment Terms</label>
                      <input
                        type="text"
                        value={company.paymentTerms || '30 Days Net'}
                        onChange={(e) => setCompany((c) => ({ ...c, paymentTerms: e.target.value }))}
                        className="w-full p-2 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Credit Period</label>
                      <input
                        type="text"
                        value={company.creditPeriod || '30 Days'}
                        onChange={(e) => setCompany((c) => ({ ...c, creditPeriod: e.target.value }))}
                        className="w-full p-2 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Delivery Terms</label>
                      <input
                        type="text"
                        value={company.deliveryTerms || 'Door Delivery / Ex-Works'}
                        onChange={(e) => setCompany((c) => ({ ...c, deliveryTerms: e.target.value }))}
                        className="w-full p-2 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={company.bankName || ''}
                        onChange={(e) => setCompany((c) => ({ ...c, bankName: e.target.value }))}
                        placeholder="Optional"
                        className="w-full p-2 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">IFSC Code</label>
                      <input
                        type="text"
                        value={company.bankIfsc || ''}
                        onChange={(e) => setCompany((c) => ({ ...c, bankIfsc: e.target.value.toUpperCase() }))}
                        placeholder="Optional"
                        className="w-full p-2 border border-slate-300 rounded-xl font-mono uppercase"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="font-bold text-slate-700 block mb-1">Vendor Summary / Notes</label>
                      <input
                        type="text"
                        value={company.remarks || ''}
                        onChange={(e) => setCompany((c) => ({ ...c, remarks: e.target.value }))}
                        className="w-full p-2 border border-slate-300 rounded-xl"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2.5 p-3 bg-blue-50/70 border border-blue-200 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createMissingInMaster}
                      onChange={(e) => setCreateMissingInMaster(e.target.checked)}
                    />
                    <span className="font-semibold text-blue-950">
                      Automatically register unmatched products into global Product Master during atomic save
                    </span>
                  </label>
                </div>
              )}

              {/* STEP 3 ACTION FOOTER */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSaveError(null);
                      setStep('INPUT');
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back / Edit Sources</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleTransferToManual}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs"
                  >
                    Edit in Manual Form (Option B)
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSaving}
                    className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 rounded-xl font-semibold text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveVendorCommit}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-500/20 transition-all"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Saving Atomic Transaction...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{commitMode === 'UPDATE' ? 'UPDATE & SYNC VENDOR' : 'SAVE VENDOR'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
