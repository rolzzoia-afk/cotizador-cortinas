// ─────────────────────────────────────────────────────────────────────
// Ir de una pestaña de Admin → Precios a otra, apuntando a un campo.
//
// El dueño (2026-09-07), mirando la columna «Precio de venta»: «esa ganancia,
// ¿en dónde se configura para que sea más o sea menos?». Se configura en otra
// pestaña —«Valores comerciales → Margen de insumos», o el margen del propio
// sistema en «Recetas y sistemas»— y no había ninguna señal de que existiera.
//
// El contexto lo provee la página de precios; los enlaces solo lo usan. Sin
// proveedor (una sección montada sola, o un test) el enlace no se dibuja: es
// una ayuda, no un dato.
// ─────────────────────────────────────────────────────────────────────
import { createContext, useContext } from 'react';
import type { TabPrecios } from './ReglasPreciosSection';

export type NavegacionPrecios = {
  /** Cambia de pestaña y, si se le pasa un ancla, hace scroll hasta ese id. */
  irA: (tab: TabPrecios, ancla?: string) => void;
};

const Ctx = createContext<NavegacionPrecios | null>(null);
export const ProveedorNavegacionPrecios = Ctx.Provider;
export const useNavegacionPrecios = () => useContext(Ctx);

/** Ancla del campo «Margen de insumos» en Valores comerciales. */
export const ANCLA_MARGEN_GENERAL = 'param-margenInsumo';
/** Ancla del bloque de un sistema en «Recetas y sistemas». */
export const anclaSistema = (clave: string) => `sistema-${clave}`;

/**
 * «editar» — lleva al campo donde se cambia el margen con el que se calcula
 * esta tabla: el del sistema si la tabla es de uno, el general si no.
 */
export function EnlaceAlMargen({ sistema }: { sistema?: string }) {
  const nav = useNavegacionPrecios();
  if (!nav) return null;
  return (
    <button
      type="button"
      onClick={() =>
        sistema
          ? nav.irA('recetas', anclaSistema(sistema))
          : nav.irA('comercial', ANCLA_MARGEN_GENERAL)
      }
      className="underline underline-offset-2 hover:text-foreground"
    >
      editar
    </button>
  );
}
