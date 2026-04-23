import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
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

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4">
      <nav className="flex items-center gap-4">
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
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">{perfil?.nombre ?? '—'}</span>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
          Salir
        </button>
      </div>
    </header>
  );
}
