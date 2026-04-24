// Correcciones del plan de corte: edita el último plan de cortes,
// guarda correcciones individuales en `correcciones`, y permite restaurar
// planes históricos. Equivalente al tab "Correcciones" del legacy.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Json } from '@/types/database';

// ── Tipos compartidos ───────────────────────────────────────────────
export type TipoError =
  | 'medida_erronea'
  | 'tubo_equivocado'
  | 'tubo_inexistente'
  | 'tubo_danado';

export const TIPO_ERROR_LABELS: Record<TipoError, string> = {
  medida_erronea: 'Medida errónea',
  tubo_equivocado: 'Tubo equivocado',
  tubo_inexistente: 'Tubo no existe en colmena',
  tubo_danado: 'Tubo dañado / inutilizable',
};

export type LineaPlan = {
  resultado?: {
    codigo?: string;
    codigo_original?: string;
    medida_cm?: number;
    colmena?: string | number;
    [k: string]: unknown;
  };
  orden?: {
    ot?: string;
    ubic?: string;
    cod?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
};

export type Plan = {
  id: string;
  empresa_id: string;
  optimizer_email: string | null;
  resultados: LineaPlan[];
  ordenes: Array<{ ot?: string; ubic?: string; cod?: string }>;
  fecha: string | null;
  fecha_correccion: string | null;
  tipo: string | null;
  snapshot_inventario: unknown;
};

export type CorreccionPendiente = {
  tipo: TipoError | '';
  nuevaMedida: number | null;
  nuevoCodigo: string | null;
  nota: string;
};

export type CorreccionRow = {
  id: string;
  empresa_id: string;
  plan_id: string | null;
  tipo: string | null;
  linea_idx: number | null;
  nota: string | null;
  timestamp: string;
};

// ── Helpers de parseo ───────────────────────────────────────────────
function parseLineas(raw: unknown): LineaPlan[] {
  if (Array.isArray(raw)) return raw as LineaPlan[];
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as LineaPlan[];
    } catch {
      return [];
    }
  }
  return [];
}

function parseOrdenes(raw: unknown): Array<{ ot?: string; ubic?: string; cod?: string }> {
  if (Array.isArray(raw)) return raw as Array<{ ot?: string; ubic?: string; cod?: string }>;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [];
}

// ── Hook: Config del optimizador (email) ────────────────────────────
export function useOptimizerConfig(): {
  email: string;
  loading: boolean;
  guardar: (email: string) => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) return;
    let cancelado = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('configuracion')
        .select('valor')
        .eq('empresa_id', empresaId)
        .eq('clave', 'optimizer_config_email')
        .maybeSingle<{ valor: string }>();
      if (!cancelado) {
        setEmail(data?.valor || '');
        setLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [empresaId]);

  const guardar = useCallback(
    async (nuevo: string) => {
      if (!empresaId) throw new Error('Empresa no resuelta');
      const e = nuevo.trim().toLowerCase();
      if (!e || !e.includes('@')) throw new Error('Ingresá un email válido');
      const { error } = await supabase
        .from('configuracion')
        .upsert(
          { empresa_id: empresaId, clave: 'optimizer_config_email', valor: e },
          { onConflict: 'empresa_id,clave' },
        );
      if (error) throw error;
      setEmail(e);
    },
    [empresaId],
  );

  return { email, loading, guardar };
}

// ── Hook: Plan activo + correcciones ────────────────────────────────
type PlanRow = {
  id: string;
  empresa_id: string;
  optimizer_email: string | null;
  resultados: unknown;
  ordenes: unknown;
  fecha: string | null;
  fecha_correccion: string | null;
  tipo: string | null;
  snapshot_inventario: unknown;
};

