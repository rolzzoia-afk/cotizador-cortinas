// ─────────────────────────────────────────────────────────────────────
// Edición del catálogo de descuentos (Admin → Catálogo técnico).
//
// Lógica PURA: validación de una fila, creación de filas nuevas y manejo de
// los respaldos. Sin React ni Supabase, para poder testearla.
//
// La app manda sobre el Excel: toda fila que pase por acá se marca
// `origen: 'manual'` y el import del Excel maestro la respeta
// (ver sql/20260804_catalogo_origen_import_v2.sql).
// ─────────────────────────────────────────────────────────────────────
import type { ModeloDespiece } from './tipos';
import { claveModelo } from './tipos';

/** Una fila del catálogo tal como vive en la tabla (con su id y su origen). */
export type FilaCatalogo = ModeloDespiece & {
  id?: string;
  origen?: 'excel' | 'manual';
};

/** Los campos numéricos editables, en el orden en que se muestran. */
export const CAMPOS_NUMERICOS = [
  { key: 'diametro_tubo_mm', label: 'Diámetro tubo', unidad: 'mm' },
  { key: 'dcto_tubo_cm', label: 'Dcto. tubo', unidad: 'cm' },
  { key: 'dcto_tela_cm', label: 'Dcto. tela', unidad: 'cm' },
  { key: 'suma_peso_cm', label: 'Suma peso', unidad: 'cm' },
  { key: 'dcto_cenefa_cm', label: 'Dcto. cenefa', unidad: 'cm' },
  { key: 'dcto_cenefa_del_cm', label: 'Cenefa delantera', unidad: 'cm' },
  { key: 'dcto_cenefa_tra_cm', label: 'Cenefa trasera', unidad: 'cm' },
  { key: 'dcto_perfiles_cm', label: 'Dcto. perfiles', unidad: 'cm' },
  { key: 'peso_interno_duo_cm', label: 'Peso interno dúo', unidad: 'cm' },
  { key: 'peso_u_duo_cm', label: 'Peso U dúo', unidad: 'cm' },
  { key: 'ancho_max_m', label: 'Ancho máximo', unidad: 'm' },
] as const satisfies ReadonlyArray<{ key: keyof ModeloDespiece; label: string; unidad: string }>;

export type CampoNumerico = (typeof CAMPOS_NUMERICOS)[number]['key'];

/** Fila vacía para dar de alta un modelo nuevo. */
export function filaNueva(sistema = ''): FilaCatalogo {
  return {
    sistema,
    tipo_rol: '',
    mecanismo: '',
    codigos_tubo: '',
    diametro_tubo_mm: 0,
    dcto_tubo_cm: 0,
    dcto_tela_cm: 0,
    suma_peso_cm: 0,
    dcto_cenefa_cm: 0,
    dcto_cenefa_del_cm: 0,
    dcto_cenefa_tra_cm: 0,
    dcto_perfiles_cm: 0,
    peso_interno_duo_cm: 0,
    peso_u_duo_cm: 0,
    ancho_max_m: 0,
    activo: true,
    notas: '',
    origen: 'manual',
  };
}

/** Copia de una fila existente, lista para guardarse como modelo aparte. */
export function duplicarFila(f: FilaCatalogo): FilaCatalogo {
  const { id: _id, ...resto } = f;
  return {
    ...resto,
    tipo_rol: `${f.tipo_rol} (copia)`,
    origen: 'manual',
  };
}

/**
 * Valida una fila antes de guardarla.
 * Devuelve la lista de problemas (vacía = se puede guardar).
 */
export function validarFila(f: FilaCatalogo, todas: FilaCatalogo[] = []): string[] {
  const errores: string[] = [];
  if (!f.sistema.trim()) errores.push('El sistema es obligatorio.');
  if (!f.tipo_rol.trim()) errores.push('El tipo de rol es obligatorio.');

  for (const c of CAMPOS_NUMERICOS) {
    const v = f[c.key];
    if (!Number.isFinite(v)) errores.push(`${c.label}: debe ser un número.`);
    else if (v < 0) errores.push(`${c.label}: no puede ser negativo.`);
  }
  if (f.diametro_tubo_mm > 0 && f.diametro_tubo_mm < 10) {
    errores.push('Diámetro tubo: se escribe en milímetros (38, 45, 63), no en centímetros.');
  }
  if (f.ancho_max_m > 20) {
    errores.push('Ancho máximo: se escribe en metros (por ejemplo 3), no en centímetros.');
  }

  // La clave sistema|tipo_rol|mecanismo es la que usa el motor para elegir el
  // modelo: si se repite, el despiece tomaría cualquiera de las dos.
  const clave = claveModelo(f);
  const choca = todas.some((o) => o.id !== f.id && claveModelo(o) === clave);
  if (choca) {
    errores.push(`Ya existe un modelo con sistema, tipo y mecanismo "${clave}".`);
  }
  return errores;
}

