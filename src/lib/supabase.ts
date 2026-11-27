import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const CANONICAL_PRODUCTION_SUPABASE_URL = 'https://plvjsiehhpdoyvzgahpr.supabase.co';

declare global {
  interface Window {
    __MRO_SUPABASE_CONFIG__?: {
      url?: string;
      publishableKey?: string;
    };
  }
}

export function resolveSupabaseUrl(envUrl?: string, runtimeUrl?: string): string {
  const candidate = String(runtimeUrl || envUrl || CANONICAL_PRODUCTION_SUPABASE_URL)
    .trim()
    .replace(/\/$/, '');

  // Never accidentally point production frontend at localhost or non-HTTPS URLs
  if (
    !candidate ||
    /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(candidate) ||
    !candidate.startsWith('https://')
  ) {
    return CANONICAL_PRODUCTION_SUPABASE_URL;
  }

  return candidate;
}

/**
 * Safety guardrail: ensures a Supabase service_role JWT can never be initialized in frontend browser code.
 */
export function isUnsafeServiceRoleJwt(key: string): boolean {
  const clean = String(key || '').trim();
  if (!clean) return false;
  if (clean.startsWith('sb_secret_')) return true;
  const parts = clean.split('.');
  if (parts.length !== 3) return false;
  try {
    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4);
    const decoded =
      typeof Buffer !== 'undefined'
        ? Buffer.from(padded, 'base64').toString('utf-8')
        : atob(padded);
    const parsed = JSON.parse(decoded);
    return parsed?.role === 'service_role';
  } catch {
    return false;
  }
}

const runtimeCfg =
  typeof window !== 'undefined' ? window.__MRO_SUPABASE_CONFIG__ : undefined;

export const SUPABASE_PROJECT_URL = resolveSupabaseUrl(
  (import.meta as any)?.env?.VITE_SUPABASE_URL,
  runtimeCfg?.url
);

const RAW_CLIENT_KEY = String(
  runtimeCfg?.publishableKey ||
    (import.meta as any)?.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
    (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY ||
    ''
).trim();

const KEY_REJECTED_AS_SECRET = isUnsafeServiceRoleJwt(RAW_CLIENT_KEY);
const PUBLISHABLE_KEY = KEY_REJECTED_AS_SECRET ? '' : RAW_CLIENT_KEY;

let centralClient: SupabaseClient | null = null;

if (SUPABASE_PROJECT_URL && PUBLISHABLE_KEY) {
  centralClient = createClient(SUPABASE_PROJECT_URL, PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'mro_erp_supabase_auth',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    global: {
      headers: {
        'x-application-name': 'mro-procurement-solution',
      },
    },
  });
}

export const supabase: SupabaseClient | null = centralClient;

export interface SupabaseClientConfigStatus {
  configured: boolean;
  url: string;
  hasPublishableKey: boolean;
  keyRejectedAsSecret?: boolean;
  missingVars: string[];
}

export function getSupabaseConfigStatus(): SupabaseClientConfigStatus {
  const missingVars: string[] = [];
  if (!SUPABASE_PROJECT_URL) missingVars.push('VITE_SUPABASE_URL');
  if (!PUBLISHABLE_KEY) missingVars.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  return {
    configured: Boolean(centralClient),
    url: SUPABASE_PROJECT_URL,
    hasPublishableKey: Boolean(PUBLISHABLE_KEY),
    keyRejectedAsSecret: KEY_REJECTED_AS_SECRET,
    missingVars,
  };
}

export function requireSupabase(): SupabaseClient {
  if (!centralClient) {
    throw new Error(
      KEY_REJECTED_AS_SECRET
        ? 'Blocked unsafe secret key in frontend config. Use VITE_SUPABASE_PUBLISHABLE_KEY (publishable/anon key) only.'
        : 'Supabase client is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY as Build Variables and redeploy.'
    );
  }
  return centralClient;
}
