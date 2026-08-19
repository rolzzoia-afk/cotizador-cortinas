// ─────────────────────────────────────────────────────────────────────
// LAS INTRODUCCIONES DE PASOS DE LUZ DEL INFORME CLIENTE.
//
// El correo de COTIZACIÓN FINAL abre advirtiendo los pasos de luz según el tipo
// de cortina que lleva la orden, y cada advertencia va acompañada de una foto
// referencial («te dejo una foto referencial:» + la foto de la duo blackout a
// contraluz). Es lo primero que ve el cliente y lo que evita el reclamo después
// de instalar.
//
// Antes estos cinco textos estaban fijos en `esqueletoInforme.ts`. Viven acá
// porque ahora se editan en Admin —texto Y fotos— igual que los bloques del
// final: son compromisos comerciales, no redacción, así que la IA no los toca.
//
// Solo entran las familias que la orden EFECTIVAMENTE trae: una cotización de
// puro roller no le explica al cliente cómo se comporta una vertical.
//
// Módulo PURO (sin React ni Supabase). La persistencia vive en
// `introsInformeStore.ts`, con el mismo patrón que los bloques.
// ─────────────────────────────────────────────────────────────────────
import { normalizarFotos, textoConFotos } from './imagenesInforme';

/** Familia de cortina a efectos del texto de pasos de luz. */
export type FamiliaTexto = 'duo' | 'blackout' | 'screen' | 'oscuridad' | 'vertical';

/**
 * Qué introducción es. Las cinco familias más la nota de varios paños, que no
 * es una familia: entra cuando ALGUNA cortina de la orden se divide en más de
 * un paño, sea del tipo que sea.
 */
export type IdIntro = FamiliaTexto | 'varios-panos';

export const IDS_INTRO: readonly IdIntro[] = [
  'duo',
  'blackout',
  'screen',
  'oscuridad',
  'vertical',
  'varios-panos',
];

/** Nombre visible en Admin. */
export const NOMBRE_INTRO: Record<IdIntro, string> = {
  duo: 'Duo blackout',
  blackout: 'Blackout',
  screen: 'Screen',
  oscuridad: 'Sistemas de oscuridad',
  vertical: 'Vertical',
  'varios-panos': 'Cortina de varios paños',
};

/** Cuándo entra al informe, en palabras, para explicarlo en Admin. */
export const CUANDO_INTRO: Record<IdIntro, string> = {
  duo: 'Si la orden trae alguna cortina duo.',
  blackout: 'Si la orden trae alguna cortina blackout.',
  screen: 'Si la orden trae alguna cortina screen.',
  oscuridad: 'Si la orden trae Soft Light, Dark, Oscuranti o BeeBlack.',
  vertical: 'Si la orden trae alguna cortina vertical.',
  'varios-panos': 'Si alguna cortina de la orden se divide en más de un paño.',
};

export type IntroInforme = {
  id: IdIntro;
  texto: string;
  /** URLs públicas de las fotos referenciales, en el orden en que van al correo. */
  fotos: string[];
  activo: boolean;
};

export type IntrosInforme = { intros: IntroInforme[] };

/** Los del correo real, tal como se mandan hoy (sin fotos: se cargan en Admin). */
export const INTROS_INFORME_DEFAULT: IntrosInforme = {
  intros: [
    {
      id: 'duo',
      texto:
        'Se explican los pasos de luz de las cortinas duo blackout, recordando que aunque estas ' +
        'sean duo blackout siempre existirán pasos de luz entre sus lamas y laterales.',
      fotos: [],
      activo: true,
    },
    {
      id: 'blackout',
      texto:
        'Se explican los pasos de luz de las cortinas blackout, recordando que con estas siempre ' +
        'tendrás pasos de luz laterales y en la parte superior.',
      fotos: [],
      activo: true,
    },
    {
      id: 'screen',
      texto:
        'Se explica que las cortinas screen permiten el paso de luz por diseño: de día no se ve ' +
        'desde afuera hacia adentro, pero sí dejan pasar claridad.',
      fotos: [],
      activo: true,
    },
    {
      id: 'oscuridad',
      texto:
        'Se explican los sistemas de oscuridad: los perfiles laterales y/o la cenefa reducen el ' +
        'paso de luz, y el porcentaje de oscuridad indicado en la cotización se alcanza con esos ' +
        'perfiles instalados y empastados.',
      fotos: [],
      activo: true,
    },
    {
      id: 'vertical',
      texto:
        'Se explican los pasos de luz de las cortinas verticales, que siempre dejan paso de luz ' +
        'entre sus lamas.',
      fotos: [],
      activo: true,
    },
    {
      id: 'varios-panos',
      texto:
        'Se explica que una cortina dividida en varios paños suma un paso de luz al centro de ' +
        'entre 4 y 7 cm.',
      fotos: [],
      activo: true,
    },
  ],
};

const txt = (v: unknown): string => String(v ?? '').trim();
const esIdIntro = (v: unknown): v is IdIntro => IDS_INTRO.includes(v as IdIntro);

/**
 * Deja las intros guardadas en forma usable. Nunca lanza y nunca PIERDE una:
 * las que falten en lo guardado se reponen de fábrica, para que agregar una
 * familia nueva no deje muda a una empresa que ya guardó su versión — la misma
 * lección del catálogo guardado que pisaba al de fábrica.
 */
export function normalizarIntrosInforme(raw: unknown): IntrosInforme {
  const lista = Array.isArray((raw as IntrosInforme)?.intros)
    ? (raw as IntrosInforme).intros
    : Array.isArray(raw)
      ? (raw as IntroInforme[])
      : [];

  const guardadas = new Map<IdIntro, IntroInforme>();
  for (const i of lista) {
    if (!i || typeof i !== 'object' || !esIdIntro(i.id)) continue;
    const texto = txt(i.texto);
    if (!texto) continue; // sin texto no hay advertencia que dar
    guardadas.set(i.id, {
      id: i.id,
      texto,
      fotos: normalizarFotos(i.fotos),
      activo: i.activo !== false,
    });
  }

  return {
    intros: INTROS_INFORME_DEFAULT.intros.map(
      (base) => guardadas.get(base.id) ?? { ...base, fotos: [...base.fotos] },
    ),
  };
}

/** La intro de una familia, o `null` si está apagada. */
export function introDe(c: IntrosInforme, id: IdIntro): IntroInforme | null {
  const i = c.intros.find((x) => x.id === id);
  return i && i.activo ? i : null;
}

/** El texto de una intro con sus fotos debajo, listo para el informe. */
export function textoIntro(c: IntrosInforme, id: IdIntro): string {
  const i = introDe(c, id);
  return i ? textoConFotos(i.texto, i.fotos) : '';
}
