// La hoja CÁLCULO GENERAL en pantalla, compartida por Dimensionado y Armado.
//
// Igual que en el papel: una SECCIÓN por sistema (roller, soft light, dark,
// oscuranti, beeblack, vertical), cada una con su color y solo sus columnas de
// despiece. Las columnas de identidad son las mismas en todas las secciones
// para que se lean alineadas.
//
// El texto de cada celda NO se decide acá: sale de `textoIdentidad` /
// `textoDespiece`, las mismas funciones que usa el PDF. La pantalla y el papel
// no pueden decir cosas distintas.

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  seccionesDeHoja,
  textoDespiece,
  textoIdentidad,
  type BloqueSistema,
  type CalculoGeneral,
  type ColumnaCalculo,
  type FilaCalculo,
} from '@/modules/cotizador/calculoGeneral';
import { calcularAvance } from '@/modules/produccion/avance';

const rgb = (c: readonly [number, number, number]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

export default function HojaCalculo({
  data,
  identidad,
  bloques,
  hechas,
  quien,
  onMarcar,
  etiquetaCheck,
}: {
  data: CalculoGeneral;
  identidad: ColumnaCalculo[];
  bloques: { sistema: BloqueSistema; columnas: ColumnaCalculo[] }[];
  hechas: Set<string>;
  quien: Map<string, string>;
  onMarcar: (clave: string, hecho: boolean) => void;
  /** Qué significa marcar la fila («dimensionada», «armada»). */
  etiquetaCheck: string;
}) {
  // Las secciones las arma el módulo puro, el mismo que usa el PDF: si cada uno
  // hiciera su lista, un cambio saldría en un papel y no en el otro.
  const secciones = seccionesDeHoja(data, bloques, identidad);

  const avance = calcularAvance(
    data.filas.map((f) => f.piezaId),
    hechas,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
        <span className="text-sm font-semibold">
          {avance.hechas} de {avance.total} cortinas
        </span>
        <div className="h-2 min-w-[8rem] flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${avance.pct}%` }}
          />
        </div>
        <span className="text-sm font-semibold tabular-nums">{avance.pct}%</span>
      </div>

      {secciones.map((sec) => (
        <section key={sec.sistema.key} className="overflow-hidden rounded-lg border">
          <header
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white"
            style={{ background: rgb(sec.sistema.color) }}
          >
            {sec.sistema.label}
          </header>
          <div className="overflow-x-auto bg-card">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="w-10 px-2 py-1.5" />
                  {sec.identidad.map((c) => (
                    <th key={c.key} className="whitespace-nowrap px-2 py-1.5 font-medium">
                      {c.label}
                    </th>
                  ))}
                  {sec.columnas.map((c) => (
                    <th
                      key={c.key}
                      className="whitespace-nowrap px-2 py-1.5 font-medium"
                      style={{ color: rgb(sec.sistema.color) }}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sec.filas.map((f: FilaCalculo) => {
                  const hecho = hechas.has(f.piezaId);
                  const porQuien = quien.get(f.piezaId);
                  return (
                    <tr
                      key={f.piezaId}
                      className={cn('border-b border-border/50 last:border-0', hecho && 'opacity-45')}
                    >
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => onMarcar(f.piezaId, !hecho)}
                          title={
                            hecho
                              ? `${etiquetaCheck}${porQuien ? ` por ${porQuien}` : ''} — tocar para desmarcar`
                              : `Marcar como ${etiquetaCheck.toLowerCase()}`
                          }
                          aria-label={hecho ? 'Desmarcar cortina' : 'Marcar cortina'}
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
                      </td>
                      {sec.identidad.map((c) => (
                        <td
                          key={c.key}
                          className={cn(
                            'whitespace-nowrap px-2 py-1.5',
                            (c.key === 'ubic' || c.key === 'codInt') && 'font-semibold',
                          )}
                        >
                          {textoIdentidad(f, c.key)}
                        </td>
                      ))}
                      {sec.columnas.map((c) => (
                        <td
                          key={c.key}
                          className="whitespace-nowrap px-2 py-1.5 text-base font-semibold tabular-nums"
                        >
                          {textoDespiece(f, c.key)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
