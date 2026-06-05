## 1. Preparación

- [x] 1.1 Correr `npx tsc --noEmit --skipLibCheck` y verificar 0 errores de partida. Si hay errores, abortar este change y arreglarlos en un change separado primero.
- [x] 1.2 Auditar imports externos: correr `grep -rn "inventario-telas-prueba" src/` desde la raíz y registrar la lista de archivos que importan algo del módulo. Confirmar que solo `App.tsx` y `Landing.tsx` lo hacen.
- [ ] 1.3 Hacer commit del estado inicial con tag implícito ("antes del refactor inventario-telas") para tener un punto de rollback claro.

## 2. Pasada 1 — Utils puros

- [x] 2.1 Crear carpeta `src/pages/inventario-telas-prueba/utils/`.
- [x] 2.2 Crear `utils/inventario-mappers.ts` con las funciones `rolloDBToItem`, `movDBToEntry`, `perfilDBToProfile` movidas desde `useInventarioSupabase.ts`.
- [x] 2.3 Crear `utils/stock-bar.ts` con la función `calcMaxMeters(item)` que centraliza el cálculo de `Math.max(item.metrosOriginales, item.totalMetros, item.rollos * item.metros, 30)`.
- [x] 2.4 Actualizar imports en `useInventarioSupabase.ts` y en `ProductTable.tsx` para usar los utils nuevos.
- [x] 2.5 Correr `npx tsc --noEmit --skipLibCheck` y verificar 0 errores. Commit.

## 3. Pasada 2 — Split del hook gigante

- [x] 3.1 Crear carpeta `src/pages/inventario-telas-prueba/hooks/`.
- [x] 3.2 Mover `usePermisoInventario` a `hooks/usePermisoInventario.ts`. Re-exportar desde el archivo original si hace falta para no romper imports temporalmente.
- [x] 3.3 Crear `hooks/useInventarioData.ts` con: estado (`items`, `historyLogs`, `loading`, `rollosRaw`) + `refresh()`. Solo lecturas. (El estado `profile` se movió a `usePerfilEmpresa` para mantener un dominio por hook).
- [x] 3.4 Crear `hooks/useInventarioMutations.ts` con: `ajustarStock`, `editarStockAsignado`, `agregarRollo`, `eliminarRollo`, `reiniciarInventario`, `borrarMovimiento`. Recibe `empresaId`, `rollosRaw`, `refresh` por parámetro.
- [x] 3.5 Crear `hooks/useImagenStorage.ts` con `subirImagen(file, tipo)`.
- [x] 3.6 Crear `hooks/usePerfilEmpresa.ts` con estado `profile` + `loading` + `guardarPerfil(newProfile)`. Absorbe el estado de profile que antes vivía en el hook gigante.
- [x] 3.7 `useInventarioSupabase.ts` convertido a stub re-export (el filesystem no permitió delete; queda marcado como DEPRECATED para borrar en limpieza manual).
- [x] 3.8 Ajustar `Pagina.tsx` para componer los 5 hooks. Se mantiene un objeto `data` con la misma forma para no tocar el resto del componente.
- [x] 3.9 Correr `npx tsc --noEmit --skipLibCheck` y verificar 0 errores. Commit.

## 4. Pasada 3 — Mover modales

- [x] 4.1 Crear carpeta `src/pages/inventario-telas-prueba/components/modals/`.
- [x] 4.2 Copiar `AdjustStockModal.tsx`, `EditStockModal.tsx` y `AddProductModal.tsx` a esa carpeta (FS no permite move/delete, los originales quedan como re-export stubs para limpieza manual). Ajustar imports relativos (`../types` → `../../types`).
- [x] 4.3 Actualizar imports en `Pagina.tsx` para apuntar a `./components/modals/...`.
- [x] 4.4 Correr `npx tsc --noEmit --skipLibCheck` y verificar 0 errores. Commit.

## 5. Pasada 3 — Subdividir ProductTable

- [x] 5.1 Crear carpeta `src/pages/inventario-telas-prueba/components/product-table/`.
- [x] 5.2 Extraer la barra superior + filtros a `TableFilters.tsx` (177 líneas). También agrego props `totalItems` y `itemsByCategoryCount` para que el componente sea puro.
- [x] 5.3 Extraer la fila individual a `ProductRow.tsx` (157 líneas).
- [x] 5.4 Extraer la barra de progreso a `StockBar.tsx` (39 líneas). Usa `calcMaxMeters` y `calcStockPercent` del utils.
- [x] 5.5 Crear `components/product-table/ProductTable.tsx` (215 líneas) como orquestador. El viejo queda como re-export stub.
- [x] 5.6 Actualizar imports en `Pagina.tsx`.
- [x] 5.7 Correr `npx tsc --noEmit --skipLibCheck` y verificar 0 errores. Commit.

