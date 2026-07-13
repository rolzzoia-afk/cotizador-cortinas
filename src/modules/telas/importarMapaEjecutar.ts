// ─────────────────────────────────────────────────────────────────────
// Capa fina de ejecución del plan de importación de la colmena (MAPA).
// Recibe el cliente Supabase por parámetro (inyectable → testeable con fake).
//
// Orden ESTRICTO: inserts → updates → bajas. Un fallo temprano deja el sistema
// con "más inventario visible", nunca con bajas aplicadas sobre un import
// incompleto. Errores parciales: se registran y se continúa (idempotente:
// re-subir el mismo archivo aplica solo lo pendiente).
//
// Las bajas llevan guard optimista `.eq('disponible', true)`: si el optimizador
// reservó el paño entre el preview y el aplicar, la baja no lo pisa (0 filas →
// advertencia, no error).
// ─────────────────────────────────────────────────────────────────────
import type { PlanAplicacion } from '@/modules/telas/importarMapa';

const TABLA = 'colmena_panos';
const CHUNK_INSERT = 100;
const CHUNK_UPDATE = 25;

// Interfaz mínima del cliente (subset de SupabaseClient) para inyectar un fake.
type PgResult = { data?: unknown[] | null; error: { message: string } | null };
interface UpdateBuilder {
  eq(col: string, val: unknown): UpdateBuilder;
  select(cols?: string): Promise<PgResult>;
}
interface TablaMapa {
  insert(rows: unknown[]): Promise<PgResult>;
  update(vals: Record<string, unknown>): UpdateBuilder;
}
export interface ClienteMapa {
  from(tabla: string): TablaMapa;
}

export type ErrorEjecucion = {
  fase: 'insert' | 'update' | 'baja';
  detalle: string;
  filas: number;
};
export type ResultadoEjecucion = {
  insertados: number;
  actualizados: number;
  dadosDeBaja: number;
  /** Bajas que no afectaron filas (el paño se reservó entre preview y aplicar). */
  bajasOmitidas: number;
  errores: ErrorEjecucion[];
};

function trozos<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export async function ejecutarPlanMapa(
  sb: ClienteMapa,
  plan: PlanAplicacion,
  opts?: { chunkInsert?: number; chunkUpdate?: number },
): Promise<ResultadoEjecucion> {
  const chunkInsert = opts?.chunkInsert ?? CHUNK_INSERT;
  const chunkUpdate = opts?.chunkUpdate ?? CHUNK_UPDATE;
  const res: ResultadoEjecucion = {
    insertados: 0,
    actualizados: 0,
    dadosDeBaja: 0,
    bajasOmitidas: 0,
    errores: [],
  };

  // 1) Inserts (chunks; un chunk que falla no detiene los siguientes).
  for (const chunk of trozos(plan.inserts, chunkInsert)) {
    const { error } = await sb.from(TABLA).insert(chunk);
    if (error) res.errores.push({ fase: 'insert', detalle: error.message, filas: chunk.length });
    else res.insertados += chunk.length;
  }

  // 2) Updates (payload por fila → un request por id, en lotes acotados).
  for (const lote of trozos(plan.updates, chunkUpdate)) {
    const salidas = await Promise.allSettled(
      lote.map((u) =>
        sb
          .from(TABLA)
          .update({
            codigo: u.codigo,
            medida_ancho: u.medida_ancho,
            medida_alto: u.medida_alto,
            datos_extra: u.datos_extra,
          })
          .eq('id', u.id)
          .select('id'),
      ),
    );
    for (const s of salidas) {
      if (s.status === 'rejected') {
        res.errores.push({ fase: 'update', detalle: String(s.reason), filas: 1 });
      } else if (s.value.error) {
        res.errores.push({ fase: 'update', detalle: s.value.error.message, filas: 1 });
      } else {
        res.actualizados += 1;
      }
    }
  }

  // 3) Bajas (soft-delete con guard optimista de disponibilidad).
  for (const lote of trozos(plan.bajas, chunkUpdate)) {
    const salidas = await Promise.allSettled(
      lote.map((b) =>
        sb
          .from(TABLA)
          .update({ disponible: false, datos_extra: b.datos_extra })
          .eq('id', b.id)
          .eq('disponible', true)
          .select('id'),
      ),
    );
    for (const s of salidas) {
      if (s.status === 'rejected') {
        res.errores.push({ fase: 'baja', detalle: String(s.reason), filas: 1 });
      } else if (s.value.error) {
        res.errores.push({ fase: 'baja', detalle: s.value.error.message, filas: 1 });
      } else if ((s.value.data?.length ?? 0) === 0) {
        res.bajasOmitidas += 1; // el paño ya no estaba disponible
      } else {
        res.dadosDeBaja += 1;
      }
    }
  }

  return res;
}
