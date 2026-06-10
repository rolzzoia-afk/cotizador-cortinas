// Re-genera el Excel de un plan de corte a partir de los datos guardados en
// `planes_corte` (columnas `resultados` y `ordenes`). Es un port directo de la
// función `exportarResultados()` del optimizador legacy (public/legacy/
// optimizador.html ~línea 6293) para que postventa pueda re-descargar el plan
// si el navegador se colgó durante la descarga original.

import * as XLSX from 'xlsx';

type ResultadoCorte = {
  colmena?: string | number | null;
  colmena_sobrante?: string | number | null;
  codigo?: string | null;
  codigo_original?: string | null;
  codigo_reemplazo?: string | null;
  color?: string | null;
  orden?: string | null;
  medida_cm?: number | null;
  medida_origen?: number | null;
  sobrante_cm?: number | null;
  es_intermedio?: boolean;
  es_desecho?: boolean;
  es_reemplazo_desde_colmena?: boolean;
  fuente?: string | null;
  nombreMaterialNuevo?: string | null;
  serial?:
    | { lote?: string; paquete?: string; serial?: string; fecha?: string | number }
    | string
    | null;
};

type OrdenLike = {
  id?: string;
  ot?: string | null;
  numero_ot?: string | null;
  ubic?: string | null;
  ubicacion?: string | null;
  cod?: string | null;
  componente?: string | null;
  con_tira?: string | null;
  lote?: string | null;
  paquete?: string | null;
  serial?:
    | { lote?: string; paquete?: string; serial?: string; fecha?: string | number }
    | string
    | null;
  fecha?: string | number | null;
};

type ResultadoItem = {
  resultado?: ResultadoCorte;
  orden?: OrdenLike | string | null;
} & ResultadoCorte;

export type PlanParaExportar = {
  fecha: string | null;
  resultados: ResultadoItem[];
  ordenes: OrdenLike[];
  /**
   * Número correlativo del plan dentro del orden de ejecución del taller.
   * Determinado por la fecha de entrega más próxima entre las OTs del plan.
   * 1 = primera prioridad (entrega más urgente). null = sin correlativo.
   */
  correlativo?: number | null;
};

