// Letra de un paño (la "cortar junto" de la hoja de corte), estilo columna de
// Excel: A…Z, AA, AB… — SIN dar la vuelta. Antes las letras volvían a la A
// después de la Z, y en una OT con más de 26 paños (la 268-6 tenía 88) la hoja
// de corte fusionaba paños distintos que compartían letra: mostraba 26 paños en
// vez de 88 y reservaba ~un tercio de la tela real.
//
// Módulo propio (y no en tela.ts) porque también lo usa el motor de PRECIOS
// para rotular sus paños, y ese no debe arrastrar las dependencias del corte.

/** 1 → A · 26 → Z · 27 → AA · 53 → BA. Fuera de rango (0, negativo, NaN) → ''. */
export function letraPano(n: number): string {
  if (!Number.isFinite(n) || n < 1) return '';
  let s = '';
  let x = Math.floor(n);
  while (x > 0) {
    x--;
    s = String.fromCharCode(65 + (x % 26)) + s;
    x = Math.floor(x / 26);
  }
  return s;
}
