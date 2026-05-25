import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type {
  CoachingObjecion,
  CoachingTip,
  ObjecionInput,
  TipInput,
} from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─────────────────────────────────────────────────────────────────────
// Carga de contenido de coaching (objeciones + tips) de la empresa.
// Solo trae lo activo; archivar = activo=false (no se borra nunca).
// ─────────────────────────────────────────────────────────────────────
export function useCoaching() {
  const { empresaId } = useAuth();
  const [objeciones, setObjeciones] = useState<CoachingObjecion[]>([]);
  const [tips, setTips] = useState<CoachingTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const [obj, tip] = await Promise.all([
        supabase
          .from('coaching_objeciones' as any)
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('activo', true)
          .order('categoria', { ascending: true })
          .order('orden', { ascending: true }),
        supabase
          .from('coaching_tips' as any)
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('activo', true)
          .order('orden', { ascending: true }),
      ]);
      if (obj.error) throw new Error(obj.error.message);
      if (tip.error) throw new Error(tip.error.message);
      setObjeciones((obj.data as unknown as CoachingObjecion[]) ?? []);
      setTips((tip.data as unknown as CoachingTip[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  return { objeciones, tips, loading, error, refrescar };
}

// ─────────────────────────────────────────────────────────────────────
// Acciones de admin (la RLS bloquea a quien no sea admin)
// ─────────────────────────────────────────────────────────────────────

export async function crearObjecion(empresaId: string, input: ObjecionInput) {
  const { error } = await supabase.from('coaching_objeciones' as any).insert({
    empresa_id: empresaId,
    categoria: input.categoria,
    objecion: input.objecion.trim(),
    respuesta: input.respuesta.trim(),
    orden: input.orden ?? 0,
  });
  if (error) throw new Error(error.message);
}

export async function actualizarObjecion(id: string, patch: Partial<ObjecionInput>) {
  const payload: Record<string, unknown> = {};
  if (patch.categoria !== undefined) payload.categoria = patch.categoria;
  if (patch.objecion !== undefined) payload.objecion = patch.objecion.trim();
  if (patch.respuesta !== undefined) payload.respuesta = patch.respuesta.trim();
  if (patch.orden !== undefined) payload.orden = patch.orden;
  const { error } = await supabase
    .from('coaching_objeciones' as any)
    .update(payload)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// Archivar = ocultar sin borrar (el registro queda en la BD)
export async function archivarObjecion(id: string) {
  const { error } = await supabase
    .from('coaching_objeciones' as any)
    .update({ activo: false })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function crearTip(empresaId: string, input: TipInput) {
  const { error } = await supabase.from('coaching_tips' as any).insert({
    empresa_id: empresaId,
    titulo: input.titulo.trim(),
    contenido: input.contenido.trim(),
    fuente: input.fuente?.trim() || null,
    orden: input.orden ?? 0,
  });
  if (error) throw new Error(error.message);
}

export async function actualizarTip(id: string, patch: Partial<TipInput>) {
  const payload: Record<string, unknown> = {};
  if (patch.titulo !== undefined) payload.titulo = patch.titulo.trim();
  if (patch.contenido !== undefined) payload.contenido = patch.contenido.trim();
  if (patch.fuente !== undefined) payload.fuente = patch.fuente?.trim() || null;
  if (patch.orden !== undefined) payload.orden = patch.orden;
  const { error } = await supabase
    .from('coaching_tips' as any)
    .update(payload)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function archivarTip(id: string) {
  const { error } = await supabase
    .from('coaching_tips' as any)
    .update({ activo: false })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
