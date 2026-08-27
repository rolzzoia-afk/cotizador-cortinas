// Una sección de la hoja de corte de paños en pantalla: la clásica o la de
// VERTICALES, que el taller corta en mesa aparte.
//
// Es el mismo contenido del PDF, sin las columnas que existen solo para
// escribir a mano (COD. SERIAL, AUTORIZACIÓN, MOTIVO del error): en pantalla
// una columna vacía es ruido. La casilla va en TOTAL PAÑOS, que es la tabla
// que el taller cuenta.

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  filasCorteVisibles,
  totalesPorTipoDeTela,
  type HojaCorte,
} from '@/modules/cotizador/hojaCorte';
import { calcularAvance } from '@/modules/produccion/avance';
import { clavesDeSeccion } from '@/modules/produccion/panos';

/** Mismo formato que el PDF: hasta 3 decimales y coma decimal. */
const fmt = (v: number | '') =>
  v === '' ? '' : String(parseFloat(Number(v).toFixed(3))).replace('.', ',');

// Un color por paño para ver de un vistazo qué se corta junto. Ciclan igual
// que la paleta del PDF.
const COLOR_PANO = [
  'border-l-slate-400',
  'border-l-orange-400',
  'border-l-emerald-400',
  'border-l-sky-400',
  'border-l-amber-400',
  'border-l-violet-400',
];
const colorDe = (pano: number) => COLOR_PANO[(pano - 1 + COLOR_PANO.length) % COLOR_PANO.length];

