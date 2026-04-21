import { Routes, Route, Outlet } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { TopBar } from '@/components/TopBar';
import { LegacyFrame } from '@/components/LegacyFrame';
import { Login } from '@/pages/Login';

function Shell() {
  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      {/* Públicas — todas apuntan a legacy por ahora */}
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<LegacyFrame src="/legacy/registro.html" title="Registro" />} />
      <Route path="/landing" element={<LegacyFrame src="/legacy/landing.html" title="Landing" />} />

      {/* Setup (requiere sesión pero no onboarding) */}
      <Route
        path="/setup"
        element={<LegacyFrame src="/legacy/setup.html" title="Setup" />}
      />

      {/* Protegidas — todas pasan por iframe a legacy */}
      <Route
        element={
          <ProtectedRoute>
            <Shell />
          </ProtectedRoute>
        }
      >
        <Route index element={<LegacyFrame src="/legacy/index.html" title="Inicio" />} />
        <Route path="ventas" element={<LegacyFrame src="/legacy/ventas.html" title="Ventas" />} />
        <Route
          path="inteligencia"
          element={<LegacyFrame src="/legacy/inteligencia.html" title="Inteligencia" />}
        />
        <Route path="telas" element={<LegacyFrame src="/legacy/telas.html" title="Telas" />} />
        <Route
          path="inventario"
          element={<LegacyFrame src="/legacy/inventario.html" title="Inventario" />}
        />
        <Route
          path="optimizador"
          element={<LegacyFrame src="/legacy/optimizador.html" title="Optimizador" />}
        />
        <Route
          path="bodeguero"
          element={<LegacyFrame src="/legacy/bodeguero.html" title="Bodega" />}
        />
        <Route
          path="camionetas"
          element={<LegacyFrame src="/legacy/camionetas.html" title="Camionetas" />}
        />
        <Route
          path="historial-corte"
          element={<LegacyFrame src="/legacy/historial_corte.html" title="Historial corte" />}
        />
        <Route
          path="historial-tubos"
          element={<LegacyFrame src="/legacy/historial_tubos.html" title="Historial tubos" />}
        />
        <Route
          path="admin"
          element={<LegacyFrame src="/legacy/admin_panel.html" title="Admin" />}
        />
      </Route>

      <Route path="*" element={<div className="p-8">404 · Ruta no encontrada</div>} />
    </Routes>
  );
}
