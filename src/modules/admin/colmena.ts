// CRUD de colmena_tubos y colmena_panos para Ojo de Dios.
// NOTA: el optimizador escribe colmena_tubos vía RPC sync_colmena_tubos.
// Estos hooks son para edición manual del admin — no usan realtime para
// evitar conflictos con las escrituras masivas del optimizer.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

// ── Tubos ────────────────────────────────────────────────────────────
export type ColmenaTubo = {
  id: string;
  empresa_id: string;
  n_colmena: string;
  cod: string;
  medida_cm: number;
  medida_mm: number;
  serial: string | null;
  tubo_raiz_id: string | null;
  agregado_por_admin: boolean;
  created_at: string;
};

export type TuboInput = {
  n_colmena: string;
  cod: string;
  medida_cm: number;
  serial: string | null;
  procedencia?: string | null;
};

type TuboEvento = 'ingreso' | 'eliminado' | 'ajuste';

export function useColmenaTubos(): {
  tubos: ColmenaTubo[];
  loading: boolean;
  refrescar: () => Promise<void>;
  guardar: (input: TuboInput, id?: string | null) => Promise<void>;
  eliminar: (id: string) => Promise<void>;
} {
  const { empresaId, user } = useAuth();
  const [tubos, setTubos] = useState<ColmenaTubo[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('colmena_tubos')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('n_colmena')
        .order('created_at');
      if (error) throw error;
      setTubos((data || []) as ColmenaTubo[]);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const logEvento = useCallback(
    async (evento: TuboEvento, t: {
      tubo_raiz_id: string | null;
      n_colmena: string;
      cod: string;
      medida_cm: number;
      medida_resultado_cm?: number;
      notas?: string | null;
    }) => {
      const { error } = await supabase.from('tubos_historial').insert({
        empresa_id: empresaId,
        tubo_raiz_id: t.tubo_raiz_id || null,
        n_colmena: t.n_colmena,
        cod: t.cod,
        medida_cm: t.medida_cm,
        medida_resultado_cm: t.medida_resultado_cm ?? t.medida_cm,
        evento,
        notas: t.notas || null,
        registrado_por: user?.email || null,
      });
      if (error) console.error('[tubos_historial]', error.message);
    },
    [empresaId, user],
  );

  const guardar = useCallback(
    async (input: TuboInput, id?: string | null) => {
      if (!empresaId) throw new Error('Empresa no resuelta');
      const payload = {
        empresa_id: empresaId,
        n_colmena: input.n_colmena,
        cod: input.cod,
        medida_cm: input.medida_cm,
        medida_mm: input.medida_cm * 10,
        serial: input.serial,
        agregado_por_admin: true,
      };
      if (id) {
        const { data: ant } = await supabase
          .from('colmena_tubos')
          .select('*')
          .eq('id', id)
          .single<ColmenaTubo>();
        const { error } = await supabase.from('colmena_tubos').update(payload).eq('id', id);
        if (error) throw error;
        await logEvento('ajuste', {
          tubo_raiz_id: ant?.tubo_raiz_id || null,
          n_colmena: input.n_colmena,
          cod: input.cod,
          medida_cm: input.medida_cm,
          medida_resultado_cm: input.medida_cm,
          notas:
            `Ajuste admin — antes: ${ant?.medida_cm}cm → ahora: ${input.medida_cm}cm` +
            (input.procedencia ? ` | Procedencia: ${input.procedencia}` : ''),
        });
      } else {
        const { data: ins, error } = await supabase
          .from('colmena_tubos')
          .insert(payload)
          .select('tubo_raiz_id')
          .single<{ tubo_raiz_id: string | null }>();
        if (error) throw error;
        await logEvento('ingreso', {
          tubo_raiz_id: ins?.tubo_raiz_id || null,
          n_colmena: input.n_colmena,
          cod: input.cod,
          medida_cm: input.medida_cm,
          notas:
            'Ingreso manual' +
            (input.procedencia
              ? ` — Procedencia: ${input.procedencia}`
              : ' — sin procedencia indicada'),
        });
      }
      await cargar();
    },
    [empresaId, logEvento, cargar],
  );

  const eliminar = useCallback(
    async (id: string) => {
      const { data: t } = await supabase
        .from('colmena_tubos')
        .select('*')
        .eq('id', id)
        .single<ColmenaTubo>();
      const { error } = await supabase.from('colmena_tubos').delete().eq('id', id);
      if (error) throw error;
      if (t) {
        await logEvento('eliminado', {
          tubo_raiz_id: t.tubo_raiz_id || null,
          n_colmena: t.n_colmena,
          cod: t.cod,
          medida_cm: t.medida_cm,
          medida_resultado_cm: 0,
          notas: 'Eliminación manual (módulo colmena)',
        });
      }
      await cargar();
    },
    [logEvento, cargar],
  );

  return { tubos, loading, refrescar: cargar, guardar, eliminar };
}

// ── Paños ────────────────────────────────────────────────────────────
export type ColmenaPano = {
  id: string;
  empresa_id: string;
  codigo: string | null;
  medida_ancho: number | null;
  medida_alto: number | null;
  disponible: boolean;
  ot_asignada: string | null;
  fecha_uso: string | null;
  // Usados por Plan de Corte (prioridad Regla 3 + FIFO Regla 4 + ubicación al guardar)
  tipo?: string | null;
  ubicacion?: string | null;
  datos_extra?: { creadoEn?: string; ot_origen?: string; fuente?: string } | null;
};

export type PanoUpdate = {
  codigo: string | null;
  medida_ancho: number | null;
  medida_alto: number | null;
  disponible: boolean;
  ot_asignada: string | null;
};

export function useColmenaPanos(): {
  panos: ColmenaPano[];
  loading: boolean;
  refrescar: () => Promise<void>;
  guardar: (id: string, input: PanoUpdate) => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [panos, setPanos] = useState<ColmenaPano[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('colmena_panos')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('codigo');
      if (error) throw error;
      setPanos((data || []) as ColmenaPano[]);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardar = useCallback(
    async (id: string, input: PanoUpdate) => {
      const { error } = await supabase.from('colmena_panos').update(input).eq('id', id);
      if (error) throw error;
      await cargar();
    },
    [cargar],
  );

  return { panos, loading, refrescar: cargar, guardar };
}
