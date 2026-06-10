# Rolzzo · Sistema de gestión para cortinas roller a medida

Aplicación web multi-empresa para administrar el ciclo completo de una fábrica de cortinas roller: cotización, leads/CRM, órdenes de trabajo (OTs), optimización de corte de tubos, inventario de colmena, telas, bodega, camionetas y un agente IA de atención por WhatsApp.

## Stack

- **Frontend**: React 18 + TypeScript + Vite, Tailwind CSS, shadcn/ui, React Query, React Router.
- **Backend**: Supabase (Postgres + Auth + RLS multi-tenant + Storage + Edge Functions en Deno).
- **Despliegue**: Vercel (frontend) + Supabase (datos). Errores con Sentry (opcional).
- **Legacy**: el Optimizador de corte vive en `public/legacy/optimizador.html` y se monta en un iframe (`LegacyFrame`). Comparte la sesión de Supabase vía `localStorage`.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completar VITE_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:5173
```

Scripts útiles:

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest (motor de precios, plan de corte, BOM, telas)
npm run build       # build de producción (tsc -b && vite build)
npm run types:gen   # regenerar src/types/database.ts desde Supabase
```

> Nota Linux/CI: si `vitest` falla por el binding nativo de rolldown (node_modules instalado en Windows), instalar `npm i --no-save @rolldown/binding-linux-x64-gnu@<versión de rolldown>`.

## Arquitectura en 1 minuto

- **Multi-tenant**: cada fila de negocio tiene `empresa_id`. El aislamiento lo garantiza RLS con la política canónica `empresa_isolation` (`empresa_id = (SELECT get_my_empresa_id())`) en cada tabla. El registro de empresas nuevas pasa por la RPC `registrar_tenant` (única función abierta a `anon`, con validaciones).
- **Roles y permisos**: la matriz vive en `src/lib/roles.ts` y la usan tanto `ProtectedRoute` (bloqueo real de rutas) como `TopBar`/`Landing` (menú). Roles: `admin`, `ventas`, `bodeguero`, `produccion`, `dimensionado`, `telas`, `operario`, `pruebas`. Los roles se asignan en **Admin → Usuarios y roles**. En BD, un trigger impide que un no-admin cambie roles.
- **Marca**: el nombre del producto (pantallas pre-login) sale de `VITE_APP_NAME` (`src/lib/marca.ts`); el nombre de la empresa del usuario sale de `tenants.nombre` (`useAuth().empresaNombre`) y aparece en TopBar, PDFs, WhatsApp y el prompt del agente IA.
- **Precios**: los parámetros comerciales (IVA, margen de insumos, recargo tarjeta, instalación, mano de obra, traslado) son por empresa: tabla `configuracion`, clave `parametros_cotizador`, editables en **Admin → Parámetros de cotización**. Defaults históricos en `src/modules/cotizador/preciosFase0.ts`.
- **Plan de corte**: lo genera el optimizador legacy y se persiste vía RPC `guardar_plan_atomico` (sync de colmena + eventos + plan en una transacción). Regla de negocio: sobrante ≤ 10 cm = merma (se desecha); está aplicada en el optimizador, en la vista del historial y en los Excel.
- **Edge Functions**: `supabase/functions/agente-playground` (agente IA del panel admin; usa `ANTHROPIC_API_KEY`, CORS restringido por `ALLOWED_ORIGINS`).

## Estructura

```
src/
  lib/            auth, supabase, roles (permisos), marca, sentry
  components/     TopBar, ProtectedRoute, LegacyFrame, admin/*, ui/*
  modules/        lógica de negocio (cotizador, ots, leads, planes-corte, admin)
  pages/          una carpeta/archivo por ruta
public/legacy/    optimizador.html (generador del plan de corte)
supabase/functions/  edge functions (Deno)
sql/              historial de migraciones y scripts aplicados (documentación)
docs/             guía de instalación y manual de usuario
```

## Variables de entorno

Ver `.env.example`. Las `VITE_*` se exponen al navegador; `SUPABASE_SERVICE_ROLE_KEY` jamás debe usarse en el frontend.

## Despliegue

Push a `main` → Vercel construye y despliega (config en `vercel.json`: SPA rewrites, headers de seguridad, no-store para `/legacy/*.html`). Tras cambios en el optimizador legacy, subir la versión mínima en **Admin → Forzar actualización** para que los navegadores del taller recarguen. Edge functions se despliegan con `supabase functions deploy agente-playground`.

Guías completas: [docs/INSTALACION.md](docs/INSTALACION.md) (instancia nueva / empresa nueva) y [docs/MANUAL_USUARIO.md](docs/MANUAL_USUARIO.md) (operación diaria).
