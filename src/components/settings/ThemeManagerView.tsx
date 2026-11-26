import React, { useState } from 'react';
import {
  Palette,
  Check,
  Moon,
  Sun,
  Monitor,
  Sparkles,
  Zap,
  Sliders,
  CheckCircle2,
  RefreshCw,
  Layout,
  Briefcase,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ThemeConfig, ThemeMode } from '../../types';

interface PresetTheme {
  id: ThemeMode;
  name: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  sidebarStyle: 'DARK_MODERN' | 'CLEAN_LIGHT' | 'INDUSTRIAL_NAVY';
  cardStyle: 'GLASS' | 'SOLID_CLEAN' | 'BORDERED';
  previewBg: string;
  previewAccent: string;
}

const PRESET_THEMES: PresetTheme[] = [
  {
    id: 'MODERN',
    name: 'Modern Industrial',
    tagline: 'High-tech industrial procurement control center with vibrant electric blue and slate',
    primaryColor: '#2563eb',
    secondaryColor: '#0f172a',
    accentColor: '#10b981',
    sidebarStyle: 'DARK_MODERN',
    cardStyle: 'SOLID_CLEAN',
    previewBg: 'bg-slate-900',
    previewAccent: 'bg-blue-600',
  },
  {
    id: 'EXECUTIVE',
    name: 'Executive Sourcing',
    tagline: 'Deep navy and royal indigo tailored for C-suite procurement and finance management',
    primaryColor: '#4f46e5',
    secondaryColor: '#1e1b4b',
    accentColor: '#06b6d4',
    sidebarStyle: 'INDUSTRIAL_NAVY',
    cardStyle: 'SOLID_CLEAN',
    previewBg: 'bg-indigo-950',
    previewAccent: 'bg-indigo-600',
  },
  {
    id: 'INDUSTRIAL',
    name: 'Heavy Engineering',
    tagline: 'Bold amber and graphite contrast designed for shop-floor and plant MRO sourcing',
    primaryColor: '#d97706',
    secondaryColor: '#18181b',
    accentColor: '#22c55e',
    sidebarStyle: 'DARK_MODERN',
    cardStyle: 'BORDERED',
    previewBg: 'bg-zinc-900',
    previewAccent: 'bg-amber-600',
  },
  {
    id: 'PROFESSIONAL',
    name: 'Corporate Precision',
    tagline: 'Clean corporate steel blue with subtle borders and balanced ergonomic contrast',
    primaryColor: '#0284c7',
    secondaryColor: '#1e293b',
    accentColor: '#14b8a6',
    sidebarStyle: 'DARK_MODERN',
    cardStyle: 'SOLID_CLEAN',
    previewBg: 'bg-slate-800',
    previewAccent: 'bg-sky-600',
  },
  {
    id: 'LIGHT',
    name: 'Crisp Day Light',
    tagline: 'High-contrast light interface optimized for daylight plant inspection and laptops',
    primaryColor: '#2563eb',
    secondaryColor: '#334155',
    accentColor: '#059669',
    sidebarStyle: 'CLEAN_LIGHT',
    cardStyle: 'SOLID_CLEAN',
    previewBg: 'bg-slate-100',
    previewAccent: 'bg-blue-600',
  },
  {
    id: 'DARK',
    name: 'OLED Midnight Dark',
    tagline: 'True black midnight theme conserving battery on mobile devices and OLED displays',
    primaryColor: '#3b82f6',
    secondaryColor: '#000000',
    accentColor: '#10b981',
    sidebarStyle: 'DARK_MODERN',
    cardStyle: 'GLASS',
    previewBg: 'bg-black',
    previewAccent: 'bg-blue-500',
  },
];

