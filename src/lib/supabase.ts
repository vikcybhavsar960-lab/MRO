import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_PROJECT_URL = (
  (import.meta as any)?.env?.VITE_SUPABASE_URL ||
  'https://plvjsiehhpdoyvzgahpr.supabase.co'
)
  .trim()
  .replace(/\/$/, '');

const PUBLISHABLE_KEY = String(
  (import.meta as any)?.env?.VITE_SUPABASE_PUBLISHABLE_KEY || ''
).trim();

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
    missingVars,
  };
}

export function requireSupabase(): SupabaseClient {
  if (!centralClient) {
    throw new Error(
      'Supabase client is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your environment.'
    );
  }
  return centralClient;
}
