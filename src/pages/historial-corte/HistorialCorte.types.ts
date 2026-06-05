// Tipos compartidos del módulo Historial de Corte.

export type ResultadoCorte = {
  colmena?: string | number | null;
  colmena_sobrante?: string | number | null;
  codigo?: string | null;
  codigo_original?: string | null;
  color?: string | null;
  orden?: string | null;
  medida_cm?: number | null;
  medida_origen?: number | null;
  sobrante_cm?: number | null;
  es_cenefa_ovalada?: boolean;
  es_peso?: boolean;
  es_intermedio?: boolean;
  es_desecho?: boolean;
  serial?:
    | { lote?: string; paquete?: string; serial?: string; fecha?: string }
    | string
    | null;
  lote?: string | null;
  paquete?: string | null;
  serial_str?: string | null;
  tubo_raiz_id?: string | null;
};

export type Orden = {
  id: string;
  ot?: string | null;
  numero_ot?: string | null;
  ubic?: string | null;
  ubicacion?: string | null;
};

export type ResultadoItem = {
  resultado?: ResultadoCorte;
  orden?: Orden | string | null;
} & ResultadoCorte;

export type Plan = {
  id: string;
  fecha: string | null;
  fecha_correccion: string | null;
  resultados: ResultadoItem[];
  ordenes: Orden[];
};

export type ErrorRow = {
  id?: string;
  plan_id: string | null;
  linea_idx: number | null;
  motivo: string;
  ot: string | null;
  cod_original: string | null;
  medida_cm: number | null;
  reemplazo_cod: string | null;
  reemplazo_colmena: string | null;
  reemplazo_medida_cm: number | null;
  registrado_por: string | null;
  created_at: string;
};

export type Tubo = {
  id: string;
  n_colmena: string | number;
  cod: string | null;
  medida_cm: number | null;
  tubo_raiz_id?: string | null;
};

export type CorteCtx = {
  planId: string;
  planFecha: string | null;
  idx: number;
  r: ResultadoCorte;
  ord: Orden;
};

export type Destino = 'merma' | 'recuperar' | null;
