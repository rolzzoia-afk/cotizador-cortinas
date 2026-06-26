// ─────────────────────────────────────────────────────────────────────
// Parser del Excel "DESCUENTOS ROLLER CATALOGO".
//
// Regla de fusión (acordada 2026-06-12):
// · La hoja "DESCUENTOS ROLLER" (maestra) manda para TODOS los sistemas
//   excepto CENEFA_OVALADA_DUO.
// · CENEFA_OVALADA_DUO se toma de la hoja "DESCUENTOS CENEFA ROLLER Y
//   DUO", que trae peso_interno/peso_u y más variantes de mecanismo.
// Lógica pura (sin React/Supabase) para poder testearla.
// ─────────────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx';

export type FilaDescuento = {
  sistema: string;
  tipo_rol: string;
  mecanismo: string;
  codigos_tubo: string;
  diametro_tubo_mm: number;
  dcto_tubo_cm: number;
  dcto_tela_cm: number;
  suma_peso_cm: number;
  dcto_cenefa_cm: number;
  dcto_cenefa_del_cm: number;
  dcto_cenefa_tra_cm: number;
  dcto_perfiles_cm: number;
  peso_interno_duo_cm: number;
  peso_u_duo_cm: number;
  ancho_max_m: number;
  activo: boolean;
  notas: string;
};

export type ResultadoParseo = {
  filas: FilaDescuento[];
  errores: string[];
  sistemas: string[];
};

const HOJA_MAESTRA = 'DESCUENTOS ROLLER';
const HOJA_CENEFAS = 'DESCUENTOS CENEFA ROLLER Y DUO';

function num(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function texto(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

function bool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toUpperCase();
  return s === 'TRUE' || s === 'VERDADERO' || s === '1' || s === 'SI' || s === 'SÍ';
}

/** Parsea el workbook completo aplicando la regla de fusión. */
export function parsearCatalogoDescuentos(wb: XLSX.WorkBook): ResultadoParseo {
  const errores: string[] = [];
  const filas: FilaDescuento[] = [];

  const ws1 = wb.Sheets[HOJA_MAESTRA];
  if (!ws1) {
    return { filas: [], errores: [`Falta la hoja "${HOJA_MAESTRA}".`], sistemas: [] };
  }
  // header en fila 3 (índice 2); datos desde fila 4
  const m1 = XLSX.utils.sheet_to_json<unknown[]>(ws1, { header: 1, defval: null }) as unknown[][];
  for (let i = 3; i < m1.length; i++) {
    const r = m1[i];
    const sistema = texto(r?.[0]);
    if (!sistema) continue;
    if (sistema === 'CENEFA_OVALADA_DUO') continue; // viene de la hoja de cenefas
    const fila: FilaDescuento = {
      sistema,
      tipo_rol: texto(r[1]),
      mecanismo: texto(r[2]),
      codigos_tubo: texto(r[3]),
      diametro_tubo_mm: num(r[4]),
      dcto_tubo_cm: num(r[5]),
      dcto_tela_cm: num(r[6]),
      suma_peso_cm: num(r[7]),
      dcto_cenefa_cm: num(r[8]),
      dcto_cenefa_del_cm: num(r[9]),
      dcto_cenefa_tra_cm: num(r[10]),
      dcto_perfiles_cm: num(r[11]),
      peso_interno_duo_cm: 0,
      peso_u_duo_cm: 0,
      ancho_max_m: num(r[12]),
      activo: bool(r[13]),
      notas: texto(r[14]),
    };
    validar(fila, `${HOJA_MAESTRA} fila ${i + 1}`, errores);
    filas.push(fila);
  }

  const ws2 = wb.Sheets[HOJA_CENEFAS];
  if (ws2) {
    const m2 = XLSX.utils.sheet_to_json<unknown[]>(ws2, { header: 1, defval: null }) as unknown[][];
    for (let i = 3; i < m2.length; i++) {
      const r = m2[i];
      if (texto(r?.[0]) !== 'CENEFA_OVALADA_DUO') continue;
      const fila: FilaDescuento = {
        sistema: 'CENEFA_OVALADA_DUO',
        tipo_rol: texto(r[1]),
        mecanismo: texto(r[2]),
        codigos_tubo: texto(r[3]),
        diametro_tubo_mm: num(r[4]),
        dcto_cenefa_cm: num(r[5]),
        dcto_tubo_cm: num(r[6]),
        dcto_tela_cm: num(r[7]),
        suma_peso_cm: num(r[8]),
        dcto_cenefa_del_cm: 0,
        dcto_cenefa_tra_cm: 0,
        dcto_perfiles_cm: 0,
        peso_interno_duo_cm: num(r[9]),
        peso_u_duo_cm: num(r[10]),
        ancho_max_m: num(r[11]),
        activo: bool(r[12]),
        notas: texto(r[13]),
      };
      validar(fila, `${HOJA_CENEFAS} fila ${i + 1}`, errores);
      filas.push(fila);
    }
  } else {
    errores.push(`Falta la hoja "${HOJA_CENEFAS}" (los modelos DÚO no se importarán).`);
  }

  // Duplicados por clave (sistema + tipo_rol + mecanismo)
  const vistos = new Set<string>();
  for (const f of filas) {
    const k = `${f.sistema}|${f.tipo_rol}|${f.mecanismo}`;
    if (vistos.has(k)) errores.push(`Modelo duplicado: ${k}`);
    vistos.add(k);
  }

  return { filas, errores, sistemas: [...new Set(filas.map((f) => f.sistema))].sort() };
}

function validar(f: FilaDescuento, donde: string, errores: string[]) {
  if (!f.tipo_rol) errores.push(`${donde}: tipo_rol vacío.`);
  const numericos: Array<[string, number]> = [
    ['diametro_tubo_mm', f.diametro_tubo_mm],
    ['dcto_tubo_cm', f.dcto_tubo_cm],
    ['dcto_tela_cm', f.dcto_tela_cm],
    ['suma_peso_cm', f.suma_peso_cm],
    ['dcto_cenefa_cm', f.dcto_cenefa_cm],
    ['ancho_max_m', f.ancho_max_m],
  ];
  for (const [nombre, v] of numericos) {
    if (Number.isNaN(v)) errores.push(`${donde}: ${nombre} no es un número.`);
    else if (v < 0) errores.push(`${donde}: ${nombre} negativo.`);
  }
  if (f.activo && f.ancho_max_m <= 0) {
    errores.push(`${donde}: modelo activo sin ancho_max_m.`);
  }
}
