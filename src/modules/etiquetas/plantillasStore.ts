// Persistencia de las plantillas de etiqueta. Mismo patrón que
// `docCotizacionStore.ts` / `formulasStore.ts`: una clave JSON en
// `configuracion`, con respaldos para poder volver atrás.
//
// La clave es POR ETIQUETA (`etiqueta_plantilla_catalogo`) y no un mapa único:
// así dos personas editando etiquetas distintas no se pisan, cada una tiene sus
// respaldos y su «Restaurar», y lo que se lee al imprimir es un JSON chico.
//
// La lógica pura vive en `plantilla.ts`.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { normalizarPlantilla, type EtiquetaId, type PlantillaEtiqueta } from './plantilla';
import { defDeEtiqueta } from './registro';

export const claveDePlantilla = (id: EtiquetaId): string => `etiqueta_plantilla_${id}`;
export const claveDeRespaldos = (id: EtiquetaId): string => `etiqueta_respaldos_${id}`;

/** Cuántas versiones anteriores se guardan por etiqueta. */
export const MAX_RESPALDOS = 10;

export type RespaldoPlantilla = { fecha: string; autor: string; plantilla: PlantillaEtiqueta };

const defaultDe = (id: EtiquetaId): PlantillaEtiqueta => {
  const def = defDeEtiqueta(id);
  if (!def) throw new Error(`Etiqueta desconocida: ${id}`);
  return def.plantillaDefault;
};

export async function cargarPlantilla(
  empresaId: string,
  id: EtiquetaId,
): Promise<PlantillaEtiqueta> {
  const def = defaultDe(id);
  const { data, error } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('clave', claveDePlantilla(id))
    .maybeSingle<{ valor: string }>();
  if (error) {
    console.warn(`[Etiquetas] No se pudo cargar ${id}, se usa el diseño de fábrica:`, error.message);
    return def;
  }
  if (!data?.valor) return def;
  try {
    return normalizarPlantilla(JSON.parse(data.valor), def);
  } catch {
    return def;
  }
}

/** Varias de una vez: Fase 4 imprime estructura + paños + cenefa en un click. */
export async function cargarPlantillas(
  empresaId: string,
  ids: EtiquetaId[],
): Promise<Partial<Record<EtiquetaId, PlantillaEtiqueta>>> {
  const out: Partial<Record<EtiquetaId, PlantillaEtiqueta>> = {};
  for (const id of ids) out[id] = defaultDe(id);
  if (ids.length === 0) return out;
  const claves = ids.map(claveDePlantilla);
  const { data, error } = await supabase
    .from('configuracion')
    .select('clave, valor')
    .eq('empresa_id', empresaId)
    .in('clave', claves);
  if (error || !data) return out;
  for (const fila of data as { clave: string; valor: string }[]) {
    const id = ids.find((x) => claveDePlantilla(x) === fila.clave);
    if (!id || !fila.valor) continue;
    try {
      out[id] = normalizarPlantilla(JSON.parse(fila.valor), defaultDe(id));
    } catch {
      /* se queda con el default */
    }
  }
  return out;
}

/**
 * Guarda el diseño. Antes respalda el que estaba: una etiqueta mal editada se
 * imprime en cientos de muestras, así que tiene que poder volver atrás.
 */
export async function guardarPlantilla(
  empresaId: string,
  id: EtiquetaId,
  plantilla: PlantillaEtiqueta,
  autor: string,
): Promise<void> {
  await respaldarPlantilla(empresaId, id, autor);
  const { error } = await supabase.from('configuracion').upsert(
    {
      empresa_id: empresaId,
      clave: claveDePlantilla(id),
      valor: JSON.stringify(plantilla),
    },
    { onConflict: 'empresa_id,clave' },
  );
  if (error) throw error;
}

/** Vuelve al diseño de fábrica: se borra lo guardado (el respaldo queda). */
export async function restaurarPlantilla(
  empresaId: string,
  id: EtiquetaId,
  autor: string,
): Promise<void> {
  await respaldarPlantilla(empresaId, id, autor);
  const { error } = await supabase
    .from('configuracion')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('clave', claveDePlantilla(id));
  if (error) throw error;
}

/** El respaldo nunca hace fallar un guardado: si no se puede, se avisa y sigue. */
async function respaldarPlantilla(empresaId: string, id: EtiquetaId, autor: string): Promise<void> {
  try {
    const actual = await cargarPlantilla(empresaId, id);
    const previos = await cargarRespaldos(empresaId, id);
    const lista: RespaldoPlantilla[] = [
      { fecha: new Date().toISOString(), autor, plantilla: actual },
      ...previos,
    ].slice(0, MAX_RESPALDOS);
    await supabase.from('configuracion').upsert(
      { empresa_id: empresaId, clave: claveDeRespaldos(id), valor: JSON.stringify(lista) },
      { onConflict: 'empresa_id,clave' },
    );
  } catch (e) {
    console.warn('[Etiquetas] No se pudo respaldar:', e);
  }
}

export async function cargarRespaldos(
  empresaId: string,
  id: EtiquetaId,
): Promise<RespaldoPlantilla[]> {
  const { data } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('clave', claveDeRespaldos(id))
    .maybeSingle<{ valor: string }>();
  if (!data?.valor) return [];
  try {
    const lista = JSON.parse(data.valor);
    return Array.isArray(lista) ? (lista as RespaldoPlantilla[]) : [];
  } catch {
    return [];
  }
}

/**
 * La plantilla de una etiqueta. Se monta en la PANTALLA que imprime, no en el
 * click: el `window.open` tiene que salir del gesto del usuario o el navegador
 * lo bloquea, así que cuando se aprieta el botón la plantilla ya tiene que
 * estar en memoria.
 */
export function usePlantillaEtiqueta(id: EtiquetaId): {
  plantilla: PlantillaEtiqueta;
  loading: boolean;
  refrescar: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [plantilla, setPlantilla] = useState<PlantillaEtiqueta>(() => defaultDe(id));
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setPlantilla(defaultDe(id));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setPlantilla(await cargarPlantilla(empresaId, id));
    } finally {
      setLoading(false);
    }
  }, [empresaId, id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { plantilla, loading, refrescar: cargar };
}