export function usePlanActivo(): {
  plan: Plan | null;
  loading: boolean;
  status: string;
  pendientes: Record<number, CorreccionPendiente>;
  setPendiente: (idx: number, c: CorreccionPendiente) => void;
  removerPendiente: (idx: number) => void;
  cargar: () => Promise<void>;
  aplicarTodo: () => Promise<number>;
} {
  const { empresaId } = useAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [pendientes, setPendientes] = useState<Record<number, CorreccionPendiente>>({});

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    setStatus('Cargando plan...');
    try {
      const { data, error } = await supabase
        .from('planes_corte')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle<PlanRow>();
      if (error) throw error;
      if (!data) {
        setPlan(null);
        setStatus('No hay plan guardado.');
        return;
      }
      const lineas = parseLineas(data.resultados);
      const ordenes = parseOrdenes(data.ordenes);
      const planObj: Plan = {
        id: data.id,
        empresa_id: data.empresa_id,
        optimizer_email: data.optimizer_email,
        resultados: lineas,
        ordenes,
        fecha: data.fecha,
        fecha_correccion: data.fecha_correccion,
        tipo: data.tipo,
        snapshot_inventario: data.snapshot_inventario,
      };
      setPlan(planObj);
      setPendientes({});
      const fechaStr = data.fecha
        ? new Date(data.fecha).toLocaleString('es-CL')
        : '';
      const optim = data.optimizer_email ? ` · ${data.optimizer_email}` : '';
      if (lineas.length === 0) {
        setStatus('El plan no tiene cortes registrados.');
      } else {
        setStatus(`${lineas.length} cortes${fechaStr ? ' — ' + fechaStr : ''}${optim}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus('Error: ' + msg);
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  const setPendiente = useCallback((idx: number, c: CorreccionPendiente) => {
    setPendientes((prev) => ({ ...prev, [idx]: c }));
  }, []);

  const removerPendiente = useCallback((idx: number) => {
    setPendientes((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  }, []);

  const aplicarTodo = useCallback(async (): Promise<number> => {
    if (!empresaId) throw new Error('Empresa no resuelta');
    if (!plan) throw new Error('Plan no cargado');
    if (Object.keys(pendientes).length === 0)
      throw new Error('No hay correcciones pendientes');

    // Aplicar correcciones en una copia profunda
    const planCorregido: LineaPlan[] = JSON.parse(JSON.stringify(plan.resultados));
    const ahora = new Date().toISOString();
    const registros: Array<{ idx: number; tipo: string; nota: string }> = [];

    for (const [idxStr, corr] of Object.entries(pendientes)) {
      const idx = parseInt(idxStr, 10);
      const item = planCorregido[idx];
      if (!item) continue;
      const res = (item.resultado || item) as LineaPlan['resultado'];
      if (!res) continue;
      if (corr.tipo === 'medida_erronea' && corr.nuevaMedida !== null) {
        res.medida_cm = corr.nuevaMedida;
      } else if (corr.tipo === 'tubo_equivocado' && corr.nuevoCodigo) {
        res.codigo = corr.nuevoCodigo;
        res.codigo_original = corr.nuevoCodigo;
      } else if (
        corr.tipo === 'tubo_inexistente' ||
        corr.tipo === 'tubo_danado'
      ) {
        (res as Record<string, unknown>)._error = corr.tipo;
        (res as Record<string, unknown>)._nota = corr.nota;
      }
      registros.push({ idx, tipo: corr.tipo || '', nota: corr.nota || '' });
    }

    // Insertar nuevo plan corregido (crea historial)
    const { data: nuevoPlan, error: insErr } = await supabase
      .from('planes_corte')
      .insert({
        empresa_id: empresaId,
        optimizer_email: plan.optimizer_email,
        resultados: planCorregido as unknown as Json,
        ordenes: plan.ordenes as unknown as Json,
        fecha: ahora,
        fecha_correccion: ahora,
      })
      .select('id')
      .maybeSingle<{ id: string }>();
    if (insErr) throw insErr;

    const nuevoPlanId = nuevoPlan?.id || plan.id;

    // Insertar registros de corrección
    if (registros.length > 0) {
      const corrRows = registros.map((r) => ({
        empresa_id: empresaId,
        plan_id: nuevoPlanId,
        tipo: r.tipo,
        linea_idx: r.idx,
        nota: r.nota,
        timestamp: ahora,
      }));
      const { error: corrErr } = await supabase.from('correcciones').insert(corrRows);
      if (corrErr) throw corrErr;
    }

    // Actualizar estado local
    setPlan({
      ...plan,
      id: nuevoPlanId,
      resultados: planCorregido,
      fecha_correccion: ahora,
    });
    setPendientes({});
    setStatus(`${registros.length} corrección(es) aplicada(s) — ${ahora.slice(0, 10)}`);
    return registros.length;
  }, [empresaId, plan, pendientes]);

  return {
    plan,
    loading,
    status,
    pendientes,
    setPendiente,
    removerPendiente,
    cargar,
    aplicarTodo,
  };
}

// ── Hook: Historial de correcciones ─────────────────────────────────
export function useCorreccionesHistorial(): {
  registros: CorreccionRow[];
  loading: boolean;
  cargar: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [registros, setRegistros] = useState<CorreccionRow[]>([]);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('correcciones')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('timestamp', { ascending: false })
        .limit(50);
      if (error) throw error;
      setRegistros((data || []) as CorreccionRow[]);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  return { registros, loading, cargar };
}

// ── Hook: Historial de planes ───────────────────────────────────────
export type PlanResumen = {
  id: string;
  fecha: string | null;
  fecha_correccion: string | null;
  optimizer_email: string | null;
  tipo: string | null;
  resultados: LineaPlan[];
  ordenes: Array<{ ot?: string; ubic?: string; cod?: string }>;
  snapshot_inventario: unknown[];
  nCortes: number;
};

export type RestauracionResult = {
  count_antes: number;
  count_despues: number;
  // Campos que devuelve la RPC actualizada con el fix de tombstone.
  // Opcionales por compatibilidad con la versión vieja por si no se
  // deployó todavía.
  count_en_snapshot?: number;
  count_omitidos_tombstone?: number;
};

export function usePlanesHistorial(): {
  planes: PlanResumen[];
  loading: boolean;
  cargar: () => Promise<void>;
  restaurar: (planId: string, email: string) => Promise<RestauracionResult>;
} {
  const { empresaId } = useAuth();
  const [planes, setPlanes] = useState<PlanResumen[]>([]);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('planes_corte')
        .select(
          'id, fecha, fecha_correccion, resultados, ordenes, optimizer_email, tipo, snapshot_inventario',
        )
        .eq('empresa_id', empresaId)
        .or('tipo.is.null,tipo.neq.respaldo')
        .order('fecha', { ascending: false })
        .limit(30);
      if (error) throw error;
      const lista: PlanResumen[] = (data || []).map((p: Record<string, unknown>) => {
        const lineas = parseLineas(p.resultados);
        let snap = p.snapshot_inventario;
        if (typeof snap === 'string') {
          try {
            snap = JSON.parse(snap);
          } catch {
            snap = [];
          }
        }
        return {
          id: String(p.id),
          fecha: (p.fecha as string) || null,
          fecha_correccion: (p.fecha_correccion as string) || null,
          optimizer_email: (p.optimizer_email as string) || null,
          tipo: (p.tipo as string) || null,
          resultados: lineas,
          ordenes: parseOrdenes(p.ordenes),
          snapshot_inventario: Array.isArray(snap) ? snap : [],
          nCortes: lineas.length,
        };
      });
      setPlanes(lista);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  const restaurar = useCallback(
    async (planId: string, email: string) => {
      if (!email) throw new Error('Configura primero el email del optimizador');
      const { data, error } = await supabase.rpc('restaurar_plan_de_corte', {
        p_plan_id: planId,
        p_email: email,
      });
      if (error) throw error;
      return (data as RestauracionResult) || {
        count_antes: 0,
        count_despues: 0,
      };
    },
    [],
  );

  return { planes, loading, cargar, restaurar };
}
