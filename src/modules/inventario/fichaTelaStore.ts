// Lo que la ficha de una tela le pide a la base.
//
// La tela se lleva en METROS y tiene dos vidas: el rollo del catálogo, que se
// mide en metros, y los paños ya cortados que viven en la colmena. La ficha
// muestra las dos, porque para el taller son el mismo material.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { ColmenaPano } from '@/modules/admin/colmena';
import type {
  Falla,
  Merma,
  Movimiento,
  Slot,
  Tela,
} from '@/pages/inventario/telas/Telas.types';

export type DatosFichaTela = {
  tela: Tela | null;
  movimientos: Movimiento[];
  slots: Slot[];
  fallas: Falla[];
  mermas: Merma[];
  panos: ColmenaPano[];
  loading: boolean;
  error: string | null;
};

const VACIO: DatosFichaTela = {
  tela: null,
  movimientos: [],
  slots: [],
  fallas: [],
  mermas: [],
  panos: [],
  loading: true,
  error: null,
};

function mensajeError(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  if (code === '42501') return 'Tu usuario no tiene permiso para ver esta tela.';
  const msg = (e as { message?: string })?.message;
  return msg ? `No se pudo cargar la ficha: ${msg}` : 'No se pudo cargar la ficha.';
}

export function useFichaTela(codigo: string): DatosFichaTela & {
  refrescar: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [datos, setDatos] = useState<DatosFichaTela>(VACIO);

  const cargar = useCallback(async () => {
    if (!empresaId || !codigo) {
      setDatos({ ...VACIO, loading: false });
      return;
    }
    setDatos((d) => ({ ...d, loading: true, error: null }));
    // Se escapan los comodines de LIKE: el código viaja en la URL.
    const patron = codigo.replace(/[\\%_]/g, (c) => `\\${c}`);
    try {
      const [rTela, rMov, rSlots, rFallas, rMermas, rPanos] = await Promise.all([
        supabase
          .from('telas_catalogo')
          .select('*')
          .eq('empresa_id', empresaId)
          .ilike('codigo', patron)
          .limit(1),
        supabase
          .from('movimientos_telas')
          .select('*')
          .eq('empresa_id', empresaId)
          .ilike('codigo', patron)
          .order('fecha', { ascending: false })
          .limit(500),
        supabase.from('telas_slots').select('*').eq('empresa_id', empresaId).ilike('codigo', patron),
        supabase
          .from('telas_fallas')
          .select('*')
          .eq('empresa_id', empresaId)
          .ilike('codigo', patron)
          .order('fecha_reporte', { ascending: false }),
        supabase
          .from('telas_mermas')
          .select('*')
          .eq('empresa_id', empresaId)
          .ilike('codigo', patron)
          .order('fecha', { ascending: false })
          .limit(200),
        // Los paños de ESTE código son pocos: no hace falta paginar como en la
        // colmena entera, que pasa de las 1.000 filas que devuelve PostgREST.
        supabase
          .from('colmena_panos')
          .select('*')
          .eq('empresa_id', empresaId)
          .ilike('codigo', patron)
          .limit(1000),
      ]);

      const primerError = rTela.error || rMov.error || rSlots.error;
      if (primerError) throw primerError;

      setDatos({
        tela: ((rTela.data as Tela[] | null) || [])[0] || null,
        movimientos: (rMov.data as Movimiento[] | null) || [],
        slots: (rSlots.data as Slot[] | null) || [],
        fallas: (rFallas.data as Falla[] | null) || [],
        mermas: (rMermas.data as Merma[] | null) || [],
        panos: (rPanos.data as ColmenaPano[] | null) || [],
        loading: false,
        error: null,
      });
    } catch (e) {
      setDatos({ ...VACIO, loading: false, error: mensajeError(e) });
    }
  }, [empresaId, codigo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { ...datos, refrescar: cargar };
}
