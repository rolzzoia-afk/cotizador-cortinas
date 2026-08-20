// ─────────────────────────────────────────────────────────────────────
// EL RESUMEN DE LO QUE LLEVAMOS CARGADO.
//
// En terreno, después de la tercera ventana, el vendedor pierde el hilo: ¿ya
// cargué la del comedor?, ¿esta de acá quedó con cenefa? La lista de texto del
// panel no responde eso de un vistazo — hay que abrir cada una.
//
// Este módulo prepara los datos de la pantalla que sí responde: las cortinas
// dibujadas en miniatura con su medida, agrupadas por ubicación, y la ficha de
// la que se toque. Es SOLO LECTURA: para cambiar algo se entra a la vista
// guiada, así nadie toca un dato sin querer con la tablet en la mano.
//
// Módulo PURO (sin React ni Supabase).
// ─────────────────────────────────────────────────────────────────────
import { porUbicacion } from '@/modules/visita/esqueletoInforme';
import { colorAccesoriosDePano } from '@/modules/descuentos/chips';
import { categoriaEsDual } from '@/modules/descuentos/tipos';
import { telaDePano } from '../telaPano';
import { rotuloForma } from './selectorVentanas';
import type { Pano, Ventana } from '../types';

const txt = (v: unknown): string => String(v ?? '').trim();
const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Metros con coma, como se anotan en terreno («1,855» · «2,30»). Hasta 3
 * decimales porque el ancho se mide al milímetro; el alto normalmente trae 2.
 */
export function medidaLabel(metros: number): string {
  if (!(metros > 0)) return '—';
  return metros.toFixed(3).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
}

export type MiniaturaVentana = {
  /** Ancho de cada paño, en orden: una etiqueta por paño como en el mockup. */
  anchos: string[];
  /** Alto de la cortina (el del primer paño con dato). */
  alto: string;
  /** Le falta alguna medida: se marca para que no pase inadvertida. */
  incompleta: boolean;
};

/** Las medidas que rodean el dibujo de una cortina en el resumen. */
export function miniaturaDe(v: Ventana): MiniaturaVentana {
  const panos = v.panos ?? [];
  const anchos = panos.map((p) => medidaLabel(num(p.ancho)));
  const altoNum = panos.map((p) => num(p.alto)).find((a) => a > 0) ?? 0;
  const incompleta = panos.length === 0 || panos.some((p) => !(num(p.ancho) > 0) || !(num(p.alto) > 0));
  return { anchos, alto: medidaLabel(altoNum), incompleta };
}

/** Las cortinas de la orden agrupadas por ubicación, en el orden de carga. */
export function gruposResumen(ventanas: Ventana[]): Array<{ ubicacion: string; ventanas: Ventana[] }> {
  return porUbicacion(ventanas ?? []);
}

export type FilaResumen = { etiqueta: string; valor: string };

/** Cenefa legible: «Ovalada, con tira» / «Cuadrada a techo». */
function textoCenefa(p: Pano | undefined): string {
  const cenefa = txt(p?.cenefa);
  if (!cenefa || cenefa.toUpperCase() === 'NO') return '';
  const tira = txt(p?.cenefaTira);
  return tira ? `${cenefa}, ${tira.toLowerCase()}` : cenefa;
}

/**
 * Las filas de tela de una DUAL: una por rollo, rotuladas por su lugar en la
 * ventana (el paño 1 va al vidrio). `null` = no es dual, la tela va como
 * siempre en una sola fila.
 */
function filasTelaDual(v: Ventana): Array<[string, string]> | null {
  if (!categoriaEsDual(txt(v.categoria))) return null;
  const panos = v.panos ?? [];
  return ['Tela (al vidrio)', 'Tela (adelante)'].map((rotulo, i) => {
    const p = panos[i];
    // Solo el primer rollo hereda la tela de la ventana: es la suya. Al
    // segundo, sin tela propia, hay que elegírsela — y se dice.
    if (!p || (i > 0 && !txt(p.codInt))) return [rotulo, 'falta elegirla'];
    const tela = telaDePano(v, p);
    const desc = [txt(p.tipoTela), txt(tela.descripcion) || txt(tela.producto)]
      .filter(Boolean)
      .join(' ');
    return [rotulo, desc || txt(tela.codInt) || 'falta elegirla'];
  });
}

/**
 * Las filas de la ficha de solo lectura, en el orden del mockup.
 *
 * Solo aparece lo que tiene dato: una ficha llena de guiones no dice nada, y
 * en pantalla de tablet el espacio es el recurso escaso.
 */
export function fichaResumen(v: Ventana): FilaResumen[] {
  const p = (v.panos ?? [])[0];
  const filas: Array<[string, string]> = [
    ['Ubicación', txt(v.ubicacion)],
    ['Modelo', rotuloForma(v)],
    ['Tipo', [txt(v.producto), txt(v.codInt)].filter(Boolean).join(' · ')],
    // La dual lleva DOS telas (un rollo cada una): mostrar solo la primera
    // dejaba la mitad de la cortina fuera de la ficha.
    ...(filasTelaDual(v) ?? [['Tela', [txt(p?.tipoTela), txt(v.descripcion)].filter(Boolean).join(' ')]]),
    ['Cenefa', textoCenefa(p)],
    ['Armado', txt(v.sentido)],
    ['Accesorios', txt(colorAccesoriosDePano(p ?? {}, v.color))],
    ['Material', [txt(p?.superficie), txt(p?.materialTipo)].filter(Boolean).join(' · ')],
    ['Instalación', txt(p?.relacionMarco) ? `${txt(p?.relacionMarco)} del marco` : ''],
    ['Mecanismo', txt(p?.mecanismo)],
    ['Tubo', txt(p?.tuberia)],
    ['Corte', txt(p?.cortes).toUpperCase() === 'NADA' ? '' : txt(p?.cortes)],
    ['Motor', txt(p?.motorModelo) || txt(p?.motorTipo)],
    ['Comentario', txt(p?.comentarioFinal)],
  ];
  return filas.filter(([, valor]) => valor).map(([etiqueta, valor]) => ({ etiqueta, valor }));
}
