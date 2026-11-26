import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getVendorCatalogueConfig,
  validateCatalogueFile,
  deduplicateCatalogueProductsAcrossChunks,
} from './catalogueConfig.js';

test('getVendorCatalogueConfig defaults to 250 MB and honors MAX_VENDOR_CATALOGUE_SIZE_MB env override', () => {
  const prev = process.env.MAX_VENDOR_CATALOGUE_SIZE_MB;
  try {
    delete process.env.MAX_VENDOR_CATALOGUE_SIZE_MB;
    const defCfg = getVendorCatalogueConfig();
    assert.equal(defCfg.maxFileSizeMb, 250);
    assert.equal(defCfg.maxFileSizeBytes, 250 * 1024 * 1024);
    assert.equal(defCfg.uploadChunkSizeBytes, 4 * 1024 * 1024);

    process.env.MAX_VENDOR_CATALOGUE_SIZE_MB = '120';
    const overrideCfg = getVendorCatalogueConfig();
    assert.equal(overrideCfg.maxFileSizeMb, 120);
    assert.equal(overrideCfg.maxFileSizeBytes, 120 * 1024 * 1024);
  } finally {
    if (prev === undefined) delete process.env.MAX_VENDOR_CATALOGUE_SIZE_MB;
    else process.env.MAX_VENDOR_CATALOGUE_SIZE_MB = prev;
  }
});

test('validateCatalogueFile enforces both extension and magic byte signatures', () => {
  const prev = process.env.MAX_VENDOR_CATALOGUE_SIZE_MB;
  try {
    process.env.MAX_VENDOR_CATALOGUE_SIZE_MB = '250';

    // Valid PDF header at 180 MB (well above old 15 MB cap, below 250 MB cap)
    const validPdf = validateCatalogueFile({
      fileName: 'SALVI_CORPORATION_2026.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 180 * 1024 * 1024,
      headerBuffer: Buffer.from('%PDF-1.7\n1 0 obj\n', 'ascii'),
    });
    assert.equal(validPdf.valid, true);
    assert.equal(validPdf.detectedFormat, 'PDF');

    // Oversized PDF exceeding configured 250 MB
    const oversizedPdf = validateCatalogueFile({
      fileName: 'GIANT_CATALOGUE.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 260 * 1024 * 1024,
      headerBuffer: Buffer.from('%PDF-1.7\n', 'ascii'),
    });
    assert.equal(oversizedPdf.valid, false);
    assert.equal(oversizedPdf.error, 'File exceeds configured maximum size of 250 MB');

    // Spoofed Windows PE executable renamed to .pdf
    const spoofedPdf = validateCatalogueFile({
      fileName: 'malware.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 1024,
      headerBuffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]),
    });
    assert.equal(spoofedPdf.valid, false);
    assert.equal(spoofedPdf.error, 'Unsupported file type');

    // Unsupported extension (.exe)
    const exeFile = validateCatalogueFile({
      fileName: 'installer.exe',
      mimeType: 'application/octet-stream',
      fileSizeBytes: 2048,
      headerBuffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00]),
    });
    assert.equal(exeFile.valid, false);
    assert.equal(exeFile.error, 'Unsupported file type');

    // Valid XLSX (ZIP magic bytes)
    const validXlsx = validateCatalogueFile({
      fileName: 'pricelist.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileSizeBytes: 50000,
      headerBuffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]),
    });
    assert.equal(validXlsx.valid, true);
    assert.equal(validXlsx.detectedFormat, 'XLSX');

    // Valid CSV vs binary spoofed as .csv
    const validCsv = validateCatalogueFile({
      fileName: 'items.csv',
      mimeType: 'text/csv',
      fileSizeBytes: 120,
      headerBuffer: Buffer.from('Brand,Part Code,Product Name,Rate\nSKF,6006,Ball Bearing,312\n', 'utf-8'),
    });
    assert.equal(validCsv.valid, true);
    assert.equal(validCsv.detectedFormat, 'CSV');

    const binaryCsv = validateCatalogueFile({
      fileName: 'binary.csv',
      mimeType: 'text/csv',
      fileSizeBytes: 120,
      headerBuffer: Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x00, 0x00]),
    });
    assert.equal(binaryCsv.valid, false);
    assert.equal(binaryCsv.error, 'Unsupported file type');

    // Valid PNG / JPEG / WEBP
    assert.equal(
      validateCatalogueFile({
        fileName: 'card.png',
        mimeType: 'image/png',
        fileSizeBytes: 4096,
        headerBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      }).valid,
      true
    );
    assert.equal(
      validateCatalogueFile({
        fileName: 'card.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 4096,
        headerBuffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      }).valid,
      true
    );
    assert.equal(
      validateCatalogueFile({
        fileName: 'card.webp',
        mimeType: 'image/webp',
        fileSizeBytes: 4096,
        headerBuffer: Buffer.from('RIFF\x24\x00\x00\x00WEBP', 'binary'),
      }).valid,
      true
    );
  } finally {
    if (prev === undefined) delete process.env.MAX_VENDOR_CATALOGUE_SIZE_MB;
    else process.env.MAX_VENDOR_CATALOGUE_SIZE_MB = prev;
  }
});

test('deduplicateCatalogueProductsAcrossChunks merges duplicates across PDF chunks while preserving part variants', () => {
  const chunkItems = [
    {
      brand: 'SKF',
      partNumber: '6006/C3',
      productName: 'Deep Groove Ball Bearing C3',
      specification: '30x55x13 mm',
      sourceFile: 'SALVI_2026.pdf',
      sourcePage: 2,
      mrp: 510,
      aiConfidence: 85,
    },
    {
      brand: 'SKF',
      partNumber: '6006/C3',
      productName: 'Deep Groove Ball Bearing C3',
      specification: '30x55x13 mm Radial Clearance C3',
      sourceFile: 'SALVI_2026.pdf',
      sourcePage: 24,
      purchaseRate: 331.5,
      aiConfidence: 92,
    },
    {
      brand: 'SKF',
      partNumber: '6006',
      productName: 'Deep Groove Ball Bearing Open',
      specification: '30x55x13 mm',
      sourceFile: 'SALVI_2026.pdf',
      sourcePage: 2,
      mrp: 480,
      aiConfidence: 90,
    },
    {
      brand: 'Schneider Electric',
      modelNumber: 'LC1D09B7',
      productName: 'TeSys D Contactor',
      specification: '9A 24VAC',
      sourceFile: 'SALVI_2026.pdf',
      sourcePage: 5,
    },
    {
      brand: 'Schneider Electric',
      modelNumber: 'LC1D09B7',
      productName: 'TeSys D Contactor 3P',
      specification: '9A 24VAC',
      sourceFile: 'SALVI_2026.pdf',
      sourcePage: 41,
      purchaseRate: 1404,
    },
  ];

  const deduped: any[] = deduplicateCatalogueProductsAcrossChunks(chunkItems);
  assert.equal(deduped.length, 3);

  const c3 = deduped.find((d) => d.partNumber === '6006/C3');
  assert.ok(c3);
  assert.deepEqual(c3.sourcePages, [2, 24]);
  assert.equal(c3.mrp, 510);
  assert.equal(c3.purchaseRate, 331.5);
  assert.equal(c3.sourceFile, 'SALVI_2026.pdf');

  const open = deduped.find((d) => d.partNumber === '6006');
  assert.ok(open);

  const lc1 = deduped.find((d) => d.modelNumber === 'LC1D09B7');
  assert.ok(lc1);
  assert.deepEqual(lc1.sourcePages, [5, 41]);
  assert.equal(lc1.purchaseRate, 1404);
});
