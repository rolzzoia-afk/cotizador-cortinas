// Render de UN bloque de contenido del documento de cotización.
//
// Lo usan DOS lugares con el mismo componente, a propósito: el documento real
// (Fase 1 / Fase 3) y la vista previa del editor de admin. Así lo que se ve al
// editar es exactamente lo que se imprime.
//
// Las SECCIONES del sistema (cliente, catálogo, cortinas, totales) no pasan por
// acá: su contenido vivo lo arma CotizadorFase0 y el editor las dibuja como
// tarjetas de referencia.

import type { ReactNode } from 'react';
import type { ParametrosCotizador } from '@/modules/cotizador/preciosFase0';
import type { ConfigTerminos } from '@/modules/cotizador/terminos';
import { claseAlineacion, type BloqueDoc } from '@/modules/cotizador/docCotizacion';
import BannerCuotas from './BannerCuotas';
import CarruselImagenes from './CarruselImagenes';
import TerminosCotizacion from './TerminosCotizacion';

/** Los datos vivos que necesitan los bloques para dibujarse. */
export type DatosBloques = {
  terminos: ConfigTerminos;
  categorias: string[];
  telas: string[];
  parametros: ParametrosCotizador;
  fmtPct: (n: number) => string;
};

interface BloqueDocRenderProps {
  bloque: BloqueDoc;
  datos: DatosBloques;
  /** En el editor: placeholders visibles cuando el bloque aún no tiene contenido. */
  conPlaceholder?: boolean;
}

/** El contenido del bloque, sin el envoltorio de ancho/alineación. */
export function ContenidoBloque({ bloque: b, datos, conPlaceholder }: BloqueDocRenderProps) {
  switch (b.tipo) {
    case 'terminos':
      return (
        <TerminosCotizacion
          config={datos.terminos}
          categorias={datos.categorias}
          telas={datos.telas}
          parametros={datos.parametros}
          fmtPct={datos.fmtPct}
        />
      );
    case 'banner_cuotas':
      return <BannerCuotas proveedor={datos.parametros.proveedorTarjeta} />;
    case 'texto':
      return (
        <div className="mt-4 rounded-lg border border-border bg-card/40 p-4 text-[11px] leading-relaxed text-muted-foreground">
          {b.titulo && <div className="mb-1 font-semibold text-foreground">{b.titulo}</div>}
          {/* whitespace-pre-line respeta los saltos de línea que escribió el admin. */}
          <div className="whitespace-pre-line">
            {b.texto || (conPlaceholder ? <span className="italic opacity-60">(cuadro de texto vacío)</span> : null)}
          </div>
        </div>
      );
    case 'imagen': {
      if (!b.url) {
        return conPlaceholder ? (
          <div className="mt-4 rounded-lg border border-dashed p-6 text-center text-[11px] italic text-muted-foreground">
            (imagen sin definir — súbela en el panel de la derecha)
          </div>
        ) : null;
      }
      return <ImagenBloque bloque={b} className="mt-4 h-auto max-w-full rounded-lg" />;
    }
    case 'carrusel': {
      const imagenes = b.imagenes ?? [];
      if (!imagenes.length) {
        return conPlaceholder ? (
          <div className="mt-4 rounded-lg border border-dashed p-6 text-center text-[11px] italic text-muted-foreground">
            (carrusel vacío — agrégale imágenes en el panel de la derecha)
          </div>
        ) : null;
      }
      return <CarruselImagenes imagenes={imagenes} sinEnlace={conPlaceholder} />;
    }
    default:
      return null;
  }
}

/** La imagen con su enlace opcional. Se reusa también en las flotantes. */
export function ImagenBloque({
  bloque: b,
  className,
  sinEnlace,
}: {
  bloque: BloqueDoc;
  className?: string;
  /** true en el editor: el clic selecciona el bloque en vez de abrir el enlace. */
  sinEnlace?: boolean;
}) {
  const img = (
    <img
      src={b.url}
      alt={b.alt || ''}
      className={className}
      style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    />
  );
  // El enlace es clickeable en pantalla; al imprimir queda solo la imagen.
  return b.enlace && !sinEnlace ? (
    <a href={b.enlace} target="_blank" rel="noreferrer noopener">
      {img}
    </a>
  ) : (
    img
  );
}

/** El bloque completo: envoltorio de ancho/alineación + contenido. */
export default function BloqueDocRender({ bloque, datos, conPlaceholder }: BloqueDocRenderProps) {
  return (
    <div className={`flex ${claseAlineacion(bloque.alineacion)}`}>
      <div style={{ width: `${bloque.ancho}%` }}>
        <ContenidoBloque bloque={bloque} datos={datos} conPlaceholder={conPlaceholder} />
      </div>
    </div>
  );
}

/**
 * Envuelve una sección del documento: la ubica según el layout y dibuja encima
 * sus imágenes flotantes.
 *
 * El reordenamiento es con `order` de flexbox y no moviendo el JSX: las
 * secciones son cientos de líneas con su propia lógica, y así el orden lo
 * decide el layout sin tocarlas. `order` es layout puro, así que la impresión
 * respeta lo mismo que la pantalla.
 *
 * Las flotantes se posicionan en % DE LA SECCIÓN, no de la página: así viajan
 * con ella cuando el admin la reordena y sobreviven a la impresión, donde el
 * alto del documento cambia.
 */
export function SeccionDocumento({
  orden,
  flotantes,
  children,
}: {
  orden: number;
  flotantes: BloqueDoc[];
  children: ReactNode;
}) {
  return (
    <div className={flotantes.length ? 'relative' : undefined} style={{ order: orden }}>
      {children}
      {flotantes.map((b) => {
        const contenido =
          b.tipo === 'carrusel' ? (
            // -mt-4 anula el margen superior con que el carrusel se separa del
            // bloque anterior cuando va en el flujo: acá está posicionado.
            <div className="-mt-4">
              <CarruselImagenes imagenes={b.imagenes ?? []} />
            </div>
          ) : b.url ? (
            <ImagenBloque bloque={b} className="h-auto w-full rounded-lg" />
          ) : null;
        if (!contenido) return null;
        return (
          <div
            key={b.id}
            className="absolute z-10"
            style={{ left: `${b.flotante!.x}%`, top: `${b.flotante!.y}%`, width: `${b.ancho}%` }}
          >
            {contenido}
          </div>
        );
      })}
    </div>
  );
}
