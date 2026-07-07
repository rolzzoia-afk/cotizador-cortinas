// Tab "Colmena" EN VIVO: lee colmena_panos y dibuja las colmenas físicas tal
// como el Excel. Una sección por ZONA, en uno de dos modos:
//   - 'grid'  (Galpón M×col, Liberado RACK #1-#4) → un paño por celda.
//   - 'slots' (Galpón ROLZZO) → estantes A/B/VR con VARIAS telas; click muestra la lista.
// Reemplaza al rack congelado (telas_slots).

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useParametrosCotizador } from '@/modules/cotizador/parametros';
import { confirmar } from '@/components/ui/confirm';
import type { ColmenaPano } from '@/modules/admin/colmena';
import {
  agruparPorZona,
  claveCelda,
  estadoColmena,
  enAlerta,
  tipoDeCodigo,
  tipoDominante,
  zonaDe,
  ZONAS,
  type EstadoColmena,
  type MapaRack,
  type SlotGalpon,
  type TipoTela,
} from '@/modules/telas/colmenaViva';
import { tipoBadgeCls } from '../utils/tipo-badge';
import LegendDot from '../components/LegendDot';
import type { Falla } from '../Telas.types';

interface ColmenaVivaTabProps {
  panos: ColmenaPano[];
  fallas: Falla[];
  onReload?: () => void | Promise<void>;
}

const ESTADO_LABEL: Record<EstadoColmena, string> = {
  activa: 'Activa',
  alerta: 'En alerta',
  usada: 'Usada',
  baja: 'Dada de baja',
};

type Estilo = { bg: string; border: string; color: string };
type Detalle = { titulo: string; panos: ColmenaPano[] };

function colorTipo(tipo: TipoTela, falla: boolean): Estilo {
  if (falla) return { bg: 'rgba(239,68,68,0.2)', border: 'rgba(239,68,68,0.45)', color: '#fca5a5' };
  switch (tipo) {
    case 'BK':
      return { bg: 'rgba(99,102,241,0.2)', border: 'rgba(99,102,241,0.4)', color: '#a5b4fc' };
    case 'DU':
      return { bg: 'rgba(168,85,247,0.2)', border: 'rgba(168,85,247,0.4)', color: '#d8b4fe' };
    case 'SC':
      return { bg: 'rgba(59,130,246,0.2)', border: 'rgba(59,130,246,0.4)', color: '#93c5fd' };
    case 'TR':
      return { bg: 'rgba(20,184,166,0.2)', border: 'rgba(20,184,166,0.4)', color: '#5eead4' };
    default:
      return { bg: 'rgba(113,113,122,0.2)', border: 'rgba(113,113,122,0.35)', color: '#d4d4d8' };
  }
}

const fmt = (n: number | null | undefined) => (n == null ? '–' : Math.round(n).toString());

