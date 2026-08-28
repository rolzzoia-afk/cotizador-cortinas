// Tipos del cotizador. Portados desde public/legacy/index.html.

export type Producto = {
  cod: string;
  producto: string;
  tipo: string;
  descripcion: string;
  precio: number;
  /**
   * Lo que le cuesta a la empresa un metro de esta tela, con IVA. NO interviene
   * en la cotización —el precio de venta es `precio`—: se usa solo en el «Costo
   * total» de producción, para saber cuánto quedó de verdad de una OT. Ausente
   * = todavía no se cargó, y esa pantalla lo dice en vez de suponer un número.
   */
  costo?: number;
  colorGrupo?: string;
  anchoRollo?: number | string;
  /** Descuento por defecto de este código (0–1). Autollena el DCT% en Fase 0. */
  descuento?: number;
  /** Categoría comercial de la tela ('A' | 'B'), de la planilla TELAS DEPURADAS. */
  categoria?: string;
  /**
   * Chip del catálogo de Fase 1 donde se muestra este producto (id de
   * FILTROS_CATALOGO). Ausente = automático: se deduce del COD_INT o de la
   * familia, y si no calza en ninguno cae en «Otros». Se elige a mano cuando el
   * automático no acierta — p. ej. un motor nuevo cuyo `cod` es ACCESORIO como
   * todos, que se quiere ver junto a sus hermanos en MOTOR MG.
   */
  chip?: string;
  /**
   * URL pública de la ficha de la tela (la lámina «LUXOR DUO GRIS CLARO» con
   * gama, código y ancho máximo). Se muestra en la sección de la habitación del
   * INFORME CLIENTE, igual que en el correo que se manda a mano. Vacío = esa
   * habitación va sin imagen.
   */
  foto?: string;
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
  /**
   * Código del insumo-tope de cadena del inventario (TOP01/04/05/06). Vacío =
   * lo resuelve el color de accesorios; con valor = el vendedor lo eligió a
   * mano y manda (igual que la cadena). Van 2 por cadena.
   */
  codTope?: string;
  cierreVert?: string;
  manillaCant?: number;
  manillaColor?: string;
  colorPeso?: string;
  colorCadena?: string;
  colorMecanismo?: string;
  /**
   * El vendedor pidió 45 mm EN ESTA CORTINA (eligió el tubo E39 o un kit 45 a
   * mano en Fase 2), con el interruptor «Tubo E39 (2,2–3,0 m)» de la OT
   * apagado. Abre la banda de 45 solo para este paño: el modelo, el kit y el
   * tubo se mantienen en 45 en cada sincronización, y apagar el interruptor de
   * la OT no lo revierte (eso solo baja los que subieron por la banda
   * automática). Se apaga al elegir un tubo o un kit de 38. Sin esto, el E39
   * elegido a mano quedaba con un kit de 38 que no calza en ese tubo (OT 3195).
   */
  tubo45Manual?: boolean;
  cenefa?: string;
  /** 'CON TIRA' | 'SIN TIRA' — cenefa ovalada (Excel órdenes / optimizador). */
  cenefaTira?: string;
  /** Dúo: cierre de altura (cm), medido en terreno por el vendedor. Sale en
   *  la etiqueta de estructura dúo y en la hoja de cálculo general. */
  cierreAlturaCm?: number | string;
  /** Sistemas de oscuridad: variante de instalación 'INTERNO'|'SEMI'|'EXTERNO'. */
  oscuridadVariante?: string;
  /** Sistemas de oscuridad: interruptores ON/OFF de perfiles (superficie = MEDIDA).
   *  Marco = "dentro del marco" (solo variante INTERNO): mide como piso (alto real). */
  perfilIzqMuro?: boolean;
  perfilIzqPiso?: boolean;
  perfilIzqMarco?: boolean;
  perfilDerMuro?: boolean;
  perfilDerPiso?: boolean;
  perfilDerMarco?: boolean;
  perfilInfMuro?: boolean;
  perfilInfPiso?: boolean;
  perfilInfMarco?: boolean;
  /**
   * Perfil ACTIVO (lleva perfil izq/der/base), independiente de la superficie
   * (muro/piso). La variante en Fase 1 activa los laterales; la superficie
   * (medida) se elige en Fase 2. Ausente = inactivo (con retro-compat: un perfil
   * con muro/piso marcado también cuenta como activo).
   */
  perfilIzqActivo?: boolean;
  perfilDerActivo?: boolean;
  perfilInfActivo?: boolean;
  /**
   * Perforación del perfil: 'INTERNO' | 'EXTERNO'. Se asigna en Fase 1 desde la
   * variante (INTERNO→INT, EXTERNO→EXT, SEMI→sin definir); editable en Fase 2.
   * Es una ANOTACIÓN de taller (no cambia la medida). Ausente = sin definir.
   */
  perfilIzqPerf?: string;
  perfilDerPerf?: string;
  perfilInfPerf?: string;
  /**
   * Montaje del perfil BASE (solo soft light INTERNO): 'DENTRO' (default, entre
   * los laterales → ancho − 13,3) | 'PARED' (pared a pared → ancho completo).
   * Se elige en Fase 2; sin efecto en SEMI/EXTERNO ni en Oscuranti/Dark.
   */
  perfilInfMontaje?: string;
  /** Medida manual (cm) que sobreescribe la calculada por perfil (ajuste de terreno). */
  perfilIzqMuroCm?: number;
  perfilIzqPisoCm?: number;
  perfilIzqMarcoCm?: number;
  perfilDerMuroCm?: number;
  perfilDerPisoCm?: number;
  perfilDerMarcoCm?: number;
  perfilInfMuroCm?: number;
  perfilInfPisoCm?: number;
  perfilInfMarcoCm?: number;
  /**
   * Perfiles SEPARADORES (E41/E42/E43) — activación independiente por lado.
   * Oscuridad usa izq/der/base; BEEBLACK además el superior. La medida sale del
   * perfil del mismo lado salvo override manual (separadorXxxCm).
   */
  separadorIzq?: boolean;
  separadorDer?: boolean;
  separadorInf?: boolean;
  separadorSup?: boolean;
  separadorIzqCm?: number;
  separadorDerCm?: number;
  separadorInfCm?: number;
  separadorSupCm?: number;
  /** BEEBLACK: variante de instalación 'INTERNO'|'SEMI'|'EXTERNO'
   *  (los paños viejos pueden traer el legacy 'EXTERNO_SEMI'). */
  beeblackVariante?: string;
  /** BEEBLACK: tipo de instalación elegido en Fase 2 — 'DENTRO_DEL_MARCO' |
   *  'TECHO_A_MURO' | 'FUERA_DEL_MARCO'. Va pegado a la variante y solo mueve
   *  los perfiles laterales (EXTERNO + fuera del marco = alto + 2). */
  beeblackInstalacion?: string;
  /** BEEBLACK: manillas ON/OFF — opt-in en Fase 2, hasta 2 (screen + blackout). */
  beeblackManillaIzq?: boolean;
  beeblackManillaDer?: boolean;
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
  /** Cenefa ovalada: tipo de bracket 'CORTO' (BRA01) | 'LARGO' (BRA02).
   *  Default CORTO — salvo el DÚO, que emite LARGO (su receta cobra BRA02). */
  bracketTipo?: string;
  /**
   * Corte invertido (rotado 90°): el alto va a lo ancho del rollo y el ancho
   * corre a lo largo. Necesario cuando la cortina es más ancha que el rollo.
   * Se auto-marca en Fase 2 según el ancho; el usuario puede confirmar/quitar
   * (telas con dirección/diseño no se pueden rotar). Lo lee la hoja de corte.
   */
  invertida?: boolean;
  /**
   * Línea de fabricación B (gama económica): kits MEC 06/15/37/44/45, tubo E01,
   * pesos E40/E69-B, cenefas E60/E72-B y, en dúo, peso U E25/E70-B + peso
   * interno E79-B/E71-B.
   *
   * Tri-estado como `invertida`: undefined = auto por la categoría comercial de
   * la tela (catálogo, columna A/B); true/false = forzado a mano en la grilla de
   * Fase 1/3 o en el editor de paño. Ver modules/cotizador/lineaB.ts.
   */
  lineaB?: boolean;
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
  /**
   * Tela PROPIA de este paño. Solo se puebla en cortinas DUAL (roller doble
   * tela: cada paño = un roller con su tela); en rollers/dúos normales quedan
   * undefined y todo consumidor cae a la tela de la ventana (ver telaDePano).
   */
  codInt?: string;
  producto?: string;
  descripcion?: string;
  motorTipo?: string;
  motorControlAdic?: boolean;
  motorHubUsb?: boolean;
  /** Modelo de motor: 'DOM38' (tronic) | 'DOM41' (inalámbrico) | 'CABLE' (futuro, sin códigos). */
  motorModelo?: string;
  /** Motor con domótica (agrega 1× DOM43 bridge hub por OT). */
  motorDomotica?: boolean;
  /** Controles remotos adicionales (además del que viene en el kit base). */
  motorControlAdicCant?: number;
  /** Hubs USB (DOM43) adicionales. */
  motorHubUsbCant?: number;
  /**
   * Cargador del motor (tabla INSTALACIÓN del inventario): 'DOM03' (HUB USB 1 QR,
   * por defecto) o 'DOM33' (enchufe adaptador motor grande). Ausente = DOM03.
   */
  motorCargador?: string;
  ladoMotor?: string;
  cortes?: string;
  verVideo?: boolean;
  relacionMarco?: string;
  alturaCierre?: string;
  cotizarConSin?: string;
  /** Nota libre de terreno (legacy; distinto del insumo suplemento). */
  suplementos?: string;
  /** Suplemento seleccionable: 'SUB01' (madera 3mm) | 'SUB02' (acrílico 1,5cm) | '' (ninguno). */
  suplementoTipo?: string;
  /** Cantidad de suplementos; undefined = auto (roller 2 / cenefa 1 por bracket). */
  suplementoCant?: number;
  comentarioFinal?: string;
};

