// Lo que el asistente «Nueva categoría» ESCRIBE: el catálogo, el mapa de ancho
// de rollo, las reglas de precio y la pastilla. Devuelve copias nuevas; quien
// llama decide si las guarda.
//
// Módulo PURO, sin React ni Supabase.
import { guardarProductoEnCatalogo } from './catalogoEdicion';
import { esCortinaTipo } from './flujoCatalogo';
import { idChipCustom, type ChipCustom } from './chipsCustom';
import { labelChip } from './filtrosCatalogo';
import {
  SISTEMA_INVERTIDA_KEY,
  SISTEMA_VERTICAL_KEY,
  type LineaReceta,
  type ReglasPrecios,
} from './reglasPrecios';
import {
  codFamilia,
  familiasDelBorrador,
  variantesDeMolde,
  type BorradorCategoria,
  type ContextoCategoria,
} from './nuevaCategoria';
import type { CatalogoProductos, Producto } from './types';

export type ResumenFamilia = {
  cod: string;
  /** De qué familia se copió la receta (las verticales no copian: es una sola). */
  molde: string | null;
  /** Las claves de receta que se escribieron (`LINO_P`, `LINO_P|B`…). */
  recetasCopiadas: string[];
  /** COD_INT de la tela de referencia, o '' = la más cara de la familia. */
  referencia: string;
  enInvertida: boolean;
  enSistemaVertical: boolean;
  /** Verticales: de qué código sale el precio de la tela. */
  baseVertical?: string;
};

export type ResumenConexion = {
  familias: ResumenFamilia[];
  pastilla: { id: string; label: string; nueva: boolean; porFamilia: boolean };
  categoriaFabricacion: string;
  productos: number;
  /** COD_INT de cortinas que quedan sin ancho de rollo. */
  sinAncho: string[];
  /** COD_INT que entran como adicional de precio fijo. */
  adicionales: string[];
};

export type ResultadoAplicar = {
  catalogo: CatalogoProductos;
  anchoRollo: Record<string, number>;
  reglas: ReglasPrecios;
  chips: ChipCustom[];
  resumen: ResumenConexion;
  avisos: string[];
};

/** Copia profunda de una receta: nunca compartir líneas con el molde. */
const clonarReceta = (lineas: readonly LineaReceta[] | undefined): LineaReceta[] =>
  JSON.parse(JSON.stringify(lineas ?? [])) as LineaReceta[];

