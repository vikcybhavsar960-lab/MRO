import React from 'react';
import { ShieldAlert, ArrowLeft, Lock, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface AccessDeniedViewProps {
  moduleName?: string;
  requiredAction?: string;
  onReturnToDashboard?: () => void;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  moduleName = 'Requested Module',
  requiredAction,
  onReturnToDashboard,
}) => {
  const { currentUser, setActiveTab } = useApp();

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-lg w-full text-center shadow-lg">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600 mb-5">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 font-bold text-xs uppercase tracking-wider inline-block mb-3">
          HTTP 403 • Access Denied
        </span>

        <h1 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
          Restricted Enterprise Area
        </h1>

        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          Your current account role <strong className="text-slate-900">({currentUser.role})</strong> does not have authorization to access the <strong className="text-slate-900">{moduleName}</strong> module {requiredAction && `or perform ${requiredAction}`}.
        </p>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-2 mb-6">
          <div className="flex items-center justify-between text-slate-500">
            <span>Signed in as:</span>
            <span className="font-bold text-slate-800">{currentUser.name}</span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>Corporate Email:</span>
            <span className="font-mono text-slate-800">{currentUser.email}</span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>Assigned Role:</span>
            <span className="font-bold text-indigo-700">{currentUser.role}</span>
          </div>
          <div className="flex items-center justify-between text-slate-500 pt-1 border-t border-slate-200">
            <span>Resolution:</span>
            <span className="text-slate-700">Request permission upgrade from Super Admin</span>
          </div>
        </div>

        <button
          onClick={() => {
            if (onReturnToDashboard) onReturnToDashboard();
            else setActiveTab('dashboard');
          }}
          className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to ERP Dashboard</span>
        </button>
      </div>
    </div>
  );
};
