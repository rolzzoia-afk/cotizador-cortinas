// ─────────────────────────────────────────────────────────────────────
// TÉRMINOS Y CONDICIONES de la cotización (Fase 1 / Fase 3).
//
// En el Excel manual los términos cambian según lo que se esté cotizando:
// hay condiciones generales, otras que solo aplican a una gama de tela
// ("GAMA PREMIUM Y DELUX: garantía 5 años…", "GAMA ESTÁNDAR: ancho máximo
// 2,50 m…") y otras a un producto puntual ("DARK ROLLER se instala entre 18 y
// 25 días hábiles").
//
// Modelo: el admin define GRUPOS. Cada grupo tiene un nombre, sus términos y
// a QUÉ aplica: siempre, a ciertas categorías de tela (A/B) y/o a ciertas
// categorías de producto (BEEBLACK, DARK_38mm…). Al cotizar se juntan los
// grupos que apliquen y se listan sus términos SIN REPETIR: un mismo término
// escrito en dos grupos sale una sola vez.
//
// Módulo puro: sin React ni Supabase (se testea directo).
// ─────────────────────────────────────────────────────────────────────

import { recargoTarjetaEfectivo, type ParametrosCotizador } from './preciosFase0';

/** Un grupo de términos y a qué cotizaciones aplica. */
export type GrupoTerminos = {
  id: string;
  nombre: string;
  /** Aplica a toda cotización, sin importar qué se cotice. */
  siempre?: boolean;
  /** Categorías de TELA a las que aplica ('A' | 'B'). Vacío = no filtra por tela. */
  telas?: string[];
  /** Categorías de PRODUCTO a las que aplica (BEEBLACK, DARK_38mm…). Vacío = no filtra. */
  categorias?: string[];
  /** Los términos, uno por línea/ítem. */
  terminos: string[];
};

export type ConfigTerminos = { grupos: GrupoTerminos[] };

/**
 * Los términos de los PDF que la empresa manda hoy al cliente. Son DOS
 * documentos distintos —el de categoría A y el de categoría B— y difieren en
 * casi todo lo que importa: cuotas (6 vs 12), garantías (5 años vs 3),
 * medidas máximas y hasta el cobro de la primera visita. Por eso van en tres
 * grupos: lo común, lo propio de la A y lo propio de la B.
 *
 * Un grupo `general` con `siempre` es además la red de seguridad: una
 * cotización cuyas telas no tengan categoría en el catálogo igual sale con
 * condiciones.
 *
 * El ítem de la TARJETA va en cada gama a propósito (dice más que el
 * automático: transferencia y efectivo solo 2.ª cuota, y el número de cuotas
 * cambia entre A y B). `conTerminoTarjeta` evita duplicarlo.
 */
