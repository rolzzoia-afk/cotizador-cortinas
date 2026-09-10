// ─────────────────────────────────────────────────────────────────────
// Alertas y reposición (lámina «Alertas y reposición»).
//
// Contesta dos preguntas: qué está por acabarse y cuánto hay que pedir. Junta
// insumos y telas en una sola lista, porque el que va a comprar no ordena su
// día por el tipo de artículo sino por lo que frena el armado.
//
// Los dos números que se editan acá:
//   · «pedir cuando baje de» es el MÍNIMO — el que dispara la alerta;
//   · «dejar en» es el MÁXIMO — hasta dónde conviene reponer.
// La cantidad sugerida es la resta: «dejar en» menos lo que hay hoy. Si nadie
// definió el máximo NO se sugiere nada, en vez de inventar una cantidad que
// alguien terminaría comprando.
// ─────────────────────────────────────────────────────────────────────

import { estadoArticulo, type EstadoArticulo, type VarianteBadge } from './badges';

export type DominioAlerta = 'insumo' | 'tela';

export type ArticuloAlerta = {
  id: string;
  dominio: DominioAlerta;
  codigo: string;
  nombre: string;
  /** El color del artículo, para mostrar el código como se imprime. */
  color?: string | null;
  /** Saldo de hoy: unidades en los insumos, metros en las telas. */
  ahora: number;
  minimo: number | null;
  maximo: number | null;
  /** 'DESCONTINUADO' saca al artículo de las alertas: ya no se repone. */
  status?: string | null;
  /** Cuánto sale al mes, para la cobertura. `null` si no hay historia. */
  consumoMes?: number | null;
};

/** Cómo se escribe la cantidad de cada dominio. */
export function unidadDe(dominio: DominioAlerta): string {
  return dominio === 'tela' ? 'm' : 'un';
}

