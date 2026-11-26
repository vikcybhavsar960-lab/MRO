import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEntityDocPayload,
  buildTombstoneDocPayload,
  buildVendorDocPayload,
  computeMissingSeedItems,
  extractEntityRecord,
  isBootstrappedAdminEmail,
  mergeCollectionWithTombstones,
  sanitizeDocId,
  stripUndefinedDeep,
  WorkspaceWriteContext,
} from './firebasePayloadHelpers';

const baseCtx: WorkspaceWriteContext = {
  workspaceId: 'mro-default',
  ownerUid: 'admin-uid-1',
  createdByUid: 'user-uid-2',
  memberUids: ['admin-uid-1', 'user-uid-2'],
  invitedEmails: ['vikcybhavsar960@gmail.com', 'teammate2@gmail.com'],
};

describe('Firebase Payload Helpers & Sync Merge Logic', () => {
  it('recognizes both bootstrapped admin email spellings case-insensitively', () => {
    assert.equal(isBootstrappedAdminEmail('vikcybhavsar960@gmail.com'), true);
    assert.equal(isBootstrappedAdminEmail('VICKYBHAVSAR960@GMAIL.COM'), true);
    assert.equal(isBootstrappedAdminEmail('teammate2@gmail.com'), false);
    assert.equal(isBootstrappedAdminEmail(null), false);
  });

  it('sanitizes arbitrary IDs to match ^[a-zA-Z0-9_-]+$ and length <= 128', () => {
    assert.equal(sanitizeDocId('VEND-007'), 'VEND-007');
    assert.equal(sanitizeDocId('../bad!id with spaces'), '___bad_id_with_spaces');
    assert.ok(sanitizeDocId('A'.repeat(300)).length <= 128);
  });

  it('strips undefined, functions, and non-finite numbers recursively while preserving native objects', () => {
    const cleaned = stripUndefinedDeep({
      id: 'VEND-008',
      rating: NaN,
      notes: undefined,
      nested: [{ a: 1, b: undefined }],
    });
    assert.deepEqual(cleaned, {
      id: 'VEND-008',
      rating: 0,
      nested: [{ a: 1 }],
    });
  });

  it('builds blueprint-compliant ErpVendor payload with strict schema keys and createdByUid', () => {
    const payload = buildVendorDocPayload(
      {
        id: 'VEND-008',
        companyName: 'Apex Industrial Spares',
        gstin: '24AAAAA0000A1Z5',
        status: 'ACTIVE',
        extraUndefined: undefined,
      },
      baseCtx
    );
    assert.equal(payload.id, 'VEND-008');
    assert.equal(payload.workspaceId, 'mro-default');
    assert.equal(payload.ownerUid, 'admin-uid-1');
    assert.equal(payload.createdByUid, 'user-uid-2');
    assert.equal(payload.isDeleted, false);
    assert.equal(payload.status, 'ACTIVE');
    assert.equal('extraUndefined' in payload.recordData, false);
    assert.equal(payload.recordData.companyName, 'Apex Industrial Spares');
  });

  it('builds blueprint-compliant ErpEntityRecord and extracts it cleanly back', () => {
    const payload = buildEntityDocPayload(
      {
        id: 'REQ-2026-00001',
        customerName: 'Hyfun Agrilink',
        status: 'PENDING_VENDOR_RATES',
      },
      baseCtx
    );
    assert.equal(payload.title, 'Hyfun Agrilink');
    assert.equal(payload.status, 'PENDING_VENDOR_RATES');
    const extracted = extractEntityRecord<any>(payload);
    assert.equal(extracted.id, 'REQ-2026-00001');
    assert.equal(extracted.customerName, 'Hyfun Agrilink');
  });

  it('caps tombstone deletedIds to 500 unique strings and merges deletions deterministically', () => {
    const tomb = buildTombstoneDocPayload(
      'vendors',
      Array.from({ length: 550 }, (_, i) => `VEND-${i}`),
      baseCtx
    );
    assert.equal(tomb.deletedIds.length, 500);

    const merged = mergeCollectionWithTombstones(
      [
        { id: 'VEND-007', isDeleted: false },
        { id: 'VEND-009', isDeleted: false },
      ],
      [
        { id: 'VEND-007', isDeleted: false },
        { id: 'VEND-008', isDeleted: false },
        { id: 'VEND-010', isDeleted: false },
      ],
      ['VEND-009', 'VEND-010']
    );
    assert.deepEqual(
      merged.map((v) => v.id),
      ['VEND-007', 'VEND-008']
    );
  });

  it('computes only missing non-deleted items for initial cloud seed without overwriting cloud docs', () => {
    const toSeed = computeMissingSeedItems(
      [{ id: 'VEND-007' }, { id: 'VEND-008' }, { id: 'VEND-009' }],
      new Set(['VEND-007']),
      ['VEND-009']
    );
    assert.deepEqual(toSeed, [{ id: 'VEND-008' }]);
  });
});
