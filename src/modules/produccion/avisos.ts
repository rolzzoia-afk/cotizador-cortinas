// El botón de emergencia del taller: cada pantalla puede dejar un recado para
// el encargado de producción, y la bandeja los muestra y los cierra.
//
// Son dos hooks a propósito. `useCrearAviso` es el que usa el botón de cada
// pestaña: solo escribe, así que no se trae la lista ni abre un canal de
// realtime en cada cambio de pestaña. `useAvisos` es el de la bandeja.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { AreaProduccion, AvisoProduccion } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function useCrearAviso(): {
  crear: (mensaje: string, area: AreaProduccion | 'general', ot: string) => Promise<void>;
} {
  const { empresaId, perfil } = useAuth();

  const crear = useCallback(
    async (mensaje: string, area: AreaProduccion | 'general', ot: string) => {
      if (!empresaId) throw new Error('Empresa no resuelta');
      const texto = mensaje.trim();
      if (!texto) throw new Error('El aviso no puede ir en blanco.');
      const { error } = await supabase.from('avisos_produccion' as any).insert({
        empresa_id: empresaId,
        ot: ot.trim(),
        area,
        mensaje: texto,
        creado_por: perfil?.nombre ?? null,
        creado_por_id: perfil?.id ?? null,
      } as any);
      if (error) throw error;
    },
    [empresaId, perfil],
  );

  return { crear };
}

export function useAvisos(): {
  avisos: AvisoProduccion[];
  pendientes: number;
  loading: boolean;
  atender: (id: string) => Promise<void>;
  refrescar: () => Promise<void>;
} {
  const { empresaId, perfil } = useAuth();
  const [avisos, setAvisos] = useState<AvisoProduccion[]>([]);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setAvisos([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('avisos_produccion' as any)
        .select('*')
        .eq('empresa_id', empresaId)
        .order('creado_en', { ascending: false })
        .limit(200);
      if (error) throw error;
      setAvisos((data || []) as unknown as AvisoProduccion[]);
    } catch (e) {
      console.warn('[Producción] No se pudieron cargar los avisos:', e);
      setAvisos([]);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Un aviso nuevo tiene que aparecerle al encargado sin que recargue: por eso
  // la bandeja escucha en vivo aunque el que avisa esté en otro computador.
  useEffect(() => {
    if (!empresaId) return;
    const canal = supabase
      .channel(`avisos-prod-${crypto.randomUUID()}`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'avisos_produccion',
          filter: `empresa_id=eq.${empresaId}`,
        },
        (payload: { eventType: string; new?: AvisoProduccion; old?: { id: string } }) => {
          if (payload.eventType === 'DELETE') {
            const delId = payload.old?.id;
            if (delId) setAvisos((prev) => prev.filter((a) => a.id !== delId));
            return;
          }
          const aviso = payload.new;
          if (!aviso) return;
          setAvisos((prev) => {
            const i = prev.findIndex((a) => a.id === aviso.id);
            if (i < 0) return [aviso, ...prev];
            const next = [...prev];
            next[i] = aviso;
            return next;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [empresaId]);

  const atender = useCallback(
    async (id: string) => {
      // Optimista: el encargado va marcando varios seguidos.
      setAvisos((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                atendido: true,
                atendido_por: perfil?.nombre ?? null,
                atendido_en: new Date().toISOString(),
              }
            : a,
        ),
      );
      const { error } = await supabase
        .from('avisos_produccion' as any)
        .update({
          atendido: true,
          atendido_por: perfil?.nombre ?? null,
          atendido_en: new Date().toISOString(),
        } as any)
        .eq('id', id);
      if (error) {
        await cargar();
        throw error;
      }
    },
    [perfil, cargar],
  );

  return {
    avisos,
    pendientes: avisos.filter((a) => !a.atendido).length,
    loading,
    atender,
    refrescar: cargar,
  };
}
