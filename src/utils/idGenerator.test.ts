import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCollisionSafeSeqId, generateCollisionSafeYearlyId } from './idGenerator';

test('generateCollisionSafeSeqId prevents collisions between concurrent users starting from identical state', () => {
  const existing = [{ id: 'CUST-004' }, { id: 'CUST-009-T1A' }];
  const tombstones = ['CUST-010-T9B'];

  const user1Id = generateCollisionSafeSeqId('CUST', existing, tombstones, 'T1A');
  const user2Id = generateCollisionSafeSeqId('CUST', existing, tombstones, 'T2B');
  const user3Id = generateCollisionSafeSeqId('CUST', existing, tombstones, 'T3C');

  assert.equal(user1Id, 'CUST-011-T1A');
  assert.equal(user2Id, 'CUST-011-T2B');
  assert.equal(user3Id, 'CUST-011-T3C');
  assert.equal(new Set([user1Id, user2Id, user3Id]).size, 3);
});

test('generateCollisionSafeYearlyId monotonically increments past tagged and untagged IDs without collision', () => {
  const existing = [
    { id: 'REQ-2026-00012', rfqNumber: 'REQ-2026-00012' },
    { id: 'REQ-2026-00015-T8Z', rfqNumber: 'REQ-2026-00015-T8Z' },
  ];
  const tombstones = ['REQ-2026-00016-T1Q'];

  const idA = generateCollisionSafeYearlyId('REQ', 2026, existing, tombstones, 'TA1');
  const idB = generateCollisionSafeYearlyId('REQ', 2026, existing, tombstones, 'TB2');

  assert.equal(idA, 'REQ-2026-00017-TA1');
  assert.equal(idB, 'REQ-2026-00017-TB2');
  assert.notEqual(idA, idB);
});
