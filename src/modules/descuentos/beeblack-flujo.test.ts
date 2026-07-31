// Flujo BEEBLACK de punta a punta (pizarra 2026-07-29): despiece → Cálculo
// General / Dimensionado → mesa de tela. La hoja de ESTRUCTURA se cubre en
// excel-ordenes.test.ts y las fórmulas en reglas-beeblack.test.ts.
import { describe, expect, it } from 'vitest';
import {
  aplicarVariante,
  construirCalculoGeneral,
  VARIANTE_DIMENSIONADO,
} from '@/modules/cotizador/pdfCalculoGeneral';
import { buildOptimizerRows } from '@/modules/cotizador/tela';
import { tipoCortinaEtiquetaGrupo } from '@/modules/cotizador/pdfEtiquetasBrother';
import type { Pano, Ventana } from '@/modules/cotizador/types';

// BEEBLACK INTERNO 200 × 130 → perfiles 194,3 · laterales 124,3 · manilla 125 ·
// tela 195,3 × 126,8 · lamas ceil(200/1,5 + 10) = 144.
function ventanaBb(extra: Partial<Pano> = {}, panos?: Pano[]): Ventana {
  return {
    id: 'bb1',
    ubicacion: 'LIVING',
    codInt: 'SC 64',
    producto: 'BEEBLACK BLACKOUT',
    tipo: '',
    color: 'NEGRO',
    alto: 1.3,
    precio: 0,
    cantidad: 1,
    categoria: 'BEEBLACK',
    sentido: 'INTERNO',
    grupoId: null,
    modelo: null,
    panos: panos ?? [
      {
        ancho: 2,
        alto: 1.3,
        color: 'NEGRO',
        beeblackVariante: 'INTERNO',
        beeblackManillaIzq: true,
        ...extra,
      } as Pano,
    ],
  } as unknown as Ventana;
}

describe('BEEBLACK — Cálculo General', () => {
  const data = construirCalculoGeneral([ventanaBb({ separadorSup: true })]);
  const bloque = data.bloques.find((b) => b.sistema.key === 'BEEBLACK')!;
  const labels = bloque.columnas.map((c) => c.label);
  const fila = data.filas[0];

  it('usa su bloque propio con los 4 perfiles, la manilla, la tela y las lamas', () => {
    expect(bloque).toBeTruthy();
    expect(labels).toContain('PERFIL SUPERIOR (ANCHO)');
    expect(labels).toContain('PERFIL INFERIOR (ANCHO)');
    expect(labels).toContain('PERFIL LATERAL IZQ (ALTO)');
    expect(labels).toContain('MANILLA IZQ (ALTO)');
    expect(labels).toContain('ANCHO TELA');
    expect(labels).toContain('ALTO TELA');
    expect(labels).toContain('TOTAL LAMAS');
    expect(fila.despiece.get('PERFIL SUPERIOR (ANCHO)')).toBe(194.3);
    expect(fila.despiece.get('TOTAL LAMAS')).toBe(144);
  });

  it('el perfil inferior NO cae en la columna PERFIL BASE de la oscuridad', () => {
    expect(labels).not.toContain('PERFIL BASE');
    expect(fila.despiece.get('PERFIL INFERIOR (ANCHO)')).toBe(194.3);
  });

  it('cierra con la variante y su instalación en TIPO DE BEEBLACK', () => {
    expect(fila.despiece.get('TIPO DE BEEBLACK')).toBe('INTERNO — DENTRO DEL MARCO');
    expect(labels[labels.length - 1]).toBe('TIPO DE BEEBLACK');
  });

  it('el Dimensionado deja solo la tela y las lamas', () => {
    const dim = aplicarVariante(data, VARIANTE_DIMENSIONADO).bloques.find(
      (b) => b.sistema.key === 'BEEBLACK',
    );
    const dimLabels = (dim?.columnas ?? []).map((c) => c.label);
    expect(dimLabels).toContain('ANCHO TELA');
    expect(dimLabels).toContain('ALTO TELA');
    expect(dimLabels).toContain('TOTAL LAMAS');
    expect(dimLabels.some((l) => l.startsWith('PERFIL'))).toBe(false);
    expect(dimLabels.some((l) => l.startsWith('MANILLA'))).toBe(false);
    expect(dimLabels.some((l) => l.startsWith('SEPARADOR'))).toBe(false);
  });
});

