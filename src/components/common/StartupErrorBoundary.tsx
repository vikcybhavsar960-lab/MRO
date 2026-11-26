import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface StartupErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  diagnosticId: string;
}

export class StartupErrorBoundary extends React.Component<
  { children: React.ReactNode },
  StartupErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      diagnosticId: '',
    };
  }

  static getDerivedStateFromError(error: Error): StartupErrorBoundaryState {
    const diagnosticId = `ERR-${Date.now().toString(36).toUpperCase()}`;
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected startup error occurred.',
      diagnosticId,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const msg = String(error?.message || '');
    const isStaleModuleError =
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes("Cannot read properties of null (reading 'useState')") ||
      msg.includes("Cannot read properties of null (reading 'useContext')") ||
      msg.includes('Invalid hook call');
    if (isStaleModuleError && typeof window !== 'undefined') {
      try {
        const lastReload = Number(sessionStorage.getItem('mro_vite_chunk_reload_at') || '0');
        if (!Number.isFinite(lastReload) || Date.now() - lastReload > 15000) {
          sessionStorage.setItem('mro_vite_chunk_reload_at', String(Date.now()));
          console.warn('[STARTUP] Recovering from stale module chunk via reload:', msg);
          window.location.reload();
          return;
        }
      } catch {
        // ignore sessionStorage access error
      }
    }
    console.error('[STARTUP] React Error Boundary caught failure:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-slate-100">
          <div className="max-w-md w-full bg-slate-950 border border-slate-800 rounded-2xl p-7 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white">MRO PROCUREMENT SOLUTION</h1>
                <p className="text-xs text-rose-300">Application startup encountered an error</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-1.5">
              <div className="font-semibold text-white">Diagnostic Details</div>
              <p className="text-slate-400 break-words">{this.state.errorMessage}</p>
              <div className="text-[11px] font-mono text-slate-500">Ref: {this.state.diagnosticId}</div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, errorMessage: '', diagnosticId: '' })}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload now</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
