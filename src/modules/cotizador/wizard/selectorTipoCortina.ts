// ─────────────────────────────────────────────────────────────────────
// «SELECCIONA EL TIPO DE CORTINA» — la pantalla visual del flujo guiado.
//
// El mockup del dueño (app de vendedores de terreno, 2026-08-20) agrupa los
// sistemas en familias con dibujo: Roller (SC/BK · Dual · Dúo), Verticales,
// Sistemas de oscuridad, Beeblack y Toldos. Cada TARJETA junta las categorías
// reales de su familia como VARIANTES (chips): tocar la tarjeta elige la
// variante por defecto (la primera) y los chips afinan la categoría exacta —
// la misma que el select «Tipo de cortina» de Fase 1/ficha.
//
// Lo que la app todavía no sabe fabricar (S. Dreams, Toldos) va DESHABILITADO
// con su rótulo, para que la pantalla se lea como el mockup sin dejar elegir
// algo que no se puede despiezar (decisión del dueño 2026-08-20).
//
// Los TIPOS PROPIOS de Admin se suman como tarjetas de texto en la sección de
// su grupo (o «Tipos propios»), igual que se suman al select de Fase 1.
//
// Módulo puro (sin React) para poder testear la cobertura: un test verifica
// que las variantes habilitadas cubren EXACTAMENTE las categorías del select.
// ─────────────────────────────────────────────────────────────────────
import {
  GRUPO_TIPOS_PROPIOS,
  tiposActivos,
  type TipoCortina,
} from '@/modules/descuentos/tiposCortina';

export type VarianteTipoCortina = { categoria: string; etiqueta: string };

/** Con qué silueta se dibuja la tarjeta ('boton' = solo texto, como el mockup). */
export type DibujoTarjeta =
  | 'roller'
  | 'dual'
  | 'duo'
  | 'vertical'
  | 'sdreams'
  | 'beeblack'
  | 'toldo'
  | 'boton';

export type TarjetaTipoCortina = {
  id: string;
  titulo: string;
  dibujo: DibujoTarjeta;
  /** La primera es la que elige el toque en la tarjeta. */
  variantes: readonly VarianteTipoCortina[];
  /** Texto del porqué no se puede elegir ('Próximamente'); sin variantes. */
  deshabilitada?: string;
};

export type SeccionTipoCortina = { titulo: string; tarjetas: TarjetaTipoCortina[] };

const T = (categoria: string, etiqueta: string): VarianteTipoCortina => ({ categoria, etiqueta });

const SECCIONES_BASE: readonly SeccionTipoCortina[] = [
  {
    titulo: 'Roller',
    tarjetas: [
      {
        id: 'roller',
        titulo: 'SC/BK',
        dibujo: 'roller',
        variantes: [
          T('ROL', 'Simple'),
          T('ROL_MANUAL_CENEFA_OVALADA_38mm', 'Cenefa ovalada 38'),
          T('ROL_MANUAL_CENEFA_OVALADA_45mm', 'Cenefa ovalada 45'),
          T('ROL_CENEFA_OVALADA_MOTOR_PEQUEÑO', 'Cenefa motor pequeño'),
          T('ROL_CENEFA_OVALADA_MOTOR_GRANDE', 'Cenefa motor grande'),
          T('PLETINA_ROLLER_V', 'Pletina en V'),
        ],
      },
      { id: 'dual', titulo: 'Dual', dibujo: 'dual', variantes: [T('ROL_DUAL', 'Dual')] },
      {
        id: 'duo',
        titulo: 'Dúo',
        dibujo: 'duo',
        variantes: [
          T('DUO_MANUAL_38mm', 'Manual 38'),
          T('DUO_MANUAL_45mm', 'Manual 45'),
          T('DUO_MOTOR_PEQUEÑO_38mm', 'Motor pequeño 38'),
          T('DUO_MOTOR_GRANDE_45mm', 'Motor grande 45'),
          T('PLETINA_DUO_V', 'Pletina en V'),
        ],
      },
    ],
  },
  {
    titulo: 'Verticales',
    tarjetas: [
      { id: 'vertical', titulo: 'Vertical', dibujo: 'vertical', variantes: [T('VERTICAL', 'Vertical')] },
      { id: 'sdreams', titulo: 'S. Dreams', dibujo: 'sdreams', variantes: [], deshabilitada: 'Próximamente' },
    ],
  },
  {
    titulo: 'Sistemas de oscuridad',
    tarjetas: [
      {
        id: 'softlight',
        titulo: 'Soft Light',
        dibujo: 'boton',
        variantes: [T('SOFT_LIGHT_38mm', '38 mm'), T('SOFT_LIGHT_45mm', '45 mm')],
      },
      {
        id: 'dark',
        titulo: 'Dark Roller',
        dibujo: 'boton',
        variantes: [T('DARK_38mm', '38 mm'), T('DARK_45mm', '45 mm')],
      },
      { id: 'oscuranti', titulo: 'Oscuranti', dibujo: 'boton', variantes: [T('OSCURANTI_63mm', '63 mm')] },
    ],
  },
  {
    titulo: 'Beeblack',
    tarjetas: [
      { id: 'beeblack', titulo: 'Beeblack', dibujo: 'beeblack', variantes: [T('BEEBLACK', 'Beeblack')] },
    ],
  },
  {
    titulo: 'Toldos',
    tarjetas: [
      { id: 'toldo', titulo: 'SC/BK', dibujo: 'toldo', variantes: [], deshabilitada: 'Próximamente' },
    ],
  },
];

/**
 * Las secciones de la pantalla, con los tipos propios ACTIVOS agregados como
 * tarjetas de texto en la sección de su grupo (nueva si no existe) — el mismo
 * criterio que `categoriasFase1ConTipos`.
 */
export function seccionesTipoCortina(tipos?: readonly TipoCortina[]): SeccionTipoCortina[] {
  const secciones: SeccionTipoCortina[] = SECCIONES_BASE.map((s) => ({
    titulo: s.titulo,
    tarjetas: [...s.tarjetas],
  }));
  for (const t of tiposActivos(tipos)) {
    const etiqueta = t.grupo?.trim() || GRUPO_TIPOS_PROPIOS;
    const nombre = t.nombre || t.categoria;
    const tarjeta: TarjetaTipoCortina = {
      id: `tipo:${t.categoria}`,
      titulo: nombre,
      dibujo: 'boton',
      variantes: [T(t.categoria, nombre)],
    };
    const seccion = secciones.find((s) => s.titulo === etiqueta);
    if (seccion) seccion.tarjetas.push(tarjeta);
    else secciones.push({ titulo: etiqueta, tarjetas: [tarjeta] });
  }
  return secciones;
}
