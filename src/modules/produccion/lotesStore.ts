// Los lotes de producción en Supabase.
//
// Una fila por lote: crear y deshacer son un INSERT y un DELETE de esa fila, no
// un read-modify-write de un array compartido. Es a propósito — la empresa ya
// perdió datos por dos escrituras pisándose sobre estado compartido.
//
// Las reglas (qué es un lote, cómo se lee una fila, qué queda afuera) viven en
// `lotes.ts`, que es puro y está probado. Acá solo está la plomería.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { parseLoteRow, type LoteOtRef, type LoteProduccion } from './lotes';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Un error de Supabase NO es un Error de JavaScript: si se relanza tal cual,
 * el `String(e)` del toast lo deja en «[object Object]» y nadie sabe qué pasó.
 * Acá se arma el mensaje de verdad, con los dos casos que se van a ver seguido:
 * la migración sin correr y el nombre repetido.
 */
export function mensajeErrorLote(error: {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}): string {
  const code = error?.code || '';
  // PGRST205 = PostgREST no conoce la tabla; 42P01 = Postgres dice que no existe.
  if (code === 'PGRST205' || code === '42P01' || /lotes_produccion/i.test(error?.message || '')) {
    if (/does not exist|could not find|no existe/i.test(error?.message || '')) {
      return 'Falta correr la migración sql/20260901_lotes_produccion.sql: la tabla de lotes todavía no existe en la base de datos.';
    }
  }
  if (code === '42501' || /row-level security/i.test(error?.message || '')) {
    return 'Solo un administrador puede crear o deshacer lotes.';
  }
  const partes = [error?.message, error?.details, error?.hint].filter(Boolean);
  return partes.join(' · ') || `Error de la base de datos${code ? ` (${code})` : ''}`;
}

export function useLotes(): {
  lotes: LoteProduccion[];
  loading: boolean;
  /** Por qué no se pudieron leer los lotes (o null). Se muestra en pantalla. */
  error: string | null;
  crear: (nombre: string, ots: LoteOtRef[]) => Promise<void>;
  eliminar: (id: string) => Promise<void>;
  refrescar: () => Promise<void>;
} {
  const { empresaId, perfil } = useAuth();
  const [lotes, setLotes] = useState<LoteProduccion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setLotes([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('lotes_produccion' as any)
        .select('*')
        .eq('empresa_id', empresaId)
        .order('creado_en', { ascending: false });
      if (err) throw err;
      // La tabla es nueva y no está en los tipos generados: nada de confiar en
      // la forma de la fila.
      setLotes(((data || []) as unknown[]).map(parseLoteRow).filter((l): l is LoteProduccion => !!l));
      setError(null);
    } catch (e) {
      console.warn('[Producción] No se pudieron cargar los lotes:', e);
      setLotes([]);
      setError(mensajeErrorLote(e as { message?: string }));
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // El jefe arma el lote en la oficina y el taller tiene que verlo sin recargar.
  useEffect(() => {
    if (!empresaId) return;
    const canal = supabase
      .channel(`lotes-prod-${crypto.randomUUID()}`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'lotes_produccion',
          filter: `empresa_id=eq.${empresaId}`,
        },
        (payload: { eventType: string; new?: unknown; old?: { id?: string } }) => {
          if (payload.eventType === 'DELETE') {
            const delId = payload.old?.id;
            if (delId) setLotes((prev) => prev.filter((l) => l.id !== delId));
            return;
          }
          const lote = parseLoteRow(payload.new);
          if (!lote) return;
          setLotes((prev) => {
            const i = prev.findIndex((l) => l.id === lote.id);
            if (i < 0) return [lote, ...prev];
            const next = [...prev];
            next[i] = lote;
            return next;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [empresaId]);

  const crear = useCallback(
    async (nombre: string, ots: LoteOtRef[]) => {
      if (!empresaId) throw new Error('Empresa no resuelta');
      const texto = nombre.trim();
      if (!texto) throw new Error('El lote necesita un nombre.');
      if (ots.length === 0) throw new Error('Elige al menos una OT.');
      const { error } = await supabase.from('lotes_produccion' as any).insert({
        empresa_id: empresaId,
        nombre: texto,
        ots,
        creado_por: perfil?.nombre ?? null,
        creado_por_id: perfil?.id ?? null,
      } as any);
      if (error) {
        if (error.code === '23505') throw new Error(`Ya existe un lote llamado «${texto}».`);
        throw new Error(mensajeErrorLote(error));
      }
      await cargar();
    },
    [empresaId, perfil, cargar],
  );

  const eliminar = useCallback(
    async (id: string) => {
      if (!empresaId) throw new Error('Empresa no resuelta');
      const { error } = await supabase
        .from('lotes_produccion' as any)
        .delete()
        .eq('id', id)
        .eq('empresa_id', empresaId);
      if (error) throw new Error(mensajeErrorLote(error));
      setLotes((prev) => prev.filter((l) => l.id !== id));
    },
    [empresaId],
  );

  return { lotes, loading, error, crear, eliminar, refrescar: cargar };
}
