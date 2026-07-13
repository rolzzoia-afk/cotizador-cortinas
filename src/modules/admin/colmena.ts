// CRUD de colmena_tubos y colmena_panos para Ojo de Dios.
// NOTA: el optimizador escribe colmena_tubos vía RPC sync_colmena_tubos.
// Estos hooks son para edición manual del admin — no usan realtime para
// evitar conflictos con las escrituras masivas del optimizer.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

// Rango sano de medidas de tubos (Phase 2 inventario, 2026-05-13).
// Coincide con el CHECK constraint en BD `colmena_tubos_medida_rango_check`.
// Mínimo 10cm: por debajo no hay corte funcional (un peso pesa ~30-50cm).
// Máximo 2000cm (20m): los tubos vírgenes más largos son ~578cm; 2000 da
// margen amplio sin permitir typos absurdos (3201 en vez de 320.1).
export const MEDIDA_CM_MIN = 10;
export const MEDIDA_CM_MAX = 2000;

export function validarMedidaCm(medida: number | null | undefined): string | null {
  if (medida == null || Number.isNaN(medida)) return 'La medida es obligatoria';
  if (medida < MEDIDA_CM_MIN) return `Medida muy baja: ${medida}cm. Mínimo ${MEDIDA_CM_MIN}cm. ¿Tipeaste mal? (ej: 5 en vez de 50)`;
  if (medida > MEDIDA_CM_MAX) return `Medida muy alta: ${medida}cm. Máximo ${MEDIDA_CM_MAX}cm. ¿Tipeaste mal? (ej: 3201 en vez de 320.1)`;
  return null;
}

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
      if (!t.tubo_raiz_id) {
        console.warn('[tubos_historial] Skip: tubo_raiz_id nulo', { evento, cod: t.cod });
        return;
      }
      if (!empresaId) return;
      const { error } = await supabase.from('tubos_historial').insert({
        empresa_id: empresaId,
        tubo_raiz_id: t.tubo_raiz_id,
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
      const errMedida = validarMedidaCm(input.medida_cm);
      if (errMedida) throw new Error(errMedida);
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
  // Timestamp de fila en BD; fallback de fecha de ingreso para alerta 90 días.
  created_at?: string | null;
  // Usados por Plan de Corte (prioridad Regla 3 + FIFO Regla 4 + ubicación al guardar)
  tipo?: string | null;
  ubicacion?: string | null;
  // `rack/m/col/cell` los escribe la importación del MAPA (grilla RACK 1-7);
  // se usan para reconstruir la grilla en la vista Colmena (colmenaViva.ts).
  datos_extra?: {
    creadoEn?: string;
    // Fecha de origen del sobrante (ROLZZO); fuente primaria de antigüedad.
    fecha_origen?: string;
    ot_origen?: string;
    fuente?: string;
    // Zona física de la colmena ('GALPON' | 'LIBERADO'). Cada zona es una
    // grilla independiente en la vista. Si falta, se asume 'GALPON'.
    zona?: string;
    // Coordenadas de la grilla MAPA. Pueden venir null en jsonb (ej. celda
    // suelta fuera de la grilla) → se tratan como sin coordenada.
    rack?: string | number | null;
    m?: string | number | null;
    col?: string | number | null;
    cell?: string | null;
    // Colmena dada de baja (Reglas Rolzzo): no se usa, queda como merma.
    baja?: boolean;
    fecha_baja?: string;
    motivo_baja?: string;
  } | null;
};

export type PanoUpdate = {
  codigo: string | null;
  medida_ancho: number | null;
  medida_alto: number | null;
  disponible: boolean;
  ot_asignada: string | null;
};

/**
 * Trae TODOS los paños de la empresa PAGINANDO. PostgREST corta cada request en
 * 1000 filas y colmena_panos supera ese tope (~1.750+), así que un `.select`
 * simple truncaría la colmena (síntoma: "COLMENA 999 PAÑOS" en la vista). Lo usan
 * la vista Colmena (Telas), el editor admin (useColmenaPanos) y el importador.
 * Orden por codigo+id: estable para paginar y conserva el orden de la tabla admin.
 */
export async function cargarTodosLosPanos(empresaId: string): Promise<ColmenaPano[]> {
  const PAGINA = 1000;
  const todos: ColmenaPano[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .from('colmena_panos')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('codigo')
      .order('id')
      .range(desde, desde + PAGINA - 1);
    if (error) throw error;
    const lote = (data || []) as ColmenaPano[];
    todos.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return todos;
}

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
      setPanos(await cargarTodosLosPanos(empresaId));
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

// ── Inventario (snapshot/diff/lock) ──────────────────────────────────
export type Inventario = {
  id: string;
  empresa_id: string;
  n_colmena: string | null;
  iniciado_por: string | null;
  iniciado_por_email: string | null;
  iniciado_at: string;
  cerrado_at: string | null;
  cerrado_por: string | null;
  cerrado_por_email: string | null;
  estado: 'activo' | 'cerrado' | 'cancelado';
  tubos_count_pre: number;
  tubos_count_post: number | null;
  notas: string | null;
  firma_png: string | null;
};

export type InventarioDiffRow = {
  tipo: 'mantenido' | 'eliminado' | 'nuevo' | 'modificado';
  tubo_raiz_id: string;
  n_colmena_pre: string | null;
  n_colmena_post: string | null;
  cod_pre: string | null;
  cod_post: string | null;
  medida_cm_pre: number | null;
  medida_cm_post: number | null;
  serial_pre: string | null;
  serial_post: string | null;
};

export function useInventario(): {
  activo: Inventario | null;
  historicos: Inventario[];
  loading: boolean;
  refrescar: () => Promise<void>;
  iniciar: (notas?: string | null) => Promise<string>;
  cerrar: (id: string, firmaPng: string, notas?: string | null) => Promise<void>;
  revertir: (id: string, motivo: string) => Promise<void>;
  diff: (id: string) => Promise<InventarioDiffRow[]>;
} {
  const { empresaId } = useAuth();
  const [activo, setActivo] = useState<Inventario | null>(null);
  const [historicos, setHistoricos] = useState<Inventario[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('inventarios' as any)
        .select('*')
        .eq('empresa_id', empresaId)
        .order('iniciado_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      const filas = ((data || []) as unknown) as Inventario[];
      setActivo(filas.find((f) => f.estado === 'activo') ?? null);
      setHistoricos(filas.filter((f) => f.estado !== 'activo'));
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const iniciar = useCallback(
    async (notas?: string | null) => {
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .rpc('iniciar_inventario' as any, {
          p_n_colmena: null,
          p_notas: notas ?? null,
        });
      if (error) throw new Error(error.message || JSON.stringify(error));
      await cargar();
      return data as string;
    },
    [cargar],
  );

  const cerrar = useCallback(
    async (id: string, firmaPng: string, notas?: string | null) => {
      const { error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .rpc('cerrar_inventario' as any, {
          p_inventario_id: id,
          p_notas: notas ?? null,
          p_firma_png: firmaPng,
        });
      if (error) throw new Error(error.message || JSON.stringify(error));
      await cargar();
    },
    [cargar],
  );

  const revertir = useCallback(
    async (id: string, motivo: string) => {
      const { error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .rpc('revertir_inventario' as any, {
          p_inventario_id: id,
          p_motivo: motivo,
        });
      if (error) throw new Error(error.message || JSON.stringify(error));
      await cargar();
    },
    [cargar],
  );

  const diff = useCallback(async (id: string) => {
    const { data, error } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .rpc('inventario_diff' as any, {
        p_inventario_id: id,
      });
    if (error) throw new Error(error.message || JSON.stringify(error));
    return ((data || []) as unknown) as InventarioDiffRow[];
  }, []);

  return { activo, historicos, loading, refrescar: cargar, iniciar, cerrar, revertir, diff };
}

// ── Tally doble ciego ────────────────────────────────────────────────
export type TallyRow = {
  id: string;
  inventario_id: string;
  empresa_id: string;
  operario_id: string;
  operario_email: string;
  n_colmena: string;
  conteo: number;
  contado_at: string;
};

// Hook para operario: SOLO ve su propio tally (RLS lo enforce).
export function useMisTallies(inventarioId: string | null): {
  tallies: TallyRow[];
  loading: boolean;
  refrescar: () => Promise<void>;
  setConteo: (nColmena: string, conteo: number) => Promise<void>;
} {
  const [tallies, setTallies] = useState<TallyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!inventarioId) {
      setTallies([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('inventario_tally' as any)
        .select('*')
        .eq('inventario_id', inventarioId);
      if (error) throw error;
      setTallies(((data || []) as unknown) as TallyRow[]);
    } finally {
      setLoading(false);
    }
  }, [inventarioId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const setConteo = useCallback(
    async (nColmena: string, conteo: number) => {
      if (!inventarioId) throw new Error('No hay inventario activo');
      const { error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .rpc('tally_set' as any, {
          p_inventario_id: inventarioId,
          p_n_colmena: nColmena,
          p_conteo: conteo,
        });
      if (error) throw new Error(error.message || JSON.stringify(error));
      await cargar();
    },
    [inventarioId, cargar],
  );

  return { tallies, loading, refrescar: cargar, setConteo };
}

// Hook para admin: ve TODOS los tallies del inventario (RLS allow admin policy).
export function useTalliesReconciliacion(inventarioId: string | null): {
  tallies: TallyRow[];
  loading: boolean;
  refrescar: () => Promise<void>;
} {
  const [tallies, setTallies] = useState<TallyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!inventarioId) {
      setTallies([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('inventario_tally' as any)
        .select('*')
        .eq('inventario_id', inventarioId)
        .order('n_colmena')
        .order('operario_email');
      if (error) throw error;
      setTallies(((data || []) as unknown) as TallyRow[]);
    } finally {
      setLoading(false);
    }
  }, [inventarioId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { tallies, loading, refrescar: cargar };
}
