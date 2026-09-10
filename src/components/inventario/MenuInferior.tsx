// Menú de abajo del celular (lámina «Inicio en el celular»): cinco lugares
// fijos — Inicio, Despacho, Buscar, Contar y Alertas — con el dedo en mente.
//
// Los lugares NO se rellenan: si un rol no ve «Contar», ese botón no está y los
// otros no se corren. Así el dedo siempre encuentra el mismo botón en el mismo
// lugar, que es lo que importa cuando se trabaja con las manos ocupadas.

import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { itemsMenuInferior } from '@/modules/inventario/navegacion';
import type { ResumenInventario } from '@/modules/inventario/resumenStore';
import { ICONOS_INVENTARIO } from './iconos';
import { badgeDeSubmodulo } from './BarraLateral';

/** Cómo se llama cada lugar en el celular (más corto que en el escritorio). */
const ROTULOS: Record<string, string> = {
  tablero: 'Inicio',
  despacho: 'Despacho',
  insumos: 'Buscar',
  contar: 'Contar',
  alertas: 'Alertas',
};

export function MenuInferior({
  rol,
  queryRol,
  resumen,
}: {
  rol: string;
  queryRol: string;
  resumen: ResumenInventario;
}) {
  const items = itemsMenuInferior(rol);
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Secciones del inventario"
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-card/95 pb-1.5 backdrop-blur lg:hidden"
    >
      {items.map((sub) => {
        const Icono = ICONOS_INVENTARIO[sub.icono];
        const badge = badgeDeSubmodulo(sub, resumen);
        return (
          <NavLink
            key={sub.id}
            to={`${sub.ruta}${queryRol}`}
            end={sub.ruta === '/inventario'}
            className={({ isActive }) =>
              cn(
                'relative flex flex-1 flex-col items-center gap-1 py-2 text-[0.6875rem] font-medium transition-colors',
                isActive ? 'text-accent' : 'text-muted-foreground',
              )
            }
          >
            <Icono className="h-[21px] w-[21px]" aria-hidden />
            {ROTULOS[sub.id] ?? sub.titulo}
            {badge && badge.variante !== 'muted' ? (
              <span
                className={cn(
                  'absolute right-[22%] top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[0.625rem] font-semibold',
                  badge.variante === 'destructive'
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-accent text-accent-foreground',
                )}
              >
                {/* «Activo» no es un número: en el celular basta un punto. */}
                {/^\d+$/.test(badge.texto) ? badge.texto : ''}
              </span>
            ) : null}
          </NavLink>
        );
      })}
    </nav>
  );
}

export default MenuInferior;
