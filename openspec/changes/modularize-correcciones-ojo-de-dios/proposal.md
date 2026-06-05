## Why

`src/components/ojo-de-dios/Correcciones.tsx` tiene 1.198 líneas y reúne 8 funciones React internas con responsabilidades muy distintas (semáforo de salud, config del optimizador, plan activo, corrección retroactiva, editor de línea, historial de correcciones, historial de planes, hint). Cada vez que tocamos una parte, el linter de Cowork tiene historial de truncar el archivo entero — ya nos pasó al menos 4 veces en sesiones previas. El módulo es **crítico para el taller**: es donde el operario resuelve errores de planes y restaura colmena. Necesitamos modularizarlo aplicando el mismo patrón establecido en `inventario-telas-frontend` para que cada sección sea editable de forma aislada.

## What Changes

- Crear una nueva carpeta `src/components/ojo-de-dios/correcciones/` que contenga las 8 funciones internas como archivos propios.
- Reducir `Correcciones.tsx` (1.198 líneas) a un orquestador chico (~70 líneas) que solo: importa, monta el `SaludColmenaWidget`, llama los hooks de `usePlanActivo`, `useCorreccionesHistorial`, `usePlanesHistorial`, y compone las 5 secciones más el hint.
- Extraer la función auxiliar `extraerOTsPlan` (helper puro, líneas 46-58) a `correcciones/utils/extraer-ots-plan.ts`.
- **NO BREAKING**: el componente `Correcciones` sigue siendo el `export function Correcciones` que importa `OjoDeDios.tsx`. La API externa queda idéntica.

## Capabilities

### New Capabilities

- `correcciones-ojo-de-dios-frontend`: arquitectura del módulo de Correcciones dentro de Ojo de Dios. Define la organización en subcomponentes por sección, el límite de líneas por archivo, y la separación entre el orquestador y los widgets.

### Modified Capabilities

(ninguna)

## Impact

- **Código afectado**: solo `src/components/ojo-de-dios/Correcciones.tsx` y los archivos nuevos bajo `src/components/ojo-de-dios/correcciones/`. No se toca el módulo admin (`src/modules/admin/correcciones.ts`) que provee los hooks.
- **Imports externos**: el único consumidor es `src/pages/OjoDeDios.tsx` que importa `{ Correcciones }` desde el path actual. Ese import se mantiene.
- **TS check**: el proyecto debe seguir compilando con 0 errores en `npx tsc --noEmit --skipLibCheck`. Criterio de aceptación principal.
- **Comportamiento usuario final**: cero cambios visibles. La pestaña Ojo de Dios → Correcciones debe verse y funcionar idéntica antes y después.
- **Sin dependencias nuevas**: no se agrega ninguna librería ni se cambia versión de las existentes.
- **Riesgo**: bajo-medio. El módulo lo usa el taller para resolver errores, pero las funciones internas ya están bien delimitadas — el riesgo está en perder algún import o estado durante el split. Mitigado por hacer una pasada por función con `tsc` verde entre cada paso.
