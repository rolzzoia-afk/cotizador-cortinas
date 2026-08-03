// Un bloque FLOTANTE dentro del editor (imagen o carrusel): se arrastra libre
// sobre la sección que lo ancla y su posición se guarda en % de esa sección.
//
// El arrastre va con pointer events sobre el box de la sección (mismo patrón
// que el resize de BloqueEditable): el drag & drop HTML5 no sirve acá porque no
// da coordenadas continuas mientras se mueve.

import { useRef } from 'react';
import { Move } from 'lucide-react';
import type { BloqueDoc, PosicionFlotante } from '@/modules/cotizador/docCotizacion';

/** La maqueta del bloque. `pointer-events-none` para no robarle el arrastre. */
function contenido(b: BloqueDoc) {
  if (b.tipo === 'carrusel') {
    const imgs = b.imagenes ?? [];
    if (!imgs.length) return <Vacio texto="carrusel vacío" />;
    return (
      <div className="pointer-events-none flex gap-1">
        {imgs.map((im, i) => (
          <img
            key={`${im.url}-${i}`}
            src={im.url}
            alt=""
            className="h-auto min-w-0 flex-1 rounded"
          />
        ))}
      </div>
    );
  }
  if (!b.url) return <Vacio texto="imagen sin definir" />;
  return <img src={b.url} alt={b.alt || ''} className="pointer-events-none h-auto w-full rounded" />;
}

function Vacio({ texto }: { texto: string }) {
  return (
    <div className="flex items-center justify-center gap-1 rounded bg-card/90 p-2 text-[10px] italic text-muted-foreground">
      <Move className="h-3 w-3" /> {texto}
    </div>
  );
}

interface ImagenFlotanteProps {
  bloque: BloqueDoc;
  seleccionada: boolean;
  onSeleccionar: () => void;
  onMover: (pos: PosicionFlotante) => void;
}

export default function ImagenFlotante({
  bloque,
  seleccionada,
  onSeleccionar,
  onMover,
}: ImagenFlotanteProps) {
  const ref = useRef<HTMLDivElement>(null);
  const f = bloque.flotante!;

  const iniciarArrastre = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSeleccionar();
    const cont = ref.current?.parentElement;
    if (!cont) return;
    const caja = cont.getBoundingClientRect();
    // Se agarra desde donde se hizo clic, no desde la esquina: si no, la imagen
    // salta al puntero apenas empieza el arrastre.
    const propio = ref.current!.getBoundingClientRect();
    const dx = e.clientX - propio.left;
    const dy = e.clientY - propio.top;

    const mover = (ev: PointerEvent) => {
      const x = ((ev.clientX - dx - caja.left) / caja.width) * 100;
      const y = ((ev.clientY - dy - caja.top) / caja.height) * 100;
      onMover({
        sobre: f.sobre,
        x: Math.min(100, Math.max(0, Math.round(x * 10) / 10)),
        y: Math.min(100, Math.max(0, Math.round(y * 10) / 10)),
      });
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
      ref={ref}
      onPointerDown={iniciarArrastre}
      // Sin esto el clic burbujea a la tarjeta de la sección y la selección
      // salta de la imagen a la sección apenas se suelta.
      onClick={(e) => e.stopPropagation()}
      style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${bloque.ancho}%` }}
      className={`absolute z-10 cursor-move rounded border-2 ${
        seleccionada ? 'border-accent' : 'border-transparent hover:border-accent/40'
      }`}
      title="Arrastrar para colocarla donde quieras"
    >
      {contenido(bloque)}
    </div>
  );
}
