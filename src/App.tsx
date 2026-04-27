import { Suspense, lazy } from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { TopBar } from '@/components/TopBar';
import { LegacyFrame } from '@/components/LegacyFrame';

// Todas las páginas son lazy: cada ruta se descarga solo al navegar a ella.
// La sintaxis `.then(m => ({ default: m.X }))` adapta nuestros exports
// nombrados al formato default que espera React.lazy.
const Login = lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })));
const Registro = lazy(() => import('@/pages/Registro').then((m) => ({ default: m.Registro })));
const Setup = lazy(() => import('@/pages/Setup').then((m) => ({ default: m.Setup })));
const Landing = lazy(() => import('@/pages/Landing').then((m) => ({ default: m.Landing })));
const AdminPanel = lazy(() => import('@/pages/AdminPanel').then((m) => ({ default: m.AdminPanel })));
const HistorialTubos = lazy(() => import('@/pages/HistorialTubos').then((m) => ({ default: m.HistorialTubos })));
const Camionetas = lazy(() => import('@/pages/Camionetas').then((m) => ({ default: m.Camionetas })));
const Ventas = lazy(() => import('@/pages/Ventas').then((m) => ({ default: m.Ventas })));
const Inteligencia = lazy(() => import('@/pages/Inteligencia').then((m) => ({ default: m.Inteligencia })));
const HistorialCorte = lazy(() => import('@/pages/HistorialCorte').then((m) => ({ default: m.HistorialCorte })));
const Bodeguero = lazy(() => import('@/pages/Bodeguero').then((m) => ({ default: m.Bodeguero })));
const Telas = lazy(() => import('@/pages/Telas').then((m) => ({ default: m.Telas })));
const Inventario = lazy(() => import('@/pages/Inventario').then((m) => ({ default: m.Inventario })));
const Panel = lazy(() => import('@/pages/Panel').then((m) => ({ default: m.Panel })));
const CotizadorFase1 = lazy(() => import('@/pages/CotizadorFase1').then((m) => ({ default: m.CotizadorFase1 })));
const CotizadorFase2 = lazy(() => import('@/pages/CotizadorFase2').then((m) => ({ default: m.CotizadorFase2 })));
const CotizadorFase3 = lazy(() => import('@/pages/CotizadorFase3').then((m) => ({ default: m.CotizadorFase3 })));
const CotizadorFase4 = lazy(() => import('@/pages/CotizadorFase4').then((m) => ({ default: m.CotizadorFase4 })));
const CotizadorTela = lazy(() => import('@/pages/CotizadorTela').then((m) => ({ default: m.CotizadorTela })));
const OjoDeDios = lazy(() => import('@/pages/OjoDeDios').then((m) => ({ default: m.OjoDeDios })));

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

function PageLoading() {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center text-zinc-400">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* Públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />

        {/* Setup (requiere sesión pero no onboarding — sin Shell/TopBar) */}
        <Route
          path="/setup"
          element={
            <ProtectedRoute>
              <Setup />
            </ProtectedRoute>
          }
        />

        {/* Protegidas */}
        <Route
          element={
            <ProtectedRoute>
              <Shell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Landing />} />
          <Route path="panel" element={<Panel />} />
          {/* Alias retrocompat: varias páginas llaman navigate('/landing'). */}
          <Route path="landing" element={<Landing />} />
          <Route path="ots/:id/fase1" element={<CotizadorFase1 />} />
          <Route path="ots/:id/fase2" element={<CotizadorFase2 />} />
          <Route path="ots/:id/fase3" element={<CotizadorFase3 />} />
          <Route path="ots/:id/fase4" element={<CotizadorFase4 />} />
          <Route path="ots/:id/tela" element={<CotizadorTela />} />
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
          <Route path="ojo-de-dios" element={<OjoDeDios />} />
        </Route>

        <Route path="*" element={<div className="p-8">404 · Ruta no encontrada</div>} />
      </Routes>
    </Suspense>
  );
}
