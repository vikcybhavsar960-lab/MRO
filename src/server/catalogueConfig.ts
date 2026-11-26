import { preserveExactPartCode } from '../services/vendorIntelligenceService.js';

export interface VendorCatalogueConfig {
  maxFileSizeMb: number;
  maxFileSizeBytes: number;
  uploadChunkSizeBytes: number;
  maxPagesPerPdfChunk: number;
  allowedExtensions: string[];
  allowedFormatsLabel: string;
}

export const SUPPORTED_CATALOGUE_EXTENSIONS = [
  '.pdf',
  '.xls',
  '.xlsx',
  '.csv',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
];

export function getVendorCatalogueConfig(): VendorCatalogueConfig {
  const rawMb = Number(process.env.MAX_VENDOR_CATALOGUE_SIZE_MB || 250);
  const maxFileSizeMb = Number.isFinite(rawMb) && rawMb >= 1 ? Math.floor(rawMb) : 250;
  return {
    maxFileSizeMb,
    maxFileSizeBytes: maxFileSizeMb * 1024 * 1024,
    uploadChunkSizeBytes: 4 * 1024 * 1024, // 4 MB raw binary chunks (safely below proxy/nginx 32M limit)
    maxPagesPerPdfChunk: 20,
    allowedExtensions: [...SUPPORTED_CATALOGUE_EXTENSIONS],
    allowedFormatsLabel: 'PDF | XLS | XLSX | CSV | JPG | PNG | WEBP',
  };
}

export function getFileExtension(fileName: string): string {
  const clean = String(fileName || '').trim().toLowerCase();
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot) : '';
}

export interface FileSignatureValidationResult {
  valid: boolean;
  detectedFormat?: 'PDF' | 'XLS' | 'XLSX' | 'CSV' | 'JPG' | 'PNG' | 'WEBP';
  code?: 'UNSUPPORTED_FILE_TYPE' | 'FILE_TOO_LARGE' | 'EMPTY_FILE';
  error?: string;
}

const EXTENSION_TO_MIMES: Record<string, string[]> = {
  '.pdf': ['application/pdf', 'application/x-pdf'],
  '.xls': [
    'application/vnd.ms-excel',
    'application/msexcel',
    'application/x-msexcel',
    'application/x-excel',
    'application/xml',
    'text/xml',
  ],
  '.xlsx': [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed',
  ],
  '.csv': ['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel'],
  '.jpg': ['image/jpeg', 'image/pjpeg'],
  '.jpeg': ['image/jpeg', 'image/pjpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
};

function hasPrefix(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buf[offset + i] !== bytes[i]) return false;
  }
  return true;
}

/**
 * Validates BOTH file extension/MIME metadata AND actual binary magic bytes.
 * Rejects spoofed or unrecognized files with exact "Unsupported file type",
 * and oversized files with "File exceeds configured maximum size of <N> MB".
 */
