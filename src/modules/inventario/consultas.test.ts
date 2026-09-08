// Las columnas que le pedimos a la base tienen que existir de verdad.
//
// POR QUÉ ESTE TEST: los tests corren en `node`, sin base, así que un nombre de
// columna equivocado no lo ve nadie hasta que la pantalla está en producción —
// y PostgREST no devuelve una columna vacía: rechaza la consulta ENTERA. Así
// quedó el tablero en blanco el 2026-09-08 pidiendo `telas_catalogo.descripcion`
// (se llama `descriptor`) y `movimientos_telas.cantidad` (se llama `metros`):
// seis KPI en cero que parecían datos.
//
// Se revisa contra `src/types/database.ts`, que lo genera `npm run types:gen`
// desde la base real. Alcance: el módulo de inventario. Las tablas que todavía
// no están en los tipos (van con `as any`) se saltan.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const RAIZ = fileURLToPath(new URL('../../..', import.meta.url));

/** Las columnas reales de cada tabla, del bloque `Row` de los tipos. */
function columnasPorTabla(): Map<string, Set<string>> {
  const src = fs.readFileSync(path.join(RAIZ, 'src/types/database.ts'), 'utf8');
  const tablas = new Map<string, Set<string>>();
  const re = /^ {6}(\w+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\}/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const cols = new Set<string>();
    for (const linea of m[2].split('\n')) {
      const c = linea.match(/^ {10}(\w+)\??:/);
      if (c) cols.add(c[1]);
    }
    tablas.set(m[1], cols);
  }
  return tablas;
}

function archivos(dir: string, salida: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) archivos(p, salida);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) salida.push(p);
  }
  return salida;
}

type Consulta = { archivo: string; linea: number; tabla: string; columnas: string[] };

const FILTROS = /\.(eq|neq|gt|gte|lt|lte|like|ilike|in|is|contains|order)\(\s*'([^']+)'/g;

/**
 * Cada `.from('tabla')…` del código, con las columnas que nombra: las del
 * `.select` y las de los filtros y el orden — una columna inventada en un
 * `.eq` o un `.order` tumba la consulta igual que en el `.select`.
 *
 * La sentencia termina en el `;` o cuando empieza la siguiente consulta:
 * dentro de un `Promise.all([...])` no hay `;` entre una y otra, y sin ese
 * corte se leerían los filtros de la vecina.
 */
function consultasDe(archivo: string): Consulta[] {
  const src = fs.readFileSync(archivo, 'utf8');
  const fuera: Consulta[] = [];
  const re = /\.from\(\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const desde = src.slice(m.index + m[0].length);
    const cortes = [desde.indexOf(';'), desde.indexOf('.from(')].filter((i) => i > 0);
    const sentencia = desde.slice(0, cortes.length ? Math.min(...cortes, 900) : 900);

    const columnas: string[] = [];
    const sel = sentencia.match(/\.select\(\s*'([^']*)'/);
    const lista = sel ? sel[1].trim() : '';
    // `*`, conteos y relaciones anidadas (`ot:ots(...)`) no se revisan acá.
    if (lista && lista !== '*' && !lista.includes('(')) {
      columnas.push(...lista.split(',').map((c) => c.trim().replace(/^.*:/, '')));
    }
    let g: RegExpExecArray | null;
    FILTROS.lastIndex = 0;
    while ((g = FILTROS.exec(sentencia))) {
      // `.order('fecha', …)` y `.order('tabla.col')`: se queda con la columna.
      columnas.push(g[2].split('.')[0].trim());
    }
    if (columnas.length === 0) continue;
    fuera.push({
      archivo: path.relative(RAIZ, archivo).replace(/\\/g, '/'),
      linea: src.slice(0, m.index).split('\n').length,
      tabla: m[1].replace(/ as any$/, '').trim(),
      columnas,
    });
  }
  return fuera;
}

describe('las columnas que pide el inventario existen en la base', () => {
  const tablas = columnasPorTabla();
  const fuentes = [
    ...archivos(path.join(RAIZ, 'src/modules/inventario')),
    ...archivos(path.join(RAIZ, 'src/pages/inventario')),
  ];

  it('los tipos generados se pudieron leer', () => {
    expect(tablas.size).toBeGreaterThan(20);
    expect(tablas.get('insumos')?.has('stock_mp')).toBe(true);
    expect(tablas.get('telas_catalogo')?.has('descriptor')).toBe(true);
    expect(tablas.get('telas_catalogo')?.has('descripcion')).toBe(false);
    expect(tablas.get('movimientos_telas')?.has('metros')).toBe(true);
    expect(tablas.get('movimientos_telas')?.has('cantidad')).toBe(false);
  });

  it('hay consultas que revisar', () => {
    expect(fuentes.length).toBeGreaterThan(20);
    expect(fuentes.flatMap(consultasDe).length).toBeGreaterThan(10);
  });

  it('ninguna consulta pide, filtra ni ordena por una columna que no existe', () => {
    const errores: string[] = [];
    for (const archivo of fuentes) {
      for (const c of consultasDe(archivo)) {
        const cols = tablas.get(c.tabla);
        if (!cols) continue; // tabla todavía fuera de los tipos: va con `as any`
        for (const col of c.columnas) {
          if (col && col !== '*' && !cols.has(col)) {
            errores.push(`${c.archivo}:${c.linea} → ${c.tabla}.${col}`);
          }
        }
      }
    }
    expect(errores).toEqual([]);
  });
});
