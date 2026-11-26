import React, { useState } from 'react';
import { X, Lock, CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  userId,
}) => {
  const { currentUser, changeUserPassword } = useApp();
  const targetUserId = userId || currentUser.id;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { label: 'Empty', color: 'bg-slate-200', score: 0 };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 1) return { label: 'Weak', color: 'bg-red-500', score: 25 };
    if (score === 2) return { label: 'Medium', color: 'bg-amber-500', score: 50 };
    if (score === 3) return { label: 'Good', color: 'bg-blue-500', score: 75 };
    return { label: 'Strong (Enterprise Compliant)', color: 'bg-emerald-500', score: 100 };
  };

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    const res = changeUserPassword(targetUserId, currentPassword, newPassword);
    if (res.success) {
      setSuccess(res.message);
      setTimeout(() => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccess(null);
        onClose();
      }, 1500);
    } else {
      setError(res.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-bold text-sm text-white">Change Account Password</h3>
              <p className="text-[11px] text-slate-400">Update credential for secure ERP access</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Current Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password or initial password"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">New Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {newPassword && (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Strength: {strength.label}</span>
                  <span>{strength.score}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${strength.color}`}
                    style={{ width: `${strength.score}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Confirm New Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type new password"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500">
            Passwords are hashed using industry standard one-way encryption. Never share your credentials with unauthorized personnel.
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm shadow-blue-500/20"
            >
              Update Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