export function validateCatalogueFile(params: {
  fileName: string;
  mimeType?: string;
  fileSizeBytes?: number;
  headerBuffer?: Buffer;
}): FileSignatureValidationResult {
  const cfg = getVendorCatalogueConfig();
  const ext = getFileExtension(params.fileName);

  if (!ext || !SUPPORTED_CATALOGUE_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      code: 'UNSUPPORTED_FILE_TYPE',
      error: 'Unsupported file type',
    };
  }

  if (typeof params.fileSizeBytes === 'number') {
    if (params.fileSizeBytes <= 0) {
      return {
        valid: false,
        code: 'EMPTY_FILE',
        error: `File "${params.fileName}" is empty (0 bytes).`,
      };
    }
    if (params.fileSizeBytes > cfg.maxFileSizeBytes) {
      return {
        valid: false,
        code: 'FILE_TOO_LARGE',
        error: `File exceeds configured maximum size of ${cfg.maxFileSizeMb} MB`,
      };
    }
  }

  const cleanMime = String(params.mimeType || '').split(';')[0].trim().toLowerCase();
  if (
    cleanMime &&
    cleanMime !== 'application/octet-stream' &&
    cleanMime !== 'binary/octet-stream'
  ) {
    const allowedMimes = EXTENSION_TO_MIMES[ext] || [];
    if (!allowedMimes.includes(cleanMime)) {
      return {
        valid: false,
        code: 'UNSUPPORTED_FILE_TYPE',
        error: 'Unsupported file type',
      };
    }
  }

  if (params.headerBuffer) {
    const buf = params.headerBuffer;
    if (buf.length === 0) {
      return {
        valid: false,
        code: 'EMPTY_FILE',
        error: `File "${params.fileName}" is empty (0 bytes).`,
      };
    }

    if (ext === '.pdf') {
      // Allow optional UTF-8 BOM or whitespace before %PDF- within first 32 bytes
      const headSlice = buf.subarray(0, Math.min(buf.length, 64)).toString('latin1');
      if (!headSlice.includes('%PDF-')) {
        return { valid: false, code: 'UNSUPPORTED_FILE_TYPE', error: 'Unsupported file type' };
      }
      return { valid: true, detectedFormat: 'PDF' };
    }

    if (ext === '.xlsx') {
      const isZip =
        hasPrefix(buf, [0x50, 0x4b, 0x03, 0x04]) ||
        hasPrefix(buf, [0x50, 0x4b, 0x05, 0x06]) ||
        hasPrefix(buf, [0x50, 0x4b, 0x07, 0x08]);
      if (!isZip) {
        return { valid: false, code: 'UNSUPPORTED_FILE_TYPE', error: 'Unsupported file type' };
      }
      return { valid: true, detectedFormat: 'XLSX' };
    }

    if (ext === '.xls') {
      const isOle2 = hasPrefix(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
      const headText = buf.subarray(0, Math.min(buf.length, 128)).toString('utf8').trim().toLowerCase();
      const isXmlOrHtmlExcel =
        headText.startsWith('<?xml') ||
        headText.startsWith('<workbook') ||
        headText.startsWith('<html') ||
        headText.startsWith('<!doctype');
      if (!isOle2 && !isXmlOrHtmlExcel) {
        return { valid: false, code: 'UNSUPPORTED_FILE_TYPE', error: 'Unsupported file type' };
      }
      return { valid: true, detectedFormat: 'XLS' };
    }

    if (ext === '.png') {
      if (!hasPrefix(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
        return { valid: false, code: 'UNSUPPORTED_FILE_TYPE', error: 'Unsupported file type' };
      }
      return { valid: true, detectedFormat: 'PNG' };
    }

    if (ext === '.jpg' || ext === '.jpeg') {
      if (!hasPrefix(buf, [0xff, 0xd8, 0xff])) {
        return { valid: false, code: 'UNSUPPORTED_FILE_TYPE', error: 'Unsupported file type' };
      }
      return { valid: true, detectedFormat: 'JPG' };
    }

    if (ext === '.webp') {
      const isRiff = hasPrefix(buf, [0x52, 0x49, 0x46, 0x46]);
      const isWebp = buf.length >= 12 && buf.subarray(8, 12).toString('ascii') === 'WEBP';
      if (!isRiff || !isWebp) {
        return { valid: false, code: 'UNSUPPORTED_FILE_TYPE', error: 'Unsupported file type' };
      }
      return { valid: true, detectedFormat: 'WEBP' };
    }

    if (ext === '.csv') {
      // Reject binary executables, archives, PDFs, images disguised as .csv
      const hasNull = buf.includes(0x00);
      const isBinarySig =
        hasPrefix(buf, [0x4d, 0x5a]) || // MZ (EXE/DLL)
        hasPrefix(buf, [0x7f, 0x45, 0x4c, 0x46]) || // ELF
        hasPrefix(buf, [0x25, 0x50, 0x44, 0x46]) || // %PDF
        hasPrefix(buf, [0x50, 0x4b, 0x03, 0x04]) || // ZIP
        hasPrefix(buf, [0xd0, 0xcf, 0x11, 0xe0]) || // OLE2
        hasPrefix(buf, [0x89, 0x50, 0x4e, 0x47]) || // PNG
        hasPrefix(buf, [0xff, 0xd8, 0xff]); // JPEG
      if (hasNull || isBinarySig) {
        return { valid: false, code: 'UNSUPPORTED_FILE_TYPE', error: 'Unsupported file type' };
      }
      return { valid: true, detectedFormat: 'CSV' };
    }
  }

  return {
    valid: true,
    detectedFormat: ext.replace('.', '').toUpperCase() as any,
  };
}

function normCode(raw?: string): string {
  return preserveExactPartCode(String(raw || ''))
    .trim()
    .toLowerCase();
}

function normText(raw?: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes hierarchical deduplication keys across PDF/spreadsheet chunks.
 * Priority:
 *   1. Exact Part Code
 *   2. Manufacturer Code
 *   3. Model Number
 *   4. Brand + Product + Specification
 */
export function buildProductDeduplicationKeys(p: any): string[] {
  const keys: string[] = [];
  const exactPart = normCode(p?.partNumber);
  const mfgCode = normCode(p?.manufacturerCode);
  const modelNum = normCode(p?.modelNumber);
  const brand = normText(p?.brand && p.brand !== 'Unconfirmed' ? p.brand : '');
  const prodName = normText(p?.productName || p?.sourceProductName || '');
  const spec = normText(p?.specification || '');

  if (exactPart) keys.push(`PART:${exactPart}`);
  if (mfgCode) keys.push(`MFG:${mfgCode}`);
  if (modelNum) keys.push(`MODEL:${modelNum}`);
  if (prodName) {
    keys.push(`BPS:${brand}::${prodName}::${spec}`);
  }
  return keys;
}

/**
 * Merges and deduplicates extracted product rows across multi-page / multi-chunk PDF processing
 * while preserving sourceFile, primary sourcePage, all sourcePages[], and row traceability.
 */
export function deduplicateCatalogueProductsAcrossChunks<T extends Record<string, any>>(items: T[]): T[] {
  const keyToIndex = new Map<string, number>();
  const result: T[] = [];

  for (const item of items) {
    if (!item) continue;
    const keys = buildProductDeduplicationKeys(item);
    let matchedIdx: number | undefined;
    for (const k of keys) {
      const found = keyToIndex.get(k);
      if (found !== undefined) {
        matchedIdx = found;
        break;
      }
    }

    const itemPages: number[] = Array.isArray(item.sourcePages)
      ? item.sourcePages.filter((n: any) => typeof n === 'number' && n > 0)
      : typeof item.sourcePage === 'number' && item.sourcePage > 0
        ? [item.sourcePage]
        : [];

    if (matchedIdx === undefined) {
      const idx = result.length;
      const cloned: any = {
        ...item,
        ...(itemPages.length > 0 ? { sourcePage: itemPages[0], sourcePages: Array.from(new Set(itemPages)) } : {}),
      };
      result.push(cloned);
      for (const k of keys) {
        if (!keyToIndex.has(k)) keyToIndex.set(k, idx);
      }
    } else {
      const existing: any = result[matchedIdx];
      const mergedPages = Array.from(
        new Set([
          ...(Array.isArray(existing.sourcePages)
            ? existing.sourcePages
            : typeof existing.sourcePage === 'number'
              ? [existing.sourcePage]
              : []),
          ...itemPages,
        ])
      ).sort((a, b) => a - b);

      result[matchedIdx] = {
        ...existing,
        brand:
          existing.brand && existing.brand !== 'Unconfirmed'
            ? existing.brand
            : item.brand || existing.brand,
        partNumber: existing.partNumber || item.partNumber,
        manufacturerCode: existing.manufacturerCode || item.manufacturerCode,
        modelNumber: existing.modelNumber || item.modelNumber,
        specification:
          (existing.specification || '').length >= (item.specification || '').length
            ? existing.specification
            : item.specification,
        description:
          (existing.description || '').length >= (item.description || '').length
            ? existing.description
            : item.description,
        mrp: existing.mrp ?? item.mrp,
        basicRate: existing.basicRate ?? item.basicRate,
        discountPercent: existing.discountPercent ?? item.discountPercent,
        purchaseRate: existing.purchaseRate ?? item.purchaseRate,
        sourceFile: existing.sourceFile || item.sourceFile || existing.catalogFileName,
        sourcePage: mergedPages[0] ?? existing.sourcePage ?? item.sourcePage,
        sourcePages: mergedPages.length > 0 ? mergedPages : existing.sourcePages,
      };
      for (const k of keys) {
        if (!keyToIndex.has(k)) keyToIndex.set(k, matchedIdx);
      }
    }
  }

  return result;
}
