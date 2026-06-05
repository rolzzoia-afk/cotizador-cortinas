// Tabla del embudo por asesora: muestra la cadena de conversión
// (asignados → cotizaciones → contactos → seg 2 → seg 3 → visitas → cierres)
// con un % de cierre coloreado por desempeño.

import { cn } from '@/lib/utils';
import { type EmbudoAsesora } from '@/modules/leads/metricas';
import { fmtPct } from '../utils/formato';

interface EmbudoAsesoraTablaProps {
  filas: EmbudoAsesora[];
}

export default function EmbudoAsesoraTabla({ filas }: EmbudoAsesoraTablaProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="px-2 py-1.5 text-left font-normal">Asesora</th>
            <th className="px-2 py-1.5 text-right font-normal" title="Leads asignados">
              Asignados
            </th>
            <th className="px-2 py-1.5 text-right font-normal" title="Cotizaciones enviadas">
              Cotiz.
            </th>
            <th className="px-2 py-1.5 text-right font-normal" title="Clientes que respondieron">
              Contactos
            </th>
            <th className="px-2 py-1.5 text-right font-normal" title="Seguimiento 2 realizado">
              Seg 2
            </th>
            <th className="px-2 py-1.5 text-right font-normal" title="Seguimiento 3 realizado">
              Seg 3
            </th>
            <th className="px-2 py-1.5 text-right font-normal" title="Visitas">
              Visitas
            </th>
            <th className="px-2 py-1.5 text-right font-normal" title="Cierres ganados">
              Cierres
            </th>
            <th className="px-2 py-1.5 text-right font-normal" title="Cierres / Cotizaciones">
              % cierre
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((v, i) => {
            const cierreColor =
              v.tasaCierre >= 20
                ? { bg: '#0F6E56', fg: '#E1F5EE' }
                : v.tasaCierre >= 10
                  ? { bg: '#085041', fg: '#9FE1CB' }
                  : v.cotizaciones > 0
                    ? { bg: '#791F1F', fg: '#F7C1C1' }
                    : { bg: 'transparent', fg: 'var(--muted-foreground)' };
            return (
              <tr
                key={v.vendedoraId}
                className={cn('border-b border-border/50', i === 0 && 'bg-success/10')}
              >
                <td className="px-2 py-2 font-medium">
                  {i === 0 && (
                    <span className="mr-1.5" style={{ color: '#FAC775' }}>
                      ★
                    </span>
                  )}
                  {v.nombre}
                </td>
                <td className="px-2 py-2 text-right">{v.asignados}</td>
                <td className="px-2 py-2 text-right">{v.cotizaciones}</td>
                <td className="px-2 py-2 text-right">{v.contactosEfectivos}</td>
                <td className="px-2 py-2 text-right">{v.seg2}</td>
                <td className="px-2 py-2 text-right">{v.seg3}</td>
                <td className="px-2 py-2 text-right">{v.visitas}</td>
                <td className="px-2 py-2 text-right font-medium">{v.cierres}</td>
                <td className="px-2 py-2 text-right">
                  <span
                    className="inline-block rounded-md px-2 py-0.5 text-[11px] font-medium"
                    style={{ background: cierreColor.bg, color: cierreColor.fg }}
                  >
                    {fmtPct(v.tasaCierre)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
