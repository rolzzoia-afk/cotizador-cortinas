// Tab Mermas: lista de mermas de tela registradas (Reglas Rolzzo v1.0).
// Solo lectura — las escribe Fase 4 (corte general) y "dar de baja" en Colmena.
// Una merma es tela que NO llega al mínimo de colmena (120×180) o una colmena
// dada de baja por antigüedad.

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { tipoBadgeCls } from '../utils/tipo-badge';
import type { Merma } from '../Telas.types';

interface MermasTabProps {
  mermas: Merma[];
}

const MOTIVO_LABEL: Record<string, string> = {
  sobrante_colmena: 'Sobrante de colmena',
  sobrante_rollo: 'Sobrante de rollo',
  baja_antiguedad: 'Baja por antigüedad',
};

const motivoTxt = (m: string | null) => (m && MOTIVO_LABEL[m]) || m || '—';

const fmt = (n: number | null | undefined) => (n == null ? '–' : Math.round(n).toString());
const fecha = (s: string | null) => (s ? s.slice(0, 10) : '—');
// Prefijo de código → tipo de tela ("BK 13" → "BK"), para el badge de color.
const tipoDe = (codigo: string | null) => {
  const t = String(codigo ?? '').trim().toUpperCase().split(/\s+/)[0];
  return t === 'BK' || t === 'DU' || t === 'SC' || t === 'TR' ? t : null;
};

export default function MermasTab({ mermas }: MermasTabProps) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroMotivo, setFiltroMotivo] = useState('');

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return mermas
      .filter((m) => {
        const matchQ = !q || [m.codigo, m.ot_origen].some((v) => (v || '').toLowerCase().includes(q));
        const matchMot = !filtroMotivo || m.motivo === filtroMotivo;
        return matchQ && matchMot;
      })
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  }, [mermas, busqueda, filtroMotivo]);

  // KPIs: cantidad + metros² totales de la lista filtrada.
  const m2 = useMemo(
    () =>
      lista.reduce(
        (s, m) => s + ((m.medida_ancho || 0) * (m.medida_alto || 0)) / 10000,
        0,
      ),
    [lista],
  );

  return (
    <div className="mx-auto max-w-[1600px] p-4">
      {/* Controles + KPIs */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="text-sm font-bold uppercase tracking-wider">
          Mermas
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {lista.length} registro{lista.length === 1 ? '' : 's'} · {m2.toFixed(1)} m²
          </span>
        </div>
        <select
          value={filtroMotivo}
          onChange={(e) => setFiltroMotivo(e.target.value)}
          className="ml-2 rounded-md border border-border bg-card px-2 py-2 text-sm"
        >
          <option value="">Todos los motivos</option>
          <option value="sobrante_colmena">Sobrante de colmena</option>
          <option value="sobrante_rollo">Sobrante de rollo</option>
          <option value="baja_antiguedad">Baja por antigüedad</option>
        </select>
        <div className="relative ml-auto max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar código u OT…"
            className="border-border bg-card pl-8"
          />
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          No hay mermas registradas. Se generan al confirmar un corte general (remanente
          &lt; 120×180) o al dar de baja una colmena.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-2.5 py-2">Código</th>
                <th className="px-2.5 py-2">Medida</th>
                <th className="px-2.5 py-2">m²</th>
                <th className="px-2.5 py-2">Motivo</th>
                <th className="px-2.5 py-2">OT origen</th>
                <th className="px-2.5 py-2">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((m) => {
                const tipo = tipoDe(m.codigo);
                return (
                  <tr key={m.id} className="border-b border-border/50 last:border-0">
                    <td className="px-2.5 py-2">
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[11px] font-bold',
                          tipoBadgeCls(tipo),
                        )}
                      >
                        {m.codigo || '—'}
                      </span>
                    </td>
                    <td className="px-2.5 py-2">
                      {fmt(m.medida_ancho)}×{fmt(m.medida_alto)} cm
                    </td>
                    <td className="px-2.5 py-2 text-muted-foreground">
                      {(((m.medida_ancho || 0) * (m.medida_alto || 0)) / 10000).toFixed(2)}
                    </td>
                    <td className="px-2.5 py-2">{motivoTxt(m.motivo)}</td>
                    <td className="px-2.5 py-2 text-muted-foreground">{m.ot_origen || '—'}</td>
                    <td className="px-2.5 py-2 text-muted-foreground">{fecha(m.fecha)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
