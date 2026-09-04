// El papel de la etiqueta en pantalla, a escala real.
//
// Cada elemento se dibuja donde va a salir impreso y se puede arrastrar o
// estirar; lo que se mueve son MILÍMETROS, no píxeles, así que el resultado es
// el mismo con cualquier zoom.
//
// El estilo de cada texto lo calcula `estiloCss`, la MISMA función que usa el
// generador del documento imprimible: si el editor tuviera su propia cuenta,
// tarde o temprano mostraría una cosa y la impresora otra.

import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { estiloCss } from '@/modules/etiquetas/etiquetaHtml';
import { interpolar, type ElementoEtiqueta, type PlantillaEtiqueta } from '@/modules/etiquetas/plantilla';
import { aMm, dentroDeLaHoja, pxPorMm } from './LienzoMm';

type Arrastre = {
  id: string;
  modo: 'mover' | 'redimensionar';
  x0: number;
  y0: number;
  base: { x: number; y: number; ancho: number; alto: number };
};

const TINTA = { negro: '#000', blanco: '#fff', gris: '#777' } as const;

/** El contenido visible de un elemento, con los datos de muestra. */
function contenido(e: ElementoEtiqueta, datos: Record<string, string>): string {
  switch (e.tipo) {
    case 'texto':
      return interpolar(e.texto, datos);
    case 'campo':
      return datos[e.slot] ?? '';
    case 'casilla':
      return e.rotulo;
    default:
      return '';
  }
}

export default function LienzoEtiqueta({
  plantilla,
  datos,
  zoom,
  logo,
  seleccion,
  onSeleccionar,
  onMover,
}: {
  plantilla: PlantillaEtiqueta;
  datos: Record<string, string>;
  zoom: number;
  logo: string;
  seleccion: string | null;
  onSeleccionar: (id: string | null) => void;
  onMover: (id: string, caja: { x: number; y: number; ancho: number; alto: number }) => void;
}) {
  const escala = pxPorMm(zoom);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const hoja = useRef<HTMLDivElement>(null);

  const iniciar = (e: React.PointerEvent, el: ElementoEtiqueta, modo: Arrastre['modo']) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onSeleccionar(el.id);
    setArrastre({
      id: el.id,
      modo,
      x0: e.clientX,
      y0: e.clientY,
      base: { x: el.x, y: el.y, ancho: el.ancho, alto: el.alto },
    });
  };

  const mover = (e: React.PointerEvent) => {
    if (!arrastre) return;
    const dx = aMm(e.clientX - arrastre.x0, zoom);
    const dy = aMm(e.clientY - arrastre.y0, zoom);
    const b = arrastre.base;
    if (arrastre.modo === 'mover') {
      onMover(arrastre.id, {
        ...b,
        x: dentroDeLaHoja(b.x + dx, b.ancho, plantilla.hoja.ancho),
        y: dentroDeLaHoja(b.y + dy, b.alto, plantilla.hoja.alto),
      });
    } else {
      onMover(arrastre.id, {
        ...b,
        ancho: Math.max(1, Math.min(plantilla.hoja.ancho - b.x, b.ancho + dx)),
        alto: Math.max(1, Math.min(plantilla.hoja.alto - b.y, b.alto + dy)),
      });
    }
  };

  return (
    <div
      ref={hoja}
      className="relative shrink-0 overflow-hidden border border-border bg-white shadow-sm"
      style={{ width: plantilla.hoja.ancho * escala, height: plantilla.hoja.alto * escala }}
      onPointerMove={mover}
      onPointerUp={() => setArrastre(null)}
      onPointerCancel={() => setArrastre(null)}
      onClick={() => onSeleccionar(null)}
    >
      {plantilla.elementos.map((el) => {
        const caja = {
          left: el.x * escala,
          top: el.y * escala,
          width: el.ancho * escala,
          height: el.alto * escala,
        };
        const activo = seleccion === el.id;
        const comun = cn(
          'absolute cursor-move select-none',
          !el.visible && 'opacity-25',
          activo && 'outline outline-2 outline-offset-[1px] outline-primary',
        );

        if (el.tipo === 'caja' || el.tipo === 'linea') {
          const borde =
            el.tipo === 'caja'
              ? { border: `${el.trazoPt}pt solid #000` }
              : el.orientacion === 'v'
                ? { borderLeft: `${el.trazoPt}pt ${el.punteada ? 'dashed' : 'solid'} #000` }
                : { borderTop: `${el.trazoPt}pt ${el.punteada ? 'dashed' : 'solid'} #000` };
          return (
            <div
              key={el.id}
              className={comun}
              style={{
                ...caja,
                ...borde,
                background: el.tipo === 'caja' && el.relleno ? TINTA[el.relleno] : undefined,
              }}
              onPointerDown={(e) => iniciar(e, el, 'mover')}
            >
              {activo && <Manija onPointerDown={(e) => iniciar(e, el, 'redimensionar')} />}
            </div>
          );
        }

        if (el.tipo === 'imagen' || el.tipo === 'qr') {
          const src = el.url || (el.tipo === 'imagen' ? logo : '');
          return (
            <div
              key={el.id}
              className={cn(comun, 'flex items-center justify-center')}
              style={caja}
              onPointerDown={(e) => iniciar(e, el, 'mover')}
            >
              {src ? (
                <img src={src} alt="" className="pointer-events-none h-full w-full object-contain" />
              ) : (
                <span className="text-[8px] text-neutral-400">sin imagen</span>
              )}
              {activo && <Manija onPointerDown={(e) => iniciar(e, el, 'redimensionar')} />}
            </div>
          );
        }

        // Textos, campos y casillas: el mismo CSS del documento imprimible,
        // más la línea que avisa cuando el dato no cabe en su recuadro.
        const texto = contenido(el, datos);
        return (
          <div
            key={el.id}
            className={cn(comun, 'flex items-center overflow-hidden whitespace-nowrap')}
            style={{ ...caja, ...cssAEstilo(estiloCss(el.estilo)) }}
            onPointerDown={(e) => iniciar(e, el, 'mover')}
            title={el.tipo === 'campo' ? `Dato: ${el.slot}` : undefined}
          >
            {el.tipo === 'casilla' && (
              <span
                className="mr-1 inline-block shrink-0 border border-black"
                style={{ width: 4.6 * escala, height: 4.6 * escala }}
              />
            )}
            <span className="pointer-events-none">{texto}</span>
            {activo && <Manija onPointerDown={(e) => iniciar(e, el, 'redimensionar')} />}
          </div>
        );
      })}
    </div>
  );
}

/** La esquina de la que se tira para estirar el elemento. */
function Manija({ onPointerDown }: { onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <span
      className="absolute -bottom-1 -right-1 h-2.5 w-2.5 cursor-nwse-resize rounded-sm border border-background bg-primary"
      onPointerDown={onPointerDown}
    />
  );
}

/** El string CSS del motor, pasado a las props de estilo de React. */
function cssAEstilo(css: string): React.CSSProperties {
  const out: Record<string, string> = {};
  for (const decl of css.split(';')) {
    const [prop, valor] = decl.split(':');
    if (!prop || !valor) continue;
    const camel = prop.trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[camel] = valor.trim();
  }
  return out as React.CSSProperties;
}
