import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ODIOS_ESTADOS } from '@/modules/admin/constants';
import type { OT } from '@/modules/ots/types';

type Props = {
  ots: OT[];
};

export function Clientes({ ots }: Props) {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState('');
  const [detalle, setDetalle] = useState<string | null>(null);

  const grupos = useMemo(() => {
    const mapa: Record<string, OT[]> = {};
    for (const o of ots) {
      const name = (o.datosGenerales?.cliente || '(Sin nombre)').trim();
      if (!mapa[name]) mapa[name] = [];
      mapa[name].push(o);
    }
    const txt = filtro.toLowerCase();
    let entradas = Object.entries(mapa);
    if (txt) entradas = entradas.filter(([n]) => n.toLowerCase().includes(txt));
    // sort desc by latest fechaModificacion
    entradas.sort((a, b) => {
      const ua = [...a[1]].sort((x, y) =>
        (y.fechaModificacion || '').localeCompare(x.fechaModificacion || ''),
      )[0];
      const ub = [...b[1]].sort((x, y) =>
        (y.fechaModificacion || '').localeCompare(x.fechaModificacion || ''),
      )[0];
      return (ub?.fechaModificacion || '').localeCompare(ua?.fechaModificacion || '');
    });
    return entradas;
  }, [ots, filtro]);

  const otsDelDetalle = useMemo(() => {
    if (!detalle) return [];
    return ots
      .filter((o) => (o.datosGenerales?.cliente || '').trim() === detalle)
      .sort((a, b) =>
        (b.fechaModificacion || '').localeCompare(a.fechaModificacion || ''),
      );
  }, [ots, detalle]);

  const abrirOT = (ot: OT) => {
    localStorage.setItem('activeOTId', ot.id);
    if (ot.estado === 'cotizacion' || ot.estado === 'esperando') {
      navigate(`/ots/${ot.id}/fase1`);
    } else if (ot.estado === 'terreno') {
      navigate(`/ots/${ot.id}/fase2`);
    } else if (ot.estado === 'produccion') {
      navigate(`/ots/${ot.id}/fase4`);
    } else {
      navigate(`/ots/${ot.id}/fase3`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card/40 p-3">
        <div className="mb-3 flex items-center justify-between">
          <strong className="text-sm">Historial por Cliente</strong>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar cliente..."
              className="h-8 w-56 pl-7 text-xs"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-card text-[0.65rem] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Cliente</th>
                <th className="p-2 text-center">Total OTs</th>
                <th className="p-2 text-left">Última OT</th>
                <th className="p-2 text-left">Último estado</th>
                <th className="p-2 text-center">Ventanas</th>
                <th className="p-2 text-right">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {grupos.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    Sin clientes
                  </td>
                </tr>
              )}
              {grupos.map(([nombre, otsCliente]) => {
                const sorted = [...otsCliente].sort((a, b) =>
                  (b.fechaModificacion || '').localeCompare(a.fechaModificacion || ''),
                );
                const ultimo = sorted[0];
                const dg = ultimo.datosGenerales || {};
                const est = ultimo.estado || '—';
                const ecfg = ODIOS_ESTADOS[est] || {
                  label: est,
                  color: '#94a3b8',
                  bg: 'rgba(148,163,184,0.1)',
                };
                const totalV = otsCliente.reduce(
                  (s, o) => s + (o.storeVentanas || []).length,
                  0,
                );
                const fechaU = (ultimo.fechaModificacion || '').slice(0, 10) || '—';
                return (
                  <tr key={nombre} className="border-t border-border hover:bg-card">
                    <td className="p-2">
                      <strong>{nombre}</strong>
                    </td>
                    <td className="p-2 text-center">{otsCliente.length}</td>
                    <td className="p-2 text-foreground">
                      {dg.ot || '—'}{' '}
                      <span className="text-muted-foreground">({fechaU})</span>
                    </td>
                    <td className="p-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[0.63rem] font-bold"
                        style={{ backgroundColor: ecfg.bg, color: ecfg.color }}
                      >
                        {ecfg.label}
                      </span>
                    </td>
                    <td className="p-2 text-center">{totalV}</td>
                    <td className="p-2 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[0.65rem]"
                        onClick={() => setDetalle(nombre)}
                      >
                        Ver historial
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Panel de detalle */}
        {detalle && (
          <div className="mt-3 rounded border border-blue-500/20 bg-background/50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <strong className="text-blue-300">{detalle}</strong>
              <button
                onClick={() => setDetalle(null)}
                className="rounded p-1 text-muted-foreground hover:bg-card hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[0.72rem]">
                <thead className="bg-card text-[0.62rem] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-1.5 text-left">OT #</th>
                    <th className="p-1.5 text-left">Estado</th>
                    <th className="p-1.5 text-center">Ventanas</th>
                    <th className="p-1.5 text-left">Fecha</th>
                    <th className="p-1.5 text-right">Abrir</th>
                  </tr>
                </thead>
                <tbody>
                  {otsDelDetalle.map((o) => {
                    const dg = o.datosGenerales || {};
                    const ecfg = ODIOS_ESTADOS[o.estado] || {
                      label: o.estado,
                      color: '#94a3b8',
                      bg: 'rgba(148,163,184,0.1)',
                    };
                    return (
                      <tr key={o.id} className="border-t border-border">
                        <td className="p-1.5">
                          <strong className="text-accent">{dg.ot || '—'}</strong>
                        </td>
                        <td className="p-1.5">
                          <span
                            className="rounded-full px-2 py-0.5 text-[0.6rem] font-bold"
                            style={{ backgroundColor: ecfg.bg, color: ecfg.color }}
                          >
                            {ecfg.label}
                          </span>
                        </td>
                        <td className="p-1.5 text-center">
                          {(o.storeVentanas || []).length}
                        </td>
                        <td className="p-1.5 text-muted-foreground">
                          {(o.fechaModificacion || '').slice(0, 10) || '—'}
                        </td>
                        <td className="p-1.5 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[0.6rem]"
                            onClick={() => abrirOT(o)}
                          >
                            <FolderOpen className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
