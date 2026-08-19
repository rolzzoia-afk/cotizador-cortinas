// ─────────────────────────────────────────────────────────────────────
// EL ESQUELETO DEL INFORME CLIENTE.
//
// El correo de COTIZACIÓN FINAL tiene una estructura fija en su sección
// «CONTRATO DE SERVICIOS»: una intro sobre los pasos de luz según el tipo de
// cortina y después UNA SECCIÓN NUMERADA POR HABITACIÓN con el tipo de cortina,
// el color de accesorios y la caída.
//
// La observación que hace este módulo posible: **la mitad de ese resumen no
// necesita IA**. El tipo de cortina, la tela, el color de accesorios y la caída
// ya están cargados en la orden, dato por dato. Lo que el video aporta es LO
// CONVERSADO — y eso es lo único que se le pide al modelo.
//
// Por eso el esqueleto se arma acá, determinista y testeable, y viaja a la Edge
// Function como andamio: la IA rellena, no inventa. Un dato equivocado en el
// informe sería un dato equivocado en un documento que el cliente aprueba.
//
// Módulo PURO: sin React, sin Supabase, sin fetch.
// ─────────────────────────────────────────────────────────────────────
import type { Pano, Ventana } from '@/modules/cotizador/types';
import type { TipoCortina } from '@/modules/descuentos/tiposCortina';
import { colorAccesoriosDePano } from '@/modules/descuentos/chips';
import { familiaOscuridad } from '@/modules/descuentos/reglas-oscuridad';
import { esCategoriaVertical } from '@/modules/descuentos/reglas-mecanismo';
import { esUrlFotoSegura, lineaFoto } from './imagenesInforme';
import {
  INTROS_INFORME_DEFAULT,
  textoIntro,
  type FamiliaTexto,
  type IntrosInforme,
} from './introsInforme';

const txt = (v: unknown) => String(v ?? '').trim();

// Las advertencias de pasos de luz (y sus fotos referenciales) se editan en
// Admin: viven en `introsInforme.ts`. Se re-exporta el tipo para no obligar a
// quien ya importaba `FamiliaTexto` desde acá a cambiar de puerta.
export type { FamiliaTexto };

/**
 * Familia para el texto de pasos de luz.
 *
 * El dúo y los sistemas de oscuridad tienen advertencias propias (lamas /
 * perfiles), así que se detectan primero; el resto se separa por tipo de tela,
 * que es lo que decide si la cortina deja pasar luz a propósito o no.
 */
export function familiaTexto(
  v: Pick<Ventana, 'categoria' | 'producto' | 'panos'>,
  tipos?: readonly TipoCortina[],
): FamiliaTexto {
  const cat = txt(v.categoria).toUpperCase();
  const p0 = (v.panos ?? [])[0];
  if (familiaOscuridad(v.categoria, p0?.cenefa, tipos)) return 'oscuridad';
  if (esCategoriaVertical(v.categoria)) return 'vertical';
  if (cat.startsWith('DUO') || cat.includes('DUO')) return 'duo';
  const tipoTela = txt(p0?.tipoTela).toUpperCase();
  const producto = txt(v.producto).toUpperCase();
  if (tipoTela === 'DU' || producto.includes('DUO')) return 'duo';
  if (tipoTela === 'SCR' || producto.includes('SCREEN')) return 'screen';
  return 'blackout';
}

/** Descripción del tipo de cortina de una ventana, para el bullet. */
function textoTipo(v: Ventana): string {
  const partes = [txt(v.producto), txt(v.codInt), txt(v.descripcion)].filter(Boolean);
  const base = partes.join(' ');
  const n = (v.panos ?? []).length;
  const panos = n > 1 ? `(${n} paños)` : n === 1 ? '(1 paño entero)' : '';
  return [base || '(sin producto)', panos].filter(Boolean).join(' ');
}

/** Caída: sentido de la cortina + si va dentro o fuera del marco. */
function textoCaida(v: Ventana, p: Pano | undefined): string {
  const sentido = txt(v.sentido).toUpperCase();
  const caida = sentido === 'INTERNO' ? 'Interna' : sentido === 'EXTERNO' ? 'Externa' : '';
  const marco = txt(p?.relacionMarco);
  const dondeVa =
    marco === 'Dentro'
      ? 'instalada dentro del marco'
      : marco === 'Fuera'
        ? 'instalada fuera del marco'
        : '';
  const partes = [caida, dondeVa].filter(Boolean);
  return partes.length ? partes.join(', ') + '.' : '';
}

/** Extras que solo se nombran cuando existen (motor, cenefa, cortes). */
function textoExtras(p: Pano | undefined): string[] {
  if (!p) return [];
  const out: string[] = [];
  const motor = txt(p.motorModelo) || txt(p.motorTipo);
  if (motor) out.push(`Motorizada: ${motor}.`);
  const cenefa = txt(p.cenefa);
  if (cenefa && cenefa.toUpperCase() !== 'NO') {
    out.push(`Cenefa: ${cenefa}. La cenefa reduce el paso de luz superior.`);
  }
  const cortes = txt(p.cortes);
  if (cortes && cortes.toUpperCase() !== 'NADA') {
    out.push(
      `El día de la instalación se cortará ${cortes.toLowerCase()} para reducir el paso de ` +
        'luz por los laterales.',
    );
  }
  return out;
}

