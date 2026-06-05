// Sección "Meta de visitas diarias": tarjeta por vendedora con su progreso
// vs la meta de visitas configurada. La barra cambia de color según pct.

import SectionHeader from '../components/SectionHeader';
import NumInput from '../components/NumInput';
import { slugify } from '../utils/helpers';
import { Target } from 'lucide-react';

interface MetaVisitasSectionProps {
  vendedoras: string[];
  metaVisitas: number;
  getVal: (clave: string) => number;
  setVal: (clave: string, valor: number) => void;
}

export default function MetaVisitasSection({
  vendedoras,
  metaVisitas,
  getVal,
  setVal,
}: MetaVisitasSectionProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <SectionHeader
        icon={<Target className="h-4 w-4" />}
        iconBg="rgba(34,197,94,0.15)"
        iconColor="#22c55e"
        title="Meta de visitas diarias"
        sub={
          <>
            Progreso de cada asesora vs meta de{' '}
            <strong className="text-foreground">{metaVisitas}</strong> visitas
          </>
        }
      />
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}
      >
        {vendedoras.map((v) => {
          const visitas = getVal('meta_' + slugify(v));
          const pct = Math.min(Math.round((visitas / metaVisitas) * 100), 100);
          const color =
            visitas >= metaVisitas
              ? '#22c55e'
              : visitas >= metaVisitas * 0.6
                ? '#f59e0b'
                : '#ef4444';
          return (
            <div key={v} className="rounded-xl border border-border bg-secondary p-3.5">
              <div className="mb-2.5 flex items-center justify-between">
                <div className="text-[13px] font-semibold text-foreground">{v}</div>
                <div className="flex items-center gap-1.5">
                  <NumInput
                    value={visitas}
                    onChange={(nv) => setVal('meta_' + slugify(v), nv)}
                    className="w-16 rounded-md border border-border bg-card px-1 py-1 text-center text-[22px] font-extrabold text-foreground focus:border-accent focus:outline-none"
                  />
                  <span className="text-lg text-muted-foreground">/</span>
                  <span className="text-base font-bold text-muted-foreground">{metaVisitas}</span>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded bg-card">
                <div
                  className="h-full transition-all"
                  style={{ width: pct + '%', background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
