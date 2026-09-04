// ─────────────────────────────────────────────────────────────────────
// LO QUE QUEDA LIBRE DENTRO DE UN PAÑO — geometría pura.
//
// Vivía en `produccion/salidasCorte.ts`, que la usaba solo para anotar lo que
// dejaba un rollo recién cortado. Ahora también la necesita el MOTOR del plan
// (`planCorte.ts`) para puntuar los paños de colmena: qué acomodo deja menos
// merma y cuántos trozos útiles vuelven al rack. El motor no puede depender del
// módulo de producción —que a su vez lee los tipos del plan—, así que la
// geometría vive acá y `salidasCorte.ts` la reexporta: para el resto de la app
// nada cambió de lugar.
//
// Módulo puro: sin React ni Supabase.
// ─────────────────────────────────────────────────────────────────────
import { PARAMETROS_CORTE_DEFAULT, type ParametrosCorte } from './parametrosCorte';

/** Para qué alcanza un trozo de tela. */
export type FuncionalSobrante = { roller: boolean; vertical: boolean };

/**
 * Bajo esta medida un rectángulo no es manipulable: ni sobrante ni merma, es
 * recorte de mesa. Anotarlo solo ensuciaría el registro de pérdidas.
 */
export const MIN_REGISTRO_CM = 10;

/**
 * ¿Para qué sirve este trozo? La app lo propone por medidas y el operario lo
 * corrige en el diálogo antes de imprimir la etiqueta: la tela tiene defectos
 * y direcciones que ninguna medida captura.
 */
export function funcionalDeSobrante(
  anchoCm: number,
  altoCm: number,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): FuncionalSobrante {
  return {
    roller: anchoCm >= params.funcionalRollerMinAnchoCm && altoCm >= params.funcionalRollerMinAltoCm,
    vertical:
      anchoCm >= params.funcionalVerticalMinAnchoCm && altoCm >= params.funcionalVerticalMinAltoCm,
  };
}

/** ¿Vale la pena guardarlo? Sirve si alcanza para algo; si no, es merma. */
export function esUtilizableProduccion(
  anchoCm: number,
  altoCm: number,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): boolean {
  const f = funcionalDeSobrante(anchoCm, altoCm, params);
  return f.roller || f.vertical;
}

/** ¿Alguno de los dos usos quedó marcado? (el operario puede desmarcar todo). */
export function sirveParaAlgo(f: FuncionalSobrante): boolean {
  return f.roller || f.vertical;
}

/** Un rectángulo de tela sin usar, ubicado dentro del tiro. */
export type RectLibre = {
  /** Esquina dentro del paño (cm), en las mismas coordenadas de las piezas. */
  x: number;
  y: number;
  anchoCm: number;
  altoCm: number;
  clase: 'sobrante' | 'merma';
  funcional: FuncionalSobrante;
};

type RectPieza = { px: number; py: number; pw: number; ph: number };

const EPS_RECT = 0.01;
const d1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Parte en rectángulos TODO lo que queda libre del tiro: la franja del costado,
 * el hueco que deja una cortina más corta y el que queda al lado de una banda
 * más angosta (los que el dibujo mostraba en negro, sin contar).
 *
 * Barre por COLUMNAS —los bordes izquierdo y derecho de cada pieza— y junta las
 * columnas vecinas que dejan libre el mismo tramo. Se barre así, y no por
 * bandas horizontales, porque es como la mesa parte el paño: primero separa las
 * cortinas a lo largo y después recorta cada columna. Con eso la franja del
 * costado sale ENTERA, de arriba abajo, igual que la que anota el cierre del
 * corte, en vez de quedar picada en pedazos que no coinciden con nada.
 *
 * La SUMA de las áreas es exacta (tiro − cortinas) y no depende de nada más;
 * el recorte en rectángulos sí depende del orden en que la mesa parta el paño,
 * así que es una lectura de dónde está la tela perdida, no una promesa de qué
 * trozos van a caer.
 */
