// ─────────────────────────────────────────────────────────────────────
// WIZARD DE TERRENO — la vista interactiva de Fase 2.
//
// A la izquierda un paso a la vez; a la derecha la cortina, que se va armando
// con lo que se llena. Clic en una pieza del dibujo = saltar a su paso.
//
// No tiene estado propio de la ventana: recibe el mismo `ventana` que edita la
// ficha clásica y despacha por los mismos `onPano`/`onVentana`, así que las dos
// vistas comparten cascadas, validación y guardado.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CortinaViz } from './CortinaViz';
import { CuerpoPaso } from './PasoWizard';
import {
  faltantesPaso,
  pasoCompleto,
  pasosAplicables,
  pasoDePieza,
  targetsProgreso,
  type CtxPaso,
  type IdPaso,
} from '@/modules/cotizador/wizard/pasos';
import {
  estiloVizDePano,
  NOMBRE_PIEZA,
  type PiezaViz,
  type VarianteViz,
} from '@/modules/cotizador/wizard/cortinaViz';
import { PANO_COLORS } from '@/modules/cotizador/fase2';
import { pendientesFase2 } from '@/modules/cotizador/fase2-completitud';
import type { FormulasFamilias } from '@/modules/descuentos/formulasFamilias';
import type { ReglasSeleccion } from '@/modules/descuentos/reglasSeleccion';
import type { CadenaInsumo } from '@/modules/cotizador/cadenas';
import type { CatalogoProductos, Pano, Ventana } from '@/modules/cotizador/types';

type Props = {
  ventana: Ventana;
  variante: VarianteViz;
  panoActivo: number;
  onPanoActivo: (i: number) => void;
  catalogo: CatalogoProductos;
  reglas: ReglasSeleccion;
  formulas?: FormulasFamilias;
  cadenas: CadenaInsumo[];
  pesos: CadenaInsumo[];
  opcionesMecanismo: readonly string[];
  opcionesTuberia: readonly string[];
  notaMecanismo?: string;
  lineaB: boolean;
  guardando: boolean;
  onVentana: (patch: Partial<Ventana>) => void;
  onPano: (patch: Partial<Pano>) => void;
  onCategoria: (categoria: string) => void;
  onGuardar: () => void;
  onCancelar: () => void;
  /** Abre «Replicar información». Sin otras cortinas en la OT no se ofrece. */
  onReplicar?: () => void;
};

