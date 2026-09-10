// Lo que la ficha de un artículo le pide a la base. La cuenta la hace
// `ficha.ts`, que es puro y está testeado; acá solo se leen y se escriben
// filas.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useFlagsInventario } from './flagsStore';
import type { Insumo, Movimiento, UbicacionRack, Validador } from './helpers';
import {
  comoMovimientoViejo,
  lineaDeMovimientoManual,
  resumenDeMovimientos,
  saldosFinales,
  type RespuestaKardex,
} from './kardex';
import { registrarMovimientos } from './kardexStore';
import {
  filaMovimiento,
  problemaDelMovimiento,
  stockDespues,
  type EntradaMovimiento,
} from './movimientos';
import { mapaDeValidadores } from './validadores';

export type CamionetaConStock = { id: string; nombre: string; cantidad: number };

export type DatosFicha = {
  insumo: Insumo | null;
  movimientos: Movimiento[];
  ubicaciones: UbicacionRack[];
  camionetas: CamionetaConStock[];
  validadores: Record<string, string[]>;
  loading: boolean;
  error: string | null;
};

const VACIO: DatosFicha = {
  insumo: null,
  movimientos: [],
  ubicaciones: [],
  camionetas: [],
  validadores: {},
  loading: true,
  error: null,
};

function mensajeError(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  if (code === '42501') return 'Tu usuario no tiene permiso para ver este artículo.';
  const msg = (e as { message?: string })?.message;
  return msg ? `No se pudo cargar la ficha: ${msg}` : 'No se pudo cargar la ficha.';
}

/**
 * La ficha de un insumo por su código. El código viaja en la URL, así que
 * puede llegar con espacios («MEC 18») o en minúsculas: se busca sin
 * distinguir mayúsculas.
 */
