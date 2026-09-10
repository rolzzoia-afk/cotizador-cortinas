import { Suspense, lazy } from 'react';
import { Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { TopBar } from '@/components/TopBar';
import { LegacyFrame } from '@/components/LegacyFrame';

const Login = lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })));
const Registro = lazy(() => import('@/pages/Registro').then((m) => ({ default: m.Registro })));
const Setup = lazy(() => import('@/pages/Setup').then((m) => ({ default: m.Setup })));
const Landing = lazy(() => import('@/pages/Landing').then((m) => ({ default: m.Landing })));
const AdminPanel = lazy(() => import('@/pages/AdminPanel').then((m) => ({ default: m.AdminPanel })));
const VistaTubos = lazy(() => import('@/pages/inventario/tubos/VistaTubos').then((m) => ({ default: m.HistorialTubos })));
const VistaCamionetas = lazy(() => import('@/pages/inventario/camionetas/VistaCamionetas').then((m) => ({ default: m.Camionetas })));
const Ventas = lazy(() => import('@/pages/Ventas').then((m) => ({ default: m.Ventas })));
const LeadsPipeline = lazy(() => import('@/pages/LeadsPipeline').then((m) => ({ default: m.LeadsPipeline })));
const Inteligencia = lazy(() => import('@/pages/Inteligencia').then((m) => ({ default: m.Inteligencia })));
const HistorialCorte = lazy(() => import('@/pages/HistorialCorte').then((m) => ({ default: m.HistorialCorte })));
const Produccion = lazy(() => import('@/pages/Produccion').then((m) => ({ default: m.Produccion })));
const VistaDespacho = lazy(() => import('@/pages/inventario/despacho/VistaDespacho').then((m) => ({ default: m.Bodeguero })));
const VistaTelas = lazy(() => import('@/pages/inventario/telas/VistaTelas').then((m) => ({ default: m.Telas })));
const VistaInsumos = lazy(() => import('@/pages/inventario/insumos/VistaInsumos').then((m) => ({ default: m.Inventario })));
const FichaInsumo = lazy(() => import('@/pages/inventario/insumos/FichaInsumo').then((m) => ({ default: m.FichaInsumo })));
const FichaTela = lazy(() => import('@/pages/inventario/telas/FichaTela').then((m) => ({ default: m.FichaTela })));
const Panel = lazy(() => import('@/pages/Panel').then((m) => ({ default: m.Panel })));
// Cotizador compartido: Fase 1 (entrada, columnas reducidas) y Fase 3
// (cotización final tras Terreno) son el MISMO componente con distinto `modo`.
const CotizadorFase0 = lazy(() => import('@/pages/CotizadorFase0').then((m) => ({ default: m.CotizadorFase0 })));
const CotizadorFase2 = lazy(() => import('@/pages/CotizadorFase2').then((m) => ({ default: m.CotizadorFase2 })));
const CotizadorFase4 = lazy(() => import('@/pages/CotizadorFase4').then((m) => ({ default: m.CotizadorFase4 })));
const CotizadorTela = lazy(() => import('@/pages/CotizadorTela').then((m) => ({ default: m.CotizadorTela })));
const OptimizadorTela = lazy(() => import('@/pages/OptimizadorTela').then((m) => ({ default: m.OptimizadorTela })));
const OjoDeDios = lazy(() => import('@/pages/OjoDeDios').then((m) => ({ default: m.OjoDeDios })));
const VistaContar = lazy(() => import('@/pages/inventario/conteo/VistaContar').then((m) => ({ default: m.InventarioConteo })));
const InventarioTelasPrueba = lazy(() => import('@/pages/inventario-telas-prueba/Pagina'));
const CotizadorJefe = lazy(() => import('@/pages/CotizadorJefe').then((m) => ({ default: m.CotizadorJefe })));

// Módulo /inventario: un armazón con barra lateral y un submódulo adentro.
const InventarioLayout = lazy(() => import('@/pages/inventario/InventarioLayout').then((m) => ({ default: m.InventarioLayout })));
const VistaTablero = lazy(() => import('@/pages/inventario/tablero/VistaTablero').then((m) => ({ default: m.VistaTablero })));
const VistaColmena = lazy(() => import('@/pages/inventario/colmena/VistaColmena').then((m) => ({ default: m.VistaColmena })));
const VistaMovimientos = lazy(() => import('@/pages/inventario/movimientos/VistaMovimientos').then((m) => ({ default: m.VistaMovimientos })));
const VistaConteo = lazy(() => import('@/pages/inventario/conteo/VistaConteo').then((m) => ({ default: m.VistaConteo })));
const VistaMermas = lazy(() => import('@/pages/inventario/mermas/VistaMermas').then((m) => ({ default: m.VistaMermas })));
const VistaAlertas = lazy(() => import('@/pages/inventario/alertas/VistaAlertas').then((m) => ({ default: m.VistaAlertas })));
const VistaReportes = lazy(() => import('@/pages/inventario/reportes/VistaReportes').then((m) => ({ default: m.VistaReportes })));
const VistaCompras = lazy(() => import('@/pages/inventario/compras/VistaCompras').then((m) => ({ default: m.VistaCompras })));
const VistaConfiguracion = lazy(() => import('@/pages/inventario/configuracion/VistaConfiguracion').then((m) => ({ default: m.VistaConfiguracion })));
const VistaAuditoria = lazy(() => import('@/pages/inventario/auditoria/VistaAuditoria').then((m) => ({ default: m.VistaAuditoria })));

