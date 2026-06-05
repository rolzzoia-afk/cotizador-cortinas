# Tareas: Modularizar Ventas.tsx

## 1. Preparación

- [ ] 1.1 `npx tsc --noEmit --skipLibCheck` → 0 errores de partida.
- [ ] 1.2 Confirmar que solo `src/App.tsx` importa `{ Ventas }`.
- [ ] 1.3 Crear `src/pages/ventas/{components,secciones,utils}/`.

## 2. Pasada 1 — Tipos, constantes, helpers

- [ ] 2.1 Crear `ventas/Ventas.types.ts` con `KpiConfig`, `Periodo`, `Registro`.
- [ ] 2.2 Crear `ventas/Ventas.config.ts` con `DEFAULT_CONFIG`, `CANAL_COLORS`.
- [ ] 2.3 Crear `ventas/utils/helpers.ts` con `hoyISO`, `slugify`, `iniciales`, `colorPct`.
- [ ] 2.4 Reemplazar inline en `Ventas.tsx` por imports.
- [ ] 2.5 `tsc=0`. Commit.

## 3. Pasada 2 — Componentes hoja

- [ ] 3.1 Crear `ventas/components/SectionHeader.tsx`.
- [ ] 3.2 Crear `ventas/components/Gauge.tsx`.
- [ ] 3.3 Crear `ventas/components/NumInput.tsx`.
- [ ] 3.4 Crear `ventas/components/ChipList.tsx`.
- [ ] 3.5 Crear `ventas/components/ConfigDialog.tsx`.
- [ ] 3.6 Actualizar `Ventas.tsx` para importarlos.
- [ ] 3.7 `tsc=0`. Commit.

## 4. Pasada 3 — Las 6 secciones

- [ ] 4.1 Crear `ventas/secciones/CanalesSection.tsx`.
- [ ] 4.2 Crear `ventas/secciones/LlamadasSection.tsx`.
- [ ] 4.3 Crear `ventas/secciones/MetaVisitasSection.tsx`.
- [ ] 4.4 Crear `ventas/secciones/CierreSection.tsx`.
- [ ] 4.5 Crear `ventas/secciones/TerrenoSection.tsx`.
- [ ] 4.6 Crear `ventas/secciones/HistorialSection.tsx`.
- [ ] 4.7 Actualizar `Ventas.tsx` para importar las 6.
- [ ] 4.8 `tsc=0`. Commit.

## 5. Pasada final — Adelgazar Ventas.tsx

- [ ] 5.1 Reescribir `Ventas.tsx` como orquestador: imports + state + queries + memos + render. Objetivo: ≤300 líneas.
- [ ] 5.2 Verificar que nada inline viejo queda.
- [ ] 5.3 `tsc=0`. Commit.

## 6. Verificación funcional

- [ ] 6.1 `npm run dev` → abrir `/ventas`.
- [ ] 6.2 Verificar que las 5 secciones aparecen, los inputs son editables, el gauge se ve.
- [ ] 6.3 Apretar "Configurar": el modal abre, se pueden agregar/quitar canales/vendedoras.
- [ ] 6.4 Guardar config, recargar, verificar que persiste.
- [ ] 6.5 Editar valores, apretar "Guardar", cambiar de fecha, volver: los valores siguen.
- [ ] 6.6 Cambiar a `Semana` o `Mes`: aparece el bloque Historial con el chart de líneas.

## 7. Cierre

- [ ] 7.1 `find src/pages/ventas src/pages/Ventas.tsx -name "*.ts" -o -name "*.tsx" | xargs wc -l`. Ningún archivo > 400 líneas.
- [ ] 7.2 `tsc=0`.
- [ ] 7.3 Confirmar `src/App.tsx` sin cambios.
- [ ] 7.4 `openspec archive modularize-ventas`.
