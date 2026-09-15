// Revisión del borrador del asistente «Nueva categoría». Los ERRORES impiden
// crear (dejarían telas sin cobrar, códigos pisados o familias fantasma); los
// AVISOS solo se muestran, porque son decisiones legítimas.
//
// Módulo PURO, sin React ni Supabase.
import { esCortinaTipo, esDuoDe, esVerticalDe } from './flujoCatalogo';
import { claveCatalogoCanonica, normCod } from './importarCatalogo';
import { familiasDelCatalogo } from './catalogoEdicion';
import { filtrosCatalogoCon } from './filtrosCatalogo';
import { idChipCustom, MAX_CHIPS_CUSTOM } from './chipsCustom';
import { categoriaEfectiva } from '@/modules/descuentos/tiposCortina';
import {
  codFamilia,
  familiasDelBorrador,
  moldesDisponibles,
  COD_ACCESORIO,
  type BorradorCategoria,
  type ContextoCategoria,
  type FilaProductoNueva,
} from './nuevaCategoria';

/** Los campos de una fila que pueden quedar marcados en la grilla. */
export type CampoFila =
  | 'codInt'
  | 'producto'
  | 'tipo'
  | 'precio'
  | 'costo'
  | 'descuentoPct'
  | 'gananciaPct'
  | 'anchoRolloM'
  | 'fechaAlta'
  | 'referencia';

export type ErroresFila = {
  errores: Partial<Record<CampoFila, string>>;
  avisos: Partial<Record<CampoFila, string>>;
};

export type ValidacionCategoria = {
  errores: string[];
  avisos: string[];
  /** Por id de fila. */
  porFila: Record<string, ErroresFila>;
};

const N = (s: string | undefined) => (s || '').trim().toUpperCase();
const RE_BASE = /^[A-Z][A-Z0-9_]*$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Cuántas filas de la grilla son cortina (las que crean familia). */
const esFilaCortina = (b: BorradorCategoria, f: FilaProductoNueva) =>
  b.tipo !== 'accesorio' && esCortinaTipo(f.tipo);

