// ─────────────────────────────────────────────────────────────────────
// Admin → Usuarios y roles
//
// Lista los perfiles de la empresa y permite cambiar el rol de cada uno.
// El acceso por rol lo define src/lib/roles.ts; en la BD, un trigger
// impide que un no-admin se cambie el rol a sí mismo, y la política
// perfiles_update_admin_empresa permite a los admins editar a su equipo.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { ROLES_DISPONIBLES } from '@/lib/roles';

type PerfilRow = {
  id: string;
  nombre: string | null;
  rol: string | null;
};

export function UsuariosRolesSection() {
  const { empresaId, user } = useAuth();
  const [perfiles, setPerfiles] = useState<PerfilRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  const cargar = async () => {
    if (!empresaId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, nombre, rol')
      .eq('empresa_id', empresaId)
      .order('nombre');
    if (error) toast.error('Error cargando usuarios: ' + error.message);
    setPerfiles((data as PerfilRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const cambiarRol = async (p: PerfilRow, nuevoRol: string) => {
    if (p.id === user?.id && nuevoRol !== 'admin') {
      const ok = window.confirm(
        'Estás a punto de quitarte el rol de administrador A TI MISMO. ' +
          'Perderás acceso al panel Admin. ¿Continuar?',
      );
      if (!ok) return;
    }
    setGuardandoId(p.id);
    const { error } = await supabase.from('perfiles').update({ rol: nuevoRol }).eq('id', p.id);
    setGuardandoId(null);
    if (error) {
      toast.error('Error al cambiar rol: ' + error.message);
      return;
    }
    toast.success(`Rol de ${p.nombre || 'usuario'} → ${nuevoRol}`);
    cargar();
  };

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex items-center gap-2">
        <Users className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">Usuarios y roles</h2>
      </header>

      <p className="mb-4 text-xs text-muted-foreground">
        El rol define qué secciones puede usar cada persona: <strong>ventas</strong> (panel,
        cotizador, leads), <strong>bodeguero/produccion/dimensionado/telas/operario</strong>{' '}
        (taller), <strong>admin</strong> (todo). Los cambios aplican al instante.
      </p>

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : perfiles.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin usuarios.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-2 py-2">Nombre</th>
                <th className="px-2 py-2">Rol</th>
              </tr>
            </thead>
            <tbody>
              {perfiles.map((p) => (
                <tr key={p.id} className="border-b border-border hover:bg-secondary/40">
                  <td className="px-2 py-1.5">
                    {p.nombre || '—'}
                    {p.id === user?.id && (
                      <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent">
                        tú
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={(p.rol || '').toLowerCase()}
                      disabled={guardandoId === p.id}
                      onChange={(e) => cambiarRol(p, e.target.value)}
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                    >
                      {!ROLES_DISPONIBLES.includes(
                        (p.rol || '').toLowerCase() as (typeof ROLES_DISPONIBLES)[number],
                      ) && <option value={(p.rol || '').toLowerCase()}>{p.rol || 'sin rol'}</option>}
                      {ROLES_DISPONIBLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
