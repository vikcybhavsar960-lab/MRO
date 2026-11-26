import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isStaticSpaFallbackResponse,
  isStaticSpaSessionToken,
  authenticateStaticSpaUser,
  restoreStaticSpaSession,
  buildJsonBackupBundle,
  parseJsonBackupBundle,
  resetStaticSpaModeCacheForTest,
} from './staticSpaRuntime';

function mockHeaders(contentType: string) {
  return {
    get(name: string) {
      return name.toLowerCase() === 'content-type' ? contentType : null;
    },
  };
}

test('isStaticSpaFallbackResponse detects Cloudflare Workers HTML SPA fallback and static 404/405', () => {
  // Cloudflare Workers `not_found_handling: "single-page-application"` returns 200 text/html for /api/*
  assert.equal(isStaticSpaFallbackResponse({ status: 200, headers: mockHeaders('text/html; charset=utf-8') }), true);
  // Static file server 404 text/plain or text/html
  assert.equal(isStaticSpaFallbackResponse({ status: 404, headers: mockHeaders('text/plain') }), true);
  assert.equal(isStaticSpaFallbackResponse({ status: 405, headers: mockHeaders('text/plain') }), true);
  assert.equal(isStaticSpaFallbackResponse({ status: 501, headers: mockHeaders('application/json') }), true);
});

test('isStaticSpaFallbackResponse NEVER treats live Express JSON errors as static SPA fallback', () => {
  assert.equal(isStaticSpaFallbackResponse({ status: 200, headers: mockHeaders('application/json') }), false);
  assert.equal(isStaticSpaFallbackResponse({ status: 400, headers: mockHeaders('application/json') }), false);
  assert.equal(isStaticSpaFallbackResponse({ status: 401, headers: mockHeaders('application/json') }), false);
  assert.equal(isStaticSpaFallbackResponse({ status: 403, headers: mockHeaders('application/json') }), false);
  assert.equal(isStaticSpaFallbackResponse({ status: 404, headers: mockHeaders('application/json') }), false);
  assert.equal(isStaticSpaFallbackResponse({ status: 409, headers: mockHeaders('application/json') }), false);
  assert.equal(isStaticSpaFallbackResponse({ status: 500, headers: mockHeaders('application/json') }), false);
});

test('authenticateStaticSpaUser validates credentials and restores static SPA sessions cleanly', () => {
  resetStaticSpaModeCacheForTest();
  const ok = authenticateStaticSpaUser('admin', 'Admin@123');
  assert.equal(ok.success, true);
  assert.equal(ok.user?.username, 'admin');
  assert.equal(ok.user?.role, 'SUPER_ADMIN');
  assert.equal(isStaticSpaSessionToken(ok.sessionId), true);

  const okEmail = authenticateStaticSpaUser('vickybhavsar960@gmail.com', 'Admin@123');
  assert.equal(okEmail.success, true);
  assert.equal(okEmail.user?.id, 'USR-001');

  const badPass = authenticateStaticSpaUser('admin', 'WrongPass');
  assert.equal(badPass.success, false);

  const restored = restoreStaticSpaSession(ok.sessionId || null, null);
  assert.equal(restored.authenticated, true);
  assert.equal(restored.user?.username, 'admin');

  const nonStatic = restoreStaticSpaSession('SES-123456', null);
  assert.equal(nonStatic.authenticated, false);
});

test('buildJsonBackupBundle and parseJsonBackupBundle round-trip ERP collections safely', () => {
  const bundle = buildJsonBackupBundle({
    vendors: [{ id: 'VEND-001', companyName: 'Apex Bearings' }],
    products: [{ id: 'PRD-001', itemName: 'SKF 6205' }],
    vendorPos: [{ id: 'VPO-001', totalAmount: 15000 }],
    unrelatedKey: ['should-be-ignored'],
  });

  assert.equal(bundle.app, 'MRO PROCUREMENT SOLUTION');
  assert.equal(bundle.collections.vendors.length, 1);
  assert.equal(bundle.collections.products.length, 1);
  assert.equal(bundle.collections.vendorPos.length, 1);
  assert.equal('unrelatedKey' in bundle.collections, false);

  const parsed = parseJsonBackupBundle(JSON.stringify(bundle));
  assert.equal(parsed.valid, true);
  assert.equal(parsed.recordCount, 3);
  assert.equal(parsed.collections?.vendors?.[0]?.companyName, 'Apex Bearings');

  const invalid = parseJsonBackupBundle('{bad json');
  assert.equal(invalid.valid, false);
  const emptyObj = parseJsonBackupBundle(JSON.stringify({ foo: 'bar' }));
  assert.equal(emptyObj.valid, false);
});
