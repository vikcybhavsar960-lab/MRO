import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Building2, RefreshCw } from 'lucide-react';
import { LoginPage } from './components/auth/LoginPage';
import { clearAuthSession } from './utils/apiClient';
import { loadWithRetry } from './utils/lazyImportWithRetry';
import { logoutComplete, restoreVerifiedSession } from './services/supabaseAuthService';
import { User } from './types';

// Lazy-load the entire authenticated ERP shell with automatic transient retry so Login
// renders immediately while protecting against Vite dev-server / proxy hiccups.
const ErpAuthenticatedShell = lazy(() =>
  loadWithRetry(() => import('./components/ErpAuthenticatedShell')).then((m) => ({
    default: m.ErpAuthenticatedShell,
  }))
);

const PROTECTED_TABS = new Set([
  'dashboard',
  'requirements',
  'rfq-management',
  'rfqs',
  'vendor-rates',
  'rate-comparison',
  'quotations',
  'customer-pos',
  'vendor-pos',
  'pi',
  'proforma-invoices',
  'payments',
  'dispatch',
  'dispatches',
  'delivery',
  'deliveries',
  'companies',
  'purchase-executives',
  'customers',
  'vendors',
  'brands',
  'brand-catalogue',
  'categories',
  'products',
  'reports',
  'company-reports',
  'documents',
  'audit-log',
  'backup-recovery',
  'sales-billing',
  'purchase-bills',
  'accounting',
  'email-rfq',
  'inventory',
  'users',
  'approvals',
  'branding-settings',
  'theme-settings',
]);

function resolveInitialRoute(): { requestedTab: string; isLoginPath: boolean } {
  if (typeof window === 'undefined') {
    return { requestedTab: 'dashboard', isLoginPath: true };
  }
  const rawSegment = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (!rawSegment || rawSegment === 'login') {
    return { requestedTab: 'dashboard', isLoginPath: rawSegment === 'login' };
  }
  if (rawSegment === 'approvals') {
    return { requestedTab: 'dashboard', isLoginPath: false };
  }
  if (rawSegment === 'rfq-management' || rawSegment === 'rfqs') {
    return { requestedTab: 'vendor-rates', isLoginPath: false };
  }
  if (PROTECTED_TABS.has(rawSegment)) {
    return { requestedTab: rawSegment, isLoginPath: false };
  }
  return { requestedTab: 'dashboard', isLoginPath: false };
}

function recordCheckpoint(name: string) {
  if (typeof window !== 'undefined') {
    const boot = (window as any).__MRO_BOOT__;
    if (boot && boot.checkpoints && boot.checkpoints[name] === undefined) {
      boot.checkpoints[name] = Math.round(performance.now() - (boot.t0 || 0));
    }
  }
}

