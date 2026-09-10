// ─────────────────────────────────────────────────────────────────────
// Cómo se le cuenta a la persona lo que acaba de pasar en Compras.
//
// Dos cosas: traducir los errores de las funciones de la base, y decir en
// palabras cómo salió la conversación con Finanzas.
//
// Van aparte de las cuentas porque son texto: cambiar cómo se dice algo no
// tiene por qué tocar la lógica que decide qué está pendiente.
// ─────────────────────────────────────────────────────────────────────

/**
 * Los códigos que levantan las funciones de la base, en la línea de los
 * `IN001…IN008` del kardex.
 */
const MENSAJES_COMPRAS: Record<string, string> = {
  CO000: 'El módulo de Compras está apagado. Se enciende en Inventario → Configuración.',
  CO001: 'Tu sesión no tiene empresa asignada. Vuelve a entrar.',
  CO002: 'Tu rol no puede hacer esto.',
  CO003: 'La orden o la solicitud ya no admite ese cambio.',
  CO004: 'Ese documento ya se recibió antes.',
  CO005: 'Esa línea no existe o no es de esta orden.',
  CO006: 'Hay una cantidad o un dato que no sirve.',
  CO007: 'Falta la firma de quien recibe.',
  CO008: 'Ese artículo no está en el catálogo.',
};

/**
 * El error de la base en palabras. Se prefiere SIEMPRE el mensaje que escribió
 * la función —que nombra el código y la cantidad concretos, «No existe el
 * artículo ZZZ99»— y el genérico queda de respaldo. Un mensaje genérico manda
 * a la persona a adivinar cuál de las doce líneas es la que falla.
 */
export function mensajeErrorCompras(code?: string | null, mensaje?: string | null): string {
  const propio = String(mensaje ?? '').trim();
  if (propio) return propio;
  const generico = MENSAJES_COMPRAS[String(code ?? '').toUpperCase()];
  if (generico) return generico;
  return 'No se pudo completar la operación.';
}

/** Qué decir después de hablar con Finanzas. */
export function mensajeSincronizacion(r: {
  nuevas?: number;
  actualizadas?: number;
  vinculadas?: number;
}): string {
  const nuevas = Number(r.nuevas ?? 0);
  const act = Number(r.actualizadas ?? 0);
  const vin = Number(r.vinculadas ?? 0);
  if (nuevas === 0 && act === 0) return 'No hay órdenes nuevas.';
  const partes: string[] = [];
  if (nuevas > 0) partes.push(nuevas === 1 ? '1 orden nueva' : `${nuevas} órdenes nuevas`);
  if (act > 0) partes.push(act === 1 ? '1 al día' : `${act} al día`);
  const base = partes.join(' · ');
  if (vin === 0) return base;
  const plural = vin === 1 ? '' : 's';
  return `${base} · ${vin} línea${plural} vinculada${plural} sola${plural}`;
}

/** «hace 12 min», para el botón de actualizar. */
export function textoDesdeSync(iso: string | null | undefined, ahora: Date = new Date()): string {
  const t = Date.parse(String(iso ?? ''));
  if (Number.isNaN(t)) return 'nunca';
  const min = Math.floor((ahora.getTime() - t) / 60_000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} día${dias === 1 ? '' : 's'}`;
}

/**
 * ¿Conviene volver a preguntarle a Finanzas al abrir la pantalla? Su proyecto
 * es de plan gratuito y se pausa: preguntarle en cada apertura no aporta nada y
 * hace lenta la pantalla.
 */
export function convieneSincronizar(
  ultima: string | null | undefined,
  ahora: Date = new Date(),
  minutos = 10,
): boolean {
  const t = Date.parse(String(ultima ?? ''));
  if (Number.isNaN(t)) return true;
  return ahora.getTime() - t > minutos * 60_000;
}
