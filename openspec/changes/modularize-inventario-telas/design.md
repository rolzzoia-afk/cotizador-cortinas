## Context

El módulo `src/pages/inventario-telas-prueba/` fue construido en pocas sesiones intensivas y heredó componentes monolíticos: `ProductTable.tsx` (530 líneas), `CompanyProfilePanel.tsx` (420 líneas), `useInventarioSupabase.ts` (380 líneas), entre otros. Durante esas sesiones, el linter de Cowork truncó archivos al menos seis veces al recibir ediciones grandes, dejando código sintácticamente roto y obligando a reconstrucciones manuales con scripts Python.

Hoy el módulo funciona end-to-end (permisos por email, ajuste de stock, edición admin, subida de imágenes a Storage, historial de movimientos) y tiene 4 usuarios activos en producción. El refactor debe ser **invisible para esos usuarios**: cero cambios visibles, cero cambios de comportamiento.

**Restricciones operativas:**

- El módulo tiene su propia ruta (`/inventario-telas-prueba`) fuera del Shell principal y se importa lazy desde `App.tsx`. Esa puerta de entrada es la única superficie pública que ve el resto de la app.
- No se pueden tocar las tablas `inv_rollos`, `inv_movimientos`, `inv_empresa_perfil`, `inv_permisos` ni el bucket `inv-empresa-assets` durante este refactor.
- `npx tsc --noEmit --skipLibCheck` debe pasar con 0 errores al final.

## Goals / Non-Goals

**Goals:**

- Ningún archivo nuevo o existente del módulo supera las 400 líneas.
- Modales aislados en una carpeta dedicada para que el linter no los toque cuando se edita la tabla.
- Lógica de datos (queries, mutations, mappers) separada de la lógica de presentación (JSX, estado de UI).
- Patrón replicable para futuros refactores del proyecto (Correcciones, Telas, Inventario).
- Cero regresiones funcionales: la página se ve y funciona idéntica antes y después.

**Non-Goals:**

- No es objetivo mejorar la UI, agregar features, optimizar performance ni rediseñar el flujo.
- No se tocan otros módulos (Correcciones, Telas, etc.) — esos serán changes propios.
- No se agregan tests automáticos en este change (queda como propuesta para un change futuro: `add-unit-tests-inventario-telas`).
- No se introducen librerías nuevas (zustand, react-query, etc.). Se mantienen los patrones actuales (useState/useEffect + Supabase client).
- No se cambia el schema de Supabase ni se renombran columnas.

## Decisions

### D1. Estructura de carpetas

```
src/pages/inventario-telas-prueba/
├── Pagina.tsx                      ← orquestador (~120 líneas, hoy 290)
├── types.ts                        ← se mantiene
├── data/
│   └── initialInventory.ts         ← se mantiene (legacy seed)
├── hooks/
│   ├── usePermisoInventario.ts     ← split de useInventarioSupabase
│   ├── useInventarioData.ts        ← queries + refresh
│   ├── useInventarioMutations.ts   ← ajustar, editar, agregar, eliminar, reset
│   ├── useImagenStorage.ts         ← subir logo/banner a Storage
│   └── usePerfilEmpresa.ts         ← guardar perfil empresa
├── utils/
│   ├── inventario-mappers.ts       ← rolloDBToItem, movDBToEntry, perfilDBToProfile
│   └── stock-bar.ts                ← cálculo de maxMeters y stockPercent
└── components/
    ├── company-profile/
    │   ├── CompanyProfilePanel.tsx ← orquesta el panel (~150 líneas)
    │   ├── LogoUploader.tsx        ← drag&drop del logo
    │   ├── BannerUploader.tsx      ← drag&drop del banner
    │   └── CompanyProfileForm.tsx  ← form de edición
    ├── product-table/
    │   ├── ProductTable.tsx        ← orquesta tabla + filtros (~180 líneas)
    │   ├── TableFilters.tsx        ← search + chips de categoría
    │   ├── ProductRow.tsx          ← una fila + acciones (Sumar/Descontar/Editar/Eliminar)
    │   └── StockBar.tsx            ← barra de progreso
    ├── modals/
    │   ├── AdjustStockModal.tsx    ← se mueve sin cambios
    │   ├── EditStockModal.tsx      ← se mueve sin cambios
    │   └── AddProductModal.tsx     ← se mueve sin cambios
    ├── HistoryLog.tsx              ← se mantiene
    └── InventoryStats.tsx          ← se mantiene
```

**Por qué esta estructura y no otra:**

- **Por dominio (company-profile, product-table, modals)** en vez de por tipo (todos los .tsx juntos). Cuando vuelva a aparecer un bug en la tabla, todo lo de la tabla está en una sola carpeta y el linter no toca los modales.
- **Subcarpeta dedicada para modales** porque son justamente los componentes que más se editaron junto a otros (cada vez que se modifica el flujo de un modal, también se modifica la tabla que lo abre). Separarlos asegura que un edit en `AdjustStockModal.tsx` no truque `ProductTable.tsx`.
- **`hooks/` y `utils/` siguen la convención que ya usa el resto del proyecto** (ver `src/lib/`, `src/modules/`). Mantiene coherencia.

**Alternativa considerada:** una única subcarpeta `components/` sin agrupar por dominio. Descartada porque mantiene archivos sueltos y no resuelve el problema de "cuando edito uno, el linter toca el de al lado".

