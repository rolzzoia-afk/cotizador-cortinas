// ─────────────────────────────────────────────────────────────────────
// Exportación del plan de corte a Excel — "hoja del cortador".
//
// Replica el formato de la planilla manual (ejemplo1-1): una fila por
// PAÑO que se corta del rollo (agrupando las cortinas que se cortan
// JUNTAS), más una fila por cada pieza que sale de un SOBRANTE de la
// colmena. La columna ORIGEN distingue rollo vs. colmena.
//
// Fuentes de datos:
//  · Optimizador de paños (tela.ts) → letra "SE CORTA JUNTO" + alto de corte.
//  · Plan de Corte desde Colmena (planCorte.ts) → de dónde sale cada pieza
//    (rollo / sobrante / sin stock), por OT.
//
// El cruce pieza↔origen se hace por el id `${otId}_${ventanaId}_p${panoIndex}`,
// idéntico al que arma generarPlanCorte().
//
// Lógica pura (sin React) salvo `descargarCorteXlsx`, que toca el DOM.
// ─────────────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx';
import type { OptimizerRow } from './tela';
import { generarPlanCorte, type PanoColmena } from './planCorte';
import type { OT } from '@/modules/ots/types';

export type OrigenCorte = 'ROLLO' | 'COLMENA' | 'SIN STOCK';

export type FilaCorte = {
  ot: string;
  cliente: string;
  panos: number | ''; // n.º de paño (solo rollo)
  tipo: string; // producto, ej. "ROLLER BLACKOUT DELUX"
  cod: string; // codInt, ej. "BK 69"
  altoCortePano: number; // metros, ej. 1.85
  seCortaJunto: string; // letra del paño (rollo); vacío para colmena
  origen: string; // "ROLLO" | "COLMENA 133x200" | "SIN STOCK"
};

// Cada OT a exportar con sus filas ya optimizadas (junto/numeroPano asignados).
export type OTParaCorte = { ot: OT; rows: OptimizerRow[] };

const pieceId = (otId: string | number, ventanaId: string | number, panoIndex: number) =>
  `${otId}_${ventanaId}_p${panoIndex}`;

// Alto de corte del paño en metros, igual a la columna "Alto corte" del
// optimizador (altoCm + 25 cm). Tomamos el mayor del grupo por seguridad.
const altoCorteM = (altoCm: number) => parseFloat(((altoCm + 25) / 100).toFixed(2));

/**
 * Construye las filas de la hoja del cortador para las OTs dadas.
 * Usa el Plan de Corte (rollo vs. sobrante) para etiquetar el origen y
 * agrupar; si no hay datos de colmena, todo se trata como rollo.
 */
export function construirFilasCorte(
  otsParaCorte: OTParaCorte[],
  colmenaPanos: PanoColmena[],
): FilaCorte[] {
  // Origen por pieza, calculado sobre TODAS las OTs juntas (igual que el
  // plan combinado de la app) para que el reparto de sobrantes sea el real.
  const plan = generarPlanCorte(
    otsParaCorte.map((o) => o.ot),
    colmenaPanos,
  );
  const origenDe = new Map<string, string>();
  for (const g of plan.sobrantes) {
    const medida = `COLMENA ${Math.round(g.sobrante.ancho)}x${Math.round(g.sobrante.alto)}`;
    for (const pz of g.placed) if (!pz.failed) origenDe.set(pz.id, medida);
  }
  for (const g of plan.rollo) for (const pz of g.placed) if (!pz.failed) origenDe.set(pz.id, 'ROLLO');
  for (const g of plan.sinStock) for (const pz of g.piezas) origenDe.set(pz.id, 'SIN STOCK');

  const filas: FilaCorte[] = [];

  for (const { ot, rows } of otsParaCorte) {
    const otNum = ot.datosGenerales?.ot || String(ot.id);
    const cliente = ot.datosGenerales?.cliente || '';

    // Particiona las filas según el origen que decidió el plan.
    const rolloPorJunto = new Map<string, OptimizerRow[]>();
    const otras: { row: OptimizerRow; origen: string }[] = [];
    for (const r of rows) {
      const origen = origenDe.get(pieceId(ot.id, r.ventanaId, r.panoIndex)) ?? 'ROLLO';
      if (origen === 'ROLLO') {
        const key = r.junto || '·';
        if (!rolloPorJunto.has(key)) rolloPorJunto.set(key, []);
        rolloPorJunto.get(key)!.push(r);
      } else {
        otras.push({ row: r, origen });
      }
    }

    // Una fila por paño de rollo (cortinas que se cortan juntas).
    let nPano = 0;
    for (const [junto, grupo] of rolloPorJunto) {
      nPano++;
      const ref = grupo[0];
      const altoMax = Math.max(...grupo.map((g) => g.altoCm));
      filas.push({
        ot: otNum,
        cliente,
        panos: nPano,
        tipo: ref.producto,
        cod: ref.codInt,
        altoCortePano: altoCorteM(altoMax),
        seCortaJunto: junto === '·' ? '' : junto,
        origen: 'ROLLO',
      });
    }

    // Una fila por pieza que sale de sobrante / sin stock.
    for (const { row, origen } of otras) {
      filas.push({
        ot: otNum,
        cliente,
        panos: '',
        tipo: row.producto,
        cod: row.codInt,
        altoCortePano: altoCorteM(row.altoCm),
        seCortaJunto: '',
        origen,
      });
    }
  }

  return filas;
}

const CABECERAS = [
  'OT',
  'CLIENTE',
  'PAÑOS',
  'TIPO',
  'COD',
  'ALTO CORTE PAÑO',
  'SE CORTA JUNTO',
  'ORIGEN',
];

/** Arma el workbook de la hoja del cortador a partir de las filas. */
export function corteToWorkbook(filas: FilaCorte[]): XLSX.WorkBook {
  const aoa: (string | number)[][] = [
    CABECERAS,
    ...filas.map((f) => [
      f.ot,
      f.cliente,
      f.panos,
      f.tipo,
      f.cod,
      f.altoCortePano,
      f.seCortaJunto,
      f.origen,
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Corte');
  return wb;
}

/** Construye y descarga la hoja del cortador (.xlsx) en el navegador. */
export function descargarCorteXlsx(filas: FilaCorte[], nombreArchivo: string): void {
  const wb = corteToWorkbook(filas);
  XLSX.writeFile(wb, nombreArchivo);
}
