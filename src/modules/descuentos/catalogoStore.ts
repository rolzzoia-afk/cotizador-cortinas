// Persistencia del catálogo técnico editable (Admin → Catálogo técnico).
//
// A diferencia de `useDescuentosModelo` (que trae solo lo ACTIVO para el
// motor), acá se traen todas las filas con su `id` y su `origen`, porque el
// editor necesita ver y prender las inactivas.
//
// Los respaldos viven en `configuracion`, clave `catalogo_respaldos`: cada
// guardado deja una foto de la tabla completa para poder volver atrás.
// La lógica pura está en `catalogoEdicionModelos.ts`.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  agregarRespaldo,
  filaParaGuardar,
  normalizarRespaldos,
  type FilaCatalogo,
  type RespaldoCatalogo,
} from './catalogoEdicionModelos';

export const CLAVE_RESPALDOS = 'catalogo_respaldos';

const COLUMNAS =
  'id, sistema, tipo_rol, mecanismo, codigos_tubo, diametro_tubo_mm, dcto_tubo_cm, dcto_tela_cm, suma_peso_cm, dcto_cenefa_cm, dcto_cenefa_del_cm, dcto_cenefa_tra_cm, dcto_perfiles_cm, peso_interno_duo_cm, peso_u_duo_cm, ancho_max_m, activo, notas';

/** Los numeric de Postgres llegan como string: hay que pasarlos a número. */
function normalizarFila(d: Record<string, unknown>): FilaCatalogo {
  return {
    ...(d as unknown as FilaCatalogo),
    diametro_tubo_mm: Number(d.diametro_tubo_mm),
    dcto_tubo_cm: Number(d.dcto_tubo_cm),
    dcto_tela_cm: Number(d.dcto_tela_cm),
    suma_peso_cm: Number(d.suma_peso_cm),
    dcto_cenefa_cm: Number(d.dcto_cenefa_cm),
    dcto_cenefa_del_cm: Number(d.dcto_cenefa_del_cm),
    dcto_cenefa_tra_cm: Number(d.dcto_cenefa_tra_cm),
    dcto_perfiles_cm: Number(d.dcto_perfiles_cm),
    peso_interno_duo_cm: Number(d.peso_interno_duo_cm),
    peso_u_duo_cm: Number(d.peso_u_duo_cm),
    ancho_max_m: Number(d.ancho_max_m),
  };
}

/**
 * Trae el catálogo completo para editar. Pide `origen` aparte porque la
 * columna es nueva (sql/20260804_catalogo_origen_import_v2.sql): si todavía
 * no se corrió el script, el editor igual funciona y todas las filas se
 * muestran como del Excel.
 */
export async function cargarCatalogoEditable(empresaId: string): Promise<{
  filas: FilaCatalogo[];
  conOrigen: boolean;
}> {
  const conOrigen = await supabase
    .from('descuentos_modelo' as never)
    .select(`${COLUMNAS}, origen`)
    .eq('empresa_id', empresaId)
    .order('sistema')
    .order('tipo_rol')
    .order('mecanismo');

  if (!conOrigen.error) {
    return {
      filas: ((conOrigen.data as unknown as Record<string, unknown>[]) ?? []).map(normalizarFila),
      conOrigen: true,
    };
  }

  const sinOrigen = await supabase
    .from('descuentos_modelo' as never)
    .select(COLUMNAS)
    .eq('empresa_id', empresaId)
    .order('sistema')
    .order('tipo_rol')
    .order('mecanismo');
  if (sinOrigen.error) throw sinOrigen.error;
  return {
    filas: ((sinOrigen.data as unknown as Record<string, unknown>[]) ?? []).map(normalizarFila),
    conOrigen: false,
  };
}

