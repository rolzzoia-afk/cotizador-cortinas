// La colmena de tubería, estante por estante (lámina «Tubos de aluminio»).
//
// Cada estante muestra sus PIEZAS, no solo cuántas hay: en un galpón lo que
// se busca es «un E 39 de 248», no «A28 tiene 19». Al clicar una pieza, el
// panel de la derecha cuenta su recorrido — de qué barra salió, en qué OT se
// cortó, dónde volvió a quedar.
//
// Es SOLO LECTURA: el optimizador es el único que escribe los tubos y el CRUD
// manual vive en Ojo de Dios. Acá se mira, se busca y se corrige a mano.

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Radio, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ChipFiltro } from '@/components/inventario/ChipsFiltro';
import { useParametrosCotizador } from '@/modules/cotizador/parametros';
import {
  agruparPorColmena,
  coincideBusqueda,
  diasEnColmena,
  familiaCod,
  LABEL_FAMILIA,
  type FamiliaTubo,
  type TuboColmena,
} from '@/modules/tubos/colmenaTubos';
import { mezclaGrisYBlanco, recorridoDeTubo } from '@/modules/tubos/fichaTubo';
import EstanteCard from '../components/EstanteCard';
import FichaTuboPanel from '../components/FichaTuboPanel';
import { useColmenaViva } from '../hooks/useColmenaViva';
import { useRecorridoTubo } from '../hooks/useRecorridoTubo';

const FAMILIAS: FamiliaTubo[] = [
  'TUBO',
  'PESO',
  'CENEFA',
  'PERFIL',
  'VERTICAL',
  'BEEBLACK',
  'OTRO',
];

/** Cuántos resultados de la búsqueda se ofrecen en el panel. */
const MAX_COINCIDENCIAS = 8;

interface VistaColmenaProps {
  empresaId: string | null | undefined;
  /** Los conteos vivos, para el encabezado y el badge de la pestaña. */
  onResumen: (r: { tubos: number; metros: number }) => void;
  /** Lleva a la pestaña Trazabilidad con este tubo ya buscado. */
  onVerHistorial: (tubo: TuboColmena) => void;
}

