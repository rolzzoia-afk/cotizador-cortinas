// La hoja «Plan de Corte» en pantalla: las mismas 13 columnas del Excel que
// hoy se imprime, con los mismos colores y una casilla por corte.
//
// Los colores NO son decoración: rojo es merma que va al basurero, naranjo es
// un sobrante que hay que dejar en la mesa, azul es un corte que SALE de la
// mesa y amarillo es la cenefa que va con tira. Salen de `estiloFilaPlan`,
// que es la misma función que pinta el Excel.

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  celdasComoArreglo,
  ENCABEZADOS_PLAN,
  estiloFilaPlan,
  type EstiloFilaPlan,
  type FilaPlan,
} from '@/modules/planes-corte/construirFilasPlan';
import { calcularAvance } from '@/modules/produccion/avance';

const CLASES_ESTILO: Record<Exclude<EstiloFilaPlan, null>, string> = {
  merma: 'bg-red-500/10 text-red-300',
  'reserva-mesa': 'bg-orange-500/10 text-orange-300',
  mesa: 'bg-blue-500/10 text-blue-300',
  'con-tira': 'bg-yellow-500/10 text-yellow-200',
};

export default function HojaPlanCorte({
  filas,
  hechas,
  quien,
  onMarcar,
  deshabilitado,
}: {
  filas: FilaPlan[];
  hechas: Set<string>;
  quien: Map<string, string>;
  onMarcar: (clave: string, hecho: boolean) => void;
  deshabilitado?: boolean;
}) {
  // Solo se marcan los CORTES: la fila de sobrante acompaña a su corte y no
  // es una tarea aparte.
  const clavesCorte = filas.filter((f) => f.tipo === 'corte').map((f) => f.clave);
  const avance = calcularAvance(clavesCorte, hechas);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b p-3">
        <div className="text-sm font-semibold">
          {avance.hechas} de {avance.total} cortes
        </div>
        <div className="h-2 min-w-[8rem] flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${avance.pct}%` }}
          />
        </div>
        <div className="text-sm font-semibold tabular-nums">{avance.pct}%</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-2 py-2" />
              {ENCABEZADOS_PLAN.map((h) => (
                <th key={h} className="whitespace-nowrap px-2 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => {
              const estilo = estiloFilaPlan(fila);
              const marcable = fila.tipo === 'corte';
              const hecho = hechas.has(fila.clave);
              const porQuien = quien.get(fila.clave);
              return (
                <tr
                  key={`${fila.clave}-${fila.tipo}`}
                  className={cn(
                    'border-b border-border/50 last:border-0',
                    estilo && CLASES_ESTILO[estilo],
                    hecho && marcable && 'opacity-45',
                  )}
                >
                  <td className="px-2 py-1.5">
                    {marcable && (
                      <button
                        type="button"
                        disabled={deshabilitado}
                        onClick={() => onMarcar(fila.clave, !hecho)}
                        title={
                          hecho
                            ? `Hecho${porQuien ? ` por ${porQuien}` : ''} — tocar para desmarcar`
                            : 'Marcar como cortado'
                        }
                        aria-label={hecho ? 'Desmarcar corte' : 'Marcar corte como hecho'}
                        aria-pressed={hecho}
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-md border transition-colors',
                          hecho
                            ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300'
                            : 'border-border hover:bg-secondary',
                          deshabilitado && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        {hecho && <Check className="h-4 w-4" />}
                      </button>
                    )}
                  </td>
                  {celdasComoArreglo(fila).map((celda, i) => (
                    <td
                      key={i}
                      className={cn(
                        'whitespace-nowrap px-2 py-1.5',
                        // Acción y código son lo que el operario lee de lejos.
                        (i === 2 || i === 4) && 'font-semibold',
                        i === 7 && 'tabular-nums',
                      )}
                    >
                      {celda === '' ? '' : String(celda)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
