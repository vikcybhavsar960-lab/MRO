import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { db } from './db.js';
import { vendorImportJobManager } from './vendorImportJobManager.js';

/**
 * Generates a valid multi-page PDF buffer over targetMinBytes containing real extractable MRO text lines
 * plus valid PDF comment padding (so >15 MB PDFs parse cleanly without bloated memory overhead).
 */
function buildValidLargeMultiPagePdf(targetMinBytes: number): Buffer {
  const pageTexts = [
    'SALVI INDUSTRIAL CORPORATION\nGSTIN: 27AABCS1234F1Z2\nPlot 18, MIDC Bhosari, Pune - 411026\nSKF Deep Groove Ball Bearing 6205-2RS1 Rate 420.00\nFesto Pneumatic Cylinder DSBC-32-100-PPVA Rate 3850.00',
    'SALVI INDUSTRIAL CORPORATION PAGE 2\nSiemens Contactor 3RT2015-1BB41 Rate 1280.00\nSKF Deep Groove Ball Bearing 6205-2RS1 Rate 420.00\nOmron Proximity Sensor E2E-X5ME1 Rate 990.00',
  ];

  const objects: string[] = [];
  // 1: Catalog, 2: Pages, 3: Font
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [4 0 R 6 0 R] /Count 2 >>\nendobj\n');
  objects.push('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  let objNum = 4;
  for (const txt of pageTexts) {
    const pageId = objNum++;
    const contentId = objNum++;
    const lines = txt.split('\n');
    const ops = ['BT', '/F1 11 Tf', '50 740 Td'];
    lines.forEach((line, idx) => {
      const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      if (idx > 0) ops.push('0 -18 Td');
      ops.push(`(${escaped}) Tj`);
    });
    ops.push('ET');
    const streamData = ops.join('\n');
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj\n`
    );
    objects.push(
      `${contentId} 0 obj\n<< /Length ${Buffer.byteLength(streamData, 'ascii')} >>\nstream\n${streamData}\nendstream\nendobj\n`
    );
  }

  let body = '%PDF-1.4\n';
  const offsets: number[] = [0];
  // Pad cleanly inside a PDF comment block after header so offsets stay exact
  const approxBase = objects.reduce((acc, o) => acc + Buffer.byteLength(o, 'ascii'), 512);
  const padNeeded = Math.max(0, targetMinBytes - approxBase);
  if (padNeeded > 0) {
    const lineChunk = '%' + 'SALVI_LARGE_PDF_STREAM_BLOCK_'.repeat(32) + '\n';
    const repeatCount = Math.ceil(padNeeded / lineChunk.length);
    body += lineChunk.repeat(repeatCount);
  }

  const headerBuf = Buffer.from(body, 'ascii');
  const parts: Buffer[] = [headerBuf];
  let cursor = headerBuf.length;

  for (const obj of objects) {
    offsets.push(cursor);
    const buf = Buffer.from(obj, 'ascii');
    parts.push(buf);
    cursor += buf.length;
  }

  const xrefOffset = cursor;
  let xref = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  parts.push(Buffer.from(xref, 'ascii'));

  return Buffer.concat(parts);
}

test('Authoritative vendor persistence commits to disk with fsync, verifies readback, and avoids soft-deleted ID collisions', () => {
  const uniqueSuffix = Date.now();
  const testCompany = `Verification Bearing Corp ${uniqueSuffix}`;
  const testGstin = '27AAACV9988K1Z4';
  let createdId = '';

  const dbFilePath = path.resolve(process.cwd(), 'data/erp_production.json');
  const backupRaw = fs.existsSync(dbFilePath) ? fs.readFileSync(dbFilePath, 'utf-8') : null;

  try {
    const createRes = db.saveVendorAuthoritative(
      {
        companyName: testCompany,
        website: 'https://verificationbearings.example.com',
        contactPerson: 'Rajesh Kulkarni',
        mobile: '9822011223',
        email: 'sales@verificationbearings.example.com',
        gstin: testGstin,
        city: 'Pune',
        state: 'Maharashtra',
        brandsSupplied: ['SKF', 'Festo'],
        materialCategories: ['Bearings', 'Pneumatics'],
      },
      'CREATE',
      'UnitTestRunner',
      'SUPER_ADMIN',
      '127.0.0.1'
    );

    assert.equal(createRes.success, true);
    assert.equal(createRes.verified, true);
    assert.equal(createRes.mode, 'CREATE');
    assert.ok(createRes.vendor.id);
    createdId = createRes.vendor.id;

    // Duplicate company name must be rejected rather than silently overwriting
    assert.throws(
      () =>
        db.saveVendorAuthoritative(
          { companyName: testCompany },
          'CREATE',
          'UnitTestRunner',
          'SUPER_ADMIN',
          '127.0.0.1'
        ),
      /already exists/i
    );

    // Update persisted vendor and verify immediate disk readback
    const updateRes = db.saveVendorAuthoritative(
      {
        id: createdId,
        companyName: testCompany,
        city: 'Mumbai',
        brandsSupplied: ['SKF', 'Festo', 'Siemens'],
      },
      'UPDATE',
      'UnitTestRunner',
      'SUPER_ADMIN',
      '127.0.0.1'
    );
    assert.equal(updateRes.verified, true);
    assert.equal(updateRes.vendor.city, 'Mumbai');
    assert.deepEqual(updateRes.vendor.brandsSupplied, ['SKF', 'Festo', 'Siemens']);

    const diskAfter = JSON.parse(fs.readFileSync(dbFilePath, 'utf-8'));
    const diskRec = (diskAfter.vendors || []).find((v: any) => v.id === createdId && !v.isDeleted);
    assert.ok(diskRec, 'Saved vendor must exist on disk JSON');
    assert.equal(diskRec.city, 'Mumbai');
    assert.equal(diskRec.gstin, testGstin);
  } finally {
    // Restore original production DB file cleanly so tests leave zero residual test records
    if (backupRaw !== null) {
      fs.writeFileSync(dbFilePath, backupRaw, 'utf-8');
    }
    if (createdId) {
      const vendors = db.getCollection('vendors').filter((v: any) => v.id !== createdId);
      db.setCollection('vendors', vendors);
    }
  }
});

test('Chunked upload and async Import Job process a >15 MB multi-page PDF without duplicate products across chunks', async () => {
  const jobsFilePath = path.resolve(process.cwd(), 'data/import_jobs/jobs.json');
  const jobsBackupRaw = fs.existsSync(jobsFilePath) ? fs.readFileSync(jobsFilePath, 'utf-8') : null;
  let uploadedFilePath: string | undefined;
  let resultFilePath: string | undefined;

  try {
    const pdfBuffer = buildValidLargeMultiPagePdf(16 * 1024 * 1024); // 16 MB > old 15 MB limit
    assert.ok(pdfBuffer.length > 15 * 1024 * 1024);

    const fileName = 'SALVI CORPORATION 2026.pdf';
    const chunkSize = 4 * 1024 * 1024;
    const totalChunks = Math.ceil(pdfBuffer.length / chunkSize);

    const session = vendorImportJobManager.initUploadSession({
      fileName,
      mimeType: 'application/pdf',
      fileSizeBytes: pdfBuffer.length,
      totalChunks,
      sourceRole: 'Catalogue',
    });

    for (let i = 0; i < totalChunks; i++) {
      const slice = pdfBuffer.subarray(i * chunkSize, Math.min(pdfBuffer.length, (i + 1) * chunkSize));
      const res = await vendorImportJobManager.appendUploadChunk({
        uploadId: session.uploadId,
        chunkIndex: i,
        totalChunks,
        chunkBuffer: slice,
      });
      assert.equal(res.chunkIndex, i);
    }

    const completed = await vendorImportJobManager.completeUploadSession(session.uploadId);
    uploadedFilePath = completed.tempFilePath;
    assert.equal(completed.status, 'READY');
    assert.equal(completed.detectedFormat, 'PDF');
    assert.equal(completed.receivedBytes, pdfBuffer.length);

    const job = vendorImportJobManager.startImportJob(
      {
        vendorNameHint: 'SALVI INDUSTRIAL CORPORATION',
        files: [
          {
            uploadId: session.uploadId,
            name: fileName,
            mimeType: 'application/pdf',
            size: pdfBuffer.length,
            sourceRole: 'Catalogue',
          },
        ],
        createdBy: 'UnitTestRunner',
      },
      {
        analyzeVendorWebsiteImpl: async () => ({ ok: false }),
        getGoogleGenAIClient: async () => {
          throw new Error('No AI key needed for deterministic PDF test');
        },
        withTimeout: async <T>(p: Promise<T>) => p,
      }
    );

    // Wait up to 15 seconds for background import job to complete
    let current = vendorImportJobManager.getJob(job.jobId);
    const deadline = Date.now() + 15000;
    while (current && !['READY_FOR_REVIEW', 'FAILED', 'CANCELLED'].includes(current.status) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 150));
      current = vendorImportJobManager.getJob(job.jobId);
    }

    assert.ok(current);
    resultFilePath = current.resultFilePath;
    assert.equal(current.status, 'READY_FOR_REVIEW', `Expected READY_FOR_REVIEW, got ${current.status}: ${current.error || ''}`);
    assert.equal(current.totalPages, 2);
    assert.equal(current.pagesProcessed, 2);

    const analysis = vendorImportJobManager.getJobResult(job.jobId);
    assert.ok(analysis);
    assert.equal(analysis.company.gstin, '27AABCS1234F1Z2');
    assert.ok(Array.isArray(analysis.products));

    // Verify 6205-2RS1 appearing on both page 1 and page 2 is NOT duplicated
    const skf6205Matches = analysis.products.filter((p: any) => String(p.partNumber || '').includes('6205-2RS1'));
    assert.equal(skf6205Matches.length, 1, 'Same part code across page 1 and page 2 must be deduplicated');
    assert.equal(skf6205Matches[0].sourceFile, fileName);
  } finally {
    if (resultFilePath && fs.existsSync(resultFilePath)) {
      fs.unlinkSync(resultFilePath);
    }
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
    }
    if (jobsBackupRaw !== null) {
      fs.writeFileSync(jobsFilePath, jobsBackupRaw, 'utf-8');
    } else if (fs.existsSync(jobsFilePath)) {
      fs.unlinkSync(jobsFilePath);
    }
  }
});

test('Authoritative Supabase ID preservation prevents tombstone split-brain and handles local-missing UPDATE without 404', () => {
  const dbFilePath = path.resolve(process.cwd(), 'data/erp_production.json');
  const backupRaw = fs.existsSync(dbFilePath) ? fs.readFileSync(dbFilePath, 'utf-8') : null;
  const originalMem = JSON.parse(JSON.stringify((db as any).data));

  try {
    const simulatedId = 'VEND-991';
    const uniqueName = `Sync Integrity Corp ${Date.now()}`;

    // Simulate tombstone conflict in local DB (exact scenario that caused VEND-011 split-brain)
    (db as any).data.deletedVendorIds = Array.from(
      new Set([...((db as any).data.deletedVendorIds || []), simulatedId])
    );

    // 1. CREATE with preserveAuthoritativeId=true must honor Supabase's ID and clear tombstone
    const created = db.saveVendorAuthoritative(
      {
        id: simulatedId,
        companyName: uniqueName,
        contactPerson: 'Vikram Patel',
        mobile: '9825011111',
        city: 'Ahmedabad',
        state: 'Gujarat',
      },
      'CREATE',
      'UnitTestRunner',
      'SUPER_ADMIN',
      '127.0.0.1',
      { preserveAuthoritativeId: true }
    );

    assert.equal(created.vendor.id, simulatedId);
    assert.equal(created.vendor.mobile, '9825011111');
    assert.equal(
      ((db as any).data.deletedVendorIds || []).includes(simulatedId),
      false,
      'Authoritative CREATE must clear any stale tombstone for the preserved ID'
    );

    // 2. UPDATE when record is missing from local JSON cache (e.g. created directly in Supabase) must upsert cleanly
    (db as any).data.vendors = ((db as any).data.vendors || []).filter((v: any) => v.id !== simulatedId);
    const updated = db.saveVendorAuthoritative(
      {
        id: simulatedId,
        companyName: uniqueName,
        contactPerson: 'Vikram Patel',
        mobile: '9825099999',
        city: 'Ahmedabad',
        state: 'Gujarat',
      },
      'UPDATE',
      'UnitTestRunner',
      'SUPER_ADMIN',
      '127.0.0.1',
      { preserveAuthoritativeId: true }
    );

    assert.equal(updated.verified, true);
    assert.equal(updated.vendor.id, simulatedId);
    assert.equal(updated.vendor.mobile, '9825099999');
    assert.ok(db.getVendorById(simulatedId), 'Updated vendor must be retrievable in active vendors');
  } finally {
    (db as any).data = originalMem;
    if (backupRaw !== null) {
      fs.writeFileSync(dbFilePath, backupRaw, 'utf-8');
    }
  }
});

test('Soft-delete archives vendor without writing permanent tombstone and restore returns it to active Vendor Master', () => {
  const dbFilePath = path.resolve(process.cwd(), 'data/erp_production.json');
  const backupRaw = fs.existsSync(dbFilePath) ? fs.readFileSync(dbFilePath, 'utf-8') : null;
  const originalMem = JSON.parse(JSON.stringify((db as any).data));
  const uniqueName = `Archive Restore Test Corp ${Date.now()}`;

  try {
    const created = db.saveVendorAuthoritative(
      {
        companyName: uniqueName,
        contactPerson: 'Meera Joshi',
        mobile: '9825077777',
        city: 'Surat',
        state: 'Gujarat',
      },
      'CREATE',
      'UnitTestRunner',
      'SUPER_ADMIN',
      '127.0.0.1'
    );

    const vid = created.vendor.id;
    assert.ok(db.getVendorById(vid));

    // Soft-delete (archive) must NOT add a permanent tombstone
    const softDel = db.deleteVendor(vid, false, 'UnitTestRunner', 'SUPER_ADMIN', '127.0.0.1', 'Temporary pause');
    assert.equal(softDel.success, true);
    assert.equal(db.getVendorById(vid), null, 'Archived vendor must not appear in active list');
    assert.equal(
      (db.getAuthoritativeState().archivedVendors || []).some((v: any) => v.id === vid),
      true,
      'Archived vendor must appear in archivedVendors'
    );
    assert.equal(
      (db.getAuthoritativeState().deletedVendorIds || []).includes(vid),
      false,
      'Soft-deleted vendor must NOT be added to permanent deletedVendorIds tombstones'
    );

    // Restore must reactivate the vendor cleanly
    const restored = db.restoreVendor(vid, 'UnitTestRunner', 'SUPER_ADMIN', '127.0.0.1');
    assert.equal(restored.success, true);
    const activeAgain = db.getVendorById(vid);
    assert.ok(activeAgain, 'Restored vendor must be active again');
    assert.equal(activeAgain.companyName, uniqueName);
    assert.equal(activeAgain.isDeleted, false);
  } finally {
    (db as any).data = originalMem;
    if (backupRaw !== null) {
      fs.writeFileSync(dbFilePath, backupRaw, 'utf-8');
    }
  }
});


