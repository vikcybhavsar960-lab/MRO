import React, { useState } from 'react';
import {
  Building2,
  Upload,
  Trash2,
  CheckCircle2,
  Globe,
  Mail,
  Phone,
  FileText,
  Sparkles,
  Eye,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Moon,
  Sun,
  Layout,
  Layers,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ErpBrandingConfig } from '../../types';

export const ErpBrandingSettingsView: React.FC = () => {
  const { branding, updateBranding, currentUser } = useApp();

  const [form, setForm] = useState<ErpBrandingConfig>({ ...branding });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'darkLogoUrl' | 'mobileLogoUrl' | 'faviconUrl' | 'sidebarLogoUrl' | 'pdfLogoUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Image size exceeds 2 MB. Please select a smaller logo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setForm((prev) => ({ ...prev, [field]: base64 }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = (field: 'logoUrl' | 'darkLogoUrl' | 'mobileLogoUrl' | 'faviconUrl' | 'sidebarLogoUrl' | 'pdfLogoUrl') => {
    setForm((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      await updateBranding(form);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save branding settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset branding to original default MRO PROCUREMENT SOLUTION settings?')) {
      const defaults: ErpBrandingConfig = {
        erpName: 'MRO PROCUREMENT SOLUTION',
        tagline: 'Enterprise B2B Industrial Sourcing & Supply Chain ERP',
        companyName: 'MRO Procurement Solution Private Limited',
        shortName: 'ProcureMRO',
        address: 'Plot 42, Sector 18, Industrial Area, Phase II',
        phone: '+91 98200 11223',
        email: 'procurement@mro-solution.com',
        website: 'https://mro-solution.com',
        gstin: '27AABCM9012K1Z9',
        cin: 'U74999MH2024PTC392810',
        logoUrl: '',
        darkLogoUrl: '',
        mobileLogoUrl: '',
        faviconUrl: '',
        sidebarLogoUrl: '',
        loginLogoUrl: '',
        pdfLogoUrl: '',
      };
      setForm(defaults);
      updateBranding(defaults);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto animate-in fade-in duration-150">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-200">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>ERP Branding & Custom Logo Studio</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Persistent Database Active
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize company logos, business identity, report headers, and ERP appearance across Desktop and Mobile
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>{isSaving ? 'Saving Changes...' : 'Save Branding'}</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Branding configuration successfully committed to authoritative central database. Real-time sync notified across all connected devices.</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* LOGO MANAGEMENT SECTION */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Layout className="w-4 h-4 text-blue-600" />
                <span>Company Logos & Visual Assets</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload transparent PNG, SVG, or high-res JPG files. Changes reflect across Navbar, Sidebar, PDFs, and Login screen.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. Primary Light Logo */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>Primary / Light Logo</span>
                </span>
                {form.logoUrl && (
                  <button
                    type="button"
                    onClick={() => handleRemoveLogo('logoUrl')}
                    className="text-[11px] text-rose-600 hover:text-rose-800 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              <div className="h-28 bg-white border border-dashed border-slate-300 rounded-lg flex items-center justify-center p-3 overflow-hidden">
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Primary Logo" className="max-h-full max-w-full object-contain" />
                ) : (
                  <div className="text-center text-slate-400 text-xs">
                    <Building2 className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                    <span>No primary logo set</span>
                  </div>
                )}
              </div>

              <label className="block">
                <span className="sr-only">Upload Primary Logo</span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/svg+xml, image/webp"
                  onChange={(e) => handleLogoUpload(e, 'logoUrl')}
                  className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </label>
              <p className="text-[10px] text-slate-400">Used for Light Theme, Navbar, and official correspondence.</p>
            </div>

            {/* 2. Dark Logo / Sidebar Logo */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Moon className="w-4 h-4 text-indigo-500" />
                  <span>Sidebar / Dark Logo</span>
                </span>
                {form.sidebarLogoUrl && (
                  <button
                    type="button"
                    onClick={() => handleRemoveLogo('sidebarLogoUrl')}
                    className="text-[11px] text-rose-600 hover:text-rose-800 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              <div className="h-28 bg-slate-900 border border-dashed border-slate-700 rounded-lg flex items-center justify-center p-3 overflow-hidden">
                {form.sidebarLogoUrl || form.darkLogoUrl ? (
                  <img src={form.sidebarLogoUrl || form.darkLogoUrl} alt="Dark Logo" className="max-h-full max-w-full object-contain" />
                ) : (
                  <div className="text-center text-slate-500 text-xs">
                    <Building2 className="w-8 h-8 mx-auto text-slate-600 mb-1" />
                    <span>No dark logo set</span>
                  </div>
                )}
              </div>

              <label className="block">
                <span className="sr-only">Upload Sidebar Logo</span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/svg+xml, image/webp"
                  onChange={(e) => handleLogoUpload(e, 'sidebarLogoUrl')}
                  className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
              </label>
              <p className="text-[10px] text-slate-400">Used inside the dark sidebar navigation and dark theme headers.</p>
            </div>

            {/* 3. Mobile / Compact App Icon */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-500" />
                  <span>Mobile & Favicon Icon</span>
                </span>
                {form.mobileLogoUrl && (
                  <button
                    type="button"
                    onClick={() => handleRemoveLogo('mobileLogoUrl')}
                    className="text-[11px] text-rose-600 hover:text-rose-800 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              <div className="h-28 bg-white border border-dashed border-slate-300 rounded-lg flex items-center justify-center p-3 overflow-hidden">
                {form.mobileLogoUrl || form.faviconUrl ? (
                  <img src={form.mobileLogoUrl || form.faviconUrl} alt="Mobile Icon" className="max-h-full max-w-full object-contain" />
                ) : (
                  <div className="text-center text-slate-400 text-xs">
                    <Layers className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                    <span>Square icon recommended (1:1)</span>
                  </div>
                )}
              </div>

              <label className="block">
                <span className="sr-only">Upload Mobile Icon</span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/svg+xml, image/webp, image/x-icon"
                  onChange={(e) => handleLogoUpload(e, 'mobileLogoUrl')}
                  className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                />
              </label>
              <p className="text-[10px] text-slate-400">Used on mobile screens and browser tab shortcut favicon.</p>
            </div>
          </div>
        </div>

        {/* APPLICATION & SYSTEM BRANDING */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>ERP System Identity & Branding</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Control the public title, header taglines, and brand naming displayed to customers and staff
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Primary ERP Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.erpName}
                onChange={(e) => setForm({ ...form, erpName: e.target.value })}
                required
                className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">Displayed in page titles, header bar, and main navigation.</p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                ERP Tagline / Subtitle
              </label>
              <input
                type="text"
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">Appears under ERP title and on login splash screen.</p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Short Brand / Abbreviation
              </label>
              <input
                type="text"
                value={form.shortName}
                onChange={(e) => setForm({ ...form, shortName: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">Used on mobile header badge and compact notifications.</p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Official Company Website
              </label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">Hyperlinked in generated emails and PDF footers.</p>
            </div>
          </div>
        </div>

        {/* LEGAL COMPANY INFORMATION (REPORTS & GST) */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>Legal Company Information & Document Headers</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              These details print on official Quotations, Purchase Orders, Proforma Invoices, and Reports
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Registered Legal Entity Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                required
                className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                GSTIN Number (15 Characters)
              </label>
              <input
                type="text"
                value={form.gstin}
                onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                maxLength={15}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Corporate Identity Number (CIN)
              </label>
              <input
                type="text"
                value={form.cin || ''}
                onChange={(e) => setForm({ ...form, cin: e.target.value.toUpperCase() })}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Procurement Department Phone
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Official Inquiries Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block font-bold text-slate-700 mb-1">
                Registered Head Office / Warehouse Address
              </label>
              <textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={2}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* BOTTOM SAVE BAR */}
        <div className="flex items-center justify-between p-4 bg-slate-900 text-white rounded-2xl shadow-xl">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-semibold">
              Changes apply instantly across all active desktop and mobile sessions.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
            >
              {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{isSaving ? 'Saving...' : 'Apply & Save Branding'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
