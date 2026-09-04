// ─────────────────────────────────────────────────────────────────────
// Las autorizaciones de GIRO de la colmena, guardadas.
//
// Cuando el plan propone acostar una cortina para que entre en un paño del
// rack, el operario la autoriza o la rechaza. Esa decisión NO puede vivir en
// el `useState` de la pantalla: el Plan de tela, el Dimensionado y la pizarra
// arman cada uno su propio plan, y si la decisión se pierde al cambiar de
// pestaña, el Dimensionado dibuja la cortina girada que ya se rechazó y el
// Plan de tela vuelve a pedir la misma autorización.
//
// Se guardan en `produccion_checks` —la tabla que ya usan las marcas del
// taller— con `area='panos'` y `ref='giro'`. El `ref` las deja INVISIBLES para
// las marcas normales de Paños (`useChecks` descarta lo que no calza con su
// ref), así que no hace falta tabla ni migración nueva.
//
// La llave es el `pieceId` del plan (`${otId}_${ventanaId}_p${i}`), la misma
// que usan el plan, la hoja, el snapshot y el lote.
// ─────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { OT } from '@/modules/ots/types';
import type { CheckProduccion } from './types';

// `produccion_checks` no está en los tipos generados de Supabase.
/* eslint-disable @typescript-eslint/no-explicit-any */

/** El área del taller donde se corta la tela: la misma de la vista Paños. */
export const AREA_GIRO = 'panos';
/**
 * Discrimina estas filas de las marcas de avance de Paños. `useChecks` filtra
 * por `ref`, así que con esto no se cuentan como cortinas hechas.
 */
export const REF_GIRO = 'giro';

/** El uuid de la OT que abre un `pieceId`. Los uuid no llevan «_». */
export function otIdDePieza(pieceId: string): string {
  return pieceId.split('_')[0] ?? '';
}

export type DecisionesGiro = {
  /** pieceId → autorizado. Sin entrada = todavía no se decidió. */
  decisiones: Record<string, boolean>;
  /** Las piezas RECHAZADAS, tal como las espera `generarPlanCorte`. */
  sinGiro: ReadonlySet<string>;
  cargando: boolean;
  /** Guarda la decisión. Optimista: el taller no espera al servidor. */
  decidir: (pieceId: string, autoriza: boolean) => Promise<void>;
  /**
   * Borra la decisión: la cortina vuelve a quedar sin decidir y el plan la
   * propone de nuevo. Es la salida de un clic equivocado — sin esto, un
   * «Rechaza» apretado por error sacaba esa cortina del rack para siempre.
   */
  olvidar: (pieceId: string) => Promise<void>;
};

/**
 * Las decisiones de giro de estas OTs. Se le pasan las OTs COMPLETAS porque
 * `produccion_checks.ot` guarda el número de la orden (el de la columna
 * `numero_ot`), y el `pieceId` solo trae el uuid.
 */
