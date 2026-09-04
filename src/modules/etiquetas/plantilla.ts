// ─────────────────────────────────────────────────────────────────────
// PLANTILLA DE ETIQUETA — el diseño de una etiqueta, como dato editable.
//
// Hasta ahora cada etiqueta era código: la geometría vivía en constantes (o,
// peor, en literales sueltos), así que agrandar una letra, correr un cuadro o
// cambiar el logo pedía tocar el repositorio. Acá el diseño pasa a ser un JSON
// que el dueño edita en Admin y que la app guarda por empresa.
//
// El reparto de trabajo NO cambia: los DATOS los sigue armando la app (qué
// tela, qué medida, qué OT). La plantilla decide dónde va cada cosa, de qué
// tamaño, si se muestra, qué dice el texto fijo y qué imagen se usa.
//
// Todo en MILÍMETROS absolutos sobre la hoja, porque una etiqueta es un plano:
// lo impreso tiene que calzar con la etiquetadora, no con el flujo de texto del
// navegador.
//
// Módulo puro: sin React ni Supabase.
// ─────────────────────────────────────────────────────────────────────

/** Qué etiqueta es. El id viaja en la clave de configuración. */
export type EtiquetaId =
  | 'catalogo'
  | 'sobrante'
  | 'panos'
  | 'cenefa_cuadrada'
  | 'estructura_roller'
  | 'estructura_vertical'
  | 'estructura_soft_light'
  | 'estructura_dark'
  | 'estructura_soft_light_cc'
  | 'estructura_oscuranti'
  | 'estructura_beeblack'
  | 'bolsa_bodega'
  | 'qr_insumo';

/** La etiquetadora imprime en monocromo: tres tintas y nada más. */
export type ColorEtiqueta = 'negro' | 'blanco' | 'gris';

export type AlineacionEtiqueta = 'izquierda' | 'centro' | 'derecha';

/** Cómo se ve un texto. */
export type EstiloTexto = {
  /** Cuerpo en puntos. */
  pt: number;
  bold: boolean;
  align: AlineacionEtiqueta;
  color: ColorEtiqueta;
  /** Fondo de la caja del texto (la banda negra de CÓDIGOS es `negro`). */
  fondo?: ColorEtiqueta;
  /** Interlineado, para los textos de varias líneas (el pie). */
  interlinea?: number;
  /** Separación entre letras, en pt. Los rótulos chicos se leen mejor con aire. */
  espaciado?: number;
  /** `mono` para los datos que se tipean o se dictan (el serial). */
  fuente?: 'sans' | 'mono';
  /**
   * «Encoger para que quepa»: baja el cuerpo hasta `minPt` antes de dejar que
   * el texto se salga. Con `partir`, cuando encoger ya no alcanza, se permite
   * repartirlo en dos renglones (partiendo solo por espacios).
   */
  encoger?: { minPt: number; partir?: boolean };
  /** Escala horizontal de la fuente (replica el `lfWidth` de los .lbx). */
  hScale?: number;
};

type Base = {
  /**
   * Id estable del elemento. Los que empiezan con `x-` los agregó el usuario;
   * el resto son del sistema y la app los busca por este nombre.
   */
  id: string;
  visible: boolean;
  /** mm desde el borde izquierdo / superior de la hoja. */
  x: number;
  y: number;
  ancho: number;
  alto: number;
};

/**
 * Un elemento del diseño. El orden del arreglo es el orden de dibujo: lo de
 * más abajo tapa a lo de más arriba.
 */
export type ElementoEtiqueta =
  | (Base & { tipo: 'caja'; trazoPt: number; relleno?: ColorEtiqueta })
  | (Base & { tipo: 'linea'; orientacion: 'h' | 'v'; trazoPt: number; punteada?: boolean })
  /** Texto FIJO, editable. Admite `{slot}` para intercalar un dato. */
  | (Base & { tipo: 'texto'; texto: string; estilo: EstiloTexto })
  /** Un dato que pone la app (el código de la tela, la medida, la OT…). */
  | (Base & { tipo: 'campo'; slot: string; estilo: EstiloTexto })
  /** Imagen; sin `url` se usa el logo de la empresa. */
  | (Base & { tipo: 'imagen'; url?: string })
  | (Base & { tipo: 'qr'; url?: string })
  /** Casilla para marcar con un visto (las tres del sobrante). */
  | (Base & { tipo: 'casilla'; slot: string; rotulo: string; estilo: EstiloTexto });

export type TipoElemento = ElementoEtiqueta['tipo'];

