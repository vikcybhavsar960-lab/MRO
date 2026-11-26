import React, { useState } from 'react';
import { Shield, Check, X, Sliders, Users, Save, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';

export const PermissionMatrixView: React.FC = () => {
  const { availableUsers = [], updateUserPermissions } = useApp();
  const safeUsers = Array.isArray(availableUsers) ? availableUsers : [];
  const [selectedUser, setSelectedUser] = useState<string>(safeUsers[0]?.id || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const currentUserObj = safeUsers.find((u) => u?.id === selectedUser) || safeUsers[0];

  const modulesList = [
    { key: 'dashboard', name: 'Dashboard' },
    { key: 'requirements', name: '1. Requirements (REQ)' },
    { key: 'vendorRates', name: '2. Direct Vendor Rates' },
    { key: 'rateComparison', name: '3. Rate Comparison' },
    { key: 'quotations', name: '4. Quotations (QTN)' },
    { key: 'customerPos', name: '5. Customer PO' },
    { key: 'vendorPos', name: '6. Vendor PO' },
    { key: 'pi', name: '7. Proforma Invoice (PI)' },
    { key: 'payments', name: '8. Payments & Finance' },
    { key: 'dispatch', name: '9. Dispatch & LR' },
    { key: 'delivery', name: '10. Delivery & Closed' },
    { key: 'customers', name: 'Customers Master' },
    { key: 'vendors', name: 'Vendors & AI Catalog' },
    { key: 'categories', name: 'Categories Master' },
    { key: 'products', name: 'Product Catalog' },
    { key: 'reports', name: 'Financial Reports' },
    { key: 'documents', name: 'Document Center' },
    { key: 'userManagement', name: 'User Management' },
    { key: 'auditTrail', name: 'System Audit Trail' },
  ];

  const actionsList = [
    { key: 'canView', name: 'View' },
    { key: 'canCreate', name: 'Create' },
    { key: 'canEdit', name: 'Edit' },
    { key: 'canDelete', name: 'Delete' },
    { key: 'canApprove', name: 'Approve' },
    { key: 'canExport', name: 'Export' },
    { key: 'canPrint', name: 'Print' },
    { key: 'canDownload', name: 'Download' },
    { key: 'canShare', name: 'Share' },
  ];

  const handleToggleModule = (modKey: string) => {
    if (!currentUserObj || !currentUserObj.permissions) return;
    const currentMods = { ...currentUserObj.permissions.modules };
    (currentMods as any)[modKey] = !(currentMods as any)[modKey];
    updateUserPermissions(currentUserObj.id, {
      modules: currentMods,
      actions: currentUserObj.permissions.actions,
    });
    triggerSuccess();
  };

  const handleToggleAction = (actKey: string) => {
    if (!currentUserObj || !currentUserObj.permissions) return;
    const currentActs = { ...currentUserObj.permissions.actions };
    (currentActs as any)[actKey] = !(currentActs as any)[actKey];
    updateUserPermissions(currentUserObj.id, {
      modules: currentUserObj.permissions.modules,
      actions: currentActs,
    });
    triggerSuccess();
  };

  const triggerSuccess = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Selector & Info */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            <span>Interactive Security Matrix & Authority Governance</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time RBAC configuration for modules and operational authorizations
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-700">Select User:</span>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="text-xs p-2 border border-slate-300 rounded-lg bg-white font-bold text-slate-800"
            >
              {safeUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {savedSuccess && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>Permission Updated</span>
            </span>
          )}
        </div>
      </div>

      {currentUserObj && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Module Access Matrix */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                  Module Navigation Permissions
                </h4>
                <p className="text-[11px] text-slate-500">
                  Controls visibility of tabs in the sidebar for {currentUserObj.name}
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                {currentUserObj.role}
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[550px] overflow-y-auto">
              {modulesList.map((mod) => {
                const isAllowed = Boolean((currentUserObj.permissions?.modules as any)?.[mod.key]);
                return (
                  <div
                    key={mod.key}
                    onClick={() => handleToggleModule(mod.key)}
                    className="p-3 px-4 flex items-center justify-between hover:bg-slate-50/80 cursor-pointer transition-colors text-xs"
                  >
                    <span className="font-medium text-slate-800">{mod.name}</span>
                    <button
                      type="button"
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                        isAllowed
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {isAllowed ? <Check className="w-4 h-4" /> : <X className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Permissions Matrix */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                  Transactional Actions & Authority
                </h4>
                <p className="text-[11px] text-slate-500">
                  Enforces create, modify, sanction, and delete gates
                </p>
              </div>
              <span className="text-[11px] font-mono font-bold text-slate-700">
                Limit: {currentUserObj.approvalLimit === 0 ? 'Unlimited' : `₹${currentUserObj.approvalLimit?.toLocaleString('en-IN')}`}
              </span>
            </div>

            <div className="p-4 space-y-3">
              {actionsList.map((act) => {
                const isAllowed = Boolean((currentUserObj.permissions?.actions as any)?.[act.key]);
                return (
                  <div
                    key={act.key}
                    onClick={() => handleToggleAction(act.key)}
                    className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isAllowed
                        ? 'bg-emerald-50/60 border-emerald-300 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">{act.name}</span>
                      <span className="text-[11px] text-slate-500">
                        {act.key === 'canDelete'
                          ? 'Critical: Destructive action permission'
                          : act.key === 'canApprove'
                          ? 'Commercial sanctioning and approval gate'
                          : `Allows ${act.name.toLowerCase()} operations across permitted modules`}
                      </span>
                    </div>

                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center text-white font-bold transition-all ${
                        isAllowed ? 'bg-emerald-600' : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      {isAllowed ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <X className="w-3 h-3" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
