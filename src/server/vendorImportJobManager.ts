import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  getVendorCatalogueConfig,
  validateCatalogueFile,
  deduplicateCatalogueProductsAcrossChunks,
  getFileExtension,
} from './catalogueConfig.js';
import { db } from './db.js';
import { parseCatalogLocally } from '../services/aiCatalogService.js';
import {
  validateExtractedProduct,
  isBannedGenericProductName,
  inspectSpreadsheetColumns,
  SuspiciousExtractedItem,
} from '../services/contentClassificationEngine.js';
import {
  classifyVendorTypeFromText,
  computeOnboardingCompletion,
  detectDuplicateVendors,
  detectSourceConflictsAndPickBest,
  extractCompanyIdentityFromText,
  extractContactsFromText,
  extractGstinAndPanFromText,
  extractStructuredAddressFromText,
  inferOnboardingSourceType,
  normalizePhoneLast10,
  parseTabularProductsFromCsv,
  reconcileBrandsWithMaster,
  reconcileCategoriesHierarchy,
  reconcileProductsWithMaster,
  SourceFieldSnapshot,
  validateGstinFormat,
  validatePanFormat,
} from '../services/vendorOnboardingService.js';

export type ImportJobStatus =
  | 'UPLOADING'
  | 'PROCESSING'
  | 'VALIDATING'
  | 'READY_FOR_REVIEW'
  | 'COMMITTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface UploadSessionRecord {
  uploadId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  receivedBytes: number;
  expectedChunks?: number;
  receivedChunks: number[];
  sourceRole?: string;
  detectedFormat?: string;
  tempDir: string;
  tempFilePath: string;
  status: 'UPLOADING' | 'READY' | 'CONSUMED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}

export interface ImportJobFileRef {
  uploadId?: string;
  name: string;
  mimeType: string;
  size: number;
  sourceRole?: string;
  textContent?: string;
  base64Data?: string;
  tempFilePath?: string;
}

export interface VendorImportJobRecord {
  jobId: string;
  status: ImportJobStatus;
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
  resultFilePath?: string;
}

export interface StartImportJobDeps {
  analyzeVendorWebsiteImpl: (url: string, vendorNameHint?: string, forceRefresh?: boolean) => Promise<any>;
  getGoogleGenAIClient: () => Promise<any>;
  withTimeout: <T>(promise: Promise<T>, ms: number, label: string) => Promise<T>;
}

const DATA_ROOT = path.resolve(process.cwd(), 'data');
const UPLOAD_TMP_ROOT = path.join(DATA_ROOT, 'uploads_tmp');
const JOBS_ROOT = path.join(DATA_ROOT, 'import_jobs');
const JOBS_INDEX_FILE = path.join(JOBS_ROOT, 'jobs.json');

function ensureStorageDirs() {
  if (!fs.existsSync(UPLOAD_TMP_ROOT)) fs.mkdirSync(UPLOAD_TMP_ROOT, { recursive: true });
  if (!fs.existsSync(JOBS_ROOT)) fs.mkdirSync(JOBS_ROOT, { recursive: true });
}

class VendorImportJobManager {
  private uploads = new Map<string, UploadSessionRecord>();
  private jobs = new Map<string, VendorImportJobRecord>();
  private cancelledJobs = new Set<string>();

  constructor() {
    ensureStorageDirs();
    this.loadJobsFromDisk();
    this.cleanupExpiredUploads();
  }

