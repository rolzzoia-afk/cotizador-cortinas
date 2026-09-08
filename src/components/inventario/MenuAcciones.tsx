// Un menú chico de acciones: el botón «Etiquetas» del encabezado y el «···»
// de cada fila de las tablas del inventario.
//
// Existe porque la lámina pide tres botones arriba y las pantallas tienen
// ocho acciones: las que se usan todos los días quedan a la vista y el resto
// se agrupa acá, en vez de una barra de botones que nadie termina de leer.
//
// El panel se posiciona FIJO, con las coordenadas del botón: dentro de una
// tabla con scroll propio, un panel absoluto se corta en el borde y las
// últimas filas quedan con el menú a medias.

import { useEffect, useRef, useState } from 'react';

type Posicion = { arriba: number; izquierda?: number; derecha?: number };

export function MenuAcciones({
  disparador,
  children,
  alineacion = 'derecha',
  etiqueta,
  className,
}: {
  /** Lo que se ve del botón que abre el menú. */
  disparador: React.ReactNode;
  /** Los `ItemMenu`. El menú se cierra solo al elegir uno. */
  children: React.ReactNode;
  alineacion?: 'izquierda' | 'derecha';
  /** Cómo lo nombra un lector de pantalla. */
  etiqueta: string;
  /** Clases del botón, para que tome la pinta del sitio donde se usa. */
  className?: string;
}) {
  const [pos, setPos] = useState<Posicion | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const abrirCerrar = () => {
    if (pos) {
      setPos(null);
      return;
    }
    const r = boton.current?.getBoundingClientRect();
    if (!r) return;
    setPos({
      arriba: r.bottom + 4,
      ...(alineacion === 'derecha'
        ? { derecha: Math.max(8, window.innerWidth - r.right) }
        : { izquierda: r.left }),
    });
  };

  // Un clic afuera, Escape o un scroll lo cierran. El scroll importa: como el
  // panel va con coordenadas fijas, si la tabla se desplaza quedaría flotando
  // lejos de la fila que abrió.
  useEffect(() => {
    if (!pos) return;
    const cerrar = () => setPos(null);
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (boton.current?.contains(t) || panel.current?.contains(t)) return;
      cerrar();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', escape);
    // `true` para oírlo también cuando quien se desplaza es la tabla.
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('scroll', cerrar, true);
      window.removeEventListener('resize', cerrar);
    };
  }, [pos]);

  return (
    <>
      <button
        ref={boton}
        type="button"
        aria-haspopup="menu"
        aria-expanded={!!pos}
        aria-label={etiqueta}
        onClick={abrirCerrar}
        className={className}
      >
        {disparador}
      </button>
      {pos && (
        <div
          ref={panel}
          role="menu"
          onClick={() => setPos(null)}
          style={{ top: pos.arriba, left: pos.izquierda, right: pos.derecha }}
          className="fixed z-50 min-w-[220px] max-w-[300px] overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          {children}
        </div>
      )}
    </>
  );
}

export function ItemMenu({
  onClick,
  children,
  hint,
  deshabilitado,
}: {
  onClick: () => void;
  children: React.ReactNode;
  /** Una línea chica debajo, para explicar qué hace sin abrir nada. */
  hint?: string;
  deshabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={deshabilitado}
      onClick={onClick}
      className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-[0.8125rem] transition-colors hover:bg-accent/[0.09] disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <span className="flex items-center gap-2">{children}</span>
      {hint && <span className="text-[0.6875rem] leading-snug text-muted-foreground">{hint}</span>}
    </button>
  );
}

export function SeparadorMenu() {
  return <div className="my-1 h-px bg-border" />;
}

export default MenuAcciones;
