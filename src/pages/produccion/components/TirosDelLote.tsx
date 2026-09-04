// Los tiros del LOTE: lo que de verdad llega a la mesa de dimensionado.
//
// Cuando dos órdenes comparten tela, sus cortinas se cortan del mismo tiro.
// Mirando el Dimensionado de una sola OT eso no se ve: aparecen sus cortinas
// con una letra que se calculó con ellas solas, y el trozo de tela que el
// cortador tiene adelante trae además las de la otra orden. Acá se muestra el
// tiro completo, con cada cortina rotulada con su OT.

import { Archive, Layers, Scissors } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  esTiroCompartido,
  resumenTiros,
  sobranteDelTiro,
  type CortinaDeColmena,
  type TiroLote,
} from '@/modules/produccion/hojaLote';
import type { SobranteDibujado } from '@/modules/cotizador/layoutPano';

/** Los centímetros del taller: con coma y sin decimales de relleno. */
const cm = (n: number): string => String(Math.round(n)).replace('.', ',');
const metros = (n: number): string => (Math.round(n) / 100).toFixed(2).replace('.', ',');

/** «sobrante (ambas)» · «merma» — lo mismo que marca la etiqueta del retazo. */
function rotuloSobrante(s: SobranteDibujado): string {
  if (s.clase === 'merma') return 'merma';
  const { roller, vertical } = s.funcional;
  return `sobrante (${roller && vertical ? 'ambas' : roller ? 'roller' : 'vertical'})`;
}

export default function TirosDelLote({
  nombre,
  tiros,
  /** Las cortinas que salen del rack: no se cortan, se van a buscar. */
  deColmena = [],
  /** La OT que está abierta: sus cortinas se destacan dentro del tiro. */
  otActual,
}: {
  nombre: string;
  tiros: TiroLote[];
  deColmena?: CortinaDeColmena[];
  otActual: string;
}) {
  if (tiros.length === 0 && deColmena.length === 0) return null;
  const r = resumenTiros(tiros);

  return (
    <section className="rounded-lg border border-accent/40 bg-accent/5 p-3">
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <Layers className="h-4 w-4 text-accent" />
        <strong className="text-sm text-accent">Tiros del lote · {nombre}</strong>
        <span className="text-[11px] text-muted-foreground">
          {r.tiros} {r.tiros === 1 ? 'tiro' : 'tiros'} · {r.cortinas} cortinas ·{' '}
          {String(r.metros).replace('.', ',')} m de rollo
          {r.compartidos > 0 &&
            ` · ${r.compartidos} ${r.compartidos === 1 ? 'compartido' : 'compartidos'} entre OTs`}
        </span>
      </header>

      <p className="mb-3 text-[11px] leading-tight text-muted-foreground">
        Esto es lo que se bajó del rollo cortando las OTs juntas. La letra es la misma que aparece
        en CONJUNTO PAÑOS de cada orden, así que el trozo que está en la mesa se busca por esa
        letra.
      </p>

      <div className="grid gap-2 lg:grid-cols-2">
        {tiros.map((t) => {
          const compartido = esTiroCompartido(t);
          const sobra = sobranteDelTiro(t);
          return (
            <article
              key={t.numero}
              className={cn(
                'rounded-lg border bg-card p-2.5',
                compartido ? 'border-accent/50' : 'border-border',
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-sm font-bold text-background">
                    {t.letra}
                  </span>
                  <strong className="font-mono text-sm">{t.codInt}</strong>
                  {t.esVertical && (
                    <span className="rounded-full border border-success/40 bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                      VERTICAL
                    </span>
                  )}
                  {compartido && (
                    <span className="rounded-full border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                      {t.otsNum.length} OTs juntas
                    </span>
                  )}
                </div>
                <span className="inline-flex items-center gap-1 text-[0.72rem] font-semibold text-accent">
                  <Scissors className="h-3 w-3" />
                  bajar {metros(t.altoCorteCm)} m
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
                <span>
                  Tiro de {cm(t.anchoRolloCm)} × {cm(t.altoCorteCm)} cm · ocupa{' '}
                  {cm(t.anchoUsadoCm)} cm
                </span>
                {/* Qué queda del tiro, ya clasificado con el mismo criterio con
                    el que se va a guardar (o a perder) al cerrar el corte. */}
                {sobra && (
                  <span
                    className={cn(
                      'rounded-full border px-1.5 py-0.5 font-semibold',
                      sobra.clase === 'sobrante'
                        ? 'border-success/40 bg-success/15 text-success'
                        : 'border-destructive/40 bg-destructive/15 text-destructive',
                    )}
                  >
                    sobra {cm(sobra.anchoCm)} × {cm(sobra.altoCm)} → {rotuloSobrante(sobra)}
                  </span>
                )}
              </div>

              <ul className="mt-2 space-y-1">
                {t.cortinas.map((c) => {
                  const esDeEsta = c.otNum === otActual;
                  return (
                    <li
                      key={c.otId + c.piezaId}
                      className={cn(
                        'flex flex-wrap items-center justify-between gap-2 rounded-md border px-2 py-1 text-[11px]',
                        esDeEsta
                          ? 'border-accent/40 bg-accent/10'
                          : 'border-border bg-muted/30 text-muted-foreground',
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'rounded-full border px-1.5 py-0.5 font-semibold',
                            esDeEsta
                              ? 'border-accent bg-accent text-accent-foreground'
                              : 'border-border',
                          )}
                        >
                          OT {c.otNum}
                        </span>
                        <strong className={esDeEsta ? 'text-foreground' : undefined}>
                          {c.ubicacion}
                        </strong>
                      </span>
                      <span className="font-mono tabular-nums">
                        {cm(c.anchoCm)} × {cm(c.altoCm)} cm
                      </span>
                    </li>
                  );
                })}
              </ul>
            </article>
          );
        })}
      </div>

      {/* Estas no se cortan: ya están cortadas y esperando en el rack. */}
      {deColmena.length > 0 && (
        <div className="mt-3 rounded-lg border border-success/40 bg-success/10 p-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-success">
            <Archive className="h-3.5 w-3.5" />
            De la colmena: {deColmena.length}{' '}
            {deColmena.length === 1 ? 'cortina ya cortada' : 'cortinas ya cortadas'}
          </div>
          <p className="mb-1.5 text-[10px] leading-tight text-muted-foreground">
            No bajan rollo: se van a buscar al rack por la ubicación. Cada paño está dibujado más
            abajo, con las cortinas que salen de él y lo que le sobra.
          </p>
          <ul className="space-y-1">
            {deColmena.map((c) => (
              <li
                key={c.otId + c.piezaId}
                className={cn(
                  'flex flex-wrap items-center justify-between gap-2 rounded-md border px-2 py-1 text-[11px]',
                  c.otNum === otActual
                    ? 'border-accent/40 bg-accent/10'
                    : 'border-border bg-muted/30 text-muted-foreground',
                )}
              >
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-border px-1.5 py-0.5 font-semibold">
                    OT {c.otNum}
                  </span>
                  <strong>{c.ubicacion}</strong>
                  <span className="font-mono">{c.codInt}</span>
                </span>
                <span className="font-mono tabular-nums">
                  📍 {c.origen || '—'} · {cm(c.anchoCm)} × {cm(c.altoCm)} cm
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
