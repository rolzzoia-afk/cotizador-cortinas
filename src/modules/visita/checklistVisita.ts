// ─────────────────────────────────────────────────────────────────────
// EL RESUMEN DE VISITA — las preguntas que el vendedor confirma con el cliente
// antes de irse: tiempos, pasos de luz, estacionamiento, techos y muros.
//
// Vienen de fábrica con las seis del formulario en papel, pero se editan en
// Admin: cada empresa arma su propia lista. Las respuestas se guardan por ID,
// así que borrar una pregunta no borra lo que ya se contestó en OTs viejas.
//
// Módulo PURO (sin React ni Supabase).
// ─────────────────────────────────────────────────────────────────────

export type PreguntaVisita = {
  /** Estable: es la llave con la que se guarda la respuesta en la OT. */
  id: string;
  /** Título del acordeón ("Tiempo de instalación"). */
  titulo: string;
  /** La pregunta que se le hace al cliente. */
  pregunta: string;
  /** Orden de aparición (menor primero). */
  orden: number;
  /** Una pregunta retirada deja de preguntarse, sin borrar el historial. */
  activa: boolean;
};

export type ChecklistVisita = { preguntas: PreguntaVisita[] };

/** Las seis del formulario de terreno, tal como se preguntan hoy. */
export const CHECKLIST_VISITA_DEFAULT: ChecklistVisita = {
  preguntas: [
    {
      id: 'tiempo-instalacion',
      titulo: 'Tiempo de instalación',
      pregunta:
        '¿Se explicó que los tiempos de instalación son de 8 a 12 días hábiles —VERTICALES 15 DÍAS hábiles— aproximadamente (lunes a viernes, sin feriados ni fines de semana) desde realizado el pago del 50 % inicial?',
      orden: 1,
      activa: true,
    },
    {
      id: 'tipos-cortinas',
      titulo: 'Tipos de cortinas',
      pregunta:
        '¿Se explicaron los tipos de cortina cotizados, con sus diferencias de tela, mecanismo y accionamiento?',
      orden: 2,
      activa: true,
    },
    {
      id: 'pasos-de-luz',
      titulo: 'Pasos de luz de las cortinas',
      pregunta:
        '¿Se explicó que incluso las cortinas blackout dejan pasos de luz en los laterales y en la parte superior, y que una cortina dividida en varios paños suma un paso de luz al centro?',
      orden: 3,
      activa: true,
    },
    {
      id: 'estacionamiento',
      titulo: 'Estacionamiento de visita',
      pregunta: '¿Hay estacionamiento disponible para el vehículo el día de la instalación?',
      orden: 4,
      activa: true,
    },
    {
      id: 'techos-y-muros',
      titulo: 'Techos y muros',
      pregunta:
        '¿Se revisó el material de techos y muros, y se avisó que puede requerir platinas metálicas u otro anclaje especial?',
      orden: 5,
      activa: true,
    },
    {
      id: 'resumen-orden',
      titulo: 'Resumen de orden',
      pregunta:
        'Entiendo todo lo explicado en la visita por el vendedor, por lo que todo lo que dice esta orden es lo que se enviará en la cotización final. En caso de querer cambiar o agregar telas, colores de accesorios, pesos, mecanismos o adicionales como cenefas o motores el mismo día de la instalación, sé que puede implicar un cobro adicional por no haber revisado la cotización final enviada por correo y por WhatsApp.',
      orden: 6,
      activa: true,
    },
  ],
};

const txt = (v: unknown): string => String(v ?? '').trim();

/** Un id utilizable: minúsculas, sin espacios ni acentos. */
export function idDePregunta(titulo: string): string {
  return txt(titulo)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Deja el checklist guardado en forma usable: descarta preguntas sin id o sin
 * texto, resuelve ids repetidos y renumera el orden. Nunca lanza: una
 * configuración corrupta cae al checklist de fábrica.
 */
export function normalizarChecklistVisita(raw: unknown): ChecklistVisita {
  const lista = Array.isArray((raw as ChecklistVisita)?.preguntas)
    ? (raw as ChecklistVisita).preguntas
    : Array.isArray(raw)
      ? (raw as PreguntaVisita[])
      : null;
  if (!lista) return CHECKLIST_VISITA_DEFAULT;

  const vistos = new Set<string>();
  const preguntas: PreguntaVisita[] = [];
  for (const p of lista) {
    if (!p || typeof p !== 'object') continue;
    const titulo = txt(p.titulo);
    const pregunta = txt(p.pregunta);
    if (!titulo && !pregunta) continue;
    let id = txt(p.id) || idDePregunta(titulo || pregunta);
    if (!id) continue;
    // Id repetido: se le agrega un sufijo para no pisar las respuestas del otro.
    if (vistos.has(id)) {
      let n = 2;
      while (vistos.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    vistos.add(id);
    preguntas.push({
      id,
      titulo: titulo || pregunta.slice(0, 40),
      pregunta: pregunta || titulo,
      orden: Number.isFinite(p.orden) ? Number(p.orden) : preguntas.length + 1,
      activa: p.activa !== false,
    });
  }
  if (preguntas.length === 0) return CHECKLIST_VISITA_DEFAULT;
  preguntas.sort((a, b) => a.orden - b.orden);
  return { preguntas: preguntas.map((p, i) => ({ ...p, orden: i + 1 })) };
}

/** Las preguntas que se muestran en terreno, en orden. */
export function preguntasActivas(c: ChecklistVisita): PreguntaVisita[] {
  return c.preguntas.filter((p) => p.activa).sort((a, b) => a.orden - b.orden);
}

/** Mueve una pregunta un lugar arriba o abajo, renumerando el orden. */
export function moverPregunta(c: ChecklistVisita, id: string, delta: -1 | 1): ChecklistVisita {
  const lista = [...c.preguntas].sort((a, b) => a.orden - b.orden);
  const i = lista.findIndex((p) => p.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= lista.length) return c;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  return { preguntas: lista.map((p, k) => ({ ...p, orden: k + 1 })) };
}

/** Cuántas preguntas activas quedan sin contestar. */
export function pendientesChecklist(
  c: ChecklistVisita,
  respuestas: Record<string, { respuesta: boolean | null }> | undefined,
): number {
  return preguntasActivas(c).filter((p) => respuestas?.[p.id]?.respuesta == null).length;
}
