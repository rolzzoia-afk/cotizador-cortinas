## Context

`Correcciones.tsx` se construyó incrementalmente a lo largo de varias sesiones: cada vez que el taller necesitaba un nuevo flujo, se agregaba una sección al mismo archivo. Hoy contiene 8 funciones React internas, en este orden y tamaños aproximados:

| Función | Líneas | Qué hace |
|---|---:|---|
| `extraerOTsPlan` (helper) | 12 | Extrae OTs únicas de un plan |
| `Correcciones` (export principal) | 35 | Orquestador |
| `SaludColmenaWidget` | 80 | Semáforo verde/ámbar/rojo |
| `ConfigOptimizador` | 55 | Form para email del optimizador |
| `PlanActivoSection` | 145 | Corrige el plan más reciente |
| `CorreccionRetroactivaSection` | 238 | Corrige planes antiguos |
| `EditorLinea` | 140 | Editor que abre cuando ✏ una línea |
| `HistorialCorrecciones` | 55 | Log de correcciones |
| `HistorialPlanes` | 340 | Lista de planes restaurables |
| `HintColmenaDuplicada` | 20 | Aviso final |

El módulo es crítico para el taller (lo usan a diario) y no tiene tests. Cada función tiene sus propios estados internos y hooks, y el archivo entero importa de `@/modules/admin/correcciones` los hooks de datos (`useOptimizerConfig`, `usePlanActivo`, `useCorreccionesHistorial`, `usePlanesHistorial`, `useSaludColmena`, `useCorreccionRetroactiva`).

## Goals / Non-Goals

**Goals:**

- Ningún archivo del módulo nuevo supera 400 líneas.
- Cada sección queda autocontenida en su archivo: el archivo tiene todo lo que necesita (imports + tipos + componente).
- El orquestador `Correcciones.tsx` queda en ~70 líneas componiendo hijos.
- Patrón replicable: misma estructura de carpetas que `inventario-telas-prueba` (subcomponentes en carpeta hija, utils si hace falta).
- Cero regresiones funcionales.

**Non-Goals:**

- No se agregan tests automáticos (deferred).
- No se toca el módulo admin `src/modules/admin/correcciones.ts`.
- No se cambia ningún flujo del taller — visualmente y funcionalmente idéntico.
- No se conecta el bug pre-existente del botón ✏ Editar Stock detectado en el refactor anterior — eso es otro change.

## Decisions

### D1. Estructura de carpetas

```
src/components/ojo-de-dios/
├── Correcciones.tsx                       ← orquestador (~70 líneas, hoy 1198)
└── correcciones/
    ├── SaludColmenaWidget.tsx             (~85)
    ├── ConfigOptimizador.tsx              (~60)
    ├── PlanActivoSection.tsx              (~150)
    ├── CorreccionRetroactivaSection.tsx   (~245)
    ├── EditorLinea.tsx                    (~145)
    ├── HistorialCorrecciones.tsx          (~60)
    ├── HistorialPlanes.tsx                (~345)
    ├── HintColmenaDuplicada.tsx           (~25)
    └── utils/
        └── extraer-ots-plan.ts            (~15)
```

**Por qué bajo `correcciones/` y no bajo `ojo-de-dios/` directo:** cada tab de Ojo de Dios tiene su propia complejidad. El otro day vimos que `Colmena.tsx` también es grande (1577 líneas). Si más adelante hay otro refactor, queremos `colmena/` paralelo a `correcciones/`. Mantiene escalabilidad.

**Por qué `EditorLinea.tsx` está al mismo nivel que las secciones y no bajo `plan-activo/`:** es usado por dos secciones (`PlanActivoSection` y `CorreccionRetroactivaSection`), no por una sola. Tiene que estar accesible a ambos.

### D2. Estado e imports

Cada sección recibe sus dependencias por props desde `Correcciones.tsx` (mismo patrón que hoy). No vamos a crear contextos React — sería over-engineering para algo que ya funciona.

