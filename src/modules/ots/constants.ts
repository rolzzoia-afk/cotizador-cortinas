import type { OTEstado, SubEtapaProd } from './types';

// Orden canónico de estados "activos" (no incluye 'archivada').
// Avanza/retrocede se calcula por el índice en este array.
export const OT_ESTADOS: Exclude<OTEstado, 'archivada'>[] = [
  'cotizacion',
  'esperando',
  'terreno',
  'aprobada',
  'produccion',
  'lista',
  'instalada',
];

export const OT_ESTADO_META: Record<
  Exclude<OTEstado, 'archivada'>,
  { label: string; color: string; bg: string; border: string; emptyIcon: string; emptyMsg: string }
> = {
  cotizacion: {
    label: 'Cotización',
    color: '#818cf8',
    bg: 'rgba(99,102,241,0.15)',
    border: 'rgba(99,102,241,0.4)',
    emptyIcon: '📝',
    emptyMsg: 'Sin cotizaciones activas',
  },
  esperando: {
    label: 'Esperando confirmación',
    color: '#fb923c',
    bg: 'rgba(251,146,60,0.15)',
    border: 'rgba(251,146,60,0.4)',
    emptyIcon: '⌛',
    emptyMsg: 'Ninguna en espera',
  },
  terreno: {
    label: 'Terreno',
    color: '#fbbf24',
    bg: 'rgba(245,158,11,0.15)',
    border: 'rgba(245,158,11,0.4)',
    emptyIcon: '📍',
    emptyMsg: 'Sin visitas de terreno',
  },
  aprobada: {
    label: 'Aprobada',
    color: '#4ade80',
    bg: 'rgba(34,197,94,0.15)',
    border: 'rgba(34,197,94,0.4)',
    emptyIcon: '✅',
    emptyMsg: 'Ninguna aprobada aún',
  },
  produccion: {
    label: 'En producción',
    color: '#60a5fa',
    bg: 'rgba(59,130,246,0.15)',
    border: 'rgba(59,130,246,0.4)',
    emptyIcon: '⚙️',
    emptyMsg: 'Nada en fabricación',
  },
  lista: {
    label: 'Lista para entrega',
    color: '#c084fc',
    bg: 'rgba(168,85,247,0.15)',
    border: 'rgba(168,85,247,0.4)',
    emptyIcon: '📦',
    emptyMsg: 'Ninguna lista para entrega',
  },
  instalada: {
    label: 'Instalada',
    color: '#2dd4bf',
    bg: 'rgba(20,184,166,0.15)',
    border: 'rgba(20,184,166,0.4)',
    emptyIcon: '🏠',
    emptyMsg: 'Sin instalaciones recientes',
  },
};

export const SUB_ETAPAS_PROD: SubEtapaProd[] = [
  'Estructura',
  'Paños',
  'Dimensionado',
  'Armado',
  'Prueba',
  'Lista',
];

// Mensajes por defecto de WhatsApp según estado (portados del legacy 6401-6409).
export const WHATSAPP_MESSAGES: Record<Exclude<OTEstado, 'archivada'>, (cliente: string, numOT: string) => string> = {
  cotizacion: (n, o) =>
    `Hola ${n}, hemos registrado tu cotización N°${o} en Cortinas Rolzzo. En breve te contactamos con los detalles. Gracias por elegirnos — Cortinas Rolzzo`,
  esperando: (n, o) =>
    `Hola ${n}, tu cotización N°${o} está lista y esperamos tu confirmación para continuar. Cualquier consulta estamos a tu disposición. — Cortinas Rolzzo`,
  terreno: (n, o) =>
    `Hola ${n}, hemos coordinado la visita de terreno para tu pedido N°${o}. Nuestro equipo se pondrá en contacto para confirmar la fecha y hora. — Cortinas Rolzzo`,
  aprobada: (n, o) =>
    `Hola ${n}, tu pedido N°${o} ha sido aprobado y ya está ingresado a nuestro sistema de producción. Te avisamos cuando esté listo. — Cortinas Rolzzo`,
  produccion: (n, o) =>
    `Hola ${n}, tu pedido N°${o} está en fabricación. Estamos trabajando en él y te notificaremos cuando esté terminado. — Cortinas Rolzzo`,
  lista: (n, o) =>
    `Hola ${n}, ¡buenas noticias! Tu pedido N°${o} está listo. Nos pondremos en contacto para coordinar la instalación. — Cortinas Rolzzo`,
  instalada: (n, o) =>
    `Hola ${n}, tu pedido N°${o} ha sido instalado correctamente. Esperamos que estés muy contento/a con el resultado. Gracias por confiar en Cortinas Rolzzo.`,
};

// Formatea teléfono chileno para wa.me (portado del legacy 6414-6423).
export function formatTelefonoWhatsApp(telefono: string): string {
  let t = (telefono || '').replace(/\D/g, '');
  if (t.startsWith('0')) t = t.slice(1);
  if (t.startsWith('56')) return t;
  if (t.startsWith('9') && t.length === 9) return '56' + t;
  if (t.length === 8) return '569' + t;
  return t;
}

// % de avance por estado (portado del legacy 6527-6549).
export function calcularPorcentaje(estado: OTEstado, subEtapa: SubEtapaProd | null): number {
  if (estado === 'produccion') {
    const pctPorSub: Record<SubEtapaProd, number> = {
      Estructura: 55,
      Paños: 62,
      Dimensionado: 69,
      Armado: 76,
      Prueba: 83,
      Lista: 90,
    };
    return subEtapa ? pctPorSub[subEtapa] : 55;
  }
  const pctPorEstado: Partial<Record<OTEstado, number>> = {
    cotizacion: 10,
    esperando: 20,
    terreno: 35,
    aprobada: 50,
    lista: 95,
    instalada: 100,
  };
  return pctPorEstado[estado] ?? 0;
}

export function colorProgreso(pct: number): string {
  if (pct <= 20) return '#818cf8';
  if (pct <= 50) return '#f59e0b';
  if (pct <= 89) return '#3b82f6';
  return '#22c55e';
}
