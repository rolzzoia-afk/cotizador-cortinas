// Tipos de dominio compartidos por la pantalla de Historial de Tubos.
// Se importan desde las 3 vistas y desde EventoItem.

import type { LucideIcon } from 'lucide-react';

export type Evento = {
  id: string;
  cod: string;
  n_colmena: string | null;
  evento: string;
  medida_cm: number | null;
  medida_resultado_cm: number | null;
  ot: string | null;
  notas: string | null;
  fuente: string | null;
  registrado_por: string | null;
  tubo_raiz_id: string | null;
  created_at: string;
};

export type EvCfg = {
  color: string;
  icon: LucideIcon;
  label: string;
  esRestauracion?: boolean;
};

// Tipos de la vista Trazabilidad

export type TuboResultado = {
  tubo_raiz_id: string;
  cod: string | null;
  n_colmena: string | null;
  medida_cm: number | null;
  evento_en_ot: string;
  en_inventario: boolean;
  fecha_primera: string | null;
};

export type FichaTuboResp = {
  tubo: {
    tubo_raiz_id: string;
    cod: string | null;
    n_colmena: string | null;
    medida_cm: number | null;
    en_inventario: boolean;
    estado_descripcion: string;
  };
  origen: {
    evento: string;
    fuente: string | null;
    fecha: string;
    ot: string | null;
    n_colmena: string | null;
    medida_cm: number | null;
    notas: string | null;
  } | null;
  padre: {
    tubo_raiz_id: string;
    cod: string | null;
    n_colmena: string | null;
    medida_cm: number | null;
    evento_corte_fecha: string;
    evento_corte_ot: string | null;
    evento_corte_linea: number | null;
  } | null;
  eventos: Evento[];
  hijos: Array<{
    tubo_raiz_id: string;
    evento: string;
    n_colmena: string | null;
    cod: string | null;
    medida_cm: number | null;
    fecha: string;
    ot: string | null;
    en_inventario: boolean;
  }>;
  consumido_en: {
    ot: string | null;
    linea_idx: number | null;
    medida_cortada: number | null;
    fecha: string;
  } | null;
};
