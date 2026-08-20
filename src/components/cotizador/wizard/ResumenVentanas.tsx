// ─────────────────────────────────────────────────────────────────────
// LAS VENTANAS DE LA ORDEN, DE UN VISTAZO.
//
// La pantalla de inicio de la vista guiada: las cortinas dibujadas con su
// medida, agrupadas por ubicación. Tocas una y ves su ficha completa.
//
// Es SOLO LECTURA a propósito. Con la tablet en la mano, un botón que cambia
// un dato al rozarlo es un dato mal cargado que nadie va a notar hasta el
// taller; para cambiar algo se entra a la vista guiada, que valida y avisa.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Copy, Pencil, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CortinaViz } from './CortinaViz';
import {
  fichaResumen,
  gruposResumen,
  miniaturaDe,
} from '@/modules/cotizador/wizard/resumenVentanas';
import { rotuloForma } from '@/modules/cotizador/wizard/selectorVentanas';
import { targetsProgreso } from '@/modules/cotizador/wizard/pasos';
import { estiloVizDePano, varianteViz } from '@/modules/cotizador/wizard/cortinaViz';
import type { ReglasSeleccion } from '@/modules/descuentos/reglasSeleccion';
import type { CatalogoProductos, Ventana } from '@/modules/cotizador/types';

type Props = {
  ventanas: Ventana[];
  catalogo: CatalogoProductos;
  reglas: ReglasSeleccion;
  onEditar: (v: Ventana) => void;
  /** Crea una cortina idéntica a continuación (misma ventana, sin medidas). */
  onReplicar: (v: Ventana) => void;
  onNueva: () => void;
};

/** El dibujo de una cortina en chico, o un cartel si su sistema no se dibuja. */
function Miniatura({
  ventana,
  catalogo,
  reglas,
}: {
  ventana: Ventana;
  catalogo: CatalogoProductos;
  reglas: ReglasSeleccion;
}) {
  const variante = useMemo(
    () => varianteViz(ventana.categoria, reglas.tipos),
    [ventana.categoria, reglas.tipos],
  );
  const pano = ventana.panos?.[0];
  const progreso = useMemo(
    () =>
      variante && pano
        ? targetsProgreso({ ventana, pano, panoIdx: 0, variante, reglas, catalogo })
        : {},
    [ventana, pano, variante, reglas, catalogo],
  );
  const estilo = useMemo(
    () => (variante && pano ? estiloVizDePano(ventana, pano, catalogo, variante) : null),
    [ventana, pano, catalogo, variante],
  );

  if (!variante || !estilo) {
    // Beeblack y sistemas de oscuridad no tienen dibujo: se nombran.
    return (
      <div className="flex h-full min-h-[5.5rem] items-center justify-center px-2 text-center">
        <span className="text-[0.68rem] uppercase tracking-wide text-muted-foreground">
          {ventana.categoria || 'sin tipo'}
        </span>
      </div>
    );
  }
  return <CortinaViz variante={variante} progreso={progreso} estilo={estilo} className="aspect-[16/10]" />;
}

export function ResumenVentanas({
  ventanas,
  catalogo,
  reglas,
  onEditar,
  onReplicar,
  onNueva,
}: Props) {
  const grupos = useMemo(() => gruposResumen(ventanas), [ventanas]);
  const [selId, setSelId] = useState<string | null>(() =>
    ventanas.length ? String(ventanas[0].id) : null,
  );
  // Si la seleccionada se borró (o la OT cambió), volver a la primera.
  useEffect(() => {
    if (!ventanas.some((v) => String(v.id) === selId)) {
      setSelId(ventanas.length ? String(ventanas[0].id) : null);
    }
  }, [ventanas, selId]);

  const sel = ventanas.find((v) => String(v.id) === selId) ?? null;
  const filas = useMemo(() => (sel ? fichaResumen(sel) : []), [sel]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Ventanas de la orden</h3>
          <p className="text-[0.72rem] text-muted-foreground">
            Toca una cortina para ver su ficha. {ventanas.length} cargada
            {ventanas.length === 1 ? '' : 's'}.
          </p>
        </div>
        <Button size="sm" className="gap-1" onClick={onNueva}>
          <Plus className="h-4 w-4" /> Nueva <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {grupos.map((g) => (
        <section key={g.ubicacion}>
          <h4 className="mb-2 rounded bg-accent/20 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-wide text-accent">
            {g.ubicacion}
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.ventanas.map((v) => {
              const mini = miniaturaDe(v);
              const activa = String(v.id) === selId;
              const forma = rotuloForma(v);
              return (
                <button
                  key={String(v.id)}
                  type="button"
                  onClick={() => setSelId(String(v.id))}
                  className={cn(
                    'flex flex-col gap-1 rounded-md border p-2 text-left transition-colors',
                    activa
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-card/40 hover:border-accent/50',
                  )}
                >
                  <div className="flex items-center justify-between gap-1 text-[0.65rem] font-mono text-muted-foreground">
                    <span>{mini.anchos.join(' · ')}</span>
                    <span>{mini.alto}</span>
                  </div>
                  <div className="overflow-hidden rounded bg-[#1a1b1c]">
                    <Miniatura ventana={v} catalogo={catalogo} reglas={reglas} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="truncate text-[0.7rem]">{v.codInt || '(sin tela)'}</span>
                    {forma && (
                      <span className="rounded bg-accent/20 px-1 text-[0.6rem] font-semibold text-accent">
                        {forma}
                      </span>
                    )}
                    {mini.incompleta && (
                      <span className="rounded bg-amber-500/20 px-1 text-[0.6rem] font-semibold text-amber-500">
                        sin medidas
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {/* ── Ficha de la seleccionada (solo lectura) ── */}
      {sel && (
        <div className="rounded-md border border-border bg-card/40 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">
              {sel.ubicacion || '(sin ubicación)'}
              {sel.categoria && (
                <span className="ml-2 text-[0.7rem] font-normal text-muted-foreground">
                  {sel.categoria}
                </span>
              )}
            </h4>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1" onClick={() => onEditar(sel)}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => onReplicar(sel)}
                title="Crear otra cortina igual a esta, en la misma ventana: solo le tomas las medidas"
              >
                <Copy className="h-3.5 w-3.5" /> Replicar información
              </Button>
            </div>
          </div>
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {filas.map((f) => (
              <div key={f.etiqueta} className="flex justify-between gap-2 border-b border-border/50 py-0.5">
                <dt className="text-[0.68rem] uppercase tracking-wide text-muted-foreground">
                  {f.etiqueta}
                </dt>
                <dd className="text-right text-[0.72rem]">{f.valor}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