## 6. Pasada 3 — Subdividir CompanyProfilePanel

- [x] 6.1 Crear carpeta `src/pages/inventario-telas-prueba/components/company-profile/`.
- [x] 6.2 Extraer banner+overlay a `BannerUploader.tsx` (84 líneas). El ref del input vive ahora adentro del componente.
- [x] 6.3 Extraer logo+overlay a `LogoUploader.tsx` (89 líneas).
- [x] 6.4 Extraer formulario de edición a `CompanyProfileForm.tsx` (151 líneas) incluyendo helper interno `FieldInput`.
- [x] 6.5 Extraer vista estática (cards de Instagram/Web/Dirección) a `StaticProfileView.tsx` (78 líneas) — no estaba en el plan original pero conviene tenerla aparte para mantener el orquestador chico.
- [x] 6.6 Crear `components/company-profile/CompanyProfilePanel.tsx` (158 líneas) como orquestador. El viejo queda como re-export stub.
- [x] 6.7 Correr `npx tsc --noEmit --skipLibCheck` y verificar 0 errores. Commit.

## 7. Pasada 4 — Adelgazar Pagina.tsx

- [x] 7.1 Extraer:
  - `hooks/useNotification.ts` (30 líneas) — banner inline
  - `hooks/useInventarioHandlers.ts` (176 líneas) — los 8 handlers con try/catch + notificaciones
  - `components/ModuleHeader.tsx` (80 líneas) — header con logo + tabs + salir
  - `utils/export-csv.ts` (39 líneas) — exportInventarioCSV
- [x] 7.2 Reescribir `Pagina.tsx` como orquestador puro. Quedó en 209 líneas (objetivo era ~150 pero la lógica de gates + composición + JSX de modales no baja de eso sin perder claridad).
- [x] 7.3 Correr `npx tsc --noEmit --skipLibCheck` y verificar 0 errores. Commit.

## 8. Documentación

- [x] 8.1 Crear `src/pages/inventario-telas-prueba/README.md` con: descripción del módulo, mapa de estructura, reglas del módulo, lista de stubs deprecated.
- [x] 8.2 Commit.

## 9. Verificación funcional manual

- [x] 9.1 Levantar `npm run dev` y abrir `/inventario-telas-prueba` con un usuario `admin` (ej. `cortinasrolzzo@hotmail.com`). Verificar que la página carga sin errores en consola.
- [x] 9.2 Probar **descontar stock** en un rollo cualquiera. Verificar que el total baja y aparece movimiento en el historial.
- [x] 9.3 Probar **sumar stock** en el mismo rollo (devolver lo descontado). Verificar que el total vuelve al valor original.
- [x] 9.4 Probar **editar stock asignado** (solo admin): cambiar rollos y metros, guardar, verificar que se reflejan.
- [x] 9.5 Probar **agregar nuevo producto** desde el botón "Nuevo Item". Verificar que aparece en la lista.
- [x] 9.6 Probar **eliminar producto** (con confirm) y verificar que desaparece de la lista pero queda historial.
- [x] 9.7 Probar **subir logo y banner** desde el tab Empresa. Verificar que se guardan en Storage y se muestran.
- [x] 9.8 Probar **reiniciar inventario** (solo admin): confirmar el diálogo, verificar que todos los `total_metros` vuelven a `metros_originales` y aparece un movimiento `[RESET]` por rollo en el historial.
- [x] 9.9 Verificar que **un usuario sin permiso** (probar con un email no listado en `inv_permisos`) ve la pantalla "Acceso restringido" y NO puede entrar.
- [x] 9.10 Verificar que **la barra de stock** muestra el descenso real (ej. Cenefa Ovalada con 52/72m debe mostrarse al ~72%, no al 100%).

## 10. Cierre

- [x] 10.1 Auditar tamaño de archivos: máximo 284 líneas (AddProductModal). Ningún archivo del módulo supera 400 ✅.
- [x] 10.2 `npx tsc --noEmit --skipLibCheck` → 0 errores ✅.
- [x] 10.3 `App.tsx` sigue importando `Pagina` exactamente 