/** Los campos que viajan a la tabla (sin `id`, que va en el filtro/upsert). */
export function filaParaGuardar(f: FilaCatalogo): Record<string, unknown> {
  return {
    sistema: f.sistema.trim(),
    tipo_rol: f.tipo_rol.trim(),
    mecanismo: f.mecanismo.trim(),
    codigos_tubo: f.codigos_tubo.trim(),
    diametro_tubo_mm: f.diametro_tubo_mm,
    dcto_tubo_cm: f.dcto_tubo_cm,
    dcto_tela_cm: f.dcto_tela_cm,
    suma_peso_cm: f.suma_peso_cm,
    dcto_cenefa_cm: f.dcto_cenefa_cm,
    dcto_cenefa_del_cm: f.dcto_cenefa_del_cm,
    dcto_cenefa_tra_cm: f.dcto_cenefa_tra_cm,
    dcto_perfiles_cm: f.dcto_perfiles_cm,
    peso_interno_duo_cm: f.peso_interno_duo_cm,
    peso_u_duo_cm: f.peso_u_duo_cm,
    ancho_max_m: f.ancho_max_m,
    activo: f.activo,
    notas: f.notas,
    // Editar una fila la vuelve de la app: el Excel ya no la pisa.
    origen: 'manual',
  };
}

/** Agrupa por sistema, en orden alfabético, para pintar la tabla. */
export function agruparPorSistema(filas: FilaCatalogo[]): Array<{
  sistema: string;
  filas: FilaCatalogo[];
}> {
  const mapa = new Map<string, FilaCatalogo[]>();
  for (const f of filas) {
    const s = f.sistema || '(sin sistema)';
    const lista = mapa.get(s);
    if (lista) lista.push(f);
    else mapa.set(s, [f]);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([sistema, fs]) => ({
      sistema,
      filas: [...fs].sort(
        (a, b) => a.tipo_rol.localeCompare(b.tipo_rol, 'es') || a.mecanismo.localeCompare(b.mecanismo, 'es'),
      ),
    }));
}

// ── Respaldos ──
// Cada guardado deja una foto del catálogo completo para poder volver atrás.
// Viven en `configuracion`, clave `catalogo_respaldos`.

export const MAX_RESPALDOS = 10;

export type RespaldoCatalogo = {
  /** ISO del momento del respaldo (lo pone quien guarda). */
  fecha: string;
  /** Qué lo originó, para reconocerlo en la lista. */
  motivo: string;
  filas: FilaCatalogo[];
};

/**
 * Agrega un respaldo al principio y recorta a los {@link MAX_RESPALDOS} más
 * nuevos: sin el tope, la clave de configuración crecería sin límite.
 */
export function agregarRespaldo(
  previos: RespaldoCatalogo[],
  nuevo: RespaldoCatalogo,
): RespaldoCatalogo[] {
  return [nuevo, ...previos].slice(0, MAX_RESPALDOS);
}

/** Lee la lista de respaldos de un JSON crudo, tolerando basura. */
export function normalizarRespaldos(crudo: unknown): RespaldoCatalogo[] {
  if (!Array.isArray(crudo)) return [];
  return crudo
    .filter((r): r is RespaldoCatalogo => {
      if (!r || typeof r !== 'object') return false;
      const o = r as Record<string, unknown>;
      return typeof o.fecha === 'string' && Array.isArray(o.filas);
    })
    .map((r) => ({ fecha: r.fecha, motivo: r.motivo || '', filas: r.filas }))
    .slice(0, MAX_RESPALDOS);
}

/** Etiqueta legible de un respaldo: "4 ago 2026, 16:23 · 67 modelos". */
export function etiquetaRespaldo(r: RespaldoCatalogo): string {
  const d = new Date(r.fecha);
  const cuando = Number.isNaN(d.getTime())
    ? r.fecha
    : d.toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });
  return `${cuando} · ${r.filas.length} modelos${r.motivo ? ` · ${r.motivo}` : ''}`;
}
