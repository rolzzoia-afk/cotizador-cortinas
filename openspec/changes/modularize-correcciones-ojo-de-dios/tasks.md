## 1. Preparación

- [x] 1.1 Correr `npx tsc --noEmit --skipLibCheck` y verificar 0 errores de partida.
- [x] 1.2 Auditar imports externos: confirmar que solo `src/pages/OjoDeDios.tsx` importa `{ Correcciones }` desde el archivo objetivo.
- [x] 1.3 Crear carpeta `src/components/ojo-de-dios/correcciones/` y `src/components/ojo-de-dios/correcciones/utils/`.

## 2. Pasada 1 — Utils puros

- [x] 2.1 Crear `correcciones/utils/extraer-ots-plan.ts` con la función `extraerOTsPlan(plan: PlanResumen): string[]` y su tipo de entrada importado de `@/modules/admin/correcciones`.
- [x] 2.2 Reemplazar la función inline en `Correcciones.tsx` por un import desde `./correcciones/utils/extraer-ots-plan`.
- [x] 2.3 Correr `npx tsc --noEmit --skipLibCheck` y verificar 0 errores. Commit.

## 3. Pasada 2 — Componentes hoja

- [x] 3.1 Crear `correcciones/SaludColmenaWidget.tsx` (~85 líneas). Recibe `salud: ReturnType<typeof useSaludColmena>` como prop. Importa íconos `CheckCircle2, AlertTriangle, X, Loader2, RefreshCw` y el botón shadcn `Button`.
- [x] 3.2 Crear `correcciones/ConfigOptimizador.tsx` (~60 líneas). Recibe `cfg: ReturnType<typeof useOptimizerConfig>` como prop.
- [x] 3.3 Crear `correcciones/HintColmenaDuplicada.tsx` (~25 líneas). Sin props.
- [x] 3.4 Crear `correcciones/HistorialCorrecciones.tsx` (~60 líneas). Recibe `ctx: ReturnType<typeof useCorreccionesHistorial>` como prop.
- [x] 3.5 Actualizar `Correcciones.tsx` para importar los 4 componentes nuevos en vez de declararlos inline.
- [x] 3.6 Correr `npx tsc --noEmit --skipLibCheck` y verificar 0 errores. Commit.

## 4. Pasada 3 — EditorLinea (componente compartido)

- [x] 4.1 Crear `correcciones/EditorLinea.tsx` (~145 líneas). Recibe `idx`, `plan`, `pendiente`, `onCancel`, `onSave`, `onRemove`. Importa `TIPO_ERROR_LABELS` y `type TipoError` desde el admin module.
- [x] 4.2 Actualizar `Correcciones.tsx` para importar `EditorLinea` desde el archivo nuevo.
- [x] 4.3 Correr `npx tsc --noEmit --skipLibCheck` y verificar 0 errores. Commit.

## 5. Pasada 4 — Secciones grandes que consumen EditorLinea

- [x] 5.1 Crear `correcciones/PlanActivoSection.tsx` (~150 líneas). Recibe `ctx: ReturnType<typeof usePlanActivo>`. Importa `EditorLinea` desde `./EditorLinea`.
- [x] 5.2 Crear `correcciones/CorreccionRetroactivaSection.tsx` (~245 líneas). Recibe `planes: ReturnType<typeof usePlanesHistorial>` y `onAplicado: () => void`. Importa `EditorLinea` y `extraerOTsPlan` del utils.
- [x] 5.3 Actualizar `Correcciones.tsx` para importar ambos componentes.
- [x] 5.4 Correr `npx tsc --noEmit --skipLibCheck` y verificar 0 errores. Commit.

## 6. Pasada 5 — HistorialPlanes (el más grande de los hijos)

- [x] 6.1 Crear `correcciones/HistorialPlanes.tsx` (~345 líneas). Recibe `ctx: ReturnType<typeof usePlanesHistorial>` y `email: string`. Importa `extraerOTsPlan`.
- [x] 6.2 Actualizar `Correcciones.tsx` para importar `HistorialPlanes` del archivo nuevo.
- [x] 6.3 Correr `npx tsc --noEmit --skipLibCheck` y verificar 0 errores. Commit.

## 7. Pasada final — Adelgazar Correcciones.tsx

- [x] 7.1 Reescribir `Correcciones.tsx` como orquestador puro: solo imports + `export function Correcciones()` que llama los hooks y compone los 5 componentes hijos + hint. Objetivo: ≤90 líneas.
- [x] 7.2 Verificar que ninguna de las funciones internas viejas (`SaludColmenaWidget`, `ConfigOptimizador`, `PlanActivoSection`, `CorreccionRetroactivaSection`, `EditorLinea`, `HistorialCorrecciones`, `HistorialPlanes`, `HintColmenaDuplicada`, `extraerOTsPlan`) quede en el archivo principal.
- [x] 7.3 Correr `npx tsc --noEmit --skipLibCheck` y verificar 0 errores. Commit.

## 8. Verificación funcional manual

- [x] 8.1 Levantar `npm run dev` y abrir Ojo de Dios → Correcciones con usuario admin.
- [x] 8.2 Verificar que el `SaludColmenaWidget` aparece arriba y muestra el estado (verde/ámbar/rojo).
- [x] 8.3 Probar `ConfigOptimizador`: ver que muestra el email actual y se puede editar.
- [x] 8.4 Apretar "Cargar" en Plan de corte activo. Aparece la tabla con líneas.
- [x] 8.5 Apretar ✏ en una línea. Se abre el `EditorLinea`. Marcar un tipo de error + nota. Guardar. La línea queda con ✏ amarillo. Apretar "Aplicar N corrección(es) al plan". Verificar que se aplica.
- [x] 8.6 En Corrección retroactiva, elegir un plan del dropdown. Aparece la tabla del plan. Apretar ✏ en una línea. Mismo flujo que arriba.
- [x] 8.7 Apretar "Cargar" en Historial de planes. Aparece la lista. Apretar "Vista previa" en uno. Verificar que se ve el preview.
- [x] 8.8 Verificar que el `HintColmenaDuplicada` aparece al final.
- [x] 8.9 Verificar que no hay errores de hooks ("Rendered more hooks…") en la consola al cambiar entre tabs de Ojo de Dios.

## 9. Cierre

- [x] 9.1 Auditar tamaño con `find src/components/ojo-de-dios/correcciones src/components/ojo-de-dios/Correcciones.tsx -name "*.ts" -o -name "*.tsx" | xargs wc -l`. Confirmar ningún archivo > 400 líneas.
- [x] 9.2 `npx tsc --noEmit --skipLibCheck` → 0 errores.
- [x] 9.3 Confirmar que `src/pages/OjoDeDios.tsx` sigue importando `{ Correcciones }` exactamente igual que antes.
- [ ] 9.4 `openspec archive modularize-correcciones-ojo-de-dios`.