export type PlantillaEtiqueta = {
  version: 1;
  /** El papel, en mm. */
  hoja: { ancho: number; alto: number };
  elementos: ElementoEtiqueta[];
};

/** Un dato que la etiqueta sabe poner: cómo se llama y un ejemplo para la vista. */
export type SlotEtiqueta = { label: string; ejemplo: string };

/** Todo lo que Admin necesita saber de una etiqueta para dejar editarla. */
export type DefEtiqueta = {
  id: EtiquetaId;
  label: string;
  /** Para agrupar el selector del editor: «Telas», «Producción», «Estructura». */
  grupo: string;
  /** Qué motor la imprime. El editor dibuja distinto según esto. */
  motor: 'html' | 'pdf';
  plantillaDefault: PlantillaEtiqueta;
  slots: Record<string, SlotEtiqueta>;
  /** Nota al pie en el editor (de dónde sale, dónde se imprime). */
  ayuda?: string;
};

// ── Helpers de lectura ───────────────────────────────────────────────

/** El elemento con ese id, si está y es visible. */
export function elementoDe(
  plantilla: PlantillaEtiqueta,
  id: string,
): ElementoEtiqueta | undefined {
  return plantilla.elementos.find((e) => e.id === id && e.visible);
}

/** Los valores de ejemplo de una etiqueta, para la vista previa del editor. */
export function muestraDeSlots(def: DefEtiqueta): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(def.slots)) out[k] = v.ejemplo;
  return out;
}

/**
 * Reemplaza los `{slot}` de un texto fijo. Un slot que no existe se deja tal
 * cual: es más útil ver `{ot}` en la etiqueta que un hueco silencioso.
 */
export function interpolar(texto: string, datos: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (m, k: string) => (k in datos ? datos[k] : m));
}

// ── Normalización ────────────────────────────────────────────────────

const num = (v: unknown, def: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def);

const COLORES: ColorEtiqueta[] = ['negro', 'blanco', 'gris'];
const ALINEACIONES: AlineacionEtiqueta[] = ['izquierda', 'centro', 'derecha'];

const color = (v: unknown, def: ColorEtiqueta): ColorEtiqueta =>
  COLORES.includes(v as ColorEtiqueta) ? (v as ColorEtiqueta) : def;

function estilo(raw: unknown, def: EstiloTexto): EstiloTexto {
  const r = (raw ?? {}) as Record<string, unknown>;
  const encogerRaw = r.encoger as Record<string, unknown> | undefined;
  return {
    pt: Math.max(1, num(r.pt, def.pt)),
    bold: bool(r.bold, def.bold),
    align: ALINEACIONES.includes(r.align as AlineacionEtiqueta)
      ? (r.align as AlineacionEtiqueta)
      : def.align,
    color: color(r.color, def.color),
    fondo: r.fondo === undefined ? def.fondo : color(r.fondo, def.fondo ?? 'blanco'),
    interlinea: r.interlinea === undefined ? def.interlinea : num(r.interlinea, def.interlinea ?? 1),
    espaciado: r.espaciado === undefined ? def.espaciado : num(r.espaciado, def.espaciado ?? 0),
    fuente: r.fuente === 'mono' || r.fuente === 'sans' ? r.fuente : def.fuente,
    hScale: r.hScale === undefined ? def.hScale : num(r.hScale, def.hScale ?? 1),
    encoger: encogerRaw
      ? {
          minPt: Math.max(1, num(encogerRaw.minPt, def.encoger?.minPt ?? 6)),
          partir: bool(encogerRaw.partir, def.encoger?.partir ?? false),
        }
      : def.encoger,
  };
}

