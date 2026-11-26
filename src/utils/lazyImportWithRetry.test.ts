import test from 'node:test';
import assert from 'node:assert/strict';
import { isTransientModuleLoadError, loadWithRetry } from './lazyImportWithRetry';

test('isTransientModuleLoadError identifies dynamic module fetch and optimize-dep errors', () => {
  assert.equal(
    isTransientModuleLoadError(
      new TypeError('Failed to fetch dynamically imported module: https://example.com/ErpAuthenticatedShell.tsx')
    ),
    true
  );
  assert.equal(
    isTransientModuleLoadError(new Error('504 (Outdated Optimize Dep)')),
    true
  );
  assert.equal(
    isTransientModuleLoadError(new SyntaxError('Unexpected token <')),
    false
  );
});

test('loadWithRetry retries transient dynamic import errors and succeeds when server recovers', async () => {
  let calls = 0;
  const slept: number[] = [];

  const result = await loadWithRetry(
    async () => {
      calls += 1;
      if (calls < 3) {
        throw new TypeError('Failed to fetch dynamically imported module: /src/components/ErpAuthenticatedShell.tsx');
      }
      return { ok: true };
    },
    {
      delaysMs: [10, 20, 30],
      sleep: async (ms) => {
        slept.push(ms);
      },
    }
  );

  assert.deepEqual(result, { ok: true });
  assert.equal(calls, 3);
  assert.deepEqual(slept, [10, 20]);
});

test('loadWithRetry does not retry non-transient errors and throws after max attempts for persistent failures', async () => {
  let nonTransientCalls = 0;
  await assert.rejects(
    loadWithRetry(
      async () => {
        nonTransientCalls += 1;
        throw new ReferenceError('Broken symbol');
      },
      { delaysMs: [10, 20], sleep: async () => {} }
    ),
    /Broken symbol/
  );
  assert.equal(nonTransientCalls, 1);

  let persistentCalls = 0;
  await assert.rejects(
    loadWithRetry(
      async () => {
        persistentCalls += 1;
        throw new TypeError('Failed to fetch dynamically imported module: /x.tsx');
      },
      { delaysMs: [5, 10], sleep: async () => {} }
    ),
    /Failed to fetch dynamically imported module/
  );
  assert.equal(persistentCalls, 3);
});
