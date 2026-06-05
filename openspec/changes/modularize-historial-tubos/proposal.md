# Propuesta: Modularizar `src/pages/HistorialTubos.tsx`

## ¿Por qué?

`src/pages/HistorialTubos.tsx` tiene **1235 líneas** y contiene 11 funciones internas dentro de un solo archivo: el `export function HistorialTubos()` orquestador, 3 vistas pesadas (Trazabilidad, Historial, Merma) y 7 helpers (TabButton, FichaCard, FichaSeccion, EventoItem, StatBox, EmptyState). Además declara 2 tipos (`Evento`, `EvCfg`) y 3 constantes de configuración (`EV`, `FUENTE_CFG`, `PALETA`) y 2 utils de formateo de fechas (`formatFechaHora`, `formatMes`).

El archivo viola el límite establecido de ≤400 líneas por archivo y mezcla 3 vistas independientes que no comparten estado entre sí.

Es una pantalla de **consulta de solo lectura** (no muta nada): riesgo de refactor bajo. Solo un consumidor: `src/App.tsx` la importa como `lazy(() => import('@/pages/HistorialTubos').then((m) => ({ default: m.HistorialTubos })))`.

## ¿Qué cambia?

- Crear `src/pages/historial-tubos/` con subcarpetas `components/`, `vistas/`, `utils/`.
- Extraer las 3 vistas grandes a archivos propios: `vistas/VistaTrazabilidad.tsx`, `vistas/VistaHistorial.tsx`, `vistas/VistaMerma.tsx`.
- Extraer los 7 helpers de UI: `components/TabButton.tsx`, `components/FichaCard.tsx`, `components/FichaSeccion.tsx`, `components/EventoItem.tsx`, `components/StatBox.tsx`, `components/EmptyState.tsx`.
- Extraer los tipos a `HistorialTubos.types.ts`.
- Extraer las constantes a `HistorialTubos.config.ts`.
- Extraer los helpers de formato a `utils/formato-fechas.ts`.
- Adelgazar `src/pages/HistorialTubos.tsx` a un orquestador ≤80 líneas que solo maneja el estado del tab activo (`'trazabilidad' | 'historial' | 'merma'`) y compone las 3 vistas.

El comportamiento externo (las 3 pestañas con su contenido idéntico) no cambia. `src/App.tsx` no necesita modificarse: el archivo principal mantiene el mismo path y el mismo `export function HistorialTubos`.

## ¿Qué NO cambia?

- `src/App.tsx` (sigue importando `{ HistorialTubos }` desde `@/pages/HistorialTubos`).
- Las queries a Supabase (siguen idénticas, solo cambia de archivo dónde viven).
- El comportamiento visual de cada vista (mismas tablas, mismos charts, mismos filtros).
- Las tablas de Supabase consultadas (`eventos_tubos`, `lotes_tubos`).

## Impacto

- **Specs afectadas**: nueva spec `historial-tubos-frontend`.
- **Código afectado**: solo `src/pages/HistorialTubos.tsx` se reescribe y se crean ~14 archivos nuevos bajo `src/pages/historial-tubos/`.
- **Tests**: no hay tests automatizados de este archivo (no rompemos suite). Verificación es manual: abrir las 3 pestañas y confirmar que cada una muestra los mismos datos que hoy.
- **Riesgo**: bajo. Sin escrituras. Si algo falla solo se ve roto en pantalla, no corrompe datos.
