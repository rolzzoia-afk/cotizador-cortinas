import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const links = [
  { to: '/', label: 'Panel' },
  { to: '/ventas', label: 'Ventas' },
  { to: '/inteligencia', label: 'Inteligencia' },
  { to: '/telas', label: 'Telas' },
  { to: '/inventario', label: 'Inventario' },
  { to: '/optimizador', label: 'Optimizador' },
  { to: '/bodeguero', label: 'Bodega' },
  { to: '/camionetas', label: 'Camionetas' },
  { to: '/historial-corte', label: 'Historial Corte' },
  { to: '/historial-tubos', label: 'Historial Tubos' },
  { to: '/ojo-de-dios', label: 'Ojo de Dios' },
  { to: '/admin', label: 'Admin' },
];

export function TopBar() {
  const { perfil, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

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
          <span className="font-semibold">Rolzzo</span>
        </div>

        {/* Desktop: logo + nav completo */}
        <nav className="hidden items-center gap-4 lg:flex">
          <span className="font-semibold">Rolzzo</span>
          <ul className="flex gap-1">
            {links.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
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

        {/* Derecha: usuario + salir (compacto en mobile) */}
        <div className="flex items-center gap-2 text-sm lg:gap-3">
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
              {links.map((l) => (
                <li key={l.to}>
                  <NavLink
                    to={l.to}
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