/**
 * Forma de la ventana física cuando NO es rectangular. Una cortina por ventana
 * especial: los paños son las caras del ángulo (bow 3, L 2, triangular 1),
 * y el rótulo viaja al informe del cliente y al dimensionado para que el taller
 * y el instalador sepan que las piezas arman UNA sola ventana en ángulo.
 * (Hubo una 'u' hasta el 2026-08-19: se quitó porque es lo mismo que un bow
 * window — tres caras — y tener dos nombres para lo mismo confundía.)
 */
export type FormaVentana = 'bow' | 'ele' | 'triangular';

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
  /**
   * Sistemas de oscuridad: variante de instalación asignada en Fase 1
   * ('INTERNO'|'SEMI'|'EXTERNO'). Los paños la heredan (pano.oscuridadVariante
   * la sobreescribe si el vendedor la cambia por paño en Fase 2).
   */
  oscuridadVariante?: string;
  /** Dirección cadena/cierre de Fase 0 (CAD [IZQUIERDA], etc.). En BEEBLACK es
   *  el CIERRE: IZQUIERDA-DERECHA, DERECHA-IZQUIERDA o DE ARRIBA ABAJO. */
  direccion?: string;
  /**
   * Modelo de fabricación elegido (snapshot del catálogo de descuentos al
   * momento de guardar). Lo usa el motor de despiece para calcular las
   * medidas de corte de tubo/tela/peso/cenefas. Import laxo para no acoplar
   * este módulo a descuentos: la forma real es ModeloDespiece.
   */
  modelo?: import('@/modules/descuentos/tipos').ModeloDespiece | null;
  /** Ventana en ángulo (bow window, en L, triangular). Sin valor = recta. */
  formaVentana?: FormaVentana | null;
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
