import React, { useEffect, useState } from 'react';
import { Clock, ShieldAlert, LogOut, CheckCircle2 } from 'lucide-react';

interface SessionExpiryModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  onContinueSession: () => void;
  onLogoutNow: () => void;
}

export const SessionExpiryModal: React.FC<SessionExpiryModalProps> = ({
  isOpen,
  secondsRemaining,
  onContinueSession,
  onLogoutNow,
}) => {
  if (!isOpen) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden text-center p-6 animate-scale-in">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600 mb-4 animate-pulse">
          <Clock className="w-7 h-7" />
        </div>

        <h2 className="text-lg font-bold text-slate-900 tracking-tight">
          Session Inactivity Warning
        </h2>

        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
          You have been inactive. For corporate data security, your authenticated ERP session will automatically expire in:
        </p>

        <div className="my-4 py-2.5 px-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xl font-extrabold text-amber-700">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>

        <div className="space-y-2 pt-2">
          <button
            onClick={onContinueSession}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Continue Session</span>
          </button>

          <button
            onClick={onLogoutNow}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500" />
            <span>Logout Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};
