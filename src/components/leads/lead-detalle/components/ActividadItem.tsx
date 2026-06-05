// Item de la timeline de actividad de un lead. Renderiza distintos tipos:
// creado, agente_ingreso, cambio_estado, comentario, asignacion,
// conversion_ot, seguimiento, etc.

import type { ReactNode } from 'react';
import {
  ESTADOS_LABEL,
  SEG_RESULTADO_LABEL,
  type LeadActividad,
  type LeadEstado,
} from '@/modules/leads/types';
import { formatFecha } from '../utils/formato';

interface ActividadItemProps {
  act: LeadActividad;
}

export default function ActividadItem({ act }: ActividadItemProps) {
  const det = act.detalle as Record<string, unknown>;
  let texto: ReactNode;
  switch (act.tipo) {
    case 'creado':
      texto = (
        <span>
          Lead creado
          {det.fuente ? <em className="ml-1 text-muted-foreground">· {String(det.fuente)}</em> : null}
        </span>
      );
      break;
    case 'agente_ingreso':
      texto = <span>Ingresado por agente IA</span>;
      break;
    case 'cambio_estado':
      texto = (
        <span>
          Estado:{' '}
          <strong className="text-muted-foreground">
            {ESTADOS_LABEL[det.de as LeadEstado] || String(det.de)}
          </strong>
          {' → '}
          <strong className="text-foreground">
            {ESTADOS_LABEL[det.a as LeadEstado] || String(det.a)}
          </strong>
          {det.motivo ? <em className="ml-1 text-muted-foreground">· {String(det.motivo)}</em> : null}
          {det.comentario ? <div className="mt-1 text-muted-foreground">{String(det.comentario)}</div> : null}
        </span>
      );
      break;
    case 'comentario':
      texto = <span>{String(det.texto || '')}</span>;
      break;
    case 'asignacion':
      texto = <span>Asignado a vendedora</span>;
      break;
    case 'conversion_ot':
      texto = <span>Convertido en cotización (OT)</span>;
      break;
    case 'seguimiento':
      if (det.accion === 'archivado_auto') {
        texto = <span>Archivado automáticamente por falta de respuesta (día +8)</span>;
      } else {
        texto = (
          <span>
            Seguimiento {det.etapa ? String(det.etapa) : ''}:{' '}
            <strong className="text-foreground">
              {SEG_RESULTADO_LABEL[det.resultado as keyof typeof SEG_RESULTADO_LABEL] ||
                String(det.resultado ?? '')}
            </strong>
            {det.nota ? <div className="mt-1 text-muted-foreground">{String(det.nota)}</div> : null}
          </span>
        );
      }
      break;
    default:
      texto = <span>{act.tipo}</span>;
  }
  return (
    <li className="flex gap-3 border-l-2 border-border pl-3 text-xs">
      <div className="flex-1">
        <div className="text-foreground">{texto}</div>
        <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {formatFecha(act.created_at)}
        </div>
      </div>
    </li>
  );
}
