// Tipos de dominio del Panel KPI Ventas.

export type KpiConfig = {
  meta_visitas: number;
  meta_cierre_pct: number;
  canales: string[];
  vendedoras: string[];
  terreno: string[];
};

export type Periodo = 'dia' | 'semana' | 'mes';

export type Registro = {
  fecha: string;
  clave: string;
  valor: number;
};
