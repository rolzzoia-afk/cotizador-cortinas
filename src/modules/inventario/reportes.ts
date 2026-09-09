// ─────────────────────────────────────────────────────────────────────
// Reportes del inventario (lámina «Reportes»).
//
// Cuatro preguntas: cuánto vale lo que hay, en qué se va, qué no se mueve y
// qué se pierde.
//
// Una advertencia que la pantalla repite y este módulo hace cumplir: solo se
// valoriza lo que TIENE COSTO. Hoy `insumos.costo` existe pero 218 de 1.012
// artículos no lo tienen, y ni `telas_catalogo` ni la colmena de tubos tienen
// columna de costo. Un total que rellene esos huecos con cero se lee como si
// fuera el valor del inventario, y no lo es: por eso se cuenta aparte cuánto
// quedó fuera y la pantalla lo dice al lado del número grande.
// ─────────────────────────────────────────────────────────────────────

export type ArticuloValorizable = {
  codigo: string;
  /** Con qué se agrupa la barra: la subcategoría del insumo. */
  grupo: string | null;
  saldo: number;
  costo: number | null;
};

export type Valorizacion = {
  /** Suma de saldo × costo de lo que sí tiene costo. */
  total: number;
  /** Cuántos artículos con saldo quedaron fuera por no tener costo. */
  sinCosto: number;
  grupos: Array<{ nombre: string; valor: number }>;
};

const SIN_GRUPO = 'Sin clasificar';

