import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, FolderOpen, Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ODIOS_ESTADOS, ESTADOS_ACTIVOS, diasDesde } from '@/modules/admin/constants';
import type { OT, OTEstado } from '@/modules/ots/types';

type Props = {
  ots: OT[];
};

export function Dashboard({ ots }: Props) {
  const navigate = useNavigate();
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [diasAlerta, setDiasAlerta] = useState(5);

  const kpis = useMemo(() => {
    const total = ots.length;
    const enProd = ots.filter((o) => o.estado === 'produccion').length;
    const entregadas = ots.filter((o) => o.estado === 'instalada' || o.estado === 'lista').length;
    const clientes = new Set(
      ots.map((o) => (o.datosGenerales?.cliente || '').trim().toLowerCase()).filter(Boolean),
    ).size;
    return { total, enProd, entregadas, clientes };
  }, [ots]);

  const conteos = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of ots) {
      const k = o.estado || 'sin_estado';
      m[k] = (m[k] || 0) + 1;
    }
    return m;
  }, [ots]);

  const maxConteo = Math.max(...Object.values(conteos), 1);

  const estancadas = useMemo(() => {
    const ahora = Date.now();
    return ots
      .filter((o) => {
        if (!ESTADOS_ACTIVOS.includes(o.estado as OTEstado)) return false;
        const mod = new Date(o.fechaModificacion || o.fechaCreacion || 0).getTime();
        return ahora - mod > diasAlerta * 86400000;
      })
      .sort(
        (a, b) => (a.fechaModificacion || '').localeCompare(b.fechaModificacion || ''),
      );
  }, [ots, diasAlerta]);

  const filtradas = useMemo(() => {
    const txt = filtroTexto.toLowerCase();
    const lista = ots.filter((o) => {
      const dg = o.datosGenerales || {};
      const okTxt =
        !txt ||
        (dg.ot || '').toLowerCase().includes(txt) ||
        (dg.cliente || '').toLowerCase().includes(txt);
      const okEst = !filtroEstado || o.estado === filtroEstado;
      return okTxt && okEst;
    });
    lista.sort((a, b) =>
      (b.fechaModificacion || '').localeCompare(a.fechaModificacion || ''),
    );
    return lista;
  }, [ots, filtroTexto, filtroEstado]);

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

  const ahora = Date.now();

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="OTs Totales" value={kpis.total} color="#3b82f6" />
        <KpiCard label="En Producción" value={kpis.enProd} color="#f59e0b" />
        <KpiCard label="Cerradas" value={kpis.entregadas} color="#22c55e" />
        <KpiCard label="Clientes Únicos" value={kpis.clientes} color="#a855f7" />
      </div>

      {/* Alertas */}
      {estancadas.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/15 p-3">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <strong className="text-sm text-warning">OTs Estancadas</strong>
            <span className="text-xs text-muted-foreground">
              ({estancadas.length} sin movimiento hace más de {diasAlerta} días)
            </span>
            <div className="ml-auto flex items-center gap-1">
              <SlidersHorizontal className="h-3 w-3 text-muted-foreground" />
              <label className="text-[0.68rem] text-muted-foreground">Alerta después de</label>
              <Input
                type="number"
                value={diasAlerta}
                onChange={(e) => setDiasAlerta(parseInt(e.target.value) || 5)}
                min={1}
                max={60}
                className="h-7 w-14 text-xs"
              />
              <span className="text-[0.68rem] text-muted-foreground">días</span>
            </div>
          </div>
          <div className="space-y-1">
            {estancadas.map((o) => {
              const dg = o.datosGenerales || {};
              const dSin = Math.floor(
                (ahora - new Date(o.fechaModificacion || o.fechaCreacion || 0).getTime()) /
                  86400000,
              );
              const ecfg = ODIOS_ESTADOS[o.estado] || {
                label: o.estado,
                color: '#94a3b8',
                bg: 'rgba(148,163,184,0.1)',
              };
              return (
                <div
                  key={o.id}
                  className="flex items-center gap-2 rounded bg-warning/15 p-2 text-xs"
                >
                  <strong className="text-warning">{dg.ot || '—'}</strong>
                  <span className="text-muted-foreground">—</span>
                  <span className="text-foreground">{dg.cliente || '—'}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[0.65rem] font-semibold"
                    style={{ backgroundColor: ecfg.bg, color: ecfg.color }}
                  >
                    {ecfg.label}
                  </span>
                  <span className="ml-auto text-[0.68rem] text-muted-foreground">
                    hace {dSin} días
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[0.65rem]"
                    onClick={() => abrirOT(o)}
                  >
                    Ver
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Barras + Tabla OTs */}
      <div className="rounded-lg border border-border bg-card/40 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <strong className="text-sm">Todas las OTs</strong>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                placeholder="OT o cliente..."
                className="h-8 w-40 pl-7 text-xs"
              />
            </div>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="h-8 rounded border border-border bg-card px-2 text-xs text-foreground"
            >
              <option value="">Todos los estados</option>
              {Object.entries(ODIOS_ESTADOS).map(([k, cfg]) => (
                <option key={k} value={k}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Barras por estado */}
        <div className="mb-3 space-y-1">
          {Object.entries(ODIOS_ESTADOS).map(([k, cfg]) => {
            const n = conteos[k] || 0;
            if (!n) return null;
            const pct = Math.round((n / maxConteo) * 100);
            return (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span
                  className="min-w-[90px] font-semibold"
                  style={{ color: cfg.color }}
                >
                  {cfg.label}
                </span>
                <div className="h-3.5 flex-1 overflow-hidden rounded bg-card">
                  <div
                    className="h-full rounded transition-all"
                    style={{ width: `${pct}%`, backgroundColor: cfg.color, opacity: 0.7 }}
                  />
                </div>
                <span
                  className="min-w-[24px] text-right text-xs font-bold"
                  style={{ color: cfg.color }}
                >
                  {n}
                </span>
              </div>
            );
          })}
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-card text-[0.65rem] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-2 text-left">OT #</th>
                <th className="p-2 text-left">Cliente</th>
                <th className="p-2 text-left">Estado</th>
                <th className="p-2 text-center">Vents</th>
                <th className="p-2 text-left">Días</th>
                <th className="p-2 text-left">Nota admin</th>
                <th className="p-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">
                    Sin resultados
                  </td>
                </tr>
              )}
              {filtradas.map((o) => {
                const dg = o.datosGenerales || {};
                const est = o.estado || 'sin_estado';
                const ecfg = ODIOS_ESTADOS[est] || {
                  label: est,
                  color: '#94a3b8',
                  bg: 'rgba(148,163,184,0.1)',
                };
                const vents = (o.storeVentanas || []).length;
                const dias = diasDesde(o.fechaModificacion || o.fechaCreacion);
                const mod = new Date(o.fechaModificacion || o.fechaCreacion || 0).getTime();
                const estancada =
                  ESTADOS_ACTIVOS.includes(est as OTEstado) &&
                  ahora - mod > diasAlerta * 86400000;
                const nota = (o.notas || '').slice(0, 40);
                return (
                  <tr
                    key={o.id}
                    className="border-t border-border hover:bg-card"
                    style={estancada ? { backgroundColor: 'rgba(245,158,11,0.06)' } : undefined}
                  >
                    <td className="p-2">
                      <strong className="text-accent">
                        {estancada && '⚠️ '}
                        {dg.ot || '—'}
                      </strong>
                    </td>
                    <td className="p-2 text-foreground">{dg.cliente || '—'}</td>
                    <td className="p-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[0.63rem] font-bold"
                        style={{ backgroundColor: ecfg.bg, color: ecfg.color }}
                      >
                        {ecfg.label}
                      </span>
                    </td>
                    <td className="p-2 text-center">{vents}</td>
                    <td
                      className="p-2 text-[0.68rem]"
                      style={{ color: estancada ? '#f59e0b' : '#a1a1aa' }}
                    >
                      {dias}
                    </td>
                    <td
                      className="max-w-[130px] truncate p-2 text-[0.68rem] text-muted-foreground"
                      title={o.notas || ''}
                    >
                      {nota || '—'}
                    </td>
                    <td className="p-2 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[0.65rem]"
                        onClick={() => abrirOT(o)}
                      >
                        <FolderOpen className="mr-1 h-3 w-3" />
                        Abrir
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-lg border bg-card/40 p-3 text-center"
      style={{ borderColor: color + '40' }}
    >
      <div className="text-2xl font-extrabold" style={{ color }}>
        {value}
      </div>
      <div className="mt-1 text-[0.68rem] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
