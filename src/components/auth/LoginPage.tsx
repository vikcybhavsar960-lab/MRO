import React, { useState, useEffect } from 'react';
import {
  Building2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  KeyRound,
  Database,
} from 'lucide-react';
import { ErpBrandingConfig } from '../../types';
import { fetchApi } from '../../utils/apiClient';
import { loginWithErpAndSupabase } from '../../services/supabaseAuthService';
import { ForgotPasswordModal } from './ForgotPasswordModal';

interface LoginPageProps {
  onLoginSuccess: (user?: any, sessionId?: string, mustChangePassword?: boolean) => void;
  sessionExpiredNotice?: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, sessionExpiredNotice = false }) => {
  const [branding, setBranding] = useState<Partial<ErpBrandingConfig> | null>(() => {
    try {
      const cached = localStorage.getItem('erp_branding_config');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [usernameOrEmail, setUsernameOrEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mro_remembered_username') || '';
    }
    return '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  // Non-blocking optional branding refresh + session expiry notice
  useEffect(() => {
    if (sessionExpiredNotice) {
      setErrorMessage('Your previous ERP session has expired or you signed out. Please sign in again.');
    }
    let mounted = true;
    fetchApi('/api/branding', { timeoutMs: 2500 })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data && data.erpName) {
          setBranding(data);
          try {
            localStorage.setItem('erp_branding_config', JSON.stringify(data));
          } catch {}
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [sessionExpiredNotice]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim()) {
      setErrorMessage('Please enter your username or email');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Please enter your password');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const result = await loginWithErpAndSupabase(usernameOrEmail.trim(), password.trim());
      if (!result.success || !result.user) {
        setErrorMessage(result.error || 'Invalid username or password');
        setIsLoading(false);
        return;
      }

      if (rememberMe) {
        localStorage.setItem('mro_remembered_username', usernameOrEmail.trim());
      } else {
        localStorage.removeItem('mro_remembered_username');
      }

      setSuccessMessage(`Authenticated successfully. Welcome back, ${result.user.name}!`);

      setTimeout(() => {
        onLoginSuccess(result.user, result.sessionId, result.mustChangePassword);
      }, 250);
    } catch (err: any) {
      setErrorMessage('Login request failed: ' + (err.message || 'Server connection error'));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-between text-slate-100 selection:bg-indigo-600 selection:text-white relative">
      {/* Subtle Corporate Grid Ambient */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      {/* Corporate Top Header */}
      <header className="relative z-10 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.companyName || 'Company Logo'}
              className="h-10 max-w-[140px] object-contain rounded-lg p-0.5 border border-slate-700 bg-white shadow-xs"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Building2 className="w-5 h-5" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-base tracking-tight">
                MRO <span className="text-indigo-400">PROCUREMENT SOLUTION</span>
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-300 rounded border border-indigo-500/20">
                Production ERP
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Professional MRO Procurement & Vendor Management ERP
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline">Supabase Auth & PostgreSQL Protected</span>
        </div>
      </header>

      {/* Main Login Screen */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl p-7 sm:p-8 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Sign in to ERP Portal
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Authorized personnel credentials required
            </p>
          </div>

          {/* Session Expired or Error Messages */}
          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span className="font-medium">{successMessage}</span>
            </div>
          )}

          {/* Enterprise Role Accounts Info Card */}
          <div className="mb-5 p-3.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs">
            <div className="flex items-center justify-between font-semibold text-white mb-2">
              <span className="flex items-center gap-1.5 text-indigo-300">
                <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                <span>Authorized ERP Accounts</span>
              </span>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Role-Based Access
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setUsernameOrEmail('admin');
                  setPassword('Admin@123');
                }}
                className={`text-left px-2 py-1.5 rounded-lg text-[11px] transition border cursor-pointer ${
                  usernameOrEmail === 'admin'
                    ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200 font-semibold'
                    : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="truncate font-semibold">Super Admin</div>
                <div className="text-[9px] text-slate-400">admin</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUsernameOrEmail('suresh_purchase');
                  setPassword('Purchase@123');
                }}
                className={`text-left px-2 py-1.5 rounded-lg text-[11px] transition border cursor-pointer ${
                  usernameOrEmail === 'suresh_purchase'
                    ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200 font-semibold'
                    : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="truncate font-semibold">Purchase Mgr</div>
                <div className="text-[9px] text-slate-400">suresh_purchase</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUsernameOrEmail('anjali_approver');
                  setPassword('Approver@123');
                }}
                className={`text-left px-2 py-1.5 rounded-lg text-[11px] transition border cursor-pointer ${
                  usernameOrEmail === 'anjali_approver'
                    ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200 font-semibold'
                    : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="truncate font-semibold">Approver</div>
                <div className="text-[9px] text-slate-400">anjali_approver</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUsernameOrEmail('pooja_accounts');
                  setPassword('Accounts@123');
                }}
                className={`text-left px-2 py-1.5 rounded-lg text-[11px] transition border cursor-pointer ${
                  usernameOrEmail === 'pooja_accounts'
                    ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200 font-semibold'
                    : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="truncate font-semibold">Accounts</div>
                <div className="text-[9px] text-slate-400">pooja_accounts</div>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {/* Username/Email Input */}
            <div>
              <label
                htmlFor="erp-login-username"
                className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Username / Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="erp-login-username"
                  type="text"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="Enter your username or email"
                  autoComplete="username"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="erp-login-password"
                  className="block text-xs font-semibold text-slate-300 uppercase tracking-wider"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="erp-login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Remember username</span>
              </label>
            </div>

            {/* Sign In Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Secure Business Access Note */}
          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Multi-user session synced to central PostgreSQL ERP database</span>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-slate-800 bg-slate-950/80 px-6 py-3 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <p>© 2026 MRO PROCUREMENT SOLUTION. All rights reserved.</p>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Supabase PostgreSQL & Storage Architecture</span>
          </span>
          <span>•</span>
          <span>Encrypted Session Vault</span>
        </div>
      </footer>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        onPasswordResetSuccess={(emailOrUser) => {
          setUsernameOrEmail(emailOrUser);
          setPassword('');
          setSuccessMessage('Password reset successfully! Please sign in with your new password.');
        }}
      />
    </div>
  );
};
