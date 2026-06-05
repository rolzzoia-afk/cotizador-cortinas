// Header sticky del módulo: logo + razón social + email/rol del usuario,
// tabs de navegación (Inventario / Historial / Empresa) y botón Salir.

import { Building2, Database, History, Scissors } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CompanyProfile } from '../types';

export type TabId = 'inventario' | 'historial' | 'empresa';

interface ModuleHeaderProps {
  profile: CompanyProfile;
  email: string | null;
  rol: string | null;
  activeTab: TabId;
  onChangeTab: (tab: TabId) => void;
}

export default function ModuleHeader({
  profile,
  email,
  rol,
  activeTab,
  onChangeTab,
}: ModuleHeaderProps) {
  const tabs: ReadonlyArray<{ id: TabId; label: string; icon: typeof Database }> = [
    { id: 'inventario', label: 'Inventario', icon: Database },
    { id: 'historial', label: 'Historial', icon: History },
    { id: 'empresa', label: 'Empresa', icon: Building2 },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#121212]/90 backdrop-blur-md border-b border-neutral-800/70 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-650 flex items-center justify-center text-white shadow-lg border border-indigo-500/30">
              {profile.logoUrl ? (
                <img src={profile.logoUrl} alt="Logo" className="w-full h-full object-contain rounded-xl p-0.5 bg-neutral-900" referrerPolicy="no-referrer" />
              ) : (
                <Scissors size={20} className="stroke-2" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-base tracking-tight">{profile.razonSocial}</span>
                <span className="text-[9px] font-mono font-bold bg-indigo-950/60 text-indigo-300 border border-indigo-900/40 px-1.5 py-0.5 rounded-sm">
                  Inventario de Rollos
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 tracking-wide font-medium">
                {profile.rut || 'RUT S/I'} · {email} ({rol})
              </p>
            </div>
          </div>

          <nav className="hidden md:flex space-x-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => onChangeTab(t.id)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeTab === t.id
                    ? 'bg-neutral-800 text-white border border-neutral-700/50 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <t.icon size={13} />
                {t.label}
              </button>
            ))}
          </nav>

          <Link to="/" className="text-xs text-neutral-400 hover:text-white px-3 py-1.5 rounded-md border border-neutral-800 hover:border-neutral-700">
            ← Salir
          </Link>
        </div>
      </div>
    </header>
  );
}
