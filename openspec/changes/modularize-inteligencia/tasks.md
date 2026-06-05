# Tareas: Modularizar Inteligencia.tsx

## 1. Preparación

- [ ] 1.1 Correr `npx tsc --noEmit --skipLibCheck` y verificar 0 errores de partida.
- [ ] 1.2 Auditar consumidores: confirmar que solo `src/App.tsx` importa `{ Inteligencia }`.
- [ ] 1.3 Crear las carpetas `src/pages/inteligencia/`, `src/pages/inteligencia/{components,cards,utils,hooks}/`.

## 2. Pasada 1 — Tipos, constantes, utils y `generarTextoDiag`

- [ ] 2.1 Crear `inteligencia/Inteligencia.types.ts` con los 5 tipos (`OT`, `Insumo`, `Mov`, `Rack`, `ErrorCorte`).
- [ ] 2.2 Crear `inteligencia/Inteligencia.config.ts` con `ESTADOS_ACTIVOS`, `ESTADOS_PRODUCCION`, `COLORES_ERROR`, `CHIPS`.
- [ ] 2.3 Crear `inteligencia/utils/formato.ts` con `fmt`, `diasDesde`, `diasHasta`, `fmtFecha`, `fmtFechaHora`, `dgStr`.
- [ ] 2.4 Crear `inteligencia/utils/generar-texto-diag.ts` con la función `generarTextoDiag(ots, insumos, movs, racks): string`.
- [ ] 2.5 Reemplazar las declaraciones inline en `Inteligencia.tsx` por imports.
- [ ] 2.6 `npx tsc --noEmit --skipLibCheck` → 0 errores. Commit.

## 3. Pasada 2 — Hook de carga de datos

- [ ] 3.1 Crear `inteligencia/hooks/useInteligenciaData.ts` que encapsule: state de los 6 datasets + `cargarTodo` + `useEffect` con setInterval cada 5 min. Exporta `useInteligenciaData()`.
- [ ] 3.2 Actualizar `Inteligencia.tsx` para llamar `useInteligenciaData()` en vez de manejar el state directamente.
- [ ] 3.3 `npx tsc --noEmit --skipLibCheck` → 0 errores. Commit.

## 4. Pasada 3 — Componentes hoja compartidos + DiagDialog

- [ ] 4.1 Crear `inteligencia/components/GlassCard.tsx` (~60 líneas).
- [ ] 4.2 Crear `inteligencia/components/EmptyState.tsx` (~15 líneas).
- [ ] 4.3 Crear `inteligencia/components/Spinner.tsx` (~15 líneas).
- [ ] 4.4 Crear `inteligencia/components/DiagDialog.tsx` (~115 líneas). Consume `generarTextoDiag` del util.
- [ ] 4.5 Actualizar `Inteligencia.tsx` para importar los 4 componentes nuevos.
- [ ] 4.6 `npx tsc --noEmit --skipLibCheck` → 0 errores. Commit.

## 5. Pasada 4 — Las 9 cards

- [ ] 5.1 Crear `inteligencia/cards/KPICard.tsx` (~40 líneas).
- [ ] 5.2 Crear `inteligencia/cards/CrossAlertsCard.tsx` (~130 líneas).
- [ ] 5.3 Crear `inteligencia/cards/OTRiskCard.tsx` (~135 líneas).
- [ ] 5.4 Crear `inteligencia/cards/ConsumoCard.tsx` (~115 líneas).
- [ ] 5.5 Crear `inteligencia/cards/ErroresCorteCard.tsx` (~120 líneas).
- [ ] 5.6 Crear `inteligencia/cards/RestockCard.tsx` (~90 líneas).
- [ ] 5.7 Crear `inteligencia/cards/ActivityCard.tsx` (~100 líneas).
- [ ] 5.8 Crear `inteligencia/cards/InsightsCard.tsx` (~140 líneas).
- [ ] 5.9 Crear `inteligencia/cards/StockGeneralCard.tsx` (~175 líneas).
- [ ] 5.10 Actualizar `Inteligencia.tsx` para importar las 9 cards.
- [ ] 5.11 `npx tsc --noEmit --skipLibCheck` → 0 errores. Commit.

## 6. Pasada final — Adelgazar `Inteligencia.tsx`

- [ ] 6.1 Reescribir `Inteligencia.tsx` como orquestador puro: imports + `useInteligenciaData()` + memos derivados + summaryParts + render del header, summary banner, KPI cards, filas de cards, y DiagDialog. Objetivo: ≤200 líneas.
- [ ] 6.2 Verificar que ninguna de las funciones internas viejas, los tipos, las constantes ni los helpers queden en el archivo principal.
- [ ] 6.3 `npx tsc --noEmit --skipLibCheck` → 0 errores. Commit.

## 7. Verificación funcional manual

- [ ] 7.1 Levantar `npm run dev` y abrir `/inteligencia`.
- [ ] 7.2 Esperar que cargue: verificar que aparezcan el header, summary banner (con el texto correcto), 4 KPIs, las 9 cards, sin errores en consola.
- [ ] 7.3 Apretar "Actualizar" y verificar que se vuelven a cargar los datos (el texto "Actualizado HH:mm" cambia).
- [ ] 7.4 Apretar "Diagnóstico IA": el diálogo se abre, los chips de sugerencias están, copia al portapapeles funciona.
- [ ] 7.5 Filtrar por categoría en `StockGeneralCard` y verificar que el chart se filtra.

## 8. Cierre

- [ ] 8.1 `find src/pages/inteligencia src/pages/Inteligencia.tsx -name "*.ts" -o -name "*.tsx" | xargs wc -l`. Confirmar ningún archivo > 400 líneas.
- [ ] 8.2 `npx tsc --noEmit --skipLibCheck` → 0 errores.
- [ ] 8.3 Confirmar que `src/App.tsx` sigue importando `{ Inteligencia }` exactamente igual.
- [ ] 8.4 `openspec archive modularize-inteligencia`.
