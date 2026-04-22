// Tipos del panel "Ojo de Dios" (admin dashboard).

export type Tela = {
  id: string;
  codigo: string;
  nombre: string;
  ancho_m: number | null;
  metros_disponibles: number;
  alerta_minimo: number;
  fechaActualizacion: string | null;
};

export type TelaInput = {
  codigo: string;
  nombre: string;
  ancho_m: number;
  metros_disponibles: number;
  alerta_minimo: number;
};
