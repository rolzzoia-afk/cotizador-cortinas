// El armazón del módulo /inventario: barra lateral en el escritorio, menú de
// abajo en el celular, y el submódulo adentro.
//
// El scroll vive en el <main> del Shell de App.tsx, así que acá cada columna
// maneja el suyo: si no, la barra lateral se iría con la página.
//
// Despachar y contar van a PANTALLA PLENA: sin barra ni menú. Son las dos cosas
// que se hacen de pie, con el teléfono en una mano y el material en la otra.

import { createContext, useContext } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BarraLateral } from '@/components/inventario/BarraLateral';
import { MenuInferior } from '@/components/inventario/MenuInferior';
import { useRolEfectivo } from '@/lib/useRolEfectivo';
import {
  puedeEditar,
  submoduloDeRuta,
  type SubmoduloInventario,
} from '@/modules/inventario/navegacion';
import { useResumenInventario, type ResumenInventario } from '@/modules/inventario/resumenStore';

export type ContextoInventario = {
  /** Con el que se está mirando (puede ser el simulado por un admin). */
  rol: string;
  /** `?rol=x` para pegar a los enlaces internos. */
  queryRol: string;
  /** false = entra pero no edita: la pantalla esconde lo que escribe. */
  puedeEditar: boolean;
  submodulo?: SubmoduloInventario;
  resumen: ResumenInventario;
  /** Para volver a contar los badges después de escribir. */
  refrescarResumen: () => Promise<void>;
};

const Contexto = createContext<ContextoInventario | null>(null);

/** Lo que cada submódulo necesita saber de su entorno. */
export function useInventario(): ContextoInventario {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useInventario se usa dentro de InventarioLayout');
  return ctx;
}

export function InventarioLayout() {
  const { pathname } = useLocation();
  const { rolEfectivo, queryRol } = useRolEfectivo();
  const { refrescar, ...resumen } = useResumenInventario();

  const submodulo = submoduloDeRuta(pathname);
  const plena = submodulo?.modo === 'pleno';

  const contexto: ContextoInventario = {
    rol: rolEfectivo,
    queryRol,
    puedeEditar: submodulo ? puedeEditar(rolEfectivo, submodulo.id) : false,
    submodulo,
    resumen,
    refrescarResumen: refrescar,
  };

  if (plena) {
    return (
      <Contexto.Provider value={contexto}>
        <Outlet />
      </Contexto.Provider>
    );
  }

  return (
    <Contexto.Provider value={contexto}>
      <div className="flex h-full min-h-0">
        <BarraLateral rol={rolEfectivo} queryRol={queryRol} resumen={resumen} />
        <section className="min-w-0 flex-1 overflow-y-auto px-4 py-5 pb-20 lg:px-7 lg:py-6 lg:pb-6">
          <Outlet />
        </section>
        <MenuInferior rol={rolEfectivo} queryRol={queryRol} resumen={resumen} />
      </div>
    </Contexto.Provider>
  );
}

export default InventarioLayout;
