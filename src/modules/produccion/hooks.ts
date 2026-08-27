// ─────────────────────────────────────────────────────────────────────
// Datos del módulo Producción: el plan de corte de una OT, las marcas del
// taller (en vivo entre navegadores) y el avance de la sub-etapa.
//
// La lógica de decisión vive en `avance.ts` y `buscarPlan.ts`, que son puros
// y están probados. Acá solo está la plomería con Supabase.
// ─────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { otToRow, rowToOT } from '@/modules/ots/mappers';
import type { OT, OTRow, SubEtapaProd } from '@/modules/ots/types';
import { useCatalogoProductos } from '@/modules/cotizador/catalogo';
import { useParametrosCotizador } from '@/modules/cotizador/parametros';
import { useFormulasFamilias } from '@/modules/descuentos/formulasStore';
import { useReglasSeleccion } from '@/modules/descuentos/reglasSeleccionStore';
import { filasOptimizadorDeOT } from '@/modules/cotizador/filasOptimizador';
import type { OptimizerRow } from '@/modules/cotizador/tela';
// Del módulo PURO, no del que dibuja el PDF: la pantalla del taller no puede
// arrastrar jsPDF (400 KB) a una tablet del galpón.
import { construirHojaCorte, partirHojaCorte, type HojaCorte } from '@/modules/cotizador/hojaCorte';
import { rowToPano, type ColmenaPanoRow, type PanoColmena } from '@/modules/cotizador/planCorte';
import {
  aplicarVariante,
  construirCalculoGeneral,
  type BloqueSistema,
  type CalculoGeneral,
  type ColumnaCalculo,
  type JuntoPieza,
  type VarianteHojaCalculo,
} from '@/modules/cotizador/calculoGeneral';
import type { Ventana } from '@/modules/cotizador/types';
import { construirInventario, type InsumoConsolidado } from '@/modules/cotizador/inventarioOT';
import { esCadenaRoller, type CadenaInsumo } from '@/modules/cotizador/cadenas';
import type {
  Insumo as InsumoBodega,
  Rack,
  TuboColmena,
} from '@/modules/bodega/bomUtils';
import {
  construirFilasPlan,
  extraerOTsDePlan,
  type FilaPlan,
  type OrdenLike,
  type ResultadoItem,
} from '@/modules/planes-corte/construirFilasPlan';
import { calcularSubEtapa, debeAvanzar, type AreasListas } from './avance';
import { elegirPlanDeOT, normalizarNumeroOT, planCubreOT } from './buscarPlan';
import type { ConsumoAluminio, CostoBodega, CostoManualOT } from './costoOT';
import { CLAVE_AREA } from './constants';
import type { AreaProduccion, CheckProduccion } from './types';

// Las tablas nuevas todavía no están en los tipos generados de Supabase.
/* eslint-disable @typescript-eslint/no-explicit-any */

// ── El plan de corte de una OT ───────────────────────────────────────

export type PlanDeOT = {
  id: string;
  fecha: string | null;
  /** Las OTs que el plan dice cubrir, tal cual las escribió el optimizador. */
  ots: string[];
  filas: FilaPlan[];
  /** false = se encontró por aproximación; hay que rotular qué OT trae. */
  exacto: boolean;
};

type FilaIndice = { id: string; fecha: string | null; ordenes: OrdenLike[] | null };

