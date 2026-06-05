# Propuesta: Modularizar `src/pages/Ventas.tsx`

## Why

`src/pages/Ventas.tsx` tiene **1228 líneas** y contiene: 3 tipos de dominio, 2 constantes, 4 helpers puros, 4 componentes de UI compartidos, 1 diálogo de configuración (~160 líneas) y el orquestador con 5-6 secciones grandes (Canales, Llamadas, Meta Visitas, Cierre, Terreno, Historial) renderizadas inline.

El archivo viola el límite de ≤400 líneas. Las 6 secciones son independientes (cada una con su layout propio) y se prestan a extracción limpia. Es una pantalla de dashboard de ventas (KPIs diarios) — riesgo bajo: solo lectura + upsert simple a `kpi_config` y `kpi_registros`. Si algo se rompe, se ven mal los KPIs, no afecta la operación del taller.

Solo un consumidor: `src/App.tsx` la importa como `lazy(() => import('@/pages/Ventas').then((m) => ({ default: m.Ventas })))`.

## What Changes

- Crear `src/pages/ventas/` con subcarpetas `components/`, `secciones/`, `utils/`.
- Extraer los 3 tipos (`KpiConfig`, `Periodo`, `Registro`) a `Ventas.types.ts`.
- Extraer las constantes (`DEFAULT_CONFIG`, `CANAL_COLORS`) a `Ventas.config.ts`.
- Extraer los 4 helpers (`hoyISO`, `slugify`, `iniciales`, `colorPct`) a `utils/helpers.ts`.
- Extraer los 4 componentes de UI compartidos: `SectionHeader`, `Gauge`, `NumInput`, `ChipList` a `components/`.
- Extraer `ConfigDialog` a `components/ConfigDialog.tsx`.
- Extraer las **6 secciones** del dashboard a `secciones/`: `CanalesSection`, `LlamadasSection`, `MetaVisitasSection`, `CierreSection`, `TerrenoSection`, `HistorialSection`.
- Adelgazar `src/pages/Ventas.tsx` a un orquestador ≤250 líneas que: lee config + registros + historial vía Supabase, deriva los memos (totales, charts, terrenoData, valores de cierre) y compone las 6 secciones en su grid.

## ¿Qué NO cambia?

- `src/App.tsx` (sigue importando `{ Ventas }` desde `@/pages/Ventas`).
- Las queries/mutations a Supabase (siguen idénticas).
- El comportamiento de guardado, configuración, periodo, cambio de fecha.
- Las tablas consultadas: `kpi_config`, `kpi_registros`.

## Impacto

- **Specs afectadas**: nueva spec `ventas-frontend`.
- **Código afectado**: solo `src/pages/Ventas.tsx` se reescribe y se crean ~15 archivos nuevos bajo `src/pages/ventas/`.
- **Tests**: no hay tests automatizados. Verificación es manual: abrir `/ventas`, modificar un par de valores, guardar, recargar, cambiar de período.
- **Riesgo**: bajo. Pantalla de KPI sin impacto en producción/operación.
