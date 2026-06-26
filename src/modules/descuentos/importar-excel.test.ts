import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parsearCatalogoDescuentos } from './importar-excel';

const HEADER = ['sistema','tipo_rol','mecanismo','aplicacion','diametro_tubo_mm','dcto_tubo_cm','dcto_tela_cm','suma_peso_cm','dcto_cenefa_cm','dcto_cenefa_del_cm','dcto_cenefa_tra_cm','dcto_perfiles_cm','ancho_max_m','activo','notas'];
const HEADER_CEN = ['sistema','tipo_rol','mecanismo','aplicacion','diametro_tubo_mm','dcto_cenefa_cm','dcto_tubo_cm','dcto_tela_cm','suma_peso_cm','peso_interno_duo','peso_u_duo','ancho_max_m','activo','notas'];

function libro(filasMaestra: unknown[][], filasCenefa: unknown[][] = []) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([['titulo'], ['aviso'], HEADER, ...filasMaestra]),
    'DESCUENTOS ROLLER',
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([[''], HEADER_CEN, [''], ...filasCenefa]),
    'DESCUENTOS CENEFA ROLLER Y DUO',
  );
  return wb;
}

describe('parsearCatalogoDescuentos', () => {
  it('lee la hoja maestra (ej. real: MEC_05, ancho 200 → tubo 196.2)', () => {
    const wb = libro([
      ['ROLLER_SIMPLE','ROL_SIMPLE','MEC_05_LZ90_BLANCO','E01; E02',38,3.8,0.5,0.1,0,0,0,0,2.2,'TRUE',''],
    ]);
    const r = parsearCatalogoDescuentos(wb);
    expect(r.errores).toEqual([]);
    expect(r.filas).toHaveLength(1);
    const f = r.filas[0];
    expect(f.dcto_tubo_cm).toBe(3.8);
    expect(f.activo).toBe(true);
    expect(200 - f.dcto_tubo_cm).toBeCloseTo(196.2, 5); // corte de tubo
  });

  it('los DUO salen de la hoja de cenefas con sus pesos', () => {
    const wb = libro(
      [['CENEFA_OVALADA_DUO','DUO_X','MEC_09','E01',38,9.9,9.9,9.9,9.9,0,0,0,2.5,'TRUE','IGNORAR']],
      [['CENEFA_OVALADA_DUO','DUO_X','MEC_09','E01',38,1.5,1.8,0.5,'',0.2,0.3,2.5,'TRUE','']],
    );
    const r = parsearCatalogoDescuentos(wb);
    expect(r.filas).toHaveLength(1); // la fila DUO de la maestra se ignora
    const f = r.filas[0];
    expect(f.dcto_tubo_cm).toBe(1.8); // de la hoja de cenefas, no 9.9
    expect(f.peso_interno_duo_cm).toBe(0.2);
    expect(f.peso_u_duo_cm).toBe(0.3);
  });

  it('detecta duplicados y modelos activos sin ancho_max', () => {
    const wb = libro([
      ['ROLLER_SIMPLE','ROL_SIMPLE','MEC_05','E01',38,3.8,0.5,0.1,0,0,0,0,2.2,'TRUE',''],
      ['ROLLER_SIMPLE','ROL_SIMPLE','MEC_05','E01',38,3.8,0.5,0.1,0,0,0,0,2.2,'TRUE',''],
      ['ROLLER_SIMPLE','ROL_OTRO','MEC_06','E01',38,3.8,0.5,0.1,0,0,0,0,'','TRUE',''],
    ]);
    const r = parsearCatalogoDescuentos(wb);
    expect(r.errores.some((e) => e.includes('duplicado'))).toBe(true);
    expect(r.errores.some((e) => e.includes('sin ancho_max'))).toBe(true);
  });

  it('falla claro si no está la hoja maestra', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'OTRA');
    const r = parsearCatalogoDescuentos(wb);
    expect(r.filas).toHaveLength(0);
    expect(r.errores[0]).toContain('DESCUENTOS ROLLER');
  });
});
