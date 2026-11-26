import { supabase, getSupabaseConfigStatus } from '../lib/supabase';
import { fetchApi, clearAuthSession, getCurrentSessionId } from '../utils/apiClient';
import { normalizeUserRole } from '../utils/roleUtils';
import {
  authenticateStaticSpaUser,
  isStaticSpaFallbackResponse,
  isStaticSpaMode,
  isStaticSpaSessionToken,
  markStaticSpaMode,
  restoreStaticSpaSession,
} from '../utils/staticSpaRuntime';
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

/**
 * Authenticates via Username or Email + Password.
 * Bridges legacy PBKDF2 accounts safely into Supabase Auth on login and establishes
 * both the Supabase JWT session and ERP session state.
 * When hosted as a pure static SPA (e.g. Cloudflare Workers *.workers.dev with no Express API),
 * seamlessly authenticates via client-side static SPA mode.
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

  // Static SPA Mode (Cloudflare Workers / Cloudflare Pages / static ./dist preview)
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

  // Fast-path restore for existing static SPA sessions (Cloudflare Workers ./dist mode)
  if (isStaticSpaSessionToken(bearerToken)) {
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

  // 1. Check live Supabase Auth session first when configured
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