export function useDecisionesGiro(ots: readonly OT[] | null): DecisionesGiro {
  const { empresaId, perfil } = useAuth();
  const [filas, setFilas] = useState<CheckProduccion[]>([]);
  const [cargando, setCargando] = useState(false);

  // uuid → número de OT, que es con lo que se escribe la fila.
  const numeroDe = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of ots ?? []) {
      const numero = String(o.datosGenerales?.ot || '').trim();
      if (numero) m.set(String(o.id), numero);
    }
    return m;
  }, [ots]);

  // Los números en una llave estable: el array llega nuevo en cada render.
  const llave = useMemo(() => [...numeroDe.values()].sort().join('|'), [numeroDe]);

  const cargar = useCallback(async () => {
    const numeros = llave ? llave.split('|').filter(Boolean) : [];
    if (!empresaId || numeros.length === 0) {
      setFilas([]);
      return;
    }
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('produccion_checks' as any)
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('area', AREA_GIRO)
        .eq('ref', REF_GIRO)
        .in('ot', numeros);
      if (error) throw error;
      setFilas((data || []) as unknown as CheckProduccion[]);
    } catch (e) {
      // Sin las decisiones el plan vuelve a preguntar, que es molesto pero no
      // rompe nada: nunca se corta sin autorizar.
      console.warn('[Producción] No se pudieron cargar las autorizaciones de giro:', e);
      setFilas([]);
    } finally {
      setCargando(false);
    }
  }, [empresaId, llave]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // El Plan de tela y el Dimensionado pueden estar abiertos a la vez (dos
  // pestañas, dos mesas): lo que uno decide tiene que llegarle al otro.
  useEffect(() => {
    if (!empresaId || !llave) return;
    const canal = supabase
      .channel(`giros-colmena-${crypto.randomUUID()}`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'produccion_checks',
          filter: `empresa_id=eq.${empresaId}`,
        },
        (payload: { eventType: string; new?: CheckProduccion; old?: { id: string } }) => {
          if (payload.eventType === 'DELETE') {
            const delId = payload.old?.id;
            if (delId) setFilas((prev) => prev.filter((f) => f.id !== delId));
            return;
          }
          const fila = payload.new;
          if (!fila || fila.area !== AREA_GIRO || fila.ref !== REF_GIRO) return;
          if (!llave.split('|').includes(fila.ot)) return;
          setFilas((prev) => {
            const i = prev.findIndex((f) => f.ot === fila.ot && f.clave === fila.clave);
            if (i < 0) return [...prev, fila];
            const next = [...prev];
            next[i] = fila;
            return next;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [empresaId, llave]);

  const decisiones = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const f of filas) out[f.clave] = f.hecho;
    return out;
  }, [filas]);

  const sinGiro = useMemo(
    () => new Set(Object.entries(decisiones).filter(([, ok]) => !ok).map(([id]) => id)),
    [decisiones],
  );

  const decidir = useCallback(
    async (pieceId: string, autoriza: boolean) => {
      const numero = numeroDe.get(otIdDePieza(pieceId)) ?? '';
      if (!empresaId || !numero) {
        throw new Error('No se pudo identificar la OT de esa cortina.');
      }
      const fila = {
        empresa_id: empresaId,
        ot: numero,
        area: AREA_GIRO,
        ref: REF_GIRO,
        clave: pieceId,
        hecho: autoriza,
        nota: null,
        hecho_por: perfil?.nombre ?? null,
        hecho_por_id: perfil?.id ?? null,
        hecho_en: new Date().toISOString(),
      };
      // Optimista: rechazar un giro regenera el plan entero y el operario tiene
      // que ver el resultado de inmediato.
      setFilas((prev) => {
        const i = prev.findIndex((f) => f.ot === numero && f.clave === pieceId);
        const previa = i < 0 ? ({ id: `local:${numero}|${pieceId}` } as CheckProduccion) : prev[i];
        const next = i < 0 ? [...prev] : [...prev];
        const mezclada = { ...previa, ...fila } as CheckProduccion;
        if (i < 0) next.push(mezclada);
        else next[i] = mezclada;
        return next;
      });
      const { error } = await supabase
        .from('produccion_checks' as any)
        .upsert(fila as any, { onConflict: 'empresa_id,area,ot,ref,clave' });
      if (error) {
        await cargar();
        throw error;
      }
    },
    [empresaId, numeroDe, perfil, cargar],
  );

  const olvidar = useCallback(
    async (pieceId: string) => {
      const numero = numeroDe.get(otIdDePieza(pieceId)) ?? '';
      if (!empresaId || !numero) return;
      setFilas((prev) => prev.filter((f) => !(f.ot === numero && f.clave === pieceId)));
      const { error } = await supabase
        .from('produccion_checks' as any)
        .delete()
        .eq('empresa_id', empresaId)
        .eq('area', AREA_GIRO)
        .eq('ref', REF_GIRO)
        .eq('ot', numero)
        .eq('clave', pieceId);
      if (error) {
        await cargar();
        throw error;
      }
    },
    [empresaId, numeroDe, cargar],
  );

  return { decisiones, sinGiro, cargando, decidir, olvidar };
}