/** Ventanas agrupadas por ubicación, respetando el orden en que fueron cargadas. */
function porUbicacion(
  ventanas: Ventana[],
): Array<{ ubicacion: string; ventanas: Ventana[] }> {
  const orden: string[] = [];
  const mapa = new Map<string, Ventana[]>();
  for (const v of ventanas) {
    const u = txt(v.ubicacion) || '(sin ubicación)';
    if (!mapa.has(u)) {
      mapa.set(u, []);
      orden.push(u);
    }
    mapa.get(u)!.push(v);
  }
  return orden.map((ubicacion) => ({ ubicacion, ventanas: mapa.get(ubicacion)! }));
}

/** Firma de una cortina para colapsar las idénticas de una misma ubicación. */
const firmaVentana = (v: Ventana): string => {
  const p = (v.panos ?? [])[0];
  return [
    textoTipo(v),
    colorAccesoriosDePano(p ?? {}, v.color),
    textoCaida(v, p),
    textoExtras(p).join('|'),
  ].join('§');
};

export type OpcionesEsqueleto = {
  tipos?: readonly TipoCortina[];
  /** Las advertencias de pasos de luz de la empresa (Admin). Default: fábrica. */
  intros?: IntrosInforme;
  /**
   * La foto de catálogo de una tela, por COD_INT — la ficha «LUXOR DUO GRIS
   * CLARO» del correo. Devuelve '' o undefined si esa tela no tiene foto
   * cargada, y entonces la sección de esa habitación va sin imagen.
   */
  fotoDeTela?: (codInt: string) => string | undefined;
};

/**
 * Arma el esqueleto del INFORME CLIENTE a partir de las ventanas de la orden.
 *
 * Devuelve texto plano con la estructura del correo: intro de pasos de luz por
 * las familias que la orden efectivamente trae, y una sección numerada por
 * ubicación. Sin ventanas devuelve cadena vacía — no tiene sentido un andamio
 * sin cortinas.
 */
export function esqueletoInforme(
  ventanas: Ventana[] | undefined,
  opts: OpcionesEsqueleto = {},
): string {
  const lista = (ventanas ?? []).filter(Boolean);
  if (lista.length === 0) return '';

  const bloques: string[] = [];
  const intros = opts.intros ?? INTROS_INFORME_DEFAULT;

  // ── Intro: una advertencia por cada familia presente, sin repetir. Cada una
  //    baja con sus fotos referenciales, como el correo que se manda a mano ──
  const familias = new Set<FamiliaTexto>(lista.map((v) => familiaTexto(v, opts.tipos)));
  const intro = [...familias].map((f) => textoIntro(intros, f));
  if (lista.some((v) => (v.panos ?? []).length > 1)) {
    intro.push(textoIntro(intros, 'varios-panos'));
  }
  const introTexto = intro.filter(Boolean).join('\n\n');
  if (introTexto) bloques.push(introTexto);

  // ── Una sección numerada por ubicación ──
  let n = 0;
  for (const grupo of porUbicacion(lista)) {
    n += 1;
    const lineas = [`${n}. ${grupo.ubicacion}`];

    // Cortinas idénticas en la misma ubicación se dicen una vez, con su cantidad.
    const vistas = new Map<string, { v: Ventana; cant: number }>();
    for (const v of grupo.ventanas) {
      const k = firmaVentana(v);
      const prev = vistas.get(k);
      if (prev) prev.cant += Math.max(1, v.cantidad || 1);
      else vistas.set(k, { v, cant: Math.max(1, v.cantidad || 1) });
    }

    for (const { v, cant } of vistas.values()) {
      const p = (v.panos ?? [])[0];
      const sufijo = cant > 1 ? ` (×${cant})` : '';
      lineas.push(`   - Tipo de Cortina: ${textoTipo(v)}${sufijo}`);
      // La ficha de la tela va pegada al bullet que la nombra, igual que en el
      // correo. Si esa tela no tiene foto cargada en el catálogo, no va nada.
      const fotoTela = opts.fotoDeTela?.(txt(v.codInt)) ?? '';
      if (fotoTela && esUrlFotoSegura(fotoTela)) lineas.push(lineaFoto(fotoTela));
      const color = colorAccesoriosDePano(p ?? {}, v.color);
      if (color) {
        lineas.push(`   - Color de Accesorios: ${color} (mecanismos, cadenas y soportes).`);
      }
      const caida = textoCaida(v, p);
      if (caida) lineas.push(`   - Caída: ${caida}`);
      for (const extra of textoExtras(p)) lineas.push(`   - ${extra}`);
    }
    bloques.push(lineas.join('\n'));
  }

  return bloques.join('\n\n');
}

/** ¿La orden trae algún sistema de oscuridad? Decide los bloques condicionales. */
export function tieneOscuridad(
  ventanas: Ventana[] | undefined,
  tipos?: readonly TipoCortina[],
): boolean {
  return (ventanas ?? []).some((v) =>
    Boolean(familiaOscuridad(v?.categoria, (v?.panos ?? [])[0]?.cenefa, tipos)),
  );
}
