// ─────────────────────────────────────────────────────────────────────
// Conjuntos de cortinas invertidas (Fase 2).
//
// Cuando dos o más cortinas se "juntan" (p. ej. una ventana grande cubierta
// por varias cortinas invertidas), comparten un `grupoId` y la FICHA de la
// cortina más grande se copia a las demás: producto, categoría, color,
// modelo y la ficha técnica de cada paño. Cada miembro CONSERVA su
// ubicación, medidas (ancho/alto), cantidad y su número de paños, y todo
// sigue editable a mano. Todos los paños quedan con `invertida: true`
// explícita.
//
// El conjunto NO afecta producción: la hoja de corte y el optimizador
// siguen calculando el "se corta junto" por su cuenta (tela.ts). Esto es
// solo captura de datos + destacado visual en Fase 2.
//
// Módulo puro (sin React/Supabase) para poder testearlo.
// ─────────────────────────────────────────────────────────────────────
import type { Pano, Ventana } from './types';
import { debeInvertirPano } from './tela';

/**
 * Campos de nivel VENTANA que se copian de la mayor a los demás miembros.
 * NO se copian: id, ubicacion, alto, precio, subtotal, cantidad, fase,
 * grupoId/grupoOrden (se asignan aparte) ni panos (se copian campo a campo).
 */
export const CAMPOS_VENTANA_CONJUNTO = [
  'codInt',
  'producto',
  'tipo',
  'descripcion',
  'categoria',
  'color',
  'modelo',
  'sentido',
  'direccion',
] as const satisfies readonly (keyof Ventana)[];

/**
 * Ficha técnica del PAÑO que se copia de la mayor. Excluidos a propósito:
 * ancho/alto (medidas propias), descuento (comercial por línea), invertida
 * (se fuerza true aparte), largoCadena/codCadena/codPeso (dependen del alto
 * propio), cierreAlturaCm y todos los overrides en cm (perfil*Cm, beeblack*Cm
 * — medidas de terreno propias), verVideo y comentarioFinal (observaciones).
 */
export const CAMPOS_PANO_CONJUNTO = [
  'armado',
  'tipoTela',
  'cierreVert',
  'manillaCant',
  'manillaColor',
  'color',
  'colorPeso',
  'colorCadena',
  'colorMecanismo',
  'colorTapa',
  'cenefa',
  'cenefaTira',
  'cenefaTapa',
  'bracketTipo',
  'mecanismo',
  'tuberia',
  'retiro',
  'superficie',
  'materialTipo',
  'ordenDoble',
  'ordenDobleOpcion',
  'dual',
  'dualLado',
  'dualColor',
  'codInt',
  'producto',
  'descripcion',
  'motorTipo',
  'motorModelo',
  'motorDomotica',
  'motorControlAdic',
  'motorHubUsb',
  'motorControlAdicCant',
  'motorHubUsbCant',
  'ladoMotor',
  'softDark',
  'instalacion',
  'separador',
  'cortes',
  'relacionMarco',
  'alturaCierre',
  'cotizarConSin',
  'suplementos',
  'suplementoTipo',
  'suplementoCant',
  'oscuridadVariante',
  'perfilIzqMuro',
  'perfilIzqPiso',
  'perfilDerMuro',
  'perfilDerPiso',
  'perfilInfMuro',
  'perfilInfPiso',
  'beeblackVariante',
  'beeblackManillaIzq',
  'beeblackManillaDer',
  'beeblackExtraSupInfIzq',
  'beeblackExtraSupInfDer',
  'beeblackExtraLatSup',
  'beeblackExtraLatInf',
] as const satisfies readonly (keyof Pano)[];

const num = (x: unknown): number => parseFloat(String(x ?? 0)) || 0;

/**
 * Área física de la cortina = Σ paños (ancho × (alto del paño || alto de la
 * ventana)). La cantidad NO multiplica: se compara la cortina física.
 */
export function areaVentana(v: Pick<Ventana, 'alto' | 'panos'>): number {
  return (v.panos || []).reduce(
    (s, p) => s + num(p.ancho) * (num(p.alto) || num(v.alto)),
    0,
  );
}

/** Mayor área; empate → mayor Σ ancho; empate de nuevo → la primera. */
export function elegirVentanaMayor<T extends Pick<Ventana, 'alto' | 'panos'>>(vs: T[]): T {
  const sumAncho = (v: T) => (v.panos || []).reduce((s, p) => s + num(p.ancho), 0);
  return vs.reduce((mejor, v) => {
    const dArea = areaVentana(v) - areaVentana(mejor);
    if (dArea > 0) return v;
    if (dArea === 0 && sumAncho(v) > sumAncho(mejor)) return v;
    return mejor;
  }, vs[0]);
}

/** ¿Algún paño efectivamente invertido? (flag explícito, o auto por ancho). */
export function esVentanaInvertida(v: Pick<Ventana, 'panos'>, anchoRolloM: number): boolean {
  return (v.panos || []).some(
    (p) => p.invertida ?? debeInvertirPano(num(p.ancho), anchoRolloM),
  );
}

