// ──────────────────────────────────────────────────────────────────────────
// Datos de la planilla de Clientes que no vienen en `useLeads`:
//   - los seguimientos de toda la empresa (con tiempo real),
//   - los nombres de las personas (para decir quién hizo cada cambio),
//   - las listas del equipo (Llamada / Cotiza / Salida a visita), que son las
//     mismas del engranaje de /ventas (`kpi_config`).
// ──────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { DEFAULT_CONFIG } from '@/pages/ventas/Ventas.config';
import { seguimientosPorLead } from './cadencia';
import { cargarNombresPerfiles, cargarSeguimientosEmpresa } from './leadsRpc';
import type { LeadSeguimiento } from './types';

/** Todos los seguimientos de la empresa agrupados por cliente. */
export function useSeguimientosEmpresa() {
  const { empresaId } = useAuth();
  const [filas, setFilas] = useState<LeadSeguimiento[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    try {
      setFilas(await cargarSeguimientosEmpresa(empresaId));
    } catch (e) {
      console.warn('[seguimientos] no se pudieron cargar:', e);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Otro vendedor registra un seguimiento → la planilla lo muestra sin recargar.
  useEffect(() => {
    if (!empresaId) return;
    const ch = supabase
      .channel(`leads-seguimientos-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads_seguimientos', filter: `empresa_id=eq.${empresaId}` },
        (payload) => {
          const nuevo = payload.new as LeadSeguimiento | undefined;
          const viejo = payload.old as { id?: string } | undefined;
          setFilas((prev) => {
            if (payload.eventType === 'DELETE') return prev.filter((s) => s.id !== viejo?.id);
            if (!nuevo?.id) return prev;
            const i = prev.findIndex((s) => s.id === nuevo.id);
            if (i < 0) return [...prev, nuevo];
            const copia = [...prev];
            copia[i] = nuevo;
            return copia;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [empresaId]);

  const porLead = useMemo(() => seguimientosPorLead(filas), [filas]);
  return { porLead, loading, refresh: cargar };
}

// Una sola consulta por empresa aunque varios componentes pidan los nombres.
const cacheNombres = new Map<string, Promise<Map<string, string>>>();

/** id de perfil → nombre, de TODA la empresa (también bodega o taller). */
export function useNombresPerfiles(): Map<string, string> {
  const { empresaId } = useAuth();
  const [nombres, setNombres] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!empresaId) return;
    let vivo = true;
    let promesa = cacheNombres.get(empresaId);
    if (!promesa) {
      promesa = cargarNombresPerfiles().catch((e) => {
        cacheNombres.delete(empresaId);
        console.warn('[nombres] no se pudieron cargar:', e);
        return new Map<string, string>();
      });
      cacheNombres.set(empresaId, promesa);
    }
    promesa.then((m) => {
      if (vivo) setNombres(m);
    });
    return () => {
      vivo = false;
    };
  }, [empresaId]);

  return nombres;
}

export type EquipoVentas = {
  /** Llamada y Persona que cotiza. */
  vendedoras: string[];
  /** Salida a visita. */
  terreno: string[];
};

const limpiar = (v: unknown, def: string[]): string[] =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : def;

/** Las listas del engranaje de /ventas, editables desde la planilla. */
export function useEquipoVentas() {
  const { empresaId } = useAuth();
  const [equipo, setEquipo] = useState<EquipoVentas>({
    vendedoras: DEFAULT_CONFIG.vendedoras,
    terreno: DEFAULT_CONFIG.terreno,
  });

  useEffect(() => {
    if (!empresaId) return;
    let vivo = true;
    (async () => {
      const { data } = await supabase
        .from('kpi_config')
        .select('vendedoras, terreno')
        .eq('empresa_id', empresaId)
        .maybeSingle();
      if (!vivo || !data) return;
      setEquipo({
        vendedoras: limpiar(data.vendedoras, DEFAULT_CONFIG.vendedoras),
        terreno: limpiar(data.terreno, DEFAULT_CONFIG.terreno),
      });
    })();
    return () => {
      vivo = false;
    };
  }, [empresaId]);

  const guardar = useCallback(
    async (nuevo: EquipoVentas) => {
      if (!empresaId) throw new Error('Empresa no resuelta');
      const { error } = await supabase
        .from('kpi_config')
        .upsert(
          {
            empresa_id: empresaId,
            vendedoras: nuevo.vendedoras,
            terreno: nuevo.terreno,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'empresa_id' },
        );
      if (error) throw new Error(error.message);
      setEquipo(nuevo);
    },
    [empresaId],
  );

  return { equipo, guardar };
}
