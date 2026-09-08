// Los cuatro interruptores del módulo de inventario.
//
// El cambio de fondo —que el stock deje de moverse desde el navegador y pase a
// hacerlo una función de la base— no se puede hacer de un día para otro sin
// parar el taller. Estos interruptores permiten encenderlo por partes y
// apagarlo en el acto si algo sale mal:
//
//   kardexRpc      Escribir por la función de la base en vez de con dos
//                  escrituras sueltas desde el navegador. Apagado = como hoy.
//   dualWrite      Además del registro nuevo, seguir escribiendo el viejo, para
//                  que las pantallas que todavía no migran no queden ciegas.
//   bloqueoDirecto Rechazar en la base cualquier escritura de stock que no pase
//                  por la función. Primero se avisa, después se bloquea.
//   compras        Mostrar el submódulo de Compras. Espera la aprobación de la
//                  jefatura: no se enciende sin eso.
//
// Se guardan como un JSON en `configuracion`, con el mismo patrón que el resto
// de las claves de la empresa.

export const CLAVE_FLAGS_INVENTARIO = 'inventario_flags';

export type FlagsInventario = {
  kardexRpc: boolean;
  dualWrite: boolean;
  bloqueoDirecto: boolean;
  compras: boolean;
};

/** Todo apagado: es como funciona el sistema hoy. */
export const FLAGS_APAGADOS: FlagsInventario = {
  kardexRpc: false,
  dualWrite: false,
  bloqueoDirecto: false,
  compras: false,
};

/**
 * Lee lo guardado sin confiar en nada: cualquier cosa que no sea exactamente
 * `true` queda apagada. Un JSON roto o a medio escribir no puede encender un
 * interruptor que cambia cómo se mueve el stock.
 */
export function sanearFlags(valor: unknown): FlagsInventario {
  let crudo: unknown = valor;
  if (typeof valor === 'string') {
    try {
      crudo = JSON.parse(valor);
    } catch {
      return { ...FLAGS_APAGADOS };
    }
  }
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return { ...FLAGS_APAGADOS };
  const o = crudo as Record<string, unknown>;
  return {
    kardexRpc: o.kardexRpc === true,
    dualWrite: o.dualWrite === true,
    bloqueoDirecto: o.bloqueoDirecto === true,
    compras: o.compras === true,
  };
}

/**
 * Combinaciones que no se pueden guardar, con el motivo en palabras. Vacío =
 * se puede guardar.
 */
export function problemasDeFlags(f: FlagsInventario): string[] {
  const problemas: string[] = [];
  if (f.bloqueoDirecto && !f.kardexRpc) {
    problemas.push(
      'No se puede bloquear la escritura directa mientras el kardex esté apagado: nadie podría mover stock.',
    );
  }
  if (f.dualWrite && !f.kardexRpc) {
    problemas.push(
      'La escritura doble solo tiene sentido con el kardex encendido: es su copia de respaldo.',
    );
  }
  return problemas;
}