/** Un elemento guardado, saneado contra el que trae el default. */
function elementoNormalizado(raw: Record<string, unknown>, base: ElementoEtiqueta): ElementoEtiqueta {
  const comun = {
    id: base.id,
    visible: bool(raw.visible, base.visible),
    x: num(raw.x, base.x),
    y: num(raw.y, base.y),
    ancho: Math.max(0, num(raw.ancho, base.ancho)),
    alto: Math.max(0, num(raw.alto, base.alto)),
  };
  switch (base.tipo) {
    case 'caja':
      return {
        ...comun,
        tipo: 'caja',
        trazoPt: Math.max(0, num(raw.trazoPt, base.trazoPt)),
        relleno: raw.relleno === undefined ? base.relleno : color(raw.relleno, 'blanco'),
      };
    case 'linea':
      return {
        ...comun,
        tipo: 'linea',
        orientacion: raw.orientacion === 'v' || raw.orientacion === 'h' ? raw.orientacion : base.orientacion,
        trazoPt: Math.max(0, num(raw.trazoPt, base.trazoPt)),
        punteada: bool(raw.punteada, base.punteada ?? false),
      };
    case 'texto':
      return {
        ...comun,
        tipo: 'texto',
        texto: typeof raw.texto === 'string' ? raw.texto : base.texto,
        estilo: estilo(raw.estilo, base.estilo),
      };
    case 'campo':
      // El slot NO se edita: es el enchufe con el dato que pone la app.
      return { ...comun, tipo: 'campo', slot: base.slot, estilo: estilo(raw.estilo, base.estilo) };
    case 'imagen':
      return {
        ...comun,
        tipo: 'imagen',
        url: typeof raw.url === 'string' ? raw.url : base.url,
      };
    case 'qr':
      return { ...comun, tipo: 'qr', url: typeof raw.url === 'string' ? raw.url : base.url };
    case 'casilla':
      return {
        ...comun,
        tipo: 'casilla',
        slot: base.slot,
        rotulo: typeof raw.rotulo === 'string' ? raw.rotulo : base.rotulo,
        estilo: estilo(raw.estilo, base.estilo),
      };
  }
}

/** Los tipos que el usuario puede agregar de cero desde el editor. */
const TIPOS_AGREGABLES: TipoElemento[] = ['caja', 'linea', 'texto', 'imagen'];

/** Un elemento `x-` inventado por el usuario, saneado contra un molde neutro. */
function elementoLibre(raw: Record<string, unknown>): ElementoEtiqueta | null {
  const tipo = raw.tipo as TipoElemento;
  if (!TIPOS_AGREGABLES.includes(tipo)) return null;
  const id = String(raw.id ?? '');
  if (!id.startsWith('x-')) return null;
  const molde: ElementoEtiqueta =
    tipo === 'caja'
      ? { id, tipo: 'caja', visible: true, x: 0, y: 0, ancho: 10, alto: 10, trazoPt: 0.5 }
      : tipo === 'linea'
        ? { id, tipo: 'linea', visible: true, x: 0, y: 0, ancho: 10, alto: 0, orientacion: 'h', trazoPt: 0.5 }
        : tipo === 'imagen'
          ? { id, tipo: 'imagen', visible: true, x: 0, y: 0, ancho: 10, alto: 10 }
          : {
              id,
              tipo: 'texto',
              visible: true,
              x: 0,
              y: 0,
              ancho: 20,
              alto: 5,
              texto: '',
              estilo: { pt: 9, bold: false, align: 'izquierda', color: 'negro' },
            };
  return elementoNormalizado(raw, molde);
}

/**
 * Lo guardado, puesto encima del default.
 *
 * Se parte SIEMPRE del default y se superpone por id lo que el usuario cambió.
 * Así un elemento nuevo del sistema (una etiqueta que gana un campo en una
 * versión posterior) aparece solo en su lugar, sin que nadie tenga que
 * restaurar la plantilla; y un id que ya no existe se descarta sin romper.
 * Los elementos `x-` que agregó el usuario se conservan, al final.
 */
export function normalizarPlantilla(raw: unknown, def: PlantillaEtiqueta): PlantillaEtiqueta {
  const r = (raw ?? {}) as Record<string, unknown>;
  const guardados = Array.isArray(r.elementos) ? (r.elementos as Record<string, unknown>[]) : [];
  const porId = new Map<string, Record<string, unknown>>();
  for (const e of guardados) {
    const id = String((e as { id?: unknown }).id ?? '');
    if (id) porId.set(id, e);
  }

  const hojaRaw = (r.hoja ?? {}) as Record<string, unknown>;
  const hoja = {
    ancho: Math.max(1, num(hojaRaw.ancho, def.hoja.ancho)),
    alto: Math.max(1, num(hojaRaw.alto, def.hoja.alto)),
  };

  const delSistema = def.elementos.map((base) => {
    const guardado = porId.get(base.id);
    return guardado ? elementoNormalizado(guardado, base) : base;
  });

  const propios = guardados
    .filter((e) => String((e as { id?: unknown }).id ?? '').startsWith('x-'))
    .map(elementoLibre)
    .filter((e): e is ElementoEtiqueta => e !== null);

  return { version: 1, hoja, elementos: [...delSistema, ...propios] };
}

/** ¿La plantilla quedó igual al default? (para no guardar de más). */
export function esDefault(p: PlantillaEtiqueta, def: PlantillaEtiqueta): boolean {
  return JSON.stringify(p) === JSON.stringify(def);
}
