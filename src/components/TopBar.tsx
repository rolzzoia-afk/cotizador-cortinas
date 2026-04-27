import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Eye, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

// Cada link tiene una lista de roles que pueden verlo. `admin` ve todo
// (se maneja aparte en el componente). Si la lista está vacía → solo admin.
const links: Array<{ to: string; label: string; rolesVisibles: string[] }> = [
  { to: '/panel', label: 'Panel', rolesVisibles: ['ventas', 'pruebas'] },
  { to: '/ventas', label: 'Ventas', rolesVisibles: ['ventas'] },
  { to: '/inteligencia', label: 'Inteligencia', rolesVisibles: ['ventas'] },
  { to: '/telas', label: 'Telas', rolesVisibles: ['bodeguero', 'produccion', 'telas', 'dimensionado'] },
  { to: '/inventario', label: 'Inventario', rolesVisibles: ['bodeguero'] },
  { to: '/optimizador', label: 'Optimizador', rolesVisibles: ['produccion'] },
  { to: '/bodeguero', label: 'Bodega', rolesVisibles: ['bodeguero'] },
  { to: '/camionetas', label: 'Camionetas', rolesVisibles: ['bodeguero'] },
  { to: '/historial-corte', label: 'Historial Corte', rolesVisibles: ['produccion', 'dimensionado'] },
  { to: '/historial-tubos', label: 'Historial Tubos', rolesVisibles: ['produccion'] },
  { to: '/ojo-de-dios', label: 'Ojo de Dios', rolesVisibles: [] }, // solo admin
  { to: '/admin', label: 'Admin', rolesVisibles: [] }, // solo admin
];

export function TopBar() {
  const { perfil, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);

  // "Ver como" via ?rol=X en la URL: permite que un admin entre en
  // perspectiva de otro rol desde Landing y vea solo los tabs de ese
  // rol. Si no hay query, se usa el perfil real (comportamiento original).
  const rolReal = (perfil?.rol || '').toLowerCase().trim();
  const viewAs = (params.get('rol') || '').toLowerCase().trim();
  const rolEfectivo = viewAs || rolReal;
  // esAdmin solo cuando NO está actuando como otro rol — el viewAs siempre
  // dispara el filtro, incluso si el usuario real es admin.
  const esAdmin = !viewAs && (rolReal === 'admin' || !rolReal);
  const linksVisibles = esAdmin
    ? links
    : links.filter((l) => l.rolesVisibles.includes(rolEfectivo));

  // Preservar ?rol=X en cada NavLink para que la navegación entre tabs
  // mantenga el modo "ver como". Click en el logo Rolzzo limpia la query.
  const queryStr = viewAs ? `?rol=${viewAs}` : '';

  // Cerrar el menú al navegar
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Cerrar con Escape
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
      <header className="flex h-14 items-center justify-between border-b bg-background px-3 lg:h-16 lg:px-4">
        {/* Mobile/tablet: hamburguesa + logo */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Abrir menú"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link to="/" className="font-semibold hover:text-primary">Rolzzo</Link>
        </div>

        {/* Desktop: logo + nav completo */}
        <nav className="hidden items-center gap-4 lg:flex">
          <Link to="/" className="font-semibold hover:text-primary">Rolzzo</Link>
          <ul className="flex gap-1">
            {linksVisibles.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={`${l.to}${queryStr}`}
                  end={l.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'rounded px-3 py-1.5 text-sm transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )
                  }
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Derecha: viendo como + usuario + salir (compacto en mobile) */}
        <div className="flex items-center gap-2 text-sm lg:gap-3">
          {viewAs && (
            <button
              onClick={() => navigate(location.pathname, { replace: true })}
              className="hidden items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[0.72rem] text-amber-200 hover:border-amber-500/50 hover:bg-amber-500/15 sm:flex"
              title="Salir del modo 'ver como'"
            >
              <Eye className="h-3 w-3" />
              <span className="capitalize">Viendo como {viewAs}</span>
              <X className="h-3 w-3 opacity-70" />
            </button>
          )}
          <span className="hidden max-w-[120px] truncate text-muted-foreground sm:inline">
            {perfil?.nombre ?? '—'}
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
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
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setMenuOpen(false)}
          />
          {/* Drawer lateral */}
          <nav className="fixed left-0 top-14 z-50 h-[calc(100vh-3.5rem)] w-[80vw] max-w-xs overflow-y-auto border-r bg-background shadow-xl lg:hidden">
            <div className="border-b px-4 py-3">
              <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                Usuario
              </div>
              <div className="truncate text-sm font-medium">{perfil?.nombre ?? '—'}</div>
              {perfil?.rol && (
                <div className="text-[0.7rem] text-muted-foreground">{perfil.rol}</div>
              )}
            </div>
            <ul className="py-2">
              {linksVisibles.map((l) => (
                <li key={l.to}>
                  <NavLink
                    to={`${l.to}${queryStr}`}
                    end={l.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex w-full items-center px-4 py-3 text-sm transition-colors',
                        isActive
                          ? 'bg-primary/15 text-primary font-medium'
                          : 'text-foreground hover:bg-muted',
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