export function useFichaInsumo(cod: string): DatosFicha & {
  refrescar: () => Promise<void>;
  aplicarCambio: (parche: Partial<Insumo>, movimiento?: Movimiento) => void;
} {
  const { empresaId } = useAuth();
  const [datos, setDatos] = useState<DatosFicha>(VACIO);

  const cargar = useCallback(async () => {
    if (!empresaId || !cod) {
      setDatos({ ...VACIO, loading: false });
      return;
    }
    setDatos((d) => ({ ...d, loading: true, error: null }));
    // El código viaja en la URL: se escapan los comodines de LIKE para que un
    // código con `%` o `_` no traiga artículos que no son.
    const patron = cod.replace(/[\\%_]/g, (c) => `\\${c}`);
    try {
      const [rIns, rMov, rUbi, rVal, rCam] = await Promise.all([
        supabase
          .from('insumos')
          .select('*')
          .eq('empresa_id', empresaId)
          .ilike('cod', patron)
          .limit(1),
        supabase
          .from('movimientos_insumos')
          .select('*')
          .eq('empresa_id', empresaId)
          .ilike('codigo', patron)
          .order('fecha', { ascending: false })
          .limit(500),
        supabase.from('ubicaciones_rack').select('*').eq('empresa_id', empresaId).ilike('codigo_insumo', patron),
        supabase.from('validadores_insumos').select('*').eq('empresa_id', empresaId).order('orden'),
        supabase.from('camionetas').select('id,nombre,instalador').eq('empresa_id', empresaId),
      ]);

      const primerError = rIns.error || rMov.error || rUbi.error;
      if (primerError) throw primerError;

      const insumo = ((rIns.data as Insumo[] | null) || [])[0] || null;

      // El stock en camionetas cuelga del insumo, no de la empresa: la tabla
      // todavía no tiene `empresa_id` (lo agrega la Entrega B).
      let camionetas: CamionetaConStock[] = [];
      if (insumo) {
        const { data: rInvCam } = await supabase
          .from('inventario_camioneta')
          .select('camioneta_id,cantidad')
          .eq('insumo_id', insumo.id);
        const porCamioneta = new Map<string, number>();
        for (const fila of (rInvCam as Array<{ camioneta_id: string; cantidad: number | null }> | null) || []) {
          porCamioneta.set(fila.camioneta_id, (porCamioneta.get(fila.camioneta_id) || 0) + (fila.cantidad || 0));
        }
        camionetas = ((rCam.data as Array<{ id: string; nombre: string | null; instalador: string | null }> | null) || [])
          .map((c) => ({
            id: c.id,
            nombre: c.nombre || c.instalador || 'Camioneta',
            cantidad: porCamioneta.get(c.id) || 0,
          }))
          .filter((c) => porCamioneta.has(c.id));
      }

      const validadores = mapaDeValidadores(rVal.data as Validador[] | null);

      setDatos({
        insumo,
        movimientos: ((rMov.data as Movimiento[] | null) || []),
        ubicaciones: ((rUbi.data as UbicacionRack[] | null) || []),
        camionetas,
        validadores,
        loading: false,
        error: null,
      });
    } catch (e) {
      setDatos({ ...VACIO, loading: false, error: mensajeError(e) });
    }
  }, [empresaId, cod]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /** Refleja en pantalla lo que se acaba de guardar, sin recargar todo. */
  const aplicarCambio = useCallback((parche: Partial<Insumo>, movimiento?: Movimiento) => {
    setDatos((d) => ({
      ...d,
      insumo: d.insumo ? { ...d.insumo, ...parche } : d.insumo,
      movimientos: movimiento ? [movimiento, ...d.movimientos] : d.movimientos,
    }));
  }, []);

  return { ...datos, refrescar: cargar, aplicarCambio };
}

/**
 * La fila que se muestra en la tabla de la ficha. Con el kardex encendido la
 * salida puede haberse repartido en dos renglones: se muestra el ÚLTIMO, que es
 * el que deja el saldo final, y el resumen explica el reparto completo.
 */
function movimientoParaLaPantalla(
  r: RespuestaKardex,
  entrada: EntradaMovimiento,
  insumo: Insumo | null,
  empresaId: string,
): Movimiento {
  const ultimo = r.movimientos[r.movimientos.length - 1];
  return {
    ...comoMovimientoViejo(ultimo, {
      producto: insumo?.nemotecnico || insumo?.descriptor_proveedor || null,
      ot: (entrada.ot || '').trim() || null,
      responsable: entrada.responsable_entrega || null,
      notas: (entrada.bitacora || '').trim() || null,
    }),
    empresa_id: empresaId,
  };
}

export type ResultadoMovimiento = {
  movimiento: Movimiento;
  parcheInsumo: Partial<Insumo>;
  /** La cuenta daba negativo y se guardó 0: hay que decirlo. */
  recortado: boolean;
  /** Con el kardex encendido: qué pasó, en una frase. */
  resumen?: string;
};

/**
 * Guarda un movimiento y ajusta el stock.
 *
 * Con el interruptor `kardexRpc` encendido lo hace la base en una sola
 * operación, con el artículo bloqueado. Apagado, sigue el camino de siempre:
 * dos escrituras sueltas sin transacción, que es lo que hay que reemplazar.
 */
export function useGuardarMovimiento(): {
  guardando: boolean;
  guardar: (
    entrada: EntradaMovimiento,
    insumo: Insumo | null,
  ) => Promise<{ ok: true; resultado: ResultadoMovimiento } | { ok: false; motivo: string }>;
} {
  const { empresaId } = useAuth();
  const { flags } = useFlagsInventario();
  const [guardando, setGuardando] = useState(false);

  const guardar = async (entrada: EntradaMovimiento, insumo: Insumo | null) => {
    if (!empresaId) return { ok: false as const, motivo: 'No hay sesión' };
    const problema = problemaDelMovimiento(entrada);
    if (problema) return { ok: false as const, motivo: problema };

    // ── El camino nuevo: una sola operación de la base ────────────────────
    if (flags.kardexRpc) {
      const linea = lineaDeMovimientoManual({ ...entrada, almacen: entrada.almacen });
      if ('error' in linea) return { ok: false as const, motivo: linea.error };

      setGuardando(true);
      try {
        const r = await registrarMovimientos([linea]);
        if (!r.ok) return { ok: false as const, motivo: r.motivo };
        const saldos = saldosFinales(r.respuesta).get(linea.item_cod.toUpperCase());
        return {
          ok: true as const,
          resultado: {
            // La fila del kardex no tiene la forma del registro viejo: se arma
            // una equivalente para que la tabla de la ficha la muestre igual.
            movimiento: movimientoParaLaPantalla(r.respuesta, entrada, insumo, empresaId),
            parcheInsumo: saldos || {},
            recortado: false,
            resumen: resumenDeMovimientos(r.respuesta),
          },
        };
      } finally {
        setGuardando(false);
      }
    }

    setGuardando(true);
    try {
      const { data, error } = await supabase
        .from('movimientos_insumos')
        .insert(filaMovimiento(entrada, insumo || undefined, empresaId))
        .select()
        .single();
      if (error) throw error;

      let parcheInsumo: Partial<Insumo> = {};
      let recortado = false;
      if (insumo) {
        const despues = stockDespues(insumo, entrada);
        recortado = despues.recortado;
        const { error: errUp } = await supabase
          .from('insumos')
          .update(
            despues.campo === 'stock_mp'
              ? { stock_mp: despues.valor }
              : { stock_liberado: despues.valor },
          )
          .eq('id', insumo.id);
        if (errUp) throw errUp;
        parcheInsumo = { [despues.campo]: despues.valor };
      }
      return {
        ok: true as const,
        resultado: { movimiento: data as Movimiento, parcheInsumo, recortado },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false as const, motivo: msg };
    } finally {
      setGuardando(false);
    }
  };

  return { guardando, guardar };
}
