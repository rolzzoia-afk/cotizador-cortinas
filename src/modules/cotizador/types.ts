// Tipos del cotizador. Portados desde public/legacy/index.html.

export type Producto = {
  cod: string;
  producto: string;
  tipo: string;
  descripcion: string;
  precio: number;
  colorGrupo?: string;
};

// Mapa de catálogo: COD_INT → Producto. Se guarda en Supabase `configuracion`
// con clave='catalogo_productos_data' como JSON string.
export type CatalogoProductos = Record<string, Producto>;

// Un paño dentro de una ventana. Legacy define muchos campos adicionales
// que sólo aplican a Fase 2 (ficha técnica); en Fase 1/3 nos alcanza con
// ancho, alto y color.
export type Pano = {
  ancho: number | string;
  alto: number | string;
  color: string;
  armado?: string;
  tipoTela?: string;
  largoCadena?: string | number;
  cierreVert?: string;
  manillaCant?: number;
  manillaColor?: string;
  colorPeso?: string;
  colorCadena?: string;
  colorMecanismo?: string;
  cenefa?: string;
  colorTapa?: string;
  cenefaTapa?: string;
  retiro?: number;
  superficie?: string;
  materialTipo?: string;
  ordenDoble?: boolean;
  ordenDobleOpcion?: string;
  mecanismo?: string;
  tuberia?: string;
  dual?: boolean;
  dualLado?: string;
  dualColor?: string;
  motorTipo?: string;
  motorControlAdic?: boolean;
  motorHubUsb?: boolean;
  ladoMotor?: string;
  softDark?: string;
  instalacion?: string;
  separador?: string;
  cortes?: string;
  verVideo?: boolean;
  relacionMarco?: string;
  alturaCierre?: string;
  cotizarConSin?: string;
  suplementos?: string;
  comentarioFinal?: string;
};

export type Ventana = {
  id: string | number;
  ubicacion: string;
  codInt: string;
  producto: string;
  tipo: string;
  descripcion?: string;
  color: string;
  alto: number;
  precio: number;
  cantidad: number;
  subtotal?: number;
  fase?: string;
  categoria: string;
  grupoId: string | null;
  grupoOrden?: number;
  panos: Pano[];
};

// Ítem en construcción dentro de Fase 1 (antes de enviar a Fase 2).
// No tiene panos[] aún — se crea al enviar.
export type ItemFase1 = {
  id: string;
  codInt: string;
  producto: string;
  tipo: string;
  ubicacion: string;
  categoria: string;
  color: string;
  cantidad: number;
  ancho: number;
  alto: number;
  precio: number;
};