export const TERMINOS_DEFAULT: ConfigTerminos = {
  grupos: [
    {
      id: 'general',
      nombre: 'General',
      siempre: true,
      terminos: [
        'Cotización válida por 5 días.',
        'Pago: 50% para iniciar la fabricación y 50% al finalizar la instalación.',
        'Perfil "ROLLER SOFT LIGHT" se debe evaluar si hay factibilidad de instalar, da entre un 60% a un 80% de oscuridad.',
        'Verificar stock de tela elegida antes de realizar algún pago.',
        'Entrega para Regiones de cortinas sin instalación de 8 a 12 días hábiles (L a V) desde recibido el pago del 50%.',
        'Es necesario contar con puesto de estacionamiento resguardado para poder realizar la visita y una posible instalación.',
        'Cortina roller (screen, dúo, blackout) con el tiempo suelen deshilachar un poco por los laterales.',
        'Instalaciones se realizarán en horario laboral de 9:30 am a 5:30 pm (L a V), fuera de horario tienen recargo adicional.',
        'Las Cortinas Roller son fabricadas a medida, por lo que son personalizadas para cada proyecto, una vez confeccionadas no se realiza devoluciones de dinero.',
        'De haber desperfectos o desniveles en muros o techos, Cortinas Rolzzo no se hace responsable en la reparación o en su defecto en el ajuste de la misma.',
        'De llevar motores y se tenga que instalar suplementos o haya desnivel en los techos, las cortinas no subirán al mismo nivel debido a las imperfecciones.',
        'En caso de agregar o quitar cortinas puede variar el precio ya que se debe recalcular toda la cotización por la cantidad de metros a utilizar y puede variar la optimización en telas, cantidad de mano de obra, accesorios, entre otros.',
        'En caso de fenómenos naturales Cortinas Rolzzo no se hace responsable por los daños ocasionados por un factor externo, casos como: incendios, terremotos, maremotos, inundaciones, tornados, tormentas, entre otros.',
      ],
    },
    {
      id: 'gama-a',
      nombre: 'Categoría A (tela)',
      telas: ['A'],
      terminos: [
        'Instalación GRATIS mínimo de 4 cortinas roller (RM Anillo Vespucio Norte) - Premium o Delux; 3 o menos, valor instalación $17.500 c/u + IVA.',
        'Los valores pueden cambiar sin previo aviso.',
        'Cortinas Roller Blackout y Screen al utilizar zuncho y corchete en el peso inferior tienden a generar leves ondas en las telas, al ser mayor a 2 mts de ancho aún más.',
        'Pago: Tarjeta de crédito hasta 6 cuotas sin interés por mercadopago, transferencia y de cancelar en efectivo solo 2da cuota.',
        'DARK ROLLER se instala entre 18 a 25 días hábiles por armado de estructura especial - INSTALACIÓN SOLO EN SANTIAGO.',
        'Primera visita teniendo cotización previa tiene un valor de $15.000 (RM en AVN), monto que será descontado del total del servicio en caso de aprobación del presupuesto. Las visitas adicionales que sean requeridas tendrán un costo de $20.000 cada una y no serán reembolsables en ningún caso.',
        'Screen mayor a 2,00 mts de estar expuestas a vientos constantes suelen deshilachar al tiempo por soltura de puntos.',
        'GAMA DE TELA PREMIUM Y DELUX: Garantía 5 (cinco) años en mecanismos y sistemas - 2 años en telas.',
        'GAMA DE TELA PREMIUM Y DELUX: Se fabrican hasta 3,00 mts de ancho y hasta 4,00 mts de alto aproximadamente (dependiendo el caso).',
        'GAMA ESTANDAR: Ancho máximo 2,50 mts - Alto máximo 2,30 mts (aprox). De ser mayor a esto se debe cotizar con gama PREMIUM O DELUX.',
        'GAMA ESTANDAR: Garantía 5 (cinco) años en mecanismos y sistemas (no incluye motor) - 1 año en telas.',
        'Garantías: Motor: 1 año | Sistemas de Oscuridad: 2 años | Verticales: 2 años | Sistema de Piolas: 1 año. El envío de la foto o video es primordial, todas las garantías mencionadas aplican siempre y cuando sean por falla de fábrica y no por mal uso.',
        'Garantía de instalaciones: 3 años (siempre y cuando sea defecto de la instalación como tal y no por techos o muros arenosos, vulcanitas de baja gama, filtraciones en el lugar de instalación, mal uso de las cortinas, manipulación de externos, traslado de la cortina del lugar inicial).',
        'El recargo por Tarjeta de Crédito se debe a que la plataforma Mercadopago cobra una comisión por el uso de la plataforma y otra comisión por ofrecer cuotas sin interés; si deseas pagar en 1 cuota podemos recalcular la comisión.',
        'Las cenefas cuadradas u ovaladas sin tira pueden tener pequeñas rajas de fábrica a pesar del cuidado que le damos desde su fabricación.',
      ],
    },
    {
      id: 'gama-b',
      nombre: 'Categoría B (tela)',
      telas: ['B'],
      terminos: [
        'Instalación básica GRATIS mínimo de 4 cortinas roller (RM Anillo Vespucio Norte) - Premium Categoría B; 3 o menos, valor instalación $17.500 c/u + IVA.',
        'Línea Premium - Categoría B se instala con peso cadena tipo "huevo".',
        'Cortinas Roller igual o mayor a 1,90 mts de alto tienden a generar una leve onda en las telas tipo corte en "V".',
        'Pago: Tarjeta de crédito hasta 12 cuotas sin interés por mercadopago, transferencia y de cancelar en efectivo solo 2da cuota.',
        'Primera visita SIN COSTO previa cotización (RM en AVN), de tener que agendar una visita adicional tiene un costo de $20.000.',
        'Los pesos o barras inferiores pueden estar un 10% rayados por defecto de fábrica.',
        'TELA PREMIUM-CATEGORÍA B: Se fabrica hasta 2,50 mts de ancho y 2,35 mts de alto.',
        'GARANTIA TELA GAMA PREMIUM-CATEGORÍA B: 1 año o lo que es igual a 365 días corridos.',
        'GARANTÍA ACCESORIOS GAMA PREMIUM-CATEGORÍA B: Garantía 3 (tres) años en mecanismos y sistemas (no incluye motor).',
        'Garantías: Motor: 6 meses | Soft Light: 1 año | Verticales: 2 años | Sistema de Piolas: 1 año | Cadenas: 3 años | Mecanismo: 3 años. El envío de la foto o video es primordial, todas las garantías mencionadas aplican siempre y cuando sean por falla de fábrica y no por mal uso.',
        'Garantía de instalaciones: 2 años (siempre y cuando sea defecto de la instalación como tal y no por techos o muros arenosos, vulcanitas de baja gama, filtraciones en el lugar de instalación, mal uso de las cortinas, manipulación de externos, traslado de la cortina del lugar inicial).',
      ],
    },
  ],
};

/**
 * La frase de la TARJETA que arma la app sola: depende del proveedor y del
 * recargo vigente, que son parámetros vivos y no pueden quedar escritos a mano.
 */
