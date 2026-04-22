import { Routes, Route, Outlet } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { TopBar } from '@/components/TopBar';
import { LegacyFrame } from '@/components/LegacyFrame';
import { Login } from '@/pages/Login';
import { Registro } from '@/pages/Registro';
import { Setup } from '@/pages/Setup';
import { Landing } from '@/pages/Landing';
import { AdminPanel } from '@/pages/AdminPanel';
import { HistorialTubos } from '@/pages/HistorialTubos';
import { Camionetas } from '@/pages/Camionetas';
import { Ventas } from '@/pages/Ventas';
import { Inteligencia } from '@/pages/Inteligencia';
import { HistorialCorte } from '@/pages/HistorialCorte';
import { Bodeguero } from '@/pages/Bodeguero';
import { Telas } from '@/pages/Telas';
import { Inventario } from '@/pages/Inventario';
import { Panel } from '@/pages/Panel';
import { CotizadorFase1 } from '@/pages/CotizadorFase1';
import { CotizadorFase2 } from '@/pages/CotizadorFase2';
import { CotizadorFase3 } from '@/pages/CotizadorFase3';

function Shell() {
  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      <main className="flex-1 overflow-auto">
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
      <Route path="/registro" element={<Registro />} />
      <Route path="/landing" element={<Landing />} />

      {/* Setup (requiere sesión pero no onboarding — sin Shell/TopBar) */}
      <Route
        path="/setup"
        element={
          <ProtectedRoute>
            <Setup />
          </ProtectedRoute>
        }
      />

      {/* Protegidas — todas pasan por iframe a legacy */}
      <Route
        element={
          <ProtectedRoute>
            <Shell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Panel />} />
        <Route path="ots/:id/fase1" element={<CotizadorFase1 />} />
        <Route path="ots/:id/fase2" element={<CotizadorFase2 />} />
        <Route path="ots/:id/fase3" element={<CotizadorFase3 />} />
        <Route
          path="cotizador"
          element={<LegacyFrame src="/legacy/index.html" title="Cotizador" />}
        />
        <Route path="ventas" element={<Ventas />} />
        <Route path="inteligencia" element={<Inteligencia />} />
        <Route path="telas" element={<Telas />} />
        <Route path="inventario" element={<Inventario />} />
        <Route
          path="optimizador"
          element={<LegacyFrame src="/legacy/optimizador.html" title="Optimizador" />}
        />
        <Route path="bodeguero" element={<Bodeguero />} />
        <Route path="camionetas" element={<Camionetas />} />
        <Route path="historial-corte" element={<HistorialCorte />} />
        <Route path="historial-tubos" element={<HistorialTubos />} />
        <Route path="admin" element={<AdminPanel />} />
      </Route>

      <Route path="*" element={<div className="p-8">404 · Ruta no encontrada</div>} />
    </Routes>
  );
}