export function aplicarNuevaCategoria(
  b: BorradorCategoria,
  ctx: ContextoCategoria,
): ResultadoAplicar {
  const avisos: string[] = [];
  const familias = familiasDelBorrador(b);
  const nuevaFamilia = !b.familiaExistente;

  // ── 1. La pastilla ─────────────────────────────────────────────────
  let chips: ChipCustom[] = [...ctx.chips];
  let chipId = '';
  let chipLabel = '';
  let chipNueva = false;
  let chipEsPropia = false;

  if (nuevaFamilia) {
    if (b.pastilla.modo === 'nueva') {
      const label = b.pastilla.label.trim().slice(0, 24);
      chipId = idChipCustom(label);
      chipLabel = label;
      chipNueva = true;
      chipEsPropia = true;
      chips = [
        ...chips,
        { id: chipId, label, hex: b.pastilla.hex, ...(familias.length ? { familias } : {}) },
      ];
    } else {
      chipId = b.pastilla.id;
      const propia = chips.find((c) => c.id === chipId);
      chipEsPropia = !!propia;
      chipLabel = propia?.label ?? labelChip(chipId, chips);
      if (propia && familias.length) {
        const juntas = [...new Set([...(propia.familias ?? []), ...familias])];
        chips = chips.map((c) => (c.id === chipId ? { ...c, familias: juntas } : c));
      }
    }
  }

  // Una familia que la pastilla reclama no necesita que cada producto la
  // nombre; el resto —los accesorios, y cualquier pastilla de fábrica— sí.
  const porFamilia = new Set(chipEsPropia ? familias : []);

  // ── 2. El catálogo ─────────────────────────────────────────────────
  let catalogo = ctx.catalogo;
  let anchoRollo = ctx.anchoRollo;
  const sinAncho: string[] = [];
  const adicionales: string[] = [];
  const referenciaDe = new Map<string, string>();

  for (const f of b.filas) {
    const cod = codFamilia(b, f);
    const cortina = b.tipo !== 'accesorio' && esCortinaTipo(f.tipo);
    const codInt = f.codInt.trim();
    if (f.referencia && cortina) referenciaDe.set(cod, codInt.toUpperCase());
    if (cortina && !(f.anchoRolloM > 0)) sinAncho.push(codInt);
    if (!cortina) adicionales.push(codInt);

    const chip = nuevaFamilia && chipId && !porFamilia.has(cod) ? chipId : undefined;
    const producto: Producto = {
      cod,
      producto: f.producto.trim(),
      tipo: f.tipo.trim(),
      descripcion: f.descripcion.trim(),
      precio: f.precio,
      descuento: f.descuentoPct / 100,
      ...(f.costo > 0 ? { costo: f.costo } : {}),
      ...(f.gama ? { categoria: f.gama } : {}),
      ...(chip ? { chip } : {}),
      ...(f.fechaAlta ? { fechaAlta: f.fechaAlta } : {}),
      ...(f.proveedor.trim() ? { proveedor: f.proveedor.trim() } : {}),
      ...(f.gananciaPct > 0 ? { ganancia: f.gananciaPct / 100 } : {}),
      ...(cortina && b.categoriaFabricacion.trim()
        ? { categoriaFabricacion: b.categoriaFabricacion.trim() }
        : {}),
    };
    const r = guardarProductoEnCatalogo(
      catalogo,
      anchoRollo,
      null,
      codInt,
      producto,
      f.anchoRolloM > 0 ? f.anchoRolloM : null,
    );
    catalogo = r.catalogo;
    anchoRollo = r.anchoRollo;
  }

  // ── 3. Las reglas de precio ────────────────────────────────────────
  let reglas = ctx.reglas;
  const resumenFamilias: ResumenFamilia[] = [];

  if (nuevaFamilia && b.tipo !== 'accesorio' && familias.length) {
    const recetas = { ...reglas.recetas };
    const arquetipos = { ...reglas.arquetipos };
    const baseVertical = { ...reglas.baseVertical };
    const sistemas = { ...reglas.sistemas };

    for (const cod of familias) {
      const referencia = referenciaDe.get(cod) ?? '';
      if (b.tipo === 'vertical') {
        // La receta de las verticales es una sola y la elige el motor. Lo que
        // hay que dejar escrito es de dónde sale el precio de su tela y que su
        // tabla de insumos es la del sistema vertical: sin eso los VER* se
        // cobran a $0, porque ya no están en la tabla general.
        const base = referencia || (b.baseVerticalDe[cod] || '').trim().toUpperCase();
        baseVertical[cod] = base;
        const sv = sistemas[SISTEMA_VERTICAL_KEY];
        const entra = !!sv && !sv.familias.includes(cod);
        if (sv && entra) sistemas[SISTEMA_VERTICAL_KEY] = { ...sv, familias: [...sv.familias, cod] };
        if (!sv) {
          avisos.push(
            `No existe el sistema de precios «vertical», así que «${cod}» va a cobrar sus insumos con la tabla general.`,
          );
        }
        resumenFamilias.push({
          cod,
          molde: null,
          recetasCopiadas: [],
          referencia,
          enInvertida: false,
          enSistemaVertical: !!sv,
          baseVertical: base,
        });
        continue;
      }

      const molde = b.moldes[cod] || '';
      const copiadas: string[] = [];
      if (reglas.recetas[molde]?.length) {
        recetas[cod] = clonarReceta(reglas.recetas[molde]);
        copiadas.push(cod);
        for (const sufijo of variantesDeMolde(reglas, molde)) {
          recetas[`${cod}${sufijo}`] = clonarReceta(reglas.recetas[`${molde}${sufijo}`]);
          copiadas.push(`${cod}${sufijo}`);
        }
      }
      // Vacío = «la tela más cara de la familia», que es la regla del Excel
      // cuando nadie fija un código.
      arquetipos[cod] = referencia;

      const inv = sistemas[SISTEMA_INVERTIDA_KEY];
      const enInvertida = !!inv?.familias.includes(molde);
      if (inv && enInvertida && !inv.familias.includes(cod)) {
        sistemas[SISTEMA_INVERTIDA_KEY] = { ...inv, familias: [...inv.familias, cod] };
      }

      resumenFamilias.push({
        cod,
        molde,
        recetasCopiadas: copiadas,
        referencia,
        enInvertida,
        enSistemaVertical: false,
      });
    }

    reglas = { ...reglas, recetas, arquetipos, baseVertical, sistemas };
  }

  if (sinAncho.length) {
    avisos.push(
      `${sinAncho.length} tela(s) quedan sin ancho de rollo: se cotizan con ${reglas.anchoRolloFallbackM} m.`,
    );
  }

  return {
    catalogo,
    anchoRollo,
    reglas,
    chips,
    avisos,
    resumen: {
      familias: resumenFamilias,
      pastilla: { id: chipId, label: chipLabel, nueva: chipNueva, porFamilia: porFamilia.size > 0 },
      categoriaFabricacion: b.tipo === 'accesorio' ? '' : b.categoriaFabricacion.trim(),
      productos: b.filas.length,
      sinAncho,
      adicionales,
    },
  };
}
