// ─────────────────────────────────────────────────────────────────────
// Reordenar una lista arrastrando: mover un elemento ANTES de otro.
//
// Sale de `moverBloqueA` (el editor de documentos), que hacía exactamente esto
// con los bloques del PDF. Ahora lo comparten ese editor y las tablas de
// Fase 1, donde el dueño pidió poder ordenar a mano las cortinas y los
// adicionales («que se puedan tomar y arrastrar de arriba a abajo»).
//
// Va por ID y no por índice a propósito: quien arrastra ve una lista que puede
// estar filtrada o agrupada, y los índices de lo que ve no son los del array.
// ─────────────────────────────────────────────────────────────────────

/**
 * Mueve el elemento `id` justo antes de `antesDeId`, o al final si no se da.
 *
 * Cuando no hay nada que mover devuelve EL MISMO array, no una copia: quien
 * llama compara por referencia para no marcar la pantalla como modificada.
 */
export function moverPorId<T extends { id: string }>(
  lista: T[],
  id: string,
  antesDeId?: string,
): T[] {
  const movido = lista.find((x) => x.id === id);
  if (!movido || antesDeId === id) return lista;
  const resto = lista.filter((x) => x.id !== id);
  const idx = antesDeId ? resto.findIndex((x) => x.id === antesDeId) : -1;
  if (idx === -1) resto.push(movido);
  else resto.splice(idx, 0, movido);
  return resto;
}

/**
 * Mueve la fila `id` con TODO su bloque de ventana.
 *
 * Una ventana de varios paños son varias filas seguidas con el mismo `vid`
 * (un dual son dos telas de una misma cortina). Arrastrar una sola las
 * separaría, y al guardar se re-agrupan por primera aparición: el orden
 * visible dejaría de ser el guardado. Una fila sin `vid` se mueve sola.
 *
 * `antesDeId` puede ser cualquier fila: se inserta antes del bloque al que
 * esa fila pertenece.
 */
export function moverBloqueDeVentana<T extends { id: string; vid?: string }>(
  lista: T[],
  id: string,
  antesDeId?: string,
): T[] {
  const movida = lista.find((x) => x.id === id);
  if (!movida) return lista;
  const delBloque = (f: T, ref: T) => (ref.vid ? f.vid === ref.vid : f.id === ref.id);
  const bloque = lista.filter((f) => delBloque(f, movida));
  const resto = lista.filter((f) => !delBloque(f, movida));
  const destino = antesDeId ? lista.find((x) => x.id === antesDeId) : undefined;
  // Soltar dentro del propio bloque no cambia nada.
  if (destino && delBloque(destino, movida)) return lista;
  const idx = destino ? resto.findIndex((f) => delBloque(f, destino)) : -1;
  if (idx === -1) resto.push(...bloque);
  else resto.splice(idx, 0, ...bloque);
  return resto;
}
