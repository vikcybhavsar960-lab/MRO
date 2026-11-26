// Universal Authoritative API Client for MRO Procurement ERP
// Ensures Cloudflare Workers, Google Cloud Run, and Localhost connect to the same central database
import { isStaticSpaMode } from './staticSpaRuntime';

declare global {
  interface Window {
    __APP_URL__?: string;
  }
}

export const PRODUCTION_BACKEND_URL = '';

let activeBaseUrl = '';

export const getInjectedBackendUrl = (): string => {
  if (typeof window !== 'undefined' && window.__APP_URL__) {
    return window.__APP_URL__.trim().replace(/\/$/, '');
  }

  if (typeof document !== 'undefined') {
    const metaAppUrl = document.querySelector('meta[name="app-url"]')?.getAttribute('content');
    if (metaAppUrl) return metaAppUrl.trim().replace(/\/$/, '');
  }

  const viteAppUrl =
    (import.meta as any)?.env?.VITE_APP_URL ||
    (import.meta as any)?.env?.VITE_API_URL ||
    (import.meta as any)?.env?.VITE_BACKEND_URL;
  if (viteAppUrl) {
    return viteAppUrl.trim().replace(/\/$/, '');
  }

  return '';
};

export const getApiBaseUrl = (): string => {
  // Always use same-origin relative endpoints. This guarantees zero CORS issues,
  // perfect mobile compatibility, and seamless routing on localhost, Cloud Run, and custom domains.
  return '';
};

export const setApiBaseUrl = (url: string) => {
  activeBaseUrl = url.trim().replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    if (url) {
      localStorage.setItem('mro_custom_backend_url', activeBaseUrl);
    } else {
      localStorage.removeItem('mro_custom_backend_url');
    }
  }
};

export const getCurrentSessionId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return (
    sessionStorage.getItem('mro_current_session_id') ||
    localStorage.getItem('mro_current_session_id') ||
    null
  );
};

export const clearAuthSession = () => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('mro_current_session_id');
  localStorage.removeItem('mro_current_session_id');
  localStorage.removeItem('procure_user');
  localStorage.setItem('mro_is_logged_out', 'true');
};

export interface ApiRequestOptions extends RequestInit {
  timeoutMs?: number;
}

export const fetchApi = async (path: string, options?: ApiRequestOptions): Promise<Response> => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  const url = `${base}${cleanPath}`;
  const timeoutMs = options?.timeoutMs ?? 12000;

  const sessionId = getCurrentSessionId();
  const headers = new Headers(options?.headers || {});

  if (sessionId && !headers.has('x-session-id')) {
    headers.set('x-session-id', sessionId);
  }
  if (sessionId && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${sessionId}`);
  }

  const controller = new AbortController();
  const externalSignal = options?.signal;
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  const { timeoutMs: _omitTimeout, ...restOptions } = options || {};
  const mergedOptions: RequestInit = {
    ...restOptions,
    headers,
    signal: controller.signal,
  };

  try {
    const res = await fetch(url, mergedOptions);
    if (timer) clearTimeout(timer);

    if (res.status === 401 && !cleanPath.includes('/api/auth/login') && !cleanPath.includes('/api/auth/verify-session')) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mro_unauthorized_session', { detail: { path: cleanPath } }));
      }
    }

    return res;
  } catch (err: any) {
    if (timer) clearTimeout(timer);
    const isTimeout = err?.name === 'AbortError';

    if (base && !isTimeout) {
      try {
        console.warn(`[ApiClient] Custom URL ${base} failed, falling back to same-origin for ${cleanPath}`);
        return await fetch(cleanPath, { ...restOptions, headers });
      } catch {}
    }

    console.warn(
      `[ApiClient] ${isTimeout ? 'Request timeout' : 'Transient network interruption'} for ${cleanPath}:`,
      err?.message || err
    );

    return new Response(
      JSON.stringify({
        error: isTimeout
          ? 'Unable to connect to ERP services within timeout. Please try again.'
          : 'Unable to connect to ERP services. Please try again.',
        offline: !isTimeout,
        timeout: isTimeout,
        details: err?.message || String(err),
      }),
      {
        status: isTimeout ? 408 : 503,
        statusText: isTimeout ? 'Request Timeout' : 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

export const checkApiHealth = async (timeoutMs = 3500): Promise<{
  ok: boolean;
  status: number;
  data?: any;
}> => {
  try {
    const res = await fetchApi('/api/health', { timeoutMs });
    if (!res.ok) {
      return { ok: false, status: res.status };
    }
    const data = await res.json();
    return { ok: data?.status === 'UP', status: res.status, data };
  } catch {
    return { ok: false, status: 503 };
  }
};

export const installApiInterceptor = () => {
  // Safe no-op
};

// Real-Time SSE Listener for Multi-Device Synchronization (authenticated sessions only)
export const subscribeToSyncEvents = (onEvent: (event: { type: string; data?: any; timestamp?: string }) => void): (() => void) => {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }

  const base = getApiBaseUrl();
  let es: EventSource | null = null;
  let retryTimeout: any = null;
  let closed = false;

  const connect = () => {
    if (closed || es || isStaticSpaMode()) return;
    const sessionId = getCurrentSessionId();
    const isLoggedOut = localStorage.getItem('mro_is_logged_out') === 'true';
    if (!sessionId || isLoggedOut) return;

    try {
      const sseUrl = `${base}/api/sync/events?sessionId=${encodeURIComponent(sessionId)}`;
      es = new EventSource(sseUrl);
      es.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          onEvent(parsed);
        } catch {}
      };
      es.onerror = () => {
        if (es) {
          es.close();
          es = null;
        }
        if (!closed) {
          retryTimeout = setTimeout(connect, 5000);
        }
      };
    } catch {
      if (!closed) {
        retryTimeout = setTimeout(connect, 5000);
      }
    }
  };

  const handleSessionReady = () => {
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
    if (!es) {
      connect();
    }
  };

  const handleSessionLoggedOut = () => {
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
    if (es) {
      es.close();
      es = null;
    }
  };

  window.addEventListener('mro_session_ready', handleSessionReady);
  window.addEventListener('mro_session_logged_out', handleSessionLoggedOut);
  retryTimeout = setTimeout(connect, 800);

  return () => {
    closed = true;
    window.removeEventListener('mro_session_ready', handleSessionReady);
    window.removeEventListener('mro_session_logged_out', handleSessionLoggedOut);
    if (retryTimeout) clearTimeout(retryTimeout);
    if (es) es.close();
  };
};

export const API_BASE_URL = '/api';