export function WizardTerreno(props: Props) {
  const { ventana, variante, panoActivo, catalogo, reglas } = props;
  const pano = ventana.panos[panoActivo] ?? ventana.panos[0];

  const ctx: CtxPaso = useMemo(
    () => ({ ventana, pano, panoIdx: panoActivo, variante, reglas, catalogo }),
    [ventana, pano, panoActivo, variante, reglas, catalogo],
  );

  const pasos = useMemo(() => pasosAplicables(ctx), [ctx]);
  const progreso = useMemo(() => targetsProgreso(ctx), [ctx]);
  const estilo = useMemo(
    () => estiloVizDePano(ventana, pano, catalogo, variante),
    [ventana, pano, catalogo, variante],
  );

  const [idPaso, setIdPaso] = useState<IdPaso>('medidas');
  // Si el paso activo deja de aplicar (cambió la categoría), volver al primero.
  useEffect(() => {
    if (!pasos.some((p) => p.id === idPaso)) setIdPaso(pasos[0]?.id ?? 'medidas');
  }, [pasos, idPaso]);
  // Al cambiar de paño se vuelve al principio: la ficha es de ESE paño.
  const panoPrevio = useRef(panoActivo);
  useEffect(() => {
    if (panoPrevio.current !== panoActivo) {
      panoPrevio.current = panoActivo;
      setIdPaso('medidas');
    }
  }, [panoActivo]);

  const idx = Math.max(0, pasos.findIndex((p) => p.id === idPaso));
  const paso = pasos[idx];
  const faltan = paso ? faltantesPaso(paso, ctx) : [];
  const completos = pasos.filter((p) => pasoCompleto(p, ctx)).length;

  const pendientesVentana = useMemo(
    () => pendientesFase2([ventana], props.formulas, reglas, catalogo),
    [ventana, props.formulas, reglas, catalogo],
  );

  const irAPieza = (pieza: PiezaViz) => {
    const destino = pasoDePieza(pieza);
    if (destino && pasos.some((p) => p.id === destino)) setIdPaso(destino);
  };

  if (!paso) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* ── Columna del paso ── */}
      <div className="order-2 flex flex-col gap-3 lg:order-1">
        {/* Rail de pasos */}
        <div className="flex flex-wrap gap-1">
          {pasos.map((p, i) => {
            const listo = pasoCompleto(p, ctx);
            const activo = p.id === idPaso;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setIdPaso(p.id)}
                title={p.titulo}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.68rem] transition-colors',
                  activo
                    ? 'border-accent bg-accent/20 text-accent'
                    : listo
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {listo ? <Check className="h-3 w-3" /> : <span className="font-mono">{i + 1}</span>}
                <span className="hidden sm:inline">{p.titulo}</span>
              </button>
            );
          })}
        </div>

        {/* Tabs por paño (ventanas de varios paños) */}
        {ventana.panos.length > 1 && (
          <div className="flex flex-wrap gap-1 border-b border-border pb-2">
            {ventana.panos.map((_, i) => {
              const color = PANO_COLORS[i] || PANO_COLORS[0];
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => props.onPanoActivo(i)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-t border-b-2 px-3 py-1.5 text-xs transition-colors',
                    panoActivo === i
                      ? 'border-b-indigo-500 bg-card text-foreground'
                      : 'border-b-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color.hex }} />
                  Paño {i + 1}
                </button>
              );
            })}
          </div>
        )}

        <div className="rounded-md border border-border bg-card/40 p-4">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold">{paso.titulo}</h4>
            <span className="font-mono text-[0.65rem] text-muted-foreground">
              {idx + 1} / {pasos.length}
            </span>
          </div>
          <p className="mb-3 text-[0.72rem] text-muted-foreground">{paso.ayuda}</p>

          {paso.id === 'resumen' ? (
            <div className="space-y-3">
              <p className="text-[0.78rem]">
                {completos} de {pasos.length} pasos listos.
              </p>
              {props.onReplicar && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={props.onReplicar}
                  title="Copiar esta ficha a otras cortinas de la OT (sin tocar sus medidas)"
                >
                  <Copy className="h-3.5 w-3.5" /> Replicar en otras cortinas
                </Button>
              )}
              {pendientesVentana.length === 0 ? (
                <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[0.75rem] text-emerald-500">
                  Esta cortina está completa: no bloquea el paso a Fase 3.
                </div>
              ) : (
                <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                  <p className="mb-1 text-[0.72rem] font-semibold text-amber-600">
                    Falta para poder producirla:
                  </p>
                  <ul className="list-inside list-disc space-y-0.5 text-[0.72rem] text-amber-600">
                    {pendientesVentana.map((p, i) => (
                      <li key={i}>
                        {p.panoIdx != null ? `Paño ${p.panoIdx + 1}: ` : ''}
                        {p.mensaje}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <CuerpoPaso
              paso={paso.id}
              ventana={ventana}
              pano={pano}
              panoIdx={panoActivo}
              esDual={variante === 'dual'}
              esDuo={variante === 'duo'}
              catalogo={catalogo}
              reglas={reglas}
              cadenas={props.cadenas}
              pesos={props.pesos}
              opcionesMecanismo={props.opcionesMecanismo}
              opcionesTuberia={props.opcionesTuberia}
              notaMecanismo={props.notaMecanismo}
              lineaB={props.lineaB}
              onVentana={props.onVentana}
              onPano={props.onPano}
              onCategoria={props.onCategoria}
            />
          )}

          {faltan.length > 0 && (
            <p className="mt-3 text-[0.7rem] text-amber-500">Falta: {faltan.join(' · ')}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={idx === 0}
            onClick={() => setIdPaso(pasos[idx - 1].id)}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Anterior
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={props.onCancelar}>
              Cancelar
            </Button>
            {idx < pasos.length - 1 ? (
              <Button size="sm" className="gap-1" onClick={() => setIdPaso(pasos[idx + 1].id)}>
                Siguiente <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="sm" className="gap-1" onClick={props.onGuardar} disabled={props.guardando}>
                {props.guardando ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Guardar ventana
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Columna del dibujo ── */}
      <div className="order-1 lg:order-2">
        <div className="lg:sticky lg:top-3">
          <div className="overflow-hidden rounded-md border border-border bg-[#1a1b1c]">
            <CortinaViz
              variante={variante}
              progreso={progreso}
              estilo={estilo}
              activa={paso.pieza}
              onClickPieza={irAPieza}
              className="aspect-[16/9]"
            />
          </div>
          <p className="mt-2 text-center text-[0.68rem] text-muted-foreground">
            {paso.pieza
              ? `Estás armando: ${NOMBRE_PIEZA[paso.pieza]}. Haz clic en otra pieza para ir a su paso.`
              : 'Haz clic en una pieza del dibujo para ir a su paso.'}
          </p>
        </div>
      </div>
    </div>
  );
}
