// Tipos del cotizador. Portados desde public/legacy/index.html.

export type Producto = {
  cod: string;
  producto: string;
  tipo: string;
  descripcion: string;
  precio: number;
  colorGrupo?: string;
  anchoRollo?: number | string;
  /** Descuento por defecto de este código (0–1). Autollena el DCT% en Fase 0. */
  descuento?: number;
  /** Categoría comercial de la tela ('A' | 'B'), de la planilla TELAS DEPURADAS. */
  categoria?: string;
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
  /** Código del insumo-cadena del inventario (CAD01…). Enlaza la OT al stock. */
  codCadena?: string;
  /** Código del insumo-peso de cadena del inventario (PCA01/PCA04). Enlaza al stock. */
  codPeso?: string;
  cierreVert?: string;
  manillaCant?: number;
  manillaColor?: string;
  colorPeso?: string;
  colorCadena?: string;
  colorMecanismo?: string;
  cenefa?: string;
  /** 'CON TIRA' | 'SIN TIRA' — cenefa ovalada (Excel órdenes / optimizador). */
  cenefaTira?: string;
  /** Sistemas de oscuridad: variante de instalación 'INTERNO'|'SEMI'|'EXTERNO'. */
  oscuridadVariante?: string;
  /** Sistemas de oscuridad: interruptores ON/OFF de perfiles. */
  perfilIzqMuro?: boolean;
  perfilIzqPiso?: boolean;
  perfilDerMuro?: boolean;
  perfilDerPiso?: boolean;
  perfilInfMuro?: boolean;
  perfilInfPiso?: boolean;
  /** Medida manual (cm) que sobreescribe la calculada por perfil (ajuste de terreno). */
  perfilIzqMuroCm?: number;
  perfilIzqPisoCm?: number;
  perfilDerMuroCm?: number;
  perfilDerPisoCm?: number;
  perfilInfMuroCm?: number;
  perfilInfPisoCm?: number;
  /** BEEBLACK: variante de instalación 'INTERNO'|'EXTERNO_SEMI'. */
  beeblackVariante?: string;
  /** BEEBLACK INTERNO: manillas ON/OFF. */
  beeblackManillaIzq?: boolean;
  beeblackManillaDer?: boolean;
  /** BEEBLACK EXTERNO_SEMI: extras +3 cm por lado/extremo. */
  beeblackExtraSupInfIzq?: boolean;
  beeblackExtraSupInfDer?: boolean;
  beeblackExtraLatSup?: boolean;
  beeblackExtraLatInf?: boolean;
  /** BEEBLACK: overrides cm de terreno. */
  beeblackPerfilSupAnchoCm?: number;
  beeblackPerfilInfAnchoCm?: number;
  beeblackPerfilLatIzqCm?: number;
  beeblackPerfilLatDerCm?: number;
  beeblackManillaIzqCm?: number;
  beeblackManillaDerCm?: number;
  beeblackAnchoTelaCm?: number;
  beeblackAltoTelaCm?: number;
  beeblackTotalLamasCm?: number;
  colorTapa?: string;
  cenefaTapa?: string;
  /**
   * Corte invertido (rotado 90°): el alto va a lo ancho del rollo y el ancho
   * corre a lo largo. Necesario cuando la cortina es más ancha que el rollo.
   * Se auto-marca en Fase 2 según el ancho; el usuario puede confirmar/quitar
   * (telas con dirección/diseño no se pueden rotar). Lo lee la hoja de corte.
   */
  invertida?: boolean;
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
  /** Sentido de la cortina (INTERNO / EXTERNO) — define variante Soft Light. */
  sentido?: string;
  /** Dirección cadena/cierre de Fase 0 (CAD [IZQUIERDA], etc.). */
  direccion?: string;
  /**
   * Modelo de fabricación elegido (snapshot del catálogo de descuentos al
   * momento de guardar). Lo usa el motor de despiece para calcular las
   * medidas de corte de tubo/tela/peso/cenefas. Import laxo para no acoplar
   * este módulo a descuentos: la forma real es ModeloDespiece.
   */
  modelo?: import('@/modules/descuentos/tipos').ModeloDespiece | null;
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
