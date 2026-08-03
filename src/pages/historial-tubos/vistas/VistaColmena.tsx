// Vista "Colmena" de tubería: qué hay en cada ubicación, en vivo.
//
// Espejo de la colmena de paños (src/pages/telas/tabs/ColmenaVivaTab.tsx) pero
// para `colmena_tubos`: como los tubos NO tienen coordenadas rack/fila/columna,
// se dibuja un estante por ubicación agrupado por sector (A, B, L…), con el
// conteo de tubos y el color de su familia dominante.
//
// Es SOLO LECTURA: las escrituras de tubos van por RPC atómica desde el
// optimizador (y el CRUD manual vive en Ojo de Dios). Acá se mira.

import { useMemo, useState } from 'react';
import { Boxes, Radio, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useParametrosCotizador } from '@/modules/cotizador/parametros';
import {
  agruparPorColmena,
  coincideBusqueda,
  diasEnColmena,
  enAlerta,
  familiaCod,
  LABEL_FAMILIA,
  type EstanteTubos,
  type FamiliaTubo,
  type TuboColmena,
} from '@/modules/tubos/colmenaTubos';
import EstanteTubo, { COLOR_FAMILIA } from '../components/EstanteTubo';
import EventoItem from '../components/EventoItem';
import EmptyState from '../components/EmptyState';
import StatBox from '../components/StatBox';
import { useColmenaViva, LIMITE_MOVIMIENTOS } from '../hooks/useColmenaViva';

const FAMILIAS: FamiliaTubo[] = [
  'TUBO',
  'PESO',
  'CENEFA',
  'PERFIL',
  'VERTICAL',
  'BEEBLACK',
  'OTRO',
];

interface VistaColmenaProps {
  empresaId: string | null | undefined;
}

export default function VistaColmena({ empresaId }: VistaColmenaProps) {
  const { tubos, ingresos, movimientos, loading, online, refrescar } = useColmenaViva(empresaId);
  const { parametros } = useParametrosCotizador();
  const [q, setQ] = useState('');
  const [familias, setFamilias] = useState<Set<FamiliaTubo>>(new Set());
  const [detalle, setDetalle] = useState<EstanteTubos | null>(null);
  // Congelado por montaje: si no, cada render recalcularía los días.
  const hoy = useMemo(() => new Date().toISOString(), []);
  const diasAlerta = parametros.diasAlertaColmena;

  const sectores = useMemo(() => agruparPorColmena(tubos), [tubos]);
  const buscando = q.trim().length > 0;

  const visible = (t: TuboColmena) => familias.size === 0 || familias.has(familiaCod(t.cod));

  const stats = useMemo(() => {
    const metros = tubos.reduce((s, t) => s + (Number(t.medida_cm) || 0), 0) / 100;
    const alertas = tubos.filter((t) => enAlerta(t, ingresos, hoy, diasAlerta)).length;
    const ubicaciones = new Set(tubos.map((t) => String(t.n_colmena ?? '').trim() || '—')).size;
    return { total: tubos.length, metros, alertas, ubicaciones };
  }, [tubos, ingresos, hoy, diasAlerta]);

  const toggleFamilia = (f: FamiliaTubo) => {
    setFamilias((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatBox value={String(stats.total)} label="Tubos en colmena" />
        <StatBox value={stats.metros.toFixed(1)} label="Metros lineales" />
        <StatBox value={String(stats.ubicaciones)} label="Ubicaciones" />
        <StatBox value={String(stats.alertas)} label={`En alerta (+${diasAlerta}d)`} />
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar código, ubicación o medida…"
          className="h-8 max-w-[260px] text-xs"
        />
        {FAMILIAS.map((f) => {
          const on = familias.has(f);
          const c = COLOR_FAMILIA[f];
          return (
            <button
              key={f}
              onClick={() => toggleFamilia(f)}
              className="rounded-full border px-2.5 py-1 text-[11px] transition"
              style={{
                background: on ? c.bg : 'transparent',
                borderColor: on ? c.border : 'hsl(var(--border))',
                color: on ? c.color : undefined,
              }}
            >
              {LABEL_FAMILIA[f]}
            </button>
          );
        })}
        {familias.size > 0 && (
          <button
            onClick={() => setFamilias(new Set())}
            className="text-[11px] text-muted-foreground underline"
          >
            limpiar
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-[11px]">
            <Radio className={`h-3 w-3 ${online ? 'text-success' : 'text-muted-foreground'}`} />
            {online ? 'En vivo' : 'Sin conexión'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refrescar()} className="h-8">
            <RefreshCw className="mr-1 h-3 w-3" />
            Refrescar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
        {/* Grilla de estantes por sector */}
        <div className="space-y-3">
          {loading && <div className="text-xs text-muted-foreground">Cargando colmena…</div>}
          {!loading && sectores.length === 0 && (
            <EmptyState>No hay tubos en la colmena.</EmptyState>
          )}
          {sectores.map((s) => (
            <div key={s.sector} className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center gap-2">
                <Boxes className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold uppercase tracking-wider">
                  {s.sector === '?' ? 'Sin ubicación' : `Sector ${s.sector}`}
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  {s.estantes.length} ubicación{s.estantes.length === 1 ? '' : 'es'} · {s.total} tubo
                  {s.total === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex flex-wrap gap-[3px]">
                {s.estantes.map((e) => (
                  <EstanteTubo
                    key={e.colmena}
                    estante={e}
                    visibles={e.tubos.filter(visible).length}
                    match={buscando && e.tubos.some((t) => coincideBusqueda(t, q))}
                    buscando={buscando}
                    alertas={e.tubos.filter((t) => enAlerta(t, ingresos, hoy, diasAlerta)).length}
                    onClick={() => setDetalle(e)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Movimientos recientes */}
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b px-3 py-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              Movimientos recientes
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Últimos {LIMITE_MOVIMIENTOS} eventos de tubería
            </p>
          </div>
          {movimientos.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">Sin movimientos registrados.</div>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto">
              {movimientos.map((e) => (
                <EventoItem key={e.id} e={e} />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Detalle de un estante */}
      <Dialog open={!!detalle} onOpenChange={(o) => !o && setDetalle(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {detalle?.colmena}
              {detalle?.nota ? ` · ${detalle.nota}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-1 overflow-y-auto">
            {detalle?.tubos.map((t) => {
              const fam = familiaCod(t.cod);
              const dias = diasEnColmena(t, ingresos, hoy);
              const alerta = enAlerta(t, ingresos, hoy, diasAlerta);
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-xs"
                >
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                    style={{
                      background: COLOR_FAMILIA[fam].bg,
                      color: COLOR_FAMILIA[fam].color,
                    }}
                  >
                    {t.cod}
                  </span>
                  <span className="font-semibold">{Number(t.medida_cm ?? 0).toFixed(1)} cm</span>
                  {alerta && (
                    <Badge variant="outline" className="text-[10px] text-warning">
                      +{diasAlerta}d
                    </Badge>
                  )}
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {dias != null ? `${dias} días` : 'sin ingreso'}
                    {t.serial ? ` · ${t.serial}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Total {detalle?.tubos.length ?? 0} tubo(s) · {detalle?.metros.toFixed(1)} m. Para editar
            usa Ojo de Dios → Colmena.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
