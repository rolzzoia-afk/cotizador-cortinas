// Datos de la vista "Colmena de tubería", EN VIVO.
//
// Tres consultas: el stock (`colmena_tubos`), los eventos `ingreso` de
// `tubos_historial` (única fuente confiable de antigüedad — ver el comentario
// de colmenaTubos.ts) y los últimos movimientos para el panel lateral.
//
// El refresco es por realtime sobre `colmena_tubos`: TODO movimiento del
// optimizador termina tocando esa tabla (el trigger `trg_auto_remove_consumed_tube`
// borra los consumidos y el sync inserta los sobrantes), así que un solo canal
// alcanza para que la grilla y los movimientos se actualicen solos. Se agrega
// un canal sobre `tubos_historial` por si la publicación realtime lo incluye;
// si no, el de colmena_tubos ya arrastra el refetch.
//
// OJO: al 2026-08-03 la publicación `supabase_realtime` NO incluía
// `colmena_tubos` (solo ots/telas/colmena_panos), así que el canal se suscribe
// pero no recibe nada. El SQL para agregarla está en
// sql/20260803_realtime_colmena_tubos.sql. Mientras tanto —y como red de
// seguridad si el socket se cae— hay un SONDEO cada 60 s que solo corre con la
// pestaña visible, para no consultar de fondo en un equipo del taller que
// quedó abierto.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { TuboColmena } from '@/modules/tubos/colmenaTubos';
import { mapaPrimerIngreso } from '@/modules/tubos/colmenaTubos';
import type { Evento } from '../HistorialTubos.types';

/** Cuántos movimientos recientes se muestran en el panel lateral. */
export const LIMITE_MOVIMIENTOS = 50;
/** Sondeo de respaldo (ver la nota de arriba sobre la publicación realtime). */
const INTERVALO_SONDEO_MS = 60_000;

export type DatosColmenaViva = {
  tubos: TuboColmena[];
  ingresos: Map<string, string>;
  movimientos: Evento[];
  loading: boolean;
  online: boolean;
  refrescar: () => Promise<void>;
};

export function useColmenaViva(empresaId: string | null | undefined): DatosColmenaViva {
  const [tubos, setTubos] = useState<TuboColmena[]>([]);
  const [ingresos, setIngresos] = useState<Map<string, string>>(new Map());
  const [movimientos, setMovimientos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  // Debounce: un sync del optimizador dispara cientos de eventos de realtime
  // seguidos; sin esto se lanzarían cientos de refetch.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    try {
      const [stock, ing, movs] = await Promise.all([
        supabase
          .from('colmena_tubos')
          .select('id, n_colmena, cod, medida_cm, serial, tubo_raiz_id, created_at')
          .eq('empresa_id', empresaId)
          .order('n_colmena')
          .order('cod'),
        supabase
          .from('tubos_historial')
          .select('tubo_raiz_id, created_at')
          .eq('empresa_id', empresaId)
          .eq('evento', 'ingreso'),
        supabase
          .from('tubos_historial')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('created_at', { ascending: false })
          .limit(LIMITE_MOVIMIENTOS),
      ]);
      setTubos((stock.data || []) as TuboColmena[]);
      setIngresos(
        mapaPrimerIngreso(
          (ing.data || []) as Array<{ tubo_raiz_id: string | null; created_at: string | null }>,
        ),
      );
      setMovimientos((movs.data || []) as Evento[]);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!empresaId) return;
    const recargar = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => cargar(), 300);
    };
    // Channel name único por mount (StrictMode-safe), igual que en ots/hooks.
    const ch = supabase
      .channel(`colmena-tubos-viva-${crypto.randomUUID()}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'colmena_tubos', filter: `empresa_id=eq.${empresaId}` },
        recargar,
      )
      .on(
        // `tubos_historial.empresa_id` es TEXT (no uuid): sin filtro para no
        // depender del cast del lado del servidor; el refetch filtra igual.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'tubos_historial' },
        recargar,
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') setOnline(true);
        else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') setOnline(false);
      });
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(ch);
    };
  }, [empresaId, cargar]);

  // Sondeo de respaldo: solo con la pestaña visible.
  useEffect(() => {
    if (!empresaId) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') cargar();
    }, INTERVALO_SONDEO_MS);
    return () => clearInterval(id);
  }, [empresaId, cargar]);

  return { tubos, ingresos, movimientos, loading, online, refrescar: cargar };
}
