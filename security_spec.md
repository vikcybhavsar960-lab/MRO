# Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Default-Deny Baseline**: Every path under `/databases/{database}/documents` is denied by default (`match /{document=**} { allow read, write: if false; }`).
2. **Verified Email Requirement**: All authenticated reads and writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Master Gate & Workspace Isolation**: Every ERP record lives under `/workspaces/{workspaceId}/<collection>/{recordId}` and can only be read, created, updated, or deleted by an active verified member of that workspace (or the bootstrapped admin `vikcybhavsar960@gmail.com` / `vickybhavsar960@gmail.com`). Membership revocation immediately revokes access on single-document `get`, `create`, `update`, and `delete`.
4. **Zero Client-Delegated List Queries (No `get()`/`exists()` inside `allow list`)**: Every `allow list` rule enforces `resource.data` checks directly (`resource.data.ownerUid == request.auth.uid || request.auth.uid in resource.data.memberUids || request.auth.token.email in resource.data.invitedEmails || isBootstrappedAdmin()`), never `allow list: if isSignedIn();`.
5. **PII Isolation & Privilege Escalation Prevention**:
   - `/users/{userId}` only stores non-PII (`uid`, `displayName`, `role`, `createdAt`, `updatedAt`) and forbids self-assigned `ADMIN` or privileged roles.
   - `/users/{userId}/private/{infoId}` isolates PII (`email`, `mobile`) and restricts `read` strictly to `isOwner(userId) || isAdmin()`.
   - `/admins/{userId}` can only be written by the bootstrapped admin.
6. **Anti-Update-Gap & Strict Schema Validation**:
   - Every `create` validates exact required and allowed keys (`hasAll` + `hasOnly`), string `.size()` limits, list `.size()` limits, valid ID regex (`^[a-zA-Z0-9_\\-]+$`), and native `map` storage (no `JSON.stringify` blobs).
   - Every `update` begins with `isValid[Entity](incoming())`, verifies immutable fields (`id`, `workspaceId`, `ownerUid`, `createdAt`), enforces server timestamps (`createdAt == request.time` on create, `updatedAt == request.time` on update), and checks `incoming().diff(existing()).affectedKeys().hasOnly(...)`.
7. **Terminal State Locking**: Records reaching terminal states (`ORDER_CLOSED`, `CANCELLED`, `ACCEPTED`, `REJECTED`, `DELIVERED`) are locked against non-admin updates.
8. **Atomicity Guarantee**: A new invited teammate joining `/workspaces/{workspaceId}/members/{uid}` must atomically update `/workspaces/{workspaceId}` (`memberUids`) in the same batch (`getAfter` verification).

---

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Vector | Target Path | Malicious Payload / Operation | Expected Result |
|---|---------------|-------------|-------------------------------|-----------------|
| 1 | **Unauthenticated Read/Write** | `/workspaces/mro-default/vendors/VEND-007` | `auth = null`, `get` or `setDoc` | `PERMISSION_DENIED` |
| 2 | **Unverified Email Spoof** | `/workspaces/mro-default/vendors/VEND-900` | `auth = { uid: "u1", token: { email: "vikcybhavsar960@gmail.com", email_verified: false } }` | `PERMISSION_DENIED` |
| 3 | **Shadow / Ghost Field Injection** | `/workspaces/mro-default/vendors/VEND-901` | Valid vendor create + extra field `{ isVerifiedSuperVendor: true }` | `PERMISSION_DENIED` (blocked by `hasOnly`) |
| 4 | **ID Poisoning (1.5KB Junk ID)** | `/workspaces/mro-default/vendors/<1500 chars>` | `create` with oversized or invalid-char doc ID (`../bad!id`) | `PERMISSION_DENIED` (blocked by `isValidId`) |
| 5 | **Self-Assigned Admin Privilege Escalation** | `/admins/attacker_uid` | Non-admin user attempts `setDoc({ uid: "attacker_uid", email: "a@b.com", ... })` | `PERMISSION_DENIED` |
| 6 | **PII Blanket Read Breach** | `/users/victim_uid/private/info` | Signed-in user `other_uid` attempts `get` on `victim_uid` private PII | `PERMISSION_DENIED` |
| 7 | **Unrestricted List Query Scraping** | `/workspaces/mro-default/vendors` | Non-member signed-in user attempts unfiltered `list` query | `PERMISSION_DENIED` |
| 8 | **Owner / CreatedAt Immutable Field Tamper** | `/workspaces/mro-default/vendors/VEND-007` | `update` modifying `ownerUid` or `createdAt` | `PERMISSION_DENIED` |
| 9 | **Fake Client Timestamp Backdating** | `/workspaces/mro-default/requirements/REQ-2026-00999` | `create` with `createdAt: Timestamp(2020-01-01)` instead of `request.time` | `PERMISSION_DENIED` |
| 10 | **Value Poisoning on Update** | `/workspaces/mro-default/vendors/VEND-007` | `update` setting `companyName: 12345` or 500KB string | `PERMISSION_DENIED` (blocked by `isValidVendor`) |
| 11 | **Terminal State Mutation** | `/workspaces/mro-default/requirements/REQ-2026-00001` | Non-admin attempts `update` when `existing().status == 'ORDER_CLOSED'` | `PERMISSION_DENIED` |
| 12 | **Unbounded Array / JSON Blob Denial-of-Wallet** | `/workspaces/mro-default/vendors/VEND-902` | `create` with `memberUids` having 25 UIDs (`> 20`) or `recordData` as string | `PERMISSION_DENIED` |
