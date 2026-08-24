// El lienzo de la vista previa del editor de documentos: dibuja el documento
// al ANCHO REAL que tendría la Fase 1 en esta pantalla y lo achica entero con
// `transform: scale`.
//
// POR QUÉ: la vista previa vive en una columna de ~850 px y la Fase 1 ocupa
// todo el ancho del monitor. Al dibujar la maqueta directo en esa columna, las
// proporciones NO eran las de la página (una imagen colocada al 60 % caía en
// otro punto al entrar a Fase 1) y encima los breakpoints de Tailwind miden el
// VIEWPORT, no el contenedor: la vista previa aplicaba las mismas clases `md:`
// / `lg:` que la página pero con la mitad del ancho, y todo se veía apretado.
//
// Con el lienzo al ancho real + `scale`, la vista previa es una FOTO de la
// página achicada: mismas proporciones, mismos saltos de columna, mismas
// posiciones relativas. Y como es solo `transform`, no cambia nada del layout:
// los arrastres y los resizes calculan porcentajes con `getBoundingClientRect`
// y `clientX/Y`, que ya vienen en píxeles de PANTALLA (escalados), así que
// dividir uno por otro da el mismo porcentaje con o sin escala.

import { useLayoutEffect, useRef, useState, type DragEventHandler, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Cuánto hay que achicar el documento para que su ancho real quepa en el
 * espacio disponible. Nunca agranda: si sobrara espacio, el documento se dibuja
 * a tamaño natural, igual que en la página.
 */
export function calcularEscala(anchoDisponible: number, anchoReal: number): number {
  if (!Number.isFinite(anchoDisponible) || !Number.isFinite(anchoReal)) return 1;
  if (anchoDisponible <= 0 || anchoReal <= 0) return 1;
  return Math.min(1, anchoDisponible / anchoReal);
}

interface LienzoEscaladoProps {
  /** Clases del marco visible del editor (borde, fondo). */
  className?: string;
  /** Soltar un bloque en el vacío del final. */
  onDragOver?: DragEventHandler<HTMLDivElement>;
  onDrop?: DragEventHandler<HTMLDivElement>;
  children: ReactNode;
}

export default function LienzoEscalado({
  className,
  onDragOver,
  onDrop,
  children,
}: LienzoEscaladoProps) {
  const marcoRef = useRef<HTMLDivElement>(null);
  const lienzoRef = useRef<HTMLDivElement>(null);
  const [disponible, setDisponible] = useState(0);
  const [real, setReal] = useState(0);
  const [alto, setAlto] = useState(0);

  useLayoutEffect(() => {
    const marco = marcoRef.current;
    const lienzo = lienzoRef.current;
    if (!marco || !lienzo) return;
    // El ancho real del documento es el del `<main>` que comparten el Admin y
    // la Fase 1 (App.tsx): la página no tiene ancho máximo, ocupa el contenedor
    // completo. `clientWidth` ya descuenta la barra de scroll.
    const pagina = marco.closest('main');
    const medir = () => {
      setDisponible(marco.clientWidth);
      setReal(pagina?.clientWidth || document.documentElement.clientWidth);
      // `offsetHeight` es el alto SIN escalar (transform no toca el layout):
      // multiplicado por la escala da el alto que debe reservar el marco.
      setAlto(lienzo.offsetHeight);
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(marco);
    obs.observe(lienzo);
    if (pagina) obs.observe(pagina);
    return () => obs.disconnect();
  }, []);

  const escala = calcularEscala(disponible, real);

  return (
    // El marco reserva el alto YA escalado; si no, dejaría el hueco del
    // documento a tamaño natural y la página del Admin quedaría gigante.
    <div
      ref={marcoRef}
      className={cn('relative min-w-0 overflow-hidden', className)}
      style={alto > 0 ? { height: alto * escala } : undefined}
    >
      <div
        ref={lienzoRef}
        onDragOver={onDragOver}
        onDrop={onDrop}
        // ESPEJO del contenedor del documento en CotizadorFase0
        // (`flex flex-col px-5 py-4`): las maquetas y los bloques traen sus
        // propios márgenes, acá solo va el marco de la página.
        className="flex flex-col px-5 py-4"
        style={{
          width: real > 0 ? real : '100%',
          transform: `scale(${escala})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
}
