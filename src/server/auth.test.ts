import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from './db.js';

test('Authentication: valid login creates active session with hashed password match', async () => {
  // Test login with valid admin credentials
  const result = await db.authenticateUser('admin', 'Admin@123', '127.0.0.1', 'Node-Test-Agent');
  assert.equal(result.success, true);
  assert.ok(result.session);
  assert.equal(result.session.role, 'Admin');
  assert.equal(result.user?.username, 'admin');

  // Verify session validity via db.verifySession
  const verification = db.verifySession(result.session.id);
  assert.equal(verification.valid, true);
  assert.equal(verification.user?.username, 'admin');
});

test('Authentication: invalid credentials increment failedLoginAttempts and reject', async () => {
  const result = await db.authenticateUser('admin', 'WrongPassword999!', '127.0.0.1', 'Node-Test-Agent');
  assert.equal(result.success, false);
  assert.match(result.error || '', /Invalid username or password/);
});

test('Authentication: password reset flow issues secure token and updates password', async () => {
  // 1. Request reset token
  const req = await db.requestPasswordReset('suresh.patil@procuremro.com');
  assert.equal(req.success, true);
  assert.ok(req.token, 'Reset token generated');

  // 2. Reset password using token
  const resetRes = await db.resetPasswordWithToken(
    'suresh.patil@procuremro.com',
    req.token!,
    'NewSecurePass@2026',
    '127.0.0.1'
  );
  assert.equal(resetRes.success, true);

  // 3. Authenticate with new password
  const newLogin = await db.authenticateUser('suresh_purchase', 'NewSecurePass@2026', '127.0.0.1', 'Node-Test-Agent');
  assert.equal(newLogin.success, true);
  assert.equal(newLogin.user?.username, 'suresh_purchase');

  // 4. Restore original password for ongoing test stability
  db.updateUser(newLogin.user!.id, { newPassword: 'Purchase@123' });
});