Los hooks de datos (`useOptimizerConfig`, `usePlanActivo`, etc.) siguen viviendo en `@/modules/admin/correcciones` — no se duplican.

### D3. Función auxiliar `extraerOTsPlan`

Es una función pura sin estado. La sacamos a `utils/extraer-ots-plan.ts` para que sea reutilizable y testeable. La importan `CorreccionRetroactivaSection` y `HistorialPlanes`.

### D4. Orden de migración

5 pasadas chicas con `tsc --noEmit` verde entre cada una. Si una rompe, se revierte sin tocar las anteriores.

1. **Pasada 1** — Utils: `extraer-ots-plan.ts`.
2. **Pasada 2** — Componentes "hoja" (sin dependencias entre sí): `SaludColmenaWidget`, `ConfigOptimizador`, `HintColmenaDuplicada`, `HistorialCorrecciones`.
3. **Pasada 3** — `EditorLinea` (lo usan dos secciones, sacarlo antes que las que lo consumen).
4. **Pasada 4** — Las dos secciones grandes que consumen `EditorLinea`: `PlanActivoSection`, `CorreccionRetroactivaSection`.
5. **Pasada 5** — La última grande: `HistorialPlanes`.
6. **Pasada final** — Reducir `Correcciones.tsx` a orquestador puro.

## Risks / Trade-offs

- **Riesgo:** truncamiento del linter durante el refactor mismo. → **Mitigación:** Usar `Write` (no `Edit`) para crear los archivos hijos, y cuando reescribimos `Correcciones.tsx` al final, hacerlo de una sola vez con el contenido reducido. Si trunca, hay backup en git (commit por pasada).

- **Riesgo:** un componente hijo importa algo que no le pase como prop y rompe en runtime. → **Mitigación:** después de cada pasada, además del `tsc`, hacer una verificación visual en el navegador (entrar a Ojo de Dios → Correcciones y ver que todo renderiza).

- **Riesgo:** `EditorLinea` se usa adentro de `PlanActivoSection` y `CorreccionRetroactivaSection` con un patrón ligeramente distinto. Al extraerlo, podemos romper uno de los dos casos. → **Mitigación:** validar manualmente abrir el editor desde ambas secciones después de Pasada 3.

- **Trade-off:** los archivos hijos van a duplicar algunos imports (de lucide-react, de los hooks del admin module). Es esperable, y es preferible a un único archivo gigante.

## Migration Plan

1. **Antes de empezar:** `npx tsc --noEmit --skipLibCheck` con 0 errores de partida.
2. **Cada pasada:** crear archivos nuevos, actualizar imports en `Correcciones.tsx`, correr `tsc`, commit. NO borrar las funciones del archivo original todavía.
3. **Pasada final:** reescribir `Correcciones.tsx` removiendo todas las funciones internas que ya viven en archivos propios. Verificar que sigue compilando.
4. **Verificación manual:** abrir Ojo de Dios → pestaña Correcciones con un usuario admin. Probar: semáforo, cargar plan activo, marcar una corrección con ✏, abrir corrección retroactiva, abrir historial de planes, ver historial de correcciones, ver el hint final.
5. **Rollback:** si una pasada rompe y no se puede arreglar en el momento, revertir el commit de esa pasada.

## Open Questions

- ¿Vale la pena extraer `EditorLinea` a su propio sub-módulo (con sus tipos internos `TipoError`, etc.) o lo dejamos como componente al mismo nivel que las secciones? Inclinación inicial: al mismo nivel — es un componente, no un sub-módulo.
- El componente `HistorialPlanes` (340 líneas) seguirá siendo el más grande del módulo nuevo. ¿Lo subdividimos también (tarjeta + dialog de preview)? Inclinación inicial: no en este change. Si 340 nos resulta incómodo más adelante, se hace otro change.