/**
 * Copia a `destino` la ficha de la `mayor`: campos de ventana y, por paño
 * (índice i, con fallback al paño 0 si el destino tiene más paños), la ficha
 * técnica. Solo copia valores DEFINIDOS en la mayor (no borra con undefined).
 * El destino conserva id/ubicacion/alto/cantidad/precio y su nº de paños.
 */
export function copiarFichaDesdeMayor(mayor: Ventana, destino: Ventana): Ventana {
  const out: Ventana = { ...destino };
  for (const k of CAMPOS_VENTANA_CONJUNTO) {
    const val = mayor[k];
    if (val !== undefined) (out as Record<string, unknown>)[k] = val;
  }
  out.panos = (destino.panos || []).map((p, i) => {
    const ref = mayor.panos?.[i] ?? mayor.panos?.[0];
    if (!ref) return { ...p };
    const np: Pano = { ...p };
    for (const k of CAMPOS_PANO_CONJUNTO) {
      const val = ref[k];
      if (val !== undefined) (np as Record<string, unknown>)[k] = val;
    }
    return np;
  });
  return out;
}

/**
 * Junta los miembros en un conjunto: elige la mayor, copia su ficha a los
 * demás, asigna `grupoId` a todos con `grupoOrden` 1..n (según el orden del
 * array = orden en storeVentanas) y fuerza `invertida: true` explícita en
 * TODOS los paños de TODOS los miembros (incluida la mayor).
 */
export function juntarVentanas(miembros: Ventana[], grupoId: string): Ventana[] {
  if (miembros.length === 0) return [];
  const mayor = elegirVentanaMayor(miembros);
  return miembros.map((v, i) => {
    const base = v === mayor ? { ...v, panos: (v.panos || []).map((p) => ({ ...p })) }
      : copiarFichaDesdeMayor(mayor, v);
    return {
      ...base,
      grupoId,
      grupoOrden: i + 1,
      panos: base.panos.map((p) => ({ ...p, invertida: true })),
    };
  });
}

/**
 * Todo grupo con menos de 2 miembros se disuelve (grupoId null, grupoOrden 0)
 * y los grupos que quedan recompactan su grupoOrden a 1..n por orden de
 * aparición. Úsalo tras quitar o eliminar una cortina.
 */
export function limpiarGruposHuerfanos<T extends Pick<Ventana, 'grupoId' | 'grupoOrden'>>(
  ventanas: T[],
): T[] {
  const porGrupo = new Map<string, number>();
  for (const v of ventanas) {
    if (v.grupoId) porGrupo.set(v.grupoId, (porGrupo.get(v.grupoId) || 0) + 1);
  }
  const orden = new Map<string, number>();
  return ventanas.map((v) => {
    if (!v.grupoId || (porGrupo.get(v.grupoId) || 0) < 2) {
      if (!v.grupoId && !v.grupoOrden) return v;
      return { ...v, grupoId: null, grupoOrden: 0 };
    }
    const n = (orden.get(v.grupoId) || 0) + 1;
    orden.set(v.grupoId, n);
    return { ...v, grupoOrden: n };
  });
}

/** Saca la ventana `id` de su conjunto y disuelve los grupos que queden solos. */
export function quitarDeConjunto<T extends Pick<Ventana, 'id' | 'grupoId' | 'grupoOrden'>>(
  ventanas: T[],
  id: Ventana['id'],
): T[] {
  return limpiarGruposHuerfanos(
    ventanas.map((v) => (v.id === id ? { ...v, grupoId: null, grupoOrden: 0 } : v)),
  );
}

// ── Colores por conjunto (destacado visual) ──────────────────────────
// Valores hex para aplicar por `style` inline (mismo patrón que
// catBadgeColor): no dependen del JIT de tailwind, así que funcionan aunque
// las clases no estén generadas. Sin ámbar: reservado al estado INVERTIDA.
export type ColorConjunto = {
  /** Color base del conjunto (bordes y texto). */
  base: string;
  /** Fondo translúcido (badges / tintes). */
  suave: string;
};

export const COLORES_CONJUNTO: ColorConjunto[] = [
  { base: '#38bdf8', suave: 'rgba(56, 189, 248, 0.15)' }, // sky
  { base: '#e879f9', suave: 'rgba(232, 121, 249, 0.15)' }, // fuchsia
  { base: '#34d399', suave: 'rgba(52, 211, 153, 0.15)' }, // emerald
  { base: '#fb923c', suave: 'rgba(251, 146, 60, 0.15)' }, // orange
  { base: '#a78bfa', suave: 'rgba(167, 139, 250, 0.15)' }, // violet
  { base: '#fb7185', suave: 'rgba(251, 113, 133, 0.15)' }, // rose
];

/**
 * grupoId → índice de color, por ORDEN DE APARICIÓN en storeVentanas. El
 * consumidor aplica `COLORES_CONJUNTO[idx % COLORES_CONJUNTO.length]`.
 */
export function coloresPorGrupo(
  ventanas: Array<Pick<Ventana, 'grupoId'>>,
): Map<string, number> {
  const idx = new Map<string, number>();
  for (const v of ventanas) {
    if (v.grupoId && !idx.has(v.grupoId)) idx.set(v.grupoId, idx.size);
  }
  return idx;
}
