// Letra de un paño (la "cortar junto" de la hoja de corte): A…Z y, al dar la
// vuelta, la MISMA letra repetida: AA, BB, CC… ZZ, AAA, BBB… Cada vuelta al
// abecedario suma una copia de la letra. Así el taller lee «la B de la segunda
// vuelta» sin descifrar columnas de Excel (AB, AC…), y las letras NUNCA se
// repiten entre paños distintos: antes volvían a la A después de la Z, y en una
// OT con más de 26 paños (la 268-6 tenía 88) la hoja de corte fusionaba paños
// que compartían letra — mostraba 26 paños en vez de 88 y reservaba ~un tercio
// de la tela real.
//
// Módulo propio (y no en tela.ts) porque también lo usa el motor de PRECIOS
// para rotular sus paños, y ese no debe arrastrar las dependencias del corte.

/** 1 → A · 26 → Z · 27 → AA · 28 → BB · 52 → ZZ · 53 → AAA. Fuera de rango (0, negativo, NaN) → ''. */
export function letraPano(n: number): string {
  if (!Number.isFinite(n) || n < 1) return '';
  const x = Math.floor(n) - 1;
  const letra = String.fromCharCode(65 + (x % 26));
  return letra.repeat(Math.floor(x / 26) + 1);
}
