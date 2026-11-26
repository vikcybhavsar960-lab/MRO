import React, { useState, useEffect } from 'react';
import {
  X,
  User as UserIcon,
  Shield,
  KeyRound,
  CheckCircle2,
  Building2,
  Sliders,
  DollarSign,
  AlertCircle,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { User, UserRole, ModulePermissions, ActionPermissions } from '../../types';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToEdit?: User | null;
}

const DEFAULT_MODULE_PERMISSIONS: ModulePermissions = {
  dashboard: true,
  requirements: true,
  rfqs: true,
  rateComparison: true,
  quotations: true,
  customerPos: true,
  vendorPos: true,
  pi: true,
  payments: true,
  dispatch: true,
  delivery: true,
  customers: true,
  vendors: true,
  categories: true,
  materials: true,
  products: true,
  reports: true,
  documents: true,
  approvals: true,
  userManagement: false,
  auditTrail: true,
};

const DEFAULT_ACTION_PERMISSIONS: ActionPermissions = {
  canView: true,
  canCreate: true,
  canEdit: true,
  canDelete: false,
  canApprove: true,
  canExport: true,
  canPrint: true,
  canDownload: true,
  canShare: true,
};

// Role-based permission presets
const ROLE_PRESETS: Record<UserRole, { modules: Partial<ModulePermissions>; actions: Partial<ActionPermissions>; designation: string; department: string; limit: number }> = {
  SUPER_ADMIN: {
    modules: {
      dashboard: true,
      requirements: true,
      rfqs: true,
      rateComparison: true,
      quotations: true,
      customerPos: true,
      vendorPos: true,
      pi: true,
      payments: true,
      dispatch: true,
      delivery: true,
      customers: true,
      vendors: true,
      categories: true,
      materials: true,
      products: true,
      reports: true,
      documents: true,
      approvals: true,
      userManagement: true,
      auditTrail: true,
    },
    actions: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canApprove: true,
      canExport: true,
      canPrint: true,
      canDownload: true,
      canShare: true,
    },
    designation: 'Managing Director / Administrator',
    department: 'Executive Management',
    limit: 0, // unlimited
  },
  PROCUREMENT_EMPLOYEE: {
    modules: {
      dashboard: true,
      requirements: true,
      rfqs: true,
      rateComparison: true,
      quotations: true,
      customerPos: false,
      vendorPos: true,
      pi: true,
      payments: false,
      dispatch: true,
      delivery: true,
      customers: false,
      vendors: true,
      categories: true,
      materials: true,
      products: true,
      reports: true,
      documents: true,
      approvals: false,
      userManagement: false,
      auditTrail: true,
    },
    actions: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: false,
      canApprove: false,
      canExport: true,
      canPrint: true,
      canDownload: true,
      canShare: true,
    },
    designation: 'Purchase Executive',
    department: 'Sourcing & Procurement',
    limit: 100000,
  },
  PURCHASE_MANAGER: {
    modules: {
      dashboard: true,
      requirements: true,
      rfqs: true,
      rateComparison: true,
      quotations: true,
      customerPos: true,
      vendorPos: true,
      pi: true,
      payments: true,
      dispatch: true,
      delivery: true,
      customers: true,
      vendors: true,
      categories: true,
      materials: true,
      products: true,
      reports: true,
      documents: true,
      approvals: true,
      userManagement: false,
      auditTrail: true,
    },
    actions: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canApprove: true,
      canExport: true,
      canPrint: true,
      canDownload: true,
      canShare: true,
    },
    designation: 'Procurement Manager',
    department: 'Sourcing & Supply Chain',
    limit: 1500000,
  },
  APPROVAL_USER: {
    modules: {
      dashboard: true,
      requirements: true,
      rfqs: true,
      rateComparison: true,
      quotations: true,
      customerPos: true,
      vendorPos: true,
      pi: true,
      payments: true,
      dispatch: true,
      delivery: true,
      customers: true,
      vendors: true,
      categories: true,
      materials: true,
      products: true,
      reports: true,
      documents: true,
      approvals: true,
      userManagement: false,
      auditTrail: true,
    },
    actions: {
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canApprove: true,
      canExport: true,
      canPrint: true,
      canDownload: true,
      canShare: true,
    },
    designation: 'Financial Controller & Approval Head',
    department: 'Finance & Governance',
    limit: 5000000,
  },
  ACCOUNTS_USER: {
    modules: {
      dashboard: true,
      requirements: false,
      rfqs: false,
      rateComparison: false,
      quotations: false,
      customerPos: true,
      vendorPos: true,
      pi: true,
      payments: true,
      dispatch: false,
      delivery: false,
      customers: false,
      vendors: false,
      categories: false,
      materials: false,
      products: false,
      reports: true,
      documents: true,
      approvals: true,
      userManagement: false,
      auditTrail: true,
    },
    actions: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: false,
      canApprove: true,
      canExport: true,
      canPrint: true,
      canDownload: true,
      canShare: false,
    },
    designation: 'Senior Accountant',
    department: 'Finance & Accounts',
    limit: 500000,
  },
  STORE_USER: {
    modules: {
      dashboard: true,
      requirements: true,
      rfqs: false,
      rateComparison: false,
      quotations: false,
      customerPos: false,
      vendorPos: true,
      pi: false,
      payments: false,
      dispatch: true,
      delivery: true,
      customers: false,
      vendors: true,
      categories: true,
      materials: true,
      products: true,
      reports: true,
      documents: true,
      approvals: false,
      userManagement: false,
      auditTrail: true,
    },
    actions: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: false,
      canApprove: false,
      canExport: true,
      canPrint: true,
      canDownload: true,
      canShare: false,
    },
    designation: 'Warehouse & Store Officer',
    department: 'Inventory & Logistics',
    limit: 0,
  },
  MANAGEMENT_VIEWER: {
    modules: {
      dashboard: true,
      requirements: true,
      rfqs: true,
      rateComparison: true,
      quotations: true,
      customerPos: true,
      vendorPos: true,
      pi: true,
      payments: true,
      dispatch: true,
      delivery: true,
      customers: true,
      vendors: true,
      categories: true,
      materials: true,
      products: true,
      reports: true,
      documents: true,
      approvals: true,
      userManagement: true,
      auditTrail: true,
    },
    actions: {
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canApprove: false,
      canExport: true,
      canPrint: true,
      canDownload: true,
      canShare: true,
    },
    designation: 'Board Observer / Auditor',
    department: 'Executive Governance',
    limit: 0,
  },
  SALES_EXECUTIVE: {
    modules: {
      dashboard: true,
      requirements: true,
      rfqs: false,
      rateComparison: false,
      quotations: true,
      customerPos: true,
      vendorPos: false,
      pi: false,
      payments: false,
      dispatch: false,
      delivery: true,
      customers: true,
      vendors: false,
      categories: true,
      materials: true,
      products: true,
      reports: true,
      documents: true,
      approvals: false,
      userManagement: false,
      auditTrail: false,
    },
    actions: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: false,
      canApprove: false,
      canExport: true,
      canPrint: true,
      canDownload: true,
      canShare: true,
    },
    designation: 'Sales Officer',
    department: 'Sales & Client Relations',
    limit: 50000,
  },
  VENDOR: {
    modules: {
      dashboard: true,
      requirements: false,
      rfqs: true,
      rateComparison: false,
      quotations: false,
      customerPos: false,
      vendorPos: true,
      pi: true,
      payments: false,
      dispatch: true,
      delivery: false,
      customers: false,
      vendors: false,
      categories: false,
      materials: false,
      products: false,
      reports: false,
      documents: true,
      approvals: false,
      userManagement: false,
      auditTrail: false,
    },
    actions: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: false,
      canApprove: false,
      canExport: true,
      canPrint: true,
      canDownload: true,
      canShare: false,
    },
    designation: 'Vendor Channel Representative',
    department: 'External Vendor Partner',
    limit: 0,
  },
  CUSTOMER: {
    modules: {
      dashboard: true,
      requirements: true,
      rfqs: false,
      rateComparison: false,
      quotations: true,
      customerPos: true,
      vendorPos: false,
      pi: false,
      payments: false,
      dispatch: false,
      delivery: true,
      customers: false,
      vendors: false,
      categories: false,
      materials: false,
      products: false,
      reports: false,
      documents: true,
      approvals: false,
      userManagement: false,
      auditTrail: false,
    },
    actions: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: false,
      canApprove: true,
      canExport: true,
      canPrint: true,
      canDownload: true,
      canShare: false,
    },
    designation: 'Procurement Officer (Client)',
    department: 'External Customer Client',
    limit: 0,
  },
};

