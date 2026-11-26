import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeUserRole,
  isAdminRole,
  canManageProcurement,
  canApproveWorkflow,
  canHandleAccounts,
  getRoleDisplayLabel,
} from './roleUtils';

test('normalizeUserRole maps backend display labels and variants to canonical UserRole values', () => {
  assert.equal(normalizeUserRole('Admin'), 'SUPER_ADMIN');
  assert.equal(normalizeUserRole('Super Admin'), 'SUPER_ADMIN');
  assert.equal(normalizeUserRole('SUPER_ADMIN'), 'SUPER_ADMIN');
  assert.equal(normalizeUserRole('Purchase Manager'), 'PURCHASE_MANAGER');
  assert.equal(normalizeUserRole('PURCHASE_MANAGER'), 'PURCHASE_MANAGER');
  assert.equal(normalizeUserRole('Approval User'), 'APPROVAL_USER');
  assert.equal(normalizeUserRole('Accounts User'), 'ACCOUNTS_USER');
  assert.equal(normalizeUserRole('Procurement Specialist'), 'PROCUREMENT_EMPLOYEE');
  assert.equal(normalizeUserRole('Sales Executive'), 'SALES_EXECUTIVE');
  assert.equal(normalizeUserRole('Store User'), 'STORE_USER');
  assert.equal(normalizeUserRole('Management Viewer'), 'MANAGEMENT_VIEWER');
  assert.equal(normalizeUserRole(undefined, 'admin'), 'SUPER_ADMIN');
});

test('capability helpers grant Purchase Manager and Accounts User appropriate permissions', () => {
  assert.equal(isAdminRole('Admin'), true);
  assert.equal(isAdminRole('Purchase Manager'), false);

  assert.equal(canManageProcurement('Purchase Manager'), true);
  assert.equal(canManageProcurement('Procurement Specialist'), true);
  assert.equal(canManageProcurement('Accounts User'), false);

  assert.equal(canApproveWorkflow('Approval User'), true);
  assert.equal(canApproveWorkflow('Purchase Manager'), true);
  assert.equal(canApproveWorkflow('Accounts User'), false);

  assert.equal(canHandleAccounts('Accounts User'), true);
  assert.equal(canHandleAccounts('Admin'), true);
  assert.equal(canHandleAccounts('Purchase Manager'), false);

  assert.equal(getRoleDisplayLabel('Purchase Manager'), 'Purchase Manager');
  assert.equal(getRoleDisplayLabel('Accounts User'), 'Accounts & Finance');
});