export default function App() {
  const initialRouteRef = useRef(resolveInitialRoute());
  const [intendedTab, setIntendedTab] = useState<string>(initialRouteRef.current.requestedTab || 'dashboard');
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authenticatedUser, setAuthenticatedUser] = useState<User | null>(null);
  const [initialMustChangePassword, setInitialMustChangePassword] = useState<boolean>(false);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<boolean>(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const startupLoggedRef = useRef(false);

  // One-time startup sequence checkpoints
  useEffect(() => {
    if (startupLoggedRef.current) return;
    startupLoggedRef.current = true;

    console.info('[STARTUP] React initialized');
    recordCheckpoint('react');

    try {
      void localStorage.getItem('erp_branding_config');
    } catch {}
    console.info('[STARTUP] Configuration loaded');
    recordCheckpoint('config');
    console.info('[STARTUP] Router initialized');
    recordCheckpoint('router');

    const clearTimer = window.setTimeout(() => {
      try {
        sessionStorage.removeItem('mro_vite_chunk_reload_at');
      } catch {}
    }, 8000);

    const prefetchTimer = window.setTimeout(() => {
      void loadWithRetry(() => import('./components/ErpAuthenticatedShell')).catch(() => undefined);
    }, 1200);

    return () => {
      window.clearTimeout(clearTimer);
      window.clearTimeout(prefetchTimer);
    };
  }, []);

  const verifyEnterpriseSession = useCallback(async () => {
    console.info('[STARTUP] Authentication initialized');
    recordCheckpoint('auth');
    setIsCheckingAuth(true);
    setStartupError(null);

    try {
      const result = await restoreVerifiedSession();
      console.info('[STARTUP] API & Auth verification completed');
      recordCheckpoint('api');

      if (result.authenticated && result.user) {
        setAuthenticatedUser(result.user);
        setInitialMustChangePassword(Boolean(result.mustChangePassword));
        setIsAuthenticated(true);
        setSessionExpiredNotice(false);
        if (typeof window !== 'undefined') {
          const targetTab = initialRouteRef.current.requestedTab || 'dashboard';
          if (window.location.pathname === '/' || window.location.pathname === '/login') {
            window.history.replaceState(null, '', `/${targetTab}${window.location.search}`);
          }
          window.dispatchEvent(new CustomEvent('mro_session_ready'));
        }
      } else {
        setAuthenticatedUser(null);
        setIsAuthenticated(false);
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.history.replaceState(null, '', '/login');
        }
      }
    } catch (err: any) {
      setAuthenticatedUser(null);
      setIsAuthenticated(false);
      setStartupError(err?.message || 'Unable to verify authentication session.');
    } finally {
      setIsCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    void verifyEnterpriseSession();

    const handleUnauthorizedEvent = () => {
      clearAuthSession();
      setAuthenticatedUser(null);
      setIsAuthenticated(false);
      setSessionExpiredNotice(true);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', '/login');
      }
    };

    window.addEventListener('mro_unauthorized_session', handleUnauthorizedEvent);
    return () => {
      window.removeEventListener('mro_unauthorized_session', handleUnauthorizedEvent);
    };
  }, [verifyEnterpriseSession]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white text-center">
        <div className="space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto shadow-xl shadow-indigo-600/30 animate-pulse">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">MRO PROCUREMENT SOLUTION</h1>
            <p className="text-xs text-slate-400 mt-1">Verifying authenticated ERP session...</p>
          </div>
        </div>
      </div>
    );
  }

  if (startupError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-slate-100">
        <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl p-7 shadow-2xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">MRO PROCUREMENT SOLUTION</h1>
              <p className="text-xs text-amber-300">Authentication Check Interrupted</p>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed">{startupError}</p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void verifyEnterpriseSession()}
              className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Verification</span>
            </button>
            <button
              type="button"
              onClick={() => {
                clearAuthSession();
                setStartupError(null);
                setAuthenticatedUser(null);
                setIsAuthenticated(false);
              }}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
            >
              <span>Go to Sign In</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !authenticatedUser) {
    return (
      <LoginPage
        onLoginSuccess={(user, _sessionId, mustChangePassword) => {
          setAuthenticatedUser(user);
          setInitialMustChangePassword(Boolean(mustChangePassword));
          setSessionExpiredNotice(false);
          setStartupError(null);
          const targetTab = intendedTab && intendedTab !== 'login' ? intendedTab : 'dashboard';
          setIntendedTab(targetTab);
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', `/${targetTab}`);
          }
          setIsAuthenticated(true);
        }}
        sessionExpiredNotice={sessionExpiredNotice}
      />
    );
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white text-center">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto shadow-xl shadow-indigo-600/30">
              <Building2 className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Loading MRO ERP Workspace...</h1>
              <p className="text-xs text-slate-400 mt-1">Initializing procurement modules</p>
            </div>
          </div>
        </div>
      }
    >
      <ErpAuthenticatedShell
        authenticatedUser={authenticatedUser}
        initialTab={intendedTab}
        initialMustChangePassword={initialMustChangePassword}
        onSignedOut={(expired) => {
          void logoutComplete(authenticatedUser);
          setAuthenticatedUser(null);
          setIsAuthenticated(false);
          setSessionExpiredNotice(Boolean(expired));
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', '/login');
          }
        }}
      />
    </Suspense>
  );
}
