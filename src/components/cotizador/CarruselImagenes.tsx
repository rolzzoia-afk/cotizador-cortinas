// Carrusel ESTÁTICO del documento de cotización: las imágenes se muestran una
// al lado de la otra, en una fila.
//
// Sin autoavance, flechas ni puntos, a propósito: la cotización se imprime y se
// manda en PDF, donde nada de eso funciona. Lo que se ve en pantalla es
// exactamente lo que sale en el papel.

import type { ImagenCarrusel } from '@/modules/cotizador/docCotizacion';

interface CarruselImagenesProps {
  imagenes: ImagenCarrusel[];
  /** true en el editor: el clic selecciona el bloque en vez de abrir el enlace. */
  sinEnlace?: boolean;
}

export default function CarruselImagenes({ imagenes, sinEnlace }: CarruselImagenesProps) {
  if (!imagenes.length) return null;
  return (
    <div className="mt-4 flex gap-2">
      {imagenes.map((im, i) => {
        const img = (
          <img
            src={im.url}
            alt={im.alt || ''}
            className="h-auto w-full rounded-lg"
            style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
          />
        );
        return (
          // Todas al mismo ancho; min-w-0 evita que una imagen grande estire la
          // fila y desborde el documento.
          <div key={`${im.url}-${i}`} className="min-w-0 flex-1">
            {im.enlace && !sinEnlace ? (
              <a href={im.enlace} target="_blank" rel="noreferrer noopener">
                {img}
              </a>
            ) : (
              img
            )}
          </div>
        );
      })}
    </div>
  );
}
