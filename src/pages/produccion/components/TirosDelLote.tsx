// Los tiros del LOTE: lo que de verdad llega a la mesa de dimensionado.
//
// Cuando dos órdenes comparten tela, sus cortinas se cortan del mismo tiro.
// Mirando el Dimensionado de una sola OT eso no se ve: aparecen sus cortinas
// con una letra que se calculó con ellas solas, y el trozo de tela que el
// cortador tiene adelante trae además las de la otra orden. Acá se muestra el
// tiro completo, con cada cortina rotulada con su OT.

import { Layers, Scissors } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  esTiroCompartido,
  resumenTiros,
  type TiroLote,
} from '@/modules/produccion/hojaLote';

/** Los centímetros del taller: con coma y sin decimales de relleno. */
const cm = (n: number): string => String(Math.round(n)).replace('.', ',');
const metros = (n: number): string => (Math.round(n) / 100).toFixed(2).replace('.', ',');

export default function TirosDelLote({
  nombre,
  tiros,
  /** La OT que está abierta: sus cortinas se destacan dentro del tiro. */
  otActual,
}: {
  nombre: string;
  tiros: TiroLote[];
  otActual: string;
}) {
  if (tiros.length === 0) return null;
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
        en CONJUNTO PAÑOS de cada orden, así que el trozo que tenés en la mesa se busca por esa
        letra.
      </p>

      <div className="grid gap-2 lg:grid-cols-2">
        {tiros.map((t) => {
          const compartido = esTiroCompartido(t);
          const libre = t.anchoRolloCm - t.anchoUsadoCm;
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

              <div className="mt-1.5 text-[11px] text-muted-foreground">
                Tiro de {cm(t.anchoRolloCm)} × {cm(t.altoCorteCm)} cm · ocupa{' '}
                {cm(t.anchoUsadoCm)} cm
                {libre > 0 && ` · sobran ${cm(libre)} cm de ancho`}
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
    </section>
  );
}