export const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, userToEdit }) => {
  const { addUser, updateUser, vendors, customers, availableUsers } = useApp();

  const [activeTab, setActiveTab] = useState<'profile' | 'modules' | 'actions'>('profile');
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState<UserRole>('PROCUREMENT_EMPLOYEE');
  const [companyName, setCompanyName] = useState('MRO PROCUREMENT SOLUTION');
  const [associatedId, setAssociatedId] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [approvalLimit, setApprovalLimit] = useState(100000);
  const [tempPassword, setTempPassword] = useState('Mro@Pass2026');
  const [forcePasswordChange, setForcePasswordChange] = useState(true);
  const [avatar, setAvatar] = useState('');

  const [modulePermissions, setModulePermissions] = useState<ModulePermissions>({ ...DEFAULT_MODULE_PERMISSIONS });
  const [actionPermissions, setActionPermissions] = useState<ActionPermissions>({ ...DEFAULT_ACTION_PERMISSIONS });

  const applyRolePreset = (selectedRole: UserRole) => {
    const preset = ROLE_PRESETS[selectedRole];
    if (preset) {
      if (!userToEdit) {
        setDesignation(preset.designation);
        setDepartment(preset.department);
        setApprovalLimit(preset.limit);
      }
      setModulePermissions((prev) => ({
        ...prev,
        ...preset.modules,
      }));
      setActionPermissions((prev) => ({
        ...prev,
        ...preset.actions,
      }));
    }
  };

  useEffect(() => {
    if (userToEdit) {
      setName(userToEdit.name);
      setUsername(userToEdit.username || userToEdit.email.split('@')[0]);
      setEmail(userToEdit.email);
      setMobile(userToEdit.mobile);
      setDesignation(userToEdit.designation || '');
      setDepartment(userToEdit.department || '');
      setRole(userToEdit.role);
      setCompanyName(userToEdit.companyName || 'MRO PROCUREMENT SOLUTION');
      setAssociatedId(userToEdit.associatedId || '');
      setStatus(userToEdit.status || 'ACTIVE');
      setApprovalLimit(userToEdit.approvalLimit ?? 100000);
      setForcePasswordChange(userToEdit.forcePasswordChange ?? false);
      setAvatar(userToEdit.avatar || '');
      setModulePermissions(userToEdit.permissions?.modules ? { ...userToEdit.permissions.modules } : { ...DEFAULT_MODULE_PERMISSIONS });
      setActionPermissions(userToEdit.permissions?.actions ? { ...userToEdit.permissions.actions } : { ...DEFAULT_ACTION_PERMISSIONS });
    } else {
      // New User Defaults
      setName('');
      setUsername('');
      setEmail('');
      setMobile('+91 ');
      setRole('PROCUREMENT_EMPLOYEE');
      applyRolePreset('PROCUREMENT_EMPLOYEE');
      setStatus('ACTIVE');
      setForcePasswordChange(true);
      setTempPassword('Mro@Pass2026');
      setAvatar('');
    }
    setFormError(null);
  }, [userToEdit, isOpen]);

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    applyRolePreset(newRole);
  };

  const toggleModule = (key: keyof ModulePermissions) => {
    setModulePermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleAction = (key: keyof ActionPermissions) => {
    setActionPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const normalizedUsername = (username || email.split('@')[0] || '').trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();
    const duplicate = (availableUsers || []).find(
      (u) =>
        u &&
        u.id !== userToEdit?.id &&
        ((normalizedUsername && (u.username || '').trim().toLowerCase() === normalizedUsername) ||
          (normalizedEmail && (u.email || '').trim().toLowerCase() === normalizedEmail))
    );
    if (duplicate) {
      setFormError(`Username or email already belongs to ${duplicate.name} (@${duplicate.username}).`);
      setActiveTab('profile');
      return;
    }

    const userData: any = {
      name: name.trim(),
      username: (username || email.split('@')[0]).trim(),
      email: email.trim(),
      mobile: mobile.trim(),
      designation: designation.trim(),
      department: department.trim(),
      role,
      companyName: role === 'VENDOR' || role === 'CUSTOMER' ? companyName : 'MRO PROCUREMENT SOLUTION',
      associatedId: role === 'VENDOR' || role === 'CUSTOMER' ? associatedId : undefined,
      status,
      approvalLimit: Number(approvalLimit) || 0,
      forcePasswordChange,
      avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      permissions: {
        modules: modulePermissions,
        actions: actionPermissions,
      },
    };

    if (userToEdit) {
      updateUser({
        ...userToEdit,
        ...userData,
      });
    } else {
      addUser({
        ...userData,
        passwordHash: tempPassword,
      });
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {userToEdit ? `Edit User: ${userToEdit.name}` : 'Create New System User'}
              </h3>
              <p className="text-xs text-slate-400">
                Configure role, designation, department, approval limits, and module permissions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close user modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 px-6 pt-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Profile & Role Authority</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('modules')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'modules'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Module-Wise Access (21 Modules)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('actions')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'actions'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Action Authorities (CRUD + Approve)</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {formError && (
            <div
              role="alert"
              className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Employee / User Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Vikram Bhavsar"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. vikram.procure"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Corporate Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vickybhavsar960@gmail.com"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="+91 98201 12345"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Role, Department, Designation */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-blue-600" />
                    Role & Organizational Mapping
                  </span>
                  <button
                    type="button"
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                    onClick={() => applyRolePreset(role)}
                  >
                    Reset to Default Permissions Preset
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">System Role</label>
                    <select
                      value={role}
                      onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-semibold"
                    >
                      <option value="SUPER_ADMIN">Admin (Super Admin)</option>
                      <option value="PROCUREMENT_EMPLOYEE">Purchase User (Executive)</option>
                      <option value="PURCHASE_MANAGER">Purchase Manager</option>
                      <option value="APPROVAL_USER">Approval User (Controller)</option>
                      <option value="ACCOUNTS_USER">Accounts User (Finance)</option>
                      <option value="STORE_USER">Store User (Warehouse)</option>
                      <option value="MANAGEMENT_VIEWER">Management / Viewer</option>
                      <option value="SALES_EXECUTIVE">Sales Executive</option>
                      <option value="VENDOR">Vendor Partner</option>
                      <option value="CUSTOMER">Customer Client</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Department</label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Sourcing & Procurement"
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Designation</label>
                    <input
                      type="text"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="e.g. Senior Buyer"
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Approval Authority Limit (INR)
                    </label>
                    <div className="relative">
                      <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="number"
                        value={approvalLimit}
                        onChange={(e) => setApprovalLimit(Number(e.target.value))}
                        placeholder="0 for Unlimited (Admin)"
                        className="w-full text-xs pl-8 pr-2.5 py-2 border border-slate-300 rounded-lg bg-white font-mono"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      {approvalLimit === 0 ? 'Unlimited PO/RFQ approval authority' : `Authority up to ₹${approvalLimit.toLocaleString('en-IN')}`}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Account Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-bold"
                    >
                      <option value="ACTIVE">ACTIVE (Can Log In)</option>
                      <option value="INACTIVE">INACTIVE (Deactivated / Suspended)</option>
                    </select>
                  </div>
                </div>

                {(role === 'VENDOR' || role === 'CUSTOMER') && (
                  <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Linked {role === 'VENDOR' ? 'Vendor Master' : 'Customer Master'}
                      </label>
                      <select
                        value={associatedId}
                        onChange={(e) => {
                          setAssociatedId(e.target.value);
                          if (role === 'VENDOR') {
                            const v = vendors.find((vend) => vend.id === e.target.value);
                            if (v) setCompanyName(v.companyName);
                          } else {
                            const c = customers.find((cust) => cust.id === e.target.value);
                            if (c) setCompanyName(c.companyName);
                          }
                        }}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="">-- Select Master Link --</option>
                        {role === 'VENDOR'
                          ? vendors.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.id} - {v.companyName}
                              </option>
                            ))
                          : customers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.id} - {c.companyName}
                              </option>
                            ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Company Entity</label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Password Settings */}
              {!userToEdit && (
                <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-blue-950">Initial Credential Setup</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Initial Password</label>
                      <input
                        type="text"
                        value={tempPassword}
                        onChange={(e) => setTempPassword(e.target.value)}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-mono"
                      />
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={forcePasswordChange}
                          onChange={(e) => setForcePasswordChange(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span>Force password reset on first login</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Module-Wise Permissions Tab */}
          {activeTab === 'modules' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-blue-50 p-3 rounded-xl border border-blue-200 text-xs">
                <span className="text-blue-950 font-semibold">
                  Module Access Control: Select which ERP sections <strong>{name || 'this user'}</strong> can navigate to.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allTrue = Object.keys(modulePermissions).reduce(
                        (acc, k) => ({ ...acc, [k]: true }),
                        {} as ModulePermissions
                      );
                      setModulePermissions(allTrue);
                    }}
                    className="px-2.5 py-1 bg-blue-600 text-white rounded text-[11px] font-bold"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const allFalse = Object.keys(modulePermissions).reduce(
                        (acc, k) => ({ ...acc, [k]: false }),
                        {} as ModulePermissions
                      );
                      setModulePermissions(allFalse);
                    }}
                    className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 rounded text-[11px] font-medium"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                {[
                  { key: 'dashboard', label: 'Executive Dashboard' },
                  { key: 'requirements', label: '1. Requirements (REQ)' },
                  { key: 'rfqs', label: '2. RFQs & Vendor Quotes' },
                  { key: 'rateComparison', label: '3. Rate Comparison' },
                  { key: 'quotations', label: '4. Client Quotations (QTN)' },
                  { key: 'customerPos', label: '5. Customer PO (CPO)' },
                  { key: 'vendorPos', label: '6. Vendor PO (VPO)' },
                  { key: 'pi', label: '7. Proforma Invoice (PI)' },
                  { key: 'payments', label: '8. Payments & Finance (PAY)' },
                  { key: 'dispatch', label: '9. Dispatch & LR (DSP)' },
                  { key: 'delivery', label: '10. Delivery & Closed' },
                  { key: 'customers', label: 'Customer Master' },
                  { key: 'vendors', label: 'Vendor Master & AI Catalog' },
                  { key: 'categories', label: 'Category Master' },
                  { key: 'materials', label: 'Material Specifications' },
                  { key: 'products', label: 'Product Catalog' },
                  { key: 'reports', label: 'Financial Reports & Sheets' },
                  { key: 'documents', label: 'Document Center' },
                  { key: 'approvals', label: 'Approval Workflow' },
                  { key: 'userManagement', label: 'User & RBAC Management' },
                  { key: 'auditTrail', label: 'System Audit Trail' },
                ].map((item) => {
                  const isChecked = Boolean((modulePermissions as any)[item.key]);
                  return (
                    <label
                      key={item.key}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-blue-50/70 border-blue-300 text-blue-950 font-semibold shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-xs">{item.label}</span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleModule(item.key as any)}
                        className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Permissions Tab */}
          {activeTab === 'actions' && (
            <div className="space-y-4">
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900">
                Action-level authorization enforces whether user can perform modifications, approvals, or destructive actions across accessible modules.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { key: 'canView', label: 'View Records', desc: 'Can view screens and data lists' },
                  { key: 'canCreate', label: 'Create New Records', desc: 'Can raise REQ, RFQ, Quotes, POs' },
                  { key: 'canEdit', label: 'Edit & Update', desc: 'Can modify draft & in-progress records' },
                  { key: 'canDelete', label: 'Delete Records', desc: 'Can delete items (Restricted to Admin)' },
                  { key: 'canApprove', label: 'Approve & Sanction', desc: 'Can grant managerial approvals' },
                  { key: 'canExport', label: 'Export Data', desc: 'Can export to Excel & Google Sheets' },
                  { key: 'canPrint', label: 'Print Documents', desc: 'Can print official purchase/sale letters' },
                  { key: 'canDownload', label: 'Download PDFs', desc: 'Can save PDF quotes, POs, and bills' },
                  { key: 'canShare', label: 'Share & Email', desc: 'Can dispatch automated emails & notices' },
                ].map((act) => {
                  const isChecked = Boolean((actionPermissions as any)[act.key]);
                  return (
                    <button
                      type="button"
                      key={act.key}
                      onClick={() => toggleAction(act.key as any)}
                      aria-pressed={isChecked}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-emerald-50/60 border-emerald-300 text-slate-900 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs">{act.label}</span>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center text-white ${
                            isChecked ? 'bg-emerald-600' : 'border border-slate-300'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight">{act.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{userToEdit ? 'Save Changes' : 'Create User Account'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
