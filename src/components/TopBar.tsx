import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Eye, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { APP_NAME } from '@/lib/marca';
import { esRolAdmin, puedeAccederRuta } from '@/lib/roles';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';

// La visibilidad de cada link la decide src/lib/roles.ts (misma matriz que
// usa ProtectedRoute para bloquear las rutas de verdad).
const links: Array<{ to: string; label: string }> = [
  { to: '/panel', label: 'Panel' },
  { to: '/ventas', label: 'Ventas' },
  { to: '/leads', label: 'Leads' },
  { to: '/inteligencia', label: 'Inteligencia' },
  { to: '/telas', label: 'Telas' },
  { to: '/inventario', label: 'Inventario' },
  { to: '/optimizador', label: 'Optimizador' },
  { to: '/optimizador-tela', label: 'Optim. Tela' },
  { to: '/bodeguero', label: 'Bodega' },
  { to: '/camionetas', label: 'Camionetas' },
  { to: '/historial-corte', label: 'Historial Corte' },
  { to: '/historial-tubos', label: 'Historial Tubos' },
  { to: '/ojo-de-dios', label: 'Ojo de Dios' },
  { to: '/admin', label: 'Admin' },
];

export function TopBar() {
  const { perfil, empresaNombre, signOut } = useAuth();
  const marca = empresaNombre || APP_NAME;
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);

  const rolReal = (perfil?.rol || '').toLowerCase().trim();
  const esAdminReal = esRolAdmin(rolReal);
  // "Ver como" (?rol=) es solo una vista previa para ADMINS. Antes cualquier
  // usuario podía ponerse ?rol=admin en la URL y ver el menú completo.
  const viewAs = esAdminReal ? (params.get('rol') || '').toLowerCase().trim() : '';
  const rolEfectivo = viewAs || rolReal;
  const linksVisibles = esRolAdmin(rolEfectivo)
    ? links
    : links.filter((l) => puedeAccederRuta(rolEfectivo, l.to));
  const queryStr = viewAs ? `?rol=${viewAs}` : '';

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md lg:h-[68px] lg:px-6">
        {/* Mobile/tablet: hamburguesa + logo */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Abrir menú"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link
            to="/"
            className="font-serif text-xl font-medium tracking-tight text-foreground hover:text-accent"
          >
            {marca}
          </Link>
        </div>

        {/* Desktop: logo + nav completo */}
        <nav className="hidden items-center gap-8 lg:flex">
          <Link
            to="/"
            className="font-serif text-2xl font-medium tracking-tight text-foreground transition-colors hover:text-accent"
          >
            {marca}
          </Link>
          <ul className="flex items-center gap-0.5">
            {linksVisibles.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={`${l.to}${queryStr}`}
                  end={l.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'relative inline-block rounded-md px-3 py-1.5 text-[0.8125rem] font-medium tracking-tight transition-colors',
                      isActive
                        ? 'text-foreground after:absolute after:bottom-0 after:left-3 after:right-3 after:h-px after:bg-accent'
                        : 'text-muted-foreground hover:text-foreground',
                    )
                  }
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Derecha: viendo como + theme + usuario + salir */}
        <div className="flex items-center gap-2 text-sm lg:gap-3">
          {viewAs && (
            <button
              onClick={() => navigate(location.pathname, { replace: true })}
              className="hidden items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-[0.72rem] text-warning transition-colors hover:bg-warning/15 sm:flex"
              title="Salir del modo 'ver como'"
            >
              <Eye className="h-3 w-3" />
              <span className="capitalize">Viendo como {viewAs}</span>
              <X className="h-3 w-3 opacity-70" />
            </button>
          )}
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <span className="hidden max-w-[140px] truncate text-[0.8125rem] text-muted-foreground sm:inline">
            {perfil?.nombre ?? '—'}
          </span>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.8125rem] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="fixed left-0 top-16 z-50 h-[calc(100vh-4rem)] w-[82vw] max-w-xs overflow-y-auto border-r border-border bg-card shadow-2xl lg:hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
                Usuario
              </div>
              <div className="mt-1 truncate font-serif text-base font-medium text-foreground">
                {perfil?.nombre ?? '—'}
              </div>
              {perfil?.rol && (
                <div className="mt-0.5 text-[0.75rem] capitalize text-muted-foreground">
                  {perfil.rol}
                </div>
              )}
              <div className="mt-3">
                <ThemeToggle />
              </div>
            </div>
            <ul className="py-2">
              {linksVisibles.map((l) => (
                <li key={l.to}>
                  <NavLink
                    to={`${l.to}${queryStr}`}
                    end={l.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex w-full items-center border-l-2 px-5 py-3 text-sm tracking-tight transition-colors',
                        isActive
                          ? 'border-accent bg-accent/5 font-medium text-foreground'
                          : 'border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                      )
                    }
                  >
                    {l.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
    </>
  );
}