export default function HojaCortePanos({
  titulo,
  banner,
  hoja,
  claves,
  hechas,
  quien,
  onMarcar,
  nombreDeTela,
}: {
  titulo: string;
  banner?: string;
  hoja: HojaCorte;
  claves: Map<number, string>;
  hechas: Set<string>;
  quien: Map<string, string>;
  onMarcar: (clave: string, hecho: boolean) => void;
  nombreDeTela: (codInt: string) => string;
}) {
  const visibles = filasCorteVisibles(hoja.cortinas);
  const avance = calcularAvance(clavesDeSeccion(hoja.panos, claves), hechas);
  const totales = totalesPorTipoDeTela(hoja.optimizador, nombreDeTela);

  return (
    <section className="rounded-lg border bg-card">
      <header className="flex flex-wrap items-center gap-3 border-b p-3">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold">
          {hoja.totalPanos} {hoja.totalPanos === 1 ? 'paño' : 'paños'}
        </span>
        <div className="h-2 min-w-[6rem] flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${avance.pct}%` }}
          />
        </div>
        <span className="text-sm font-semibold tabular-nums">
          {avance.hechas}/{avance.total}
        </span>
      </header>

      {banner && (
        <p className="border-b bg-emerald-600/15 px-3 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-emerald-300">
          {banner}
        </p>
      )}

      {/* Solo las cortinas con algo especial: de colmena, invertidas o
          verticales. Las de rollo normal no necesitan esta tabla. */}
      {visibles.length > 0 && (
        <div className="border-b">
          <p className="px-3 pt-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            Cortes especiales
          </p>
          <div className="overflow-x-auto p-3 pt-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  {[
                    'Cant',
                    'Cod int',
                    'Tipo',
                    'Ancho corte tela',
                    'Corte ancho −3,5',
                    'Alto',
                    'Alto corte tela',
                    'Paño',
                    'Cortar junto',
                    'Comentario',
                    'Medida colmena',
                    'Ubicación colmena',
                  ].map((h) => (
                    <th key={h} className="whitespace-nowrap px-2 py-1.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibles.map((f, i) => (
                  <tr
                    key={`${f.codInt}-${f.pano}-${i}`}
                    className={cn('border-l-4 border-b border-border/50', colorDe(f.pano))}
                  >
                    <td className="px-2 py-1.5">{f.cant}</td>
                    <td className="px-2 py-1.5 font-semibold">{f.codInt}</td>
                    <td className="px-2 py-1.5">{f.tipo}</td>
                    <td className="px-2 py-1.5 tabular-nums">{fmt(f.anchoCorteTela)}</td>
                    <td className="px-2 py-1.5 tabular-nums">{fmt(f.corteAncho35)}</td>
                    <td className="px-2 py-1.5 tabular-nums">{fmt(f.alto)}</td>
                    <td className="px-2 py-1.5 tabular-nums">{fmt(f.altoCorteTela)}</td>
                    <td className="px-2 py-1.5 font-semibold">{f.pano}</td>
                    <td className="px-2 py-1.5 font-semibold">{f.cortarJunto}</td>
                    <td
                      className={cn(
                        'whitespace-nowrap px-2 py-1.5 font-semibold',
                        f.comentario === 'NO CABE' && 'text-red-400',
                        f.comentario === 'INVERTIDA' && 'text-amber-300',
                      )}
                    >
                      {f.comentario}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-emerald-300">
                      {f.medidaColmena}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-emerald-300">
                      {f.ubicColmena}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TOTAL PAÑOS: lo que hay que bajar del rollo. Los paños que salen de
          colmena no están acá — ya están cortados. */}
      <div className="overflow-x-auto p-3">
        <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          Total paños — lo que se corta del rollo
        </p>
        {hoja.panos.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Ningún paño sale del rollo: todos vienen de sobrantes de la colmena.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="w-10 px-2 py-1.5" />
                {['Paño', 'Tipo', 'Cod', 'Alto corte paño', 'Alto máximo a utilizar', 'Ubicación'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-2 py-1.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hoja.panos.map((p) => {
                const clave = claves.get(p.pano);
                const hecho = !!clave && hechas.has(clave);
                const porQuien = clave ? quien.get(clave) : undefined;
                return (
                  <tr
                    key={p.pano}
                    className={cn(
                      'border-l-4 border-b border-border/50',
                      colorDe(p.pano),
                      hecho && 'opacity-45',
                    )}
                  >
                    <td className="px-2 py-1.5">
                      {clave && (
                        <button
                          type="button"
                          onClick={() => onMarcar(clave, !hecho)}
                          title={
                            hecho
                              ? `Cortado${porQuien ? ` por ${porQuien}` : ''} — tocar para desmarcar`
                              : 'Marcar el paño como cortado'
                          }
                          aria-label={hecho ? 'Desmarcar paño' : 'Marcar paño como cortado'}
                          aria-pressed={hecho}
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-md border transition-colors',
                            hecho
                              ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300'
                              : 'border-border hover:bg-secondary',
                          )}
                        >
                          {hecho && <Check className="h-4 w-4" />}
                        </button>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-base font-bold tabular-nums">{p.pano}</td>
                    <td className="px-2 py-1.5">
                      {p.tipo}
                      {p.invertida && (
                        <span className="ml-1.5 rounded bg-amber-500/20 px-1 text-[10px] font-semibold text-amber-300">
                          INVERTIDA
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 font-semibold">{p.cod}</td>
                    <td className="px-2 py-1.5 text-base font-bold tabular-nums">
                      {fmt(p.altoCortePano)}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">{fmt(p.altoMaxUtilizar)}</td>
                    {/* Para qué ventanas se corta este paño. Si sirve a varias
                        van todas, en chips, para que se lean de una pasada. */}
                    <td className="px-2 py-1.5">
                      <span className="flex flex-wrap gap-1">
                        {p.ubicaciones.map((u) => (
                          <span key={u} className="rounded bg-secondary px-1.5 py-0.5 font-semibold">
                            {u}
                          </span>
                        ))}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* OPTIMIZADOR: los metros a bajar por tela. */}
      {hoja.optimizador.length > 0 && (
        <div className="border-t p-3">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Metros a bajar del rollo
          </p>
          <div className="flex flex-wrap gap-2">
            {hoja.optimizador.map((o) => (
              <span
                key={`${o.codInt}-${o.esVertical}`}
                className="rounded-md border bg-secondary/50 px-2 py-1 text-xs"
              >
                <strong>{o.codInt}</strong> · {fmt(o.metros)} m
              </span>
            ))}
          </div>
          {totales.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {totales.map((t) => (
                <li key={`${t.producto}-${t.esVertical}`}>
                  {t.producto}: <strong className="text-foreground">{fmt(t.metros)} m</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
