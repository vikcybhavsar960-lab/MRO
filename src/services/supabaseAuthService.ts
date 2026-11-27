import { supabase, getSupabaseConfigStatus } from '../lib/supabase';
import { fetchApi, clearAuthSession, getCurrentSessionId } from '../utils/apiClient';
import { normalizeUserRole } from '../utils/roleUtils';
import {
  STATIC_SPA_ACCOUNTS,
  authenticateStaticSpaUser,
  isStaticSpaFallbackResponse,
  isStaticSpaMode,
  isStaticSpaSessionToken,
  markStaticSpaMode,
  restoreStaticSpaSession,
} from '../utils/staticSpaRuntime';
import { fetchAuthenticatedSupabaseUserProfile } from './supabaseClientDataService';
import { User } from '../types';

export interface AuthenticatedSessionResult {
  authenticated: boolean;
  user: User | null;
  sessionId?: string;
  mustChangePassword?: boolean;
  authProvider: 'supabase' | 'erp-session' | 'static-spa' | 'none';
  error?: string;
}

function mapRawUserToErpUser(raw: any): User {
  return {
    id: raw.id,
    name: raw.name,
    username: raw.username,
    email: raw.email,
    role: normalizeUserRole(raw.role, raw.username, raw.email),
    department: raw.department || 'Procurement',
    mobile: raw.mobile || '',
    status: raw.status || 'ACTIVE',
    mustChangePassword: Boolean(raw.mustChangePassword ?? raw.must_change_password),
    permissions: raw.permissions,
    approvalLimit: raw.approvalAuthority?.maxApprovalLimit ?? raw.approval_limit ?? 0,
  };
}

function persistLocalSessionState(user: User, sessionToken?: string) {
  if (typeof window === 'undefined') return;
  try {
    if (sessionToken) {
      sessionStorage.setItem('mro_current_session_id', sessionToken);
      localStorage.setItem('mro_current_session_id', sessionToken);
    }
    localStorage.setItem('procure_user', JSON.stringify(user));
    localStorage.removeItem('mro_is_logged_out');
    window.dispatchEvent(new CustomEvent('mro_session_ready'));
  } catch {}
}

function resolveEmailCandidatesForSupabaseLogin(usernameOrEmail: string): string[] {
  const clean = usernameOrEmail.trim().toLowerCase();
  if (!clean) return [];
  if (clean.includes('@')) {
    if (clean === 'vickybhavsar960@gmail.com') return [clean, 'vikcybhavsar960@gmail.com'];
    if (clean === 'vikcybhavsar960@gmail.com') return [clean, 'vickybhavsar960@gmail.com'];
    return [clean];
  }
  const matched = STATIC_SPA_ACCOUNTS.find((a) => a.username.toLowerCase() === clean);
  if (matched) {
    const base = matched.email.toLowerCase();
    if (base === 'vickybhavsar960@gmail.com') return [base, 'vikcybhavsar960@gmail.com'];
    return [base];
  }
  return [];
}

/**
 * Authenticates via Username or Email + Password.
 * 1. On full-stack Express deployments: calls /api/auth/login and hydrates Supabase JWT session.
 * 2. On Cloudflare Workers static SPA (*.workers.dev): authenticates directly against
 *    Supabase Auth (`supabase.auth.signInWithPassword`) and loads `public.user_profiles`
 *    under RLS whenever `VITE_SUPABASE_PUBLISHABLE_KEY` is present in the build.
 * 3. Falls back to offline static SPA accounts only if Supabase publishable key is not configured.
 */
