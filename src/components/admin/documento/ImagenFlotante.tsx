// Un bloque FLOTANTE dentro del editor (imagen o carrusel): se arrastra libre
// sobre la sección que lo ancla y su posición se guarda en % de esa sección.
//
// El arrastre va con pointer events sobre el box de la sección (mismo patrón
// que el resize de BloqueEditable): el drag & drop HTML5 no sirve acá porque no
// da coordenadas continuas mientras se mueve.

import { useRef } from 'react';
import { Move } from 'lucide-react';
import CarruselImagenes from '@/components/cotizador/CarruselImagenes';
import { ImagenBloque } from '@/components/cotizador/BloquesDocumento';
import type { BloqueDoc, PosicionFlotante } from '@/modules/cotizador/docCotizacion';

/**
 * El contenido del bloque: los MISMOS componentes que dibuja `SeccionDocumento`
 * en la cotización real, con las mismas clases. Antes acá había una maqueta
 * aparte (imágenes `rounded` en vez de `rounded-lg`, carrusel con `gap-1` y sin
 * el `-mt-4`) y la imagen no se veía igual al entrar a Fase 1.
 *
 * `pointer-events-none` para no robarle el arrastre al contenedor.
 */
function contenido(b: BloqueDoc) {
  if (b.tipo === 'carrusel') {
    const imgs = b.imagenes ?? [];
    if (!imgs.length) return <Vacio texto="carrusel vacío" />;
    return (
      // -mt-4 anula el margen con que el carrusel se separa del bloque anterior
      // cuando va en el flujo: acá está posicionado (igual que en el documento).
      <div className="pointer-events-none -mt-4">
        <CarruselImagenes imagenes={imgs} sinEnlace />
      </div>
    );
  }
  if (!b.url) return <Vacio texto="imagen sin definir" />;
  return (
    <div className="pointer-events-none">
      <ImagenBloque bloque={b} className="h-auto w-full rounded-lg" sinEnlace />
    </div>
  );
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
      // La marca de selección va con `ring` (que se pinta por fuera y no ocupa
      // caja) y no con `border-2`, que le comía 4 px al ancho de la imagen y la
      // dejaba más chica que en la cotización.
      className={`absolute z-10 cursor-move rounded-lg ring-2 ${
        seleccionada ? 'ring-accent' : 'ring-transparent hover:ring-accent/40'
      }`}
      title="Arrastrar para colocarla donde quieras"
    >
      {contenido(bloque)}
    </div>
  );
}
