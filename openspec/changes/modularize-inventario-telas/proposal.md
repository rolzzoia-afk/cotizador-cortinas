## Why

Los componentes del módulo `src/pages/inventario-telas-prueba/` son archivos grandes (entre 170 y 530 líneas cada uno, varios cerca o por encima de las 400) que el linter de Cowork ha truncado al menos seis veces en sesiones recientes, obligando a reparaciones manuales con scripts Python y dejando código en estados inconsistentes durante minutos. Cada vez que se intenta arreglar algo, hay riesgo de romper otra parte del mismo archivo. Modularizar este módulo ahora — antes de que crezca más — elimina la fuente principal de truncamientos y establece un patrón replicable para refactores posteriores (Correcciones.tsx, Telas.tsx, etc.).

## What Changes

- Dividir cada componente grande en piezas cohesivas más chicas (objetivo: ningún archivo de UI superior a 400 líneas).
- Extraer los modales a una subcarpeta `components/modals/` (AdjustStockModal, EditStockModal, AddProductModal).
- Romper `CompanyProfilePanel.tsx` en panel + uploaders (logo, banner) + form de edición.
- Romper `ProductTable.tsx` en tabla + filtros + fila individual + barra de stock.
- Extraer toda la lógica no-UI del hook gigante `useInventarioSupabase.ts` en archivos por dominio: `useInventarioData`, `useInventarioMutations`, `useInventarioPermisos`, plus mappers puros en `inventario-mappers.ts`.
- Mantener una única ruta pública del módulo (`/inventario-telas-prueba`) y un único componente `Pagina.tsx` como entry-point con responsabilidad reducida.
- Mover utilidades puras (cálculo de máximos para barra, formateo) a un `inventario-utils.ts` con sus tests unitarios.
- **NO BREAKING**: No cambian rutas, props públicas de los componentes que importa el resto de la app, ni schemas de Supabase. Tampoco cambian permisos, comportamiento visible, o flujo del usuario final.

## Capabilities

### New Capabilities

- `inventario-telas-frontend`: arquitectura de componentes y hooks del módulo de inventario de telas para CyberDay y vendedores en terreno. Define la estructura modular esperada (organización por carpetas, límite de líneas por archivo, separación entre data hooks y componentes de presentación, ubicación de modales).

### Modified Capabilities

(ninguna — este es el primer change formal del proyecto, así que no hay specs existentes para modificar)

## Impact

- **Código afectado**: solo `src/pages/inventario-telas-prueba/` y sus subdirectorios. No se tocan otros módulos, ni `src/components/`, ni el optimizador legacy, ni la BD Supabase.
- **Imports externos**: el resto de la app importa el módulo solo vía `import('@/pages/inventario-telas-prueba/Pagina')` (lazy load en `App.tsx`). Esa puerta de entrada se mantiene idéntica.
- **TS check**: el proyecto debe seguir compilando con 0 errores en `npx tsc --noEmit --skipLibCheck`. Es el criterio de aceptación principal.
- **Comportamiento usuario final**: cero cambios visibles. La página debe verse y funcionar idéntica antes y después del refactor.
- **Sin dependencias nuevas**: no se agrega ninguna librería ni se cambia versión de las existentes.
- **Riesgo**: bajo. El módulo está aislado (ruta propia, sin TopBar, fuera del Shell principal). Si se rompe, no afecta al taller, ventas, optimizador ni cualquier otra parte de la operación.
