import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_PRODUCTION_SUPABASE_URL,
  isUnsafeServiceRoleJwt,
  resolveSupabaseUrl,
} from '../lib/supabase';
import {
  mapSupabaseRowToPayload,
  mapSupabaseUserProfileToErpUser,
} from './supabaseClientDataService';

describe('supabase production configuration & client mapping', () => {
  it('enforces the canonical production Supabase URL and rejects localhost / non-HTTPS URLs', () => {
    assert.equal(resolveSupabaseUrl(undefined, undefined), CANONICAL_PRODUCTION_SUPABASE_URL);
    assert.equal(resolveSupabaseUrl('http://localhost:54321'), CANONICAL_PRODUCTION_SUPABASE_URL);
    assert.equal(resolveSupabaseUrl('http://127.0.0.1:54321'), CANONICAL_PRODUCTION_SUPABASE_URL);
    assert.equal(resolveSupabaseUrl('http://plvjsiehhpdoyvzgahpr.supabase.co'), CANONICAL_PRODUCTION_SUPABASE_URL);
    assert.equal(
      resolveSupabaseUrl('https://plvjsiehhpdoyvzgahpr.supabase.co/'),
      'https://plvjsiehhpdoyvzgahpr.supabase.co'
    );
  });

  it('blocks service_role and sb_secret_ keys from being used in frontend browser builds', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const servicePayload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
    const anonPayload = Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url');

    assert.equal(isUnsafeServiceRoleJwt('sb_secret_live_1234567890'), true);
    assert.equal(isUnsafeServiceRoleJwt(`${header}.${servicePayload}.sig`), true);
    assert.equal(isUnsafeServiceRoleJwt(`${header}.${anonPayload}.sig`), false);
    assert.equal(isUnsafeServiceRoleJwt('sb_publishable_1234567890'), false);
    assert.equal(isUnsafeServiceRoleJwt(''), false);
  });

  it('maps Supabase JSON payload rows and user_profiles cleanly into ERP records', () => {
    const mapped = mapSupabaseRowToPayload<{ id: string; companyName: string; city: string }>(
      {
        id: 'VEND-012',
        payload: { id: 'VEND-012', companyName: 'Test Electricals', city: 'Vadodara' },
      },
      { companyName: 'Test Electricals' }
    );
    assert.equal(mapped.id, 'VEND-012');
    assert.equal(mapped.companyName, 'Test Electricals');
    assert.equal(mapped.city, 'Vadodara');

    const user = mapSupabaseUserProfileToErpUser({
      id: 'USR-001',
      name: 'Vicky Bhavsar',
      username: 'admin',
      email: 'vickybhavsar960@gmail.com',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      must_change_password: false,
      approval_limit: 500000,
    });
    assert.equal(user.role, 'SUPER_ADMIN');
    assert.equal(user.username, 'admin');
    assert.equal(user.approvalLimit, 500000);
  });
});