export function usePlanDeOT(numeroOT: string): {
  plan: PlanDeOT | null;
  loading: boolean;
  error: string | null;
} {
  const { empresaId } = useAuth();
  const [plan, setPlan] = useState<PlanDeOT | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const buscado = numeroOT.trim();
    if (!empresaId || !buscado) {
      setPlan(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelado = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Índice liviano: solo `ordenes` (todas juntas pesan ~100 KB). Los
        // `resultados`, que son lo pesado, se piden después y solo del plan
        // que calzó. `tipo is null` deja fuera respaldos y restauraciones.
        const { data, error: err } = await supabase
          .from('planes_corte')
          .select('id, fecha, ordenes')
          .eq('empresa_id', empresaId)
          .is('tipo', null)
          .order('fecha', { ascending: false });
        if (err) throw err;

        const indice = ((data as unknown as FilaIndice[]) || []).map((p) => ({
          id: p.id,
          fecha: p.fecha,
          ots: extraerOTsDePlan({ fecha: p.fecha, resultados: [], ordenes: p.ordenes || [] }),
        }));
        const elegido = elegirPlanDeOT(indice, buscado);
        if (cancelado) return;
        if (!elegido) {
          setPlan(null);
          setLoading(false);
          return;
        }

        const { data: completo, error: err2 } = await supabase
          .from('planes_corte')
          .select('id, fecha, resultados, ordenes')
          .eq('id', elegido.id)
          .maybeSingle<{
            id: string;
            fecha: string | null;
            resultados: ResultadoItem[] | null;
            ordenes: OrdenLike[] | null;
          }>();
        if (err2) throw err2;
        if (cancelado) return;
        if (!completo) {
          setPlan(null);
          setLoading(false);
          return;
        }

        setPlan({
          id: completo.id,
          fecha: completo.fecha,
          ots: elegido.ots,
          exacto: planCubreOT(elegido, buscado),
          filas: construirFilasPlan({
            fecha: completo.fecha,
            resultados: completo.resultados || [],
            ordenes: completo.ordenes || [],
          }),
        });
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [empresaId, numeroOT]);

  return { plan, loading, error };
}

// ── La OT que se está mirando ────────────────────────────────────────

export function useOTPorNumero(numeroOT: string): {
  ot: OT | null;
  loading: boolean;
  refrescar: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [ot, setOt] = useState<OT | null>(null);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
    const buscado = numeroOT.trim();
    if (!empresaId || !buscado) {
      setOt(null);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ots')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('numero_ot', buscado)
        .order('fecha_modificacion', { ascending: false })
        .limit(1);
      if (error) throw error;
      const fila = ((data as unknown as OTRow[]) || [])[0];
      setOt(fila ? rowToOT(fila) : null);
    } catch (e) {
      console.warn('[Producción] No se pudo cargar la OT:', e);
      setOt(null);
    } finally {
      setLoading(false);
    }
  }, [empresaId, numeroOT]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { ot, loading, refrescar: cargar };
}

// ── La hoja de corte de paños ────────────────────────────────────────

/**
 * La hoja de corte de la OT, ya partida en las dos secciones que imprime el
 * PDF: la clásica y la de VERTICALES, que el taller corta en mesa aparte.
 *
 * Sale del MISMO motor que el PDF de Fase 4 (`construirHojaCorte`) y de la
 * misma receta de filas (`filasOptimizadorDeOT`): la pantalla no recalcula
 * nada por su cuenta.
 */