export default function ColmenaVivaTab({ panos, fallas, onReload }: ColmenaVivaTabProps) {
  const { empresaId } = useAuth();
  const { parametros } = useParametrosCotizador();
  const [filtroTipo, setFiltroTipo] = useState<TipoTela | ''>('');
  const [incluirUsados, setIncluirUsados] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [bajando, setBajando] = useState<string | null>(null);

  const q = busqueda.trim().toLowerCase();
  // Fecha de referencia para la alerta de antigüedad (estable por montaje).
  const hoy = useMemo(() => new Date().toISOString(), []);
  const diasAlerta = parametros.diasAlertaColmena;
  const alertas = useMemo(
    () => panos.filter((p) => enAlerta(p, hoy, diasAlerta)),
    [panos, hoy, diasAlerta],
  );

  // Dar de baja una colmena vieja (Reglas Rolzzo, sección 6): sale del inventario
  // activo y se registra como merma con trazabilidad.
  const darDeBaja = async (p: ColmenaPano) => {
    if (!empresaId) return;
    const ok = await confirmar({
      titulo: 'Dar de baja la colmena',
      mensaje:
        `¿Dar de baja ${p.codigo} (${fmt(p.medida_ancho)}×${fmt(p.medida_alto)} cm)?\n\n` +
        'Sale del inventario activo y se registra como merma. No se usará en cortes.',
      confirmLabel: 'Dar de baja',
      destructivo: true,
    });
    if (!ok) return;
    setBajando(p.id);
    try {
      const now = new Date().toISOString();
      const { error: upErr } = await supabase
        .from('colmena_panos')
        .update({
          disponible: false,
          datos_extra: {
            ...(p.datos_extra || {}),
            baja: true,
            fecha_baja: now,
            motivo_baja: 'antiguedad',
          },
        })
        .eq('id', p.id);
      if (upErr) throw upErr;
      const { error: mErr } = await supabase.from('telas_mermas').insert({
        empresa_id: empresaId,
        codigo: p.codigo,
        medida_ancho: p.medida_ancho,
        medida_alto: p.medida_alto,
        motivo: 'baja_antiguedad',
        colmena_origen_id: p.id,
        fecha: now,
      });
      if (mErr) console.warn('[Colmena] merma de baja no registrada:', mErr.message);
      toast.success(`${p.codigo} dada de baja y registrada como merma.`);
      setDetalle(null);
      await onReload?.();
    } catch (e) {
      toast.error('No se pudo dar de baja: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBajando(null);
    }
  };

  const fallaCodes = useMemo(
    () =>
      new Set(
        fallas.filter((f) => f.resuelto === 'NO').map((f) => (f.codigo || '').toUpperCase().trim()),
      ),
    [fallas],
  );
  const tieneFalla = (p: ColmenaPano) => fallaCodes.has((p.codigo || '').toUpperCase().trim());

  // Las grillas/estantes se arman con TODOS los paños (estructura estable). El
  // filtro de tipo/disponibilidad atenúa las celdas; la búsqueda las resalta.
  const zonas = useMemo(() => agruparPorZona(panos), [panos]);

  const pasaFiltro = (p: ColmenaPano) =>
    (incluirUsados || p.disponible) && (!filtroTipo || tipoDeCodigo(p.codigo) === filtroTipo);
  const matchQ = (p: ColmenaPano) => q !== '' && (p.codigo || '').toLowerCase().includes(q);

  const totalVisible = useMemo(
    () => panos.filter(pasaFiltro).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panos, incluirUsados, filtroTipo],
  );

  // ── Celda de grilla (un paño o vacío) ──────────────────────────────
  const renderCelda = (p: ColmenaPano | undefined, key: string | number) => {
    if (!p) {
      return (
        <td key={key} className="p-0">
          <div className="h-10 rounded-sm bg-background/40" />
        </td>
      );
    }
    const est = colorTipo(tipoDeCodigo(p.codigo), tieneFalla(p));
    const visible = pasaFiltro(p);
    const match = matchQ(p);
    const opacity = !visible ? 0.15 : q && !match ? 0.35 : 1;
    return (
      <td key={key} className="p-0">
        <button
          onClick={() => setDetalle({ titulo: p.ubicacion || 'Paño', panos: [p] })}
          className="flex h-10 w-[66px] flex-col items-center justify-center overflow-hidden rounded-sm border px-0.5 leading-tight transition hover:scale-105"
          style={{ background: est.bg, color: est.color, borderColor: match ? '#fbbf24' : est.border, opacity }}
          title={`${p.codigo} · ${fmt(p.medida_ancho)}×${fmt(p.medida_alto)}${p.disponible ? '' : ' · usado'}`}
        >
          <span className="truncate font-bold">{p.codigo}</span>
          <span className="truncate text-[10px] opacity-70">
            {fmt(p.medida_ancho)}×{fmt(p.medida_alto)}
          </span>
        </button>
      </td>
    );
  };

  const renderRack = (r: MapaRack, filaPrefix: string, filaDesc: boolean) => {
    const filas = filaDesc ? [...r.filas].reverse() : r.filas;
    return (
      <div key={r.rack} className="overflow-x-auto rounded-xl border border-border bg-card p-3">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Rack {r.rack}
        </div>
        <table className="border-separate border-spacing-[3px] text-[11px]">
          <thead>
            <tr>
              <th className="w-7" />
              {r.cols.map((c) => (
                <th key={c} className="w-[66px] text-center font-normal text-muted-foreground">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila}>
                <td className="pr-1 text-right font-bold text-muted-foreground">
                  {filaPrefix}
                  {fila}
                </td>
                {r.cols.map((col) => renderCelda(r.celdas.get(claveCelda(fila, col)), col))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ── Estante multi-tela (modo slots) ────────────────────────────────
  const renderSlot = (s: SlotGalpon) => {
    const visibles = s.panos.filter(pasaFiltro).length;
    const est = colorTipo(tipoDominante(s.panos), s.panos.some(tieneFalla));
    const match = q !== '' && s.panos.some(matchQ);
    const opacity = visibles === 0 ? 0.15 : q && !match ? 0.35 : 1;
    return (
      <button
        key={s.slot}
        onClick={() => setDetalle({ titulo: s.slot, panos: s.panos })}
        className="flex h-11 w-[62px] flex-col items-center justify-center rounded-sm border px-0.5 text-[11px] leading-tight transition hover:scale-105"
        style={{ background: est.bg, color: est.color, borderColor: match ? '#fbbf24' : est.border, opacity }}
        title={`${s.slot} · ${s.panos.length} tela(s)`}
      >
        <span className="font-bold">{s.slot}</span>
        <span className="text-[10px] opacity-70">
          {visibles} tela{visibles === 1 ? '' : 's'}
        </span>
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-[1600px] p-4">
      {/* Controles */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="text-sm font-bold uppercase tracking-wider">
          Colmena
          <span className="ml-2 text-xs font-normal text-muted-foreground">{totalVisible} paños</span>
        </div>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value as TipoTela | '')}
          className="ml-2 rounded-md border border-border bg-card px-2 py-2 text-sm"
        >
          <option value="">Todos los tipos</option>
          <option value="BK">Blackout</option>
          <option value="DU">Duo</option>
          <option value="SC">Screen</option>
          <option value="TR">Translúcido</option>
        </select>
        <label className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-2 text-sm">
          <input
            type="checkbox"
            checked={incluirUsados}
            onChange={(e) => setIncluirUsados(e.target.checked)}
          />
          Incluir usados
        </label>
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar código (resalta)…"
            className="border-border bg-card pl-8"
          />
        </div>
        <div className="ml-auto flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <LegendDot color="#6366f1" label="Blackout" />
          <LegendDot color="#a855f7" label="Duo" />
          <LegendDot color="#3b82f6" label="Screen" />
          <LegendDot color="#14b8a6" label="Translúcido" />
          <LegendDot color="#ef4444" label="Con falla" />
          <LegendDot color="#f59e0b" label="En alerta (+90d)" />
        </div>
      </div>

      {alertas.length > 0 && (
        <button
          onClick={() =>
            setDetalle({ titulo: 'Colmenas en alerta (+90 días sin usar)', panos: alertas })
          }
          className="mb-4 flex w-full items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-left text-sm text-amber-300 transition hover:bg-amber-500/15"
        >
          <span className="font-bold">⚠ {alertas.length} colmena(s) en alerta</span>
          <span className="text-amber-200/70">
            más de 90 días sin usar — revisa su estado o da de baja
          </span>
        </button>
      )}

      {zonas.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          La colmena está vacía.
        </div>
      ) : (
        zonas.map((z) => {
          const cfg = ZONAS[z.zona];
          const label = cfg?.label ?? z.zona;
          const nZona = panos.filter((p) => zonaDe(p) === z.zona && pasaFiltro(p)).length;
          const sub =
            z.modo === 'grid'
              ? `${z.racks.length} racks`
              : `${z.sectores.reduce((n, s) => n + s.slots.length, 0)} estantes`;
          return (
            <section key={z.zona} className="mb-6">
              <div className="mb-2 flex items-baseline gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wider">{label}</h2>
                <span className="text-xs text-muted-foreground">
                  {nZona} paño{nZona === 1 ? '' : 's'} · {sub}
                </span>
              </div>

              {z.modo === 'grid' ? (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {z.racks.map((r) => renderRack(r, cfg?.filaPrefix ?? '', cfg?.filaDesc ?? false))}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {z.sectores.map((sec) => (
                    <div key={sec.pref} className="rounded-xl border border-border bg-card p-3">
                      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Sector {sec.pref}
                      </div>
                      <div className="flex flex-wrap gap-1.5">{sec.slots.map(renderSlot)}</div>
                    </div>
                  ))}
                </div>
              )}

              {z.huerfanos.length > 0 && (
                <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                  <div className="mb-1 font-bold text-amber-300">
                    {z.huerfanos.length} paño(s) sin ubicación válida
                  </div>
                  <div className="flex flex-wrap gap-2 text-muted-foreground">
                    {z.huerfanos.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setDetalle({ titulo: p.ubicacion || 'Paño', panos: [p] })}
                        className="rounded border border-border px-1.5 py-0.5 hover:text-foreground"
                      >
                        {p.codigo} ({p.ubicacion})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          );
        })
      )}

      {/* Detalle (lista de telas del estante/celda) */}
      {detalle && (
        <Dialog open onOpenChange={() => setDetalle(null)}>
          <DialogContent className="max-w-md border-border bg-card text-foreground">
            <DialogHeader>
              <DialogTitle>
                {detalle.titulo}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {detalle.panos.length} tela{detalle.panos.length === 1 ? '' : 's'}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
              {detalle.panos.map((p) => {
                const tipo = tipoDeCodigo(p.codigo);
                const { estado, dias } = estadoColmena(p, hoy, diasAlerta);
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[11px] font-bold',
                          tipoBadgeCls(tipo === 'OTRO' ? null : tipo),
                        )}
                      >
                        {tipo === 'OTRO' ? '—' : tipo}
                      </span>
                      <strong>{p.codigo}</strong>
                      {tieneFalla(p) && (
                        <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                          falla
                        </span>
                      )}
                      {estado === 'alerta' && (
                        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                          +90d
                        </span>
                      )}
                    </div>
                    <div className="text-right text-xs">
                      <div>
                        {fmt(p.medida_ancho)}×{fmt(p.medida_alto)} cm
                      </div>
                      <div className="text-muted-foreground">
                        {ESTADO_LABEL[estado]}
                        {dias != null ? ` · ${dias}d` : ''}
                        {p.ot_asignada ? ` · OT ${p.ot_asignada}` : ''}
                      </div>
                      {p.disponible && !p.datos_extra?.baja && (
                        <button
                          onClick={() => darDeBaja(p)}
                          disabled={bajando === p.id}
                          className="mt-1 rounded border border-destructive/40 px-1.5 py-0.5 text-[10px] text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
                        >
                          {bajando === p.id ? '…' : 'Dar de baja'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <Button onClick={() => setDetalle(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