export async function loginWithErpAndSupabase(
  usernameOrEmail: string,
  password: string
): Promise<{
  success: boolean;
  user?: User;
  sessionId?: string;
  mustChangePassword?: boolean;
  error?: string;
}> {
  if (!isStaticSpaMode()) {
    const res = await fetchApi('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: usernameOrEmail.trim(),
        password: password.trim(),
      }),
      timeoutMs: 12000,
    });

    if (!isStaticSpaFallbackResponse(res)) {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Invalid username or password',
        };
      }

      markStaticSpaMode(false);

      // Hydrate frontend Supabase client session if server issued Supabase JWT tokens
      if (supabase && data.supabaseSession?.access_token && data.supabaseSession?.refresh_token) {
        try {
          await supabase.auth.setSession({
            access_token: data.supabaseSession.access_token,
            refresh_token: data.supabaseSession.refresh_token,
          });
        } catch (e) {
          console.warn('[Supabase Auth] setSession warning:', e);
        }
      }

      const user = mapRawUserToErpUser(data.user);
      const sessionToken = data.supabaseSession?.access_token || data.sessionId;
      persistLocalSessionState(user, sessionToken);

      return {
        success: true,
        user,
        sessionId: sessionToken,
        mustChangePassword: Boolean(data.mustChangePassword),
      };
    }

    markStaticSpaMode(true);
  }

  // Static SPA / Cloudflare Workers Mode:
  // Authenticate directly with Supabase Auth whenever the production publishable key is configured!
  if (supabase && getSupabaseConfigStatus().configured) {
    const emailCandidates = resolveEmailCandidatesForSupabaseLogin(usernameOrEmail);
    let lastAuthError = '';

    for (const candidateEmail of emailCandidates) {
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: candidateEmail,
        password: password.trim(),
      });
      if (!signInErr && signInData?.session?.access_token) {
        const profileRes = await fetchAuthenticatedSupabaseUserProfile();
        if (profileRes.authenticated && profileRes.user) {
          persistLocalSessionState(profileRes.user, signInData.session.access_token);
          return {
            success: true,
            user: profileRes.user,
            sessionId: signInData.session.access_token,
            mustChangePassword: Boolean(profileRes.user.mustChangePassword),
          };
        }
        lastAuthError = profileRes.error || 'Authenticated with Supabase, but user_profiles record could not be loaded.';
        break;
      }
      lastAuthError = signInErr?.message || 'Invalid credentials';
    }

    // If user entered a real Supabase email and Supabase rejected credentials, return the real Supabase Auth error
    if (usernameOrEmail.includes('@') || lastAuthError.toLowerCase().includes('invalid')) {
      return {
        success: false,
        error: lastAuthError || 'Invalid email or password (Supabase Auth).',
      };
    }
  }

  // Offline / Unconfigured Build Fallback (only when VITE_SUPABASE_PUBLISHABLE_KEY is not injected at build time)
  const staticAuth = authenticateStaticSpaUser(usernameOrEmail, password);
  if (!staticAuth.success || !staticAuth.user || !staticAuth.sessionId) {
    return {
      success: false,
      error: staticAuth.error || 'Invalid username or password',
    };
  }

  persistLocalSessionState(staticAuth.user, staticAuth.sessionId);
  return {
    success: true,
    user: staticAuth.user,
    sessionId: staticAuth.sessionId,
    mustChangePassword: false,
  };
}

/**
 * Validates the current active session on app load or browser refresh.
 * Never bypasses authentication if no valid session exists.
 */
