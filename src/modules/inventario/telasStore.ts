// La carga de datos que compartían las cinco pestañas de la vieja pantalla de
// Telas. Ahora esas pestañas viven en tres submódulos distintos (Telas, Colmena
// de paños y Mermas), así que la lectura se saca acá para no copiarla.
//
// `incluirPanos` está apagado por defecto a propósito: son más de 2.000 filas
// paginadas de a 1.000, y solo la colmena las necesita.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { cargarTodosLosPanos, type ColmenaPano } from '@/modules/admin/colmena';
import type {
  Colmena,
  Falla,
  Merma,
  Movimiento,
  Slot,
  Tela,
  Validador,
  ValidadoresMap,
} from '@/pages/inventario/telas/Telas.types';

export type DatosTelas = {
  telas: Tela[];
  movimientos: Movimiento[];
  fallas: Falla[];
  mermas: Merma[];
  validadores: ValidadoresMap;
  /** Mapa posición → tela, para las etiquetas y el QR de ubicación. */
  colmena: Colmena;
  /** Retazos reales con medida. Vacío si no se pidieron. */
  panos: ColmenaPano[];
  loading: boolean;
  error: string | null;
};

const VACIO: DatosTelas = {
  telas: [],
  movimientos: [],
  fallas: [],
  mermas: [],
  validadores: {},
  colmena: {},
  panos: [],
  loading: true,
  error: null,
};

function mensajeError(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  if (code === '42501') return 'Tu usuario no tiene permiso para ver las telas.';
  if (code === 'PGRST205' || code === '42P01')
    return 'Falta una tabla de telas en la base. Avisa a quien administra el sistema.';
  const msg = (e as { message?: string })?.message;
  return msg ? `No se pudieron cargar las telas: ${msg}` : 'No se pudieron cargar las telas.';
}

/**
 * Arma el mapa de posiciones. Parte de `telas_catalogo.posicion` (lo viejo) y,
 * si hay filas en `telas_slots`, esas mandan: son la fuente moderna, pero no
 * todas las empresas las usan todavía.
 */
export function armarColmena(telas: Tela[], slots: Slot[]): Colmena {
  const porCodigo: Record<string, Tela> = {};
  for (const t of telas) porCodigo[t.codigo] = t;

  if (slots.length > 0) {
    const col: Colmena = {};
    for (const s of slots) {
      if (!s.posicion || !s.codigo) continue;
      const cat = porCodigo[s.codigo];
      col[s.posicion.toUpperCase()] = {
        codigo: s.codigo,
        tipo: cat?.tipo ?? null,
        nemotecnico: cat?.nemotecnico ?? null,
        almacen: s.almacen || cat?.almacen || null,
        id: cat?.id ?? null,
      };
    }
    return col;
  }

  const col: Colmena = {};
  for (const t of telas) {
    if (!t.posicion) continue;
    col[t.posicion.toUpperCase()] = {
      codigo: t.codigo,
      tipo: t.tipo,
      nemotecnico: t.nemotecnico,
      almacen: t.almacen,
      id: t.id,
    };
  }
  return col;
}

export function useDatosTelas(opciones: { incluirPanos?: boolean } = {}): DatosTelas & {
  recargar: () => Promise<void>;
} {
  const { incluirPanos = false } = opciones;
  const { empresaId } = useAuth();
  const [datos, setDatos] = useState<DatosTelas>(VACIO);

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setDatos({ ...VACIO, loading: false });
      return;
    }
    setDatos((d) => ({ ...d, loading: true, error: null }));
    try {
      const [rTelas, rSlots, rMov, rFallas, rVal, rMermas, panos] = await Promise.all([
        supabase.from('telas_catalogo').select('*').eq('empresa_id', empresaId).order('codigo'),
        supabase.from('telas_slots').select('posicion,codigo,almacen').eq('empresa_id', empresaId),
        supabase
          .from('movimientos_telas')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('fecha', { ascending: false })
          .limit(500),
        supabase
          .from('telas_fallas')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('fecha_reporte', { ascending: false }),
        supabase.from('validadores_telas').select('*').eq('empresa_id', empresaId).order('orden'),
        supabase
          .from('telas_mermas')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('fecha', { ascending: false }),
        incluirPanos ? cargarTodosLosPanos(empresaId) : Promise.resolve([] as ColmenaPano[]),
      ]);

      const primerError = rTelas.error || rMov.error || rFallas.error || rMermas.error;
      if (primerError) throw primerError;

      const telas = ((rTelas.data as Tela[]) || []).slice();
      const validadores: ValidadoresMap = {};
      for (const v of (rVal.data as Validador[]) || []) {
        if (!validadores[v.campo]) validadores[v.campo] = [];
        validadores[v.campo].push(v.valor);
      }

      setDatos({
        telas,
        movimientos: (rMov.data as Movimiento[]) || [],
        fallas: (rFallas.data as Falla[]) || [],
        mermas: (rMermas.data as Merma[]) || [],
        validadores,
        colmena: armarColmena(telas, (rSlots.data as Slot[]) || []),
        panos,
        loading: false,
        error: null,
      });
    } catch (e) {
      setDatos({ ...VACIO, loading: false, error: mensajeError(e) });
    }
  }, [empresaId, incluirPanos]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { ...datos, recargar: cargar };
}