export default function VistaColmena({
  empresaId,
  onResumen,
  onVerHistorial,
}: VistaColmenaProps) {
  const { tubos, ingresos, loading, online, refrescar } = useColmenaViva(empresaId);
  const { parametros } = useParametrosCotizador();
  const [q, setQ] = useState('');
  const [familias, setFamilias] = useState<Set<FamiliaTubo>>(new Set());
  const [elegidoId, setElegidoId] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  // Congelado por montaje: si no, cada render recalcularía los días.
  const hoy = useMemo(() => new Date().toISOString(), []);
  const diasAlerta = parametros.diasAlertaColmena;

  const sectores = useMemo(() => agruparPorColmena(tubos), [tubos]);
  const visible = (t: TuboColmena) => familias.size === 0 || familias.has(familiaCod(t.cod));
  const resaltado = (t: TuboColmena) => q.trim() !== '' && coincideBusqueda(t, q);

  const coincidencias = useMemo(
    () => (q.trim() === '' ? [] : tubos.filter((t) => coincideBusqueda(t, q)).slice(0, MAX_COINCIDENCIAS)),
    [tubos, q],
  );

  const elegido = useMemo(() => tubos.find((t) => t.id === elegidoId) ?? null, [tubos, elegidoId]);
  const { eventos, loading: cargandoRecorrido } = useRecorridoTubo(elegido?.tubo_raiz_id);
  const dias = elegido ? diasEnColmena(elegido, ingresos, hoy) : null;
  const recorrido = useMemo(
    () => (elegido ? recorridoDeTubo(eventos, { enColmena: true, dias }) : []),
    [elegido, eventos, dias],
  );

  const alertas = useMemo(
    () => tubos.filter((t) => (diasEnColmena(t, ingresos, hoy) ?? 0) > diasAlerta).length,
    [tubos, ingresos, hoy, diasAlerta],
  );

  // El encabezado y el badge de la pestaña viven arriba, pero el dato lo tiene
  // esta vista: se lo pasa cuando cambia.
  const metros = useMemo(
    () => tubos.reduce((s, t) => s + (Number(t.medida_cm) || 0), 0) / 100,
    [tubos],
  );
  useEffect(() => {
    if (!loading) onResumen({ tubos: tubos.length, metros });
  }, [loading, tubos.length, metros, onResumen]);

  const alternar = <T,>(set: Set<T>, v: T): Set<T> => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {FAMILIAS.map((f) => (
          <ChipFiltro
            key={f}
            activo={familias.has(f)}
            onClick={() => setFamilias((s) => alternar(s, f))}
          >
            {LABEL_FAMILIA[f]}
          </ChipFiltro>
        ))}
        {familias.size > 0 && (
          <button
            type="button"
            onClick={() => setFamilias(new Set())}
            className="text-[0.72rem] text-muted-foreground underline hover:text-foreground"
          >
            limpiar
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {alertas > 0 && (
            <Badge variant="warning">
              {alertas} sobre {diasAlerta} días
            </Badge>
          )}
          <Badge variant="outline" className="gap-1">
            <Radio className={online ? 'h-3 w-3 text-success' : 'h-3 w-3 text-muted-foreground'} />
            {online ? 'En vivo' : 'Sin conexión'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => void refrescar()}>
            <RefreshCw className="h-3 w-3" />
            Refrescar
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1fr)_316px]">
        <div className="flex min-h-0 flex-col gap-2.5 overflow-hidden rounded-lg border border-border bg-card p-4">
          <div className="min-h-0 flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : sectores.length === 0 ? (
              <EmptyState
                titulo="La colmena está vacía"
                texto="No hay tubos registrados. Los escribe el optimizador de corte al guardar un plan."
              />
            ) : (
              <div className="flex flex-col gap-4">
                {sectores.map((s) => {
                  // El optimizador no junta el tubo blanco con los grises en
                  // una misma ubicación. Si igual quedaron juntos, alguien
                  // tiene que ir a mirar ese estante al galpón.
                  const mezclados = s.estantes.filter((e) => mezclaGrisYBlanco(e.tubos)).length;
                  return (
                  <div key={s.sector}>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h3 className="font-serif text-[0.9375rem] font-medium">
                        {s.sector === '?' ? 'Sin ubicación' : `Sector ${s.sector}`} · estantes
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {s.estantes.length} ubicación{s.estantes.length === 1 ? '' : 'es'} ·{' '}
                        {s.total} tubo{s.total === 1 ? '' : 's'}
                      </span>
                      {mezclados > 0 && (
                        <Badge variant="warning">
                          {mezclados === 1
                            ? '1 estante junta blanco con gris'
                            : `${mezclados} estantes juntan blanco con gris`}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
                      {s.estantes.map((e) => (
                        <EstanteCard
                          key={e.colmena}
                          estante={e}
                          visible={visible}
                          resaltado={resaltado}
                          elegidoId={elegidoId}
                          expandido={expandidos.has(e.colmena)}
                          onExpandir={() => setExpandidos((x) => alternar(x, e.colmena))}
                          onElegir={(t) => setElegidoId(t.id)}
                        />
                      ))}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="border-t border-border pt-2 text-[0.72rem] leading-relaxed text-muted-foreground">
            Los tubos no llevan kardex de cantidades: cada pieza tiene su propio historial
            (ingreso, corte, sobrante, merma). El kardex general los muestra en solo lectura.
          </p>
        </div>

        <div className="hidden min-h-0 xl:flex xl:flex-col">
          <FichaTuboPanel
            busqueda={q}
            onBusqueda={setQ}
            coincidencias={coincidencias}
            tubo={elegido}
            dias={dias}
            recorrido={recorrido}
            cargandoRecorrido={cargandoRecorrido}
            onElegir={(t) => setElegidoId(t.id)}
            onVerHistorial={() => elegido && onVerHistorial(elegido)}
          />
        </div>
      </div>
    </div>
  );
}