export function textoTerminoTarjeta(
  parametros: ParametrosCotizador,
  fmtPct: (n: number) => string,
): string {
  return parametros.proveedorTarjeta === 'flow'
    ? `Tarjeta de crédito vía Flow (recargo ${fmtPct(recargoTarjetaEfectivo(parametros))}%): las cuotas y sus intereses dependen de tu banco.`
    : `Tarjeta de crédito hasta 12 cuotas sin interés (recargo Mercado Pago ${fmtPct(recargoTarjetaEfectivo(parametros))}%).`;
}

/**
 * ¿La lista ya trae un término que habla de la tarjeta de CRÉDITO? (el de
 * fábrica lo hace, y dice más que el automático). Se exige «crédito» para no
 * confundirse con la nota de la tarjeta de DÉBITO.
 */
export function hayTerminoTarjeta(items: string[]): boolean {
  return items.some((t) => {
    const k = claveTermino(t);
    return k.includes('TARJETA DE CREDITO');
  });
}

/**
 * La lista final que se muestra: agrega la frase automática de la tarjeta SOLO
 * si los términos configurados no hablan ya del tema. Así el PDF y la pantalla
 * dicen exactamente lo mismo, y si el admin borra su término la app vuelve a
 * poner el suyo.
 */
export function conTerminoTarjeta(items: string[], textoTarjeta: string): string[] {
  return hayTerminoTarjeta(items) ? items : [...items, textoTarjeta];
}

/** Normaliza para comparar/deduplicar: sin acentos, sin espacios de más, sin puntuación final. */
export function claveTermino(t: string): string {
  return String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[.;:,\s]+$/, '')
    .trim();
}

/** Normaliza una categoría de producto para comparar (mayúsculas, sin espacios). */
function normCat(c: string | null | undefined): string {
  return String(c ?? '').trim().toUpperCase();
}

/**
 * Sanea lo que viene de la BD: descarta grupos sin forma válida, recorta
 * términos vacíos y garantiza los arrays. Si no queda nada, devuelve el default
 * (la cotización nunca debe quedarse sin condiciones).
 */
export function normalizarTerminos(raw: unknown): ConfigTerminos {
  const gruposRaw = (raw as ConfigTerminos | null)?.grupos;
  if (!Array.isArray(gruposRaw)) return TERMINOS_DEFAULT;
  const grupos: GrupoTerminos[] = [];
  for (const g of gruposRaw) {
    if (!g || typeof g !== 'object') continue;
    const terminos = Array.isArray(g.terminos)
      ? g.terminos.map((t) => String(t ?? '').trim()).filter(Boolean)
      : [];
    const id = String(g.id ?? '').trim();
    if (!id) continue;
    grupos.push({
      id,
      nombre: String(g.nombre ?? '').trim() || id,
      siempre: g.siempre === true,
      telas: Array.isArray(g.telas) ? g.telas.map((t) => String(t).trim().toUpperCase()).filter(Boolean) : [],
      categorias: Array.isArray(g.categorias)
        ? g.categorias.map(normCat).filter(Boolean)
        : [],
      terminos,
    });
  }
  return grupos.length ? { grupos } : TERMINOS_DEFAULT;
}

/** Categorías de PRODUCTO presentes en las ventanas de la OT (set ordenado). */
export function categoriasDeVentanas(
  ventanas: Array<{ categoria?: string | null }> | null | undefined,
): string[] {
  const set = new Set<string>();
  for (const v of ventanas ?? []) {
    const c = normCat(v?.categoria);
    if (c) set.add(c);
  }
  return [...set].sort();
}

/** ¿Este grupo aplica a lo que se está cotizando? */
export function grupoAplica(
  g: GrupoTerminos,
  catsProducto: string[],
  catsTela: string[],
): boolean {
  if (g.siempre) return true;
  const cats = (g.categorias ?? []).map(normCat).filter(Boolean);
  const telas = (g.telas ?? []).map((t) => String(t).trim().toUpperCase()).filter(Boolean);
  // Un grupo sin `siempre` y sin ninguna asignación no aplica a nada: es un
  // grupo a medio configurar, no un comodín silencioso.
  if (!cats.length && !telas.length) return false;
  const porCat = cats.some((c) => catsProducto.map(normCat).includes(c));
  const porTela = telas.some((t) => catsTela.map((x) => String(x).toUpperCase()).includes(t));
  return porCat || porTela;
}

/**
 * Términos que corresponden a la cotización: une los grupos que aplican, en el
 * orden en que están definidos, y descarta los repetidos (comparando el texto
 * normalizado). Devuelve el texto ORIGINAL del primero que apareció.
 */
export function terminosParaCotizacion(
  config: ConfigTerminos,
  catsProducto: string[],
  catsTela: string[],
): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const g of config.grupos) {
    if (!grupoAplica(g, catsProducto, catsTela)) continue;
    for (const t of g.terminos) {
      const k = claveTermino(t);
      if (!k || vistos.has(k)) continue;
      vistos.add(k);
      out.push(t.trim());
    }
  }
  return out;
}
