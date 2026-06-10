// ─────────────────────────────────────────────────────────────────────
// Admin → Usuarios y roles
//
// Lista los perfiles de la empresa y permite cambiar el rol de cada uno.
// El acceso por rol lo define src/lib/roles.ts; en la BD, un trigger
// impide que un no-admin se cambie el rol a sí mismo, y la política
// perfiles_update_admin_empresa permite a los admins editar a su equipo.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { Copy, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { ROLES_DISPONIBLES } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type PerfilRow = {
  id: string;
  nombre: string | null;
  rol: string | null;
};

type InvitacionRow = {
  id: string;
  codigo: string;
  rol: string;
  email: string | null;
  created_at: string;
  expira_en: string;
  usado_en: string | null;
};

function generarCodigo(): string {
  // 10 caracteres legibles (sin 0/O/1/I) — suficiente entropía para 7 días
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return [...bytes].map((b) => alfabeto[b % alfabeto.length]).join('');
}

function linkInvitacion(codigo: string): string {
  return `${window.location.origin}/registro?invitacion=${codigo}`;
}

export function UsuariosRolesSection() {
  const { empresaId, user } = useAuth();
  const [perfiles, setPerfiles] = useState<PerfilRow[]>([]);
  const [invitaciones, setInvitaciones] = useState<InvitacionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [invRol, setInvRol] = useState<string>('ventas');
  const [invEmail, setInvEmail] = useState('');
  const [creandoInv, setCreandoInv] = useState(false);

  const cargar = async () => {
    if (!empresaId) return;
    setLoading(true);
    const [perfRes, invRes] = await Promise.all([
      supabase.from('perfiles').select('id, nombre, rol').eq('empresa_id', empresaId).order('nombre'),
      supabase
        .from('invitaciones' as never)
        .select('id, codigo, rol, email, created_at, expira_en, usado_en')
        .eq('empresa_id', empresaId)
        .is('usado_en', null)
        .gt('expira_en', new Date().toISOString())
        .order('created_at', { ascending: false }),
    ]);
    if (perfRes.error) toast.error('Error cargando usuarios: ' + perfRes.error.message);
    setPerfiles((perfRes.data as PerfilRow[]) ?? []);
    setInvitaciones((invRes.data as unknown as InvitacionRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const copiarLink = async (codigo: string) => {
    try {
      await navigator.clipboard.writeText(linkInvitacion(codigo));
      toast.success('Link copiado. Envíaselo a la persona invitada.');
    } catch {
      toast.info(linkInvitacion(codigo));
    }
  };

  const crearInvitacion = async () => {
    if (!empresaId || !user) return;
    setCreandoInv(true);
    const codigo = generarCodigo();
    const { error } = await supabase.from('invitaciones' as never).insert({
      empresa_id: empresaId,
      codigo,
      rol: invRol,
      email: invEmail.trim() || null,
      creado_por: user.id,
    } as never);
    setCreandoInv(false);
    if (error) {
      toast.error('Error creando invitación: ' + error.message);
      return;
    }
    setInvEmail('');
    await cargar();
    copiarLink(codigo);
  };

  const revocarInvitacion = async (inv: InvitacionRow) => {
    const { error } = await supabase.from('invitaciones' as never).delete().eq('id', inv.id);
    if (error) {
      toast.error('Error al revocar: ' + error.message);
      return;
    }
    toast.success('Invitación revocada.');
    cargar();
  };

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

      {/* ── Invitar a una persona a esta empresa ── */}
      <div className="mt-6 border-t border-border pt-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <UserPlus className="h-3.5 w-3.5" /> Invitar a una persona
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Genera un link de invitación y envíaselo (WhatsApp, correo…). Al registrarse con ese
          link, la persona entra a TU empresa con el rol elegido. Vence en 7 días.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={invRol}
            onChange={(e) => setInvRol(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          >
            {ROLES_DISPONIBLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <Input
            placeholder="Email (opcional, restringe la invitación)"
            value={invEmail}
            onChange={(e) => setInvEmail(e.target.value)}
            className="h-8 w-64 text-xs"
          />
          <Button size="sm" onClick={crearInvitacion} disabled={creandoInv || !empresaId}>
            {creandoInv ? 'Generando…' : 'Generar link'}
          </Button>
        </div>

        {invitaciones.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {invitaciones.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
              >
                <code className="font-mono font-bold">{inv.codigo}</code>
                <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent">
                  {inv.rol}
                </span>
                {inv.email && <span className="text-muted-foreground">{inv.email}</span>}
                <span className="text-muted-foreground">
                  vence {new Date(inv.expira_en).toLocaleDateString('es-CL')}
                </span>
                <span className="ml-auto flex gap-1">
                  <button
                    onClick={() => copiarLink(inv.codigo)}
                    className="rounded-md border border-border p-1 hover:bg-secondary"
                    title="Copiar link"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => revocarInvitacion(inv)}
                    className="rounded-md border border-border p-1 text-destructive hover:bg-destructive/10"
                    title="Revocar invitación"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
