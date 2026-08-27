// ─────────────────────────────────────────────────────────────────────
// Las FILAS del plan de corte, sin Excel de por medio.
//
// Vivían dentro de `exportar-excel.ts`, que las escupía directo a una hoja
// XLSX. El módulo Producción necesita exactamente las mismas filas —mismo
// orden, mismas acciones, mismos colores— pero en pantalla, así que se
// extrajeron acá. Es un puerto 1:1: si esto cambia, el Excel del taller
// cambia con ello, y ese Excel es el papel que se corta.
//
// A propósito SIN `import * as XLSX`: este módulo lo carga la pantalla de
// producción y xlsx pesa 400 KB.
// ─────────────────────────────────────────────────────────────────────

export type ResultadoCorte = {
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

export type OrdenLike = {
  id?: string;
  ot?: string | null;
  numero_ot?: string | null;
  ubic?: string | null;
  ubicacion?: string | null;
  cod?: string | null;
  componente?: string | null;
  con_tira?: string | null;
  /** Perforación del perfil zócalo (INTERNO/EXTERNO) — v5.22 del optimizador. */
  perforacion?: string | null;
  lote?: string | null;
  paquete?: string | null;
  serial?:
    | { lote?: string; paquete?: string; serial?: string; fecha?: string | number }
    | string
    | null;
  fecha?: string | number | null;
};

export type ResultadoItem = {
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

/** Las 13 columnas de la hoja «Plan de Corte», en su orden de siempre. */
export const ENCABEZADOS_PLAN = [
  'OT',
  'Ubicación',
  'Acción',
  'Colmena',
  'Código',
  'Color',
  'Perforación',
  'Medida a Cortar (cm)',
  'Tubo Origen (cm)',
  'Lote',
  'Paquete',
  'Serial',
  'Fecha Serial',
] as const;

/**
 * Qué es cada fila. Solo las de tipo `corte` se marcan como hechas: la de
 * sobrante acompaña a su corte y no es una tarea aparte.
 */
export type TipoFilaPlan = 'corte' | 'sobrante' | 'merma' | 'reserva-mesa';

export type CeldasFilaPlan = {
  ot: string | number;
  ubicacion: string | number;
  accion: string | number;
  colmena: string | number;
  codigo: string | number;
  color: string | number;
  perforacion: string | number;
  medidaCm: string | number;
  origenCm: string | number;
  lote: string | number;
  paquete: string | number;
  serial: string | number;
  fechaSerial: string | number;
};

export type FilaPlan = {
  /**
   * Identidad estable de la fila para marcarla como hecha: `r{idx}` para el
   * corte y `r{idx}:s` para su sobrante, donde idx es la posición en
   * `plan.resultados[]`. El reorden de MESA mueve las filas de lugar pero NO
   * toca los índices, así que una marca sobrevive al reordenamiento.
   */
  clave: string;
  idx: number;
  tipo: TipoFilaPlan;
  conTira: boolean;
  celdas: CeldasFilaPlan;
};

// Formatea fecha tipo serial Excel (46083) o ISO string a "dd/mm/yyyy".
export function formatearFecha(fecha: string | number | null | undefined): string {
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

export function getR(item: ResultadoItem): ResultadoCorte {
  return (item.resultado ?? item) as ResultadoCorte;
}

export function getOrd(item: ResultadoItem, ordenes: OrdenLike[]): OrdenLike {
  const raw = item.orden;
  if (raw && typeof raw === 'object') return raw as OrdenLike;
  const r = getR(item);
  const ordIdOrVal = (r.orden ?? (item.orden as string | null)) as string | null;
  return ordenes.find((o) => o.id === ordIdOrVal) || {};
}

const ACCIONES_SOBRANTE = new Set(['RESERVAR EN MESA', 'GUARDAR SOBRANTE', 'DESECHAR MERMA']);

/**
 * Arma las filas del plan tal cual salen en el Excel del taller, ya
 * reordenadas: un RESERVAR EN MESA tiene que ir ANTES del corte que consume
 * ese sobrante, o el operario busca en la mesa algo que todavía no dejó ahí.
 */
export function construirFilasPlan(plan: PlanParaExportar): FilaPlan[] {
  const filas: FilaPlan[] = [];

  (plan.resultados || []).forEach((item, idx) => {
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
    const _conTiraRaw = String(ord.con_tira || '').toUpperCase().trim();
    // La tira es SOLO de la cenefa ovalada: marcarla en otro componente no
    // cambia nada, tal como en el optimizador.
    const conTira =
      (_conTiraRaw === 'CON TIRA' ||
        _conTiraRaw === 'SI' ||
        _conTiraRaw === 'SÍ' ||
        _conTiraRaw === 'X') &&
      _comp === 'CENEFA OVALADA';
    if (conTira) accionCortar += ' CON TIRA';

    const _colmenaExcel =
      _esTuboNuevo || _esTuboNuevoReemplazo
        ? res.nombreMaterialNuevo || 'TUBO NUEVO'
        : (res.colmena ?? '-');

    filas.push({
      clave: `r${idx}`,
      idx,
      tipo: 'corte',
      conTira,
      celdas: {
        ot: ord.ot || '-',
        ubicacion: ord.ubic || '-',
        accion: accionCortar,
        colmena: _colmenaExcel as string | number,
        codigo: codigoExcel,
        color,
        perforacion: ord.perforacion || '-',
        medidaCm: res.medida_cm ?? '-',
        origenCm: res.medida_origen ?? '-',
        lote: s.lote || '-',
        paquete: s.paquete || '-',
        serial: s.serial || '-',
        fechaSerial: fechaFormateada,
      },
    });

    if ((res.sobrante_cm ?? 0) > 0) {
      // Defensa: sobrante ≤ 10 cm SIEMPRE es merma (espejo de MERMA_MAX_MM=100
      // del optimizador), aunque el plan guardado no traiga es_desecho.
      const esDesecho = !!res.es_desecho || (res.sobrante_cm ?? 0) <= 10;
      let accionSobrante: string;
      let colmenaDestino: string | number;
      let tipo: TipoFilaPlan;
      if (res.es_intermedio) {
        accionSobrante = 'RESERVAR EN MESA';
        colmenaDestino = '-';
        tipo = 'reserva-mesa';
      } else if (esDesecho) {
        accionSobrante = 'DESECHAR MERMA';
        colmenaDestino = 'BASURERO';
        tipo = 'merma';
      } else {
        accionSobrante = 'GUARDAR SOBRANTE';
        colmenaDestino = (res.colmena_sobrante ?? res.colmena ?? '-') as string | number;
        tipo = 'sobrante';
      }

      filas.push({
        clave: `r${idx}:s`,
        idx,
        tipo,
        conTira: false,
        celdas: {
          ot: ord.ot || '-',
          ubicacion: '',
          accion: accionSobrante,
          colmena: colmenaDestino,
          codigo: codigoExcel,
          color,
          perforacion: '',
          medidaCm: res.sobrante_cm ?? 0,
          origenCm: '-',
          lote: s.lote || ord.lote || '-',
          paquete: s.paquete || ord.paquete || '-',
          serial: s.serial || (typeof ord.serial === 'string' ? ord.serial : '-') || '-',
          fechaSerial:
            (s.fecha as string | number | undefined) ?? (ord.fecha as string | number | null) ?? '-',
        },
      });
    }
  });

  return reordenarMesa(filas);
}

/**
 * Sube cada RESERVAR EN MESA por encima del CORTAR que come ese sobrante.
 * Puerto literal del bucle del Excel: agrupa corte + sobrante y mueve grupos
 * enteros, nunca filas sueltas.
 */
function reordenarMesa(filas: FilaPlan[]): FilaPlan[] {
  const grupos: FilaPlan[][] = [];
  let i = 0;
  while (i < filas.length) {
    const g: FilaPlan[] = [filas[i]];
    i++;
    if (i < filas.length && ACCIONES_SOBRANTE.has(String(filas[i].celdas.accion))) {
      g.push(filas[i]);
      i++;
    }
    grupos.push(g);
  }

  const productorDe = new Map<string, number>();
  grupos.forEach((g, gi) => {
    g.forEach((f) => {
      if (f.celdas.accion === 'RESERVAR EN MESA') {
        productorDe.set(`${f.celdas.codigo}|${f.celdas.medidaCm}`, gi);
      }
    });
  });

  let cambiado = true;
  while (cambiado) {
    cambiado = false;
    for (let ci = 0; ci < grupos.length; ci++) {
      const corte = grupos[ci][0];
      if (corte.celdas.colmena !== 'MESA') continue;
      const clave = `${corte.celdas.codigo}|${corte.celdas.origenCm}`;
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

  return grupos.flat();
}

/** Las celdas de una fila como arreglo, en el orden de `ENCABEZADOS_PLAN`. */
export function celdasComoArreglo(f: FilaPlan): (string | number)[] {
  const c = f.celdas;
  return [
    c.ot,
    c.ubicacion,
    c.accion,
    c.colmena,
    c.codigo,
    c.color,
    c.perforacion,
    c.medidaCm,
    c.origenCm,
    c.lote,
    c.paquete,
    c.serial,
    c.fechaSerial,
  ];
}

/**
 * Cómo se pinta la fila. Es la MISMA cadena de decisiones que el Excel: gana
 * la merma, después la reserva en mesa, después cualquier fila que salga de
 * la mesa y al final la tira. Se comparten para que la pantalla y el papel
 * no se contradigan.
 */
export type EstiloFilaPlan = 'merma' | 'reserva-mesa' | 'mesa' | 'con-tira' | null;

export function estiloFilaPlan(f: FilaPlan): EstiloFilaPlan {
  const accion = f.celdas.accion;
  if (accion === 'DESECHAR MERMA') return 'merma';
  if (accion === 'RESERVAR EN MESA') return 'reserva-mesa';
  if (f.celdas.colmena === 'MESA') return 'mesa';
  if (typeof accion === 'string' && accion.includes('CON TIRA')) return 'con-tira';
  return null;
}

/** Colores del Excel por estilo: fondo y letra en formato ARGB de xlsx. */
export const COLORES_EXCEL: Record<Exclude<EstiloFilaPlan, null>, { fill: string; font: string }> = {
  merma: { fill: 'FFFF9999', font: 'FF990000' },
  'reserva-mesa': { fill: 'FFFFF3E0', font: 'FFE65100' },
  mesa: { fill: 'FFE3F2FD', font: 'FF0D47A1' },
  'con-tira': { fill: 'FFFFFF99', font: 'FF886600' },
};

/**
 * Las OTs que toca un plan. Una celda puede traer dos OTs escritas a mano en
 * dos líneas («3054- SERV\n3061- SERV»), así que se parten por salto de línea.
 */
export function extraerOTsDePlan(plan: PlanParaExportar): string[] {
  const vistas = new Set<string>();
  const fuera: string[] = [];
  const agregar = (raw: unknown) => {
    if (typeof raw !== 'string') return;
    for (const parte of raw.split(/[\r\n]+/)) {
      const ot = parte.trim();
      if (!ot || ot === '-' || vistas.has(ot)) continue;
      vistas.add(ot);
      fuera.push(ot);
    }
  };
  (plan.resultados || []).forEach((item) => agregar(getOrd(item, plan.ordenes || []).ot));
  (plan.ordenes || []).forEach((o) => agregar(o.ot));
  return fuera;
}
