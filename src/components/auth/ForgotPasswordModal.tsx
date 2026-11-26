import React, { useState } from 'react';
import { Mail, KeyRound, ShieldAlert, CheckCircle2, AlertCircle, ArrowRight, X, ShieldCheck } from 'lucide-react';
import { fetchApi } from '../../utils/apiClient';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPasswordResetSuccess?: (usernameOrEmail: string) => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onPasswordResetSuccess,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successInfo, setSuccessInfo] = useState('');

  if (!isOpen) return null;

  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!usernameOrEmail.trim()) {
      setErrorMessage('Please enter your registered username or corporate email.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetchApi('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: usernameOrEmail.trim() }),
      });
      const data = await res.json();
      setIsLoading(false);

      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to issue reset code.');
        return;
      }

      setSuccessInfo(data.message || 'Security code generated.');
      if (data.token) {
        // Pre-fill generated token for instant testing ease
        setResetCode(data.token);
      }
      setStep(2);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Server connection failed.');
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!resetCode.trim()) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirm password do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetchApi('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernameOrEmail: usernameOrEmail.trim(),
          token: resetCode.trim(),
          newPassword,
        }),
      });

      const data = await res.json();
      setIsLoading(false);

      if (!res.ok) {
        setErrorMessage(data.error || 'Invalid or expired authorization code.');
        return;
      }

      setSuccessInfo(data.message || 'Password reset successfully!');
      setTimeout(() => {
        if (onPasswordResetSuccess) {
          onPasswordResetSuccess(usernameOrEmail.trim());
        }
        onClose();
      }, 1500);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Server connection failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Enterprise Password Recovery</h2>
              <p className="text-[11px] text-slate-400">Step {step} of 2 • Secure verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successInfo && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successInfo}</span>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleRequestToken} className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Enter your registered username or corporate email address. If an active employee profile is found, a secure 6-digit authorization code will be generated.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Username or Corporate Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    placeholder="e.g. admin or vickybhavsar960@gmail.com"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/25 flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Verifying...' : 'Request Security Code'}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleConfirmReset} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  6-Digit Authorization Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-slate-500 hover:text-slate-800 underline font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/25 flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Updating Vault...' : 'Reset & Save Password'}
                  <ShieldCheck className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