export function useHojaCorte(ot: OT | null): {
  rows: OptimizerRow[];
  hoja: HojaCorte | null;
  principal: HojaCorte | null;
  vertical: HojaCorte | null;
  /** Nombre comercial de una tela por su COD_INT, para los totales por tela. */
  nombreDeTela: (codInt: string) => string;
  loading: boolean;
  error: string | null;
} {
  const { empresaId } = useAuth();
  const { catalogo, loading: loadingCat } = useCatalogoProductos();
  const { parametros, loading: loadingParams } = useParametrosCotizador();
  const { formulas, loading: loadingFormulas } = useFormulasFamilias();
  const { reglas, loading: loadingReglas } = useReglasSeleccion();
  const [colmenaPanos, setColmenaPanos] = useState<PanoColmena[]>([]);
  const [cargandoColmena, setCargandoColmena] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sobrantes de tela disponibles: dicen qué pieza sale de un retazo ya
  // cortado y cuál hay que bajar del rollo.
  useEffect(() => {
    if (!empresaId) return;
    let cancelado = false;
    (async () => {
      setCargandoColmena(true);
      try {
        const { data, error: err } = await supabase
          .from('colmena_panos')
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('disponible', true);
        if (err) throw err;
        if (!cancelado) setColmenaPanos(((data || []) as ColmenaPanoRow[]).map(rowToPano));
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelado) setCargandoColmena(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [empresaId]);

  const listo = !loadingCat && !loadingParams && !loadingFormulas && !loadingReglas;

  const rows = useMemo(() => {
    if (!ot || !listo) return [];
    return filasOptimizadorDeOT(ot, catalogo, parametros, formulas, reglas);
  }, [ot, listo, catalogo, parametros, formulas, reglas]);

  const hoja = useMemo(() => {
    if (!ot || rows.length === 0) return null;
    return construirHojaCorte(
      rows,
      colmenaPanos,
      ot,
      parametros,
      ot.datosGenerales?.corteGeneralColmena?.piezas,
    );
  }, [ot, rows, colmenaPanos, parametros]);

  const partes = useMemo(() => (hoja ? partirHojaCorte(hoja) : null), [hoja]);

  const nombreDeTela = useCallback(
    (codInt: string) => catalogo[codInt]?.producto || codInt,
    [catalogo],
  );

  return {
    rows,
    hoja,
    principal: partes?.principal ?? null,
    vertical: partes?.vertical ?? null,
    nombreDeTela,
    loading: !listo || cargandoColmena,
    error,
  };
}

// ── La hoja de cálculo general / dimensionado ────────────────────────

/**
 * La hoja CÁLCULO GENERAL de la OT, con la variante que pida la pantalla:
 * completa para Armado, recortada a lo que corta la mesa de tela para
 * Dimensionado.
 *
 * Las letras de «cortar junto» vienen de la MISMA hoja de corte que ve la
 * pestaña de Paños, así que la columna CONJUNTO PAÑOS del Dimensionado dice
 * lo mismo que el papel del cortador.
 */
export function useCalculoGeneral(
  ot: OT | null,
  variante: VarianteHojaCalculo,
): {
  data: CalculoGeneral | null;
  identidad: ColumnaCalculo[];
  bloques: { sistema: BloqueSistema; columnas: ColumnaCalculo[] }[];
  loading: boolean;
} {
  const { catalogo, loading: loadingCat } = useCatalogoProductos();
  const { parametros, loading: loadingParams } = useParametrosCotizador();
  const { formulas, loading: loadingFormulas } = useFormulasFamilias();
  const { reglas, loading: loadingReglas } = useReglasSeleccion();
  const listo = !loadingCat && !loadingParams && !loadingFormulas && !loadingReglas;

  const juntoPorPieza = useMemo(() => {
    if (!ot || !listo) return undefined;
    const filas = filasOptimizadorDeOT(ot, catalogo, parametros, formulas, reglas);
    if (filas.length === 0) return undefined;
    const { cortinas } = construirHojaCorte(filas, [], ot, parametros);
    const mapa = new Map<string, JuntoPieza>();
    filas.forEach((r, i) => {
      const letra = cortinas[i]?.cortarJunto;
      if (letra) {
        mapa.set(`${r.ventanaId}_${r.panoIndex}`, {
          letra,
          invertida: !!cortinas[i]?.invertida,
        });
      }
    });
    return mapa;
  }, [ot, listo, catalogo, parametros, formulas, reglas]);

  const data = useMemo(() => {
    if (!ot || !listo) return null;
    const ventanas = (ot.storeVentanas || []) as unknown as Ventana[];
    if (ventanas.length === 0) return null;
    return construirCalculoGeneral(ventanas, catalogo, parametros, juntoPorPieza, {
      altoMesaCorteDuo: variante.altoMesaCorteDuo,
      usarTuboE78: !!ot.datosGenerales?.usarTuboE78,
      formulas,
      reglas,
    });
  }, [ot, listo, catalogo, parametros, juntoPorPieza, variante, formulas, reglas]);

  const vista = useMemo(
    () => (data ? aplicarVariante(data, variante) : { identidad: [], bloques: [] }),
    [data, variante],
  );

  return { data, identidad: vista.identidad, bloques: vista.bloques, loading: !listo };
}

// ── Las marcas del taller ────────────────────────────────────────────

export type UseChecks = {
  hechas: Set<string>;
  /** Quién marcó cada clave, para el tooltip de la fila. */
  quien: Map<string, string>;
  /** La nota guardada en una clave (rack de la bolsa, detalle de un problema). */
  notaDe: Map<string, string>;
  areaLista: boolean;
  loading: boolean;
  marcar: (clave: string, hecho: boolean, nota?: string) => Promise<void>;
  marcarAreaLista: (lista: boolean) => Promise<void>;
};

/**
 * Las marcas de un área para una OT. `ref` acota las claves a un contexto (en
 * Estructura, el id del plan): si el plan se corrigió, nace con id nuevo y el
 * avance parte de cero en vez de heredar marcas de filas que ya no existen.
 *
 * El sentinel `__area__` va SIEMPRE con ref vacío: «el área está lista» es de
 * la OT, no de un plan en particular.
 */
/**
 * La identidad REAL de una marca es su UNIQUE, no su id: la fila optimista que
 * pinta el clic todavía no tiene id de la base. Mezclar por id dejaba dos
 * filas para la misma casilla —la local y la que traía el realtime— y bastaba
 * con desmarcar para que la vieja siguiera diciendo «hecho».
 */
function claveNatural(f: { area: string; ot: string; ref: string; clave: string }): string {
  return `${f.area}|${f.ot}|${f.ref}|${f.clave}`;
}

function mezclar(prev: CheckProduccion[], fila: CheckProduccion): CheckProduccion[] {
  const k = claveNatural(fila);
  const i = prev.findIndex((f) => claveNatural(f) === k);
  if (i < 0) return [...prev, fila];
  const next = [...prev];
  next[i] = fila;
  return next;
}

export function useChecks(area: AreaProduccion, ot: string, ref: string = ''): UseChecks {
  const { empresaId, perfil } = useAuth();
  const [filas, setFilas] = useState<CheckProduccion[]>([]);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
    const numero = ot.trim();
    if (!empresaId || !numero) {
      setFilas([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('produccion_checks' as any)
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('ot', numero)
        .eq('area', area);
      if (error) throw error;
      setFilas((data || []) as unknown as CheckProduccion[]);
    } catch (e) {
      console.warn('[Producción] No se pudieron cargar las marcas:', e);
      setFilas([]);
    } finally {
      setLoading(false);
    }
  }, [empresaId, ot, area]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Realtime: el filtro del canal solo admite una condición, así que se
  // suscribe por empresa y se descarta en el handler lo que no es de esta
  // pantalla.
  useEffect(() => {
    const numero = ot.trim();
    if (!empresaId || !numero) return;
    const canal = supabase
      .channel(`prod-checks-${crypto.randomUUID()}`)
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
          if (!fila || fila.ot !== numero || fila.area !== area) return;
          setFilas((prev) => mezclar(prev, fila));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [empresaId, ot, area]);

  const { hechas, quien, notaDe, areaLista } = useMemo(() => {
    const hechasSet = new Set<string>();
    const quienMap = new Map<string, string>();
    const notaMap = new Map<string, string>();
    let lista = false;
    for (const f of filas) {
      if (f.clave === CLAVE_AREA) {
        lista = f.hecho;
        continue;
      }
      if (f.ref !== ref) continue;
      if (f.hecho) hechasSet.add(f.clave);
      if (f.hecho_por) quienMap.set(f.clave, f.hecho_por);
      if (f.nota) notaMap.set(f.clave, f.nota);
    }
    return { hechas: hechasSet, quien: quienMap, notaDe: notaMap, areaLista: lista };
  }, [filas, ref]);

  const upsert = useCallback(
    async (clave: string, refFila: string, hecho: boolean, nota?: string) => {
      const numero = ot.trim();
      if (!empresaId || !numero) return;
      const fila = {
        empresa_id: empresaId,
        ot: numero,
        area,
        ref: refFila,
        clave,
        hecho,
        nota: nota ?? null,
        hecho_por: perfil?.nombre ?? null,
        hecho_por_id: perfil?.id ?? null,
        hecho_en: new Date().toISOString(),
      };
      // Optimista: el operario no puede quedarse mirando el spinner con la
      // sierra en la mano. El realtime confirma después.
      setFilas((prev) => {
        const k = claveNatural(fila);
        const previa = prev.find((f) => claveNatural(f) === k);
        return mezclar(prev, {
          ...(previa ?? ({ id: `local:${k}` } as CheckProduccion)),
          ...fila,
        } as CheckProduccion);
      });
      const { error } = await supabase
        .from('produccion_checks' as any)
        .upsert(fila as any, { onConflict: 'empresa_id,area,ot,ref,clave' });
      if (error) {
        await cargar();
        throw error;
      }
    },
    [empresaId, ot, area, perfil, cargar],
  );

  const marcar = useCallback(
    (clave: string, hecho: boolean, nota?: string) => upsert(clave, ref, hecho, nota),
    [upsert, ref],
  );

  const marcarAreaLista = useCallback(
    (lista: boolean) => upsert(CLAVE_AREA, '', lista),
    [upsert],
  );

  return { hechas, quien, notaDe, areaLista, loading, marcar, marcarAreaLista };
}

// ── Los insumos de la OT (picking de bodega) ─────────────────────────

/**
 * Los insumos consolidados de la OT: los MISMOS de la hoja de inventario que
 * hoy se imprime, con su grupo de destino. Acá no se recalcula nada.
 */
export function useInsumosOT(ot: OT | null): {
  insumos: InsumoConsolidado[];
  loading: boolean;
} {
  const { empresaId } = useAuth();
  const { catalogo, loading: loadingCat } = useCatalogoProductos();
  const { parametros, loading: loadingParams } = useParametrosCotizador();
  const { formulas, loading: loadingFormulas } = useFormulasFamilias();
  const { reglas, loading: loadingReglas } = useReglasSeleccion();
  const [cadenas, setCadenas] = useState<CadenaInsumo[]>([]);
  const [cargandoCadenas, setCargandoCadenas] = useState(false);

  // Catálogo de cadenas: si un paño no guardó su codCadena (OT que no pasó por
  // Fase 2), el inventario la resuelve por alto + color con este catálogo.
  useEffect(() => {
    if (!empresaId) return;
    let cancelado = false;
    (async () => {
      setCargandoCadenas(true);
      try {
        const { data } = await supabase
          .from('insumos')
          .select('cod,nemotecnico,color,status')
          .eq('empresa_id', empresaId);
        if (!cancelado) {
          setCadenas(((data || []) as CadenaInsumo[]).filter((i) => esCadenaRoller(i.cod)));
        }
      } finally {
        if (!cancelado) setCargandoCadenas(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [empresaId]);

  const listo = !loadingCat && !loadingParams && !loadingFormulas && !loadingReglas;

  const insumos = useMemo(() => {
    if (!ot || !listo) return [];
    const ventanas = (ot.storeVentanas || []) as unknown as Ventana[];
    if (ventanas.length === 0) return [];
    return construirInventario(
      ventanas,
      catalogo,
      parametros,
      cadenas,
      !!ot.datosGenerales?.usarTuboE78,
      ot.datosGenerales?.adicionalesFase0,
      formulas,
      reglas,
    ).insumos;
  }, [ot, listo, catalogo, parametros, cadenas, formulas, reglas]);

  return { insumos, loading: !listo || cargandoCadenas };
}

/**
 * Lo que hace falta para decir DÓNDE está cada insumo: el maestro de insumos,
 * el mapa de racks y la colmena de tubos. Se carga una vez por pantalla y se
 * comparte entre todas las filas.
 */
export function useCatalogoBodega(): {
  insumosCat: InsumoBodega[];
  racks: Rack[];
  tubos: TuboColmena[];
  loading: boolean;
} {
  const { empresaId } = useAuth();
  const [insumosCat, setInsumosCat] = useState<InsumoBodega[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [tubos, setTubos] = useState<TuboColmena[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    let cancelado = false;
    (async () => {
      setLoading(true);
      try {
        const [rIns, rRacks, rTubos] = await Promise.all([
          supabase
            .from('insumos')
            .select(
              'cod,nemotecnico,descriptor_proveedor,categoria,color,ubicacion,stock_mp,stock_liberado',
            )
            .eq('empresa_id', empresaId),
          supabase
            .from('ubicaciones_rack')
            .select('rack,fila,columna,codigo_insumo,almacen')
            .eq('empresa_id', empresaId),
          supabase
            .from('colmena_tubos')
            .select('cod,n_colmena,medida_cm')
            .eq('empresa_id', empresaId),
        ]);
        if (cancelado) return;
        setInsumosCat((rIns.data || []) as unknown as InsumoBodega[]);
        setRacks((rRacks.data || []) as unknown as Rack[]);
        setTubos((rTubos.data || []) as unknown as TuboColmena[]);
      } catch (e) {
        console.warn('[Producción] No se pudo cargar el mapa de bodega:', e);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [empresaId]);

  return { insumosCat, racks, tubos, loading };
}

// ── Lo que costó la OT (solo administradores) ────────────────────────

/**
 * El aluminio que se cortó DE VERDAD para esta OT, del historial de la colmena.
 *
 * El `ot` del historial lo escribió una persona en el optimizador, así que hay
 * «OT 3182» junto a «3182». Se pide por parecido y se filtra con la misma
 * regla que busca el plan de corte, para no contarle a la 318 los tubos de la
 * 3182.
 */
export function useConsumoAluminio(numeroOT: string): {
  consumo: ConsumoAluminio[];
  loading: boolean;
} {
  const { empresaId } = useAuth();
  const [consumo, setConsumo] = useState<ConsumoAluminio[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const buscado = numeroOT.trim();
    if (!empresaId || !buscado) {
      setConsumo([]);
      return;
    }
    let cancelado = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('tubos_historial')
          .select('cod, medida_cm, evento, ot')
          .eq('empresa_id', empresaId)
          .in('evento', ['corte', 'merma'])
          .ilike('ot', `%${buscado}%`);
        if (error) throw error;
        if (cancelado) return;
        const objetivo = normalizarNumeroOT(buscado);
        const acc = new Map<string, ConsumoAluminio>();
        for (const f of (data || []) as unknown as Array<{
          cod: string;
          medida_cm: number | string | null;
          evento: string;
          ot: string | null;
        }>) {
          if (normalizarNumeroOT(f.ot) !== objetivo) continue;
          const cod = String(f.cod || '').trim();
          if (!cod) continue;
          const m = (Number(f.medida_cm) || 0) / 100;
          const prev = acc.get(cod) || { cod, metros: 0, merma: 0 };
          if (f.evento === 'merma') prev.merma += m;
          else prev.metros += m;
          acc.set(cod, prev);
        }
        setConsumo([...acc.values()].sort((a, b) => a.cod.localeCompare(b.cod, 'es')));
      } catch (e) {
        console.warn('[Producción] No se pudo leer el aluminio cortado:', e);
        if (!cancelado) setConsumo([]);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [empresaId, numeroOT]);

  return { consumo, loading };
}

/** Lo que cuesta cada código en bodega. Solo lo pide la pantalla de costo. */
export function useCostosBodega(activo: boolean): { costos: CostoBodega[]; loading: boolean } {
  const { empresaId } = useAuth();
  const [costos, setCostos] = useState<CostoBodega[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!empresaId || !activo) return;
    let cancelado = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('insumos')
          .select('cod, costo_iva')
          .eq('empresa_id', empresaId);
        if (error) throw error;
        if (cancelado) return;
        setCostos(
          ((data || []) as unknown as Array<{ cod: string; costo_iva: number | string | null }>).map(
            (f) => ({ cod: f.cod, costoIva: Number(f.costo_iva) || 0 }),
          ),
        );
      } catch (e) {
        console.warn('[Producción] No se pudieron leer los costos de bodega:', e);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [empresaId, activo]);

  return { costos, loading };
}

/**
 * Guarda lo que se escribió a mano en «Costo total». Es el otro upsert de OT
 * completa de este módulo: relee la OT justo antes para no pisar lo que haya
 * guardado la oficina mientras tanto.
 */
export function useGuardarCostosOT(numeroOT: string): {
  guardar: (manual: CostoManualOT) => Promise<void>;
} {
  const { empresaId } = useAuth();

  const guardar = useCallback(
    async (manual: CostoManualOT) => {
      const numero = numeroOT.trim();
      if (!empresaId || !numero) return;
      const { data, error } = await supabase
        .from('ots')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('numero_ot', numero)
        .order('fecha_modificacion', { ascending: false })
        .limit(1);
      if (error) throw error;
      const fila = ((data as unknown as OTRow[]) || [])[0];
      if (!fila) throw new Error(`La OT ${numero} ya no está en el sistema.`);
      const ot = rowToOT(fila);
      const actualizada: OT = {
        ...ot,
        datosGenerales: { ...(ot.datosGenerales || {}), costosOT: manual },
        fechaModificacion: new Date().toISOString(),
      };
      const { error: errUp } = await supabase
        .from('ots')
        .upsert(otToRow(actualizada, empresaId) as unknown as never, { onConflict: 'id' });
      if (errUp) throw errUp;
    },
    [empresaId, numeroOT],
  );

  return { guardar };
}

// ── Cerrar la OT desde el taller ─────────────────────────────────────

/**
 * Marca la OT como LISTA PARA ENTREGA. Es la misma escritura que hace el botón
 * de Fase 4 —estado `lista`, sin sub-etapa y con el paso anotado en el
 * historial—, para que una OT cerrada desde el taller sea indistinguible de
 * una cerrada desde la oficina.
 */
export function useMarcarOTLista(numeroOT: string): {
  marcarLista: () => Promise<boolean>;
} {
  const { empresaId } = useAuth();

  const marcarLista = useCallback(async (): Promise<boolean> => {
    const numero = numeroOT.trim();
    if (!empresaId || !numero) return false;
    const { data, error } = await supabase
      .from('ots')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('numero_ot', numero)
      .order('fecha_modificacion', { ascending: false })
      .limit(1);
    if (error) throw error;
    const fila = ((data as unknown as OTRow[]) || [])[0];
    if (!fila) return false;

    const ot = rowToOT(fila);
    if (ot.estado === 'lista') return true;
    const dg = {
      ...(ot.datosGenerales || {}),
      historialEstados: [
        ...(ot.datosGenerales?.historialEstados || []),
        { de: ot.estado, a: 'lista' as const, fecha: new Date().toISOString() },
      ],
    };
    const actualizada: OT = {
      ...ot,
      estado: 'lista',
      subEtapa: null,
      datosGenerales: dg,
      fechaModificacion: new Date().toISOString(),
    };
    const { error: errUp } = await supabase
      .from('ots')
      .upsert(otToRow(actualizada, empresaId) as unknown as never, { onConflict: 'id' });
    if (errUp) throw errUp;
    return true;
  }, [empresaId, numeroOT]);

  return { marcarLista };
}

// ── La compuerta que mueve la sub-etapa de la OT ─────────────────────

export function useAvanceSubEtapa(numeroOT: string): {
  areasListas: AreasListas;
  /** Relee las áreas cerradas y mueve la OT si corresponde. */
  sincronizar: () => Promise<SubEtapaProd | null>;
  refrescar: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [areasListas, setAreasListas] = useState<AreasListas>({});
  const sincronizando = useRef(false);

  const leerAreas = useCallback(async (): Promise<AreasListas> => {
    const numero = numeroOT.trim();
    if (!empresaId || !numero) return {};
    const { data, error } = await supabase
      .from('produccion_checks' as any)
      .select('area, hecho')
      .eq('empresa_id', empresaId)
      .eq('ot', numero)
      .eq('clave', CLAVE_AREA);
    if (error) {
      console.warn('[Producción] No se pudieron leer las áreas cerradas:', error.message);
      return {};
    }
    const mapa: AreasListas = {};
    for (const f of (data || []) as unknown as Array<{ area: AreaProduccion; hecho: boolean }>) {
      mapa[f.area] = f.hecho;
    }
    return mapa;
  }, [empresaId, numeroOT]);

  const refrescar = useCallback(async () => {
    setAreasListas(await leerAreas());
  }, [leerAreas]);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  /**
   * Mueve la OT a la sub-etapa que le toca. Nunca la retrocede: el select
   * manual del Panel sigue mandando. Escribe la OT completa (es el único
   * upsert que hace esta pantalla) leyéndola justo antes, para no pisar lo
   * que otro haya guardado mientras tanto.
   */
  const sincronizar = useCallback(async (): Promise<SubEtapaProd | null> => {
    const numero = numeroOT.trim();
    if (!empresaId || !numero || sincronizando.current) return null;
    sincronizando.current = true;
    try {
      const listas = await leerAreas();
      setAreasListas(listas);
      const objetivo = calcularSubEtapa(listas);

      const { data, error } = await supabase
        .from('ots')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('numero_ot', numero)
        .order('fecha_modificacion', { ascending: false })
        .limit(1);
      if (error) throw error;
      const fila = ((data as unknown as OTRow[]) || [])[0];
      if (!fila) return null;

      const ot = rowToOT(fila);
      if (!debeAvanzar(ot.subEtapa, objetivo)) return null;

      const actualizada: OT = {
        ...ot,
        subEtapa: objetivo,
        fechaModificacion: new Date().toISOString(),
      };
      const { error: errUp } = await supabase
        .from('ots')
        .upsert(otToRow(actualizada, empresaId) as unknown as never, { onConflict: 'id' });
      if (errUp) throw errUp;
      return objetivo;
    } catch (e) {
      console.warn('[Producción] No se pudo mover la sub-etapa:', e);
      return null;
    } finally {
      sincronizando.current = false;
    }
  }, [empresaId, numeroOT, leerAreas]);

  return { areasListas, sincronizar, refrescar };
}