### D2. División del hook gigante

El `useInventarioSupabase.ts` actual (380 líneas) hace seis cosas: queries, mutations de stock, edición admin, agregar/eliminar rollos, perfil empresa, storage de imágenes. Se va a partir así:

| Hook nuevo | Qué hace |
|---|---|
| `useInventarioData(empresaId)` | refresh + estado `items`, `historyLogs`, `loading`, `rollosRaw` |
| `useInventarioMutations(empresaId, refresh, rollosRaw)` | `ajustarStock`, `editarStockAsignado`, `agregarRollo`, `eliminarRollo`, `reiniciarInventario`, `borrarMovimiento` |
| `useImagenStorage(empresaId)` | `subirImagen(file, tipo)` |
| `usePerfilEmpresa(empresaId, refresh)` | `guardarPerfil(newProfile)` + estado `profile` |
| `usePermisoInventario()` | sin cambios, ya está aislado |

`Pagina.tsx` los compone:

```tsx
const permiso = usePermisoInventario();
const data = useInventarioData(permiso.empresaId);
const mutations = useInventarioMutations(permiso.empresaId, data.refresh, data.rollosRaw);
const imagen = useImagenStorage(permiso.empresaId);
const perfil = usePerfilEmpresa(permiso.empresaId, data.refresh);
```

**Alternativa considerada:** un solo hook con muchos métodos. Es lo que hay hoy. Descartado porque es la causa raíz de los truncamientos.

### D3. Compatibilidad de API hacia afuera

`Pagina.tsx` sigue siendo el `export default` del módulo, y la ruta `/inventario-telas-prueba` no cambia. El resto de la app no se entera del refactor.

Los hooks `usePermisoInventario` y los tipos en `types.ts` se mantienen exportados desde sus ubicaciones actuales para no romper imports externos (aunque hoy nadie los importa desde fuera del módulo, conviene mantenerlo por las dudas).

### D4. Orden de migración

Se hace en cuatro pasadas pequeñas, cada una con `tsc --noEmit` verde antes de pasar a la siguiente:

1. **Pasada 1 — Utils y mappers puros.** Mover `rolloDBToItem`, `movDBToEntry`, `perfilDBToProfile`, `calcMaxMeters`. Cero riesgo: son funciones puras.
2. **Pasada 2 — Split del hook.** Crear los 4 hooks nuevos y borrar el viejo. Riesgo medio.
3. **Pasada 3 — Componentes (modals → product-table → company-profile).** Mover y subdividir. Riesgo bajo (cada componente es independiente).
4. **Pasada 4 — Reducir Pagina.tsx.** Adelgazar a orquestador puro.

Cada pasada es un commit. Si una rompe algo, se puede revertir sin tocar las anteriores.

## Risks / Trade-offs

- **Riesgo:** el linter trunca un archivo durante el refactor mismo. → **Mitigación:** trabajar con `Edit` puntual (no `Write`) y mantener el `tsc --noEmit` corriendo al lado. Si trunca, restaurar desde el archivo previo (que sigue existiendo hasta el último paso de borrar). Ya tenemos experiencia con esto.
- **Riesgo:** algún componente externo importa algo del módulo que rompemos sin querer. → **Mitigación:** auditar imports con `grep -r "inventario-telas-prueba" src/` antes y después del refactor.
- **Riesgo:** un permiso queda mal después del split del hook (ej. `useImagenStorage` no recibe `empresaId` y crashea en runtime). → **Mitigación:** probar manualmente cada acción (sumar, descontar, agregar, eliminar, editar admin, subir logo, subir banner, reiniciar inventario) antes de cerrar el change.
- **Trade-off:** más archivos = más navegación. Para alguien acostumbrado a un solo archivo gigante, el primer recorrido por la nueva estructura puede ser confuso. → **Mitigación:** dejar un `README.md` corto en la raíz del módulo con el mapa de archivos.

## Migration Plan

1. **Antes de empezar:** correr `npx tsc --noEmit --skipLibCheck` para confirmar 0 errores de partida. Si hay errores previos, abortar el change y abrir uno paralelo para arreglarlos primero.
2. **Cada pasada (1 a 4):** crear archivos nuevos, ajustar imports, correr `tsc`, commit. No borrar el archivo viejo hasta que la pasada esté validada.
3. **Después de la pasada 4:** probar manualmente los 8 flujos de usuario (lista arriba). Si todos pasan, mergear.
4. **Rollback:** si una pasada rompe y no se puede arreglar en el momento, revertir el commit de esa pasada y volver al estado anterior. Las pasadas son independientes.

## Open Questions

- ¿Vale la pena agregar un test smoke ahora (al menos uno que monte `<Pagina />` con mocks de Supabase) o lo dejamos para el change `add-unit-tests-inventario-telas` que se mencionó como Non-Goal? Inclinación inicial: dejarlo para el change separado, pero queda abierto si el usuario prefiere meterlo acá.
- ¿La capacidad `inventario-telas-frontend` debería contener requisitos sobre la estructura de archivos (línea-límite, organización), o solo sobre el comportamiento observable del módulo? Inclinación inicial: ambos, porque "no truncamiento" es justamente una propiedad arquitectural que justifica el change.
