# Tareas: Modularizar HistorialTubos.tsx

## 1. Preparación

- [ ] 1.1 Correr `npx tsc --noEmit --skipLibCheck` y verificar 0 errores de partida.
- [ ] 1.2 Auditar consumidores: confirmar que solo `src/App.tsx` importa `{ HistorialTubos }` desde `@/pages/HistorialTubos`.
- [ ] 1.3 Crear las carpetas `src/pages/historial-tubos/`, `src/pages/historial-tubos/components/`, `src/pages/historial-tubos/vistas/`, `src/pages/historial-tubos/utils/`.

## 2. Pasada 1 — Tipos, constantes y utils

- [ ] 2.1 Crear `historial-tubos/HistorialTubos.types.ts` con los tipos `Evento` y `EvCfg`.
- [ ] 2.2 Crear `historial-tubos/HistorialTubos.config.ts` con las constantes `EV`, `FUENTE_CFG`, `PALETA`. Importa `EvCfg` de los tipos y los íconos de `lucide-react`.
- [ ] 2.3 Crear `historial-tubos/utils/formato-fechas.ts` con `formatFechaHora` y `formatMes`.
- [ ] 2.4 Reemplazar las declaraciones inline en `HistorialTubos.tsx` por imports desde los 3 archivos nuevos.
- [ ] 2.5 Correr `npx tsc --noEmit --skipLibCheck` y verificar 0 errores. Commit.

## 3. Pasada 2 — Componentes hoja sin deps internas

- [ ] 3.1 Crear `historial-tubos/components/TabButton.tsx` (~85 líneas). Recibe `activo: boolean`, `icon: LucideIcon`, `label: string`, `onClick: () => void`.
- [ ] 3.2 Crear `historial-tubos/components/StatBox.tsx` (~15 líneas). Recibe `value: number | string` y `label: string`.
- [ ] 3.3 Crear `historial-tubos/components/EmptyState.tsx` (~12 líneas). Acepta `children: React.ReactNode`.
- [ ] 3.4 Crear `historial-tubos/components/FichaSeccion.tsx` (~45 líneas). Recibe los props que tenía inline.
- [ ] 3.5 Crear `historial-tubos/components/EventoItem.tsx` (~95 líneas). Recibe `e: Evento`. Importa `EV`, `FUENTE_CFG` de la config, `formatFechaHora` del util.
- [ ] 3.6 Actualizar `HistorialTubos.tsx` para importar los 5 componentes nuevos en vez de declararlos inline.
- [ ] 3.7 Correr `npx tsc --noEmit --skipLibCheck` y verificar 0 errores. Commit.

## 4. Pasada 3 — FichaCard (depende de FichaSeccion)

- [ ] 4.1 Crear `historial-tubos/components/FichaCard.tsx` (~195 líneas). Recibe los props que tenía inline. Importa `FichaSeccion`, `formatFechaHora`.
- [ ] 4.2 Actualizar `HistorialTubos.tsx` para importar `FichaCard` desde el archivo nuevo.
- [ ] 4.3 Correr `npx tsc --noEmit --skipLibCheck` y verificar 0 errores. Commit.

## 5. Pasada 4 — Las 3 vistas

- [ ] 5.1 Crear `historial-tubos/vistas/VistaTrazabilidad.tsx` (~225 líneas). Prop: `empresaId: string | null | undefined`. Importa `FichaCard`, `EmptyState`, `Evento`, `formatFechaHora`.
- [ ] 5.2 Crear `historial-tubos/vistas/VistaHistorial.tsx` (~265 líneas). Prop: `empresaId`. Importa `EventoItem`, `EmptyState`, `EV`, `formatFechaHora`, `Evento`.
- [ ] 5.3 Crear `historial-tubos/vistas/VistaMerma.tsx` (~225 líneas). Prop: `empresaId`. Importa `StatBox`, `EmptyState`, `PALETA`, `formatMes`, `Evento`.
- [ ] 5.4 Actualizar `HistorialTubos.tsx` para importar las 3 vistas.
- [ ] 5.5 Correr `npx tsc --noEmit --skipLibCheck` y verificar 0 errores. Commit.

## 6. Pasada final — Adelgazar HistorialTubos.tsx

- [ ] 6.1 Reescribir `HistorialTubos.tsx` como orquestador puro: imports + lectura de `useAuth().empresaId` + `useState` del tab + 3 botones de tab + render condicional de la vista. Objetivo: ≤100 líneas.
- [ ] 6.2 Verificar que ninguna de las funciones internas viejas (`TabButton`, `VistaTrazabilidad`, `FichaCard`, `FichaSeccion`, `VistaHistorial`, `EventoItem`, `VistaMerma`, `StatBox`, `EmptyState`) ni las constantes (`EV`, `FUENTE_CFG`, `PALETA`) ni los helpers (`formatFechaHora`, `formatMes`) ni los tipos (`Evento`, `EvCfg`) queden en el archivo principal.
- [ ] 6.3 Correr `npx tsc --noEmit --skipLibCheck` y verificar 0 errores. Commit.

## 7. Verificación funcional manual

- [ ] 7.1 Levantar `npm run dev` y abrir `/historial-tubos`.
- [ ] 7.2 Tab Trazabilidad: buscar un código de tubo conocido, verificar que aparece la ficha con sus secciones (Ingreso, Cortes, Sobrantes, Mermas, etc.).
- [ ] 7.3 Tab Historial: verificar que la lista de eventos aparece, que se puede filtrar por texto, y que cada evento muestra su ícono y color correctos.
- [ ] 7.4 Tab Merma: verificar que los KPIs aparecen (total kg, # eventos, etc.) y que el chart de barras por mes se renderiza con la paleta correcta.
- [ ] 7.5 Cambiar entre las 3 tabs varias veces y verificar que no hay errores en la consola del browser, especialmente nada de "Rendered more hooks…".

## 8. Cierre

- [ ] 8.1 Auditar tamaño con `find src/pages/historial-tubos src/pages/HistorialTubos.tsx -name "*.ts" -o -name "*.tsx" | xargs wc -l`. Confirmar ningún archivo > 400 líneas.
- [ ] 8.2 `npx tsc --noEmit --skipLibCheck` → 0 errores.
- [ ] 8.3 Confirmar que `src/App.tsx` sigue importando `{ HistorialTubos }` exactamente igual que antes.
- [ ] 8.4 `openspec archive modularize-historial-tubos`.
