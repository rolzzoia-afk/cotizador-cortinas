# Propuesta: Modularizar `src/pages/Inteligencia.tsx`

## Why

`src/pages/Inteligencia.tsx` tiene **1813 líneas** y contiene 20 funciones internas + 5 tipos + 3 constantes + 6 utils de formato + un helper grande de generación de texto (`generarTextoDiag`, ~140 líneas) en un solo archivo. La pantalla muestra 9 cards distintas, cada una con su propia lógica de visualización, todas declaradas inline en el mismo archivo.

El archivo viola el límite establecido de ≤400 líneas por archivo. Las 9 cards son independientes entre sí (cada una recibe slices de datos por props), lo que hace este refactor especialmente limpio: cada card sale a su archivo sin tocar la lógica de las otras.

Es una pantalla de **analytics / inteligencia** (panel de KPIs e insights agregados). No muta datos — solo lee 6 tablas de Supabase y derive memos. Riesgo de refactor: bajo. Solo un consumidor: `src/App.tsx` la importa como `lazy(() => import('@/pages/Inteligencia').then((m) => ({ default: m.Inteligencia })))`.

## What Changes

- Crear `src/pages/inteligencia/` con subcarpetas `components/`, `cards/`, `utils/`, `hooks/`.
- Extraer los 5 tipos a `Inteligencia.types.ts` (`OT`, `Insumo`, `Mov`, `Rack`, `ErrorCorte`).
- Extraer las constantes (`ESTADOS_ACTIVOS`, `ESTADOS_PRODUCCION`, `COLORES_ERROR`, `CHIPS`) a `Inteligencia.config.ts`.
- Extraer los 6 utils de formato (`fmt`, `diasDesde`, `diasHasta`, `fmtFecha`, `fmtFechaHora`, `dgStr`) a `utils/formato.ts`.
- Extraer `generarTextoDiag` a `utils/generar-texto-diag.ts` (helper de texto, no es React).
- Extraer el hook de carga de datos (las 6 queries Supabase + auto-refresh cada 5 minutos + state) a `hooks/useInteligenciaData.ts`.
- Extraer los 3 componentes hoja compartidos (`GlassCard`, `EmptyState`, `Spinner`) a `components/`.
- Extraer `DiagDialog` (el diálogo de diagnóstico IA) a `components/DiagDialog.tsx`.
- Extraer las **9 cards** a `cards/`: `KPICard`, `CrossAlertsCard`, `OTRiskCard`, `ConsumoCard`, `ErroresCorteCard`, `RestockCard`, `ActivityCard`, `InsightsCard`, `StockGeneralCard`.
- Adelgazar `src/pages/Inteligencia.tsx` a un orquestador ≤150 líneas que: lee `useInteligenciaData()`, deriva los memos de filtrado (otsActivas, otsProduccion, stockBajo, otsSinMov, salidas, consumoMap, summaryParts) y compone los 9 cards en su grid.

## ¿Qué NO cambia?

- `src/App.tsx` (sigue importando `{ Inteligencia }` desde `@/pages/Inteligencia`).
- Las queries a Supabase (siguen idénticas, solo cambian de archivo).
- El intervalo de auto-refresh (5 minutos) y el comportamiento de "Actualizar" manual.
- El layout: header sticky + summary banner + 4 KPIs + filas de cards (idéntico).
- Las tablas de Supabase consultadas (`ots`, `insumos`, `movimientos_insumos`, `ubicaciones_rack`, `errores_corte`).

## Impacto

- **Specs afectadas**: nueva spec `inteligencia-frontend`.
- **Código afectado**: solo `src/pages/Inteligencia.tsx` se reescribe y se crean ~17 archivos nuevos bajo `src/pages/inteligencia/`.
- **Tests**: no hay tests automatizados (no rompemos suite). Verificación es manual: abrir la pantalla y confirmar que las 9 cards muestran los mismos datos que hoy.
- **Riesgo**: bajo. Sin escrituras. Pantalla de analytics — si algo se rompe se ve mal una métrica, no afecta operación del taller.