export const ThemeManagerView: React.FC = () => {
  const { theme, updateTheme } = useApp();

  const [currentTheme, setCurrentTheme] = useState<ThemeConfig>({ ...theme });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleApplyPreset = (preset: PresetTheme) => {
    const updated: ThemeConfig = {
      ...currentTheme,
      mode: preset.id,
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
      accentColor: preset.accentColor,
      sidebarStyle: preset.sidebarStyle,
      cardStyle: preset.cardStyle,
    };
    setCurrentTheme(updated);
    updateTheme(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSaveCustom = async () => {
    setIsSaving(true);
    try {
      await updateTheme(currentTheme);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto animate-in fade-in duration-150">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Theme System & Visual Experience Manager</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                User Persistent
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Personalize colors, card densities, sidebar styles, and visual animation levels for Desktop and Mobile
            </p>
          </div>
        </div>

        <button
          onClick={handleSaveCustom}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-all shrink-0"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{isSaving ? 'Applying...' : 'Save Theme Preferences'}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Theme preferences applied live to interface and synchronized with your user profile.</span>
        </div>
      )}

      {/* PRESET THEMES CARDS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Industrial Curated Theme Presets</span>
          </h3>
          <span className="text-[11px] text-slate-400">Click any preset to apply instantly</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PRESET_THEMES.map((preset) => {
            const isSelected = currentTheme.mode === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => handleApplyPreset(preset)}
                className={`cursor-pointer p-4 rounded-2xl border-2 transition-all space-y-3 relative overflow-hidden bg-white hover:shadow-md ${
                  isSelected
                    ? 'border-indigo-600 ring-4 ring-indigo-500/10 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 px-2 py-0.5 bg-indigo-600 text-white rounded-full text-[10px] font-bold flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>Active</span>
                  </div>
                )}

                {/* Theme Palette Bar */}
                <div className="h-14 rounded-xl flex overflow-hidden border border-slate-200 shadow-2xs">
                  <div
                    className="w-1/3 flex items-center justify-center font-bold text-[10px] text-white"
                    style={{ backgroundColor: preset.secondaryColor }}
                  >
                    Nav
                  </div>
                  <div
                    className="w-1/2 flex items-center justify-center font-bold text-[10px] text-white"
                    style={{ backgroundColor: preset.primaryColor }}
                  >
                    Primary
                  </div>
                  <div
                    className="w-1/6 flex items-center justify-center"
                    style={{ backgroundColor: preset.accentColor }}
                  />
                </div>

                <div>
                  <h4 className="font-bold text-sm text-slate-900">{preset.name}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{preset.tagline}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DETAILED PALETTE & ERGONOMIC CUSTOMIZATION */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
          <Sliders className="w-4 h-4 text-blue-600" />
          <span>Advanced Custom Colors & Layout Density</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Primary Color Picker */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-slate-50/50">
            <label className="block text-xs font-bold text-slate-700">Primary Brand Accent</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={currentTheme.primaryColor}
                onChange={(e) => setCurrentTheme({ ...currentTheme, primaryColor: e.target.value })}
                className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300 p-0.5"
              />
              <input
                type="text"
                value={currentTheme.primaryColor}
                onChange={(e) => setCurrentTheme({ ...currentTheme, primaryColor: e.target.value })}
                className="w-full text-xs font-mono p-2 border border-slate-300 rounded-lg text-slate-800"
              />
            </div>
            <p className="text-[10px] text-slate-400">Used for primary action buttons, active tabs, and main highlights.</p>
          </div>

          {/* Secondary Color Picker */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-slate-50/50">
            <label className="block text-xs font-bold text-slate-700">Navigation / Chrome Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={currentTheme.secondaryColor}
                onChange={(e) => setCurrentTheme({ ...currentTheme, secondaryColor: e.target.value })}
                className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300 p-0.5"
              />
              <input
                type="text"
                value={currentTheme.secondaryColor}
                onChange={(e) => setCurrentTheme({ ...currentTheme, secondaryColor: e.target.value })}
                className="w-full text-xs font-mono p-2 border border-slate-300 rounded-lg text-slate-800"
              />
            </div>
            <p className="text-[10px] text-slate-400">Used for sidebar background and dark header bars.</p>
          </div>

          {/* Accent Color Picker */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-slate-50/50">
            <label className="block text-xs font-bold text-slate-700">Success / Status Indicator</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={currentTheme.accentColor}
                onChange={(e) => setCurrentTheme({ ...currentTheme, accentColor: e.target.value })}
                className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300 p-0.5"
              />
              <input
                type="text"
                value={currentTheme.accentColor}
                onChange={(e) => setCurrentTheme({ ...currentTheme, accentColor: e.target.value })}
                className="w-full text-xs font-mono p-2 border border-slate-300 rounded-lg text-slate-800"
              />
            </div>
            <p className="text-[10px] text-slate-400">Used for approval badges, order closures, and positive KPIs.</p>
          </div>
        </div>

        {/* Animation Level & Density Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Animation & Motion Level</label>
            <select
              value={currentTheme.animationLevel}
              onChange={(e) => setCurrentTheme({ ...currentTheme, animationLevel: e.target.value as any })}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-slate-800"
            >
              <option value="FULL">Full Enterprise Motion (KPI Counters, Smooth Transitions)</option>
              <option value="REDUCED">Reduced Motion (Subtle Fades Only)</option>
              <option value="MINIMAL">Minimal (Immediate Instant Rendering)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Interface Density</label>
            <select
              value={currentTheme.density}
              onChange={(e) => setCurrentTheme({ ...currentTheme, density: e.target.value as any })}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-slate-800"
            >
              <option value="COMFORTABLE">Comfortable (Optimal for Touch & Mobile)</option>
              <option value="COMPACT">Compact Data Grid (Maximum Records on Screen)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Card Corner Curvature</label>
            <select
              value={currentTheme.borderRadius}
              onChange={(e) => setCurrentTheme({ ...currentTheme, borderRadius: e.target.value as any })}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-slate-800"
            >
              <option value="ROUNDED">Modern Soft Rounded (16px)</option>
              <option value="SMOOTH">Classic Smooth (10px)</option>
              <option value="SHARP">Industrial Sharp (4px)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
