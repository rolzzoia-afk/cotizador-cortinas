// Tabla expandida de un plan: una fila por corte + opcionalmente una fila
// por sobrante (sobrante puro, intermedio o desecho). Cada corte tiene
// botón para registrar error; cada sobrante puede marcarse como inexistente.

import type { ReactNode } from 'react';
import { GhostIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getOrd, getR } from '../utils/parsers';
import { fmtFecha } from '../utils/formato';
import type { Plan } from '../HistorialCorte.types';

// Regla de negocio: un sobrante de ≤ 10 cm es MERMA (se desecha), aunque el
// plan guardado no traiga `es_desecho` (planes viejos o reconstruidos a mano).
// Espejo de MERMA_MAX_MM = 100 en el optimizador legacy.
const MERMA_MAX_CM = 10;

interface PlanTablaProps {
  plan: Plan;
  errores: { linea_idx: number; motivo: string }[];
  onRegistrarError: (idx: number) => void;
  onMarcarSobranteInexistente: (idx: number, descripcion: string) => void;
  readonly?: boolean;
}

export default function PlanTabla({
  plan,
  errores,
  onRegistrarError,
  onMarcarSobranteInexistente,
  readonly = false,
}: PlanTablaProps) {
  const rows: ReactNode[] = [];
  plan.resultados.forEach((item, idx) => {
    const r = getR(item);
    const ord = getOrd(item, plan.ordenes);
    const ot = ord.ot || ord.numero_ot || r.orden || '-';
    const ubicacion = ord.ubic || ord.ubicacion || '-';
    // Material nuevo: el corte NO sale de una colmena. `r.colmena` en ese caso
    // es la posición DESTINO del sobrante, no el origen del corte.
    const esMaterialNuevo = r.fuente === 'tubo_nuevo' || !!r.nombreMaterialNuevo;
    const colmena = esMaterialNuevo
      ? r.nombreMaterialNuevo || 'TUBO NUEVO'
      : (r.colmena ?? 'TUBO NUEVO');
    const codigo = r.codigo || r.codigo_original || '-';
    const color = r.color || '-';
    const medidaCm = r.medida_cm != null ? Number(r.medida_cm).toFixed(1) : '-';
    const origenCm = r.medida_origen != null ? Number(r.medida_origen).toFixed(1) : '-';
    const s = (r.serial && typeof r.serial === 'object' ? r.serial : {}) as {
      lote?: string;
      paquete?: string;
      serial?: string;
      fecha?: string;
    };
    const lote = s.lote || r.lote || '-';
    const paquete = s.paquete || r.paquete || '-';
    const serial = s.serial || r.serial_str || '-';
    const fechaSer = s.fecha ? fmtFecha(s.fecha) : '-';

    const errorExistente = errores.find((e) => e.linea_idx === idx);
    let accion = 'CORTAR';
    if (r.es_cenefa_ovalada) accion = 'CORTAR CENEFA OVALADA';
    else if (r.es_peso) accion = 'CORTAR PESO';
    else if (r.codigo?.includes('TIRA')) accion = 'CORTAR CON TIRA';

    rows.push(
      <tr key={`c-${idx}`} className="border-b border-border hover:bg-secondary/40">
        <td className="whitespace-nowrap px-2.5 py-1.5">{ot}</td>
        <td className="whitespace-nowrap px-2.5 py-1.5">{ubicacion}</td>
        <td className="whitespace-nowrap px-2.5 py-1.5">
          <span className="rounded bg-accent/15 px-2 py-0.5 text-[12px] font-bold uppercase text-accent">
            {accion}
          </span>
        </td>
        <td className="whitespace-nowrap px-2.5 py-1.5">
          <strong>{String(colmena)}</strong>
        </td>
        <td className="whitespace-nowrap px-2.5 py-1.5">{codigo}</td>
        <td className="whitespace-nowrap px-2.5 py-1.5">{color}</td>
        <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-bold">{medidaCm}</td>
        <td className="whitespace-nowrap px-2.5 py-1.5 text-right">{origenCm}</td>
        <td className="whitespace-nowrap px-2.5 py-1.5">{lote}</td>
        <td className="whitespace-nowrap px-2.5 py-1.5">{paquete}</td>
        <td className="whitespace-nowrap px-2.5 py-1.5">{serial}</td>
        <td className="whitespace-nowrap px-2.5 py-1.5">{fechaSer}</td>
        <td className="whitespace-nowrap px-2.5 py-1.5">
          <button
            onClick={() => onRegistrarError(idx)}
            disabled={readonly && !errorExistente}
            className={cn(
              'rounded-md border px-2 py-1 text-[12px] font-bold uppercase transition',
              errorExistente
                ? 'cursor-default border-destructive/30 bg-destructive/15 text-destructive'
                : readonly
                  ? 'cursor-not-allowed border-border text-muted-foreground opacity-50'
                  : 'border-warning/30 text-warning hover:bg-warning/15',
            )}
            title={
              errorExistente
                ? `Ya registrado: ${errorExistente.motivo}`
                : readonly
                  ? 'Versión anterior: marcar errores en el plan actual'
                  : 'Registrar error en este corte'
            }
          >
            ⚠ {errorExistente ? errorExistente.motivo : 'Error'}
          </button>
        </td>
      </tr>,
    );

    if (r.sobrante_cm && Number(r.sobrante_cm) > 0) {
      const sobranteNum = Number(r.sobrante_cm);
      const sobranteCm = sobranteNum.toFixed(1);
      // Defensa: ≤ 10 cm SIEMPRE es merma, aunque es_desecho venga falso/ausente.
      const esDesecho = !!r.es_desecho || sobranteNum <= MERMA_MAX_CM;
      // Destino del sobrante: posición física (no la etiqueta 'TUBO NUEVO').
      const colSob = r.colmena_sobrante || r.colmena || colmena;
      let rowCls = 'border-b border-border bg-accent/[0.08] text-accent';
      let badgeCls = 'rounded bg-accent/20 px-2 py-0.5 text-[12px] font-bold uppercase text-accent';
      let accion2 = 'GUARDAR SOBRANTE';
      let colDisp: string | number = colSob;
      if (r.es_intermedio) {
        rowCls = 'border-b border-border bg-warning/10 text-warning';
        badgeCls = 'rounded bg-warning/20 px-2 py-0.5 text-[12px] font-bold uppercase text-warning';
        accion2 = 'RESERVAR EN MESA';
        colDisp = '—';
      } else if (esDesecho) {
        rowCls = 'border-b border-border bg-destructive/[0.08] text-destructive';
        badgeCls = 'rounded bg-destructive/20 px-2 py-0.5 text-[12px] font-bold uppercase text-destructive';
        accion2 = 'DESECHAR MERMA';
        colDisp = 'BASURERO';
      }
      const esSobrantePuro = !r.es_intermedio && !esDesecho;
      const descripcionSobrante = `${colSob} · ${codigo} · ${sobranteCm} cm`;
      rows.push(
        <tr key={`s-${idx}`} className={rowCls}>
          <td className="whitespace-nowrap px-2.5 py-1.5">{ot}</td>
          <td className="whitespace-nowrap px-2.5 py-1.5">{ubicacion}</td>
          <td className="whitespace-nowrap px-2.5 py-1.5">
            <span className={badgeCls}>{accion2}</span>
          </td>
          <td className="whitespace-nowrap px-2.5 py-1.5">{String(colDisp)}</td>
          <td className="whitespace-nowrap px-2.5 py-1.5">{codigo}</td>
          <td className="whitespace-nowrap px-2.5 py-1.5">{color}</td>
          <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-bold">{sobranteCm}</td>
          <td colSpan={5}></td>
          <td className="whitespace-nowrap px-2.5 py-1.5">
            {esSobrantePuro && (
              <button
                onClick={() => onMarcarSobranteInexistente(idx, descripcionSobrante)}
                disabled={readonly}
                className={cn(
                  'rounded-md border px-2 py-1 text-[12px] font-bold uppercase transition',
                  readonly
                    ? 'cursor-not-allowed border-border text-muted-foreground opacity-50'
                    : 'border-muted-foreground/30 text-muted-foreground hover:border-warning/50 hover:bg-warning/10 hover:text-warning',
                )}
                title={
                  readonly
                    ? 'Versión anterior: marcar sobrantes inexistentes en el plan actual'
                    : 'Marcar este sobrante como inexistente físicamente (no se guardó en la colmena)'
                }
              >
                <GhostIcon className="mr-1 inline h-3 w-3" />
                No existe
              </button>
            )}
          </td>
        </tr>,
      );
    }
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px]" style={{ minWidth: 900 }}>
        <thead>
          <tr className="border-b border-border bg-secondary/40">
            {[
              'OT',
              'Ubicación',
              'Acción',
              'Colmena',
              'Código',
              'Color',
              'Cortar (cm)',
              'Origen (cm)',
              'Lote',
              'Paquete',
              'Serial',
              'Fecha serial',
              '',
            ].map((h) => (
              <th
                key={h}
                className="whitespace-nowrap px-2.5 py-2 text-left text-[12px] font-bold uppercase tracking-wider text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}
