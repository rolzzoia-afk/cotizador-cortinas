import { describe, it, expect } from 'vitest';
import {
  MAX_RESPALDOS,
  agregarRespaldo,
  agruparPorSistema,
  duplicarFila,
  etiquetaRespaldo,
  filaNueva,
  filaParaGuardar,
  normalizarRespaldos,
  validarFila,
  type FilaCatalogo,
  type RespaldoCatalogo,
} from './catalogoEdicionModelos';

const fila = (over: Partial<FilaCatalogo> = {}): FilaCatalogo => ({
  ...filaNueva('ROLLER_SIMPLE'),
  tipo_rol: 'ROL_SIMPLE',
  mecanismo: 'MEC_05_LZ90_BLANCO',
  diametro_tubo_mm: 38,
  dcto_tubo_cm: 3.8,
  ancho_max_m: 3,
  ...over,
});

describe('filaNueva / duplicarFila', () => {
  it('la fila nueva nace manual y activa, con todo en cero', () => {
    const f = filaNueva('DARK_ROLLER');
    expect(f.sistema).toBe('DARK_ROLLER');
    expect(f.origen).toBe('manual');
    expect(f.activo).toBe(true);
    expect(f.dcto_tubo_cm).toBe(0);
    expect(f.ancho_max_m).toBe(0);
  });

  it('duplicar suelta el id (si no, el upsert pisaría el original) y marca la copia', () => {
    const original = fila({ id: 'uuid-1', origen: 'excel' });
    const copia = duplicarFila(original);
    expect(copia.id).toBeUndefined();
    expect(copia.tipo_rol).toBe('ROL_SIMPLE (copia)');
    expect(copia.origen).toBe('manual');
    expect(copia.dcto_tubo_cm).toBe(3.8); // el resto viaja igual
  });
});

describe('validarFila', () => {
  it('acepta una fila bien formada', () => {
    expect(validarFila(fila())).toEqual([]);
  });

  it('exige sistema y tipo de rol', () => {
    const errores = validarFila(fila({ sistema: '  ', tipo_rol: '' }));
    expect(errores).toHaveLength(2);
    expect(errores[0]).toContain('sistema');
    expect(errores[1]).toContain('tipo de rol');
  });

  it('rechaza números negativos y no numéricos', () => {
    const errores = validarFila(fila({ dcto_tubo_cm: -1, ancho_max_m: NaN }));
    expect(errores.some((e) => e.includes('Dcto. tubo') && e.includes('negativo'))).toBe(true);
    expect(errores.some((e) => e.includes('Ancho máximo') && e.includes('número'))).toBe(true);
  });

  it('avisa cuando el diámetro parece venir en centímetros', () => {
    const errores = validarFila(fila({ diametro_tubo_mm: 3.8 }));
    expect(errores.some((e) => e.includes('milímetros'))).toBe(true);
  });

  it('avisa cuando el ancho máximo parece venir en centímetros', () => {
    const errores = validarFila(fila({ ancho_max_m: 300 }));
    expect(errores.some((e) => e.includes('metros'))).toBe(true);
  });

  it('detecta clave duplicada contra otra fila (el motor elegiría cualquiera)', () => {
    const existente = fila({ id: 'uuid-1' });
    const nueva = fila({ id: 'uuid-2' });
    const errores = validarFila(nueva, [existente, nueva]);
    expect(errores).toHaveLength(1);
    expect(errores[0]).toContain('ROLLER_SIMPLE|ROL_SIMPLE|MEC_05_LZ90_BLANCO');
  });

  it('no se acusa a sí misma de duplicada al editarse', () => {
    const f = fila({ id: 'uuid-1' });
    expect(validarFila(f, [f])).toEqual([]);
  });

  it('el mecanismo distinto ya no es duplicado', () => {
    const a = fila({ id: 'uuid-1' });
    const b = fila({ id: 'uuid-2', mecanismo: 'MEC_06_LZ50_BLANCO' });
    expect(validarFila(b, [a, b])).toEqual([]);
  });
});

