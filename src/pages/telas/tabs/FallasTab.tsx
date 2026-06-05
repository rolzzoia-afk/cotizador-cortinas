// Tab Fallas: lista de fallas reportadas con filtros + chart de severidad.
// Click en una fila abre FallaDialog para editar; botón "Reportar Falla"
// abre el mismo dialog en modo nuevo.

import { useMemo, useState } from 'react';
import { Pencil, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FallaDialog from '../dialogs/FallaDialog';
import { tipoBadgeCls } from '../utils/tipo-badge';
import type { Falla, Tela, ValidadoresMap } from '../Telas.types';

interface FallasTabProps {
  fallas: Falla[];
  telas: Tela[];
  validadores: ValidadoresMap;
  empresaId: string;
  onReload: () => void;
}

export default function FallasTab({
  fallas,
  telas,
  validadores,
  empresaId,
  onReload,
}: FallasTabProps) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroRes, setFiltroRes] = useState('');
  const [filtroTF, setFiltroTF] = useState('');
  const [modalFalla, setModalFalla] = useState<Falla | null | undefined>(undefined);

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return fallas.filter((f) => {
      const matchQ =
        !q ||
        [f.codigo, f.nemotecnico, f.tipo_falla, f.proveedor, f.observaciones].some((v) =>
          (v || '').toLowerCase().includes(q),
        );
      const matchR = !filtroRes || f.resuelto === filtroRes;
      const matchTF = !filtroTF || f.tipo_falla === filtroTF;
      return matchQ && matchR && matchTF;
    });
  }, [fallas, busqueda, filtroRes, filtroTF]);

  return (
    <div className="mx-auto max-w-[1600px] p-4">
      <div className="mb-3 flex flex-wrap gap-2">
        <Button
          onClick={() => setModalFalla(null)}
          className="gap-1.5 bg-destructive hover:bg-destructive/90"
        >
          <Plus className="h-4 w-4" /> Reportar Falla
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <select
            value={filtroRes}
            onChange={(e) => setFiltroRes(e.target.value)}
            className="rounded-md border border-border bg-card px-2 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="NO">Pendientes</option>
            <option value="EN PROCESO">En proceso</option>
            <option value="SI">Resueltas</option>
          </select>
          <select
            value={filtroTF}
            onChange={(e) => setFiltroTF(e.target.value)}
            className="rounded-md border border-border bg-card px-2 py-2 text-sm"
          >
            <option value="">Todos los tipos</option>
            {(validadores.TIPO_FALLA || []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar…"
              className="w-56 border-border bg-card pl-8"
            />
          </div>
        </div>
      </div>

      <div className="overflow-auto rounded-2xl border border-border bg-card">
        <table className="w-full border-collapse text-[12px]" style={{ minWidth: 1400 }}>
          <thead>
            <tr className="border-b border-border bg-white/[0.03] text-[10px] uppercase tracking-wider text-muted-foreground">
              {[
                'Código',
                'Tipo',
                'Grupo',
                'Proveedor',
                'Nemotécnico',
                'Ancho',
                'Alto',
                'Obs',
                'Tipo falla',
                'Metraje',
                'Reporte',
                'Responsable',
                'Solución',
                'Estado',
                'Acciones',
              ].map((h) => (
                <th key={h} className="whitespace-nowrap px-2.5 py-2 text-left font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td colSpan={15} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Sin fallas — todo en orden ✓
                </td>
              </tr>
            ) : (
              lista.map((f) => {
                const badgeCls =
                  f.resuelto === 'SI'
                    ? 'bg-success/15 text-success border-success/30'
                    : f.resuelto === 'EN PROCESO'
                      ? 'bg-warning/15 text-warning border-warning/30'
                      : 'bg-destructive/15 text-destructive border-destructive/30';
                const badgeTxt =
                  f.resuelto === 'SI'
                    ? 'Resuelto'
                    : f.resuelto === 'EN PROCESO'
                      ? 'En proceso'
                      : 'Pendiente';
                return (
                  <tr key={f.id} className="border-b border-border hover:bg-secondary/40">
                    <td className="whitespace-nowrap px-2.5 py-2 font-bold">{f.codigo || '—'}</td>
                    <td className="px-2.5 py-2">
                      {f.tipo ? (
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[10px] font-bold',
                            tipoBadgeCls(f.tipo),
                          )}
                        >
                          {f.tipo}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-2.5 py-2 text-muted-foreground">{f.grupo || '—'}</td>
                    <td className="px-2.5 py-2 text-muted-foreground">{f.proveedor || '—'}</td>
                    <td className="px-2.5 py-2">{f.nemotecnico || '—'}</td>
                    <td className="px-2.5 py-2 text-center">{f.ancho ?? '—'}</td>
                    <td className="px-2.5 py-2 text-center">{f.alto ?? '—'}</td>
                    <td
                      className="max-w-[140px] truncate px-2.5 py-2 text-[11px] text-muted-foreground"
                      title={f.observaciones || ''}
                    >
                      {f.observaciones || '—'}
                    </td>
                    <td className="px-2.5 py-2">
                      {f.tipo_falla && (
                        <span className="rounded-full border border-warning/30 bg-warning/15 px-2 py-0.5 text-[10px] text-warning">
                          {f.tipo_falla}
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      {f.metraje != null ? `${f.metraje}m` : '—'}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2 text-[11px]">
                      {f.fecha_reporte || '—'}
                    </td>
                    <td className="px-2.5 py-2 text-[11px]">{f.responsable || '—'}</td>
                    <td
                      className="max-w-[140px] truncate px-2.5 py-2 text-[11px] text-muted-foreground"
                      title={f.solucion || ''}
                    >
                      {f.solucion || '—'}
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px] font-bold',
                          badgeCls,
                        )}
                      >
                        {badgeTxt}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <button
                        onClick={() => setModalFalla(f)}
                        className="rounded-md border border-border bg-secondary p-1.5 hover:border-accent/40 hover:bg-accent/10"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalFalla !== undefined && (
        <FallaDialog
          falla={modalFalla}
          telas={telas}
          validadores={validadores}
          empresaId={empresaId}
          onClose={() => setModalFalla(undefined)}
          onSaved={() => {
            setModalFalla(undefined);
            onReload();
          }}
        />
      )}
    </div>
  );
}