export function textoCantidad(valor: number, dominio: DominioAlerta): string {
  const decimales = dominio === 'tela' ? 2 : 0;
  return valor.toLocaleString('es-CL', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

export function estadoDeAlerta(a: ArticuloAlerta): EstadoArticulo {
  return estadoArticulo({ total: a.ahora, minimo: a.minimo, status: a.status });
}

/** ¿Este artículo pide que alguien haga algo hoy? */
export function pideAtencion(a: ArticuloAlerta): boolean {
  const e = estadoDeAlerta(a);
  return e === 'negativo' || e === 'sin_stock' || e === 'bajo_minimo';
}

/**
 * Cuánto pedir: «dejar en» menos lo que hay. Sin máximo definido devuelve
 * `null` — la pantalla ofrece definirlo en vez de sugerir un número.
 */
export function cantidadSugerida(a: ArticuloAlerta): number | null {
  const max = Number(a.maximo ?? 0);
  if (!(max > 0)) return null;
  const falta = max - a.ahora;
  return falta > 0 ? Math.round(falta * 100) / 100 : 0;
}

// ── Cobertura ────────────────────────────────────────────────────────

export type Cobertura = { texto: string; variante: VarianteBadge };

/** Para cuántos meses alcanza lo que hay. `null` si no se sabe qué sale. */
export function coberturaMeses(a: ArticuloAlerta): number | null {
  const consumo = Number(a.consumoMes ?? 0);
  if (!(consumo > 0)) return null;
  if (a.ahora <= 0) return 0;
  return a.ahora / consumo;
}

/**
 * La columna «Cobertura». Cuando hay historia de consumo dice para cuántos
 * meses alcanza; cuando no la hay, dice en qué estado está, que es lo único
 * que se sabe de verdad.
 */
export function textoCobertura(a: ArticuloAlerta): Cobertura {
  const estado = estadoDeAlerta(a);
  if (estado === 'descontinuado') return { texto: 'Descontinuado', variante: 'muted' };
  if (estado === 'negativo') return { texto: 'Negativo', variante: 'destructive' };
  if (estado === 'sin_stock') return { texto: 'Sin stock', variante: 'destructive' };
  if (estado === 'sin_minimo') return { texto: 'Sin mínimo', variante: 'muted' };

  const meses = coberturaMeses(a);
  if (meses == null) {
    return estado === 'bajo_minimo'
      ? { texto: 'Crítico', variante: 'destructive' }
      : { texto: 'Cubierto', variante: 'success' };
  }
  const texto = `${meses.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} meses`;
  if (meses < 1) return { texto, variante: 'destructive' };
  if (meses < 2) return { texto, variante: 'warning' };
  return { texto, variante: 'success' };
}

// ── Consumo ──────────────────────────────────────────────────────────

export type SalidaConsumo = { codigo: string | null; cantidad: number | null; fecha: string | null };

/**
 * Cuánto sale al mes de cada código, promediando los últimos `meses`. Solo
 * cuenta lo que SALIÓ: una entrada no dice nada sobre el ritmo de consumo.
 */
export function consumoPorCodigo(
  salidas: SalidaConsumo[],
  meses: number,
  desdeISO: string,
): Map<string, number> {
  const desde = Date.parse(desdeISO);
  const total = new Map<string, number>();
  for (const s of salidas) {
    const cod = String(s.codigo ?? '').trim().toUpperCase();
    if (!cod) continue;
    const t = Date.parse(String(s.fecha ?? ''));
    if (Number.isNaN(t) || t < desde) continue;
    const cant = Math.abs(Number(s.cantidad ?? 0));
    if (!(cant > 0)) continue;
    total.set(cod, (total.get(cod) ?? 0) + cant);
  }
  const promedio = new Map<string, number>();
  for (const [cod, suma] of total) promedio.set(cod, suma / Math.max(1, meses));
  return promedio;
}

// ── Filtros y resumen ────────────────────────────────────────────────

export type FiltroAlertas = 'atencion' | 'sin_stock' | 'bajo_minimo' | 'sin_minimo' | 'todas';

export const FILTROS_ALERTAS: ReadonlyArray<{ id: FiltroAlertas; texto: string }> = [
  { id: 'atencion', texto: 'Piden atención' },
  { id: 'sin_stock', texto: 'Sin stock' },
  { id: 'bajo_minimo', texto: 'Bajo mínimo' },
  { id: 'sin_minimo', texto: 'Sin mínimo' },
  { id: 'todas', texto: 'Todo el catálogo' },
];

export function filtrarAlertas<T extends ArticuloAlerta>(
  articulos: T[],
  filtro: FiltroAlertas,
  busqueda = '',
  dominios: ReadonlySet<DominioAlerta> | null = null,
): T[] {
  const q = busqueda.trim().toLowerCase();
  return articulos.filter((a) => {
    if (dominios && dominios.size > 0 && !dominios.has(a.dominio)) return false;
    if (q && !`${a.codigo} ${a.nombre}`.toLowerCase().includes(q)) return false;
    const e = estadoDeAlerta(a);
    switch (filtro) {
      case 'sin_stock':
        return e === 'sin_stock' || e === 'negativo';
      case 'bajo_minimo':
        return e === 'bajo_minimo';
      case 'sin_minimo':
        return e === 'sin_minimo';
      case 'atencion':
        return pideAtencion(a);
      default:
        return true;
    }
  });
}

/**
 * Lo que se ordena primero es lo que más duele: lo que quedó en negativo,
 * después lo que se acabó, y recién ahí lo que está bajo el mínimo.
 */
const PESO_ESTADO: Record<EstadoArticulo, number> = {
  negativo: 0,
  sin_stock: 1,
  bajo_minimo: 2,
  sin_minimo: 3,
  con_stock: 4,
  descontinuado: 5,
};

export function ordenarAlertas<T extends ArticuloAlerta>(articulos: T[]): T[] {
  return [...articulos].sort(
    (a, b) =>
      PESO_ESTADO[estadoDeAlerta(a)] - PESO_ESTADO[estadoDeAlerta(b)] ||
      a.codigo.localeCompare(b.codigo, 'es'),
  );
}

export type ResumenAlertas = {
  sinStock: number;
  bajoMinimo: number;
  sinMinimo: number;
};

export function resumenAlertas(articulos: ArticuloAlerta[]): ResumenAlertas {
  let sinStock = 0;
  let bajoMinimo = 0;
  let sinMinimo = 0;
  for (const a of articulos) {
    const e = estadoDeAlerta(a);
    if (e === 'sin_stock' || e === 'negativo') sinStock++;
    else if (e === 'bajo_minimo') bajoMinimo++;
    if (e === 'sin_minimo') sinMinimo++;
  }
  return { sinStock, bajoMinimo, sinMinimo };
}

// ── El borrador de la edición ────────────────────────────────────────

/** Lo que alguien cambió y todavía no guardó, por id de artículo. */
export type CambioAlerta = { minimo?: number | null; maximo?: number | null };
export type BorradorAlertas = Record<string, CambioAlerta>;

/** El artículo con los cambios sin guardar ya aplicados encima. */
export function conBorrador<T extends ArticuloAlerta>(a: T, borrador: BorradorAlertas): T {
  const c = borrador[a.id];
  if (!c) return a;
  return {
    ...a,
    minimo: c.minimo !== undefined ? c.minimo : a.minimo,
    maximo: c.maximo !== undefined ? c.maximo : a.maximo,
  };
}

/**
 * Qué se cambió, en una frase. Se cuenta por CAMPO y no por artículo: cambiar
 * el mínimo de uno y el máximo de otro son dos decisiones distintas, y quien
 * va a guardar tiene que saber cuáles está confirmando.
 */
export function resumenCambios(borrador: BorradorAlertas): string | null {
  let minimos = 0;
  let maximos = 0;
  for (const c of Object.values(borrador)) {
    if (c.minimo !== undefined) minimos++;
    if (c.maximo !== undefined) maximos++;
  }
  if (minimos === 0 && maximos === 0) return null;
  const partes: string[] = [];
  if (minimos > 0) {
    partes.push(
      minimos === 1
        ? 'el punto de reposición de 1 artículo'
        : `el punto de reposición de ${minimos} artículos`,
    );
  }
  if (maximos > 0) {
    partes.push(maximos === 1 ? 'el objetivo de 1' : `el objetivo de ${maximos}`);
  }
  return `Cambiaste ${partes.join(' y ')}`;
}