export async function restoreVerifiedSession(): Promise<AuthenticatedSessionResult> {
  if (typeof window === 'undefined') {
    return { authenticated: false, user: null, authProvider: 'none' };
  }

  const isExplicitlyLoggedOut = localStorage.getItem('mro_is_logged_out') === 'true';
  if (isExplicitlyLoggedOut) {
    return { authenticated: false, user: null, authProvider: 'none' };
  }

  let bearerToken: string | null = getCurrentSessionId();
  let authProvider: 'supabase' | 'erp-session' | 'static-spa' | 'none' = 'none';

  // 1. Check live Supabase Auth session first whenever configured
  if (supabase && getSupabaseConfigStatus().configured) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        bearerToken = data.session.access_token;
        authProvider = 'supabase';
        sessionStorage.setItem('mro_current_session_id', bearerToken);
        localStorage.setItem('mro_current_session_id', bearerToken);
      }
    } catch {}
  }

  // Fast-path restore for offline static SPA sessions (when no Supabase Auth JWT exists)
  if (authProvider !== 'supabase' && isStaticSpaSessionToken(bearerToken)) {
    markStaticSpaMode(true);
    const restored = restoreStaticSpaSession(bearerToken, localStorage.getItem('procure_user'));
    if (restored.authenticated && restored.user) {
      return {
        authenticated: true,
        user: restored.user,
        sessionId: bearerToken || undefined,
        mustChangePassword: false,
        authProvider: 'static-spa',
      };
    }
    clearAuthSession();
    return { authenticated: false, user: null, authProvider: 'none' };
  }

  if (!bearerToken) {
    return { authenticated: false, user: null, authProvider: 'none' };
  }

  try {
    const res = await fetchApi(`/api/auth/verify-session?sessionId=${encodeURIComponent(bearerToken)}`, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'x-session-id': bearerToken,
      },
      timeoutMs: 8000,
    });

    if (isStaticSpaFallbackResponse(res)) {
      markStaticSpaMode(true);

      // In Cloudflare Workers SPA mode with active Supabase Auth, verify against live Supabase + user_profiles!
      if (supabase && getSupabaseConfigStatus().configured) {
        const profileRes = await fetchAuthenticatedSupabaseUserProfile();
        if (profileRes.authenticated && profileRes.user && profileRes.accessToken) {
          persistLocalSessionState(profileRes.user, profileRes.accessToken);
          return {
            authenticated: true,
            user: profileRes.user,
            sessionId: profileRes.accessToken,
            mustChangePassword: Boolean(profileRes.user.mustChangePassword),
            authProvider: 'supabase',
          };
        }
        clearAuthSession();
        return {
          authenticated: false,
          user: null,
          authProvider: 'none',
          error: profileRes.error || 'Supabase session expired. Please sign in again.',
        };
      }

      const storedRaw = localStorage.getItem('procure_user');
      if (storedRaw) {
        try {
          const parsed = JSON.parse(storedRaw);
          if (parsed && parsed.id && parsed.username) {
            return {
              authenticated: true,
              user: mapRawUserToErpUser(parsed),
              sessionId: bearerToken,
              mustChangePassword: false,
              authProvider: 'static-spa',
            };
          }
        } catch {}
      }
      clearAuthSession();
      return { authenticated: false, user: null, authProvider: 'none' };
    }

    const data = await res.json().catch(() => ({}));

    if (res.ok && data?.valid && data?.user) {
      markStaticSpaMode(false);
      const user = mapRawUserToErpUser(data.user);
      try {
        localStorage.setItem('procure_user', JSON.stringify(user));
      } catch {}
      return {
        authenticated: true,
        user,
        sessionId: bearerToken,
        mustChangePassword: Boolean(data.user.mustChangePassword),
        authProvider: data.authProvider === 'supabase' || authProvider === 'supabase' ? 'supabase' : 'erp-session',
      };
    }

    // Invalid or expired session: clear stale tokens and force Login
    clearAuthSession();
    return {
      authenticated: false,
      user: null,
      authProvider: 'none',
      error: data?.error || 'Session expired or invalid',
    };
  } catch (err: any) {
    return {
      authenticated: false,
      user: null,
      authProvider: 'none',
      error: err?.message || 'Unable to verify session',
    };
  }
}

export async function logoutComplete(user?: User | null): Promise<void> {
  const sessionId = getCurrentSessionId();
  try {
    if (sessionId) {
      await fetchApi('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          username: user?.username || user?.name,
          role: user?.role,
          userId: user?.id,
        }),
        timeoutMs: 4000,
      });
    }
  } catch {}

  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {}
  }

  clearAuthSession();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mro_session_logged_out'));
  }
}
