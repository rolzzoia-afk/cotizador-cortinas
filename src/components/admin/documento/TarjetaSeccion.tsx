// Una SECCIÓN del sistema en el editor del documento (datos del cliente,
// catálogo, cortinas, totales).
//
// Se dibuja su MAQUETA —el mismo markup y clases que la sección real de la
// cotización— para que la vista previa se vea como la página y las imágenes
// flotantes caigan donde van a caer de verdad. Se arrastra para reordenar, pero
// no se oculta ni se elimina: sin cortinas o totales la cotización no sirve.
//
// La barra de herramientas va flotando por encima (absolute) y el estado de
// selección es un `ring`, no un borde: así ni la barra ni la selección alteran
// el alto de la sección, que es la referencia de las posiciones flotantes.

import { useState } from 'react';
import { GripVertical } from 'lucide-react';
import { LABEL_TIPO, type TipoSeccionDoc } from '@/modules/cotizador/docCotizacion';
import MaquetaSeccion from './MaquetasSecciones';

/** Aviso al pie del rótulo, cuando la sección no viaja al papel. */
const NOTA: Partial<Record<TipoSeccionDoc, string>> = {
  catalogo: 'no sale impreso',
};

interface TarjetaSeccionProps {
  tipo: TipoSeccionDoc;
  seleccionada: boolean;
  arrastrando: boolean;
  onSeleccionar: () => void;
  onDragStart: () => void;
  onDropEn: () => void;
}

export default function TarjetaSeccion({
  tipo,
  seleccionada,
  arrastrando,
  onSeleccionar,
  onDragStart,
  onDropEn,
}: TarjetaSeccionProps) {
  const [sobre, setSobre] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setSobre(true);
      }}
      onDragLeave={() => setSobre(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setSobre(false);
        onDropEn();
      }}
      onClick={onSeleccionar}
      className={`relative rounded-md transition ${
        seleccionada ? 'ring-2 ring-accent' : sobre ? 'ring-2 ring-accent/50' : ''
      } ${arrastrando ? 'opacity-40' : ''}`}
    >
      {/* Rótulo flotante: no ocupa alto, para no deformar la maqueta. */}
      <div className="absolute -top-2 left-1 z-20 flex items-center gap-1 rounded bg-card px-1 text-[10px] text-muted-foreground shadow">
        <span
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            onDragStart();
          }}
          className="cursor-grab active:cursor-grabbing"
          title="Arrastrar para mover esta sección"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        <span className="font-semibold">{LABEL_TIPO[tipo]}</span>
        {NOTA[tipo] && <span className="italic opacity-70">· {NOTA[tipo]}</span>}
      </div>

      {/* La maqueta no debe reaccionar al mouse: los clics son del editor. */}
      <div className="pointer-events-none">
        <MaquetaSeccion tipo={tipo} />
      </div>
    </div>
  );
}
