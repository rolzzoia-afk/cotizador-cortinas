// Lectura y escritura de las listas del formulario de un insumo.
//
// Se lee la tabla ENTERA, incluidos los valores desactivados: la pantalla de
// Configuración tiene que poder mostrarlos para reactivarlos, y el filtro de
// «qué se ofrece en el alta» lo hace `mapaDeValidadores`, no la consulta.
//
// Nunca se BORRA un valor. Un valor borrado deja artículos apuntando a algo
// que el formulario ya no conoce, que es justo el agujero que el SQL 02 vino a
// tapar. Se desactiva: deja de ofrecerse y las fichas viejas siguen enteras.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Validador } from './helpers';
import { normalizarValorValidador } from './validadores';

function motivoDe(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  if (code === '42501') return 'Tu usuario no tiene permiso para cambiar estas listas.';
  if (code === '23505') return 'Ese valor ya estaba en la lista.';
  if (code === 'PGRST205' || code === '42P01')
    return 'Falta la tabla validadores_insumos en la base.';
  return (e as { message?: string })?.message || String(e);
}

export function useValidadores(): {
  filas: Validador[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [filas, setFilas] = useState<Validador[]>([]);
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
    const { data, error: e } = await supabase
      .from('validadores_insumos')
      .select('id,campo,valor,orden,activo')
      .eq('empresa_id', empresaId)
      .order('campo')
      .order('orden', { nullsFirst: true })
      .order('valor');
    if (e) {
      setError(motivoDe(e));
      setFilas([]);
    } else {
      setFilas((data || []) as Validador[]);
    }
    setLoading(false);
  }, [empresaId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { filas, loading, error, recargar: cargar };
}

/**
 * Los valores que los ARTÍCULOS traen escritos hoy, por campo.
 *
 * Es lo que se compara contra las listas para encontrar el hueco: si un
 * artículo dice «TORNILLERIA» y el desplegable no la ofrece, alguien va a
 * tener que volver a mandarlo a MATERIALES la próxima vez que lo edite.
 */
export function useValoresEnUso(): {
  enUso: Record<string, string[]>;
  loading: boolean;
} {
  const { empresaId } = useAuth();
  const [enUso, setEnUso] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) {
      setEnUso({});
      setLoading(false);
      return;
    }
    let vivo = true;
    (async () => {
      const { data } = await supabase
        .from('insumos')
        .select('categoria,sub_categoria,color,producto,proveedor,compra,ubicacion')
        .eq('empresa_id', empresaId);
      if (!vivo) return;
      const filas = (data || []) as Array<Record<string, string | null>>;
      const junta = (col: string) => filas.map((f) => f[col]).filter((v): v is string => !!v);
      setEnUso({
        CATEGORIA: junta('categoria'),
        SUB_CATEGORIA: junta('sub_categoria'),
        COLOR: junta('color'),
        PRODUCTO: junta('producto'),
        PROVEEDOR: junta('proveedor'),
        COMPRA: junta('compra'),
        UBICACION: junta('ubicacion'),
      });
      setLoading(false);
    })();
    return () => {
      vivo = false;
    };
  }, [empresaId]);

  return { enUso, loading };
}

/**
 * Agrega valores a una lista. Recibe varios de una vez porque el caso normal
 * es «los 6 que los artículos usan y el formulario no ofrecía».
 *
 * El `orden` arranca después del más alto que ya haya, para que lo agregado
 * quede al final del desplegable y no se mezcle con lo de siempre.
 */
export async function agregarValores(
  empresaId: string,
  campo: string,
  valores: string[],
  ordenDesde: number,
): Promise<{ ok: true; agregados: number } | { ok: false; motivo: string }> {
  const limpios = [...new Set(valores.map(normalizarValorValidador).filter(Boolean))];
  if (limpios.length === 0) return { ok: true, agregados: 0 };

  const { error } = await supabase.from('validadores_insumos').insert(
    limpios.map((valor, i) => ({
      empresa_id: empresaId,
      campo,
      valor,
      orden: ordenDesde + i,
      activo: true,
    })),
  );
  if (error) return { ok: false, motivo: motivoDe(error) };
  return { ok: true, agregados: limpios.length };
}

/** Enciende o apaga un valor. Apagarlo lo saca del alta, no de las fichas. */
export async function cambiarActivoValidador(
  id: string,
  activo: boolean,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { error } = await supabase.from('validadores_insumos').update({ activo }).eq('id', id);
  if (error) return { ok: false, motivo: motivoDe(error) };
  return { ok: true };
}