export function validarBorrador(
  b: BorradorCategoria,
  ctx: ContextoCategoria,
): ValidacionCategoria {
  const errores: string[] = [];
  const avisos: string[] = [];
  const porFila: Record<string, ErroresFila> = {};
  const marca = (f: FilaProductoNueva) =>
    (porFila[f.id] ??= { errores: {}, avisos: {} });
  const error = (f: FilaProductoNueva, campo: CampoFila, texto: string) => {
    marca(f).errores[campo] = texto;
  };
  const aviso = (f: FilaProductoNueva, campo: CampoFila, texto: string) => {
    marca(f).avisos[campo] = texto;
  };

  const nuevaFamilia = !b.familiaExistente;

  // ── La categoría ───────────────────────────────────────────────────
  if (nuevaFamilia) {
    if (!b.nombre.trim()) errores.push('Ponle un nombre a la categoría.');
    const base = N(b.baseCod);
    if (!base) {
      errores.push('Falta el código de la categoría (la raíz de la familia).');
    } else if (!RE_BASE.test(base)) {
      errores.push(
        `«${b.baseCod}» no sirve como código: empieza con una letra y usa solo letras, números y guion bajo.`,
      );
    }
    // El motor deduce dúo y vertical del CÓDIGO: una raíz que insinúe otra cosa
    // cambiaría la cuenta de la tela sin que nadie lo haya pedido.
    if (b.tipo === 'roller' && base.startsWith('DUO')) {
      errores.push(
        'Un roller no puede llamarse DUO…: el motor lo cobraría como dúo (el doble de tela).',
      );
    }
    if (b.tipo === 'roller' && /_V_|_V$/.test(base)) {
      errores.push('Un roller no puede llevar _V en el código: el motor lo cobraría como vertical.');
    }
    if (b.tipo === 'duo' && !base.startsWith('DUO')) {
      errores.push('El código de un dúo tiene que empezar con DUO, o se cobraría una sola tela.');
    }

    // Familias que ya existen: se estaría cotizando con la receta de otro.
    const enCatalogo = new Set(familiasDelCatalogo(ctx.catalogo).map((f) => f.toUpperCase()));
    const enRecetas = new Set(Object.keys(ctx.reglas.recetas).map((f) => f.toUpperCase()));
    for (const cod of familiasDelBorrador(b)) {
      if (enCatalogo.has(cod) || enRecetas.has(cod)) {
        errores.push(
          `La familia «${cod}» ya existe. Usa «Agregar productos» sobre ella en vez de crearla de nuevo.`,
        );
      }
    }
  }

  // ── La pastilla del catálogo ───────────────────────────────────────
  if (nuevaFamilia) {
    const filtros = filtrosCatalogoCon(ctx.chips);
    if (b.pastilla.modo === 'nueva') {
      const label = b.pastilla.label.trim();
      if (!label) {
        errores.push('Ponle un nombre a la pastilla del catálogo.');
      } else if (filtros.some((f) => f.id === idChipCustom(label))) {
        errores.push(`Ya hay una pastilla que se llama «${label}».`);
      }
      if (ctx.chips.length >= MAX_CHIPS_CUSTOM) {
        errores.push(`No caben más pastillas propias (el tope son ${MAX_CHIPS_CUSTOM}).`);
      }
    } else {
      const id = b.pastilla.id;
      if (!filtros.some((f) => f.id === id)) {
        errores.push('Elige en qué pastilla del catálogo se van a ver estos productos.');
      }
    }
  }

  // ── La categoría de fabricación ────────────────────────────────────
  if (b.tipo !== 'accesorio') {
    const cat = b.categoriaFabricacion.trim();
    if (!cat) {
      errores.push('Elige con qué categoría de fabricación nacen estas cortinas.');
    } else if (!ctx.categoriasSelect.some((c) => N(c) === N(cat))) {
      errores.push(`La categoría de fabricación «${cat}» ya no existe.`);
    } else {
      const efectiva = N(categoriaEfectiva(cat));
      const esVertical = efectiva === 'VERTICAL';
      const esDuo = efectiva.startsWith('DUO') || efectiva.includes('DUO');
      if (b.tipo === 'vertical' && !esVertical) {
        errores.push(`Una cortina vertical se fabrica con la categoría VERTICAL, no con «${cat}».`);
      }
      if (b.tipo !== 'vertical' && esVertical) {
        errores.push(`La categoría VERTICAL es solo para cortinas verticales, no para «${cat}».`);
      }
      if (b.tipo === 'duo' && !esDuo) {
        avisos.push(`«${cat}» no es una categoría de dúo: revisa que sea la que corresponde.`);
      }
      if (b.tipo === 'roller' && esDuo) {
        avisos.push(`«${cat}» es una categoría de dúo y esta categoría es roller.`);
      }
    }
  }

  // ── Con qué receta se cobra cada familia ───────────────────────────
  if (nuevaFamilia && b.tipo !== 'accesorio') {
    const moldes = moldesDisponibles(ctx.reglas, b.tipo);
    for (const cod of familiasDelBorrador(b)) {
      if (b.tipo === 'vertical') {
        // La receta de las verticales es una sola y la pone el motor; lo que
        // hay que decidir es de dónde sale el precio de su tela.
        const refPropia = b.filas.some(
          (f) => f.referencia && codFamilia(b, f) === cod && f.precio > 0,
        );
        const base = (b.baseVerticalDe[cod] || '').trim();
        const precioBase = Number(ctx.catalogo[base]?.precio) || 0;
        if (!refPropia && !(precioBase > 0)) {
          errores.push(
            `«${cod}»: falta de dónde sale el precio de la tela (una fila de referencia con precio, o un código del catálogo).`,
          );
        }
      } else if (!moldes.includes(b.moldes[cod] || '')) {
        errores.push(`«${cod}»: elige con qué familia se cobra (de cuál copia la receta).`);
      }
    }
  }

  // ── Las filas ──────────────────────────────────────────────────────
  if (!b.filas.length) errores.push('Agrega al menos un producto.');

  const vistos = new Map<string, number>();
  const referenciasPorFamilia = new Map<string, number>();
  for (const f of b.filas) {
    const cod = codFamilia(b, f);
    const cortina = esFilaCortina(b, f);
    const clave = normCod(f.codInt);

    if (!clave) {
      error(f, 'codInt', 'Falta el código.');
    } else {
      const repetidas = (vistos.get(clave) ?? 0) + 1;
      vistos.set(clave, repetidas);
      if (repetidas > 1) error(f, 'codInt', 'Ese código está repetido en la lista.');
      const existente = claveCatalogoCanonica(ctx.catalogo, f.codInt);
      if (existente) error(f, 'codInt', `«${existente}» ya está en el catálogo.`);
    }

    if (!f.producto.trim()) error(f, 'producto', 'Falta el nombre del producto.');
    if (!f.tipo.trim()) error(f, 'tipo', 'Falta el tipo.');

    // El nombre tiene que decir lo mismo que el código: el motor mira las dos
    // cosas y con la palabra equivocada cobra otra cortina.
    if (cortina) {
      const nombre = N(f.producto);
      const duo = esDuoDe(cod, nombre);
      const vertical = esVerticalDe(cod, nombre);
      if (b.tipo === 'duo' && !duo) {
        error(f, 'producto', 'El nombre de un dúo tiene que decir DUO.');
      }
      if (b.tipo === 'vertical' && !vertical) {
        error(f, 'producto', 'El nombre de una vertical tiene que decir VERTICAL.');
      }
      if (b.tipo === 'roller' && (duo || vertical)) {
        error(
          f,
          'producto',
          'Este nombre dice DUO o VERTICAL y la categoría es roller: se cobraría mal.',
        );
      }
    } else if (b.tipo !== 'accesorio' && f.tipo.trim()) {
      aviso(
        f,
        'tipo',
        `«${f.tipo}» no es un tipo de cortina: entra como adicional de precio fijo, sin tela.`,
      );
    }

    if (f.referencia) {
      if (!cortina) {
        error(f, 'referencia', 'La tela de referencia tiene que ser una cortina.');
      } else {
        const n = (referenciasPorFamilia.get(cod) ?? 0) + 1;
        referenciasPorFamilia.set(cod, n);
        if (n > 1) error(f, 'referencia', `«${cod}» ya tiene una tela de referencia.`);
      }
      if (!(f.precio > 0)) error(f, 'precio', 'La tela de referencia necesita precio.');
    }

    if (f.descuentoPct < 0 || f.descuentoPct > 100) {
      error(f, 'descuentoPct', 'El descuento va de 0 a 100.');
    }
    if (f.gananciaPct <= 0 || f.gananciaPct > 100) {
      error(f, 'gananciaPct', 'La ganancia va de 1 a 100.');
    }
    if (f.anchoRolloM < 0) error(f, 'anchoRolloM', 'El ancho no puede ser negativo.');
    if (f.fechaAlta && !RE_FECHA.test(f.fechaAlta)) {
      error(f, 'fechaAlta', 'La fecha va como AAAA-MM-DD.');
    }

    if (cortina && !(f.anchoRolloM > 0)) {
      aviso(
        f,
        'anchoRolloM',
        `Sin ancho de rollo se cotiza con ${ctx.reglas.anchoRolloFallbackM} m y se corta con el ancho por defecto.`,
      );
    }
    if (cortina && !f.referencia && !(f.precio > 0) && !(f.costo > 0)) {
      aviso(f, 'precio', 'Sin precio: se cobra el de la tela de referencia de su familia.');
    }
  }

  // Familias sin referencia: es válido (el Excel lo hace en el beeblack), pero
  // ahí manda la tela más cara que alguien venda.
  if (nuevaFamilia && b.tipo !== 'accesorio' && b.tipo !== 'vertical') {
    for (const cod of familiasDelBorrador(b)) {
      if (!referenciasPorFamilia.has(cod)) {
        avisos.push(
          `«${cod}» queda sin tela de referencia: se va a cobrar con la más cara que se venda de esa familia.`,
        );
      }
    }
  }
  if (b.filas.some((f) => codFamilia(b, f) === COD_ACCESORIO) && b.tipo !== 'accesorio') {
    avisos.push('Las filas que no son cortina se guardan como accesorios, sin familia propia.');
  }

  return { errores, avisos, porFila };
}

/** ¿Hay algún error de fila? (lo que bloquea el paso de la grilla). */
export function hayErroresDeFila(v: ValidacionCategoria): boolean {
  return Object.values(v.porFila).some((f) => Object.keys(f.errores).length > 0);
}
