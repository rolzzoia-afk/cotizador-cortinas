// La lectura de la pantalla de Reportes.
//
// Todo sale de lo que ya está en la base: `insumos` (saldo y costo), las
// salidas de `movimientos_insumos` y las mermas de tela. Nada se calcula en
// la base todavía: son consultas simples y el módulo puro hace las cuentas,
// que es lo que se puede testear.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { MermaTela, SalidaValorizable } from './reportes';

export type ArticuloReporte = {
  codigo: string;
  nombre: string;
  grupo: string | null;
  saldo: number;
  costo: number | null;
};

export type DatosReportes = {
  articulos: ArticuloReporte[];
  salidas: SalidaValorizable[];
  mermas: MermaTela[];
  /** Código → fecha de su última salida. */
  ultimaSalida: Map<string, string>;
  /** Código → costo unitario, para valorizar el consumo. */
  costos: Map<string, number>;
  /** Cuántas telas y tubos quedaron fuera por no tener costo en la base. */
  fueraDeValorizacion: { telas: number; tubos: number };
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
};

const VACIO = {
  articulos: [] as ArticuloReporte[],
  salidas: [] as SalidaValorizable[],
  mermas: [] as MermaTela[],
  ultimaSalida: new Map<string, string>(),
  costos: new Map<string, number>(),
  fueraDeValorizacion: { telas: 0, tubos: 0 },
};

function mensajeError(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  if (code === '42501') return 'Solo un administrador puede ver los reportes: llevan el costo.';
  if (code === 'PGRST205' || code === '42P01')
    return 'Falta una tabla del inventario en la base. Avisa a quien administra el sistema.';
  const msg = (e as { message?: string })?.message;
  return msg ? `No se pudieron cargar los reportes: ${msg}` : 'No se pudieron cargar los reportes.';
}

export function useReportes(meses = 12): DatosReportes {
  const { empresaId } = useAuth();
  const [datos, setDatos] = useState(VACIO);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const desde = new Date();
      desde.setMonth(desde.getMonth() - meses);
      const desdeISO = desde.toISOString();

      const [rIns, rSal, rMer, rTel, rTub] = await Promise.all([
        supabase
          .from('insumos')
          .select('cod,nemotecnico,descriptor_proveedor,sub_categoria,color,stock_mp,stock_liberado,costo')
          .eq('empresa_id', empresaId),
        supabase
          .from('movimientos_insumos')
          .select('codigo,cantidad,fecha')
          .eq('empresa_id', empresaId)
          .ilike('tipo', 'SALIDA%')
          .gte('fecha', desdeISO),
        supabase
          .from('telas_mermas')
          .select('medida_ancho,medida_alto,fecha')
          .eq('empresa_id', empresaId)
          .gte('fecha', desdeISO),
        // Solo para contar cuánto queda fuera del total: estas dos tablas no
        // tienen columna de costo, así que su valor no se puede calcular.
        supabase
          .from('telas_catalogo')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId),
        supabase
          .from('colmena_tubos')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId),
      ]);

      if (rIns.error) throw rIns.error;

      const articulos: ArticuloReporte[] = (rIns.data || [])
        .filter((i) => i.cod)
        .map((i) => ({
          codigo: String(i.cod),
          nombre: i.nemotecnico || i.descriptor_proveedor || String(i.cod),
          color: i.color,
          grupo: i.sub_categoria,
          saldo: Number(i.stock_mp ?? 0) + Number(i.stock_liberado ?? 0),
          costo: i.costo,
        }));

      const costos = new Map<string, number>();
      for (const a of articulos) {
        if (Number(a.costo ?? 0) > 0) costos.set(a.codigo.trim().toUpperCase(), Number(a.costo));
      }

      const salidas = (rSal.data || []) as SalidaValorizable[];
      const ultimaSalida = new Map<string, string>();
      for (const s of salidas) {
        const cod = String(s.codigo ?? '').trim().toUpperCase();
        const f = String(s.fecha ?? '');
        if (!cod || !f) continue;
        const previa = ultimaSalida.get(cod);
        if (!previa || Date.parse(f) > Date.parse(previa)) ultimaSalida.set(cod, f);
      }

      setDatos({
        articulos,
        salidas,
        mermas: (rMer.data || []) as MermaTela[],
        ultimaSalida,
        costos,
        fueraDeValorizacion: { telas: rTel.count ?? 0, tubos: rTub.count ?? 0 },
      });
      setLoading(false);
    } catch (e) {
      setError(mensajeError(e));
      setDatos(VACIO);
      setLoading(false);
    }
  }, [empresaId, meses]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { ...datos, loading, error, recargar: cargar };
}
