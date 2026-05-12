import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Lead, LeadActividad, LeadEstado, LeadInput } from './types';

// Tipos generados de Supabase no incluyen aún la tabla `leads` ni las RPCs.
// Cast localizado a `any` para evitar errores de TS hasta regenerar tipos.
/* eslint-disable @typescript-eslint/no-explicit-any */

export function useLeads() {
  const { empresaId } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('leads' as any)
      .select('*')
      .eq('empresa_id', empresaId)
      .order('ultima_actividad_at', { ascending: false });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setLeads(((data || []) as unknown) as Lead[]);
    setLoading(false);
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Realtime: cambios sobre leads de esta empresa.
  useEffect(() => {
    if (!empresaId) return;
    const channelName = `leads-realtime-${crypto.randomUUID()}`;
    const ch = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: `empresa_id=eq.${empresaId}`,
        },
        (payload: { eventType: string; new?: Lead; old?: { id: string } }) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            setLeads((prev) =>
              prev.find((l) => l.id === payload.new!.id) ? prev : [payload.new!, ...prev],
            );
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updated = payload.new;
            setLeads((prev) => {
              const idx = prev.findIndex((l) => l.id === updated.id);
              if (idx < 0) return [updated, ...prev];
              const next = [...prev];
              next[idx] = updated;
              return next;
            });
          } else if (payload.eventType === 'DELETE' && payload.old?.id) {
            const delId = payload.old.id;
            setLeads((prev) => prev.filter((l) => l.id !== delId));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [empresaId]);

  const crear = useCallback(
    async (input: LeadInput): Promise<Lead | null> => {
      if (!empresaId) throw new Error('Empresa no resuelta');
      const row = {
        empresa_id: empresaId,
        nombre: input.nombre.trim(),
        telefono: input.telefono?.trim() || null,
        email: input.email?.trim() || null,
        rut: input.rut?.trim() || null,
        canal: input.canal?.trim() || null,
        ubicacion: input.ubicacion?.trim() || null,
        vendedora_id: input.vendedora_id || null,
        estado: input.estado || 'nuevo',
        valor_estimado: input.valor_estimado ?? null,
        comentarios: input.comentarios?.trim() || null,
      };
      const { data, error: err } = await supabase
        .from('leads' as any)
        .insert(row)
        .select('*')
        .single();
      if (err) throw new Error(err.message);
      const nuevo = (data as unknown) as Lead;

      // Activity log: creación (best-effort, no bloqueante)
      await supabase
        .from('leads_actividad' as any)
        .insert({
          lead_id: nuevo.id,
          empresa_id: empresaId,
          tipo: 'creado',
          detalle: { nombre: nuevo.nombre, canal: nuevo.canal },
        });

      setLeads((prev) => [nuevo, ...prev]);
      return nuevo;
    },
    [empresaId],
  );

  const actualizar = useCallback(
    async (id: string, patch: Partial<LeadInput>): Promise<Lead | null> => {
      const row: Record<string, unknown> = {};
      if (patch.nombre !== undefined) row.nombre = patch.nombre.trim();
      if (patch.telefono !== undefined) row.telefono = patch.telefono?.trim() || null;
      if (patch.email !== undefined) row.email = patch.email?.trim() || null;
      if (patch.rut !== undefined) row.rut = patch.rut?.trim() || null;
      if (patch.canal !== undefined) row.canal = patch.canal?.trim() || null;
      if (patch.ubicacion !== undefined) row.ubicacion = patch.ubicacion?.trim() || null;
      if (patch.vendedora_id !== undefined) row.vendedora_id = patch.vendedora_id || null;
      if (patch.valor_estimado !== undefined) row.valor_estimado = patch.valor_estimado ?? null;
      if (patch.comentarios !== undefined) row.comentarios = patch.comentarios?.trim() || null;
      row.ultima_actividad_at = new Date().toISOString();

      const { data, error: err } = await supabase
        .from('leads' as any)
        .update(row)
        .eq('id', id)
        .select('*')
        .single();
      if (err) throw new Error(err.message);
      const actualizado = (data as unknown) as Lead;
      setLeads((prev) => prev.map((l) => (l.id === id ? actualizado : l)));
      return actualizado;
    },
    [],
  );

  const cambiarEstado = useCallback(
    async (
      id: string,
      nuevoEstado: LeadEstado,
      motivo?: string,
      comentario?: string,
    ): Promise<Lead | null> => {
      const { data, error: err } = await supabase.rpc('lead_cambiar_estado' as any, {
        p_lead_id: id,
        p_nuevo_estado: nuevoEstado,
        p_motivo: motivo ?? null,
        p_comentario: comentario ?? null,
      });
      if (err) throw new Error(err.message);
      const actualizado = (data as unknown) as Lead;
      setLeads((prev) => prev.map((l) => (l.id === id ? actualizado : l)));
      return actualizado;
    },
    [],
  );

  const vincularOT = useCallback(
    async (id: string, otId: string): Promise<Lead | null> => {
      const { data, error: err } = await supabase.rpc('lead_vincular_ot' as any, {
        p_lead_id: id,
        p_ot_id: otId,
      });
      if (err) throw new Error(err.message);
      const actualizado = (data as unknown) as Lead;
      setLeads((prev) => prev.map((l) => (l.id === id ? actualizado : l)));
      return actualizado;
    },
    [],
  );

  const eliminar = useCallback(async (id: string): Promise<void> => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    const { error: err } = await supabase.from('leads' as any).delete().eq('id', id);
    if (err) throw new Error(err.message);
  }, []);

  return {
    leads,
    loading,
    error,
    refresh: cargar,
    crear,
    actualizar,
    cambiarEstado,
    vincularOT,
    eliminar,
  };
}

// Hook un solo lead + su historial de actividad
export function useLeadDetalle(leadId: string | null) {
  const { empresaId } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [actividad, setActividad] = useState<LeadActividad[]>([]);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
    if (!leadId || !empresaId) {
      setLead(null);
      setActividad([]);
      return;
    }
    setLoading(true);
    const [{ data: leadData }, { data: actData }] = await Promise.all([
      supabase.from('leads' as any).select('*').eq('id', leadId).maybeSingle(),
      supabase
        .from('leads_actividad' as any)
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false }),
    ]);
    setLead((leadData as unknown) as Lead | null);
    setActividad(((actData || []) as unknown) as LeadActividad[]);
    setLoading(false);
  }, [leadId, empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const agregarComentario = useCallback(
    async (texto: string) => {
      if (!leadId) return;
      const { error: err } = await supabase.rpc('lead_agregar_comentario' as any, {
        p_lead_id: leadId,
        p_texto: texto,
      });
      if (err) throw new Error(err.message);
      await cargar();
    },
    [leadId, cargar],
  );

  return { lead, actividad, loading, refresh: cargar, agregarComentario };
}

// Vendedoras (perfiles con rol='ventas' activos) para el selector de asignación
export type VendedoraOpt = { id: string; nombre: string };

export function useVendedoras(): { vendedoras: VendedoraOpt[]; loading: boolean } {
  const { empresaId } = useAuth();
  const [vendedoras, setVendedoras] = useState<VendedoraOpt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('perfiles')
        .select('id, nombre, rol')
        .eq('empresa_id', empresaId)
        .in('rol', ['ventas', 'admin']);
      const opts = (data || [])
        .map((p) => ({ id: String(p.id), nombre: String(p.nombre ?? 'Sin nombre') }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-CL'));
      setVendedoras(opts);
      setLoading(false);
    })();
  }, [empresaId]);

  return { vendedoras, loading };
}
