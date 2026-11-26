export interface RetryOptions {
  delaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_DELAYS_MS = [350, 900, 1800];

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function isTransientModuleLoadError(error: unknown): boolean {
  const msg = String((error as any)?.message || error || '').toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('load failed') ||
    msg.includes('networkerror') ||
    msg.includes('outdated optimize dep') ||
    msg.includes('504') ||
    msg.includes('502') ||
    msg.includes('503')
  );
}

/**
 * Retries transient Vite / network dynamic import failures without appending
 * cache-busting query strings (which would create duplicate React instances).
 */
export async function loadWithRetry<T>(
  loader: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const delays = options.delaysMs ?? DEFAULT_DELAYS_MS;
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await loader();
    } catch (err) {
      lastError = err;
      if (attempt >= delays.length || !isTransientModuleLoadError(err)) {
        throw err;
      }
      await sleep(delays[attempt]);
    }
  }
  throw lastError;
}