/** Título de un grupo: «TUBERÍA» se lee mejor como «Tubería». */
export function nombreGrupo(g: string | null | undefined): string {
  const t = String(g ?? '').trim();
  if (!t) return SIN_GRUPO;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

export function valorizar(articulos: ArticuloValorizable[]): Valorizacion {
  let total = 0;
  let sinCosto = 0;
  const porGrupo = new Map<string, number>();
  for (const a of articulos) {
    const costo = Number(a.costo ?? 0);
    const saldo = Number(a.saldo ?? 0);
    if (!(costo > 0)) {
      // Solo cuenta como hueco si HAY algo en el estante: un artículo en cero
      // sin costo no le falta plata a nadie.
      if (saldo > 0) sinCosto++;
      continue;
    }
    if (saldo <= 0) continue;
    const valor = saldo * costo;
    total += valor;
    const g = nombreGrupo(a.grupo);
    porGrupo.set(g, (porGrupo.get(g) ?? 0) + valor);
  }
  return {
    total: Math.round(total),
    sinCosto,
    grupos: [...porGrupo.entries()]
      .map(([nombre, valor]) => ({ nombre, valor: Math.round(valor) }))
      .sort((a, b) => b.valor - a.valor),
  };
}

// ── Meses ────────────────────────────────────────────────────────────

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Clave de mes comparable: «2026-09». */
export function claveMes(iso: string | null | undefined): string | null {
  const t = Date.parse(String(iso ?? ''));
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function nombreMes(clave: string): string {
  const mes = Number(clave.slice(5, 7));
  return MESES_CORTOS[mes - 1] ?? clave;
}

/** Los últimos `n` meses hasta hoy, del más viejo al más nuevo. */
export function ultimosMeses(hoyISO: string, n: number): string[] {
  const base = new Date(Date.parse(hoyISO));
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export type BarraMes = {
  clave: string;
  etiqueta: string;
  valor: number;
  /** El mes de hoy todavía no terminó: se dibuja distinto. */
  enCurso: boolean;
};

export type SalidaValorizable = { codigo: string | null; cantidad: number | null; fecha: string | null };

/**
 * Cuánto salió cada mes, en pesos. Una salida cuyo código no tiene costo NO
 * suma: es lo mismo que valorizar en cero, y prefiero una barra más baja que
 * un número que parece completo y no lo es.
 */
export function consumoMensual(
  salidas: SalidaValorizable[],
  costoPorCodigo: Map<string, number>,
  hoyISO: string,
  meses = 12,
): BarraMes[] {
  const claves = ultimosMeses(hoyISO, meses);
  const suma = new Map<string, number>(claves.map((c) => [c, 0]));
  for (const s of salidas) {
    const clave = claveMes(s.fecha);
    if (!clave || !suma.has(clave)) continue;
    const costo = costoPorCodigo.get(String(s.codigo ?? '').trim().toUpperCase());
    if (!costo) continue;
    suma.set(clave, (suma.get(clave) ?? 0) + Math.abs(Number(s.cantidad ?? 0)) * costo);
  }
  const mesDeHoy = claveMes(hoyISO);
  return claves.map((clave) => ({
    clave,
    etiqueta: nombreMes(clave),
    valor: Math.round(suma.get(clave) ?? 0),
    enCurso: clave === mesDeHoy,
  }));
}

// ── Lo que no se mueve ───────────────────────────────────────────────

export type ArticuloQuieto = {
  codigo: string;
  nombre: string;
  /** Meses desde la última salida. `null` = nunca salió. */
  meses: number | null;
  valor: number;
};

/** Meses enteros entre dos fechas. */
function mesesEntre(desdeISO: string, hastaISO: string): number | null {
  const a = Date.parse(desdeISO);
  const b = Date.parse(hastaISO);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.floor((b - a) / (30 * 86_400_000)));
}

/**
 * Los artículos con saldo que llevan más tiempo sin salir, y cuánta plata
 * representan. Un artículo que NUNCA salió cuenta como el más quieto de
 * todos: es justo el que nadie mira.
 */
export function loQueNoSeMueve(
  articulos: Array<ArticuloValorizable & { nombre: string }>,
  ultimaSalida: Map<string, string>,
  hoyISO: string,
  mesesQuieto = 6,
): { articulos: ArticuloQuieto[]; valorParado: number } {
  const quietos: ArticuloQuieto[] = [];
  let valorParado = 0;
  for (const a of articulos) {
    const saldo = Number(a.saldo ?? 0);
    const costo = Number(a.costo ?? 0);
    if (saldo <= 0) continue;
    const fecha = ultimaSalida.get(a.codigo.trim().toUpperCase());
    const meses = fecha ? mesesEntre(fecha, hoyISO) : null;
    if (meses != null && meses < mesesQuieto) continue;
    const valor = costo > 0 ? Math.round(saldo * costo) : 0;
    quietos.push({ codigo: a.codigo, nombre: a.nombre, meses, valor });
    valorParado += valor;
  }
  quietos.sort((x, y) => (y.meses ?? 999) - (x.meses ?? 999) || y.valor - x.valor);
  return { articulos: quietos, valorParado };
}

// ── Merma ────────────────────────────────────────────────────────────

export type MermaTela = {
  medida_ancho: number | null;
  medida_alto: number | null;
  fecha: string | null;
};

/** Metros cuadrados de tela perdidos cada mes. */
export function mermaMensual(mermas: MermaTela[], hoyISO: string, meses = 12): BarraMes[] {
  const claves = ultimosMeses(hoyISO, meses);
  const suma = new Map<string, number>(claves.map((c) => [c, 0]));
  for (const m of mermas) {
    const clave = claveMes(m.fecha);
    if (!clave || !suma.has(clave)) continue;
    const m2 = (Number(m.medida_ancho ?? 0) * Number(m.medida_alto ?? 0)) / 10_000;
    if (!(m2 > 0)) continue;
    suma.set(clave, (suma.get(clave) ?? 0) + m2);
  }
  const mesDeHoy = claveMes(hoyISO);
  return claves.map((clave) => ({
    clave,
    etiqueta: nombreMes(clave),
    valor: Math.round((suma.get(clave) ?? 0) * 10) / 10,
    enCurso: clave === mesDeHoy,
  }));
}

/** El promedio mensual de una serie, sin contar el mes en curso. */
export function promedioMensual(barras: BarraMes[]): number {
  const cerradas = barras.filter((b) => !b.enCurso);
  if (cerradas.length === 0) return 0;
  const suma = cerradas.reduce((s, b) => s + b.valor, 0);
  return Math.round((suma / cerradas.length) * 10) / 10;
}

// ── Formato ──────────────────────────────────────────────────────────

/** «$ 375.187.620» */
export function pesos(v: number): string {
  return `$ ${Math.round(v).toLocaleString('es-CL')}`;
}

/** «375,2 M» — para las barras, donde el peso exacto no aporta. */
export function millones(v: number): string {
  return `${(v / 1_000_000).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}
