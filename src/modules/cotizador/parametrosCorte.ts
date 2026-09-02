// ─────────────────────────────────────────────────────────────────────
// Parámetros de CORTE / dimensionado — las celdas seteables del Excel
// del taller, editables por empresa desde el tab "Parámetros de corte"
// del Optimizador de Tela (/optimizador-tela).
//
// Los defaults son los valores históricos exactos que estaban hardcodeados
// en tela.ts / planCorte.ts / motorFase0.ts, verificados contra OTs reales.
// Los módulos puros los reciben por argumento opcional con estos defaults,
// así una llamada sin parámetros conserva el comportamiento validado.
//
// Se guardan junto al resto en la clave 'parametros_cotizador' de la tabla
// `configuracion` (ParametrosCotizador los incluye por intersección).
// Módulo puro: sin React/Supabase.
// ─────────────────────────────────────────────────────────────────────

export type ParametrosCorte = {
  /** Extra (cm) al alto de corte roller/otros. ⚠ También define los metros
   *  de tela del PRECIO en Fase 0 (igual que la celda del Excel). */
  extraAltoCm: number;
  /** Dúo: corte real de tela = 2×alto + este valor (cm). Fija también la
   *  reserva de colmena del plan de corte (regla "nunca inferior"). */
  extraDuoCm: number;
  /** Dúo: ALTO MESA DE CORTE = alto + este valor (cm). La tela dúo se corta
   *  DOBLADA en la mesa, así que el Dimensionado muestra esta medida (mitad del
   *  alto de tela) en vez del ALTO. Solo afecta el PDF Dimensionado. */
  extraMesaDuoCm: number;
  /** Vertical: extra (cm) al alto. Es el ALTO DE CORTE de la tela vertical
   *  (alto real + este valor) y la reserva del plan de corte (Regla 7). */
  extraVerticalCm: number;
  /** Vertical: alto FINAL de la lama = alto de corte − este valor (cm). Es el
   *  descuento de la terminación (dobladillo + enganche del carrito). */
  dctoAltoFinalVerticalCm: number;
  /** Ancho de corte = ancho nominal − este valor (cm). */
  descAnchoCorteCm: number;
  /** Ancho de rollo (m) cuando el producto no define el suyo en catálogo. */
  anchoRolloDefaultM: number;
  /** Ancho del rollo en el plan de corte (cm); útil = este − 2×margen. */
  anchoRolloPlanCm: number;
  /** Margen de corte del rollo por lado (cm). */
  margenRolloCm: number;
  /** Limpieza de bordes al ancho de cada pieza que va a rollo (cm, Regla 5). */
  bordeCm: number;
  /** Tolerancia de alto (cm) para reusar un sobrante de colmena
   *  (alto pieza ≤ alto sobrante ≤ pieza + este valor). */
  ventanaAltoCm: number;
  /** Solo se propone rotar piezas si el layout rotado ahorra ≥ esto (cm). */
  ahorroMinRotacionCm: number;
  /** Mínimo de ancho (cm) para que un remanente sea colmena; bajo esto es MERMA. */
  colmenaMinAnchoCm: number;
  /** Mínimo de alto (cm) para que un remanente sea colmena. */
  colmenaMinAltoCm: number;
  /** Días sin uso para que una colmena disponible pase a alerta (Reglas Rolzzo v1.0). */
  diasAlertaColmena: number;
  /**
   * ¿Desde qué medida un sobrante SIRVE para una roller? Es lo que la etiqueta
   * del sobrante marca como FUNCIONAL, y en el módulo Producción decide si el
   * remanente entra a la colmena o se anota como merma. Va aparte del mínimo de
   * colmena de arriba a propósito: aquel es la regla histórica del inventario;
   * estos dos son la pregunta del cortador —«¿alcanza para algo?»—.
   */
  funcionalRollerMinAnchoCm: number;
  funcionalRollerMinAltoCm: number;
  /** Lo mismo para una vertical: más angosta pero más larga (da lamas). */
  funcionalVerticalMinAnchoCm: number;
  funcionalVerticalMinAltoCm: number;
  /**
   * ¿El plan de corte puede reutilizar paños de la colmena? Apagado, el
   * optimizador corta TODO de rollo nuevo aunque la colmena tenga paños
   * disponibles (y no los descuenta al confirmar el corte). Los sobrantes se
   * siguen registrando como inventario físico: esto solo decide si se usan.
   */
  usarColmenaPanos: boolean;
  /**
   * Cómo corta la mesa, que es lo que decide qué layouts se pueden proponer:
   *
   *  · `guillotina` — las mesas de HOY. Cada corte cruza la tela de punta a
   *    punta y la otra dirección se consigue girando el paño, así que un
   *    layout solo sirve si se puede ir partiendo en dos, una y otra vez.
   *  · `multieje` — la cortadora CNC (puente X-Y): corta en todos los ejes sin
   *    girar la tela, así que acepta cualquier acomodo (MaxRects, el histórico).
   *
   * De fábrica va en `guillotina`: un layout que la mesa no puede ejecutar no
   * ahorra tela, obliga al operario a improvisar.
   */
  modoCorte: ModoCorte;
};

/** Cómo corta la mesa que va a ejecutar el plan. */
export type ModoCorte = 'guillotina' | 'multieje';

export const PARAMETROS_CORTE_DEFAULT: ParametrosCorte = {
  extraAltoCm: 25,
  extraDuoCm: 30,
  extraMesaDuoCm: 10,
  extraVerticalCm: 5,
  dctoAltoFinalVerticalCm: 13,
  descAnchoCorteCm: 3.5,
  anchoRolloDefaultM: 2.98,
  anchoRolloPlanCm: 300,
  margenRolloCm: 1,
  bordeCm: 4,
  ventanaAltoCm: 30,
  ahorroMinRotacionCm: 20,
  colmenaMinAnchoCm: 120,
  colmenaMinAltoCm: 180,
  diasAlertaColmena: 90,
  // Medidas que el dueño fijó mirando el taller (2026-09-02).
  funcionalRollerMinAnchoCm: 100,
  funcionalRollerMinAltoCm: 200,
  funcionalVerticalMinAnchoCm: 80,
  funcionalVerticalMinAltoCm: 250,
  // De fábrica la colmena SÍ se usa (comportamiento histórico). Se apaga desde
  // el tab "Parámetros de corte" del Optimizador de Tela.
  usarColmenaPanos: true,
  // Las mesas de hoy cortan de punta a punta y giran el paño. Se cambia a
  // 'multieje' cuando entre en producción la cortadora CNC.
  modoCorte: 'guillotina',
};
