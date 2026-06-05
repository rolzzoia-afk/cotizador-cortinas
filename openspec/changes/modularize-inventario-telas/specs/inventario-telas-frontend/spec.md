## ADDED Requirements

### Requirement: Tamaño máximo de archivo

Todo archivo `.ts` o `.tsx` dentro de `src/pages/inventario-telas-prueba/` (excluyendo `types.ts` y archivos de seed/datos iniciales) SHALL tener un máximo de 400 líneas de código.

#### Scenario: Verificación de tamaño con wc -l

- **WHEN** se corre `find src/pages/inventario-telas-prueba -name "*.ts" -o -name "*.tsx" | grep -v "types.ts" | grep -v "data/" | xargs wc -l`
- **THEN** ningún archivo de la lista (excluyendo el total) supera las 400 líneas

#### Scenario: Archivo cercano al límite

- **WHEN** un archivo del módulo se acerca al límite (>350 líneas) por crecimiento natural
- **THEN** el archivo SHALL ser subdividido antes de superar las 400 líneas, en el mismo PR que introduce el crecimiento

### Requirement: Organización por dominio en components/

Los componentes del módulo SHALL estar organizados en subcarpetas dentro de `components/` agrupadas por dominio funcional, no por tipo de archivo. Las subcarpetas mínimas requeridas son `modals/`, `product-table/` y `company-profile/`.

#### Scenario: Inspección de la estructura

- **WHEN** se inspecciona `src/pages/inventario-telas-prueba/components/`
- **THEN** existen las subcarpetas `modals/`, `product-table/` y `company-profile/`
- **THEN** los archivos `AdjustStockModal.tsx`, `EditStockModal.tsx` y `AddProductModal.tsx` viven en `components/modals/`
- **THEN** `ProductTable.tsx` vive en `components/product-table/` junto a sus componentes acompañantes (`TableFilters.tsx`, `ProductRow.tsx`, `StockBar.tsx`)
- **THEN** `CompanyProfilePanel.tsx` vive en `components/company-profile/` junto a sus componentes acompañantes (`LogoUploader.tsx`, `BannerUploader.tsx`, `CompanyProfileForm.tsx`)

### Requirement: Separación de hooks por responsabilidad

La lógica de datos del módulo SHALL estar dividida en hooks separados por responsabilidad. No SHALL existir un único hook que combine queries, mutations, storage de archivos y gestión de perfil empresa.

#### Scenario: Inspección de hooks/

- **WHEN** se inspecciona `src/pages/inventario-telas-prueba/hooks/`
- **THEN** existen al menos los archivos `usePermisoInventario.ts`, `useInventarioData.ts`, `useInventarioMutations.ts`, `useImagenStorage.ts` y `usePerfilEmpresa.ts`
- **THEN** ningún archivo de `hooks/` supera las 250 líneas

#### Scenario: useInventarioData solo lee

- **WHEN** se inspecciona el contenido de `useInventarioData.ts`
- **THEN** el hook contiene únicamente queries (`SELECT`) y refresh, sin operaciones de escritura (`INSERT`, `UPDATE`, `DELETE`)

#### Scenario: useInventarioMutations solo escribe

- **WHEN** se inspecciona el contenido de `useInventarioMutations.ts`
- **THEN** el hook contiene únicamente operaciones de escritura sobre `inv_rollos` e `inv_movimientos`, y no contiene queries de lectura standalone (excepto las necesarias internamente para mutations)

### Requirement: Utils puros separados de la UI

Las funciones puras (mappers DB→UI, cálculos auxiliares) SHALL vivir en `utils/`, NO dentro de componentes ni de hooks.

#### Scenario: Mappers en utils

- **WHEN** se inspecciona `src/pages/inventario-telas-prueba/utils/inventario-mappers.ts`
- **THEN** el archivo exporta las funciones `rolloDBToItem`, `movDBToEntry`, `perfilDBToProfile`

#### Scenario: Cálculo de barra de stock

- **WHEN** se inspecciona `src/pages/inventario-telas-prueba/utils/stock-bar.ts`
- **THEN** el archivo exporta una función `calcMaxMeters(item)` que recibe un `InventoryItem` y devuelve el valor numérico usado como denominador de la barra de progreso (que respeta `metrosOriginales`)

### Requirement: Comportamiento del módulo sin regresiones

El refactor SHALL preservar exactamente el comportamiento funcional del módulo. Cualquier acción que un usuario podía hacer antes del refactor, debe seguir funcionando idénticamente después.

