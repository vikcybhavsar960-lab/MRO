import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const specPath = path.resolve(process.cwd(), 'security_spec.md');

const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));
const rulesText = fs.readFileSync(rulesPath, 'utf8');
const specText = fs.readFileSync(specPath, 'utf8');

describe('Firestore Security Rules & Blueprint Parity Verification', () => {
  it('enforces rules_version = 2 and global default-deny match /{document=**}', () => {
    assert.match(rulesText, /rules_version\s*=\s*'2';/);
    assert.match(rulesText, /match \/\{document=\*\*\}\s*\{\s*allow read, write:\s*if false;\s*\}/);
  });

  it('contains zero blanket open-read, open-write, or unguarded list rules', () => {
    assert.doesNotMatch(rulesText, /allow\s+(read|write|get|list)\s*:\s*if\s+true\s*;/);
    assert.doesNotMatch(rulesText, /allow\s+list\s*:\s*if\s+isSignedIn\(\)\s*;/);
    assert.doesNotMatch(rulesText, /allow\s+list\s*:\s*if\s+isEmailVerified\(\)\s*;/);
  });

  it('avoids get()/exists() calls inside allow list clauses (Pillar 8)', () => {
    const listLines = rulesText
      .split('\n')
      .filter((line) => /^\s*allow\s+list\s*:/.test(line));
    assert.ok(listLines.length >= 25, `Expected >= 25 allow list rules, found ${listLines.length}`);
    for (const line of listLines) {
      assert.doesNotMatch(line, /\b(get|exists|getAfter|existsAfter)\s*\(/, `Forbidden DB read in allow list: ${line}`);
    }
  });

  it('requires verified email and bootstrapped admin addresses (both vikcy & vicky spellings)', () => {
    assert.match(rulesText, /request\.auth\.token\.email_verified\s*==\s*true/);
    assert.match(rulesText, /vikcybhavsar960@gmail\.com/);
    assert.match(rulesText, /vickybhavsar960@gmail\.com/);
  });

  it('covers every Firestore collection declared in firebase-blueprint.json', () => {
    const blueprintPaths = Object.keys(blueprint.firestore || {});
    assert.ok(blueprintPaths.length >= 28, `Expected >= 28 blueprint paths, got ${blueprintPaths.length}`);

    for (const fullPath of blueprintPaths) {
      const segments = fullPath.split('/').filter(Boolean);
      const collectionSegment = segments.length >= 2 ? segments[segments.length - 2] : segments[0];
      assert.match(
        rulesText,
        new RegExp(`match\\s+/${collectionSegment}/\\{[^}]+\\}`),
        `Missing match rule for blueprint path ${fullPath}`
      );
    }
  });

  it('enforces anti-update-gap, immutable fields, request.time, and createdByUid identity integrity', () => {
    assert.match(rulesText, /incoming\(\)\.createdAt\s*==\s*request\.time/);
    assert.match(rulesText, /incoming\(\)\.updatedAt\s*==\s*request\.time/);
    assert.match(rulesText, /incoming\(\)\.createdByUid\s*==\s*request\.auth\.uid/);
    assert.match(rulesText, /incoming\(\)\.ownerUid\s*==\s*existing\(\)\.ownerUid/);
    assert.match(rulesText, /incoming\(\)\.createdByUid\s*==\s*existing\(\)\.createdByUid/);
    assert.match(rulesText, /incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasOnly\(/);
  });

  it('enforces terminal state locking on requirements, quotations, and deliveries', () => {
    assert.match(rulesText, /function\s+isNonTerminalEntityStatus\(\)/);
    assert.match(rulesText, /match\s+\/requirements\/\{requirementId\}[\s\S]*isNonTerminalEntityStatus\(\)/);
    assert.match(rulesText, /match\s+\/quotations\/\{quotationId\}[\s\S]*isNonTerminalEntityStatus\(\)/);
    assert.match(rulesText, /match\s+\/deliveries\/\{deliveryId\}[\s\S]*isNonTerminalEntityStatus\(\)/);
  });

  it('documents all 12 Dirty Dozen adversarial test vectors in security_spec.md', () => {
    for (let i = 1; i <= 12; i++) {
      assert.match(specText, new RegExp(`\\|\\s*${i}\\s*\\|`), `Missing Dirty Dozen case #${i} in security_spec.md`);
    }
  });
});