/**
 * Redirección que CONSERVA la query. Sin esto, un admin que anda mirando con
 * `?rol=bodeguero` lo pierde al entrar por una ruta vieja y la pantalla le
 * cambia sola.
 */
function Redirigir({ a }: { a: string }) {
  const { search } = useLocation();
  return <Navigate to={`${a}${search}`} replace />;
}

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
    <div className="flex h-full min-h-[50vh] items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />

        <Route
          path="/setup"
          element={
            <ProtectedRoute>
              <Setup />
            </ProtectedRoute>
          }
        />

        <Route
          path="/inventario-telas-prueba"
          element={
            <ProtectedRoute>
              <InventarioTelasPrueba />
            </ProtectedRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <Outlet />
            </ProtectedRoute>
          }
        >
          <Route index element={<Landing />} />
          <Route path="landing" element={<Landing />} />
        </Route>

        <Route
          element={
            <ProtectedRoute>
              <Shell />
            </ProtectedRoute>
          }
        >
          <Route path="panel" element={<Panel />} />
          {/* Fase 1 = cotización de entrada (columnas reducidas). /cotizar y
              /fase0 (compat) renderizan lo mismo. */}
          <Route path="cotizar" element={<CotizadorFase0 modo="fase1" />} />
          <Route path="ots/:id/fase0" element={<CotizadorFase0 modo="fase1" />} />
          <Route path="ots/:id/fase1" element={<CotizadorFase0 modo="fase1" />} />
          <Route path="ots/:id/fase2" element={<CotizadorFase2 />} />
          {/* Fase 3 = cotización final tras Terreno (mismo cotizador, todas las
              columnas + aprobar a Producción). */}
          <Route path="ots/:id/fase3" element={<CotizadorFase0 modo="fase3" />} />
          <Route path="ots/:id/fase4" element={<CotizadorFase4 />} />
          <Route path="ots/:id/tela" element={<CotizadorTela />} />
          <Route path="optimizador-tela" element={<OptimizadorTela />} />
          <Route path="ventas" element={<Ventas />} />
          <Route path="leads" element={<LeadsPipeline />} />
          <Route path="inteligencia" element={<Inteligencia />} />
          {/* Inventario: los submódulos cuelgan del layout con la barra lateral.
              El registro de src/modules/inventario/navegacion.ts dice quién ve
              cada uno; acá solo se declara dónde vive. */}
          <Route path="inventario" element={<InventarioLayout />}>
            <Route index element={<VistaTablero />} />
            <Route path="insumos" element={<VistaInsumos />} />
            <Route path="insumos/ubicaciones" element={<VistaInsumos />} />
            {/* La ficha de un artículo. Va después de `ubicaciones` para que
                esa palabra no se lea como un código. */}
            <Route path="insumos/:cod" element={<FichaInsumo />} />
            <Route path="telas" element={<VistaTelas />} />
            <Route path="telas/:codigo" element={<FichaTela />} />
            <Route path="colmena" element={<VistaColmena />} />
            <Route path="tubos" element={<VistaTubos />} />
            <Route path="camionetas" element={<VistaCamionetas />} />
            <Route path="despacho" element={<VistaDespacho />} />
            <Route path="movimientos" element={<VistaMovimientos />} />
            <Route path="conteo" element={<VistaConteo />} />
            <Route path="conteo/tubos" element={<VistaConteo />} />
            <Route path="conteo/contar" element={<VistaContar />} />
            <Route path="mermas" element={<VistaMermas />} />
            <Route path="alertas" element={<VistaAlertas />} />
            <Route path="reportes" element={<VistaReportes />} />
            <Route path="compras" element={<VistaCompras />} />
            <Route path="configuracion" element={<VistaConfiguracion />} />
            <Route path="auditoria" element={<VistaAuditoria />} />
            {/* Una ruta que no existe dentro del módulo vuelve al tablero, no a
                la pantalla de 404 de toda la app. */}
            <Route path="*" element={<Navigate to="/inventario" replace />} />
          </Route>

          {/* Rutas viejas: siguen funcionando y llevan a su nueva casa. */}
          <Route path="telas" element={<Redirigir a="/inventario/telas" />} />
          <Route path="bodeguero" element={<Redirigir a="/inventario/despacho" />} />
          <Route path="camionetas" element={<Redirigir a="/inventario/camionetas" />} />
          <Route path="historial-tubos" element={<Redirigir a="/inventario/tubos" />} />
          <Route path="inventario-conteo" element={<Redirigir a="/inventario/conteo/contar" />} />

          <Route
            path="optimizador"
            element={<LegacyFrame src="/legacy/optimizador.html" title="Optimizador" />}
          />
          <Route path="historial-corte" element={<HistorialCorte />} />
          <Route path="produccion" element={<Produccion />} />
          <Route path="cotizador-jefe" element={<CotizadorJefe />} />
          <Route path="admin" element={<AdminPanel />} />
          <Route path="ojo-de-dios" element={<OjoDeDios />} />
        </Route>

        <Route path="*" element={<div className="p-8">404 · Ruta no encontrada</div>} />
      </Routes>
    </Suspense>
  );
}