/**
 * Alta o edición de una fila. Devuelve el id (nuevo o el que ya tenía).
 *
 * Si la fila trae un id que ya no está en la tabla —una fila borrada que se
 * está reponiendo desde un respaldo— se INSERTA con ese mismo id: un `update`
 * a secas no afectaría ninguna fila y se perdería en silencio.
 */
export async function guardarFilaCatalogo(
  empresaId: string,
  fila: FilaCatalogo,
  conOrigen: boolean,
): Promise<string> {
  const payload = filaParaGuardar(fila);
  // Sin la columna `origen` en la base, el payload la rechazaría entera.
  if (!conOrigen) delete payload.origen;

  if (fila.id) {
    const { data, error } = await supabase
      .from('descuentos_modelo' as never)
      .update(payload as never)
      .eq('id', fila.id)
      .eq('empresa_id', empresaId)
      .select('id');
    if (error) throw error;
    if ((data as unknown as unknown[])?.length) return fila.id;
    // No existía: se repone conservando su id.
    const alta = await supabase
      .from('descuentos_modelo' as never)
      .insert({ ...payload, id: fila.id, empresa_id: empresaId } as never)
      .select('id')
      .single();
    if (alta.error) throw alta.error;
    return fila.id;
  }
  const { data, error } = await supabase
    .from('descuentos_modelo' as never)
    .insert({ ...payload, empresa_id: empresaId } as never)
    .select('id')
    .single();
  if (error) throw error;
  return (data as unknown as { id: string }).id;
}

export async function eliminarFilaCatalogo(empresaId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('descuentos_modelo' as never)
    .delete()
    .eq('id', id)
    .eq('empresa_id', empresaId);
  if (error) throw error;
}

// ── Respaldos ──

export async function cargarRespaldos(empresaId: string): Promise<RespaldoCatalogo[]> {
  const { data, error } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('clave', CLAVE_RESPALDOS)
    .maybeSingle<{ valor: string }>();
  if (error || !data?.valor) return [];
  try {
    return normalizarRespaldos(JSON.parse(data.valor));
  } catch {
    return [];
  }
}

/**
 * Guarda una foto del catálogo antes de tocarlo. Nunca lanza: un respaldo que
 * falla no puede impedir que el admin guarde su cambio.
 */
export async function respaldarCatalogo(
  empresaId: string,
  filas: FilaCatalogo[],
  motivo: string,
): Promise<void> {
  try {
    const previos = await cargarRespaldos(empresaId);
    const lista = agregarRespaldo(previos, {
      fecha: new Date().toISOString(),
      motivo,
      filas,
    });
    await supabase.from('configuracion').upsert(
      { empresa_id: empresaId, clave: CLAVE_RESPALDOS, valor: JSON.stringify(lista) },
      { onConflict: 'empresa_id,clave' },
    );
  } catch (e) {
    console.warn('[Catálogo] No se pudo guardar el respaldo:', e);
  }
}

/**
 * Vuelve el catálogo a un respaldo: reescribe las filas que existan y da de
 * alta las que se hubieran borrado. No toca las creadas después (el admin las
 * ve y decide), así que restaurar nunca destruye trabajo nuevo en silencio.
 */
export async function restaurarRespaldo(
  empresaId: string,
  respaldo: RespaldoCatalogo,
  conOrigen: boolean,
): Promise<number> {
  let aplicadas = 0;
  for (const fila of respaldo.filas) {
    await guardarFilaCatalogo(empresaId, fila, conOrigen);
    aplicadas++;
  }
  return aplicadas;
}

/** Hook del catálogo editable de la empresa actual. */
export function useCatalogoEditable(): {
  filas: FilaCatalogo[];
  conOrigen: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [filas, setFilas] = useState<FilaCatalogo[]>([]);
  const [conOrigen, setConOrigen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setFilas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await cargarCatalogoEditable(empresaId);
      setFilas(r.filas);
      setConOrigen(r.conOrigen);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setFilas([]);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { filas, conOrigen, loading, error, refresh: cargar };
}
