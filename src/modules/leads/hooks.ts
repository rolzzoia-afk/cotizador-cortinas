import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Lead, LeadActividad, LeadEstado, LeadInput, LeadSeguimiento } from './types';
import { asignarLead, editarLead, type PatchLead } from './leadsRpc';

// Las lecturas y los `rpc` viejos siguen con `as any` (venían de antes de
// regenerar los tipos). Lo nuevo va tipado en `leadsRpc.ts`.
/* eslint-disable @typescript-eslint/no-explicit-any */

/** Del formulario a lo que acepta `lead_editar` (texto vacío = sin dato). */
function patchDesdeInput(input: Partial<LeadInput>): PatchLead {
  const p: PatchLead = {};
  const texto = (v: string | undefined) => (v === undefined ? undefined : v.trim() || null);
  if (input.nombre !== undefined) p.nombre = input.nombre.trim();
  if (input.whatsapp_phone !== undefined) p.whatsapp_phone = texto(input.whatsapp_phone) ?? null;
  if (input.email !== undefined) p.email = texto(input.email) ?? null;
  if (input.rut !== undefined) p.rut = texto(input.rut) ?? null;
  if (input.comuna !== undefined) p.comuna = texto(input.comuna) ?? null;
  if (input.fuente !== undefined && input.fuente.trim()) p.fuente = input.fuente.trim();
  if (input.presupuesto_rango !== undefined) p.presupuesto_rango = texto(input.presupuesto_rango) ?? null;
  if (input.comentarios !== undefined) p.comentarios = texto(input.comentarios) ?? null;
  if (input.instagram !== undefined) p.instagram = texto(input.instagram) ?? null;
  if (input.region !== undefined) p.region = texto(input.region) ?? null;
  if (input.anuncio !== undefined) p.anuncio = texto(input.anuncio) ?? null;
  if (input.mensaje !== undefined) p.mensaje = texto(input.mensaje) ?? null;
  if (input.llamada_por !== undefined) p.llamada_por = texto(input.llamada_por) ?? null;
  if (input.cotizado_por !== undefined) p.cotizado_por = texto(input.cotizado_por) ?? null;
  if (input.visita_por !== undefined) p.visita_por = texto(input.visita_por) ?? null;
  if (input.monto !== undefined) p.monto = input.monto && input.monto > 0 ? input.monto : null;
  return p;
}

export function useLeads() {
  const { empresaId, user } = useAuth();
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
        whatsapp_phone: input.whatsapp_phone?.trim() || null,
        email: input.email?.trim() || null,
        rut: input.rut?.trim() || null,
        comuna: input.comuna?.trim() || null,
        fuente: input.fuente?.trim() || 'manual',
        asignado_a: input.asignado_a || null,
        estado: input.estado || 'nuevo',
        presupuesto_rango: input.presupuesto_rango?.trim() || null,
        comentarios: input.comentarios?.trim() || null,
        instagram: input.instagram?.trim() || null,
        region: input.region?.trim() || null,
        anuncio: input.anuncio?.trim() || null,
        mensaje: input.mensaje?.trim() || null,
        llamada_por: input.llamada_por?.trim() || null,
        cotizado_por: input.cotizado_por?.trim() || null,
        visita_por: input.visita_por?.trim() || null,
        monto: input.monto && input.monto > 0 ? input.monto : null,
      };
      const { data, error: err } = await supabase
        .from('leads' as any)
        .insert(row)
        .select('*')
        .single();
      if (err) throw new Error(err.message);
      const nuevo = (data as unknown) as Lead;

      await supabase.from('leads_actividad' as any).insert({
        lead_id: nuevo.id,
        empresa_id: empresaId,
        tipo: 'creado',
        detalle: { nombre: nuevo.nombre, fuente: nuevo.fuente },
        registrado_por: user?.id ?? null,
      });

      setLeads((prev) => [nuevo, ...prev]);
      return nuevo;
    },
    [empresaId, user?.id],
  );

  // Editar deja rastro: una entrada «Editó …» con de → a y quién lo hizo.
  const actualizar = useCallback(
    async (id: string, patch: Partial<LeadInput>): Promise<Lead | null> => {
      let actualizado = await editarLead(id, patchDesdeInput(patch));
      if (patch.asignado_a !== undefined) {
        actualizado = await asignarLead(id, patch.asignado_a || null);
      }
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

export function useLeadDetalle(leadId: string | null) {
  const { empresaId } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [actividad, setActividad] = useState<LeadActividad[]>([]);
  const [seguimientos, setSeguimientos] = useState<LeadSeguimiento[]>([]);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
    if (!leadId || !empresaId) {
      setLead(null);
      setActividad([]);
      setSeguimientos([]);
      return;
    }
    setLoading(true);
    const [{ data: leadData }, { data: actData }, { data: segData }] = await Promise.all([
      supabase.from('leads' as any).select('*').eq('id', leadId).maybeSingle(),
      supabase
        .from('leads_actividad' as any)
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false }),
      supabase.from('leads_seguimientos').select('*').eq('lead_id', leadId).order('n'),
    ]);
    setLead((leadData as unknown) as Lead | null);
    setActividad(((actData || []) as unknown) as LeadActividad[]);
    setSeguimientos(((segData || []) as unknown) as LeadSeguimiento[]);
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

  return { lead, actividad, seguimientos, loading, refresh: cargar, agregarComentario };
}

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