describe('BEEBLACK — mesa de tela', () => {
  const rows = buildOptimizerRows([ventanaBb()], {});

  it('corta con las medidas de la variante, no con las del roller', () => {
    // Roller sería ancho − 3,5 = 196,5 y alto + 25 = 155; beeblack: 195,3 × 126,8.
    expect(rows[0].anchoCorteTelaCm).toBe(195.3);
    expect(Math.round(rows[0].altoCorte * 1000) / 1000).toBe(1.268);
    expect(Math.round(rows[0].altoReal * 1000) / 1000).toBe(1.268);
  });

  it('la fila trae sus piezas aunque no haya modelo de fabricación', () => {
    const comps = (rows[0].piezas || []).map((p) => p.componente);
    expect(comps).toContain('Perfil superior (ancho)');
    expect(comps).toContain('Total lamas');
  });
});

describe('BEEBLACK — etiquetas', () => {
  it('el TIPO DE CORTINA del paño dice BEE-BLACK', () => {
    const rows = buildOptimizerRows([ventanaBb()], {});
    expect(tipoCortinaEtiquetaGrupo(rows)).toBe('BEE-BLACK');
  });
});

// Cierre DE ARRIBA ABAJO (decisión 2026-07-30): la cortina va girada 90°, así
// que ancho y alto cambian de papel en todas las fórmulas de la pizarra.
describe('BEEBLACK — cierre vertical (DE ARRIBA ABAJO)', () => {
  const v = ventanaBb();
  (v as unknown as { direccion: string }).direccion = 'DE ARRIBA ABAJO';
  const rows = buildOptimizerRows([v], {});
  const pieza = (nombre: string) =>
    (rows[0].piezas || []).find((p) => p.componente === nombre)?.medidaCm;

  it('las lamas se cuentan sobre el ALTO', () => {
    // 200 × 130 INTERNO: de lado sería ceil(200/1,5 + 10) = 144; girada,
    // ceil(130/1,5 + 10) = 97.
    expect(pieza('Total lamas')).toBe(97);
  });

  it('el corte de tela intercambia ancho y alto', () => {
    // ancho tela = alto − 4,7 = 125,3 · alto tela = ancho − 3,2 = 196,8
    expect(pieza('Ancho tela')).toBe(125.3);
    expect(pieza('Alto tela')).toBe(196.8);
    expect(rows[0].anchoCorteTelaCm).toBe(125.3);
    expect(Math.round(rows[0].altoCorte * 1000) / 1000).toBe(1.968);
  });

  it('los perfiles intercambian medidas (se cortan las mismas 4 barras)', () => {
    expect(pieza('Perfil superior (ancho)')).toBe(124.3); // 130 − 5,7
    expect(pieza('Perfil lateral izq (alto)')).toBe(194.3); // 200 − 5,7
  });

  it('un cierre de lado NO invierte nada', () => {
    const vLado = ventanaBb();
    (vLado as unknown as { direccion: string }).direccion = 'IZQUIERDA-DERECHA';
    const p = buildOptimizerRows([vLado], {})[0].piezas || [];
    expect(p.find((x) => x.componente === 'Total lamas')?.medidaCm).toBe(144);
  });
});

// Tipo de instalación (pizarra 2026-07-30): se elige en Fase 2 y solo EXTERNO
// tiene dos, porque "fuera del marco" alarga los laterales 1 cm.
describe('BEEBLACK — tipo de instalación', () => {
  const data = construirCalculoGeneral([
    ventanaBb({ beeblackVariante: 'EXTERNO', beeblackInstalacion: 'FUERA_DEL_MARCO' }),
  ]);
  const fila = data.filas[0];

  it('EXTERNO fuera del marco llega con sus laterales al Cálculo General', () => {
    expect(fila.despiece.get('PERFIL LATERAL IZQ (ALTO)')).toBe(132); // 130 + 2
    expect(fila.despiece.get('PERFIL LATERAL DER (ALTO)')).toBe(132);
    // El resto sigue con la fórmula de EXTERNO.
    expect(fila.despiece.get('PERFIL SUPERIOR (ANCHO)')).toBe(201);
    expect(fila.despiece.get('TOTAL LAMAS')).toBe(140);
  });

  it('la instalación viaja junto a la variante', () => {
    expect(fila.despiece.get('TIPO DE BEEBLACK')).toBe('EXTERNO — FUERA DEL MARCO');
  });

  it('sin instalación elegida, EXTERNO cae en techo a muro', () => {
    const sinInst = construirCalculoGeneral([ventanaBb({ beeblackVariante: 'EXTERNO' })]).filas[0];
    expect(sinInst.despiece.get('PERFIL LATERAL IZQ (ALTO)')).toBe(131); // 130 + 1
    expect(sinInst.despiece.get('TIPO DE BEEBLACK')).toBe('EXTERNO — TECHO A MURO');
  });
});
