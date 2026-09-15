// ─────────────────────────────────────────────────────────────────────
// RECONOCER UN ARTÍCULO CON LA CÁMARA — las reglas, sin pantalla ni red.
//
// La idea, en una línea: la app PROPONE hasta cinco artículos y la persona
// CONFIRMA. Nunca decide sola.
//
// Por qué importa esa línea: dos tamaños del mismo kit, un tubo E01 y uno E39,
// o dos blackout beige de la misma familia se ven casi iguales en una foto. El
// parecido visual los deja empatados y ahí no hay nada que hacer salvo mirar el
// código impreso o el tamaño. Por eso la pantalla muestra siempre una BANDA
// (seguro / probable / dudoso) en vez de un nombre a secas: la persona sabe
// cuánta confianza tenerle antes de tocar nada.
//
// Los umbrales de acá son un ESPEJO de los que usa la función
// `reconocer-articulo`. Se calibran juntos, mirando la tabla `reconocimientos`
// (la consulta está al pie de sql/20260916_reconocimiento_01_fotos.sql).
// ─────────────────────────────────────────────────────────────────────

import { normalizarCodigoInsumo } from './codigosInsumo';
import { claveTela } from '@/modules/visita/fotosTelas';

export type DominioReconocimiento = 'insumo' | 'tela';
export type Banda = 'seguro' | 'probable' | 'dudoso';

/** Los mismos números que `supabase/functions/reconocer-articulo/comun.ts`. */
export const UMBRALES = {
  seguro: 0.8,
  posible: 0.62,
  minimo: 0.45,
  margenDuda: 0.04,
} as const;

export type Candidato = {
  dominio: DominioReconocimiento;
  cod: string;
  nombre: string;
  similitud: number;
  banda: Banda;
  miniatura_url: string | null;
  foto_url: string | null;
  n_fotos: number;
};

export type Juicio = {
  eleccion: string | null;
  confianza: 'alta' | 'media' | 'baja';
  codigo_leido: string | null;
  motivo: string;
};

export type ResultadoReconocimiento = {
  reconocimiento_id: string | null;
  candidatos: Candidato[];
  sugerido: string | null;
  duda: boolean;
};

/** En qué banda cae un parecido. */
export function bandaDeSimilitud(similitud: number): Banda {
  if (similitud >= UMBRALES.seguro) return 'seguro';
  if (similitud >= UMBRALES.posible) return 'probable';
  return 'dudoso';
}

/**
 * ¿Hace falta la segunda opinión? Dos casos: el mejor no llega a «seguro», o
 * los dos primeros están tan juntos que el parecido no los distingue. Si no hay
 * NADA parecido tampoco sirve preguntar: no habría entre qué elegir.
 */
export function hayDuda(similitudes: number[]): boolean {
  const top1 = similitudes[0] ?? 0;
  if (top1 < UMBRALES.minimo) return false;
  if (top1 < UMBRALES.seguro) return true;
  return top1 - (similitudes[1] ?? 0) < UMBRALES.margenDuda;
}

/** Cómo se le explica la banda a quien está mirando. */
export function textoDeBanda(banda: Banda): string {
  if (banda === 'seguro') return 'Muy parecido';
  if (banda === 'probable') return 'Se parece';
  return 'Dudoso';
}

// ── Enseñar: los ángulos que se piden ────────────────────────────────

export type AnguloGuia = {
  id: 'frente' | 'lado' | 'arriba' | 'etiqueta' | 'escala';
  titulo: string;
  ayuda: string;
  obligatorio: boolean;
};

/**
 * Las tomas que se piden al enseñar un artículo, en orden.
 *
 * Las dos últimas son las que salvan los casos difíciles: la ETIQUETA permite
 * leer el código cuando el parecido empata, y la ESCALA (una moneda al lado) es
 * lo único que distingue dos piezas iguales de distinto tamaño. Se pueden
 * omitir, pero la pantalla dice para qué sirven.
 */
export const ANGULOS_GUIA: readonly AnguloGuia[] = [
  { id: 'frente', titulo: 'De frente', ayuda: 'Que llene el cuadro, con luz pareja.', obligatorio: true },
  { id: 'lado', titulo: 'De lado', ayuda: 'Para que se vea el grosor y la forma.', obligatorio: true },
  { id: 'arriba', titulo: 'Desde arriba', ayuda: 'Apoyado, mirándolo hacia abajo.', obligatorio: false },
  {
    id: 'etiqueta',
    titulo: 'La etiqueta',
    ayuda: 'El código impreso, si tiene. Es lo que desempata cuando dos se parecen.',
    obligatorio: false,
  },
  {
    id: 'escala',
    titulo: 'Con referencia de tamaño',
    ayuda: 'Una moneda o una huincha al lado: distingue dos piezas iguales de distinto tamaño.',
    obligatorio: false,
  },
];

/** Cuántas tomas obligatorias faltan todavía. */
export function faltanObligatorias(hechos: ReadonlyArray<string>): number {
  return ANGULOS_GUIA.filter((a) => a.obligatorio && !hechos.includes(a.id)).length;
}

// ── El QR de la etiqueta ─────────────────────────────────────────────

/**
 * Lo que dice una etiqueta impresa por la app: `INS:<cod>` en los insumos y
 * `TEL:<codigo>` en las telas (`QRInsumoDialog` / `QRTelaDialog`). `LOC:` es una
 * ubicación de rack, no un artículo.
 *
 * Si la foto trae un QR, esto gana sobre cualquier parecido: es el propio
 * artículo diciendo su nombre. Y sale gratis —se lee en el teléfono—, así que
 * se intenta SIEMPRE antes de mandar la foto a ninguna parte.
 */
export function parsearPayloadQR(texto: unknown): { dominio: DominioReconocimiento; cod: string } | null {
  const s = String(texto ?? '').trim();
  if (!s) return null;
  const m = /^(INS|TEL)\s*:\s*(.+)$/i.exec(s);
  if (!m) return null;
  const tipo = m[1].toUpperCase();
  if (tipo === 'INS') {
    const cod = normalizarCodigoInsumo(m[2]);
    return cod ? { dominio: 'insumo', cod } : null;
  }
  const cod = claveTela(m[2]);
  return cod ? { dominio: 'tela', cod } : null;
}

// ── Dónde se guarda cada foto ────────────────────────────────────────

/**
 * La primera carpeta SIEMPRE es el id de la empresa: es lo único que mira la
 * política del bucket para dejar subir o no (`(storage.foldername(name))[1]`).
 */
const limpio = (s: string) => s.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 40) || 'x';

export function rutaFotoReconocimiento(
  empresaId: string,
  dominio: DominioReconocimiento,
  cod: string,
  angulo: string,
  ahora: number = Date.now(),
): string {
  return `${empresaId}/${dominio}/${limpio(cod)}/${ahora}_${limpio(angulo)}.jpg`;
}

export function rutaConsulta(empresaId: string, ahora: number = Date.now()): string {
  return `${empresaId}/consultas/${ahora}_${Math.random().toString(36).slice(2, 8)}.jpg`;
}

/** La ruta de la miniatura que acompaña a una foto. */
export function rutaMiniatura(path: string): string {
  return path.replace(/\.jpg$/i, '_min.jpg');
}

// ── Mensajes ─────────────────────────────────────────────────────────

export function mensajeErrorReconocimiento(mensaje?: string): string {
  const m = (mensaje ?? '').trim();
  if (!m) return 'No se pudo reconocer la foto. Vuelve a intentar.';
  return m;
}