describe('filaParaGuardar', () => {
  it('recorta los textos y fuerza origen manual (la app manda sobre el Excel)', () => {
    const g = filaParaGuardar(fila({ sistema: ' ROLLER_SIMPLE ', notas: 'x', origen: 'excel' }));
    expect(g.sistema).toBe('ROLLER_SIMPLE');
    expect(g.origen).toBe('manual');
    expect(g.notas).toBe('x');
  });

  it('no manda el id (va en el filtro del upsert, no en el payload)', () => {
    expect(filaParaGuardar(fila({ id: 'uuid-1' }))).not.toHaveProperty('id');
  });
});

describe('agruparPorSistema', () => {
  it('agrupa alfabéticamente y ordena por tipo y mecanismo dentro del grupo', () => {
    const grupos = agruparPorSistema([
      fila({ sistema: 'VERTICAL', tipo_rol: 'VERTICAL_LAMAS_89', mecanismo: '' }),
      fila({ sistema: 'DARK_ROLLER', tipo_rol: 'DARK_45', mecanismo: 'B' }),
      fila({ sistema: 'DARK_ROLLER', tipo_rol: 'DARK_38', mecanismo: 'A' }),
    ]);
    expect(grupos.map((g) => g.sistema)).toEqual(['DARK_ROLLER', 'VERTICAL']);
    expect(grupos[0].filas.map((f) => f.tipo_rol)).toEqual(['DARK_38', 'DARK_45']);
  });

  it('las filas sin sistema caen en un grupo propio y no se pierden', () => {
    const grupos = agruparPorSistema([fila({ sistema: '' })]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].sistema).toBe('(sin sistema)');
  });
});

describe('respaldos', () => {
  const r = (fecha: string): RespaldoCatalogo => ({ fecha, motivo: 'edición', filas: [fila()] });

  it('el más nuevo queda primero', () => {
    const lista = agregarRespaldo([r('2026-08-01T10:00:00Z')], r('2026-08-04T10:00:00Z'));
    expect(lista[0].fecha).toBe('2026-08-04T10:00:00Z');
    expect(lista).toHaveLength(2);
  });

  it(`recorta a los ${MAX_RESPALDOS} más nuevos (si no, la clave crecería sin fin)`, () => {
    const total = MAX_RESPALDOS + 5;
    let lista: RespaldoCatalogo[] = [];
    for (let i = 0; i < total; i++) lista = agregarRespaldo(lista, r(`respaldo-${i}`));
    expect(lista).toHaveLength(MAX_RESPALDOS);
    expect(lista[0].fecha).toBe(`respaldo-${total - 1}`); // el último que entró
    expect(lista.at(-1)?.fecha).toBe(`respaldo-${total - MAX_RESPALDOS}`); // los viejos se cayeron
  });

  it('normalizar tolera basura y descarta lo que no tiene forma de respaldo', () => {
    const lista = normalizarRespaldos([
      r('2026-08-04T10:00:00Z'),
      null,
      { fecha: 123, filas: [] },
      { fecha: '2026-08-03T10:00:00Z' }, // sin filas
      'texto',
    ]);
    expect(lista).toHaveLength(1);
    expect(lista[0].fecha).toBe('2026-08-04T10:00:00Z');
  });

  it('normalizar de algo que no es lista devuelve vacío', () => {
    expect(normalizarRespaldos(null)).toEqual([]);
    expect(normalizarRespaldos({ fecha: 'x' })).toEqual([]);
  });

  it('la etiqueta muestra cuántos modelos tenía y el motivo', () => {
    const e = etiquetaRespaldo(r('2026-08-04T13:00:00Z'));
    expect(e).toContain('1 modelos');
    expect(e).toContain('edición');
  });

  it('una fecha ilegible se muestra tal cual, sin romper', () => {
    expect(etiquetaRespaldo({ fecha: 'ayer', motivo: '', filas: [] })).toContain('ayer');
  });
});