  private loadJobsFromDisk() {
    try {
      if (!fs.existsSync(JOBS_INDEX_FILE)) return;
      const raw = fs.readFileSync(JOBS_INDEX_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const j of parsed) {
          if (!j || !j.jobId) continue;
          // Any interrupted background job on server restart should not stay stuck spinning
          if (j.status === 'UPLOADING' || j.status === 'PROCESSING' || j.status === 'VALIDATING' || j.status === 'COMMITTING') {
            j.status = 'FAILED';
            j.currentStage = 'Interrupted by server restart';
            j.error = 'Import job was interrupted by a server restart. Please re-run the analysis.';
            j.updatedAt = new Date().toISOString();
          }
          this.jobs.set(j.jobId, j);
        }
      }
    } catch (err) {
      console.warn('[ImportJobManager] Could not load persisted jobs:', err);
    }
  }

  private persistJobsSync() {
    try {
      ensureStorageDirs();
      const list = Array.from(this.jobs.values())
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 40);
      const tmp = `${JOBS_INDEX_FILE}.tmp.${process.pid}.${Date.now()}`;
      fs.writeFileSync(tmp, JSON.stringify(list), 'utf-8');
      fs.renameSync(tmp, JOBS_INDEX_FILE);
    } catch (err) {
      console.warn('[ImportJobManager] Persist jobs warning:', err);
    }
  }

  private cleanupExpiredUploads(maxAgeMs = 2 * 60 * 60 * 1000) {
    try {
      if (!fs.existsSync(UPLOAD_TMP_ROOT)) return;
      const now = Date.now();
      for (const entry of fs.readdirSync(UPLOAD_TMP_ROOT)) {
        const full = path.join(UPLOAD_TMP_ROOT, entry);
        try {
          const stat = fs.statSync(full);
          if (now - stat.mtimeMs > maxAgeMs) {
            fs.rmSync(full, { recursive: true, force: true });
          }
        } catch {}
      }
    } catch {}
  }

  public initUploadSession(params: {
    fileName: string;
    mimeType?: string;
    fileSizeBytes: number;
    totalChunks?: number;
    sourceRole?: string;
  }): UploadSessionRecord {
    ensureStorageDirs();
    this.cleanupExpiredUploads();

    const validation = validateCatalogueFile({
      fileName: params.fileName,
      mimeType: params.mimeType,
      fileSizeBytes: params.fileSizeBytes,
    });
    if (!validation.valid) {
      const err: any = new Error(validation.error || 'Unsupported file type');
      err.code = validation.code || 'UNSUPPORTED_FILE_TYPE';
      err.statusCode = validation.code === 'FILE_TOO_LARGE' ? 413 : 400;
      throw err;
    }

    const cfg = getVendorCatalogueConfig();
    if (params.fileSizeBytes > cfg.maxFileSizeBytes) {
      const err: any = new Error(`File exceeds configured maximum size of ${cfg.maxFileSizeMb} MB`);
      err.code = 'FILE_TOO_LARGE';
      err.statusCode = 413;
      throw err;
    }

    const uploadId = `UPL-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const ext = getFileExtension(params.fileName) || '.bin';
    const tempDir = path.join(UPLOAD_TMP_ROOT, uploadId);
    fs.mkdirSync(tempDir, { recursive: true });
    const tempFilePath = path.join(tempDir, `source${ext}`);

    const session: UploadSessionRecord = {
      uploadId,
      fileName: path.basename(params.fileName),
      mimeType: String(params.mimeType || ''),
      fileSizeBytes: params.fileSizeBytes,
      receivedBytes: 0,
      expectedChunks: params.totalChunks,
      receivedChunks: [],
      sourceRole: params.sourceRole,
      detectedFormat: validation.detectedFormat,
      tempDir,
      tempFilePath,
      status: 'UPLOADING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.uploads.set(uploadId, session);
    return session;
  }

  public async appendUploadChunk(params: {
    uploadId: string;
    chunkIndex: number;
    totalChunks?: number;
    chunkBuffer: Buffer;
  }): Promise<{
    uploadId: string;
    chunkIndex: number;
    receivedBytes: number;
    fileSizeBytes: number;
    percent: number;
  }> {
    const session = this.uploads.get(params.uploadId);
    if (!session) {
      const err: any = new Error('Upload session not found or expired.');
      err.statusCode = 404;
      throw err;
    }
    if (session.status === 'FAILED') {
      const err: any = new Error('Upload session was aborted due to validation failure.');
      err.statusCode = 400;
      throw err;
    }

    const cfg = getVendorCatalogueConfig();
    if (!Buffer.isBuffer(params.chunkBuffer) || params.chunkBuffer.length === 0) {
      const err: any = new Error('Empty upload chunk received.');
      err.statusCode = 400;
      throw err;
    }

    // Idempotent check if chunk already appended
    if (session.receivedChunks.includes(params.chunkIndex)) {
      return {
        uploadId: session.uploadId,
        chunkIndex: params.chunkIndex,
        receivedBytes: session.receivedBytes,
        fileSizeBytes: session.fileSizeBytes,
        percent: Math.min(100, Math.round((session.receivedBytes / Math.max(1, session.fileSizeBytes)) * 100)),
      };
    }

    const expectedNext = session.receivedChunks.length;
    if (params.chunkIndex !== expectedNext) {
      const err: any = new Error(`Out-of-order upload chunk ${params.chunkIndex} (expected ${expectedNext}).`);
      err.statusCode = 400;
      throw err;
    }

    const nextTotalBytes = session.receivedBytes + params.chunkBuffer.length;
    if (nextTotalBytes > cfg.maxFileSizeBytes || nextTotalBytes > session.fileSizeBytes + 1024 * 1024) {
      session.status = 'FAILED';
      this.cleanupUploadSession(session.uploadId);
      const err: any = new Error(`File exceeds configured maximum size of ${cfg.maxFileSizeMb} MB`);
      err.code = 'FILE_TOO_LARGE';
      err.statusCode = 413;
      throw err;
    }

    // Validate actual binary magic signature on chunk 0 immediately
    if (params.chunkIndex === 0) {
      const sigCheck = validateCatalogueFile({
        fileName: session.fileName,
        mimeType: session.mimeType,
        fileSizeBytes: session.fileSizeBytes,
        headerBuffer: params.chunkBuffer,
      });
      if (!sigCheck.valid) {
        session.status = 'FAILED';
        this.cleanupUploadSession(session.uploadId);
        const err: any = new Error(sigCheck.error || 'Unsupported file type');
        err.code = sigCheck.code || 'UNSUPPORTED_FILE_TYPE';
        err.statusCode = sigCheck.code === 'FILE_TOO_LARGE' ? 413 : 400;
        throw err;
      }
      session.detectedFormat = sigCheck.detectedFormat;
    }

    await fs.promises.appendFile(session.tempFilePath, params.chunkBuffer);
    session.receivedBytes = nextTotalBytes;
    session.receivedChunks.push(params.chunkIndex);
    if (typeof params.totalChunks === 'number' && params.totalChunks > 0) {
      session.expectedChunks = params.totalChunks;
    }
    session.updatedAt = new Date().toISOString();

    return {
      uploadId: session.uploadId,
      chunkIndex: params.chunkIndex,
      receivedBytes: session.receivedBytes,
      fileSizeBytes: session.fileSizeBytes,
      percent: Math.min(100, Math.round((session.receivedBytes / Math.max(1, session.fileSizeBytes)) * 100)),
    };
  }

  public async completeUploadSession(uploadId: string): Promise<UploadSessionRecord> {
    const session = this.uploads.get(uploadId);
    if (!session) {
      const err: any = new Error('Upload session not found or expired.');
      err.statusCode = 404;
      throw err;
    }
    if (!fs.existsSync(session.tempFilePath)) {
      const err: any = new Error('Uploaded temporary file not found on disk.');
      err.statusCode = 404;
      throw err;
    }

    const stat = await fs.promises.stat(session.tempFilePath);
    const fd = await fs.promises.open(session.tempFilePath, 'r');
    const headBuf = Buffer.alloc(Math.min(512, stat.size));
    try {
      await fd.read(headBuf, 0, headBuf.length, 0);
    } finally {
      await fd.close();
    }

    const validation = validateCatalogueFile({
      fileName: session.fileName,
      mimeType: session.mimeType,
      fileSizeBytes: stat.size,
      headerBuffer: headBuf,
    });

    if (!validation.valid) {
      session.status = 'FAILED';
      this.cleanupUploadSession(uploadId);
      const err: any = new Error(validation.error || 'Unsupported file type');
      err.code = validation.code || 'UNSUPPORTED_FILE_TYPE';
      err.statusCode = validation.code === 'FILE_TOO_LARGE' ? 413 : 400;
      throw err;
    }

    session.receivedBytes = stat.size;
    session.detectedFormat = validation.detectedFormat;
    session.status = 'READY';
    session.updatedAt = new Date().toISOString();
    return session;
  }

  public getUploadSession(uploadId: string): UploadSessionRecord | undefined {
    return this.uploads.get(uploadId);
  }

  public cleanupUploadSession(uploadId: string) {
    const session = this.uploads.get(uploadId);
    if (session?.tempDir) {
      try {
        fs.rmSync(session.tempDir, { recursive: true, force: true });
      } catch {}
    }
    this.uploads.delete(uploadId);
  }

  public getJob(jobId: string): VendorImportJobRecord | undefined {
    return this.jobs.get(jobId);
  }

  public listJobs(): VendorImportJobRecord[] {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public getJobResult(jobId: string): any | null {
    const job = this.jobs.get(jobId);
    if (!job || !job.resultFilePath || !fs.existsSync(job.resultFilePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(job.resultFilePath, 'utf-8'));
    } catch {
      return null;
    }
  }

  public cancelJob(jobId: string): VendorImportJobRecord | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
      return job;
    }
    this.cancelledJobs.add(jobId);
    job.status = 'CANCELLED';
    job.currentStage = 'Import job cancelled by user';
    job.updatedAt = new Date().toISOString();
    this.persistJobsSync();
    return job;
  }

  public markJobCommitting(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'COMMITTING';
    job.currentStage = 'Committing verified records to database...';
    job.updatedAt = new Date().toISOString();
    this.persistJobsSync();
  }

  public markJobCompleted(jobId: string, vendorId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'COMPLETED';
    job.committedVendorId = vendorId;
    job.progressPercent = 100;
    job.currentStage = `Completed — vendor ${vendorId} persisted and verified`;
    job.updatedAt = new Date().toISOString();
    this.persistJobsSync();
  }

  public startImportJob(
    input: {
      vendorNameHint?: string;
      websiteUrl?: string;
      pastedText?: string;
      files?: Array<ImportJobFileRef>;
      columnMappingOverride?: Record<string, string>;
      forceRefresh?: boolean;
      createdBy?: string;
    },
    deps: StartImportJobDeps
  ): VendorImportJobRecord {
    ensureStorageDirs();
    const resolvedFiles: ImportJobFileRef[] = [];
    const inputFiles = Array.isArray(input.files) ? input.files : [];

    for (const f of inputFiles) {
      if (f?.uploadId) {
        const session = this.uploads.get(f.uploadId);
        if (!session || session.status !== 'READY' || !fs.existsSync(session.tempFilePath)) {
          throw new Error(`Uploaded source "${f.name || f.uploadId}" is missing or incomplete. Please re-upload.`);
        }
        session.status = 'CONSUMED';
        resolvedFiles.push({
          uploadId: session.uploadId,
          name: session.fileName,
          mimeType: session.mimeType || f.mimeType || '',
          size: session.receivedBytes,
          sourceRole: f.sourceRole || session.sourceRole,
          tempFilePath: session.tempFilePath,
        });
      } else if (f) {
        // Inline small CSV/text or legacy inline payload — still enforce validation & size
        const inlineBuf = f.base64Data
          ? Buffer.from(String(f.base64Data).replace(/^data:[^;]+;base64,/, ''), 'base64')
          : f.textContent
            ? Buffer.from(String(f.textContent), 'utf-8')
            : undefined;
        const val = validateCatalogueFile({
          fileName: f.name,
          mimeType: f.mimeType,
          fileSizeBytes: inlineBuf ? inlineBuf.length : f.size,
          headerBuffer: inlineBuf,
        });
        if (!val.valid) {
          throw new Error(val.error || 'Unsupported file type');
        }
        resolvedFiles.push(f);
      }
    }

    const totalSizeBytes = resolvedFiles.reduce((acc, f) => acc + (Number(f.size) || 0), 0);
    const primaryFileName =
      resolvedFiles[0]?.name ||
      (input.websiteUrl ? input.websiteUrl.trim() : '') ||
      'Pasted Vendor Details';

    const jobId = `IMPJOB-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const job: VendorImportJobRecord = {
      jobId,
      status: 'PROCESSING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: input.createdBy || 'Super Admin',
      fileName: primaryFileName,
      fileSizeBytes: totalSizeBytes,
      filesSummary: resolvedFiles.map((f) => ({
        name: f.name,
        size: f.size || 0,
        mimeType: f.mimeType || '',
        sourceRole: f.sourceRole,
      })),
      totalPages: 0,
      pagesProcessed: 0,
      ocrPagesProcessed: 0,
      productsDetected: 0,
      validCount: 0,
      reviewRequiredCount: 0,
      rejectedCount: 0,
      currentStage: 'Initializing catalogue import pipeline...',
      progressPercent: 2,
      warnings: [],
    };

    this.jobs.set(jobId, job);
    this.persistJobsSync();

    // Launch asynchronous background execution cleanly
    void this.executeImportJob(
      job,
      {
        vendorNameHint: input.vendorNameHint || '',
        websiteUrl: input.websiteUrl || '',
        pastedText: input.pastedText || '',
        files: resolvedFiles,
        columnMappingOverride: input.columnMappingOverride,
        forceRefresh: Boolean(input.forceRefresh),
      },
      deps
    );

    return job;
  }

  private async executeImportJob(
    job: VendorImportJobRecord,
    params: {
      vendorNameHint: string;
      websiteUrl: string;
      pastedText: string;
      files: ImportJobFileRef[];
      columnMappingOverride?: Record<string, string>;
      forceRefresh: boolean;
    },
    deps: StartImportJobDeps
  ) {
    const updateJob = (patch: Partial<VendorImportJobRecord>, persist = false) => {
      Object.assign(job, patch, { updatedAt: new Date().toISOString() });
      if (persist) this.persistJobsSync();
    };

    const isCancelled = () => this.cancelledJobs.has(job.jobId) || job.status === 'CANCELLED';

    try {
      const cfg = getVendorCatalogueConfig();
      const cleanUrl = params.websiteUrl.trim();
      const cleanText = params.pastedText.trim();
      const inputFiles = params.files;

      const dbVendors = db.getCollection('vendors') || [];
      const dbBrands = db.getCollection('brands') || [];
      const dbCategories = db.getCategories() || [];
      const dbProducts = db.getCollection('products') || [];

      const snapshots: SourceFieldSnapshot[] = [];
      const sourcesAnalyzed: any[] = [];
      const collectedContacts: any[] = [];
      let rawProducts: any[] = [];
      const collectedSuspicious: SuspiciousExtractedItem[] = [];
      const explicitBrands: string[] = [];
      const warnings: string[] = [];
      const extractionMethods = new Set<string>();
      const allCombinedTexts: string[] = [];
      let websiteIntelligenceResult: any = undefined;
      let structuredAddressBest: any = undefined;
      let spreadsheetPreview: any = undefined;

      const helperPushTextExtraction = (
        srcText: string,
        sourceName: string,
        sourceType: any,
        baseConf: number
      ) => {
        if (!srcText || !srcText.trim()) return;
        if (allCombinedTexts.join('\n').length < 32000) {
          allCombinedTexts.push(`--- SOURCE (${sourceType}): ${sourceName} ---\n${srcText.slice(0, 12000)}`);
        }
        const tax = extractGstinAndPanFromText(srcText);
        const identity = extractCompanyIdentityFromText(srcText, sourceName, cleanUrl);
        const addr = extractStructuredAddressFromText(srcText, sourceName, tax.gstin);
        const contacts = extractContactsFromText(srcText, sourceName);
        const vType = classifyVendorTypeFromText(srcText);

        const primaryC = contacts[0];
        snapshots.push({
          sourceType,
          sourceName,
          confidence: baseConf,
          companyName: identity.companyName || (params.vendorNameHint ? params.vendorNameHint.trim() : ''),
          legalName: identity.legalName,
          vendorType: vType.confidence >= 70 ? vType.vendorType : undefined,
          gstin: tax.gstin,
          pan: tax.pan,
          email: primaryC?.email || '',
          mobile: primaryC?.mobile || '',
          address: addr.rawAddress,
          city: addr.city || '',
          state: addr.state || tax.gstState || '',
          pincode: addr.pincode || '',
          website: identity.website || '',
        });

        contacts.forEach((c) => collectedContacts.push(c));
        if (!structuredAddressBest || addr.splitConfidence > (structuredAddressBest.splitConfidence || 0)) {
          structuredAddressBest = addr;
        }
      };

      // 1. Optional Website Crawl
      if (cleanUrl && !isCancelled()) {
        updateJob({ currentStage: `Scanning vendor website (${cleanUrl})...`, progressPercent: 6 }, true);
        try {
          const webOutcome = await deps.analyzeVendorWebsiteImpl(
            cleanUrl,
            params.vendorNameHint || undefined,
            params.forceRefresh
          );
          if (webOutcome.ok && webOutcome.result) {
            const wr = webOutcome.result;
            const { textSnippet: webTextSnippet, aiUsed: _omitAiUsed, ...wrPublic } = wr as any;
            websiteIntelligenceResult = wrPublic;
            if (Array.isArray(wr.suspiciousItems)) {
              wr.suspiciousItems.forEach((s: SuspiciousExtractedItem) => collectedSuspicious.push(s));
            }
            const webCombinedText = [wr.h1Name, wr.title, wr.companyOverview, webTextSnippet, ...(wr.crawledPages || [])]
              .filter(Boolean)
              .join('\n');
            allCombinedTexts.push(`--- SOURCE (WEBSITE): ${wr.url} ---\n${webCombinedText}`);

            const webTax = extractGstinAndPanFromText(webCombinedText);
            const webIdentity = extractCompanyIdentityFromText(webCombinedText, wr.url, wr.url);
            const webAddr = extractStructuredAddressFromText(webCombinedText, wr.url, webTax.gstin);
            const webVType = classifyVendorTypeFromText(webCombinedText);

            snapshots.push({
              sourceType: 'WEBSITE',
              sourceName: wr.url,
              confidence: 92,
              companyName: wr.h1Name || webIdentity.companyName || wr.title || params.vendorNameHint.trim(),
              legalName: wr.h1Name || webIdentity.legalName || wr.title || '',
              vendorType: webVType.confidence >= 70 ? webVType.vendorType : undefined,
              gstin: webTax.gstin,
              pan: webTax.pan,
              email: wr.emails?.[0] || '',
              mobile: wr.phones?.[0] || '',
              address: webAddr.rawAddress,
              city: webAddr.city || '',
              state: webAddr.state || webTax.gstState || '',
              pincode: webAddr.pincode || '',
              website: wr.url,
            });
            if (webAddr.rawAddress || webAddr.city) structuredAddressBest = webAddr;
            (wr.emails || []).forEach((em: string, idx: number) => {
              collectedContacts.push({
                id: `WEB-CNT-${idx + 1}`,
                name: idx === 0 ? 'Sales / Enquiry Desk' : '',
                department: 'Sales',
                email: em,
                mobile: wr.phones?.[idx],
                isPrimary: idx === 0,
                source: wr.url,
                confidence: 86,
              });
            });
            (wr.phones || []).forEach((ph: string, idx: number) => {
              if (!wr.emails?.[idx]) {
                collectedContacts.push({
                  id: `WEB-PH-${idx + 1}`,
                  name: 'Support / Enquiry Phone',
                  department: 'Support',
                  mobile: ph,
                  isPrimary: false,
                  source: wr.url,
                  confidence: 82,
                });
              }
            });
            if (Array.isArray(wr.products)) {
              wr.products.forEach((p: any) => rawProducts.push({ ...p, sourceType: 'WEBSITE', sourceFile: wr.url }));
            }
            if (Array.isArray(wr.brands)) {
              wr.brands.forEach((b: any) => {
                const bn = typeof b === 'string' ? b : b?.name;
                if (bn) explicitBrands.push(bn);
              });
            }
            sourcesAnalyzed.push({
              sourceType: 'WEBSITE',
              sourceName: wr.url,
              status: 'SUCCESS',
              itemsExtracted: wr.products?.length || 0,
              note: `Crawled ${(wr.crawledPages || []).length} public page(s)`,
            });
            extractionMethods.add('Website Crawler');
          } else {
            sourcesAnalyzed.push({
              sourceType: 'WEBSITE',
              sourceName: cleanUrl,
              status: 'FAILED',
              itemsExtracted: 0,
              note: webOutcome.error || 'Website unreachable',
            });
            warnings.push(`Website scan notice (${cleanUrl}): ${webOutcome.error || 'Could not reach public website'}`);
          }
        } catch (webErr: any) {
          sourcesAnalyzed.push({
            sourceType: 'WEBSITE',
            sourceName: cleanUrl,
            status: 'FAILED',
            itemsExtracted: 0,
            note: webErr?.message || 'Website scan error',
          });
          warnings.push(`Website scan notice: ${webErr?.message || 'Could not parse website'}`);
        }
      }

      // 2. Process Uploaded Files in Safe Streaming/Chunked Passes
      for (const f of inputFiles) {
        if (isCancelled()) break;

        const fileName = String(f.name || 'uploaded_file');
        const mimeType = String(f.mimeType || '');
        const lowerName = fileName.toLowerCase();
        const srcType = inferOnboardingSourceType(fileName, f.sourceRole);
        let itemsFoundForFile = 0;
        let identitySampleText = '';

        try {
          if (lowerName.endsWith('.pdf') || mimeType === 'application/pdf') {
            updateJob({ currentStage: `Opening PDF "${fileName}" and detecting page count...`, progressPercent: 10 }, true);
            const { PDFParse } = await import('pdf-parse');
            let pdfBuffer: Buffer;
            if (f.tempFilePath && fs.existsSync(f.tempFilePath)) {
              pdfBuffer = await fs.promises.readFile(f.tempFilePath);
            } else if (f.base64Data) {
              pdfBuffer = Buffer.from(f.base64Data.replace(/^data:[^;]+;base64,/, ''), 'base64');
            } else {
              pdfBuffer = Buffer.from(f.textContent || '', 'utf-8');
            }

            const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
            try {
              const info = await parser.getInfo({ parsePageInfo: false });
              const totalPages = Math.max(1, Number(info?.total || 1));
              updateJob(
                {
                  totalPages: job.totalPages + totalPages,
                  currentStage: `Extracting product tables from ${totalPages} pages...`,
                },
                true
              );

              const chunkSize = cfg.maxPagesPerPdfChunk;
              let ocrUsed = 0;
              const MAX_OCR_PAGES_PER_JOB = 12;

              for (let startPage = 1; startPage <= totalPages; startPage += chunkSize) {
                if (isCancelled()) break;
                const endPage = Math.min(totalPages, startPage + chunkSize - 1);
                updateJob({
                  currentStage: `Extracting Product Tables (Pages ${startPage}–${endPage} of ${totalPages})...`,
                });

                const chunkTextRes = await parser.getText({
                  first: startPage,
                  last: endPage,
                  lineEnforce: true,
                  cellSeparator: '\t',
                  pageJoiner: '',
                });

                const pagesArr = Array.isArray(chunkTextRes?.pages) && chunkTextRes.pages.length > 0
                  ? chunkTextRes.pages
                  : [{ num: startPage, text: chunkTextRes?.text || '' }];

                for (const pg of pagesArr) {
                  if (isCancelled()) break;
                  const pageNum = Number(pg.num || startPage);
                  let pageText = String(pg.text || '');

                  // Detect image-heavy / scanned page (low native text density)
                  const meaningfulTextLen = pageText.replace(/\s+/g, '').length;
                  if (meaningfulTextLen < 45 && process.env.GEMINI_API_KEY && ocrUsed < MAX_OCR_PAGES_PER_JOB) {
                    try {
                      updateJob({
                        currentStage: `Running selective OCR on scanned page ${pageNum} of ${totalPages}...`,
                      });
                      const shot = await parser.getScreenshot({
                        partial: [pageNum],
                        scale: 1.5,
                        imageDataUrl: false,
                        imageBuffer: true,
                      });
                      const pgImg = shot?.pages?.[0]?.data;
                      if (pgImg && pgImg.length > 0) {
                        ocrUsed++;
                        const aiClient = await deps.getGoogleGenAIClient();
                        const base64Img = Buffer.from(pgImg).toString('base64');
                        const ocrPrompt = `Extract vendor identity and ALL product table rows from scanned catalogue page ${pageNum} of "${fileName}".
STRICT RULES: Never invent product names, part codes, GSTIN, emails, or rates. Preserve exact part codes/suffixes.
Return JSON only: { "companyName": "", "gstin": "", "products": [{ "sourceProductName": "", "productName": "", "brand": "", "partNumber": "", "manufacturerCode": "", "modelNumber": "", "category": "", "subCategory": "", "specification": "", "uom": "NOS", "mrp": null, "basicRate": null, "discountPercent": null, "purchaseRate": null }], "rawText": "" }`;
                        const aiRes = await deps.withTimeout<any>(
                          aiClient.models.generateContent({
                            model: 'gemini-4-hydrogen',
                            contents: [
                              {
                                role: 'user',
                                parts: [
                                  { inlineData: { mimeType: 'image/png', data: base64Img } },
                                  { text: ocrPrompt },
                                ],
                              },
                            ],
                            config: { responseMimeType: 'application/json' },
                          }),
                          20000,
                          `Scanned PDF Page ${pageNum} OCR`
                        );
                        const ocrJson = JSON.parse(
                          (aiRes?.text || '{}').replace(/```json/gi, '').replace(/```/g, '').trim()
                        );
                        if (ocrJson.rawText) {
                          pageText = `${pageText}\n${ocrJson.rawText}`.trim();
                        }
                        if (Array.isArray(ocrJson.products)) {
                          ocrJson.products.forEach((op: any, oIdx: number) => {
                            if (op?.productName && !isBannedGenericProductName(op.productName)) {
                              rawProducts.push({
                                ...op,
                                catalogFileName: fileName,
                                sourceFile: fileName,
                                sourcePage: pageNum,
                                sourcePages: [pageNum],
                                catalogueRow: oIdx + 1,
                                sourceType: 'PDF_OCR',
                                aiConfidence: 88,
                              });
                              itemsFoundForFile++;
                            }
                          });
                        }
                        updateJob({ ocrPagesProcessed: job.ocrPagesProcessed + 1 });
                        extractionMethods.add('Selective Scanned-Page OCR');
                      }
                    } catch (ocrErr: any) {
                      warnings.push(`OCR notice (${fileName} p.${pageNum}): ${ocrErr?.message || 'OCR skipped'}`);
                    }
                  }

                  if (
                    pageNum <= 5 ||
                    pageNum >= totalPages - 2 ||
                    /gstin|pan\b|@|website|www\.|authorized|authorised/i.test(pageText)
                  ) {
                    if (identitySampleText.length < 24000) {
                      identitySampleText += `\n[Page ${pageNum}]\n${pageText.slice(0, 4000)}`;
                    }
                  }

                  if (pageText.trim()) {
                    const pageParsed = parseCatalogLocally(fileName, pageText, 'NEW', {
                      columnMappingOverride: params.columnMappingOverride,
                    });
                    pageParsed.products.forEach((p: any) => {
                      rawProducts.push({
                        ...p,
                        sourceFile: fileName,
                        sourcePage: pageNum,
                        sourcePages: [pageNum],
                      });
                    });
                    (pageParsed.suspiciousItems || []).forEach((s: any) =>
                      collectedSuspicious.push({ ...s, sourcePage: pageNum, sourceFile: fileName })
                    );
                    itemsFoundForFile += pageParsed.products.length;
                  }

                  const nextProcessed = job.pagesProcessed + 1;
                  const dedupedLive = deduplicateCatalogueProductsAcrossChunks(rawProducts);
                  rawProducts = dedupedLive;
                  const pct = Math.min(
                    82,
                    10 + Math.round((nextProcessed / Math.max(1, job.totalPages)) * 72)
                  );
                  updateJob({
                    pagesProcessed: nextProcessed,
                    productsDetected: dedupedLive.length + collectedSuspicious.length,
                    progressPercent: pct,
                  });
                }

                // Yield event loop cleanly between PDF chunks
                await new Promise((r) => setImmediate(r));
              }

              extractionMethods.add('Chunked PDF Table Extractor');
              if (identitySampleText.trim()) {
                helperPushTextExtraction(identitySampleText, fileName, srcType, srcType === 'GST_DOC' ? 94 : 86);
              }
            } finally {
              await parser.destroy().catch(() => {});
            }
          } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
            updateJob({ currentStage: `Reading spreadsheet "${fileName}"...`, progressPercent: 25 }, true);
            const XLSX = await import('xlsx');
            const wb = f.tempFilePath && fs.existsSync(f.tempFilePath)
              ? XLSX.readFile(f.tempFilePath)
              : f.base64Data
                ? XLSX.read(Buffer.from(f.base64Data.replace(/^data:[^;]+;base64,/, ''), 'base64'), { type: 'buffer' })
                : null;

            if (wb) {
              const sheetCount = Math.max(1, wb.SheetNames.length);
              updateJob({ totalPages: job.totalPages + sheetCount });
              let combinedSheets = '';
              for (let sIdx = 0; sIdx < wb.SheetNames.length; sIdx++) {
                if (isCancelled()) break;
                const sName = wb.SheetNames[sIdx];
                const sheet = wb.Sheets[sName];
                if (sheet) {
                  const csv = XLSX.utils.sheet_to_csv(sheet);
                  if (csv.trim()) {
                    combinedSheets += `\n--- SHEET: ${sName} ---\n${csv}\n`;
                    spreadsheetPreview = spreadsheetPreview || inspectSpreadsheetColumns(csv);
                    const tabProds = parseTabularProductsFromCsv(csv, fileName, 'NEW', params.columnMappingOverride);
                    tabProds.forEach((p: any) => {
                      rawProducts.push({
                        ...p,
                        sourceFile: fileName,
                        sourcePage: sIdx + 1,
                        sourcePages: [sIdx + 1],
                      });
                    });
                    itemsFoundForFile += tabProds.length;
                  }
                }
                rawProducts = deduplicateCatalogueProductsAcrossChunks(rawProducts);
                updateJob({
                  pagesProcessed: job.pagesProcessed + 1,
                  productsDetected: rawProducts.length,
                  progressPercent: Math.min(82, 25 + Math.round(((sIdx + 1) / sheetCount) * 55)),
                });
              }
              if (combinedSheets.trim()) {
                helperPushTextExtraction(combinedSheets.slice(0, 16000), fileName, srcType, 86);
              }
              extractionMethods.add('Excel / Spreadsheet Parser');
            }
          } else if (lowerName.endsWith('.csv')) {
            updateJob({ currentStage: `Streaming CSV catalogue "${fileName}"...`, progressPercent: 25 }, true);
            const csvText = f.tempFilePath && fs.existsSync(f.tempFilePath)
              ? await fs.promises.readFile(f.tempFilePath, 'utf-8')
              : String(f.textContent || (f.base64Data ? Buffer.from(f.base64Data.replace(/^data:[^;]+;base64,/, ''), 'base64').toString('utf-8') : ''));

            spreadsheetPreview = inspectSpreadsheetColumns(csvText);
            const lines = csvText.split(/\r?\n/);
            const headerLine = lines[0] || '';
            const dataLines = lines.slice(1).filter((l) => l.trim().length > 0);
            const ROW_CHUNK = 500;
            const totalChunks = Math.max(1, Math.ceil(dataLines.length / ROW_CHUNK));
            updateJob({ totalPages: job.totalPages + totalChunks });

            for (let ci = 0; ci < totalChunks; ci++) {
              if (isCancelled()) break;
              const sliceText = [headerLine, ...dataLines.slice(ci * ROW_CHUNK, (ci + 1) * ROW_CHUNK)].join('\n');
              const tabProds = parseTabularProductsFromCsv(sliceText, fileName, 'NEW', params.columnMappingOverride);
              tabProds.forEach((p: any) => {
                rawProducts.push({
                  ...p,
                  sourceFile: fileName,
                  sourcePage: ci + 1,
                  sourcePages: [ci + 1],
                });
              });
              itemsFoundForFile += tabProds.length;
              rawProducts = deduplicateCatalogueProductsAcrossChunks(rawProducts);
              updateJob({
                pagesProcessed: job.pagesProcessed + 1,
                productsDetected: rawProducts.length,
                progressPercent: Math.min(82, 25 + Math.round(((ci + 1) / totalChunks) * 55)),
              });
              await new Promise((r) => setImmediate(r));
            }
            helperPushTextExtraction(lines.slice(0, 80).join('\n'), fileName, srcType, 84);
            extractionMethods.add('Chunked CSV Table Parser');
          } else if (
            mimeType.startsWith('image/') ||
            /\.(jpg|jpeg|png|webp)$/i.test(lowerName)
          ) {
            updateJob({
              totalPages: job.totalPages + 1,
              currentStage: `Running OCR on image "${fileName}"...`,
              progressPercent: 40,
            });
            const imgBase64 = f.tempFilePath && fs.existsSync(f.tempFilePath)
              ? (await fs.promises.readFile(f.tempFilePath)).toString('base64')
              : String(f.base64Data || '').replace(/^data:[^;]+;base64,/, '');

            if (process.env.GEMINI_API_KEY && imgBase64) {
              try {
                const aiClient = await deps.getGoogleGenAIClient();
                const ocrPrompt = `Extract ALL visible vendor details and real MRO products from this uploaded image (${fileName}).
STRICT RULES:
1. NEVER invent GSTIN, PAN, emails, phone numbers, prices, part codes, or authorization claims. Return "" or null if absent.
2. NEVER invent generic product names. Extract actual product name, designation, and part/model code printed on the image.
Return JSON only:
{ "companyName": "", "legalName": "", "vendorType": "", "gstin": "", "pan": "", "website": "", "address": "", "city": "", "state": "", "pincode": "", "contacts": [{ "name": "", "department": "", "email": "", "mobile": "", "whatsapp": "", "landline": "" }], "brands": [""], "products": [{ "sourceProductName": "", "productName": "", "productDesignation": "", "brand": "", "partNumber": "", "manufacturerCode": "", "modelNumber": "", "productFamily": "", "category": "", "subCategory": "", "description": "", "specification": "", "uom": "NOS", "mrp": null, "basicRate": null, "discountPercent": null, "purchaseRate": null }], "rawText": "" }`;

                const aiRes = await deps.withTimeout<any>(
                  aiClient.models.generateContent({
                    model: 'gemini-4-hydrogen',
                    contents: [
                      {
                        role: 'user',
                        parts: [
                          { inlineData: { mimeType: mimeType || 'image/jpeg', data: imgBase64 } },
                          { text: ocrPrompt },
                        ],
                      },
                    ],
                    config: { responseMimeType: 'application/json' },
                  }),
                  20000,
                  `Image OCR (${fileName})`
                );
                const parsedImg = JSON.parse((aiRes.text || '{}').replace(/```json/gi, '').replace(/```/g, '').trim());
                if (parsedImg.rawText) helperPushTextExtraction(parsedImg.rawText, fileName, srcType, 88);
                if (parsedImg.companyName || parsedImg.gstin || parsedImg.address) {
                  snapshots.push({
                    sourceType: srcType,
                    sourceName: fileName,
                    confidence: 88,
                    companyName: parsedImg.companyName || '',
                    legalName: parsedImg.legalName || '',
                    vendorType: parsedImg.vendorType || '',
                    gstin: parsedImg.gstin && validateGstinFormat(parsedImg.gstin) ? parsedImg.gstin.toUpperCase() : '',
                    pan: parsedImg.pan && validatePanFormat(parsedImg.pan) ? parsedImg.pan.toUpperCase() : '',
                    email: parsedImg.contacts?.[0]?.email || '',
                    mobile: parsedImg.contacts?.[0]?.mobile || '',
                    address: parsedImg.address || '',
                    city: parsedImg.city || '',
                    state: parsedImg.state || '',
                    pincode: parsedImg.pincode || '',
                    website: parsedImg.website || '',
                  });
                }
                if (Array.isArray(parsedImg.contacts)) {
                  parsedImg.contacts.forEach((c: any, ci: number) => {
                    if (c && (c.name || c.email || c.mobile)) {
                      collectedContacts.push({
                        id: `IMG-CNT-${ci + 1}`,
                        name: c.name || '',
                        department: c.department || 'General',
                        email: c.email || undefined,
                        mobile: c.mobile || undefined,
                        whatsapp: c.whatsapp || undefined,
                        landline: c.landline || undefined,
                        isPrimary: ci === 0,
                        source: fileName,
                        confidence: 88,
                      });
                    }
                  });
                }
                if (Array.isArray(parsedImg.brands)) {
                  parsedImg.brands.forEach((b: string) => b && explicitBrands.push(b));
                }
                if (Array.isArray(parsedImg.products)) {
                  parsedImg.products.forEach((p: any) => {
                    if (p?.productName && !isBannedGenericProductName(p.productName)) {
                      rawProducts.push({
                        ...p,
                        catalogFileName: fileName,
                        sourceFile: fileName,
                        sourcePage: 1,
                        sourcePages: [1],
                        sourceType: 'IMAGE',
                        aiConfidence: 88,
                      });
                      itemsFoundForFile++;
                    }
                  });
                }
                extractionMethods.add('Gemini Multimodal OCR');
              } catch (imgErr: any) {
                warnings.push(`Image OCR notice (${fileName}): ${imgErr?.message || 'OCR could not extract cleanly'}`);
              }
            } else {
              warnings.push(`Image "${fileName}" uploaded — paste any visiting card text if OCR key is not configured.`);
            }
            updateJob({
              pagesProcessed: job.pagesProcessed + 1,
              ocrPagesProcessed: job.ocrPagesProcessed + 1,
              productsDetected: rawProducts.length,
              progressPercent: 75,
            });
          }

          sourcesAnalyzed.push({
            sourceType: srcType,
            sourceName: fileName,
            status: itemsFoundForFile > 0 || identitySampleText.trim() ? 'SUCCESS' : 'PARTIAL',
            itemsExtracted: itemsFoundForFile,
          });
        } catch (fileErr: any) {
          sourcesAnalyzed.push({
            sourceType: srcType,
            sourceName: fileName,
            status: 'FAILED',
            itemsExtracted: 0,
            note: fileErr?.message || 'Parse error',
          });
          warnings.push(`File parse error (${fileName}): ${fileErr?.message}`);
        } finally {
          if (f.uploadId) {
            this.cleanupUploadSession(f.uploadId);
          }
        }
      }

      if (isCancelled()) return;

      // 3. Pasted Text
      if (cleanText) {
        const textSrcType = /gstin|gst\s*no/i.test(cleanText)
          ? 'GST_DOC'
          : /mobile|email|@\w+|sales|mr\.|ms\./i.test(cleanText) && cleanText.length < 900
            ? 'BUSINESS_CARD'
            : 'TEXT';
        helperPushTextExtraction(cleanText, 'Pasted Profile / Card Text', textSrcType, 82);

        const looksTabular = cleanText.includes(',') && cleanText.split('\n').length >= 2;
        const pastedProds = looksTabular
          ? parseTabularProductsFromCsv(cleanText, 'Pasted Profile Text', 'NEW')
          : parseCatalogLocally('Pasted Profile Text', cleanText, 'NEW').products;

        const filteredPastedProds = pastedProds.filter((p) => {
          const lineLower = (p.productName || '').toLowerCase();
          if (looksTabular) return true;
          return (
            !/^(company|legal|gstin|pan|address|email|mobile|phone|website|contact|attn|name)\b/i.test(lineLower) &&
            (p.brand !== 'Unconfirmed' || !!p.partNumber)
          );
        });
        filteredPastedProds.forEach((p) =>
          rawProducts.push({ ...p, sourceFile: 'Pasted Vendor Details', sourcePage: 1 })
        );
        sourcesAnalyzed.push({
          sourceType: textSrcType,
          sourceName: 'Pasted Vendor Details',
          status: 'SUCCESS',
          itemsExtracted: filteredPastedProds.length,
        });
        extractionMethods.add('Text & Card Extractor');
      }

      // 4. Optional Gemini Vendor Identity Synthesis over collected header/profile text
      const combinedSourceCorpus = allCombinedTexts.join('\n\n').slice(0, 26000);
      if (process.env.GEMINI_API_KEY && combinedSourceCorpus.trim().length > 20 && (!websiteIntelligenceResult || inputFiles.length > 0 || cleanText.length > 0)) {
        updateJob({ currentStage: 'Consolidating vendor identity, GSTIN, contacts & brands...', progressPercent: 86 }, true);
        try {
          const aiClient = await deps.getGoogleGenAIClient();
          const prompt = `Extract verified vendor profile details from these sources. NEVER invent GSTIN, PAN, emails, phones, addresses, or generic product names.
SOURCES:
"""
${combinedSourceCorpus}
"""
Return STRICT JSON:
{ "companyName": "", "legalName": "", "vendorType": "", "gstin": "", "pan": "", "website": "", "address": "", "city": "", "state": "", "pincode": "", "country": "India", "summary": "", "contacts": [{ "name": "", "department": "", "email": "", "mobile": "", "landline": "", "whatsapp": "" }], "brands": [""], "products": [{ "sourceProductName": "", "normalizedProductName": "", "productDesignation": "", "productFamily": "", "brand": "", "partNumber": "", "modelNumber": "", "category": "", "subCategory": "", "specification": "", "description": "", "uom": "NOS", "mrp": null, "basicRate": null, "discountPercent": null, "purchaseRate": null }] }`;

          const geminiResp = await deps.withTimeout<any>(
            aiClient.models.generateContent({
              model: 'gemini-4-hydrogen',
              contents: prompt,
              config: { responseMimeType: 'application/json' },
            }),
            15000,
            'Onboarding AI consolidation'
          );
          const aiData = JSON.parse((geminiResp.text || '{}').replace(/```json/gi, '').replace(/```/g, '').trim());
          if (aiData.companyName || aiData.gstin || aiData.address) {
            snapshots.push({
              sourceType: 'COMPANY_PROFILE',
              sourceName: 'Gemini AI Source Synthesis',
              confidence: 90,
              companyName: aiData.companyName || '',
              legalName: aiData.legalName || '',
              vendorType: aiData.vendorType || '',
              gstin: aiData.gstin && validateGstinFormat(aiData.gstin) ? aiData.gstin.toUpperCase() : '',
              pan: aiData.pan && validatePanFormat(aiData.pan) ? aiData.pan.toUpperCase() : '',
              email: aiData.contacts?.[0]?.email || '',
              mobile: aiData.contacts?.[0]?.mobile || '',
              address: aiData.address || '',
              city: aiData.city || '',
              state: aiData.state || '',
              pincode: aiData.pincode || '',
              website: aiData.website || '',
            });
          }
          if (Array.isArray(aiData.contacts)) {
            aiData.contacts.forEach((c: any, ci: number) => {
              if (c && (c.name || c.email || c.mobile)) {
                collectedContacts.push({
                  id: `AI-CNT-${ci + 1}`,
                  name: c.name || '',
                  department: c.department || 'General',
                  email: c.email || undefined,
                  mobile: c.mobile || undefined,
                  landline: c.landline || undefined,
                  whatsapp: c.whatsapp || undefined,
                  isPrimary: ci === 0,
                  source: 'Gemini AI Extraction',
                  confidence: 90,
                });
              }
            });
          }
          if (Array.isArray(aiData.brands)) {
            aiData.brands.forEach((b: string) => b && explicitBrands.push(b));
          }
          if (Array.isArray(aiData.products)) {
            aiData.products.forEach((p: any) => {
              const candidateName = p?.sourceProductName || p?.productName || p?.productDesignation || p?.partNumber;
              if (candidateName && !isBannedGenericProductName(candidateName)) {
                rawProducts.push({
                  ...p,
                  productName: p?.normalizedProductName || p?.productName || candidateName,
                  sourceProductName: p?.sourceProductName || candidateName,
                  catalogFileName: inputFiles[0]?.name || cleanUrl || 'AI Source Analysis',
                  sourceFile: inputFiles[0]?.name || cleanUrl || 'AI Source Analysis',
                  sourcePage: 1,
                  sourceType: cleanUrl && inputFiles.length === 0 ? 'WEBSITE' : 'PDF',
                  aiConfidence: 90,
                });
              }
            });
          }
          extractionMethods.add('Gemini 4 Hydrogen');
        } catch (aiErr: any) {
          console.warn('[ImportJobManager] Gemini synthesis skipped/timed out:', aiErr?.message);
        }
      }

      if (isCancelled()) return;

      // 5. VALIDATING STAGE: Cross-Chunk Deduplication + Master Reconciliation + Validation
      updateJob(
        {
          status: 'VALIDATING',
          currentStage: 'Deduplicating cross-chunk records & validating MRO catalogue products...',
          progressPercent: 92,
        },
        true
      );

      const dedupedRawProducts = deduplicateCatalogueProductsAcrossChunks(rawProducts);
      const defaultSourceLabel = inputFiles[0]?.name || cleanUrl || 'Vendor Onboarding Input';
      const reconciledAllProducts = reconcileProductsWithMaster(
        'NEW',
        dedupedRawProducts,
        dbProducts,
        dbBrands,
        defaultSourceLabel
      );

      const reconciledProducts: any[] = [];
      reconciledAllProducts.forEach((rp: any, rIdx: number) => {
        const val = validateExtractedProduct({
          productName: rp.productName,
          sourceProductName: rp.sourceProductName,
          brand: rp.brand,
          partNumber: rp.partNumber,
          modelNumber: rp.modelNumber,
          productDesignation: rp.productDesignation,
          specification: rp.specification,
          description: rp.description,
          category: rp.category,
          imageUrl: rp.imageUrl,
          detailUrl: rp.detailUrl || rp.sourceUrl,
          sourceUrl: rp.sourceUrl,
          mrp: rp.mrp,
          basicRate: rp.basicRate,
          purchaseRate: rp.purchaseRate,
          originalSourceText: rp.originalSourceText || rp.evidence || rp.productName,
          inProductSection: true,
        });
        if (val.isRejected) {
          collectedSuspicious.push({
            id: `SUS-ONB-${Date.now()}-${rIdx + 1}`,
            rawText: rp.sourceProductName || rp.productName || '',
            contentClass: val.contentClass,
            rejectionCategory: val.rejectionCategory || 'Low Confidence Record',
            reason: val.breakdown.reasons.join('; ') || 'Filtered out during MRO onboarding validation',
            score: val.breakdown.totalScore,
            sourceUrl: rp.sourceUrl || cleanUrl || undefined,
            catalogueRow: rp.catalogueRow,
            suggestedBrand: rp.brand !== 'Unconfirmed' ? rp.brand : undefined,
            suggestedCategory: rp.category,
            suggestedPartCode: rp.partNumber || undefined,
            suggestedProductName: rp.productName,
            status: 'REJECTED',
          });
          return;
        }
        reconciledProducts.push({
          ...rp,
          sourceFile: rp.sourceFile || rp.catalogFileName || defaultSourceLabel,
          sourcePage: rp.sourcePage,
          sourcePages: rp.sourcePages,
          contentClass: val.contentClass,
          validationScore: val.breakdown.totalScore,
          validationBreakdown: val.breakdown,
          reviewStatus:
            val.breakdown.status === 'NEEDS_REVIEW' || rp.brand === 'Unconfirmed' ? 'Needs Review' : 'Verified',
        });
      });

      const validCountOnb = reconciledProducts.filter((p) => p.reviewStatus !== 'Needs Review').length;
      const reviewCountOnb = reconciledProducts.filter((p) => p.reviewStatus === 'Needs Review').length;
      const rejectedCountOnb = collectedSuspicious.filter((s) => s.status === 'REJECTED').length;

      const { resolvedFields, conflicts } = detectSourceConflictsAndPickBest(snapshots);

      const dedupedContacts: any[] = [];
      const seenContactKeys = new Set<string>();
      for (const c of collectedContacts) {
        const emailKey = (c.email || '').trim().toLowerCase();
        const phoneKey = normalizePhoneLast10(c.mobile || c.landline || '');
        const key = `${emailKey}::${phoneKey}`;
        if (!emailKey && !phoneKey && !c.name) continue;
        if (key !== '::' && seenContactKeys.has(key)) {
          const existingC = dedupedContacts.find(
            (dc) =>
              (emailKey && (dc.email || '').toLowerCase() === emailKey) ||
              (phoneKey && normalizePhoneLast10(dc.mobile || '') === phoneKey)
          );
          if (existingC) {
            if (!existingC.name && c.name) existingC.name = c.name;
            if ((!existingC.department || existingC.department === 'General') && c.department) {
              existingC.department = c.department;
            }
          }
          continue;
        }
        if (key !== '::') seenContactKeys.add(key);
        dedupedContacts.push({ ...c, id: `CNT-${dedupedContacts.length + 1}`, isPrimary: dedupedContacts.length === 0 });
      }

      const reconciledBrands = reconcileBrandsWithMaster(
        reconciledProducts,
        combinedSourceCorpus,
        dbBrands,
        defaultSourceLabel,
        explicitBrands
      );

      const { categories: reconciledCategories, productFamilies } = reconcileCategoriesHierarchy(
        reconciledProducts,
        dbCategories,
        defaultSourceLabel
      );

      const companyNameFinal = resolvedFields.companyName?.value || params.vendorNameHint.trim();
      const gstFinal = resolvedFields.gstin?.value || '';
      const panFinal = resolvedFields.pan?.value || (gstFinal && validateGstinFormat(gstFinal) ? gstFinal.slice(2, 12) : '');

      const company = {
        companyName: companyNameFinal,
        legalName: resolvedFields.legalName?.value || companyNameFinal,
        tradingNames:
          companyNameFinal && resolvedFields.legalName?.value && companyNameFinal !== resolvedFields.legalName.value
            ? [companyNameFinal]
            : [],
        vendorType: resolvedFields.vendorType?.value || 'Distributor',
        website: resolvedFields.website?.value || cleanUrl || '',
        gstin: gstFinal,
        pan: panFinal,
        country: structuredAddressBest?.country || 'India',
        msmeStatus: 'Small',
        paymentTerms: '30 Days Net',
        creditPeriod: '30 Days',
        deliveryTerms: 'Door Delivery / Ex-Works',
        summary: websiteIntelligenceResult?.companyOverview || '',
      };

      const structuredAddress = {
        ...(structuredAddressBest || { splitConfidence: 40, rawAddress: '' }),
        rawAddress: resolvedFields.address?.value || structuredAddressBest?.rawAddress || '',
        city: resolvedFields.city?.value || structuredAddressBest?.city || '',
        state: resolvedFields.state?.value || structuredAddressBest?.state || '',
        pincode: resolvedFields.pincode?.value || structuredAddressBest?.pincode || '',
        country: structuredAddressBest?.country || 'India',
      };

      const sourceTraceability = Object.values(resolvedFields)
        .map((r) => r.trace)
        .filter(Boolean) as any[];

      const primaryC = dedupedContacts[0];
      const duplicates = detectDuplicateVendors(
        {
          companyName: company.companyName,
          legalName: company.legalName,
          gstin: company.gstin,
          pan: company.pan,
          website: company.website,
          email: primaryC?.email || resolvedFields.email?.value,
          mobile: primaryC?.mobile || resolvedFields.mobile?.value,
          address: structuredAddress.rawAddress,
        },
        dbVendors
      );

      const completion = computeOnboardingCompletion({
        company,
        structuredAddress,
        contacts: dedupedContacts,
        brands: reconciledBrands,
        categories: reconciledCategories,
        productFamilies,
        products: reconciledProducts,
        conflicts,
        sourceTraceability,
      });

      const analysisResult = {
        success: true,
        analysisId: `ONB-${Date.now()}`,
        importJobId: job.jobId,
        analyzedAt: new Date().toISOString(),
        sourcesAnalyzed,
        company,
        structuredAddress,
        contacts: dedupedContacts,
        brands: reconciledBrands,
        categories: reconciledCategories,
        productFamilies,
        products: reconciledProducts,
        suspiciousItems: collectedSuspicious,
        extractionSummary: {
          totalDetected: reconciledProducts.length + rejectedCountOnb,
          validCount: validCountOnb,
          reviewCount: reviewCountOnb,
          rejectedCount: rejectedCountOnb,
        },
        spreadsheetPreview,
        conflicts,
        duplicates,
        sourceTraceability,
        completion,
        warnings,
        extractionMethods: Array.from(extractionMethods),
        websiteIntelligence: websiteIntelligenceResult,
        cacheHit: Boolean(websiteIntelligenceResult?.cacheHit),
      };

      const resultPath = path.join(JOBS_ROOT, `${job.jobId}_result.json`);
      await fs.promises.writeFile(resultPath, JSON.stringify(analysisResult), 'utf-8');

      updateJob(
        {
          status: 'READY_FOR_REVIEW',
          productsDetected: reconciledProducts.length + rejectedCountOnb,
          validCount: validCountOnb,
          reviewRequiredCount: reviewCountOnb,
          rejectedCount: rejectedCountOnb,
          warnings,
          currentStage: 'Catalogue ready for review & confirmation',
          progressPercent: 100,
          resultFilePath: resultPath,
        },
        true
      );
    } catch (err: any) {
      if (isCancelled()) return;
      console.error(`[ImportJobManager] Job ${job.jobId} failed:`, err);
      updateJob(
        {
          status: 'FAILED',
          error: err?.message || 'Catalogue processing failed.',
          currentStage: 'Import job failed',
        },
        true
      );
    }
  }
}

export const vendorImportJobManager = new VendorImportJobManager();
