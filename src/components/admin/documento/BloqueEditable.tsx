// Un bloque dentro del editor del documento: se arrastra para reordenar, se
// redimensiona con la manija de la derecha y se edita en su panel.
//
// Drag & drop con la API HTML5 nativa (igual que el Kanban de leads) y resize
// con pointer events: el repo no tiene librerías de dnd/resize y no vale la
// pena sumar una para esto.

import { useRef, useState, type ReactNode } from 'react';
import { Eye, EyeOff, GripVertical, Trash2 } from 'lucide-react';
import {
  ANCHO_MAX,
  ANCHO_MIN,
  LABEL_TIPO,
  claseAlineacion,
  type AlineacionBloque,
  type BloqueDoc,
} from '@/modules/cotizador/docCotizacion';

const ALINEACIONES: Array<{ v: AlineacionBloque; label: string }> = [
  { v: 'izquierda', label: '⌐' },
  { v: 'centro', label: '≡' },
  { v: 'derecha', label: '¬' },
];

interface BloqueEditableProps {
  bloque: BloqueDoc;
  seleccionado: boolean;
  onSeleccionar: () => void;
  onChange: (patch: Partial<BloqueDoc>) => void;
  onEliminar: () => void;
  onDragStart: () => void;
  onDropEn: () => void;
  arrastrando: boolean;
  children: ReactNode;
}

export default function BloqueEditable({
  bloque,
  seleccionado,
  onSeleccionar,
  onChange,
  onEliminar,
  onDragStart,
  onDropEn,
  arrastrando,
  children,
}: BloqueEditableProps) {
  const [sobre, setSobre] = useState(false);
  const contRef = useRef<HTMLDivElement>(null);

  // Resize: se calcula el % sobre el ancho del contenedor del documento.
  const iniciarResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const cont = contRef.current?.parentElement;
    if (!cont) return;
    const rect = cont.getBoundingClientRect();
    const mover = (ev: PointerEvent) => {
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      onChange({ ancho: Math.min(ANCHO_MAX, Math.max(ANCHO_MIN, Math.round(pct))) });
    };
    const soltar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
  };

  return (
    <div
      className={`flex ${claseAlineacion(bloque.alineacion)} ${sobre ? 'ring-2 ring-accent/40' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        // Sin stopPropagation el contenedor de la lista también trataría el
        // drop y movería el bloque al final, pisando este destino.
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
    >
      <div
        ref={contRef}
        style={{ width: `${bloque.ancho}%` }}
        // El marco de edición va con `outline` y no con `border-2 + p-1`: el
        // borde y el padding le robaban 6 px por lado al contenido, así que el
        // bloque medía menos que en la cotización real. `outline` se pinta por
        // fuera y no ocupa caja.
        className={`relative rounded-md outline-dashed outline-2 outline-offset-1 transition ${
          seleccionado ? 'outline-accent' : 'outline-transparent hover:outline-border'
        } ${arrastrando ? 'opacity-40' : ''} ${!bloque.visible ? 'opacity-40' : ''}`}
        onClick={onSeleccionar}
      >
        {/* Barra de herramientas del bloque */}
        <div className="absolute -top-2 left-1 z-10 flex items-center gap-0.5 rounded bg-card px-1 shadow">
          <span
            draggable
            onDragStart={onDragStart}
            className="cursor-grab text-muted-foreground active:cursor-grabbing"
            title="Arrastrar para reordenar"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          <span className="text-[10px] text-muted-foreground">{LABEL_TIPO[bloque.tipo]}</span>
          <span className="text-[10px] text-muted-foreground">· {bloque.ancho}%</span>
          {ALINEACIONES.map((a) => (
            <button
              key={a.v}
              onClick={(e) => {
                e.stopPropagation();
                onChange({ alineacion: a.v });
              }}
              className={`px-0.5 text-[11px] ${
                bloque.alineacion === a.v ? 'text-accent' : 'text-muted-foreground'
              }`}
              title={`Alinear a ${a.v}`}
            >
              {a.label}
            </button>
          ))}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange({ visible: !bloque.visible });
            }}
            className="text-muted-foreground"
            title={bloque.visible ? 'Ocultar en el documento' : 'Mostrar en el documento'}
          >
            {bloque.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEliminar();
            }}
            className="text-destructive"
            title="Quitar bloque"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {children}

        {/* Manija de resize */}
        <div
          onPointerDown={iniciarResize}
          className="absolute -right-1 top-1/2 h-8 w-2 -translate-y-1/2 cursor-ew-resize rounded bg-accent/50 opacity-0 transition hover:opacity-100"
          style={{ opacity: seleccionado ? 0.8 : undefined }}
          title="Arrastrar para cambiar el ancho"
        />
      </div>
    </div>
  );
}
