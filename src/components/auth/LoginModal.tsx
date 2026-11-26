import React, { useState } from 'react';
import {
  Building2,
  X,
  Lock,
  Mail,
  Smartphone,
  ShieldCheck,
  KeyRound,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { User } from '../../types';
import { fetchApi } from '../../utils/apiClient';
import { normalizeUserRole } from '../../utils/roleUtils';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, setCurrentUser, availableUsers, syncBackendNow } = useApp();

  const [mode, setMode] = useState<'PASSWORD' | 'OTP'>('PASSWORD');
  const [emailOrPhone, setEmailOrPhone] = useState('vickybhavsar960@gmail.com');
  const [password, setPassword] = useState('••••••••••');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSendOtp = () => {
    if (!emailOrPhone) {
      setErrorMsg('Please enter your mobile or email');
      return;
    }
    setErrorMsg('');
    setOtpSent(true);
    setOtp('582910'); // Simulated OTP auto-fill for testing ease
  };

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setErrorMsg('');
      const response = await fetchApi('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: emailOrPhone,
          password: password === '••••••••••' ? 'Admin@123' : password,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMsg(data.error || 'Authentication failed');
        return;
      }

      const loggedInUser: User = {
        id: data.user.id,
        name: data.user.name,
        username: data.user.username,
        email: data.user.email,
        role: normalizeUserRole(data.user.role, data.user.username, data.user.email),
        department: data.user.department || 'Procurement',
        mobile: data.user.mobile || '+91 98250 12345',
        status: data.user.status || 'ACTIVE',
        mustChangePassword: data.mustChangePassword,
        permissions: data.user.permissions,
        approvalLimit: data.user.approvalAuthority?.maxApprovalLimit ?? 0,
      };

      if (data.sessionId) {
        sessionStorage.setItem('mro_current_session_id', data.sessionId);
        localStorage.setItem('mro_current_session_id', data.sessionId);
      }
      localStorage.removeItem('mro_is_logged_out');
      localStorage.setItem('procure_user', JSON.stringify(loggedInUser));
      setCurrentUser(loggedInUser);
      window.dispatchEvent(new CustomEvent('mro_session_ready'));
      void syncBackendNow();
      onClose();
    } catch (err: any) {
      setErrorMsg('Login failed: ' + (err.message || 'Network error'));
    }
  };

  const handleSelectRole = async (user: User) => {
    const normalizedUser: User = {
      ...user,
      role: normalizeUserRole(user.role, user.username, user.email),
    };
    try {
      const demoPasswords: Record<string, string> = {
        'USR-001': 'Admin@123',
        'USR-002': 'Purchase@123',
        'USR-003': 'Approver@123',
        'USR-004': 'Accounts@123',
      };
      const pw = demoPasswords[user.id] || 'Admin@123';
      const response = await fetchApi('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username || user.email,
          password: pw,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.sessionId) {
        sessionStorage.setItem('mro_current_session_id', data.sessionId);
        localStorage.setItem('mro_current_session_id', data.sessionId);
        localStorage.removeItem('mro_is_logged_out');
        if (data.user) {
          normalizedUser.role = normalizeUserRole(data.user.role, data.user.username, data.user.email);
          normalizedUser.permissions = data.user.permissions || normalizedUser.permissions;
        }
      }
    } catch {}

    try {
      localStorage.setItem('procure_user', JSON.stringify(normalizedUser));
    } catch {}
    setCurrentUser(normalizedUser);
    window.dispatchEvent(new CustomEvent('mro_session_ready'));
    void syncBackendNow();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">MRO PROCUREMENT SOLUTION</h2>
              <p className="text-xs text-blue-200 font-medium">Enterprise Procurement Management & B2B Supply Chain</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Persona 1-Click Role Switcher */}
          <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Quick Test Persona (1-Click Role Switch)
              </span>
              <span className="text-[11px] text-blue-600 font-semibold">Demo Accounts</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Switch immediately between roles to test strict permissions and workflow visibility:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {availableUsers.map((u) => {
                const isSelected = u.id === currentUser.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => handleSelectRole(u)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-white bg-slate-100/60 text-slate-700'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                      {u.avatar ? <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" /> : u.name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800 truncate">{u.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{u.role.replace(/_/g, ' ')}</div>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative my-4 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <span className="relative bg-white px-3 text-xs text-slate-400 font-medium">
              Or Sign In with Credentials
            </span>
          </div>

          {/* Mode Tabs */}
          <div className="flex border-b border-slate-200 mb-4 text-xs font-bold">
            <button
              onClick={() => {
                setMode('PASSWORD');
                setOtpSent(false);
              }}
              className={`pb-2 px-4 border-b-2 transition-colors ${
                mode === 'PASSWORD'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Password Login
            </button>
            <button
              onClick={() => setMode('OTP')}
              className={`pb-2 px-4 border-b-2 transition-colors ${
                mode === 'OTP'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              OTP Login (SMS / WhatsApp)
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleStandardLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Registered Mobile or Work Email
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  placeholder="e.g. vickybhavsar960@gmail.com or +91 98201 12345"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {mode === 'PASSWORD' ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => alert('Password reset link sent to registered email.')}
                    className="text-[11px] text-blue-600 hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    required
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>
            ) : (
              <div>
                {!otpSent ? (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    <span>Send Verification OTP</span>
                  </button>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Enter 6-Digit OTP (Simulated: 582910)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="582910"
                        className="w-full pl-9 pr-3 py-2 text-xs font-mono tracking-widest border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        required
                      />
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              className="w-full mt-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/30 transition-all flex items-center justify-center gap-2"
            >
              <span>Sign In to MRO Platform</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
