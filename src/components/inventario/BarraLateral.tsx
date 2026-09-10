// Barra lateral del módulo (lámina «Shell y tablero»): 248 px, tres grupos
// rotulados, ícono + nombre, y el badge del que tiene algo pendiente.
//
// Los ítems salen del registro filtrado por rol, así que no hay una segunda
// lista que mantener. Un submódulo «pendiente» se ve apagado y no se puede
// abrir: está ahí para que se sepa que viene, no para frustrar a nadie.

import { NavLink } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  GRUPOS_INVENTARIO,
  submodulosVisibles,
  type SubmoduloInventario,
} from '@/modules/inventario/navegacion';
import type { ResumenInventario } from '@/modules/inventario/resumenStore';
import { ICONOS_INVENTARIO } from './iconos';

type Props = {
  rol: string;
  /** `?rol=x` para no perder el «ver como» al navegar. */
  queryRol: string;
  resumen: ResumenInventario;
};

/** El número (o el texto) que va pegado al ítem, si tiene algo que decir. */
export function badgeDeSubmodulo(
  sub: SubmoduloInventario,
  resumen: ResumenInventario,
): { texto: string; variante: 'destructive' | 'accent' | 'muted' } | null {
  if (sub.estado === 'pendiente') return { texto: 'Pendiente', variante: 'muted' };
  if (sub.badge === 'alertas' && resumen.alertas > 0)
    return { texto: String(resumen.alertas), variante: 'destructive' };
  if (sub.badge === 'conteo' && resumen.conteoActivo)
    return { texto: 'Activo', variante: 'accent' };
  if (sub.badge === 'despacho' && resumen.despacho > 0)
    return { texto: String(resumen.despacho), variante: 'accent' };
  return null;
}

export function BarraLateral({ rol, queryRol, resumen }: Props) {
  const visibles = submodulosVisibles(rol);
  if (visibles.length === 0) return null;

  return (
    <nav
      aria-label="Secciones del inventario"
      className="hidden w-[248px] shrink-0 overflow-y-auto border-r border-border bg-card/50 px-3 py-4 lg:block"
    >
      {GRUPOS_INVENTARIO.map((grupo) => {
        const items = visibles.filter((s) => s.grupo === grupo.id);
        if (items.length === 0) return null;
        return (
          <div key={grupo.id} className="mb-1 last:mb-0">
            <div className="px-3 pb-2 pt-3 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {grupo.titulo}
            </div>
            <div className="flex flex-col gap-0.5">
              {items.map((sub) => {
                const Icono = ICONOS_INVENTARIO[sub.icono];
                const badge = badgeDeSubmodulo(sub, resumen);
                const contenido = (
                  <>
                    <Icono className="h-[17px] w-[17px] shrink-0" aria-hidden />
                    <span className="truncate">{sub.titulo}</span>
                    {badge ? (
                      <Badge variant={badge.variante} className="ml-auto shrink-0">
                        {badge.texto}
                      </Badge>
                    ) : null}
                  </>
                );

                if (sub.estado === 'pendiente') {
                  return (
                    <div
                      key={sub.id}
                      title="Todavía no está disponible"
                      className="flex h-9 cursor-default items-center gap-2.5 rounded-lg px-3 text-[0.845rem] font-medium text-muted-foreground opacity-55"
                    >
                      {contenido}
                    </div>
                  );
                }

                return (
                  <NavLink
                    key={sub.id}
                    to={`${sub.ruta}${queryRol}`}
                    // El tablero vive en /inventario: sin `end` se quedaría
                    // marcado en todos sus hijos.
                    end={sub.ruta === '/inventario'}
                    className={({ isActive }) =>
                      cn(
                        'flex h-9 items-center gap-2.5 rounded-lg px-3 text-[0.845rem] font-medium transition-colors',
                        isActive
                          ? 'bg-accent/[0.13] text-accent'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                      )
                    }
                  >
                    {contenido}
                  </NavLink>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export default BarraLateral;
