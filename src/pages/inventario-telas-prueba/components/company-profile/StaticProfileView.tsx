// Vista estática del perfil de empresa (cuando no está en modo edición).
// Solo lectura: razón social + RUT en el título, y debajo una grilla
// con Instagram / Página Web / Dirección como cards clickeables.

import { Instagram, Globe, MapPin } from 'lucide-react';
import type { CompanyProfile } from '../../types';

interface StaticProfileViewProps {
  profile: CompanyProfile;
}

export default function StaticProfileView({ profile }: StaticProfileViewProps) {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          {profile.razonSocial}
          <span className="text-xs font-normal text-neutral-300 bg-neutral-950 px-2.5 py-0.5 rounded-full border border-neutral-800/80">
            RUT: {profile.rut}
          </span>
        </h1>
        <p className="text-neutral-400 text-xs mt-0.5">Control corporativo & gestión automatizada de rollos de tela</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <DetailCard icon={<Instagram size={14} />} label="Instagram">
          <a
            href={`https://instagram.com/${profile.instagram.replace('@', '')}`}
            target="_blank"
            rel="noreferrer"
            className="text-neutral-200 hover:text-indigo-400 font-medium text-xs truncate block"
          >
            {profile.instagram}
          </a>
        </DetailCard>

        <DetailCard icon={<Globe size={14} />} label="Página Web">
          <a
            href={profile.paginaWeb.startsWith('http') ? profile.paginaWeb : `https://${profile.paginaWeb}`}
            target="_blank"
            rel="noreferrer"
            className="text-neutral-200 hover:text-indigo-400 font-medium text-xs truncate block"
          >
            {profile.paginaWeb}
          </a>
        </DetailCard>

        <DetailCard icon={<MapPin size={14} />} label="Dirección">
          <span className="text-neutral-200 font-medium text-xs truncate block">
            {profile.direccion}
          </span>
        </DetailCard>
      </div>
    </div>
  );
}

function DetailCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-950 border border-neutral-850">
      <div className="p-1.5 bg-indigo-950/40 text-indigo-400 border border-indigo-900/30 rounded-lg shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <span className="block text-[12px] text-neutral-400 font-semibold uppercase tracking-wider">{label}</span>
        {children}
      </div>
    </div>
  );
}
