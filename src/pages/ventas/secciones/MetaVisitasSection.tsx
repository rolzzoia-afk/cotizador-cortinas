// Sección "Meta de visitas diarias": tarjeta por vendedora con su progreso
// vs la meta de visitas configurada. La barra cambia de color según pct.

import SectionHeader from '../components/SectionHeader';
import NumInput from '../components/NumInput';
import { slugify, textoPeriodo } from '../utils/helpers';
import type { Periodo } from '../Ventas.types';
import { Target } from 'lucide-react';

interface MetaVisitasSectionProps {
  vendedoras: string[];
  metaVisitas: number;
  getVal: (clave: string) => number;
  setVal: (clave: string, valor: number) => void;
  periodo?: Periodo;
  /** Días del rango activo: la meta diaria se multiplica por este factor. */
  dias?: number;
  editable?: boolean;
}

export default function MetaVisitasSection({
  vendedoras,
  metaVisitas,
  getVal,
  setVal,
  periodo = 'dia',
  dias = 1,
  editable = true,
}: MetaVisitasSectionProps) {
  const txt = textoPeriodo(periodo);
  // En semana/mes la meta acumulada es la meta diaria × días del rango.
  const meta = Math.max(1, metaVisitas * Math.max(1, dias));
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <SectionHeader
        icon={<Target className="h-4 w-4" />}
        iconBg="rgba(34,197,94,0.15)"
        iconColor="#22c55e"
        title={`Meta de visitas ${txt.adjetivo}`}
        sub={
          <>
            Progreso de cada asesora vs meta de{' '}
            <strong className="text-foreground">{meta}</strong> visitas
            {dias > 1 ? ` (${metaVisitas}/día × ${dias} días)` : ''}
          </>
        }
      />
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}
      >
        {vendedoras.map((v) => {
          const visitas = getVal('meta_' + slugify(v));
          const pct = Math.min(Math.round((visitas / meta) * 100), 100);
          const color =
            visitas >= meta ? '#22c55e' : visitas >= meta * 0.6 ? '#f59e0b' : '#ef4444';
          return (
            <div key={v} className="rounded-xl border border-border bg-secondary p-3.5">
              <div className="mb-2.5 flex items-center justify-between">
                <div className="text-[13px] font-semibold text-foreground">{v}</div>
                <div className="flex items-center gap-1.5">
                  <NumInput
                    value={visitas}
                    onChange={(nv) => setVal('meta_' + slugify(v), nv)}
                    disabled={!editable}
                    className="w-16 rounded-md border border-border bg-card px-1 py-1 text-center text-[22px] font-extrabold text-foreground focus:border-accent focus:outline-none"
                  />
                  <span className="text-lg text-muted-foreground">/</span>
                  <span className="text-base font-bold text-muted-foreground">{meta}</span>
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