export function rectangulosLibres(
  piezas: readonly RectPieza[],
  anchoUtilCm: number,
  altoUtilCm: number,
): { x: number; y: number; anchoCm: number; altoCm: number }[] {
  if (!(anchoUtilCm > 0) || !(altoUtilCm > 0)) return [];

  const bordes = new Set<number>([0, anchoUtilCm]);
  for (const p of piezas) {
    for (const x of [p.px, p.px + p.pw]) if (x > 0 && x < anchoUtilCm) bordes.add(x);
  }
  const cortes = [...bordes].sort((a, b) => a - b);

  type R = { x: number; y: number; anchoCm: number; altoCm: number };
  const out: R[] = [];
  let abiertos: R[] = [];

  for (let i = 0; i + 1 < cortes.length; i++) {
    const x0 = cortes[i];
    const x1 = cortes[i + 1];
    if (x1 - x0 < EPS_RECT) continue;

    // Lo que ocupan las cortinas en esta columna, de arriba abajo.
    const ocupado = piezas
      .filter((p) => p.px < x1 - EPS_RECT && p.px + p.pw > x0 + EPS_RECT)
      .map((p) => [Math.max(0, p.py), Math.min(altoUtilCm, p.py + p.ph)] as const)
      .filter(([a, b]) => b - a > EPS_RECT)
      .sort((a, b) => a[0] - b[0]);

    const columna: R[] = [];
    let cursor = 0;
    for (const [a, b] of ocupado) {
      if (a - cursor > EPS_RECT)
        columna.push({ x: x0, y: cursor, anchoCm: x1 - x0, altoCm: a - cursor });
      cursor = Math.max(cursor, b);
    }
    if (altoUtilCm - cursor > EPS_RECT)
      columna.push({ x: x0, y: cursor, anchoCm: x1 - x0, altoCm: altoUtilCm - cursor });

    // Un libre que sigue justo al lado de otro, en el mismo tramo, es el MISMO
    // trozo: dos cortinas cortas una al lado de la otra dejan UN hueco ancho.
    const siguen: R[] = [];
    for (const r of columna) {
      const izq = abiertos.find(
        (a) =>
          Math.abs(a.y - r.y) < EPS_RECT &&
          Math.abs(a.altoCm - r.altoCm) < EPS_RECT &&
          Math.abs(a.x + a.anchoCm - r.x) < EPS_RECT,
      );
      if (izq) {
        izq.anchoCm += r.anchoCm;
        siguen.push(izq);
      } else {
        out.push(r);
        siguen.push(r);
      }
    }
    abiertos = siguen;
  }

  return out.map((r) => ({
    x: d1(r.x),
    y: d1(r.y),
    anchoCm: d1(r.anchoCm),
    altoCm: d1(r.altoCm),
  }));
}

/**
 * Los mismos rectángulos, ya con el semáforo del taller: sirve para otra
 * cortina (vuelve al rack) o no sirve (se perdió). Se descartan las hilachas
 * de menos de 1 cm, que son el filo de la cuchilla y no tela.
 */
export function libresClasificados(
  piezas: readonly RectPieza[],
  anchoUtilCm: number,
  altoUtilCm: number,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
): RectLibre[] {
  const out: RectLibre[] = [];
  for (const r of rectangulosLibres(piezas, anchoUtilCm, altoUtilCm)) {
    const anchoCm = Math.round(r.anchoCm);
    const altoCm = Math.round(r.altoCm);
    if (anchoCm < 1 || altoCm < 1) continue;
    const funcional = funcionalDeSobrante(anchoCm, altoCm, params);
    out.push({
      x: r.x,
      y: r.y,
      anchoCm,
      altoCm,
      clase: sirveParaAlgo(funcional) ? 'sobrante' : 'merma',
      funcional,
    });
  }
  return out;
}

/** Cuánta tela del tiro vuelve al rack y cuánta se perdió (cm²). */
export function resumenLibres(libres: readonly RectLibre[]): {
  sobranteCm2: number;
  mermaCm2: number;
} {
  let sobranteCm2 = 0;
  let mermaCm2 = 0;
  for (const r of libres) {
    const area = r.anchoCm * r.altoCm;
    if (r.clase === 'sobrante') sobranteCm2 += area;
    else mermaCm2 += area;
  }
  return { sobranteCm2, mermaCm2 };
}