// Formatea fecha tipo serial Excel (46083) o ISO string a "dd/mm/yyyy".
function formatearFecha(fecha: string | number | null | undefined): string {
  if (fecha == null || fecha === '') return '-';
  if (typeof fecha === 'number' && Number.isFinite(fecha)) {
    const d = new Date((fecha - 25569) * 86400 * 1000);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
  const s = String(fecha);
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
  return s;
}

function getR(item: ResultadoItem): ResultadoCorte {
  return (item.resultado ?? item) as ResultadoCorte;
}

function getOrd(item: ResultadoItem, ordenes: OrdenLike[]): OrdenLike {
  const raw = item.orden;
  if (raw && typeof raw === 'object') return raw as OrdenLike;
  const r = getR(item);
  const ordIdOrVal = (r.orden ?? (item.orden as string | null)) as string | null;
  return ordenes.find((o) => o.id === ordIdOrVal) || {};
}

export function exportarPlanComoExcel(plan: PlanParaExportar): void {
  const datosExcel: (string | number)[][] = [
    [
      'OT',
      'Ubicación',
      'Acción',
      'Colmena',
      'Código',
      'Color',
      'Medida a Cortar (cm)',
      'Tubo Origen (cm)',
      'Lote',
      'Paquete',
      'Serial',
      'Fecha Serial',
    ],
  ];

  plan.resultados.forEach((item) => {
    const res = getR(item);
    const ord = getOrd(item, plan.ordenes || []);

    const sRaw = res.serial || ord.serial;
    const s =
      sRaw && typeof sRaw === 'object'
        ? sRaw
        : ({} as { lote?: string; paquete?: string; serial?: string; fecha?: string | number });
    const fechaFormateada = s.fecha ? formatearFecha(s.fecha) : '-';
    const codigoReal = res.codigo || res.codigo_original || ord.cod || '-';
    const codigoExcel =
      res.codigo_original && res.codigo && res.codigo_original !== res.codigo
        ? `${res.codigo_original} → ${res.codigo}`
        : codigoReal;
    const color = res.color || '-';

    const _comp = ord.componente && ord.componente !== 'TUBO' ? ord.componente : '';
    const _esTuboNuevoReemplazo =
      res.fuente === 'reemplazo' &&
      !!res.codigo_original &&
      !!res.codigo &&
      res.codigo !== res.codigo_original &&
      !!res.codigo_reemplazo &&
      !res.es_reemplazo_desde_colmena;
    const _esTuboNuevo = res.fuente === 'tubo_nuevo';

    let accionCortar: string;
    if (_esTuboNuevoReemplazo) {
      accionCortar = `TUBO NUEVO (REEMPLAZO ${res.codigo_original} → ${res.codigo})`;
    } else if (_esTuboNuevo) {
      accionCortar = _comp ? `${_comp} NUEVO` : 'TUBO NUEVO';
    } else if (_comp) {
      accionCortar = `CORTAR ${_comp}`;
    } else {
      accionCortar = 'CORTAR';
    }
    const _conTira = String(ord.con_tira || '').toUpperCase().trim();
    if (
      (_conTira === 'CON TIRA' || _conTira === 'SI' || _conTira === 'SÍ' || _conTira === 'X') &&
      _comp === 'CENEFA OVALADA'
    ) {
      accionCortar += ' CON TIRA';
    }
    const _colmenaExcel =
      _esTuboNuevo || _esTuboNuevoReemplazo
        ? res.nombreMaterialNuevo || 'TUBO NUEVO'
        : (res.colmena ?? '-');

    datosExcel.push([
      ord.ot || '-',
      ord.ubic || '-',
      accionCortar,
      _colmenaExcel as string | number,
      codigoExcel,
      color,
      res.medida_cm ?? '-',
      res.medida_origen ?? '-',
      s.lote || '-',
      s.paquete || '-',
      s.serial || '-',
      fechaFormateada,
    ]);

    if ((res.sobrante_cm ?? 0) > 0) {
      // Defensa: sobrante ≤ 10 cm SIEMPRE es merma (espejo de MERMA_MAX_MM=100
      // del optimizador), aunque el plan guardado no traiga es_desecho.
      const esDesecho = !!res.es_desecho || (res.sobrante_cm ?? 0) <= 10;
      let accionSobrante: string;
      let colmenaDestino: string | number;
      if (res.es_intermedio) {
        accionSobrante = 'RESERVAR EN MESA';
        colmenaDestino = '-';
      } else if (esDesecho) {
        accionSobrante = 'DESECHAR MERMA';
        colmenaDestino = 'BASURERO';
      } else {
        accionSobrante = 'GUARDAR SOBRANTE';
        colmenaDestino = (res.colmena_sobrante ?? res.colmena ?? '-') as string | number;
      }

      datosExcel.push([
        ord.ot || '-',
        '',
        accionSobrante,
        colmenaDestino,
        codigoExcel,
        color,
        res.sobrante_cm ?? 0,
        '-',
        s.lote || ord.lote || '-',
        s.paquete || ord.paquete || '-',
        s.serial || (typeof ord.serial === 'string' ? ord.serial : '-') || '-',
        (s.fecha as string | number | undefined) ?? (ord.fecha as string | number | null) ?? '-',
      ]);
    }
  });

  // Reordenar grupos: RESERVAR EN MESA debe preceder al CORTAR(MESA) que lo consume.
  const ACCIONES_SOBRANTE = new Set(['RESERVAR EN MESA', 'GUARDAR SOBRANTE', 'DESECHAR MERMA']);
  const grupos: (string | number)[][][] = [];
  let idx = 1;
  while (idx < datosExcel.length) {
    const g: (string | number)[][] = [datosExcel[idx]];
    idx++;
    if (idx < datosExcel.length && ACCIONES_SOBRANTE.has(String(datosExcel[idx][2]))) {
      g.push(datosExcel[idx]);
      idx++;
    }
    grupos.push(g);
  }

  const productorDe = new Map<string, number>();
  grupos.forEach((g, gi) => {
    g.forEach((row) => {
      if (row[2] === 'RESERVAR EN MESA') {
        productorDe.set(`${row[4]}|${row[6]}`, gi);
      }
    });
  });

  let cambiado = true;
  while (cambiado) {
    cambiado = false;
    for (let ci = 0; ci < grupos.length; ci++) {
      const corte = grupos[ci][0];
      if (corte[3] !== 'MESA') continue;
      const clave = `${corte[4]}|${corte[7]}`;
      const pi = productorDe.get(clave);
      if (pi === undefined || pi <= ci) continue;
      const [productor] = grupos.splice(pi, 1);
      grupos.splice(ci, 0, productor);
      productorDe.forEach((oldIdx, k) => {
        if (oldIdx === pi) productorDe.set(k, ci);
        else if (oldIdx >= ci && oldIdx < pi) productorDe.set(k, oldIdx + 1);
      });
      cambiado = true;
      break;
    }
  }

  datosExcel.splice(1);
  grupos.forEach((g) => g.forEach((row) => datosExcel.push(row)));

  const ws = XLSX.utils.aoa_to_sheet(datosExcel);

  type StyledCell = XLSX.CellObject & {
    s?: { fill?: { fgColor: { rgb: string } }; font?: { color: { rgb: string }; bold: boolean } };
  };
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = 1; R <= range.e.r; ++R) {
    const accionCell = ws[XLSX.utils.encode_cell({ r: R, c: 2 })] as StyledCell | undefined;
    const colmenaCell = ws[XLSX.utils.encode_cell({ r: R, c: 3 })] as StyledCell | undefined;
    if (!accionCell) continue;
    let fillColor: string | null = null;
    let fontColor: string | null = null;
    if (accionCell.v === 'DESECHAR MERMA') {
      fillColor = 'FFFF9999';
      fontColor = 'FF990000';
    } else if (accionCell.v === 'RESERVAR EN MESA') {
      fillColor = 'FFFFF3E0';
      fontColor = 'FFE65100';
    } else if (colmenaCell && colmenaCell.v === 'MESA') {
      fillColor = 'FFE3F2FD';
      fontColor = 'FF0D47A1';
    } else if (typeof accionCell.v === 'string' && accionCell.v.includes('CON TIRA')) {
      fillColor = 'FFFFFF99';
      fontColor = 'FF886600';
    }
    if (fillColor && fontColor) {
      for (let C = 0; C <= range.e.c; ++C) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })] as StyledCell | undefined;
        if (cell) {
          if (!cell.s) cell.s = {};
          cell.s.fill = { fgColor: { rgb: fillColor } };
          cell.s.font = { color: { rgb: fontColor }, bold: true };
        }
      }
    }
  }

  // Footer del documento: CORRELATIVO N en una celda destacada al final.
  // Sigue el patrón del template del jefe (ver screenshot del usuario): celda
  // grande con fondo y borde para que el taller la vea de un vistazo.
  if (plan.correlativo != null) {
    const lastRow = XLSX.utils.decode_range(ws['!ref'] || 'A1').e.r;
    const corrRow = lastRow + 3; // 2 filas vacías + 1 fila para el correlativo
    const corrCellAddr = XLSX.utils.encode_cell({ r: corrRow, c: 1 });
    ws[corrCellAddr] = {
      t: 's',
      v: `CORRELATIVO ${plan.correlativo}`,
      s: {
        fill: { fgColor: { rgb: 'FF1F1F2E' } },
        font: { color: { rgb: 'FFFFFFFF' }, bold: true, sz: 14 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'medium', color: { rgb: 'FF000000' } },
          bottom: { style: 'medium', color: { rgb: 'FF000000' } },
          left: { style: 'medium', color: { rgb: 'FF000000' } },
          right: { style: 'medium', color: { rgb: 'FF000000' } },
        },
      },
    } as XLSX.CellObject & {
      s: {
        fill: { fgColor: { rgb: string } };
        font: { color: { rgb: string }; bold: boolean; sz: number };
        alignment: { horizontal: string; vertical: string };
        border: Record<string, { style: string; color: { rgb: string } }>;
      };
    };
    // Merge celdas B-G del correlativo para que sea ancho/visible
    const merges = (ws['!merges'] as XLSX.Range[] | undefined) || [];
    merges.push({ s: { r: corrRow, c: 1 }, e: { r: corrRow, c: 6 } });
    ws['!merges'] = merges;
    // Set alto de la fila para que se vea destacado
    const rows = (ws['!rows'] as XLSX.RowInfo[] | undefined) || [];
    rows[corrRow] = { hpt: 30 };
    ws['!rows'] = rows;
    // Extender el rango del worksheet
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: corrRow, c: range.e.c } });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plan de Corte');

  const fechaPlan = plan.fecha ? new Date(plan.fecha) : new Date();
  const yyyy = fechaPlan.getFullYear();
  const mm = String(fechaPlan.getMonth() + 1).padStart(2, '0');
  const dd = String(fechaPlan.getDate()).padStart(2, '0');
  const corrSuffix = plan.correlativo != null ? `_corr-${plan.correlativo}` : '';
  XLSX.writeFile(wb, `plan_corte${corrSuffix}_${yyyy}-${mm}-${dd}.xlsx`);
}