#### Scenario: Permiso de acceso

- **WHEN** un usuario con email en `inv_permisos` activo abre `/inventario-telas-prueba`
- **THEN** entra al módulo y ve la lista de productos
- **WHEN** un usuario sin permiso intenta acceder
- **THEN** ve la pantalla "Acceso restringido" con el botón "Volver al inicio"

#### Scenario: Descontar stock

- **WHEN** un usuario aprieta el botón rojo "Descontar" en una fila
- **THEN** se abre `AdjustStockModal` con `actionType = 'DESCUENTO'` preseleccionado
- **WHEN** ingresa cantidad, comentario y confirma
- **THEN** `inv_rollos.total_metros` y `inv_rollos.rollos` se actualizan en Supabase, y se crea un movimiento `INCREMENTO`/`DESCUENTO` en `inv_movimientos`

#### Scenario: Sumar stock

- **WHEN** un usuario aprieta el botón verde "Sumar" en una fila
- **THEN** se abre `AdjustStockModal` con `actionType = 'INCREMENTO'` preseleccionado

#### Scenario: Editar stock asignado (solo admin)

- **WHEN** un usuario con rol `admin` aprieta el ícono ✏ ámbar en una fila
- **THEN** se abre `EditStockModal`
- **WHEN** modifica rollos, metros por rollo y/o total, ingresa comentario y guarda
- **THEN** `inv_rollos` se actualiza y se crea un movimiento `EDICION_STOCK` con `metros_originales` también actualizado al nuevo total

#### Scenario: Agregar nuevo producto

- **WHEN** un usuario aprieta "Nuevo Item" en la barra superior
- **THEN** se abre `AddProductModal`
- **WHEN** completa los campos y guarda
- **THEN** se inserta una fila en `inv_rollos` con `metros_originales = total_metros`

#### Scenario: Reiniciar inventario (solo admin)

- **WHEN** un usuario con rol `admin` aprieta "Reiniciar Inventario", confirma el diálogo
- **THEN** todos los rollos vuelven a `total_metros = metros_originales` y se registra un movimiento `INCREMENTO` con comentario que empieza con `[RESET]` por cada rollo afectado

#### Scenario: Subir logo o banner

- **WHEN** un usuario con permiso de edición arrastra una imagen al cuadro de logo o banner
- **THEN** la imagen se sube al bucket `inv-empresa-assets` con path `<empresa_id>/<tipo>-<timestamp>.<ext>`, se actualiza `inv_empresa_perfil.logo_url` o `banner_url`, y la imagen se ve en la pantalla

#### Scenario: Barra de stock refleja el descenso real

- **WHEN** un rollo tiene `total_metros = 52` y `metros_originales = 72`
- **THEN** la barra se muestra con `stockPercent ≈ 72%` (52/72) y el texto `52 / 72m`

### Requirement: Compatibilidad de API externa

El módulo SHALL exponer el mismo punto de entrada que antes del refactor: `Pagina.tsx` como `default export`, importado lazy desde `src/App.tsx` en la ruta `/inventario-telas-prueba`.

#### Scenario: Import desde App.tsx

- **WHEN** se inspecciona `src/App.tsx`
- **THEN** existe `const InventarioTelasPrueba = lazy(() => import('@/pages/inventario-telas-prueba/Pagina'))`
- **THEN** existe `<Route path="/inventario-telas-prueba" element={<ProtectedRoute><InventarioTelasPrueba /></ProtectedRoute>} />`
- **THEN** ese import y esa ruta no cambian respecto del estado pre-refactor

### Requirement: TypeScript sin errores

El proyecto SHALL compilar sin errores con `npx tsc --noEmit --skipLibCheck` después del refactor.

#### Scenario: Verificación con tsc

- **WHEN** se ejecuta `npx tsc --noEmit --skipLibCheck` desde la raíz del proyecto
- **THEN** el comando devuelve exit code 0 y no imprime errores `error TS*`

### Requirement: Documentación de la estructura

El módulo SHALL tener un archivo `README.md` en `src/pages/inventario-telas-prueba/` que documente brevemente la estructura de carpetas y el propósito de cada subdirectorio.

#### Scenario: Verificación del README

- **WHEN** se inspecciona `src/pages/inventario-telas-prueba/README.md`
- **THEN** el archivo existe
- **THEN** el archivo contiene una sección que lista cada subcarpeta (`hooks/`, `utils/`, `components/modals/`, `components/product-table/`, `components/company-profile/`) con una descripción de qué vive ahí
