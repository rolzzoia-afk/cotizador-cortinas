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
  /** Vertical: extra (cm) de reserva en el plan de corte (Regla 7). */
  extraVerticalCm: number;
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
};

export const PARAMETROS_CORTE_DEFAULT: ParametrosCorte = {
  extraAltoCm: 25,
  extraDuoCm: 30,
  extraVerticalCm: 5,
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
};
