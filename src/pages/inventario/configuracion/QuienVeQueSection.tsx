// Quién ve qué, en una sola tabla.
//
// No es una lámina ni una copia: se dibuja con las MISMAS funciones que deciden
// el acceso de verdad (`puedeVer`, `puedeEditar`, `puedeVerDato`). Si un día el
// permiso y la tabla dijeran cosas distintas sería porque la tabla está mal
// leída, no porque se olvidó actualizarla.
//
// El rol propio va marcado, para poder contestar «¿por qué yo no veo esto?»
// sin salir de la pantalla.

import { Fragment, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ROLES_DISPONIBLES } from '@/lib/roles';
import { cn } from '@/lib/utils';
import {
  DATOS_SENSIBLES,
  GRUPOS_INVENTARIO,
  SUBMODULOS_INVENTARIO,
  puedeEditar,
  puedeVer,
  puedeVerDato,
  type SubmoduloInventario,
} from '@/modules/inventario/navegacion';

/** Los roles que se muestran como columnas, sin admin (que ve y edita todo). */
const COLUMNAS = ROLES_DISPONIBLES.filter((r) => r !== 'admin');

const TITULOS: Record<string, string> = {
  ventas: 'Ventas',
  bodeguero: 'Bodeguero',
  produccion: 'Producción',
  dimensionado: 'Dimensionado',
  telas: 'Telas',
  operario: 'Operario',
  pruebas: 'Pruebas',
};

type Nivel = 'edita' | 'mira' | 'no';

function nivelDe(rol: string, sub: SubmoduloInventario): Nivel {
  if (!puedeVer(rol, sub)) return 'no';
  return puedeEditar(rol, sub.id) ? 'edita' : 'mira';
}

function Marca({ nivel }: { nivel: Nivel }) {
  if (nivel === 'no') return <span className="text-muted-foreground/50">—</span>;
  return (
    <span
      aria-label={nivel === 'edita' ? 'Entra y edita' : 'Solo mira'}
      className={cn(
        'inline-block h-2.5 w-2.5 rounded-full',
        nivel === 'edita' ? 'bg-success' : 'bg-success/45 ring-1 ring-success/70',
      )}
    />
  );
}

/** La nota de la fila: qué matiz tiene este submódulo. */
function notaDe(sub: SubmoduloInventario): string {
  if (sub.roles.length === 0 && (sub.lectura?.length ?? 0) === 0) return 'Solo admin';
  if (sub.roles.length === 0) return 'Entrar y mirar; abrir y cerrar es de admin';
  if (sub.lectura?.length) return `Solo miran: ${sub.lectura.map((r) => TITULOS[r] ?? r).join(', ')}`;
  return '—';
}

export default function QuienVeQueSection({ rolActual }: { rolActual: string }) {
  const [verTodo, setVerTodo] = useState(false);
  const filas = SUBMODULOS_INVENTARIO.filter((s) => verTodo || s.enMenu);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <h2 className="font-serif text-[0.9375rem] font-medium">Quién ve qué</h2>
        <span className="text-xs text-muted-foreground">
          El gate real y el menú salen de esta misma tabla
        </span>
        <div className="ml-auto flex items-center gap-3 text-[0.7rem] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Marca nivel="edita" /> entra y edita
          </span>
          <span className="flex items-center gap-1.5">
            <Marca nivel="mira" /> solo mira
          </span>
          <span className="flex items-center gap-1.5">
            <Marca nivel="no" /> no lo ve
          </span>
        </div>
      </div>

      <p className="px-4 pb-3 text-xs text-muted-foreground">
        Admin y superadmin ven y editan todo, así que no tienen columna. Un rol que no ve un
        submódulo tampoco lo tiene en la barra lateral ni en el menú del celular: es la misma
        función la que decide las tres cosas.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-[0.78rem]">
          <thead>
            <tr className="border-b border-border text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">
              <th className="h-9 px-4 text-left font-medium">Submódulo</th>
              {COLUMNAS.map((r) => (
                <th
                  key={r}
                  className={cn(
                    'h-9 px-2 text-center font-medium',
                    r === rolActual && 'text-foreground',
                  )}
                >
                  {TITULOS[r] ?? r}
                  {r === rolActual && <span className="ml-1 normal-case">(tú)</span>}
                </th>
              ))}
              <th className="h-9 px-4 text-left font-medium">Nota</th>
            </tr>
          </thead>
          <tbody>
            {GRUPOS_INVENTARIO.map((g) => {
              const delGrupo = filas.filter((s) => s.grupo === g.id);
              if (delGrupo.length === 0) return null;
              return (
                <Fragment key={g.id}>
                  <tr className="border-b border-border bg-secondary/30">
                    <td
                      colSpan={COLUMNAS.length + 2}
                      className="px-4 py-1 text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground"
                    >
                      {g.titulo}
                    </td>
                  </tr>
                  {delGrupo.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">
                        {s.titulo}
                        {!s.enMenu && (
                          <Badge variant="muted" className="ml-2">
                            fuera del menú
                          </Badge>
                        )}
                      </td>
                      {COLUMNAS.map((r) => (
                        <td
                          key={r}
                          className={cn('px-2 py-2 text-center', r === rolActual && 'bg-accent/[.06]')}
                        >
                          <Marca nivel={nivelDe(r, s)} />
                        </td>
                      ))}
                      <td className="px-4 py-2 text-[0.72rem] text-muted-foreground">{notaDe(s)}</td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}

            {/* Lo que se esconde DENTRO de una pantalla, no la pantalla entera. */}
            <tr className="border-b border-border bg-secondary/30">
              <td
                colSpan={COLUMNAS.length + 2}
                className="px-4 py-1 text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground"
              >
                Dentro de la pantalla
              </td>
            </tr>
            {DATOS_SENSIBLES.map((d) => (
              <tr key={d.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">
                  {d.titulo}
                  <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{d.detalle}</p>
                </td>
                {COLUMNAS.map((r) => (
                  <td
                    key={r}
                    className={cn('px-2 py-2 text-center', r === rolActual && 'bg-accent/[.06]')}
                  >
                    <Marca nivel={puedeVerDato(r, d.id) ? 'edita' : 'no'} />
                  </td>
                ))}
                <td className="px-4 py-2 text-[0.72rem] text-muted-foreground">
                  {d.donde.join(' · ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        <button
          onClick={() => setVerTodo((v) => !v)}
          className="rounded-md border border-border px-2 py-1 text-[0.72rem] transition-colors hover:bg-secondary hover:text-foreground"
        >
          {verTodo ? 'Ver solo lo que está en el menú' : 'Ver también las pantallas internas'}
        </button>
        <span>
          Los roles se asignan en Admin → Usuarios y roles. Esta tabla se cambia en el código
          (<span className="font-mono">src/modules/inventario/navegacion.ts</span>), que es de donde
          salen el permiso, la barra lateral y el menú del celular.
        </span>
      </div>
    </div>
  );
}
