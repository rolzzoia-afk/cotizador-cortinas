# Guía de instalación

Dos escenarios distintos. El A es el normal; el B es para montar una instancia separada (white-label u otro país).

---

## A) Dar de alta una EMPRESA nueva (mismo sistema, 10 minutos)

El sistema es multi-empresa: no hay que instalar nada. Cada empresa nueva vive aislada por RLS en la misma base.

1. **Registro**: la persona dueña entra a `/registro`, pone nombre de empresa, su nombre, email y contraseña. Esto crea el tenant (plan `trial`) y su perfil como `admin` vía la RPC `registrar_tenant`.
2. **Confirmación de email** (si está activada en Supabase Auth): revisa su correo y luego inicia sesión.
3. **Setup inicial**: la app la lleva a `/setup` para la configuración básica.
4. **Catálogo y precios**: en **Admin → Parámetros de cotización** ajusta IVA, márgenes y costos. El catálogo de productos y anchos de rollo se cargan en la tabla `configuracion` (claves `catalogo_productos_data` y `ancho_rollo_data`).
5. **Equipo**: cada integrante se registra con su email; el admin les asigna rol en **Admin → Usuarios y roles**. Importante: un usuario recién registrado por `/registro` crea SU PROPIA empresa — para sumar gente a una empresa existente, hoy hay que crear el usuario en Supabase Auth y asignarle perfil/empresa desde la BD o pedirlo al soporte (mejora pendiente: flujo de invitaciones).
6. **Inventario base**: cargar el conteo físico de tubos en **Admin → Cargar inventario base desde Excel**.

## B) Montar una INSTANCIA nueva desde cero

### 1. Supabase

1. Crear proyecto en [supabase.com](https://supabase.com) (anotar `Project ID`, `anon key`, `service_role key`).
2. Aplicar el esquema: las migraciones aplicadas están registradas en Supabase (Database → Migrations) del proyecto original; para una instancia nueva, exportar el esquema con `supabase db dump --schema-only` desde el proyecto original y aplicarlo al nuevo. La carpeta `sql/` del repo documenta los scripts importantes (seguridad, RBAC, rendimiento).
3. **Auth**: activar Email/Password. Recomendado: activar *Leaked password protection* (Authentication → Settings).
4. **Storage**: crear buckets públicos `fotos-insumos`, `fotos-telas`, `inv-empresa-assets` (las políticas vienen en el esquema; no agregar políticas de listado público).
5. **Edge function**:
   ```bash
   supabase functions deploy agente-playground --project-ref <PROJECT_ID>
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-... ALLOWED_ORIGINS=https://tudominio.com,https://www.tudominio.com
   ```

### 2. Vercel

1. Importar el repo de GitHub en Vercel (framework: Vite; la config ya está en `vercel.json`).
2. Variables de entorno (Settings → Environment Variables):

   | Variable | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://<PROJECT_ID>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | anon key del proyecto |
   | `VITE_APP_NAME` | nombre comercial del producto (default: Rolzzo) |
   | `VITE_SENTRY_DSN` | DSN de Sentry (vacío = desactivado) |
   | `VITE_APP_VERSION` | SHA de git en CI (`dev` en local) |

3. Conectar el dominio. Si cambia el dominio, actualizar `ALLOWED_ORIGINS` de la edge function.

### 3. Verificación post-instalación

- Registrar una empresa de prueba en `/registro` y completar el setup.
- Probar: cotizar (Fase 0), crear OT, abrir el Optimizador, guardar un plan, verlo en Historial de Corte, descargar el Excel (debe traer CORRELATIVO).
- En Supabase, correr los *Advisors* (Database → Advisors): seguridad debería estar limpio salvo `registrar_tenant` abierta a `anon` (intencional).

### 4. Mantenimiento

- **Cambios en el optimizador legacy**: tras cada deploy, subir versión mínima en **Admin → Forzar actualización** (recarga los navegadores del taller).
- **Tipos de BD**: tras cambios de esquema, `npm run types:gen`.
- **Respaldos**: Supabase hace backups automáticos; los respaldos manuales históricos viven en el esquema `archivo` de la BD.
